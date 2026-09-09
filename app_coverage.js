// v1.8.0 技範囲調整
// For an input Pokemon and up to 4 of its moves, evaluates how much of the Champions-registered
// Pokemon pool those moves can hit for neutral damage or better, and offers a maximizer that
// picks the best 4-move physical/special coverage from the Pokemon's own learnset.
(function(){
  'use strict';
  function q(id){ return document.getElementById(id); }
  var DATA = window.DAMEKE_DATA;
  var CALC = window.DAMEKE_CALC;
  var TYPE_COLOR_MAP = { 'なし':'none', 'ノーマル':'normal', 'ほのお':'fire', 'みず':'water', 'でんき':'electric', 'くさ':'grass', 'こおり':'ice', 'かくとう':'fighting', 'どく':'poison', 'じめん':'ground', 'ひこう':'flying', 'エスパー':'psychic', 'むし':'bug', 'いわ':'rock', 'ゴースト':'ghost', 'ドラゴン':'dragon', 'あく':'dark', 'はがね':'steel', 'フェアリー':'fairy', 'ステラ':'stellar' };
  var ALL_TYPES = CALC.__typeEffectivenessAllTypes || ['ノーマル','ほのお','みず','でんき','くさ','こおり','かくとう','どく','じめん','ひこう','エスパー','むし','いわ','ゴースト','ドラゴン','あく','はがね','フェアリー'];
  function typeColorClass(t){ return 'dameke-type-' + (TYPE_COLOR_MAP[t] || 'none'); }
  function typeBadgesHtml(types){
    return (types||[]).map(function(t){ return '<span class="dameke-party-type-badge '+typeColorClass(t)+'">'+t+'</span>'; }).join('');
  }
  function learnsetKeyFor(name){
    var m = String(name||'').match(/^(.+?)\(([^)]+)\)$/);
    return m ? (m[1] + '_' + m[2]) : name;
  }
  function hasChampionsEntry(p){
    var LS = window.DAMEKE_LEARNSETS;
    return !!(LS && LS.hasLearnset(learnsetKeyFor(p.name)));
  }
  function fillSelect(select, items, placeholder){
    select.textContent = '';
    if(placeholder){ var op0=document.createElement('option'); op0.value=''; op0.textContent=placeholder; select.appendChild(op0); }
    items.forEach(function(item){ var op=document.createElement('option'); op.value=item.id; op.textContent=item.name; select.appendChild(op); });
  }

  var selectedPokemon = null;
  var moveSlots = [ {moveId:'', fixed:false}, {moveId:'', fixed:false}, {moveId:'', fixed:false}, {moveId:'', fixed:false} ];
  // Separate from moveSlots: what the 出力 side actually shows. null means "just mirror the
  // input slots directly". 範囲最大化 sets this to its own result WITHOUT touching moveSlots or
  // re-rendering the input selects, per the "入力欄は変わらず、出力だけが変わる" request; any
  // manual change to an input move select clears it back to null (output tracks input again).
  var displayMoveIds = null;
  var championsCache = null;
  function championsPool(){
    if(!championsCache) championsCache = DATA.pokemons.filter(hasChampionsEntry);
    return championsCache;
  }
  function findMoveById(id){ return DATA.moves.find(function(m){ return m.id===id; }) || null; }
  // 一撃必殺含む固定ダメージ技は、弱点等が存在しないため技範囲の集計対象からは除外するが、
  // 変化技と同様に選択欄には残す（選べるが、集計・最大化候補には使われない）。
  function isEligibleForCoverage(m){ return !m.fixedDamageKind; }

  // ==================== 特性選択 ====================
  var lastAbilityPopulatedForId = undefined;
  function ensureAbilityOptions(pokemon){
    var key = pokemon ? pokemon.id : null;
    if(lastAbilityPopulatedForId === key) return;
    lastAbilityPopulatedForId = key;
    var select = q('damekeCoverageAbility');
    var list = [];
    if(pokemon && pokemon.abilities && pokemon.abilities.length){
      pokemon.abilities.forEach(function(name){
        var found = DATA.abilities.find(function(a){ return a.name===name && a.id!=='なし'; });
        if(found) list.push(found);
      });
    }
    if(!list.length) list.push({ id:'', name:'（特性なし）' });
    fillSelect(select, list);
    if(select._v082hRefreshOptions) select._v082hRefreshOptions();
  }

  // ==================== 詳細条件設定 ====================
  // 持ち物: restricted to the item kinds that actually change a move's type (プレート/きのみ/メ
  // モリ/カセット), per the simplified scope requested.
  var CONDITION_ITEM_KINDS = ['Plate', 'Berry', 'ResistBerry', 'Memory', 'Drive'];
  function conditionItemPool(){
    return DATA.items.filter(function(it){ return CONDITION_ITEM_KINDS.indexOf(it.kind) >= 0; });
  }
  function readConditions(){
    var itemId = q('damekeCoverageItem').value;
    return {
      pokemon: selectedPokemon,
      abilityName: q('damekeCoverageAbility').value || null,
      weather: q('damekeCoverageWeather').value || null,
      field: q('damekeCoverageField').value || null,
      item: itemId ? DATA.items.find(function(it){ return it.id === itemId; }) : null,
      teraType: q('damekeCoverageTeraType').value || null
    };
  }

  // Simplified port of calc.js's own resolveMoveType() -- covers every condition-dependent move
  // it does EXCEPT the battle-transient ones the request explicitly excluded (めざめるパワー,
  // そうでん, プラズマシャワー). Returns the move's effective type string.
  var WEATHER_TYPE_MAP = { 'にほんばれ':'ほのお', 'あめ':'みず', 'すなあらし':'いわ', 'ゆき':'こおり' };
  var FIELD_TYPE_MAP = { 'エレキフィールド':'でんき', 'グラスフィールド':'くさ', 'ミストフィールド':'フェアリー', 'サイコフィールド':'エスパー' };
  var SKIN_ABILITY_TYPE_MAP = { 'エレキスキン':'でんき', 'スカイスキン':'ひこう', 'ドラゴンスキン':'ドラゴン', 'フェアリースキン':'フェアリー', 'フリーズスキン':'こおり' };
  var FORM_DEPENDENT_MOVES = ['レイジングブル', 'オーラぐるま', 'ツタこんぼう'];
  function resolveEffectiveType(move, conditions){
    var type = move.type, locked = false;
    var H = window.DAMEKE_DATA_HELPERS;

    if(!locked && FORM_DEPENDENT_MOVES.indexOf(move.name) >= 0 && conditions.pokemon && H && H.formMoveType){
      var formType = H.formMoveType(move.name, conditions.pokemon, type);
      if(formType){ type = formType; locked = true; }
    }
    if(!locked && conditions.teraType && (move.name === 'テラバースト' || (H && H.moveTag && H.moveTag(move, 'teraCluster')))){
      type = conditions.teraType; locked = true;
    }
    if(!locked && move.name === 'ウェザーボール' && conditions.weather){
      type = WEATHER_TYPE_MAP[conditions.weather] || 'ノーマル'; locked = true;
    }
    if(!locked && move.name === 'だいちのはどう' && conditions.field){
      type = FIELD_TYPE_MAP[conditions.field] || 'ノーマル'; locked = true;
    }
    if(!locked && move.name === 'さばきのつぶて' && conditions.item && conditions.item.kind === 'Plate'){
      type = conditions.item.type; locked = true;
    }
    if(!locked && move.name === 'しぜんのめぐみ' && conditions.item && conditions.item.isBerry && conditions.item.naturalGiftType && conditions.item.naturalGiftType !== '-'){
      type = conditions.item.naturalGiftType; locked = true;
    }
    if(!locked && move.name === 'マルチアタック' && conditions.item && conditions.item.kind === 'Memory'){
      type = conditions.item.type; locked = true;
    }
    if(!locked && move.name === 'テクノバスター' && conditions.item && conditions.item.kind === 'Drive'){
      type = conditions.item.type; locked = true;
    }
    if(!locked && conditions.abilityName){
      if(conditions.abilityName === 'ノーマルスキン'){ type = 'ノーマル'; locked = true; }
      else if(SKIN_ABILITY_TYPE_MAP[conditions.abilityName] && type === 'ノーマル'){ type = SKIN_ABILITY_TYPE_MAP[conditions.abilityName]; locked = true; }
    }
    if(!locked && conditions.abilityName === 'うるおいボイス' && H && H.moveTag && H.moveTag(move, 'sound')){
      type = 'みず'; locked = true;
    }
    return type;
  }
  // The single entry point used everywhere below: resolves the move's effective type through
  // every condition above, then folds in the freezeDry/flyingPress/thousandArrows overrides
  // (which key off the move's own tags, independent of the resolved type) before finally
  // applying the ordinary ability-aware type chart.
  function effectiveRateFor(defenderTypes, defenderAbility, move, conditions){
    var resolvedType = resolveEffectiveType(move, conditions);
    return CALC.computeMoveEffectiveness(defenderTypes, resolvedType, defenderAbility, move.tags);
  }

  // ==================== Coverage computation ====================
  // For a defender, the "best achievable" rate is the highest of the given move types' rates,
  // but the defender is assumed to pick whichever of its own abilities minimizes that -- the
  // standard "opponent plays optimally" assumption used elsewhere in this app (補完ポケモン出力
  // picks the candidate's best defensive ability; here it's the same idea from the attacker's
  // side of the matchup).
  function bestRateForDefender(defender, moves, conditions){
    var abilities = (defender.abilities && defender.abilities.length) ? defender.abilities : [null];
    var worstForAttacker = Infinity;
    abilities.forEach(function(ab){
      var best = 0;
      moves.forEach(function(m){
        var r = effectiveRateFor(defender.types, ab, m, conditions);
        if(r > best) best = r;
      });
      if(best < worstForAttacker) worstForAttacker = best;
    });
    return worstForAttacker;
  }
  function computeCoverage(moves, conditions){
    var champions = championsPool();
    var weakOrMore = [], neutralOrMore = [], halfOrLess = [], immune = [];
    champions.forEach(function(d){
      var rate = bestRateForDefender(d, moves, conditions);
      if(rate > 1) weakOrMore.push(d);
      if(rate >= 1) neutralOrMore.push(d);
      if(rate <= 0.5) halfOrLess.push(d);
      if(rate === 0) immune.push(d);
    });
    return { total: champions.length, weakOrMore: weakOrMore, neutralOrMore: neutralOrMore, halfOrLess: halfOrLess, immune: immune };
  }

  // ==================== Maximizer ====================
  function combinations(arr, k){
    var result = [];
    function helper(start, combo){
      if(combo.length === k){ result.push(combo.slice()); return; }
      for(var i=start;i<arr.length;i++){ combo.push(arr[i]); helper(i+1, combo); combo.pop(); }
    }
    helper(0, []);
    return result;
  }
  function maximizeCoverage(){
    var host = q('damekeCoverageMovesHost');
    var statsHost = q('damekeCoverageStatsHost');
    if(!selectedPokemon) return;
    var LS = window.DAMEKE_LEARNSETS;
    if(!LS) return;
    var key = learnsetKeyFor(selectedPokemon.name);
    if(!LS.hasLearnset(key)) return;
    var learned = LS.getLearnset(key);
    var categoryPhysical = q('damekeCoverageCategoryPhysical').checked;
    var categorySpecial = q('damekeCoverageCategorySpecial').checked;
    var allowedCategories = categoryPhysical ? ['物理'] : (categorySpecial ? ['特殊'] : ['物理','特殊']);
    var excludeNormal = q('damekeCoverageExcludeNormal').checked;
    var conditions = readConditions();
    var learnableMoves = DATA.moves.filter(function(m){
      return isEligibleForCoverage(m) && learned.indexOf(m.name)>=0 && allowedCategories.indexOf(m.category)>=0;
    });
    // The ノーマル技除外 check happens AFTER type resolution (skin abilities etc), so a Normal-
    // type move that a skin ability turns into something else is no longer excluded, while a
    // move that's still Normal after every condition is applied still gets filtered out here.
    var resolvedPool = learnableMoves.map(function(m){
      return { move: m, resolvedType: resolveEffectiveType(m, conditions) };
    }).filter(function(rm){ return !(excludeNormal && rm.resolvedType === 'ノーマル'); });
    var SPECIAL_EFFECT_TAGS = ['freezeDry', 'flyingPress', 'thousandArrows'];
    function bucketKeyFor(rm){
      var specialTag = SPECIAL_EFFECT_TAGS.filter(function(t){ return (rm.move.tags||[]).indexOf(t) >= 0; })[0];
      // Moves with one of these tags have a genuinely different effectiveness profile than an
      // ordinary same-type move (e.g. フリーズドライ hits みず for 2x despite being こおり-typed),
      // so they're never allowed to be silently out-competed by a higher-power plain move of the
      // same resolved type -- each gets its own bucket, on top of (not instead of) the regular
      // per-type one.
      return specialTag ? ('special:'+specialTag) : rm.resolvedType;
    }
    // One move per bucket -- the highest-power learnable move representing that bucket (multiple
    // raw Normal-type moves that all convert to the same skin type compete here too, within the
    // ordinary per-type buckets).
    var byType = {};
    resolvedPool.forEach(function(rm){
      var key = bucketKeyFor(rm);
      if(!byType[key] || (rm.move.power||0) > (byType[key].move.power||0)) byType[key] = rm;
    });
    var fixedMoveIds = {};
    moveSlots.forEach(function(s){ if(s.fixed && s.moveId) fixedMoveIds[s.moveId] = true; });
    var fixedMoves = Object.keys(fixedMoveIds).map(findMoveById).filter(Boolean).filter(isEligibleForCoverage);
    var pool = Object.keys(byType).map(function(t){ return byType[t].move; }).filter(function(m){ return !fixedMoveIds[m.id]; });

    var freeSlotIndices = [];
    moveSlots.forEach(function(s, i){ if(!s.fixed) freeSlotIndices.push(i); });
    var freeCount = freeSlotIndices.length;
    if(freeCount === 0) return; // everything fixed -- nothing to maximize

    if(!pool.length){
      // Genuinely nothing left to offer (e.g. ノーマルスキン + ノーマル技除外 leaves almost
      // nothing) -- this is a normal, expected outcome, not an error.
      host.innerHTML = '';
      statsHost.innerHTML = '<div class="dameke-adjust-summary-note">該当する技がありません。</div>';
      return;
    }

    var champions = championsPool();
    // Precompute each candidate move's rate against every defender/ability once, reused across
    // every combination tried below (same optimization pattern as パーティタイプ評価's swap
    // search).
    var defenderAbilityRates = champions.map(function(d){
      var abilities = (d.abilities && d.abilities.length) ? d.abilities : [null];
      return abilities.map(function(ab){
        return pool.map(function(m){ return effectiveRateFor(d.types, ab, m, conditions); });
      });
    });
    var fixedRatesPerDefender = champions.map(function(d){
      var abilities = (d.abilities && d.abilities.length) ? d.abilities : [null];
      return abilities.map(function(ab){
        var best = 0;
        fixedMoves.forEach(function(m){ var r = effectiveRateFor(d.types, ab, m, conditions); if(r>best) best=r; });
        return best;
      });
    });

    function countNeutralOrMoreForCombo(indices){
      var count = 0;
      for(var di=0; di<defenderAbilityRates.length; di++){
        var abilityRates = defenderAbilityRates[di];
        var fixedRates = fixedRatesPerDefender[di];
        var worstForAttacker = Infinity;
        for(var ai=0; ai<abilityRates.length; ai++){
          var best = fixedRates[ai];
          var rates = abilityRates[ai];
          for(var k=0;k<indices.length;k++){ if(rates[indices[k]] > best) best = rates[indices[k]]; }
          if(best < worstForAttacker) worstForAttacker = best;
        }
        if(worstForAttacker >= 1) count++;
      }
      return count;
    }

    var poolIndices = pool.map(function(_,i){ return i; });
    var k = Math.min(freeCount, poolIndices.length);
    var combos = k > 0 ? combinations(poolIndices, k) : [[]];
    var best = null;
    combos.forEach(function(combo){
      var count = countNeutralOrMoreForCombo(combo);
      if(!best || count > best.count) best = { combo: combo, count: count };
    });
    if(!best) return;
    var chosenMoves = best.combo.map(function(i){ return pool[i]; });
    // Final 4-move set for display only: fixed moves plus the newly chosen ones, together
    // sorted by (resolved) type -- moveSlots (and thus the visible input selects) are never
    // touched here.
    var finalMoves = fixedMoves.concat(chosenMoves);
    finalMoves.sort(function(a,b){
      return ALL_TYPES.indexOf(resolveEffectiveType(a, conditions)) - ALL_TYPES.indexOf(resolveEffectiveType(b, conditions));
    });
    displayMoveIds = finalMoves.map(function(m){ return m.id; });
    renderOutput();
  }

  // ==================== Rendering ====================
  function renderImage(){
    var host = q('damekeCoverageImageHost');
    var typesHost = q('damekeCoverageInputTypes');
    host.innerHTML = '';
    typesHost.innerHTML = '';
    if(!selectedPokemon) return;
    var img = window.__damekeBuildPokemonImage ? window.__damekeBuildPokemonImage(selectedPokemon.name, function(){ host.innerHTML=''; }) : null;
    if(img) host.appendChild(img);
    typesHost.innerHTML = typeBadgesHtml(selectedPokemon.types);
  }

  function renderMoveSlots(){
    var host = q('damekeCoverageMoveSlotsHost');
    host.innerHTML = '';
    var learnableMoves = selectedPokemon && window.__damekeGetFilteredMovesForPokemon
      ? window.__damekeGetFilteredMovesForPokemon(selectedPokemon.id, false)
      : DATA.moves;
    moveSlots.forEach(function(slot, i){
      var cell = document.createElement('div'); cell.className = 'dameke-coverage-move-slot';
      var label = document.createElement('label'); label.className = 'dameke-coverage-move-slot-label'; label.textContent = '技'+(i+1);
      var select = document.createElement('select'); select.id = 'damekeCoverageMove'+i;
      fillSelect(select, learnableMoves, '指定なし');
      select.value = slot.moveId;
      select.addEventListener('change', function(){
        slot.moveId = select.value;
        displayMoveIds = null; // manual edits always take output back to mirroring the input
        renderOutput();
      });
      label.appendChild(select);
      cell.appendChild(label);
      var fixedLabel = document.createElement('label'); fixedLabel.className = 'check dameke-coverage-fixed-check';
      var fixedCb = document.createElement('input'); fixedCb.type = 'checkbox'; fixedCb.checked = slot.fixed;
      fixedCb.addEventListener('change', function(){ slot.fixed = fixedCb.checked; refreshLive(); });
      fixedLabel.appendChild(fixedCb); fixedLabel.appendChild(document.createTextNode('固定'));
      cell.appendChild(fixedLabel);
      host.appendChild(cell);
    });
    if(window.__damekeAttachSearchCombo){
      for(var i=0;i<4;i++) window.__damekeAttachSearchCombo('damekeCoverageMove'+i);
    }
  }

  function buildBreakdownList(host, pokemonList){
    host.innerHTML = '';
    pokemonList.forEach(function(p){
      var chip = document.createElement('div'); chip.className = 'dameke-coverage-breakdown-chip';
      var imgHost = document.createElement('div'); imgHost.className = 'dameke-coverage-breakdown-img';
      var img = window.__damekeBuildPokemonImage ? window.__damekeBuildPokemonImage(p.name, function(){ imgHost.innerHTML=''; }) : null;
      if(img) imgHost.appendChild(img);
      var nameEl = document.createElement('div'); nameEl.className = 'dameke-coverage-breakdown-name'; nameEl.textContent = p.name;
      var typesEl = document.createElement('div'); typesEl.className = 'dameke-search-detail-types'; typesEl.innerHTML = typeBadgesHtml(p.types);
      chip.appendChild(imgHost); chip.appendChild(nameEl); chip.appendChild(typesEl);
      host.appendChild(chip);
    });
  }

  function renderOutput(){
    var movesHost = q('damekeCoverageMovesHost');
    var statsHost = q('damekeCoverageStatsHost');
    var conditions = readConditions();
    var idsToShow = displayMoveIds || moveSlots.map(function(s){ return s.moveId; });
    // 固定ダメージ技は技として表示はするが、弱点等が存在しないため集計対象からは除外する
    var selectedMoves = idsToShow.map(function(id){ return id ? findMoveById(id) : null; }).filter(function(m){ return m && isEligibleForCoverage(m); });

    movesHost.innerHTML = '';
    idsToShow.forEach(function(id){
      var m = id ? findMoveById(id) : null;
      var resolvedType = m ? resolveEffectiveType(m, conditions) : 'なし';
      var cell = document.createElement('div'); cell.className = 'dameke-typecell ' + typeColorClass(resolvedType);
      cell.innerHTML = '<span class="dameke-typecell-name">'+(m ? m.name : '（未選択）')+'</span>';
      movesHost.appendChild(cell);
    });

    statsHost.innerHTML = '';
    if(!selectedMoves.length){
      statsHost.innerHTML = '<div class="dameke-adjust-summary-note">技を1つ以上選択してください。</div>';
      return;
    }
    var result = computeCoverage(selectedMoves, conditions);
    function statRow(label, list, cls){
      var pct = result.total ? (100*list.length/result.total) : 0;
      var row = document.createElement('div'); row.className = 'dameke-coverage-stat-row ' + cls;
      var head = document.createElement('div'); head.className = 'dameke-coverage-stat-head';
      head.innerHTML = '<span class="dameke-coverage-stat-label">'+label+'</span>'
        + '<span class="dameke-coverage-stat-value">'+list.length+' / '+result.total+'（'+pct.toFixed(1)+'%）</span>';
      row.appendChild(head);
      return row;
    }
    function statRowWithFold(label, list, cls, foldLabel){
      var row = statRow(label, list, cls);
      var details = document.createElement('details'); details.className = 'dameke-coverage-breakdown-fold';
      var summary = document.createElement('summary'); summary.textContent = foldLabel + '（' + list.length + '件）';
      details.appendChild(summary);
      var listHost = document.createElement('div'); listHost.className = 'dameke-coverage-breakdown-list';
      details.appendChild(listHost);
      details.addEventListener('toggle', function(){
        if(details.open && !listHost.childElementCount) buildBreakdownList(listHost, list);
      });
      row.appendChild(details);
      statsHost.appendChild(row);
    }
    statsHost.appendChild(statRow('いずれかで弱点以上', result.weakOrMore, 'dameke-coverage-stat-weak'));
    statsHost.appendChild(statRow('いずれかで等倍以上', result.neutralOrMore, 'dameke-coverage-stat-neutral'));
    statRowWithFold('すべて使っても半減以下', result.halfOrLess, 'dameke-coverage-stat-half', '内訳');
    statRowWithFold('すべて使っても無効', result.immune, 'dameke-coverage-stat-immune', '内訳');
  }

  // ==================== Load from ポケモン管理 ====================
  function closePicker(){
    var host = q('damekeCoveragePickerHost');
    host.hidden = true;
    host.innerHTML = '';
  }
  function openPicker(){
    var host = q('damekeCoveragePickerHost');
    var list = window.__damekeLoadPokemonList ? window.__damekeLoadPokemonList() : [];
    host.innerHTML = '';
    var banner = document.createElement('div'); banner.className = 'dameke-pokemon-create-banner';
    var text = document.createElement('span');
    text.textContent = list.length ? '呼び出すポケモンのカードを下から選んでください。' : 'ポケモン管理に保存されたポケモンがまだありません。';
    banner.appendChild(text);
    var cancelBtn = document.createElement('button'); cancelBtn.type='button'; cancelBtn.className='dameke-pokemon-edit-cancel'; cancelBtn.textContent='キャンセル';
    cancelBtn.addEventListener('click', closePicker);
    banner.appendChild(cancelBtn);
    host.appendChild(banner);
    if(window.__damekeBuildPokemonCard){
      list.forEach(function(entry){
        host.appendChild(window.__damekeBuildPokemonCard(entry, function(picked){
          applyPickedEntry(picked);
          closePicker();
        }));
      });
    }
    host.hidden = false;
  }
  function applyPickedEntry(entry){
    var pokemonSelect = q('damekeCoveragePokemon');
    pokemonSelect.value = entry.pokemonId;
    if(pokemonSelect._v082hRefreshOptions) pokemonSelect._v082hRefreshOptions();
    selectedPokemon = DATA.pokemons.find(function(p){ return p.id === entry.pokemonId; }) || null;
    for(var i=0;i<4;i++){
      var mid = (entry.moves||[])[i];
      moveSlots[i] = { moveId: (mid && mid !== 'none') ? mid : '', fixed: false };
    }
    displayMoveIds = null;
    renderAll();
    if(entry.abilityId && entry.abilityId !== 'none' && entry.abilityId !== 'なし'){
      var abilitySelect = q('damekeCoverageAbility');
      abilitySelect.value = entry.abilityId;
      if(abilitySelect._v082hRefreshOptions) abilitySelect._v082hRefreshOptions();
      renderOutput();
    }
  }

  // ==================== Save to ポケモン管理 ====================
  function currentMoveIds(){
    var ids = displayMoveIds || moveSlots.map(function(s){ return s.moveId; });
    var padded = ids.slice(0,4);
    while(padded.length < 4) padded.push('');
    return padded.map(function(v){ return v || ''; });
  }
  function findExactMatch(){
    if(!selectedPokemon || !window.__damekeLoadPokemonList) return null;
    var ids = currentMoveIds();
    var list = window.__damekeLoadPokemonList();
    return list.find(function(e){
      var em = (e.moves||['','','','']).map(function(v){ return (v && v!=='none') ? v : ''; });
      return e.pokemonId === selectedPokemon.id && em[0]===ids[0] && em[1]===ids[1] && em[2]===ids[2] && em[3]===ids[3];
    }) || null;
  }
  function doSave(){
    if(!selectedPokemon) return;
    function buildNewEntry(existingId){
      return {
        id: existingId || null,
        pokemonId: selectedPokemon.id,
        nickname: '',
        abilityId: q('damekeCoverageAbility').value || 'none', itemId: 'none', teraType: 'なし',
        nature: 'まじめ',
        level: '50',
        ivs: { H:31,A:31,B:31,C:31,D:31,S:31 },
        evs: { H:0,A:0,B:0,C:0,D:0,S:0 },
        moves: currentMoveIds(),
        notes: ''
      };
    }
    var match = findExactMatch();
    if(!match){
      if(window.__damekeOpenPokemonEditorWithEntry) window.__damekeOpenPokemonEditorWithEntry(buildNewEntry(null));
      return;
    }
    var chosen = window.confirm(
      '入力内容と完全に一致するポケモンが「'+ (match.nickname || selectedPokemon.name) +'」としてポケモン管理に見つかりました。\n'
      + 'OK：このポケモンを更新\nキャンセル：新規のポケモンとして保存'
    );
    if(chosen){
      if(window.__damekeOpenPokemonEditorWithEntry) window.__damekeOpenPokemonEditorWithEntry(JSON.parse(JSON.stringify(match)));
    } else {
      if(window.__damekeOpenPokemonEditorWithEntry) window.__damekeOpenPokemonEditorWithEntry(buildNewEntry(null));
    }
  }

  // ==================== Init ====================
  function renderAll(){
    ensureAbilityOptions(selectedPokemon);
    renderImage();
    renderMoveSlots();
    renderOutput();
  }
  // While a 範囲最大化 result is being shown, condition changes re-run the maximizer live
  // instead of requiring another button press; otherwise they just recompute the stats for
  // whatever's currently in the input slots.
  function refreshLive(){
    if(displayMoveIds) maximizeCoverage();
    else renderOutput();
  }

  function updateTeraTypeColor(){
    var select = q('damekeCoverageTeraType');
    select.classList.add('dameke-type-select');
    Object.keys(TYPE_COLOR_MAP).forEach(function(k){ select.classList.remove('dameke-type-' + TYPE_COLOR_MAP[k]); });
    select.classList.add(typeColorClass(select.value || 'なし'));
  }

  function init(){
    var pokemonSelect = q('damekeCoveragePokemon');
    var learnablePokemon = DATA.pokemons.filter(hasChampionsEntry);
    fillSelect(pokemonSelect, learnablePokemon, '指定なし');
    if(window.__damekeAttachSearchCombo) window.__damekeAttachSearchCombo('damekeCoveragePokemon');
    ensureAbilityOptions(null);
    if(window.__damekeAttachSearchCombo) window.__damekeAttachSearchCombo('damekeCoverageAbility');

    var itemSelect = q('damekeCoverageItem');
    fillSelect(itemSelect, conditionItemPool(), 'なし');
    if(window.__damekeAttachSearchCombo) window.__damekeAttachSearchCombo('damekeCoverageItem');

    var teraSelect = q('damekeCoverageTeraType');
    fillSelect(teraSelect, ALL_TYPES.map(function(t){ return { id:t, name:t }; }), 'なし');
    updateTeraTypeColor();

    pokemonSelect.addEventListener('change', function(){
      var id = pokemonSelect.value;
      selectedPokemon = id ? DATA.pokemons.find(function(p){ return p.id===id; }) : null;
      moveSlots = [ {moveId:'', fixed:false}, {moveId:'', fixed:false}, {moveId:'', fixed:false}, {moveId:'', fixed:false} ];
      displayMoveIds = null;
      renderAll();
    });
    q('damekeCoverageLoadBtn').addEventListener('click', openPicker);
    q('damekeCoverageMaximizeBtn').addEventListener('click', maximizeCoverage);
    q('damekeCoverageSaveBtn').addEventListener('click', doSave);
    // While a 範囲最大化 result is being shown, any condition that could change what "best" means
    // (category filters, ノーマル技除外, or any of the 詳細条件設定 fields) re-runs the maximizer
    // live instead of requiring another button press. If no maximize result is active, these
    // just recompute the stats for whatever's currently in the input slots.
    var physicalCb = q('damekeCoverageCategoryPhysical');
    var specialCb = q('damekeCoverageCategorySpecial');
    physicalCb.addEventListener('change', function(){ if(physicalCb.checked) specialCb.checked = false; refreshLive(); });
    specialCb.addEventListener('change', function(){ if(specialCb.checked) physicalCb.checked = false; refreshLive(); });
    q('damekeCoverageExcludeNormal').addEventListener('change', refreshLive);
    q('damekeCoverageAbility').addEventListener('change', refreshLive);
    q('damekeCoverageWeather').addEventListener('change', refreshLive);
    q('damekeCoverageField').addEventListener('change', refreshLive);
    q('damekeCoverageItem').addEventListener('change', refreshLive);
    teraSelect.addEventListener('change', function(){ updateTeraTypeColor(); refreshLive(); });

    renderAll();
  }
  window.__damekeRenderCoveragePanel = function(){
    if(!q('damekeCoveragePokemon').options.length) init();
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
