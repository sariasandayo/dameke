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
  const ids = ['attackerSelect','defenderSelect','moveSelect','attackerLevel','defenderLevel','attackerSpecialState','defenderSpecialState','attackerTeraType','defenderTeraType','attackerType1','attackerType2','defenderType1','defenderType2','attackerTypeOverride','defenderTypeOverride','attackerAddType','defenderAddType','attackerItemSelect','defenderItemSelect','attackerNoItem','defenderNoItem','attackerAbilitySelect','defenderAbilitySelect','attackerNoAbility','defenderNoAbility','weatherSelect','fieldSelect','magicRoom','gravity','protect','plasmaShower','neutralizingGasField','critical','electrify','pledgeCombination','defenderLuckyChant','defenderForesight','defenderMiracleEye','attackerEmbargo','defenderEmbargo','attackerStealthRock','defenderStealthRock','attackerSpikes','defenderSpikes','attackerSteelSurge','defenderSteelSurge','attackerRootedSmacked','defenderRootedSmacked','attackerMagnetRise','defenderMagnetRise','attackerTelekinesis','defenderTelekinesis','attackerRoost','defenderRoost','attackerBurnUp','defenderBurnUp','attackerDoubleShock','defenderDoubleShock','attackerCurrentHp','defenderCurrentHp','attackerStatsGrid','defenderStatsGrid','calculateButton','copyTraceButton','summary','rolls','trace','transformOpsDisplay','resetTransformOps'];
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
  function byId(items, id) { return items.find(x => x.id === id) || items[0]; }
  function statInputId(side, key, kind) { return side + '_' + key + '_' + kind; }
  function createStatsGrid(side, host) {
    let html = '<div class="stat-row header"><span>能力</span><span>個体値</span><span>努力値</span><span>ランク</span></div>';
    html += '<div class="stat-row nature-row"><span>性格</span><select id="' + side + '_nature"></select><span>-</span><span>-</span></div>';
    for (const key of STAT_KEYS) {
      const hasIvEv = key !== 'acc' && key !== 'eva';
      const hasRank = key !== 'H';
      html += '<div class="stat-row"><span>' + STAT_LABELS[key] + '</span>';
      html += hasIvEv ? '<input id="' + statInputId(side,key,'iv') + '" type="number" min="0" max="31" value="31" />' : '<span>-</span>';
      html += hasIvEv ? '<input id="' + statInputId(side,key,'ev') + '" type="number" min="0" max="32" value="0" />' : '<span>-</span>';
      html += hasRank ? '<input id="' + statInputId(side,key,'rank') + '" type="number" min="-6" max="6" value="0" />' : '<span>-</span>';
      html += '</div>';
    }
    host.innerHTML = html;
    const natureSelect = document.getElementById(side + '_nature');
    if (natureSelect) {
      for (const n of NATURE_OPTIONS) { const op = document.createElement('option'); op.value = n[0]; op.textContent = n[1]; natureSelect.appendChild(op); }
      natureSelect.value = 'まじめ';
    }
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
  function fillSelectBeatUpAllies() { for (let i = 1; i <= 5; i++) { const s = document.getElementById('beatUpAlly' + i); if (!s) continue; s.textContent = ""; const none = document.createElement('option'); none.value = 'none'; none.textContent = 'なし'; s.appendChild(none); for (const p of DATA.pokemons) { const op = document.createElement('option'); op.value = p.id; op.textContent = p.name; s.appendChild(op); } } } function setTypeDefaults(side) { const p = byId(DATA.pokemons, el[side + 'Select'].value); if (el[side + 'Type1']) el[side + 'Type1'].value = (p.types && p.types[0]) || 'なし'; if (el[side + 'Type2']) el[side + 'Type2'].value = (p.types && p.types[1]) || 'なし'; } function formatTrace(trace) {
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
  function buildOptions() {
    return {
      attackerItemId: el.attackerItemSelect.value, defenderItemId: el.defenderItemSelect.value, attackerNoItem: el.attackerNoItem.checked, defenderNoItem: el.defenderNoItem.checked,
      attackerAbilityId: el.attackerAbilitySelect.value, defenderAbilityId: el.defenderAbilitySelect.value, attackerNoAbility: el.attackerNoAbility.checked, defenderNoAbility: el.defenderNoAbility.checked,
      attackerSpecialState: el.attackerSpecialState.value, defenderSpecialState: el.defenderSpecialState.value, attackerTeraType: el.attackerTeraType.value, defenderTeraType: el.defenderTeraType.value, attackerGender: genderValue('attacker'), defenderGender: genderValue('defender'),
      attackerType1: el.attackerType1.value, attackerType2: el.attackerType2.value, defenderType1: el.defenderType1.value, defenderType2: el.defenderType2.value, attackerTypeOverride: el.attackerTypeOverride.value, defenderTypeOverride: el.defenderTypeOverride.value, attackerAddType: el.attackerAddType.value, defenderAddType: el.defenderAddType.value, weather: el.weatherSelect.value, field: el.fieldSelect.value, magicRoom: el.magicRoom.checked, gravity: el.gravity.checked, protect: el.protect.checked, plasmaShower: el.plasmaShower.checked, neutralizingGasField: el.neutralizingGasField.checked,
      critical: el.critical.checked, electrify: el.electrify.checked, pledgeCombination: el.pledgeCombination.checked,
      defenderLuckyChant: el.defenderLuckyChant.checked, defenderForesight: el.defenderForesight.checked, defenderMiracleEye: el.defenderMiracleEye.checked,
      attackerEmbargo: el.attackerEmbargo.checked, defenderEmbargo: el.defenderEmbargo.checked, attackerStealthRock: el.attackerStealthRock.checked, defenderStealthRock: el.defenderStealthRock.checked,
      attackerSpikes: el.attackerSpikes.value, defenderSpikes: el.defenderSpikes.value, attackerSteelSurge: el.attackerSteelSurge.checked, defenderSteelSurge: el.defenderSteelSurge.checked, attackerRootedSmacked: el.attackerRootedSmacked.checked, defenderRootedSmacked: el.defenderRootedSmacked.checked, attackerMagnetRise: el.attackerMagnetRise.checked, defenderMagnetRise: el.defenderMagnetRise.checked, attackerTelekinesis: el.attackerTelekinesis.checked, defenderTelekinesis: el.defenderTelekinesis.checked, attackerRoost: el.attackerRoost.checked, defenderRoost: el.defenderRoost.checked, attackerBurnUp: el.attackerBurnUp.checked, defenderBurnUp: el.defenderBurnUp.checked, attackerDoubleShock: el.attackerDoubleShock.checked, defenderDoubleShock: el.defenderDoubleShock.checked,
      attackerCurrentHpInput: el.attackerCurrentHp.value, defenderCurrentHpInput: el.defenderCurrentHp.value, attackerStats: readStats('attacker'), defenderStats: readStats('defender'), transformOps: transformOps.slice(), attackerStatus: (document.getElementById('attackerStatus')||{}).value || 'なし', defenderStatus: (document.getElementById('defenderStatus')||{}).value || 'なし', defenderSemiInvulnerable: (document.getElementById('defenderSemiInvulnerable')||{}).value || 'なし', rolloutHit: document.getElementById('rolloutHit') ? document.getElementById('rolloutHit').value : '1', defenseCurl: !!(document.getElementById('defenseCurl') && document.getElementById('defenseCurl').checked), echoedVoiceCount: document.getElementById('echoedVoiceCount') ? document.getElementById('echoedVoiceCount').value : '1', moveOrder: document.getElementById('moveOrder') ? document.getElementById('moveOrder').value : 'first', targetSwitching: !!(document.getElementById('targetSwitching') && document.getElementById('targetSwitching').checked), faintedAllies: document.getElementById('faintedAllies') ? document.getElementById('faintedAllies').value : '0', supremeOverlordFaintedAllies: document.getElementById('supremeOverlordFaintedAllies') ? document.getElementById('supremeOverlordFaintedAllies').value : '0', friendship: document.getElementById('friendship') ? document.getElementById('friendship').value : '255', remainingPP: document.getElementById('remainingPP') ? document.getElementById('remainingPP').value : '4', lastMoveFailed: !!(document.getElementById('lastMoveFailed') && document.getElementById('lastMoveFailed').checked), userDamagedThisTurn: !!(document.getElementById('userDamagedThisTurn') && document.getElementById('userDamagedThisTurn').checked), targetDamagedThisTurn: !!(document.getElementById('targetDamagedThisTurn') && document.getElementById('targetDamagedThisTurn').checked), stockpileCount: document.getElementById('stockpileCount') ? document.getElementById('stockpileCount').value : '1', presentPower: document.getElementById('presentPower') ? document.getElementById('presentPower').value : '40', rageFistHitCount: document.getElementById('rageFistHitCount') ? document.getElementById('rageFistHitCount').value : '0', magnitudePower: document.getElementById('magnitudePower') ? document.getElementById('magnitudePower').value : '70', roundAllyUsed: !!(document.getElementById('roundAllyUsed') && document.getElementById('roundAllyUsed').checked), furyCutterCount: document.getElementById('furyCutterCount') ? document.getElementById('furyCutterCount').value : '1', psywaveMultiplier: document.getElementById('psywaveMultiplier') ? document.getElementById('psywaveMultiplier').value : '1', fixedDamageTaken: document.getElementById('fixedDamageTaken') ? document.getElementById('fixedDamageTaken').value : '0', defenderScreen: document.getElementById('defenderScreen') ? document.getElementById('defenderScreen').value : 'none', defenderFriendGuard: !!(document.getElementById('defenderFriendGuard') && document.getElementById('defenderFriendGuard').checked), defenderMinimized: !!(document.getElementById('defenderMinimized') && document.getElementById('defenderMinimized').checked), defenderProtectState: document.getElementById('defenderProtectState') ? document.getElementById('defenderProtectState').value : 'none', metronomeUseCount: document.getElementById('metronomeUseCount') ? document.getElementById('metronomeUseCount').value : '1', defenderForesight: !!(document.getElementById('defenderForesight') && document.getElementById('defenderForesight').checked), defenderMiracleEye: !!(document.getElementById('defenderMiracleEye') && document.getElementById('defenderMiracleEye').checked), defenderTarShot: !!(document.getElementById('defenderTarShot') && document.getElementById('defenderTarShot').checked), attackerStellarMoveCount: document.getElementById('attackerStellarMoveCount') ? document.getElementById('attackerStellarMoveCount').value : 'first', attackerDoubleDamage: !!(document.getElementById('attackerDoubleDamage') && document.getElementById('attackerDoubleDamage').checked), defenderGlaiveRush: !!(document.getElementById('defenderGlaiveRush') && document.getElementById('defenderGlaiveRush').checked), beadsOfRuinField: !!(document.getElementById('beadsOfRuinField') && document.getElementById('beadsOfRuinField').checked), swordOfRuinField: !!(document.getElementById('swordOfRuinField') && document.getElementById('swordOfRuinField').checked), defenderFlowerGiftSupport: !!(document.getElementById('defenderFlowerGiftSupport') && document.getElementById('defenderFlowerGiftSupport').checked), vesselOfRuinField: !!(document.getElementById('vesselOfRuinField') && document.getElementById('vesselOfRuinField').checked), tabletsOfRuinField: !!(document.getElementById('tabletsOfRuinField') && document.getElementById('tabletsOfRuinField').checked), flowerGiftSupport: !!(document.getElementById('flowerGiftSupport') && document.getElementById('flowerGiftSupport').checked), plusMinusSupport: !!(document.getElementById('plusMinusSupport') && document.getElementById('plusMinusSupport').checked), flashFireActivated: !!(document.getElementById('flashFireActivated') && document.getElementById('flashFireActivated').checked), stakeoutSwitchIn: !!(document.getElementById('stakeoutSwitchIn') && document.getElementById('stakeoutSwitchIn').checked), batterySupport: !!(document.getElementById('batterySupport') && document.getElementById('batterySupport').checked), powerSpotSupport: !!(document.getElementById('powerSpotSupport') && document.getElementById('powerSpotSupport').checked), steelSpiritCount: document.getElementById('steelSpiritCount') ? document.getElementById('steelSpiritCount').value : '0', helpingHandCount: document.getElementById('helpingHandCount') ? document.getElementById('helpingHandCount').value : '0', meFirst: !!(document.getElementById('meFirst') && document.getElementById('meFirst').checked), charge: !!(document.getElementById('charge') && document.getElementById('charge').checked), analyzeMovedLast: !!(document.getElementById('analyzeMovedLast') && document.getElementById('analyzeMovedLast').checked), fairyAuraField: !!(document.getElementById('fairyAuraField') && document.getElementById('fairyAuraField').checked), darkAuraField: !!(document.getElementById('darkAuraField') && document.getElementById('darkAuraField').checked), mudSport: !!(document.getElementById('mudSport') && document.getElementById('mudSport').checked), waterSport: !!(document.getElementById('waterSport') && document.getElementById('waterSport').checked), weatherSuppressField: !!(document.getElementById('weatherSuppressField') && document.getElementById('weatherSuppressField').checked), statDroppedThisTurn: !!(document.getElementById('statDroppedThisTurn') && document.getElementById('statDroppedThisTurn').checked), allyFaintedLastTurn: !!(document.getElementById('allyFaintedLastTurn') && document.getElementById('allyFaintedLastTurn').checked), beatUpAlly1: document.getElementById('beatUpAlly1') ? document.getElementById('beatUpAlly1').value : 'none', beatUpAlly2: document.getElementById('beatUpAlly2') ? document.getElementById('beatUpAlly2').value : 'none', beatUpAlly3: document.getElementById('beatUpAlly3') ? document.getElementById('beatUpAlly3').value : 'none', beatUpAlly4: document.getElementById('beatUpAlly4') ? document.getElementById('beatUpAlly4').value : 'none', beatUpAlly5: document.getElementById('beatUpAlly5') ? document.getElementById('beatUpAlly5').value : 'none', attackerTailwind: !!(document.getElementById('attackerTailwind') && document.getElementById('attackerTailwind').checked), defenderTailwind: !!(document.getElementById('defenderTailwind') && document.getElementById('defenderTailwind').checked), attackerSwamp: !!(document.getElementById('attackerSwamp') && document.getElementById('attackerSwamp').checked), defenderSwamp: !!(document.getElementById('defenderSwamp') && document.getElementById('defenderSwamp').checked), attackerSlowStart: !!(document.getElementById('attackerSlowStart') && document.getElementById('attackerSlowStart').checked), defenderSlowStart: !!(document.getElementById('defenderSlowStart') && document.getElementById('defenderSlowStart').checked), attackerUnburden: !!(document.getElementById('attackerUnburden') && document.getElementById('attackerUnburden').checked), defenderUnburden: !!(document.getElementById('defenderUnburden') && document.getElementById('defenderUnburden').checked), attackerParadoxBoostStat: document.getElementById('attackerParadoxBoostStat') ? document.getElementById('attackerParadoxBoostStat').value : 'none', defenderParadoxBoostStat: document.getElementById('defenderParadoxBoostStat') ? document.getElementById('defenderParadoxBoostStat').value : 'none', attackerBodyPurge: document.getElementById('attackerBodyPurge') ? document.getElementById('attackerBodyPurge').value : '0', defenderBodyPurge: document.getElementById('defenderBodyPurge') ? document.getElementById('defenderBodyPurge').value : '0',
      moldBreaker: false, neutralizingGas: false, attackerItemSuppressed: false, defenderItemSuppressed: false
    };
  }
  function formatKoInfo(koInfo) {
    if (!koInfo) return '計算対象外';
    if (koInfo.partial) return '乱数' + koInfo.partial.hits + '発(' + (koInfo.partial.probability * 100).toFixed(2) + '%)';
    if (koInfo.certain) return '確定' + koInfo.certain + '発';
    if (koInfo.cappedAt) return koInfo.cappedAt + '発以上でも確定せず';
    return '圏外';
  }
  function calculate() {
    const result = CALC.calculateDamage({ attacker: byId(DATA.pokemons, el.attackerSelect.value), defender: byId(DATA.pokemons, el.defenderSelect.value), move: byId(DATA.moves, el.moveSelect.value), attackerLevel: el.attackerLevel.value, defenderLevel: el.defenderLevel.value, options: buildOptions() });
    el.summary.innerHTML = ['<strong>' + result.attackerName + '</strong> の <strong>' + result.moveName + '</strong> → <strong>' + result.defenderName + '</strong>', '判定分類: <strong>' + result.effectiveCategory + '</strong>', '技タイプ: <strong>' + result.effectiveType + '</strong>', 'ダメージ: <strong>' + result.minDamage + ' ～ ' + result.maxDamage + '</strong>', '割合: <strong>' + result.minRate.toFixed(1) + '% ～ ' + result.maxRate.toFixed(1) + '%</strong>', '防御側HP: ' + result.defenderCurrentHp + ' / ' + result.defenderMaxHp, '確定数: <strong>' + formatKoInfo(result.koInfo) + '</strong>'].join('<br>');
    el.rolls.textContent = (result.multiHitRolls && result.multiHitRolls.length) ? result.multiHitRolls.join(NL) : result.rolls.join(', ');
    el.trace.textContent = formatTrace(result.trace);
  }
  function setHpFraction(side, denom) { const pokemon = byId(DATA.pokemons, el[side + 'Select'].value); const level = el[side + 'Level'].value; const stats = readStats(side); const maxHp = CALC.previewBaseMaxHp(pokemon, level, stats); el[side + 'CurrentHp'].value = Math.max(1, Math.floor(maxHp / denom)); calculate(); }
  async function copyTrace() { const text = el.trace.textContent || ''; if (!text) return; try { await navigator.clipboard.writeText(text); alert('計算過程をコピーしました。'); } catch { alert('コピーに失敗しました。'); } }
  function init() {
    createStatsGrid('attacker', el.attackerStatsGrid); createStatsGrid('defender', el.defenderStatsGrid);
    fillSelect(el.attackerSelect, DATA.pokemons); fillSelect(el.defenderSelect, DATA.pokemons); fillSelect(el.moveSelect, DATA.moves); fillSelect(el.attackerItemSelect, DATA.items); fillSelect(el.defenderItemSelect, DATA.items); fillSelect(el.attackerAbilitySelect, DATA.abilities); fillSelect(el.defenderAbilitySelect, DATA.abilities); fillSelect(el.attackerSpecialState, DATA.specialStates); fillSelect(el.defenderSpecialState, specialStatesForDefender()); fillSelect(el.attackerTeraType, DATA.teraTypes); fillSelect(el.defenderTeraType, DATA.teraTypes); fillSelect(el.attackerType1, DATA.typeOptions); fillSelect(el.attackerType2, DATA.typeOptions); fillSelect(el.defenderType1, DATA.typeOptions); fillSelect(el.defenderType2, DATA.typeOptions); fillSelect(el.weatherSelect, DATA.weatherOptions); fillSelect(el.fieldSelect, DATA.fieldOptions); fillSelectBeatUpAllies();
    el.attackerSelect.value = 'pikachu'; el.defenderSelect.value = 'venusaur'; el.moveSelect.value = 'thunderbolt'; setTypeDefaults('attacker'); setTypeDefaults('defender');
    el.attackerSelect.addEventListener('change', () => { setTypeDefaults('attacker'); calculate(); }); el.defenderSelect.addEventListener('change', () => { setTypeDefaults('defender'); calculate(); }); document.querySelectorAll('button[data-op]').forEach(btn => btn.addEventListener('click', () => { transformOps.push(btn.dataset.op); updateOpsDisplay(); calculate(); }));
    el.resetTransformOps.addEventListener('click', () => { transformOps = []; updateOpsDisplay(); calculate(); });
    el.calculateButton.addEventListener('click', calculate); el.copyTraceButton.addEventListener('click', copyTrace);
    document.querySelectorAll('button[data-hp-side]').forEach(btn => btn.addEventListener('click', () => setHpFraction(btn.dataset.hpSide, Number(btn.dataset.hpRate))));
    document.addEventListener('change', function(e){ var t=e.target; if(t && t.matches && t.matches('input,select')) calculate(); });
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
  function canDynamaxPokemon(p){const D=window.DAMEKE_DATA;return !(D.zMax&&D.zMax.dynamaxBanned||[]).includes(p.name);}
  function canGmaxPokemon(p){const D=window.DAMEKE_DATA;return (D.zMax&&D.zMax.gmaxEligible||[]).includes(p.name);}
  function specialZRule(p,m){const D=window.DAMEKE_DATA;return (D.zMax&&D.zMax.signatureZ||[]).find(r=>(r.pokemon||[]).includes(p.name)&&r.move===m.name);}
  function fillStateSelect(sel, opts){if(!sel)return;const cur=sel.value;sel.textContent = "";opts.forEach(o=>{const op=document.createElement('option');op.value=o.id;op.textContent=o.name;sel.appendChild(op);});sel.value=opts.some(o=>o.id===cur)?cur:'none';}
  function updateSpecialStateOptions(){const D=window.DAMEKE_DATA;if(!D||!D.zMax)return;const atk=current('attacker'),def=current('defender'),m=move();const atkOpts=[{id:'none',name:'なし'}];
    atkOpts.push({id:'zmove',name:'Zワザ'});
    if(specialZRule(atk,m)) atkOpts.push({id:'special_z',name:'専用Z'});
    if(canDynamaxPokemon(atk)) atkOpts.push({id:'dynamax',name:'ダイマックス'});
    if(canDynamaxPokemon(atk)&&canGmaxPokemon(atk)) atkOpts.push({id:'gmax',name:'キョダイマックス'});
    const defOpts=[{id:'none',name:'なし'}];
    if(canDynamaxPokemon(def)) defOpts.push({id:'dynamax',name:'ダイマックス'});
    if(canDynamaxPokemon(def)&&canGmaxPokemon(def)) defOpts.push({id:'gmax',name:'キョダイマックス'});
    fillStateSelect(q('attackerSpecialState'),atkOpts);fillStateSelect(q('defenderSpecialState'),defOpts);
  }
  function initV021(){['attackerSelect','defenderSelect','moveSelect'].forEach(id=>{const e=q(id);if(e)e.addEventListener('change',updateSpecialStateOptions);});setTimeout(updateSpecialStateOptions,0);}
  window.__damekeInitV021 = initV021;
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
  function attachSearchCombo(selectId){
    var select = q(selectId);
    if(!select || select.getAttribute('data-v082h-search')) return;
    select.setAttribute('data-v082h-search', '1');

    var wrap = make('div','v082h-search-combo');
    var input = document.createElement('input');
    input.type = 'text'; input.className = 'v082h-search-input'; input.autocomplete = 'off';
    var list = document.createElement('ul');
    list.className = 'v082h-search-list'; list.hidden = true;
    document.body.appendChild(list);

    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(input); wrap.appendChild(select);
    select.classList.add('v082h-hide');

    function currentText(){ var o=select.options[select.selectedIndex]; return o ? o.textContent : ''; }
    input.value = currentText();

    var options = Array.prototype.map.call(select.options, function(o){ return { value:o.value, text:o.textContent, norm:kanaNormalize(o.textContent) }; });
    var activeIndex = -1;

    function positionList(){
      var r = input.getBoundingClientRect();
      list.style.position = 'fixed';
      list.style.left = r.left + 'px';
      list.style.top = (r.bottom + 2) + 'px';
      list.style.width = r.width + 'px';
    }
    function closeList(){ list.hidden = true; }
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
      positionList();
      list.hidden = false;
    }
    function choose(o){
      select.value = o.value; input.value = o.text; closeList();
      dispatchChange(select);
    }
    function updateActive(items){
      items.forEach(function(li,i){ li.classList.toggle('active', i===activeIndex); });
      if(activeIndex>=0 && items[activeIndex]) items[activeIndex].scrollIntoView({block:'nearest'});
    }
    input.addEventListener('focus', function(){ renderList(''); input.select(); });
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
    window.addEventListener('scroll', function(e){ if(!list.hidden && e.target !== list) closeList(); }, true);
    window.addEventListener('resize', function(){ if(!list.hidden) closeList(); });
  }
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
  function box(title, cls){ var s=make('section','sub-card v082h-box '+(cls||'')); s.appendChild(make('h3','',title)); return s; }
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
    var swap=make('button','v082h-primary','攻防交代'); swap.type='button'; swap.addEventListener('click', swapSides);
    toolbar.appendChild(swap);
    root.appendChild(toolbar);

    root.appendChild(buildSideTabs());
    var grid=make('div','v082h-basic-grid'); grid.id='v082hBasicGrid'; root.appendChild(grid);
    var atk=box('攻撃側','v082h-attacker');
    var def=box('防御側','v082h-defender');
    grid.appendChild(atk); grid.appendChild(def);
    buildSide('attacker', atk, true);
    buildSide('defender', def, false);
    top.classList.add('v082h-hide');
    all('.side-panel').forEach(function(p){ p.classList.add('v082h-hide'); });
    hideOldItemAbilityBox();
    var calc=q('calculateButton'); if(calc) calc.classList.add('v082h-hide');
    var copy=q('copyTraceButton'); var traceEl=q('trace');
    if(copy && traceEl && traceEl.parentNode){ traceEl.parentNode.insertBefore(copy, traceEl.nextSibling); copy.classList.add('v082h-secondary-action'); }
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
    var specialGrid=make('div','v082h-mini-grid'); dest.appendChild(specialGrid);
    moveLabel(side+'SpecialState', specialGrid);
    moveLabel(side+'TeraType', specialGrid);
    if(isAttack){ var teraZone=make('div','v082h-zone'); teraZone.id='v082hAttackerTeraZone'; dest.appendChild(teraZone); }
    addStatsPanel(side, dest);
    if(isAttack){ moveLabel('moveSelect', dest); relabel('moveSelect','技'); var moveLabelEl=labelOf('moveSelect'); if(moveLabelEl){ moveLabelEl.classList.add('dameke-main-control-label'); } attachSearchCombo('moveSelect'); var moveZone=make('div','v082h-zone'); moveZone.id='v082hMoveZone'; dest.appendChild(moveZone); moveLabel('critical', dest); }
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
  function applyHpFraction(side, denom){
    var C=window.DAMEKE_CALC, p=currentPokemon(side);
    if(!C || !p || !C.previewBaseMaxHp) return;
    var level=valueOf(side+'Level');
    var maxHp=C.previewBaseMaxHp(p, level, statsSnapshot(side));
    var input=q(side+'CurrentHp'); if(!input) return;
    input.value=String(Math.max(1, Math.floor(maxHp/denom)));
    dispatchChange(input);
  }

  function addStatsPanel(side, dest){
    var panel=make('div','v082h-stats-panel'); panel.id='v082hStatsPanel_'+side;
    dest.appendChild(panel);
    panel.appendChild(make('div','v082h-minititle','詳細ステータス'));

    addNatureField(side, panel);

    var visible=make('div','v082h-stat-table'); panel.appendChild(visible);
    visible.appendChild(statHeader(['H','A','B','C','D','S']));
    visible.appendChild(statRow(side,'努力値',['H','A','B','C','D','S'],'ev'));
    visible.appendChild(statRow(side,'ランク',['H','A','B','C','D','S'],'rank'));

    var accEva=make('div','v082h-stat-table v082h-rank-sub'); panel.appendChild(accEva);
    accEva.appendChild(statHeader(['acc','eva']));
    accEva.appendChild(statRow(side,'ランク',['acc','eva'],'rank'));

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
    dispatchChange(q(side+'_H_ev'));
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
    return row;
  }
  function addLevelIvFold(side, panel){
    var d=details('レベル・個体値','v082h-details v082h-type-effects',false); panel.appendChild(d);
    var lr=levelRow(side); if(lr) d.appendChild(lr);
    var ivTable=make('div','v082h-stat-table'); d.appendChild(ivTable);
    ivTable.appendChild(statHeader(['H','A','B','C','D','S']));
    ivTable.appendChild(statRow(side,'個体値',['H','A','B','C','D','S'],'iv'));
  }
  function statHeader(stats){ var row=make('div','v082h-stat-row v082h-stat-head'); row.appendChild(make('span','','')); stats.forEach(function(k){ row.appendChild(make('span','',labelStat(k))); }); return row; }
  function labelStat(k){ return {H:'H',A:'A',B:'B',C:'C',D:'D',S:'S',acc:'命中',eva:'回避'}[k] || k; }
  function statRow(side,label,stats,kind){ var row=make('div','v082h-stat-row'); row.appendChild(make('span','v082h-stat-label',label)); stats.forEach(function(k){ var input=q(side+'_'+k+'_'+kind); var cell=make('span','v082h-stat-cell'); if(input) cell.appendChild(input); else cell.textContent='-'; row.appendChild(cell); }); return row; }

  function setupZones(){
    if(q('v082hMoveDetails')) return;
    var abilityA=q('v082hAttackerAbilityZone'), abilityD=q('v082hDefenderAbilityZone'), itemA=q('v082hAttackerItemZone'), itemD=q('v082hDefenderItemZone'), tera=q('v082hAttackerTeraZone'), move=q('v082hMoveZone');
    if(abilityA) abilityA.appendChild(zone('v082hAbilityDetails','特性固有条件'));
    if(abilityD) abilityD.appendChild(zone('v082hDefenderAbilityDetails','特性固有条件'));
    if(itemA) itemA.appendChild(zone('v082hItemDetails','持ち物固有条件'));
    if(itemD) itemD.appendChild(zone('v082hDefenderItemDetails','持ち物固有条件'));
    if(tera) tera.appendChild(zone('v082hTeraDetails','テラスタル固有条件'));
    if(move) move.appendChild(zone('v082hMoveDetails','技固有条件'));
    relabelControls(); moveConditionalLabels();
  }
  function relabelControls(){
    [['flashFireActivated','ほのお技被弾'],['stakeoutSwitchIn','防御側繰り出し'],['supremeOverlordFaintedAllies','味方ひんし数'],['attackerSlowStart','発動'],['attackerUnburden','発動'],['attackerParadoxBoostStat','上昇する能力値'],['analyzeMovedLast','行動順'],['defenderSlowStart','発動'],['defenderUnburden','発動'],['defenderParadoxBoostStat','上昇する能力値'],['metronomeUseCount','回数'],['attackerStellarMoveCount','ステラ技回数'],['pledgeCombination','コンビネーション'],['psywaveMultiplier','倍率'],['fixedDamageTaken','被ダメ'],['statDroppedThisTurn','自身のランク下降'],['allyFaintedLastTurn','前ターン味方ひんし'],['defenseCurl','まるくなる'],['echoedVoiceCount','回数'],['presentPower','威力'],['magnitudePower','威力'],['roundAllyUsed','同ターン内りんしょう'],['furyCutterCount','回数']].forEach(function(x){ relabel(x[0],x[1]); });
    for(var i=1;i<=5;i++) relabel('beatUpAlly'+i,'控え'+i);
  }
  function moveConditionalLabels(){
    var ability=q('v082hAbilityDetails'), defAbility=q('v082hDefenderAbilityDetails'), item=q('v082hItemDetails'), tera=q('v082hTeraDetails'), move=q('v082hMoveDetails');
    ['flashFireActivated','stakeoutSwitchIn','supremeOverlordFaintedAllies','attackerSlowStart','attackerUnburden','attackerParadoxBoostStat','analyzeMovedLast'].forEach(function(id){ moveLabel(id, ability); });
    ['defenderSlowStart','defenderUnburden','defenderParadoxBoostStat'].forEach(function(id){ moveLabel(id, defAbility); });
    ['metronomeUseCount'].forEach(function(id){ moveLabel(id, item); });
    ['attackerStellarMoveCount'].forEach(function(id){ moveLabel(id, tera); });
    ['pledgeCombination','psywaveMultiplier','fixedDamageTaken','statDroppedThisTurn','allyFaintedLastTurn','beatUpAlly1','beatUpAlly2','beatUpAlly3','beatUpAlly4','beatUpAlly5','rolloutHit','defenseCurl','echoedVoiceCount','moveOrder','targetSwitching','faintedAllies','friendship','remainingPP','lastMoveFailed','userDamagedThisTurn','targetDamagedThisTurn','stockpileCount','presentPower','rageFistHitCount','magnitudePower','roundAllyUsed','furyCutterCount'].forEach(function(id){ moveLabel(id, move); });
  }

  function show(id, visible){ var l=labelOf(id); if(l) l.style.display=visible?'':'none'; }
  function detailVisible(id){ var d=q(id); if(!d) return; var visible=false; all('label',d).forEach(function(l){ if(l.style.display!=='none') visible=true; }); d.style.display=visible?'':'none'; if(visible) d.open=true; }
  function selectedMove(){ var D=window.DAMEKE_DATA || {}; return (D.moves||[]).find(function(m){ return m.id===valueOf('moveSelect'); }) || {}; }
  function updateConditional(){
    var m=selectedMove(), move=optionText('moveSelect'), kind=m.powerKind||'', ab=optionText('attackerAbilitySelect'), dab=optionText('defenderAbilitySelect'), item=optionText('attackerItemSelect'), tera=valueOf('attackerTeraType');
    show('flashFireActivated', ab==='もらいび'); show('stakeoutSwitchIn', ab==='はりこみ'); show('supremeOverlordFaintedAllies', ab==='そうだいしょう');
    show('attackerSlowStart', ab==='スロースタート'); show('attackerUnburden', ab==='かるわざ'); show('attackerParadoxBoostStat', ab==='こだいかっせい'||ab==='クォークチャージ'); show('analyzeMovedLast', ab==='アナライズ');
    show('defenderSlowStart', dab==='スロースタート'); show('defenderUnburden', dab==='かるわざ'); show('defenderParadoxBoostStat', dab==='こだいかっせい'||dab==='クォークチャージ');
    show('metronomeUseCount', item==='メトロノーム'); show('attackerStellarMoveCount', tera==='ステラ');
    show('pledgeCombination', ['くさのちかい','ほのおのちかい','みずのちかい','クロスサンダー','クロスフレイム'].indexOf(move)>=0);
    show('psywaveMultiplier', move==='サイコウェーブ'); show('fixedDamageTaken', ['カウンター','ミラーコート','がまん','メタルバースト','ほうふく'].indexOf(move)>=0);
    show('statDroppedThisTurn', move==='うっぷんばらし'); show('allyFaintedLastTurn', move==='かたきうち'); var beat=move==='ふくろだたき'||kind==='BeatUp'; for(var i=1;i<=5;i++) show('beatUpAlly'+i, beat);
    show('rolloutHit', kind==='Rollout'); show('defenseCurl', kind==='Rollout'); show('echoedVoiceCount', kind==='EchoedVoice'); show('moveOrder', kind==='DoubleIfFirst'||kind==='DoubleIfMovedSecond'); show('targetSwitching', kind==='Pursuit'); show('faintedAllies', kind==='LastRespects'); show('friendship', kind==='Friendship'||kind==='Frustration'); show('remainingPP', kind==='TrumpCard'); show('lastMoveFailed', kind==='DoubleIfLastMoveFailed'); show('userDamagedThisTurn', kind==='DoubleIfUserDamaged'); show('targetDamagedThisTurn', kind==='DoubleIfTargetDamaged'); show('stockpileCount', kind==='SpitUp'); show('presentPower', kind==='Present'); show('rageFistHitCount', kind==='RageFist'); show('magnitudePower', kind==='Magnitude'); show('roundAllyUsed', kind==='Round'); show('furyCutterCount', kind==='FuryCutter');
    ['v082hAbilityDetails','v082hDefenderAbilityDetails','v082hItemDetails','v082hDefenderItemDetails','v082hTeraDetails','v082hMoveDetails'].forEach(detailVisible);
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

    var atk=buildConditionDetails('攻撃側条件',
      ['attackerStatus','attackerEmbargo','attackerStealthRock','attackerSpikes','attackerSteelSurge','electrify','plasmaShower','charge','meFirst','attackerRootedSmacked','attackerMagnetRise','attackerTelekinesis','attackerBodyPurge','attackerTailwind'],
      ['attackerDoubleDamage','helpingHandCount','powerSpotSupport','batterySupport','flowerGiftSupport','plusMinusSupport','steelSpiritCount','attackerSwamp']);

    relabel('defenderSemiInvulnerable','姿を隠す');
    relabel('defenderProtectState','まもる');
    var def=buildConditionDetails('防御側条件',
      ['defenderStatus','defenderEmbargo','defenderStealthRock','defenderSpikes','defenderSteelSurge','defenderScreen','defenderTarShot','defenderLuckyChant','defenderGlaiveRush','defenderMinimized','defenderSemiInvulnerable','defenderProtectState','defenderRootedSmacked','defenderMagnetRise','defenderTelekinesis','defenderForesight','defenderMiracleEye','defenderBodyPurge','defenderTailwind'],
      ['defenderFlowerGiftSupport','defenderFriendGuard','defenderSwamp']);

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

  function swapValue(a,b){ var ea=q(a), eb=q(b); if(!ea||!eb) return; var av=ea.type==='checkbox'?ea.checked:ea.value; var bv=eb.type==='checkbox'?eb.checked:eb.value; if(ea.type==='checkbox') ea.checked=bv; else ea.value=bv; if(eb.type==='checkbox') eb.checked=av; else eb.value=av; }
  function swapSides(){ var pairs=[['attackerSelect','defenderSelect'],['attackerLevel','defenderLevel'],['attackerSpecialState','defenderSpecialState'],['attackerTeraType','defenderTeraType'],['attackerGender','defenderGender'],['attackerType1','defenderType1'],['attackerType2','defenderType2'],['attackerTypeOverride','defenderTypeOverride'],['attackerAddType','defenderAddType'],['attackerItemSelect','defenderItemSelect'],['attackerNoItem','defenderNoItem'],['attackerAbilitySelect','defenderAbilitySelect'],['attackerNoAbility','defenderNoAbility'],['attackerCurrentHp','defenderCurrentHp'],['attackerStatus','defenderStatus']]; pairs.forEach(function(p){ swapValue(p[0],p[1]); }); ['H','A','B','C','D','S','acc','eva'].forEach(function(k){ ['iv','ev','rank'].forEach(function(kind){ swapValue('attacker_'+k+'_'+kind,'defender_'+k+'_'+kind); }); }); swapValue('attacker_nature','defender_nature'); ['attackerSelect','defenderSelect','attackerAbilitySelect','defenderAbilitySelect','attackerItemSelect','defenderItemSelect','moveSelect'].forEach(function(id){ dispatchChange(q(id)); }); refreshAll(); }

  function summaryLines(){ var src=q('summary'); if(!src) return []; var html=String(src.innerHTML||'').split('<br>').join('\n').split('<br/>').join('\n').split('<br />').join('\n'); var div=document.createElement('div'); div.innerHTML=html; return String(div.textContent||'').split('\n').map(function(x){return x.trim();}).filter(Boolean); }
  function linesOf(el){ return el ? String(el.innerText || el.textContent || '').split('\n').map(function(x){return x.trim();}).filter(Boolean) : []; }
  function valueAfter(lines,prefix){ for(var i=0;i<lines.length;i++){ if(lines[i].indexOf(prefix)===0) return lines[i].slice(prefix.length).trim(); } return ''; }
  function digits(s){ var arr=[], cur=''; s=String(s||''); for(var i=0;i<s.length;i++){ var c=s.charAt(i); if(c>='0'&&c<='9') cur+=c; else if(cur){ arr.push(Number(cur)); cur=''; } } if(cur) arr.push(Number(cur)); return arr; }
  function traceLine(key){ var lines=linesOf(q('trace')); for(var i=0;i<lines.length;i++){ if(lines[i].indexOf(key)>=0) return lines[i]; } return ''; }
  function compactPower(line){ var txt=String(line||'').trim(); if(txt==='-') return '-'; var nums=[], re=/回目=([0-9]+)/g, m; while((m=re.exec(txt))) nums.push(m[1]); if(nums.length) return nums.join(','); m=txt.match(/最終威力:\s*([0-9]+)/); return m?m[1]:'未計算'; }
  function cleanCurrent(s){ return String(s||'').replace(/^.*?\]\s*/,'').replace(/^現在値:\s*/,'').trim(); }
  function statText(side, key, kind) { var el = q(side+'_'+key+'_'+kind); return el ? el.value : ''; }
  function natureText(side) { var el = q(side+'_nature'); if (!el) return ''; var opt = el.options[el.selectedIndex]; return opt ? opt.textContent : ''; }
  function statRefFor(labelKey, fallbackSide, fallbackKey) {
    var line = traceLine(labelKey);
    var m = line.match(/(攻撃側|防御側)ランク補正込み([ABCD])参照/);
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
  function buildHpBar(maxHp, minRemain, maxRemain) {
    var track = make('div','v082h-hpbar-track');
    if (!maxHp || maxHp <= 0) return track;
    function pct(v){ return Math.max(0, Math.min(100, v / maxHp * 100)); }
    var colorClass = hpColorClass(maxRemain, maxHp);
    var solid = make('div', 'v082h-hpbar-seg v082h-hpbar-solid ' + colorClass);
    solid.style.width = pct(maxRemain) + '%';
    var uncertain = make('div', 'v082h-hpbar-seg v082h-hpbar-uncertain ' + colorClass);
    uncertain.style.width = Math.max(0, pct(minRemain) - pct(maxRemain)) + '%';
    track.appendChild(solid);
    track.appendChild(uncertain);
    return track;
  }
  function resultRow(container, label, value){ var item=make('div','v082h-result-item'); item.appendChild(make('span','v082h-result-key',label)); item.appendChild(make('span','v082h-result-value',value||'未計算')); container.appendChild(item); }
  function renderResult(){
    var src=q('summary'); if(!src) return;
    var lines=summaryLines();
    var cat=valueAfter(lines,'判定分類:');
    var type=valueAfter(lines,'技タイプ:');
    var dmg=valueAfter(lines,'ダメージ:');
    var rate=valueAfter(lines,'割合:');
    var hp=valueAfter(lines,'防御側HP:');
    var certainty=valueAfter(lines,'確定数:')||'未計算';
    var power=compactPower(traceLine('変動後威力'));
    var priority=cleanCurrent(traceLine('優先度'))||'未計算';
    var invalid=cleanCurrent(traceLine('無効要素'))||'なし';
    var dn=digits(dmg), hn=digits(hp);

    // ---- compact HP-bar summary: this is the only part pinned at the top on narrow screens ----
    var panel=q('v082hResultPanel');
    if(!panel){ panel=make('div','v082h-result-panel'); panel.id='v082hResultPanel'; src.parentNode.insertBefore(panel,src); src.classList.add('v082h-hide'); }
    panel.innerHTML='';
    panel.appendChild(make('div','v082h-hp-infoline', dmg+'（'+rate+'）'));
    panel.appendChild(make('div','v082h-hp-infoline2', certainty+'　瀕死率:未実装'));

    var maxHp=0;
    if (dn.length>=2 && hn.length>=2) {
      var minDmg=dn[0], maxDmg=dn[1], curHp=hn[0]; maxHp=hn[1];
      var minRemain=Math.max(0, curHp-minDmg), maxRemain=Math.max(0, curHp-maxDmg);
      var barWrap=make('div','v082h-hpbar-wrap');
      barWrap.appendChild(buildHpBar(maxHp, minRemain, maxRemain));
      barWrap.appendChild(make('div','v082h-hpbar-nums', maxRemain+' ～ '+minRemain+' / '+maxHp));
      panel.appendChild(barWrap);
    }

    var atkRef = statRefFor('補正後攻撃側実数値', 'attacker', cat==='特殊'?'C':'A');
    var defRef = statRefFor('補正後防御側実数値', 'defender', cat==='特殊'?'D':'B');
    var sideGrid = make('div','v082h-result-sidegrid');
    panel.appendChild(sideGrid);
    var atkCol = make('div','v082h-result-col'), defCol = make('div','v082h-result-col');
    sideGrid.appendChild(atkCol); sideGrid.appendChild(defCol);
    resultRow(atkCol, '性格', natureText('attacker'));
    resultRow(defCol, '性格', natureText('defender'));
    if (cat !== '変化') {
      var atkSideJp = atkRef.side==='attacker' ? '攻' : '防';
      resultRow(atkCol, '努力値('+atkSideJp+atkRef.key+')', statText(atkRef.side, atkRef.key, 'ev'));
      resultRow(defCol, '努力値(H/'+defRef.key+')', statText('defender','H','ev')+' / '+statText('defender',defRef.key,'ev'));
      resultRow(atkCol, 'ランク('+atkSideJp+atkRef.key+')', statText(atkRef.side, atkRef.key, 'rank'));
      resultRow(defCol, 'ランク('+defRef.key+')', statText('defender',defRef.key,'rank'));
    }

    // ---- full detail panel + rolls/trace: restored as-is, normal flow, not pinned ----
    var detail=q('v082hResultDetailPanel');
    if(!detail){ detail=make('div','v082h-result-panel'); detail.id='v082hResultDetailPanel'; panel.parentNode.insertBefore(detail, panel.nextSibling); }
    detail.innerHTML='';
    var grid=make('div','v082h-result-grid');
    detail.appendChild(grid);
    [['技分類',cat],['技タイプ',type],['技威力',power],['ダメージ',dmg],['割合',rate],['確定数',certainty],['命中・必中','未計算'],['優先度',priority],['無効要素',invalid],['みがわり','未実装'],['瀕死率','未実装']].forEach(function(r){ resultRow(grid, r[0], r[1]); });

    requestAnimationFrame(function(){
      document.documentElement.style.setProperty('--v082h-fixed-panel-h', panel.offsetHeight + 'px');
    });
  }
  function setupResult(){ var s=q('summary'), t=q('trace'); if(!s) return; var obs=new MutationObserver(renderResult); obs.observe(s,{childList:true,subtree:true,characterData:true}); if(t) obs.observe(t,{childList:true,subtree:true,characterData:true}); setTimeout(renderResult,0); }
  function refreshAll(){ updateAbilityButtons('attacker'); updateAbilityButtons('defender'); updateConditional(); renderResult(); }
  function bind(){ ['attackerSelect','defenderSelect'].forEach(function(id){ var e=q(id); if(e) e.addEventListener('change',function(){ setTimeout(refreshAll,0); }); }); ['moveSelect','attackerAbilitySelect','defenderAbilitySelect','attackerItemSelect','attackerTeraType'].forEach(function(id){ var e=q(id); if(e) e.addEventListener('change',function(){ setTimeout(updateConditional,0); }); }); }

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
  function buildLayoutAndZones(){
    safeStep('installLayout', installLayout);
    safeStep('setupZones', setupZones);
    safeStep('restructureConditions', restructureConditions);
    safeStep('finalizeSearchCombos', finalizeSearchCombos);
  }
  function initializeLayoutAndZones(){
    buildLayoutAndZones();
  }
  function init(){ document.body.classList.add('v082h-ui'); initializeLayoutAndZones(); setActiveSide('attacker'); bind(); refreshAll(); setupResult(); }
    window.DAMEKE_UI_V082H_COND_DEBUG=function(){
    function info(el){
      if(!el) return {found:false};
      var cs=window.getComputedStyle(el);
      return {found:true,tag:el.tagName,className:el.className,inlineStyle:el.getAttribute('style'),computedDisplay:cs.display,computedGridTemplateColumns:cs.gridTemplateColumns,childCount:el.children.length,open:el.open};
    }
    var wrap=document.querySelector('.v082h-cond-wrap');
    var detailsInWrap=wrap?all('details',wrap).filter(function(d){return d.parentNode===wrap;}):[];
    var doubleFolds=all('.v082h-double-fold');
    return {
      wrap: info(wrap),
      atk: info(detailsInWrap[0]),
      def: info(detailsInWrap[1]),
      doubleFoldCount: doubleFolds.length,
      doubleFolds: doubleFolds.map(info)
    };
  };
  window.DAMEKE_UI_V082H_ABILITY_DEBUG=function(){
    function info(id){
      var sel=q(id);
      if(!sel) return {found:false};
      var combo=sel.closest('.v082h-search-combo');
      var label=sel.closest('label');
      return {
        found:true,
        hasSearchAttr: sel.getAttribute('data-v082h-search'),
        selectHidden: sel.classList.contains('v082h-hide'),
        comboExists: !!combo,
        comboHasInput: combo ? !!combo.querySelector('.v082h-search-input') : false,
        labelClassName: label ? label.className : null,
        labelText: label ? label.textContent : null
      };
    }
    return { attacker: info('attackerAbilitySelect'), defender: info('defenderAbilitySelect') };
  };
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
  function byId(id){ return document.getElementById(id); }
  function sidePrefix(side){ return side === 'A' ? 'attacker' : 'defender'; }
  function pokemonSelect(side){ return byId(sidePrefix(side) + 'Select'); }
  function itemSelect(side){ return byId(sidePrefix(side) + 'ItemSelect'); }
  function abilitySelect(side){ return byId(sidePrefix(side) + 'AbilitySelect'); }
  function moveSelect(){ return byId('moveSelect'); }
  function sexSelect(side){ return byId(sidePrefix(side) + 'SexSelect'); }
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
      var el = byId(exact[x]);
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
    var sel = byId(id);
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
    var specs = [['','指定なし'], ['♂','♂'], ['♀','♀'], ['不明','性別不明']];
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
    if(p.formLinkedTerastal) setSelectSilent(teraSelect(side), p.formLinkedTerastal);
    if(p.formLinkedSex) setSelectSilent(ensureSexField(side), p.formLinkedSex);
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
    var t1 = byId(prefix + 'Type1');
    var t2 = byId(prefix + 'Type2');
    var types = Array.isArray(p.types) ? p.types : [];
    if(t1) setSelectSilent(t1, types[0] || 'なし');
    if(t2) setSelectSilent(t2, types[1] || 'なし');
    if(withLinked) applyLinked(side, p);
    setDefaultAbility(side, p);
    // Refresh visible ability chips when a form button commits a new Pokemon.
    // Keep the ability buttons synchronized with the committed Pokemon.
    var abilityHost = byId('v082hAbilityButtons_' + prefix) || byId('v082gAbilityButtons_' + prefix) || byId('v082fAbilityButtons_' + prefix);
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
    var old = byId(oldId);
    if(old) old.remove();
    var anchor = anchorAfterPokemon(side);
    if(!anchor) return null;
    var panel = byId(id);
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
  function handleLinkedManual(side, kind){
    if(syncing) return;
    var p = selectedPokemon(side);
    if(!p) return;
    var target = null;
    if(kind === 'item' && D.findFormByLinkedItem) target = D.findFormByLinkedItem(p, optionText(itemSelect(side)));
    if(kind === 'tera' && D.findFormByLinkedTerastal) target = D.findFormByLinkedTerastal(p, optionText(teraSelect(side)));
    if(kind === 'sex' && D.findFormByLinkedSex) target = D.findFormByLinkedSex(p, optionText(ensureSexField(side)));
    if(target && target.name !== p.name){
      commitPokemon(side, target, false);
      return;
    }
    if(D.getFormDefaultPokemon){
      var lost = false;
      if((p.formLinkedItem1 || p.formLinkedItem2) && optionText(itemSelect(side)) !== p.formLinkedItem1 && optionText(itemSelect(side)) !== p.formLinkedItem2) lost = true;
      if(p.formLinkedTerastal && optionText(teraSelect(side)) !== p.formLinkedTerastal) lost = true;
      if(p.formLinkedSex && optionText(ensureSexField(side)) !== p.formLinkedSex) lost = true;
      if(lost){
        var base = D.getFormDefaultPokemon(p);
        if(base && base.name !== p.name) commitPokemon(side, base, false);
      }
    }
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
      ts.addEventListener('change', function(){ setTimeout(function(){ handleLinkedManual(side, 'tera'); }, 0); });
    }
    var ss = ensureSexField(side);
    if(ss && !ss.dataset.v091Form){
      ss.dataset.v091Form = '1';
      ss.addEventListener('change', function(){ setTimeout(function(){ handleLinkedManual(side, 'sex'); }, 0); });
    }
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
  })();

/* Form-change runtime END */





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
      version: 'v1.0.3',
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
