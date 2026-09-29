// v2.5.3: 瀕死率の表示。絶対に瀕死にならない場合(ちょうど0)は「不可」、ごくわずかでも可能性があれば0.00%。
function fmtFaintPct(p){ if(p == null) return '計算不可'; if(p === 0) return '不可'; return p.toFixed(2) + '%'; }
window.__damekeFmtFaintPct = fmtFaintPct;
// v2.4.0 ポケモン名の変更(ゲッコウガ(サトシゲッコウガ)→ゲッコウガ(サトシ)、ヨワシ(むれたすがた)→
// ヨワシ(むれた)。IDも ゲッコウガ_サトシ / ヨワシ_むれた に変更)に合わせ、端末に保存済みの計算履歴・
// ポケモン管理・パーティ等(localStorageの dameke_ で始まるキー)に残っている旧ID・旧名を、他の
// スクリプトが読み込むより前に1度だけ新しい表記へ置き換える。
(function(){
  var RENAMES = [
    ['ゲッコウガ_サトシゲッコウガ', 'ゲッコウガ_サトシ'],
    ['ゲッコウガ(サトシゲッコウガ)', 'ゲッコウガ(サトシ)'],
    ['ヨワシ_むれたすがた', 'ヨワシ_むれた'],
    ['ヨワシ(むれたすがた)', 'ヨワシ(むれた)']
  ];
  try{
    var ls = window.localStorage;
    if(!ls) return;
    var keys = [];
    for(var i = 0; i < ls.length; i++){ var k = ls.key(i); if(k && k.indexOf('dameke_') === 0) keys.push(k); }
    keys.forEach(function(k){
      var v = ls.getItem(k);
      if(typeof v !== 'string') return;
      var nv = v;
      RENAMES.forEach(function(r){ nv = nv.split(r[0]).join(r[1]); });
      if(nv !== v) ls.setItem(k, nv);
    });
  }catch(e){}
})();
// DAMEKE Web integrated application
// app.js is the single UI script loaded by index.html.
// Initialization is coordinated by the single-entry orchestrator at the end of this file.

// ===== BEGIN core application =====


(function () {
  const DATA = window.DAMEKE_DATA;
  const CALC = window.DAMEKE_CALC;
  const NL = String.fromCharCode(10);
  const STAT_KEYS = ['H','A','B','C','D','S','acc','eva'];
  const STAT_LABELS = { H:'HP', A:'攻撃', B:'防御', C:'特攻', D:'特防', S:'素早さ', acc:'命中', eva:'回避' };
  const NATURE_OPTIONS = [["がんばりや","がんばりや 補正なし"],["さみしがり","さみしがり A↑ B↓"],["いじっぱり","いじっぱり A↑ C↓"],["やんちゃ","やんちゃ A↑ D↓"],["ゆうかん","ゆうかん A↑ S↓"],["ずぶとい","ずぶとい B↑ A↓"],["すなお","すなお 補正なし"],["わんぱく","わんぱく B↑ C↓"],["のうてんき","のうてんき B↑ D↓"],["のんき","のんき B↑ S↓"],["ひかえめ","ひかえめ C↑ A↓"],["おっとり","おっとり C↑ B↓"],["てれや","てれや 補正なし"],["うっかりや","うっかりや C↑ D↓"],["れいせい","れいせい C↑ S↓"],["おだやか","おだやか D↑ A↓"],["おとなしい","おとなしい D↑ B↓"],["しんちょう","しんちょう D↑ C↓"],["きまぐれ","きまぐれ 補正なし"],["なまいき","なまいき D↑ S↓"],["おくびょう","おくびょう S↑ A↓"],["せっかち","せっかち S↑ B↓"],["ようき","ようき S↑ C↓"],["むじゃき","むじゃき S↑ D↓"],["まじめ","まじめ 補正なし"]];
  const OP_LABELS = { attackerPowerTrick:'攻撃側パワートリック', defenderPowerTrick:'防御側パワートリック', powerShare:'パワーシェア', guardShare:'ガードシェア', speedSwap:'スピードスワップ', wonderRoom:'ワンダールーム' };
  let transformOps = [];
  const ids = ['attackerSelect','defenderSelect','moveSelect','moveShowAll','attackerLevel','defenderLevel','attackerSpecialState','defenderSpecialState','attackerTeraType','defenderTeraType','attackerType1','attackerType2','defenderType1','defenderType2','attackerTypeOverride','defenderTypeOverride','attackerAddType','defenderAddType','attackerItemSelect','defenderItemSelect','attackerNoItem','defenderNoItem','attackerAbilitySelect','defenderAbilitySelect','attackerNoAbility','defenderNoAbility','weatherSelect','fieldSelect','magicRoom','gravity','protect','plasmaShower','neutralizingGasField','critical','electrify','pledgeCombination','defenderLuckyChant','defenderForesight','defenderMiracleEye','attackerEmbargo','defenderEmbargo','attackerStealthRock','defenderStealthRock','attackerSpikes','defenderSpikes','attackerSteelSurge','defenderSteelSurge','attackerRootedSmacked','defenderRootedSmacked','attackerMagnetRise','defenderMagnetRise','attackerTelekinesis','defenderTelekinesis','attackerRoost','defenderRoost','attackerBurnUp','defenderBurnUp','attackerDoubleShock','defenderDoubleShock','attackerCurrentHp','defenderCurrentHp','attackerStatsGrid','defenderStatsGrid','calculateButton','copyTraceButton','summary','trace','transformOpsDisplay','resetTransformOps'];
  const el = {};
  ids.forEach(id => { el[id] = document.getElementById(id); });
  function genderValue(prefix){
    var s = document.getElementById(prefix+'SexSelect');
    var v = s ? s.value : '';
    if(v==='♂') return 'male';
    if(v==='♀') return 'female';
    return 'unknown';
  }
  function fillSelect(select, items) { select.textContent = ""; for (const item of items) { const op = document.createElement('option'); op.value = item.id; op.textContent = item.name; select.appendChild(op); } }
  function getLearnsetKey(name) {
    var m = String(name || '').match(/^(.+?)\(([^)]+)\)$/);
    return m ? (m[1] + '_' + m[2]) : name;
  }
  function getFilteredMoves() {
    var D = window.DAMEKE_DATA;
    var allMoves = D.moves; // 専用Z/キョダイマックスの内部参照レコードはD.enhancedMoveInternalRefsに分離済みのためフィルタ不要
    if (el.moveShowAll && el.moveShowAll.checked) return allMoves;
    var attacker = byId(D.pokemons, el.attackerSelect.value);
    var LS = window.DAMEKE_LEARNSETS;
    if (!attacker || !LS) return allMoves;
    var key = getLearnsetKey(attacker.name);
    if (!LS.hasLearnset(key)) return allMoves;
    var learned = LS.getLearnset(key);
    var filtered = allMoves.filter(function(m){ return learned.indexOf(m.name) >= 0; });
    if(!filtered.length) return allMoves;
    // 技データが登録されているポケモンについては、選択肢の最後に「わるあがき」を追加する
    // (実際のゲームと同様、PPが尽きた際の代替技として常に選べるようにするため)。技データが
    // そもそも登録されていない場合(上のif文でallMovesにフォールバックする場合)は、
    // allMoves自体に元々わるあがきが含まれているため、ここでの追加は不要。
    var struggle = allMoves.find(function(m){ return m.id === 'わるあがき'; });
    if(struggle && filtered.indexOf(struggle) === -1) return filtered.concat([struggle]);
    return filtered;
  }
  function applyMoveFilter() {
    if (!el.moveSelect) return;
    var filtered = getFilteredMoves();
    var prevValue = el.moveSelect.value;
    fillSelect(el.moveSelect, filtered);
    var stillHas = filtered.some(function(m){ return m.id === prevValue; });
    if (stillHas) el.moveSelect.value = prevValue;
    if (el.moveSelect._v082hRefreshOptions) el.moveSelect._v082hRefreshOptions();
  }
  window.__damekeApplyMoveFilter = applyMoveFilter;
  // 技②選択欄の絞り込み。技①(getFilteredMoves/applyMoveFilter)とほぼ同じロジックだが、
  // 「全技」チェックボックスは技②側で独立に持つ(move2ShowAll)ため、別関数として複製している。
  function getFilteredMoves2() {
    var D = window.DAMEKE_DATA;
    var allMoves = D.moves;
    var showAllEl = document.getElementById('move2ShowAll');
    if (showAllEl && showAllEl.checked) return allMoves;
    var attacker = byId(D.pokemons, el.attackerSelect.value);
    var LS = window.DAMEKE_LEARNSETS;
    if (!attacker || !LS) return allMoves;
    var key = getLearnsetKey(attacker.name);
    if (!LS.hasLearnset(key)) return allMoves;
    var learned = LS.getLearnset(key);
    var filtered = allMoves.filter(function(m){ return learned.indexOf(m.name) >= 0; });
    if(!filtered.length) return allMoves;
    var struggle = allMoves.find(function(m){ return m.id === 'わるあがき'; });
    if(struggle && filtered.indexOf(struggle) === -1) return filtered.concat([struggle]);
    return filtered;
  }
  // 技②のみ、先頭に「なし」を追加する(デフォルト選択もこれにする)。技②を指定しない
  // (=1発のみで計算する)場合の明示的な選択肢として使う。技①側には追加しない。
  var MOVE2_NONE_ID = '__move2_none__';
  window.__damekeMove2NoneId = MOVE2_NONE_ID;
  function isMove2None() { var sel = document.getElementById('move2Select'); return !sel || sel.value === MOVE2_NONE_ID; }
  window.__damekeIsMove2None = isMove2None;
  function applyMoveFilter2() {
    var sel = document.getElementById('move2Select');
    if (!sel) return;
    var filtered = getFilteredMoves2();
    var prevValue = sel.value;
    var withNone = [{ id: MOVE2_NONE_ID, name: 'なし' }].concat(filtered);
    fillSelect(sel, withNone);
    var stillHas = withNone.some(function(m){ return m.id === prevValue; });
    sel.value = stillHas ? prevValue : MOVE2_NONE_ID;
    if (sel._v082hRefreshOptions) sel._v082hRefreshOptions();
    if (window.__damekeUpdateMoveOrderSwapButton) window.__damekeUpdateMoveOrderSwapButton();
  }
  window.__damekeApplyMoveFilter2 = applyMoveFilter2;
  function byId(items, id) { return items.find(x => x.id === id) || items[0]; }
  function statInputId(side, key, kind) { return side + '_' + key + '_' + kind; }
  window.__damekeStatKeys = STAT_KEYS;
  window.__damekeStatInputId = statInputId;
  window.__damekeGetTransformOps = function(){ return transformOps; };
  function createStatsGrid(side, host) {
    let html = '<div class="stat-row header"><span>能力</span><span>個体値</span><span>努力値</span><span>実数値</span><span>ランク</span></div>';
    html += '<div class="stat-row nature-row"><span>性格</span><select id="' + side + '_nature"></select><span>-</span><span>-</span><span>-</span></div>';
    for (const key of STAT_KEYS) {
      const hasIvEv = key !== 'acc' && key !== 'eva';
      const hasRank = key !== 'H';
      html += '<div class="stat-row"><span>' + STAT_LABELS[key] + '</span>';
      html += hasIvEv ? '<input id="' + statInputId(side,key,'iv') + '" type="number" min="0" max="31" value="31" />' : '<span>-</span>';
      html += hasIvEv ? '<input id="' + statInputId(side,key,'ev') + '" type="number" min="0" max="32" value="0" />' : '<span>-</span>';
      html += hasIvEv ? '<input id="' + statInputId(side,key,'actual') + '" type="number" />' : '<span>-</span>';
      html += hasRank ? '<input id="' + statInputId(side,key,'rank') + '" type="number" min="-6" max="6" value="0" />' : '<span>-</span>';
      html += '</div>';
    }
    host.innerHTML = html;
    const natureSelect = document.getElementById(side + '_nature');
    if (natureSelect) {
      for (const n of NATURE_OPTIONS) { const op = document.createElement('option'); op.value = n[0]; op.textContent = n[1]; natureSelect.appendChild(op); }
      natureSelect.value = 'まじめ';
    }
    bindActualStatInputs(side);
  }
  // 実数値 -> 努力値 reverse lookup: typing a target actual stat finds the minimum EV (0-32)
  // whose actual value reaches it, using that stat's own current nature/IV/level. The target is
  // clamped to [actualAt(0), actualAt(32)] first, so only values actually achievable for this
  // Pokemon (given the currently-entered nature) can ever be entered -- same convention already
  // used by ポケモン管理's own edit form.
  function bindActualStatInputs(side){
    STAT_KEYS.forEach(function(key){
      if(key === 'acc' || key === 'eva') return;
      var actualEl = document.getElementById(statInputId(side,key,'actual'));
      if(!actualEl) return;
      actualEl.addEventListener('change', function(){
        if(!window.__damekeReverseLookupEv) return;
        var target = parseInt(actualEl.value, 10);
        var result = window.__damekeReverseLookupEv(side, key, target);
        if(result == null) return;
        var evEl = document.getElementById(statInputId(side,key,'ev'));
        if(evEl) evEl.value = result.ev;
        // Set explicitly rather than relying solely on the later refresh -- that path skips
        // fields the user is still "actively" in, and change/blur timing isn't consistent
        // enough across browsers to guarantee it always fires after this field loses focus.
        actualEl.value = result.value;
        calculate();
        if(window.__damekeRefreshAll) window.__damekeRefreshAll();
      });
    });
  }
  function readStats(side) {
    const out = { ivs:{}, evs:{}, ranks:{} };
    const natureEl = document.getElementById(side + '_nature');
    out.nature = natureEl ? natureEl.value : 'まじめ';
    for (const key of STAT_KEYS) {
      if (key !== 'acc' && key !== 'eva') {
        out.ivs[key] = document.getElementById(statInputId(side,key,'iv')).value;
        out.evs[key] = document.getElementById(statInputId(side,key,'ev')).value;
      }
      if (key !== 'H') out.ranks[key] = document.getElementById(statInputId(side,key,'rank')).value;
    }
    return out;
  }
  function fillSelectBeatUpAllies() { ['beatUpAlly', 'move2BeatUpAlly'].forEach(function(prefix){ for (let i = 1; i <= 5; i++) { const s = document.getElementById(prefix + i); if (!s) continue; s.textContent = ""; const none = document.createElement('option'); none.value = 'none'; none.textContent = 'なし'; s.appendChild(none); for (const p of DATA.pokemons) { const op = document.createElement('option'); op.value = p.id; op.textContent = p.name; s.appendChild(op); } } }); } function setTypeDefaults(side) { const p = byId(DATA.pokemons, el[side + 'Select'].value); if (el[side + 'Type1']) el[side + 'Type1'].value = (p.types && p.types[0]) || 'なし'; if (el[side + 'Type2']) el[side + 'Type2'].value = (p.types && p.types[1]) || 'なし'; updateAllTypeColors(); if (el[side + 'AbilitySelect']) { el[side + 'AbilitySelect'].value = (p && p.abilities && p.abilities[0]) || 'なし'; } if (p && p.fixedGender) { const sexSel = document.getElementById(side + 'SexSelect'); if (sexSel) { sexSel.value = p.fixedGender; sexSel.dispatchEvent(new Event('change', {bubbles:true})); } } }
  const TYPE_COLOR_MAP = { 'なし':'none', 'ノーマル':'normal', 'ほのお':'fire', 'みず':'water', 'でんき':'electric', 'くさ':'grass', 'こおり':'ice', 'かくとう':'fighting', 'どく':'poison', 'じめん':'ground', 'ひこう':'flying', 'エスパー':'psychic', 'むし':'bug', 'いわ':'rock', 'ゴースト':'ghost', 'ドラゴン':'dragon', 'あく':'dark', 'はがね':'steel', 'フェアリー':'fairy', 'ステラ':'stellar' };
  function updateTypeColor(sel) {
    if (!sel) return;
    sel.classList.add('dameke-type-select');
    for (const k in TYPE_COLOR_MAP) sel.classList.remove('dameke-type-' + TYPE_COLOR_MAP[k]);
    const suffix = TYPE_COLOR_MAP[sel.value] || 'none';
    sel.classList.add('dameke-type-' + suffix);
  }
  function updateAllTypeColors() {
    ['attackerType1', 'attackerType2', 'defenderType1', 'defenderType2', 'attackerTeraType', 'defenderTeraType', 'move2AttackerTeraType'].forEach(function(id) { updateTypeColor(document.getElementById(id)); });
  }
  // moveSelect is wrapped by the search-combo UI (it needs search, unlike the fixed-19-option
  // type selects above), so the element actually visible on screen is its paired .v082h-search-input
  // sibling, not the (deliberately hidden) <select> itself -- the color has to go on that input
  // to be seen. The dropdown's own candidate items are intentionally left uncolored, matching how
  // the type selects' own <option> list is forced back to plain white/black (see .dameke-type-select
  // option in style.css) rather than inheriting the gradient.
  function updateMoveTypeColor(){
    var sel = document.getElementById('moveSelect');
    if(!sel) return;
    var input = sel.closest('.v082h-search-combo');
    input = input ? input.querySelector('.v082h-search-input') : null;
    if(!input) return;
    var move = DATA.moves.find(function(m){ return m.id === sel.value; });
    input.classList.add('dameke-type-select');
    for (const k in TYPE_COLOR_MAP) input.classList.remove('dameke-type-' + TYPE_COLOR_MAP[k]);
    var suffix = TYPE_COLOR_MAP[move ? move.type : 'なし'] || 'none';
    input.classList.add('dameke-type-' + suffix);
  }
  window.__damekeUpdateMoveTypeColor = updateMoveTypeColor;
  // 技②側も技①とまったく同じ仕組み(検索ボックスの表示用input要素へのタイプ色クラス付与)で
  // 色付けする。「なし」が選ばれているときは無色(なし)扱いにする。
  function updateMove2TypeColor(){
    var sel = document.getElementById('move2Select');
    if(!sel) return;
    var input = sel.closest('.v082h-search-combo');
    input = input ? input.querySelector('.v082h-search-input') : null;
    if(!input) return;
    var isNone = window.__damekeIsMove2None && window.__damekeIsMove2None();
    var move = isNone ? null : DATA.moves.find(function(m){ return m.id === sel.value; });
    input.classList.add('dameke-type-select');
    for (const k in TYPE_COLOR_MAP) input.classList.remove('dameke-type-' + TYPE_COLOR_MAP[k]);
    var suffix = TYPE_COLOR_MAP[move ? move.type : 'なし'] || 'none';
    input.classList.add('dameke-type-' + suffix);
  }
  window.__damekeUpdateMove2TypeColor = updateMove2TypeColor;
  window.__damekeUpdateTypeColors = updateAllTypeColors; function formatTrace(trace) {
  const order = [
    '持ち物（攻撃側）','持ち物（防御側）','特性（攻撃側）','特性（防御側）','天候','フィールド',
    'Z・ダイマックス（攻撃側）','ダイマックス（防御側）','テラスタル（攻撃側）','テラスタル（防御側）','技名変換','強化技効果',
    '計算上タイプ（攻撃側）','計算上タイプ（防御側）','実数値操作','接地判定（攻撃側）','接地判定（防御側）',
    'すばやさ詳細（攻撃側）','すばやさ詳細（防御側）','計算上おもさ（攻撃側）','計算上おもさ（防御側）',
    '実効ランク（攻撃側）','実効ランク（防御側）','攻撃側ランク補正込み実数値','防御側ランク補正込み実数値',
    '物理/特殊判定','技タイプ','連続攻撃','変動後威力','補正後攻撃側実数値','補正後防御側実数値',
    'ダメージ変動値','タイプ相性詳細','ダメージ補正値','基本ダメージ','急所','乱数','優先度','直接攻撃判定','無効要素'
  ];
  const orderMap = new Map(order.map((x, i) => [x, i]));
  function cleanLabel(label) {
    let s = String(label || '');
    s = s.replace(/^\s*00\s+/, '').replace(/^\s*02\s+/, '').replace(/^\s*N\d+\s+/, '').trim();
    if (s === 'Z・ダイマックス（防御側）') s = 'ダイマックス（防御側）';
    return s;
  }
  const rows = (trace || []).filter(x => !String(x.label).includes('まきびし接地判定')).map((x, i) => {
    const label = cleanLabel(x.label);
    let idx = orderMap.has(label) ? orderMap.get(label) : 999;
    // ダメージ変動値は複数回出るため、元の出現順を維持します。
    return { item: x, originalIndex: i, label, orderIndex: idx };
  });
  rows.sort((a, b) => (a.orderIndex - b.orderIndex) || (a.originalIndex - b.originalIndex));
  return rows.map((row, i) => {
    const x = row.item;
    const no = String(i + 1).padStart(2, '0');
    const mark = x.implemented === false ? ' [未実装]' : '';
    const note = x.note ? ' / ' + x.note : '';
    return no + '. [' + row.label + ']' + mark + ' ' + x.name + ': ' + x.value + note;
  }).join(NL);
}
  function specialStatesForDefender() { return DATA.specialStates.filter(s => s.kind === 'none' || s.kind === 'dynamax' || s.kind === 'gmax'); }
  function updateOpsDisplay() { el.transformOpsDisplay.textContent = transformOps.length ? transformOps.map((x, i) => (i + 1) + '. ' + OP_LABELS[x]).join(' → ') : 'なし'; }
  window.__damekeUpdateOpsDisplay = updateOpsDisplay;
  // 技②固有条件(rolloutHitなど)は、技①のものとは別idのフィールドを持っている。技スロット
  // (1 or 2)を指定すると、該当する分だけ差し替えたオプションを返す。それ以外の共通条件
  // (特性・持ち物・天候・場・両側のステータスなど)は技①・技②で完全に共通なので触らない。
  function moveConditionOptions(idPrefix){
    function gid(base){
      var id = idPrefix ? (idPrefix + base.charAt(0).toUpperCase() + base.slice(1)) : base;
      return document.getElementById(id);
    }
    return {
      rolloutHit: gid('rolloutHit') ? gid('rolloutHit').value : '1',
      defenseCurl: !!(gid('defenseCurl') && gid('defenseCurl').checked),
      echoedVoiceCount: gid('echoedVoiceCount') ? gid('echoedVoiceCount').value : '1',
      moveOrder: gid('moveOrder') ? gid('moveOrder').value : 'first',
      targetSwitching: !!(gid('targetSwitching') && gid('targetSwitching').checked),
      faintedAllies: gid('faintedAllies') ? gid('faintedAllies').value : '0',
      supremeOverlordFaintedAllies: gid('supremeOverlordFaintedAllies') ? gid('supremeOverlordFaintedAllies').value : '0',
      friendship: gid('friendship') ? gid('friendship').value : '255',
      remainingPP: gid('remainingPP') ? gid('remainingPP').value : '4',
      lastMoveFailed: !!(gid('lastMoveFailed') && gid('lastMoveFailed').checked),
      userDamagedThisTurn: !!(gid('userDamagedThisTurn') && gid('userDamagedThisTurn').checked),
      targetDamagedThisTurn: !!(gid('targetDamagedThisTurn') && gid('targetDamagedThisTurn').checked),
      stockpileCount: gid('stockpileCount') ? gid('stockpileCount').value : '1',
      presentPower: gid('presentPower') ? gid('presentPower').value : '40',
      rageFistHitCount: gid('rageFistHitCount') ? gid('rageFistHitCount').value : '0',
      magnitudePower: gid('magnitudePower') ? gid('magnitudePower').value : '70',
      roundAllyUsed: !!(gid('roundAllyUsed') && gid('roundAllyUsed').checked),
      furyCutterCount: gid('furyCutterCount') ? gid('furyCutterCount').value : '1',
      statDroppedThisTurn: !!(gid('statDroppedThisTurn') && gid('statDroppedThisTurn').checked),
      allyFaintedLastTurn: !!(gid('allyFaintedLastTurn') && gid('allyFaintedLastTurn').checked),
      beatUpAlly1: gid('beatUpAlly1') ? gid('beatUpAlly1').value : 'none',
      beatUpAlly2: gid('beatUpAlly2') ? gid('beatUpAlly2').value : 'none',
      beatUpAlly3: gid('beatUpAlly3') ? gid('beatUpAlly3').value : 'none',
      beatUpAlly4: gid('beatUpAlly4') ? gid('beatUpAlly4').value : 'none',
      beatUpAlly5: gid('beatUpAlly5') ? gid('beatUpAlly5').value : 'none',
      orderUpForm: gid('orderUpForm') ? gid('orderUpForm').value : 'なし'
    };
  }
  // もうどくは、ダメージ計算上は「どく」として扱い(からげんき・ベノムショック等)、ターン終了時のダメージ
  // (最大HP×カウント/16)だけ区別する。
  function statusForCalc(side) {
    var v = (document.getElementById(side + 'Status')||{}).value || 'なし';
    return v === 'もうどく' ? 'どく' : v;
  }
  function buildOptions(moveSlot) {
    var base = {
      attackerItemId: el.attackerItemSelect.value, defenderItemId: el.defenderItemSelect.value, attackerNoItem: el.attackerNoItem.checked, defenderNoItem: el.defenderNoItem.checked,
      attackerAbilityId: el.attackerAbilitySelect.value, defenderAbilityId: el.defenderAbilitySelect.value, attackerNoAbility: el.attackerNoAbility.checked, defenderNoAbility: el.defenderNoAbility.checked,
      attackerSpecialState: el.attackerSpecialState.value, defenderSpecialState: el.defenderSpecialState.value, attackerTeraType: el.attackerTeraType.value, defenderTeraType: el.defenderTeraType.value, attackerGender: genderValue('attacker'), defenderGender: genderValue('defender'),
      attackerType1: el.attackerType1.value, attackerType2: el.attackerType2.value, defenderType1: el.defenderType1.value, defenderType2: el.defenderType2.value, attackerTypeOverride: el.attackerTypeOverride.value, defenderTypeOverride: el.defenderTypeOverride.value, attackerAddType: el.attackerAddType.value, defenderAddType: el.defenderAddType.value, weather: el.weatherSelect.value, field: el.fieldSelect.value, magicRoom: el.magicRoom.checked, gravity: el.gravity.checked, protect: el.protect.checked, plasmaShower: el.plasmaShower.checked, neutralizingGasField: el.neutralizingGasField.checked,
      critical: (document.getElementById('attackerCriticalForce') && document.getElementById('attackerCriticalForce').checked) ? 3 : (parseInt(el.critical.value, 10) || 0), attackerGMaxRapidStrike: document.getElementById('attackerGMaxRapidStrike') ? (parseInt(document.getElementById('attackerGMaxRapidStrike').value, 10) || 0) : 0, attackerRainbow: !!(document.getElementById('attackerRainbow') && document.getElementById('attackerRainbow').checked), attackerFocusEnergy: !!(document.getElementById('attackerFocusEnergy') && document.getElementById('attackerFocusEnergy').checked), electrify: el.electrify.checked, pledgeCombination: el.pledgeCombination.checked,
      defenderLuckyChant: el.defenderLuckyChant.checked, defenderForesight: el.defenderForesight.checked, defenderMiracleEye: el.defenderMiracleEye.checked,
      attackerEmbargo: el.attackerEmbargo.checked, defenderEmbargo: el.defenderEmbargo.checked, attackerStealthRock: el.attackerStealthRock.checked, defenderStealthRock: el.defenderStealthRock.checked,
      attackerSpikes: el.attackerSpikes.value, defenderSpikes: el.defenderSpikes.value, attackerSteelSurge: el.attackerSteelSurge.checked, defenderSteelSurge: el.defenderSteelSurge.checked, attackerRootedSmacked: el.attackerRootedSmacked.checked, defenderRootedSmacked: el.defenderRootedSmacked.checked, attackerIngrain: !!(document.getElementById('attackerIngrain') && document.getElementById('attackerIngrain').checked), defenderIngrain: !!(document.getElementById('defenderIngrain') && document.getElementById('defenderIngrain').checked), defenderSeaOfFire: !!(document.getElementById('defenderSeaOfFire') && document.getElementById('defenderSeaOfFire').checked), attackerMagnetRise: el.attackerMagnetRise.checked, defenderMagnetRise: el.defenderMagnetRise.checked, attackerTelekinesis: el.attackerTelekinesis.checked, defenderTelekinesis: el.defenderTelekinesis.checked, attackerRoost: el.attackerRoost.checked, defenderRoost: el.defenderRoost.checked, attackerBurnUp: el.attackerBurnUp.checked, defenderBurnUp: el.defenderBurnUp.checked, attackerDoubleShock: el.attackerDoubleShock.checked, defenderDoubleShock: el.defenderDoubleShock.checked,
      attackerCurrentHpInput: el.attackerCurrentHp.value, defenderCurrentHpInput: el.defenderCurrentHp.value, attackerStats: readStats('attacker'), defenderStats: readStats('defender'), transformOps: transformOps.slice(), attackerStatus: statusForCalc('attacker'), defenderStatus: statusForCalc('defender'), attackerToxic: ((document.getElementById('attackerStatus')||{}).value === 'もうどく'), defenderToxic: ((document.getElementById('defenderStatus')||{}).value === 'もうどく'), attackerToxicCount: (document.getElementById('attackerToxicCount')||{}).value || '1', defenderToxicCount: (document.getElementById('defenderToxicCount')||{}).value || '1', defenderSemiInvulnerable: (document.getElementById('defenderSemiInvulnerable')||{}).value || 'なし', rolloutHit: document.getElementById('rolloutHit') ? document.getElementById('rolloutHit').value : '1', defenseCurl: !!(document.getElementById('defenseCurl') && document.getElementById('defenseCurl').checked), echoedVoiceCount: document.getElementById('echoedVoiceCount') ? document.getElementById('echoedVoiceCount').value : '1', moveOrder: document.getElementById('moveOrder') ? document.getElementById('moveOrder').value : 'first', targetSwitching: !!(document.getElementById('targetSwitching') && document.getElementById('targetSwitching').checked), faintedAllies: document.getElementById('faintedAllies') ? document.getElementById('faintedAllies').value : '0', supremeOverlordFaintedAllies: document.getElementById('supremeOverlordFaintedAllies') ? document.getElementById('supremeOverlordFaintedAllies').value : '0', friendship: document.getElementById('friendship') ? document.getElementById('friendship').value : '255', remainingPP: document.getElementById('remainingPP') ? document.getElementById('remainingPP').value : '4', lastMoveFailed: !!(document.getElementById('lastMoveFailed') && document.getElementById('lastMoveFailed').checked), userDamagedThisTurn: !!(document.getElementById('userDamagedThisTurn') && document.getElementById('userDamagedThisTurn').checked), targetDamagedThisTurn: !!(document.getElementById('targetDamagedThisTurn') && document.getElementById('targetDamagedThisTurn').checked), stockpileCount: document.getElementById('stockpileCount') ? document.getElementById('stockpileCount').value : '1', presentPower: document.getElementById('presentPower') ? document.getElementById('presentPower').value : '40', rageFistHitCount: document.getElementById('rageFistHitCount') ? document.getElementById('rageFistHitCount').value : '0', magnitudePower: document.getElementById('magnitudePower') ? document.getElementById('magnitudePower').value : '70', roundAllyUsed: !!(document.getElementById('roundAllyUsed') && document.getElementById('roundAllyUsed').checked), furyCutterCount: document.getElementById('furyCutterCount') ? document.getElementById('furyCutterCount').value : '1', psywaveMultiplier: document.getElementById('psywaveMultiplier') ? document.getElementById('psywaveMultiplier').value : '1', kimagureLaserDouble: !!(document.getElementById('kimagureLaserDouble') && document.getElementById('kimagureLaserDouble').checked), fixedDamageTaken: document.getElementById('fixedDamageTaken') ? document.getElementById('fixedDamageTaken').value : '0', defenderScreen: document.getElementById('defenderScreen') ? document.getElementById('defenderScreen').value : 'none', defenderFriendGuard: !!(document.getElementById('defenderFriendGuard') && document.getElementById('defenderFriendGuard').checked), defenderMinimized: !!(document.getElementById('defenderMinimized') && document.getElementById('defenderMinimized').checked), defenderProtectState: document.getElementById('defenderProtectState') ? document.getElementById('defenderProtectState').value : 'none', metronomeUseCount: document.getElementById('metronomeUseCount') ? document.getElementById('metronomeUseCount').value : '1', defenderForesight: !!(document.getElementById('defenderForesight') && document.getElementById('defenderForesight').checked), defenderMiracleEye: !!(document.getElementById('defenderMiracleEye') && document.getElementById('defenderMiracleEye').checked), defenderTarShot: !!(document.getElementById('defenderTarShot') && document.getElementById('defenderTarShot').checked), attackerStellarMoveCount: document.getElementById('attackerStellarMoveCount') ? document.getElementById('attackerStellarMoveCount').value : 'first', attackerDoubleDamage: !!(document.getElementById('attackerDoubleDamage') && document.getElementById('attackerDoubleDamage').checked), defenderGlaiveRush: !!(document.getElementById('defenderGlaiveRush') && document.getElementById('defenderGlaiveRush').checked), beadsOfRuinField: !!(document.getElementById('beadsOfRuinField') && document.getElementById('beadsOfRuinField').checked), swordOfRuinField: !!(document.getElementById('swordOfRuinField') && document.getElementById('swordOfRuinField').checked), defenderFlowerGiftSupport: !!(document.getElementById('defenderFlowerGiftSupport') && document.getElementById('defenderFlowerGiftSupport').checked), vesselOfRuinField: !!(document.getElementById('vesselOfRuinField') && document.getElementById('vesselOfRuinField').checked), tabletsOfRuinField: !!(document.getElementById('tabletsOfRuinField') && document.getElementById('tabletsOfRuinField').checked), flowerGiftSupport: !!(document.getElementById('flowerGiftSupport') && document.getElementById('flowerGiftSupport').checked), plusMinusSupport: !!(document.getElementById('plusMinusSupport') && document.getElementById('plusMinusSupport').checked), flashFireActivated: !!(document.getElementById('flashFireActivated') && document.getElementById('flashFireActivated').checked), stakeoutSwitchIn: !!(document.getElementById('stakeoutSwitchIn') && document.getElementById('stakeoutSwitchIn').checked), batterySupport: !!(document.getElementById('batterySupport') && document.getElementById('batterySupport').checked), powerSpotSupport: !!(document.getElementById('powerSpotSupport') && document.getElementById('powerSpotSupport').checked), steelSpiritCount: document.getElementById('steelSpiritCount') ? document.getElementById('steelSpiritCount').value : '0', helpingHandCount: document.getElementById('helpingHandCount') ? document.getElementById('helpingHandCount').value : '0', meFirst: !!(document.getElementById('meFirst') && document.getElementById('meFirst').checked), charge: !!(document.getElementById('charge') && document.getElementById('charge').checked), analyzeMovedLast: !!(document.getElementById('analyzeMovedLast') && document.getElementById('analyzeMovedLast').checked), fairyAuraField: !!(document.getElementById('fairyAuraField') && document.getElementById('fairyAuraField').checked), darkAuraField: !!(document.getElementById('darkAuraField') && document.getElementById('darkAuraField').checked), mudSport: !!(document.getElementById('mudSport') && document.getElementById('mudSport').checked), waterSport: !!(document.getElementById('waterSport') && document.getElementById('waterSport').checked), weatherSuppressField: !!(document.getElementById('weatherSuppressField') && document.getElementById('weatherSuppressField').checked), statDroppedThisTurn: !!(document.getElementById('statDroppedThisTurn') && document.getElementById('statDroppedThisTurn').checked), allyFaintedLastTurn: !!(document.getElementById('allyFaintedLastTurn') && document.getElementById('allyFaintedLastTurn').checked), beatUpAlly1: document.getElementById('beatUpAlly1') ? document.getElementById('beatUpAlly1').value : 'none', beatUpAlly2: document.getElementById('beatUpAlly2') ? document.getElementById('beatUpAlly2').value : 'none', beatUpAlly3: document.getElementById('beatUpAlly3') ? document.getElementById('beatUpAlly3').value : 'none', beatUpAlly4: document.getElementById('beatUpAlly4') ? document.getElementById('beatUpAlly4').value : 'none', beatUpAlly5: document.getElementById('beatUpAlly5') ? document.getElementById('beatUpAlly5').value : 'none', attackerTailwind: !!(document.getElementById('attackerTailwind') && document.getElementById('attackerTailwind').checked), attackerLockOn: !!(document.getElementById('attackerLockOn') && document.getElementById('attackerLockOn').checked), attackerMicleBerry: !!(document.getElementById('attackerMicleBerry') && document.getElementById('attackerMicleBerry').checked), attackerVictoryStar: !!(document.getElementById('attackerVictoryStar') && document.getElementById('attackerVictoryStar').checked), defenderConfusion: !!(document.getElementById('defenderConfusion') && document.getElementById('defenderConfusion').checked), defenderSubstitute: !!(document.getElementById('defenderSubstitute') && document.getElementById('defenderSubstitute').checked), focusLensMoveOrder: document.getElementById('focusLensMoveOrder') ? document.getElementById('focusLensMoveOrder').value : 'first', defenderTailwind: !!(document.getElementById('defenderTailwind') && document.getElementById('defenderTailwind').checked), attackerSwamp: !!(document.getElementById('attackerSwamp') && document.getElementById('attackerSwamp').checked), defenderSwamp: !!(document.getElementById('defenderSwamp') && document.getElementById('defenderSwamp').checked), attackerSlowStart: !!(document.getElementById('attackerSlowStart') && document.getElementById('attackerSlowStart').checked), defenderSlowStart: !!(document.getElementById('defenderSlowStart') && document.getElementById('defenderSlowStart').checked), attackerUnburden: !!(document.getElementById('attackerUnburden') && document.getElementById('attackerUnburden').checked), defenderUnburden: !!(document.getElementById('defenderUnburden') && document.getElementById('defenderUnburden').checked), attackerParadoxBoostStat: document.getElementById('attackerParadoxBoostStat') ? document.getElementById('attackerParadoxBoostStat').value : 'none', defenderParadoxBoostStat: document.getElementById('defenderParadoxBoostStat') ? document.getElementById('defenderParadoxBoostStat').value : 'none', attackerBodyPurge: document.getElementById('attackerBodyPurge') ? document.getElementById('attackerBodyPurge').value : '0', defenderBodyPurge: document.getElementById('defenderBodyPurge') ? document.getElementById('defenderBodyPurge').value : '0',
      orderUpForm: document.getElementById('orderUpForm') ? document.getElementById('orderUpForm').value : 'なし',
      moldBreaker: false, neutralizingGas: false, attackerItemSuppressed: false, defenderItemSuppressed: false
    };
    if (moveSlot === 2) {
      var move2SS = document.getElementById('move2AttackerSpecialState'), move2TT = document.getElementById('move2AttackerTeraType');
      return Object.assign(base, moveConditionOptions('move2'), {
        critical: (document.getElementById('move2CriticalForce') && document.getElementById('move2CriticalForce').checked) ? 3 : (parseInt(el.critical.value, 10) || 0),
        attackerSpecialState: move2SS ? move2SS.value : base.attackerSpecialState,
        attackerTeraType: move2TT ? move2TT.value : base.attackerTeraType
      });
    }
    return base;
  }
  // 攻防交代・ポケモン管理への保存(テラスタルのみ)など、技①・技②の区別を持たない既存の
  // 単一フィールド向け処理に渡すための「代表値」を、技①・技②のどちらかに指定があればそれを
  // 使う形で解決する。ルール1(相互排他)により両方に値がある場合は一致しているはずなので、
  // どちらを優先しても結果は同じになる。
  function canonicalAttackerField(id1, id2, noneVal) {
    var e1 = document.getElementById(id1), e2 = document.getElementById(id2);
    var v1 = e1 ? e1.value : noneVal, v2 = e2 ? e2.value : noneVal;
    if (v1 && v1 !== noneVal) return v1;
    if (v2 && v2 !== noneVal) return v2;
    return noneVal;
  }
  window.__damekeCanonicalAttackerSpecialState = function () { return canonicalAttackerField('attackerSpecialState', 'move2AttackerSpecialState', 'none'); };
  window.__damekeCanonicalAttackerTeraType = function () { return canonicalAttackerField('attackerTeraType', 'move2AttackerTeraType', 'なし'); };
  // ルール1: 技①・技②のテラスタルは同一の変身状態を表すため、片方が「なし」以外に設定されたら
  // もう片方は「なし」かその同じタイプしか選べないようにする。選択不可にするだけでなく、
  // 該当しない<option>そのものを候補から取り除く(disabledで残すのではなく、fillSelectで
  // 選択肢一覧ごと作り直す)。
  function updateAttackerTeraExclusivity() {
    var m1 = document.getElementById('attackerTeraType'), m2 = document.getElementById('move2AttackerTeraType');
    if (!m1 || !m2) return;
    var allTera = DATA.teraTypes || [];
    function allowedList(sourceVal) {
      if (sourceVal && sourceVal !== 'なし') {
        return allTera.filter(function (t) { return t.id === 'なし' || t.id === sourceVal; });
      }
      return allTera;
    }
    // 基準にする値は、技①・技②どちらか一方の生の値をお互いに参照し合うのではなく、
    // canonicalAttackerField(なしでない方を優先)で1つに解決してから両方の選択肢をそれで
    // 作り直す。お互いの生の値を参照し合う実装だと、外部コード(攻防交代・技順序入替・
    // ポケモン管理復元など)が一時的に矛盾した組み合わせを書き込んだ場合に、2回連続で
    // 「相手基準の作り直し」が走って両方ともなしへ巻き戻ってしまうことがあるため。
    var canonical = canonicalAttackerField('attackerTeraType', 'move2AttackerTeraType', 'なし');
    var list = allowedList(canonical);
    function rebuild(target) {
      var prevValue = target.value;
      fillSelect(target, list);
      var stillValid = list.some(function (t) { return t.id === prevValue; });
      target.value = stillValid ? prevValue : 'なし';
      updateTypeColor(target);
    }
    rebuild(m1);
    rebuild(m2);
  }
  window.__damekeUpdateAttackerTeraExclusivity = updateAttackerTeraExclusivity;
  // updateAttackerTeraExclusivityは選択肢そのものを絞り込むため、技①・技②のテラスタル欄へ
  // 外部コード(攻防交代・ポケモン管理復元など)が直接.valueを書き込もうとした際、絞り込まれた
  // ままの選択肢に書き込み先の<option>が存在しないと代入が無視されてしまう(disabledで
  // 残すだけだった旧実装では起きなかった問題)。そのような直接代入の直前に呼び出し、
  // 一旦全タイプへ選択肢を戻しておくためのヘルパー。呼び出し側は一連の代入が終わった後、
  // 最終的にupdateAttackerTeraExclusivity()を呼んで正しい絞り込みへ戻すこと。
  function widenAttackerTeraOptions() {
    var allTera = DATA.teraTypes || [];
    [document.getElementById('attackerTeraType'), document.getElementById('move2AttackerTeraType')].forEach(function (sel) {
      if (sel) { var prev = sel.value; fillSelect(sel, allTera); if (allTera.some(function(t){return t.id===prev;})) sel.value = prev; }
    });
  }
  window.__damekeWidenAttackerTeraOptions = widenAttackerTeraOptions;
  window.__damekeBuildOptions = buildOptions;
  // For the 攻撃・防御調整 tool: it needs the calculator's full current input snapshot
  // without duplicating buildOptions()'s DOM-reading logic in a second file. buildOptions()
  // already calls readStats() internally for both sides (options.attackerStats/defenderStats),
  // so this single call captures everything needed.
  window.__damekeSnapshotCalculatorInput = function(){
    return {
      attacker: byId(DATA.pokemons, el.attackerSelect.value),
      defender: byId(DATA.pokemons, el.defenderSelect.value),
      move: byId(DATA.moves, el.moveSelect.value),
      attackerLevel: el.attackerLevel.value,
      defenderLevel: el.defenderLevel.value,
      options: buildOptions()
    };
  };
  // For ポケモン検索's "ダメージ計算機へ" links: sets the calculator's own attacker/defender
  // select to the given species and fires the same change event picking it manually would, so
  // every downstream listener (stat panel rebuild, ability/item options, etc.) runs exactly as
  // it would for a normal selection.
  window.__damekeLoadPokemonIntoCalculator = function(pokemonId, side){
    var select = side === 'defender' ? el.defenderSelect : el.attackerSelect;
    if(!select) return;
    select.value = pokemonId;
    try{ select.dispatchEvent(new Event('change', {bubbles:true})); }
    catch(err){ var ev=document.createEvent('Event'); ev.initEvent('change', true, true); select.dispatchEvent(ev); }
  };
  function findTraceEntry(trace, labelPart){ return (trace||[]).find(function(x){ return String(x.label||'').indexOf(labelPart) >= 0; }) || null; }
  window.__damekeFindTraceEntry = findTraceEntry;
  function findTraceEntries(trace, labelPart){ return (trace||[]).filter(function(x){ return String(x.label||'').indexOf(labelPart) >= 0; }); }
  function rateCell(label, rawText){
    var tr = document.createElement('tr');
    var th = document.createElement('th'); th.textContent = label; tr.appendChild(th);
    var td = document.createElement('td');
    var num = parseInt(rawText, 10);
    if(!isNaN(num)){
      td.textContent = String(num);
      if(num > 4096) td.className = 'v082h-rate-up';
      else if(num < 4096) td.className = 'v082h-rate-down';
    } else {
      td.textContent = rawText || '-';
    }
    tr.appendChild(td);
    return tr;
  }
  function pairedRow(label, atkText, defText){
    var tr = document.createElement('tr');
    var th = document.createElement('th'); th.textContent = label; tr.appendChild(th);
    var tdA = document.createElement('td'); tdA.textContent = atkText || '-'; tr.appendChild(tdA);
    var tdD = document.createElement('td'); tdD.textContent = defText || '-'; tr.appendChild(tdD);
    return tr;
  }
  function spanRow(label, value){
    var tr = document.createElement('tr');
    var th = document.createElement('th'); th.textContent = label; tr.appendChild(th);
    var td = document.createElement('td'); td.colSpan = 2; td.textContent = value || '-'; tr.appendChild(td);
    return tr;
  }
  function plainRow(label, value){ return spanRow(label, value); }
  function renderCalcTable(result, hostId, anchorId){
    hostId = hostId || 'v082hCalcTable';
    anchorId = anchorId || 'trace';
    var host = document.getElementById(hostId);
    if(!host){
      host = document.createElement('table'); host.id = hostId; host.className = 'v082h-calc-table';
      var traceEl = document.getElementById(anchorId);
      if(traceEl && traceEl.parentNode) traceEl.parentNode.insertBefore(host, traceEl);
    }
    host.innerHTML = '';
    var trace = result.trace || [];

    var headerRow = document.createElement('tr');
    ['項目','攻撃側','防御側'].forEach(function(t){ var th=document.createElement('th'); th.textContent=t; headerRow.appendChild(th); });
    host.appendChild(headerRow);

    function pairedNameRow(label, atkLabelPart, defLabelPart){
      var a = findTraceEntry(trace, atkLabelPart);
      var d = findTraceEntry(trace, defLabelPart);
      host.appendChild(pairedRow(label, a ? a.name+'（'+a.value+'）' : '-', d ? d.name+'（'+d.value+'）' : '-'));
    }
    function itemStatusText(entry){
      if(!entry) return '-';
      var status = entry.value === '持ち物なし' ? '無効' : entry.value;
      return entry.name + '（' + status + '）';
    }
    var itemA = findTraceEntry(trace, '00 持ち物（攻撃側）'), itemD = findTraceEntry(trace, '00 持ち物（防御側）');
    host.appendChild(pairedRow('持ち物', itemStatusText(itemA), itemStatusText(itemD)));
    pairedNameRow('特性', '00 特性（攻撃側）', '00 特性（防御側）');
    var zmA = findTraceEntry(trace, '00 Z・ダイマックス（攻撃側）'), zmD = findTraceEntry(trace, '00 Z・ダイマックス（防御側）');
    host.appendChild(pairedRow('Z・ダイマックス', zmA ? zmA.name : '-', zmD ? zmD.name : '-'));
    var teraA = findTraceEntry(trace, '00 テラスタル（攻撃側）'), teraD = findTraceEntry(trace, '00 テラスタル（防御側）');
    var teraAText = teraA ? teraA.value : '-';
    if(teraA && teraA.value === 'ステラ'){
      var stellarCountEl = document.getElementById('attackerStellarMoveCount');
      if(stellarCountEl && stellarCountEl.selectedOptions && stellarCountEl.selectedOptions[0]) teraAText += '（' + stellarCountEl.selectedOptions[0].textContent + '）';
    }
    host.appendChild(pairedRow('テラスタル', teraAText, teraD ? teraD.value : '-'));

    var weatherEntry = findTraceEntry(trace, '00 天候');
    var weatherNote = weatherEntry ? String(weatherEntry.note || '') : '';
    var wA = (weatherNote.match(/攻撃側天候=([^ /]+)/) || [])[1] || result.attackerEffectiveWeather || '-';
    var wD = (weatherNote.match(/防御側天候=([^ /]+)/) || [])[1] || result.defenderEffectiveWeather || '-';
    host.appendChild(pairedRow('天候（実効）', wA, wD));

    var fieldEntry = findTraceEntry(trace, '00 フィールド');
    host.appendChild(spanRow('フィールド', fieldEntry ? fieldEntry.value : '-'));

    var moveEnhanceEntry = findTraceEntry(trace, '技名変換');
    if(moveEnhanceEntry){
      var changed = moveEnhanceEntry.name && moveEnhanceEntry.value && moveEnhanceEntry.name !== moveEnhanceEntry.value;
      host.appendChild(spanRow('技', changed ? (moveEnhanceEntry.name + ' → ' + moveEnhanceEntry.value) : moveEnhanceEntry.value));
    }

    var calcTypeA = findTraceEntry(trace, '02 計算上タイプ（攻撃側）'), calcTypeD = findTraceEntry(trace, '02 計算上タイプ（防御側）');
    host.appendChild(pairedRow('計算上タイプ', calcTypeA ? calcTypeA.value : '-', calcTypeD ? calcTypeD.value : '-'));

    var transformEntry = findTraceEntry(trace, '02 実数値操作');
    if(transformEntry){
      var wonderText = String(transformEntry.note || '').match(/最終ワンダールーム=(ON|OFF)/);
      host.appendChild(spanRow('実数値操作', '適用順：' + transformEntry.value + '　ワンダールーム：' + (wonderText ? (wonderText[1]==='ON'?'有効':'無効') : '-')));
    }

    var groundA = findTraceEntry(trace, '02 接地判定（攻撃側）'), groundD = findTraceEntry(trace, '02 接地判定（防御側）');
    host.appendChild(pairedRow('接地判定', groundA ? groundA.value : '-', groundD ? groundD.value : '-'));

    var critFractions = {0:'1/24', 1:'1/8', 2:'1/2', 3:'1/1'};
    var critText;
    if(result.criticalBlocked) critText = '急所無効';
    else {
      var cr = result.criticalRank || 0;
      critText = cr >= 3 ? '確定急所' : critFractions[cr];
    }
    host.appendChild(spanRow('急所率', critText));

    function formatWeightEntry(entry){
      if(!entry) return '-';
      var notes = String(entry.note || '').split('、');
      var baseNote = notes[0] || '';
      var baseM = baseNote.match(/本来=([\d.]+)kg/);
      var base = baseM ? parseFloat(baseM[1]) : null;
      var changeNotes = notes.slice(1);
      if(!changeNotes.length || base == null) return entry.value + 'kg';
      var parts = changeNotes.map(function(n){
        var m = n.match(/^(.*?)\s*([\d.]+)kg->([\d.]+)kg$/);
        if(m){ var delta = parseFloat(m[3]) - parseFloat(m[2]); return (delta>=0?'+':'') + delta.toFixed(1) + '（' + m[1].trim() + '）'; }
        var m2 = n.match(/^(.*?)\s*=\s*([+-][\d.]+)kg$/);
        if(m2) return m2[2] + '（' + m2[1].trim() + '）';
        return n;
      });
      return entry.value + 'kg（' + base.toFixed(1) + parts.join('') + '）';
    }

    function formatSpeedEntry(entry){
      if(!entry) return '-';
      var note = String(entry.note || '');
      var rankM = note.match(/ランク後=(-?\d+)/);
      var afterRank = rankM ? rankM[1] : '-';
      var mods = [];
      var re = /([^\/]+?):\s*-?\d+->-?\d+\s*(\d+)\/4096/g, mm;
      while((mm = re.exec(note))){
        if(mm[2] !== '4096') mods.push(mm[1].trim() + ':' + mm[2]);
      }
      var paraM = note.match(/まひ=(\d+)/);
      if(paraM && paraM[1] !== '4096') mods.push('まひ補正:' + paraM[1]);
      if(!mods.length) return entry.value;
      var parts = ['ランク補正込み:' + afterRank].concat(mods);
      return entry.value + '（' + parts.join('／') + '）';
    }

    var rankA = findTraceEntry(trace, '02 実効ランク（攻撃側）'), rankD = findTraceEntry(trace, '02 実効ランク（防御側）');
    if(rankA || rankD){
      var rankAParts = rankA ? String(rankA.value || '').split('/') : [];
      var rankAText = rankAParts.slice(0, 5).join('/').trim();
      var rankDText = rankD ? rankD.value : '-';
      host.appendChild(pairedRow('実効ランク', rankAText || '-', rankDText));
      var hitNoteM = rankA ? String(rankA.note || '').match(/命中\d+ - 回避\d+ = -?\d+/) : null;
      if(hitNoteM) host.appendChild(spanRow('命中/回避ランク差', hitNoteM[0]));
    }

    function formatRankedEntry(entry, side){
      if(!entry) return '-';
      var hpInput = document.getElementById(side === 'A' ? 'attackerCurrentHp' : 'defenderCurrentHp');
      var manual = hpInput && hpInput.value !== '';
      var m = String(entry.value || '').match(/^(\d+)\/(\d+)\s*\/\s*(.+)$/);
      if(!m) return entry.value;
      var cur = m[1], max = m[2], rest = m[3];
      var hpText = cur + '/' + max;
      if(cur !== max){
        var noteM = String(entry.note || '').match(/設置技=\d+、(.+)$/);
        var causes = [];
        if(manual) causes.push('入力');
        if(noteM && noteM[1] && noteM[1] !== 'なし'){
          noteM[1].split('、').forEach(function(c){ causes.push(c.replace(/=\d+.*$/, '').trim()); });
        }
        if(causes.length) hpText += '（' + causes.join('、') + '）';
      }
      return hpText + ' / ' + rest;
    }
    var rankedA = findTraceEntry(trace, '02 攻撃側ランク補正込み実数値'), rankedD = findTraceEntry(trace, '02 防御側ランク補正込み実数値');
    host.appendChild(pairedRow('ランク補正後実数値', formatRankedEntry(rankedA, 'A'), formatRankedEntry(rankedD, 'D')));

    var speedA = findTraceEntry(trace, '02 すばやさ詳細（攻撃側）'), speedD = findTraceEntry(trace, '02 すばやさ詳細（防御側）');
    host.appendChild(pairedRow('補正込みすばやさ', formatSpeedEntry(speedA), formatSpeedEntry(speedD)));

    var usesWeight = result.hitPlan && result.hitPlan[0] && (result.hitPlan[0].note === '防御側計算上おもさ' || result.hitPlan[0].note === '計算上おもさ比');
    if(usesWeight){
      var weightA = findTraceEntry(trace, '02 計算上おもさ（攻撃側）'), weightD = findTraceEntry(trace, '02 計算上おもさ（防御側）');
      host.appendChild(pairedRow('おもさ', formatWeightEntry(weightA), formatWeightEntry(weightD)));
    }

    var catEntry = findTraceEntry(trace, '02 物理/特殊判定');
    host.appendChild(spanRow('技分類判定', catEntry ? catEntry.value : '-'));

    var moveTypeEntry = findTraceEntry(trace, '02 技タイプ');
    host.appendChild(spanRow('技タイプ', moveTypeEntry ? moveTypeEntry.value : '-'));

    host.appendChild(spanRow('直接攻撃', result.contactEffective ? '接触' : '非接触'));

    function formatPowerEntry(entry, moveNameForCheck, isParentalBond){
      if(!entry) return '-';
      var val = String(entry.value || '');
      if(val === '-' || !val) return '-';
      var note = String(entry.note || '');
      var factorsM = note.match(/威力補正:\s*(.+)$/);
      var factorsRaw = factorsM ? factorsM[1] : '';
      var factorEntries = (!factorsRaw || factorsRaw === 'なし') ? [] : factorsRaw.split(' / ').map(function(f){
        var m = f.match(/^([^:]+):\s*-?\d+->-?\d+\s*\((\d+)\/4096\)/);
        return m ? { label: m[1].trim(), rate: m[2] } : null;
      }).filter(function(x){ return x && x.rate !== '4096'; });
      var factorText = factorEntries.map(function(f){ return f.rate + '（' + f.label + '）'; }).join('、');
      var hits = val.split(' / ');
      if(hits.length === 1 && !/回目=/.test(hits[0])) return hits[0];

      var variableMoves = ['ふくろだたき', 'トリプルキック', 'トリプルアクセル'];
      var isVariable = variableMoves.indexOf(moveNameForCheck) >= 0 || isParentalBond;

      // Detailed format (from the main power-modifier layer): "N回目=FIN（基礎BASE 補正RATE/4096...）"
      var detailedHits = hits.map(function(h){
        var m = h.match(/^(\d+)回目=(\d+)（基礎(\d+)\s*補正\d+\/4096(.*)）$/);
        return m ? { idx: m[1], fin: m[2], base: m[3], extra: (m[4] || '').trim() } : null;
      });
      if(!detailedHits.some(function(p){ return !p; })){
        if(!isVariable){
          var p0 = detailedHits[0];
          var parts = ['基礎威力 ' + p0.base].concat(factorText ? [factorText] : []).concat(p0.extra ? [p0.extra] : []);
          return p0.fin + '（' + parts.join('、') + '）';
        }
        return detailedHits.map(function(p){
          var parts = ['基礎威力 ' + p.base].concat(factorText ? [factorText] : []).concat(p.extra ? [p.extra] : []);
          return p.idx + '回目=' + p.fin + '（' + parts.join('、') + '）';
        }).join('/');
      }

      // Simpler format (from the data-driven variable-hit-count layer, e.g. Rock Blast):
      // "N回目=VALUE（note）" with no base/rate breakdown available.
      var simpleHits = hits.map(function(h){
        var m = h.match(/^(\d+)回目=(\d+)/);
        return m ? { idx: m[1], fin: m[2] } : null;
      });
      if(!simpleHits.some(function(p){ return !p; })){
        var allSame = simpleHits.every(function(p){ return p.fin === simpleHits[0].fin; });
        if(allSame && !isVariable){
          var baseFromPlan = (result.hitPlan && result.hitPlan[0] && result.hitPlan[0].basePower != null) ? result.hitPlan[0].basePower : null;
          return baseFromPlan != null ? (simpleHits[0].fin + '（基礎威力 ' + baseFromPlan + '）') : simpleHits[0].fin;
        }
        return simpleHits.map(function(p){ return p.idx + '回目=' + p.fin; }).join('/');
      }

      return hits.join('／');
    }
    var powerEntry = findTraceEntry(trace, '変動後威力');
    var atkAbilityEntry = findTraceEntry(trace, '00 特性（攻撃側）');
    var isParentalBondActive = !!(atkAbilityEntry && atkAbilityEntry.name === 'おやこあい' && atkAbilityEntry.value === '有効');
    var currentMoveName = moveEnhanceEntry ? moveEnhanceEntry.value : '';
    host.appendChild(spanRow('威力', formatPowerEntry(powerEntry, currentMoveName, isParentalBondActive)));

    function formatStatEntry(entry, sideLabel){
      if(!entry) return '-';
      var val = String(entry.value || '');
      var vm = val.match(/^(-?\d+)\s*->\s*(-?\d+)/);
      if(!vm) return val;
      var final = vm[2];
      var note = String(entry.note || '');
      var refM = note.match(/(攻撃側|防御側)ランク補正込み([ABCD])参照/);
      var refText = refM ? (refM[1] === '攻撃側' ? '攻' : '防') + refM[2] : sideLabel;
      var factorsM = note.match(/(?:攻撃力補正|防御力補正):\s*(.+)$/);
      var factorsRaw = factorsM ? factorsM[1] : '';
      var factorEntries = (!factorsRaw || factorsRaw === 'なし') ? [] : factorsRaw.split(' / ').map(function(f){
        var m = f.match(/^([^:]+):\s*-?\d+->-?\d+\s*\((\d+)\/4096/);
        return m ? { label: m[1].trim(), rate: m[2] } : null;
      }).filter(function(x){ return x && x.rate !== '4096'; });
      var factorText = factorEntries.map(function(f){ return f.rate + '（' + f.label + '）'; }).join('、');
      var parts = [refText].concat(factorText ? [factorText] : []);
      return final + '（' + parts.join('、') + '）';
    }
    var atkStatEntry = findTraceEntry(trace, '補正後攻撃側実数値');
    var defStatEntry = findTraceEntry(trace, '補正後防御側実数値');
    host.appendChild(pairedRow('補正後使用実数値', formatStatEntry(atkStatEntry, '攻'), formatStatEntry(defStatEntry, '防')));

    var priorityEntry = findTraceEntry(trace, 'N79 優先度');
    host.appendChild(spanRow('優先度', priorityEntry ? priorityEntry.value : '-'));

    host.appendChild(spanRow('命中判定', result.accuracyResult || '-'));
    var accRateText = result.accuracyResult === '命中' ? formatAccuracyPercent(result.accuracyPercent) : (result.accuracyResult || '-');
    host.appendChild(spanRow('命中率', accRateText));
    host.appendChild(spanRow('無効要素', result.isInvalid ? 'あり' : 'なし'));

    if(result.moveRangeTarget != null) host.appendChild(spanRow('範囲', String(result.moveRangeTarget)));

    if(result.stabRate4096 != null){
      var stabReasonText = String(result.stabReason || '');
      var stabParts = stabReasonText.split('+').map(function(s){
        return s
          .replace('テラパゴス(ステラ)', 'ステラ')
          .replace('計算上タイプ一致', '一致')
          .replace('計算上タイプ不一致', '不一致')
          .replace('テラタイプかつ計算上タイプ一致', 'テラス一致、一致')
          .replace('テラタイプまたは計算上タイプ一致', 'テラス一致または一致')
          .replace('テラタイプのみ一致', 'テラス一致')
          .replace('一致なし', '不一致')
          .replace('非テラ', '')
          .trim();
      }).filter(Boolean);
      host.appendChild(spanRow('タイプ一致判定', String(result.stabRate4096) + (stabParts.length ? '（' + stabParts.join('、') + '）' : '')));
    }

    if(result.typeRate4096 != null){
      var finalMoveType = moveTypeEntry ? moveTypeEntry.value : '-';
      var teraD = document.getElementById('defenderTeraType');
      var teraDVal = teraD ? teraD.value : '';
      var calcTypeDEntry = findTraceEntry(trace, '02 計算上タイプ（防御側）');
      var defTypesUsed = (teraDVal && teraDVal !== 'なし' && teraDVal !== 'ステラ') ? teraDVal : (calcTypeDEntry ? calcTypeDEntry.value : '-');
      host.appendChild(spanRow('タイプ相性', String(result.typeRate4096) + '（' + finalMoveType + '→' + defTypesUsed + '）'));
    }

    var damageModEntry = findTraceEntry(trace, 'N66 ダメージ補正値');
    if(damageModEntry){
      var otherM = String(damageModEntry.note || '').match(/その他:\s*(.+?)(?:\s*\/\s*まもる:|$)/);
      var otherRaw = otherM ? otherM[1] : '';
      if(otherRaw && otherRaw !== 'なし'){
        var otherParts = otherRaw.split(' / ').map(function(f){
          var m = f.match(/^([^:]+):\s*-?\d+->-?\d+\s*\((\d+)\/4096\)/);
          return m ? { label: m[1].trim(), rate: m[2] } : null;
        }).filter(function(x){ return x && x.rate !== '4096'; });
        if(otherParts.length) host.appendChild(spanRow('その他補正', otherParts.map(function(f){ return f.rate + '（' + f.label + '）'; }).join('、')));
      }

      var dmText = String(damageModEntry.value || '');
      var dmPairs = dmText.split('/').map(function(s){ return s.trim(); }).filter(Boolean);
      var combined = 4096;
      var dmParts = [];
      dmPairs.forEach(function(p){
        var m = p.match(/^([^=]+)=(.+)$/);
        if(!m) return;
        var label = m[1].trim(), raw = m[2].trim();
        if(label === 'STAB') label = 'タイプ一致';
        var rateNum = parseInt(raw, 10);
        if(isNaN(rateNum)){
          // e.g. おやこあい="4096,1024" -- use the first value for combination purposes only
          rateNum = parseInt(raw.split(',')[0], 10);
          if(isNaN(rateNum)) return;
        }
        combined = Math.round(combined * rateNum / 4096);
        if(rateNum !== 4096) dmParts.push(rateNum + '（' + label + '）');
      });
      host.appendChild(spanRow('ダメージ補正合成', combined + (dmParts.length ? '（' + dmParts.join('、') + '）' : '')));

      var dmgRawMulti = result.rawMultiHitRolls;
      var dmgText = (dmgRawMulti && dmgRawMulti.length) ? dmgRawMulti.join('／') : (result.rawRolls || result.rolls || []).join(', ');
      host.appendChild(spanRow('ダメージ', dmgText));

      var adjMulti = result.multiHitRolls;
      var adjText = (adjMulti && adjMulti.length) ? adjMulti.join('／') : (result.rolls || []).join(', ');
      if(adjText !== dmgText) host.appendChild(spanRow('ダメージ変更', adjText));
    }
    // v2.4.0: この技の追加効果(攻撃側/防御側)。確率で発生する効果は「確率%：内容」で表示する。
    // 技①の追加効果は、技②の計算結果(ダメージ・割合・確定数は確定分、瀕死率は全分岐)に反映済み。
    // v2.5.0: 技・特性・持ち物・フィールドの順に、確率と発生する状態を簡潔に列記する(技②の表では
    // 「技①追加効果」として技①の効果を表示する)。
    var effSum = result.effectSummary;
    if(effSum){
      host.appendChild(pairedRow(result.effectLabel || '追加効果', effSum.A, effSum.D));
      if(effSum.pending) host.appendChild(spanRow('追加効果（計算未反映）', effSum.pending));
    }
  }
  function formatAccuracyPercent(v){
    if(v == null) return '-';
    var rounded = Math.round(v * 10) / 10;
    return (Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)) + '%';
  }
  window.__damekeFormatAccuracyPercent = formatAccuracyPercent;
  // resultオブジェクト(CALC.calculateDamageの戻り値)を丸ごと受け取り、確定数欄の表示文字列を
  // 組み立てる。みがわりが立っている間は、本体の実数値HP基準の確定数(result.koInfo、みがわりが
  // 壊れてから本体にダメージが通るまでの長い道のりを含む)ではなく、みがわりのHPをそのままHPに
  // 見立てた確定数(result.substituteKoInfo、そのターンにみがわりへダメージが入ったことがそのまま
  // 見える)を優先する。ただしタイプ相性0倍・変化技など、技そのものが無効な場合は(みがわりの
  // 有無に関わらず)常に「無効」とする。
  function formatKoInfo(result) {
    if (!result) return '計算対象外';
    var isInvalidMove = result.typeRate4096 === 0 || result.effectiveCategory === '変化';
    if (result.substituteActive) {
      if (isInvalidMove) return '無効';
      var subKo = result.substituteKoInfo;
      if (!subKo) return 'みがわり';
      if (subKo.partial) return 'みがわり乱数' + subKo.partial.hits + '発(' + (subKo.partial.probability * 100).toFixed(2) + '%)';
      if (subKo.certain) return 'みがわり確定' + subKo.certain + '発';
      if (subKo.cappedAt) return 'みがわり' + subKo.cappedAt + '発以上でも確定せず';
      return 'みがわり圏外';
    }
    if (result.maxDamage === 0) return '無効';
    var koInfo = result.koInfo;
    if (!koInfo) return '計算対象外';
    if (koInfo.partial) return '乱数' + koInfo.partial.hits + '発(' + (koInfo.partial.probability * 100).toFixed(2) + '%)';
    if (koInfo.certain) return '確定' + koInfo.certain + '発';
    if (koInfo.cappedAt) return koInfo.cappedAt + '発以上でも確定せず';
    return '圏外';
  }
  window.__damekeFormatKoInfo = formatKoInfo;
  // 技①→技②(それぞれ1回ずつ)での確定数を、技①単体でも既に確定/乱数で倒せる可能性があること
  // まで含めて「確定N発+乱数N発(X%)」のような形式にする。move1Frac=技①だけで瀕死になる確率、
  // totalFrac=技①+②の両方を撃った後で瀕死になる確率(いずれもCALC.calculateCombinedSequenceが
  // 急所率・連続攻撃命中回数分布・命中判定・みがわり・きのみ消費を厳密に織り込んで返す生の確率)。
  function formatComboKoInfo(move1Frac, totalFrac) {
    var EPS = 1e-9;
    if (move1Frac == null || totalFrac == null) return '計算対象外';
    if (move1Frac >= 1 - EPS) return '確定1発';
    var totalCertain = totalFrac >= 1 - EPS;
    var parts = [];
    if (totalCertain) parts.push('確定2発');
    if (move1Frac > EPS) parts.push('乱数1発(' + (move1Frac * 100).toFixed(2) + '%)');
    if (!totalCertain && totalFrac > EPS) parts.push('乱数2発(' + (totalFrac * 100).toFixed(2) + '%)');
    if (!parts.length) return '技①+②でも打点不足';
    return parts.join('+');
  }
  // resultオブジェクト(CALC.calculateDamageの戻り値)から回復量の表示文字列を作る。
  // きのみ等による回復が起こりうる場合のみ('result.recoveryAmount>0')、その量のみを返す
  // (要因の名前は表示しない)。
  function recoveryNoteFor(result) {
    if (!result || !result.recoveryAmount || result.recoveryAmount <= 0) return null;
    return result.recoveryAmount + '回復';
  }
  window.__damekeRecoveryNoteFor = recoveryNoteFor;
  // 「もうどく経過」欄は、状態異常で「もうどく」を選んでいるときだけ表示する。
  function updateToxicCountVisibility() {
    ['attacker','defender'].forEach(function(side){
      var sel = document.getElementById(side + 'Status'), inp = document.getElementById(side + 'ToxicCount');
      if(!sel || !inp) return;
      var lab = inp.closest('label') || inp;
      lab.style.display = sel.value === 'もうどく' ? '' : 'none';
    });
  }
  document.addEventListener('change', function(e){ if(e.target && /^(attacker|defender)Status$/.test(e.target.id)) updateToxicCountVisibility(); }, true);
  function calculate() {
    updateToxicCountVisibility();
    const inputArgs = { attacker: byId(DATA.pokemons, el.attackerSelect.value), defender: byId(DATA.pokemons, el.defenderSelect.value), move: byId(DATA.moves, el.moveSelect.value), attackerLevel: el.attackerLevel.value, defenderLevel: el.defenderLevel.value, options: buildOptions() };
    const result = CALC.calculateDamageWithEffects ? CALC.calculateDamageWithEffects(inputArgs) : CALC.calculateDamage(inputArgs);
    let faintPct = null;
    try { faintPct = CALC.computeFaintProbability ? CALC.computeFaintProbability(inputArgs, result) : null; } catch(e) { faintPct = null; }
    const faintText = fmtFaintPct(faintPct);
    const subLine = result.substituteActive ? (result.substituteMaxHp + '/' + result.substituteMinRemaining + '/' + result.substituteMaxRemaining) : '';
    el.summary.innerHTML = ['<strong>' + result.attackerName + '</strong> の <strong>' + result.moveName + '</strong> → <strong>' + result.defenderName + '</strong>', '判定分類: <strong>' + result.effectiveCategory + '</strong>', '技タイプ: <strong>' + result.effectiveType + '</strong>', 'ダメージ: <strong>' + result.minDamage + ' ～ ' + result.maxDamage + '</strong>', '割合: <strong>' + result.minRate.toFixed(1) + '% ～ ' + result.maxRate.toFixed(1) + '%</strong>', '防御側HP: ' + result.defenderCurrentHp + ' / ' + result.defenderMaxHp, '確定数: <strong>' + formatKoInfo(result) + '</strong>', '命中率: <strong>' + (result.accuracyResult === '命中' ? formatAccuracyPercent(result.accuracyPercent) : result.accuracyResult) + '</strong>', '瀕死率: <strong>' + faintText + '</strong>', 'みがわり: ' + subLine].join('<br>');
    // v2.4.0: 計算過程表の「追加効果」行(技①の追加効果、攻撃側/防御側)。
    try { result.effectSummary = CALC.describeMoveEffects ? CALC.describeMoveEffects(inputArgs, result) : null; } catch(e) { result.effectSummary = null; }
    renderCalcTable(result);
    el.trace.textContent = formatTrace(result.trace);
    // Exposed so renderResult() (a separate IIFE, driven by a MutationObserver on #summary/#trace
    // rather than a direct call from here) can read the same structured trace entries the calc-
    // process table itself uses for 特性/持ち物, instead of re-parsing the rendered trace text
    // (which also carries each entry's note, and was producing "有効 / 有効"-style duplicates).
    window.__damekeLastTrace = result.trace;
    window.__damekeLastResult = result;
    // 瀕死率は#summaryへの表示専用の文字列(faintText)ではなく生の数値のまま保持しておく --
    // 結果枠側(renderResult)はこれと result を直接読んで表示を組み立て、#summary/#traceの
    // テキストを読み返すことはしない。
    window.__damekeLastFaintPct = faintPct;
    updateMove2CombinedResult(inputArgs, result, faintPct);
    updateMove2StandaloneSection(inputArgs);
  }
  window.__damekeCalculate = calculate;
  // 技②が指定されているとき(「なし」以外)、技①→技②の順で技を連続して繰り出した場合の
  // 結果を厳密に計算する。「単純加算」とは、状態異常付与やランク変動などの追加効果を考慮しない
  // ことのみを意味し、それ以外(ダメージ・割合・確定数・瀕死率)はすべて、みがわり・きのみ回復・
  // 連続攻撃・急所率・命中判定を技①技②それぞれ独立に厳密計算したうえで、技①の結果として
  // 起こりうる防御側の状態(実HP・みがわり残りHP・きのみ消費済みフラグ)の分布すべてを分岐として
  // 保持し、各分岐ごとに技②を厳密に適用して合成した、真の同時分布から導出する
  // (calc.js の CALC.calculateCombinedSequence、近似やサンプリングは一切含まない)。
  function updateMove2CombinedResult(inputArgs1, result1, faintPct1){
    var isNone = window.__damekeIsMove2None ? window.__damekeIsMove2None() : true;
    if (isNone) { window.__damekeCombinedResult = null; return; }
    var move2 = byId(DATA.moves, el2Value('move2Select'));
    if (!move2 || move2.id !== el2Value('move2Select')) { window.__damekeCombinedResult = null; return; }
    var options2 = buildOptions(2);
    var inputArgs2 = { attacker: inputArgs1.attacker, defender: inputArgs1.defender, move: move2, attackerLevel: inputArgs1.attackerLevel, defenderLevel: inputArgs1.defenderLevel, options: options2 };
    var combined;
    try {
      combined = CALC.calculateCombinedSequence ? CALC.calculateCombinedSequence(inputArgs1, inputArgs2) : null;
    } catch(e) { combined = null; }
    if (!combined) { window.__damekeCombinedResult = null; return; }
    // 「技①+②で確定撃破」のような一言ではなく、技①単体で既に倒れている場合の確率も含めた
    // 「確定N発+乱数N発(X%)」形式(formatComboKoInfo)。ここで使う確率は、単体技の確定数表示
    // (computeExactKoInfo: 乱数のみ考慮・急所は確定急所以外考慮しない・命中は前提)と同じ土俵に
    // 揃えた move1FaintFractionHit/totalFaintFractionHit(命中率・急所発生確率で割り引いた
    // 「本当の」瀕死率=faintPercentとは別の指標)を使う。そうしないと、技①単体では「確定2発」
    // なのに技①+②では命中率の分だけ割り引かれて「乱数◯発」に見えてしまい、単体表示と矛盾する。
    var comboKoInfoText = formatComboKoInfo(combined.move1FaintFractionHit, combined.totalFaintFractionHit);
    // 技①が実際には一切ダメージを与えない場合(タイプ相性無効・みがわりに完全に阻まれた等)、
    // formatComboKoInfoの「技①・技②を1回ずつ」という前提そのものが成り立たない
    // (技①は進捗に何も寄与しないので、技②を繰り返し使ったときの確定数こそが知りたい値になる)。
    // この場合は「技①+②でも打点不足」のような的外れな表示にせず、技②単体の確定数
    // (formatKoInfo、複数回の使用も考慮した本来の確定数)をそのまま使う。
    var move1DealsNoDamage = combined.move1RealMinDamage === 0 && combined.move1RealMaxDamage === 0;
    if (move1DealsNoDamage && combined.move2RepresentativeResult) {
      comboKoInfoText = formatKoInfo(combined.move2RepresentativeResult);
    }
    window.__damekeCombinedResult = {
      move1Effects: combined.move1Effects,
      move1Name: combined.move1Name, move2Name: combined.move2Name || move2.name,
      move1MinDamage: combined.move1MinDamage, move1MaxDamage: combined.move1MaxDamage, move1MinRate: combined.move1MinRate, move1MaxRate: combined.move1MaxRate,
      move1RealMinDamage: combined.move1RealMinDamage, move1RealMaxDamage: combined.move1RealMaxDamage,
      move2MinDamage: combined.move2MinDamage, move2MaxDamage: combined.move2MaxDamage, move2MinRate: combined.move2MinRate, move2MaxRate: combined.move2MaxRate,
      move2PowerMin: combined.move2PowerMin, move2PowerMax: combined.move2PowerMax,
      move2RepresentativeResult: combined.move2RepresentativeResult, move2RepresentativeStartHp: combined.move2RepresentativeStartHp,
      move2EasyResult: combined.move2EasyResult, move2EasyStartHp: combined.move2EasyStartHp,
      move2RecoveryName: combined.move2RecoveryName, move2RecoveryAmount: combined.move2RecoveryAmount,
      move2StartHpMin: combined.move2StartHpMin, move2StartHpMax: combined.move2StartHpMax,
      totalMinDamage: combined.totalMinDamage, totalMaxDamage: combined.totalMaxDamage, totalMinRate: combined.totalMinRate, totalMaxRate: combined.totalMaxRate,
      totalRealMinDamage: combined.totalRealMinDamage, totalRealMaxDamage: combined.totalRealMaxDamage,
      faintPercent: combined.faintPercent, koText: comboKoInfoText,
      move1FaintFraction: combined.move1FaintFraction, totalFaintFraction: combined.totalFaintFraction,
      move1FaintFractionHit: combined.move1FaintFractionHit, totalFaintFractionHit: combined.totalFaintFractionHit,
      defenderMaxHp: combined.defenderMaxHp, defenderCurrentHp: combined.defenderCurrentHp,
      substituteActive: combined.substituteActive, substituteMaxHp: combined.substituteMaxHp,
      substituteMinRemaining: combined.substituteMinRemaining, substituteMaxRemaining: combined.substituteMaxRemaining
    };
  }
  function el2Value(id){ var e = document.getElementById(id); return e ? e.value : ''; }
  // 技②が指定されているとき(「なし」以外)、結果枠の技②タブ(サマリー・計算過程テーブル)を
  // 組み立てる。技①を全く無視して防御側が満タンのまま技②だけ計算するのではなく、技①を
  // 撃った後に実際に起こりうる残りHPの分岐すべて(乱数関連、ただし瀕死率の計算を除いて急所は
  // 確定急所以外考慮しない)を踏まえた技②単体の結果(window.__damekeCombinedResult、
  // CALC.calculateCombinedSequenceによる厳密な連結計算)を使う。計算過程の表自体は、技①が
  // 最大ダメージを与えた最も厳しい分岐(=技②開始時点のHPが最小)を代表として1つ表示しつつ、
  // ダメージ・割合・技威力・防御側HPなど、分岐によって値が変わりうる項目は幅(min～max)で示す。
  function updateMove2StandaloneSection(inputArgs1){
    var section = document.getElementById('v082hMove2Section');
    if(!section) return;
    var isNone = window.__damekeIsMove2None ? window.__damekeIsMove2None() : true;
    // 技②に関する入力(技②本体の選択・急所チェックボックス・技②固有条件欄)が変化するたびに、
    // 結果枠のタブを技②側へ自動で切り替える(「なし」から実際の技に変わった最初の一回だけでは
    // なく、その後の技②側の入力変更すべてが対象)。技②に無関係な入力(攻撃側/防御側の他の設定
    // など)の変更では切り替えない。
    var move2CritEl = document.getElementById('move2CriticalForce');
    var move2InputSnapshot = isNone ? 'none' : JSON.stringify([el2Value('move2Select'), move2CritEl ? move2CritEl.checked : false, moveConditionOptions('move2')]);
    if (window.__damekePrevMove2InputSnapshot !== undefined && !isNone && move2InputSnapshot !== window.__damekePrevMove2InputSnapshot) {
      window.__damekeActiveMoveTab = 'move2';
    }
    window.__damekePrevMove2InputSnapshot = move2InputSnapshot;
    var move2 = isNone ? null : byId(DATA.moves, el2Value('move2Select'));
    if (isNone || !move2 || move2.id !== el2Value('move2Select')) {
      section.classList.add('v082h-hide');
      window.__damekeLastResult2 = null;
      window.__damekeLastResult2Trace = null;
      window.__damekeMove2DisplayText = null;
      return;
    }
    var combined = window.__damekeCombinedResult;
    var result2 = combined && combined.move2RepresentativeResult;
    if (!result2) {
      // CALC.calculateCombinedSequenceが失敗した(技②が命中しない等で分岐が1つも実行されな
      // かった)場合のみ、フォールバックとして現在の防御側HPでの単純な技②単体計算を使う。
      var inputArgs2Fallback = { attacker: inputArgs1.attacker, defender: inputArgs1.defender, move: move2, attackerLevel: inputArgs1.attackerLevel, defenderLevel: inputArgs1.defenderLevel, options: buildOptions(2) };
      try { result2 = CALC.calculateDamage(inputArgs2Fallback); }
      catch(e) {
        section.classList.add('v082h-hide');
        window.__damekeLastResult2 = null;
        window.__damekeLastResult2Trace = null;
        window.__damekeMove2DisplayText = null;
        return;
      }
    }

    // ダメージ・割合は代表分岐単体の値ではなく、全分岐を通じた本当の範囲
    // (combined.move2MinDamage～move2MaxDamage、technical: HP依存で威力が変わる技も含めて
    // 正しく分岐ごとに再計算済み)を使う。代表分岐しか無い(combinedが取れなかった)場合は
    // 代表分岐自身の値にフォールバックする。
    var dispMinDmg = combined ? combined.move2MinDamage : result2.minDamage;
    var dispMaxDmg = combined ? combined.move2MaxDamage : result2.maxDamage;
    var dispMinRate = combined ? combined.move2MinRate : result2.minRate;
    var dispMaxRate = combined ? combined.move2MaxRate : result2.maxRate;
    var hpMinShown = combined && combined.move2StartHpMin != null ? combined.move2StartHpMin : result2.defenderCurrentHp;
    var hpMaxShown = combined && combined.move2StartHpMax != null ? combined.move2StartHpMax : result2.defenderCurrentHp;
    var hpRangeText = hpMinShown === hpMaxShown ? String(hpMinShown) : (hpMinShown + '～' + hpMaxShown);
    // 技②の確定数は、技①後に実際に起こりうる残りHPが一意に定まる場合(=技①が常に0ダメージで、
    // 技②が実質1回目の技として満タンのHPから始まる場合)のみ意味を持つ。技①が実際にダメージを
    // 与えうる場合、技②の開始HPは技①の分岐次第で変わってしまい、技②単体の確定数という言い方
    // 自体が一意に定まらなくなる(技①+②2回分の確定数という考え方自体を撤廃したため、その代わり
    // に技②単体の確定数を出すことも、この場合はできない)。そのため「-」で表示する。
    var move1AlwaysZeroDamage = combined && combined.move1RealMinDamage === 0 && combined.move1RealMaxDamage === 0;
    var koText2;
    if (combined && !move1AlwaysZeroDamage) {
      koText2 = '-';
    } else {
      koText2 = formatKoInfo(result2);
    }
    var faintText2 = combined ? fmtFaintPct(combined.faintPercent) : '計算不可';
    var subLine2 = result2.substituteActive ? (result2.substituteMaxHp + '/' + result2.substituteMinRemaining + '/' + result2.substituteMaxRemaining) : '';
    var summaryEl = document.getElementById('move2Summary');
    if (summaryEl) {
      summaryEl.innerHTML = ['<strong>' + result2.attackerName + '</strong> の <strong>' + result2.moveName + '</strong> → <strong>' + result2.defenderName + '</strong>', '判定分類: <strong>' + result2.effectiveCategory + '</strong>', '技タイプ: <strong>' + result2.effectiveType + '</strong>', 'ダメージ: <strong>' + dispMinDmg + ' ～ ' + dispMaxDmg + '</strong>', '割合: <strong>' + dispMinRate.toFixed(1) + '% ～ ' + dispMaxRate.toFixed(1) + '%</strong>', '防御側HP: ' + hpRangeText + ' / ' + result2.defenderMaxHp, '確定数: <strong>' + koText2 + '</strong>', '命中率: <strong>' + (result2.accuracyResult === '命中' ? formatAccuracyPercent(result2.accuracyPercent) : result2.accuracyResult) + '</strong>', '瀕死率: <strong>' + faintText2 + '</strong>', 'みがわり: ' + subLine2].join('<br>');
    }
    // renderResult()/buildMoveDetailGridが#move2Summaryの描画済みテキストを読み返さなくて
    // 済むよう、同じ内容を構造化フィールドのまま公開しておく(技②はcombinedの分岐幅を織り込んだ
    // 表示専用の値なので、result2自身のフィールドだけでは再現できない)。
    window.__damekeMove2DisplayText = {
      dmgText: dispMinDmg + ' ～ ' + dispMaxDmg,
      rateText: dispMinRate.toFixed(1) + '% ～ ' + dispMaxRate.toFixed(1) + '%',
      hpText: hpRangeText + ' / ' + result2.defenderMaxHp,
      certaintyText: koText2,
      faintText: faintText2,
      accuracyText: result2.accuracyResult === '命中' ? formatAccuracyPercent(result2.accuracyPercent) : result2.accuracyResult,
      subLineText: subLine2
    };

    // 計算過程の表自体は代表分岐(技①が最大ダメージを与えたケース)のtraceをそのまま使うが、
    // 「ランク補正後実数値」の防御側HPと「変動後威力」だけは、分岐間で値が変わりうるため
    // 幅表示に差し替える(元のtrace配列は書き換えず、表示用にエントリを複製する)。
    // v2.4.0: 技②の計算過程表の「追加効果」行(技②自身の追加効果)。技②の入力は、技①の確定した
    // 追加効果を適用済みの代表分岐のもの(combined.move2RepresentativeInput)を使う。
    // v2.5.0: 技②の表には「技①追加効果」(技①の効果の要約。技②の計算に反映済み)を表示する。
    result2.effectSummary = (combined && combined.move1Effects && combined.move1Effects.summary) || null;
    result2.effectLabel = '技①追加効果';
    var renderResult2 = result2;
    if (combined && (hpMinShown !== hpMaxShown || (combined.move2PowerMin != null && combined.move2PowerMin !== combined.move2PowerMax))) {
      var clonedTrace = (result2.trace || []).map(function(entry){ return Object.assign({}, entry); });
      if (hpMinShown !== hpMaxShown) {
        var hEntry = clonedTrace.find(function(x){ return String(x.label||'').indexOf('防御側ランク補正込み実数値') >= 0; });
        if (hEntry) hEntry.value = String(hEntry.value||'').replace(/^\d+\/\d+/, hpRangeText + '/' + result2.defenderMaxHp);
      }
      if (combined.move2PowerMin != null && combined.move2PowerMin !== combined.move2PowerMax) {
        var pEntry = clonedTrace.find(function(x){ return String(x.label||'').indexOf('変動後威力') >= 0; });
        if (pEntry) pEntry.value = combined.move2PowerMin + '～' + combined.move2PowerMax + '（分岐幅）';
      }
      renderResult2 = Object.assign({}, result2, { trace: clonedTrace });
    }
    renderCalcTable(renderResult2, 'v082hCalcTable2', 'move2Trace');
    var traceEl2 = document.getElementById('move2Trace');
    if (traceEl2) traceEl2.textContent = formatTrace(renderResult2.trace);
    window.__damekeLastResult2 = result2;
    window.__damekeLastResult2Trace = renderResult2.trace;
    window.__damekeLastResult2FaintPct = combined ? combined.faintPercent : null;
    section.classList.remove('v082h-hide');
  }
  function setHpFraction(side, denom) { const pokemon = byId(DATA.pokemons, el[side + 'Select'].value); const level = el[side + 'Level'].value; const stats = readStats(side); const maxHp = CALC.previewBaseMaxHp(pokemon, level, stats); el[side + 'CurrentHp'].value = Math.max(1, Math.floor(maxHp / denom)); calculate(); }
  async function copyTrace() { const text = el.trace.textContent || ''; if (!text) return; try { await navigator.clipboard.writeText(text); alert('計算過程をコピーしました。'); } catch { alert('コピーに失敗しました。'); } }
  // If the browser window/tab itself loses focus (switching to another app or tab), release
  // focus from whatever input was active -- otherwise a still-focused text field can prevent
  // other in-page controls (e.g. form-change buttons) from visibly taking effect afterward.
  window.addEventListener('blur', function () {
    var ae = document.activeElement;
    if (ae && typeof ae.blur === 'function' && ae !== document.body) ae.blur();
  });
  window.addEventListener('resize', function(){
    var panel = document.getElementById('v082hResultPanel');
    if(panel) document.documentElement.style.setProperty('--v082h-fixed-panel-h', panel.offsetHeight + 'px');
  });
  // v2.4.0 技固有条件「シャリタツ」(いっちょうあがり用)。技①(#moveSpecificSection)・技②
  // (#move2SpecificSection)の技固有条件グリッドへ、他の技固有条件と同じ<label>形式で追加する
  // (レイアウト構築側のmoveConditionalLabels()が、他の項目と同様にバブルへ移設する)。
  function ensureOrderUpInputs() {
    [['moveSpecificSection', 'orderUpForm'], ['move2SpecificSection', 'move2OrderUpForm']].forEach(function (pair) {
      if (document.getElementById(pair[1])) return;
      var section = document.getElementById(pair[0]);
      var grid = section ? section.querySelector('.grid') : null;
      if (!grid) return;
      var label = document.createElement('label');
      label.appendChild(document.createTextNode('シャリタツ'));
      var sel = document.createElement('select');
      sel.id = pair[1];
      ['なし', 'そったすがた', 'たれたすがた', 'のびたすがた'].forEach(function (v) { var op = document.createElement('option'); op.value = v; op.textContent = v; sel.appendChild(op); });
      sel.value = 'なし';
      label.appendChild(sel);
      grid.appendChild(label);
    });
  }
  function init() {
    ensureOrderUpInputs();
    createStatsGrid('attacker', el.attackerStatsGrid); createStatsGrid('defender', el.defenderStatsGrid);
    fillSelect(el.attackerSelect, DATA.pokemons); fillSelect(el.defenderSelect, DATA.pokemons); fillSelect(el.moveSelect, DATA.moves); fillSelect(el.attackerItemSelect, DATA.items); fillSelect(el.defenderItemSelect, DATA.items); fillSelect(el.attackerAbilitySelect, DATA.abilities); fillSelect(el.defenderAbilitySelect, DATA.abilities); fillSelect(el.attackerSpecialState, DATA.specialStates); fillSelect(el.defenderSpecialState, specialStatesForDefender()); fillSelect(el.attackerTeraType, DATA.teraTypes); fillSelect(el.defenderTeraType, DATA.teraTypes); fillSelect(el.attackerType1, DATA.typeOptions); fillSelect(el.attackerType2, DATA.typeOptions); fillSelect(el.defenderType1, DATA.typeOptions); fillSelect(el.defenderType2, DATA.typeOptions); fillSelect(el.weatherSelect, DATA.weatherOptions); fillSelect(el.fieldSelect, DATA.fieldOptions); fillSelectBeatUpAllies();
    // 技②専用のZ・ダイマ/テラスタルは、技①のもの(el.attackerSpecialState/el.attackerTeraType)と
    // 同じ選択肢構成で初期化する(専用Zの有無だけは後でupdateSpecialStateOptions()が技②の
    // 選択技に応じて個別に作り直す)。
    var move2SpecialStateEl = document.getElementById('move2AttackerSpecialState'), move2TeraTypeEl = document.getElementById('move2AttackerTeraType');
    if (move2SpecialStateEl) fillSelect(move2SpecialStateEl, DATA.specialStates);
    if (move2TeraTypeEl) fillSelect(move2TeraTypeEl, DATA.teraTypes);
    el.attackerSelect.value = 'ジュペッタ'; el.defenderSelect.value = 'サーフゴー'; applyMoveFilter(); el.moveSelect.value = 'シャドークロー'; applyMoveFilter2(); setTypeDefaults('attacker'); setTypeDefaults('defender');
    ['attackerType1', 'attackerType2', 'defenderType1', 'defenderType2', 'attackerTeraType', 'defenderTeraType', 'move2AttackerTeraType'].forEach(function(id) { var e = document.getElementById(id); if (e) e.addEventListener('change', updateAllTypeColors); });
    ['attackerTeraType', 'move2AttackerTeraType'].forEach(function(id) { var e = document.getElementById(id); if (e) e.addEventListener('change', updateAttackerTeraExclusivity); });
    updateAttackerTeraExclusivity();
    el.attackerSelect.addEventListener('change', () => { applyMoveFilter(); applyMoveFilter2(); setTypeDefaults('attacker'); calculate(); }); el.defenderSelect.addEventListener('change', () => { setTypeDefaults('defender'); calculate(); }); document.querySelectorAll('button[data-op]').forEach(btn => btn.addEventListener('click', () => { transformOps.push(btn.dataset.op); updateOpsDisplay(); calculate(); }));
    if (el.moveShowAll) el.moveShowAll.addEventListener('change', () => { applyMoveFilter(); calculate(); });
    var move2ShowAllEl = document.getElementById('move2ShowAll');
    if (move2ShowAllEl) move2ShowAllEl.addEventListener('change', () => { applyMoveFilter2(); calculate(); });
    el.resetTransformOps.addEventListener('click', () => { transformOps = []; updateOpsDisplay(); calculate(); });
    el.calculateButton.addEventListener('click', calculate); el.copyTraceButton.addEventListener('click', copyTrace);
    document.querySelectorAll('button[data-hp-side]').forEach(btn => btn.addEventListener('click', () => setHpFraction(btn.dataset.hpSide, Number(btn.dataset.hpRate))));
    document.addEventListener('change', function(e){ var t=e.target; if(t && t.matches && t.matches('input,select')){ calculate(); if(window.__damekeRefreshAll) window.__damekeRefreshAll(); } });
    updateOpsDisplay(); calculate();
  }
  window.__damekeInitV084 = init;
})();


// Dynamic Z-Move, Dynamax, and Gigantamax choices
(function(){
  if(window.__specialMoveUiPatched) return;
  window.__specialMoveUiPatched = true;
  function q(id){return document.getElementById(id);}
  function by(list,id){return (list||[]).find(x=>x.id===id)||(list||[])[0];}
  function current(side){const D=window.DAMEKE_DATA;return by(D.pokemons, q(side+'Select')&&q(side+'Select').value)||{};}
  function move(){const D=window.DAMEKE_DATA;return by(D.moves, q('moveSelect')&&q('moveSelect').value)||{};}
  function move2(){const D=window.DAMEKE_DATA;return by(D.moves, q('move2Select')&&q('move2Select').value)||{};}
  function canDynamaxPokemon(p){const D=window.DAMEKE_DATA;return !(D.zMax&&D.zMax.dynamaxBanned||[]).includes(p.name);}
  function canGmaxPokemon(p){const D=window.DAMEKE_DATA;return (D.zMax&&D.zMax.gmaxEligible||[]).includes(p.name);}
  // 専用Zの判定は、計算本体(calc.jsのDAMEKE_DATA_HELPERS.specialZRuleFor)と同じ基準
  // (ポケモン名の完全一致)で行う。
  function allSignatureZRules(){const D=window.DAMEKE_DATA;return (D.zMax&&(D.zMax.signatureZRules||D.zMax.signatureZ))||[];}
  function specialZRule(p,m){
    if(!p||!m||!m.name) return null;
    const H=window.DAMEKE_DATA_HELPERS;
    if(H&&H.specialZRuleFor) return H.specialZRuleFor(p,m);
    return allSignatureZRules().find(r=>(r.pokemon||[]).includes(p.name)&&r.move===m.name)||null;
  }
  // このポケモンが使える専用Zのルール一覧(技を問わない)。ポケモン名の完全一致のみ。
  function signatureZRulesForPokemon(p){
    if(!p||!p.name) return [];
    return allSignatureZRules().filter(r=>(r.pokemon||[]).includes(p.name));
  }
  function fillStateSelect(sel, opts){if(!sel)return;const cur=sel.value;sel.textContent = "";opts.forEach(o=>{const op=document.createElement('option');op.value=o.id;op.textContent=o.name;sel.appendChild(op);});sel.value=opts.some(o=>o.id===cur)?cur:'none';}
  // 「専用Z」の選択肢は、ポケモン名だけで(技に関係なく)出す。選択中の値が専用Zで、技が条件から
  // 外れている場合は「なし」に戻す(ポケモンが条件から外れた場合は、選択肢自体が消えるため
  // fillStateSelectが自動的に「なし」に戻す)。
  function fillAttackerStateSelect(sel,atk,m){
    fillStateSelect(sel,buildAttackerSpecialStateOpts(atk,m));
    if(sel&&sel.value==='special_z'&&!specialZRule(atk,m)) sel.value='none';
  }
  function buildAttackerSpecialStateOpts(atk,m){const opts=[{id:'none',name:'なし'}];
    opts.push({id:'zmove',name:'Zワザ'});
    if(signatureZRulesForPokemon(atk).length) opts.push({id:'special_z',name:'専用Z'});
    if(canDynamaxPokemon(atk)) opts.push({id:'dynamax',name:'ダイマックス'});
    if(canDynamaxPokemon(atk)&&canGmaxPokemon(atk)) opts.push({id:'gmax',name:'キョダイマックス'});
    return opts;
  }
  function updateSpecialStateOptions(){const D=window.DAMEKE_DATA;if(!D||!D.zMax)return;const atk=current('attacker'),def=current('defender'),m=move();
    const defOpts=[{id:'none',name:'なし'}];
    if(canDynamaxPokemon(def)) defOpts.push({id:'dynamax',name:'ダイマックス'});
    if(canDynamaxPokemon(def)&&canGmaxPokemon(def)) defOpts.push({id:'gmax',name:'キョダイマックス'});
    fillAttackerStateSelect(q('attackerSpecialState'),atk,m);fillStateSelect(q('defenderSpecialState'),defOpts);
    // 技②の専用Zは、同じ攻撃側ポケモンでも技②自身の選択技(move2Select)を基準に判定するため、
    // 技①用とは別に作り直す(ダイマックス/キョダイマックスの可否は攻撃側ポケモン自体で決まる
    // ため技①・技②で共通)。
    fillAttackerStateSelect(q('move2AttackerSpecialState'),atk,move2());
  }
  // 「専用Z」が選ばれたとき、技①(slot 1)/技②(slot 2)の技を専用Zの条件どおりの技へ自動で
  // 変更する(すでに条件を満たす技が選ばれていれば何もしない)。技の選択欄が「覚える技」に
  // 絞り込まれていて該当する技が候補にない場合は、その技の「全技」をオンにして候補に出す。
  // 技の変更は通常の手動選択と同じ'change'イベントで通知するため、技固有条件の表示切り替えや
  // 再計算もそのまま行われる。
  function applySpecialZMove(slot){
    const stateSel=q(slot===2?'move2AttackerSpecialState':'attackerSpecialState');
    if(!stateSel||stateSel.value!=='special_z') return;
    const atk=current('attacker');
    const moveSel=q(slot===2?'move2Select':'moveSelect');
    if(!moveSel) return;
    const curMove=slot===2?move2():move();
    const curMoveValid=moveSel.value===curMove.id;
    if(curMoveValid&&specialZRule(atk,curMove)) return;
    const rule=signatureZRulesForPokemon(atk)[0];
    if(!rule) return;
    const D=window.DAMEKE_DATA;
    const target=(D.moves||[]).find(x=>x.name===rule.move);
    if(!target) return;
    const hasOption=()=>Array.prototype.some.call(moveSel.options,o=>o.value===target.id);
    if(!hasOption()){
      const showAll=q(slot===2?'move2ShowAll':'moveShowAll');
      if(showAll) showAll.checked=true;
      const refilter=slot===2?window.__damekeApplyMoveFilter2:window.__damekeApplyMoveFilter;
      if(refilter) refilter();
      if(!hasOption()) return;
    }
    moveSel.value=target.id;
    if(moveSel._v082hRefreshOptions) moveSel._v082hRefreshOptions();
    // 技を変えたことで専用Zの選択肢の作り直し・技固有条件の切り替え・タイプ色・再計算が
    // 通常の手動選択と同じ経路で走るよう、'change'を発火する。
    try{ moveSel.dispatchEvent(new Event('change',{bubbles:true})); }
    catch(err){ const ev=document.createEvent('Event'); ev.initEvent('change',true,true); moveSel.dispatchEvent(ev); }
    // 念のため、専用Zの選択が技変更後も残っていることを保証する(直前の'change'処理で
    // 選択肢が作り直されても、条件を満たしているので専用Zのまま残るはず)。
    if(stateSel.value!=='special_z'&&specialZRule(atk,target)) stateSel.value='special_z';
    if(window.__damekeCalculate) window.__damekeCalculate();
  }
  function initV021(){['attackerSelect','defenderSelect','moveSelect','move2Select'].forEach(id=>{const e=q(id);if(e)e.addEventListener('change',updateSpecialStateOptions);});
    const s1=q('attackerSpecialState'), s2=q('move2AttackerSpecialState');
    if(s1) s1.addEventListener('change',()=>applySpecialZMove(1));
    if(s2) s2.addEventListener('change',()=>applySpecialZMove(2));
    setTimeout(updateSpecialStateOptions,0);}
  window.__damekeInitV021 = initV021;
  window.__damekeUpdateSpecialStateOptions = updateSpecialStateOptions;
})();




// ===== BEGIN integrated UI builder =====
// Integrated UI builder: layout, abilities, stats, conditions, and compact results
(function(){
  if(window.__damekeUiV082h) return;
  window.__damekeUiV082h = true;

  function q(id){ return document.getElementById(id); }
  function all(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function make(tag, cls, text){ var e=document.createElement(tag); if(cls) e.className=cls; if(text!==undefined && text!==null) e.textContent=text; return e; }
  function labelOf(id){ var e=q(id); return e ? e.closest('label') : null; }
  function moveLabel(id, dest){ var l=labelOf(id); if(l && dest) dest.appendChild(l); }
  function valueOf(id){ var e=q(id); return e ? e.value : ''; }
  function optionText(id){ var e=q(id); return e && e.options && e.selectedIndex >= 0 ? e.options[e.selectedIndex].textContent : ''; }
  function dispatchChange(el){ if(!el) return; try{ el.dispatchEvent(new Event('change', {bubbles:true})); }catch(err){ var ev=document.createEvent('Event'); ev.initEvent('change', true, true); el.dispatchEvent(ev); } }
  function kanaNormalize(s){
    return String(s||'').replace(/[\u30a1-\u30f6]/g, function(c){ return String.fromCharCode(c.charCodeAt(0) - 0x60); }).toLowerCase();
  }
  var searchComboSyncList = [];
  var searchComboSyncTimer = null;
  function ensureSearchComboSync(){
    if(searchComboSyncTimer) return;
    searchComboSyncTimer = setInterval(function(){
      searchComboSyncList.forEach(function(c){
        if(document.activeElement === c.input) return;
        var t = c.currentText();
        if(c.input.value !== t) c.input.value = t;
      });
    }, 400);
  }
  function attachSearchCombo(selectIdOrElement){
    // id文字列で渡された場合はdocument.getElementByIdで探す(まだページに挿入されていない、
    // 構築中のデタッチされたDOMツリー内の要素は見つからない)。要素そのものが直接渡された
    // 場合は、ライブかどうかに関わらずそのまま使える。
    var select = typeof selectIdOrElement === 'string' ? q(selectIdOrElement) : selectIdOrElement;
    if(!select || select.getAttribute('data-v082h-search')) return;
    // 万一、呼び出し元の実装ミスでまだどこにも追加されていない(親を持たない)要素が
    // 渡された場合、insertBeforeで例外を投げてページ全体の描画を止めてしまうことを防ぐ。
    if(!select.parentNode) return;
    select.setAttribute('data-v082h-search', '1');

    var wrap = make('div','v082h-search-combo');
    var input = document.createElement('input');
    input.type = 'text'; input.className = 'v082h-search-input'; input.autocomplete = 'off';
    var list = document.createElement('ul');
    list.className = 'v082h-search-list'; list.hidden = true;
    // The dropdown is a normal-flow child of the input's own (position:relative) wrapper,
    // positioned with plain CSS (top:100%/bottom:100%, see style.css) rather than
    // position:fixed plus JS-computed pixel coordinates. This is the standard, robust way to
    // build this kind of control: since the browser itself keeps an absolutely-positioned
    // element glued to its normal-flow parent through scrolling, zooming, and on-screen-keyboard
    // viewport resizing, there's no JS position math to keep in sync with any of that, and
    // nothing to get out of sync in the first place.
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(input); wrap.appendChild(list); wrap.appendChild(select);
    select.classList.add('v082h-hide');

    function currentText(){ var o=select.options[select.selectedIndex]; return o ? o.textContent : ''; }
    input.value = currentText();

    var options = Array.prototype.map.call(select.options, function(o){ return { value:o.value, text:o.textContent, norm:kanaNormalize(o.textContent) }; });
    var activeIndex = -1;
    select._v082hRefreshOptions = function(){
      options = Array.prototype.map.call(select.options, function(o){ return { value:o.value, text:o.textContent, norm:kanaNormalize(o.textContent) }; });
      input.value = currentText();
    };

    function closeList(){ list.hidden = true; }
    function updateListDirection(){
      var r = input.getBoundingClientRect();
      var vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      list.classList.toggle('v082h-search-list-up', r.bottom > vh * 0.6);
    }
    function renderList(query){
      var nq = kanaNormalize(query);
      var matches = nq ? options.filter(function(o){ return o.norm.indexOf(nq) === 0; }) : options;
      list.innerHTML = '';
      activeIndex = -1;
      if(!matches.length){ closeList(); return; }
      matches.forEach(function(o){
        var li = document.createElement('li');
        li.textContent = o.text; li.className = 'v082h-search-item';
        li.addEventListener('mousedown', function(e){ e.preventDefault(); choose(o); });
        list.appendChild(li);
      });
      // Made every time the list (re)renders, using the input's *current* position -- this
      // matters because on first open, the up/down choice runs before the auto-scroll below has
      // had a chance to move the input, so it can end up based on a position (near the bottom of
      // the screen) that's no longer accurate once the input settles nearer the top. Typing
      // anything re-triggers this via the 'input' listener, which is why the list would
      // self-correct back to "below" once the user typed a character -- the fix below just also
      // re-checks once after the scroll itself finishes, so it's already correct without
      // requiring that extra keystroke.
      updateListDirection();
      list.hidden = false;
    }
    function choose(o){
      select.value = o.value; input.value = o.text; closeList();
      dispatchChange(select);
      // Deferred rather than called synchronously here: mousedown's preventDefault() (see the
      // list item's own listener below) keeps the input focused through the click so the list
      // doesn't close early, but that same suppression means an immediate .blur() here can get
      // silently overridden once the click gesture finishes and the browser re-affirms focus on
      // whatever was focused going in -- deferring past that point makes the blur stick.
      // Blurs document.activeElement rather than this closure's own `input` specifically: for
      // fields whose change (e.g. picking a Pokemon) triggers a larger rebuild elsewhere on the
      // page, `input` can already be a stale, detached reference by the time this timeout fires,
      // which silently blurs nothing -- activeElement always refers to whatever is actually
      // focused at that later point, rebuilt or not.
      setTimeout(function(){ if(document.activeElement && document.activeElement.blur) document.activeElement.blur(); }, 0);
    }
    function updateActive(items){
      items.forEach(function(li,i){ li.classList.toggle('active', i===activeIndex); });
      if(activeIndex>=0 && items[activeIndex]) items[activeIndex].scrollIntoView({block:'nearest'});
    }
    input.addEventListener('focus', function(){
      renderList('');
      input.select();
      // A light nudge so the input (and the dropdown right below/above it) isn't left under the
      // keyboard -- unlike before, this doesn't need to be precisely timed against anything,
      // since it's not feeding a position calculation; worst case it's a little off and the
      // browser's own keyboard-avoidance behavior (most mobile browsers already do this
      // natively for focused inputs) covers the rest.
      setTimeout(function(){
        // Centering the input (the old block:'center') puts it right where a mobile keyboard
        // (which eats roughly the bottom half of the screen) covers it. scrollIntoView doesn't
        // support an arbitrary target offset, so this computes a scroll position that lands the
        // input nearer the top of the visible area instead, comfortably above where the
        // keyboard will end up.
        var rect = input.getBoundingClientRect();
        var vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        var targetY = window.pageYOffset + rect.top - vh * 0.2;
        window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
        // Re-check the up/down direction once the smooth scroll above has had time to finish --
        // see the comment in renderList() for why this is needed rather than relying on the
        // decision made at the very start of this focus handler.
        setTimeout(function(){ if(!list.hidden) updateListDirection(); }, 450);
      }, 80);
    });
    input.addEventListener('input', function(){ renderList(input.value); });
    input.addEventListener('blur', function(){ setTimeout(function(){ closeList(); input.value = currentText(); }, 120); });
    input.addEventListener('keydown', function(e){
      var items = list.querySelectorAll('.v082h-search-item');
      if(e.key === 'ArrowDown'){ e.preventDefault(); if(list.hidden) renderList(input.value); else { activeIndex = Math.min(items.length-1, activeIndex+1); updateActive(items); } }
      else if(e.key === 'ArrowUp'){ e.preventDefault(); activeIndex = Math.max(0, activeIndex-1); updateActive(items); }
      else if(e.key === 'Enter'){ e.preventDefault(); if(activeIndex>=0 && items[activeIndex]) items[activeIndex].dispatchEvent(new MouseEvent('mousedown')); }
      else if(e.key === 'Escape'){ closeList(); input.value = currentText(); }
    });
    select.addEventListener('change', function(){ input.value = currentText(); });
    searchComboSyncList.push({ select: select, input: input, currentText: currentText });
    ensureSearchComboSync();
  }
  window.__damekeAttachSearchCombo = attachSearchCombo;
  function firstTextNode(label){ if(!label) return null; for(var i=0;i<label.childNodes.length;i++){ var n=label.childNodes[i]; if(n.nodeType===3 && String(n.textContent).trim()) return n; } return null; }
  function relabel(id, text){
    var l=labelOf(id); if(!l) return;
    for(var i=l.childNodes.length-1;i>=0;i--){
      if(l.childNodes[i].nodeType===3) l.removeChild(l.childNodes[i]);
    }
    var control=q(id);
    var isChoice=!!(control && (control.type==='checkbox' || control.type==='radio'));
    var textNode=document.createTextNode(text);
    if(isChoice){
      if(control.parentNode!==l) l.appendChild(control);
      if(control.nextSibling) l.insertBefore(textNode, control.nextSibling);
      else l.appendChild(textNode);
    }else{
      l.insertBefore(textNode, l.firstChild);
    }
  }
  function selectByText(selectId, label){ var s=q(selectId); if(!s) return false; for(var i=0;i<s.options.length;i++){ if(s.options[i].textContent===label || s.options[i].value===label){ s.value=s.options[i].value; dispatchChange(s); return true; } } return false; }

  function details(title, cls, open){ var d=document.createElement('details'); d.className=cls||'v082h-details'; d.open=!!open; d.appendChild(make('summary','',title)); return d; }
  function box(title, cls, side){
    var s=make('section','sub-card v082h-box '+(cls||''));
    var head=make('div','v082h-box-head');
    head.appendChild(make('h3','',title));
    if(side){
      var group=make('div','dameke-btn-group dameke-btn-group-poke');
      group.appendChild(make('span','dameke-btn-group-label','ポケ管理'));
      var row=make('div','dameke-btn-group-buttons');
      var saveBtn=make('button','dameke-btn-group-btn dameke-btn-group-save','保存');
      saveBtn.type='button';
      saveBtn.addEventListener('click', function(){ if(window.__damekeSavePokemonFromSide) window.__damekeSavePokemonFromSide(side); });
      var loadBtn=make('button','dameke-btn-group-btn dameke-btn-group-load','呼び出し');
      loadBtn.type='button';
      loadBtn.addEventListener('click', function(){ if(window.__damekeShowPanel) window.__damekeShowPanel('pokemon'); });
      row.appendChild(saveBtn); row.appendChild(loadBtn);
      group.appendChild(row);
      head.appendChild(group);
    }
    s.appendChild(head);
    return s;
  }
  function zone(id, title){ var d=details(title,'v082h-details v082h-trigger-details',false); d.id=id; return d; }

  function setActiveSide(side){
    document.body.classList.remove('v082h-tab-attacker','v082h-tab-defender');
    document.body.classList.add('v082h-tab-'+side);
    all('.v082h-side-tabs button').forEach(function(b){ b.classList.toggle('active', b.dataset.side===side); });
  }
  function buildSideTabs(){
    var bar=make('div','v082h-side-tabs');
    ['attacker','defender'].forEach(function(side){
      var b=document.createElement('button'); b.type='button';
      b.textContent = side==='attacker' ? '攻撃側' : '防御側';
      b.dataset.side=side;
      b.addEventListener('click', function(){ setActiveSide(side); });
      bar.appendChild(b);
    });
    return bar;
  }
  function installLayout(){
    if(q('v082hBasicGrid')) return;
    var top=document.querySelector('.top-inputs');
    if(!top) return;
    var root=top.closest('.sub-card');
    if(!root) return;
    root.classList.add('v082h-root-basic');

    var toolbar=make('div','v082h-toolbar'); toolbar.id='v082hToolbar';
    var swap=make('button','dameke-toolbar-btn dameke-toolbar-btn-swap','攻防交代'); swap.type='button'; swap.id='v082hSwapBtn'; swap.addEventListener('click', swapSides);
    toolbar.appendChild(swap);
    root.appendChild(toolbar);

    root.appendChild(buildSideTabs());
    var grid=make('div','v082h-basic-grid'); grid.id='v082hBasicGrid'; root.appendChild(grid);
    var atk=box('攻撃側','v082h-attacker','attacker');
    var def=box('防御側','v082h-defender','defender');
    grid.appendChild(atk); grid.appendChild(def);
    buildSide('attacker', atk, true);
    buildSide('defender', def, false);
    top.classList.add('v082h-hide');
    all('.side-panel').forEach(function(p){ p.classList.add('v082h-hide'); });
    hideOldItemAbilityBox();
    var calc=q('calculateButton'); if(calc) calc.classList.add('v082h-hide');
    var copy=q('copyTraceButton'); var traceEl=q('trace');
    if(copy) copy.classList.add('v082h-hide');
    if(traceEl){
      traceEl.classList.add('v082h-hide');
      if(traceEl.previousElementSibling && traceEl.previousElementSibling.tagName==='H3') traceEl.previousElementSibling.classList.add('v082h-hide');
    }
    var protect=labelOf('protect'); if(protect){ var p=q('protect'); if(p) p.checked=false; protect.classList.add('v082h-hide'); }
  }
  function hideOldItemAbilityBox(){
    all('.input-card > .sub-card').forEach(function(section){ var h=section.querySelector('h3'); if(h && h.textContent==='持ち物・特性') section.classList.add('v082h-hide'); });
  }

  function buildSide(side, dest, isAttack){
    moveLabel(side+'Select', dest);
    relabel(side+'Select','ポケモン名');
    var pokemonLabel=labelOf(side+'Select'); if(pokemonLabel) pokemonLabel.classList.add('v082h-pokemon-field');
    attachSearchCombo(side+'Select');
    var typeGrid=make('div','v082h-mini-grid v082h-type-grid'); dest.appendChild(typeGrid);
    moveLabel(side+'Type1', typeGrid); moveLabel(side+'Type2', typeGrid);
    var typeD=details('タイプ変更効果','v082h-details v082h-type-effects',false); dest.appendChild(typeD);
    moveLabel(side+'TypeOverride', typeD); moveLabel(side+'AddType', typeD);
    moveLabel(side+'Roost', typeD); moveLabel(side+'BurnUp', typeD); moveLabel(side+'DoubleShock', typeD);
    addAbilityPanel(side, dest);
    moveLabel(side+'ItemSelect', dest);
    relabel(side+'ItemSelect','持ち物');
    var itemLabel=labelOf(side+'ItemSelect'); if(itemLabel){ itemLabel.classList.add('dameke-main-control-label'); }
    attachSearchCombo(side+'ItemSelect');
    var itemZone=make('div','v082h-zone'); itemZone.id=isAttack?'v082hAttackerItemZone':'v082hDefenderItemZone'; dest.appendChild(itemZone);
    var noItem=labelOf(side+'NoItem'); if(noItem){ var inp=q(side+'NoItem'); noItem.classList.add('v082h-inline-check'); noItem.textContent = ""; if(inp) noItem.appendChild(inp); noItem.appendChild(document.createTextNode('持ち物なし')); dest.appendChild(noItem); }
    // 攻撃側のZ・ダイマ/テラスタルは技①・技②それぞれ専用のフィールドを持つため、ここ(攻撃側の
    // 全般ステータス欄)には置かず、下のisAttackブロックで技①(move1Fold)・技②(move2Fold)の
    // 急所ランクの下にそれぞれ移設する。防御側は従来通りここに置く。
    if(!isAttack){
      var specialGrid=make('div','v082h-mini-grid'); dest.appendChild(specialGrid);
      moveLabel(side+'SpecialState', specialGrid);
      moveLabel(side+'TeraType', specialGrid);
    }
    if(isAttack){ var teraZone=make('div','v082h-zone'); teraZone.id='v082hAttackerTeraZone'; dest.appendChild(teraZone); }
    addStatsPanel(side, dest);
    if(isAttack){
      // 急所ランク(id="critical")はaddStatsPanel内で命中・回避の隣へ移設済みのため、ここでは移動しない。
      // 技①のまとまり(技名選択・技固有条件バブル・急所ランク)を、技②(.dameke-move2-fold)と
      // 同じ見た目の枠で囲む。
      var move1Fold=make('div','dameke-move1-fold'); dest.appendChild(move1Fold);
      var moveRow=make('div','v082h-move1-row'); move1Fold.appendChild(moveRow);
      moveLabel('moveSelect', moveRow);
      relabel('moveSelect','技①');
      var moveLabelEl=labelOf('moveSelect'); if(moveLabelEl){ moveLabelEl.classList.add('dameke-main-control-label'); }
      attachSearchCombo('moveSelect');
      // 全技チェックボックスを「技①」というラベルのテキストと同じ行の右側に並べる。
      // (検索ボックス自体はテキストの下に全幅で表示されるため、テキストとチェックボックスだけを
      //  ヘッダー行としてひとまとめにし、検索ボックスはその下の行として残す。)
      if(moveLabelEl){
        var moveHeaderRow=make('span','dameke-move-label-header');
        var moveTextNode=firstTextNode(moveLabelEl);
        // 「技①」の見出し文字は、技②側の<summary>(dameke-move2-fold summary)と見た目
        // (太さ・サイズ・色)を揃えるため、専用のspanでラップしてCSSで個別にスタイルする
        // (全技チェックボックス側の見た目は変えない)。
        if(moveTextNode){
          var moveTextSpan=make('span','dameke-move-label-text');
          moveTextSpan.appendChild(moveTextNode);
          moveHeaderRow.appendChild(moveTextSpan);
        }
        var moveShowAllLabel=labelOf('moveShowAll');
        if(moveShowAllLabel) moveHeaderRow.appendChild(moveShowAllLabel);
        // ヘッダー行(「技①」テキスト+全技チェックボックス)は、moveLabelEl(select本体を暗黙的に
        // ラベル付けする<label>)の"外"(直前の兄弟)に置く。中に入れてしまうと、暗黙ラベルの
        // 結びつけ先が「DOM順で最初のlabelable要素」であるチェックボックス側になってしまい、
        // 行のどこをクリックしても(本来のselectではなく)チェックボックスがトグルされる不具合が
        // あったため。見た目上の配置(select本体の直前の行)は変わらない。
        if(moveTextNode) moveLabelEl.setAttribute('aria-label', String(moveTextNode.textContent||'').trim());
        moveLabelEl.parentNode.insertBefore(moveHeaderRow, moveLabelEl);
      }
      var moveZone=make('div','v082h-zone'); moveZone.id='v082hMoveZone'; move1Fold.appendChild(moveZone);
      moveLabel('attackerCriticalForce', move1Fold);
      // Z・ダイマ/テラスタル(技①側): 急所ランクのすぐ下に、技②側(dameke-move2-fold内の
      // move2AttackerSpecialState/move2AttackerTeraType、HTML側で既に急所の下に静的配置済み)と
      // 揃う見た目(v082h-mini-grid)で配置する。
      var move1SpecialGrid=make('div','v082h-mini-grid dameke-move-special-grid'); move1Fold.appendChild(move1SpecialGrid);
      moveLabel('attackerSpecialState', move1SpecialGrid);
      moveLabel('attackerTeraType', move1SpecialGrid);

      var move2Fold=document.querySelector('.dameke-move2-fold');
      if(move2Fold){
        dest.appendChild(move2Fold);
        var move2SelectLabel=labelOf('move2Select');
        if(move2SelectLabel){ move2SelectLabel.classList.add('dameke-main-control-label'); }
        attachSearchCombo('move2Select');
        // 全技チェックボックスの位置だけを、技①(選択ボックスの上の行、右寄せ)と同じ位置関係に
        // する。「技②」という見出し文字自体は<summary>のまま動かさない(折り畳みの開閉トグルは
        // <summary>が担うため、そこにチェックボックスを混ぜると折り畳みの見た目が崩れる)。
        if(move2SelectLabel){
          var move2HeaderRow=make('span','dameke-move-label-header');
          var move2ShowAllLabel=labelOf('move2ShowAll');
          if(move2ShowAllLabel) move2HeaderRow.appendChild(move2ShowAllLabel);
          // 技①側と同じ理由で、move2SelectLabel(select本体の暗黙ラベル)の外(直前の兄弟)に置く。
          move2SelectLabel.parentNode.insertBefore(move2HeaderRow, move2SelectLabel);
        }
        // 技②固有条件も技①とまったく同じ「該当する項目だけを自動で開閉するバブル」の仕組みに
        // するため、専用のズーン(v082hMove2Zone)を、旧来の常設グリッド(move2SpecificSection)
        // があった位置に差し込む。実際のフィールドの移設はmoveConditionalLabels()で行う。
        var move2Zone=make('div','v082h-zone'); move2Zone.id='v082hMove2Zone';
        var move2SpecificSection=q('move2SpecificSection');
        if(move2SpecificSection && move2SpecificSection.parentNode){ move2SpecificSection.parentNode.insertBefore(move2Zone, move2SpecificSection); }
        else move2Fold.appendChild(move2Zone);
        var moveOrderActions=document.querySelector('.dameke-move-order-actions');
        if(moveOrderActions) move2Fold.appendChild(moveOrderActions);
      }
    }
  }

  function addAbilityPanel(side, dest){
    var wrap=make('div','v082h-ability-panel'); wrap.id='v082hAbilityPanel_'+side;
    dest.appendChild(wrap);
    wrap.appendChild(make('div','v082h-minititle','特性'));
    var buttons=make('div','v082h-ability-buttons'); buttons.id='v082hAbilityButtons_'+side; wrap.appendChild(buttons);
    moveLabel(side+'AbilitySelect', wrap);
    var abilityZone=make('div','v082h-zone'); abilityZone.id=side==='attacker'?'v082hAttackerAbilityZone':'v082hDefenderAbilityZone'; wrap.appendChild(abilityZone);
    var no=labelOf(side+'NoAbility'); if(no){ var inp=q(side+'NoAbility'); no.classList.add('v082h-inline-check'); no.textContent = ""; if(inp) no.appendChild(inp); no.appendChild(document.createTextNode('特性なし')); wrap.appendChild(no); }
  }
  function updateAbilityButtons(side){
    var host=q('v082hAbilityButtons_'+side); if(!host) return;
    host.innerHTML='';
    var D=window.DAMEKE_DATA || {};
    var pokemonList=D.pokemons||[];
    var pokemon=pokemonList.find(function(p){ return p.id===valueOf(side+'Select'); }) || pokemonList[0];
    var names=[];
    if(pokemon){
      if(Array.isArray(pokemon.abilities)) names=pokemon.abilities.slice(0,3);
      if(!names.length){ ['ability1','ability2','hiddenAbility','ability'].forEach(function(k){ if(pokemon[k]) names.push(pokemon[k]); }); }
    }
    names.forEach(function(name){
      if(!name || name==='なし') return;
      var b=make('button','v082h-ability-chip',name); b.type='button';
      b.addEventListener('click',function(){ selectByText(side+'AbilitySelect', name); });
      host.appendChild(b);
    });
    if(!host.childNodes.length) host.appendChild(make('span','v082h-muted','候補なし'));
    host.appendChild(make('span','v082h-muted',''));
  }

  function currentPokemon(side){
    var D=window.DAMEKE_DATA || {};
    var id=valueOf(side+'Select');
    var list=D.pokemons||[];
    return list.find(function(p){ return p.id===id; }) || list[0];
  }
  function statsSnapshot(side){
    var out={ivs:{},evs:{},ranks:{}};
    var n=q(side+'_nature'); out.nature = n?n.value:'まじめ';
    ['H','A','B','C','D','S'].forEach(function(k){
      var ivEl=q(side+'_'+k+'_iv'), evEl=q(side+'_'+k+'_ev');
      if(ivEl) out.ivs[k]=ivEl.value;
      if(evEl) out.evs[k]=evEl.value;
    });
    return out;
  }
  // 実数値 -> 努力値 reverse lookup, exposed on window since the 実数値 input's own change
  // listener lives in a different IIFE (the one that builds the stats grid) and has no direct
  // access to currentPokemon/statsSnapshot/valueOf, which only exist in this closure.
  function reverseLookupEvForActualStat(side, key, targetValue){
    var C = window.DAMEKE_CALC, p = currentPokemon(side);
    if(!p || !C || !C.getActualStats) return null;
    var level = valueOf(side+'Level');
    var snap = statsSnapshot(side);
    function actualAt(ev){
      var s = Object.assign({}, snap, { evs: Object.assign({}, snap.evs) });
      s.evs[key] = String(ev);
      var result = C.getActualStats(p, level, s);
      return result ? result[key] : 0;
    }
    var lo = actualAt(0), hi = actualAt(32);
    var target = isNaN(targetValue) ? lo : targetValue;
    target = Math.max(lo, Math.min(hi, target));
    var chosenEv = 32;
    for(var ev=0; ev<=32; ev++){
      if(actualAt(ev) >= target){ chosenEv = ev; break; }
    }
    return { ev: chosenEv, value: actualAt(chosenEv) };
  }
  window.__damekeReverseLookupEv = reverseLookupEvForActualStat;
  function applyHpFraction(side, denom){
    var C=window.DAMEKE_CALC, p=currentPokemon(side);
    if(!C || !p || !C.previewBaseMaxHp) return;
    var level=valueOf(side+'Level');
    var maxHp=C.previewBaseMaxHp(p, level, statsSnapshot(side));
    var input=q(side+'CurrentHp'); if(!input) return;
    input.value=String(Math.max(1, Math.floor(maxHp/denom)));
    dispatchChange(input);
  }

  function readOnlyStatRow(side,label,stats,idPrefix){
    var row=make('div','v082h-stat-row');
    row.appendChild(make('span','v082h-stat-label',label));
    stats.forEach(function(k){
      var cell=make('span','v082h-stat-cell v082h-stat-readonly');
      cell.id = idPrefix+'_'+side+'_'+k;
      row.appendChild(cell);
    });
    return row;
  }
  function updateReadOnlyStatRows(side){
    var C=window.DAMEKE_CALC, p=currentPokemon(side);
    if(!p) return;
    ['H','A','B','C','D','S'].forEach(function(k){
      var baseCell=q('v082hBaseStat_'+side+'_'+k);
      if(baseCell) baseCell.textContent = (p.baseStats && p.baseStats[k]!=null) ? p.baseStats[k] : '-';
    });
    if(!C || !C.getActualStats) return;
    var level=valueOf(side+'Level');
    var snap = statsSnapshot(side);
    var actual = C.getActualStats(p, level, snap);
    ['H','A','B','C','D','S'].forEach(function(k){
      var actualEl = q(side+'_'+k+'_actual');
      if(!actualEl) return;
      // min/max reflect exactly what's achievable for this stat at the CURRENT nature/level/IV
      // (EV0 through EV32) -- kept in sync on every relevant change so the browser's own
      // validation, and the reverse-EV lookup's own clamping, always agree with each other.
      var loSnap = Object.assign({}, snap, { evs: Object.assign({}, snap.evs, (function(){ var o={}; o[k]='0'; return o; })()) });
      var hiSnap = Object.assign({}, snap, { evs: Object.assign({}, snap.evs, (function(){ var o={}; o[k]='32'; return o; })()) });
      var lo = C.getActualStats(p, level, loSnap), hi = C.getActualStats(p, level, hiSnap);
      if(lo && hi){ actualEl.min = String(lo[k]); actualEl.max = String(hi[k]); }
      // Don't overwrite the field the user is actively typing into -- its own change handler
      // (bindActualStatInputs) is what reacts to a value THEY entered; this path only mirrors
      // whatever IV/EV/nature/level currently compute to, for every other field.
      if(document.activeElement !== actualEl) actualEl.value = actual ? actual[k] : '';
    });
  }

  function addStatsPanel(side, dest){
    var panel=make('div','v082h-stats-panel'); panel.id='v082hStatsPanel_'+side;
    dest.appendChild(panel);
    var titleRow = make('div','v082h-minititle-row');
    titleRow.appendChild(make('div','v082h-minititle','詳細ステータス'));
    // "調整": jumps to the 攻撃・防御調整 tool (see app_adjust.js), preset to this side's mode.
    var adjustBtn = document.createElement('button');
    adjustBtn.type = 'button';
    adjustBtn.className = 'v082h-stats-adjust-btn v082h-stats-adjust-btn-'+side;
    adjustBtn.textContent = '調整';
    adjustBtn.addEventListener('click', function(){
      if(window.__damekeShowPanel) window.__damekeShowPanel('adjust');
      if(window.__damekeSetAdjustMode) window.__damekeSetAdjustMode(side === 'attacker' ? 'attacker' : 'defender');
    });
    titleRow.appendChild(adjustBtn);
    panel.appendChild(titleRow);

    addNatureField(side, panel);

    var visible=make('div','v082h-stat-table'); panel.appendChild(visible);
    visible.appendChild(statHeader(['H','A','B','C','D','S']));
    visible.appendChild(readOnlyStatRow(side,'種族値',['H','A','B','C','D','S'],'v082hBaseStat'));
    visible.appendChild(statRow(side,'努力値',['H','A','B','C','D','S'],'ev'));
    visible.appendChild(statRow(side,'実数値',['H','A','B','C','D','S'],'actual'));
    visible.appendChild(statRow(side,'ランク',['H','A','B','C','D','S'],'rank'));

    var accEva=make('div','v082h-stat-table v082h-rank-sub'); panel.appendChild(accEva);
    // 急所ランク(id="critical")は攻撃側専用の技固有条件だが、命中・回避と同じ「ランク」の
    // 見た目(attachNumberPicker)で扱えるよう、攻撃側パネルに限りここへ3列目として合流させる。
    var accEvaKeys = (side === 'attacker') ? ['acc','eva','critical'] : ['acc','eva'];
    accEva.appendChild(statHeader(accEvaKeys));
    accEva.appendChild(statRow(side,'ランク',accEvaKeys,'rank'));

    var levelInputEl = q(side+'Level');
    if(levelInputEl){
      levelInputEl.addEventListener('input', function(){ updateReadOnlyStatRows(side); });
      levelInputEl.addEventListener('change', function(){ updateReadOnlyStatRows(side); });
    }

    addRemainingEvDisplay(side, panel);
    addEvPreset(side, panel);
    addHpPreset(side, panel);
    addLevelIvFold(side, panel);

    var original=q(side+'StatsGrid'); if(original) original.classList.add('v082h-hide');
  }
  function addNatureField(side, panel){
    var sel=q(side+'_nature'); if(!sel) return;
    var lbl=document.createElement('label');
    lbl.className='v082h-nature-field';
    lbl.appendChild(document.createTextNode('性格'));
    lbl.appendChild(sel);
    panel.appendChild(lbl);
    sel.addEventListener('change', function(){ updateNatureStatColors(side); updateReadOnlyStatRows(side); });
    setTimeout(function(){ updateNatureStatColors(side); updateReadOnlyStatRows(side); }, 0);
  }
  function updateRemainingEvDisplay(side){
    var textEl = q('v082hEvRemainingText_'+side);
    if(!textEl) return;
    var total = 0;
    ['H','A','B','C','D','S'].forEach(function(k){ var e=q(side+'_'+k+'_ev'); total += e ? (parseInt(e.value,10)||0) : 0; });
    var remaining = 66 - total;
    textEl.textContent = '残り努力値：' + remaining;
    textEl.classList.toggle('v082h-ev-remaining-over', remaining < 0);
  }
  function addRemainingEvDisplay(side, panel){
    var wrap = make('div', 'v082h-ev-remaining');
    wrap.id = 'v082hEvRemaining_'+side;
    var textEl = document.createElement('span');
    textEl.id = 'v082hEvRemainingText_'+side;
    wrap.appendChild(textEl);
    panel.appendChild(wrap);
    function update(){
      updateRemainingEvDisplay(side);
      updateReadOnlyStatRows(side);
    }
    ['H','A','B','C','D','S'].forEach(function(k){
      var e = q(side+'_'+k+'_ev');
      if(e){ e.addEventListener('input', update); e.addEventListener('change', update); }
      var iv = q(side+'_'+k+'_iv');
      if(iv){ iv.addEventListener('input', function(){ updateReadOnlyStatRows(side); }); iv.addEventListener('change', function(){ updateReadOnlyStatRows(side); }); }
    });
    update();
  }
  function addEvPreset(side, panel){
    var wrap=make('div','v082h-ev-preset');
    wrap.appendChild(make('span','v082h-muted','努力値簡易入力'));
    var select=make('select','v082h-ev-select'); select.id='v082hEvPreset_'+side;
    var options=['選択なし','HA','HB','HC','HD','HS','AB','AC','AD','AS','BC','BD','BS','CD','CS','DS'];
    options.forEach(function(x){ var op=document.createElement('option'); op.value=x; op.textContent=x; select.appendChild(op); });
    select.value='選択なし';
    select.addEventListener('change', function(){ applyEvPreset(side, select.value); });
    var btn=make('button','v082h-ability-chip','リセット'); btn.type='button';
    btn.addEventListener('click', function(){ select.value='選択なし'; applyEvPreset(side, '選択なし'); });
    wrap.appendChild(select); wrap.appendChild(btn); panel.appendChild(wrap);
  }
  function applyEvPreset(side, preset){
    ['H','A','B','C','D','S'].forEach(function(k){ var e=q(side+'_'+k+'_ev'); if(e) e.value='0'; });
    if(preset && preset!=='選択なし') preset.split('').forEach(function(k){ var e=q(side+'_'+k+'_ev'); if(e) e.value='32'; });
    // Each EV input has its own companion number-picker <select> (the one actually visible on
    // mobile, since the raw <input> is hidden there) that only re-syncs its displayed value on
    // that specific input's own 'change' event -- dispatching it for just one field (as before)
    // left the other five pickers showing stale values even though the underlying inputs were
    // correctly updated.
    ['H','A','B','C','D','S'].forEach(function(k){ dispatchChange(q(side+'_'+k+'_ev')); });
  }
  function addHpPreset(side, panel){
    var row=make('div','v082h-mini-grid v082h-hp-row');
    var currentHpInput=q(side+'CurrentHp');
    var oldHpTools = currentHpInput ? currentHpInput.closest('.hp-tools') : null;
    moveLabel(side+'CurrentHp', row);
    var btnLabel=document.createElement('label');
    btnLabel.appendChild(document.createTextNode('現HP簡易入力'));
    var buttons=make('div','v082h-hp-buttons');
    [['最大',1],['1/2',2],['1/3',3],['1/4',4]].forEach(function(pair){
      var b=make('button','v082h-ability-chip',pair[0]); b.type='button';
      b.addEventListener('click', function(){ applyHpFraction(side, pair[1]); });
      buttons.appendChild(b);
    });
    btnLabel.appendChild(buttons);
    row.appendChild(btnLabel);
    panel.appendChild(row);
    if(oldHpTools && oldHpTools.parentNode) oldHpTools.parentNode.removeChild(oldHpTools);
  }
  function levelRow(side){
    var input=q(side+'Level'); if(!input) return null;
    var row=make('div','v082h-stat-row');
    row.appendChild(make('span','v082h-stat-label','レベル'));
    var cell=make('span','v082h-stat-cell'); cell.appendChild(input); row.appendChild(cell);
    attachNumberPicker(input, 1, 100);
    return row;
  }
  function addLevelIvFold(side, panel){
    var d=details('レベル・個体値','v082h-details v082h-type-effects',false); panel.appendChild(d);
    var lr=levelRow(side); if(lr) d.appendChild(lr);
    var ivTable=make('div','v082h-stat-table'); d.appendChild(ivTable);
    ivTable.appendChild(statHeader(['H','A','B','C','D','S']));
    ivTable.appendChild(statRow(side,'個体値',['H','A','B','C','D','S'],'iv'));
  }
  function statHeader(stats){ var row=make('div','v082h-stat-row v082h-stat-head'); row.appendChild(make('span','','')); stats.forEach(function(k){ var cell=make('span','',labelStat(k)); cell.setAttribute('data-stat-key', k); row.appendChild(cell); }); return row; }
  function labelStat(k){ return {H:'H',A:'A',B:'B',C:'C',D:'D',S:'S',acc:'命中',eva:'回避',critical:'急所'}[k] || k; }
  function updateNatureStatColors(side){
    var natureSel = q(side+'_nature');
    if(!natureSel || !window.DAMEKE_NATURE) return;
    var pair = window.DAMEKE_NATURE.naturePair({nature: natureSel.value});
    var panel = q('v082hStatsPanel_'+side);
    if(!panel) return;
    panel.querySelectorAll('[data-stat-key]').forEach(function(cell){
      var k = cell.getAttribute('data-stat-key');
      cell.classList.toggle('v082h-stat-boost', k === pair.up);
      cell.classList.toggle('v082h-stat-drop', k === pair.down);
    });
  }
  function attachNumberPicker(input, min, max){
    if(!input || input.getAttribute('data-v082h-picker')) return;
    input.setAttribute('data-v082h-picker', '1');
    var sel = document.createElement('select');
    sel.className = 'v082h-num-picker';
    for(var v=min; v<=max; v++){
      var op = document.createElement('option'); op.value=String(v); op.textContent=String(v);
      sel.appendChild(op);
    }
    sel.value = input.value !== '' ? input.value : String(min);
    sel.addEventListener('change', function(){ input.value = sel.value; dispatchChange(input); });
    input.addEventListener('change', function(){ if(sel.value !== input.value && input.value !== '') sel.value = input.value; });
    if(input.parentNode) input.parentNode.insertBefore(sel, input.nextSibling);
  }
  window.__damekeAttachNumberPicker = attachNumberPicker;
  function statRow(side,label,stats,kind,extraRowClass){ var row=make('div','v082h-stat-row'+(extraRowClass?(' '+extraRowClass):'')); row.appendChild(make('span','v082h-stat-label',label)); stats.forEach(function(k){ var input=(k==='critical') ? q('critical') : q(side+'_'+k+'_'+kind); var cell=make('span','v082h-stat-cell'); if(input){ if(k==='critical') input.classList.remove('v082h-hide'); cell.appendChild(input); var mn=parseInt(input.min,10), mx=parseInt(input.max,10); if(!isNaN(mn) && !isNaN(mx)) attachNumberPicker(input, mn, mx); } else cell.textContent='-'; row.appendChild(cell); }); return row; }

  function setupZones(){
    if(q('v082hMoveDetails')) return;
    var abilityA=q('v082hAttackerAbilityZone'), abilityD=q('v082hDefenderAbilityZone'), itemA=q('v082hAttackerItemZone'), itemD=q('v082hDefenderItemZone'), tera=q('v082hAttackerTeraZone'), move=q('v082hMoveZone'), move2=q('v082hMove2Zone');
    if(abilityA) abilityA.appendChild(zone('v082hAbilityDetails','特性固有条件'));
    if(abilityD) abilityD.appendChild(zone('v082hDefenderAbilityDetails','特性固有条件'));
    if(itemA) itemA.appendChild(zone('v082hItemDetails','持ち物固有条件'));
    if(itemD) itemD.appendChild(zone('v082hDefenderItemDetails','持ち物固有条件'));
    if(tera) tera.appendChild(zone('v082hTeraDetails','テラスタル固有条件'));
    if(move) move.appendChild(zone('v082hMoveDetails','技固有条件'));
    // 技②固有条件も、技①とまったく同じ「該当項目だけが表示されるバブル」にする。
    // 見出しは技①と同じく「技固有条件」とし、「技②」という文言は持たせない。
    if(move2) move2.appendChild(zone('v082hMove2Details','技固有条件'));
    relabelControls(); moveConditionalLabels();
  }
  function move2Id(id){ return 'move2' + id.charAt(0).toUpperCase() + id.slice(1); }
  function relabelControls(){
    var pairs=[['flashFireActivated','ほのお技被弾'],['stakeoutSwitchIn','防御側繰り出し'],['supremeOverlordFaintedAllies','味方ひんし数'],['attackerSlowStart','発動'],['attackerUnburden','発動'],['attackerParadoxBoostStat','上昇する能力値'],['analyzeMovedLast','行動順'],['defenderSlowStart','発動'],['defenderUnburden','発動'],['defenderParadoxBoostStat','上昇する能力値'],['metronomeUseCount','回数'],['attackerStellarMoveCount','ステラ技回数'],['pledgeCombination','コンビネーション'],['psywaveMultiplier','倍率'],['fixedDamageTaken','被ダメ'],['statDroppedThisTurn','自身のランク下降'],['allyFaintedLastTurn','前ターン味方ひんし'],['defenseCurl','まるくなる'],['echoedVoiceCount','回数'],['presentPower','威力'],['magnitudePower','威力'],['roundAllyUsed','同ターン内りんしょう'],['furyCutterCount','回数']];
    pairs.forEach(function(x){ relabel(x[0],x[1]); });
    for(var i=1;i<=5;i++) relabel('beatUpAlly'+i,'控え'+i);
    // 技②側で実際に使われる項目(技の種類だけで表示が決まるもの)は、技①とまったく同じ
    // 短縮ラベルを使う。「技②」の文言はここでは一切付けない。
    var move2Shortened=['statDroppedThisTurn','allyFaintedLastTurn','defenseCurl','echoedVoiceCount','presentPower','magnitudePower','roundAllyUsed','furyCutterCount','supremeOverlordFaintedAllies'];
    pairs.forEach(function(x){ if(move2Shortened.indexOf(x[0])>=0) relabel(move2Id(x[0]), x[1]); });
    for(var j=1;j<=5;j++) relabel('move2BeatUpAlly'+j,'控え'+j);
  }
  function moveConditionalLabels(){
    var ability=q('v082hAbilityDetails'), defAbility=q('v082hDefenderAbilityDetails'), item=q('v082hItemDetails'), tera=q('v082hTeraDetails'), move=q('v082hMoveDetails'), move2=q('v082hMove2Details');
    ['flashFireActivated','stakeoutSwitchIn','supremeOverlordFaintedAllies','attackerSlowStart','attackerUnburden','attackerParadoxBoostStat','analyzeMovedLast'].forEach(function(id){ moveLabel(id, ability); });
    ['defenderSlowStart','defenderUnburden','defenderParadoxBoostStat'].forEach(function(id){ moveLabel(id, defAbility); });
    ['metronomeUseCount','focusLensMoveOrder'].forEach(function(id){ moveLabel(id, item); });
    ['attackerStellarMoveCount'].forEach(function(id){ moveLabel(id, tera); });
    ['pledgeCombination','psywaveMultiplier','kimagureLaserDouble','fixedDamageTaken','statDroppedThisTurn','allyFaintedLastTurn','beatUpAlly1','beatUpAlly2','beatUpAlly3','beatUpAlly4','beatUpAlly5','rolloutHit','defenseCurl','echoedVoiceCount','moveOrder','targetSwitching','faintedAllies','friendship','remainingPP','lastMoveFailed','userDamagedThisTurn','targetDamagedThisTurn','stockpileCount','presentPower','rageFistHitCount','magnitudePower','roundAllyUsed','furyCutterCount','orderUpForm'].forEach(function(id){ moveLabel(id, move); });
    // 技②固有条件: 技①のupdateConditional()のうち、選択中の技そのものに応じて表示が変わる項目
    // (m.powerKind/技名で判定するもの)だけを、技②(move2Select)を基準に複製している。
    ['move2SupremeOverlordFaintedAllies','move2StatDroppedThisTurn','move2AllyFaintedLastTurn','move2BeatUpAlly1','move2BeatUpAlly2','move2BeatUpAlly3','move2BeatUpAlly4','move2BeatUpAlly5','move2RolloutHit','move2DefenseCurl','move2EchoedVoiceCount','move2MoveOrder','move2TargetSwitching','move2FaintedAllies','move2Friendship','move2RemainingPP','move2LastMoveFailed','move2UserDamagedThisTurn','move2TargetDamagedThisTurn','move2StockpileCount','move2PresentPower','move2RageFistHitCount','move2MagnitudePower','move2RoundAllyUsed','move2FuryCutterCount','move2OrderUpForm'].forEach(function(id){ moveLabel(id, move2); });
  }

  function show(id, visible){ var l=labelOf(id); if(l) l.style.display=visible?'':'none'; }
  function detailVisible(id){ var d=q(id); if(!d) return; var visible=false; all('label',d).forEach(function(l){ if(l.style.display!=='none') visible=true; }); d.style.display=visible?'':'none'; if(visible) d.open=true; }
  function selectedMove(){ var D=window.DAMEKE_DATA || {}; return (D.moves||[]).find(function(m){ return m.id===valueOf('moveSelect'); }) || {}; }
  function updateConditional(){
    var m=selectedMove(), move=optionText('moveSelect'), kind=m.powerKind||'', ab=optionText('attackerAbilitySelect'), dab=optionText('defenderAbilitySelect'), item=optionText('attackerItemSelect'), tera=valueOf('attackerTeraType'), tera2=valueOf('move2AttackerTeraType');
    show('flashFireActivated', ab==='もらいび'); show('stakeoutSwitchIn', ab==='はりこみ'); show('supremeOverlordFaintedAllies', ab==='そうだいしょう');
    show('attackerSlowStart', ab==='スロースタート'); show('attackerUnburden', ab==='かるわざ'); show('attackerParadoxBoostStat', ab==='こだいかっせい'||ab==='クォークチャージ'); show('analyzeMovedLast', ab==='アナライズ');
    show('defenderSlowStart', dab==='スロースタート'); show('defenderUnburden', dab==='かるわざ'); show('defenderParadoxBoostStat', dab==='こだいかっせい'||dab==='クォークチャージ');
    // ステラ技回数はテラスタル自体は技①・技②で別フィールドだが、この項目自体は共有のまま
    // (このタスクの対象外)なので、どちらかがステラであれば表示する。
    show('metronomeUseCount', item==='メトロノーム'); show('focusLensMoveOrder', item==='フォーカスレンズ'); show('attackerStellarMoveCount', tera==='ステラ'||tera2==='ステラ');
    show('pledgeCombination', ['くさのちかい','ほのおのちかい','みずのちかい','クロスサンダー','クロスフレイム'].indexOf(move)>=0);
    show('psywaveMultiplier', move==='サイコウェーブ'); show('kimagureLaserDouble', move==='きまぐレーザー'); show('fixedDamageTaken', ['カウンター','ミラーコート','がまん','メタルバースト','ほうふく'].indexOf(move)>=0);
    show('statDroppedThisTurn', move==='うっぷんばらし'); show('allyFaintedLastTurn', move==='かたきうち'); var beat=move==='ふくろだたき'||kind==='BeatUp'; for(var i=1;i<=5;i++) show('beatUpAlly'+i, beat);
    show('rolloutHit', kind==='Rollout'); show('defenseCurl', kind==='Rollout'); show('echoedVoiceCount', kind==='EchoedVoice'); show('moveOrder', kind==='DoubleIfFirst'||kind==='DoubleIfMovedSecond'||move==='コアパニッシャー'); show('targetSwitching', kind==='Pursuit'); show('faintedAllies', kind==='LastRespects'); show('friendship', kind==='Friendship'||kind==='Frustration'); show('remainingPP', kind==='TrumpCard'); show('lastMoveFailed', kind==='DoubleIfLastMoveFailed'); show('userDamagedThisTurn', kind==='DoubleIfUserDamaged'); show('targetDamagedThisTurn', kind==='DoubleIfTargetDamaged'); show('stockpileCount', kind==='SpitUp'); show('presentPower', kind==='Present'); show('rageFistHitCount', kind==='RageFist'); show('magnitudePower', kind==='Magnitude'); show('roundAllyUsed', kind==='Round'); show('furyCutterCount', kind==='FuryCutter'); show('orderUpForm', move==='いっちょうあがり');
    ['v082hAbilityDetails','v082hDefenderAbilityDetails','v082hItemDetails','v082hDefenderItemDetails','v082hTeraDetails','v082hMoveDetails'].forEach(detailVisible);
  }

  // 技②固有条件: 技①のupdateConditional()のうち、選択中の技そのものに応じて表示が変わる項目
  // (m.powerKind/技名で判定するもの)だけを、技②(move2Select)を基準に複製している。
  // 特性・持ち物・テラスタルに応じて表示が変わる項目(そうだいしょう味方ひんし数を含む)は
  // 攻撃側が技①・技②を通じて共通のため複製せず、技①側のものをそのまま使う。
  function selectedMove2(){ var D=window.DAMEKE_DATA || {}; return (D.moves||[]).find(function(m){ return m.id===valueOf('move2Select'); }) || {}; }
  function updateConditional2(){
    if(!q('move2Select')) return;
    var m=selectedMove2(), move=optionText('move2Select'), kind=m.powerKind||'', ab=optionText('attackerAbilitySelect');
    show('move2SupremeOverlordFaintedAllies', ab==='そうだいしょう');
    show('move2StatDroppedThisTurn', move==='うっぷんばらし'); show('move2AllyFaintedLastTurn', move==='かたきうち'); var beat2=move==='ふくろだたき'||kind==='BeatUp'; for(var i=1;i<=5;i++) show('move2BeatUpAlly'+i, beat2);
    show('move2RolloutHit', kind==='Rollout'); show('move2DefenseCurl', kind==='Rollout'); show('move2EchoedVoiceCount', kind==='EchoedVoice'); show('move2MoveOrder', kind==='DoubleIfFirst'||kind==='DoubleIfMovedSecond'||move==='コアパニッシャー'); show('move2TargetSwitching', kind==='Pursuit'); show('move2FaintedAllies', kind==='LastRespects'); show('move2Friendship', kind==='Friendship'||kind==='Frustration'); show('move2RemainingPP', kind==='TrumpCard'); show('move2LastMoveFailed', kind==='DoubleIfLastMoveFailed'); show('move2UserDamagedThisTurn', kind==='DoubleIfUserDamaged'); show('move2TargetDamagedThisTurn', kind==='DoubleIfTargetDamaged'); show('move2StockpileCount', kind==='SpitUp'); show('move2PresentPower', kind==='Present'); show('move2RageFistHitCount', kind==='RageFist'); show('move2MagnitudePower', kind==='Magnitude'); show('move2RoundAllyUsed', kind==='Round'); show('move2FuryCutterCount', kind==='FuryCutter'); show('move2OrderUpForm', move==='いっちょうあがり');
    // 技①の技固有条件バブルと同じく、該当項目が1つもなければバブルごと隠す。
    detailVisible('v082hMove2Details');
  }

  function findSectionByTitle(title){
    return all('.input-card > .sub-card').find(function(s){ var h=s.querySelector('h3'); return h && h.textContent===title; });
  }
  function convertToDetails(section, title, cls){
    if(!section) return null;
    var d=details(title, cls||'sub-card v082h-section-details', false);
    Array.prototype.slice.call(section.childNodes).forEach(function(n){ if(n.nodeName!=='H3') d.appendChild(n); });
    section.parentNode.replaceChild(d, section);
    return d;
  }
  function forceCols(el, cols){
    if(!el) return;
    el.classList.toggle('v082h-cond-grid-cols-4', Number(cols) === 4);
  }
  function buildDoubleFold(container, ids, cols){
    var d=details('ダブル','v082h-details v082h-section-details v082h-double-fold',false);
    var inner=document.createElement('div');
    inner.className='v082h-cond-grid';
    forceCols(inner, cols||2);
    ids.forEach(function(id){ moveLabel(id, inner); });
    d.appendChild(inner);
    container.appendChild(d);
    return d;
  }
  function buildConditionDetails(title, ids, doubleIds){
    var section=findSectionByTitle(title);
    if(!section) return null;
    var sideClass=title==='攻撃側条件'?' v082h-attacker':(title==='防御側条件'?' v082h-defender':'');
    var d=details(title,'sub-card v082h-section-details'+sideClass,false);
    var mainGrid=document.createElement('div');
    mainGrid.className='v082h-cond-grid';
    forceCols(mainGrid, 2);
    ids.forEach(function(id){ moveLabel(id, mainGrid); });
    d.appendChild(mainGrid);
    if(doubleIds && doubleIds.length) buildDoubleFold(d, doubleIds, 2);
    if(section.parentNode) section.parentNode.replaceChild(d, section);
    return d;
  }

  function restructureConditions(){
    var field=convertToDetails(findSectionByTitle('場'),'場','sub-card v082h-section-details');
    // 天候・フィールドを変える特性の自動反映(v2.2.0)が、この折り畳み(details)自体を開けるよう公開する。
    window.__damekeFieldFoldDetails = field;

    var atk=buildConditionDetails('攻撃側条件',
      ['attackerStatus','attackerToxicCount','attackerEmbargo','attackerStealthRock','attackerSpikes','attackerSteelSurge','electrify','plasmaShower','charge','meFirst','attackerIngrain','attackerRootedSmacked','attackerMagnetRise','attackerTelekinesis','attackerBodyPurge','attackerTailwind','attackerGMaxRapidStrike','attackerFocusEnergy','attackerLockOn','attackerMicleBerry'],
      ['attackerDoubleDamage','helpingHandCount','powerSpotSupport','batterySupport','flowerGiftSupport','plusMinusSupport','steelSpiritCount','attackerSwamp','attackerRainbow','attackerVictoryStar']);

    relabel('defenderSemiInvulnerable','姿を隠す');
    relabel('defenderProtectState','まもる');
    var def=buildConditionDetails('防御側条件',
      ['defenderStatus','defenderToxicCount','defenderConfusion','defenderSubstitute','defenderEmbargo','defenderStealthRock','defenderSpikes','defenderSteelSurge','defenderScreen','defenderTarShot','defenderLuckyChant','defenderGlaiveRush','defenderMinimized','defenderSemiInvulnerable','defenderProtectState','defenderIngrain','defenderRootedSmacked','defenderMagnetRise','defenderTelekinesis','defenderForesight','defenderMiracleEye','defenderBodyPurge','defenderTailwind'],
      ['defenderFlowerGiftSupport','defenderFriendGuard','defenderSwamp','defenderSeaOfFire']);

    if(field){
      buildDoubleFold(field, ['darkAuraField','fairyAuraField','vesselOfRuinField','beadsOfRuinField','swordOfRuinField','tabletsOfRuinField','weatherSuppressField','neutralizingGasField'], 4);
    }

    if(atk && def && atk.parentNode){
      var wrap=make('div','v082h-cond-wrap-outer');
      atk.parentNode.insertBefore(wrap, atk);
      wrap.appendChild(buildSideTabs());
      var condWrap=make('div','v082h-cond-wrap');
      wrap.appendChild(condWrap);
      condWrap.appendChild(atk); condWrap.appendChild(def);
      var syncingOpen=false;
      atk.addEventListener('toggle', function(){ if(syncingOpen) return; syncingOpen=true; def.open=atk.open; syncingOpen=false; });
      def.addEventListener('toggle', function(){ if(syncingOpen) return; syncingOpen=true; atk.open=def.open; syncingOpen=false; });
    }

    var moveSpecific=findSectionByTitle('技固有条件');
    if(moveSpecific) moveSpecific.classList.add('v082h-hide');
  }

  // Every input whose state should swap sides symmetrically. Left column is the attacker-side id,
  // right column is its defender-side counterpart. Kept as a flat list (not nested per-category)
  // so audit/testing can iterate it directly; see the chat report for the full classification.
  const SYMMETRIC_PAIRS = [
    ['attackerSelect','defenderSelect'], ['attackerLevel','defenderLevel'],
    ['attackerSpecialState','defenderSpecialState'], ['attackerTeraType','defenderTeraType'],
    ['attackerSexSelect','defenderSexSelect'], // the field genderValue() actually reads; the static
    // attackerGender/defenderGender selects are dead UI (unused by buildOptions) and are left alone.
    ['attackerType1','defenderType1'], ['attackerType2','defenderType2'],
    ['attackerTypeOverride','defenderTypeOverride'], ['attackerAddType','defenderAddType'],
    ['attackerItemSelect','defenderItemSelect'], ['attackerNoItem','defenderNoItem'],
    ['attackerAbilitySelect','defenderAbilitySelect'], ['attackerNoAbility','defenderNoAbility'],
    ['attackerCurrentHp','defenderCurrentHp'], ['attackerStatus','defenderStatus'], ['attackerToxicCount','defenderToxicCount'],
    ['attackerEmbargo','defenderEmbargo'], ['attackerStealthRock','defenderStealthRock'],
    ['attackerSpikes','defenderSpikes'], ['attackerSteelSurge','defenderSteelSurge'],
    ['attackerTailwind','defenderTailwind'], ['attackerSwamp','defenderSwamp'],
    ['attackerSlowStart','defenderSlowStart'], ['attackerUnburden','defenderUnburden'],
    ['attackerParadoxBoostStat','defenderParadoxBoostStat'],
    ['attackerIngrain','defenderIngrain'], ['attackerRootedSmacked','defenderRootedSmacked'], ['attackerMagnetRise','defenderMagnetRise'],
    ['attackerTelekinesis','defenderTelekinesis'], ['attackerRoost','defenderRoost'],
    ['attackerBurnUp','defenderBurnUp'], ['attackerDoubleShock','defenderDoubleShock'],
    ['attackerBodyPurge','defenderBodyPurge'],
    ['v082hEvPreset_attacker','v082hEvPreset_defender'], // the quick-preset dropdown's own displayed
    // selection isn't derived from the EV values -- it's independent "what was last picked" state,
    // so it needs its own explicit swap entry alongside the underlying EV inputs above.
  ];
  function statSymmetricPairs(){
    var out = [];
    var keys = window.__damekeStatKeys || ['H','A','B','C','D','S','acc','eva'];
    var idFn = window.__damekeStatInputId || function(side,key,kind){ return side+'_'+key+'_'+kind; };
    keys.forEach(function(key){
      if(key !== 'acc' && key !== 'eva') out.push([idFn('attacker',key,'iv'), idFn('defender',key,'iv')]);
      if(key !== 'acc' && key !== 'eva') out.push([idFn('attacker',key,'ev'), idFn('defender',key,'ev')]);
      if(key !== 'H') out.push([idFn('attacker',key,'rank'), idFn('defender',key,'rank')]);
    });
    out.push(['attacker_nature','defender_nature']);
    return out;
  }
  // Role-only conditions: these have no symmetric counterpart, so instead of leaving them
  // untouched (which would let one pokemon's leftover attacker-only settings silently carry over
  // to whichever unrelated pokemon takes the attacker role next), each swap stashes the outgoing
  // side's values into a shadow slot and restores whatever was stashed there last time -- so the
  // visible fields always reflect "this role's own history", not whichever pokemon is unrelated.
  const ATTACKER_ROLE_ONLY_IDS = ['moveSelect','moveShowAll','critical','attackerCriticalForce',
    'move2Select','move2ShowAll','move2CriticalForce','move2RolloutHit','move2DefenseCurl','move2EchoedVoiceCount','move2MoveOrder','move2TargetSwitching','move2FaintedAllies','move2SupremeOverlordFaintedAllies','move2Friendship','move2RemainingPP','move2LastMoveFailed','move2UserDamagedThisTurn','move2TargetDamagedThisTurn','move2StockpileCount','move2PresentPower','move2RageFistHitCount','move2MagnitudePower','move2RoundAllyUsed','move2FuryCutterCount','move2StatDroppedThisTurn','move2AllyFaintedLastTurn','move2BeatUpAlly1','move2BeatUpAlly2','move2BeatUpAlly3','move2BeatUpAlly4','move2BeatUpAlly5',
    'attackerFocusEnergy','attackerGMaxRapidStrike','attackerLockOn','attackerMicleBerry','attackerVictoryStar','attackerStellarMoveCount','charge','pledgeCombination','meFirst','helpingHandCount','batterySupport','powerSpotSupport','flowerGiftSupport','plusMinusSupport','flashFireActivated','stakeoutSwitchIn','attackerDoubleDamage','metronomeUseCount','focusLensMoveOrder','steelSpiritCount','analyzeMovedLast','supremeOverlordFaintedAllies','beatUpAlly1','beatUpAlly2','beatUpAlly3','beatUpAlly4','beatUpAlly5','allyFaintedLastTurn','defenseCurl','echoedVoiceCount','moveOrder','targetSwitching','faintedAllies','friendship','remainingPP','lastMoveFailed','userDamagedThisTurn','targetDamagedThisTurn','stockpileCount','presentPower','rageFistHitCount','magnitudePower','roundAllyUsed','furyCutterCount','psywaveMultiplier','kimagureLaserDouble','fixedDamageTaken','statDroppedThisTurn','electrify','orderUpForm','move2OrderUpForm','attackerRainbow'];
  const DEFENDER_ROLE_ONLY_IDS = ['defenderConfusion','defenderForesight','defenderMiracleEye','defenderTarShot','defenderScreen','defenderFriendGuard','defenderMinimized','defenderProtectState','defenderSemiInvulnerable','defenderGlaiveRush','defenderFlowerGiftSupport','defenderSubstitute','defenderLuckyChant','protect','defenderSeaOfFire'];
  var attackerRoleShadow = {};
  var defenderRoleShadow = {};
  function swapWithShadow(ids, shadow){
    ids.forEach(function(id){
      var elm = q(id);
      if(!elm) return;
      var current = readField(elm);
      if(Object.prototype.hasOwnProperty.call(shadow, id)) writeField(elm, shadow[id]);
      shadow[id] = current;
    });
  }
  function readField(elm){ if(!elm) return undefined; return elm.type==='checkbox' ? elm.checked : elm.value; }
  function writeField(elm, v){ if(!elm || v===undefined) return; if(elm.type==='checkbox') elm.checked = v; else elm.value = v; }
  // 技①⇔技②の入替: 技そのものと、技①/技②それぞれが独立に持つ「全技」「急所」「技固有条件」を
  // まとめて入れ替える。天候・場・攻撃側/防御側のステータスや持ち物・特性など、技①技②で
  // 共通の条件はここでは一切触らない(同じ条件のまま技だけ入れ替わる)。
  const MOVE_ORDER_SWAP_PAIRS = [
    ['moveSelect','move2Select'], ['moveShowAll','move2ShowAll'], ['attackerCriticalForce','move2CriticalForce'],
    // Z・ダイマ/テラスタルも技①・技②それぞれ専用のフィールドを持つため、技順序入替の対象に含める。
    // Z・ダイマ側は「専用Z」の選択肢が選択中の技に依存するため、下のswapMoveOrder()内で技本体の
    // 入替と同様にオプション再構築後まで遅延させる(ここでは通常のペアとして列挙するだけ)。
    ['attackerSpecialState','move2AttackerSpecialState'], ['attackerTeraType','move2AttackerTeraType'],
    ['rolloutHit','move2RolloutHit'], ['defenseCurl','move2DefenseCurl'], ['echoedVoiceCount','move2EchoedVoiceCount'],
    ['moveOrder','move2MoveOrder'], ['targetSwitching','move2TargetSwitching'], ['faintedAllies','move2FaintedAllies'],
    ['supremeOverlordFaintedAllies','move2SupremeOverlordFaintedAllies'], ['friendship','move2Friendship'],
    ['remainingPP','move2RemainingPP'], ['lastMoveFailed','move2LastMoveFailed'],
    ['userDamagedThisTurn','move2UserDamagedThisTurn'], ['targetDamagedThisTurn','move2TargetDamagedThisTurn'],
    ['stockpileCount','move2StockpileCount'], ['presentPower','move2PresentPower'],
    ['rageFistHitCount','move2RageFistHitCount'], ['magnitudePower','move2MagnitudePower'],
    ['roundAllyUsed','move2RoundAllyUsed'], ['furyCutterCount','move2FuryCutterCount'],
    ['statDroppedThisTurn','move2StatDroppedThisTurn'], ['allyFaintedLastTurn','move2AllyFaintedLastTurn'],
    ['beatUpAlly1','move2BeatUpAlly1'], ['beatUpAlly2','move2BeatUpAlly2'], ['beatUpAlly3','move2BeatUpAlly3'],
    ['beatUpAlly4','move2BeatUpAlly4'], ['beatUpAlly5','move2BeatUpAlly5'],
    ['orderUpForm','move2OrderUpForm']
  ];
  // 技②が「なし」のときは入れ替える技が存在しないため、ボタン自体を押せなくする。
  function updateMoveOrderSwapButton(){
    var btn=q('moveOrderSwapButton');
    if(!btn) return;
    var none = window.__damekeIsMove2None ? window.__damekeIsMove2None() : false;
    btn.disabled = !!none;
  }
  window.__damekeUpdateMoveOrderSwapButton = updateMoveOrderSwapButton;
  function swapMoveOrder(){
    // 技②が「なし」のときは入れ替える対象がないため、ボタンが無効化されているはずだが、
    // 念のためここでも二重にガードしておく。
    if(window.__damekeIsMove2None && window.__damekeIsMove2None()) return;
    // 「技①/技②」それぞれの選択欄は、「全技」チェックボックスの状態によっては
    // 覚えている技だけに絞り込まれている場合がある。技そのもの(moveSelect/move2Select)を
    // 先に入れ替えてしまうと、入れ替え先の<select>にまだ存在しない技IDを直接.valueへ
        // 書き込むことになり、ブラウザ側でその代入が無視されて値が失われてしまう
    // (技固有条件が消え、選択欄が一番上の技に戻って見えるのはこのため)。
    // そこで、「全技」チェックボックスを含む他の項目を先に入れ替え、それを反映して
    // 両方の選択肢を作り直してから、最後に技そのものの値を入れ替える。
    var snapshot = MOVE_ORDER_SWAP_PAIRS.map(function(p){
      var ea=q(p[0]), eb=q(p[1]);
      return {ea:ea, eb:eb, av: ea?readField(ea):undefined, bv: eb?readField(eb):undefined};
    });
    var moveEntry=null;
    // Z・ダイマ(attackerSpecialState)も、「専用Z」の選択肢が選択中の技に依存するという点で
    // moveSelect/move2Selectと同じ制約を持つ(入替先にまだ存在しない値を直接書き込むと消える)。
    // そのため技本体と同様、両方の技が入れ替わった後で選択肢を作り直してから値を入れ替える。
    var specialStateEntry=null;
    snapshot.forEach(function(s){
      if(!s.ea || !s.eb) return;
      if(s.ea.id==='moveSelect'){ moveEntry=s; return; }
      if(s.ea.id==='attackerSpecialState'){ specialStateEntry=s; return; }
      writeField(s.ea, s.bv); writeField(s.eb, s.av);
    });
    if(window.__damekeApplyMoveFilter) window.__damekeApplyMoveFilter();
    if(window.__damekeApplyMoveFilter2) window.__damekeApplyMoveFilter2();
    if(moveEntry){ writeField(moveEntry.ea, moveEntry.bv); writeField(moveEntry.eb, moveEntry.av); }
    var moveEl=q('moveSelect'); if(moveEl && moveEl._v082hRefreshOptions) moveEl._v082hRefreshOptions();
    var move2El=q('move2Select'); if(move2El && move2El._v082hRefreshOptions) move2El._v082hRefreshOptions();
    // 技本体が入れ替わった後の新しい技①/技②を基準に「専用Z」の選択肢を作り直してから、
    // Z・ダイマの値そのものを入れ替える。
    if(window.__damekeUpdateSpecialStateOptions) window.__damekeUpdateSpecialStateOptions();
    if(specialStateEntry){ writeField(specialStateEntry.ea, specialStateEntry.bv); writeField(specialStateEntry.eb, specialStateEntry.av); }
    if(window.__damekeUpdateAttackerTeraExclusivity) window.__damekeUpdateAttackerTeraExclusivity();
    updateMoveOrderSwapButton();
    // 技①(moveSelect)の値は入れ替え後も直接DOM操作で書き換えているだけで change イベントを
    // 発火させていない(発火させると入力途中の他の値まで巻き込んで再計算が走ってしまう箇所が
    // あるため、他の操作と同様ここでも意図的にdispatchしていない)。そのため、ダメージ計算
    // 本体(calculate())を明示的に呼び直さないと、入れ替え後も画面には入れ替え前の技での
    // 計算結果が残ったままになってしまう。
    if(window.__damekeCalculate) window.__damekeCalculate();
    refreshAll();
  }
  function swapSides(){
    // Z・ダイマ/テラスタルは技①・技②それぞれ専用のフィールドを持つが、攻防交代先の防御側は
    // 単一フィールドしか持たない。攻防交代で使う攻撃側の代表値は、技①・技②のどちらかに指定が
    // あればそれを使う(現行の単一フィールド運用と同じ扱いにする、というルールに従う)。
    // ルール1(テラスタルの相互排他)によりどちらを優先しても通常は同じ結果になる。
    var canonicalSpecialState = window.__damekeCanonicalAttackerSpecialState ? window.__damekeCanonicalAttackerSpecialState() : (q('attackerSpecialState')?readField(q('attackerSpecialState')):'none');
    var canonicalTeraType = window.__damekeCanonicalAttackerTeraType ? window.__damekeCanonicalAttackerTeraType() : (q('attackerTeraType')?readField(q('attackerTeraType')):'なし');
    var elAttackerSpecialState=q('attackerSpecialState'), elAttackerTeraType=q('attackerTeraType');
    // 技①・技②のテラスタル欄は選択肢が絞り込まれている場合があるため、これから行う一連の
    // 直接代入(このあとのcanonical値の書き込み、SYMMETRIC_PAIRSでのattackerTeraType<->
    // defenderTeraType入替、技②欄への反映)が絞り込みによって無視されないよう、先に全タイプへ
    // 選択肢を戻しておく。最後にupdateAttackerTeraExclusivity()で正しく絞り込み直す。
    if(window.__damekeWidenAttackerTeraOptions) window.__damekeWidenAttackerTeraOptions();
    if(elAttackerSpecialState) writeField(elAttackerSpecialState, canonicalSpecialState);
    if(elAttackerTeraType) writeField(elAttackerTeraType, canonicalTeraType);

    var pairs = SYMMETRIC_PAIRS.concat(statSymmetricPairs());
    // 1) Snapshot every symmetric pair's current value up front, so writing side A doesn't affect
    //    the value read for side B later in the same pass.
    var snapshot = pairs.map(function(p){ return [q(p[0]), q(p[1]), readField(q(p[0])), readField(q(p[1]))]; });
    // 2) Write the swap in one pass.
    snapshot.forEach(function(s){
      var ea=s[0], eb=s[1], av=s[2], bv=s[3];
      if(!ea || !eb) return;
      writeField(ea, bv); writeField(eb, av);
    });
    // 2.5) 既知の不具合の修正: Zワザ/専用Zは防御側のセレクトに該当<option>が存在しないため、
    // そのまま防御側へ書き込むと値が空欄になってしまう。防御側に着地した値がZワザ/専用Z
    // (またはそれに起因する空欄)であれば、強制的に「なし」にする。
    var defenderSpecialStateEl = q('defenderSpecialState');
    if(defenderSpecialStateEl){
      var landedState = ((window.DAMEKE_DATA||{}).specialStates||[]).find(function(x){ return x.id===defenderSpecialStateEl.value; });
      if(!landedState || landedState.kind==='zmove' || landedState.kind==='special_z') defenderSpecialStateEl.value='none';
    }
    // 攻防交代前の防御側は単一フィールドしか持たなかったため、新しい攻撃側(技①用フィールドが
    // 引き継いだ値)を、技②用フィールドにもそのまま反映して技①・技②を揃える。
    var move2AttackerSpecialStateEl = q('move2AttackerSpecialState');
    if(move2AttackerSpecialStateEl && elAttackerSpecialState) move2AttackerSpecialStateEl.value = elAttackerSpecialState.value;
    var move2AttackerTeraTypeEl = q('move2AttackerTeraType');
    if(move2AttackerTeraTypeEl && elAttackerTeraType) move2AttackerTeraTypeEl.value = elAttackerTeraType.value;
    // 3) transformOps: only the role-relative Power Trick operations flip; powerShare/guardShare/
    //    speedSwap/wonderRoom act on both sides already and keep their position and identity.
    //    transformOps itself lives in a different closure (IIFE #1) -- mutate the array in place
    //    via the exposed getter rather than reassigning, so the change is visible there too.
    var ops = window.__damekeGetTransformOps ? window.__damekeGetTransformOps() : null;
    if(ops){
      for(var i=0;i<ops.length;i++){
        if(ops[i]==='attackerPowerTrick') ops[i]='defenderPowerTrick';
        else if(ops[i]==='defenderPowerTrick') ops[i]='attackerPowerTrick';
      }
    }
    if(window.__damekeUpdateOpsDisplay) window.__damekeUpdateOpsDisplay();
    // Role-only conditions: swap each side's visible values with what's stashed in its shadow
    // (see ATTACKER_ROLE_ONLY_IDS/DEFENDER_ROLE_ONLY_IDS above) instead of leaving them as-is.
    swapWithShadow(ATTACKER_ROLE_ONLY_IDS, attackerRoleShadow);
    swapWithShadow(DEFENDER_ROLE_ONLY_IDS, defenderRoleShadow);
    // 4) Sync display-only state that mirrors the swapped selects (search-box text, ability
    //    chips) WITHOUT dispatching 'change' -- a real 'change' event on attacker/defenderSelect
    //    would run the species-default handler (setTypeDefaults) and overwrite the type values
    //    we just swapped in step 2.
    ['attackerSelect','defenderSelect','attackerItemSelect','defenderItemSelect','attackerAbilitySelect','defenderAbilitySelect','moveSelect'].forEach(function(id){
      var elm = q(id);
      if(elm && elm._v082hRefreshOptions) elm._v082hRefreshOptions();
    });
    if(window.__damekeApplyMoveFilter) window.__damekeApplyMoveFilter(); // new attacker's learnset may differ
    // moveSelect/move2Select(技①/技②の役割固有シャドー入替、上のswapWithShadow)が確定した後で、
    // 新しい攻撃側・新しい技①/技②を基準にZ・ダイマの選択肢(専用Zの有無)を作り直す。
    if(window.__damekeUpdateSpecialStateOptions) window.__damekeUpdateSpecialStateOptions();
    if(window.__damekeUpdateAttackerTeraExclusivity) window.__damekeUpdateAttackerTeraExclusivity();
    if(window.__damekeUpdateTypeColors) window.__damekeUpdateTypeColors();
    refreshAll(); // rebuilds ability chips for both sides + re-renders the last computed result
    // swapSides はタイプ上書きを守るため attacker/defenderSelect に 'change' を発火しない。
    // そのため、'change' 頼みで再描画しているフォルムチェンジボタン(v091)がそのままでは
    // 攻防交代前の状態を表示し続けてしまう -- 直接再描画を呼んで同期する。
    if(window.__damekeRenderFormButtons) window.__damekeRenderFormButtons();
    if(window.__damekeCalculate) window.__damekeCalculate(); // the one recalculation for this swap
  }

  // 技威力(N46 変動後威力)の表示文字列を、result.trace(構造化データ、findTraceEntryで
  // renderCalcTable自身が特性/持ち物などを読むのと同じ経路)から直接組み立てる。#trace等の
  // 描画済みテキスト<pre>を読み返すことはしない -- そちらは単なる出力であり、参照元にはしない。
  // traceOverride: updateMove2StandaloneSectionが分岐幅を仮のtrace値として詰め替えたクローン
  // (renderResult2)がある場合はそちらを渡す。
  function powerTextFor(result){
    if(!result) return '-';
    var line = window.__damekeFindTraceEntry(result.trace, '変動後威力');
    var txt = line ? String(line.value) : '';
    if(txt==='-') return '-';
    var nums=[], re=/(\d+)回目=([0-9]+)/g, m;
    while((m=re.exec(txt))) nums.push({idx:m[1], val:m[2]});
    if(nums.length){
      if(nums.length===1) return nums[0].val;
      var moveEntry = window.__damekeFindTraceEntry(result.trace, '技名変換');
      var moveNameNow = moveEntry ? String(moveEntry.value||'') : '';
      var abilityEntry = window.__damekeFindTraceEntry(result.trace, '特性（攻撃側）');
      var isParental = !!abilityEntry && abilityEntry.name==='おやこあい' && abilityEntry.value==='有効';
      var variableMoves = ['ふくろだたき', 'トリプルキック', 'トリプルアクセル'];
      var isVariable = variableMoves.indexOf(moveNameNow) >= 0 || isParental;
      if(!isVariable) return nums[0].val;
      return nums.map(function(n){ return n.idx+'回目='+n.val; }).join('/');
    }
    // 技②(結果枠)で、防御側の残りHPによって威力が変わる技の分岐幅を "X～Y（分岐幅）" の
    // 形で仮のtraceエントリに詰めている場合(updateMove2StandaloneSection参照)は、それを
    // 単一数値パースより先に拾って範囲表示のまま使う。
    var rangeM = txt.match(/([0-9]+)～([0-9]+)（分岐幅）/);
    if(rangeM) return rangeM[1]+'～'+rangeM[2];
    if(/^[0-9]+$/.test(txt)) return txt;
    return '-';
  }
  function statText(side, key, kind) { var el = q(side+'_'+key+'_'+kind); return el ? el.value : ''; }
  function natureText(side) { var el = q(side+'_nature'); if (!el) return ''; var opt = el.options[el.selectedIndex]; return opt ? opt.textContent : ''; }
  // labelKeyのtraceエントリのnote(例:「物理: 攻撃側ランク補正込みA参照」)から、イカサマ・
  // ボディプレス等で参照先ステータスが入れ替わっている場合を構造化データのまま検出する。
  function statRefFor(labelKey, fallbackSide, fallbackKey, result) {
    var entry = window.__damekeFindTraceEntry(result ? result.trace : null, labelKey);
    var noteText = entry ? String(entry.note||'') : '';
    var m = noteText.match(/(攻撃側|防御側)ランク補正込み([ABCD])参照/);
    if (m) return { side: m[1]==='攻撃側' ? 'attacker' : 'defender', key: m[2] };
    return { side: fallbackSide, key: fallbackKey };
  }
  function hpColorClass(remainHp, maxHp) {
    if (remainHp <= 0) return 'v082h-hp-faint';
    var half = Math.floor(maxHp / 2), quarter = Math.floor(maxHp / 4);
    if (remainHp > half) return 'v082h-hp-green';
    if (remainHp > quarter) return 'v082h-hp-yellow';
    return 'v082h-hp-red';
  }
  // For forms whose sprite likely doesn't exist yet (very new/rare Terastal or transformed
  // states), fall back to showing the pre-transformation form instead of nothing.
  var PRE_TRANSFORM_FALLBACK = {
    'ネクロズマ(たそがれのたてがみ(ウルトラネクロズマ))':'ネクロズマ(たそがれのたてがみ)',
    'ネクロズマ(あかつきのつばさ(ウルトラネクロズマ))':'ネクロズマ(あかつきのつばさ)',
    'テラパゴス(テラスタル)':'テラパゴス',
    'オーガポン(いしずえ)':'オーガポン(みどり)',
    'オーガポン(いど)':'オーガポン(みどり)',
    'オーガポン(かまど)':'オーガポン(みどり)',
  };
  // Builds an <img> with the app's full 3-step sprite fallback chain (primary sprite -> Pokemon
  // HOME render -> a pre-transformation form's sprite, for the handful of forms hardcoded above)
  // wired up via onerror, and calls onAllFailed() once every step has been exhausted. This used
  // to live only inside the calculator's own buildPokemonThumb, so every other tool's thumbnail
  // only ever tried the first step -- exposed here so they can all share the identical chain
  // instead of drifting out of sync with each other.
  function buildPokemonImageEl(japaneseName, onAllFailed, opts){
    var map = window.DAMEKE_POKEMON_IMAGE_IDS;
    var numId = map ? map[japaneseName] : null;
    if(!numId && PRE_TRANSFORM_FALLBACK[japaneseName]){
      numId = map ? map[PRE_TRANSFORM_FALLBACK[japaneseName]] : null;
    }
    if(!numId) return null;
    var img = document.createElement('img');
    if(opts && opts.crossOrigin) img.crossOrigin = opts.crossOrigin; // must be set before src
    var primaryUrl = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/' + numId + '.png';
    var fallbackUrl = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/' + numId + '.png';
    var preTransformId = PRE_TRANSFORM_FALLBACK[japaneseName] && map ? map[PRE_TRANSFORM_FALLBACK[japaneseName]] : null;
    img.src = primaryUrl;
    img.alt = japaneseName;
    img.loading = 'lazy';
    img.onerror = function(){
      if(!img.dataset.triedFallback){
        img.dataset.triedFallback = '1';
        img.src = fallbackUrl;
        return;
      }
      if(!img.dataset.triedPreTransform && preTransformId && preTransformId !== numId){
        img.dataset.triedPreTransform = '1';
        img.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/' + preTransformId + '.png';
        return;
      }
      if(onAllFailed) onAllFailed();
    };
    return img;
  }
  window.__damekeBuildPokemonImage = buildPokemonImageEl;

  // 持ち物画像: ポケモン画像と同じロジックで、日本語名からPokeAPIの英語スラッグを引いて
  // スプライトを組み立てる。PokeAPI側に対応するスラッグが見つからない持ち物(このアプリ独自の
  // メガストーン等、実際のゲームに存在しない持ち物を含む)は、単純に画像なし(枠を空にする)。
  function buildItemImageEl(japaneseName, onAllFailed){
    var map = window.DAMEKE_ITEM_IMAGE_SLUGS;
    var slug = map ? map[japaneseName] : null;
    if(!slug) return null;
    var img = document.createElement('img');
    img.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/' + slug + '.png';
    img.alt = japaneseName;
    img.loading = 'lazy';
    img.onerror = function(){ if(onAllFailed) onAllFailed(); };
    return img;
  }
  window.__damekeBuildItemImage = buildItemImageEl;
  function itemNameForSide(side){
    var sel = q(side + 'ItemSelect');
    if(!sel) return '';
    var opt = sel.options[sel.selectedIndex];
    return opt ? (opt.textContent || opt.value) : '';
  }
  function buildPokemonThumb(japaneseName, side, itemName) {
    var group = make('div', 'v082h-pokemon-thumb-group');
    var wrap = make('div', 'v082h-pokemon-thumb v082h-pokemon-thumb-' + side);
    var img = buildPokemonImageEl(japaneseName, function(){
      wrap.classList.add('v082h-pokemon-thumb-missing'); wrap.innerHTML = '';
    });
    if(img) wrap.appendChild(img);
    else wrap.classList.add('v082h-pokemon-thumb-missing');
    group.appendChild(wrap);
    if(itemName && itemName !== 'なし'){
      var itemWrap = make('div', 'v082h-item-thumb');
      var itemImg = buildItemImageEl(itemName, function(){
        itemWrap.classList.add('v082h-item-thumb-missing'); itemWrap.innerHTML = '';
      });
      if(itemImg) itemWrap.appendChild(itemImg);
      else itemWrap.classList.add('v082h-item-thumb-missing');
      group.appendChild(itemWrap);
    }
    return group;
  }
  // minRemain/maxRemainという名前だが、値の大小関係は逆(minRemain=最小ダメージ側=残りHPが
  // 最も多い側、maxRemain=最大ダメージ側=残りHPが最も少ない側)であることに注意 -- 呼び出し側は
  // 必ずこの並びで渡すこと(逆に渡すと乱数幅のセグメントが常に幅0になる)。forceColorClassを
  // 渡すと、hpColorClassによる残量割合ベースの色分け(緑/黄/赤)を無視し、常にそのクラスを使う
  // (みがわりのHPバーは、残量割合に関わらず常に緑で表示する)。
  function buildHpBar(maxHp, minRemain, maxRemain, forceColorClass) {
    var track = make('div','v082h-hpbar-track');
    if (!maxHp || maxHp <= 0) return track;
    function pct(v){ return Math.max(0, Math.min(100, v / maxHp * 100)); }
    var solid = make('div', 'v082h-hpbar-seg v082h-hpbar-solid ' + (forceColorClass || hpColorClass(maxRemain, maxHp)));
    solid.style.width = pct(maxRemain) + '%';
    var uncertain = make('div', 'v082h-hpbar-seg v082h-hpbar-uncertain ' + (forceColorClass || hpColorClass(minRemain, maxHp)));
    uncertain.style.width = Math.max(0, pct(minRemain) - pct(maxRemain)) + '%';
    track.appendChild(solid);
    track.appendChild(uncertain);
    return track;
  }
  function resultRow(container, label, value){ var item=make('div','v082h-result-item'); item.appendChild(make('span','v082h-result-key',label)); item.appendChild(make('span','v082h-result-value',value||'未計算')); container.appendChild(item); }
  // 下部固定枠(v082hResultPanel)自体の背景を、左下から右上への対角線で二分し、
  // 左側(左上寄り)の三角形を天候、右側(右下寄り)の三角形をフィールドの状態に応じた
  // 淡い色で塗り分けることで、状況が変わったことだけを一目でわかるようにする
  // (パネルのサイズ・余白・レイアウトには一切影響させない。色はCSS変数として
  // panel.style に設定し、実際の三角形分割・描画はstyle.css側のclip-pathで行う)。
  // 「なし」の時はCSS変数を明示的に上書きせず削除する -- style.css側の既定値
  // (var(--dameke-surface-alt)、ライト/ダークテーマに連動)にそのまま委ねるため。
  // ライト/ダークそれぞれで見分けやすく、かつ文字(ダークモード対応色)が読める明るさに
  // なるよう、テーマごとに別の色を用意する(ダーク側は暗めのトーンに)。
  var WEATHER_TINT_COLOR_LIGHT = {
    'にほんばれ': '#fdf6e3', 'おおひでり': '#fdf6e3',
    'あめ': '#e8f1fe', 'おおあめ': '#e8f1fe',
    'すなあらし': '#f7ecdb',
    'ゆき': '#eafbfd',
    'らんきりゅう': '#eceef2',
    'ノーてんき・エアロック': '#eef0f2'
  };
  var WEATHER_TINT_COLOR_DARK = {
    'にほんばれ': '#4a3b12', 'おおひでり': '#4a3b12',
    'あめ': '#1c3a5e', 'おおあめ': '#1c3a5e',
    'すなあらし': '#3d2f1a',
    'ゆき': '#113a3d',
    'らんきりゅう': '#2a2e38',
    'ノーてんき・エアロック': '#262a30'
  };
  var FIELD_TINT_COLOR_LIGHT = {
    'エレキフィールド': '#fff6cc',
    'グラスフィールド': '#e3f7e3',
    'ミストフィールド': '#fbe6f0',
    'サイコフィールド': '#f1e6fb'
  };
  var FIELD_TINT_COLOR_DARK = {
    'エレキフィールド': '#4a3f0a',
    'グラスフィールド': '#1f3d24',
    'ミストフィールド': '#4a1f34',
    'サイコフィールド': '#34204a'
  };
  function damekeIsDarkTheme(){
    return window.__damekeCurrentTheme ? window.__damekeCurrentTheme() === 'dark' : false;
  }
  function updateResultPanelFieldTint(panel){
    if(!panel) return;
    var weatherSel = document.getElementById('weatherSelect');
    var fieldSel = document.getElementById('fieldSelect');
    var dark = damekeIsDarkTheme();
    var weatherMap = dark ? WEATHER_TINT_COLOR_DARK : WEATHER_TINT_COLOR_LIGHT;
    var fieldMap = dark ? FIELD_TINT_COLOR_DARK : FIELD_TINT_COLOR_LIGHT;
    var wColor = weatherSel ? weatherMap[weatherSel.value] : null;
    var fColor = fieldSel ? fieldMap[fieldSel.value] : null;
    if(wColor) panel.style.setProperty('--dameke-weather-tint', wColor);
    else panel.style.removeProperty('--dameke-weather-tint');
    if(fColor) panel.style.setProperty('--dameke-field-tint', fColor);
    else panel.style.removeProperty('--dameke-field-tint');
  }
  document.addEventListener('dameke:themechange', function(){
    var panel = document.getElementById('v082hResultPanel');
    if(panel) updateResultPanelFieldTint(panel);
  });
  // 結果枠(下部固定枠とは別の、非固定の詳細表示エリア)の1技分の要素を組み立てる:
  // 「結果の要点の表示(技分類～瀕死率)」の小さな詳細グリッドのみで、サムネイル・HPバー・
  // 性格/特性/持ち物のグリッドは含まない(それらは下部固定枠側にのみ表示する)。技②がある
  // ときはこれを技①・技②それぞれについて1つずつ作り、直後にその技自身の計算過程表を
  // 並べて表示する(cfg.labelでボックス先頭に「技①」「技②」のラベルを付ける)。
  // cfg.which: 'move1' | 'move2'。#summary/#move2Summary/#trace/#move2Traceの描画済みテキストは
  // 一切読み返さず、calculate()/updateMove2StandaloneSectionがその場で公開した構造化フィールド
  // (window.__damekeLastResult / __damekeLastFaintPct / __damekeMove2DisplayText / トレース配列)
  // だけから直接組み立てる。
  function buildMoveDetailGrid(cfg){
    var cat, type, dmg, rate, certainty, faintRate, power, accuracyDisplay;
    if (cfg.which === 'move2') {
      var result2 = window.__damekeLastResult2;
      var disp2 = window.__damekeMove2DisplayText;
      if (!result2 || !disp2) {
        cat=type=dmg=rate=power=accuracyDisplay='未計算'; certainty=faintRate='未計算';
      } else {
        cat = result2.effectiveCategory; type = result2.effectiveType;
        dmg = disp2.dmgText; rate = disp2.rateText;
        certainty = disp2.certaintyText || '未計算';
        faintRate = disp2.faintText || '未計算';
        accuracyDisplay = disp2.accuracyText || '未計算';
        power = powerTextFor({ trace: window.__damekeLastResult2Trace });
      }
    } else {
      var result = window.__damekeLastResult;
      if (!result) {
        cat=type=dmg=rate=power=accuracyDisplay='未計算'; certainty=faintRate='未計算';
      } else {
        var faintPct = window.__damekeLastFaintPct;
        cat = result.effectiveCategory; type = result.effectiveType;
        dmg = result.minDamage + ' ～ ' + result.maxDamage;
        rate = result.minRate.toFixed(1) + '% ～ ' + result.maxRate.toFixed(1) + '%';
        certainty = window.__damekeFormatKoInfo(result);
        faintRate = fmtFaintPct(faintPct);
        accuracyDisplay = result.accuracyResult === '命中' ? window.__damekeFormatAccuracyPercent(result.accuracyPercent) : result.accuracyResult;
        power = powerTextFor(result);
      }
    }

    var box = make('div','v082h-result-panel');
    if (cfg.label) box.appendChild(make('div','v082h-move-card-label', cfg.label));
    var grid = make('div','v082h-result-grid');
    box.appendChild(grid);
    [['技分類',cat],['技タイプ',type],['技威力',power],['ダメージ',dmg],['割合',rate],['確定数',certainty],['命中率',accuracyDisplay],['瀕死率',faintRate]].forEach(function(r){ resultRow(grid, r[0], r[1]); });
    return box;
  }
  // 結果枠内の技①/技②切り替えタブ(狭い画面での攻撃側/防御側切り替えと同じ2ボタン形式)。
  // アクティブ状態の配色は、側切り替えタブの青(#2563eb、攻撃側/防御側の識別色)と紛らわしく
  // ならないよう、特に意味を持たせない中間グレーにしている。
  function setActiveMoveTab(tab){
    window.__damekeActiveMoveTab = tab;
    var p1 = document.getElementById('v082hMoveTabPanel1');
    var p2 = document.getElementById('v082hMoveTabPanel2');
    if (p1) p1.classList.toggle('v082h-hide', tab !== 'move1');
    if (p2) p2.classList.toggle('v082h-hide', tab !== 'move2');
    all('.v082h-move-tabs button').forEach(function(b){ b.classList.toggle('active', b.dataset.moveTab === tab); });
  }
  function buildMoveResultTabs(){
    var bar = make('div','v082h-move-tabs');
    [['move1','技①'],['move2','技②']].forEach(function(pair){
      var b = document.createElement('button'); b.type='button'; b.textContent=pair[1]; b.dataset.moveTab=pair[0];
      // タブ切り替えは結果枠内の技①/技②の詳細パネルだけでなく、下部固定枠(技①単体か技①+②の
      // 統合結果か)にも反映する必要があるため、renderResult()を丸ごと呼び直す。
      b.addEventListener('click', function(){ setActiveMoveTab(pair[0]); renderResult(); });
      bar.appendChild(b);
    });
    return bar;
  }
  function renderResult(){
    var src=q('summary'); if(!src) return;
    // #summary/#trace(いずれも非表示のまま残る旧UIの中間置き場)の描画済みテキストを読み返す
    // のではなく、calculate()がその場で公開した構造化フィールド(window.__damekeLastResult等)
    // から直接組み立てる。結果枠はあくまで出力であり、参照元にはしない。
    var lastResult = window.__damekeLastResult;
    var lastFaintPct = window.__damekeLastFaintPct;
    var head = lastResult ? (lastResult.attackerName+' の '+lastResult.moveName+' → '+lastResult.defenderName) : '未計算';
    var cat = lastResult ? lastResult.effectiveCategory : '';
    var dmg = lastResult ? (lastResult.minDamage+' ～ '+lastResult.maxDamage) : '';
    var rate = lastResult ? (lastResult.minRate.toFixed(1)+'% ～ '+lastResult.maxRate.toFixed(1)+'%') : '';
    var certainty = lastResult ? window.__damekeFormatKoInfo(lastResult) : '未計算';
    var faintRate = lastResult ? fmtFaintPct(lastFaintPct) : '未計算';
    var hn = lastResult ? [lastResult.defenderCurrentHp, lastResult.defenderMaxHp] : [];

    // ---- compact HP-bar summary: this is the only part pinned at the top on narrow screens ----
    var panel=q('v082hResultPanel');
    if(!panel){
      panel=make('div','v082h-result-panel'); panel.id='v082hResultPanel'; src.parentNode.insertBefore(panel,src); src.classList.add('v082h-hide');
    }
    updateResultPanelFieldTint(panel);
    panel.innerHTML='';
    var headParts = String(head||'').split(' → ');
    var attackerMovePart = (headParts[0]||'').split(' の ');
    var attackerNamePart = (attackerMovePart[0]||'').trim();
    var moveNamePart = (attackerMovePart[1]||'').trim();
    var defenderNamePart = (headParts[1]||'').trim();
    var headerRow = make('div','v082h-result-header-row');
    headerRow.appendChild(buildPokemonThumb(attackerNamePart, 'left', itemNameForSide('attacker')));
    var textCol = make('div','v082h-result-text-col');
    var namesLine = make('div','v082h-result-title', attackerNamePart+' → '+defenderNamePart);
    var moveLine = make('div','v082h-result-move-line', moveNamePart);
    textCol.appendChild(namesLine);
    // 技②が指定されている(「なし」以外)ときは、下部固定サマリーを「技名は①+②」「ダメージは
    // ①/②の2段+合計」「瀕死率は技①・②を連結した真の瀕死率」という統合表示に切り替える
    // (数値はCALC.calculateCombinedSequenceによる厳密な連結計算そのもの)。技①単体・技②単体の
    // それぞれの完全な結果(計算過程含む)は、このカードの下に続く別々の結果枠にまるごと表示する。
    var combined = window.__damekeCombinedResult;
    // 結果枠のタブ(技①/技②)が技①のときは、技②があっても下部固定枠は技①単体の結果を表示する。
    // 技②タブのときだけ、技①+②を連結した統合結果を表示する。
    var activeMoveTab = window.__damekeActiveMoveTab || 'move1';
    var showCombined = !!combined && activeMoveTab === 'move2';
    if (showCombined) {
      moveLine.textContent = combined.move1Name + ' + ' + combined.move2Name;
      textCol.appendChild(moveLine);
      textCol.appendChild(make('div','v082h-hp-infoline', '①'+combined.move1MinDamage+'～'+combined.move1MaxDamage+'（'+combined.move1MinRate.toFixed(1)+'%～'+combined.move1MaxRate.toFixed(1)+'%）'));
      textCol.appendChild(make('div','v082h-hp-infoline', '②'+combined.move2MinDamage+'～'+combined.move2MaxDamage+'（'+combined.move2MinRate.toFixed(1)+'%～'+combined.move2MaxRate.toFixed(1)+'%）'));
      textCol.appendChild(make('div','v082h-hp-infoline2', '合計'+combined.totalMinDamage+'～'+combined.totalMaxDamage+'（'+combined.totalMinRate.toFixed(1)+'%～'+combined.totalMaxRate.toFixed(1)+'%）'));
      // 技①+②2回分の確定数という考え方自体を撤廃したため、技①の分岐によって技②開始HPが
      // 一意に定まらない(=技①が実際にダメージを与えうる)場合は確定数を表示せず、瀕死率のみ
      // 表示する。技①が常に0ダメージで技②開始HPが一意に定まる場合のみ、確定数も併記する。
      var move1AlwaysZeroDamageBottom = combined.move1RealMinDamage === 0 && combined.move1RealMaxDamage === 0;
      var bottomKoLine = move1AlwaysZeroDamageBottom ? (combined.koText + '　瀕死率:' + fmtFaintPct(combined.faintPercent)) : ('瀕死率:' + fmtFaintPct(combined.faintPercent));
      textCol.appendChild(make('div','v082h-hp-infoline2', bottomKoLine));
    } else {
      textCol.appendChild(moveLine);
      textCol.appendChild(make('div','v082h-hp-infoline', dmg+'（'+rate+'）'));
      textCol.appendChild(make('div','v082h-hp-infoline2', certainty+'　瀕死率:'+faintRate));
    }
    headerRow.appendChild(textCol);
    headerRow.appendChild(buildPokemonThumb(defenderNamePart, 'right', itemNameForSide('defender')));
    panel.appendChild(headerRow);

    // HPバー・その直下の残りHP数値も、技②が指定されているときは技①+②を合算した結果
    // (真の連結計算による合計ダメージ)を反映する。
    var maxHp=0;
    var barMinDmg, barMaxDmg, barCurHp, barMaxHp;
    // 本体側のHPバー・残りHP数値は、みがわりに防がれた分は本体に届いていない(=減っていない)
    // ものとして描く必要がある。①/②/合計のダメージ・割合の「テキスト」表示(dn、combined.
    // totalMinDamage等)は「みがわりが無かったら本来出るはずの値」に変わっているため、HPバー・
    // 残りHP数値にはみがわりの有無をそのまま反映した実際のダメージ(lastResult.realMinDamage/
    // realMaxDamage、combined.totalRealMinDamage/totalRealMaxDamage)を別途使う。
    var barSubActive, barSubMaxHp, barSubMinRemain, barSubMaxRemain;
    if (showCombined) {
      barMinDmg = combined.totalRealMinDamage; barMaxDmg = combined.totalRealMaxDamage;
      barCurHp = combined.defenderCurrentHp; barMaxHp = combined.defenderMaxHp;
      barSubActive = combined.substituteActive;
      barSubMaxHp = combined.substituteMaxHp; barSubMinRemain = combined.substituteMinRemaining; barSubMaxRemain = combined.substituteMaxRemaining;
    } else if (lastResult && hn.length>=2) {
      barMinDmg = lastResult.realMinDamage; barMaxDmg = lastResult.realMaxDamage; barCurHp = hn[0]; barMaxHp = hn[1];
      barSubActive = lastResult.substituteActive;
      barSubMaxHp = lastResult.substituteMaxHp; barSubMinRemain = lastResult.substituteMinRemaining; barSubMaxRemain = lastResult.substituteMaxRemaining;
    }
    if (barMaxHp != null && barMaxHp > 0) {
      maxHp = barMaxHp;
      var minRemain=Math.max(0, barCurHp-barMinDmg), maxRemain=Math.max(0, barCurHp-barMaxDmg);
      var barWrap=make('div','v082h-hpbar-wrap');
      if(barSubActive && barSubMaxHp > 0){
        // buildHpBarの引数はminRemain(残りHPが多い側=乱数の中で最も有利なケース)を先、
        // maxRemain(残りHPが少ない側=最も不利なケース)を後に渡す規約なので、
        // substituteMinRemaining(小さい方)/substituteMaxRemaining(大きい方)は順序を
        // 入れ替えて渡す必要がある(そのまま渡すと乱数幅のセグメントが常に幅0になる)。
        // また、みがわりのHPバーは残量割合に関わらず常に緑で表示する(本体側の緑/黄/赤とは
        // 独立)。
        var subOuter=make('div','v082h-subbar-outer');
        var subBar=buildHpBar(barSubMaxHp, barSubMaxRemain, barSubMinRemain, 'v082h-hp-green');
        subBar.classList.add('v082h-subbar-track');
        subOuter.appendChild(subBar);
        barWrap.appendChild(subOuter);
      }
      barWrap.appendChild(buildHpBar(maxHp, minRemain, maxRemain));
      // きのみ等による回復が起こりうる場合、その旨を表示する。技②タブ(統合表示)のときは技①・
      // 技②それぞれについて別々にチェックする。技②側は代表分岐(技①最大ダメージのケース)単体
      // だけを見ると、その分岐では技①の時点で既にきのみを消費済みになっていて見逃すことが
      // あるため、combined.move2RecoveryName/Amount(全分岐を通じて検出済み)を使う。
      // 下部固定枠の高さを抑えるため、残りHP表示と同じ行に右寄せで並べる(別行にはしない)。
      var recoveryNotes = [];
      if (showCombined) {
        var note1 = window.__damekeRecoveryNoteFor(window.__damekeLastResult);
        if (note1) recoveryNotes.push('①'+note1);
        if (combined.move2RecoveryName && combined.move2RecoveryAmount > 0) {
          recoveryNotes.push('②'+combined.move2RecoveryAmount+'回復');
        }
      } else {
        var noteSolo = window.__damekeRecoveryNoteFor(window.__damekeLastResult);
        if (noteSolo) recoveryNotes.push(noteSolo);
      }
      var numsRow = make('div','v082h-hpbar-numsrow');
      numsRow.appendChild(make('span','v082h-hpbar-nums', maxRemain+' ～ '+minRemain+' / '+maxHp));
      if (recoveryNotes.length) {
        numsRow.appendChild(make('span','v082h-hpbar-recovery', recoveryNotes.join('　')));
      }
      barWrap.appendChild(numsRow);
      panel.appendChild(barWrap);
    }

    // ---- 性格/特性/持ち物の枠。技②の有無にかかわらず、ポケモン自体の情報として常に表示する
    // (技①・技②どちらを選んでも同じ攻撃側/防御側のポケモンなので、共通で構わない)。----
    {
      var atkRef = statRefFor('補正後攻撃側実数値', 'attacker', cat==='特殊'?'C':'A', lastResult);
      var defRef = statRefFor('補正後防御側実数値', 'defender', cat==='特殊'?'D':'B', lastResult);
      var sideGrid = make('div','v082h-result-sidegrid');
      panel.appendChild(sideGrid);
      var atkCol = make('div','v082h-result-col'), defCol = make('div','v082h-result-col');
      sideGrid.appendChild(atkCol); sideGrid.appendChild(defCol);
      resultRow(atkCol, '性格', natureText('attacker'));
      resultRow(defCol, '性格', natureText('defender'));
      // A positive rank value is shown with an explicit "+" (matching how the calculator marks
      // boosts elsewhere) -- negative values already carry their own "-", so only >0 needs it added.
      var signedRank = function(side, key){
        var v = statText(side, key, 'rank');
        var n = parseInt(v, 10);
        return (Number.isFinite(n) && n > 0) ? ('+'+v) : v;
      };
      if (cat !== '変化') {
        var atkSideJp = atkRef.side==='attacker' ? '攻' : '防';
        resultRow(atkCol, '努力値/ランク('+atkSideJp+atkRef.key+')', statText(atkRef.side, atkRef.key, 'ev')+' / '+signedRank(atkRef.side, atkRef.key));
        // The defender's EV figure is H/X (both always shown), but rank only applies to X itself --
        // so the two get their own parenthesized reference rather than sharing one, e.g.
        // "努力値(H/B)/ランク(B)" instead of a single "努力値/ランク(H/B)" that would misleadingly
        // suggest a rank for H too.
        resultRow(defCol, '努力値(H/'+defRef.key+')/ランク('+defRef.key+')', statText('defender','H','ev')+' / '+statText('defender',defRef.key,'ev')+' / '+signedRank('defender', defRef.key));
      }
      // 特性/持ち物: reuses the exact same structured trace lookup and formatting the 計算過程
      // column itself uses (renderCalcTable's pairedNameRow/itemStatusText), rather than
      // re-parsing the rendered trace *text* -- that text also carries each entry's note appended
      // after the value, which is what was producing "有効 / 有効"-style duplicates here before.
      var lastTrace = window.__damekeLastTrace || [];
      var findTrace = function(labelPart){ return lastTrace.find(function(x){ return String(x.label||'').indexOf(labelPart) >= 0; }) || null; };
      var abilityDisplay = function(labelPart){
        var e = findTrace(labelPart);
        if(!e) return '-';
        return e.value === '有効' ? e.name : (e.name + '（' + e.value + '）');
      };
      var itemDisplay = function(labelPart){
        var e = findTrace(labelPart);
        if(!e) return '-';
        var status = e.value === '持ち物なし' ? '無効' : e.value;
        return status === '有効' ? e.name : (e.name + '（' + status + '）');
      };
      resultRow(atkCol, '特性', abilityDisplay('特性（攻撃側）'));
      resultRow(defCol, '特性', abilityDisplay('特性（防御側）'));
      resultRow(atkCol, '持ち物', itemDisplay('持ち物（攻撃側）'));
      resultRow(defCol, '持ち物', itemDisplay('持ち物（防御側）'));
    }

    // ---- detail area (結果枠): 結果の要点の表示(技分類～瀕死率の小さな詳細グリッド)と、その
    // 直後に計算過程の表を並べる。技②が指定されているときは、この2点セットを技①・技②の
    // 2つ分並べて表示する(画像・HPバーは下部固定枠のみに表示し、ここには含めない)。
    // #summary / #trace / #move2Summary / #move2Trace は非表示のまま、上記の表示を組み立てる
    // ためのデータ抽出元として残す(旧式の生のトレース文字列<pre>そのものは表示しない)。----
    var detail=q('v082hResultDetailPanel');
    if(!detail){ detail=make('div','v082h-move-cards-holder'); detail.id='v082hResultDetailPanel'; panel.parentNode.insertBefore(detail, panel.nextSibling); }
    var staleResult2Panel = q('v082hResult2Panel');
    if(staleResult2Panel && staleResult2Panel.parentNode) staleResult2Panel.parentNode.removeChild(staleResult2Panel);

    var move2Section = document.getElementById('v082hMove2Section');
    var move2SummaryEl = document.getElementById('move2Summary');
    var traceEl = document.getElementById('trace');
    var move2TraceEl = document.getElementById('move2Trace');
    if (traceEl) traceEl.classList.add('v082h-hide');
    if (move2TraceEl) move2TraceEl.classList.add('v082h-hide');
    // 計算過程表の見出し(「計算過程」「計算過程②」のh3)はもともと#trace/#move2Traceの直前に
    // 静的に置かれているだけなので、一度だけid(v082hCalcTitle/v082hCalcTitle2)を振って以後
    // getElementByIdで安定して参照できるようにする(表と一緒にdetail内へ移動させて対にするため)。
    function ensureCalcTitle(preEl, idName){
      var existing = document.getElementById(idName);
      if (existing) return existing;
      if (preEl && preEl.previousElementSibling && preEl.previousElementSibling.tagName === 'H3') {
        preEl.previousElementSibling.id = idName;
        return preEl.previousElementSibling;
      }
      return null;
    }
    var traceTitle = ensureCalcTitle(traceEl, 'v082hCalcTitle');
    var move2TraceTitle = ensureCalcTitle(move2TraceEl, 'v082hCalcTitle2');
    // installLayout()がページ初期化時に#trace直前のh3(「計算過程」見出し)へv082h-hideを付けて
    // 隠している(その時点ではまだ計算過程表そのものが無いため)。ここで表と対にしてdetail内へ
    // 表示する以上、その古いhideは解除する。
    if (traceTitle) traceTitle.classList.remove('v082h-hide');
    if (move2TraceTitle) move2TraceTitle.classList.remove('v082h-hide');
    var calcTable1 = document.getElementById('v082hCalcTable');
    var calcTable2 = document.getElementById('v082hCalcTable2');
    // v082hCalcTable/v082hCalcTable2とその見出しは、前回の描画でdetail内(または技②が
    // 「なし」に戻った際の退避先であるmove2Section内)のどちらかに置かれている可能性があるので、
    // 一旦すべて現在の親から切り離してから、detail.innerHTML=''で(切り離し済みのため無害に)
    // detailを空にし、今回の状態に応じてあらためて正しい位置へ組み立て直す。
    [traceTitle, calcTable1, move2TraceTitle, calcTable2].forEach(function(n){
      if (n && n.parentNode) n.parentNode.removeChild(n);
    });
    detail.innerHTML='';

    var move2Active = !!(combined && move2Section && !move2Section.classList.contains('v082h-hide'));
    if (move2SummaryEl) move2SummaryEl.classList.toggle('v082h-hide', !!combined);
    if (move2Active) {
      // 技①・技②が両方あるときは、結果枠内をタブ切り替え式にする(狭い画面での攻撃側/防御側
      // 切り替えと同じ見た目の2ボタンバー。ただし配色はそれと紛らわしくないよう、特に意味の
      // ない中間色にする)。
      detail.appendChild(buildMoveResultTabs());
      var panel1 = make('div','v082h-move-tab-panel'); panel1.id='v082hMoveTabPanel1';
      detail.appendChild(panel1);
      var box1 = buildMoveDetailGrid({ which:'move1' });
      panel1.appendChild(box1);
      if (traceTitle) panel1.appendChild(traceTitle);
      if (calcTable1) panel1.appendChild(calcTable1);

      var panel2 = make('div','v082h-move-tab-panel'); panel2.id='v082hMoveTabPanel2';
      detail.appendChild(panel2);
      var box2 = buildMoveDetailGrid({ which:'move2' });
      panel2.appendChild(box2);
      if (move2TraceTitle) panel2.appendChild(move2TraceTitle);
      if (calcTable2) panel2.appendChild(calcTable2);

      setActiveMoveTab(window.__damekeActiveMoveTab || 'move1');
    } else {
      var box1 = buildMoveDetailGrid({ which:'move1' });
      detail.appendChild(box1);
      if (traceTitle) detail.appendChild(traceTitle);
      if (calcTable1) detail.appendChild(calcTable1);
    }
    if (!move2Active && move2Section) {
      // 技②が「なし」のときは、技②用の計算過程表とその見出しを元の置き場所
      // (v082hMove2Section、v082h-hideで隠れている)へ戻す -- detail内に孤立して残ってしまい、
      // 技②が「なし」に戻された後もdetail枠内に表示され続けてしまうのを防ぐため。
      if (move2TraceTitle) move2Section.insertBefore(move2TraceTitle, move2Section.firstChild);
      if (calcTable2) move2Section.insertBefore(calcTable2, move2TraceEl || null);
    }

    requestAnimationFrame(function(){
      document.documentElement.style.setProperty('--v082h-fixed-panel-h', panel.offsetHeight + 'px');
    });
    // Pokemon sprite images inside the panel load asynchronously (fetched from PokeAPI), so the
    // panel's true height can still grow after the first measurement above -- re-measure a
    // couple more times to catch that, rather than leaving stale (too-small) padding underneath.
    [150, 500, 1200].forEach(function(delay){
      setTimeout(function(){
        document.documentElement.style.setProperty('--v082h-fixed-panel-h', panel.offsetHeight + 'px');
      }, delay);
    });
    // Safety net beyond the staggered re-measures above: a ResizeObserver fires whenever the
    // fixed panel's actual rendered height changes for ANY reason (content, font/image load,
    // viewport-driven wrapping), so a stale (too-small) padding value can't persist -- this is
    // what self-heals the "can't scroll all the way down" symptom without needing a panel
    // switch or page refresh. Guarded to attach only once (renderResult reuses the same panel
    // element on every call, it doesn't recreate it).
    if(window.ResizeObserver && !panel.getAttribute('data-dameke-resize-observed')){
      panel.setAttribute('data-dameke-resize-observed', '1');
      var ro = new ResizeObserver(function(entries){
        entries.forEach(function(entry){
          document.documentElement.style.setProperty('--v082h-fixed-panel-h', entry.target.offsetHeight + 'px');
        });
      });
      ro.observe(panel);
    }
  }
  function setupResult(){ var s=q('summary'), t=q('trace'); if(!s) return; var obs=new MutationObserver(renderResult); obs.observe(s,{childList:true,subtree:true,characterData:true}); if(t) obs.observe(t,{childList:true,subtree:true,characterData:true}); setTimeout(renderResult,0); }
  function refreshAll(){ updateAbilityButtons('attacker'); updateAbilityButtons('defender'); updateConditional(); updateConditional2(); updateMoveOrderSwapButton(); renderResult(); updateNatureStatColors('attacker'); updateNatureStatColors('defender'); updateReadOnlyStatRows('attacker'); updateReadOnlyStatRows('defender'); updateRemainingEvDisplay('attacker'); updateRemainingEvDisplay('defender'); if(window.__damekeUpdateMoveTypeColor) window.__damekeUpdateMoveTypeColor(); if(window.__damekeUpdateMove2TypeColor) window.__damekeUpdateMove2TypeColor(); }
  window.__damekeRefreshAll = refreshAll;
  function bind(){ ['attackerSelect','defenderSelect'].forEach(function(id){ var e=q(id); if(e) e.addEventListener('change',function(){ setTimeout(refreshAll,0); }); }); ['moveSelect','attackerAbilitySelect','defenderAbilitySelect','attackerItemSelect','attackerTeraType','move2AttackerTeraType'].forEach(function(id){ var e=q(id); if(e) e.addEventListener('change',function(){ setTimeout(updateConditional,0); }); }); ['move2Select'].forEach(function(id){ var e=q(id); if(e) e.addEventListener('change',function(){ setTimeout(function(){ updateConditional2(); updateMoveOrderSwapButton(); },0); }); }); ['attackerAbilitySelect','defenderAbilitySelect'].forEach(function(id){ var e=q(id); if(e) e.addEventListener('change',function(){ if(window.__damekeApplyAbilityFieldAuto) window.__damekeApplyAbilityFieldAuto(e.value); }); }); var swapMoveBtn=q('moveOrderSwapButton'); if(swapMoveBtn) swapMoveBtn.addEventListener('click', swapMoveOrder); }

  function safeStep(name, fn){ try{ fn(); }catch(e){ if(window.console && console.error) console.error('[v082h] '+name+' failed:', e); } }
  function finalizeSearchCombos(){
    // Attaching the ability search combo here (after the rest of the layout has
    // settled) instead of inline inside addAbilityPanel is what reliably works;
    // building it earlier in the sequence did not take effect consistently.
    ['attackerAbilitySelect','defenderAbilitySelect'].forEach(function(id){
      var sel = q(id);
      if(!sel) return;
      attachSearchCombo(id);
      var l = labelOf(id);
      if(l && !l.classList.contains('dameke-main-control-label')){
        l.classList.add('dameke-main-control-label');
        for(var i=l.childNodes.length-1;i>=0;i--){ if(l.childNodes[i].nodeType===3) l.removeChild(l.childNodes[i]); }
        l.insertBefore(document.createTextNode('特性選択'), l.firstChild);
      }
    });
    for(var n=1;n<=5;n++){
      var beatSel = q('beatUpAlly'+n);
      if(beatSel) attachSearchCombo('beatUpAlly'+n);
    }
  }
  function finalizeNumberPickers(){
    all('.v082h-box input[type="number"]').forEach(function(input){
      if(input.getAttribute('data-v082h-picker')) return;
      if(/CurrentHp$/.test(input.id||'')) return; // has its own quick-set buttons already
      var mn=parseInt(input.min,10), mx=parseInt(input.max,10);
      if(isNaN(mn) || isNaN(mx) || mx<=mn || (mx-mn)>40) return;
      attachNumberPicker(input, mn, mx);
    });
  }
  function buildLayoutAndZones(){
    safeStep('installLayout', installLayout);
    safeStep('setupZones', setupZones);
    safeStep('restructureConditions', restructureConditions);
    safeStep('finalizeSearchCombos', finalizeSearchCombos);
    safeStep('finalizeNumberPickers', finalizeNumberPickers);
  }
  function initializeLayoutAndZones(){
    buildLayoutAndZones();
  }
  function init(){ document.body.classList.add('v082h-ui'); initializeLayoutAndZones(); setActiveSide('attacker'); bind(); refreshAll(); setupResult(); }
  window.__damekeInitV082h = init;
})();






// ===== END integrated UI builder =====

/* Form-change runtime BEGIN */
/* Owns form candidates, linked item/tera/sex changes, and form-panel rendering. */
(function(){
  'use strict';
  var D = window.DAMEKE_DATA;
  if(!D) return;

  var syncing = false;
  var renderTimer = null;
  var recalcTimer = null;
  var initialized = false;

  function arr(x){ return Array.isArray(x) ? x : []; }
  function norm(x){ return x == null ? '' : String(x).trim(); }
  function sidePrefix(side){ return side === 'A' ? 'attacker' : 'defender'; }
  function byIdLocal(id){ return document.getElementById(id); }
  function pokemonSelect(side){ return byIdLocal(sidePrefix(side) + 'Select'); }
  function itemSelect(side){ return byIdLocal(sidePrefix(side) + 'ItemSelect'); }
  function abilitySelect(side){ return byIdLocal(sidePrefix(side) + 'AbilitySelect'); }
  function moveSelect(){ return byIdLocal('moveSelect'); }
  function sexSelect(side){ return byIdLocal(sidePrefix(side) + 'SexSelect'); }
  function optionText(sel){
    if(!sel) return '';
    var opt = sel.options && sel.options[sel.selectedIndex];
    return opt ? norm(opt.textContent || opt.value) : norm(sel.value);
  }
  function dispatch(el){
    if(!el) return;
    try { el.dispatchEvent(new Event('input', {bubbles:true})); } catch(e) {}
    try { el.dispatchEvent(new Event('change', {bubbles:true})); } catch(e) {}
  }
  function ensureOption(sel, value, label){
    if(!sel || value == null) return;
    var v = norm(value);
    var l = label == null ? v : norm(label);
    for(var i=0;i<sel.options.length;i++){
      if(norm(sel.options[i].value) === v || norm(sel.options[i].textContent) === l) return;
    }
    var opt = document.createElement('option');
    opt.value = v;
    opt.textContent = l;
    sel.appendChild(opt);
  }
  function setSelectSilent(sel, value, label){
    if(!sel || value == null) return false;
    var v = norm(value);
    ensureOption(sel, v, label);
    for(var i=0;i<sel.options.length;i++){
      if(norm(sel.options[i].value) === v || norm(sel.options[i].textContent) === v || (label != null && norm(sel.options[i].textContent) === norm(label))){
        sel.selectedIndex = i;
        return true;
      }
    }
    return false;
  }
  function findPokemon(name){ return arr(D.pokemons).find(function(p){ return p && p.name === name; }) || null; }
  function selectedPokemon(side){
    var sel = pokemonSelect(side);
    return findPokemon(optionText(sel)) || findPokemon(sel && sel.value) || null;
  }
  function sideCard(side){
    var sel = pokemonSelect(side);
    if(!sel) return null;
    return sel.closest('.v082-side-card') || sel.closest('.panel') || sel.closest('section') || sel.parentElement;
  }
  function labelTextFor(el){
    if(!el) return '';
    var lab = el.id ? document.querySelector('label[for="' + el.id + '"]') : null;
    if(lab) return norm(lab.textContent);
    var parent = el.closest('label');
    if(parent) return norm(parent.textContent);
    var row = el.closest('.field,.row,.control,.v082-field');
    return row ? norm(row.textContent) : '';
  }
  function isForbiddenTeraSelect(sel, side){
    if(!sel) return true;
    var id = norm(sel.id).toLowerCase();
    if(sel === pokemonSelect(side) || sel === itemSelect(side) || sel === abilitySelect(side) || sel === sexSelect(side)) return true;
    if(id.indexOf('move') >= 0) return true;
    if(id.indexOf('pokemon') >= 0 || id === sidePrefix(side).toLowerCase() + 'select') return true;
    return false;
  }
  function teraSelect(side){
    var p = sidePrefix(side);
    var exact = [p + 'TeraTypeSelect', p + 'TeraSelect', p + '_tera', p + 'TeraType', p + 'TerastalSelect'];
    for(var x=0;x<exact.length;x++){
      var el = byIdLocal(exact[x]);
      if(el && !isForbiddenTeraSelect(el, side)) return el;
    }
    var root = sideCard(side) || document;
    var selects = Array.prototype.slice.call(root.querySelectorAll('select'));
    for(var i=0;i<selects.length;i++){
      var s = selects[i];
      if(isForbiddenTeraSelect(s, side)) continue;
      var hay = (norm(s.id) + ' ' + norm(s.name) + ' ' + labelTextFor(s)).toLowerCase();
      if(hay.indexOf('テラスタイプ') >= 0 || hay.indexOf('tera') >= 0 || hay.indexOf('terastal') >= 0) return s;
    }
    return null;
  }
  function firstAbilityName(p){
    if(!p) return '';
    if(Array.isArray(p.abilities) && p.abilities.length) return norm(p.abilities[0]);
    return norm(p.ability1 || p.ability || p.tokusei1 || '');
  }
  function setDefaultAbility(side, p){
    var ab = firstAbilityName(p);
    if(ab) setSelectSilent(abilitySelect(side), ab);
  }
  function findIvAnchor(side){
    var root = sideCard(side);
    if(!root) return null;
    var nodes = Array.prototype.slice.call(root.querySelectorAll('details, .v082-iv-details, .iv-details, .v082-compact-details'));
    for(var i=nodes.length-1;i>=0;i--){
      if(norm(nodes[i].textContent).indexOf('個体値') >= 0) return nodes[i];
    }
    return null;
  }
  function ensureSexField(side){
    var id = sidePrefix(side) + 'SexSelect';
    var sel = byIdLocal(id);
    var field = sel && sel.closest('.v091-sex-field');
    if(!field){
      field = document.createElement('label');
      field.className = 'v091-sex-field';
      var span = document.createElement('span');
      span.textContent = '性別';
      sel = sel || document.createElement('select');
      sel.id = id;
      sel.className = 'v091-sex-select';
      field.appendChild(span);
      field.appendChild(sel);
    }
    var current = sel.value;
    // The trailing \uFE0E (text-presentation variation selector) on the *label* only forces
    // ♂/♀ to render as plain text/symbol glyphs rather than color emoji glyphs -- some mobile
    // platforms otherwise substitute an emoji glyph for these two characters specifically, which
    // has different vertical metrics (sits lower, gets clipped) and a different overall look
    // than the desktop text glyph. The underlying value stays plain ('♂'/'♀', no selector) since
    // that's compared elsewhere in the code and stored as saved Pokemon data.
    var specs = [['','指定なし'], ['♂','♂\uFE0E'], ['♀','♀\uFE0E'], ['不明','性別不明']];
    if(sel.options.length !== specs.length){
      sel.innerHTML = '';
      specs.forEach(function(x){
        var opt = document.createElement('option');
        opt.value = x[0];
        opt.textContent = x[1];
        sel.appendChild(opt);
      });
      setSelectSilent(sel, current || '');
    }
    var anchor = findIvAnchor(side);
    if(anchor && anchor.parentNode && field.previousElementSibling !== anchor){
      anchor.insertAdjacentElement('afterend', field);
    } else if(!field.parentNode && sideCard(side)) {
      sideCard(side).appendChild(field);
    }
    return sel;
  }
  function applyLinked(side, p){
    if(!p) return;
    if(p.formLinkedItem1) setSelectSilent(itemSelect(side), p.formLinkedItem1);
    if(p.formLinkedTerastal){
      setSelectSilent(teraSelect(side), p.formLinkedTerastal);
      // 攻撃側は技①・技②それぞれ専用のテラスタルフィールドを持つため、種族選択に伴う連動反映
      // (オーガポン各種/テラパゴス(ステラ))は両方に同じ値を反映して揃える。
      if(side === 'A'){ var m2te = byIdLocal('move2AttackerTeraType'); if(m2te) setSelectSilent(m2te, p.formLinkedTerastal); }
    }
    // Gender auto-fill is now handled uniformly via p.fixedGender (see commitPokemon/
    // setTypeDefaults), which also covers Pokemon management -- the old formLinkedSex-driven
    // logic that used to live here has been folded into that single mechanism.
  }
  // オーガポン各種・テラパゴス(ステラ)のテラスタル連動: 攻撃側は技①(teraSelect('A')相当、
  // id='attackerTeraType')・技②(move2AttackerTeraType)の2つのフィールドを持つが、どちらの
  // フィールドの変更でフォルムが連動しても、もう片方にも同じテラスタイプを反映して揃える
  // (同一個体の同一のテラスタル状態を表すため)。防御側は従来通り単一フィールドのまま。
  function syncAttackerTeraFields(sourceEl){
    if(!sourceEl) return;
    var m1 = byIdLocal('attackerTeraType'), m2 = byIdLocal('move2AttackerTeraType');
    var val = sourceEl.value;
    if(m1 && m1 !== sourceEl) setSelectSilent(m1, val);
    if(m2 && m2 !== sourceEl) setSelectSilent(m2, val);
    if(window.__damekeUpdateAttackerTeraExclusivity) window.__damekeUpdateAttackerTeraExclusivity();
  }
  function scheduleRecalc(){
    if(recalcTimer) clearTimeout(recalcTimer);
    recalcTimer = setTimeout(function(){
      recalcTimer = null;
      var m = moveSelect();
      if(m) dispatch(m);
      else dispatch(pokemonSelect('A') || pokemonSelect('D'));
    }, 40);
  }
  function commitPokemon(side, p, withLinked){
    if(!p) return false;
    syncing = true;
    setSelectSilent(pokemonSelect(side), p.name);
    // The form-change runtime is the single owner of displayed base-type updates after Pokemon or form changes.
    var prefix = sidePrefix(side);
    var t1 = byIdLocal(prefix + 'Type1');
    var t2 = byIdLocal(prefix + 'Type2');
    var types = Array.isArray(p.types) ? p.types : [];
    if(t1) setSelectSilent(t1, types[0] || 'なし');
    if(t2) setSelectSilent(t2, types[1] || 'なし');
    if(p.fixedGender){
      var sexSelForCommit = byIdLocal(prefix + 'SexSelect');
      if(sexSelForCommit) setSelectSilent(sexSelForCommit, p.fixedGender);
    }
    if(withLinked) applyLinked(side, p);
    if(typeof window.__damekeUpdateTypeColors === 'function') window.__damekeUpdateTypeColors();
    setDefaultAbility(side, p);
    // ポケモン選択に伴い特性が自動設定された分も、天候・フィールドの自動入力トリガーの対象に含める
    // (setDefaultAbilityはsetSelectSilent経由で'change'を発火しないため、ここで直接呼ぶ)。
    if(window.__damekeApplyAbilityFieldAuto) window.__damekeApplyAbilityFieldAuto(firstAbilityName(p));
    // Refresh visible ability chips when a form button commits a new Pokemon.
    // Keep the ability buttons synchronized with the committed Pokemon.
    var abilityHost = byIdLocal('v082hAbilityButtons_' + prefix) || byIdLocal('v082gAbilityButtons_' + prefix) || byIdLocal('v082fAbilityButtons_' + prefix);
    if(abilityHost){
      abilityHost.innerHTML = '';
      var names = [];
      if(Array.isArray(p.abilities)) names = p.abilities.slice(0, 3);
      if(!names.length){
        ['ability1','ability2','hiddenAbility','ability'].forEach(function(k){ if(p[k]) names.push(p[k]); });
      }
      names.forEach(function(name){
        if(!name || name === 'なし') return;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'v082h-ability-chip';
        btn.textContent = name;
        btn.addEventListener('click', function(){
          var sel = abilitySelect(side);
          setSelectSilent(sel, name);
          dispatch(sel);
        });
        abilityHost.appendChild(btn);
      });
      if(!abilityHost.childNodes.length){
        var span = document.createElement('span');
        span.className = 'v082h-muted';
        span.textContent = '候補なし';
        abilityHost.appendChild(span);
      }
      abilityHost.dataset.v103iSynced = '1';
    }
    syncing = false;
    if(side === 'A' && typeof window.__damekeApplyMoveFilter === 'function') window.__damekeApplyMoveFilter();
    renderSoon();
    scheduleRecalc();
    return true;
  }
  function anchorAfterPokemon(side){
    var sel = pokemonSelect(side);
    if(!sel) return null;
    return sel.closest('.v082-field') || sel.closest('.field') || sel.parentElement || sel;
  }
  function ensurePanel(side){
    var id = side === 'A' ? 'attackerFormPanelV091' : 'defenderFormPanelV091';
    var oldId = side === 'A' ? 'attackerFormPanelV090' : 'defenderFormPanelV090';
    var old = byIdLocal(oldId);
    if(old) old.remove();
    var anchor = anchorAfterPokemon(side);
    if(!anchor) return null;
    var panel = byIdLocal(id);
    if(!panel){
      panel = document.createElement('details');
      panel.id = id;
      panel.className = 'v091-form-panel';
      panel.open = true;
      var summary = document.createElement('summary');
      summary.className = 'v091-form-panel-title';
      summary.textContent = 'フォルム';
      var body = document.createElement('div');
      body.className = 'v091-form-body';
      var buttons = document.createElement('div');
      buttons.className = 'v091-form-buttons';
      body.appendChild(buttons);
      panel.appendChild(summary);
      panel.appendChild(body);
    }
    if(panel.parentNode !== anchor.parentNode || panel.previousElementSibling !== anchor) anchor.insertAdjacentElement('afterend', panel);
    return panel;
  }
  function renderSide(side){
    ensureSexField(side);
    var panel = ensurePanel(side);
    if(!panel) return;
    var buttons = panel.querySelector('.v091-form-buttons');
    buttons.innerHTML = '';
    var p = selectedPokemon(side);
    var candidates = D.getFormCandidates ? arr(D.getFormCandidates(p || '')) : [];
    if(!p || candidates.length <= 1){
      panel.classList.add('v091-form-panel-empty');
      return;
    }
    panel.classList.remove('v091-form-panel-empty');
    candidates.forEach(function(c){
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'v091-form-chip';
      if(c.name === p.name) btn.classList.add('active');
      btn.textContent = c.formLabel || c.formKey || c.name;
      btn.dataset.side = side;
      btn.dataset.formName = c.name;
      btn.title = c.name;
      buttons.appendChild(btn);
    });
  }
  function renderAll(){ renderSide('A'); renderSide('D'); }
  function renderSoon(){
    if(renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(function(){ renderTimer = null; renderAll(); }, 0);
  }
  function handlePokemonManual(side){
    if(syncing) return;
    var p = selectedPokemon(side);
    if(!p) return;
    commitPokemon(side, p, true);
  }
  function handleLinkedManual(side, kind, sourceEl){
    if(syncing) return;
    var p = selectedPokemon(side);
    if(!p) return;
    var target = null;
    // kind==='tera'のとき、変更のきっかけになったフィールド(sourceEl: 技①用のteraSelect(side)
    // か、攻撃側なら技②用のmove2AttackerTeraType)の値を基準に判定する。
    var srcSel = (kind === 'tera') ? (sourceEl || teraSelect(side)) : null;
    if(kind === 'item' && D.findFormByLinkedItem) target = D.findFormByLinkedItem(p, optionText(itemSelect(side)));
    if(kind === 'tera' && D.findFormByLinkedTerastal) target = D.findFormByLinkedTerastal(p, optionText(srcSel));
    // Note: gender no longer drives a form switch here -- p.fixedGender (see
    // commitPokemon/setTypeDefaults) auto-fills gender FROM the selected Pokemon/form, but
    // manually changing gender doesn't switch the Pokemon anymore. This mirrors how Pokemon
    // management now handles the same species, instead of two different behaviors.
    if(target && target.name !== p.name){
      commitPokemon(side, target, false);
      // オーガポン各種・テラパゴス(ステラ)へのフォルム連動が発生した場合、攻撃側の技①・技②
      // テラスタルフィールドを両方とも同じ値に揃える。
      if(kind === 'tera' && side === 'A') syncAttackerTeraFields(srcSel);
      return;
    }
    if(D.getFormDefaultPokemon){
      var lost = false;
      if((p.formLinkedItem1 || p.formLinkedItem2) && optionText(itemSelect(side)) !== p.formLinkedItem1 && optionText(itemSelect(side)) !== p.formLinkedItem2) lost = true;
      var teraCheckVal = optionText(kind === 'tera' ? srcSel : teraSelect(side));
      if(p.formLinkedTerastal && teraCheckVal !== p.formLinkedTerastal) lost = true;
      if(lost){
        var base = D.getFormDefaultPokemon(p);
        if(base && base.name !== p.name) commitPokemon(side, base, false);
      }
    }
    // フォルムは変わらなかった(または既にテラスタル連動フォルムのままの)場合でも、対象種族が
    // テラスタル連動種族(オーガポン各種・テラパゴス(ステラ))であれば、技①・技②を揃えておく。
    if(kind === 'tera' && side === 'A' && p.formLinkedTerastal) syncAttackerTeraFields(srcSel);
  }
  function attachSide(side){
    ensureSexField(side);
    var ps = pokemonSelect(side);
    if(ps && !ps.dataset.v091Form){
      ps.dataset.v091Form = '1';
      ps.addEventListener('change', function(){ setTimeout(function(){ handlePokemonManual(side); }, 0); });
    }
    var is = itemSelect(side);
    if(is && !is.dataset.v091Form){
      is.dataset.v091Form = '1';
      is.addEventListener('change', function(){ setTimeout(function(){ handleLinkedManual(side, 'item'); }, 0); });
    }
    var ts = teraSelect(side);
    if(ts && !ts.dataset.v091Form){
      ts.dataset.v091Form = '1';
      ts.addEventListener('change', function(){ setTimeout(function(){ handleLinkedManual(side, 'tera', ts); }, 0); });
    }
    // 攻撃側の技②用テラスタルフィールドも、技①用(teraSelect('A'))とまったく同じ連動処理の
    // 入口として扱う(オーガポン各種・テラパゴス(ステラ)は、どちらのフィールドの変更でも
    // フォルムが連動し、もう片方も揃う)。
    if(side === 'A'){
      var ts2 = byIdLocal('move2AttackerTeraType');
      if(ts2 && !ts2.dataset.v091Form){
        ts2.dataset.v091Form = '1';
        ts2.addEventListener('change', function(){ setTimeout(function(){ handleLinkedManual(side, 'tera', ts2); }, 0); });
      }
    }
    // 性別セレクトの'change'にはhandleLinkedManualを繋がない。性別は(handleLinkedManualの上の
    // コメントの通り)もうフォルム切り替えを引き起こさない設計になっており、handleLinkedManual
    // 内でも'sex'というkindは持ち物/テラスタルの判定に一切使われず、実質的に「(性別変更とは無関係
    // な)持ち物・テラスタルの整合性チェックを性別変更のたびに再実行するだけ」になっていた。
    // これが原因で、ゲンシグラードン/ゲンシカイオーガ(性別「不明」固定)をポケモン選択欄から
    // 直接選んだ際、setTypeDefaults側の性別自動設定が(持ち物の連動反映がまだ済んでいない
    // タイミングで)性別セレクトに'change'を発火させてしまい、「専用アイテムを持っていない」と
    // 誤判定されて強制的に通常フォルム(グラードン/カイオーガ)へ戻されてしまっていた。
    ensureSexField(side);
  }
  function attachAll(){ attachSide('A'); attachSide('D'); }
  function removeLegacyNodes(){
    var nodes = document.querySelectorAll('#attackerFormPanelV090,#defenderFormPanelV090,.v090e-sex-field,.v090f-sex-field,.v090g-sex-field,.v090-form-select');
    Array.prototype.slice.call(nodes).forEach(function(n){ n.remove(); });
  }
  document.addEventListener('pointerdown', function(e){
    var btn = e.target && e.target.closest ? e.target.closest('.v091-form-chip') : null;
    if(!btn) return;
    e.preventDefault();
    e.stopPropagation();
    var p = findPokemon(btn.dataset.formName);
    if(p) commitPokemon(btn.dataset.side, p, true);
  }, true);
  document.addEventListener('click', function(e){
    var btn = e.target && e.target.closest ? e.target.closest('.v091-form-chip') : null;
    if(!btn) return;
    e.preventDefault();
    e.stopPropagation();
  }, true);
  function init(){
    removeLegacyNodes();
    attachAll();
    renderAll();
  }
  window.__damekeInitV093 = init;
  // 攻防交代やポケモン管理からの呼び出しなど、他のモジュールからポケモン変更後の同期(タイプ表示・
  // 特性チップ・フォルムチェンジボタン)を正しくトリガーできるよう公開する。
  window.__damekeCommitPokemonForm = commitPokemon; // (side: 'A'|'D', pokemonObj, withLinked)
  window.__damekeRenderFormButtons = renderAll;
  })();

/* Form-change runtime END */

// 天候・フィールドを変える特性の自動反映(v2.2.0)
// 攻撃側/防御側いずれかの特性が該当特性になった場合(手動でのプルダウン選択・特性チップの
// クリック・ポケモン選択に伴う自動設定のいずれでも)、天候/フィールドの入力欄に対応する値を
// 自動入力する。あくまで自動入力するだけで内部値を固定するわけではなく、その後の手動上書きや
// 別の特性による上書きは自由に行える。自動入力があった場合は「場」の折り畳みを開く
// (手動で閉じることもできる)。
(function(){
  'use strict';
  var TRIGGERS = {
    'ひでり': ['weatherSelect', 'にほんばれ'],
    'あめふらし': ['weatherSelect', 'あめ'],
    'すなおこし': ['weatherSelect', 'すなあらし'],
    'ゆきふらし': ['weatherSelect', 'ゆき'],
    'おわりのだいち': ['weatherSelect', 'おおひでり'],
    'はじまりのうみ': ['weatherSelect', 'おおあめ'],
    'デルタストリーム': ['weatherSelect', 'らんきりゅう'],
    'ノーてんき': ['weatherSelect', 'ノーてんき・エアロック'],
    'エアロック': ['weatherSelect', 'ノーてんき・エアロック'],
    'エレキメイカー': ['fieldSelect', 'エレキフィールド'],
    'グラスメイカー': ['fieldSelect', 'グラスフィールド'],
    'ミストメイカー': ['fieldSelect', 'ミストフィールド'],
    'サイコメイカー': ['fieldSelect', 'サイコフィールド']
  };
  function openFieldFold(){
    // 「場」セクションは起動時にrestructureConditions()がsection→detailsへ組み替える
    // (id等は振られないため、その際に公開されるwindow.__damekeFieldFoldDetailsを使う)。
    var fold = window.__damekeFieldFoldDetails;
    if(fold && !fold.open) fold.open = true;
  }
  window.__damekeApplyAbilityFieldAuto = function(abilityName){
    var trig = TRIGGERS[String(abilityName || '').trim()];
    if(!trig) return;
    var sel = document.getElementById(trig[0]);
    if(!sel) return;
    if(sel.value !== trig[1]){
      sel.value = trig[1];
      try{ sel.dispatchEvent(new Event('change', {bubbles:true})); }
      catch(e){ try{ var ev=document.createEvent('Event'); ev.initEvent('change', true, true); sel.dispatchEvent(ev); }catch(e2){} }
    }
    openFieldFold();
  };
})();




// Integrated read-only application diagnostic
(function(){
  'use strict';
  window.DAMEKE_APP_DIAGNOSTIC_REPORT = function(){
    function exists(id){ return !!document.getElementById(id); }
    function selectText(id){
      var el = document.getElementById(id);
      if(!el) return '';
      var option = el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
      return option ? String(option.textContent || option.value || '') : String(el.value || '');
    }
    var scripts = Array.prototype.slice.call(document.querySelectorAll('script[src]')).map(function(script){
      return script.getAttribute('src') || '';
    });
    var oldFormChangeScripts = scripts.filter(function(src){ return /^app\.formchange\./.test(src); });
    var ui = {
      basicGrid: exists('v082hBasicGrid'),
      toolbar: exists('v082hToolbar'),
      resultPanel: exists('v082hResultPanel'),
      zones: {
        moveDetails: exists('v082hMoveDetails'),
        attackerAbilityDetails: exists('v082hAbilityDetails'),
        defenderAbilityDetails: exists('v082hDefenderAbilityDetails'),
        attackerItemDetails: exists('v082hItemDetails'),
        defenderItemDetails: exists('v082hDefenderItemDetails'),
        teraDetails: exists('v082hTeraDetails')
      },
      abilityButtonCounts: {
        attacker: document.querySelectorAll('#v082hAbilityButtons_attacker button').length,
        defender: document.querySelectorAll('#v082hAbilityButtons_defender button').length
      },
      bodyClass: document.body.className
    };
    var forms = {
      attacker: {
        pokemon: selectText('attackerSelect'),
        panel: exists('attackerFormPanelV091'),
        sexSelect: exists('attackerSexSelect'),
        listener: !!(document.getElementById('attackerSelect') && document.getElementById('attackerSelect').dataset.v091Form),
        ability: selectText('attackerAbilitySelect')
      },
      defender: {
        pokemon: selectText('defenderSelect'),
        panel: exists('defenderFormPanelV091'),
        sexSelect: exists('defenderSexSelect'),
        listener: !!(document.getElementById('defenderSelect') && document.getElementById('defenderSelect').dataset.v091Form),
        ability: selectText('defenderAbilitySelect')
      },
      legacyPanelCount: document.querySelectorAll('#attackerFormPanelV090,#defenderFormPanelV090').length
    };
    var initialization = {
      appJsLoaded: scripts.indexOf('app.js') >= 0,
      singleEntryGuard: window.__damekeSingleInitDone === true,
      formChangeIntegratedIntoApp: true,
      oldFormChangeScriptsLoaded: oldFormChangeScripts
    };
    var checks = {
      requiredUiPresent: ui.basicGrid && ui.toolbar && ui.resultPanel && ui.zones.moveDetails && ui.zones.attackerAbilityDetails && ui.zones.defenderAbilityDetails,
      formRuntimePresent: forms.attacker.panel && forms.defender.panel && forms.attacker.sexSelect && forms.defender.sexSelect && forms.attacker.listener && forms.defender.listener,
      oldScriptsAbsent: oldFormChangeScripts.length === 0,
      legacyPanelsAbsent: forms.legacyPanelCount === 0
    };
    return {
      version: 'v1.2.0',
      loaded: true,
      initialization: initialization,
      ui: ui,
      forms: forms,
      checks: checks,
      healthy: initialization.appJsLoaded && initialization.singleEntryGuard && checks.requiredUiPresent && checks.formRuntimePresent && checks.oldScriptsAbsent && checks.legacyPanelsAbsent
    };
  };
})();

// Single-entry initialization orchestrator
// Runs each existing init stage exactly once, in a fixed, deterministic order,
// instead of five independent DOMContentLoaded/setTimeout listeners racing each other.
(function(){
  if(window.__damekeSingleInitDone) return;
  window.__damekeSingleInitDone = true;
  function step(name, fn){
    if(typeof fn !== 'function') return;
    try{ fn(); }
    catch(e){ if(window.console && console.error) console.error('[init] '+name+' failed:', e); }
  }
  function runAll(){
    step('v084', window.__damekeInitV084);
    step('v021', window.__damekeInitV021);
    step('v082h', window.__damekeInitV082h);
    step('v093', window.__damekeInitV093);
    document.body.classList.add('v082h-ready');
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', runAll, {once:true});
  else runAll();
})();
