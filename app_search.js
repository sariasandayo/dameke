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
  // 専用Z技(てんこがすめつぼうのひかり等)は、ダメージ計算式の内部処理で技名参照が必要なため
  // DATA.moves自体には実体が登録されているが、ユーザーが直接選べる一覧には出すべきではない
  // (ダメージ計算機の技選択など、他の画面と同じ扱いにする)。「選択可能な技一覧」をここで
  // 一元的に定義し、以後この検索機能内ではDATA.movesの代わりにこちらを使う。
  var SELECTABLE_MOVES = DATA.moves.filter(function(m){ return !(DATA.isExcludedSignatureZMove && DATA.isExcludedSignatureZMove(m)); });

  // ==================== 使用率データ (v2.1.0) ====================
  // Pokemon Champions Battle Data (https://championsbattledata.com/) から日次取得した
  // 使用率データ。取得・読込・検証のいずれかに失敗しても、既存のポケモン検索機能には
  // 一切影響を与えない設計とする(usageData が null のままなら、使用率関連の表示・
  // 並べ替えだけを安全に非表示/無効化し、それ以外は従来通り動作する)。
  var usageData = null; // 検証に通った場合のみ、パース済みのオブジェクトが入る
  var usageFormat = 'singles'; // 'singles' | 'doubles'
  var usageLoadPromise = null;

  function isFiniteNumberInRange(v, min, max){
    return typeof v === 'number' && isFinite(v) && v >= min && v <= max;
  }

  // 最低限のスキーマ検証。ここを通らないデータは一切使用しない(ブラウザ側は安全性優先)。
  function validateUsageData(obj){
    if(!obj || typeof obj !== 'object') return 'obj not an object';
    if(obj.schemaVersion !== 1) return 'schemaVersion !== 1 (got ' + obj.schemaVersion + ')';
    if(!obj.source || obj.source.sourceType !== 'pokemon-champions-in-game') return 'source.sourceType mismatch';
    if(!obj.formats || typeof obj.formats !== 'object') return 'formats missing/not object';
    if(!obj.formats.singles && !obj.formats.doubles) return 'both formats.singles and formats.doubles are empty';
    return null; // null = 検証OK
  }

  function usageFormatData(){
    if(!usageData) return null;
    return usageData.formats && usageData.formats[usageFormat] || null;
  }

  function usagePokemonEntry(pokemonName){
    var fd = usageFormatData();
    if(!fd || !fd.pokemon) return null;
    return fd.pokemon[pokemonName] || null;
  }

  function loadUsageData(){
    if(usageLoadPromise) return usageLoadPromise;
    // ブラウザのHTTPキャッシュ(cache:'no-store')に加え、GitHub Pages側のCDNキャッシュも
    // 回避するため、日付ベースのクエリを付与する(このデータは1日1回しか更新されないため、
    // 日付単位での区別で十分)。
    var cacheBustDate = new Date().toISOString().slice(0, 10);
    var url = 'data/data.usage.json?v=' + cacheBustDate;
    var resolvedUrl = (function(){ try{ return new URL(url, document.baseURI).href; }catch(e){ return url; } })();
    usageLoadPromise = fetch(url, { cache: 'no-store' })
      .then(function(res){ if(!res.ok) throw new Error('HTTP ' + res.status + '（URL: ' + resolvedUrl + '）'); return res.json(); })
      .then(function(json){
        var invalidReason = validateUsageData(json);
        if(invalidReason){ console.warn('[使用率] スキーマ検証に失敗したため無効化します。理由: ' + invalidReason); return; }
        usageData = json;
        var singlesCount = json.formats.singles ? Object.keys(json.formats.singles.pokemon||{}).length : 0;
        var doublesCount = json.formats.doubles ? Object.keys(json.formats.doubles.pokemon||{}).length : 0;
        console.log('[使用率] 読み込み成功。シングル:'+singlesCount+'件 / ダブル:'+doublesCount+'件');
      })
      .catch(function(e){
        // 使用率データがまだ存在しない/取得できない場合は、通常のポケモン検索として
        // 動作させるだけでよいので、警告のみに留める(エラー表示やダイアログは出さない)。
        console.warn('[使用率] 読み込みに失敗しました。使用率機能なしで動作します。', e);
      });
    return usageLoadPromise;
  }

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
      moveConditions: [{name:'', type:'', category:'', minPower:null, minAccuracy:null, pp:null, target:'', contact:''}],
      statRange: {},
      totalRange: [null,null],
      weightRange: [null,null],
      finalEvoOnly: false,
      championsOnly: false,
      megaOnly: false,
      megaExclude: false
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
    // タイプ/分類/威力下限/命中下限/PP/範囲をAND条件として満たす技を1つでも覚えていればその
    // スロットは合格。スロット同士もAND条件。
    var activeMoveConds = filters.moveConditions.filter(function(c){
      return c.name || c.type || c.category || c.minPower != null || c.minAccuracy != null || c.pp != null || c.target;
    });
    if(activeMoveConds.length){
      var learned = pokemonLearnset(p);
      if(!learned) return false;
      var allSlotsOk = activeMoveConds.every(function(cond){
        if(cond.name) return learned.indexOf(cond.name) >= 0;
        return learned.some(function(moveName){
          var m = SELECTABLE_MOVES.find(function(x){ return x.name === moveName; });
          if(!m) return false;
          if(cond.type && m.type !== cond.type) return false;
          if(cond.category && m.category !== cond.category) return false;
          if(cond.minPower != null && (m.power||0) < cond.minPower) return false;
          if(cond.minAccuracy != null && (parseInt(m.accuracy,10)||0) < cond.minAccuracy) return false;
          if(cond.pp != null && m.pp !== cond.pp) return false;
          if(cond.contact === 'true' && !m.contact) return false;
          if(cond.contact === 'false' && m.contact) return false;
          if(cond.target && m.target !== cond.target) return false;
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
    // メガシンカ後のポケモンは、だめけーの命名規則上、名前が必ず「メガ」で始まる。
    // 名前が「メガ」で始まるかどうかではなく、フォルムのラベル(formLabel)を見て判定する。
    // メガニウム・メガヤンマ等、名前がたまたま「メガ」で始まるだけの通常フォルムのポケモンを
    // 誤ってメガシンカ扱いしないようにするため(これらのformLabelは「通常」等であり、
    // 実際にメガシンカ後のポケモンのformLabelは「メガ」「メガX」「メガY」「メガZ」のいずれか)。
    // ゲンシグラードン(formLabel:「ゲンシグラードン」)・ゲンシカイオーガ(formLabel:
    // 「ゲンシカイキ」)は、専用アイテムで見た目・種族値・特性が変化するという点でメガシンカと
    // 同様の扱いをするため、この判定に含める。
    var isMegaForm = String(p.formLabel || '').indexOf('メガ') === 0 || String(p.formLabel || '').indexOf('ゲンシ') === 0;
    if(filters.megaOnly && !isMegaForm) return false;
    if(filters.megaExclude && isMegaForm) return false;
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
    // ここで返すselectは、呼び出し元がまだどこにも追加していない(親を持たない)段階にある。
    // attachSearchCombo()は要素をラップする際にselect.parentNode.insertBefore(...)を使う
    // ため、親がない状態で呼ぶとエラーになる。呼び出し元は関数から戻った直後、同期的に
    // 必ずどこかへ追加する実装になっているため、そのタイミングを待つよう1マイクロタスク
    // 遅延させる(要素そのものを直接渡すため、id文字列によるdocument.getElementById検索は
    // 経由しない)。
    if(withSearch && window.__damekeAttachSearchCombo){
      Promise.resolve().then(function(){ window.__damekeAttachSearchCombo(select); });
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
      filters.moveConditions.push({name:'', type:'', category:'', minPower:null, minAccuracy:null, pp:null, target:'', contact:''});
      renderMoveSlots();
    });
    host.appendChild(addMoveBtn);
    var moveFilterPpValues = Array.from(new Set(SELECTABLE_MOVES.map(function(m){ return m.pp; }).filter(function(v){ return v!=null; }))).sort(function(a,b){return a-b;});
    var moveFilterTargetValues = Array.from(new Set(SELECTABLE_MOVES.map(function(m){ return m.target; }).filter(Boolean))).sort();
    function renderMoveSlots(){
      moveListHost.innerHTML = '';
      filters.moveConditions.forEach(function(cond, idx){
        var row = document.createElement('div'); row.className = 'dameke-search-move-filter-grid dameke-search-move-filter-slot';
        var row1 = document.createElement('div'); row1.className = 'dameke-search-move-filter-row1';
        var row2 = document.createElement('div'); row2.className = 'dameke-search-move-filter-row2 dameke-search-move-filter-row2-box';

        // 技名選択欄: ひらがな/カタカナでの絞り込み検索ができるよう、検索コンボ機能で
        // ラップする。幅は(この要素の有無に関わらず)style.css側の宣言的なルールで
        // 一元的に指定しているため、ここでJS側から個別にstyleを設定する必要はない。
        var nameSel = document.createElement('select');
        nameSel.id = 'damekeSearchCombo' + (comboIdCounter++);
        nameSel.className = 'dameke-search-move-name-select';
        fillSelect(nameSel, SELECTABLE_MOVES, '技名指定なし');
        nameSel.value = cond.name;
        row1.appendChild(nameSel);
        if(window.__damekeAttachSearchCombo) window.__damekeAttachSearchCombo(nameSel);

        var typeSel = makeCompactSelect(ALL_TYPES.map(function(t){return {id:t,name:t};}), 'タイプ指定なし');
        typeSel.value = cond.type;
        var catSel = makeCompactSelect([{id:'物理',name:'物理'},{id:'特殊',name:'特殊'},{id:'変化',name:'変化'}], '分類指定なし');
        catSel.value = cond.category;
        var powerInput = document.createElement('input'); powerInput.type='number'; powerInput.placeholder='威力下限';
        powerInput.value = cond.minPower==null ? '' : cond.minPower;
        var accInput = document.createElement('input'); accInput.type='number'; accInput.placeholder='命中下限';
        accInput.value = cond.minAccuracy==null ? '' : cond.minAccuracy;
        var ppSel = makeCompactSelect(moveFilterPpValues.map(function(v){ return {id:String(v), name:String(v)}; }), 'PP指定なし');
        ppSel.value = cond.pp==null ? '' : String(cond.pp);
        var contactSel = makeCompactSelect([{id:'true',name:'接触'},{id:'false',name:'非接触'}], '接触指定なし');
        contactSel.value = cond.contact || '';
        var targetSel = makeCompactSelect(moveFilterTargetValues.map(function(v){ return {id:v, name:v}; }), '範囲指定なし');
        targetSel.value = cond.target;
        // 2段目(row2)は、薄い枠で囲んだ箱の中に、さらに2段に分けて配置する
        // (1段目: タイプ/分類/威力下限/命中下限、2段目: PP/接触/範囲)。
        var row2a = document.createElement('div'); row2a.className = 'dameke-search-move-filter-row2-sub';
        var row2b = document.createElement('div'); row2b.className = 'dameke-search-move-filter-row2-sub';
        [typeSel, catSel, powerInput, accInput].forEach(function(el){ row2a.appendChild(el); });
        [ppSel, contactSel, targetSel].forEach(function(el){ row2b.appendChild(el); });
        row2.appendChild(row2a); row2.appendChild(row2b);

        // 技名を指定した場合はそれのみで判定(2段目は無効化)、2段目のいずれかを指定した場合は
        // 技名を無効化する、相互排他の関係。
        function updateExclusivity(){
          var row2HasInput = !!(typeSel.value || catSel.value || powerInput.value || accInput.value || ppSel.value || contactSel.value || targetSel.value);
          var row1HasInput = !!nameSel.value;
          nameSel.disabled = row2HasInput;
          [typeSel, catSel, powerInput, accInput, ppSel, contactSel, targetSel].forEach(function(el){ el.disabled = row1HasInput; });
        }
        nameSel.addEventListener('change', function(){ filters.moveConditions[idx].name = nameSel.value; updateExclusivity(); renderResults(); });
        typeSel.addEventListener('change', function(){ filters.moveConditions[idx].type = typeSel.value; updateExclusivity(); renderResults(); });
        catSel.addEventListener('change', function(){ filters.moveConditions[idx].category = catSel.value; updateExclusivity(); renderResults(); });
        powerInput.addEventListener('input', function(){ filters.moveConditions[idx].minPower = powerInput.value===''?null:parseInt(powerInput.value,10); updateExclusivity(); renderResults(); });
        accInput.addEventListener('input', function(){ filters.moveConditions[idx].minAccuracy = accInput.value===''?null:parseInt(accInput.value,10); updateExclusivity(); renderResults(); });
        ppSel.addEventListener('change', function(){ filters.moveConditions[idx].pp = ppSel.value===''?null:parseInt(ppSel.value,10); updateExclusivity(); renderResults(); });
        contactSel.addEventListener('change', function(){ filters.moveConditions[idx].contact = contactSel.value; updateExclusivity(); renderResults(); });
        targetSel.addEventListener('change', function(){ filters.moveConditions[idx].target = targetSel.value; updateExclusivity(); renderResults(); });
        updateExclusivity();

        row.appendChild(row1); row.appendChild(row2);
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
    var megaOnlyLabel = document.createElement('label'); megaOnlyLabel.className='check';
    var megaOnlyCb = document.createElement('input'); megaOnlyCb.type='checkbox';
    var megaExcludeLabel = document.createElement('label'); megaExcludeLabel.className='check';
    var megaExcludeCb = document.createElement('input'); megaExcludeCb.type='checkbox';
    // 「メガシンカポケモンのみ」と「メガシンカポケモン除外」は互いに排他的(どちらか一方にしか
    // チェックが入らない)。片方をチェックしたら、もう片方は自動的に外す。
    megaOnlyCb.addEventListener('change', function(){
      filters.megaOnly = megaOnlyCb.checked;
      if(megaOnlyCb.checked){ filters.megaExclude = false; megaExcludeCb.checked = false; }
      renderResults();
    });
    megaExcludeCb.addEventListener('change', function(){
      filters.megaExclude = megaExcludeCb.checked;
      if(megaExcludeCb.checked){ filters.megaOnly = false; megaOnlyCb.checked = false; }
      renderResults();
    });
    megaOnlyLabel.appendChild(megaOnlyCb); megaOnlyLabel.appendChild(document.createTextNode('メガシンカポケモンのみ'));
    megaExcludeLabel.appendChild(megaExcludeCb); megaExcludeLabel.appendChild(document.createTextNode('メガシンカポケモン除外'));
    checksRow.appendChild(finalLabel); checksRow.appendChild(champLabel); checksRow.appendChild(megaOnlyLabel); checksRow.appendChild(megaExcludeLabel);
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
    if(sortBy === 'usage'){
      // rank(使用率順位)があるポケモンを昇順(=使用率が高い順)で並べ、データのない
      // ポケモンはその後ろに、既存の安定した図鑑番号順のまま配置する。usageRateやrankを
      // 0として扱ったり、シングル/ダブルの値を混同したりしないよう、選択中フォーマット
      // (usageFormat)のrankだけを見る。
      var withRank = [], withoutRank = [];
      list.forEach(function(p){
        var entry = usagePokemonEntry(p.name);
        if(entry && typeof entry.rank === 'number') withRank.push({ p: p, rank: entry.rank });
        else withoutRank.push(p);
      });
      withRank.sort(function(a,b){ return a.rank - b.rank; });
      return withRank.map(function(x){ return x.p; }).concat(withoutRank);
    }
    return list; // 'dex' -- keep DATA.pokemons' own (filter-preserved) order
  }
  function renderSortControls(){
    var host = q('damekeSearchSortHost');
    if(!host) return;
    host.innerHTML = '';

    // シングル/ダブルの形式切替。並び替え選択の左側に置く。使用率データが読み込めている
    // 場合のみ表示する。片方の形式しか収録されていない場合は、利用可能な形式だけを選択
    // 可能にする。
    if(usageData){
      var hasSingles = !!(usageData.formats && usageData.formats.singles);
      var hasDoubles = !!(usageData.formats && usageData.formats.doubles);
      if(hasSingles || hasDoubles){
        var formatSel = document.createElement('select'); formatSel.className = 'dameke-search-compact-select';
        if(hasSingles){ var opS = document.createElement('option'); opS.value='singles'; opS.textContent='シングル'; formatSel.appendChild(opS); }
        if(hasDoubles){ var opD = document.createElement('option'); opD.value='doubles'; opD.textContent='ダブル'; formatSel.appendChild(opD); }
        if(usageFormat === 'singles' && !hasSingles) usageFormat = 'doubles';
        if(usageFormat === 'doubles' && !hasDoubles) usageFormat = 'singles';
        formatSel.value = usageFormat;
        formatSel.addEventListener('change', function(){ usageFormat = formatSel.value; renderResults(); });
        host.appendChild(formatSel);
      }
    }

    var sortSel = document.createElement('select'); sortSel.className = 'dameke-search-compact-select';
    var options = [['dex','図鑑番号順'],['kana','五十音順'],['stat','種族値順'],['weight','おもさ順']];
    // 使用率データが読み込めている場合だけ「使用率順」を選択肢に加える。読み込めていない
    // 場合はこの選択肢自体を出さない(選べない状態にする)ことで、失敗時も一覧が空になったり
    // 壊れたりしないようにする。
    if(usageData) options.push(['usage','使用率順']);
    options.forEach(function(pair){
      var op = document.createElement('option'); op.value = pair[0]; op.textContent = pair[1]; sortSel.appendChild(op);
    });
    if(sortBy === 'usage' && !usageData) sortBy = 'dex'; // データが後から無効になった場合の保険
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
    // 日次更新日は、○件表示と同じ行の右端の専用ホストに配置する。
    var dateHost = q('damekeSearchUsageDateHost');
    if(dateHost){
      dateHost.innerHTML = '';
      if(usageData){
        var fd = usageFormatData();
        if(fd && fd.generatedAt){
          var d = new Date(fd.generatedAt);
          var dateStr = isNaN(d.getTime()) ? '' : (d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日');
          dateHost.textContent = '日次更新：' + dateStr;
          dateHost.className = 'dameke-search-usage-date-host';
        }
      }
    }
    // 出典は、一覧・詳細表示のカードより下、枠外の専用ホストに表示する(横幅の制約で
    // 見切れないようにするため)。
    var sourceHost = q('damekeSearchUsageSourceHost');
    if(sourceHost){
      sourceHost.innerHTML = '';
      if(usageData){
        sourceHost.textContent = '出典：' + (usageData.source && usageData.source.name || 'Pokemon Champions Battle Data');
      }
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
      // 使用率順で並べたとき、データのないポケモン(図鑑番号順で末尾に配置される分)は
      // 薄いグレー背景にして、データがある分と視覚的に区別できるようにする。
      if(sortBy === 'usage' && !usagePokemonEntry(p.name)){
        item.classList.add('dameke-search-result-item-nodata');
      }
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
    moveListFilter = { name:'', type:'', category:'', minPower:null, minAccuracy:null, pp:null, target:'', contact:'' };
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
  var moveListFilter = { name:'', type:'', category:'', minPower:null, minAccuracy:null, pp:null, target:'', contact:'' };
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
    var usageEntryForRank = usagePokemonEntry(p.name);
    var rankHtml = (usageEntryForRank && typeof usageEntryForRank.rank === 'number')
      ? '<div class="dameke-adjust-summary-note dameke-search-detail-flags">使用率 '+usageEntryForRank.rank+'位</div>'
      : '';
    headInfo.innerHTML = '<div class="dameke-history-title dameke-search-detail-name">'+nameHtml+'</div>'
      + '<div class="dameke-search-detail-types">'+(p.types||[]).map(function(t){ return '<span class="dameke-party-type-badge '+typeColorClass(t)+'">'+t+'</span>'; }).join('')+'</div>'
      + '<div class="dameke-adjust-summary-note">おもさ：'+p.weight+'kg</div>'
      + flagsHtml
      + rankHtml;
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

    // 人気の性格・努力値構成(使用率データがある場合のみ)。データがなければ、見出しごと
    // 一切表示しない。
    var usageEntry = usagePokemonEntry(p.name);
    if(usageEntry && ((usageEntry.natures && usageEntry.natures.length) || (usageEntry.evSpreads && usageEntry.evSpreads.length))){
      var usageFold = document.createElement('details'); usageFold.className = 'dameke-pokemon-edit-levelfold dameke-search-section-gap';
      var usageFoldSummary = document.createElement('summary'); usageFoldSummary.textContent = '人気の性格・努力値構成';
      usageFold.appendChild(usageFoldSummary);
      if(usageEntry.natures && usageEntry.natures.length){
        var natureTitle = document.createElement('div'); natureTitle.className='dameke-adjust-nature-title'; natureTitle.textContent='性格';
        usageFold.appendChild(natureTitle);
        var natureList = document.createElement('div'); natureList.className='dameke-search-usage-rate-list';
        usageEntry.natures.forEach(function(n){
          var row = document.createElement('div'); row.className='dameke-search-usage-rate-row';
          var label = document.createElement('span'); label.textContent = n.id;
          row.appendChild(label);
          if(n.rate != null){ var rate = document.createElement('span'); rate.className='dameke-search-usage-rate-value'; rate.textContent = n.rate.toFixed(1)+'%'; row.appendChild(rate); }
          natureList.appendChild(row);
        });
        usageFold.appendChild(natureList);
      }
      if(usageEntry.evSpreads && usageEntry.evSpreads.length){
        var evTitle = document.createElement('div'); evTitle.className='dameke-adjust-nature-title dameke-search-section-gap'; evTitle.textContent='努力値構成';
        usageFold.appendChild(evTitle);
        var evList = document.createElement('div'); evList.className='dameke-search-usage-rate-list';
        usageEntry.evSpreads.forEach(function(s){
          var row = document.createElement('div'); row.className='dameke-search-usage-rate-row';
          var label = document.createElement('span'); label.textContent = s.label;
          row.appendChild(label);
          if(s.rate != null){ var rate = document.createElement('span'); rate.className='dameke-search-usage-rate-value'; rate.textContent = s.rate.toFixed(1)+'%'; row.appendChild(rate); }
          evList.appendChild(row);
        });
        usageFold.appendChild(evList);
      }
      host.appendChild(usageFold);
    }

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

    // 特性の採用率(使用率データがある場合のみ)。このポケモンが実際に持ちうる特性の範囲に
    // 絞って表示する(データ側にIDが対応しないものはここには出てこない)。
    if(usageEntry && usageEntry.abilities && usageEntry.abilities.length){
      var abilityRateList = document.createElement('div'); abilityRateList.className='dameke-search-usage-rate-list';
      usageEntry.abilities.forEach(function(a){
        if((p.abilities||[]).indexOf(a.id) === -1) return; // このポケモンが持たない特性は無視
        var row = document.createElement('div'); row.className='dameke-search-usage-rate-row';
        var label = document.createElement('span'); label.textContent = a.id;
        row.appendChild(label);
        if(a.rate != null){ var rate = document.createElement('span'); rate.className='dameke-search-usage-rate-value'; rate.textContent = a.rate.toFixed(1)+'%'; row.appendChild(rate); }
        abilityRateList.appendChild(row);
      });
      if(abilityRateList.children.length) host.appendChild(abilityRateList);
    }

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
      renderMoveSection(host, learned, p);
    }

    // 持ち物採用率(使用率データがある場合のみ)。持ち物の画像・名前・採用率を一覧表示する。
    // 画像用の枠(itemImgWrap)は、画像の有無に関わらず必ず作成して常に同じ幅を確保する
    // (名前・採用率の表示位置を揃えるため)。画像が見つからない/読み込みに失敗した場合は、
    // 要素自体を消すのではなく、フォールバック表示(グレーの枠)に差し替える。
    if(usageEntry && usageEntry.items && usageEntry.items.length){
      var itemTitle = document.createElement('div'); itemTitle.className='dameke-adjust-nature-title dameke-search-section-gap'; itemTitle.textContent='持ち物採用率';
      host.appendChild(itemTitle);
      var itemList = document.createElement('div'); itemList.className='dameke-search-usage-item-list';
      usageEntry.items.forEach(function(it){
        var row = document.createElement('div'); row.className='dameke-search-usage-item-row';
        var itemImgWrap = document.createElement('span'); itemImgWrap.className='dameke-search-usage-item-thumb';
        function showFallback(){
          itemImgWrap.innerHTML = '';
          itemImgWrap.classList.add('dameke-search-usage-item-thumb-fallback');
        }
        var itemImg = window.__damekeBuildItemImage ? window.__damekeBuildItemImage(it.id, showFallback) : null;
        if(itemImg){ itemImgWrap.appendChild(itemImg); } else { showFallback(); }
        row.appendChild(itemImgWrap);
        var label = document.createElement('span'); label.textContent = it.id;
        row.appendChild(label);
        if(it.rate != null){ var rate = document.createElement('span'); rate.className='dameke-search-usage-rate-value'; rate.textContent = it.rate.toFixed(1)+'%'; row.appendChild(rate); }
        itemList.appendChild(row);
      });
      host.appendChild(itemList);
    }

    // 同じチームのポケモン(使用率データがある場合のみ)。クリックでそのポケモンの詳細表示へ
    // 遷移する。
    if(usageEntry && usageEntry.teammates && usageEntry.teammates.length){
      var teammateTitle = document.createElement('div'); teammateTitle.className='dameke-adjust-nature-title dameke-search-section-gap'; teammateTitle.textContent='同じチームのポケモン';
      host.appendChild(teammateTitle);
      var teammateWrap = document.createElement('div'); teammateWrap.className='dameke-search-result-host dameke-search-teammate-host';
      usageEntry.teammates.forEach(function(tm){
        var tmPokemon = DATA.pokemons.find(function(x){ return x.name === tm.id; });
        if(!tmPokemon) return; // 変換できなかった/だめけー側に存在しない場合は表示しない
        var item = document.createElement('div'); item.className = 'dameke-search-result-item';
        item.appendChild(buildThumb(tmPokemon.name));
        var nameEl = document.createElement('div'); nameEl.className='dameke-search-result-name'; nameEl.textContent=tmPokemon.name;
        item.appendChild(nameEl);
        item.addEventListener('click', function(){ showDetail(tmPokemon); });
        teammateWrap.appendChild(item);
      });
      if(teammateWrap.children.length) host.appendChild(teammateWrap);
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

  function renderMoveSection(host, learnedNames, p){
    var moveObjsAll = learnedNames.map(function(name){ return SELECTABLE_MOVES.find(function(m){ return m.name===name; }); }).filter(Boolean);
    // 技の採用率(使用率データがある場合のみ)。技名 -> {rate, isTop10} のマップを作る。
    var moveRateMap = {};
    var usageEntryForMoves = usagePokemonEntry(p.name);
    if(usageEntryForMoves && usageEntryForMoves.moves){
      usageEntryForMoves.moves.forEach(function(m, idx){ moveRateMap[m.id] = { rate: m.rate, isTop10: idx < 10 }; });
    }
    var hasMoveUsageData = Object.keys(moveRateMap).length > 0;

    var sortRow = document.createElement('div'); sortRow.className = 'dameke-search-inline-row';
    var sortLabel = document.createElement('span'); sortLabel.className='dameke-search-range-label dameke-search-sort-label'; sortLabel.textContent='並び替え';
    var sortSelect = document.createElement('select'); sortSelect.className = 'dameke-search-sort-select';
    var moveSortOptions = [['name','五十音順'],['type','タイプ順'],['power','威力順']];
    if(hasMoveUsageData) moveSortOptions.push(['usage','採用率順']);
    moveSortOptions.forEach(function(pair){ var op=document.createElement('option'); op.value=pair[0]; op.textContent=pair[1]; sortSelect.appendChild(op); });
    if(moveListSort === 'usage' && !hasMoveUsageData) moveListSort = 'type'; // データがない場合の保険
    sortSelect.value = moveListSort;
    sortSelect.addEventListener('change', function(){ moveListSort = sortSelect.value; renderMoveList(); });
    sortRow.appendChild(sortLabel); sortRow.appendChild(sortSelect);
    host.appendChild(sortRow);

    var filterFold = document.createElement('details'); filterFold.className = 'dameke-pokemon-edit-levelfold dameke-search-move-filter-fold';
    var filterSummary = document.createElement('summary'); filterSummary.textContent = '技の絞り込み';
    filterFold.appendChild(filterSummary);
    var filterGrid = document.createElement('div'); filterGrid.className = 'dameke-search-move-filter-grid';

    // 1段目: 技名(指定した場合はこれのみで判定)。2段目: タイプ/分類/威力下限/命中下限/PP/範囲
    // (いずれかを指定した場合、AND条件で判定)。どちらか一方に入力があれば、もう一方は無効化。
    var row1 = document.createElement('div'); row1.className = 'dameke-search-move-filter-row1';
    var row2 = document.createElement('div'); row2.className = 'dameke-search-move-filter-row2 dameke-search-move-filter-row2-box';

    var nameF = document.createElement('input'); nameF.type='text'; nameF.placeholder='技名';
    row1.appendChild(nameF);

    var typeF = makeCompactSelect(ALL_TYPES.map(function(t){return {id:t,name:t};}), 'タイプ指定なし');
    var catF = makeCompactSelect([{id:'物理',name:'物理'},{id:'特殊',name:'特殊'},{id:'変化',name:'変化'}], '分類指定なし');
    var powerF = document.createElement('input'); powerF.type='number'; powerF.placeholder='威力の下限';
    var accF = document.createElement('input'); accF.type='number'; accF.placeholder='命中の下限';
    var ppValues = Array.from(new Set(SELECTABLE_MOVES.map(function(m){ return m.pp; }).filter(function(v){ return v!=null; }))).sort(function(a,b){return a-b;});
    var ppF = makeCompactSelect(ppValues.map(function(v){ return {id:String(v), name:String(v)}; }), 'PP指定なし');
    var contactF = makeCompactSelect([{id:'true',name:'接触'},{id:'false',name:'非接触'}], '接触指定なし');
    var targetValues = Array.from(new Set(SELECTABLE_MOVES.map(function(m){ return m.target; }).filter(Boolean))).sort();
    var targetF = makeCompactSelect(targetValues.map(function(v){ return {id:v, name:v}; }), '範囲指定なし');
    // 2段目(row2)は、薄い枠で囲んだ箱の中に、さらに2段に分けて配置する
    // (1段目: タイプ/分類/威力下限/命中下限、2段目: PP/接触/範囲)。
    var row2aDetail = document.createElement('div'); row2aDetail.className = 'dameke-search-move-filter-row2-sub';
    var row2bDetail = document.createElement('div'); row2bDetail.className = 'dameke-search-move-filter-row2-sub';
    [typeF, catF, powerF, accF].forEach(function(el){ row2aDetail.appendChild(el); });
    [ppF, contactF, targetF].forEach(function(el){ row2bDetail.appendChild(el); });
    row2.appendChild(row2aDetail); row2.appendChild(row2bDetail);

    function updateMoveFilterExclusivity(){
      var row2HasInput = !!(typeF.value || catF.value || powerF.value || accF.value || ppF.value || contactF.value || targetF.value);
      var row1HasInput = !!nameF.value;
      nameF.disabled = row2HasInput;
      [typeF, catF, powerF, accF, ppF, contactF, targetF].forEach(function(el){ el.disabled = row1HasInput; });
    }
    nameF.addEventListener('input', function(){ moveListFilter.name = nameF.value; updateMoveFilterExclusivity(); renderMoveList(); });
    typeF.addEventListener('change', function(){ moveListFilter.type = typeF.value; updateMoveFilterExclusivity(); renderMoveList(); });
    catF.addEventListener('change', function(){ moveListFilter.category = catF.value; updateMoveFilterExclusivity(); renderMoveList(); });
    powerF.addEventListener('input', function(){ moveListFilter.minPower = powerF.value===''?null:parseInt(powerF.value,10); updateMoveFilterExclusivity(); renderMoveList(); });
    accF.addEventListener('input', function(){ moveListFilter.minAccuracy = accF.value===''?null:parseInt(accF.value,10); updateMoveFilterExclusivity(); renderMoveList(); });
    ppF.addEventListener('change', function(){ moveListFilter.pp = ppF.value===''?null:parseInt(ppF.value,10); updateMoveFilterExclusivity(); renderMoveList(); });
    contactF.addEventListener('change', function(){ moveListFilter.contact = contactF.value; updateMoveFilterExclusivity(); renderMoveList(); });
    targetF.addEventListener('change', function(){ moveListFilter.target = targetF.value; updateMoveFilterExclusivity(); renderMoveList(); });
    updateMoveFilterExclusivity();

    filterGrid.appendChild(row1); filterGrid.appendChild(row2);
    filterFold.appendChild(filterGrid);
    host.appendChild(filterFold);

    var header = document.createElement('div');
    header.className = 'dameke-search-move-row dameke-search-move-header';
    header.innerHTML = '<span>技名</span><span>タイプ</span><span>技分類</span><span>威力</span><span>命中</span><span>PP</span><span>接触</span><span>範囲</span>';
    host.appendChild(header);
    var listHost = document.createElement('div'); listHost.className = 'dameke-search-move-list';
    host.appendChild(listHost);

    function renderMoveList(){
      var moves = moveObjsAll.slice();
      if(moveListFilter.name){
        moves = moves.filter(function(m){ return kanaNormalize(m.name).indexOf(kanaNormalize(moveListFilter.name))>=0; });
      } else {
        if(moveListFilter.type) moves = moves.filter(function(m){ return m.type===moveListFilter.type; });
        if(moveListFilter.category) moves = moves.filter(function(m){ return m.category===moveListFilter.category; });
        if(moveListFilter.minPower != null) moves = moves.filter(function(m){ return (m.power||0) >= moveListFilter.minPower; });
        if(moveListFilter.minAccuracy != null) moves = moves.filter(function(m){ return (parseInt(m.accuracy,10)||0) >= moveListFilter.minAccuracy; });
        if(moveListFilter.pp != null) moves = moves.filter(function(m){ return m.pp === moveListFilter.pp; });
        if(moveListFilter.contact === 'true') moves = moves.filter(function(m){ return !!m.contact; });
        if(moveListFilter.contact === 'false') moves = moves.filter(function(m){ return !m.contact; });
        if(moveListFilter.target) moves = moves.filter(function(m){ return m.target === moveListFilter.target; });
      }
      moves.sort(function(a,b){
        if(moveListSort==='type'){
          var ia = TYPE_ORDER.indexOf(a.type), ib = TYPE_ORDER.indexOf(b.type);
          return (ia-ib) || a.name.localeCompare(b.name,'ja');
        }
        if(moveListSort==='power') return (b.power||0)-(a.power||0) || a.name.localeCompare(b.name,'ja');
        if(moveListSort==='usage'){
          var ra = moveRateMap[a.name] ? moveRateMap[a.name].rate : null;
          var rb = moveRateMap[b.name] ? moveRateMap[b.name].rate : null;
          if(ra != null && rb != null && ra !== rb) return rb - ra;
          if(ra != null && rb == null) return -1;
          if(ra == null && rb != null) return 1;
          // 同一順位・データなし同士は、タイプ順にフォールバックする。
          var ita = TYPE_ORDER.indexOf(a.type), itb = TYPE_ORDER.indexOf(b.type);
          return (ita-itb) || a.name.localeCompare(b.name,'ja');
        }
        return a.name.localeCompare(b.name,'ja');
      });
      listHost.innerHTML = moves.map(function(m){
        var usage = moveRateMap[m.name];
        // 採用率データがあり、かつ0%(採用なし)ではない技についてのみ、技名の下に採用率を
        // 表示する。採用率TOP10の技は、薄い黄色の枠で技名と採用率をあわせて強調する。
        var nameCellClass = 'dameke-search-move-name' + (usage && usage.isTop10 ? ' dameke-search-move-name-top10' : '');
        var rateHtml = (usage && usage.rate != null && usage.rate > 0)
          ? '<span class="dameke-search-move-rate">'+usage.rate.toFixed(1)+'%</span>' : '';
        return '<div class="dameke-search-move-row">'
          + '<span class="'+nameCellClass+'">'+m.name+rateHtml+'</span>'
          + '<span><span class="dameke-party-type-badge '+typeColorClass(m.type)+'">'+m.type+'</span></span>'
          + '<span>'+m.category+'</span>'
          + '<span>'+(m.power===1 ? '-' : (m.power||'-'))+'</span>'
          + '<span>'+(m.accuracy==='ONEHIT_KO' ? '-' : (m.accuracy||'-'))+'</span>'
          + '<span>'+(m.pp!=null?m.pp:'-')+'</span>'
          + '<span>'+(m.contact ? '○' : '×')+'</span>'
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
    // 使用率データは非同期で読み込み、検索自体をブロックしない。読み込み完了後に
    // 並び替えUI(使用率順の選択肢の有効/無効)と結果一覧を更新する。
    loadUsageData().then(function(){
      renderSortControls();
      renderResults();
    });
  }
  window.__damekeRenderSearchPanel = function(){
    if(!q('damekeSearchFilterHost').childElementCount) init();
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
