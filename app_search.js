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

  var filters = {
    name: '',
    type1: '', type2: '',
    matchupType: '', matchupCategory: '',
    ability: '',
    moves: [''],
    statRange: {},
    totalRange: [null,null],
    weightRange: [null,null],
    finalEvoOnly: false,
    championsOnly: false
  };
  function kanaNormalize(s){ return String(s||'').replace(/[\u30a1-\u30f6]/g, function(c){ return String.fromCharCode(c.charCodeAt(0)-0x60); }).toLowerCase(); }
  function matchupCategoryOf(rate){
    if(rate === 0) return '無効';
    if(rate >= 4) return '4倍弱点';
    if(rate === 2) return '2倍弱点';
    if(rate === 1) return '等倍';
    if(rate === 0.5) return '半減';
    if(rate <= 0.25) return '4分の1';
    return '等倍';
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
    if(filters.matchupType && filters.matchupCategory){
      var abilityList = (p.abilities||[]).length ? p.abilities : [null];
      var anyMatches = abilityList.some(function(abName){
        var rate = CALC.computeTypeEffectiveness(p.types, filters.matchupType, abName);
        return matchupCategoryOf(rate) === filters.matchupCategory;
      });
      if(!anyMatches) return false;
    }
    if(filters.ability && (p.abilities||[]).indexOf(filters.ability) === -1) return false;
    var wantedMoves = filters.moves.filter(function(m){ return m; });
    if(wantedMoves.length){
      var learned = pokemonLearnset(p);
      if(!learned) return false;
      if(!wantedMoves.every(function(m){ return learned.indexOf(m) >= 0; })) return false;
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
    var matchupRow = document.createElement('div'); matchupRow.className='dameke-search-inline-row';
    var matchupTypeSel = makeCompactSelect(ALL_TYPES.map(function(t){return {id:t,name:t};}), '指定なし');
    var matchupCatSel = makeCompactSelect(['4倍弱点','2倍弱点','等倍','半減','4分の1','無効'].map(function(c){return {id:c,name:c};}), '指定なし');
    matchupTypeSel.addEventListener('change', function(){ filters.matchupType = matchupTypeSel.value; renderResults(); });
    matchupCatSel.addEventListener('change', function(){ filters.matchupCategory = matchupCatSel.value; renderResults(); });
    matchupRow.appendChild(matchupTypeSel); matchupRow.appendChild(matchupCatSel);
    host.appendChild(matchupRow);

    var abilityLabel = document.createElement('div'); abilityLabel.className='dameke-adjust-nature-title'; abilityLabel.textContent='特性';
    host.appendChild(abilityLabel);
    var abilityOptions = DATA.abilities.filter(function(a){ return a.id !== 'なし'; });
    var abilitySelect = makeCompactSelect(abilityOptions, '指定なし', true);
    abilitySelect.addEventListener('change', function(){ filters.ability = abilitySelect.value; renderResults(); });
    host.appendChild(abilitySelect);

    var moveTitle = document.createElement('div'); moveTitle.className='dameke-adjust-nature-title dameke-search-section-gap'; moveTitle.textContent='覚える技';
    host.appendChild(moveTitle);
    var moveListHost = document.createElement('div'); moveListHost.className = 'dameke-search-move-slot-host';
    host.appendChild(moveListHost);
    var addMoveBtn = document.createElement('button');
    addMoveBtn.type = 'button'; addMoveBtn.className = 'dameke-search-add-btn'; addMoveBtn.textContent = '追加する';
    addMoveBtn.addEventListener('click', function(){
      if(filters.moves.length >= 4) return;
      filters.moves.push('');
      renderMoveSlots();
    });
    host.appendChild(addMoveBtn);
    function renderMoveSlots(){
      moveListHost.innerHTML = '';
      filters.moves.forEach(function(val, idx){
        var moveSelect = makeCompactSelect(DATA.moves, '指定なし', true);
        moveSelect.value = val;
        moveSelect.addEventListener('change', function(){ filters.moves[idx] = moveSelect.value; renderResults(); });
        moveListHost.appendChild(moveSelect);
      });
      addMoveBtn.hidden = filters.moves.length >= 4;
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
  function renderResults(){
    var headerHost = q('damekeSearchResultHeader');
    var host = q('damekeSearchResultHost');
    var matched = DATA.pokemons.filter(matchesFilters);
    headerHost.textContent = matched.length + ' 件（全 ' + DATA.pokemons.length + ' 件中）';
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
    headInfo.innerHTML = '<div class="dameke-history-title dameke-search-detail-name">'+p.name+'</div>'
      + '<div class="dameke-search-detail-types">'+(p.types||[]).map(function(t){ return '<span class="dameke-party-type-badge '+typeColorClass(t)+'">'+t+'</span>'; }).join('')+'</div>'
      + '<div class="dameke-adjust-summary-note">おもさ：'+p.weight+'kg'+(p.canEvolve?'':'（最終進化）')+(p.cannotDynamax?'（ダイマックス不可）':'')+'</div>';
    head.appendChild(headInfo);
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
      cell.className = 'dameke-search-matchup-cell ' + matchupClassFor(rate);
      cell.innerHTML = '<span>'+t+'</span><b>×'+(rate===0?'0':rate)+'</b>';
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
    renderResults();
  }
  window.__damekeRenderSearchPanel = function(){
    if(!q('damekeSearchFilterHost').childElementCount) init();
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
