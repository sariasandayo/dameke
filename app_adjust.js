// v1.3.0 攻撃・防御調整ツール
// Reads the calculator's current input as a fixed snapshot (see window.__damekeSnapshotCalculatorInput
// in app.js), then re-runs CALC.calculateDamage() many times with only the chosen side's nature/EVs
// varied, to visualize how much EV investment is needed to cross a given damage threshold.
// calculateDamage() itself is a pure function (verified: no DOM access, no shared mutable state), so
// calling it repeatedly here is safe and does not touch or disturb the live calculator's own state.
(function(){
  'use strict';
  function q(id){ return document.getElementById(id); }

  var NATURE_STAT_MAP = {
    'さみしがり':['A','B'], 'いじっぱり':['A','C'], 'やんちゃ':['A','D'], 'ゆうかん':['A','S'],
    'ずぶとい':['B','A'], 'わんぱく':['B','C'], 'のうてんき':['B','D'], 'のんき':['B','S'],
    'ひかえめ':['C','A'], 'おっとり':['C','B'], 'うっかりや':['C','D'], 'れいせい':['C','S'],
    'おだやか':['D','A'], 'おとなしい':['D','B'], 'しんちょう':['D','C'], 'なまいき':['D','S'],
    'おくびょう':['S','A'], 'せっかち':['S','B'], 'ようき':['S','C'], 'むじゃき':['S','D'],
    'がんばりや':[null,null], 'すなお':[null,null], 'てれや':[null,null], 'きまぐれ':[null,null], 'まじめ':[null,null]
  };
  var ALL_NATURE_NAMES = Object.keys(NATURE_STAT_MAP);
  var STAT_KEYS = ['H','A','B','C','D','S'];

  var STAT_DEPENDENT_MOVE_NAMES = ['フォトンゲイザー', 'てんこがすめつぼうのひかり', 'テラバースト', 'シェルアームズ'];
  function isStatDependentCategoryMove(move){
    if(!move) return false;
    if(STAT_DEPENDENT_MOVE_NAMES.indexOf(move.name) >= 0) return true;
    var H = window.DAMEKE_DATA_HELPERS;
    return !!(H && H.moveTagByName && H.moveTagByName(move.name, 'teraCluster'));
  }
  function normalizeCategory(cat){
    cat = String(cat||'');
    if(cat.indexOf('物理')>=0) return '物理';
    if(cat.indexOf('特殊')>=0) return '特殊';
    if(cat.indexOf('変化')>=0) return '変化';
    return cat;
  }

  var currentMode = 'attacker'; // 'attacker' | 'defender'
  var selectedNatures = {};
  var selectedNaturesForMoveId = null; // move.id + '|' + mode
  // Kept per side (努力値指定 is independent for attacker-mode vs defender-mode, since they're
  // exploring different Pokemon/roles).
  var manualEvSpec = {
    attacker: { H:null, A:null, B:null, C:null, D:null, S:null },
    defender: { H:null, A:null, B:null, C:null, D:null, S:null }
  };
  var selectedThresholdPick = null; // { nature, statKey, ev }

  function getSnapshot(){
    return window.__damekeSnapshotCalculatorInput ? window.__damekeSnapshotCalculatorInput() : null;
  }

  function defaultNaturesForMove(move, mode, defenderPokemon){
    if(isStatDependentCategoryMove(move)) return ['いじっぱり','ようき','ひかえめ','おくびょう'];
    var cat = normalizeCategory(move.category);
    if(mode === 'attacker'){
      if(cat === '物理') return ['いじっぱり','ようき'];
      if(cat === '特殊') return ['ひかえめ','おくびょう'];
    } else {
      // わんぱく/しんちょう/ずぶとい/おだやか are the bulk-boosting natures; いじっぱり/ひかえめ
      // are added as a second, realistic reference (not a defensive nature at all -- neutral for
      // B and D alike -- but a nature this Pokemon might genuinely run as an attacker itself,
      // showing how that choice happens to affect its own bulk). Which of the two depends on
      // whether its own A or C is higher, since that's the stat it would more naturally invest
      // in offensively.
      var base = defenderPokemon ? defenderPokemon.baseStats : null;
      var aGtC = base ? base.A > base.C : true;
      if(cat === '物理') return aGtC ? ['わんぱく','いじっぱり'] : ['ずぶとい','ひかえめ'];
      if(cat === '特殊') return aGtC ? ['しんちょう','いじっぱり'] : ['おだやか','ひかえめ'];
    }
    return ['がんばりや'];
  }

  // ---- Which stat actually drives this move's damage, for a given nature, on a given side ----
  // Checked in order:
  // 1. A handful of moves override the "source stat" outright, independent of category --
  //    confirmed directly against calc.js's own runtime patch (the one piece of code that
  //    actually decides which stat feeds the attack-side multiplier):
  //      - ボディプレス always uses the *attacker's* own B (so on the defender side, this move
  //        behaves like any ordinary 物理 move -- the defender's own B still applies normally).
  //      - イカサマ always uses the *defender's* own A -- meaning on the attacker side, the
  //        attacker's A/C investment has no effect at all (returns null), while on the defender
  //        side, the stat that actually matters is the defender's own A (not B/D as category
  //        would otherwise suggest).
  // 2. Otherwise, category (物理→attacker A / defender B, 特殊→attacker C / defender D) applies
  //    as usual -- but for the handful of moves whose category itself depends on stats (see
  //    isStatDependentCategoryMove), that category can come out differently for different
  //    natures (a nature that boosts one side of the comparison can flip which stat wins even
  //    before any EV is added), so this is decided fresh per nature rather than once for the
  //    whole tool. For シェルアームズ specifically the comparison also depends on the defender's
  //    own B/D, so on the defender side this is genuinely nature-and-EV-sensitive.
  function probeEvs(spec){
    var evs = {};
    STAT_KEYS.forEach(function(k){ evs[k] = spec[k] != null ? spec[k] : 0; });
    return evs;
  }
  function decideRelevantStatKey(snapshot, natureName, side){
    if(side === 'attacker'){
      if(snapshot.move.name === 'ボディプレス') return 'B';
      if(snapshot.move.name === 'イカサマ') return null;
    } else {
      if(snapshot.move.name === 'イカサマ') return 'A';
    }
    var CALC = window.DAMEKE_CALC;
    var sideKey = side === 'attacker' ? 'attackerStats' : 'defenderStats';
    var baseStats = snapshot.options[sideKey];
    var probeStats = Object.assign({}, baseStats, { nature: natureName, evs: probeEvs(manualEvSpec[side]) });
    var probeOptions = Object.assign({}, snapshot.options);
    probeOptions[sideKey] = probeStats;
    var input = { attacker: snapshot.attacker, defender: snapshot.defender, move: snapshot.move, attackerLevel: snapshot.attackerLevel, defenderLevel: snapshot.defenderLevel, options: probeOptions };
    var result = CALC.calculateDamage(input);
    var isPhysical = result.effectiveCategory === '物理';
    if(side === 'attacker') return isPhysical ? 'A' : 'C';
    return isPhysical ? 'B' : 'D';
  }
  function groupNaturesByStatKey(snapshot, natures, side){
    var groups = {};
    var order = [];
    natures.forEach(function(n){
      var key = decideRelevantStatKey(snapshot, n, side) || '__na__';
      if(!groups[key]){ groups[key] = []; order.push(key); }
      groups[key].push(n);
    });
    return { groups: groups, order: order };
  }

  function computeSweepRange(sweptStatKey, spec){
    var otherSum = 0;
    STAT_KEYS.forEach(function(k){
      if(k === sweptStatKey) return;
      otherSum += spec[k] != null ? spec[k] : 0;
    });
    var start = spec[sweptStatKey] != null ? spec[sweptStatKey] : 0;
    var max = Math.min(32, 66 - otherSum);
    if(max < start) max = start;
    return { start: start, max: max, otherSum: otherSum };
  }
  function buildEvs(sweptStatKey, sweptEv, spec){
    var evs = { H:0, A:0, B:0, C:0, D:0, S:0 };
    STAT_KEYS.forEach(function(k){
      evs[k] = (k === sweptStatKey) ? sweptEv : (spec[k] != null ? spec[k] : 0);
    });
    return evs;
  }
  function runSweep(snapshot, natures, statKey, range, side){
    var CALC = window.DAMEKE_CALC;
    var sideKey = side === 'attacker' ? 'attackerStats' : 'defenderStats';
    var baseStats = snapshot.options[sideKey];
    var spec = manualEvSpec[side];
    var lines = {};
    natures.forEach(function(natureName){
      var points = [];
      for(var ev=range.start; ev<=range.max; ev++){
        var stats = Object.assign({}, baseStats, { nature: natureName, evs: buildEvs(statKey, ev, spec) });
        var options = Object.assign({}, snapshot.options);
        options[sideKey] = stats;
        var input = { attacker: snapshot.attacker, defender: snapshot.defender, move: snapshot.move, attackerLevel: snapshot.attackerLevel, defenderLevel: snapshot.defenderLevel, options: options };
        var result = CALC.calculateDamage(input);
        points.push({ ev: ev, minDamage: result.minDamage, maxDamage: result.maxDamage, minRate: result.minRate, maxRate: result.maxRate, category: result.effectiveCategory });
      }
      lines[natureName] = points;
    });
    return lines;
  }

  function computeDefenderMaxHp(snapshot, hEv, natureNameForH){
    var CALC = window.DAMEKE_CALC;
    var baseStats = snapshot.options.defenderStats;
    var spec = manualEvSpec.defender;
    var evs = Object.assign({}, buildEvs('H', hEv, spec));
    var stats = Object.assign({}, baseStats, { nature: natureNameForH || baseStats.nature, evs: evs });
    var options = Object.assign({}, snapshot.options, { defenderStats: stats });
    var probeInput = { attacker: snapshot.attacker, defender: snapshot.defender, move: snapshot.move, attackerLevel: snapshot.attackerLevel, defenderLevel: snapshot.defenderLevel, options: options };
    var result = CALC.calculateDamage(probeInput);
    return result.minRate ? Math.round(result.minDamage / (result.minRate/100)) : 0;
  }

  // ---- Defender-mode 2D optimum search (H x swept stat) ----
  // 努力値指定 is a *minimum*, not a fixed amount -- H and the swept stat (B/D) are both genuinely
  // free to move above whatever minimum was specified, so "必要努力値" here means the smallest
  // possible H+swept-stat *total* that still guarantees (or makes possible) surviving N hits, not
  // a value read off a single fixed-H line. Ties (same total) break toward the larger H, per the
  // stated preference for bulk over the swept stat when the total cost is otherwise identical.
  //
  // HP has no nature modifier (confirmed directly in calc.js's own nature-application function),
  // so it only depends on H EV -- computed once and shared across every nature's search, rather
  // than recomputed per nature.
  function build1DHpArray(snapshot, hMin, hMax){
    var arr = {};
    for(var hEv=hMin; hEv<=hMax; hEv++) arr[hEv] = computeDefenderMaxHp(snapshot, hEv, null);
    return arr;
  }
  // Damage only depends on the swept stat (H never enters the attack-side calculation at all),
  // so this is likewise computed once per nature rather than once per (H,def) pair.
  function build1DDamageArray(snapshot, natureName, sweptStatKey, defMin, defMax){
    var CALC = window.DAMEKE_CALC;
    var baseStats = snapshot.options.defenderStats;
    var spec = manualEvSpec.defender;
    var arr = {};
    for(var defEv=defMin; defEv<=defMax; defEv++){
      var stats = Object.assign({}, baseStats, { nature: natureName, evs: buildEvs(sweptStatKey, defEv, spec) });
      var options = Object.assign({}, snapshot.options, { defenderStats: stats });
      var input = { attacker: snapshot.attacker, defender: snapshot.defender, move: snapshot.move, attackerLevel: snapshot.attackerLevel, defenderLevel: snapshot.defenderLevel, options: options };
      var result = CALC.calculateDamage(input);
      arr[defEv] = { minDamage: result.minDamage, maxDamage: result.maxDamage };
    }
    return arr;
  }
  // Finds the (hEv, defEv) pair with the smallest hEv+defEv total for which `damage*targetN <
  // hp` holds (i.e. N hits at that damage level don't quite reach HP) -- useMaxDamage=true means
  // "確定" (guaranteed survive, using the attacker's worst-case/highest damage roll), false means
  // "乱数" (possibly survive, using the attacker's best-case/lowest damage roll for the defender).
  function search2DOptimal(hpArr, dmgArr, hMin, hMax, defMin, defMax, otherFixedSum, targetN, useMaxDamage){
    var best = null;
    for(var hEv=hMin; hEv<=hMax; hEv++){
      var hp = hpArr[hEv];
      var defCapForThisH = Math.min(defMax, 66 - otherFixedSum - hEv);
      if(defCapForThisH < defMin) continue;
      for(var defEv=defMin; defEv<=defCapForThisH; defEv++){
        var d = dmgArr[defEv];
        if(!d) continue;
        var dmg = useMaxDamage ? d.maxDamage : d.minDamage;
        if(dmg * targetN < hp){
          var total = hEv + defEv;
          if(best === null || total < best.total || (total === best.total && hEv > best.hEv)){
            best = { hEv: hEv, defEv: defEv, total: total };
          }
        }
      }
    }
    return best;
  }
  // Enumerates every N (hits survived) that's achievable anywhere in the grid, for both the
  // 確定 and 乱数 variants, each with its own minimal-total combo -- capped at a generous N so an
  // unusually tanky combination doesn't loop indefinitely.
  var DEFENDER_SURVIVE_N_CAP = 10;
  function computeDefenderThresholds(snapshot, natureName, sweptStatKey, range, hpArr, defMin, defMax, otherFixedSum, hMin, hMax){
    var dmgArr = build1DDamageArray(snapshot, natureName, sweptStatKey, defMin, defMax);
    var rows = [];
    ['確定','乱数'].forEach(function(kind){
      var useMaxDamage = kind === '確定';
      // Baseline is the trivial starting point (whatever minimum was already specified) --
      // never itself shown as a row, same as attacker mode never shows the EV0 (or specified
      // minimum) state as its own row. If that baseline already survives N=1 (very common for
      // bulky Pokemon against weak moves), N=1 legitimately needs no row -- only the first N
      // that actually requires more than the baseline gets one.
      var prevHEv = hMin, prevDefEv = defMin;
      for(var n=1; n<=DEFENDER_SURVIVE_N_CAP; n++){
        var found = search2DOptimal(hpArr, dmgArr, hMin, hMax, defMin, defMax, otherFixedSum, n, useMaxDamage);
        if(!found) break; // once a given N is unreachable even at max investment, higher N won't be either
        if(found.hEv === prevHEv && found.defEv === prevDefEv) continue;
        prevHEv = found.hEv; prevDefEv = found.defEv;
        var d = dmgArr[found.defEv];
        rows.push({ nature: natureName, statKey: sweptStatKey, kind: kind, n: n, hEv: found.hEv, defEv: found.defEv, total: found.total, minDamage: d.minDamage, maxDamage: d.maxDamage });
      }
    });
    return rows;
  }

  var NATURE_COLORS = ['#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed', '#0891b2'];
  function renderSweepGraph(host, lines, natures, hpRef, range, statKey){
    var w = 640, h = 340, padL = 52, padR = 16, padT = 16, padB = 36;
    var innerW = w - padL - padR, innerH = h - padT - padB;
    var evSpan = Math.max(1, range.max - range.start);

    var maxDamage = 0;
    natures.forEach(function(n){ (lines[n]||[]).forEach(function(p){ if(p.maxDamage > maxDamage) maxDamage = p.maxDamage; }); });
    var hpCeiling = hpRef.kind === 'band' ? hpRef.max : hpRef.value;
    var yMax = Math.max(maxDamage, hpCeiling) * 1.08;
    if(yMax <= 0) yMax = 10;

    function xPos(ev){ return padL + ((ev-range.start)/evSpan) * innerW; }
    function yPos(val){ return padT + innerH - (val/yMax) * innerH; }

    var svg = '<svg viewBox="0 0 '+w+' '+h+'" xmlns="http://www.w3.org/2000/svg" class="dameke-adjust-svg">';
    var steps = 5;
    for(var s=0; s<=steps; s++){
      var val = Math.round(yMax * s / steps);
      var y = yPos(val);
      svg += '<line x1="'+padL+'" y1="'+y+'" x2="'+(w-padR)+'" y2="'+y+'" class="dameke-adjust-grid"/>';
      svg += '<text x="'+(padL-6)+'" y="'+(y+3)+'" text-anchor="end" class="dameke-adjust-axis-label">'+val+'</text>';
    }
    var xTicks = [];
    for(var t=0;t<=4;t++) xTicks.push(Math.round(range.start + evSpan*t/4));
    xTicks.forEach(function(ev){
      var x = xPos(ev);
      svg += '<text x="'+x+'" y="'+(h-padB+16)+'" text-anchor="middle" class="dameke-adjust-axis-label">'+ev+'</text>';
    });
    svg += '<text x="'+(w/2)+'" y="'+(h-4)+'" text-anchor="middle" class="dameke-adjust-axis-title">'+statKey+'努力値 ('+range.start+'-'+range.max+')</text>';

    if(hpRef.kind === 'exact' && hpRef.value > 0){
      [1,2,3,4].forEach(function(n){
        var val = hpRef.value / n;
        if(val > yMax) return;
        var y = yPos(val);
        svg += '<line x1="'+padL+'" y1="'+y+'" x2="'+(w-padR)+'" y2="'+y+'" class="dameke-adjust-hp-line"/>';
        svg += '<text x="'+(w-padR-4)+'" y="'+(y-3)+'" text-anchor="end" class="dameke-adjust-hp-label">確定'+n+'発ライン</text>';
      });
    } else if(hpRef.kind === 'band' && hpRef.max > 0){
      [1,2,3,4].forEach(function(n){
        var valLo = hpRef.min / n, valHi = hpRef.max / n;
        if(valLo > yMax) return;
        var yHi = yPos(Math.min(valHi, yMax)), yLo = yPos(valLo);
        svg += '<rect x="'+padL+'" y="'+yHi+'" width="'+innerW+'" height="'+(yLo-yHi)+'" class="dameke-adjust-hp-band"/>';
        svg += '<text x="'+(w-padR-4)+'" y="'+(yHi-3)+'" text-anchor="end" class="dameke-adjust-hp-label">確定'+n+'発帯（HPが取りうる範囲）</text>';
      });
    }
    natures.forEach(function(natureName, idx){
      var points = lines[natureName];
      if(!points || !points.length) return;
      var color = NATURE_COLORS[idx % NATURE_COLORS.length];
      var bandPath = 'M ' + points.map(function(p){ return xPos(p.ev)+','+yPos(p.maxDamage); }).join(' L ');
      bandPath += ' L ' + points.slice().reverse().map(function(p){ return xPos(p.ev)+','+yPos(p.minDamage); }).join(' L ') + ' Z';
      svg += '<path d="'+bandPath+'" fill="'+color+'" fill-opacity="0.15" stroke="none"/>';
      var maxLine = 'M ' + points.map(function(p){ return xPos(p.ev)+','+yPos(p.maxDamage); }).join(' L ');
      var minLine = 'M ' + points.map(function(p){ return xPos(p.ev)+','+yPos(p.minDamage); }).join(' L ');
      svg += '<path d="'+maxLine+'" fill="none" stroke="'+color+'" stroke-width="2"/>';
      svg += '<path d="'+minLine+'" fill="none" stroke="'+color+'" stroke-width="2" stroke-dasharray="4 3"/>';
    });
    svg += '</svg>';
    var legend = '<div class="dameke-adjust-legend">' + natures.map(function(natureName, idx){
      var color = NATURE_COLORS[idx % NATURE_COLORS.length];
      return '<span class="dameke-adjust-legend-item"><span class="dameke-adjust-legend-swatch" style="background:'+color+'"></span>'+natureName+'（実線=最高乱数, 破線=最低乱数）</span>';
    }).join('') + '</div>';
    if(hpRef.kind === 'band'){
      legend += '<div class="dameke-adjust-band-note">確定n発の帯は、HPに投資できる努力値の範囲（「努力値指定」で指定した場合はその値以上、指定していない場合は0以上）に応じて、確定n発ラインが取りうる範囲を暫定的に示したものです。正確な必要努力値は、下の一覧表をご覧ください。</div>';
    }
    host.innerHTML = svg + legend;
  }

  function computeDynamicThresholds(points, hp, natureName, statKey){
    if(!hp) return [];
    var rows = [];
    var prevConfirmed = null, prevPossible = null;
    points.forEach(function(p){
      var confirmedN = p.minDamage > 0 ? Math.ceil(hp / p.minDamage) : Infinity;
      var possibleN = p.maxDamage > 0 ? Math.ceil(hp / p.maxDamage) : Infinity;
      if(confirmedN !== prevConfirmed){
        if(prevConfirmed !== null) rows.push({ nature: natureName, statKey: statKey, ev: p.ev, kind: '確定', n: confirmedN, minDamage: p.minDamage, maxDamage: p.maxDamage });
        prevConfirmed = confirmedN;
      }
      if(possibleN !== prevPossible){
        if(prevPossible !== null) rows.push({ nature: natureName, statKey: statKey, ev: p.ev, kind: '乱数', n: possibleN, minDamage: p.minDamage, maxDamage: p.maxDamage });
        prevPossible = possibleN;
      }
    });
    return rows;
  }
  function renderThresholdTable(host, allRows, side){
    selectedThresholdPick = null;
    var saveBtn = q('damekeAdjustSaveBtn');
    if(saveBtn) saveBtn.disabled = true;
    if(!allRows.length){
      host.innerHTML = '<div class="dameke-adjust-coming-soon">この範囲では、確定n発・乱数n発の数字が変化する地点がありませんでした。</div>';
      return;
    }
    var html;
    if(side === 'defender'){
      html = '<table class="dameke-adjust-threshold-table"><thead><tr><th></th><th>性格</th><th>確定数</th><th>必要努力値</th><th>ダメージ幅</th></tr></thead><tbody>';
      allRows.forEach(function(row, i){
        html += '<tr>'
          + '<td><input type="radio" name="damekeAdjustThresholdPick" data-idx="'+i+'"></td>'
          + '<td>'+row.nature+'</td>'
          + '<td>'+row.kind+row.n+'発耐え</td>'
          + '<td>H：'+row.hEv+'　'+row.statKey+'：'+row.defEv+'</td>'
          + '<td>'+row.minDamage+' ～ '+row.maxDamage+'</td>'
          + '</tr>';
      });
    } else {
      html = '<table class="dameke-adjust-threshold-table"><thead><tr><th></th><th>性格</th><th>確定数</th><th>必要努力値</th><th>ダメージ幅</th></tr></thead><tbody>';
      allRows.forEach(function(row, i){
        html += '<tr>'
          + '<td><input type="radio" name="damekeAdjustThresholdPick" data-idx="'+i+'"></td>'
          + '<td>'+row.nature+'</td>'
          + '<td>'+row.kind+row.n+'発</td>'
          + '<td>'+row.statKey+'：'+row.ev+'</td>'
          + '<td>'+row.minDamage+' ～ '+row.maxDamage+'</td>'
          + '</tr>';
      });
    }
    html += '</tbody></table>';
    host.innerHTML = html;
    host.querySelectorAll('input[type="radio"]').forEach(function(radio){
      radio.addEventListener('change', function(){
        var row = allRows[parseInt(radio.getAttribute('data-idx'), 10)];
        selectedThresholdPick = side === 'defender'
          ? { nature: row.nature, statKey: row.statKey, ev: row.defEv, hEv: row.hEv }
          : { nature: row.nature, statKey: row.statKey, ev: row.ev };
        if(saveBtn) saveBtn.disabled = false;
      });
    });
  }

  function renderManualEvSpec(host, snapshot, side){
    host.innerHTML = '';
    var title = document.createElement('div');
    title.className = 'dameke-adjust-nature-title';
    title.textContent = '努力値指定（任意）：指定した分は固定し、残りだけを自由に動かします';
    host.appendChild(title);
    var pokemon = side === 'attacker' ? snapshot.attacker : snapshot.defender;
    var spec = manualEvSpec[side];
    var base = pokemon.baseStats;
    var table = document.createElement('div');
    table.className = 'dameke-adjust-evspec-table';
    table.style.gridTemplateColumns = '3.4em repeat(6,minmax(2.4em,3.4em))';
    var corner = document.createElement('div');
    table.appendChild(corner);
    STAT_KEYS.forEach(function(k){ var h=document.createElement('div'); h.className='dameke-adjust-evspec-head'; h.textContent=k; table.appendChild(h); });
    var baseLabel = document.createElement('div'); baseLabel.className='dameke-adjust-evspec-rowlabel'; baseLabel.textContent='種族値'; table.appendChild(baseLabel);
    STAT_KEYS.forEach(function(k){ var c=document.createElement('div'); c.className='dameke-adjust-evspec-cell'; c.textContent=base[k]; table.appendChild(c); });
    var evLabel = document.createElement('div'); evLabel.className='dameke-adjust-evspec-rowlabel'; evLabel.textContent='努力値'; table.appendChild(evLabel);
    STAT_KEYS.forEach(function(k){
      var cell = document.createElement('div');
      cell.className = 'dameke-adjust-evspec-cell';
      var input = document.createElement('input');
      input.type = 'number'; input.min = '0'; input.max = '32'; input.placeholder = '-';
      input.className = 'dameke-adjust-evspec-input';
      input.value = spec[k] != null ? spec[k] : '';
      input.addEventListener('change', function(){
        var v = input.value === '' ? null : Math.max(0, Math.min(32, parseInt(input.value,10)||0));
        spec[k] = v;
        renderAndRun();
      });
      cell.appendChild(input);
      table.appendChild(cell);
    });
    host.appendChild(table);

    var remainingEl = document.createElement('div');
    remainingEl.className = 'dameke-adjust-evspec-remaining';
    host.appendChild(remainingEl);
    function updateRemaining(){
      var total = 0;
      STAT_KEYS.forEach(function(k){ total += spec[k] != null ? spec[k] : 0; });
      var remaining = 66 - total;
      remainingEl.textContent = '残り努力値：' + remaining;
      remainingEl.classList.toggle('dameke-adjust-evspec-remaining-over', remaining < 0);
    }
    updateRemaining();
    table.querySelectorAll('.dameke-adjust-evspec-input').forEach(function(inputEl){
      inputEl.addEventListener('input', updateRemaining);
    });
  }

  function renderNatureSelector(host, move, mode, defenderPokemon){
    if(!selectedNaturesForMoveId || selectedNaturesForMoveId !== (move.id+'|'+mode)){
      selectedNatures = {};
      defaultNaturesForMove(move, mode, defenderPokemon).forEach(function(n){ selectedNatures[n] = true; });
      selectedNaturesForMoveId = move.id+'|'+mode;
    }
    host.innerHTML = '';
    var details = document.createElement('details');
    details.className = 'dameke-adjust-nature-details';
    var summary = document.createElement('summary');
    summary.className = 'dameke-adjust-nature-summary';
    function summaryText(){ return '表示する性格（'+Object.keys(selectedNatures).length+'件選択中）'; }
    summary.textContent = summaryText();
    details.appendChild(summary);
    var grid = document.createElement('div');
    grid.className = 'dameke-adjust-nature-grid';
    ALL_NATURE_NAMES.forEach(function(natureName){
      var label = document.createElement('label');
      label.className = 'dameke-adjust-nature-check';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!selectedNatures[natureName];
      cb.addEventListener('change', function(){
        if(cb.checked) selectedNatures[natureName] = true; else delete selectedNatures[natureName];
        summary.textContent = summaryText();
        renderAndRun();
      });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(natureName));
      grid.appendChild(label);
    });
    details.appendChild(grid);
    host.appendChild(details);
  }

  function buildMiniThumb(japaneseName){
    var wrap = document.createElement('div');
    wrap.className = 'dameke-history-thumb';
    var map = window.DAMEKE_POKEMON_IMAGE_IDS;
    var numId = map ? map[japaneseName] : null;
    if(numId){
      var img = document.createElement('img');
      img.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/' + numId + '.png';
      img.alt = japaneseName; img.loading = 'lazy';
      img.onerror = function(){ wrap.classList.add('dameke-history-thumb-missing'); wrap.innerHTML = ''; };
      wrap.appendChild(img);
    } else {
      wrap.classList.add('dameke-history-thumb-missing');
    }
    return wrap;
  }
  function buildFixedSideStatBlock(snapshot, fixedSide){
    var pokemon = fixedSide === 'attacker' ? snapshot.attacker : snapshot.defender;
    var stats = fixedSide === 'attacker' ? snapshot.options.attackerStats : snapshot.options.defenderStats;
    var level = fixedSide === 'attacker' ? snapshot.attackerLevel : snapshot.defenderLevel;
    var label = fixedSide === 'attacker' ? '攻撃側' : '防御側';
    var wrap = document.createElement('div');
    wrap.className = 'dameke-adjust-defender-stats';
    var title = document.createElement('div');
    title.className = 'dameke-adjust-detail-subtitle';
    title.textContent = label+'ステータス（性格：'+stats.nature+'）';
    wrap.appendChild(title);
    var CALC = window.DAMEKE_CALC;
    var actual = CALC.getActualStats(pokemon, level, stats);
    var base = pokemon.baseStats;
    var table = document.createElement('div');
    table.className = 'dameke-adjust-evspec-table';
    table.style.gridTemplateColumns = '3.4em repeat(6,minmax(2.4em,3.4em))';
    var corner = document.createElement('div'); table.appendChild(corner);
    STAT_KEYS.forEach(function(k){ var h=document.createElement('div'); h.className='dameke-adjust-evspec-head'; h.textContent=k; table.appendChild(h); });
    function addRow(rowLabel, valueFn){
      var rl = document.createElement('div'); rl.className='dameke-adjust-evspec-rowlabel'; rl.textContent=rowLabel; table.appendChild(rl);
      STAT_KEYS.forEach(function(k){ var c=document.createElement('div'); c.className='dameke-adjust-evspec-cell'; c.textContent=valueFn(k); table.appendChild(c); });
    }
    addRow('種族値', function(k){ return base[k]; });
    addRow('努力値', function(k){ return stats.evs[k]; });
    addRow('実数値', function(k){ return actual[k]; });
    wrap.appendChild(table);
    return wrap;
  }
  function renderSummary(host, snapshot){
    host.innerHTML = '';
    var note = document.createElement('div');
    note.className = 'dameke-adjust-summary-note';
    note.textContent = 'この条件は計算機の現在の入力から引き継いでいます。変更するには「条件変更」を押してください。';
    host.appendChild(note);

    var row = document.createElement('div');
    row.className = 'dameke-history-header-row';
    row.appendChild(buildMiniThumb(snapshot.attacker.name));
    var textCol = document.createElement('div');
    textCol.className = 'dameke-history-text-col';
    var namesLine = document.createElement('div');
    namesLine.className = 'dameke-history-title';
    namesLine.textContent = snapshot.attacker.name + ' → ' + snapshot.defender.name;
    var moveLine = document.createElement('div');
    moveLine.className = 'dameke-history-move-line';
    moveLine.textContent = snapshot.move.name;
    textCol.appendChild(namesLine); textCol.appendChild(moveLine);
    row.appendChild(textCol);
    row.appendChild(buildMiniThumb(snapshot.defender.name));
    host.appendChild(row);

    var fixedSide = currentMode === 'attacker' ? 'defender' : 'attacker';
    host.appendChild(buildFixedSideStatBlock(snapshot, fixedSide));

    var detailToggle = document.createElement('button');
    detailToggle.type = 'button';
    detailToggle.className = 'dameke-adjust-detail-toggle';
    detailToggle.textContent = '詳細を表示';
    var detailBody = document.createElement('div');
    detailBody.className = 'dameke-adjust-detail-body';
    detailBody.hidden = true;
    var o = snapshot.options;
    var lines = [];
    function addIfSet(label, value){ if(value && value!=='none' && value!=='なし') lines.push(label+'：'+value); }
    addIfSet('攻撃側特性', o.attackerAbilityId);
    addIfSet('攻撃側持ち物', o.attackerItemId);
    addIfSet('攻撃側テラスタル', o.attackerTeraType);
    addIfSet('防御側特性', o.defenderAbilityId);
    addIfSet('防御側持ち物', o.defenderItemId);
    addIfSet('防御側テラスタル', o.defenderTeraType);
    addIfSet('天候', o.weather);
    addIfSet('フィールド', o.field);
    detailBody.innerHTML = lines.length ? lines.map(function(l){ return '<div class="dameke-adjust-detail-line">'+l+'</div>'; }).join('') : '<div class="dameke-adjust-detail-line">その他の特記条件はありません。</div>';
    detailToggle.addEventListener('click', function(){
      detailBody.hidden = !detailBody.hidden;
      detailToggle.textContent = detailBody.hidden ? '詳細を表示' : '詳細を閉じる';
    });
    host.appendChild(detailToggle);
    host.appendChild(detailBody);
  }

  function saveSelectedToPokemonManagement(snapshot){
    if(!selectedThresholdPick) return;
    var side = currentMode;
    var pokemon = side === 'attacker' ? snapshot.attacker : snapshot.defender;
    var level = side === 'attacker' ? snapshot.attackerLevel : snapshot.defenderLevel;
    var ivs = (side === 'attacker' ? snapshot.options.attackerStats : snapshot.options.defenderStats).ivs;
    var abilityId = side === 'attacker' ? snapshot.options.attackerAbilityId : snapshot.options.defenderAbilityId;
    var itemId = side === 'attacker' ? snapshot.options.attackerItemId : snapshot.options.defenderItemId;
    var teraType = side === 'attacker' ? snapshot.options.attackerTeraType : snapshot.options.defenderTeraType;
    var evs = buildEvs(selectedThresholdPick.statKey, selectedThresholdPick.ev, manualEvSpec[side]);
    if(side === 'defender' && selectedThresholdPick.hEv != null) evs.H = selectedThresholdPick.hEv;
    var entry = {
      id: null,
      pokemonId: pokemon.id,
      nickname: '',
      abilityId: abilityId || 'none',
      itemId: itemId || 'none',
      teraType: teraType || 'なし',
      nature: selectedThresholdPick.nature,
      level: level,
      ivs: ivs,
      evs: evs,
      moves: ['', '', '', ''],
      notes: ''
    };
    if(window.__damekeOpenPokemonEditorWithEntry) window.__damekeOpenPokemonEditorWithEntry(entry);
  }

  function renderAndRun(){
    var summaryHost = q('damekeAdjustSummary');
    var evSpecHost = q('damekeAdjustEvSpec');
    var natureHost = q('damekeAdjustNatureSelect');
    var graphHost = q('damekeAdjustGraphHost');
    var thresholdHost = q('damekeAdjustThresholdHost');
    var saveBtn = q('damekeAdjustSaveBtn');
    if(!summaryHost || !graphHost) return;

    var snapshot = getSnapshot();
    if(!snapshot || !snapshot.attacker || !snapshot.defender || !snapshot.move){
      summaryHost.innerHTML = '<div class="dameke-adjust-summary-note">計算機側でポケモン・技を選択してから、こちらのツールをご利用ください。</div>';
      if(evSpecHost) evSpecHost.innerHTML = '';
      natureHost.innerHTML = ''; graphHost.innerHTML = ''; thresholdHost.innerHTML = '';
      if(saveBtn) saveBtn.disabled = true;
      return;
    }

    renderSummary(summaryHost, snapshot);

    var side = currentMode;
    if(evSpecHost) renderManualEvSpec(evSpecHost, snapshot, side);
    renderNatureSelector(natureHost, snapshot.move, currentMode, snapshot.defender);
    var natures = Object.keys(selectedNatures);
    if(!natures.length){
      graphHost.innerHTML = '<div class="dameke-adjust-coming-soon">性格を1つ以上選択してください。</div>';
      thresholdHost.innerHTML = '';
      if(saveBtn) saveBtn.disabled = true;
      return;
    }

    var grouped = groupNaturesByStatKey(snapshot, natures, side);

    var hpRef;
    if(side === 'attacker'){
      var CALC = window.DAMEKE_CALC;
      var probeInput = { attacker: snapshot.attacker, defender: snapshot.defender, move: snapshot.move, attackerLevel: snapshot.attackerLevel, defenderLevel: snapshot.defenderLevel, options: snapshot.options };
      var probeResult = CALC.calculateDamage(probeInput);
      var hp = probeResult.minRate ? Math.round(probeResult.minDamage / (probeResult.minRate/100)) : 0;
      hpRef = { kind: 'exact', value: hp };
    } else {
      // 努力値指定 is a *minimum*, not a fixed value -- specifying H doesn't pin it exactly, it
      // only raises the band's lower edge (the upper edge is still whatever the remaining budget
      // allows). The band only collapses to a single exact line when the minimum itself is 32,
      // since that's the only value with no room left to exceed.
      var hMin = manualEvSpec.defender.H != null ? manualEvSpec.defender.H : 0;
      var otherSumExcludingH = 0;
      STAT_KEYS.forEach(function(k){ if(k!=='H') otherSumExcludingH += manualEvSpec.defender[k] != null ? manualEvSpec.defender[k] : 0; });
      var hMax = Math.min(32, 66 - otherSumExcludingH);
      if(hMax < hMin) hMax = hMin;
      if(hMin >= hMax){
        hpRef = { kind: 'exact', value: computeDefenderMaxHp(snapshot, hMax, null) };
      } else {
        hpRef = { kind: 'band', min: computeDefenderMaxHp(snapshot, hMin, null), max: computeDefenderMaxHp(snapshot, hMax, null) };
      }
    }

    // Shared across every nature/group in defender mode -- HP has no nature modifier, so it only
    // needs computing once for the whole panel, not once per nature.
    var sharedHpArr = null, hMinForSearch = 0, hMaxForSearch = 0;
    if(side === 'defender'){
      hMinForSearch = manualEvSpec.defender.H != null ? manualEvSpec.defender.H : 0;
      var otherSumExcludingHOnly = 0;
      STAT_KEYS.forEach(function(k){ if(k!=='H') otherSumExcludingHOnly += manualEvSpec.defender[k] != null ? manualEvSpec.defender[k] : 0; });
      hMaxForSearch = Math.min(32, 66 - otherSumExcludingHOnly);
      if(hMaxForSearch < hMinForSearch) hMaxForSearch = hMinForSearch;
      sharedHpArr = build1DHpArray(snapshot, hMinForSearch, hMaxForSearch);
    }

    graphHost.innerHTML = '';
    var allThresholdRows = [];
    var hadRealGroup = false;
    grouped.order.forEach(function(statKey){
      var groupNatures = grouped.groups[statKey];
      if(statKey === '__na__'){
        var msg = document.createElement('div');
        msg.className = 'dameke-adjust-coming-soon';
        msg.textContent = (groupNatures.join('・')) + '：' + snapshot.move.name + 'は' + (side==='attacker'?'攻撃側':'防御側') + 'の努力値の影響を受けない技のため、ここでは調整できません。';
        graphHost.appendChild(msg);
        return;
      }
      hadRealGroup = true;
      var range = computeSweepRange(statKey, manualEvSpec[side]);
      var lines = runSweep(snapshot, groupNatures, statKey, range, side);
      var groupHost = document.createElement('div');
      groupHost.className = 'dameke-adjust-graph-group';
      graphHost.appendChild(groupHost);
      renderSweepGraph(groupHost, lines, groupNatures, hpRef, range, statKey);
      if(side === 'attacker'){
        var hpForThresholds = hpRef.value;
        groupNatures.forEach(function(natureName){
          allThresholdRows = allThresholdRows.concat(computeDynamicThresholds(lines[natureName], hpForThresholds, natureName, statKey));
        });
      } else {
        // 2D search: the swept stat's own bounds here exclude H from "otherFixedSum" (H is the
        // second free dimension, not a fixed cost) -- defMin/defMax still come from the same
        // per-stat minimum/32 cap, just without H folded into the budget subtraction.
        var defMin = manualEvSpec.defender[statKey] != null ? manualEvSpec.defender[statKey] : 0;
        var otherSumExcludingHAndSwept = 0;
        STAT_KEYS.forEach(function(k){ if(k!=='H' && k!==statKey) otherSumExcludingHAndSwept += manualEvSpec.defender[k] != null ? manualEvSpec.defender[k] : 0; });
        var defMaxForSearch = Math.min(32, 66 - otherSumExcludingHAndSwept - hMinForSearch);
        if(defMaxForSearch < defMin) defMaxForSearch = defMin;
        groupNatures.forEach(function(natureName){
          allThresholdRows = allThresholdRows.concat(computeDefenderThresholds(snapshot, natureName, statKey, range, sharedHpArr, defMin, defMaxForSearch, otherSumExcludingHAndSwept, hMinForSearch, hMaxForSearch));
        });
      }
    });
    if(!hadRealGroup && !graphHost.innerHTML) graphHost.innerHTML = '<div class="dameke-adjust-coming-soon">選択した性格では調整できる項目がありませんでした。</div>';

    renderThresholdTable(thresholdHost, allThresholdRows, side);

    if(saveBtn){
      saveBtn.onclick = function(){ saveSelectedToPokemonManagement(snapshot); };
    }
  }
  window.__damekeRenderAdjustPanel = renderAndRun;

  function setMode(mode){
    currentMode = mode;
    var atkBtn = q('damekeAdjustModeAttacker'), defBtn = q('damekeAdjustModeDefender');
    if(atkBtn) atkBtn.classList.toggle('dameke-adjust-mode-active', mode==='attacker');
    if(defBtn) defBtn.classList.toggle('dameke-adjust-mode-active', mode==='defender');
    renderAndRun();
  }
  window.__damekeSetAdjustMode = setMode;

  function init(){
    var atkBtn = q('damekeAdjustModeAttacker'), defBtn = q('damekeAdjustModeDefender');
    if(atkBtn) atkBtn.addEventListener('click', function(){ setMode('attacker'); });
    if(defBtn) defBtn.addEventListener('click', function(){ setMode('defender'); });
    var goCalcBtn = q('damekeAdjustGoCalcBtn');
    if(goCalcBtn) goCalcBtn.addEventListener('click', function(){ if(window.__damekeShowPanel) window.__damekeShowPanel('calculator'); });
    var goAdjustAtk = q('damekeGoAdjustAttackerBtn');
    if(goAdjustAtk) goAdjustAtk.addEventListener('click', function(){ if(window.__damekeShowPanel) window.__damekeShowPanel('adjust'); setMode('attacker'); });
    var goAdjustDef = q('damekeGoAdjustDefenderBtn');
    if(goAdjustDef) goAdjustDef.addEventListener('click', function(){ if(window.__damekeShowPanel) window.__damekeShowPanel('adjust'); setMode('defender'); });
    setMode('attacker');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
