// v0.63 runtime calculation fix: final type-0 propagation and data-driven multi-hit display
(function(){
  var root = (typeof window !== 'undefined') ? window : globalThis;
  var C = root.DAMEKE_CALC;
  var D = root.DAMEKE_DATA;
  if(!C || !C.calculateDamage || C.__v063TypeZeroMultiHitFixed) return;

  function arr(x){ return Array.isArray(x) ? x : []; }
  function num(v, f){ var n = parseInt(v, 10); return Number.isFinite(n) ? n : f; }
  function hasTag(obj, tag){ return arr(obj && obj.tags).indexOf(tag) >= 0 || arr(obj && obj.effectTags).indexOf(tag) >= 0; }
  function setTrace(result, labelPart, name, value, note){
    result.trace = arr(result.trace);
    var line = result.trace.find(function(x){ return String(x.label || '').indexOf(labelPart) >= 0; });
    if(line){
      line.name = name;
      line.value = value;
      if(note != null) line.note = note;
      line.implemented = true;
    } else {
      result.trace.push({ label: labelPart, name: name, value: value, note: note || '', implemented: true });
    }
  }
  function forceZeroDamage(result, reason){
    result.rolls = [0];
    result.multiHitRolls = null;
    result.minDamage = 0;
    result.maxDamage = 0;
    result.minRate = 0;
    result.maxRate = 0;
    result.typeRate4096 = 0;
    setTrace(result, 'N64 ダメージ変動値', '相性', '0/4096 (0.00倍)', reason || 'タイプ相性により無効');
    setTrace(result, 'N66 ダメージ補正値', '全補正', '範囲=4096 / おやこあい=4096 / 天候=4096 / きょけんとつげき=4096 / 急所=4096 / STAB=' + (result.stabRate4096 || 4096) + ' / 相性=0 / やけど=4096 / その他=4096 / まもる=4096', 'v0.63: typeRate4096=0 を最終補正へ反映');
    setTrace(result, 'N68 乱数', '85から100', '0', 'v0.63: ' + (reason || 'タイプ相性により無効'));
    setTrace(result, 'N81 無効要素', '現在値', reason || 'タイプ相性により無効', 'v0.63');
  }
  function getHitSpec(move){
    if(!move) return null;
    var min = move.hitCountMin != null ? num(move.hitCountMin, 1) : null;
    var max = move.hitCountMax != null ? num(move.hitCountMax, 1) : null;
    var hitCount = move.hitCount != null ? num(move.hitCount, 1) : null;
    if(min == null && max == null && hitCount == null && !hasTag(move, 'multiHit')) return null;
    if(min == null) min = hitCount || max || 1;
    if(max == null) max = hitCount || min || 1;
    min = Math.max(1, min);
    max = Math.max(min, max);
    if(max <= 1) return null;
    return { min:min, max:max, fixed:(min === max) };
  }
  function parsePowersFromTrace(result, fallbackPower){
    var line = arr(result.trace).find(function(x){ return String(x.label || '').indexOf('変動後威力') >= 0; });
    var text = line ? String(line.value || '') : '';
    var out = [];
    var re = /(d+)回目=(d+)/g;
    var m;
    while((m = re.exec(text))) out.push(num(m[2], fallbackPower || 1));
    if(out.length) return out;
    if(arr(result.hitPlan).length) return arr(result.hitPlan).map(function(h){ return num(h.basePower, fallbackPower || 1); });
    return [num(fallbackPower, 1)];
  }
  function applyDataDrivenMultiHit(result, input){
    var move = input && input.move;
    var spec = getHitSpec(move);
    if(!spec) return;
    if(result.typeRate4096 === 0) return;
    if((result.effectiveCategory || move.category) === '変化') return;
    if(arr(result.multiHitRolls).length > 0) return;
    if(arr(result.hitPlan).length > 1) return;
    if(!arr(result.rolls).length) return;

    var singleRolls = arr(result.rolls).map(function(x){ return num(x, 0); });
    var basePower = parsePowersFromTrace(result, move.power)[0] || move.power || 1;
    var countForSummary = spec.max;
    var totalRolls = singleRolls.map(function(x){ return x * countForSummary; });
    var hitPlan = [];
    for(var i=1; i<=countForSummary; i++) hitPlan.push({ hitIndex:i, basePower:basePower, note: spec.fixed ? '固定' + countForSummary + '回' : spec.min + '-' + spec.max + '回技の最大回数表示' });

    result.hitPlan = hitPlan;
    result.rolls = totalRolls;
    result.multiHitRolls = totalRolls.map(function(total, idx){
      var rnd = 85 + idx;
      return rnd + ': ' + singleRolls[idx] + ' x ' + countForSummary + ' = ' + total + (spec.fixed ? '' : '（最大' + countForSummary + '回時。最小' + spec.min + '回は ' + (singleRolls[idx] * spec.min) + '）');
    });
    result.minDamage = Math.min.apply(null, totalRolls);
    result.maxDamage = Math.max.apply(null, totalRolls);
    var hp = result.defenderMaxHp || 1;
    result.minRate = hp ? result.minDamage / hp * 100 : 0;
    result.maxRate = hp ? result.maxDamage / hp * 100 : 0;

    setTrace(result, '連続攻撃', 'ヒット数', spec.fixed ? String(countForSummary) + '回' : String(spec.min) + '-' + String(spec.max) + '回', 'v0.63: move.hitCountMin/hitCountMax から反映');
    setTrace(result, 'N46 変動後威力', 'HitPlan', hitPlan.map(function(h){ return h.hitIndex + '回目=' + h.basePower + '（' + h.note + '）'; }).join(' / '), 'v0.63: データ駆動連続攻撃');
  }

  var previous = C.calculateDamage.bind(C);
  C.calculateDamage = function(input){
    var result = previous(input);
    if(result && result.typeRate4096 === 0){
      forceZeroDamage(result, 'タイプ相性により無効');
      return result;
    }
    applyDataDrivenMultiHit(result, input || {});
    return result;
  };
  C.__v063TypeZeroMultiHitFixed = true;
})();
