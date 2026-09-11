// v1.5.0 ポケモン検索
// Filters the full roster live against multiple simultaneous conditions, then shows a Pokedex-
// style detail view (ranks among all Pokemon, full type matchup via the shared
// window.DAMEKE_CALC.computeTypeEffectiveness, learnset, related forms, and jump-to-calculator).
(function(){
  'use strict';
  function q(id){ return document.getElementById(id); }
  var DATA = window.DAMEKE_DATA;
  var CALC = window.DAMEKE_CALC;
  var STAT_KEYS = ['H','A','B','C','D','S'];
  var ALL_TYPES = CALC.__typeEffectivenessAllTypes || ['ノーマル','ほのお','みず','でんき','くさ','こおり','かくとう','どく','じめん','ひこう','エスパー','むし','いわ','ゴースト','ドラゴン','あく','はがね','フェアリー'];
  var TYPE_ORDER = ALL_TYPES;
  var TYPE_COLOR_MAP = { 'なし':'none', 'ノーマル':'normal', 'ほのお':'fire', 'みず':'water', 'でんき':'electric', 'くさ':'grass', 'こおり':'ice', 'かくとう':'fighting', 'どく':'poison', 'じめん':'ground', 'ひこう':'flying', 'エスパー':'psychic', 'むし':'bug', 'いわ':'rock', 'ゴースト':'ghost', 'ドラゴン':'dragon', 'あく':'dark', 'はがね':'steel', 'フェアリー':'fairy', 'ステラ':'stellar' };
  function typeColorClass(t){ return 'dameke-type-' + (TYPE_COLOR_MAP[t] || 'none'); }

  var NATURE_STAT_MAP = {
    'さみしがり':['A','B'], 'いじっぱり':['A','C'], 'やんちゃ':['A','D'], 'ゆうかん':['A','S'],
    'ずぶとい':['B','A'], 'わんぱく':['B','C'], 'のうてんき':['B','D'], 'のんき':['B','S'],
    'ひかえめ':['C','A'], 'おっとり':['C','B'], 'うっかりや':['C','D'], 'れいせい':['C','S'],
    'おだやか':['D','A'], 'おとなしい':['D','B'], 'しんちょう':['D','C'], 'なまいき':['D','S'],
    'おくびょう':['S','A'], 'せっかち':['S','B'], 'ようき':['S','C'], 'むじゃき':['S','D']
  };
  var UP_NATURE_FOR = {}, DOWN_NATURE_FOR = {};
  Object.keys(NATURE_STAT_MAP).forEach(function(n){
    var pair = NATURE_STAT_MAP[n];
    if(!UP_NATURE_FOR[pair[0]]) UP_NATURE_FOR[pair[0]] = n;
    if(!DOWN_NATURE_FOR[pair[1]]) DOWN_NATURE_FOR[pair[1]] = n;
  });

  function learnsetKeyFor(name){
    var m = String(name||'').match(/^(.+?)\(([^)]+)\)$/);
    return m ? (m[1] + '_' + m[2]) : name;
  }
  function pokemonLearnset(p){
    var LS = window.DAMEKE_LEARNSETS;
    if(!LS) return null;
    var key = learnsetKeyFor(p.name);
    return LS.hasLearnset(key) ? LS.getLearnset(key) : null;
  }
  function hasChampionsEntry(p){ return !!pokemonLearnset(p); }
  function totalBaseStat(p){ return STAT_KEYS.reduce(function(sum,k){ return sum + p.baseStats[k]; }, 0); }

  var rankCache = null;
  function buildRankCache(){
    if(rankCache) return rankCache;
    var keys = STAT_KEYS.concat(['total']);
    var cache = {};
    keys.forEach(function(k){
      var values = DATA.pokemons.map(function(p){ return k==='total' ? totalBaseStat(p) : p.baseStats[k]; });
      cache[k] = values.slice().sort(function(a,b){ return b-a; });
    });
    rankCache = cache;
    return cache;
  }
  function rankOf(value, k){
    var arr = buildRankCache()[k];
    var idx = arr.findIndex(function(v){ return v <= value; });
    return { rank: idx + 1, total: arr.length };
  }

  var dataBounds = null;
  function buildDataBounds(){
    if(dataBounds) return dataBounds;
    var b = {};
    STAT_KEYS.forEach(function(k){
      var values = DATA.pokemons.map(function(p){ return p.baseStats[k]; });
      b[k] = [Math.min.apply(null, values), Math.max.apply(null, values)];
    });
    var totals = DATA.pokemons.map(totalBaseStat);
    b.total = [Math.min.apply(null, totals), Math.max.apply(null, totals)];
    var weights = DATA.pokemons.map(function(p){ return p.weight; }).filter(function(w){ return w != null; });
    b.weight = [Math.min.apply(null, weights), Math.max.apply(null, weights)];
    dataBounds = b;
    return b;
  }

  function statRefRange(p, k){
    var ivs = { H:31,A:31,B:31,C:31,D:31,S:31 };
    function actual(ev, nature){
      var evs = { H:0,A:0,B:0,C:0,D:0,S:0 }; evs[k] = ev;
      return CALC.getActualStats(p, '50', { ivs:ivs, evs:evs, ranks:{A:0,B:0,C:0,D:0,S:0,acc:0,eva:0}, nature:nature })[k];
    }
    if(k === 'H') return { min: actual(0,'まじめ'), neutral: actual(0,'まじめ'), max: actual(32,'まじめ') };
    return { min: actual(0, DOWN_NATURE_FOR[k]||'まじめ'), neutral: actual(0, 'まじめ'), max: actual(32, UP_NATURE_FOR[k]||'まじめ') };
  }

  function defaultFilters(){
    return {
      name: '',
      type1: '', type2: '',
      matchupConditions: [{type:'', category:''}],
      ability: '',
      moveConditions: [{name:'', type:'', category:'', minPower:null, minAccuracy:null}],
      statRange: {},
      totalRange: [null,null],
      weightRange: [null,null],
      finalEvoOnly: false,
      championsOnly: false
    };
  }
  var filters = defaultFilters();
  var sortBy = 'dex'; // 'dex' | 'kana' | 'stat' | 'weight'
  var sortStatKey = 'total'; // used when sortBy==='stat': H/A/B/C/D/S/total
  function kanaNormalize(s){ return String(s||'').replace(/[\u30a1-\u30f6]/g, function(c){ return String.fromCharCode(c.charCodeAt(0)-0x60); }).toLowerCase(); }
  // 「等倍以下」「半減以下」「1/4以下」の3段階。それぞれ、無効(0倍)も含めて「その水準以下」を
  // 満たすかどうかで判定する(等倍以下なら半減・1/4・無効もすべて該当)。
  function matchupSatisfies(rate, category){
    if(category === '等倍以下') return rate <= 1;
    if(category === '半減以下') return rate <= 0.5;
    if(category === '1/4以下') return rate <= 0.25;
    return false;
  }
  function inRange(val, range){
    if(range[0] != null && val < range[0]) return false;
    if(range[1] != null && val > range[1]) return false;
    return true;
  }
  function matchesFilters(p){
    if(filters.name && kanaNormalize(p.name).indexOf(kanaNormalize(filters.name)) === -1) return false;
    if(filters.type1 && (p.types||[]).indexOf(filters.type1) === -1) return false;
    if(filters.type2 && (p.types||[]).indexOf(filters.type2) === -1) return false;
    // タイプ相性: 有効な条件(タイプ・段階とも指定済み)をすべてAND条件として満たす必要がある。
    var activeMatchups = filters.matchupConditions.filter(function(c){ return c.type && c.category; });
    if(activeMatchups.length){
      var abilityList = (p.abilities||[]).length ? p.abilities : [null];
      var allMatchupsOk = activeMatchups.every(function(cond){
        return abilityList.some(function(abName){
          var rate = CALC.computeTypeEffectiveness(p.types, cond.type, abName);
          return matchupSatisfies(rate, cond.category);
        });
      });
      if(!allMatchupsOk) return false;
    }
    if(filters.ability && (p.abilities||[]).indexOf(filters.ability) === -1) return false;
    // 覚える技: 技名が指定されたスロットはその技名のみで判定(他の項目は無視)。技名未指定なら
    // タイプ/分類/威力下限/命中下限をAND条件として満たす技を1つでも覚えていればそのスロットは
    // 合格。スロット同士もAND条件。
    var activeMoveConds = filters.moveConditions.filter(function(c){
      return c.name || c.type || c.category || c.minPower != null || c.minAccuracy != null;
    });
    if(activeMoveConds.length){
      var learned = pokemonLearnset(p);
      if(!learned) return false;
      var allSlotsOk = activeMoveConds.every(function(cond){
        if(cond.name) return learned.indexOf(cond.name) >= 0;
        return learned.some(function(moveName){
          var m = DATA.moves.find(function(x){ return x.name === moveName; });
          if(!m) return false;
          if(cond.type && m.type !== cond.type) return false;
          if(cond.category && m.category !== cond.category) return false;
          if(cond.minPower != null && (m.power||0) < cond.minPower) return false;
          if(cond.minAccuracy != null && (parseInt(m.accuracy,10)||0) < cond.minAccuracy) return false;
          return true;
        });
      });
      if(!allSlotsOk) return false;
    }
    for(var i=0;i<STAT_KEYS.length;i++){
      var k = STAT_KEYS[i];
      if(!inRange(p.baseStats[k], filters.statRange[k])) return false;
    }
    if(!inRange(totalBaseStat(p), filters.totalRange)) return false;
    if(!inRange(p.weight, filters.weightRange)) return false;
    if(filters.finalEvoOnly && p.canEvolve) return false;
    if(filters.championsOnly && !hasChampionsEntry(p)) return false;
    return true;
  }

  function fillSelect(select, items, placeholder){
    select.textContent = '';
    if(placeholder){ var op0=document.createElement('option'); op0.value=''; op0.textContent=placeholder; select.appendChild(op0); }
    items.forEach(function(item){ var op=document.createElement('option'); op.value=item.id; op.textContent=item.name; select.appendChild(op); });
  }
  var comboIdCounter = 0;
  function makeCompactSelect(items, placeholder, withSearch){
    var id = 'damekeSearchCombo' + (comboIdCounter++);
    var select = document.createElement('select');
    select.id = id;
    select.className = 'dameke-search-compact-select';
    fillSelect(select, items, placeholder);
    if(withSearch && window.__damekeAttachSearchCombo){
      Promise.resolve().then(function(){ window.__damekeAttachSearchCombo(id); });
    }
    return select;
  }
  function buildStatRangeRow(container, label, key, bounds){
    var row = document.createElement('div');
    row.className = 'dameke-search-range-row';
    var lab = document.createElement('span'); lab.className='dameke-search-range-label'; lab.textContent=label;
    var lo = document.createElement('input'); lo.type='number'; lo.className='dameke-search-range-input'; lo.value = bounds[0]; lo.min = bounds[0]; lo.max = bounds[1];
    var tilde = document.createElement('span'); tilde.textContent='〜';
    var hi = document.createElement('input'); hi.type='number'; hi.className='dameke-search-range-input'; hi.value = bounds[1]; hi.min = bounds[0]; hi.max = bounds[1];
    function targetRange(){ return key==='total' ? filters.totalRange : key==='weight' ? filters.weightRange : filters.statRange[key]; }
    targetRange()[0] = bounds[0]; targetRange()[1] = bounds[1];
    // The HTML min/max attributes alone don't stop every path a value can get out of range
    // (typing past them, then blurring), so clamp explicitly too -- never lets the filter go
    // outside the data's own actual min/max.
    lo.addEventListener('change', function(){
      var v = lo.value===''?null:Math.max(bounds[0], Math.min(bounds[1], parseFloat(lo.value)));
      lo.value = v==null?'':v;
      targetRange()[0] = v; renderResults();
    });
    hi.addEventListener('change', function(){
      var v = hi.value===''?null:Math.max(bounds[0], Math.min(bounds[1], parseFloat(hi.value)));
      hi.value = v==null?'':v;
      targetRange()[1] = v; renderResults();
    });
    row.appendChild(lab); row.appendChild(lo); row.appendChild(tilde); row.appendChild(hi);
    container.appendChild(row);
  }

  function renderFilterPanel(){
    var host = q('damekeSearchFilterHost');
    host.innerHTML = '';
    var bounds = buildDataBounds();
    STAT_KEYS.forEach(function(k){ filters.statRange[k] = bounds[k].slice(); });
    filters.totalRange = bounds.total.slice();
    filters.weightRange = bounds.weight.slice();

    var nameTitle = document.createElement('div'); nameTitle.className='dameke-adjust-nature-title'; nameTitle.textContent='ポケモン名';
    host.appendChild(nameTitle);
    var nameInput = document.createElement('input'); nameInput.type='text'; nameInput.placeholder='ひらがな・カタカナ可（部分一致）'; nameInput.className='dameke-search-text-input';
    nameInput.addEventListener('change', function(){ filters.name = nameInput.value; renderResults(); });
    host.appendChild(nameInput);

    var typeTitle = document.createElement('div'); typeTitle.className='dameke-adjust-nature-title'; typeTitle.textContent='タイプ';
    host.appendChild(typeTitle);
    var typeRow = document.createElement('div'); typeRow.className='dameke-search-inline-row';
    var type1Sel = makeCompactSelect(ALL_TYPES.map(function(t){return {id:t,name:t};}), '指定なし');
    var type2Sel = makeCompactSelect(ALL_TYPES.map(function(t){return {id:t,name:t};}), '指定なし');
    type1Sel.addEventListener('change', function(){ filters.type1 = type1Sel.value; renderResults(); });
    type2Sel.addEventListener('change', function(){ filters.type2 = type2Sel.value; renderResults(); });
    typeRow.appendChild(type1Sel); typeRow.appendChild(type2Sel);
    host.appendChild(typeRow);

    var matchupLabel = document.createElement('div'); matchupLabel.className='dameke-adjust-nature-title'; matchupLabel.textContent='指定タイプとの相性';
    host.appendChild(matchupLabel);
    var matchupListHost = document.createElement('div'); matchupListHost.className = 'dameke-search-move-slot-host';
    host.appendChild(matchupListHost);
    var addMatchupBtn = document.createElement('button');
    addMatchupBtn.type = 'button'; addMatchupBtn.className = 'dameke-search-add-btn'; addMatchupBtn.textContent = '追加する';
    addMatchupBtn.addEventListener('click', function(){
      if(filters.matchupConditions.length >= 4) return;
      filters.matchupConditions.push({type:'', category:''});
      renderMatchupSlots();
    });
    host.appendChild(addMatchupBtn);
    function renderMatchupSlots(){
      matchupListHost.innerHTML = '';
      filters.matchupConditions.forEach(function(cond, idx){
        var row = document.createElement('div'); row.className = 'dameke-search-inline-row';
        var typeSel = makeCompactSelect(ALL_TYPES.map(function(t){return {id:t,name:t};}), '指定なし');
        typeSel.value = cond.type;
        typeSel.addEventListener('change', function(){ filters.matchupConditions[idx].type = typeSel.value; renderResults(); });
        var catSel = makeCompactSelect(['等倍以下','半減以下','1/4以下'].map(function(c){return {id:c,name:c};}), '指定なし');
        catSel.value = cond.category;
        catSel.addEventListener('change', function(){ filters.matchupConditions[idx].category = catSel.value; renderResults(); });
        row.appendChild(typeSel); row.appendChild(catSel);
        matchupListHost.appendChild(row);
      });
      addMatchupBtn.hidden = filters.matchupConditions.length >= 4;
    }
    renderMatchupSlots();

    var abilityLabel = document.createElement('div'); abilityLabel.className='dameke-adjust-nature-title'; abilityLabel.textContent='特性';
    host.appendChild(abilityLabel);
    var abilityOptions = DATA.abilities.filter(function(a){ return a.id !== 'なし'; });
    var abilitySelect = makeCompactSelect(abilityOptions, '指定なし', true);
    abilitySelect.addEventListener('change', function(){ filters.ability = abilitySelect.value; renderResults(); });
    host.appendChild(abilitySelect);

    var moveTitle = document.createElement('div'); moveTitle.className='dameke-adjust-nature-title dameke-search-section-gap dameke-search-move-title'; moveTitle.textContent='覚える技';
    host.appendChild(moveTitle);
    var moveListHost = document.createElement('div'); moveListHost.className = 'dameke-search-move-slot-host';
    host.appendChild(moveListHost);
    var addMoveBtn = document.createElement('button');
    addMoveBtn.type = 'button'; addMoveBtn.className = 'dameke-search-add-btn'; addMoveBtn.textContent = '追加する';
    addMoveBtn.addEventListener('click', function(){
      if(filters.moveConditions.length >= 4) return;
      filters.moveConditions.push({name:'', type:'', category:'', minPower:null, minAccuracy:null});
      renderMoveSlots();
    });
    host.appendChild(addMoveBtn);
    function renderMoveSlots(){
      moveListHost.innerHTML = '';
      filters.moveConditions.forEach(function(cond, idx){
        var row = document.createElement('div'); row.className = 'dameke-search-move-filter-grid dameke-search-move-filter-slot';
        var nameSel = makeCompactSelect(DATA.moves, '技名指定なし', true);
        nameSel.value = cond.name;
        nameSel.addEventListener('change', function(){ filters.moveConditions[idx].name = nameSel.value; renderResults(); });
        var typeSel = makeCompactSelect(ALL_TYPES.map(function(t){return {id:t,name:t};}), 'タイプ指定なし');
        typeSel.value = cond.type;
        typeSel.addEventListener('change', function(){ filters.moveConditions[idx].type = typeSel.value; renderResults(); });
        var catSel = makeCompactSelect([{id:'物理',name:'物理'},{id:'特殊',name:'特殊'},{id:'変化',name:'変化'}], '分類指定なし');
        catSel.value = cond.category;
        catSel.addEventListener('change', function(){ filters.moveConditions[idx].category = catSel.value; renderResults(); });
        var powerInput = document.createElement('input'); powerInput.type='number'; powerInput.placeholder='威力下限';
        powerInput.value = cond.minPower==null ? '' : cond.minPower;
        powerInput.addEventListener('input', function(){ filters.moveConditions[idx].minPower = powerInput.value===''?null:parseInt(powerInput.value,10); renderResults(); });
        var accInput = document.createElement('input'); accInput.type='number'; accInput.placeholder='命中下限';
        accInput.value = cond.minAccuracy==null ? '' : cond.minAccuracy;
        accInput.addEventListener('input', function(){ filters.moveConditions[idx].minAccuracy = accInput.value===''?null:parseInt(accInput.value,10); renderResults(); });
        [nameSel, typeSel, catSel, powerInput, accInput].forEach(function(el){ row.appendChild(el); });
        moveListHost.appendChild(row);
      });
      addMoveBtn.hidden = filters.moveConditions.length >= 4;
    }
    renderMoveSlots();

    var statRangeTitle = document.createElement('div'); statRangeTitle.className='dameke-adjust-nature-title dameke-search-section-gap'; statRangeTitle.textContent='種族値の範囲（空欄で指定なし）';
    host.appendChild(statRangeTitle);
    STAT_KEYS.forEach(function(k){ buildStatRangeRow(host, k, k, bounds[k]); });
    buildStatRangeRow(host, '合計', 'total', bounds.total);
    buildStatRangeRow(host, 'おもさ', 'weight', bounds.weight);

    var checksRow = document.createElement('div'); checksRow.className='dameke-speed-cond-row dameke-search-section-gap';
    var finalLabel = document.createElement('label'); finalLabel.className='check';
    var finalCb = document.createElement('input'); finalCb.type='checkbox';
    finalCb.addEventListener('change', function(){ filters.finalEvoOnly = finalCb.checked; renderResults(); });
    finalLabel.appendChild(finalCb); finalLabel.appendChild(document.createTextNode('最終進化のみ'));
    var champLabel = document.createElement('label'); champLabel.className='check';
    var champCb = document.createElement('input'); champCb.type='checkbox';
    champCb.addEventListener('change', function(){ filters.championsOnly = champCb.checked; renderResults(); });
    champLabel.appendChild(champCb); champLabel.appendChild(document.createTextNode('チャンピオンズ参戦済のみ'));
    checksRow.appendChild(finalLabel); checksRow.appendChild(champLabel);
    host.appendChild(checksRow);

    var clearBtn = document.createElement('button');
    clearBtn.type = 'button'; clearBtn.className = 'dameke-search-clear-btn dameke-search-section-gap';
    clearBtn.textContent = '絞り込みクリア';
    clearBtn.addEventListener('click', function(){
      filters = defaultFilters();
      renderFilterPanel();
      renderResults();
    });
    host.appendChild(clearBtn);
  }

  function buildThumb(japaneseName){
    var wrap = document.createElement('div');
    wrap.className = 'dameke-search-thumb';
    var img = window.__damekeBuildPokemonImage
      ? window.__damekeBuildPokemonImage(japaneseName, function(){ wrap.classList.add('dameke-search-thumb-missing'); wrap.innerHTML = ''; })
      : null;
    if(img) wrap.appendChild(img);
    else wrap.classList.add('dameke-search-thumb-missing');
    return wrap;
  }
  function sortMatched(list){
    if(sortBy === 'kana') return list.slice().sort(function(a,b){ return a.name.localeCompare(b.name,'ja'); });
    if(sortBy === 'stat'){
      return list.slice().sort(function(a,b){
        var va = sortStatKey==='total' ? totalBaseStat(a) : a.baseStats[sortStatKey];
        var vb = sortStatKey==='total' ? totalBaseStat(b) : b.baseStats[sortStatKey];
        return vb - va;
      });
    }
    if(sortBy === 'weight') return list.slice().sort(function(a,b){ return b.weight - a.weight; });
    return list; // 'dex' -- keep DATA.pokemons' own (filter-preserved) order
  }
  function renderSortControls(){
    var host = q('damekeSearchSortHost');
    if(!host) return;
    host.innerHTML = '';
    var sortSel = document.createElement('select'); sortSel.className = 'dameke-search-compact-select';
    [['dex','図鑑番号順'],['kana','五十音順'],['stat','種族値順'],['weight','おもさ順']].forEach(function(pair){
      var op = document.createElement('option'); op.value = pair[0]; op.textContent = pair[1]; sortSel.appendChild(op);
    });
    sortSel.value = sortBy;
    sortSel.addEventListener('change', function(){ sortBy = sortSel.value; renderSortControls(); renderResults(); });
    host.appendChild(sortSel);
    if(sortBy === 'stat'){
      var statSel = document.createElement('select'); statSel.className = 'dameke-search-compact-select';
      STAT_KEYS.concat(['total']).forEach(function(k){
        var op = document.createElement('option'); op.value = k; op.textContent = (k==='total'?'合計':k); statSel.appendChild(op);
      });
      statSel.value = sortStatKey;
      statSel.addEventListener('change', function(){ sortStatKey = statSel.value; renderResults(); });
      host.appendChild(statSel);
    }
  }
  function renderResults(){
    var countHost = q('damekeSearchResultCount');
    var host = q('damekeSearchResultHost');
    var matched = sortMatched(DATA.pokemons.filter(matchesFilters));
    countHost.textContent = matched.length + ' 件（全 ' + DATA.pokemons.length + ' 件中）';
    host.innerHTML = '';
    var frag = document.createDocumentFragment();
    matched.forEach(function(p){
      var item = document.createElement('div');
      item.className = 'dameke-search-result-item';
      item.appendChild(buildThumb(p.name));
      var nameEl = document.createElement('div'); nameEl.className='dameke-search-result-name'; nameEl.textContent=p.name;
      item.appendChild(nameEl);
      item.addEventListener('click', function(){ showDetail(p); });
      frag.appendChild(item);
    });
    host.appendChild(frag);
  }

  var detailAbilityChoice = null;
  function relatedFormsFor(p){
    var baseNameMatch = p.name.match(/^(.+?)(\([^)]+\))?$/);
    var baseName = baseNameMatch ? baseNameMatch[1] : p.name;
    return DATA.pokemons.filter(function(o){
      if(o.id === p.id) return false;
      if(o.speciesKey && p.speciesKey && o.speciesKey === p.speciesKey) return true;
      if(o.name.indexOf(baseName) === 0 && baseName.length >= 2) return true;
      return false;
    });
  }
  function showDetail(p){
    detailAbilityChoice = (p.abilities && p.abilities[0]) || null;
    moveListFilter = { name:'', type:'', category:'', minPower:null, minAccuracy:null };
    moveListSort = 'type';
    q('damekeSearchResultHost').hidden = true;
    var host = q('damekeSearchDetailHost');
    host.hidden = false;
    renderDetail(p);
    requestAnimationFrame(function(){ host.scrollIntoView({behavior:'smooth', block:'start'}); });
  }
  function closeDetail(){
    q('damekeSearchDetailHost').hidden = true;
    q('damekeSearchResultHost').hidden = false;
  }
  // 種族値レーダーチャート: 12時の頂点をH、右回りにC/D/S/B/Aの六角形。数値は表示せず、あくまで
  // イメージ図として形と軸ラベルのみを示す(具体的な数値は下の表で確認できるため)。
  function buildStatRadarSvg(baseStats){
    var order = ['H','C','D','S','B','A'];
    // 255等の極端な種族値を持つポケモンがいるため、そちらを基準にすると140~150程度の一般的に
    // 高い数値でもチャートが小さく見えてしまう。目盛りの最大は200とし、それを超える分は表示上
    // はみ出す(SVGのviewBox外にあたる部分は自然に見切れる)ことで、実用上のバランスをとる。
    var maxStat = 200;
    var size = 120, cx = size/2, cy = size/2, r = size/2 - 16;
    function axisAngle(i){ return (-90 + i*60) * Math.PI/180; }
    function ringPoints(frac){
      return order.map(function(_,i){
        var a = axisAngle(i);
        return (cx+r*frac*Math.cos(a)).toFixed(1)+','+(cy+r*frac*Math.sin(a)).toFixed(1);
      }).join(' ');
    }
    var rings = [0.25,0.5,0.75,1].map(function(frac){
      return '<polygon points="'+ringPoints(frac)+'" fill="none" stroke="#e2e8f0" stroke-width="1"/>';
    }).join('');
    var axisLines = order.map(function(_,i){
      var a = axisAngle(i);
      return '<line x1="'+cx+'" y1="'+cy+'" x2="'+(cx+r*Math.cos(a)).toFixed(1)+'" y2="'+(cy+r*Math.sin(a)).toFixed(1)+'" stroke="#e2e8f0" stroke-width="1"/>';
    }).join('');
    // 各目盛りの実際の値(50/100/150/200)を、H軸(真上方向)沿いに控えめな小さい数字で添える。
    var ringLabels = [0.25,0.5,0.75,1].map(function(frac){
      var y = cy - r*frac;
      return '<text x="'+(cx+3)+'" y="'+(y-1.5)+'" font-size="6" text-anchor="start" fill="#cbd5e1">'+Math.round(maxStat*frac)+'</text>';
    }).join('');
    var dataPoints = order.map(function(k,i){
      var a = axisAngle(i);
      // 上限でクランプしない -- 200を超える種族値はチャート外へそのままはみ出させる。
      var scale = Math.max(0, (baseStats && baseStats[k]!=null ? baseStats[k] : 0)/maxStat);
      return (cx+r*scale*Math.cos(a)).toFixed(1)+','+(cy+r*scale*Math.sin(a)).toFixed(1);
    }).join(' ');
    var labels = order.map(function(k,i){
      var a = axisAngle(i);
      var lr = r + 11;
      var x = (cx+lr*Math.cos(a)).toFixed(1), y = (cy+lr*Math.sin(a)).toFixed(1);
      return '<text x="'+x+'" y="'+y+'" font-size="11" text-anchor="middle" dominant-baseline="middle" fill="#475569" font-weight="700">'+k+'</text>';
    }).join('');
    return '<svg viewBox="0 0 '+size+' '+size+'" class="dameke-search-detail-radar" role="img" aria-label="種族値レーダーチャート">'
      + rings + axisLines + ringLabels
      + '<polygon points="'+dataPoints+'" fill="rgba(37,99,235,.32)" stroke="#2563eb" stroke-width="1.5"/>'
      + labels
      + '</svg>';
  }
  function matchupClassFor(rate){
    if(rate === 0) return 'dameke-search-matchup-immune';
    if(rate >= 4) return 'dameke-search-matchup-weak4';
    if(rate === 2) return 'dameke-search-matchup-weak2';
    if(rate === 1) return 'dameke-search-matchup-neutral';
    if(rate === 0.5) return 'dameke-search-matchup-resist2';
    return 'dameke-search-matchup-resist4';
  }
  var moveListFilter = { name:'', type:'', category:'', minPower:null, minAccuracy:null };
  var moveListSort = 'type';
  function renderDetail(p){
    var host = q('damekeSearchDetailHost');
    host.innerHTML = '';

    var head = document.createElement('div');
    head.className = 'dameke-search-detail-head';
    var headImg = window.__damekeBuildPokemonImage ? window.__damekeBuildPokemonImage(p.name, function(){ headImg.remove(); }) : null;
    if(headImg){ headImg.className = 'dameke-search-detail-image'; head.appendChild(headImg); }
    var headInfo = document.createElement('div');
    headInfo.className = 'dameke-search-detail-info';
    // 括弧書き(フォルム名等)の直前で必ず改行 -- 括弧書き自体の中にさらに括弧があっても、そこで
    // 追加の改行はしない(最初の"("の直前だけを対象にする)。
    var parenIdx = p.name.indexOf('(');
    var nameHtml = parenIdx > 0 ? (p.name.slice(0,parenIdx) + '<br>' + p.name.slice(parenIdx)) : p.name;
    var flagsHtml = (!p.canEvolve)
      ? '<div class="dameke-adjust-summary-note dameke-search-detail-flags">（最終進化）</div>'
      : '';
    headInfo.innerHTML = '<div class="dameke-history-title dameke-search-detail-name">'+nameHtml+'</div>'
      + '<div class="dameke-search-detail-types">'+(p.types||[]).map(function(t){ return '<span class="dameke-party-type-badge '+typeColorClass(t)+'">'+t+'</span>'; }).join('')+'</div>'
      + '<div class="dameke-adjust-summary-note">おもさ：'+p.weight+'kg</div>'
      + flagsHtml;
    head.appendChild(headInfo);
    var radarHost = document.createElement('div');
    radarHost.className = 'dameke-search-detail-radar-host';
    radarHost.innerHTML = buildStatRadarSvg(p.baseStats);
    head.appendChild(radarHost);
    host.appendChild(head);

    var related = relatedFormsFor(p);
    if(related.length){
      var relTitle = document.createElement('div'); relTitle.className='dameke-adjust-nature-title'; relTitle.textContent='関連フォルム';
      host.appendChild(relTitle);
      var relWrap = document.createElement('div'); relWrap.className='dameke-search-ability-list';
      related.forEach(function(o){
        var chip = document.createElement('button'); chip.type='button'; chip.className='dameke-search-ability-chip';
        chip.textContent = o.name;
        chip.addEventListener('click', function(){ showDetail(o); });
        relWrap.appendChild(chip);
      });
      host.appendChild(relWrap);
    }

    var statTitle = document.createElement('div'); statTitle.className='dameke-adjust-nature-title dameke-search-section-gap'; statTitle.textContent='種族値・実数値（Lv50・個体値31基準）';
    host.appendChild(statTitle);
    var statTable = document.createElement('div');
    statTable.className = 'dameke-adjust-evspec-table dameke-search-combined-stat-table';
    statTable.style.gridTemplateColumns = '5.4em repeat(6,minmax(3.6em,4.6em)) minmax(4.6em,5.6em)';
    var corner = document.createElement('div'); statTable.appendChild(corner);
    STAT_KEYS.concat(['合計']).forEach(function(k){ var h=document.createElement('div'); h.className='dameke-adjust-evspec-head'; h.textContent=k; statTable.appendChild(h); });
    function addStatRow(label, valueFn, totalFn){
      var rl = document.createElement('div'); rl.className='dameke-adjust-evspec-rowlabel'; rl.textContent=label; statTable.appendChild(rl);
      STAT_KEYS.forEach(function(k){ var c=document.createElement('div'); c.className='dameke-adjust-evspec-cell'; c.textContent=valueFn(k); statTable.appendChild(c); });
      var tc = document.createElement('div'); tc.className='dameke-adjust-evspec-cell'; tc.textContent=totalFn(); statTable.appendChild(tc);
    }
    addStatRow('種族値', function(k){ return p.baseStats[k]; }, function(){ return totalBaseStat(p); });
    var totalPokemonCount = rankOf(0,'H').total; // same denominator regardless of which stat is ranked
    addStatRow('全'+totalPokemonCount+'種中', function(k){ return rankOf(p.baseStats[k],k).rank+'位'; }, function(){ return rankOf(totalBaseStat(p),'total').rank+'位'; });
    addStatRow('無振り実数値', function(k){ return statRefRange(p,k).neutral; }, function(){ return '-'; });
    addStatRow('最高実数値', function(k){ return statRefRange(p,k).max; }, function(){ return '-'; });
    host.appendChild(statTable);

    var abilityTitle = document.createElement('div'); abilityTitle.className='dameke-adjust-nature-title dameke-search-section-gap'; abilityTitle.textContent='特性';
    host.appendChild(abilityTitle);
    var abilityWrap = document.createElement('div'); abilityWrap.className='dameke-search-ability-list';
    (p.abilities||[]).forEach(function(abName){
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'dameke-search-ability-chip' + (abName===detailAbilityChoice ? ' dameke-search-ability-chip-active' : '');
      chip.textContent = abName;
      chip.addEventListener('click', function(){ detailAbilityChoice = abName; renderDetail(p); });
      abilityWrap.appendChild(chip);
    });
    host.appendChild(abilityWrap);

    var matchupTitle = document.createElement('div'); matchupTitle.className='dameke-adjust-nature-title dameke-search-section-gap'; matchupTitle.textContent='攻撃を受けるときの相性（選択中の特性を考慮）';
    host.appendChild(matchupTitle);
    var matchup = CALC.computeAllTypeEffectiveness(p.types, detailAbilityChoice);
    var matchupWrap = document.createElement('div'); matchupWrap.className='dameke-search-matchup-grid';
    ALL_TYPES.forEach(function(t){
      var rate = matchup[t];
      var cell = document.createElement('div');
      cell.className = 'dameke-typecell ' + typeColorClass(t);
      cell.innerHTML = '<span class="dameke-typecell-name">'+t+'</span><span class="dameke-typecell-value '+matchupClassFor(rate)+'">×'+(rate===0?'0':rate)+'</span>';
      matchupWrap.appendChild(cell);
    });
    host.appendChild(matchupWrap);

    var moveTitle = document.createElement('div'); moveTitle.className='dameke-adjust-nature-title dameke-search-section-gap'; moveTitle.textContent='覚える技';
    host.appendChild(moveTitle);
    var learned = pokemonLearnset(p);
    if(!learned){
      host.appendChild(makeNote('この個体の技データは未登録です。'));
    } else {
      renderMoveSection(host, learned);
    }

    var calcRow = document.createElement('div'); calcRow.className='dameke-speed-cond-row dameke-search-section-gap';
    var atkBtn = document.createElement('button'); atkBtn.type='button'; atkBtn.className='v082h-stats-adjust-btn v082h-stats-adjust-btn-attacker'; atkBtn.textContent='攻撃側で計算機へ';
    atkBtn.addEventListener('click', function(){ if(window.__damekeLoadPokemonIntoCalculator) window.__damekeLoadPokemonIntoCalculator(p.id,'attacker'); if(window.__damekeShowPanel) window.__damekeShowPanel('calculator'); });
    var defBtn = document.createElement('button'); defBtn.type='button'; defBtn.className='v082h-stats-adjust-btn v082h-stats-adjust-btn-defender'; defBtn.textContent='防御側で計算機へ';
    defBtn.addEventListener('click', function(){ if(window.__damekeLoadPokemonIntoCalculator) window.__damekeLoadPokemonIntoCalculator(p.id,'defender'); if(window.__damekeShowPanel) window.__damekeShowPanel('calculator'); });
    calcRow.appendChild(atkBtn); calcRow.appendChild(defBtn);
    host.appendChild(calcRow);
  }
  function makeNote(text){ var d=document.createElement('div'); d.className='dameke-adjust-summary-note'; d.textContent=text; return d; }

  function renderMoveSection(host, learnedNames){
    var moveObjsAll = learnedNames.map(function(name){ return DATA.moves.find(function(m){ return m.name===name; }); }).filter(Boolean);

    var sortRow = document.createElement('div'); sortRow.className = 'dameke-search-inline-row';
    var sortLabel = document.createElement('span'); sortLabel.className='dameke-search-range-label dameke-search-sort-label'; sortLabel.textContent='並び替え';
    var sortSelect = document.createElement('select'); sortSelect.className = 'dameke-search-sort-select';
    [['name','五十音順'],['type','タイプ順'],['power','威力順']].forEach(function(pair){ var op=document.createElement('option'); op.value=pair[0]; op.textContent=pair[1]; sortSelect.appendChild(op); });
    sortSelect.value = moveListSort;
    sortSelect.addEventListener('change', function(){ moveListSort = sortSelect.value; renderMoveList(); });
    sortRow.appendChild(sortLabel); sortRow.appendChild(sortSelect);
    host.appendChild(sortRow);

    var filterFold = document.createElement('details'); filterFold.className = 'dameke-pokemon-edit-levelfold dameke-search-move-filter-fold';
    var filterSummary = document.createElement('summary'); filterSummary.textContent = '技の絞り込み';
    filterFold.appendChild(filterSummary);
    var filterGrid = document.createElement('div'); filterGrid.className = 'dameke-search-move-filter-grid';
    var nameF = document.createElement('input'); nameF.type='text'; nameF.placeholder='技名';
    nameF.addEventListener('input', function(){ moveListFilter.name = nameF.value; renderMoveList(); });
    var typeF = makeCompactSelect(ALL_TYPES.map(function(t){return {id:t,name:t};}), 'タイプ指定なし');
    typeF.addEventListener('change', function(){ moveListFilter.type = typeF.value; renderMoveList(); });
    var catF = makeCompactSelect([{id:'物理',name:'物理'},{id:'特殊',name:'特殊'},{id:'変化',name:'変化'}], '分類指定なし');
    catF.addEventListener('change', function(){ moveListFilter.category = catF.value; renderMoveList(); });
    var powerF = document.createElement('input'); powerF.type='number'; powerF.placeholder='威力の下限';
    powerF.addEventListener('input', function(){ moveListFilter.minPower = powerF.value===''?null:parseInt(powerF.value,10); renderMoveList(); });
    var accF = document.createElement('input'); accF.type='number'; accF.placeholder='命中の下限';
    accF.addEventListener('input', function(){ moveListFilter.minAccuracy = accF.value===''?null:parseInt(accF.value,10); renderMoveList(); });
    [nameF, typeF, catF, powerF, accF].forEach(function(el){ filterGrid.appendChild(el); });
    filterFold.appendChild(filterGrid);
    host.appendChild(filterFold);

    var header = document.createElement('div');
    header.className = 'dameke-search-move-row dameke-search-move-header';
    header.innerHTML = '<span>技名</span><span>タイプ</span><span>技分類</span><span>威力</span><span>命中</span><span>PP</span><span>範囲</span>';
    host.appendChild(header);
    var listHost = document.createElement('div'); listHost.className = 'dameke-search-move-list';
    host.appendChild(listHost);

    function renderMoveList(){
      var moves = moveObjsAll.slice();
      if(moveListFilter.name) moves = moves.filter(function(m){ return kanaNormalize(m.name).indexOf(kanaNormalize(moveListFilter.name))>=0; });
      if(moveListFilter.type) moves = moves.filter(function(m){ return m.type===moveListFilter.type; });
      if(moveListFilter.category) moves = moves.filter(function(m){ return m.category===moveListFilter.category; });
      if(moveListFilter.minPower != null) moves = moves.filter(function(m){ return (m.power||0) >= moveListFilter.minPower; });
      if(moveListFilter.minAccuracy != null) moves = moves.filter(function(m){ return (parseInt(m.accuracy,10)||0) >= moveListFilter.minAccuracy; });
      moves.sort(function(a,b){
        if(moveListSort==='type'){
          var ia = TYPE_ORDER.indexOf(a.type), ib = TYPE_ORDER.indexOf(b.type);
          return (ia-ib) || a.name.localeCompare(b.name,'ja');
        }
        if(moveListSort==='power') return (b.power||0)-(a.power||0) || a.name.localeCompare(b.name,'ja');
        return a.name.localeCompare(b.name,'ja');
      });
      listHost.innerHTML = moves.map(function(m){
        return '<div class="dameke-search-move-row">'
          + '<span class="dameke-search-move-name">'+m.name+'</span>'
          + '<span><span class="dameke-party-type-badge '+typeColorClass(m.type)+'">'+m.type+'</span></span>'
          + '<span>'+m.category+'</span>'
          + '<span>'+(m.power===1 ? '-' : (m.power||'-'))+'</span>'
          + '<span>'+(m.accuracy||'-')+'</span>'
          + '<span>'+(m.pp!=null?m.pp:'-')+'</span>'
          + '<span>'+(m.target||'-')+'</span>'
          + '</div>';
      }).join('') || '<div class="dameke-adjust-summary-note">該当する技がありません。</div>';
    }
    renderMoveList();
  }

  function init(){
    renderFilterPanel();
    renderSortControls();
    renderResults();
  }
  window.__damekeRenderSearchPanel = function(){
    if(!q('damekeSearchFilterHost').childElementCount) init();
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
