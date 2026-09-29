// ==== shared active-item / active-ability helpers ====
// Consolidates ~16 near-duplicate copies of this logic that had accumulated across
// the file's many patch layers into one canonical implementation per behavior variant.
// Behavior is unchanged from before -- this only removes the duplicated text.
/* v2.5.2 ジュエルが発動しない技: 変化技・一撃必殺技・わるあがき・くさのちかい・ほのおのちかい・みずのちかい。 */
window.DAMEKE_GEM_ELIGIBLE = function(move, name){
  var n = name || (move && move.name) || '';
  if(move && move.category === '変化') return false;
  if(move && move.fixedDamageKind === 'ohko') return false;
  return ['わるあがき','くさのちかい','ほのおのちかい','みずのちかい'].indexOf(n) < 0;
};
(function(){
  if(window.DAMEKE_CALC_SHARED) return;
  var D = window.DAMEKE_DATA;
  function by(list,id){ return (list||[]).find(function(x){ return x.id===id; }) || (list||[])[0]; }

  // Variant "WithFallback": prefer the core result's already-computed active state;
  // if unavailable, independently re-derive from the raw held-item/ability + field flags.
  function activeItemWithFallback(side,item,o){
    if(o&&o.__coreState){
      var st=side==='A'?o.__coreState.attackerItemState:o.__coreState.defenderItemState;
      var coreItem=side==='A'?o.__coreState.attackerItem:o.__coreState.defenderItem;
      if(st&&coreItem&&item&&coreItem.id===item.id) return !!st.active;
    }
    if(!item||item.id==='none') return false;
    if(side==='A'&&o.attackerNoItem) return false;
    if(side==='D'&&o.defenderNoItem) return false;
    if(o.magicRoom) return false;
    if(side==='A'&&o.attackerEmbargo) return false;
    if(side==='D'&&o.defenderEmbargo) return false;
    return true;
  }
  function activeAbilityWithFallback(side,ab,o){
    if(o&&o.__coreState){
      var st=side==='A'?o.__coreState.attackerAbilityState:o.__coreState.defenderAbilityState;
      if(st&&st.ability&&ab&&st.ability.id===ab.id) return !!st.active;
    }
    if(!ab||ab.id==='なし') return false;
    if(side==='A'&&o.attackerNoAbility) return false;
    if(side==='D'&&o.defenderNoAbility) return false;
    if(ab.name==='マルチタイプ'||ab.name==='ARシステム') return true;
    if(o.neutralizingGasField) return false;
    var other=by(D.abilities,side==='A'?o.defenderAbilityId:o.attackerAbilityId);
    var otherNo=side==='A'?o.defenderNoAbility:o.attackerNoAbility;
    if(other&&!otherNo&&other.name==='かがくへんかガス') return false;
    return true;
  }

  // Variant "CoreOnly": trust only the core result's state; if it's unavailable
  // (e.g. called before the core has run), report inactive rather than guessing.
  function activeItemCoreOnly(side,item,o,result){
    var core=(result&&result.__coreState)||(o&&o.__coreState);
    if(core){
      var st=side==='A'?core.attackerItemState:core.defenderItemState;
      var coreItem=side==='A'?core.attackerItem:core.defenderItem;
      if(st&&coreItem&&item&&coreItem.id===item.id) return !!st.active;
    }
    return false;
  }
  function activeAbilityCoreOnly(side,ab,o,result){
    var core=(result&&result.__coreState)||(o&&o.__coreState);
    if(core){
      var st=side==='A'?core.attackerAbilityState:core.defenderAbilityState;
      if(st&&st.ability&&ab&&st.ability.id===ab.id) return !!st.active;
    }
    return false;
  }

  function num(v,f){ var n=parseInt(v,10); return Number.isFinite(n) ? n : f; }
  function parseAfterArrow(result,labelPart){
    var line=(result.trace||[]).find(function(x){ return String(x.label).includes(labelPart); });
    if(!line) return null;
    var m=String(line.value).match(/->\s*(\d+)/);
    return m ? num(m[1],null) : null;
  }

  function attackerCalcTypes(result){ var line=(result.trace||[]).find(function(x){return String(x.label).includes('計算上タイプ（攻撃側）');}); return line?String(line.value||'').split('/').filter(Boolean):[]; }
  function defenderCalcTypes(result){ var line=(result.trace||[]).find(function(x){return String(x.label).includes('計算上タイプ（防御側）');}); return line?String(line.value||'').split('/').filter(Boolean):[]; }
  function isGrounded(result,side){ var label=side==='A'?'接地判定（攻撃側）':'接地判定（防御側）'; var line=(result.trace||[]).find(function(x){return String(x.label).includes(label);}); return !line||line.value==='有効'; }
  function contactActive(result){
    if(result && typeof result.contactEffective === 'boolean') return result.contactEffective;
    var line=(result.trace||[]).find(function(x){return String(x.label).includes('直接攻撃判定');});
    return !!(line && String(line.value).includes('直接') && !String(line.value).includes('非直接'));
  }
  function isZOrMax(result,o){
    var line=(result.trace||[]).find(function(x){return String(x.label).includes('Z・ダイマックス（攻撃側）');});
    var nm=String((line&&line.name)||''), val=String((line&&line.value)||'');
    return (val==='有効'&&(nm==='Zワザ'||nm==='専用Z'||nm==='ダイマックス'||nm==='キョダイマックス')) || (o.attackerSpecialState&&o.attackerSpecialState!=='none');
  }
  function isAbility(name,ab,ok){ return ok && ab && ab.name===name; }
  function moveName(result,input){ return result.moveName || input.move.name; }
  function protectedPierceMove(n,maxGuard){ return window.DAMEKE_DATA_HELPERS.moveTagByName(n, maxGuard ? 'maxGuardBypass' : 'protectBypass'); }
  function protectInfo(result,input,o){
    var state=o.defenderProtectState||'none', n=moveName(result,input);
    if(state==='none') return {rate:4096,invalid:false,reason:'なし'};
    if(state==='maxGuard'){
      if(protectedPierceMove(n,true)) return {rate:4096,invalid:false,reason:'ダイウォール例外 '+n};
      return {rate:0,invalid:true,reason:'ダイウォール'};
    }
    if(protectedPierceMove(n,false)) return {rate:4096,invalid:false,reason:'まもる例外 '+n};
    if(isZOrMax(result,o)) return {rate:1024,invalid:false,reason:'Z/ダイマ技のまもる貫通25%'};
    var aAb=by(D.abilities,o.attackerAbilityId||'なし');
    if(activeAbilityCoreOnly('A',aAb,o,result) && window.DAMEKE_DATA_HELPERS.abilityTag(aAb,'protectPiercingContact') && contactActive(result))
      return {rate:1024,invalid:false,reason:aAb.name+'+直接攻撃'};
    return {rate:0,invalid:true,reason:'まもる'};
  }
  function getHitSpec(move){
    if(!move) return null;
    var min = move.hitCountMin != null ? num(move.hitCountMin, 1) : null;
    var max = move.hitCountMax != null ? num(move.hitCountMax, 1) : null;
    var hitCount = move.hitCount != null ? num(move.hitCount, 1) : null;
    if(min == null && max == null && hitCount == null && !(window.DAMEKE_DATA_HELPERS && window.DAMEKE_DATA_HELPERS.moveTag && window.DAMEKE_DATA_HELPERS.moveTag(move,'multiHit'))) return null;
    if(min == null) min = hitCount || max || 1;
    if(max == null) max = hitCount || min || 1;
    min = Math.max(1, min);
    max = Math.max(min, max);
    if(max <= 1) return null;
    return { min:min, max:max, fixed:(min === max) };
  }
  // Consolidates 6 near-identical copies. One had extra critical-hit rank-normalization
  // logic (crit/atk params), but every call site always passes crit=false, so that branch
  // was provably dead -- effectiveRanks() already does critical-hit rank normalization
  // upstream before calling this. Dropped safely; behavior is unchanged.
  function fl(x){ return window.DAMEKE_ROUNDING.floor(x); }
  function rank(v,r){ r=num(r,0); return r>=0 ? fl(v*(2+r)/2) : fl(v*2/(2-r)); }

  window.DAMEKE_CALC_SHARED = {
    num: num,
    parseAfterArrow: parseAfterArrow,
    attackerCalcTypes: attackerCalcTypes,
    defenderCalcTypes: defenderCalcTypes,
    isGrounded: isGrounded,
    contactActive: contactActive,
    isZOrMax: isZOrMax,
    isAbility: isAbility,
    moveName: moveName,
    protectedPierceMove: protectedPierceMove,
    protectInfo: protectInfo,
    getHitSpec: getHitSpec,
    rank: rank,
    activeItemWithFallback: activeItemWithFallback,
    activeAbilityWithFallback: activeAbilityWithFallback,
    activeItemCoreOnly: activeItemCoreOnly,
    activeAbilityCoreOnly: activeAbilityCoreOnly
  };
})();



// fix/v0.48-v0.51 early canonical name-reference helpers
(function(){
  var root = typeof window !== 'undefined' ? window : globalThis;
  var H = root.DAMEKE_DATA_HELPERS = root.DAMEKE_DATA_HELPERS || {};
  if(H.__earlyV048051) return;
  function arr(v){ return Array.isArray(v) ? v : (v ? [v] : []); }
  function uniq(a){ return Array.from(new Set((a || []).filter(Boolean))); }
  function keys(p){ return p ? uniq([p.id,p.name,p.speciesKey,p.formKey,p.baseSpecies].concat(arr(p.aliases))) : []; }
  function pokemonMatches(p, names){ var s = new Set(arr(names)); return keys(p).some(function(k){ return s.has(k); }); }
  function itemTargetsPokemon(item,p){ var targets = [].concat(arr(item && item.targetSpeciesKeys), arr(item && item.targetSpecies), arr(item && item.targetSpeciesGroup)); return targets.length ? pokemonMatches(p, targets) : false; }
  function effectTag(obj, tag){ return arr(obj && obj.effectTags).includes(tag); }
  function abilityTag(a, tag){ return effectTag(a, tag); }
  function itemTag(i, tag){ return effectTag(i, tag); }
  function formMoveType(moveName,pokemon,def){
    var D = root.DAMEKE_DATA || {}; var map = D.formMoveType && D.formMoveType[moveName]; if(!map) return def;
    var ks = keys(pokemon); for(var i=0;i<ks.length;i++){ if(map[ks[i]]) return map[ks[i]]; }
    return map.default || def;
  }
  // メガゲンガー・ディグダ(通常/アローラ)・ダグトリオ(通常/アローラ)・スナバァ・シロデスナは、
  // テレキネシスのチェックの有無に関わらず無効(接地判定・命中判定のどちらにも影響しない)。
  var TELEKINESIS_IMMUNE_NAMES = ['メガゲンガー','ディグダ','ディグダ(アローラ)','ダグトリオ','ダグトリオ(アローラ)','スナバァ','シロデスナ'];
  function isTelekinesisImmune(p){ return pokemonMatches(p, TELEKINESIS_IMMUNE_NAMES); }
  // コオリッポ(アイスフェイス)がアイスフェイスを1回消費してコオリッポ(ナイスフェイス)に変化する
  // ような「同一フォルムグループ内で特定の特性を持つ姿」を探す汎用ヘルパー。同じformGroup
  // (無ければbaseSpecies)を共有するポケモンの中から、指定した特性名を持つものを1体返す。
  function findFormByAbility(pokemon, abilityName){
    var D = root.DAMEKE_DATA;
    if(!pokemon || !D || !D.pokemons) return null;
    var group = pokemon.formGroup || pokemon.baseSpecies;
    if(!group) return null;
    return D.pokemons.find(function(p){
      return (p.formGroup || p.baseSpecies) === group && Array.isArray(p.abilities) && p.abilities.indexOf(abilityName) >= 0;
    }) || null;
  }
  H.pokemonKeys = H.pokemonKeys || keys;
  H.pokemonMatches = H.pokemonMatches || pokemonMatches;
  H.itemTargetsPokemon = H.itemTargetsPokemon || itemTargetsPokemon;
  H.abilityTag = H.abilityTag || abilityTag;
  H.itemTag = H.itemTag || itemTag;
  H.formMoveType = H.formMoveType || formMoveType;
  H.isTelekinesisImmune = H.isTelekinesisImmune || isTelekinesisImmune;
  H.findFormByAbility = H.findFormByAbility || findFormByAbility;
  H.__earlyV048051 = true;
})();

// fix v0.42: early canonical data helpers
// This must be defined before the base calculator IIFE because base functions now read DAMEKE_DATA_HELPERS.
(function(){
  var root = typeof window !== 'undefined' ? window : globalThis;
  root.DAMEKE_DATA_HELPERS = root.DAMEKE_DATA_HELPERS || {};
  var H = root.DAMEKE_DATA_HELPERS;
  if(H.__earlyV42) return;
  function arr(v){ return Array.isArray(v) ? v : (v ? [v] : []); }
  function hasTag(obj, tag){
    if(!obj) return false;
    if(arr(obj.tags).includes(tag)) return true;
    // Transitional safety only: preserves current behavior until all data is fully canonical.
    var legacy = {
      punch:'punch', cut:'cut', sound:'sound', bite:'bite', pulse:'pulse', recoil:'recoil', sheerForce:'sheerForce', alwaysCrit:'alwaysCrit', fixedDamage:'fixedDamage', ignoresAbilities:'ignoresAbilities'
    };
    return legacy[tag] ? !!obj[legacy[tag]] : false;
  }
  function byMoveName(name){
    var D = root.DAMEKE_DATA;
    return (D && D.moves || []).find(function(m){ return m.name === name || m.id === name; })
      || (D && D.enhancedMoveInternalRefs || []).find(function(m){ return m.name === name || m.id === name; })
      || null;
  }
  function moveTag(move, tag){ return hasTag(move, tag); }
  function moveTagByName(name, tag){ return hasTag(byMoveName(name), tag); }
  function moveTagForEffective(inputMove, effectiveName, tag){
    if(effectiveName && inputMove && effectiveName === inputMove.name) return moveTag(inputMove, tag) || moveTagByName(effectiveName, tag);
    return moveTagByName(effectiveName, tag);
  }
  function moveTarget(move){ return (move && (move.target || move.range || move.scope || move.targetType || move.originalTarget)) || '1体選択'; }
  function fixedDamageKind(move){ return move && (move.fixedDamageKind || (move.fixedDamage ? move.damageKind : null)) || null; }
  function fixedDamageKindByName(name){ var m = byMoveName(name); return fixedDamageKind(m); }
  function moveHitCount(move){
    if(!move) return {min:1,max:1};
    if(move.hitCountMin != null || move.hitCountMax != null) return {min:move.hitCountMin || move.hitCountMax || 1, max:move.hitCountMax || move.hitCountMin || 1};
    if(move.hitCount != null) return {min:move.hitCount,max:move.hitCount};
    return {min:1,max:1};
  }
  H.moveTag = H.moveTag || moveTag;
  H.moveTagByName = H.moveTagByName || moveTagByName;
  H.moveTagForEffective = H.moveTagForEffective || moveTagForEffective;
  H.moveTarget = H.moveTarget || moveTarget;
  H.fixedDamageKind = H.fixedDamageKind || fixedDamageKind;
  H.fixedDamageKindByName = H.fixedDamageKindByName || fixedDamageKindByName;
  H.moveHitCount = H.moveHitCount || moveHitCount;
  H.byMoveName = H.byMoveName || byMoveName;
  H.__earlyV42 = true;
})();


// v0.29 shared rounding utilities
(function(){
  if(window.DAMEKE_ROUNDING) return;
  function floor(x){return Math.floor(x);}
  function roundHalfUp(x){return Math.floor(x+0.5);}
  function roundFiveDown(x){var f=Math.floor(x),r=x-f;return r>0.5?f+1:f;}
  function trunc1(x){return Math.floor(x*10)/10;}
  function apply4096Floor(value,rate){return Math.floor(value*rate/4096);}
  function apply4096HalfUp(value,rate){return roundHalfUp(value*rate/4096);}
  function apply4096FiveDown(value,rate){return roundFiveDown(value*rate/4096);}
  function combineRateHalfUp(current,rate){return roundHalfUp(current*rate/4096);}
  function baseDamage(level,power,atk,def){if(!power||power<=0||def<=0)return 0;var a=Math.floor(level*2/5)+2;var b=Math.floor(a*power*atk/def);return Math.floor(b/50)+2;}
  window.DAMEKE_ROUNDING={floor:floor,fl:floor,roundHalfUp:roundHalfUp,roundFiveDown:roundFiveDown,trunc1:trunc1,apply4096Floor:apply4096Floor,apply4096HalfUp:apply4096HalfUp,apply4096FiveDown:apply4096FiveDown,combineRateHalfUp:combineRateHalfUp,baseDamage:baseDamage};
})();



// v0.35 shared nature modifier utilities
(function(){
  if(window.DAMEKE_NATURE) return;
  var NAME_MAP = {
    'さみしがり':['A','B'], 'いじっぱり':['A','C'], 'やんちゃ':['A','D'], 'ゆうかん':['A','S'],
    'ずぶとい':['B','A'], 'わんぱく':['B','C'], 'のうてんき':['B','D'], 'のんき':['B','S'],
    'ひかえめ':['C','A'], 'おっとり':['C','B'], 'うっかりや':['C','D'], 'れいせい':['C','S'],
    'おだやか':['D','A'], 'おとなしい':['D','B'], 'しんちょう':['D','C'], 'なまいき':['D','S'],
    'おくびょう':['S','A'], 'せっかち':['S','B'], 'ようき':['S','C'], 'むじゃき':['S','D'],
    'がんばりや':[null,null], 'すなお':[null,null], 'てれや':[null,null], 'きまぐれ':[null,null], 'まじめ':[null,null]
  };
  function pick(src, keys){
    if(!src) return null;
    for(var i=0;i<keys.length;i++){
      if(src[keys[i]] != null && src[keys[i]] !== '' && src[keys[i]] !== 'none' && src[keys[i]] !== 'なし') return src[keys[i]];
    }
    return null;
  }
  function code(v){
    var map = {'攻撃':'A','防御':'B','特攻':'C','特防':'D','素早さ':'S','A':'A','B':'B','C':'C','D':'D','S':'S'};
    return map[v] || v || null;
  }
  function naturePair(src){
    src = src || {};
    var up = pick(src, ['natureUp','naturePlus','natureBoost','upNature','plusNature','plus','up']);
    var down = pick(src, ['natureDown','natureMinus','natureDrop','downNature','minusNature','minus','down']);
    var n = pick(src, ['nature','natureName','personality']);
    if(n && NAME_MAP[n]){ up = NAME_MAP[n][0]; down = NAME_MAP[n][1]; }
    if(src.nature && typeof src.nature === 'object'){
      up = src.nature.up || src.nature.plus || up;
      down = src.nature.down || src.nature.minus || down;
    }
    return {up:code(up), down:code(down)};
  }
  function apply(value, stat, src){
    if(stat === 'H') return value;
    var p = naturePair(src);
    if(!p.up && !p.down) return value;
    if(p.up === p.down) return value;
    if(p.up === stat) return Math.floor(value * 1.1);
    if(p.down === stat) return Math.floor(value * 0.9);
    return value;
  }
  window.DAMEKE_NATURE = {apply:apply,naturePair:naturePair};
})();

(function () {
  const DATA = window.DAMEKE_DATA;
  const MOLD = new Set(['メテオドライブ','フォトンゲイザー','サンシャインスマッシャー','てんこがすめつぼうのひかり','キョダイコランダ']);
  const DEF_RANK_IGNORE_MOVES = new Set(['なしくずし','せいなるつるぎ','DDラリアット','むにきすひかり']);
  const PLEDGE_MOVES = new Set(['くさのちかい','ほのおのちかい','みずのちかい']);
  const hiddenPowerTypes = ['かくとう','ひこう','どく','じめん','いわ','むし','ゴースト','はがね','ほのお','みず','くさ','でんき','エスパー','こおり','ドラゴン','あく'];
  function i(v,f){const n=parseInt(v,10);return Number.isFinite(n)?n:f;} function fl(v){return window.DAMEKE_ROUNDING.floor(v);} function cl(v,a,b){return Math.min(Math.max(v,a),b);} function st(label,name,value,note='',implemented=true){return{label,name,value,note,implemented};} function pend(label,name,note){return st(label,name,'未反映',note||'未実装枠',false);} function by(list,id){return list.find(x=>x.id===id)||list[0];} function formatRate(r){return r+'/4096 ('+(r/4096).toFixed(2)+'倍)';}
  function spToEv(sp){sp=cl(i(sp,0),0,32);return sp<=0?0:(sp===32?252:4+(sp-1)*8);} function norm(src){const o={ivs:{},evs:{},ranks:{}};let total=0;src=src||{};for(const k of ['H','A','B','C','D','S']){o.ivs[k]=cl(i(src.ivs&&src.ivs[k],31),0,31);const raw=cl(i(src.evs&&src.evs[k],0),0,32);const use=Math.min(raw,Math.max(0,66-total));o.evs[k]=use;total+=use;}for(const k of ['A','B','C','D','S','acc','eva'])o.ranks[k]=cl(i(src.ranks&&src.ranks[k],0),-6,6);o.totalEv=total;return o;} function stat(base,level,iv,sp,hp){const ev=spToEv(sp);return hp?fl(((2*base+iv+fl(ev/4))*level)/100)+level+10:fl(((2*base+iv+fl(ev/4))*level)/100)+5;} function getActualStats(p,level,input){level=cl(i(level,50),1,100);const n=norm(input),b=p.baseStats,o={input:n};for(const k of ['H','A','B','C','D','S']){o[k]=stat(b[k],level,n.ivs[k],n.evs[k],k==='H');if(k==='H'&&window.DAMEKE_DATA_HELPERS.pokemonMatches(p,'ヌケニン'))o[k]=1;if(k!=='H')o[k]=window.DAMEKE_NATURE.apply(o[k],k,input||{});}return o;} function previewBaseMaxHp(p,level,input){return getActualStats(p,cl(i(level,50),1,100),input).H;} function cloneStats(s){return Object.assign({},s,{input:s.input});}
  var rank = window.DAMEKE_CALC_SHARED.rank; function typeRate(t,dt){return (DATA.typeChart4096[t]||{})[dt]??4096;} function combo(t,types){let r=4096,details=[];for(const dt of types){const single=typeRate(t,dt),before=r;r=fl(r*single/4096);details.push({attackType:t,defenseType:dt,single,before,after:r});}return{rate:r,details};} function stab(t,types){return types.includes(t)?6144:4096;} function mod(v,r){return fl(v*r/4096);} function baseDamage(level,power,atk,def){if(!power||def<=0)return 0;return fl(fl((fl(2*level/5)+2)*power*atk/def)/50)+2;}
  function maxPower(p){
    var z = (window.DAMEKE_DATA && window.DAMEKE_DATA.zMax) || (typeof DATA !== 'undefined' && DATA.zMax) || {};
    if(p == null) return null;
    p = Number(p);
    var table = z.legacyBaseMaxPowerTable || [[40,90],[50,100],[60,110],[70,120],[100,130],[140,140],[Infinity,150]];
    for(var i=0;i<table.length;i++) if(p <= table[i][0]) return table[i][1];
    return table[table.length-1][1];
  } function zPower(moveOrPower){
    var move = (moveOrPower && typeof moveOrPower === 'object') ? moveOrPower : null;
    var name = move ? move.name : null;
    var p = move ? move.power : moveOrPower;
    var z = (window.DAMEKE_DATA && window.DAMEKE_DATA.zMax) || (typeof D !== 'undefined' && D.zMax) || (typeof DATA !== 'undefined' && DATA.zMax) || {};
    if(name && z.zPowerOverrides && z.zPowerOverrides[name] != null) return z.zPowerOverrides[name];
    if(p == null) return null;
    p = Number(p);
    var table = z.zPowerBaseTable || [[59,100],[69,120],[79,140],[89,160],[99,175],[109,180],[119,185],[129,190],[139,195],[Infinity,200]];
    for(var i=0;i<table.length;i++) if(p <= table[i][0]) return table[i][1];
    return 200;
  } function enhanced(m){return{id:m.id,name:m.name,type:m.type,category:m.category,power:m.power,priority:0,contact:false,ignoresAbilities:false,damageKind:null,protectRate4096:1024,sound:!!m.sound};}
  function resolveSpecialMove(pokemon,move,state){state=state||{kind:'none',name:'なし'};const info={originalMoveName:move.name,transformedMoveName:move.name,status:'通常',reason:'なし',effectReset:'なし',enhancedEffectNote:'通常技'};if(state.kind==='none')return{move:Object.assign({},move),info,isDynamaxActive:false};if(state.kind==='zmove'){const name=DATA.zMax.zByType[move.type];if(!name){info.status='無効';info.reason='Z技名未定義';return{move:Object.assign({},move),info,isDynamaxActive:false};}const m=enhanced(move);m.name=name;m.power=zPower(move.power);m.isZMove=true;info.status='有効';info.reason='タイプ別Zワザ';info.transformedMoveName=m.name;info.effectReset='通常技固有効果をリセット';info.enhancedEffectNote='特殊効果なし';return{move:m,info,isDynamaxActive:false};}if(state.kind==='special_z'){const rule=window.DAMEKE_DATA_HELPERS.specialZRuleFor(pokemon,move);if(!rule){info.status='無効';info.reason='ポケモン+技の専用Z条件なし';return{move:Object.assign({},move),info,isDynamaxActive:false};}const m=enhanced(move);Object.assign(m,{name:rule.name,type:rule.type,category:rule.category,power:rule.power,ignoresAbilities:!!rule.ignoresAbilities,isZMove:true});info.status='有効';info.reason='専用Z条件成立';info.transformedMoveName=m.name;info.effectReset='通常技固有効果をリセット';info.enhancedEffectNote=m.ignoresAbilities?'例外: 強化技側のかたやぶり効果あり':'特殊効果なし';return{move:m,info,isDynamaxActive:false};}if(state.kind==='dynamax'||state.kind==='gmax'){if(!window.DAMEKE_DATA_HELPERS.canDynamaxPokemon(pokemon)){info.status='無効';info.reason=pokemon.name+'はダイマックス不可';return{move:Object.assign({},move),info,isDynamaxActive:false};}const m=enhanced(move);Object.assign(m,{name:(DATA.zMax.maxByType[move.type]||move.name),power:maxPower(move.power),isMaxMove:true});info.status='有効';info.reason='タイプ別ダイマックス技';info.transformedMoveName=m.name;info.effectReset='通常技固有効果をリセット';info.enhancedEffectNote='特殊効果なし';return{move:m,info,isDynamaxActive:true};}return{move:Object.assign({},move),info,isDynamaxActive:false};}
  function held(side,item,o){if(!item||item.id==='none')return false;if(side==='A'&&o.attackerNoItem)return false;if(side==='D'&&o.defenderNoItem)return false;return true;} function itemBase(side,o){if(o.magicRoom)return{suppressed:true,reason:'マジックルームにより無効'};if(side==='A'&&o.attackerEmbargo)return{suppressed:true,reason:'攻撃側さしおさえにより無効'};if(side==='D'&&o.defenderEmbargo)return{suppressed:true,reason:'防御側さしおさえにより無効'};return{suppressed:false,reason:''};} function shield(side,item,o){return held(side,item,o)&&item.kind==='AbilityProtection'&&!itemBase(side,o).suppressed;} function baseAbility(side,ab,item,o){const none=side==='A'?o.attackerNoAbility:o.defenderNoAbility;if(!ab||ab.id==='なし'||none)return{active:false,status:'特性なし',reason:'特性なし',ability:ab};if(ab.name==='マルチタイプ'||ab.name==='ARシステム')return{active:true,status:'有効',reason:'常時有効',ability:ab};return{active:true,status:'有効',reason:'有効',ability:ab};} function abilityStates(aAb,dAb,aItem,dItem,o){let a=baseAbility('A',aAb,aItem,o),d=baseAbility('D',dAb,dItem,o);function prot(s){return s.active&&(s.ability.name==='マルチタイプ'||s.ability.name==='ARシステム'||s.ability.protectedFromSuppression);}if(o.neutralizingGasField){if(a.active&&!prot(a))a=Object.assign({},a,{active:false,status:'無効',reason:'場のかがくへんかガスにより無効'});if(d.active&&!prot(d))d=Object.assign({},d,{active:false,status:'無効',reason:'場のかがくへんかガスにより無効'});}if(a.active&&a.ability&&a.ability.name==='かがくへんかガス'&&d.active&&!prot(d)){d=Object.assign({},d,{active:false,status:'無効',reason:'相手側かがくへんかガスにより無効'});}if(d.active&&d.ability&&d.ability.name==='かがくへんかガス'&&a.active&&!prot(a)){a=Object.assign({},a,{active:false,status:'無効',reason:'相手側かがくへんかガスにより無効'});}if(a.active&&a.ability&&a.ability.name==='ごりむちゅう'&&(o.attackerSpecialState==='dynamax'||o.attackerSpecialState==='gmax')){a=Object.assign({},a,{active:false,status:'無効',reason:'ダイマックス中はごりむちゅうが無効'});}return{attackerAbilityState:a,defenderAbilityState:d};}
  function itemActive(side,item,own,opp,o){if(!held(side,item,o))return{active:false,status:'持ち物なし',reason:'持ち物なし'};const b=itemBase(side,o);if(b.suppressed)return{active:false,status:'無効',reason:b.reason};var dynState=o[(side==='A'?'attacker':'defender')+'SpecialState'];if((dynState==='dynamax'||dynState==='gmax')&&(item.kind==='ChoiceScarf'||item.kind==='ChoiceBand'||item.kind==='ChoiceSpecs'))return{active:false,status:'無効',reason:'ダイマックス中はこだわり系持ち物が無効'};if(item.isBerry&&opp.active&&window.DAMEKE_DATA_HELPERS.abilityTag(opp.ability,'berrySuppressOpponent'))return{active:false,status:'無効',reason:'相手側特性'+opp.ability.name+'によりきのみ無効'};if(own.active&&window.DAMEKE_DATA_HELPERS.abilityTag(own.ability,'itemSuppress')&&item.kind!=='AbilityProtection')return{active:false,status:'無効',reason:'特性'+own.ability.name+'により無効'};return{active:true,status:'有効',reason:'有効'};} function itemActiveForMoveType(side,item,own,opp,o,moveName){const state=itemActive(side,item,own,opp,o);if(moveName==='しぜんのめぐみ'&&item&&item.isBerry&&held(side,item,o)&&/きんちょうかん|じんばいったい/.test(state.reason))return{active:true,status:'有効',reason:'しぜんのめぐみではきんちょうかんによるきのみ無効を無視'};return state;}
  function hasMold(aState,m,o){if(o.moldBreaker)return true;if(aState.active&&window.DAMEKE_DATA_HELPERS.abilityTag(aState.ability,'moldBreakerEffect'))return true;if(m.ignoresAbilities)return true;return MOLD.has(m.name);} function ignored(aState,dState,dItem,m,o){if(!dState.active)return{ignored:false,reason:'防御側特性が有効ではない'};if(shield('D',dItem,o))return{ignored:false,reason:'防御側とくせいガード有効'};if(!dState.ability.ignorableByMoldBreaker)return{ignored:false,reason:'かたやぶり対象外'};if(!hasMold(aState,m,o))return{ignored:false,reason:'かたやぶり効果なし'};return{ignored:true,reason:'かたやぶり効果により無視'};}
  function ignoreWonderRawSwap(aState,move){return(aState.active&&aState.ability.name==='てんねん')||DEF_RANK_IGNORE_MOVES.has(move.name);} function applyTransformOps(aStats,dStats,ops,ignoreWonderRaw){const a=cloneStats(aStats),d=cloneStats(dStats),logs=[];let wonderActive=false;(ops||[]).forEach((op,idx)=>{if(op==='attackerPowerTrick'){const x=a.A;a.A=a.B;a.B=x;logs.push((idx+1)+'. 攻撃側パワートリック A/B入替');}else if(op==='defenderPowerTrick'){const x=d.A;d.A=d.B;d.B=x;logs.push((idx+1)+'. 防御側パワートリック A/B入替');}else if(op==='powerShare'){const avA=fl((a.A+d.A)/2),avC=fl((a.C+d.C)/2);a.A=d.A=avA;a.C=d.C=avC;logs.push((idx+1)+'. パワーシェア A='+avA+' C='+avC);}else if(op==='guardShare'){const avB=fl((a.B+d.B)/2),avD=fl((a.D+d.D)/2);a.B=d.B=avB;a.D=d.D=avD;logs.push((idx+1)+'. ガードシェア B='+avB+' D='+avD);}else if(op==='speedSwap'){const x=a.S;a.S=d.S;d.S=x;logs.push((idx+1)+'. スピードスワップ S入替');}else if(op==='wonderRoom'){wonderActive=!wonderActive;if(ignoreWonderRaw)logs.push((idx+1)+'. ワンダールーム '+(wonderActive?'発動':'解除')+'（実数値入替のみ無効）');else{const ab=a.B;a.B=a.D;a.D=ab;const db=d.B;d.B=d.D;d.D=db;logs.push((idx+1)+'. ワンダールーム '+(wonderActive?'発動':'解除')+' B/D入替');}}});return{attacker:a,defender:d,logs,wonderRoomActive:wonderActive,wonderRoomRawIgnored:ignoreWonderRaw};}
  function hazardDamage(max,num,den){return num<=0?0:Math.max(1,fl(max*num/den));} function hazardType(max,type,types){const r=combo(type,types).rate;return r<=0?0:Math.max(1,fl(max*r/(4096*8)));} function grounded(p,ab,itState,item,o){if(o.gravity)return true;if(itState.active&&item.kind==='Grounding')return true;if(p.types.includes('ひこう'))return false;if(ab.active&&ab.ability.kind==='Levitate')return false;if(itState.active&&item.kind==='Floating')return false;return true;} 
  function sideGrounded(side,p,ab,itState,item,o,calcTypes){
    const prefix = side === 'A' ? 'attacker' : 'defender';
    if(o[prefix+'Ingrain']) return {grounded:true, reason:'ねをはる'};
    if(o[prefix+'RootedSmacked']) return {grounded:true, reason:'うちおとす'};
    if(o.gravity) return {grounded:true, reason:'じゅうりょく'};
    if(itState.active && item.kind === 'Grounding') return {grounded:true, reason:'くろいてっきゅう'};
    const teraType = o[prefix + 'TeraType'] || 'なし';
    const typeList = (teraType && teraType !== 'なし' && teraType !== 'ステラ') ? [teraType] : (Array.isArray(calcTypes) ? calcTypes : (p.types || []));
    if(typeList.includes('ひこう')) return {grounded:false, reason:(teraType && teraType !== 'なし' && teraType !== 'ステラ') ? 'テラスタイプがひこう' : '計算上タイプがひこう'};
    if(ab.active && (window.DAMEKE_DATA_HELPERS.abilityTag(ab.ability,'levitate') || ab.ability.name === 'ふゆう' || ab.ability.name === 'うなぎのぼり')) return {grounded:false, reason:'特性'+ab.ability.name};
    if(itState.active && item.kind === 'Floating') return {grounded:false, reason:'ふうせん'};
    if(o[prefix+'MagnetRise']) return {grounded:false, reason:'でんじふゆう'};
    if(o[prefix+'Telekinesis'] && !window.DAMEKE_DATA_HELPERS.isTelekinesisImmune(p)) return {grounded:false, reason:'テレキネシス'};
    return {grounded:true, reason:'その他'};
  }
function hpBlock(side,p,stt,item,itState,ab,special,o){const prefix=side==='A'?'attacker':'defender',max=stt.H;const raw=o[prefix+'CurrentHpInput']===''||o[prefix+'CurrentHpInput']==null?max:cl(i(o[prefix+'CurrentHpInput'],max),1,max);let hd=0,notes=[];const immune=(itState.active&&item.kind==='HazardImmune')||(ab.active&&window.DAMEKE_DATA_HELPERS.abilityTag(ab.ability,'hazardImmune'));if(immune)notes.push('あつぞこブーツまたはマジックガードにより設置技0');if(!immune&&o[prefix+'StealthRock']){const d=hazardType(max,'いわ',p.types);hd+=d;notes.push('ステロ='+d);}if(!immune&&o[prefix+'SteelSurge']){const d=hazardType(max,'はがね',p.types);hd+=d;notes.push('キョダイコウジン='+d);}const sp=cl(i(o[prefix+'Spikes'],0),0,3);if(!immune&&sp>0){if(grounded(p,ab,itState,item,o)){const d=sp===1?hazardDamage(max,1,8):sp===2?hazardDamage(max,1,6):hazardDamage(max,1,4);hd+=d;notes.push('まきびし'+sp+'回='+d);}else notes.push('まきびし=0（繰り出し時非接地扱い）');}const after=Math.max(0,raw-hd);return{maxFinal:special?max*2:max,currentFinal:special?after*2:after,hazardDamage:hd,notes:notes.join('、')||'なし'};}
  function ranksToText(r){return'A'+r.A+' / B'+r.B+' / C'+r.C+' / D'+r.D+' / S'+r.S;} function copyRanks(r){const o={};for(const k of ['A','B','C','D','S','acc','eva'])o[k]=r[k]||0;return o;} function effectiveRankedStatsText(hp,raw,ranks,isAtk){return hp.currentFinal+'/'+hp.maxFinal+' / '+[rank(raw.A,ranks.A,false,isAtk),rank(raw.B,ranks.B,false,isAtk),rank(raw.C,ranks.C,false,isAtk),rank(raw.D,ranks.D,false,isAtk),rank(raw.S,ranks.S,false,isAtk)].join('/');}
  function criticalState(dState,o,move,aState,aAb,aItem,aIt,atk){
    const name=move&&move.name;
    const fixed=!!(move&&window.DAMEKE_DATA_HELPERS.moveTag(move,'fixedDamage'));
    const merciless=(o&&o.defenderStatus==='どく'&&o.attackerAbilityId==='ひとでなし');
    const forced=(move&&window.DAMEKE_DATA_HELPERS.moveTag(move,'alwaysCrit'))||merciless;
    const manualRank=cl(i(o.critical,0),0,3);
    // ① blocked (急所無効) short-circuits everything below, exactly as before.
    if(dState.active&&window.DAMEKE_DATA_HELPERS.abilityTag(dState.ability,'criticalBlock'))return{effective:false,forced,blocked:true,rank:0,reason:'防御側特性'+dState.ability.name+'により急所無効'};
    if(o.defenderLuckyChant)return{effective:false,forced,blocked:true,rank:0,reason:'防御側おまじないにより急所無効'};
    if(fixed)return{effective:false,forced,blocked:true,rank:0,reason:'固定ダメージ技のため急所なし'};
    // Internal-only override used by the faint-probability calculator to get the "always crit" /
    // "never crit" damage rolls without duplicating this whole function. Never set by the UI.
    if(o.__forceCritOverride==='on') return {effective:true,forced,blocked:false,rank:3,reason:'瀕死率計算用の急所強制'};
    if(o.__forceCritOverride==='off') return {effective:false,forced,blocked:false,rank:0,reason:'瀕死率計算用の急所無視'};
    // ② accumulate the rank from each qualifying condition (capped at 3 before comparing to manual).
    var critRank=0, notes=[];
    var gmaxRapidCount=o.attackerGMaxRapidStrike===true?1:(parseInt(o.attackerGMaxRapidStrike,10)||0);if(gmaxRapidCount>0){critRank+=gmaxRapidCount;notes.push('キョダイシンゲキ+'+gmaxRapidCount);}
    if(o.attackerFocusEnergy){critRank+=3;notes.push('とぎすます+3');}
    if(aState&&aState.active&&aState.ability&&aState.ability.name==='きょううん'){critRank+=1;notes.push('きょううん+1');}
    if(aIt&&aIt.active&&aItem&&(aItem.name==='ピントレンズ'||aItem.name==='するどいツメ')){critRank+=1;notes.push(aItem.name+'+1');}
    if(aIt&&aIt.active&&aItem&&aItem.name==='ラッキーパンチ'&&window.DAMEKE_DATA_HELPERS.pokemonMatches(atk,['ラッキー'])){critRank+=2;notes.push('ラッキー+ラッキーパンチ+2');}
    if(aIt&&aIt.active&&aItem&&aItem.name==='ながねぎ'&&window.DAMEKE_DATA_HELPERS.pokemonMatches(atk,['カモネギ','カモネギ(ガラル)','ネギガナイト'])){critRank+=2;notes.push('カモネギ系統+ながねぎ+2');}
    if(forced){critRank+=3;notes.push(name+'により確定+3');}
    if(name==='10000まんボルト'||name==='1000まんボルト'){critRank+=2;notes.push(name+'+2');}
    if(window.DAMEKE_DATA_HELPERS.moveTagByName(name,'highCritRatio')){critRank+=1;notes.push('急所に当たりやすい技+1');}
    critRank=Math.min(3,critRank);
    // ③ 手入力ランクは、技/道具/特性等から自動計算されたランクを上書きするのではなく加算する
    // (例: 急所に当たりやすい技(+1)を選びつつ手入力でさらに+1した場合、ランク2になるべき)。
    var finalRank=Math.min(3,critRank+manualRank);
    var reason=(notes.length?notes.join('、')+'（計算上ランク'+critRank+'）':'条件なし（計算上ランク0）')+'、手入力ランク'+manualRank+' → 採用ランク'+finalRank+'（加算）';
    return{effective:finalRank>=3,forced,blocked:false,rank:finalRank,reason:reason};
  }
  function effectiveRanks(aIn,dIn,aState,dState,move,o,crit){const a=copyRanks(aIn),d=copyRanks(dIn),notes=[];if(move.name==='シャドースチール'){var stolen=[];for(const k of ['A','B','C','D','S']){if(d[k]>0){var steal=d[k];d[k]=0;a[k]=cl(a[k]+steal,-6,6);stolen.push(k+'+'+steal);}}if(stolen.length)notes.push('シャドースチールにより防御側の有利ランク（'+stolen.join('、')+'）を攻撃側へ移動');}if((aState.active&&aState.ability.name==='てんねん')||DEF_RANK_IGNORE_MOVES.has(move.name)){for(const k of ['B','C','D'])d[k]=0;if(move.name!=='イカサマ')d.A=0;notes.push((aState.active&&aState.ability.name==='てんねん'?'攻撃側てんねん':move.name)+'により防御側ABCDランクを0');}if(dState.active&&dState.ability.name==='てんねん'){for(const k of ['A','B','C','D'])a[k]=0;if(move.name==='イカサマ')d.A=0;notes.push('防御側てんねんにより攻撃側ABCDランクを0'+(move.name==='イカサマ'?'、イカサマ参照の防御側Aも0':''));}if(crit.effective){for(const k of ['A','B','C','D']){if(a[k]<0)a[k]=0;if(d[k]>0)d[k]=0;}notes.push('急所により攻撃側不利ランクと防御側有利ランクを0');}const accRank=(dState.active&&dState.ability.name==='てんねん')?0:a.acc;const ignoreEva=(aState.active&&['てんねん','しんがん','するどいめ','はっこう'].includes(aState.ability.name))||o.defenderForesight||o.defenderMiracleEye;const evaRank=ignoreEva?0:d.eva;const hitRank=cl(accRank-evaRank,-6,6);return{attacker:a,defender:d,notes:notes.join('、')||'入力どおり',hitRank,hitNote:'命中'+accRank+' - 回避'+evaRank+' = '+hitRank+(ignoreEva?'（回避ランク無視）':'')};}
  function inputRanked(raw,statName,isAtk,rankName){return rank(raw[statName],raw.input.ranks[rankName||statName],false,isAtk);} function normalizeCategoryLabel(cat){cat=String(cat||'');if(cat.indexOf('物理')>=0)return '物理';if(cat.indexOf('特殊')>=0)return '特殊';if(cat.indexOf('変化')>=0)return '変化';return cat;} function categoryDecision(move,as,ds,tera,level,wonderRoom){const A=inputRanked(as,'A',true),C=inputRanked(as,'C',true),B=inputRanked(ds,'B',false),D=inputRanked(ds,'D',false),name=move.name;if(name==='ナインエボルブースト')return{category:'変化',reason:'ナインエボルブーストは変化扱い',detail:'-'};if(name==='フォトンゲイザー'||name==='てんこがすめつぼうのひかり')return{category:A>C?'物理':'特殊',reason:name+'のA/C比較',detail:'A='+A+' / C='+C};if(name==='テラバースト'||window.DAMEKE_DATA_HELPERS.moveTagByName(name,'teraCluster')){if(tera&&tera!=='なし')return{category:A>C?'物理':'特殊',reason:name+' テラスタル時のA/C比較',detail:'A='+A+' / C='+C+' / テラ='+tera};return{category:'特殊',reason:name+' 非テラスタル時は特殊',detail:'テラ=なし'};}if(name==='シェルアームズ'){const lp=fl((level*2)/5)+2;const phy=((lp*90*A/B)/50),sp=((lp*90*C/D)/50);return{category:phy>sp?'物理':'特殊',reason:'シェルアームズの物理/特殊比較'+(wonderRoom?'（ワンダールーム操作後）':''),detail:'物理='+phy.toFixed(4)+' / 特殊='+sp.toFixed(4)+'（同値は特殊）'};}var normalizedCategory=normalizeCategoryLabel(move.category);return{category:normalizedCategory,reason:'技データの分類',detail:normalizedCategory+(normalizedCategory!==move.category?'（元='+move.category+'）':'')};}
  
  function normalizeCalcTypes(types){const out=[];for(const t of (types||[])){if(!t||t==='なし')continue;if(t==='タイプなし'){if(!out.length)out.push('タイプなし');continue;}if(!out.includes(t))out.push(t);}return out.length?out:['タイプなし'];}
  function sameTypeSet(a,b){return normalizeCalcTypes(a).slice().sort().join('|')===normalizeCalcTypes(b).slice().sort().join('|');}
  function removeCalcType(types,type){const out=types.filter(t=>t!==type);return out.length?out:['タイプなし'];}
  function resolveCalcTypes(side,p,ability,item,o,otherAbility){
    const pre=side==='A'?'attacker':'defender';
    const tera=o[pre+'TeraType']&&o[pre+'TeraType']!=='なし';
    let types=normalizeCalcTypes(p.types),notes=['元タイプ='+types.join('/')];
    const manual=normalizeCalcTypes([o[pre+'Type1'],o[pre+'Type2']]);
    const typeOverride=o[pre+'TypeOverride']||'none';
    if(typeOverride==='soak'&&!window.DAMEKE_DATA_HELPERS.pokemonMatches(p,['アルセウス','シルヴァディ','arceus','silvally'])){types=['みず'];notes.push('みずびたし');}
    if(typeOverride==='magicPowder'&&!window.DAMEKE_DATA_HELPERS.pokemonMatches(p,['アルセウス','シルヴァディ','arceus','silvally'])){types=['エスパー'];notes.push('まほうのこな');}
    if(!sameTypeSet(manual,p.types)){types=manual;notes.push('タイプ入力='+types.join('/'));}
    if(ability.active&&ability.ability.name==='マルチタイプ'&&(item.kind==='Plate'||item.kind==='ZCrystal')){types=[item.type];notes.push('マルチタイプ');}
    if(ability.active&&ability.ability.name==='ARシステム'&&item.kind==='Memory'){types=[item.type];notes.push('ARシステム');}
    if(ability.active&&ability.ability.name==='てんきや'){
      const otherNoWeather=otherAbility&&otherAbility.active&&otherAbility.ability.kind==='IgnoreWeather';
      if(otherNoWeather){notes.push('相手ノーてんき/エアロックでてんきや変化なし');}
      else {
        const otherHasSolarPower=side==='D'&&otherAbility&&otherAbility.active&&otherAbility.ability.name==='メガソーラー';
        const w=otherHasSolarPower?(o.weather||'なし'):((side==='A'?o.attackerEffectiveWeather:o.defenderEffectiveWeather)||o.weather);
        const map={'にほんばれ':'ほのお','おおひでり':'ほのお','あめ':'みず','おおあめ':'みず','ゆき':'こおり'};types=[map[w]||'ノーマル'];notes.push('てんきや 天候='+w+(otherHasSolarPower?'（相手メガソーラーを無視して独自算出）':''));
      }
    }
    if(ability.active&&ability.ability.name==='ぎたい'){
      const map={'エレキフィールド':'でんき','グラスフィールド':'くさ','ミストフィールド':'フェアリー','サイコフィールド':'エスパー'};
      if(map[o.field]){types=[map[o.field]];notes.push('ぎたい');}
    }
    if(!tera){
      if(o[pre+'AddType']==='halloween'&&!types.includes('ゴースト')){if(types[0]==='タイプなし')types=[];types.push('ゴースト');notes.push('ハロウィン');}
      if(o[pre+'AddType']==='forestCurse'&&!types.includes('くさ')){if(types[0]==='タイプなし')types=[];types.push('くさ');notes.push('もりののろい');}
      if(o[pre+'Roost']){types=(p.types.length===1&&p.types[0]==='ひこう')?['ノーマル']:removeCalcType(types,'ひこう');notes.push('はねやすめ');}
      if(o[pre+'BurnUp']){types=removeCalcType(types,'ほのお');notes.push('もえつきる');}
      if(o[pre+'DoubleShock']){types=removeCalcType(types,'でんき');notes.push('でんこうそうげき');}
    } else {notes.push('テラスタル中の一部タイプ変更無効');}
    return {types:normalizeCalcTypes(types),notes:notes.join('、')};
  }
  function hiddenPowerType(ivs){const sum=(ivs.H%2?1:0)+(ivs.A%2?2:0)+(ivs.B%2?4:0)+(ivs.S%2?8:0)+(ivs.C%2?16:0)+(ivs.D%2?32:0);return hiddenPowerTypes[fl(sum*15/63)];}
  function skinType(ability){const map={'ノーマルスキン':'ノーマル','エレキスキン':'でんき','スカイスキン':'ひこう','ドラゴンスキン':'ドラゴン','フェアリースキン':'フェアリー','フリーズスキン':'こおり'};return map[ability.name]||null;}
  function contactState(move,aState,aItem,aIt,dState){const name=move&&move.name;const isPunch=!!(move&&window.DAMEKE_DATA_HELPERS.moveTag(move,'punch'));if(aState.active&&aState.ability&&aState.ability.name==='えんかく')return{contact:false,reason:'攻撃側特性えんかく'};if(isPunch&&aIt.active&&aItem&&(window.DAMEKE_DATA_HELPERS.itemTag(aItem,'punchingGlove')||aItem.name==='パンチグローブ'))return{contact:false,reason:'パンチ技+パンチグローブ'};return{contact:!!(move&&move.contact),reason:'技データ'};}
  function resolveMoveType(ctx){const {move,attacker,as,aState,dState,aItem,aIt,o,originalMove,calcTypes}=ctx;let type=move.type,note='技データのタイプ',locked=false;if(o.electrify){type='でんき';note='そうでん状態';locked=true;} if(!locked&&(move.name==='テラバースト'||window.DAMEKE_DATA_HELPERS.moveTag(move,'teraCluster'))&&o.attackerTeraType&&o.attackerTeraType!=='なし'){type=o.attackerTeraType;note=move.name+' + 攻撃側テラスタル';locked=true;} if(!locked&&move.name==='ウェザーボール'){const w=o.attackerEffectiveWeather||o.weather;const map={'にほんばれ':'ほのお','おおひでり':'ほのお','あめ':'みず','おおあめ':'みず','すなあらし':'いわ','ゆき':'こおり'};type=map[w]||'ノーマル';note='攻撃側天候='+w;locked=true;} if(!locked&&move.name==='さばきのつぶて'){type=(aIt.active&&aItem.kind==='Plate')?aItem.type:'ノーマル';note=aIt.active&&aItem.kind==='Plate'?'プレートによるタイプ':'有効なプレートなし';locked=true;} if(!locked&&move.name==='しぜんのめぐみ'){const ngState=itemActiveForMoveType('A',aItem,aState,dState,o,move.name);type=(ngState.active&&aItem.isBerry&&aItem.naturalGiftType)?aItem.naturalGiftType:'ノーマル';note=ngState.active&&aItem.isBerry?'きのみのしぜんのめぐみタイプ':'有効なきのみなし';locked=true;} if(!locked&&move.name==='だいちのはどう'){const map={'エレキフィールド':'でんき','グラスフィールド':'くさ','ミストフィールド':'フェアリー','サイコフィールド':'エスパー'};type=map[o.field]||'ノーマル';note=map[o.field]?'フィールド='+o.field+'、接地判定は暫定有効':'フィールドなし';locked=true;} if(!locked&&move.name==='マルチアタック'){type=(aIt.active&&aItem.kind==='Memory')?aItem.type:'ノーマル';note=aIt.active&&aItem.kind==='Memory'?'メモリによるタイプ':'有効なメモリなし';locked=true;} if(!locked&&move.name==='めざめるダンス'){if(o.attackerSpecialState==='zmove'||o.attackerSpecialState==='special_z'){type='ノーマル';note='Zワザ時はノーマル';}else if(o.attackerTeraType&&o.attackerTeraType!=='なし'&&o.attackerTeraType!=='ステラ'){type=o.attackerTeraType;note='テラスタル時はテラスタイプ';}else{type=(calcTypes&&calcTypes[0]&&calcTypes[0]!=='タイプなし')?calcTypes[0]:'ノーマル';note='計算上タイプ1';}locked=true;} if(!locked&&move.name==='めざめるパワー'){type=hiddenPowerType(as.input.ivs);note='個体値から算出';locked=true;} if(!locked&&move.name==='テクノバスター'){type=(aIt.active&&aItem.kind==='Drive')?aItem.type:'ノーマル';note=aIt.active&&aItem.kind==='Drive'?'カセットによるタイプ':'有効なカセットなし';locked=true;} if(!locked&&move.name==='レイジングブル'){const rbType=window.DAMEKE_DATA_HELPERS.formMoveType('レイジングブル',attacker,null);if(rbType){type=rbType;note='ケンタロス系統によるタイプ';locked=true;}} if(!locked&&aState.active&&aState.ability&&aState.ability.name){const st=skinType(aState.ability);const blockedZ=move.isZMove&&move.category!=='変化';const pledgeBlocked=o.pledgeCombination&&PLEDGE_MOVES.has(originalMove.name);if(st&&move.name!=='わるあがき'&&!blockedZ&&!pledgeBlocked){if(aState.ability.name==='ノーマルスキン'){type='ノーマル';note='ノーマルスキン';locked=true;}else if(type==='ノーマル'){type=st;note=aState.ability.name+'によりノーマル技を変換';locked=true;}}} if(!locked&&aState.active&&aState.ability.kind==='LiquidVoice'&&window.DAMEKE_DATA_HELPERS.moveTag(move,'sound')){type='みず';note='うるおいボイス + 音技';locked=true;} if(!locked&&move.name==='オーラぐるま'){type=window.DAMEKE_DATA_HELPERS.formMoveType('オーラぐるま',attacker,'でんき');note='モルペコの姿によるタイプ';locked=true;} if(!locked&&move.name==='ツタこんぼう'){type=window.DAMEKE_DATA_HELPERS.formMoveType('ツタこんぼう',attacker,'くさ');note='オーガポンの姿によるタイプ';locked=true;} if(o.plasmaShower&&type==='ノーマル'){type='でんき';note+='、プラズマシャワーでノーマル→でんき';}return{type,note};}
  function resolveEffectiveWeather(o,aState,dState,aAb,dAb,aIt,dIt,aItem,dItem){
    var raw=o.weather||'なし';
    var aw=raw,dw=raw,notes=[];
    if(aState.active&&aAb.name==='メガソーラー'){aw='にほんばれ';dw='にほんばれ';notes.push('攻撃側メガソーラー: 両側天候=にほんばれ');}
    if((aState.active&&window.DAMEKE_DATA_HELPERS.abilityTag(aAb,'ignoreWeather'))||(dState.active&&window.DAMEKE_DATA_HELPERS.abilityTag(dAb,'ignoreWeather'))||raw==='ノーてんき・エアロック'||o.weatherSuppressField){aw='なし';dw='なし';notes.push('ノーてんき・エアロック: 両側天候=なし');}
    if(aIt.active&&aItem.kind==='WeatherIgnore'&&['にほんばれ','おおひでり','あめ','おおあめ'].includes(aw)){aw='なし';notes.push('攻撃側ばんのうがさ: 攻撃側天候=なし');}
    if(dIt.active&&dItem.kind==='WeatherIgnore'&&['にほんばれ','おおひでり','あめ','おおあめ'].includes(dw)){dw='なし';notes.push('防御側ばんのうがさ: 防御側天候=なし');}
    o.attackerEffectiveWeather=aw;o.defenderEffectiveWeather=dw;
    return {raw:raw,attacker:aw,defender:dw,note:notes.join('、')||'入力どおり'};
  }
  function calculateDamage(input){const trace=[],o=input.options||{},atk=input.attacker,def=input.defender,al=cl(i(input.attackerLevel,50),1,100),dl=cl(i(input.defenderLevel,50),1,100);const aItem=by(DATA.items,o.attackerItemId||'none'),dItem=by(DATA.items,o.defenderItemId||'none'),aAb=by(DATA.abilities,o.attackerAbilityId||'なし'),dAb=by(DATA.abilities,o.defenderAbilityId||'なし');const aSpec=by(DATA.specialStates,o.attackerSpecialState||'none'),dSpec=by(DATA.specialStates,o.defenderSpecialState||'none'),tf=resolveSpecialMove(atk,input.move,aSpec),m=tf.move,defDyn=(dSpec.kind==='dynamax'||dSpec.kind==='gmax')&&!def.cannotDynamax;const ev=abilityStates(aAb,dAb,aItem,dItem,o),baseA=ev.attackerAbilityState,baseD=ev.defenderAbilityState,ig=ignored(baseA,baseD,dItem,m,o),aState=baseA,dState=ig.ignored?Object.assign({},baseD,{active:false,status:'無視',reason:ig.reason,ignored:true}):baseD,aIt=itemActive('A',aItem,aState,dState,o),dIt=itemActive('D',dItem,dState,aState,o);var weatherResolution=resolveEffectiveWeather(o,aState,dState,aAb,dAb,aIt,dIt,aItem,dItem);const aCalc=resolveCalcTypes('A',atk,aState,aItem,o,dState),dCalc=resolveCalcTypes('D',def,dState,dItem,o,aState),baseAs=getActualStats(atk,al,o.attackerStats),baseDs=getActualStats(def,dl,o.defenderStats),transformed=applyTransformOps(baseAs,baseDs,o.transformOps||[],ignoreWonderRawSwap(aState,m)),as=transformed.attacker,ds=transformed.defender;const aHp=hpBlock('A',atk,as,aItem,aIt,aState,tf.isDynamaxActive,o),dHp=hpBlock('D',def,ds,dItem,dIt,dState,defDyn,o),crit=criticalState(dState,o,m,aState,aAb,aItem,aIt,atk),er=effectiveRanks(as.input.ranks,ds.input.ranks,aState,dState,m,o,crit),cat=categoryDecision(m,as,ds,o.attackerTeraType||'なし',al,transformed.wonderRoomActive),moveType=resolveMoveType({move:m,originalMove:input.move,attacker:atk,as,aState,dState,aItem,aIt,o,calcTypes:aCalc.types});const phys=cat.category==='物理',an=phys?'A':'C',dn=phys?'B':'D',af=rank(as[an],er.attacker[an],false,true),df=rank(ds[dn],er.defender[dn],false,false),type=combo(moveType.type,dCalc.types),sr=stab(moveType.type,atk.types);const aGrounding=sideGrounded('A',atk,aState,aIt,aItem,o,aCalc.types),dGrounding=sideGrounded('D',def,dState,dIt,dItem,o,dCalc.types);const cState=contactState(m,aState,aItem,aIt,dState);
    trace.push(st('00 持ち物（攻撃側）',aItem.name,aIt.status,aIt.reason));trace.push(st('00 持ち物（防御側）',dItem.name,dIt.status,dIt.reason));trace.push(st('00 特性（攻撃側）',aAb.name,aState.status,aState.reason));trace.push(st('00 特性（防御側）',dAb.name,dState.status,dState.reason));trace.push(st('00 天候','現在値',o.weather||'なし'));trace.push(st('00 フィールド','現在値',o.field||'なし'));trace.push(st('00 急所','指定',crit.rank>0?'あり':'なし',crit.reason));trace.push(st('00 Z・ダイマックス（攻撃側）',aSpec.name,tf.info.status,tf.info.reason));trace.push(st('00 Z・ダイマックス（防御側）',dSpec.name,defDyn?'有効':(dSpec.kind==='none'?'なし':'無効'),def.cannotDynamax?def.name+'はダイマックス不可':''));trace.push(st('00 テラスタル（攻撃側）','タイプ',o.attackerTeraType||'なし','現時点ではタイプ変更未反映'));trace.push(st('00 テラスタル（防御側）','タイプ',o.defenderTeraType||'なし','現時点ではタイプ変更未反映'));trace.push(st('00 技名変換',tf.info.originalMoveName,tf.info.transformedMoveName));trace.push(st('00 強化技効果','通常技固有効果',tf.info.effectReset,tf.info.enhancedEffectNote));trace.push(st('02 計算上タイプ（攻撃側）','タイプ',aCalc.types.join('/'),aCalc.notes));trace.push(st('02 計算上タイプ（防御側）','タイプ',dCalc.types.join('/'),dCalc.notes));trace.push(st('02 実数値操作','適用順',transformed.logs.length?transformed.logs.join(' / '):'なし','最終ワンダールーム='+(transformed.wonderRoomActive?'ON':'OFF')+(transformed.wonderRoomRawIgnored?'、B/D入替のみ無効':'')));trace.push(st('02 接地判定（攻撃側）','地面にいる',aGrounding.grounded?'有効':'無効',aGrounding.reason));trace.push(st('02 接地判定（防御側）','地面にいる',dGrounding.grounded?'有効':'無効',dGrounding.reason));trace.push(st('02 まきびし接地判定','注記','通常接地判定とは別処理','まきびしは、くろいてっきゅう・じゅうりょく・本来ひこうタイプ・ふゆう・ふうせんだけで繰り出し時判定'));trace.push(st('02 実効ランク（攻撃側）','A/B/C/D/S/命中回避',ranksToText(er.attacker)+' / 命中回避'+er.hitRank,er.notes+'、'+er.hitNote));trace.push(st('02 実効ランク（防御側）','A/B/C/D/S',ranksToText(er.defender),er.notes));trace.push(st('02 攻撃側ランク補正込み実数値','H/A/B/C/D/S',effectiveRankedStatsText(aHp,as,er.attacker,true),'Hは現在/最大。ABCDSは実効ランク反映後。設置技='+aHp.hazardDamage+'、'+aHp.notes));trace.push(st('02 防御側ランク補正込み実数値','H/A/B/C/D/S',effectiveRankedStatsText(dHp,ds,er.defender,false),'Hは現在/最大。ABCDSは実効ランク反映後。設置技='+dHp.hazardDamage+'、'+dHp.notes));trace.push(st('02 物理/特殊判定',m.name,cat.category,cat.reason+' / '+cat.detail));trace.push(st('02 技タイプ',m.name,moveType.type,moveType.note));trace.push(st('N54 補正後攻撃側実数値',an,as[an]+' -> '+af+' / 実効ランク '+er.attacker[an]));trace.push(st('N57 補正後防御側実数値',dn,ds[dn]+' -> '+df+' / 実効ランク '+er.defender[dn]));trace.push(st('N46 変動後威力','現在値',m.power??'特殊'));trace.push(st('N64 ダメージ変動値','タイプ一致',formatRate(sr)));trace.push(st('N64 ダメージ変動値','相性',formatRate(type.rate)));for(const d of type.details)trace.push(st('タイプ相性詳細',d.attackType+' -> '+d.defenseType,d.single+' / 合成 '+d.before+' -> '+d.after));trace.push(pend('N66 ダメージ補正値','各補正値','枠のみ'));
    let invalid='',rolls=[];if(type.rate===0){invalid='タイプ相性により無効';rolls=[0];}else if(m.damageKind==='AttackerLevel')rolls=[al];else if(cat.category==='変化')rolls=[0];else{const b=baseDamage(al,m.power,af,df);trace.push(st('基本ダメージ','前',b));const pr=o.protect?(m.protectRate4096||0):4096;if(o.protect&&pr===0)invalid='まもる状態により0ダメージ';for(let f=85;f<=100;f++){let d=mod(mod(mod(fl(b*f/100),sr),type.rate),pr);if(d<1&&!invalid)d=1;if(invalid)d=0;rolls.push(d);}trace.push(st('N64 ダメージ変動値','まもる',o.protect?formatRate(pr):formatRate(4096),o.protect&&pr===1024?'Z/ダイマ技のため25%':''));}trace.push(st('N68 乱数','85から100',rolls.join(', ')));trace.push(st('N79 優先度','現在値',m.priority??0));trace.push(st('N80 直接攻撃判定','現在値',cState.contact?'直接':'非直接',cState.reason));trace.push(st('N81 無効要素','現在値',invalid||'なし'));const min=Math.min(...rolls),max=Math.max(...rolls),hp=dHp.maxFinal||ds.H;return{attackerName:atk.name,defenderName:def.name,moveName:m.name,effectiveCategory:cat.category,effectiveType:moveType.type,rolls,trace,defenderMaxHp:dHp.maxFinal,defenderCurrentHp:dHp.currentFinal,typeRate4096:type.rate,minDamage:min,maxDamage:max,minRate:hp?min/hp*100:0,maxRate:hp?max/hp*100:0,attackerEffectiveWeather:weatherResolution.attacker,defenderEffectiveWeather:weatherResolution.defender,weatherResolution:weatherResolution,criticalEffective:crit.effective,criticalForced:crit.forced,criticalRank:crit.rank,criticalBlocked:crit.blocked,contactEffective:cState.contact,hitRank:er.hitRank,__coreState:{attackerAbilityState:aState,defenderAbilityState:dState,attackerItemState:aIt,defenderItemState:dIt,attackerAbility:aAb,defenderAbility:dAb,attackerItem:aItem,defenderItem:dItem}};}
  window.DAMEKE_CALC={calculateDamage,getActualStats,previewBaseMaxHp,resolveSpecialMove};
})();


// v0.16 power variation wrapper
(function(){
  const D = window.DAMEKE_DATA;
  const C = window.DAMEKE_CALC;
  if(!D || !C || !C.calculateDamage || C.__powerVariationPatched) return;
  var originalPowerVariation = C.calculateDamage.bind(C);
  function int(v,f){const n=parseInt(v,10);return Number.isFinite(n)?n:f;}
  function fl(x){return window.DAMEKE_ROUNDING.floor(x);}
  function roundFiveDown(x){var f=Math.floor(x),r=x-f;return r>0.5?f+1:f;}
  function clamp(v,a,b){return Math.min(Math.max(v,a),b);}
  var rank = window.DAMEKE_CALC_SHARED.rank;
  function spToEv(sp){sp=clamp(int(sp,0),0,32);if(sp<=0)return 0;if(sp===32)return 252;return 4+(sp-1)*8;}
  function stats(p,level,input){const src=input||{},iv=src.ivs||{},ev=src.evs||{},ranks=src.ranks||{},b=p.baseStats,o={input:{ivs:iv,evs:ev,ranks}};for(const k of ['H','A','B','C','D','S']){const evv=spToEv(ev[k]);o[k]=k==='H'?fl(((2*b[k]+int(iv[k],31)+fl(evv/4))*level)/100)+level+10:fl(((2*b[k]+int(iv[k],31)+fl(evv/4))*level)/100)+5;if(k==='H'&&window.DAMEKE_DATA_HELPERS.pokemonMatches(p,'ヌケニン'))o[k]=1;if(k!=='H')o[k]=window.DAMEKE_NATURE.apply(o[k],k,src);}return o;}
  function typeRate(t,dt){if(!dt||dt==='タイプなし')return 4096;return ((D.typeChart4096&&D.typeChart4096[t])||{})[dt]??4096;}
  function combo(t,types){let r=4096;for(const dt of (types||[])){r=fl(r*typeRate(t,dt)/4096);}return r;}
  function mod(v,r){return fl(v*r/4096);}
  function baseDamage(level,power,atk,def){if(!power||def<=0)return 0;return fl(fl((fl(2*level/5)+2)*power*atk/def)/50)+2;}
  function weightPower(w){w=Number(w||100);if(w<10)return 20;if(w<25)return 40;if(w<50)return 60;if(w<100)return 80;if(w<200)return 100;return 120;}
  function heavySlamPower(a,d){a=Number(a||100);d=Number(d||100);if(d<=a/5)return 120;if(d<=a/4)return 100;if(d<=a/3)return 80;if(d<=a/2)return 60;return 40;}
  function positiveRankSum(r){let s=0;for(const k of ['A','B','C','D','S','acc','eva']){var v=Number(r[k]);if(!isNaN(v)&&v>0)s+=v;}return s;}
  function currentHp(max,input){return input===''||input==null?max:clamp(int(input,max),1,max);}
  function reversalPower(cur,max){const x=fl(cur*48/max);if(x>=33)return 20;if(x>=17)return 40;if(x>=10)return 80;if(x>=5)return 100;if(x>=2)return 150;return 200;}
  function speedValue(st){return rank(st.S, st.input.ranks.S||0);}
  function isGroundedForTerrain(result){ return window.DAMEKE_CALC_SHARED.isGrounded(result,'A'); }
  function getMoveType(result,move){return result.effectiveType || move.type || 'ノーマル';}
  function getDefTypes(result,def){return result.defenderTypes || def.types || [];}
  function onePower(move,ctx,hit){const o=ctx.o,kind=move.powerKind,base=move.power;switch(kind){
    case 'GForce': return {power:o.gravity?135:90,note:o.gravity?'じゅうりょく':'通常'};
    case 'Rollout': {const h=clamp(int(o.rolloutHit,1),1,5);let p=30*Math.pow(2,h-1);if(o.defenseCurl)p*=2;return{power:p,note:'回数'+h+(o.defenseCurl?'、まるくなる':'')}}
    case 'Acrobatics': return {power:(!ctx.holdingItem || ctx.gemFires)?110:55,note:!ctx.holdingItem?'持ち物なし':ctx.gemFires?'ジュエル消費で持ち物なし':'通常'};
    case 'PositiveRankUser': return {power:20+positiveRankSum(ctx.aStats.input.ranks)*20,note:'攻撃側プラスランク'};
    case 'WeatherBall': return {power:ctx.moveType!=='ノーマル'?100:50,note:ctx.moveType!=='ノーマル'?'タイプ変化あり':'通常'};
    case 'EchoedVoice': return {power:40*clamp(int(o.echoedVoiceCount,1),1,5),note:'回数'};
    case 'DoubleIfFirst': return {power:o.moveOrder==='first'?170:85,note:o.moveOrder==='first'?'先攻':'通常'};
    case 'ElectroBall': {const a=ctx.aSpeed,d=ctx.dSpeed;let p=40;if(d!==0){const r=a/d;p=r>=4?150:r>=3?120:r>=2?80:r>=1?60:40;}return{power:p,note:'S比較'}}
    case 'Pursuit': return {power:o.targetSwitching?80:40,note:o.targetSwitching?'交代':'通常'};
    case 'PositiveRankTarget': return {power:Math.min(200,60+positiveRankSum(ctx.dStats.input.ranks)*20),note:'防御側プラスランク'};
    case 'LastRespects': return {power:50+clamp(int(o.faintedAllies,0),0,100)*50,note:'味方ひんし数'};
    case 'Friendship': return {power:Math.max(1,fl(clamp(int(o.friendship,255),0,255)*10/25)),note:'なつき度'};
    case 'Frustration': return {power:Math.max(1,fl((255-clamp(int(o.friendship,0),0,255))*10/25)),note:'なつき度'};
    case 'DoubleIfTargetFlying': return {power:o.defenderSemiInvulnerable==='そらをとぶ'?80:40,note:o.defenderSemiInvulnerable==='そらをとぶ'?'そらをとぶ':'通常'};
    case 'Reversal': return {power:reversalPower(ctx.aCurrent,ctx.aMax),note:'HP割合'};
    case 'DoubleIfTargetParalyzed': return {power:o.defenderStatus==='まひ'?140:70,note:o.defenderStatus==='まひ'?'まひ':'通常'};
    case 'TrumpCard': {const pp=clamp(int(o.remainingPP,4),0,8);return{power:pp===0?200:pp===1?80:pp===2?60:pp===3?50:40,note:'残りPP'}}
    case 'Pledge': return {power:o.pledgeCombination?150:80,note:o.pledgeCombination?'コンビネーション':'通常'};
    case 'LowKick': return {power:weightPower(ctx.defWeight),note:'防御側重さ'};
    case 'UserHp150': return {power:Math.max(1,fl(150*ctx.aCurrent/ctx.aMax)),note:'攻撃側HP割合'};
    case 'NaturalGift': return {power:ctx.itemNaturalGiftPower||80,note:'きのみデータ'};
    case 'DoubleIfLastMoveFailed': return {power:o.lastMoveFailed?150:75,note:o.lastMoveFailed?'前ターン失敗':'通常'};
    case 'DoubleIfMovedSecond': return {power:o.moveOrder==='second'?100:50,note:o.moveOrder==='second'?'後攻':'通常'};
    case 'TargetHp120': return {power:Math.max(1,roundFiveDown(120*ctx.dCurrent/ctx.dMax)),note:'防御側HP割合'};
    case 'GyroBall': return {power:ctx.aSpeed<=1?1:Math.min(150,Math.max(1,fl(25*ctx.dSpeed/ctx.aSpeed+1))),note:'S比較'};
    case 'TerrainPulse': return {power:(ctx.attackerGrounded&&o.field&&o.field!=='なし')?100:50,note:(ctx.attackerGrounded&&o.field&&o.field!=='なし')?'接地+フィールド':'通常'};
    case 'DoubleIfTargetStatus': return {power:(o.defenderStatus&&o.defenderStatus!=='なし')?base*2:base,note:'状態異常'};
    case 'DoubleIfTargetDamaged': return {power:o.targetDamagedThisTurn?120:60,note:o.targetDamagedThisTurn?'このターン被ダメ':'通常'};
    case 'TeraBlast': return {power:o.attackerTeraType==='ステラ'?100:80,note:o.attackerTeraType==='ステラ'?'ステラ':'通常'};
    case 'DoubleIfTargetPoison': return {power:o.defenderStatus==='どく'?120:60,note:o.defenderStatus==='どく'?'どく':'通常'};
    case 'Fling': return {power:ctx.itemFlingPower||10,note:'持ち物データ'};
    case 'HardPress': return {power:Math.max(1,roundFiveDown(100*ctx.dCurrent/ctx.dMax)),note:'防御側HP割合'};
    case 'SpitUp': return {power:clamp(int(o.stockpileCount,1),1,3)*100,note:'たくわえる'};
    case 'HeavySlam': return {power:heavySlamPower(ctx.atkWeight,ctx.defWeight),note:'重さ比'};
    case 'Present': return {power:clamp(int(o.presentPower,40),40,120),note:'選択値'};
    case 'RageFist': return {power:Math.min(350,50+clamp(int(o.rageFistHitCount,0),0,6)*50),note:'被ダメ回数'};
    case 'Magnitude': return {power:clamp(int(o.magnitudePower,70),10,150),note:'選択値'};
    case 'WaterShuriken': return {power:window.DAMEKE_DATA_HELPERS.pokemonMatches(ctx.attacker,['ゲッコウガ(サトシ)','greninja_ash'])?20:15,note:'みずしゅりけん'};
    case 'DoubleIfTargetSleep': return {power:o.defenderStatus==='ねむり'?140:70,note:'ねむり'};
    case 'DoubleIfUserDamaged': return {power:o.userDamagedThisTurn?120:60,note:o.userDamagedThisTurn?'自分が被ダメ':'通常'};
    case 'Round': return {power:o.roundAllyUsed?120:60,note:o.roundAllyUsed?'他のりんしょう':'通常'};
    case 'FuryCutter': return {power:Math.min(160,40*Math.pow(2,clamp(int(o.furyCutterCount,1),1,3)-1)),note:'回数'};
    case 'TripleAxel': return {power:20*hit,note:'ヒットごと'};
    case 'TripleKick': return {power:10*hit,note:'ヒットごと'};
    default: return {power:base||1,note:'元威力'};
  }}
  function hitCount(move,ctx){if(move.powerKind==='TripleAxel'||move.powerKind==='TripleKick')return 3;if(move.powerKind==='WaterShuriken')return window.DAMEKE_DATA_HELPERS.pokemonMatches(ctx.attacker,['ゲッコウガ(サトシ)','greninja_ash'])?3:5;return 1;}
  var originalPowerVariation = C.calculateDamage.bind(C);
  C.calculateDamage=function(input){
    const result= originalPowerVariation(input);
    const o=input.options||{};
    if(o.attackerSpecialState&&o.attackerSpecialState!=='none') return result;
    const move=input.move;
    if(!move.powerKind) return result;
    const level=clamp(int(input.attackerLevel,50),1,100), dlevel=clamp(int(input.defenderLevel,50),1,100);
    const aStats=stats(input.attacker,level,o.attackerStats), dStats=stats(input.defender,dlevel,o.defenderStats);
    const aMax=aStats.H,dMax=dStats.H,aCurrent=currentHp(aMax,o.attackerCurrentHpInput),dCurrent=currentHp(dMax,o.defenderCurrentHpInput);
    const item=(D.items||[]).find(x=>x.id===o.attackerItemId)||{};
    const holdingItem=!(o.attackerNoItem||!item||item.id==='none');
    const gemFires=holdingItem&&item.kind==='Gem'&&item.type===getMoveType(result,move)&&window.DAMEKE_CALC_SHARED.activeItemWithFallback('A',item,o)&&window.DAMEKE_GEM_ELIGIBLE(move,move.name);
    const ctx={o,attacker:input.attacker,defender:input.defender,aStats,dStats,aMax,dMax,aCurrent,dCurrent,aSpeed:speedValue(aStats),dSpeed:speedValue(dStats),moveType:getMoveType(result,move),attackerGrounded:isGroundedForTerrain(result),holdingItem,gemFires,itemKind:item.kind,itemNaturalGiftPower:item.naturalGiftPower,itemFlingPower:item.flingPower,atkWeight:input.attacker.weight||100,defWeight:input.defender.weight||100};
    const count=hitCount(move,ctx), hitPlan=[];
    for(let h=1;h<=count;h++){const p=onePower(move,ctx,h);hitPlan.push({hitIndex:h,basePower:p.power,note:p.note});}
    const category=result.effectiveCategory||move.category;
    const an=category==='物理'?'A':'C', dn=category==='物理'?'B':'D';
    const af=rank(aStats[an],aStats.input.ranks[an]||0), df=rank(dStats[dn],dStats.input.ranks[dn]||0);
    const tr=combo(ctx.moveType,getDefTypes(result,input.defender));
    const sr=(input.attacker.types||[]).includes(ctx.moveType)?6144:4096;
    const details=[];let totalMin=0,totalMax=0,firstRolls=[];
    for(const hp of hitPlan){let rolls=[];if(tr===0||!hp.basePower||category==='変化') rolls=[0]; else {const b=baseDamage(level,hp.basePower,af,df);for(let f=85;f<=100;f++){let d=mod(mod(fl(b*f/100),sr),tr);if(d<1)d=1;rolls.push(d);}}
      if(!firstRolls.length) firstRolls=rolls; const mn=Math.min(...rolls),mx=Math.max(...rolls);totalMin+=mn;totalMax+=mx;details.push(hp.hitIndex+'回目 威力'+hp.basePower+' ダメージ'+mn+'-'+mx);
    }
    result.hitPlan=hitPlan; result.rolls=firstRolls; result.minDamage=totalMin; result.maxDamage=totalMax; const hpMax=result.defenderMaxHp||dMax; result.minRate=hpMax?totalMin/hpMax*100:0; result.maxRate=hpMax?totalMax/hpMax*100:0;
    const n46=(result.trace||[]).find(x=>String(x.label).includes('N46'));
    if(n46){n46.name='HitPlan';n46.value=hitPlan.map(h=>h.hitIndex+'回目='+h.basePower+'（'+h.note+'）').join(' / ');n46.note='威力変動反映';}
    result.trace.push({label:'連続攻撃',name:'ヒット別',value:details.join(' / '),note:'v0.16 威力変動処理',implemented:true});
    return result;
  };
  C.__powerVariationPatched=true;
})();


// v0.17 detailed speed calculation patch v2
(function(){
  var D = window.DAMEKE_DATA;
  var C = window.DAMEKE_CALC;
  if(!D || !C || !C.calculateDamage || C.__speedPatchedV2) return;
  var num = window.DAMEKE_CALC_SHARED.num;
  function fl(x){return window.DAMEKE_ROUNDING.floor(x);}
  function roundHalfUp(x){return Math.floor(x+0.5);}
  function roundFiveDown(x){return window.DAMEKE_ROUNDING.roundFiveDown(x);}
  function clamp(v,a,b){return Math.min(Math.max(v,a),b);}
  function by(list,id){return (list||[]).find(function(x){return x.id===id;}) || (list||[])[0] || {};}
  var rank = window.DAMEKE_CALC_SHARED.rank;
  function spToEv(sp){sp=clamp(num(sp,0),0,32);if(sp<=0)return 0;if(sp===32)return 252;return 4+(sp-1)*8;}
  function makeStats(p,level,input){var src=input||{},iv=src.ivs||{},ev=src.evs||{},ranks=src.ranks||{},b=p.baseStats,o={input:{ivs:iv,evs:ev,ranks:ranks}};['H','A','B','C','D','S'].forEach(function(k){var evv=spToEv(ev[k]);o[k]=k==='H'?fl(((2*b[k]+num(iv[k],31)+fl(evv/4))*level)/100)+level+10:fl(((2*b[k]+num(iv[k],31)+fl(evv/4))*level)/100)+5;if(k==='H'&&window.DAMEKE_DATA_HELPERS.pokemonMatches(p,'ヌケニン'))o[k]=1;if(k!=='H')o[k]=window.DAMEKE_NATURE.apply(o[k],k,src);});return o;}
  var activeItem = window.DAMEKE_CALC_SHARED.activeItemWithFallback;
  var activeAbility = window.DAMEKE_CALC_SHARED.activeAbilityWithFallback;
  function rateText(r){return r+'/4096 ('+(r/4096).toFixed(2)+'倍)';}
  function otherWeatherIgnored(side,o){var other=by(D.abilities, side==='A'?o.defenderAbilityId:o.attackerAbilityId);var no=side==='A'?o.defenderNoAbility:o.attackerNoAbility;return !no && (other.kind==='IgnoreWeather'||other.name==='ノーてんき'||other.name==='エアロック');}
  function itemRate(side,pokemon,item,itemOk){if(!itemOk||!item)return{rate:4096,reason:'なし'};if(item.kind==='SpeedPowder'&&pokemon.name==='メタモン')return{rate:8192,reason:'スピードパウダー'};if(item.kind==='ChoiceScarf'||item.name==='こだわりスカーフ')return{rate:6144,reason:'こだわりスカーフ'};if(item.kind==='Grounding'||item.kind==='SpeedHalve'||['くろいてっきゅう','パワーウエイト','パワーリスト','パワーベルト','パワーレンズ','パワーバンド','パワーアンクル','きょうせいギプス'].includes(item.name))return{rate:2048,reason:item.name};return{rate:4096,reason:'なし'};}
  function abilityRate(side,pokemon,ability,item,itemOk,status,o){if(!ability||!ability.name)return{rate:4096,reason:'なし',noPara:false};var w=(side==='A'?o.attackerEffectiveWeather:o.defenderEffectiveWeather)||o.weather||'なし',f=o.field||'なし',umbrella=false,ignore=false,name=ability.name;function r(rate,reason,noPara){return{rate:rate,reason:reason,noPara:!!noPara};}
    if(name==='ようりょくそ'&&!ignore&&!umbrella&&(w==='にほんばれ'||w==='おおひでり'))return r(8192,'ようりょくそ');
    if(name==='すいすい'&&!ignore&&!umbrella&&(w==='あめ'||w==='おおあめ'))return r(8192,'すいすい');
    if(name==='すなかき'&&!ignore&&w==='すなあらし')return r(8192,'すなかき');
    if(name==='ゆきかき'&&!ignore&&w==='ゆき')return r(8192,'ゆきかき');
    if(name==='サーフテール'&&f==='エレキフィールド')return r(8192,'サーフテール');
    if(name==='スロースタート'&&(side==='A'?o.attackerSlowStart:o.defenderSlowStart))return r(2048,'スロースタート発動');
    if(name==='かるわざ'&&(side==='A'?o.attackerUnburden:o.defenderUnburden))return r(8192,'かるわざ発動');
    if(name==='はやあし'&&status&&status!=='なし')return r(6144,'はやあし',status==='まひ');
    if((name==='こだいかっせい'||name==='クォークチャージ')&&((side==='A'?o.attackerParadoxBoostStat:o.defenderParadoxBoostStat)==='S'))return r(6144,name+' 素早さ上昇');
    return r(4096,'なし');}
  function calcSpeed(side,pokemon,rawS,rankStage,status,o){var item=by(D.items,side==='A'?o.attackerItemId:o.defenderItemId),ab=by(D.abilities,side==='A'?o.attackerAbilityId:o.defenderAbilityId);var itemOk=activeItem(side,item,o),abOk=activeAbility(side,ab,o);var afterRank=rank(rawS,rankStage);var mod=4096,logs=[];function apply(src,rate,reason){var before=mod;mod=roundHalfUp(mod*rate/4096);logs.push(src+' '+reason+': '+before+'->'+mod+' '+rateText(rate));}
    var ar=abOk?abilityRate(side,pokemon,ab,item,itemOk,status,o):{rate:4096,reason:'特性なし',noPara:false};if(ar.rate!==4096)apply('特性',ar.rate,ar.reason);
    var ir=itemRate(side,pokemon,item,itemOk);if(ir.rate!==4096)apply('持ち物',ir.rate,ir.reason);
    if(side==='A'&&o.attackerTailwind)apply('条件',8192,'おいかぜ');if(side==='D'&&o.defenderTailwind)apply('条件',8192,'おいかぜ');
    if(side==='A'&&o.attackerSwamp)apply('条件',1024,'しつげん');if(side==='D'&&o.defenderSwamp)apply('条件',1024,'しつげん');
    if(mod<410){logs.push('最小410: '+mod+'->410');mod=410;}var afterMod=roundFiveDown(afterRank*mod/4096);var para=status==='まひ'?2048:4096;if(ar.noPara||(abOk&&ab&&ab.name==='はやあし'&&status==='まひ'))para=4096;var fin=Math.min(10000,fl(afterMod*para/4096));return{final:fin,afterRank:afterRank,modifier:mod,log:logs.join(' / ')||'なし',para:para};}
  function typeRate(t,dt){if(!dt||dt==='タイプなし')return 4096;return ((D.typeChart4096&&D.typeChart4096[t])||{})[dt]??4096;}
  function combo(t,types){var r=4096;(types||[]).forEach(function(dt){r=fl(r*typeRate(t,dt)/4096);});return r;}
  function modDamage(v,r){return fl(v*r/4096);}
  function baseDamage(level,power,atk,def){if(!power||power<=0||def<=0)return 0;return fl(fl((fl(2*level/5)+2)*power*atk/def)/50)+2;}
  function recalcSpeedMove(result,input,as,ds,aSp,dSp){var move=input.move;if(move.powerKind!=='ElectroBall'&&move.powerKind!=='GyroBall')return;var o=input.options||{},level=clamp(num(input.attackerLevel,50),1,100);var cat=result.effectiveCategory||move.category,an=cat==='物理'?'A':'C',dn=cat==='物理'?'B':'D';var atk=rank(as[an],(as.input.ranks||{})[an]||0),def=rank(ds[dn],(ds.input.ranks||{})[dn]||0);var power=40,note='詳細S比較';if(move.powerKind==='ElectroBall'){if(dSp.final===0)power=40;else{var rr=aSp.final/dSp.final;power=rr>=4?150:rr>=3?120:rr>=2?80:rr>=1?60:40;}}else{power=aSp.final<=1?1:Math.min(150,Math.max(1,fl(25*dSp.final/aSp.final+1)));}
    var tr=combo(result.effectiveType||move.type,result.defenderTypes||input.defender.types),sr=(input.attacker.types||[]).includes(result.effectiveType||move.type)?6144:4096;var rolls=[];if(tr===0||cat==='変化')rolls=[0];else{var b=baseDamage(level,power,atk,def);for(var f=85;f<=100;f++){var d=modDamage(modDamage(fl(b*f/100),sr),tr);if(d<1)d=1;rolls.push(d);}}
    result.hitPlan=[{hitIndex:1,basePower:power,note:note}];result.rolls=rolls;result.minDamage=Math.min.apply(null,rolls);result.maxDamage=Math.max.apply(null,rolls);var hp=result.defenderMaxHp||ds.H;result.minRate=hp?result.minDamage/hp*100:0;result.maxRate=hp?result.maxDamage/hp*100:0;var n46=(result.trace||[]).find(function(x){return String(x.label).includes('N46');});if(n46){n46.name='HitPlan';n46.value='1回目='+power+'（'+note+'）';n46.note='詳細すばやさ反映';}}
  var originalSpeedPatchV2 = C.calculateDamage.bind(C);
  C.calculateDamage=function(input){var result=originalSpeedPatchV2(input);var o=input.options||{};if(result&&result.__coreState)o.__coreState=result.__coreState;al=clamp(num(input.attackerLevel,50),1,100),dl=clamp(num(input.defenderLevel,50),1,100);var as=makeStats(input.attacker,al,o.attackerStats),ds=makeStats(input.defender,dl,o.defenderStats);var aSp=calcSpeed('A',input.attacker,as.S,(as.input.ranks||{}).S||0,o.attackerStatus||'なし',o);var dSp=calcSpeed('D',input.defender,ds.S,(ds.input.ranks||{}).S||0,o.defenderStatus||'なし',o);
    function upsertLine(label,sp){var line=(result.trace||[]).find(function(x){return String(x.label)===label;});var note='ランク後='+sp.afterRank+' / 補正='+sp.modifier+' / '+sp.log+' / まひ='+sp.para;if(line){line.value=sp.final;line.note=note;}else result.trace.push({label:label,name:'実効S',value:sp.final,note:note,implemented:true});}
    upsertLine('02 すばやさ詳細（攻撃側）',aSp);upsertLine('02 すばやさ詳細（防御側）',dSp);
    (result.trace||[]).forEach(function(line){if(String(line.label).includes('攻撃側ランク補正込み実数値')&&typeof line.value==='string')line.value=line.value.replace(/\/[^\/]*$/, '/'+aSp.final);if(String(line.label).includes('防御側ランク補正込み実数値')&&typeof line.value==='string')line.value=line.value.replace(/\/[^\/]*$/, '/'+dSp.final);});
    recalcSpeedMove(result,input,as,ds,aSp,dSp);return result;};
  // Exposed for the 素早さ調整 tool: the exact same speed-modifier logic the calculator itself
  // uses internally (ability/item/おいかぜ/しつげん/まひ all included), so that tool never risks
  // drifting out of sync with how speed is actually computed here. Call as
  // calcSpeed('A', pokemon, rawS, rankStage, status, o) with o.attackerAbilityId/attackerItemId/
  // attackerTailwind/attackerSwamp populated (side is always 'A' for a standalone speed lookup --
  // there's no real "defender" side to speak of, this just reuses the same field names).
  C.calcSpeed = calcSpeed;
  C.__speedPatchedV2=true;
})();


// v0.18 calculated weight patch
(function(){
  var D = window.DAMEKE_DATA;
  var C = window.DAMEKE_CALC;
  if(!D || !C || !C.calculateDamage || C.__weightPatched) return;
  var num = window.DAMEKE_CALC_SHARED.num;
  function fl(x){return window.DAMEKE_ROUNDING.floor(x);}
  function clamp(v,a,b){return Math.min(Math.max(v,a),b);}
  function by(list,id){return (list||[]).find(function(x){return x.id===id;}) || (list||[])[0] || {};}
  var activeItem = window.DAMEKE_CALC_SHARED.activeItemWithFallback;
  var activeAbility = window.DAMEKE_CALC_SHARED.activeAbilityWithFallback;
  function trunc1(x){return Math.floor(x*10)/10;}
  function calcWeight(side,pokemon,o){var prefix=side==='A'?'attacker':'defender';var item=by(D.items,side==='A'?o.attackerItemId:o.defenderItemId);var ab=by(D.abilities,side==='A'?o.attackerAbilityId:o.defenderAbilityId);var itemOk=activeItem(side,item,o);var abOk=activeAbility(side,ab,o);var w=Number(pokemon.weight||0);var notes=['本来='+w.toFixed(1)+'kg'];var bp=clamp(num(o[prefix+'BodyPurge'],0),0,6);if(bp>0){w-=bp*100;notes.push('ボディパージ '+bp+'回 = -'+(bp*100)+'kg');}if(abOk&&ab.name==='ライトメタル'){var beforeLM=w;w=trunc1(w/2);notes.push('ライトメタル '+beforeLM.toFixed(1)+'kg->'+w.toFixed(1)+'kg');}if(abOk&&ab.name==='ヘヴィメタル'){var beforeHM=w;w=w*2;notes.push('ヘヴィメタル '+beforeHM.toFixed(1)+'kg->'+w.toFixed(1)+'kg');}if(itemOk&&item.kind==='WeightHalve'){var beforeKI=w;w=trunc1(w/2);notes.push('かるいし '+beforeKI.toFixed(1)+'kg->'+w.toFixed(1)+'kg');}if(w<=0.1){w=0.1;notes.push('最小0.1kg');}return{value:w,notes:notes.join('、')};}
  function weightPower(w){w=Number(w||0);if(w<10)return 20;if(w<25)return 40;if(w<50)return 60;if(w<100)return 80;if(w<200)return 100;return 120;}
  function heavyPower(a,d){if(d<=a/5)return 120;if(d<=a/4)return 100;if(d<=a/3)return 80;if(d<=a/2)return 60;return 40;}
  function spToEv(sp){sp=clamp(num(sp,0),0,32);if(sp<=0)return 0;if(sp===32)return 252;return 4+(sp-1)*8;}
  function makeStats(p,level,input){var src=input||{},iv=src.ivs||{},ev=src.evs||{},ranks=src.ranks||{},b=p.baseStats,o={input:{ivs:iv,evs:ev,ranks:ranks}};['H','A','B','C','D','S'].forEach(function(k){var evv=spToEv(ev[k]);o[k]=k==='H'?fl(((2*b[k]+num(iv[k],31)+fl(evv/4))*level)/100)+level+10:fl(((2*b[k]+num(iv[k],31)+fl(evv/4))*level)/100)+5;if(k==='H'&&window.DAMEKE_DATA_HELPERS.pokemonMatches(p,'ヌケニン'))o[k]=1;if(k!=='H')o[k]=window.DAMEKE_NATURE.apply(o[k],k,src);});return o;}
  var rank = window.DAMEKE_CALC_SHARED.rank;
  function typeRate(t,dt){if(!dt||dt==='タイプなし')return 4096;return ((D.typeChart4096&&D.typeChart4096[t])||{})[dt]??4096;}
  function combo(t,types){var r=4096;(types||[]).forEach(function(dt){r=fl(r*typeRate(t,dt)/4096);});return r;}
  function mod(v,r){return fl(v*r/4096);}
  function baseDamage(level,power,atk,def){if(!power||power<=0||def<=0)return 0;return fl(fl((fl(2*level/5)+2)*power*atk/def)/50)+2;}
  function recalcWeightMove(result,input,aW,dW){var move=input.move;if(move.powerKind!=='LowKick'&&move.powerKind!=='HeavySlam')return;var power=move.powerKind==='LowKick'?weightPower(dW.value):heavyPower(aW.value,dW.value);var note=move.powerKind==='LowKick'?'防御側計算上おもさ':'計算上おもさ比';var o=input.options||{},level=clamp(num(input.attackerLevel,50),1,100),dlevel=clamp(num(input.defenderLevel,50),1,100);var as=makeStats(input.attacker,level,o.attackerStats),ds=makeStats(input.defender,dlevel,o.defenderStats);var cat=result.effectiveCategory||move.category;var an=cat==='物理'?'A':'C',dn=cat==='物理'?'B':'D';var atk=rank(as[an],(as.input.ranks||{})[an]||0),def=rank(ds[dn],(ds.input.ranks||{})[dn]||0);var tr=combo(result.effectiveType||move.type,result.defenderTypes||input.defender.types);var sr=(input.attacker.types||[]).includes(result.effectiveType||move.type)?6144:4096;var rolls=[];if(tr===0||cat==='変化')rolls=[0];else{var b=baseDamage(level,power,atk,def);for(var f=85;f<=100;f++){var d=mod(mod(fl(b*f/100),sr),tr);if(d<1)d=1;rolls.push(d);}}result.hitPlan=[{hitIndex:1,basePower:power,note:note}];result.rolls=rolls;result.minDamage=Math.min.apply(null,rolls);result.maxDamage=Math.max.apply(null,rolls);var hp=result.defenderMaxHp||ds.H;result.minRate=hp?result.minDamage/hp*100:0;result.maxRate=hp?result.maxDamage/hp*100:0;var n46=(result.trace||[]).find(function(x){return String(x.label).includes('N46');});if(n46){n46.name='HitPlan';n46.value='1回目='+power+'（'+note+'）';n46.note='計算上おもさ反映';}}
  var originalWeightPatch = C.calculateDamage.bind(C);
  C.calculateDamage = function(input){var result=originalWeightPatch(input);var o=input.options||{};if(result&&result.__coreState)o.__coreState=result.__coreState;var aW=calcWeight('A',input.attacker,o);var dW=calcWeight('D',input.defender,o);var idx=-1;(result.trace||[]).forEach(function(x,i){if(String(x.label).includes('すばやさ詳細（防御側）'))idx=i;});var lines=[{label:'02 計算上おもさ（攻撃側）',name:'kg',value:aW.value.toFixed(1),note:aW.notes,implemented:true},{label:'02 計算上おもさ（防御側）',name:'kg',value:dW.value.toFixed(1),note:dW.notes,implemented:true}];if(!(result.trace||[]).some(function(x){return String(x.label)==='02 計算上おもさ（攻撃側）';})){if(idx>=0)result.trace.splice(idx+1,0,lines[0],lines[1]);else result.trace.push(lines[0],lines[1]);}recalcWeightMove(result,input,aW,dW);return result;};
  C.__weightPatched = true;
})();


// v0.20 multihit implementation
(function(){
  var D = window.DAMEKE_DATA;
  var C = window.DAMEKE_CALC;
  if(!D || !C || !C.calculateDamage || C.__multiHitPatched) return;
  var num = window.DAMEKE_CALC_SHARED.num;
  function fl(x){return window.DAMEKE_ROUNDING.floor(x);}
  function clamp(v,a,b){return Math.min(Math.max(v,a),b);}
  function spToEv(sp){sp=clamp(num(sp,0),0,32);if(sp<=0)return 0;if(sp===32)return 252;return 4+(sp-1)*8;}
  function stats(p,level,input){var src=input||{},iv=src.ivs||{},ev=src.evs||{},ranks=src.ranks||{},b=p.baseStats,o={input:{ivs:iv,evs:ev,ranks:ranks}};['H','A','B','C','D','S'].forEach(function(k){var evv=spToEv(ev[k]);o[k]=k==='H'?fl(((2*b[k]+num(iv[k],31)+fl(evv/4))*level)/100)+level+10:fl(((2*b[k]+num(iv[k],31)+fl(evv/4))*level)/100)+5;if(k==='H'&&window.DAMEKE_DATA_HELPERS.pokemonMatches(p,'ヌケニン'))o[k]=1;if(k!=='H')o[k]=window.DAMEKE_NATURE.apply(o[k],k,src);});return o;}
  var rank = window.DAMEKE_CALC_SHARED.rank;
  function typeRate(t,dt){if(!dt||dt==='タイプなし')return 4096;return ((D.typeChart4096&&D.typeChart4096[t])||{})[dt]??4096;}
  function combo(t,types){var r=4096;(types||[]).forEach(function(dt){r=fl(r*typeRate(t,dt)/4096);});return r;}
  function mod(v,r){return fl(v*r/4096);}
  function baseDamage(level,power,atk,def){if(!power||power<=0||def<=0)return 0;return fl(fl((fl(2*level/5)+2)*power*atk/def)/50)+2;}
  function pokeById(id){return (D.pokemons||[]).find(function(p){return p.id===id;}) || null;}
  function beatUpPokemon(mon){ return (D.getBeatUpAttackPokemon && D.getBeatUpAttackPokemon(mon)) || mon; }
  function partyForBeatUp(attacker,o){var party=[beatUpPokemon(attacker)];for(var i=1;i<=5;i++){var id=o['beatUpAlly'+i];if(id&&id!=='none'){var p=pokeById(id);if(p) party.push(beatUpPokemon(p));}}return party;}
  function makeHitPlan(move,attacker,o){var plan=[];if(move.powerKind==='TripleAxel'){for(var i=1;i<=3;i++)plan.push({hitIndex:i,basePower:20*i,note:'トリプルアクセル '+i+'回目'});}else if(move.powerKind==='TripleKick'){for(var j=1;j<=3;j++)plan.push({hitIndex:j,basePower:10*j,note:'トリプルキック '+j+'回目'});}else if(move.powerKind==='WaterShuriken'){var count=window.DAMEKE_DATA_HELPERS.pokemonMatches(attacker,['ゲッコウガ(サトシ)','greninja_ash'])?3:5;var power=window.DAMEKE_DATA_HELPERS.pokemonMatches(attacker,['ゲッコウガ(サトシ)','greninja_ash'])?20:15;for(var k=1;k<=count;k++)plan.push({hitIndex:k,basePower:power,note:'みずしゅりけん'});}else if(move.powerKind==='BeatUp'){var party=partyForBeatUp(attacker,o);for(var h=0;h<party.length;h++){var mon=party[h];plan.push({hitIndex:h+1,basePower:fl((mon.baseStats.A||0)/10)+5,note:mon.name+' A種族値参照'});}}return plan;}
  function setOrPushTrace(trace,label,name,value,note){var line=(trace||[]).find(function(x){return String(x.label).includes(label);});if(line){line.name=name;line.value=value;line.note=note||line.note;}else trace.push({label:label,name:name,value:value,note:note||'',implemented:true});}
  var originalMultiHitPatch = C.calculateDamage.bind(C);
  C.calculateDamage=function(input){var result=originalMultiHitPatch(input);var move=input.move;if(!move || !['TripleAxel','TripleKick','WaterShuriken','BeatUp'].includes(move.powerKind)) return result;var o=input.options||{};if(o.attackerSpecialState&&o.attackerSpecialState!=='none') return result;
    var hitPlan=makeHitPlan(move,input.attacker,o);if(!hitPlan.length) return result;
    var level=clamp(num(input.attackerLevel,50),1,100),dlevel=clamp(num(input.defenderLevel,50),1,100);var as=stats(input.attacker,level,o.attackerStats),ds=stats(input.defender,dlevel,o.defenderStats);var cat=result.effectiveCategory||move.category;var an=cat==='物理'?'A':'C',dn=cat==='物理'?'B':'D';var atk=rank(as[an],(as.input.ranks||{})[an]||0),def=rank(ds[dn],(ds.input.ranks||{})[dn]||0);var tr=combo(result.effectiveType||move.type,result.defenderTypes||input.defender.types);var sr=(input.attacker.types||[]).includes(result.effectiveType||move.type)?6144:4096;
    var totalMin=0,totalMax=0,firstRolls=[],details=[],rollLines=[];for(var i=0;i<hitPlan.length;i++){var hp=hitPlan[i],rolls=[];if(tr===0||cat==='変化'||!hp.basePower){rolls=[0];}else{var base=baseDamage(level,hp.basePower,atk,def);for(var f=85;f<=100;f++){var d=mod(mod(fl(base*f/100),sr),tr);if(d<1)d=1;rolls.push(d);}}if(!firstRolls.length)firstRolls=rolls;var mn=Math.min.apply(null,rolls),mx=Math.max.apply(null,rolls);totalMin+=mn;totalMax+=mx;details.push(hp.hitIndex+'回目 威力'+hp.basePower+' ダメージ'+mn+'-'+mx+'（'+hp.note+'）');rollLines.push(hp.hitIndex+'回目 威力'+hp.basePower+': '+rolls.join(', '));}
    result.hitPlan=hitPlan;result.rolls=firstRolls;result.multiHitRolls=rollLines;result.minDamage=totalMin;result.maxDamage=totalMax;var hpMax=result.defenderMaxHp||ds.H;result.minRate=hpMax?totalMin/hpMax*100:0;result.maxRate=hpMax?totalMax/hpMax*100:0;
    setOrPushTrace(result.trace,'連続攻撃','ヒット別',details.join(' / '),'v0.20 連続技処理');
    setOrPushTrace(result.trace,'N46','HitPlan',hitPlan.map(function(h){return h.hitIndex+'回目='+h.basePower+'（'+h.note+'）';}).join(' / '),'連続技反映');
    return result;};
  C.__multiHitPatched=true;
})();


// v0.21 Z / Dynamax / G-Max implementation wrapper
(function(){
  var D = window.DAMEKE_DATA;
  var C = window.DAMEKE_CALC;
  if(!D || !C || !C.calculateDamage || C.__specialMovePatched) return;
  function clone(obj){var o={};for(var k in obj)o[k]=obj[k];return o;}
  function zPower(moveOrPower){
    var move = (moveOrPower && typeof moveOrPower === 'object') ? moveOrPower : null;
    var name = move ? move.name : null;
    var p = move ? move.power : moveOrPower;
    var z = (window.DAMEKE_DATA && window.DAMEKE_DATA.zMax) || (typeof D !== 'undefined' && D.zMax) || (typeof DATA !== 'undefined' && DATA.zMax) || {};
    if(name && z.zPowerOverrides && z.zPowerOverrides[name] != null) return z.zPowerOverrides[name];
    if(p == null) return null;
    p = Number(p);
    var table = z.zPowerBaseTable || [[59,100],[69,120],[79,140],[89,160],[99,175],[109,180],[119,185],[129,190],[139,195],[Infinity,200]];
    for(var i=0;i<table.length;i++) if(p <= table[i][0]) return table[i][1];
    return 200;
  }
  function maxPower(move, finalType){
    var z = (window.DAMEKE_DATA && window.DAMEKE_DATA.zMax) || (typeof D !== 'undefined' && D.zMax) || {};
    if(move && z.maxPowerOverrides && z.maxPowerOverrides[move.name] != null) return z.maxPowerOverrides[move.name];
    var p = move ? move.power : null;
    if(p == null) return null;
    p = Number(p);
    var tables = z.maxPowerTypeTables || {};
    var low = tables.low || {types:['どく','かくとう'], table:[[40,70],[50,75],[60,80],[70,85],[100,90],[140,95],[Infinity,100]]};
    var normal = tables.normal || {table:[[40,90],[50,100],[60,110],[70,120],[100,135],[140,140],[Infinity,150]]};
    var table = (low.types || []).includes(finalType) ? low.table : normal.table;
    for(var i=0;i<table.length;i++) if(p <= table[i][0]) return table[i][1];
    return table[table.length-1][1];
  }
  function canDynamax(p){return !(D.zMax&&D.zMax.dynamaxBanned||[]).includes(p.name);}
  function specialZRule(p,m){return window.DAMEKE_DATA_HELPERS.specialZRuleFor(p,m);}
  function gmaxName(p,type){return window.DAMEKE_DATA_HELPERS.gmaxNameFor(p,type);}
  function clearMulti(m){delete m.powerKind;delete m.hitCount;delete m.hitCountKind;delete m.hitCountMin;delete m.hitCountMax;return m;}
  function activeItemForType(side,item,o){if(o&&o.__coreState){var st=side==='A'?o.__coreState.attackerItemState:o.__coreState.defenderItemState;var coreItem=side==='A'?o.__coreState.attackerItem:o.__coreState.defenderItem;if(st&&coreItem&&item&&coreItem.id===item.id)return !!st.active;}if(!item||item.id==='none')return false;if(side==='A'&&o.attackerNoItem)return false;if(side==='D'&&o.defenderNoItem)return false;if(o.magicRoom)return false;if(side==='A'&&o.attackerEmbargo)return false;if(side==='D'&&o.defenderEmbargo)return false;return true;}
  function activeAbilityForType(side,ab,o){if(o&&o.__coreState){var st=side==='A'?o.__coreState.attackerAbilityState:o.__coreState.defenderAbilityState;if(st&&st.ability&&ab&&st.ability.id===ab.id)return !!st.active;}if(!ab||ab.id==='なし')return false;if(side==='A'&&o.attackerNoAbility)return false;if(side==='D'&&o.defenderNoAbility)return false;if(ab.name==='マルチタイプ'||ab.name==='ARシステム')return true;if(o.neutralizingGasField)return false;var otherId=side==='A'?o.defenderAbilityId:o.attackerAbilityId;var otherNo=side==='A'?o.defenderNoAbility:o.attackerNoAbility;var other=(D.abilities||[]).find(function(x){return x.id===otherId;});if(other&&!otherNo&&other.name==='かがくへんかガス')return false;return true;}
  function byIdType(list,id){return (list||[]).find(function(x){return x.id===id;})||(list||[])[0]||{};}
  function enhancedType(attacker,move,o,forZ){var item=byIdType(D.items,o.attackerItemId||'none'),ab=byIdType(D.abilities,o.attackerAbilityId||'なし');var itemOk=activeItemForType('A',item,o),abOk=activeAbilityForType('A',ab,o);var type=move.type||'ノーマル';
    if(o.electrify)type='でんき';
    else if((move.name==='テラバースト'||window.DAMEKE_DATA_HELPERS.moveTag(move,'teraCluster'))&&o.attackerTeraType&&o.attackerTeraType!=='なし')type=o.attackerTeraType;
    else if(move.name==='ウェザーボール'){var w=o.attackerEffectiveWeather||o.weather;type=({'にほんばれ':'ほのお','おおひでり':'ほのお','あめ':'みず','おおあめ':'みず','すなあらし':'いわ','ゆき':'こおり'}[w]||'ノーマル');}
    else if(move.name==='さばきのつぶて')type=(itemOk&&item.kind==='Plate')?item.type:'ノーマル';
    else if(move.name==='しぜんのめぐみ')type=(item&&item.isBerry&&item.naturalGiftType)?item.naturalGiftType:'ノーマル';
    else if(move.name==='だいちのはどう')type=({'エレキフィールド':'でんき','グラスフィールド':'くさ','ミストフィールド':'フェアリー','サイコフィールド':'エスパー'}[o.field]||'ノーマル');
    else if(move.name==='マルチアタック')type=(itemOk&&item.kind==='Memory')?item.type:'ノーマル';
    else if(move.name==='めざめるダンス')type=(o.attackerTeraType&&o.attackerTeraType!=='なし'&&o.attackerTeraType!=='ステラ')?o.attackerTeraType:((attacker.types&&attacker.types[0])||'ノーマル');
    else if(move.name==='テクノバスター')type=(itemOk&&item.kind==='Drive')?item.type:'ノーマル';
    else if(move.name==='オーラぐるま')type=attacker.name==='モルペコ(はらぺこもよう)'?'あく':'でんき';
    else if(move.name==='ツタこんぼう')type=({'オーガポン(みどり)':'くさ','オーガポン(いど)':'みず','オーガポン(かまど)':'ほのお','オーガポン(いしずえ)':'いわ'}[attacker.name]||'くさ');
    if(!forZ&&abOk){var skin={'ノーマルスキン':'ノーマル','エレキスキン':'でんき','スカイスキン':'ひこう','ドラゴンスキン':'ドラゴン','フェアリースキン':'フェアリー','フリーズスキン':'こおり'}[ab.name];if(ab.name==='ノーマルスキン')type='ノーマル';else if(type==='ノーマル'&&skin)type=skin;if(ab.kind==='LiquidVoice'&&window.DAMEKE_DATA_HELPERS.moveTag(move,'sound'))type='みず';}
    if(o.plasmaShower&&type==='ノーマル')type='でんき';return type;}
  function transform(attacker,move,state,o){var info={status:'通常',reason:'なし',originalMoveName:move.name,transformedMoveName:move.name,effectReset:'なし',enhancedEffectNote:'通常技'};if(!state||state==='none')return{move:move,info:info,active:false};
    // Enhanced moves (Z/signature-Z/Max) do NOT inherit attributes from the base move --
    // clone(move) below copies every property (contact, ignoresAbilities, sound, damageKind,
    // etc.) from the original as a byproduct of being a generic shallow copy, which is wrong:
    // it was leaking mold-breaker-style flags from moves like メテオドライブ/フォトンゲイザー
    // into completely generic Z-moves/Max-moves built from them. Reset those fields to a clean
    // slate here, then look up the enhanced move's OWN data (keyed by its own generated name)
    // to reapply only what's actually documented for that specific enhanced move.
    function resetInheritedAttributes(m){
      m.ignoresAbilities=false; m.sound=false; m.damageKind=null;
      var known=window.DAMEKE_DATA_HELPERS && window.DAMEKE_DATA_HELPERS.byMoveName && window.DAMEKE_DATA_HELPERS.byMoveName(m.name);
      if(known){
        if(known.contact) m.contact=true;
        if(known.ignoresAbilities) m.ignoresAbilities=true;
        if(known.sound) m.sound=true;
        if(known.damageKind) m.damageKind=known.damageKind;
      }
      return m;
    }
    if(state==='zmove'){var zType=enhancedType(attacker,move,o,true);var name=(D.zMax&&D.zMax.zByType||{})[zType];if(!name||move.category==='変化'){info.status='無効';info.reason=move.category==='変化'?'変化技のタイプ別Zは現段階では未実装':'Z技名未定義';return{move:move,info:info,active:false};}var z=clearMulti(clone(move));z.name=name;z.type=zType;z.power=zPower(move);z.isZMove=true;z.contact=false;z.protectRate4096=1024;resetInheritedAttributes(z);info.status='有効';info.reason='タイプ別Zワザ';info.transformedMoveName=z.name;info.effectReset='通常技固有効果をリセット';info.enhancedEffectNote='特殊効果なし';return{move:z,info:info,active:true};}
    if(state==='special_z'){var rule=specialZRule(attacker,move);if(!rule){info.status='無効';info.reason='ポケモン+技の専用Z条件なし';return{move:move,info:info,active:false};}var sz=clearMulti(clone(move));sz.name=rule.name;sz.type=rule.type;sz.category=rule.category;sz.power=rule.power;sz.isZMove=true;sz.contact=false;sz.protectRate4096=1024;resetInheritedAttributes(sz);if(rule.ignoresAbilities)sz.ignoresAbilities=true;if(rule.categoryFromAC)sz.category='特殊';if(rule.damageKind)sz.damageKind=rule.damageKind;info.status='有効';info.reason='専用Z条件成立';info.transformedMoveName=sz.name;info.effectReset='通常技固有効果をリセット';info.enhancedEffectNote=rule.ignoresAbilities?'例外: 強化技側のかたやぶり効果あり':'特殊効果なし';return{move:sz,info:info,active:true};}
    if(state==='dynamax'||state==='gmax'){if(!canDynamax(attacker)){info.status='無効';info.reason=attacker.name+'はダイマックス不可';return{move:move,info:info,active:false};}var mx=clearMulti(clone(move));mx.isMaxMove=true;mx.contact=false;mx.protectRate4096=1024;if(move.category==='変化'){mx.name='ダイウォール';mx.type='ノーマル';mx.category='変化';mx.power=null;}else{var dType=enhancedType(attacker,move,o,false);var g=state==='gmax'?gmaxName(attacker,dType):null;mx.type=dType;mx.name=g||((D.zMax&&D.zMax.maxByType||{})[dType]||move.name);mx.power=maxPower(move,dType);}resetInheritedAttributes(mx);info.status='有効';info.reason=state==='gmax'?'キョダイマックス技':'タイプ別ダイマックス技';info.transformedMoveName=mx.name;info.effectReset='通常技固有効果をリセット';info.enhancedEffectNote=(mx.name==='キョダイコランダ')?'例外: 強化技側のかたやぶり効果あり':'特殊効果なし';if(mx.name==='キョダイコランダ')mx.ignoresAbilities=true;return{move:mx,info:info,active:true};}
    return{move:move,info:info,active:false};}
  function replaceTrace(result,labelPart,name,value,note){var line=(result.trace||[]).find(function(x){return String(x.label).includes(labelPart);});if(line){if(name!=null)line.name=name;if(value!=null)line.value=value;if(note!=null)line.note=note;}else result.trace.push({label:labelPart,name:name||'',value:value||'',note:note||'',implemented:true});}
  var originalSpecialMovePatch=C.calculateDamage.bind(C);
  C.calculateDamage=function(input){var o=clone(input.options||{});var state=o.attackerSpecialState||'none';var t=transform(input.attacker,input.move,state,o);if(t.active){o.attackerSpecialState='none';}
    var newInput={attacker:input.attacker,defender:input.defender,move:t.move,attackerLevel:input.attackerLevel,defenderLevel:input.defenderLevel,options:o};var result=originalSpecialMovePatch(newInput);
    if(state&&state!=='none'){replaceTrace(result,'Z・ダイマックス（攻撃側）',state==='zmove'?'Zワザ':state==='special_z'?'専用Z':state==='dynamax'?'ダイマックス':'キョダイマックス',t.info.status,t.info.reason);replaceTrace(result,'技名変換',t.info.originalMoveName,t.info.transformedMoveName,'');replaceTrace(result,'強化技効果','通常技固有効果',t.info.effectReset,t.info.enhancedEffectNote);result.moveName=t.info.transformedMoveName||result.moveName;result.effectiveType=t.move.type||result.effectiveType;result.effectiveMove=t.move;result.originalMoveName=t.info.originalMoveName;}
    return result;};
  C.__specialMovePatched=true;
})();


// v0.22 power modifiers and final power calculation
(function(){
  var D = window.DAMEKE_DATA;
  var C = window.DAMEKE_CALC;
  if(!D || !C || !C.calculateDamage || C.__powerModifierPatched) return;
  var num = window.DAMEKE_CALC_SHARED.num;
  function fl(x){return window.DAMEKE_ROUNDING.floor(x);} function roundHalfUp(x){return window.DAMEKE_ROUNDING.roundHalfUp(x);} function roundFiveDown(x){return window.DAMEKE_ROUNDING.roundFiveDown(x);} function clamp(v,a,b){return Math.min(Math.max(v,a),b);}
  function by(list,id){return (list||[]).find(function(x){return x.id===id;}) || (list||[])[0] || {};}
  var activeItem = window.DAMEKE_CALC_SHARED.activeItemWithFallback;
  var activeAbility = window.DAMEKE_CALC_SHARED.activeAbilityWithFallback;
  function spToEv(sp){sp=clamp(num(sp,0),0,32);if(sp<=0)return 0;if(sp===32)return 252;return 4+(sp-1)*8;} function stats(p,level,input){var src=input||{},iv=src.ivs||{},ev=src.evs||{},ranks=src.ranks||{},b=p.baseStats,o={input:{ivs:iv,evs:ev,ranks:ranks}};['H','A','B','C','D','S'].forEach(function(k){var evv=spToEv(ev[k]);o[k]=k==='H'?fl(((2*b[k]+num(iv[k],31)+fl(evv/4))*level)/100)+level+10:fl(((2*b[k]+num(iv[k],31)+fl(evv/4))*level)/100)+5;if(k==='H'&&window.DAMEKE_DATA_HELPERS.pokemonMatches(p,'ヌケニン'))o[k]=1;if(k!=='H')o[k]=window.DAMEKE_NATURE.apply(o[k],k,src);});return o;} var rank = window.DAMEKE_CALC_SHARED.rank;
  function typeRate(t,dt){if(!dt||dt==='タイプなし')return 4096;return ((D.typeChart4096&&D.typeChart4096[t])||{})[dt]??4096;} function combo(t,types){var r=4096;(types||[]).forEach(function(dt){r=fl(r*typeRate(t,dt)/4096);});return r;} function mod(v,r){return fl(v*r/4096);} function baseDamage(level,power,atk,def){if(!power||power<=0||def<=0)return 0;return fl(fl((fl(2*level/5)+2)*power*atk/def)/50)+2;}
  function setHas(arr,name){return arr.indexOf(name)>=0;}
  var isGrounded = window.DAMEKE_CALC_SHARED.isGrounded;
  var contactActive = window.DAMEKE_CALC_SHARED.contactActive;
  function getBasePowerFromResult(result,input){if(result.hitPlan&&result.hitPlan[0])return result.hitPlan[0].basePower;var n46=(result.trace||[]).find(function(x){return String(x.label).includes('N46')||String(x.label).includes('変動後威力');});if(n46){var m=String(n46.value).match(/(?:1回目=)?(\d+)/);if(m)return num(m[1],input.move.power||1);}return input.move.power||1;}
  function applyRate(state,label,rate,list){var before=state.rate;state.rate=roundHalfUp(state.rate*rate/4096);list.push(label+': '+before+'->'+state.rate+' ('+rate+'/4096)');}
  function hasAura(name,o){var a=by(D.abilities,o.attackerAbilityId),d=by(D.abilities,o.defenderAbilityId);return (activeAbility('A',a,o)&&a.name===name)||(activeAbility('D',d,o)&&d.name===name)||(name==='フェアリーオーラ'&&o.fairyAuraField)||(name==='ダークオーラ'&&o.darkAuraField);}
  function hasAuraBreak(o){var a=by(D.abilities,o.attackerAbilityId),d=by(D.abilities,o.defenderAbilityId);return (activeAbility('A',a,o)&&a.name==='オーラブレイク')||(activeAbility('D',d,o)&&d.name==='オーラブレイク');}
  function calcModifier(result,input,basePower){var o=input.options||{},name=result.moveName||input.move.name,type=result.effectiveType||input.move.type,cat=result.effectiveCategory||input.move.category;var aAb=by(D.abilities,o.attackerAbilityId),dAb=by(D.abilities,o.defenderAbilityId),aItem=by(D.items,o.attackerItemId),dItem=by(D.items,o.defenderItemId);var aAbOk=activeAbility('A',aAb,o),dAbOk=activeAbility('D',dAb,o),aItemOk=activeItem('A',aItem,o),dItemOk=activeItem('D',dItem,o);var state={rate:4096},logs=[];function A(n){return aAbOk&&aAb.name===n;}function Df(n){return dAbOk&&dAb.name===n;}function M(n){return name===n;}function typeItemMatches(){return aItemOk&&((aItem.kind==='Plate'||aItem.kind==='TypeBoost'||aItem.kind==='Gem')&&aItem.type===type);}var auraRate=hasAuraBreak(o)?3072:5448;
    if(A('とうそうしん')){var ag=o.attackerGender,dg=o.defenderGender;if((ag==='male'||ag==='female')&&(dg==='male'||dg==='female'))applyRate(state,'とうそうしん',ag===dg?5120:3072,logs);} 
    if(A('そうだいしょう')){var fallen=Math.max(0,num(o.supremeOverlordFaintedAllies,0));var rate=Math.min(6144,4096+roundHalfUp(4096*0.1*Math.min(fallen,5)));applyRate(state,'そうだいしょう',rate,logs);}
    if(A('きれあじ')&&window.DAMEKE_DATA_HELPERS.moveTagForEffective(input.move,name,'cut'))applyRate(state,'きれあじ',6144,logs);
    if(A('ノーマルスキン')||A('エレキスキン')||A('スカイスキン')||A('ドラゴンスキン')||A('フェアリースキン')||A('フリーズスキン')){if(!name.startsWith('ダイ')&&!name.startsWith('キョダイ')&&input.move.type==='ノーマル'&&type!==input.move.type)applyRate(state,'スキン系',4915,logs);} 
    if(A('すてみ')&&window.DAMEKE_DATA_HELPERS.moveTagForEffective(input.move,name,'recoil'))applyRate(state,'すてみ',4915,logs);
    if(A('てつのこぶし')&&window.DAMEKE_DATA_HELPERS.moveTagForEffective(input.move,name,'punch'))applyRate(state,'てつのこぶし',4915,logs);
    if(o.batterySupport&&cat==='特殊')applyRate(state,'バッテリー',5325,logs);
    if(o.powerSpotSupport&&(cat==='物理'||cat==='特殊'))applyRate(state,'パワースポット',5325,logs);
    if(A('アナライズ')&&o.analyzeMovedLast)applyRate(state,'アナライズ',5325,logs);
    if(A('かたいツメ')&&contactActive(result))applyRate(state,'かたいツメ',5325,logs);
    if(A('すなのちから')&&((o.attackerEffectiveWeather||o.weather)==='すなあらし')&&['じめん','いわ','はがね'].includes(type))applyRate(state,'すなのちから',5325,logs);
    if(A('ちからずく')&&window.DAMEKE_DATA_HELPERS.moveTagForEffective(input.move,name,'sheerForce'))applyRate(state,'ちからずく',5325,logs);
    if(A('パンクロック')&&window.DAMEKE_DATA_HELPERS.moveTagForEffective(input.move,name,'sound'))applyRate(state,'パンクロック',5325,logs);
    if(hasAura('ダークオーラ',o)&&type==='あく')applyRate(state,'ダークオーラ',auraRate,logs);
    if(hasAura('フェアリーオーラ',o)&&type==='フェアリー')applyRate(state,'フェアリーオーラ',auraRate,logs);
    if(A('がんじょうあご')&&window.DAMEKE_DATA_HELPERS.moveTagForEffective(input.move,name,'bite'))applyRate(state,'がんじょうあご',6144,logs);
    if(A('テクニシャン')&&basePower<=60)applyRate(state,'テクニシャン',6144,logs);
    if(A('どくぼうそう')&&cat==='物理'&&o.attackerStatus==='どく')applyRate(state,'どくぼうそう',6144,logs);
    if(A('ねつぼうそう')&&cat==='特殊'&&o.attackerStatus==='やけど')applyRate(state,'ねつぼうそう',6144,logs);
    var steelCount=(num(o.steelSpiritCount,0)||0);if(type==='はがね'){for(var ss=0;ss<steelCount;ss++)applyRate(state,'はがねのせいしん',6144,logs);}
    if(A('メガランチャー')&&window.DAMEKE_DATA_HELPERS.moveTagForEffective(input.move,name,'pulse'))applyRate(state,'メガランチャー',6144,logs);
    /* v0.25: たいねつは攻撃力補正側で処理 */
    if(Df('かんそうはだ')&&type==='ほのお')applyRate(state,'かんそうはだ',5120,logs);
    if(aItemOk&&aItem.kind==='PhysicalBoost'&&cat==='物理')applyRate(state,'ちからのハチマキ',4505,logs);
    if(aItemOk&&aItem.kind==='SpecialBoost'&&cat==='特殊')applyRate(state,'ものしりメガネ',4505,logs);
    if(aItemOk&&(window.DAMEKE_DATA_HELPERS.itemTag(aItem,'punchingGlove')||aItem.name==='パンチグローブ')&&window.DAMEKE_DATA_HELPERS.moveTagForEffective(input.move,name,'punch'))applyRate(state,'パンチグローブ',4506,logs);
    if(typeItemMatches()&&aItem.kind!=='Gem')applyRate(state,'タイプ強化持ち物',4915,logs);
    if(aItemOk&&aItem.kind==='SoulDew'&&['ラティオス','ラティアス'].includes(input.attacker.name)&&['ドラゴン','エスパー'].includes(type))applyRate(state,'こころのしずく',4915,logs);
    if(aItemOk&&aItem.kind==='AdamantOrb'&&input.attacker.name==='ディアルガ'&&['ドラゴン','はがね'].includes(type))applyRate(state,'こんごうだま',4915,logs);
    if(aItemOk&&aItem.kind==='LustrousOrb'&&input.attacker.name==='パルキア'&&['ドラゴン','みず'].includes(type))applyRate(state,'しらたま',4915,logs);
    if(aItemOk&&aItem.kind==='GriseousOrb'&&input.attacker.name==='ギラティナ(アナザーフォルム)'&&['ドラゴン','ゴースト'].includes(type))applyRate(state,'はっきんだま',4915,logs);
    if(aItemOk&&aItem.kind==='Gem'&&aItem.type===type&&cat!=='変化'&&window.DAMEKE_GEM_ELIGIBLE(input.move,name)){applyRate(state,'ジュエル',5325,logs);
      // ジュエルは発動と同時に消費される(技のタイプが一致していれば必ず発動・消費が確定する)
      // ので、技①→技②の連結時に技②側で「持ち物なし」として扱えるようフラグを公開しておく。
      result.gemConsumed = true; result.gemConsumedName = aItem.name;
    }
    if(input.attacker&&/^オーガポン/.test(input.attacker.name||'')&&input.attacker.name!=='オーガポン(みどり)')applyRate(state,'オーガポンのめん',4915,logs);
    if((M('ソーラービーム')||M('ソーラーブレード'))&&['あめ','おおあめ','すなあらし','ゆき'].includes(o.attackerEffectiveWeather||o.weather))applyRate(state,'ソーラー系悪天候',2048,logs);
    if(M('Gのちから')&&o.gravity)applyRate(state,'Gのちから',6144,logs);
    if(M('はたきおとす')&&o.defenderItemId&&o.defenderItemId!=='none'&&!(D.findFormByLinkedItem&&D.findFormByLinkedItem(input.defender,dItem.name))&&!/Z$/.test(dItem.name||''))applyRate(state,'はたきおとす',6144,logs);
    if(M('きまぐレーザー')&&(o.__forceKimagureLaserOverride==='on'||(o.__forceKimagureLaserOverride!=='off'&&o.kimagureLaserDouble)))applyRate(state,'きまぐレーザー威力2倍',8192,logs);
    if(M('ミストバースト')&&o.field==='ミストフィールド'&&isGrounded(result,'A'))applyRate(state,'ミストバースト',6144,logs);
    if(M('ワイドフォース')&&o.field==='サイコフィールド'&&isGrounded(result,'A'))applyRate(state,'ワイドフォース',6144,logs);
    if(M('ライジングボルト')&&o.field==='エレキフィールド'&&isGrounded(result,'A')&&isGrounded(result,'D')&&(o.defenderSemiInvulnerable||'なし')==='なし')applyRate(state,'ライジングボルト',8192,logs);
    if(M('サイコブレイド')&&o.field==='エレキフィールド')applyRate(state,'サイコブレイド',6144,logs);
    if(M('からげんき')&&o.attackerStatus&&o.attackerStatus!=='なし')applyRate(state,'からげんき',8192,logs);
    var hh=num(o.helpingHandCount,0);for(var h=0;h<hh;h++)applyRate(state,'てだすけ',6144,logs);
    if(o.meFirst)applyRate(state,'さきどり',6144,logs);
    if(o.charge&&type==='でんき')applyRate(state,'じゅうでん',8192,logs);
    if(M('うっぷんばらし')&&o.statDroppedThisTurn)applyRate(state,'うっぷんばらし',8192,logs);
    if(M('かたきうち')&&o.allyFaintedLastTurn)applyRate(state,'かたきうち',8192,logs);
    if((M('クロスフレイム')||M('クロスサンダー'))&&o.pledgeCombination)applyRate(state,'クロス系コンビネーション',8192,logs);
    if(M('しおみず')){var hpLine=(result.trace||[]).find(x=>String(x.label).includes('防御側ランク補正込み実数値'));var m=hpLine&&String(hpLine.value).match(/(\d+)\/(\d+)/);if(m&&num(m[1],0)*2<=num(m[2],1))applyRate(state,'しおみず',8192,logs);}
    if(M('ベノムショック')&&o.defenderStatus==='どく')applyRate(state,'ベノムショック',8192,logs);
    if(isGrounded(result,'D')&&o.field==='グラスフィールド'&&['じしん','じならし','マグニチュード'].includes(name)&&(o.defenderSemiInvulnerable||'なし')==='なし')applyRate(state,'グラスフィールド弱化',2048,logs);
    if(isGrounded(result,'D')&&o.field==='ミストフィールド'&&type==='ドラゴン'&&(o.defenderSemiInvulnerable||'なし')==='なし')applyRate(state,'ミストフィールド弱化',2048,logs);
    if(isGrounded(result,'A')&&o.field==='エレキフィールド'&&type==='でんき')applyRate(state,'エレキフィールド強化',5325,logs);
    if(isGrounded(result,'A')&&o.field==='グラスフィールド'&&type==='くさ')applyRate(state,'グラスフィールド強化',5325,logs);
    if(isGrounded(result,'A')&&o.field==='サイコフィールド'&&type==='エスパー')applyRate(state,'サイコフィールド強化',5325,logs);
    if(o.mudSport&&type==='でんき')applyRate(state,'どろあそび',1352,logs);
    if(o.waterSport&&type==='ほのお')applyRate(state,'みずあそび',1352,logs);
    return{rate:state.rate,logs:logs};}
  function teraFinalPower(basePower,preFinal,input,result){var o=input.options||{},tera=o.attackerTeraType;if(!tera||tera==='なし'||tera!==result.effectiveType)return preFinal;var nm=result.moveName||input.move.name;if(window.DAMEKE_DATA_HELPERS.moveTagByName(nm,'teraMinPowerExcluded')||(nm===input.move.name&&input.move.priority>=1))return preFinal;if(preFinal<60)return 60;return preFinal;}
  function recalc(result,input,finalPowers){var o=input.options||{},level=clamp(num(input.attackerLevel,50),1,100),dlevel=clamp(num(input.defenderLevel,50),1,100);var as=stats(input.attacker,level,o.attackerStats),ds=stats(input.defender,dlevel,o.defenderStats);var cat=result.effectiveCategory||input.move.category,an=cat==='物理'?'A':'C',dn=cat==='物理'?'B':'D';var atk=rank(as[an],(as.input.ranks||{})[an]||0),def=rank(ds[dn],(ds.input.ranks||{})[dn]||0);var tr=result.typeRate4096||combo(result.effectiveType||input.move.type,result.defenderTypes||input.defender.types);var sr=result.stabRate4096||((input.attacker.types||[]).includes(result.effectiveType||input.move.type)?6144:4096);var rollsFirst=[],totalMin=0,totalMax=0,lines=[];for(var i=0;i<finalPowers.length;i++){var pw=finalPowers[i],rolls=[];if(tr===0||cat==='変化')rolls=[0];else{var b=baseDamage(level,pw,atk,def);for(var f=85;f<=100;f++){var d=mod(mod(fl(b*f/100),sr),tr);if(d<1)d=1;rolls.push(d);}}if(!rollsFirst.length)rollsFirst=rolls;var mn=Math.min.apply(null,rolls),mx=Math.max.apply(null,rolls);totalMin+=mn;totalMax+=mx;lines.push((i+1)+'回目 威力'+pw+': '+rolls.join(', '));}result.rolls=rollsFirst;result.multiHitRolls=finalPowers.length>1?lines:null;result.minDamage=totalMin;result.maxDamage=totalMax;var hp=result.defenderMaxHp||ds.H;result.minRate=hp?totalMin/hp*100:0;result.maxRate=hp?totalMax/hp*100:0;}
  function setTrace(result,label,name,value,note){var line=(result.trace||[]).find(x=>String(x.label).includes(label));if(line){line.name=name;line.value=value;if(note!=null)line.note=note;}else result.trace.push({label:label,name:name,value:value,note:note||'',implemented:true});}
  var previousPowerModifierCalc=C.calculateDamage.bind(C);
  C.calculateDamage=function(input){var result=previousPowerModifierCalc(input);if(result&&result.__coreState)(input.options||(input.options={})).__coreState=result.__coreState;if((result.effectiveCategory||input.move.category)==='変化'){setTrace(result,'変動後威力','最終威力','-','変化技のため威力なし');return result;}var base=getBasePowerFromResult(result,input);var modInfo=calcModifier(result,input,base);var hitPlan=result.hitPlan&&result.hitPlan.length?result.hitPlan:[{hitIndex:1,basePower:base,note:'基礎威力'}];var finals=[];var notes=[];for(var i=0;i<hitPlan.length;i++){var bp=hitPlan[i].basePower;if(input.move.name==='Gのちから'&&(input.options||{}).gravity)bp=90;var pre=Math.max(1,roundFiveDown(bp*modInfo.rate/4096));var fin=teraFinalPower(bp,pre,input,result);finals.push(fin);notes.push(hitPlan[i].hitIndex+'回目='+fin+'（基礎'+bp+' 補正'+modInfo.rate+'/4096'+(fin!==pre?' テラス最低威力':'')+'）');}setTrace(result,'変動後威力','最終威力',notes.join(' / '),'威力補正: '+(modInfo.logs.join(' / ')||'なし'));recalc(result,input,finals);return result;};
  C.__powerModifierPatched=true;
})();


// v0.23 common weather state resolver
// The actual attacker/defender-effective weather is now resolved once, inside the
// core calculation itself (where ability/item state is already known -- see
// resolveEffectiveWeather), and exposed as result.weatherResolution. This layer's
// only remaining job is to (a) relay that value into input.options so the later
// layers in the chain that read o.attackerEffectiveWeather/o.defenderEffectiveWeather
// see it too, matching how __coreState is relayed, and (b) render the trace line.
// Previously this layer independently re-derived ability/item activity *before*
// the core had run, and wrote the result only onto a local copy of options --
// meaning later layers (attack/defense modifiers, weather-based damage rate) never
// actually saw the corrected effective weather and silently fell back to the raw
// input weather. Moving resolution into the core fixes that.
(function(){
  var D = window.DAMEKE_DATA;
  var C = window.DAMEKE_CALC;
  if(!D || !C || !C.calculateDamage || C.__weatherStatePatched) return;
  function setWeatherTrace(result,ws){
    var line=(result.trace||[]).find(function(x){return String(x.label).includes('天候');});
    if(line){
      line.note='攻撃側天候='+ws.attacker+' / 防御側天候='+ws.defender+' / '+ws.note;
    } else {
      result.trace.push({label:'00 天候',name:'現在値',value:ws.attacker,note:'攻撃側天候='+ws.attacker+' / 防御側天候='+ws.defender+' / '+ws.note,implemented:true});
    }
  }
  var previousWeatherStateCalc=C.calculateDamage.bind(C);
  C.calculateDamage=function(input){
    var result=previousWeatherStateCalc(input);
    if(result&&result.__coreState)(input.options||(input.options={})).__coreState=result.__coreState;
    var ws=result.weatherResolution || {raw:(input.options&&input.options.weather)||'なし', attacker:result.attackerEffectiveWeather||'なし', defender:result.defenderEffectiveWeather||'なし', note:'入力どおり'};
    if(input.options){
      input.options.attackerEffectiveWeather = result.attackerEffectiveWeather;
      input.options.defenderEffectiveWeather = result.defenderEffectiveWeather;
    }
    setWeatherTrace(result,ws);
    return result;
  };
  C.__weatherStatePatched=true;
})();


// v0.25 attack modifier and modified attacking stat calculation
(function(){
  var D = window.DAMEKE_DATA;
  var C = window.DAMEKE_CALC;
  if(!D || !C || !C.calculateDamage || C.__attackModifierPatched) return;
  var num = window.DAMEKE_CALC_SHARED.num;
  function fl(x){return window.DAMEKE_ROUNDING.floor(x);} function roundHalfUp(x){return window.DAMEKE_ROUNDING.roundHalfUp(x);} function roundFiveDown(x){return window.DAMEKE_ROUNDING.roundFiveDown(x);} function clamp(v,a,b){return Math.min(Math.max(v,a),b);}
  function typeRate(t,dt){if(!dt||dt==='タイプなし')return 4096;return ((D.typeChart4096&&D.typeChart4096[t])||{})[dt]??4096;}
  function combo(t,types){var r=4096;(types||[]).forEach(function(dt){r=fl(r*typeRate(t,dt)/4096);});return r;}
  function mod(v,r){return fl(v*r/4096);} function baseDamage(level,power,atk,def){if(!power||power<=0||def<=0)return 0;return fl(fl((fl(2*level/5)+2)*power*atk/def)/50)+2;}
  function by(list,id){return (list||[]).find(function(x){return x.id===id;}) || (list||[])[0] || {};}
  var activeAbilityFromCore = window.DAMEKE_CALC_SHARED.activeAbilityCoreOnly;
  var activeItemFromCore = window.DAMEKE_CALC_SHARED.activeItemCoreOnly;
  function parseRankedValues(result,side){var label=side==='A'?'攻撃側ランク補正込み実数値':'防御側ランク補正込み実数値';var line=(result.trace||[]).find(function(x){return String(x.label).includes(label);});if(!line)return null;var parts=String(line.value).split('/').map(function(x){return num(x,NaN);});if(parts.length<7)return null;return {Hcur:parts[0],Hmax:parts[1],A:parts[2],B:parts[3],C:parts[4],D:parts[5],S:parts[6]};}
  var parseAfterArrow = window.DAMEKE_CALC_SHARED.parseAfterArrow;
  function getFinalPowers(result,input){var line=(result.trace||[]).find(function(x){return String(x.label).includes('変動後威力');});var txt=line?String(line.value):'';var re=/(\d+)回目=(\d+)/g,m,out=[];while((m=re.exec(txt)))out.push(num(m[2],0));if(out.length)return out;if(result.hitPlan&&result.hitPlan.length)return result.hitPlan.map(function(h){return h.basePower||input.move.power||1;});return [input.move.power||1];}
  function applyRate(state,label,rate,logs){var before=state.rate;state.rate=roundHalfUp(state.rate*rate/4096);logs.push(label+': '+before+'->'+state.rate+' ('+rate+'/4096)');}
  function currentHpInfo(result,side){var v=parseRankedValues(result,side);return v||{Hcur:1,Hmax:1};}
  var isAbility = window.DAMEKE_CALC_SHARED.isAbility;
  function calcAtkModifier(result,input,source,cat,type){var o=input.options||{};var aAb=by(D.abilities,o.attackerAbilityId||'なし'),dAb=by(D.abilities,o.defenderAbilityId||'なし'),aItem=by(D.items,o.attackerItemId||'none');var aOk=activeAbilityFromCore('A',aAb,o,result),dOk=activeAbilityFromCore('D',dAb,o,result),itemOk=activeItemFromCore('A',aItem,o,result);var hp=currentHpInfo(result,'A');var state={rate:4096},logs=[];function A(n){return isAbility(n,aAb,aOk);}function Df(n){return isAbility(n,dAb,dOk);}function M(n){return (result.moveName||input.move.name)===n;}
    if(A('スロースタート')&&o.attackerSlowStart)applyRate(state,'スロースタート',2048,logs);
    if(A('よわき')&&hp.Hcur*2<=hp.Hmax)applyRate(state,'よわき',2048,logs);
    if(!A('わざわいのうつわ')&&(Df('わざわいのうつわ')||o.vesselOfRuinField)&&cat==='特殊')applyRate(state,'わざわいのうつわ',3072,logs);
    if(!A('わざわいのおふだ')&&(Df('わざわいのおふだ')||o.tabletsOfRuinField)&&cat==='物理')applyRate(state,'わざわいのおふだ',3072,logs);
    if((A('こだいかっせい')||A('クォークチャージ'))&&((o.attackerParadoxBoostStat==='A'&&cat==='物理')||(o.attackerParadoxBoostStat==='C'&&cat==='特殊')))applyRate(state,aAb.name,5325,logs);
    if(A('トランジスタ')&&type==='でんき')applyRate(state,'トランジスタ',5325,logs);
    if(A('ほのおのたてがみ')&&type==='ほのお')applyRate(state,'ほのおのたてがみ',6144,logs);
    if(A('ハドロンエンジン')&&o.field==='エレキフィールド')applyRate(state,'ハドロンエンジン',5461,logs);
    if(A('ひひいろのこどう')&&['にほんばれ','おおひでり'].includes(o.attackerEffectiveWeather||o.weather))applyRate(state,'ひひいろのこどう',5461,logs);
    if((A('フラワーギフト')||o.flowerGiftSupport)&&['にほんばれ','おおひでり'].includes(o.attackerEffectiveWeather||o.weather))applyRate(state,'フラワーギフト',6144,logs);
    if(A('こんじょう')&&o.attackerStatus&&o.attackerStatus!=='なし')applyRate(state,'こんじょう',6144,logs);
    if(A('しんりょく')&&hp.Hcur*3<=hp.Hmax&&type==='くさ')applyRate(state,'しんりょく',6144,logs);
    if(A('もうか')&&hp.Hcur*3<=hp.Hmax&&type==='ほのお')applyRate(state,'もうか',6144,logs);
    if(A('げきりゅう')&&hp.Hcur*3<=hp.Hmax&&type==='みず')applyRate(state,'げきりゅう',6144,logs);
    if(A('むしのしらせ')&&hp.Hcur*3<=hp.Hmax&&type==='むし')applyRate(state,'むしのしらせ',6144,logs);
    if(A('もらいび')&&o.flashFireActivated&&type==='ほのお')applyRate(state,'もらいび',6144,logs);
    if(A('サンパワー')&&['にほんばれ','おおひでり'].includes(o.attackerEffectiveWeather||o.weather))applyRate(state,'サンパワー',6144,logs);
    if((A('プラス')||A('マイナス'))&&o.plusMinusSupport&&cat==='特殊')applyRate(state,aAb.name,6144,logs);
    if(A('いわはこび')&&type==='いわ')applyRate(state,'いわはこび',6144,logs);
    if(A('はがねつかい')&&type==='はがね')applyRate(state,'はがねつかい',6144,logs);
    if(A('ごりむちゅう')&&cat==='物理')applyRate(state,'ごりむちゅう',6144,logs);
    if(A('りゅうのあぎと')&&type==='ドラゴン')applyRate(state,'りゅうのあぎと',6144,logs);
    if((A('ちからもち')||A('ヨガパワー'))&&cat==='物理')applyRate(state,aAb.name,8192,logs);
    if(A('すいほう')&&type==='みず')applyRate(state,'攻撃側すいほう',8192,logs);
    if(Df('すいほう')&&type==='ほのお')applyRate(state,'防御側すいほう',2048,logs);
    if(A('はりこみ')&&o.stakeoutSwitchIn)applyRate(state,'はりこみ',8192,logs);
    if(Df('あついしぼう')&&['ほのお','こおり'].includes(type))applyRate(state,'あついしぼう',2048,logs);
    /* v0.25: たいねつは攻撃力補正側で処理 */
    if(Df('きよめのしお')&&type==='ゴースト')applyRate(state,'きよめのしお',2048,logs);
    if(itemOk&&window.DAMEKE_DATA_HELPERS.itemTag(aItem,'choiceBand')&&cat==='物理')applyRate(state,'こだわりハチマキ',6144,logs);
    if(itemOk&&window.DAMEKE_DATA_HELPERS.itemTag(aItem,'choiceSpecs')&&cat==='特殊')applyRate(state,'こだわりメガネ',6144,logs);
    if(itemOk&&window.DAMEKE_DATA_HELPERS.itemTag(aItem,'thickClub')&&window.DAMEKE_DATA_HELPERS.itemTargetsPokemon(aItem,input.attacker))applyRate(state,'ふといホネ',8192,logs);
    if(itemOk&&window.DAMEKE_DATA_HELPERS.itemTag(aItem,'deepSeaTooth')&&window.DAMEKE_DATA_HELPERS.itemTargetsPokemon(aItem,input.attacker))applyRate(state,'しんかいのキバ',8192,logs);
    if(itemOk&&window.DAMEKE_DATA_HELPERS.itemTag(aItem,'lightBall')&&window.DAMEKE_DATA_HELPERS.itemTargetsPokemon(aItem,input.attacker))applyRate(state,'でんきだま',8192,logs);
    var hustleRate=(A('はりきり')&&cat==='物理')?6144:4096;var afterHustle=Math.max(1,fl(source*hustleRate/4096));if(hustleRate!==4096)logs.unshift('はりきり: '+source+'->'+afterHustle+' ('+hustleRate+'/4096・事前切り捨て)');return {rate:state.rate,logs:logs,hustleRate:hustleRate,afterHustle:afterHustle,final:Math.max(1,roundFiveDown(afterHustle*state.rate/4096))};
  }
  function updateTrace(result,source,modInfo,sourceNote){var line=(result.trace||[]).find(function(x){return String(x.label).includes('補正後攻撃側実数値');});var note=sourceNote+' / 攻撃力補正: '+(modInfo.logs.join(' / ')||'なし');if(line){line.name='攻撃側実数値';line.value=source+' -> '+modInfo.final+' / 補正 '+modInfo.rate+'/4096';line.note=note;}else result.trace.push({label:'N54 補正後攻撃側実数値',name:'攻撃側実数値',value:source+' -> '+modInfo.final+' / 補正 '+modInfo.rate+'/4096',note:note,implemented:true});}
  function recalc(result,input,finalAtk,finalPowers){var level=clamp(num(input.attackerLevel,50),1,100);var def=parseAfterArrow(result,'補正後防御側実数値')||1;var cat=result.effectiveCategory||input.move.category;var tr=result.typeRate4096||combo(result.effectiveType||input.move.type,result.defenderTypes||input.defender.types);var sr=result.stabRate4096||((input.attacker.types||[]).includes(result.effectiveType||input.move.type)?6144:4096);var rollsFirst=[],totalMin=0,totalMax=0,lines=[];for(var i=0;i<finalPowers.length;i++){var pw=finalPowers[i],rolls=[];if(tr===0||cat==='変化')rolls=[0];else{var b=baseDamage(level,pw,finalAtk,def);for(var f=85;f<=100;f++){var d=mod(mod(fl(b*f/100),sr),tr);if(d<1)d=1;rolls.push(d);}}if(!rollsFirst.length)rollsFirst=rolls;var mn=Math.min.apply(null,rolls),mx=Math.max.apply(null,rolls);totalMin+=mn;totalMax+=mx;lines.push((i+1)+'回目 威力'+pw+': '+rolls.join(', '));}result.rolls=rollsFirst;result.multiHitRolls=finalPowers.length>1?lines:null;result.minDamage=totalMin;result.maxDamage=totalMax;var hp=result.defenderMaxHp||1;result.minRate=hp?totalMin/hp*100:0;result.maxRate=hp?totalMax/hp*100:0;}
  var previousAttackModifierCalc=C.calculateDamage.bind(C);
  C.calculateDamage=function(input){var result=previousAttackModifierCalc(input);if(result&&result.__coreState)(input.options||(input.options={})).__coreState=result.__coreState;var cat=result.effectiveCategory||input.move.category,type=result.effectiveType||input.move.type;var a=parseRankedValues(result,'A'),d=parseRankedValues(result,'D');if(!a||!d)return result;var effectiveMoveName=result.moveName||input.move.name;var source,sourceNote;if(effectiveMoveName==='イカサマ'){source=d.A;sourceNote='イカサマ: 防御側ランク補正込みA参照';}else if(effectiveMoveName==='ボディプレス'){source=a.B;sourceNote='ボディプレス: 攻撃側ランク補正込みB参照';}else if(cat==='物理'){source=a.A;sourceNote='物理: 攻撃側ランク補正込みA参照';}else if(cat==='特殊'){source=a.C;sourceNote='特殊: 攻撃側ランク補正込みC参照';}else{return result;}var modInfo=calcAtkModifier(result,input,source,cat,type);updateTrace(result,source,modInfo,sourceNote);var powers=getFinalPowers(result,input);recalc(result,input,modInfo.final,powers);return result;};
  C.__attackModifierPatched=true;
})();


// v0.27 defense modifier and modified defending stat calculation
(function(){
  var D = window.DAMEKE_DATA;
  var C = window.DAMEKE_CALC;
  if(!D || !C || !C.calculateDamage || C.__defenseModifierPatched) return;
  var num = window.DAMEKE_CALC_SHARED.num;
  function fl(x){return window.DAMEKE_ROUNDING.floor(x);} function roundHalfUp(x){return window.DAMEKE_ROUNDING.roundHalfUp(x);} function roundFiveDown(x){return window.DAMEKE_ROUNDING.roundFiveDown(x);} function clamp(v,a,b){return Math.min(Math.max(v,a),b);}
  function by(list,id){return (list||[]).find(function(x){return x.id===id;}) || (list||[])[0] || {};}
  function typeRate(t,dt){if(!dt||dt==='タイプなし')return 4096;return ((D.typeChart4096&&D.typeChart4096[t])||{})[dt]??4096;}
  function combo(t,types){var r=4096;(types||[]).forEach(function(dt){r=fl(r*typeRate(t,dt)/4096);});return r;}
  function mod(v,r){return fl(v*r/4096);} function baseDamage(level,power,atk,def){if(!power||power<=0||def<=0)return 0;return fl(fl((fl(2*level/5)+2)*power*atk/def)/50)+2;}
  function parseRankedValues(result,side){var label=side==='A'?'攻撃側ランク補正込み実数値':'防御側ランク補正込み実数値';var line=(result.trace||[]).find(function(x){return String(x.label).includes(label);});if(!line)return null;var parts=String(line.value).split('/').map(function(x){return num(x,NaN);});if(parts.length<7)return null;return {Hcur:parts[0],Hmax:parts[1],A:parts[2],B:parts[3],C:parts[4],D:parts[5],S:parts[6]};}
  var parseAfterArrow = window.DAMEKE_CALC_SHARED.parseAfterArrow;
  function getFinalPowers(result,input){var line=(result.trace||[]).find(function(x){return String(x.label).includes('変動後威力');});var txt=line?String(line.value):'';var re=/(\d+)回目=(\d+)/g,m,out=[];while((m=re.exec(txt)))out.push(num(m[2],0));if(out.length)return out;if(result.hitPlan&&result.hitPlan.length)return result.hitPlan.map(function(h){return h.basePower||input.move.power||1;});return [input.move.power||1];}
  var activeAbilityFromCore = window.DAMEKE_CALC_SHARED.activeAbilityCoreOnly;
  var activeItemFromCore = window.DAMEKE_CALC_SHARED.activeItemCoreOnly;
  var isAbility = window.DAMEKE_CALC_SHARED.isAbility;
  function applyRate(state,label,rate,logs){var before=state.rate;state.rate=roundHalfUp(state.rate*rate/4096);logs.push(label+': '+before+'->'+state.rate+' ('+rate+'/4096)');}
  function defenderWeather(result,o){var line=(result.trace||[]).find(function(x){return String(x.label).includes('天候');});var m=line&&String(line.note||'').match(/防御側天候=([^ /]+)/);return m?m[1]:(o.defenderEffectiveWeather||o.weather||'なし');}
  var attackerCalcTypes = window.DAMEKE_CALC_SHARED.attackerCalcTypes;
  var defenderCalcTypes = window.DAMEKE_CALC_SHARED.defenderCalcTypes;
  function wonderRoomOn(result){var line=(result.trace||[]).find(function(x){return String(x.label).includes('実数値操作');});return !!(line && String(line.note||'').includes('最終ワンダールーム=ON'));}
  function teraType(o){return o.defenderTeraType||'なし';}
  function typeConditionForWeather(result,o,need){var tera=teraType(o);if(tera===need)return true;if(!tera||tera==='なし'||tera==='ステラ')return defenderCalcTypes(result).includes(need);return false;}
  function weatherRate(result,o,flag){var w=defenderWeather(result,o);if(w==='すなあらし'&&flag==='D'&&typeConditionForWeather(result,o,'いわ'))return {rate:6144,reason:'すなあらし+いわ+D'};if(w==='ゆき'&&flag==='B'&&typeConditionForWeather(result,o,'こおり'))return {rate:6144,reason:'ゆき+こおり+B'};return {rate:4096,reason:'なし'};}
  function calcDefModifier(result,input,source,flagAfterWonder){var o=input.options||{};var aAb=by(D.abilities,o.attackerAbilityId||'なし'),dAb=by(D.abilities,o.defenderAbilityId||'なし'),dItem=by(D.items,o.defenderItemId||'none');var aOk=activeAbilityFromCore('A',aAb,o,result),dOk=activeAbilityFromCore('D',dAb,o,result),itemOk=activeItemFromCore('D',dItem,o,result);var state={rate:4096},logs=[];function A(n){return isAbility(n,aAb,aOk);}function Df(n){return isAbility(n,dAb,dOk);}var flag=flagAfterWonder;
    if(!Df('わざわいのたま')&&(A('わざわいのたま')||o.beadsOfRuinField)&&flag==='D')applyRate(state,'わざわいのたま',3072,logs);
    if(!Df('わざわいのつるぎ')&&(A('わざわいのつるぎ')||o.swordOfRuinField)&&flag==='B')applyRate(state,'わざわいのつるぎ',3072,logs);
    if((Df('こだいかっせい')||Df('クォークチャージ'))&&((o.defenderParadoxBoostStat==='B'&&flag==='B')||(o.defenderParadoxBoostStat==='D'&&flag==='D')))applyRate(state,dAb.name,5325,logs);
    if((Df('フラワーギフト')||o.defenderFlowerGiftSupport)&&['にほんばれ','おおひでり'].includes(defenderWeather(result,o))&&flag==='D')applyRate(state,'フラワーギフト',6144,logs);
    if(Df('ふしぎなうろこ')&&o.defenderStatus&&o.defenderStatus!=='なし'&&flag==='B')applyRate(state,'ふしぎなうろこ',6144,logs);
    if(Df('くさのけがわ')&&o.field==='グラスフィールド'&&flag==='B')applyRate(state,'くさのけがわ',6144,logs);
    if(Df('ファーコート')&&flag==='B')applyRate(state,'ファーコート',6144,logs);
    if(itemOk&&window.DAMEKE_DATA_HELPERS.itemTag(dItem,'eviolite')&&input.defender&&input.defender.canEvolve)applyRate(state,'しんかのきせき',6144,logs);
    if(itemOk&&window.DAMEKE_DATA_HELPERS.itemTag(dItem,'assaultVest')&&flag==='D')applyRate(state,'とつげきチョッキ',6144,logs);
    if(itemOk&&window.DAMEKE_DATA_HELPERS.itemTag(dItem,'deepSeaScale')&&window.DAMEKE_DATA_HELPERS.itemTargetsPokemon(dItem,input.defender)&&flag==='D')applyRate(state,'しんかいのウロコ',8192,logs);
    if(itemOk&&window.DAMEKE_DATA_HELPERS.itemTag(dItem,'metalPowder')&&window.DAMEKE_DATA_HELPERS.itemTargetsPokemon(dItem,input.defender)&&flag==='B')applyRate(state,'メタルパウダー',8192,logs);
    var wr=weatherRate(result,o,flag);var afterWeather=Math.max(1,fl(source*wr.rate/4096));if(wr.rate!==4096)logs.unshift('天候補正: '+source+'->'+afterWeather+' ('+wr.rate+'/4096・'+wr.reason+'・事前切り捨て)');return {rate:state.rate,logs:logs,weatherRate:wr.rate,afterWeather:afterWeather,final:Math.max(1,roundFiveDown(afterWeather*state.rate/4096)),flag:flag};
  }
  function updateTrace(result,source,modInfo,sourceNote){var line=(result.trace||[]).find(function(x){return String(x.label).includes('補正後防御側実数値');});var note=sourceNote+' / 参照フラグ='+modInfo.flag+' / 防御力補正: '+(modInfo.logs.join(' / ')||'なし');if(line){line.name='防御側実数値';line.value=source+' -> '+modInfo.final+' / 補正 '+modInfo.rate+'/4096';line.note=note;}else result.trace.push({label:'N57 補正後防御側実数値',name:'防御側実数値',value:source+' -> '+modInfo.final+' / 補正 '+modInfo.rate+'/4096',note:note,implemented:true});}
  function recalc(result,input,finalDef,finalPowers){var level=clamp(num(input.attackerLevel,50),1,100);var atk=parseAfterArrow(result,'補正後攻撃側実数値')||1;var cat=result.effectiveCategory||input.move.category;var tr=result.typeRate4096||combo(result.effectiveType||input.move.type,result.defenderTypes||input.defender.types);var sr=result.stabRate4096||((input.attacker.types||[]).includes(result.effectiveType||input.move.type)?6144:4096);var rollsFirst=[],totalMin=0,totalMax=0,lines=[];for(var i=0;i<finalPowers.length;i++){var pw=finalPowers[i],rolls=[];if(tr===0||cat==='変化')rolls=[0];else{var b=baseDamage(level,pw,atk,finalDef);for(var f=85;f<=100;f++){var d=mod(mod(fl(b*f/100),sr),tr);if(d<1)d=1;rolls.push(d);}}if(!rollsFirst.length)rollsFirst=rolls;var mn=Math.min.apply(null,rolls),mx=Math.max.apply(null,rolls);totalMin+=mn;totalMax+=mx;lines.push((i+1)+'回目 威力'+pw+': '+rolls.join(', '));}result.rolls=rollsFirst;result.multiHitRolls=finalPowers.length>1?lines:null;result.minDamage=totalMin;result.maxDamage=totalMax;var hp=result.defenderMaxHp||1;result.minRate=hp?totalMin/hp*100:0;result.maxRate=hp?totalMax/hp*100:0;}
  var previousDefenseModifierCalc=C.calculateDamage.bind(C);
  C.calculateDamage=function(input){var result=previousDefenseModifierCalc(input);if(result&&result.__coreState)(input.options||(input.options={})).__coreState=result.__coreState;var cat=result.effectiveCategory||input.move.category;var d=parseRankedValues(result,'D');if(!d)return result;var effectiveMoveName=result.moveName||input.move.name;var source,flag,sourceNote;if(['サイコショック','サイコブレイク','しんぴのつるぎ'].includes(effectiveMoveName)){source=d.B;flag='B';sourceNote=effectiveMoveName+': 防御側ランク補正込みB参照';}else if(cat==='物理'){source=d.B;flag='B';sourceNote='物理: 防御側ランク補正込みB参照';}else if(cat==='特殊'){source=d.D;flag='D';sourceNote='特殊: 防御側ランク補正込みD参照';}else{return result;}var flagAfter=wonderRoomOn(result)?(flag==='B'?'D':'B'):flag;var modInfo=calcDefModifier(result,input,source,flagAfter);updateTrace(result,source,modInfo,sourceNote+(flagAfter!==flag?' / ワンダールームにより補正判定フラグ反転':''));var powers=getFinalPowers(result,input);recalc(result,input,modInfo.final,powers);return result;};
  C.__defenseModifierPatched=true;
})();




// v0.31 final damage formula core wrapper: range to STAB
(function(){
  var D = window.DAMEKE_DATA;
  var C = window.DAMEKE_CALC;
  var R = window.DAMEKE_ROUNDING;
  if(!D || !C || !C.calculateDamage || !R || C.__finalDamageCorePatchedV31) return;
  var num = window.DAMEKE_CALC_SHARED.num;
  function by(list,id){return (list||[]).find(function(x){return x.id===id;}) || (list||[])[0] || {};}
  var activeAbilityFromCore = window.DAMEKE_CALC_SHARED.activeAbilityCoreOnly;
  var parseAfterArrow = window.DAMEKE_CALC_SHARED.parseAfterArrow;
  function getFinalPowers(result,input){var line=(result.trace||[]).find(function(x){return String(x.label).includes('変動後威力');});var txt=line?String(line.value):'';var re=/(\d+)回目=(\d+)/g,m,out=[];while((m=re.exec(txt)))out.push(num(m[2],0));if(out.length)return out;if(result.hitPlan&&result.hitPlan.length)return result.hitPlan.map(function(h){return h.basePower||input.move.power||1;});return [input.move.power||1];}
  function protectRate(result){var line=(result.trace||[]).find(function(x){return String(x.label).includes('まもる');});var m=line&&String(line.value||'').match(/(\d+)\/4096/);return m?num(m[1],4096):4096;}
  function criticalRate(result){return (result&&result.criticalEffective)?6144:4096;}
  function zeroDamage(result,input,rates){if(rates&&rates.weather===0)return true;if((result.typeRate4096||4096)===0)return true;if((result.effectiveCategory||input.move.category)==='変化')return true;return false;}
  var isGrounded = window.DAMEKE_CALC_SHARED.isGrounded;
  function effectiveMoveName(result,input){return result.moveName||input.move.name;}
  function moveTarget(result,input,o){var name=effectiveMoveName(result,input);var target=window.DAMEKE_DATA_HELPERS.moveTarget(input.move);
    if(window.DAMEKE_DATA_HELPERS.moveTagByName(name,'teraCluster')&&window.DAMEKE_DATA_HELPERS.pokemonMatches(input.attacker,['テラパゴス(テラスタル)','terapagos_terastal'])&&o.attackerTeraType==='ステラ')return '相手全体';
    if(window.DAMEKE_DATA_HELPERS.moveTagByName(name,'expandingForce')&&o.field==='サイコフィールド'&&isGrounded(result,'A'))return '相手全体';
    return target;
  }
  function rangeInfo(result,input,o){var target=moveTarget(result,input,o);var spread=target==='相手全体'||target==='自分以外';var rate=(o.attackerDoubleDamage&&spread)?3072:4096;return {rate:rate,target:target,spread:spread,reason:rate===3072?'ダブルダメージ+範囲'+target:'なし'};}
  function isZOrSpecialZ(result,input){var line=(result.trace||[]).find(function(x){return String(x.label).includes('Z・ダイマックス（攻撃側）');});var val=String((line&&line.value)||'');if(val==='有効')return true;var effMove=(result&&result.effectiveMove)||input.move;return !!(effMove&&(effMove.isZMove||effMove.isSignatureZ||effMove.isMaxMove));}
  function parentalExcludedMove(name){return window.DAMEKE_DATA_HELPERS.moveTagByName(name,'parentalExcluded');}
  function moveHasMultiHitSpec(move){
    if(!move) return false;
    if(window.DAMEKE_DATA_HELPERS && window.DAMEKE_DATA_HELPERS.moveTag && window.DAMEKE_DATA_HELPERS.moveTag(move,'multiHit')) return true;
    var min = move.hitCountMin != null ? Number(move.hitCountMin) : null;
    var max = move.hitCountMax != null ? Number(move.hitCountMax) : null;
    var hitCount = move.hitCount != null ? Number(move.hitCount) : null;
    var effMax = max != null ? max : (hitCount != null ? hitCount : (min != null ? min : null));
    return effMax != null && effMax > 1;
  }
  function parentalBondInfo(result,input,o,range){var aAb=by(D.abilities,o.attackerAbilityId||'なし');var aOk=activeAbilityFromCore('A',aAb,o,result);var cat=result.effectiveCategory||input.move.category;var name=effectiveMoveName(result,input);var existingHits=(result.hitPlan&&result.hitPlan.length)?result.hitPlan.length:1;var effMoveForHits=result.effectiveMove||input.move;var willBeMultiHit=existingHits>1||moveHasMultiHitSpec(effMoveForHits);var ok=aOk&&aAb.name==='おやこあい'&&(cat==='物理'||cat==='特殊')&&!willBeMultiHit&&range.rate===4096&&!isZOrSpecialZ(result,input)&&!parentalExcludedMove(name);return {active:!!ok,rates:ok?[4096,1024]:[4096],reason:ok?'おやこあいにより2回攻撃 1回目4096/2回目1024':'なし'};}
  function weatherInfo(result,input,o){
    function cleanWeather(v){
      v = String(v == null ? '' : v).trim();
      v = v.replace(/[（(].*$/, '');
      return v || 'なし';
    }
    function traceWeather(side){
      var label = side === 'A' ? '攻撃側天候' : '防御側天候';
      var line = (result.trace || []).find(function(x){ return String(x.label || '') === '00 天候' || String(x.label || '').includes('00 天候'); });
      var note = String(line && line.note || '');
      var m = note.match(new RegExp(label + '=([^ /、]+)'));
      return cleanWeather(m ? m[1] : null);
    }
    var attackerW = cleanWeather(o.attackerEffectiveWeather || traceWeather('A') || o.weather || 'なし');
    var defenderW = cleanWeather(o.defenderEffectiveWeather || traceWeather('D') || o.weather || 'なし');
    var type = result.effectiveType || input.move.type;
    var name = effectiveMoveName(result,input);
    var w = defenderW;
    var source = '防御側天候';
    var rate = 4096;
    var reason = 'なし';
    var invalid = false;

    if(name === 'ハイドロスチーム' && (attackerW === 'にほんばれ' || attackerW === 'おおひでり')){
      w = attackerW;
      source = '攻撃側天候（ハイドロスチーム例外）';
      rate = 6144;
      reason = w + '+ハイドロスチーム';
      return {rate:rate,reason:reason,invalid:false,weather:w,attackerWeather:attackerW,defenderWeather:defenderW,source:source};
    }

    if((w === 'あめ' || w === 'おおあめ') && type === 'みず'){
      rate = 6144; reason = w + '+みず';
    }else if(w === 'あめ' && type === 'ほのお'){
      rate = 2048; reason = 'あめ+ほのお';
    }else if(w === 'おおあめ' && type === 'ほのお'){
      rate = 0; reason = 'おおあめ+ほのお無効'; invalid = true;
    }else if((w === 'にほんばれ' || w === 'おおひでり') && type === 'ほのお'){
      rate = 6144; reason = w + '+ほのお';
    }else if(w === 'にほんばれ' && type === 'みず'){
      rate = 2048; reason = 'にほんばれ+みず';
    }else if(w === 'おおひでり' && type === 'みず'){
      rate = 0; reason = 'おおひでり+みず無効'; invalid = true;
    }else{
      reason = 'なし（防御側天候=' + w + '）';
    }
    return {rate:rate,reason:reason,invalid:invalid,weather:w,attackerWeather:attackerW,defenderWeather:defenderW,source:source};
  }
  var attackerCalcTypes = window.DAMEKE_CALC_SHARED.attackerCalcTypes;
  function stabInfo(result,input,o){var moveType=result.effectiveType||input.move.type;var tera=o.attackerTeraType||'なし';var calcTypes=attackerCalcTypes(result);var calcMatch=calcTypes.includes(moveType);var teraMatch=(tera&&tera!=='なし'&&tera!=='ステラ'&&moveType===tera);var isTerapagos=input.attacker&&window.DAMEKE_DATA_HELPERS.pokemonMatches(input.attacker,['テラパゴス(テラスタル)','terapagos_terastal']);var isStellarTerapagos=input.attacker&&window.DAMEKE_DATA_HELPERS.pokemonMatches(input.attacker,['テラパゴス(ステラ)','terapagos_stellar']);var count=o.attackerStellarMoveCount||'first';var aAb=by(D.abilities,o.attackerAbilityId||'なし');var adapt=activeAbilityFromCore('A',aAb,o,result)&&aAb.name==='てきおうりょく';var name=effectiveMoveName(result,input);if((isStellarTerapagos||(isTerapagos&&tera==='ステラ'))&&calcMatch)return {rate:8192,reason:'テラパゴス(ステラ)+計算上タイプ一致'};if((isStellarTerapagos||(isTerapagos&&tera==='ステラ'))&&!calcMatch)return {rate:4915,reason:'テラパゴス(ステラ)+計算上タイプ不一致'};if(!isTerapagos&&tera==='ステラ'&&calcMatch&&count==='first')return {rate:8192,reason:'ステラ1回目+計算上タイプ一致'};if(!isTerapagos&&tera==='ステラ'&&calcMatch&&count!=='first')return {rate:6144,reason:'ステラ2回目以降+計算上タイプ一致'};if(!isTerapagos&&tera==='ステラ'&&!calcMatch&&name!=='わるあがき'&&count==='first')return {rate:4915,reason:'ステラ1回目+計算上タイプ不一致'};if(!isTerapagos&&tera==='ステラ'&&!calcMatch&&count!=='first')return {rate:4096,reason:'ステラ2回目以降+計算上タイプ不一致'};if(tera!=='なし'&&tera!=='ステラ'&&adapt&&teraMatch&&calcMatch)return {rate:9216,reason:'テラ+てきおうりょく+テラタイプかつ計算上タイプ一致'};if(tera!=='なし'&&tera!=='ステラ'&&adapt&&teraMatch&&!calcMatch)return {rate:8192,reason:'テラ+てきおうりょく+テラタイプのみ一致'};if((!tera||tera==='なし')&&adapt&&calcMatch)return {rate:8192,reason:'非テラ+てきおうりょく+計算上タイプ一致'};if(tera!=='なし'&&tera!=='ステラ'&&teraMatch&&calcMatch)return {rate:8192,reason:'テラタイプかつ計算上タイプ一致'};if(tera!=='なし'&&tera!=='ステラ'&&(teraMatch||calcMatch))return {rate:6144,reason:'テラタイプまたは計算上タイプ一致'};if((!tera||tera==='なし')&&calcMatch)return {rate:6144,reason:'非テラ+計算上タイプ一致'};return {rate:4096,reason:'一致なし'};}
  var defenderCalcTypes = window.DAMEKE_CALC_SHARED.defenderCalcTypes;
  function baseDefTypes(result,o){var tera=o.defenderTeraType||'なし';if(tera&&tera!=='なし'&&tera!=='ステラ')return [tera];var types=defenderCalcTypes(result);return types.length?types:['タイプなし'];}
  
  // v0.64i: final core local helper set. These must live in the same IIFE as typeEffectInfo().
  function isAbilityActive(result,o,side,name){
    var core=(result&&result.__coreState)||(o&&o.__coreState);
    if(core){
      var st=side==='A'?core.attackerAbilityState:core.defenderAbilityState;
      return !!(st&&st.active&&st.ability&&st.ability.name===name);
    }
    var ab=by(D.abilities,side==='A'?(o.attackerAbilityId||'なし'):(o.defenderAbilityId||'なし'));
    return !!(ab&&ab.name===name);
  }
  function isItemActive(result,o,side,name,kind){
    var core=(result&&result.__coreState)||(o&&o.__coreState);
    if(core){
      var st=side==='A'?core.attackerItemState:core.defenderItemState;
      var item=side==='A'?core.attackerItem:core.defenderItem;
      if(!st||!st.active||!item) return false;
      if(name&&item.name!==name) return false;
      if(kind&&item.kind!==kind&&!window.DAMEKE_DATA_HELPERS.itemTag(item,kind)) return false;
      return true;
    }
    var item=by(D.items,side==='A'?(o.attackerItemId||'none'):(o.defenderItemId||'none'));
    if(!item||item.id==='none') return false;
    if(name&&item.name!==name) return false;
    if(kind&&item.kind!==kind&&!window.DAMEKE_DATA_HELPERS.itemTag(item,kind)) return false;
    return true;
  }
  function typeRate(t,dt){
    if(!dt||dt==='タイプなし') return 4096;
    return ((D.typeChart4096&&D.typeChart4096[t])||{})[dt] != null ? D.typeChart4096[t][dt] : 4096;
  }
  function weatherSide(result,o,side){
    var label=side==='A'?'攻撃側天候':'防御側天候';
    var fallback=side==='A'?(o.attackerEffectiveWeather||o.weather||'なし'):(o.defenderEffectiveWeather||o.weather||'なし');
    var line=(result.trace||[]).find(function(x){return String(x.label||'').includes('天候');});
    var note=String(line&&line.note||'');
    var m=note.match(new RegExp(label+'=([^ /、]+)'));
    return m?m[1]:fallback;
  }
  function combineRatesFloor(rates){
    var out=4096;
    (rates||[]).forEach(function(r){out=Math.floor(out*r/4096);});
    return out;
  }
  function currentHpInfo(result){
    var line=(result.trace||[]).find(function(x){return String(x.label).includes('防御側ランク補正込み実数値');});
    var m=line&&String(line.value||'').match(/(\d+)\/(\d+)/);
    return m?{cur:num(m[1],1),max:num(m[2],1)}:{cur:1,max:1};
  }
function abilityImmunity(result,o,moveType){var table={'こんがりボディ':'ほのお','そうしょく':'くさ','ちくでん':'でんき','ちょすい':'みず','でんきエンジン':'でんき','どしょく':'じめん','ひらいしん':'でんき','もらいび':'ほのお','よびみず':'みず'};for(var k in table){if(moveType===table[k]&&isAbilityActive(result,o,'D',k))return k;}return null;}
  function singleRate(result,input,o,moveType,defType,logs){var name=effectiveMoveName(result,input);var rate=typeRate(moveType,defType);var original=rate;
    if(isItemActive(result,o,'D','ねらいのまと','RingTarget')&&rate===0){logs.push(defType+': ねらいのまとにより相性0のタイプを除外');return null;}
    if((isAbilityActive(result,o,'A','きもったま')||isAbilityActive(result,o,'A','しんがん')||o.defenderForesight)&&(moveType==='ノーマル'||moveType==='かくとう')&&defType==='ゴースト'&&rate===0){rate=4096;logs.push(defType+': みやぶり/きもったま/しんがんで0->4096');}
    if(o.defenderMiracleEye&&moveType==='エスパー'&&defType==='あく'&&rate===0){rate=4096;logs.push(defType+': ミラクルアイで0->4096');}
    if(window.DAMEKE_DATA_HELPERS.moveTagByName(name,'freezeDry')&&defType==='みず'){rate=8192;logs.push(defType+': フリーズドライで8192');}
    if(window.DAMEKE_DATA_HELPERS.moveTagByName(name,'absoluteZero')&&defType==='こおり'){rate=0;logs.push(defType+': ぜったいれいどで0');}
    if(name==='フリーフォール'&&defType==='ひこう'){rate=0;logs.push(defType+': フリーフォールで0');}
    if(isAbilityActive(result,o,'A','いたずらごころ')&&(result.effectiveCategory||input.move.category)==='変化'&&defType==='あく'){rate=0;logs.push(defType+': いたずらごころ+変化技で0');}
    if(weatherSide(result,o,'D')==='らんきりゅう'&&defType==='ひこう'&&rate>4096){logs.push(defType+': らんきりゅうで'+rate+'->'+Math.floor(rate/2));rate=Math.floor(rate/2);}
    if(original===rate&&!logs.some(function(x){return x.indexOf(defType+':')===0;}))logs.push(defType+': '+rate);
    return rate;
  }
  function typeEffectInfo(result,input,o,hitOrdinal){var moveType=result.effectiveType||input.move.type;var name=effectiveMoveName(result,input);var logs=[];var invalid=false;
    if(moveType==='ステラ'){var st=o.defenderTeraType&&o.defenderTeraType!=='なし'?8192:4096;return {rate:st,invalid:false,reason:'ステラ技タイプ: 防御側テラ='+(o.defenderTeraType||'なし'),details:['ステラ='+st]};}
    if(moveType==='タイプなし')return {rate:4096,invalid:false,reason:'技タイプなし',details:['技タイプなし=4096']};
    var types=baseDefTypes(result,o);if(!types.length||types[0]==='タイプなし')return {rate:4096,invalid:false,reason:'防御側タイプなし',details:['防御側タイプなし=4096']};
    if(name==='むにきすひかり'&&moveType==='ドラゴン'&&types.indexOf('フェアリー')>=0){types=types.filter(function(t){return t!=='フェアリー';});logs.push('むにきすひかり: フェアリータイプを相性計算から除外');if(!types.length)types=['タイプなし'];}
    var imm=abilityImmunity(result,o,moveType);if(imm)return {rate:0,invalid:true,reason:'防御側特性'+imm+'により無効',details:['特性無効']};
    var dGrounded=isGrounded(result,'D');
    if(window.DAMEKE_DATA_HELPERS.moveTagByName(name,'thousandArrows')&&moveType==='じめん'){
      var targetRing=isItemActive(result,o,'D','ねらいのまと','RingTarget');
      if(types.includes('ひこう')&&!dGrounded&&!targetRing)return {rate:4096,invalid:false,reason:'サウザンアロー: 非接地ひこう相手は4096',details:['サウザンアロー特殊=4096']};
      if(types.includes('ひこう')&&dGrounded&&!targetRing){types=types.filter(function(t){return t!=='ひこう';});logs.push('サウザンアロー: 接地ひこうを除外');if(!types.length)types=['タイプなし'];}
    } else if(!dGrounded&&moveType==='じめん'){
      return {rate:0,invalid:true,reason:'防御側が地面にいないためじめん技無効',details:['非接地じめん無効']};
    } else if(dGrounded&&moveType==='じめん'&&types.includes('ひこう')){
      // じゅうりょく・くろいてっきゅう・ねをはる・うちおとす等で接地しているひこうタイプには、
      // じめん技が等倍で当たる(ひこうタイプの相性0を除外する)。
      types=types.filter(function(t){return t!=='ひこう';});logs.push('接地しているためひこうのじめん無効を除外');if(!types.length)types=['タイプなし'];
    }
    var rates=[];types.forEach(function(t){var r=singleRate(result,input,o,moveType,t,logs);if(r!==null)rates.push(r);});if(!rates.length)return {rate:4096,invalid:false,reason:'ねらいのまと等で全タイプ除外=タイプなし扱い',details:logs};
    var rate=combineRatesFloor(rates);
    if(window.DAMEKE_DATA_HELPERS.moveTagByName(name,'flyingPress')){var flyingRates=[];types.forEach(function(t){var r=singleRate(result,input,o,'ひこう',t,logs);if(r!==null)flyingRates.push(r);});var fr=flyingRates.length?combineRatesFloor(flyingRates):4096;logs.push('フライングプレス追加ひこう相性='+fr);rate=Math.floor(rate*fr/4096);}
    if(rate!==0&&moveType==='ほのお'&&o.defenderTarShot){logs.push('タールショット: '+rate+' -> '+Math.floor(rate*8192/4096));rate=Math.floor(rate*8192/4096);}
    var hp=currentHpInfo(result);if(rate!==0&&isAbilityActive(result,o,'D','テラスシェル')&&hp.cur===hp.max){logs.push('テラスシェル満タン: '+rate+' -> 2048');rate=2048;}
    if(rate!==0&&rate<=4096&&isAbilityActive(result,o,'D','ふしぎなまもり')){logs.push('ふしぎなまもり: '+rate+' -> 0');rate=0;invalid=true;}
    if(rate===0)invalid=true;return {rate:rate,invalid:invalid,reason:logs.join(' / ')||'通常相性',details:logs};
  }
  function calcOtherModifier(){return {rate:4096,logs:['外枠のみ: その他補正は未実装のため4096']};}
  function applyFiveDown(v,rate){return R.apply4096FiveDown(v,rate);}function applyFloorPercent(v,pct){return Math.floor(v*pct/100);}
  function calcOne(level,power,atk,def,rnd,rates,parentalRate){var steps=[];var a=Math.floor(level*2/5)+2;steps.push('floor(Lv*2/5)+2='+a);var b=Math.floor(a*power*atk/def);steps.push('floor('+a+'*威力'+power+'*攻撃'+atk+'/防御'+def+')='+b);var d=Math.floor(b/50)+2;steps.push('floor('+b+'/50)+2='+d);d=applyFiveDown(d,rates.range);steps.push('範囲 '+rates.range+' -> '+d);d=applyFiveDown(d,parentalRate);steps.push('おやこあい '+parentalRate+' -> '+d);d=applyFiveDown(d,rates.weather);steps.push('天候 '+rates.weather+' -> '+d);d=applyFiveDown(d,rates.glaiveRush);steps.push('きょけんとつげき '+rates.glaiveRush+' -> '+d);d=applyFiveDown(d,rates.critical);steps.push('急所 '+rates.critical+' -> '+d);d=applyFloorPercent(d,rnd);steps.push('乱数 '+rnd+'/100 -> '+d);d=applyFiveDown(d,rates.stab);steps.push('タイプ一致 '+rates.stab+' -> '+d);d=R.apply4096Floor(d,rates.type);steps.push('相性 '+rates.type+' -> '+d);d=applyFiveDown(d,rates.burn);steps.push('やけど '+rates.burn+' -> '+d);d=applyFiveDown(d,rates.other);steps.push('その他 '+rates.other+' -> '+d);d=applyFiveDown(d,rates.protect);steps.push('まもる '+rates.protect+' -> '+d);if(d<1)d=1;return {damage:d,steps:steps};}
  function setTrace(result,label,name,value,note){var line=(result.trace||[]).find(function(x){return String(x.label).includes(label);});if(line){line.name=name;line.value=value;if(note!=null)line.note=note;}else result.trace.push({label:label,name:name,value:value,note:note||'',implemented:true});}
  var prev=C.calculateDamage.bind(C);
  C.calculateDamage=function(input){var result=prev(input);if(result&&result.__coreState)(input.options||(input.options={})).__coreState=result.__coreState;var o=input.options||{};var powers=getFinalPowers(result,input),atk=parseAfterArrow(result,'補正後攻撃側実数値'),def=parseAfterArrow(result,'補正後防御側実数値'),level=Math.min(Math.max(num(input.attackerLevel,50),1),100);var range=rangeInfo(result,input,o),parent=parentalBondInfo(result,input,o,range),weather=weatherInfo(result,input,o),stab=stabInfo(result,input,o),typeEff=typeEffectInfo(result,input,o),other=calcOtherModifier();result.stabRate4096=stab.rate;result.stabReason=stab.reason;result.moveRangeTarget=range.target;var rates={range:range.rate,weather:weather.rate,glaiveRush:o.defenderGlaiveRush?8192:4096,critical:criticalRate(result),stab:stab.rate,type:typeEff.rate,burn:4096,other:other.rate,protect:protectRate(result)};
    result.typeRate4096=typeEff.rate;setTrace(result,'N64 ダメージ変動値','相性',typeEff.rate+'/4096 ('+(typeEff.rate/4096).toFixed(2)+'倍)',typeEff.reason);setTrace(result,'タイプ相性詳細','詳細',typeEff.details.join(' / ')||typeEff.reason,'v0.32');
    // テラスシェルは例外的に、1ヒット目の時点でHP満タンであれば2ヒット目以降にもそのまま
    // 適用される(他のHP満タン条件の特性(マルチスケイル/ファントムガード)とは異なり、1ヒット目
    // 限定にしない)。そのためtypeRate4096Restのような2ヒット目以降専用の値は用意せず、
    // 全ヒット共通でtypeEff.rateを使う。
    var zero=(!atk||!def||!powers.length||weather.invalid||typeEff.invalid||(result.effectiveCategory||input.move.category)==='変化');if(zero){result.rolls=[0];result.minDamage=0;result.maxDamage=0;result.minRate=0;result.maxRate=0;var reason=weather.invalid?'天候により無効':(typeEff.invalid?'タイプ相性により無効':'変化技または無効');setTrace(result,'N68 乱数','85から100','0','v0.32 最終式: '+reason);setTrace(result,'N81 無効要素','現在値',reason,'v0.32');return result;}
    var rolls=[],rollLines=[],firstDetail=[];for(var rnd=85;rnd<=100;rnd++){var total=0,parts=[];for(var i=0;i<powers.length;i++){for(var j=0;j<parent.rates.length;j++){var one=calcOne(level,powers[i],atk,def,rnd,rates,parent.rates[j]);total+=one.damage;parts.push((i+1)+'回目'+(parent.rates.length>1?'-おやこあい'+(j+1):'')+'='+one.damage);if(rnd===85&&i===0&&j===0)firstDetail=one.steps;}}rolls.push(total);rollLines.push(rnd+': '+parts.join(' + ')+' = '+total);}result.rolls=rolls;result.multiHitRolls=(powers.length>1||parent.rates.length>1)?rollLines:null;result.minDamage=Math.min.apply(null,rolls);result.maxDamage=Math.max.apply(null,rolls);var hp=result.defenderMaxHp||1;result.minRate=hp?result.minDamage/hp*100:0;result.maxRate=hp?result.maxDamage/hp*100:0;setTrace(result,'N66 ダメージ補正値','範囲から相性まで','範囲='+rates.range+' / おやこあい='+(parent.rates.length>1?'4096,1024':'4096')+' / 天候='+rates.weather+' / きょけんとつげき='+rates.glaiveRush+' / 急所='+rates.critical+' / STAB='+rates.stab+' / 相性='+rates.type+' / やけど='+rates.burn+' / その他='+rates.other+' / まもる='+rates.protect,'範囲: '+range.reason+' / おやこあい: '+parent.reason+' / 天候: '+weather.reason+' / タイプ一致: '+stab.reason+' / 相性: '+typeEff.reason+' / '+other.logs.join(' / '));setTrace(result,'N68 乱数','85から100',rolls.join(', '),'v0.32 最終式。85時1回目詳細: '+firstDetail.join(' / '));return result;};
  C.__finalDamageCorePatchedV32=true;
})();


// v0.33 final damage formula core wrapper: burn, other, protect
(function(){
  var D = window.DAMEKE_DATA;
  var C = window.DAMEKE_CALC;
  var R = window.DAMEKE_ROUNDING;
  if(!D || !C || !C.calculateDamage || !R || C.__finalDamageCorePatchedV33) return;
  var num = window.DAMEKE_CALC_SHARED.num;
  function by(list,id){return (list||[]).find(function(x){return x.id===id;}) || (list||[])[0] || {};}
  var activeAbility = window.DAMEKE_CALC_SHARED.activeAbilityCoreOnly;
  var activeItem = window.DAMEKE_CALC_SHARED.activeItemCoreOnly;
  var parseAfterArrow = window.DAMEKE_CALC_SHARED.parseAfterArrow;
  function parseRateFromTrace(result,label,nameContains){var line=(result.trace||[]).find(function(x){return String(x.label).includes(label) && (!nameContains || String(x.name).includes(nameContains));});var m=line&&String(line.value||'').match(/(\d+)\/4096/);return m?num(m[1],4096):4096;}
  function getFinalPowers(result,input){var line=(result.trace||[]).find(x=>String(x.label).includes('変動後威力'));var txt=line?String(line.value):'';var re=/(\d+)回目=(\d+)/g,m,out=[];while((m=re.exec(txt)))out.push(num(m[2],0));if(out.length)return out;if(result.hitPlan&&result.hitPlan.length)return result.hitPlan.map(h=>h.basePower||input.move.power||1);return [input.move.power||1];}
  function criticalActive(result){if(result&&typeof result.criticalEffective==='boolean')return result.criticalEffective;var line=(result.trace||[]).find(x=>String(x.label).includes('急所'));var note=String((line&&line.note)||''), val=String((line&&line.value)||'');return (val==='あり'||note.includes('急所確定')||note.includes('攻撃側条件急所'))&&!note.includes('無効')&&!note.includes('なし');}
  var contactActive = window.DAMEKE_CALC_SHARED.contactActive;
  function currentHp(result){var line=(result.trace||[]).find(x=>String(x.label).includes('防御側ランク補正込み実数値'));var m=line&&String(line.value||'').match(/(\d+)\/(\d+)/);return m?{cur:num(m[1],1),max:num(m[2],1)}:{cur:1,max:1};}
  var moveName = window.DAMEKE_CALC_SHARED.moveName;
  var isGrounded = window.DAMEKE_CALC_SHARED.isGrounded;
  var attackerCalcTypes = window.DAMEKE_CALC_SHARED.attackerCalcTypes;
  function moveDataAlwaysHit(move){
    if(!move || move.accuracy==null) return false;
    var s=String(move.accuracy).trim();
    if(s==='ONEHIT_KO') return false; // OHKO-style level-based accuracy, not a plain 必中 flag -- needs separate future handling
    if(s==='-'||s==='必中') return true;
    var n=parseInt(s,10);
    return isNaN(n);
  }
  function accuracyInfo(result,input,o){
    var effMove = result.effectiveMove || input.move;
    var n = moveName(result,input);
    var aAb=by(D.abilities,o.attackerAbilityId||'なし'), dAb=by(D.abilities,o.defenderAbilityId||'なし');
    var aOk=activeAbility('A',aAb,o,result), dOk=activeAbility('D',dAb,o,result);
    var invisible = o.defenderSemiInvulnerable||'なし';
    var special = o.attackerSpecialState||'none';

    if((aOk&&aAb.name==='ノーガード')||(dOk&&dAb.name==='ノーガード')) return {result:'必中', reason:'ノーガード', invalidated:false};

    if(o.attackerLockOn) return {result:'必中', reason:'ロックオン', invalidated:false};

    var tera=o.attackerTeraType||'なし';
    var toxicTeraMatch = (tera==='どく') || (tera==='なし' && attackerCalcTypes(result).indexOf('どく')>=0);
    if(toxicTeraMatch && n==='どくどく') return {result:'必中', reason:'テラスタイプどく+どくどく', invalidated:false};

    if(invisible==='そらをとぶ' && ['かぜおこし','たつまき','かみなり','スカイアッパー','うちおとす','ぼうふう','サウザンアロー'].indexOf(n)<0) return {result:'当たらない', reason:'相手はそらをとぶ中', invalidated:true};
    if(invisible==='あなをほる' && ['じしん','マグニチュード'].indexOf(n)<0) return {result:'当たらない', reason:'相手はあなをほる中', invalidated:true};
    if(invisible==='ダイビング' && ['なみのり','うずしお'].indexOf(n)<0) return {result:'当たらない', reason:'相手はダイビング中', invalidated:true};
    if(invisible==='シャドーダイブ') return {result:'当たらない', reason:'相手はシャドーダイブ中', invalidated:true};

    var thunderMoves=['かみなり','ぼうふう','かみなりあらし','こがらしあらし','ねっさのあらし'];
    var rainAlwaysHit = (o.defenderEffectiveWeather||o.weather)==='あめ' && thunderMoves.indexOf(n)>=0;
    var defenderTelekinesisActive = o.defenderTelekinesis && !(input.defender && window.DAMEKE_DATA_HELPERS.isTelekinesisImmune(input.defender));
    if(defenderTelekinesisActive || special==='zmove' || special==='special_z' || special==='dynamax' || special==='gmax' || moveDataAlwaysHit(effMove) || rainAlwaysHit){
      var why = defenderTelekinesisActive?'防御側テレキネシス':(special!=='none'?'攻撃側強化技選択中':(rainAlwaysHit?'防御側あめ+天候技':'技データが必中'));
      return {result:'必中', reason:why, invalidated:false};
    }

    return {result:'命中', reason:'', invalidated:false};
  }
  function accuracyPercentInfo(result,input,o){
    var effMove = result.effectiveMove || input.move;
    var n = moveName(result,input);
    var tera = o.attackerTeraType||'なし';
    var iceTeraMatch = (tera==='こおり') || (tera==='なし' && attackerCalcTypes(result).indexOf('こおり')>=0);
    var attackerLevel = num(input.attackerLevel,50), defenderLevel = num(input.defenderLevel,50);
    var isOhkoData = String(effMove.accuracy).trim()==='ONEHIT_KO';

    if(!iceTeraMatch && n==='ぜったいれいど'){
      return {value: 20+(attackerLevel-defenderLevel), note:'ぜったいれいど(こおり以外)、20+レベル差'};
    }
    if((iceTeraMatch && n==='ぜったいれいど') || (n!=='ぜったいれいど' && isOhkoData)){
      return {value: 30+(attackerLevel-defenderLevel), note:'一撃必殺技、30+レベル差'};
    }

    var aAb=by(D.abilities,o.attackerAbilityId||'なし'), dAb=by(D.abilities,o.defenderAbilityId||'なし');
    var aOk=activeAbility('A',aAb,o,result), dOk=activeAbility('D',dAb,o,result);
    var aItem=by(D.items,o.attackerItemId||'none'), dItem=by(D.items,o.defenderItemId||'none');
    var aItemOk=activeItem('A',aItem,o,result), dItemOk=activeItem('D',dItem,o,result);
    var cat=result.effectiveCategory||input.move.category;

    var baseAcc=parseInt(effMove.accuracy,10);
    if(isNaN(baseAcc)) baseAcc=100;
    var weather=o.attackerEffectiveWeather||o.weather;
    if((weather==='にほんばれ'||weather==='おおひでり') && (n==='かみなり'||n==='ぼうふう')) baseAcc=50;
    if(dOk && dAb.name==='ミラクルスキン' && cat==='変化' && baseAcc>=50) baseAcc=50;

    var combined=4096, logs=[];
    function apply(rate,label){ combined=R.roundHalfUp(combined*rate/4096); logs.push(label+'='+rate); }

    if(o.gravity) apply(6840,'じゅうりょく');
    if(dOk && dAb.name==='ちどりあし' && o.defenderConfusion) apply(2048,'ちどりあし');
    if(dOk && dAb.name==='すながくれ' && (o.defenderEffectiveWeather||o.weather)==='すなあらし') apply(3277,'すながくれ');
    if(dOk && dAb.name==='ゆきがくれ' && (o.defenderEffectiveWeather||o.weather)==='ゆき') apply(3277,'ゆきがくれ');
    if(aOk && aAb.name==='はりきり' && cat==='物理') apply(3277,'はりきり');
    if(aOk && aAb.name==='ふくがん') apply(5325,'ふくがん');
    if((aOk && aAb.name==='しょうりのほし') || o.attackerVictoryStar) apply(4506,'しょうりのほし');
    if(dItemOk && dItem.name==='ひかりのこな') apply(3686,'ひかりのこな');
    if(dItemOk && dItem.name==='のんきのおこう') apply(3686,'のんきのおこう');
    if(aItemOk && aItem.name==='こうかくレンズ') apply(4505,'こうかくレンズ');
    if(aItemOk && aItem.name==='フォーカスレンズ' && o.focusLensMoveOrder==='second') apply(4915,'フォーカスレンズ');

    var afterCombined = R.roundFiveDown(baseAcc*combined/4096);

    var hitRank = num(result.hitRank,0);
    var rankMult = hitRank>=0 ? (3+hitRank)/3 : 3/(3-hitRank);
    var afterRank = Math.floor(afterCombined*rankMult);
    if(afterRank>100) afterRank=100;

    var final=afterRank;
    if(o.attackerMicleBerry){
      final = R.roundFiveDown(afterRank*4915/4096);
      if(final>100) final=100;
    }

    return {value: final, note: '基礎'+baseAcc+'、合成後'+afterCombined+'、'+(logs.join('、')||'補正なし')+(o.attackerMicleBerry?'、ミクルのみ':'')};
  }
  function priorityInfo(result,input,o){
    var effMove = result.effectiveMove || input.move;
    var base = num(effMove.priority, 0);
    var cat = result.effectiveCategory || input.move.category;
    var type = result.effectiveType || input.move.type;
    var n = moveName(result,input);
    var aAb = by(D.abilities, o.attackerAbilityId||'なし');
    var aOk = activeAbility('A', aAb, o, result);
    var total = base;
    var notes = ['基礎='+base];

    if(aOk && aAb.name==='いたずらごころ' && cat==='変化'){ total+=1; notes.push('いたずらごころ+1'); }

    var galeWingsExcluded = ['めざめるパワー','しぜんのめぐみ','さばきのつぶて','マルチアタック','めざめるダンス','テラバースト'];
    if(aOk && aAb.name==='はやてのつばさ' && type==='ひこう' && galeWingsExcluded.indexOf(n)<0){ total+=1; notes.push('はやてのつばさ+1'); }

    if(aOk && aAb.name==='ヒーリングシフト' && window.DAMEKE_DATA_HELPERS.moveTagByName(n,'healingMove')){ total+=3; notes.push('ヒーリングシフト+3'); }

    if(window.DAMEKE_DATA_HELPERS.moveTagByName(n,'grassyGlide') && o.field==='グラスフィールド' && isGrounded(result,'A')){ total+=1; notes.push('グラススライダー+1'); }

    return { value: total, note: notes.join('、') };
  }
  function attackerCurrentHp(result){
    var line=(result.trace||[]).find(function(x){return String(x.label).includes('攻撃側ランク補正込み実数値');});
    var m=line&&String(line.value||'').match(/(\d+)\/(\d+)/);
    return m?num(m[1],1):1;
  }
  function additionalInvalidChecks(result,input,o){
    var effMove=result.effectiveMove||input.move;
    var n=moveName(result,input);
    var aAb=by(D.abilities,o.attackerAbilityId||'なし'), dAb=by(D.abilities,o.defenderAbilityId||'なし');
    var aOk=activeAbility('A',aAb,o,result), dOk=activeAbility('D',dAb,o,result);
    var aItem=by(D.items,o.attackerItemId||'none'), dItem=by(D.items,o.defenderItemId||'none');
    var aItemOk=activeItem('A',aItem,o,result), dItemOk=activeItem('D',dItem,o,result);
    var tera=o.attackerTeraType||'なし';
    var calcTypesA=attackerCalcTypes(result);
    var attacker=input.attacker;
    var attackerLevel=num(input.attackerLevel,50), defenderLevel=num(input.defenderLevel,50);
    var priority=priorityInfo(result,input,o).value;
    var invisible=o.defenderSemiInvulnerable||'なし';

    if(o.gravity && ['はねる','とびげり','とびひざげり','でんじふゆう','そらをとぶ','とびはねる','フリーフォール','テレキネシス','フライングプレス'].indexOf(n)>=0)
      return {invalid:true,reason:'じゅうりょく中は'+n+'不可'};

    if(n==='もえつきる'){
      var fireMatch=(tera==='ほのお')||(tera==='なし'&&calcTypesA.indexOf('ほのお')>=0);
      if(!fireMatch) return {invalid:true,reason:'もえつきるはほのおタイプ以外は使用不可'};
    }
    if(n==='でんこうそうげき'){
      var elecMatch=(tera==='でんき')||(tera==='なし'&&calcTypesA.indexOf('でんき')>=0);
      if(!elecMatch) return {invalid:true,reason:'でんこうそうげきはでんきタイプ以外は使用不可'};
    }

    if(n==='アイアンローラー' && (o.field||'なし')==='なし') return {invalid:true,reason:'アイアンローラーはフィールドがないと無効'};

    if(n==='いじげんラッシュ' && !window.DAMEKE_DATA_HELPERS.pokemonMatches(attacker,['フーパ(ときはなたれしフーパ)','hoopa_unbound'])) return {invalid:true,reason:'いじげんラッシュはときはなたれしフーパ専用'};
    if(n==='ダークホール' && !window.DAMEKE_DATA_HELPERS.pokemonMatches(attacker,['ダークライ','メガダークライ','darkrai','darkrai_mega'])) return {invalid:true,reason:'ダークホールはダークライ/メガダークライ専用'};
    if(n==='オーラぐるま' && !window.DAMEKE_DATA_HELPERS.pokemonMatches(attacker,['モルペコ(まんぷくもよう)','モルペコ(はらぺこもよう)','morpeko_full','morpeko_hangry'])) return {invalid:true,reason:'オーラぐるまはモルペコ専用'};

    if(n==='なげつける'){
      // Fling throws the held item even if きんちょうかん would block *eating* a berry -- eating and
      // throwing are different actions, so the same exception used for しぜんのめぐみ applies here.
      // activeItem()は真偽値を返すため、きんちょうかんの理由はコアの持ち物状態から読む
      // (以前は真偽値に.activeを参照しており、なげつけるが常に無効になっていた)。
      var aItemCoreState = result.__coreState && result.__coreState.attackerItemState;
      var flingActive = aItemOk || (aItem.isBerry && !!aItemCoreState && /きんちょうかん|じんばいったい/.test(String(aItemCoreState.reason||'')));
      if(!flingActive) return {invalid:true,reason:'なげつけるは持ち物がないか無効'};
      // flingPower==null covers items with no defined Fling power in the data (poke balls, TMs,
      // mail, festival ticket, gems, とくせいカプセル/パッチ, ふくごうきんぞく, the auto-item
      // "～ポン" series, etc.) -- these can't be thrown at all.
      if(aItem.flingPower==null) return {invalid:true,reason:'なげつけるは、その持ち物には投げつける威力が設定されていないため無効'};
      // Species-linked items (mega stones, Arceus plates/Z-crystals, Silvally memories, Ogerpon
      // masks, Zacian/Zamazenta swords/shields, Dialga/Palkia/Giratina orbs) are throwable in
      // general (many have a real Fling power) but not by the very pokemon they're linked to.
      if(D.findFormByLinkedItem && D.findFormByLinkedItem(attacker, aItem.name)) return {invalid:true,reason:'なげつけるはそのポケモン専用の連動アイテムのため無効'};
      if(aItem.kind==='Drive' && window.DAMEKE_DATA_HELPERS.pokemonMatches(attacker,['ゲノセクト','genesect'])) return {invalid:true,reason:'なげつけるはゲノセクト自身のカセットには無効'};
      var boostEnergyList=['イダイナキバ','サケブシッポ','アラブルタケ','ハバタクカミ','チヲハウハネ','スナノケガワ','トドロクツキ','ウネルミナモ','テツノワダチ','テツノツツミ','テツノカイナ','テツノコウベ','テツノドクガ','テツノイバラ','テツノブジン','テツノイサハ'];
      if(aItem.name==='ブーストエナジー' && window.DAMEKE_DATA_HELPERS.pokemonMatches(attacker,boostEnergyList)) return {invalid:true,reason:'なげつけるはそのポケモン自身のブーストエナジーには無効'};
    }
    if(n==='しぜんのめぐみ'){
      var aItemCoreState2 = result.__coreState && result.__coreState.attackerItemState;
      var ngActive=aItemOk || (aItem.isBerry && !!aItemCoreState2 && /きんちょうかん|じんばいったい/.test(String(aItemCoreState2.reason||'')));
      if(!ngActive||!aItem.isBerry) return {invalid:true,reason:'しぜんのめぐみは有効なきのみが必要'};
    }
    if(n==='ポルターガイスト' && (!dItem || dItem.id==='none' || o.defenderNoItem)) return {invalid:true,reason:'ポルターガイストは相手が持ち物を持っていないと無効'};

    if(n==='いびき' && o.attackerStatus!=='ねむり') return {invalid:true,reason:'いびきは眠り状態でないと使用不可'};
    if(n==='ゆめくい' && o.defenderStatus!=='ねむり') return {invalid:true,reason:'ゆめくいは相手が眠り状態でないと無効'};

    var dynState=o.defenderSpecialState;
    if((dynState==='dynamax'||dynState==='gmax') && ['けたぐり','くさむすび','ヘビーボンバー','ヒートスタンプ','じわれ','ぜったいれいど','つのドリル','ハサミギロチン'].indexOf(n)>=0)
      return {invalid:true,reason:'防御側ダイマックス中は'+n+'無効'};

    if(['じばく','だいばくはつ','ビックリヘッド','ミストバースト'].indexOf(n)>=0 && dOk && dAb.name==='しめりけ')
      return {invalid:true,reason:'しめりけにより爆発技無効'};

    if(priority>=1 && dOk && ['ビビッドボディ','じょおうのいげん','テイルアーマー'].indexOf(dAb.name)>=0)
      return {invalid:true,reason:dAb.name+'により先制技無効'};

    if((o.field||'なし')==='サイコフィールド' && isGrounded(result,'D') && invisible==='なし' && priority>=1)
      return {invalid:true,reason:'サイコフィールドにより先制技無効'};

    if(window.DAMEKE_DATA_HELPERS.moveTagByName(n,'sound') && dOk && dAb.name==='ぼうおん') return {invalid:true,reason:'ぼうおんにより音技無効'};
    if(window.DAMEKE_DATA_HELPERS.moveTagByName(n,'bullet') && dOk && dAb.name==='ぼうだん') return {invalid:true,reason:'ぼうだんにより弾技無効'};
    if(window.DAMEKE_DATA_HELPERS.moveTagByName(n,'wind') && dOk && dAb.name==='かぜのり') return {invalid:true,reason:'かぜのりにより風技無効'};

    if(n==='がむしゃら' && attackerCurrentHp(result)>=result.defenderCurrentHp) return {invalid:true,reason:'がむしゃらは自分の残りHPが相手以上だと無効'};

    if(['じわれ','ぜったいれいど','つのドリル','ハサミギロチン'].indexOf(n)>=0){
      if(attackerLevel<defenderLevel) return {invalid:true,reason:'一撃必殺技はレベルが低いと無効'};
      if(dOk && dAb.name==='がんじょう') return {invalid:true,reason:'がんじょうにより一撃必殺技無効'};
    }

    return {invalid:false,reason:''};
  }
  function moveType(result,input){return result.effectiveType||input.move.type;}
  function moveCat(result,input){return result.effectiveCategory||input.move.category;}
  var isZOrMax = window.DAMEKE_CALC_SHARED.isZOrMax;
  function getRangeRate(result){var line=(result.trace||[]).find(x=>String(x.label).includes('ダメージ補正値'));var m=line&&String(line.value||'').match(/範囲=(\d+)/);return m?num(m[1],4096):4096;}
  function rangeIsSpread(result){return getRangeRate(result)===3072;}
  function rateApply(state,label,rate,logs){var before=state.rate;state.rate=R.combineRateHalfUp(state.rate,rate);logs.push(label+': '+before+'->'+state.rate+' ('+rate+'/4096)');}
  function soundMove(input,result){return !!window.DAMEKE_DATA_HELPERS.moveTagForEffective(input.move,moveName(result,input),'sound');}
  var protectedPierceMove = window.DAMEKE_CALC_SHARED.protectedPierceMove;
  function burnRate(result,input,o){var aAb=by(D.abilities,o.attackerAbilityId||'なし');if(o.attackerStatus==='やけど' && result.effectiveCategory==='物理' && !(activeAbility('A',aAb,o,result)&&aAb.name==='こんじょう') && moveName(result,input)!=='からげんき')return {rate:2048,reason:'やけど'};return {rate:4096,reason:'なし'};}
  function moldBreakerActive(result,input,o){var aAb=by(D.abilities,o.attackerAbilityId||'なし');var aA=activeAbility('A',aAb,o,result);var n=moveName(result,input);var moldMoves=['メテオドライブ','フォトンゲイザー','サンシャインスマッシャー','てんこがすめつぼうのひかり','キョダイコランダ'];var effMove=(result&&result.effectiveMove)||input.move;return !!((aA&&window.DAMEKE_DATA_HELPERS.abilityTag(aAb,'moldBreakerEffect'))||(effMove&&effMove.ignoresAbilities)||window.DAMEKE_DATA_HELPERS.moveTagByName(n,'ignoresAbilities')||moldMoves.indexOf(n)>=0);}
  function otherModifier(result,input,o,hitOrdinal){var aAb=by(D.abilities,o.attackerAbilityId||'なし'),dAb=by(D.abilities,o.defenderAbilityId||'なし'),aItem=by(D.items,o.attackerItemId||'none'),dItem=by(D.items,o.defenderItemId||'none');var aA=activeAbility('A',aAb,o,result),dA=activeAbility('D',dAb,o,result),aI=activeItem('A',aItem,o,result),dI=activeItem('D',dItem,o,result);var cat=moveCat(result,input),type=moveType(result,input),n=moveName(result,input),typeRate=result.typeRate4096||4096,crit=criticalActive(result),contact=contactActive(result);var state={rate:4096},logs=[];
    var screen=o.defenderScreen||'none';var wall=4096;var wallBypassMove=['かわらわり','サイコファング','レイジングブル'].includes(n);if(!(aA&&window.DAMEKE_DATA_HELPERS.abilityTag(aAb,'screenBypass'))&&!crit&&!wallBypassMove){if((cat==='物理'&&(screen==='reflect'||screen==='auroraVeil'))||(cat==='特殊'&&(screen==='lightScreen'||screen==='auroraVeil')))wall=rangeIsSpread(result)?2703:2048;}if(wall!==4096)rateApply(state,'壁補正',wall,logs);
    if(aA&&window.DAMEKE_DATA_HELPERS.abilityTag(aAb,'superEffectiveBoost')&&typeRate>4096)rateApply(state,'ブレインフォース',5120,logs);
    if(['アクセルブレイク','イナズマドライブ'].includes(n)&&typeRate>4096)rateApply(state,'弱点強化技',5461,logs);
    if(aA&&window.DAMEKE_DATA_HELPERS.abilityTag(aAb,'criticalDamageBoost')&&crit)rateApply(state,'スナイパー',6144,logs);
    if(aA&&window.DAMEKE_DATA_HELPERS.abilityTag(aAb,'notVeryEffectiveBoost')&&typeRate<4096)rateApply(state,'いろめがね',8192,logs);
    if(dA&&dAb.name==='もふもふ'&&type==='ほのお')rateApply(state,'もふもふ ほのお',8192,logs);
    if(dA&&dAb.name==='こおりのりんぷん'&&cat==='特殊')rateApply(state,'こおりのりんぷん',2048,logs);
    if(dA&&dAb.name==='パンクロック'&&soundMove(input,result))rateApply(state,'防御側パンクロック',2048,logs);
    var hp=currentHp(result);if(dA&&['ファントムガード','マルチスケイル'].includes(dAb.name)&&hp.cur===hp.max&&(hitOrdinal==null||hitOrdinal===1))rateApply(state,dAb.name,2048,logs);
    if(dA&&dAb.name==='もふもふ'&&contact)rateApply(state,'もふもふ 接触',2048,logs);
    if(dA&&dAb.name==='ぼうごのはどう'&&contact)rateApply(state,'ぼうごのはどう',2048,logs);
    if(dA&&['ハードロック','フィルター','プリズムアーマー'].includes(dAb.name)&&typeRate>4096)rateApply(state,dAb.name,3072,logs);
    if(o.defenderFriendGuard&&!moldBreakerActive(result,input,o))rateApply(state,'フレンドガード',3072,logs);else if(o.defenderFriendGuard&&moldBreakerActive(result,input,o))logs.push('フレンドガード: かたやぶり効果により4096');
    if(aI&&window.DAMEKE_DATA_HELPERS.itemTag(aItem,'expertBelt')&&typeRate>4096)rateApply(state,'たつじんのおび',4915,logs);
    if(aI&&window.DAMEKE_DATA_HELPERS.itemTag(aItem,'metronomeItem')){var count=Math.min(Math.max(num(o.metronomeUseCount,1),1),6);var rate=R.roundHalfUp(4096*(1+0.2*(count-1)));rateApply(state,'メトロノーム '+count+'回',rate,logs);}
    if(aI&&window.DAMEKE_DATA_HELPERS.itemTag(aItem,'lifeOrb'))rateApply(state,'いのちのたま',5324,logs);
    if(dI&&window.DAMEKE_DATA_HELPERS.itemTag(dItem,'resistBerry')&&(hitOrdinal==null||hitOrdinal===1)){if((dItem.name==='ホズのみ'&&type==='ノーマル')||(dItem.name!=='ホズのみ'&&dItem.type===type&&typeRate>4096)){var ripenActive=dA&&dAb.name==='じゅくせい';rateApply(state,dItem.name+(ripenActive?'+じゅくせい':''),ripenActive?1024:2048,logs);
      // 半減実は発動と同時に消費される(手持ちのダメージ計算のロール幅に関わらず、技のタイプが
      // 一致していれば必ず発動・消費が確定する)ので、技①→技②の連結時に技②側で「持ち物なし」
      // として扱えるようフラグを公開しておく。
      result.resistBerryConsumed = true; result.resistBerryConsumedName = dItem.name;
    }}
    if(['じしん','マグニチュード'].includes(n)&&o.defenderSemiInvulnerable==='あなをほる')rateApply(state,'倍ダメージ あなをほる',8192,logs);
    if(n==='なみのり'&&o.defenderSemiInvulnerable==='ダイビング')rateApply(state,'倍ダメージ ダイビング',8192,logs);
    if(window.DAMEKE_DATA_HELPERS.moveTagByName(n,'minimizeDouble')&&o.defenderMinimized&&o.defenderSpecialState!=='dynamax'&&o.defenderSpecialState!=='gmax')rateApply(state,'倍ダメージ ちいさくなる',8192,logs);
    var dMaxLine=(result.trace||[]).find(x=>String(x.label).includes('ダイマックス（防御側）')||String(x.label).includes('Z・ダイマックス（防御側）'));var dMax=!!(dMaxLine&&String(dMaxLine.value).includes('有効'));if(window.DAMEKE_DATA_HELPERS.moveTagByName(n,'doubleVsDynamax')&&dMax)rateApply(state,'倍ダメージ 対ダイマックス',8192,logs);
    return {rate:state.rate,logs:logs.length?logs:['なし']};}
  var protectInfo = window.DAMEKE_CALC_SHARED.protectInfo;
  // ばけのかわ/アイスフェイスは「1回きり」の効果だが、1回のcalculateDamage呼び出しの中では
  // hitOrdinal===1でのみ適用されるだけで、それが実際に発動したかどうかは呼び出し元に伝わらない
  // ままだった。技①→技②の連結(calculateCombinedSequence)や、1つの技の連続ヒット2回目以降の
  // 計算で「既に消費済み」と正しく認識できるよう、発動したかどうかをresultへフラグとして残す。
  // ・ばけのかわ: o.__forceNoDisguiseOverrideが立っていれば(技①で既に消費済みの分岐)、
  //   このクランプ自体を適用しない(連続技2回目以降と同じ「無補正」扱い)。
  // ・アイスフェイス: フォルムそのものが変わる(コオリッポ(ナイスフェイス)は種族値も別)ため、
  //   ここでは発動フラグを立てるだけにとどめ、実際の「以降のダメージをナイスフェイス基準で
  //   再計算する」処理は、この関数の外側(連続ヒットのordループ側、および技②の分岐生成側)で行う。
  function postHitDamageAdjustment(result,input,o,hitOrdinal,damage,logs){if(hitOrdinal!==1)return damage;var dAb=by(D.abilities,o.defenderAbilityId||'なし'),dItem=by(D.items,o.defenderItemId||'none');var dA=activeAbility('D',dAb,o,result),dI=activeItem('D',dItem,o,result);var hp=currentHp(result);var n=moveName(result,input),cat=moveCat(result,input);if(dA&&dAb.name==='ばけのかわ'&&!o.__forceNoDisguiseOverride){var disguise=Math.floor(hp.max/8);logs.push('ばけのかわ: 1回目 '+damage+' -> '+disguise);result.disguiseTriggered=true;return disguise;}if(input.defender&&input.defender.name==='コオリッポ(アイスフェイス)'&&dA&&dAb.name==='アイスフェイス'&&cat==='物理'){logs.push('アイスフェイス: 1回目 '+damage+' -> 0');result.iceFaceTriggered=true;return 0;}var holdBack=(n==='てかげん'||n==='みねうち');var sturdy=(dA&&dAb.name==='がんじょう'&&hp.cur===hp.max);var sash=(dI&&(dItem.name==='きあいのタスキ'||window.DAMEKE_DATA_HELPERS.itemTag(dItem,'focusSash'))&&hp.cur===hp.max);if((holdBack||sturdy||sash)&&damage>=hp.max){var adjusted=Math.max(0,hp.max-1);logs.push((holdBack?n:(sturdy?'がんじょう':'きあいのタスキ'))+': 1回目 '+damage+' -> '+adjusted);return adjusted;}return damage;}
  // アイスフェイス発動時、2ヒット目以降(連続技の中での再計算)に使う「コオリッポ(ナイスフェイス)
  // 基準の防御側実数値」を求める。フォルムが変わると種族値(特にB/D/S)も変わるため、単純に
  // 元の防御側実数値を使い回すのではなく、防御側をナイスフェイス個体に差し替えて改めて
  // calculateDamageを1回走らせ、そこから補正後防御側実数値・タイプ相性を取り直す。
  function computeNoiceFaceStat(input, o){
    var H = window.DAMEKE_DATA_HELPERS;
    var noice = H && H.findFormByAbility ? H.findFormByAbility(input.defender, 'ナイスフェイス') : null;
    if(!noice) return null;
    var swappedOptions = Object.assign({}, o, { defenderAbilityId: (noice.abilities && noice.abilities[0]) || 'ナイスフェイス' });
    var swappedInput = { attacker: input.attacker, defender: noice, move: input.move, attackerLevel: input.attackerLevel, defenderLevel: input.defenderLevel, options: swappedOptions };
    try{
      var r2 = C.calculateDamage(swappedInput);
      var def2 = parseAfterArrow(r2, '補正後防御側実数値');
      if(!def2) return null;
      return { defender: noice, defenderAbilityId: swappedOptions.defenderAbilityId, def: def2, typeRate4096: (r2.typeRate4096 != null ? r2.typeRate4096 : null) };
    }catch(e){ return null; }
  }
  function calcOne(level,power,atk,def,rnd,rates,parentalRate){var a=Math.floor(level*2/5)+2,b=Math.floor(a*power*atk/def),d=Math.floor(b/50)+2;d=R.apply4096FiveDown(d,rates.range);d=R.apply4096FiveDown(d,parentalRate);d=R.apply4096FiveDown(d,rates.weather);d=R.apply4096FiveDown(d,rates.glaiveRush);d=R.apply4096FiveDown(d,rates.critical);d=Math.floor(d*rnd/100);d=R.apply4096FiveDown(d,rates.stab);d=R.apply4096Floor(d,rates.type);d=R.apply4096FiveDown(d,rates.burn);d=R.apply4096FiveDown(d,rates.other);d=R.apply4096FiveDown(d,rates.protect);return d<1?1:d;}
  function setTrace(result,label,name,value,note){var line=(result.trace||[]).find(x=>String(x.label).includes(label));if(line){line.name=name;line.value=value;if(note!=null)line.note=note;}else result.trace.push({label:label,name:name,value:value,note:note||'',implemented:true});}
  var prev=C.calculateDamage.bind(C);
  C.calculateDamage=function(input){var result=prev(input);if(result&&result.__coreState)(input.options||(input.options={})).__coreState=result.__coreState;var o=input.options||{},powers=[],line=(result.trace||[]).find(x=>String(x.label).includes('変動後威力'));if(line){var re=/(\d+)回目=(\d+)/g,m;while((m=re.exec(String(line.value))))powers.push(num(m[2],0));}if(!powers.length&&result.hitPlan)powers=result.hitPlan.map(h=>h.basePower||input.move.power||1);if(!powers.length)powers=[input.move.power||1];var atk=parseAfterArrow(result,'補正後攻撃側実数値'),def=parseAfterArrow(result,'補正後防御側実数値'),level=Math.min(Math.max(num(input.attackerLevel,50),1),100);var baseLine=(result.trace||[]).find(x=>String(x.label).includes('ダメージ補正値'));var range=(String(baseLine&&baseLine.value).match(/範囲=(\d+)/)||[])[1]||4096,weather=(String(baseLine&&baseLine.value).match(/天候=(\d+)/)||[])[1]||4096,glaive=(String(baseLine&&baseLine.value).match(/きょけんとつげき=(\d+)/)||[])[1]||4096,crit=(String(baseLine&&baseLine.value).match(/急所=(\d+)/)||[])[1]||4096,stab=(String(baseLine&&baseLine.value).match(/STAB=(\d+)/)||[])[1]||result.stabRate4096||4096,type=result.typeRate4096||4096;var invalidLine=(result.trace||[]).find(function(x){return String(x.label).includes('無効要素');});if(String(invalidLine&&invalidLine.value||'').includes('天候により無効'))weather=0;var burn=burnRate(result,input,o),other=otherModifier(result,input,o,1),protect=protectInfo(result,input,o);var rates={range:+range,weather:+weather,glaiveRush:+glaive,critical:+crit,stab:+stab,type:+type,burn:burn.rate,other:other.rate,protect:protect.rate};var typeRateForZero=(result.typeRate4096==null?4096:result.typeRate4096);var zero=!atk||!def||protect.invalid||rates.weather===0||typeRateForZero===0||(moveCat(result,input)==='変化');
    // v0.82i 連続攻撃技の2ヒット目以降は、1ヒット目で消費・解除される状態依存効果
    // (マルチスケイル/ファントムガード・半減実等、HP満タン条件や一度きりの効果)を反映しない、
    // 2ヒット目以降専用の補正レートを別途用意する。ただしテラスシェルは例外で、1ヒット目の
    // 時点でHP満タンなら2ヒット目以降もそのまま適用され続けるため、typeはhit1と同じ値を使う
    // (typeRate4096に既に反映済み)。
    var otherRest=otherModifier(result,input,o,2);var ratesRest={range:+range,weather:+weather,glaiveRush:+glaive,critical:+crit,stab:+stab,type:+type,burn:burn.rate,other:otherRest.rate,protect:protect.rate};
  var priority=priorityInfo(result,input,o);
  result.priorityFinal=priority.value;
  setTrace(result,'N79 優先度','現在値',(priority.value>0?'+':'')+priority.value,priority.note);
  var accuracy=accuracyInfo(result,input,o);
  result.accuracyResult=accuracy.result;
  result.accuracyInvalidated=accuracy.invalidated;
  if(accuracy.result==='命中'){
    var accPct=accuracyPercentInfo(result,input,o);
    result.accuracyPercent=accPct.value;
    result.accuracyPercentNote=accPct.note;
  } else {
    result.accuracyPercent=null;
    result.accuracyPercentNote='';
  }
  setTrace(result,'N45 命中判定','現在値',accuracy.result,accuracy.reason||'なし');
  setTrace(result,'N45b 命中率','現在値',result.accuracyPercent!=null?result.accuracyPercent.toFixed(1)+'%':(accuracy.result==='必中'?'必中':'当たらない'),result.accuracyPercentNote||'');
  var additional=additionalInvalidChecks(result,input,o);
  var extraInvalidReason = accuracy.invalidated ? accuracy.reason : (additional.invalid ? additional.reason : null);
  zero = zero || accuracy.invalidated || additional.invalid;
  result.isInvalid = zero;
  if(zero){result.rolls=[0];result.rawRolls=[0];result.independentHitRolls=null;result.rawIndependentHitRolls=null;result.multiHitRolls=null;result.rawMultiHitRolls=null;result.minDamage=0;result.maxDamage=0;result.minRate=0;result.maxRate=0;var zeroReason=protect.invalid?protect.reason:(rates.weather===0?'天候により無効':(typeRateForZero===0?'タイプ相性により無効':(extraInvalidReason||'変化技または無効')));setTrace(result,'N66 ダメージ補正値','全補正','範囲='+rates.range+' / おやこあい=4096 / 天候='+rates.weather+' / きょけんとつげき='+rates.glaiveRush+' / 急所='+rates.critical+' / STAB='+rates.stab+' / 相性='+rates.type+' / やけど='+rates.burn+' / その他='+rates.other+' / まもる='+rates.protect,'v0.33 無効判定: '+zeroReason);setTrace(result,'N81 無効要素','現在値',zeroReason,'v0.33');setTrace(result,'N68 乱数','85から100','0','v0.33 最終式');return result;}var parentRates=(String(baseLine&&baseLine.value).includes('4096,1024'))?[4096,1024]:[4096];
  // Each sub-hit (each power entry, x2 for parental bond) rolls its own 85-100 independently
  // -- this is what real multi-hit moves do; sharing one rnd across all sub-hits (the old
  // approach) understates variance for multi-hit KO-probability math. rawHitRolls holds each
  // sub-hit's own 16 pre-adjustment values; adjHitRolls holds the same after
  // postHitDamageAdjustment (ばけのかわ/がんじょう/きあいのタスキ/てかげん/みねうち), which
  // only ever touches the very first hit. Likewise rates vs ratesRest: HP満タン条件の特性
  // (マルチスケイル/ファントムガード/テラスシェル)や一度きりの半減実は、1ヒット目(ord===1)
  // にしか適用しない(2ヒット目以降はHPが満タンでなくなる/きのみが消費済みのため)。
  var rawHitRolls=[],adjHitRolls=[],postLogs=[],ord=0;
  // アイスフェイス対策: 1ヒット目でアイスフェイスが発動(コオリッポ(ナイスフェイス)へ変化)した
  // 場合、2ヒット目以降は種族値(B/D/Sなど)が変わった状態で改めて防御側実数値を計算し直す
  // 必要がある。defForRest/typeRateForRestは、1ヒット目の結果が確定した直後に一度だけ
  // computeNoiceFaceStatで差し替え、以降のヒット(このi/jループの残り、および下の
  // rawHitRestRolls=連続技の複製展開用の生ロール)双方で使う。
  var defForRest=def, typeRateForRest=null, iceFaceRestHandled=false;
  for(var i=0;i<powers.length;i++){
    for(var j=0;j<parentRates.length;j++){
      ord++;
      var hitRates=(ord===1)?rates:(typeRateForRest!=null?Object.assign({},ratesRest,{type:typeRateForRest}):ratesRest);
      var curDef=(ord===1)?def:defForRest;
      var rawArr=[],adjArr=[];
      for(var rnd=85;rnd<=100;rnd++){
        var rawD=calcOne(level,powers[i],atk,curDef,rnd,hitRates,parentRates[j]);
        var d=postHitDamageAdjustment(result,input,o,ord,rawD,postLogs);
        rawArr.push(rawD);
        adjArr.push(d);
      }
      rawHitRolls.push(rawArr);
      adjHitRolls.push(adjArr);
      if(ord===1 && !iceFaceRestHandled){
        iceFaceRestHandled=true;
        if(result.iceFaceTriggered){
          var noiceStat=computeNoiceFaceStat(input,o);
          if(noiceStat){ defForRest=noiceStat.def; typeRateForRest=noiceStat.typeRate4096; }
        }
      }
    }
  }
  // v0.82i: 通常の(hitPlanが1件のまま扱われる)回数技は、この時点ではまだ1ヒット分しか
  // 計算されておらず、実際の複数ヒットへの展開は後段のv0.63パッチ(applyDataDrivenMultiHit)
  // が「1ヒット目の結果をそのままN回分複製」する形で行っている。そのままだと1ヒット目にしか
  // 適用されないはずの補正(マルチスケイル/ファントムガード/半減実/テラスシェル)が2ヒット目
  // 以降にも複製されてしまうため、ratesRestで計算した「2ヒット目以降用の生ロール」を別途
  // 公開し、後段パッチがそちらを使えるようにする(アイスフェイス発動時はdefForRest/
  // typeRateForRestで、ナイスフェイス基準に差し替えたレートを使う)。
  result.rawHitRestRolls=(function(){
    var arr=[], ratesForRest=(typeRateForRest!=null?Object.assign({},ratesRest,{type:typeRateForRest}):ratesRest);
    for(var rnd3=85;rnd3<=100;rnd3++)arr.push(calcOne(level,powers[0],atk,defForRest,rnd3,ratesForRest,parentRates[0]));
    return arr;
  })();
  if(postLogs.length)setTrace(result,'N69 最終ダメージ後補正','1回目',Array.from(new Set(postLogs)).join(' / '),'v0.81');
  // Combined per-roll-index totals (index k across all sub-hits pairs the same 16 rnd draws):
  // this keeps min/max correct (rnd=85 on every sub-hit gives the true minimum total, rnd=100
  // the true maximum) without needing all 16^N raw combinations here.
  var rolls=[],rawRolls=[];
  for(var k=0;k<16;k++){
    var tAdj=0,tRaw=0;
    for(var h=0;h<adjHitRolls.length;h++){ tAdj+=adjHitRolls[h][k]; tRaw+=rawHitRolls[h][k]; }
    rolls.push(tAdj); rawRolls.push(tRaw);
  }
  result.rolls=rolls;
  result.rawRolls=rawRolls;
  result.independentHitRolls=adjHitRolls.length>1?adjHitRolls:null;
  result.rawIndependentHitRolls=rawHitRolls.length>1?rawHitRolls:null;
  result.multiHitRolls=adjHitRolls.length>1?adjHitRolls.map(function(hr,idx){ return (idx+1)+'回目：'+hr.join(', '); }):null;
  result.rawMultiHitRolls=rawHitRolls.length>1?rawHitRolls.map(function(hr,idx){ return (idx+1)+'回目：'+hr.join(', '); }):null;
  result.minDamage=Math.min.apply(null,rolls);result.maxDamage=Math.max.apply(null,rolls);var hp=result.defenderMaxHp||1;result.minRate=hp?result.minDamage/hp*100:0;result.maxRate=hp?result.maxDamage/hp*100:0;setTrace(result,'N66 ダメージ補正値','全補正','範囲='+rates.range+' / おやこあい='+(parentRates.length>1?'4096,1024':'4096')+' / 天候='+rates.weather+' / きょけんとつげき='+rates.glaiveRush+' / 急所='+rates.critical+' / STAB='+rates.stab+' / 相性='+rates.type+' / やけど='+rates.burn+' / その他='+rates.other+' / まもる='+rates.protect,'やけど: '+burn.reason+' / その他: '+other.logs.join(' / ')+' / まもる: '+protect.reason+' / 天候: '+weather.reason+' / 参照: '+(weather.source||'防御側天候')+' / 攻撃側天候='+(weather.attackerWeather||'なし')+' / 防御側天候='+(weather.defenderWeather||weather.weather||'なし'));setTrace(result,'N68 乱数','85から100',rolls.join(', '),'v0.33 最終式');return result;};
  C.__finalDamageCorePatchedV33=true;
})();


// v0.34 fixed damage moves and Parental Bond handling for fixed damage
(function(){
  var D = window.DAMEKE_DATA;
  var C = window.DAMEKE_CALC;
  var R = window.DAMEKE_ROUNDING;
  if(!D || !C || !C.calculateDamage || !R || C.__fixedDamagePatchedV34) return;
  var num = window.DAMEKE_CALC_SHARED.num;
  function by(list,id){return (list||[]).find(function(x){return x.id===id;}) || (list||[])[0] || {};}
  var activeAbility = window.DAMEKE_CALC_SHARED.activeAbilityCoreOnly;
  function hpLine(result,side){var label=side==='A'?'攻撃側ランク補正込み実数値':'防御側ランク補正込み実数値';var line=(result.trace||[]).find(function(x){return String(x.label).includes(label);});var m=line&&String(line.value||'').match(/(\d+)\/(\d+)/);return m?{cur:num(m[1],1),max:num(m[2],1)}:{cur:1,max:1};}
  var moveName = window.DAMEKE_CALC_SHARED.moveName;
  function fixedKind(result,input){var n=moveName(result,input);return window.DAMEKE_DATA_HELPERS.fixedDamageKindByName(n)||(n===input.move.name?window.DAMEKE_DATA_HELPERS.fixedDamageKind(input.move):null);}
  function fixedBaseDamage(kind,result,input,o){var aHp=hpLine(result,'A'),dHp=hpLine(result,'D');var level=Math.min(Math.max(num(input.attackerLevel,50),1),100);var taken=Math.max(0,num(o.fixedDamageTaken,0));
    // Moves that read the defender's HP (halfHp/endeavor/guardian -- not ohko, which always fully
    // KOs regardless) see that HP halved (floored) on both cur and max while the defender is
    // Dynamax/Gigantamax, per the same rule real games apply to these specific moves.
    var dynDefender = o.defenderSpecialState==='dynamax' || o.defenderSpecialState==='gmax';
    var dHpForRef = dHp;
    if(dynDefender && (kind==='halfHp'||kind==='endeavor'||kind==='guardian')){
      dHpForRef = { cur: Math.floor(dHp.cur/2), max: Math.floor(dHp.max/2) };
    }
    if(kind==='sonicBoom')return 20;
    if(kind==='dragonRage')return 40;
    if(kind==='level')return level;
    if(kind==='psywave'){var mult=Math.min(Math.max(Number(o.psywaveMultiplier||1),0.5),1.5);return Math.max(1,Math.floor(level*mult));}
    if(kind==='halfHp')return Math.max(1,Math.floor(dHpForRef.cur*0.5));
    if(kind==='endeavor')return Math.max(0,dHpForRef.cur-aHp.cur);
    if(kind==='counter')return taken*2;
    if(kind==='metalBurst')return Math.floor(taken*1.5);
    if(kind==='finalGambit')return aHp.cur;
    if(kind==='ohko')return dHp.cur;
    if(kind==='guardian')return Math.max(1,Math.floor(dHpForRef.cur*0.75));
    return null;
  }
  var protectedPierceMove = window.DAMEKE_CALC_SHARED.protectedPierceMove;
  var contactActive = window.DAMEKE_CALC_SHARED.contactActive;
  var isZOrMax = window.DAMEKE_CALC_SHARED.isZOrMax;
  var protectInfo = window.DAMEKE_CALC_SHARED.protectInfo;
  function setTrace(result,label,name,value,note){var line=(result.trace||[]).find(function(x){return String(x.label).includes(label);});if(line){line.name=name;line.value=value;if(note!=null)line.note=note;}else result.trace.push({label:label,name:name,value:value,note:note||'',implemented:true});}
  var prev=C.calculateDamage.bind(C);
  C.calculateDamage=function(input){var result=prev(input);if(result&&result.__coreState)(input.options||(input.options={})).__coreState=result.__coreState;var o=input.options||{};var kind=fixedKind(result,input);if(!kind)return result;var base=fixedBaseDamage(kind,result,input,o);if(base==null)return result;var typeRate=result.typeRate4096==null?4096:result.typeRate4096;var protect=protectInfo(result,input,o);var out=base;var invalid='なし';
    if(typeRate===0){out=0;invalid='タイプ相性により無効';}
    else if(protect.rate===0||protect.invalid){out=0;invalid=protect.reason;}
    else if(kind==='guardian'&&protect.rate===1024){out=R.apply4096FiveDown(base,1024);}
    var aAb=by(D.abilities,o.attackerAbilityId||'なし');var parental=activeAbility('A',aAb,o,result)&&aAb.name==='おやこあい';var hits=parental?2:1;result.rolls=[out];result.rawRolls=[out];result.independentHitRolls=parental?[[out],[out]]:[[out]];result.rawIndependentHitRolls=result.independentHitRolls;result.multiHitRolls=parental?['1回目：'+out,'2回目：'+out]:null;result.rawMultiHitRolls=result.multiHitRolls;result.minDamage=out*hits;result.maxDamage=out*hits;var hp=result.defenderMaxHp||hpLine(result,'D').max||1;result.minRate=hp?result.minDamage/hp*100:0;result.maxRate=hp?result.maxDamage/hp*100:0;result.hitPlan=parental?[{hitIndex:1,fixedDamage:out,note:'おやこあい固定ダメージ1回目'},{hitIndex:2,fixedDamage:out,note:'おやこあい固定ダメージ2回目'}]:[{hitIndex:1,fixedDamage:out,note:'固定ダメージ'}];setTrace(result,'N46 変動後威力','固定ダメージ',base,'固定ダメージ技のため通常ダメージ計算なし');setTrace(result,'N66 ダメージ補正値','固定ダメージ','相性='+typeRate+' / まもる='+protect.rate,'固定ダメージは相性補正とまもる補正のみ確認。'+(kind==='guardian'&&protect.rate===1024?'ガーディアン・デ・アローラのみ1024を適用。':'')+' / '+protect.reason);setTrace(result,'N68 乱数','固定ダメージ',parental?(out+' + '+out+' = '+(out*2)):String(out),parental?'おやこあいにより同一固定ダメージを2回':'固定ダメージ');setTrace(result,'N81 無効要素','現在値',invalid,'v0.34 固定ダメージ');return result;};
  C.__fixedDamagePatchedV34=true;
})();


// v0.36 canonical data access helpers
(function(){
  if(window.DAMEKE_DATA_HELPERS && window.DAMEKE_DATA_HELPERS.__v36) return;
  var H = window.DAMEKE_DATA_HELPERS = window.DAMEKE_DATA_HELPERS || {};
  function arr(v){ return Array.isArray(v) ? v : (v ? [v] : []); }
  function hasTag(obj, tag){ return arr(obj && obj.tags).includes(tag); }
  function hasEffectTag(obj, tag){ return arr(obj && obj.effectTags).includes(tag); }
  function moveTag(move, tag){ return hasTag(move, tag); }
  function abilityTag(ability, tag){ return hasEffectTag(ability, tag); }
  function itemTag(item, tag){ return hasEffectTag(item, tag); }
  function moveTarget(move){ return (move && (move.target || move.range || move.scope || move.targetType || move.originalTarget)) || '1体選択'; }
  function fixedDamageKind(move){ return move && (move.fixedDamageKind || (move.fixedDamage ? move.damageKind : null)) || null; }
  function moveHitCount(move){
    if(!move) return {min:1,max:1};
    if(move.hitCountMin != null || move.hitCountMax != null) return {min:move.hitCountMin || move.hitCountMax || 1, max:move.hitCountMax || move.hitCountMin || 1};
    if(move.hitCount != null) return {min:move.hitCount,max:move.hitCount};
    return {min:1,max:1};
  }
  function schemaReport(){
    var D = window.DAMEKE_DATA;
    return D && D.schemaReport ? D.schemaReport() : null;
  }
  H.moveTag = H.moveTag || moveTag;
  H.abilityTag = H.abilityTag || abilityTag;
  H.itemTag = H.itemTag || itemTag;
  H.moveTarget = H.moveTarget || moveTarget;
  H.fixedDamageKind = H.fixedDamageKind || fixedDamageKind;
  H.moveHitCount = H.moveHitCount || moveHitCount;
  H.schemaReport = H.schemaReport || schemaReport;
  H.__v36 = true;
})();


// v0.37-v0.41 canonical data access helpers
(function(){
  if(window.DAMEKE_DATA_HELPERS && window.DAMEKE_DATA_HELPERS.__v037041) return;
  var H = window.DAMEKE_DATA_HELPERS = window.DAMEKE_DATA_HELPERS || {};
  function arr(v){ return Array.isArray(v) ? v : (v ? [v] : []); }
  function hasTag(obj, tag){ return arr(obj && obj.tags).includes(tag); }
  function hasEffectTag(obj, tag){ return arr(obj && obj.effectTags).includes(tag); }
  function moveTag(move, tag){ return hasTag(move, tag); }
  function abilityTag(ability, tag){ return hasEffectTag(ability, tag); }
  function itemTag(item, tag){ return hasEffectTag(item, tag); }
  function moveTarget(move){ return (move && move.target) || '1体選択'; }
  function fixedDamageKind(move){ return move && move.fixedDamageKind || null; }
  function moveHitCount(move){ if(!move) return {min:1,max:1}; return {min:move.hitCountMin || move.hitCount || 1, max:move.hitCountMax || move.hitCount || 1}; }
  function schemaReport(){ var D = window.DAMEKE_DATA; return D && D.schemaReport ? D.schemaReport() : null; }
  H.moveTag = H.moveTag || moveTag;
  H.abilityTag = H.abilityTag || abilityTag;
  H.itemTag = H.itemTag || itemTag;
  H.moveTarget = H.moveTarget || moveTarget;
  H.fixedDamageKind = H.fixedDamageKind || fixedDamageKind;
  H.moveHitCount = H.moveHitCount || moveHitCount;
  H.schemaReport = H.schemaReport || schemaReport;
  H.__v037041 = true;
})();


// v0.42 move tag helper extensions
(function(){
  var D = window.DAMEKE_DATA;
  var H = window.DAMEKE_DATA_HELPERS = window.DAMEKE_DATA_HELPERS || {};
  if(H.__v42MoveTagExtensions) return;
  function arr(v){ return Array.isArray(v) ? v : (v ? [v] : []); }
  function byMoveName(name){ return (D && D.moves || []).find(function(m){return m.name === name || m.id === name;}) || (D && D.enhancedMoveInternalRefs || []).find(function(m){return m.name === name || m.id === name;}) || null; }
  function moveTag(obj, tag){ return arr(obj && obj.tags).includes(tag); }
  function moveTagByName(name, tag){ return moveTag(byMoveName(name), tag); }
  function moveTagForEffective(inputMove, effectiveName, tag){
    if(effectiveName && inputMove && effectiveName === inputMove.name) return moveTag(inputMove, tag) || moveTagByName(effectiveName, tag);
    return moveTagByName(effectiveName, tag);
  }
  var EXCLUDED_SIGNATURE_Z_FIXED_DAMAGE_KIND = { 'ガーディアン・デ・アローラ': 'guardian' };
  function fixedDamageKindByName(name){ var m = byMoveName(name); if(m) return (m.fixedDamageKind || (m.fixedDamage ? m.damageKind : null)) || null; return EXCLUDED_SIGNATURE_Z_FIXED_DAMAGE_KIND[name] || null; }
  H.byMoveName = byMoveName;
  H.moveTag = H.moveTag || moveTag;
  H.moveTagByName = moveTagByName;
  H.moveTagForEffective = moveTagForEffective;
  H.fixedDamageKindByName = fixedDamageKindByName;
  H.__v42MoveTagExtensions = true;
})();


// v0.44-v0.47 canonical species / Z / item / ability helpers
(function(){
  var root = typeof window !== 'undefined' ? window : globalThis;
  var H = root.DAMEKE_DATA_HELPERS = root.DAMEKE_DATA_HELPERS || {};
  if(H.__v044047) return;
  function arr(v){ return Array.isArray(v) ? v : (v ? [v] : []); }
  function uniq(arr0){ return Array.from(new Set((arr0 || []).filter(Boolean))); }
  function pokemonKeys(p){
    if(!p) return [];
    return uniq([p.id,p.name,p.speciesKey,p.formKey,p.baseSpecies].concat(arr(p.aliases)));
  }
  function pokemonMatches(p, keys){
    var set = new Set(arr(keys));
    return pokemonKeys(p).some(function(k){ return set.has(k); });
  }
  function itemTargetsPokemon(item,p){
    if(!item) return false;
    var keys = [].concat(arr(item.targetSpeciesKeys), arr(item.targetSpecies), arr(item.targetSpeciesGroup));
    if(!keys.length) return false;
    return pokemonMatches(p, keys);
  }
  function abilityTag(ability, tag){
    return arr(ability && ability.effectTags).includes(tag);
  }
  function canDynamaxPokemon(p){
    var D = root.DAMEKE_DATA || {};
    var z = D.zMax || {};
    if(p && p.cannotDynamax) return false;
    if(pokemonMatches(p, z.dynamaxBannedKeys || z.dynamaxBanned || [])) return false;
    return true;
  }
  function specialZRuleFor(p, move){
    var D = root.DAMEKE_DATA || {};
    var z = D.zMax || {};
    var rules = z.signatureZRules || z.signatureZ || [];
    // 専用Zの対象は、例外なくポケモン名の完全一致で判定する(フォルム違い・種族キー等では
    // 照合しない。例: 「ピカチュウ」のルールはピカチュウ(サトシ)には当てはまらない)。
    // ルガルガンのように複数フォルムが対象の場合は、データ側で各フォルム名を列挙する。
    function ruleTargets(r){
      if(!p) return false;
      var list = [].concat(arr(r.pokemon), arr(r.pokemonKeys));
      return list.indexOf(p.name) >= 0;
    }
    return rules.find(function(r){ return r.move === move.name && ruleTargets(r); }) || null;
  }
  function gmaxNameFor(p,type){
    var D = root.DAMEKE_DATA || {};
    var z = D.zMax || {};
    var maps = z.gmaxByKeyType || z.gmaxByPokemonType || {};
    var keys = pokemonKeys(p);
    for(var i=0;i<keys.length;i++){
      var m = maps[keys[i]];
      if(m && m[type]) return m[type];
    }
    return null;
  }
  function isGmaxEligible(p){
    var D = root.DAMEKE_DATA || {};
    var z = D.zMax || {};
    return pokemonMatches(p, z.gmaxEligibleKeys || z.gmaxEligible || []);
  }
  H.pokemonKeys = pokemonKeys;
  H.pokemonMatches = pokemonMatches;
  H.itemTargetsPokemon = itemTargetsPokemon;
  H.canDynamaxPokemon = canDynamaxPokemon;
  H.specialZRuleFor = specialZRuleFor;
  H.gmaxNameFor = gmaxNameFor;
  H.isGmaxEligible = isGmaxEligible;
  H.abilityTag = H.abilityTag || abilityTag;
  H.__v044047 = true;
})();

// v0.81b restore formMoveType helper after later helper-object overwrites
(function(){
  var root = typeof window !== 'undefined' ? window : this;
  var H = root.DAMEKE_DATA_HELPERS = root.DAMEKE_DATA_HELPERS || {};
  if(H.__v081bFormMoveTypeRestore) return;
  function arr(v){ return Array.isArray(v) ? v : (v ? [v] : []); }
  function uniq(a){ var out=[]; (a||[]).forEach(function(x){ if(x && out.indexOf(x)<0) out.push(x); }); return out; }
  function pokemonKeys(p){
    if(H.pokemonKeys) return H.pokemonKeys(p);
    if(!p) return [];
    return uniq([p.id,p.name,p.speciesKey,p.formKey,p.baseSpecies].concat(arr(p.aliases)));
  }
  function pokemonMatches(p, keys){
    if(H.pokemonMatches) return H.pokemonMatches(p, keys);
    var set = new Set(arr(keys));
    return pokemonKeys(p).some(function(k){ return set.has(k); });
  }
  function formMoveType(moveName, pokemon, def){
    var D = root.DAMEKE_DATA || {};
    var map = D.formMoveType && D.formMoveType[moveName];
    if(map){
      var keys = pokemonKeys(pokemon);
      for(var i=0;i<keys.length;i++) if(map[keys[i]]) return map[keys[i]];
      if(map.default) return map.default;
    }
    // Fallbacks for known form-dependent moves. These keep the calculator stable even if a generated map is absent.
    if(moveName === 'ツタこんぼう'){
      if(pokemonMatches(pokemon, ['オーガポン(いど)','ogerpon_wellspring'])) return 'みず';
      if(pokemonMatches(pokemon, ['オーガポン(かまど)','ogerpon_hearthflame'])) return 'ほのお';
      if(pokemonMatches(pokemon, ['オーガポン(いしずえ)','ogerpon_cornerstone'])) return 'いわ';
      return 'くさ';
    }
    if(moveName === 'レイジングブル'){
      if(pokemonMatches(pokemon, ['ケンタロス(パルデア・コンバット)','ケンタロス(パルデア・単)', 'tauros_paldea_combat'])) return 'かくとう';
      if(pokemonMatches(pokemon, ['ケンタロス(パルデア・ブレイズ)','tauros_paldea_blaze'])) return 'ほのお';
      if(pokemonMatches(pokemon, ['ケンタロス(パルデア・ウォーター)','tauros_paldea_aqua'])) return 'みず';
      return def || 'ノーマル';
    }
    if(moveName === 'オーラぐるま'){
      if(pokemonMatches(pokemon, ['モルペコ(はらぺこもよう)','morpeko_hangry'])) return 'あく';
      return 'でんき';
    }
    return def;
  }
  H.formMoveType = formMoveType;
  H.__v081bFormMoveTypeRestore = true;
})();


/* DAMEKE v0.97 integrated runtime fix v063 BEGIN */
// v0.63 runtime calculation fix: final type-0 propagation and data-driven multi-hit display
(function(){
  var root = (typeof window !== 'undefined') ? window : globalThis;
  var C = root.DAMEKE_CALC;
  var D = root.DAMEKE_DATA;
  if(!C || !C.calculateDamage || C.__v063TypeZeroMultiHitFixed) return;

  function arr(x){ return Array.isArray(x) ? x : []; }
  var num = window.DAMEKE_CALC_SHARED.num;
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
    var re = /(\d+)回目=(\d+)/g;
    var m;
    while((m = re.exec(text))) out.push(num(m[2], fallbackPower || 1));
    if(out.length) return out;
    if(arr(result.hitPlan).length) return arr(result.hitPlan).map(function(h){ return num(h.basePower, fallbackPower || 1); });
    return [num(fallbackPower, 1)];
  }
  function applyDataDrivenMultiHit(result, input){
    var move = result.effectiveMove || (input && input.move);
    if(move && (move.isZMove || move.isSignatureZ || move.isMaxMove)) return;
    // powerKindを持つ技(BeatUp/TripleAxel/TripleKick/WaterShuriken等)は、それぞれ専用の
    // パッチで既にヒット数・威力を確定させている(ふくろだたきは控えの入力数に応じて動的に
    // 1～6ヒットになるが、move.hitCountMin/Maxは常に6/6の固定値のため、ここでのデータ駆動
    // フォールバックに任せると常に6ヒット扱いになってしまう)。ここでの静的なhitCountMin/Max
    // 参照はpowerKindを持たない通常の回数技専用とし、powerKindがある場合は触らない。
    if(move && move.powerKind) return;
    var spec = getHitSpec(move);
    if(!spec) return;
    if(result.typeRate4096 === 0) return;
    if((result.effectiveCategory || move.category) === '変化') return;
    if(arr(result.multiHitRolls).length > 0) return;
    if(arr(result.hitPlan).length > 1) return;
    if(!arr(result.rolls).length) return;

    var singleRolls = arr(result.rolls).map(function(x){ return num(x, 0); });
    var rawSingleRolls = arr(result.rawRolls).length ? arr(result.rawRolls).map(function(x){ return num(x, 0); }) : singleRolls;
    var basePower = parsePowersFromTrace(result, move.power)[0] || move.power || 1;
    var countForSummary = spec.max;
    var hitPlan = [];
    for(var i=1; i<=countForSummary; i++) hitPlan.push({ hitIndex:i, basePower:basePower, note: spec.fixed ? '固定' + countForSummary + '回' : spec.min + '-' + spec.max + '回技の最大回数表示' });

    result.hitPlan = hitPlan;
    // Any final-damage adjustment (ばけのかわ/がんじょう/きあいのタスキ etc, baked into singleRolls
    // via the earlier single-hit layer) applies to the FIRST hit only -- hits 2+ must use the raw,
    // unadjusted per-hit value, not a copy of the adjusted one. Likewise, hit-1-only conditional
    // modifiers (マルチスケイル/ファントムガード/半減実/テラスシェル, HP満タン条件や一度きりの
    // 効果) must not be copied onto hits 2+: rawHitRestRolls (computed by the v0.82i patch above,
    // using ratesRest which omits those hit-1-only effects) is used for hits 2+ when available.
    var restRolls = arr(result.rawHitRestRolls).length ? arr(result.rawHitRestRolls).map(function(x){ return num(x, 0); }) : rawSingleRolls;
    result.independentHitRolls = [];
    result.rawIndependentHitRolls = [];
    for(var ci=0; ci<countForSummary; ci++){
      result.independentHitRolls.push((ci===0 ? singleRolls : restRolls).slice());
      result.rawIndependentHitRolls.push((ci===0 ? rawSingleRolls : restRolls).slice());
    }
    var totalRolls = [];
    for(var ri=0; ri<16; ri++){
      var sum=0; for(var hi=0; hi<countForSummary; hi++) sum += result.independentHitRolls[hi][ri];
      totalRolls.push(sum);
    }
    var rawTotalRolls = [];
    for(var ri2=0; ri2<16; ri2++){
      var sum2=0; for(var hi2=0; hi2<countForSummary; hi2++) sum2 += result.rawIndependentHitRolls[hi2][ri2];
      rawTotalRolls.push(sum2);
    }
    result.rolls = totalRolls;
    result.rawRolls = rawTotalRolls;
    result.multiHitRolls = result.independentHitRolls.map(function(hr, idx){
      return (idx+1) + '回目：' + hr.join(', ');
    });
    result.rawMultiHitRolls = result.rawIndependentHitRolls.map(function(hr, idx){
      return (idx+1) + '回目：' + hr.join(', ');
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

/* DAMEKE v0.97 integrated runtime fix v063 END */

(function(){
  var C = window.DAMEKE_CALC || {};
  C.v097CalcRuntimeIntegrationReport = function(){
    var scripts = Array.prototype.slice.call(document.querySelectorAll('script[src]')).map(function(s){ return String(s.getAttribute('src') || '').replace(/\\/g, '/'); });
    return {
      version: 'v0.97',
      loaded: true,
      runtimeIntegratedIntoCalc: true,
      runtimeScriptLoaded: scripts.indexOf('runtime/calc.runtime.fix.v063.js') >= 0,
      canProceedToV098: scripts.indexOf('runtime/calc.runtime.fix.v063.js') < 0
    };
  };
  window.DAMEKE_CALC = C;
})();

/* v2.5.1 ヒットごとの乱数の差し替え(内部用: options.__hitRollsOverride = [{rolls, raw}, ...])。
   技の途中で100%発生する効果(くだけるよろい・溜めターンの上昇など)を反映したヒットごとのダメージを、
   確定数・ダメージ範囲・みがわり等の後続の処理にそのまま流すために使う(C.calculateDamageWithEffects)。 */
(function(){
  var C = window.DAMEKE_CALC;
  var prev = C.calculateDamage;
  C.calculateDamage = function(input){
    var result = prev(input);
    var ov = input && input.options && input.options.__hitRollsOverride;
    if(!result || !ov || !ov.length) return result;
    var hp = result.defenderMaxHp || 1;
    if(ov.length === 1){
      result.rolls = ov[0].rolls.slice(); result.rawRolls = ov[0].raw.slice();
    } else {
      result.independentHitRolls = ov.map(function(h){ return h.rolls.slice(); });
      result.rawIndependentHitRolls = ov.map(function(h){ return h.raw.slice(); });
      var tot = [], rawTot = [];
      for(var i=0;i<16;i++){
        var a = 0, b = 0;
        ov.forEach(function(h){ a += (h.rolls[i] != null ? h.rolls[i] : h.rolls[h.rolls.length-1]); b += (h.raw[i] != null ? h.raw[i] : h.raw[h.raw.length-1]); });
        tot.push(a); rawTot.push(b);
      }
      result.rolls = tot; result.rawRolls = rawTot;
      result.multiHitRolls = result.independentHitRolls.map(function(r, idx){ return (idx+1)+'回目：'+r.join(', '); });
      result.rawMultiHitRolls = result.rawIndependentHitRolls.map(function(r, idx){ return (idx+1)+'回目：'+r.join(', '); });
    }
    result.minDamage = Math.min.apply(null, result.rolls);
    result.maxDamage = Math.max.apply(null, result.rolls);
    result.minRate = result.minDamage / hp * 100;
    result.maxRate = result.maxDamage / hp * 100;
    result.__effectsAdjusted = true;
    return result;
  };
})();

/* v0.98 exact KO-count probability (independent per-hit rolls, DP convolution) */
(function(){
  var C = window.DAMEKE_CALC || {};
  var num = window.DAMEKE_CALC_SHARED.num;
  var parseAfterArrow = window.DAMEKE_CALC_SHARED.parseAfterArrow;
  function distFromRolls(rolls){
    var out=Object.create(null),p=1/rolls.length;
    for(var i=0;i<rolls.length;i++){ var d=rolls[i]; out[d]=(out[d]||0)+p; }
    return out;
  }
  function convolve(a,b){
    var out=Object.create(null);
    for(var da in a){ var pa=a[da]; for(var db in b){ var s=Number(da)+Number(db); out[s]=(out[s]||0)+pa*b[db]; } }
    return out;
  }
  function probAtLeast(dist,threshold){
    var p=0; for(var d in dist){ if(Number(d)>=threshold) p+=dist[d]; } return p;
  }

  var MAX_TURNS = 200;             // see chat: raised from 30 after benchmarking convolution cost

  function computeExactKoInfo(result, input){
    // Deliberately does NOT re-derive damage from scratch (no re-parsing atk/def/rates
    // and no re-running the formula). That approach missed ability/condition modifiers
    // that don't flow through the specific trace fields it was watching (e.g. そうだいしょう,
    // アナライズ), causing koInfo to silently disappear or mismatch. Instead this uses
    // result.independentHitRolls (each sub-hit's own independently-rolled 16 values,
    // post-adjustment) when available -- the same authoritative data the "乱数" display
    // and result.rolls come from -- falling back to result.rolls for single-hit moves.
    result.koInfo = null;
    if(!result) return;
    var cat = result.effectiveCategory || (input.move && input.move.category);
    if(cat === '変化') return;
    if(result.typeRate4096 === 0) return;
    var hp = result.defenderCurrentHp;
    if(!hp || hp <= 0) return;

    var turnDist;
    if(result.independentHitRolls && result.independentHitRolls.length){
      turnDist = null;
      for(var h=0; h<result.independentHitRolls.length; h++){
        var hd = distFromRolls(result.independentHitRolls[h]);
        turnDist = turnDist ? convolve(turnDist, hd) : hd;
      }
    } else {
      if(!result.rolls || !result.rolls.length) return;
      turnDist = distFromRolls(result.rolls);
    }

    var cum = turnDist, partial = null, certain = null;
    for(var k=1;k<=MAX_TURNS;k++){
      if(k>1) cum = convolve(cum, turnDist);
      var p = probAtLeast(cum, hp);
      if(p > 1e-9 && p < 1 - 1e-9 && !partial) partial = { hits:k, probability:p };
      if(p >= 1 - 1e-9){ certain = k; break; }
    }
    result.koInfo = {
      certain: certain,
      partial: (partial && (!certain || partial.hits < certain)) ? partial : null,
      cappedAt: certain ? null : MAX_TURNS
    };
  }

  var prevKo = C.calculateDamage;
  C.calculateDamage = function(input){
    var result = prevKo(input);
    try{ computeExactKoInfo(result, input || {}); }
    catch(e){ if(window.console && console.error) console.error('[koInfo] failed:', e); }
    return result;
  };
  window.DAMEKE_CALC = C;
})();

/* v2.4.0 技の追加効果データ(技①→技②連続計算で使用)。
   元データ: 「追加効果データ入力シート(v2)」(ユーザー作成のExcel)と「追加効果等無効等要素」(テキスト)。
   効果の種類(k):
     rank        ランク変動 t:'self'|'target', s:{A:-1,...}, oc:1=溜めターンに発生(外れ・無効でも発生),
                 eot:1=ターン終了時(みずあめボム), cond=発動条件
     status      状態異常 st:'まひ'|'やけど'|'ねむり'|'こおり'|'どく'|'もうどく'
     statusOneOf sts:[...] のうち1つを等確率で(トライアタック・フェイタルクロー)
     confuse     こんらん
     note        計算対象外の効果(ひるみ・交代・にげられない等。表示のみ)
     recoil      与えたダメージの r[0]/r[1] の反動(四捨五入・最低1)
     drain       与えたダメージの r[0]/r[1] 回復(四捨五入)
     crash       外れ・無効のとき最大HPの1/2(切り捨て)の反動
     selfKO      自分がひんし(always:1=外れ・無効でも)   selfHalf  最大HPの1/2(切り上げ)の反動(外れ・無効でも)
     chloro      当たったとき最大HPの1/2(切り上げ)の反動  struggle  最大HPの1/4(四捨五入・最低1)の反動
     bind        バインド(最大HPの1/8、しめつけバンドで1/6)   saltCure  しおづけ(1/16、みず・はがねは1/8)
     rankReset   相手のランク補正をリセット   healBlock  かいふくふうじ
     pluck / fling / knockOff / incinerate / thief   持ち物関連
     fieldClear / screenClear / burnUp / doubleShock / smack / coreEnforcer   その他
     cure        相手の状態異常(st)を治す   thawTarget  相手のこおりを治す   thawSelf  自分のこおりを治す
     relicSong   メロエッタのフォルムチェンジ
     setWeather / setField / gravity   天候・フィールド・じゅうりょく(強化技)
     eotGmax     キョダイベンタツ等: typeを持たない相手へターン終了時に最大HPの1/6
     cureSelf    自分の状態異常を治す   gmaxRapid  キョダイシンゲキの回数+1   finaleHeal  キョダイダンエンの回復
     sf:1 = ちからずく有効時は発生しない(ちからずくタグの有無に関わらず)
   シートからの修正点:
   ・こうそくスピン: 10% → 100%    ・Gのちから: 能力未記入 → ぼうぎょ-1
   ・ミストバースト行に記載の「50% 相手 とくこう-1」はミストボールの効果のため、ミストボールへ移動
   ・フレアドライブ: 10% やけど を追加(シートに記載なし)
   ・ねこだまし: 効果の対象を「自分」→「相手」(ひるみ)
   ・メテオビーム/エレクトロビーム/ロケットずつき: 溜めターンに上昇するため、外れ・無効でも発生(oc:1)
   ・ひみつのちから: フィールドにより効果が変わる
   ・とどめばり(相手を倒したときのみ=技②が発生しない)は対象外 */
(function(){
  window.DAMEKE_MOVE_EFFECTS = {
    // ---- 強化技(専用Z・ダイマックスわざ・キョダイマックスわざ)。enh:1=強化技の効果(ちからずく・
    // てんのめぐみ・にじの対象外)、maxMove:1=ダイマックス/キョダイマックスわざ(りんぷん等で無効化されない) ----
    "ライトニングサーフライド":[{"k":"status","c":100,"st":"まひ","enh":1}],
    "オリジンズスーパーノヴァ":[{"k":"setField","f":"サイコフィールド","enh":1}],
    "ラジアルエッジストーム":[{"k":"fieldClear","enh":1}],
    "ブレイジングソウルビート":[{"k":"rank","t":"self","c":100,"s":{"A":1,"B":1,"C":1,"D":1,"S":1},"enh":1}],
    "ダイアタック":[{"k":"rank","t":"target","c":100,"s":{"S":-1},"enh":1,"maxMove":1}],
    "ダイナックル":[{"k":"rank","t":"self","c":100,"s":{"A":1},"enh":1,"maxMove":1}],
    "ダイジェット":[{"k":"rank","t":"self","c":100,"s":{"S":1},"enh":1,"maxMove":1}],
    "ダイアシッド":[{"k":"rank","t":"self","c":100,"s":{"C":1},"enh":1,"maxMove":1}],
    "ダイアース":[{"k":"rank","t":"self","c":100,"s":{"D":1},"enh":1,"maxMove":1}],
    "ダイワーム":[{"k":"rank","t":"target","c":100,"s":{"C":-1},"enh":1,"maxMove":1}],
    "ダイホロウ":[{"k":"rank","t":"target","c":100,"s":{"B":-1},"enh":1,"maxMove":1}],
    "ダイスチル":[{"k":"rank","t":"self","c":100,"s":{"B":1},"enh":1,"maxMove":1}],
    "ダイドラグーン":[{"k":"rank","t":"target","c":100,"s":{"A":-1},"enh":1,"maxMove":1}],
    "ダイアーク":[{"k":"rank","t":"target","c":100,"s":{"D":-1},"enh":1,"maxMove":1}],
    "ダイロック":[{"k":"setWeather","w":"すなあらし","enh":1,"maxMove":1}],
    "ダイバーン":[{"k":"setWeather","w":"にほんばれ","enh":1,"maxMove":1}],
    "ダイストリーム":[{"k":"setWeather","w":"あめ","enh":1,"maxMove":1}],
    "ダイアイス":[{"k":"setWeather","w":"ゆき","enh":1,"maxMove":1}],
    "ダイソウゲン":[{"k":"setField","f":"グラスフィールド","enh":1,"maxMove":1}],
    "ダイサンダー":[{"k":"setField","f":"エレキフィールド","enh":1,"maxMove":1}],
    "ダイサイコ":[{"k":"setField","f":"サイコフィールド","enh":1,"maxMove":1}],
    "ダイフェアリー":[{"k":"setField","f":"ミストフィールド","enh":1,"maxMove":1}],
    "キョダイベンタツ":[{"k":"eotGmax","type":"くさ","enh":1,"maxMove":1}],
    "キョダイゴクエン":[{"k":"eotGmax","type":"ほのお","enh":1,"maxMove":1}],
    "キョダイホウゲキ":[{"k":"eotGmax","type":"みず","enh":1,"maxMove":1}],
    "キョダイフンセキ":[{"k":"eotGmax","type":"いわ","enh":1,"maxMove":1}],
    "キョダイコワク":[{"k":"statusOneOf","c":100,"sts":["どく","まひ","ねむり"],"enh":1,"maxMove":1}],
    "キョダイバンライ":[{"k":"status","c":100,"st":"まひ","enh":1,"maxMove":1}],
    "キョダイコバン":[{"k":"confuse","c":100,"enh":1,"maxMove":1},{"k":"note","t":"self","c":100,"text":"おかねを拾う(レベル×100円)","dustOk":1,"subOk":1,"enh":1,"maxMove":1}],
    "キョダイシンゲキ":[{"k":"gmaxRapid","enh":1,"maxMove":1}],
    "キョダイゲンエイ":[{"k":"note","t":"target","c":100,"text":"にげられない","dustOk":1,"subOk":1,"enh":1,"maxMove":1}],
    "キョダイホウマツ":[{"k":"rank","t":"target","c":100,"s":{"S":-2},"enh":1,"maxMove":1}],
    "キョダイセンリツ":[{"k":"note","t":"self","c":100,"text":"オーロラベール","dustOk":1,"subOk":1,"enh":1,"maxMove":1}],
    "キョダイホーヨー":[{"k":"note","t":"target","c":100,"text":"メロメロ","dustOk":1,"subOk":1,"enh":1,"maxMove":1,"cond":"oppositeGender"}],
    "キョダイシュウキ":[{"k":"status","c":100,"st":"どく","enh":1,"maxMove":1}],
    "キョダイフウゲキ":[{"k":"fieldClear","enh":1,"maxMove":1},{"k":"screenClear","enh":1,"maxMove":1}],
    "キョダイテンドウ":[{"k":"gravity","enh":1,"maxMove":1}],
    "キョダイガンジン":[{"k":"note","t":"target","c":100,"text":"ステルスロック状態","dustOk":1,"subOk":1,"enh":1,"maxMove":1}],
    "キョダイサンゲキ":[{"k":"rank","t":"target","c":100,"s":{"eva":-1},"enh":1,"maxMove":1}],
    "キョダイカンロ":[{"k":"cureSelf","enh":1,"maxMove":1}],
    "キョダイサジン":[{"k":"bind","enh":1,"maxMove":1},{"k":"note","t":"target","c":100,"text":"にげられない","dustOk":1,"subOk":1,"enh":1,"maxMove":1}],
    "キョダイカンデン":[{"k":"statusOneOf","c":100,"sts":["どく","まひ"],"enh":1,"maxMove":1}],
    "キョダイヒャッカ":[{"k":"bind","enh":1,"maxMove":1},{"k":"note","t":"target","c":100,"text":"にげられない","dustOk":1,"subOk":1,"enh":1,"maxMove":1}],
    "キョダイテンバツ":[{"k":"confuse","c":100,"enh":1,"maxMove":1}],
    "キョダイスイマ":[{"k":"note","t":"target","c":100,"text":"ねむけ","dustOk":1,"subOk":1,"enh":1,"maxMove":1}],
    "キョダイダンエン":[{"k":"finaleHeal","enh":1,"maxMove":1}],
    "キョダイコウジン":[{"k":"note","t":"target","c":100,"text":"キョダイコウジン状態","dustOk":1,"subOk":1,"enh":1,"maxMove":1}],
    "キョダイゲンスイ":[{"k":"note","t":"target","c":100,"text":"PPを2減らす","dustOk":1,"subOk":1,"enh":1,"maxMove":1}],
    "キョダイユウゲキ":[{"k":"note","t":"target","c":100,"text":"いちゃもん","dustOk":1,"subOk":1,"enh":1,"maxMove":1}],
    "キョダイサイセイ":[{"k":"note","t":"self","c":100,"text":"50%で使ったきのみが戻る","dustOk":1,"subOk":1,"enh":1,"maxMove":1}],
    "10まんボルト":[{"k":"status","c":10,"st":"まひ"}],
    "3ぼんのや":[{"k":"rank","t":"target","c":50,"s":{"B":-1}},{"k":"note","t":"target","c":30,"text":"ひるみ"}],
    "Gのちから":[{"k":"rank","t":"target","c":100,"s":{"B":-1}}],
    "Vジェネレート":[{"k":"rank","t":"self","c":100,"s":{"B":-1,"D":-1,"S":-1}}],
    "あおいほのお":[{"k":"status","c":20,"st":"やけど"}],
    "あくのはどう":[{"k":"note","t":"target","c":20,"text":"ひるみ"}],
    "あやしいかぜ":[{"k":"rank","t":"self","c":10,"s":{"A":1,"B":1,"C":1,"D":1,"S":1}}],
    "あわ":[{"k":"rank","t":"target","c":10,"s":{"S":-1}}],
    "いじげんラッシュ":[{"k":"rank","t":"self","c":100,"s":{"B":-1}}],
    "いっちょうあがり":[{"k":"rank","t":"self","c":100,"s":{"A":1},"cond":"orderUp:そったすがた"},{"k":"rank","t":"self","c":100,"s":{"B":1},"cond":"orderUp:たれたすがた"},{"k":"rank","t":"self","c":100,"s":{"S":1},"cond":"orderUp:のびたすがた"}],
    "いてつくしせん":[{"k":"status","c":10,"st":"こおり"}],
    "いにしえのうた":[{"k":"status","c":10,"st":"ねむり"},{"k":"relicSong"}],
    "いのちがけ":[{"k":"selfKO"}],
    "いびき":[{"k":"note","t":"target","c":30,"text":"ひるみ"}],
    "いわくだき":[{"k":"rank","t":"target","c":50,"s":{"B":-1}}],
    "いわなだれ":[{"k":"note","t":"target","c":30,"text":"ひるみ"}],
    "うずしお":[{"k":"bind"},{"k":"note","t":"target","c":100,"text":"にげられない","dustOk":1}],
    "うたかたのアリア":[{"k":"cure","st":"やけど","sf":1}],
    "うちおとす":[{"k":"smack"}],
    "うらみつらみ":[{"k":"rank","t":"target","c":100,"s":{"A":-1}}],
    "おしゃべり":[{"k":"confuse","c":100}],
    "おどろかす":[{"k":"note","t":"target","c":30,"text":"ひるみ"}],
    "かえんぐるま":[{"k":"thawSelf"},{"k":"status","c":10,"st":"やけど"}],
    "かえんだん":[{"k":"status","c":30,"st":"やけど"}],
    "かえんほうしゃ":[{"k":"status","c":10,"st":"やけど"}],
    "かえんボール":[{"k":"thawSelf"},{"k":"status","c":10,"st":"やけど"}],
    "かかとおとし":[{"k":"confuse","c":30},{"k":"crash"}],
    "かげぬい":[{"k":"note","t":"target","c":100,"text":"にげられない","dustOk":1}],
    "かみくだく":[{"k":"rank","t":"target","c":20,"s":{"B":-1}}],
    "かみつく":[{"k":"note","t":"target","c":30,"text":"ひるみ"}],
    "かみなり":[{"k":"status","c":30,"st":"まひ"}],
    "かみなりあらし":[{"k":"status","c":20,"st":"まひ"}],
    "かみなりのキバ":[{"k":"status","c":10,"st":"まひ"},{"k":"note","t":"target","c":10,"text":"ひるみ"}],
    "かみなりパンチ":[{"k":"status","c":10,"st":"まひ"}],
    "からみつく":[{"k":"rank","t":"target","c":10,"s":{"S":-1}}],
    "かわらわり":[{"k":"screenClear"}],
    "がんせきふうじ":[{"k":"rank","t":"target","c":100,"s":{"S":-1}}],
    "がんせきアックス":[{"k":"note","t":"target","c":100,"text":"ステルスロック状態","subOk":1,"dustOk":1}],
    "きあいだま":[{"k":"rank","t":"target","c":10,"s":{"D":-1}}],
    "きつけ":[{"k":"cure","st":"まひ","sf":1}],
    "きゅうけつ":[{"k":"drain","r":[1,2]}],
    "きょけんとつげき":[{"k":"note","t":"self","c":100,"text":"むぼうび"}],
    "ぎんいろのかぜ":[{"k":"rank","t":"self","c":10,"s":{"A":1,"B":1,"C":1,"D":1,"S":1}}],
    "くさわけ":[{"k":"rank","t":"self","c":100,"s":{"S":1}}],
    "くらいつく":[{"k":"note","t":"target","c":100,"text":"お互いににげられない","dustOk":1}],
    "げんしのちから":[{"k":"rank","t":"self","c":10,"s":{"A":1,"B":1,"C":1,"D":1,"S":1}}],
    "こうそくスピン":[{"k":"rank","t":"self","c":100,"s":{"S":1}}],
    "こおりのキバ":[{"k":"status","c":10,"st":"こおり"},{"k":"note","t":"target","c":10,"text":"ひるみ"}],
    "こがらしあらし":[{"k":"rank","t":"target","c":30,"s":{"S":-1}}],
    "こごえるかぜ":[{"k":"rank","t":"target","c":100,"s":{"S":-1}}],
    "こごえるせかい":[{"k":"rank","t":"target","c":100,"s":{"S":-1}}],
    "こなゆき":[{"k":"status","c":10,"st":"こおり"}],
    "さわぐ":[{"k":"note","t":"self","c":100,"text":"さわぐ状態(お互いねむりにならない)"}],
    "しおづけ":[{"k":"saltCure","c":100}],
    "したでなめる":[{"k":"status","c":30,"st":"まひ"}],
    "しねんのずつき":[{"k":"note","t":"target","c":20,"text":"ひるみ"}],
    "しめつける":[{"k":"bind"},{"k":"note","t":"target","c":100,"text":"にげられない","dustOk":1}],
    "しんぴのちから":[{"k":"rank","t":"self","c":100,"s":{"C":1}}],
    "じごくぐるま":[{"k":"recoil","r":[1,4]}],
    "じごくづき":[{"k":"note","t":"target","c":100,"text":"音技使用不可"}],
    "じならし":[{"k":"rank","t":"target","c":100,"s":{"S":-1}}],
    "じばく":[{"k":"selfKO","always":1}],
    "じゃどくのくさり":[{"k":"status","c":50,"st":"もうどく"}],
    "じゃれつく":[{"k":"rank","t":"target","c":10,"s":{"A":-1}}],
    "じんつうりき":[{"k":"note","t":"target","c":10,"text":"ひるみ"}],
    "すいとる":[{"k":"drain","r":[1,2]}],
    "すてみタックル":[{"k":"recoil","r":[33,100]}],
    "すなじごく":[{"k":"bind"},{"k":"note","t":"target","c":100,"text":"にげられない","dustOk":1}],
    "ずつき":[{"k":"note","t":"target","c":30,"text":"ひるみ"}],
    "せいなるほのお":[{"k":"thawSelf"},{"k":"status","c":50,"st":"やけど"}],
    "たきのぼり":[{"k":"note","t":"target","c":20,"text":"ひるみ"}],
    "たつまき":[{"k":"note","t":"target","c":20,"text":"ひるみ"}],
    "だいちのちから":[{"k":"rank","t":"target","c":10,"s":{"D":-1}}],
    "だいばくはつ":[{"k":"selfKO","always":1}],
    "だいもんじ":[{"k":"status","c":10,"st":"やけど"}],
    "だくりゅう":[{"k":"rank","t":"target","c":30,"s":{"acc":-1}}],
    "ついばむ":[{"k":"pluck"}],
    "つららおとし":[{"k":"note","t":"target","c":30,"text":"ひるみ"}],
    "てっていこうせん":[{"k":"selfHalf"}],
    "でんきショック":[{"k":"status","c":10,"st":"まひ"}],
    "でんこうそうげき":[{"k":"doubleShock"}],
    "でんじほう":[{"k":"status","c":100,"st":"まひ"}],
    "とっしん":[{"k":"recoil","r":[1,4]}],
    "とびかかる":[{"k":"rank","t":"target","c":100,"s":{"A":-1}}],
    "とびげり":[{"k":"crash"}],
    "とびつく":[{"k":"rank","t":"target","c":100,"s":{"S":-1}}],
    "とびはねる":[{"k":"status","c":30,"st":"まひ"}],
    "とびひざげり":[{"k":"crash"}],
    "ともえなげ":[{"k":"note","t":"target","c":100,"text":"強制交代","dustOk":1}],
    "とんぼがえり":[{"k":"note","t":"self","c":100,"text":"交代する"}],
    "どくづき":[{"k":"status","c":30,"st":"どく"}],
    "どくどくのキバ":[{"k":"status","c":50,"st":"もうどく"}],
    "どくばり":[{"k":"status","c":30,"st":"どく"}],
    "どくばりセンボン":[{"k":"status","c":50,"st":"どく"}],
    "どろかけ":[{"k":"rank","t":"target","c":100,"s":{"acc":-1}}],
    "どろばくだん":[{"k":"rank","t":"target","c":30,"s":{"acc":-1}}],
    "どろぼう":[{"k":"thief"}],
    "なげつける":[{"k":"fling"}],
    "ねこだまし":[{"k":"note","t":"target","c":100,"text":"ひるみ"}],
    "ねっさのあらし":[{"k":"status","c":20,"st":"やけど"}],
    "ねっさのだいち":[{"k":"thawSelf"},{"k":"status","c":30,"st":"やけど"},{"k":"thawTarget","sf":1}],
    "ねっとう":[{"k":"thawSelf"},{"k":"status","c":30,"st":"やけど"},{"k":"thawTarget","sf":1}],
    "ねっぷう":[{"k":"status","c":10,"st":"やけど"}],
    "ねんりき":[{"k":"confuse","c":10}],
    "のしかかり":[{"k":"status","c":30,"st":"まひ"}],
    "はいよるいちげき":[{"k":"rank","t":"target","c":100,"s":{"C":-1}}],
    "はがねのつばさ":[{"k":"rank","t":"self","c":10,"s":{"B":1}}],
    "はたきおとす":[{"k":"knockOff"}],
    "はっけい":[{"k":"status","c":30,"st":"まひ"}],
    "はめつのひかり":[{"k":"recoil","r":[1,2]}],
    "はるのあらし":[{"k":"rank","t":"target","c":30,"s":{"A":-1}}],
    "ばかぢから":[{"k":"rank","t":"self","c":100,"s":{"A":-1,"B":-1}}],
    "ばくれつパンチ":[{"k":"confuse","c":100}],
    "ひけん・ちえなみ":[{"k":"note","t":"target","c":100,"text":"まきびし状態","subOk":1,"dustOk":1}],
    "ひっさつまえば":[{"k":"note","t":"target","c":10,"text":"ひるみ"}],
    "ひのこ":[{"k":"status","c":10,"st":"やけど"}],
    "ひみつのちから":[{"k":"rank","t":"target","c":30,"s":{"C":-1},"cond":"field:ミストフィールド"},{"k":"rank","t":"target","c":30,"s":{"S":-1},"cond":"field:サイコフィールド"},{"k":"status","c":30,"st":"まひ","cond":"fieldNot:ミストフィールド|サイコフィールド|グラスフィールド"},{"k":"status","c":30,"st":"ねむり","cond":"field:グラスフィールド"}],
    "ひゃっきやこう":[{"k":"status","c":30,"st":"やけど"}],
    "ひやみず":[{"k":"rank","t":"target","c":100,"s":{"A":-1}}],
    "ひょうざんおろし":[{"k":"note","t":"target","c":30,"text":"ひるみ"}],
    "びりびりちくちく":[{"k":"note","t":"target","c":30,"text":"ひるみ"}],
    "ふぶき":[{"k":"status","c":10,"st":"こおり"}],
    "ふみつけ":[{"k":"note","t":"target","c":30,"text":"ひるみ"}],
    "ふんえん":[{"k":"status","c":30,"st":"やけど"}],
    "ぶきみなじゅもん":[{"k":"note","t":"target","c":100,"text":"PPを3減らす"}],
    "ぶちかまし":[{"k":"rank","t":"self","c":100,"s":{"B":-1,"D":-1}}],
    "ほうでん":[{"k":"status","c":30,"st":"まひ"}],
    "ほしがる":[{"k":"thief"}],
    "ほっぺすりすり":[{"k":"status","c":100,"st":"まひ"}],
    "ほのおのうず":[{"k":"bind"},{"k":"note","t":"target","c":100,"text":"にげられない","dustOk":1}],
    "ほのおのまい":[{"k":"rank","t":"self","c":50,"s":{"C":1}}],
    "ほのおのキバ":[{"k":"status","c":10,"st":"やけど"},{"k":"note","t":"target","c":10,"text":"ひるみ"}],
    "ほのおのパンチ":[{"k":"status","c":10,"st":"やけど"}],
    "ほのおのムチ":[{"k":"rank","t":"target","c":100,"s":{"B":-1}}],
    "ぼうふう":[{"k":"confuse","c":30}],
    "まきつく":[{"k":"bind"},{"k":"note","t":"target","c":100,"text":"にげられない","dustOk":1}],
    "まとわりつく":[{"k":"bind"},{"k":"note","t":"target","c":100,"text":"にげられない","dustOk":1}],
    "まわしげり":[{"k":"note","t":"target","c":30,"text":"ひるみ"}],
    "みずあめボム":[{"k":"rank","t":"target","c":100,"s":{"S":-1},"eot":1}],
    "みずのはどう":[{"k":"confuse","c":20}],
    "むしくい":[{"k":"pluck"}],
    "むしのさざめき":[{"k":"rank","t":"target","c":10,"s":{"D":-1}}],
    "むしのていこう":[{"k":"rank","t":"target","c":100,"s":{"C":-1}}],
    "むねんのつるぎ":[{"k":"drain","r":[1,2]}],
    "めざましビンタ":[{"k":"cure","st":"ねむり","sf":1}],
    "もえあがるいかり":[{"k":"note","t":"target","c":20,"text":"ひるみ"}],
    "もえつきる":[{"k":"burnUp"}],
    "もろはのずつき":[{"k":"recoil","r":[1,2]}],
    "やきつくす":[{"k":"incinerate"}],
    "ようかいえき":[{"k":"rank","t":"target","c":10,"s":{"D":-1}}],
    "らいげき":[{"k":"status","c":20,"st":"まひ"}],
    "らいめいげり":[{"k":"rank","t":"target","c":100,"s":{"B":-1}}],
    "りゅうせいぐん":[{"k":"rank","t":"self","c":100,"s":{"C":-2}}],
    "りゅうのいぶき":[{"k":"status","c":30,"st":"まひ"}],
    "りんごさん":[{"k":"rank","t":"target","c":100,"s":{"D":-1}}],
    "れいとうパンチ":[{"k":"status","c":10,"st":"こおり"}],
    "れいとうビーム":[{"k":"status","c":10,"st":"こおり"}],
    "れんごく":[{"k":"status","c":100,"st":"やけど"}],
    "わるあがき":[{"k":"struggle"}],
    "アイアンテール":[{"k":"rank","t":"target","c":30,"s":{"B":-1}}],
    "アイアンヘッド":[{"k":"note","t":"target","c":20,"text":"ひるみ"}],
    "アイアンローラー":[{"k":"fieldClear"}],
    "アイススピナー":[{"k":"fieldClear"}],
    "アイスハンマー":[{"k":"rank","t":"self","c":100,"s":{"S":-1}}],
    "アクアステップ":[{"k":"rank","t":"self","c":100,"s":{"S":1}}],
    "アクアブレイク":[{"k":"rank","t":"target","c":20,"s":{"B":-1}}],
    "アシッドボム":[{"k":"rank","t":"target","c":100,"s":{"D":-2}}],
    "アフロブレイク":[{"k":"recoil","r":[1,4]}],
    "アンカーショット":[{"k":"note","t":"target","c":100,"text":"にげられない","dustOk":1}],
    "アーマーキャノン":[{"k":"rank","t":"self","c":100,"s":{"B":-1,"D":-1}}],
    "アームハンマー":[{"k":"rank","t":"self","c":100,"s":{"S":-1}}],
    "インファイト":[{"k":"rank","t":"self","c":100,"s":{"B":-1,"D":-1}}],
    "ウェーブタックル":[{"k":"recoil","r":[33,100]}],
    "ウッドハンマー":[{"k":"recoil","r":[33,100]}],
    "ウッドホーン":[{"k":"drain","r":[1,2]}],
    "エアスラッシュ":[{"k":"note","t":"target","c":30,"text":"ひるみ"}],
    "エナジーボール":[{"k":"rank","t":"target","c":10,"s":{"D":-1}}],
    "エレキネット":[{"k":"rank","t":"target","c":100,"s":{"S":-1}}],
    "エレクトロビーム":[{"k":"rank","t":"self","c":100,"s":{"C":1},"oc":1}],
    "オクタンほう":[{"k":"rank","t":"target","c":50,"s":{"acc":-1}}],
    "オーバーヒート":[{"k":"rank","t":"self","c":100,"s":{"C":-2}}],
    "オーラぐるま":[{"k":"rank","t":"self","c":100,"s":{"S":1}}],
    "オーラウイング":[{"k":"rank","t":"self","c":100,"s":{"S":1}}],
    "オーロラビーム":[{"k":"rank","t":"target","c":10,"s":{"A":-1}}],
    "ガリョウテンセイ":[{"k":"rank","t":"self","c":100,"s":{"B":-1,"D":-1}}],
    "キラースピン":[{"k":"status","c":100,"st":"どく"}],
    "ギガドレイン":[{"k":"drain","r":[1,2]}],
    "クイックターン":[{"k":"note","t":"self","c":100,"text":"交代する"}],
    "クリアスモッグ":[{"k":"rankReset"}],
    "クロスフレイム":[{"k":"thawSelf"}],
    "クロスポイズン":[{"k":"status","c":10,"st":"どく"}],
    "クロロブラスト":[{"k":"chloro"}],
    "グラスミキサー":[{"k":"rank","t":"target","c":50,"s":{"acc":-1}}],
    "グロウパンチ":[{"k":"rank","t":"self","c":100,"s":{"A":1}}],
    "コアパニッシャー":[{"k":"coreEnforcer"}],
    "コメットパンチ":[{"k":"rank","t":"self","c":20,"s":{"A":1}}],
    "コールドフレア":[{"k":"status","c":30,"st":"やけど"}],
    "ゴッドバード":[{"k":"note","t":"target","c":30,"text":"ひるみ"}],
    "ゴールドラッシュ":[{"k":"rank","t":"self","c":100,"s":{"C":-2}}],
    "サイケこうせん":[{"k":"confuse","c":10}],
    "サイコキネシス":[{"k":"rank","t":"target","c":10,"s":{"D":-1}}],
    "サイコノイズ":[{"k":"healBlock","c":100}],
    "サイコファング":[{"k":"screenClear"}],
    "サウザンアロー":[{"k":"smack"}],
    "サウザンウェーブ":[{"k":"note","t":"target","c":100,"text":"にげられない","dustOk":1}],
    "サンダーダイブ":[{"k":"crash"}],
    "サンダープリズン":[{"k":"bind"},{"k":"note","t":"target","c":100,"text":"にげられない","dustOk":1}],
    "シェルアームズ":[{"k":"status","c":20,"st":"どく"}],
    "シェルブレード":[{"k":"rank","t":"target","c":50,"s":{"B":-1}}],
    "シグナルビーム":[{"k":"confuse","c":10}],
    "シャカシャカほう":[{"k":"thawSelf"},{"k":"status","c":20,"st":"やけど"},{"k":"thawTarget","sf":1},{"k":"drain","r":[1,2]}],
    "シャドーボール":[{"k":"rank","t":"target","c":20,"s":{"D":-1}}],
    "シャドーボーン":[{"k":"rank","t":"target","c":20,"s":{"B":-1}}],
    "シードフレア":[{"k":"rank","t":"target","c":40,"s":{"D":-2}}],
    "スケイルショット":[{"k":"rank","t":"self","c":100,"s":{"B":-1,"S":1}}],
    "スケイルノイズ":[{"k":"rank","t":"self","c":100,"s":{"B":-1}}],
    "スチームバースト":[{"k":"thawSelf"},{"k":"status","c":30,"st":"やけど"},{"k":"thawTarget","sf":1}],
    "スパーク":[{"k":"status","c":30,"st":"まひ"}],
    "スモッグ":[{"k":"status","c":40,"st":"どく"}],
    "ソウルクラッシュ":[{"k":"rank","t":"target","c":100,"s":{"C":-1}}],
    "ダイヤストーム":[{"k":"rank","t":"self","c":50,"s":{"B":2}}],
    "ダストシュート":[{"k":"status","c":30,"st":"どく"}],
    "ダブルニードル":[{"k":"status","c":20,"st":"どく"}],
    "ダブルパンツァー":[{"k":"note","t":"target","c":30,"text":"ひるみ"}],
    "チャージビーム":[{"k":"rank","t":"self","c":70,"s":{"C":1}}],
    "テラバースト":[{"k":"rank","t":"self","c":100,"s":{"A":-1,"C":-1},"cond":"stellarTera"}],
    "デスウイング":[{"k":"drain","r":[3,4]}],
    "トライアタック":[{"k":"statusOneOf","c":20,"sts":["まひ","やけど","こおり"]}],
    "トラバサミ":[{"k":"bind"},{"k":"note","t":"target","c":100,"text":"にげられない","dustOk":1}],
    "トロピカルキック":[{"k":"rank","t":"target","c":100,"s":{"A":-1}}],
    "ドラゴンダイブ":[{"k":"note","t":"target","c":20,"text":"ひるみ"}],
    "ドラゴンテール":[{"k":"note","t":"target","c":100,"text":"強制交代","dustOk":1}],
    "ドラムアタック":[{"k":"rank","t":"target","c":100,"s":{"S":-1}}],
    "ドレインキッス":[{"k":"drain","r":[3,4]}],
    "ドレインパンチ":[{"k":"drain","r":[1,2]}],
    "ナイトバースト":[{"k":"rank","t":"target","c":40,"s":{"acc":-1}}],
    "ニトロチャージ":[{"k":"rank","t":"self","c":100,"s":{"S":1}}],
    "ニードルアーム":[{"k":"note","t":"target","c":30,"text":"ひるみ"}],
    "ネコにこばん":[{"k":"note","t":"self","c":100,"text":"おかねを拾う"}],
    "ハイドロスチーム":[{"k":"thawSelf"},{"k":"thawTarget","sf":1}],
    "ハートスタンプ":[{"k":"note","t":"target","c":30,"text":"ひるみ"}],
    "ハードローラー":[{"k":"note","t":"target","c":30,"text":"ひるみ"}],
    "バブルこうせん":[{"k":"rank","t":"target","c":10,"s":{"S":-1}}],
    "バリアーラッシュ":[{"k":"rank","t":"self","c":100,"s":{"B":1}}],
    "バークアウト":[{"k":"rank","t":"target","c":100,"s":{"C":-1}}],
    "パラボラチャージ":[{"k":"drain","r":[1,2]}],
    "ビックリヘッド":[{"k":"selfHalf"}],
    "ピヨピヨパンチ":[{"k":"confuse","c":20}],
    "フェイタルクロー":[{"k":"statusOneOf","c":30,"sts":["どく","まひ","ねむり"]}],
    "フリーズボルト":[{"k":"status","c":30,"st":"まひ"}],
    "フルールカノン":[{"k":"rank","t":"self","c":100,"s":{"C":-2}}],
    "フレアソング":[{"k":"rank","t":"self","c":100,"s":{"C":1}}],
    "フレアドライブ":[{"k":"thawSelf"},{"k":"status","c":10,"st":"やけど"},{"k":"recoil","r":[33,100]}],
    "ブレイククロー":[{"k":"rank","t":"target","c":50,"s":{"B":-1}}],
    "ブレイズキック":[{"k":"status","c":10,"st":"やけど"}],
    "ブレイブバード":[{"k":"recoil","r":[33,100]}],
    "プラズマフィスト":[{"k":"note","t":"self","c":100,"text":"プラズマシャワー(このターンのみ)"}],
    "ヘドロこうげき":[{"k":"status","c":30,"st":"どく"}],
    "ヘドロばくだん":[{"k":"status","c":30,"st":"どく"}],
    "ヘドロウェーブ":[{"k":"status","c":10,"st":"どく"}],
    "ホイールスピン":[{"k":"rank","t":"self","c":100,"s":{"S":-2}}],
    "ホネこんぼう":[{"k":"note","t":"target","c":10,"text":"ひるみ"}],
    "ボルテッカー":[{"k":"status","c":10,"st":"まひ"},{"k":"recoil","r":[33,100]}],
    "ボルトチェンジ":[{"k":"note","t":"self","c":100,"text":"交代する"}],
    "ポイズンテール":[{"k":"status","c":10,"st":"どく"}],
    "マグマストーム":[{"k":"bind"},{"k":"note","t":"target","c":100,"text":"にげられない","dustOk":1}],
    "マジカルフレイム":[{"k":"rank","t":"target","c":100,"s":{"C":-1}}],
    "マッドショット":[{"k":"rank","t":"target","c":100,"s":{"S":-1}}],
    "ミストバースト":[{"k":"selfKO","always":1}],
    "ミストボール":[{"k":"rank","t":"target","c":50,"s":{"C":-1}}],
    "ミラーショット":[{"k":"rank","t":"target","c":30,"s":{"acc":-1}}],
    "ムーンフォース":[{"k":"rank","t":"target","c":10,"s":{"C":-1}}],
    "メガドレイン":[{"k":"drain","r":[1,2]}],
    "メタルクロー":[{"k":"rank","t":"self","c":10,"s":{"A":1}}],
    "メテオビーム":[{"k":"rank","t":"self","c":100,"s":{"C":1},"oc":1}],
    "ラスターカノン":[{"k":"rank","t":"target","c":10,"s":{"D":-1}}],
    "ラスターパージ":[{"k":"rank","t":"target","c":50,"s":{"D":-1}}],
    "リーフストーム":[{"k":"rank","t":"self","c":100,"s":{"C":-2}}],
    "ルミナコリジョン":[{"k":"rank","t":"target","c":100,"s":{"D":-2}}],
    "レイジングブル":[{"k":"screenClear"}],
    "ロケットずつき":[{"k":"rank","t":"self","c":100,"s":{"B":1},"oc":1}],
    "ロッククライム":[{"k":"confuse","c":20}],
    "ローキック":[{"k":"rank","t":"target","c":100,"s":{"S":-1}}],
    "ワイドブレイカー":[{"k":"rank","t":"target","c":100,"s":{"A":-1}}],
    "ワイルドボルト":[{"k":"recoil","r":[1,4]}],
    "ワンダースチーム":[{"k":"confuse","c":20}]
  };
})();

/* v1.05 faint probability: combines accuracy, crit-rate-weighted independent per-hit rolls,
   and hit-count distribution (skill link / loaded dice / 2-5-hit / per-hit-accuracy moves). */
(function(){
  var C = window.DAMEKE_CALC || {};
  if(!C.calculateDamage) return;
  var num = window.DAMEKE_CALC_SHARED.num;
  var moveName = window.DAMEKE_CALC_SHARED.moveName;
  var getHitSpec = window.DAMEKE_CALC_SHARED.getHitSpec;
  var activeAbility = window.DAMEKE_CALC_SHARED.activeAbilityCoreOnly;
  var activeItem = window.DAMEKE_CALC_SHARED.activeItemCoreOnly;
  var MAX_TURNS = 200;

  function distFromRolls(rolls){
    var out=Object.create(null), p=1/rolls.length;
    for(var i=0;i<rolls.length;i++){ var d=rolls[i]; out[d]=(out[d]||0)+p; }
    return out;
  }
  function convolve(a,b){
    var out=Object.create(null);
    for(var da in a){ var pa=a[da]; for(var db in b){ var s=Number(da)+Number(db); out[s]=(out[s]||0)+pa*b[db]; } }
    return out;
  }
  function scaleDist(a,w){ var out=Object.create(null); for(var k in a) out[k]=a[k]*w; return out; }
  function addDist(a,b){ var out=Object.create(null); for(var k in a) out[k]=a[k]; for(var k in b) out[k]=(out[k]||0)+b[k]; return out; }
  function probAtLeast(dist,threshold){ var p=0; for(var d in dist){ if(Number(d)>=threshold) p+=dist[d]; } return p; }

  function critRateFromResult(result){
    if(result.criticalBlocked) return 0;
    var r = result.criticalRank || 0;
    if(r>=3) return 1;
    if(r===2) return 0.5;
    if(r===1) return 0.125;
    return 1/24;
  }

  // Blend the "never crit" and "always crit" runs' independent per-hit rolls (already reflect
  // postHitDamageAdjustment -- ばけのかわ/がんじょう/きあいのタスキ etc -- so KO probability
  // correctly accounts for those too) into one distribution per hit index.
  function buildPerHitDists(normalResult, critResult, critRate, hitCount){
    var normalHits = normalResult.independentHitRolls || [normalResult.rolls || [0]];
    var critHits = critResult.independentHitRolls || [critResult.rolls || [0]];
    var dists = [];
    for(var i=0;i<hitCount;i++){
      var nd = distFromRolls(normalHits[i] || normalHits[normalHits.length-1] || [0]);
      var cd = distFromRolls(critHits[i] || critHits[critHits.length-1] || [0]);
      dists.push(addDist(scaleDist(nd,1-critRate), scaleDist(cd,critRate)));
    }
    return dists;
  }
  // きまぐレーザー: the faint-probability calculator ignores the checkbox and always blends the
  // real 30% chance of the power-doubling, independent of crit -- this is the only move where the
  // UI selection and the probability model intentionally diverge (per user's explicit request).
  var KIMAGURE_LASER_DOUBLE_RATE = 0.3;
  function buildPerHitDistsKimagureLaser(nn, nc, cn, cc, critRate, hitCount){
    var dists = [];
    for(var i=0;i<hitCount;i++){
      var getRolls = function(r){ var h=r.independentHitRolls || [r.rolls || [0]]; return h[i] || h[h.length-1] || [0]; };
      var dNN = distFromRolls(getRolls(nn)), dNC = distFromRolls(getRolls(nc));
      var dCN = distFromRolls(getRolls(cn)), dCC = distFromRolls(getRolls(cc));
      var notCrit = addDist(scaleDist(dNN,1-KIMAGURE_LASER_DOUBLE_RATE), scaleDist(dNC,KIMAGURE_LASER_DOUBLE_RATE));
      var isCrit = addDist(scaleDist(dCN,1-KIMAGURE_LASER_DOUBLE_RATE), scaleDist(dCC,KIMAGURE_LASER_DOUBLE_RATE));
      dists.push(addDist(scaleDist(notCrit,1-critRate), scaleDist(isCrit,critRate)));
    }
    return dists;
  }

  // みがわり: not in effect if the move is sound-tagged, the attacker has すりぬけ, or the
  // defender is Dynamax/Gigantamax -- regardless of the checkbox.
  function substituteHpOrNull(result,input,o){
    if(!o.defenderSubstitute) return null;
    var n = moveName(result,input);
    if(window.DAMEKE_DATA_HELPERS.moveTagByName(n,'sound')) return null;
    var aAbState = result.__coreState && result.__coreState.attackerAbilityState;
    var aAb = result.__coreState && result.__coreState.attackerAbility;
    if(aAbState && aAbState.active && aAb && aAb.name==='すりぬけ') return null;
    if(o.defenderSpecialState==='dynamax' || o.defenderSpecialState==='gmax') return null;
    var maxHp = result.defenderMaxHp;
    if(!maxHp) return null;
    return Math.floor(maxHp/4);
  }
  // Recovery berries: triggers once, mid-sequence, the first time remaining HP drops to/below
  // the threshold. Returns {threshold, amount, name} or null if the defender isn't holding (and
  // able to use) one of the recognized berries.
  function getBerrySpec(result, maxHp, forceNoBerry){
    if(forceNoBerry) return null;
    var dItem = result.__coreState && result.__coreState.defenderItem;
    var dItemState = result.__coreState && result.__coreState.defenderItemState;
    if(!dItemState || !dItemState.active || !dItem || !maxHp) return null;
    var dAb = result.__coreState && result.__coreState.defenderAbility;
    var dAbState = result.__coreState && result.__coreState.defenderAbilityState;
    var hasRipen = !!(dAbState && dAbState.active && dAb && dAb.name==='じゅくせい');
    var hasGluttony = !!(dAbState && dAbState.active && dAb && dAb.name==='くいしんぼう');
    var name = dItem.name;
    if(name==='オボンのみ'){
      // じゅくせい: 回復量2倍(最大HPの1/2)。
      var amt = hasRipen ? Math.floor(maxHp/2) : Math.floor(maxHp/4);
      return {threshold:Math.floor(maxHp/2), amount:amt, name:name};
    }
    if(['フィラのみ','ウイのみ','マゴのみ','バンジのみ','イアのみ'].indexOf(name)>=0){
      var threshold = hasGluttony ? Math.floor(maxHp/2) : Math.floor(maxHp/4);
      var amt2 = hasRipen ? Math.floor(maxHp*2/3) : Math.floor(maxHp/3);
      return {threshold:threshold, amount:amt2, name:name};
    }
    if(name==='オレンのみ') return {threshold:Math.floor(maxHp/2), amount:(hasRipen?20:10), name:name};
    if(name==='きのみジュース') return {threshold:Math.floor(maxHp/2), amount:20, name:name};
    // ナゾのみ: 他のきのみ(残りHPが閾値を下回ったら発動)とは条件が異なり、「効果ばつぐん(タイプ
    // 相性が4096超過)の技を受けたとき」に発動する。この関数の閾値モデル(1ヒットごとにHPが
    // threshold以下になったら発動)は残りHPベースだが、ダメージが1でも入った時点でHPは必ず
    // maxHp未満になる(=maxHp以下という条件を満たす)ことを利用し、threshold:maxHpとすることで
    // 「(効果ばつぐんの技を受けて)何かダメージが入った最初のヒットで即発動」を表現する。
    // タイプ相性は技全体で共通(ヒットごとに変わらない)ため、この判定はresultから一度だけ
    // 取得すれば十分。
    if(name==='ナゾのみ'){
      if(!((result.typeRate4096||0) > 4096)) return null;
      return {threshold:maxHp, amount:Math.floor(maxHp/4), name:name};
    }
    return null;
  }
  // Resolves a FIXED, known sequence of per-hit distributions through the substitute's HP pool
  // first; the hit that breaks it deals no body damage, and only hits after that count toward
  // the real target. Returns a plain body-damage distribution (0 if the substitute survives).
  // Core state transition: applies a fixed sequence of hit distributions to a phase-tagged state
  // distribution (key 's<n>' = substitute has taken n so far, 'b<n>' = substitute is gone and the
  // body has taken n so far). Does NOT collapse to plain body-damage -- callers that need to carry
  // the state into a further turn (substitute HP persists across turns) can keep using it as-is;
  // callers that just want "how much got through" call bodyDamageOf() on the result.
  function applyHitSequence(states, hitDists, subHp){
    for(var h=0; h<hitDists.length; h++){
      var hitDist = hitDists[h], next = Object.create(null);
      for(var key in states){
        var p = states[key], phase=key.charAt(0), cum=Number(key.slice(1));
        for(var hd in hitDist){
          var hp2 = hitDist[hd];
          if(phase==='b'){ var nk='b'+(cum+Number(hd)); next[nk]=(next[nk]||0)+p*hp2; }
          else {
            var newSub = cum+Number(hd);
            var nk2 = newSub>=subHp ? 'b0' : ('s'+newSub);
            next[nk2]=(next[nk2]||0)+p*hp2;
          }
        }
      }
      states = next;
    }
    return states;
  }
  // Same idea but for the accuracy-gated per-hit sequence (トリプルキック etc without loaded
  // dice/skill link): a miss at any point stops the sequence for that path, leaving its state
  // (still phase-tagged) untouched for the rest of this application.
  function applyHitSequenceSequential(states, hitDists, subHp, accProb, maxHits){
    var stopped = Object.create(null);
    for(var h=0; h<maxHits; h++){
      var hitDist = hitDists[h], next = Object.create(null);
      for(var key in states){
        var p = states[key];
        stopped[key] = (stopped[key]||0) + p*(1-accProb);
        var phase=key.charAt(0), cum=Number(key.slice(1));
        for(var hd in hitDist){
          var hp2 = hitDist[hd]*accProb;
          if(phase==='b'){ var nk='b'+(cum+Number(hd)); next[nk]=(next[nk]||0)+p*hp2; }
          else {
            var newSub = cum+Number(hd);
            var nk2 = newSub>=subHp ? 'b0' : ('s'+newSub);
            next[nk2]=(next[nk2]||0)+p*hp2;
          }
        }
      }
      states = next;
    }
    for(var key2 in states) stopped[key2] = (stopped[key2]||0) + states[key2];
    return stopped;
  }
  function bodyDamageOf(states){
    var out = Object.create(null);
    for(var key in states){
      var bodyDmg = key.charAt(0)==='b' ? Number(key.slice(1)) : 0;
      out[bodyDmg] = (out[bodyDmg]||0) + states[key];
    }
    return out;
  }
  function freshStates(){ var s=Object.create(null); s['s0']=1; return s; }
  // Generalized per-hit transition that layers substitute AND recovery-berry handling on the same
  // state machine. Key formats: 's<n>' = still behind the substitute (n = cumulative damage to
  // it so far); 'r<hp>_<0|1>' = substitute gone (or never present), hp = current remaining real
  // HP, flag = has the berry already been consumed; 'f' = fainted (terminal/absorbing -- further
  // hits land on an already-fainted target and change nothing). When the substitute breaks, the
  // hit that breaks it deals no body damage and body phase starts fresh at startHp with the berry
  // not yet consumed (matches how real HP was untouched while the sub stood).
  function applyHitSequenceFull(states, hitDists, subHp, startHp, maxHp, berrySpec){
    for(var h=0; h<hitDists.length; h++){
      var hitDist = hitDists[h], next = Object.create(null);
      for(var key in states){
        var p = states[key];
        if(key.charAt(0)==='f'){ next[key]=(next[key]||0)+p; continue; }
        var phase = key.charAt(0);
        if(phase==='s'){
          var cum = Number(key.slice(1));
          for(var hd in hitDist){
            var w = hitDist[hd];
            var newSub = cum+Number(hd);
            if(newSub>=subHp){
              var nk = 'r'+startHp+'_0';
              next[nk]=(next[nk]||0)+p*w;
            } else {
              var nk2 = 's'+newSub;
              next[nk2]=(next[nk2]||0)+p*w;
            }
          }
        } else { // phase 'r'
          var us = key.slice(1).split('_'), hpNow=Number(us[0]), consumed=us[1];
          for(var hd2 in hitDist){
            var w2 = hitDist[hd2];
            var newHp = hpNow-Number(hd2);
            if(newHp<=0){
              // Keep the actual (possibly negative, i.e. overkill) remaining HP AND whether the
              // berry had already been consumed before this fatal hit, so display code can tell
              // "recovery happened mid-sequence but wasn't enough" apart from "never triggered at
              // all" -- collapsing fainted states to just 'f<hp>' previously lost the consumed
              // flag, so a guaranteed-KO sequence with a mid-way heal looked like no recovery ever
              // occurred.
              var nkf = 'f'+newHp+'_'+consumed;
              next[nkf]=(next[nkf]||0)+p*w2;
              continue;
            }
            var flag = consumed;
            if(flag==='0' && berrySpec && newHp<=berrySpec.threshold){
              newHp = Math.min(maxHp, newHp+berrySpec.amount);
              flag='1';
            }
            var nk3='r'+newHp+'_'+flag;
            next[nk3]=(next[nk3]||0)+p*w2;
          }
        }
      }
      states = next;
    }
    return states;
  }
  function faintProbOf(states){
    var total = 0;
    for(var key in states){ if(key.charAt(0)==='f') total += states[key]; }
    return total;
  }
  function initialStatesFor(subHp, startHp){
    if(subHp!=null) return freshStates();
    var s = Object.create(null); s['r'+startHp+'_0']=1; return s;
  }
  // Accuracy-gated version for トリプルキック etc: a miss at any point stops the sequence,
  // leaving that path's state (still phase-tagged) untouched from then on.
  function applyHitSequenceFullSequential(states, hitDists, subHp, startHp, maxHp, berrySpec, accProb, maxHits){
    var stopped = Object.create(null);
    for(var h=0; h<maxHits; h++){
      var hitDist = hitDists[h], next = Object.create(null);
      for(var key in states){
        var p = states[key];
        stopped[key] = (stopped[key]||0) + p*(1-accProb);
        if(key.charAt(0)==='f'){ next[key]=(next[key]||0)+p*accProb; continue; }
        var phase = key.charAt(0);
        if(phase==='s'){
          var cum = Number(key.slice(1));
          for(var hd in hitDist){
            var w = hitDist[hd]*accProb;
            var newSub = cum+Number(hd);
            if(newSub>=subHp){ var nk='r'+startHp+'_0'; next[nk]=(next[nk]||0)+p*w; }
            else { var nk2='s'+newSub; next[nk2]=(next[nk2]||0)+p*w; }
          }
        } else {
          var us = key.slice(1).split('_'), hpNow=Number(us[0]), consumed=us[1];
          for(var hd2 in hitDist){
            var w2 = hitDist[hd2]*accProb;
            var newHp = hpNow-Number(hd2);
            if(newHp<=0){ var nkf='f'+newHp+'_'+consumed; next[nkf]=(next[nkf]||0)+p*w2; continue; }
            var flag = consumed;
            if(flag==='0' && berrySpec && newHp<=berrySpec.threshold){ newHp=Math.min(maxHp,newHp+berrySpec.amount); flag='1'; }
            var nk3='r'+newHp+'_'+flag;
            next[nk3]=(next[nk3]||0)+p*w2;
          }
        }
      }
      states = next;
    }
    for(var key2 in states) stopped[key2] = (stopped[key2]||0) + states[key2];
    return stopped;
  }

  // v2.4.0: applyHitSequenceFullと同じ遷移だが、状態キーの末尾に「この技で与えたダメージ」
  // ('|<dealt>')を持たせる(反動・吸収の計算用)。与えたダメージは、みがわりへはみがわりの残りHP、
  // 本体へは残りHPを上限とする(オーバーキル分は含めない)。きのみの回復は与えたダメージに影響しない。
  function applyHitSequenceFullTracked(states, hitDists, subHp, startHp, maxHp, berrySpec){
    for(var h=0; h<hitDists.length; h++){
      var hitDist = hitDists[h], next = Object.create(null);
      for(var fullKey in states){
        var p = states[fullKey];
        var bar = fullKey.indexOf('|');
        var key = fullKey.slice(0, bar), dealt = Number(fullKey.slice(bar+1));
        if(key.charAt(0)==='f'){ next[fullKey]=(next[fullKey]||0)+p; continue; }
        if(key.charAt(0)==='s'){
          var cum = Number(key.slice(1));
          for(var hd in hitDist){
            var w = hitDist[hd], dmg = Number(hd);
            var inc = Math.min(dmg, subHp - cum);
            var nk = (cum+dmg>=subHp) ? ('r'+startHp+'_0') : ('s'+(cum+dmg));
            nk += '|' + (dealt+inc);
            next[nk]=(next[nk]||0)+p*w;
          }
        } else {
          var us = key.slice(1).split('_'), hpNow=Number(us[0]), consumed=us[1];
          for(var hd2 in hitDist){
            var w2 = hitDist[hd2], dmg2 = Number(hd2);
            var inc2 = Math.min(dmg2, hpNow);
            var newHp = hpNow-dmg2, nk3;
            if(newHp<=0){ nk3 = 'f'+newHp+'_'+consumed; }
            else {
              var flag = consumed;
              if(flag==='0' && berrySpec && newHp<=berrySpec.threshold){ newHp = Math.min(maxHp, newHp+berrySpec.amount); flag='1'; }
              nk3 = 'r'+newHp+'_'+flag;
            }
            nk3 += '|' + (dealt+inc2);
            next[nk3]=(next[nk3]||0)+p*w2;
          }
        }
      }
      states = next;
    }
    return states;
  }
  function addDealtSuffix(states){ var out=Object.create(null); for(var k in states){ var nk=k+'|0'; out[nk]=(out[nk]||0)+states[k]; } return out; }

  function resolveThroughSubstitute(hitDists, subHp){
    return bodyDamageOf(applyHitSequence(freshStates(), hitDists, subHp));
  }
  function resolveThroughSubstituteSequential(hitDists, subHp, accProb, maxHits){
    return bodyDamageOf(applyHitSequenceSequential(freshStates(), hitDists, subHp, accProb, maxHits));
  }

  function getMultiHitCategory(result,input,o){
    var effMove = result.effectiveMove || input.move;
    var n = moveName(result,input);
    if(effMove && (effMove.isZMove || effMove.isSignatureZ || effMove.isMaxMove)) return {type:'single'};
    if(n==='ふくろだたき'){
      var count=1;
      for(var k=1;k<=5;k++){ if(o['beatUpAlly'+k] && o['beatUpAlly'+k]!=='none') count++; }
      return {type:'fixed', count:Math.max(1,count)};
    }
    if(n==='トリプルキック'||n==='トリプルアクセル') return {type:'perHitAcc', max:3};
    if(n==='ネズミざん') return {type:'perHitAcc', max:10};
    if(n==='みずしゅりけん' && window.DAMEKE_DATA_HELPERS.pokemonMatches(input.attacker,['ゲッコウガ(サトシ)','greninja_ash'])) return {type:'fixed', count:3};
    var aAb = result.__coreState && result.__coreState.attackerAbility;
    var aAbState = result.__coreState && result.__coreState.attackerAbilityState;
    var parentalActive = aAbState && aAbState.active && aAb && aAb.name==='おやこあい' && !getHitSpec(effMove);
    if(parentalActive && (result.effectiveCategory==='物理'||result.effectiveCategory==='特殊')) return {type:'fixed', count:2};
    var spec = getHitSpec(effMove);
    if(spec){
      if(spec.fixed) return {type:'fixed', count:spec.max};
      return {type:'variable2to5', min:spec.min, max:spec.max};
    }
    return {type:'single'};
  }

  // Discrete P(exactly k hits), GIVEN the entry accuracy check already passed. Only used for
  // categories where hit-count is independent of per-hit damage (i.e. not perHitAcc-without-modifiers).
  function getHitCountDist(category, hasSkillLink, hasLoadedDice){
    if(category.type==='single') return {1:1};
    if(category.type==='fixed') { var d={}; d[category.count]=1; return d; }
    var max = category.max;
    if(hasSkillLink){ var d2={}; d2[max]=1; return d2; }
    if(hasLoadedDice){
      var guaranteed = Math.min(4,max);
      if(guaranteed>=max){ var d3={}; d3[max]=1; return d3; }
      var slots = max-guaranteed+1, out={};
      for(var k=guaranteed;k<=max;k++) out[k]=1/slots;
      return out;
    }
    // 2～5回の連続攻撃: 2回35%・3回35%・4回15%・5回15%。
    if(category.type==='variable2to5') return {2:0.35, 3:0.35, 4:0.15, 5:0.15};
    return null; // perHitAcc without modifiers -- handled by the joint DP instead
  }

  // 単体の瀕死率: 急所発生確率・連続攻撃の回数分布・命中判定・みがわり・回復きのみ・
  // きあいのハチマキを織り込んだ、実際に瀕死する確率(%)。v2.5.0から1ヒット単位の状態
  // シミュレーション(buildHitModel/runHitModel、技①→技②連続計算と共通)で計算する。
  C.computeFaintProbability = function(input, mainResult){
    try{
      var result = (mainResult && !mainResult.__effectsAdjusted) ? mainResult : C.calculateDamage(input);
      var fsFlag = false;
      if(isFutureSightMove(input, result)){ input = futureSightInput(input); result = C.calculateDamage(input); fsFlag = true; }
      if(result.accuracyResult==='当たらない') return 0;
      var hp = result.defenderCurrentHp;
      if(!hp || hp<=0) return 0;
      if(result.isInvalid) return 0;
      if((result.effectiveCategory)==='変化') return 0;
      // v2.5.0: 技②と同じパイプライン(1ヒット単位。連続攻撃・おやこあいの途中の効果も反映)。
      var eff = resolveMove1Effects(input, result, input);
      eff.plan = eff.plan.filter(function(pev){ return pev.stage === 'hit' || pev.stage === 'pre'; });
      var reg = makeRegistry();
      var m0 = eff.newState(), mk0 = reg.id(m0);
      var P = makeMoveContext(input, result, 'prob', 2, eff, reg, mk0, eff.attackerMaxHp, { noChargeBoost: true, futureSight: fsFlag });
      P.track = false;
      var dist = runMovePipeline(P, { sub: P.env.subHp != null ? 0 : null, hp: hp, bf: 0, fn: 0, dealt: 0, crit: 0, bh: 0,
                                      aHp: eff.attackerStartHp != null ? eff.attackerStartHp : null, hit: 0, m: m0, mk: mk0 });
      var t = 0; for(var k in dist) if(dist[k].s.fn) t += dist[k].p;
      return roundPct2(t);
    } catch(e){
      if(window.console && console.error) console.error('[faintProbability] failed:', e);
      return null;
    }
  };

  // ==== v2.4.0 技①の追加効果 → 技②への反映 ====
  // 追加効果は「強化処理(Z/ダイマックス等)を経た後の技名」(result.moveName)で引く。
  // 表(window.DAMEKE_MOVE_EFFECTS)の各効果の種類(k)は、表の定義ブロック冒頭のコメントを参照。
  // 発生判定の前提:
  //  ・技①が外れた/無効化された分岐では、溜めターンの効果(oc)・自爆系・とびげり系の反動・
  //    自分のこおり解凍以外は発生しない。
  //  ・相手への効果は、みがわり(有効時)・りんぷん・おんみつマントで無効(種類ごとの例外あり)。
  //  ・ちからずく有効かつ技がちからずく対象なら、追加効果は発生しない。
  //  ・おやこあい等の固定回数連続攻撃では、追加効果はヒットごとに独立に判定する。
  //  ・確率100%以上の効果は「確定」として、ダメージ・割合・確定数の表示用計算にも反映する。
  //    100%未満の効果は瀕死率(確率分布)の計算でのみ分岐として考慮する。
  var RANK_KEYS = ['A','B','C','D','S','acc','eva'];
  var RANK_LABEL = {A:'こうげき',B:'ぼうぎょ',C:'とくこう',D:'とくぼう',S:'すばやさ',acc:'命中',eva:'回避'};
  var RANK_DROP_BLOCK_ALL = ['しろいけむり','クリアボディ','メタルプロテクト'];
  var RANK_DROP_BLOCK_STAT = { A:['かいりきバサミ'], B:['はとむね'], acc:['するどいめ','はっこう','しんがん'] };
  // 状態異常ごとの無効化特性(フラワーベール・リーフガード・うるおいボディ・リミットシールドは
  // 条件付きのため別途判定)。
  var STATUS_BLOCK_ABILITY = {
    'まひ': ['じゅうなん'],
    'やけど': ['すいほう','ねつこうかん','みずのベール'],
    'ねむり': ['やるき','ふみん'],
    'こおり': ['マグマのよろい'],
    'どく': ['めんえき','パステルベール'],
    'もうどく': ['めんえき','パステルベール']
  };
  var STATUS_IMMUNE_TYPES = { 'まひ':['でんき'], 'やけど':['ほのお'], 'こおり':['こおり'], 'どく':['どく','はがね'], 'もうどく':['どく','はがね'], 'ねむり':[] };
  var STATUS_CURE_BERRY = { 'まひ':'クラボのみ', 'やけど':'チーゴのみ', 'ねむり':'カゴのみ', 'こおり':'ナナシのみ', 'どく':'モモンのみ', 'もうどく':'モモンのみ' };
  var RANK_BERRY = { 'チイラのみ':{A:1}, 'リュガのみ':{B:1}, 'カムラのみ':{S:1}, 'ヤタピのみ':{C:1}, 'ズアのみ':{D:1}, 'アッキのみ':{B:1}, 'タラプのみ':{D:1} };
  var FLING_STATUS = { 'でんきだま':'まひ', 'かえんだま':'やけど', 'どくバリ':'どく', 'どくどくだま':'もうどく' };
  var FLING_FLINCH = ['おうじゃのしるし','するどいキバ'];
  // 追加効果として「相手」に働く効果のうち、りんぷん/おんみつマントで無効化されない種類
  var SHIELD_DUST_EXEMPT = { bind:1, cure:1, thawTarget:1, rankReset:1, smack:1, coreEnforcer:1, thief:1, pluck:1, knockOff:1, incinerate:1, fieldClear:1, screenClear:1 };
  // みがわりで無効化されない種類(相手への効果のうち)
  var SUBSTITUTE_EXEMPT = { coreEnforcer:1, fieldClear:1, screenClear:1 };
  // 相手に働く効果の種類(自分に働く効果=みがわり・りんぷんと無関係)
  var TARGET_KINDS = { status:1, statusOneOf:1, confuse:1, bind:1, saltCure:1, rankReset:1, healBlock:1, pluck:1, fling:1, knockOff:1, incinerate:1, thief:1, smack:1, coreEnforcer:1, cure:1, thawTarget:1 };
  // ちからずくの対象になりうる(=技にちからずくタグがあれば消える)種類
  var SHEER_FORCE_KINDS = { rank:1, status:1, statusOneOf:1, confuse:1, saltCure:1, healBlock:1, note:1 };
  // 効果の処理順(小さいほど先)。同じ順位の中では表の記載順。
  var KIND_ORDER = { thawSelf:0, relicSong:1, cure:1, thawTarget:1, status:2, statusOneOf:2, confuse:2, rank:3, pluck:5, fling:5, knockOff:6, incinerate:6, thief:6, rankReset:7, healBlock:7, smack:7, coreEnforcer:7, fieldClear:7, screenClear:7, burnUp:7, doubleShock:7, setWeather:7, setField:7, gravity:7, cureSelf:0, gmaxRapid:7, finaleHeal:8, eotGmax:9, seaOfFire:9, recoil:8, drain:8, crash:8, selfKO:8, selfHalf:8, chloro:8, struggle:8, bind:9, saltCure:9, note:10 };

  // v2.5.0 パイプライン: 効果が処理される段階(「技の効果」の手順番号に対応)。
  //  pre : 命中判定より前(自分のこおり解凍(成功判定7)・HP消費(成功判定27)・壁の破壊(成功判定58))
  //  hit : 1ヒットごと(9-1 なげつける / 9-2 追加効果・自分のランク変化・HP吸収・ダイマックスわざの効果 /
  //        10-1 コアパニッシャー / 10-3 クリアスモッグ / 10-9 やきつくす)
  //  post: 全ヒット終了後(15 反動・バインド・持ち物関連・うちおとす・解凍等 / 19 いにしえのうた /
  //        25 もえつきる・アイアンローラー・いっちょうあがり 等)
  //  eot : ターン終了時(ひのうみ・みずあめボム等)
  function effectStageOf(e, name){
    // ひみつのちからの追加効果は手順15(全ヒット後に1回。おやこあいでも1回)。
    if(name==='ひみつのちから' && e.k!=='note') return 'post';
    switch(e.k){
      case 'thawSelf': case 'selfHalf': case 'screenClear': return 'pre';
      case 'rank':
        if(e.eot) return 'eot';
        if(e.oc) return 'pre';   // 溜めターン(成功判定23)の上昇は、技①自身のダメージから反映する
        if(name==='スケイルショット') return 'post';
        if(e.cond && String(e.cond).indexOf('orderUp:')===0) return 'post';
        return 'hit';
      case 'status': case 'statusOneOf': case 'confuse': case 'drain': case 'fling': case 'healBlock': case 'saltCure':
      case 'setWeather': case 'setField': case 'gravity': case 'gmaxRapid': case 'finaleHeal': case 'cureSelf': case 'eotGmax':
      case 'coreEnforcer': case 'rankReset': case 'incinerate':
        return 'hit';
      case 'seaOfFire': return 'eot';
      default: return 'post';
    }
  }
  // 処理の順番(「技の効果」の手順番号×100程度。同じ段階の中での順序づけに使う)。
  //  pre : 7 自分のこおり解凍 / 23 溜めターン / 27 HP消費 / 58 壁の破壊
  //  hit : 910 なげつける / 921～925 追加効果等 / 1010 コアパニッシャー / 1030 クリアスモッグ / 1090 やきつくす
  //  post: 1110 自分がひんし / 1501～1506 手順15 / 1900 いにしえのうた / 2500 手順25
  var HIT_AT = { fling:910, status:921, statusOneOf:921, confuse:921, rank:923, drain:924, healBlock:924, saltCure:924,
                 setWeather:925, setField:925, gravity:925, gmaxRapid:925, finaleHeal:925, cureSelf:925, eotGmax:925,
                 coreEnforcer:1010, rankReset:1030, incinerate:1090 };
  var POST_AT = { recoil:1501, struggle:1501, chloro:1501, crash:1501, bind:1502, knockOff:1504, thief:1504, pluck:1504, smack:1505,
                  thawTarget:1506, cure:1506, relicSong:1900, burnUp:2500, doubleShock:2500, fieldClear:2500, selfKO:1110 };
  function effectAt(pev, name){
    var st = pev.stage, e = pev.e;
    if(st==='pre') return e.k==='thawSelf' ? 7 : (e.k==='rank' ? 23 : (e.k==='selfHalf' ? 27 : 58));
    if(st==='hit') return HIT_AT[e.k] != null ? HIT_AT[e.k] : 925;
    if(st==='post'){
      if(name==='ひみつのちから') return 1502.5;
      if(e.k==='rank'){
        if(e.oc) return 2990;
        if(e.cond && String(e.cond).indexOf('orderUp:')===0) return 2500;
        return 1503; // スケイルショット
      }
      return POST_AT[e.k] != null ? POST_AT[e.k] : 2500;
    }
    if(e.k==='rank') return 5300;   // みずあめボム(ターン終了時のすばやさ低下)
    return 5000;                     // ひのうみ(ダメージ量の登録。ダメージ自体は手順6aで与える)
  }

  function effectSideCtx(result, input, side){
    var core = result.__coreState || {};
    var o = input.options || {};
    var S = window.DAMEKE_CALC_SHARED;
    var ab = side==='A' ? core.attackerAbility : core.defenderAbility;
    var abSt = side==='A' ? core.attackerAbilityState : core.defenderAbilityState;
    var it = side==='A' ? core.attackerItem : core.defenderItem;
    var itSt = side==='A' ? core.attackerItemState : core.defenderItemState;
    var tera = side==='A' ? o.attackerTeraType : o.defenderTeraType;
    var calcTypes = side==='A' ? S.attackerCalcTypes(result) : S.defenderCalcTypes(result);
    var types = (tera && tera!=='なし' && tera!=='ステラ') ? [tera] : calcTypes;
    var heldId = side==='A' ? (o.attackerNoItem ? 'none' : (o.attackerItemId||'none')) : (o.defenderNoItem ? 'none' : (o.defenderItemId||'none'));
    var heldItem = heldId==='none' ? null : ((window.DAMEKE_DATA.items||[]).find(function(x){ return x.id===heldId; }) || null);
    var hpLine = (result.trace||[]).find(function(x){ return String(x.label).indexOf(side==='A' ? '攻撃側ランク補正込み実数値' : '防御側ランク補正込み実数値') >= 0; });
    var hpM = hpLine && String(hpLine.value||'').match(/(\d+)\/(\d+)/);
    return {
      ability: (abSt && abSt.active && ab) ? ab.name : null,
      // かたやぶり等で無視されていても、特性自体は持っている(手順27の状態異常回復などで使う)。
      abilityRaw: (ab && abSt && (abSt.active || /かたやぶり/.test(String(abSt.reason||'')))) ? ab.name : null,
      item: (itSt && itSt.active && it && it.id!=='none') ? it.name : null,
      heldItem: heldItem,
      types: types,
      grass: types.indexOf('くさ')>=0,
      grounded: S.isGrounded(result, side),
      weather: side==='A' ? (result.attackerEffectiveWeather||o.weather||'なし') : (result.defenderEffectiveWeather||o.weather||'なし'),
      pokemon: side==='A' ? input.attacker : input.defender,
      hpCur: hpM ? Number(hpM[1]) : null,
      hpMax: hpM ? Number(hpM[2]) : null,
      label: side==='A' ? '攻撃側' : '防御側'
    };
  }
  function readRanks(stats){
    var out = {}, r = (stats && stats.ranks) || {};
    RANK_KEYS.forEach(function(k){ var n = parseInt(r[k],10); out[k] = Number.isFinite(n) ? n : 0; });
    return out;
  }
  function fmtDelta(d){ return Object.keys(d).filter(function(k){ return d[k]; }).map(function(k){ return RANK_LABEL[k]+(d[k]>0?'+':'')+d[k]; }).join('、'); }
  function isSunny(w){ return w==='にほんばれ' || w==='おおひでり'; }
  function isRainy(w){ return w==='あめ' || w==='おおあめ'; }

  // ---- 効果シミュレーション用の状態 ----
  function newEffectState(ctx, input2){
    var o2 = input2.options || {};
    return {
      ranks: { A: readRanks(o2.attackerStats), D: readRanks(o2.defenderStats) },
      itemGone: {A:false, D:false},
      status: { A: (o2.attackerToxic && o2.attackerStatus==='どく') ? 'もうどく' : (o2.attackerStatus || 'なし'),
                D: (o2.defenderToxic && o2.defenderStatus==='どく') ? 'もうどく' : (o2.defenderStatus || 'なし') },
      confusion: !!o2.defenderConfusion,
      extra: toxicCounts(o2),       // 技②のoptionsへそのまま上書きする値(フィールド・壁・タイプ喪失など)
      hp: { recoil:null, drain:null, aLoss:0, aFaint:false, aHeal:0, finale:false, dBind:0, dSalt:0, dGmax:0, dSea:0, dHeal:0, dLoss:0 },
      logs: []
    };
  }
  function lg(state, side, text){ state.logs.push({s:side, t:text}); }
  // もうどくの経過カウント(入力。ターン終了時のダメージ = 最大HP×n/16)。
  function toxicCounts(o){
    var x = {};
    ['attacker','defender'].forEach(function(pre, i){
      if(o[pre+'Toxic'] && o[pre+'Status']==='どく'){ var n = parseInt(o[pre+'ToxicCount'],10); (x.toxicN || (x.toxicN = {}))[i ? 'D' : 'A'] = (n >= 1 && n <= 15) ? n : 1; }
    });
    return x;
  }

  // 1回分のランク変動(targetSide側へ、sourceSide側が原因)を、無効化・倍化/反転・まけんき/かちき・
  // ミラーアーマー・しろいハーブ・びんじょう/ものまねハーブまで含めて解決し、stateを更新する。
  function applyRankEvent(state, ctx, targetSide, deltas, sourceSide){
    var gains = {A:{}, D:{}};
    function other(s){ return s==='A' ? 'D' : 'A'; }
    function ability(s){ return ctx[s].ability; }
    function item(s){ return state.itemGone[s] ? null : ctx[s].item; }
    function modify(s, d){
      var out = {};
      Object.keys(d).forEach(function(k){
        var v = d[k];
        if(ability(s)==='たんじゅん') v = v*2;
        if(ability(s)==='あまのじゃく') v = -v;
        out[k] = v;
      });
      return out;
    }
    function applyRaw(s, d){
      var actual = {};
      Object.keys(d).forEach(function(k){
        var before = state.ranks[s][k];
        var after = Math.max(-6, Math.min(6, before + d[k]));
        state.ranks[s][k] = after;
        actual[k] = after - before;
        if(actual[k] > 0) gains[s][k] = (gains[s][k]||0) + actual[k];
        if(actual[k] < 0){ var dr = state.extra.drops || (state.extra.drops = {}); dr[s] = 1; }
      });
      return actual;
    }
    function whiteHerb(s){
      if(item(s)!=='しろいハーブ') return;
      var neg = RANK_KEYS.filter(function(k){ return state.ranks[s][k] < 0; });
      if(!neg.length) return;
      neg.forEach(function(k){ state.ranks[s][k] = 0; });
      state.itemGone[s] = true;
      lg(state, s, 'しろいハーブ: 下がった能力を元に戻す('+neg.map(function(k){return RANK_LABEL[k];}).join('、')+')');
    }
    function opponentCaused(tSide, d, sSide, allowReflect){
      var md = modify(tSide, d);
      var apply = {}, reflected = {}, blocked = [];
      Object.keys(md).forEach(function(k){
        var v = md[k];
        if(v < 0){
          var ab = ability(tSide);
          if(allowReflect && ab==='ミラーアーマー'){ reflected[k] = d[k]; return; }
          if(ab && (RANK_DROP_BLOCK_ALL.indexOf(ab)>=0 || (ab==='フラワーベール' && ctx[tSide].grass) || (RANK_DROP_BLOCK_STAT[k]||[]).indexOf(ab)>=0 || (!allowReflect && ab==='ミラーアーマー'))){ blocked.push(RANK_LABEL[k]+'('+ab+')'); return; }
          if(item(tSide)==='クリアチャーム'){ blocked.push(RANK_LABEL[k]+'(クリアチャーム)'); return; }
        }
        apply[k] = v;
      });
      if(blocked.length) lg(state, tSide, blocked.join('、')+'で無効');
      var actual = applyRaw(tSide, apply);
      var txt = fmtDelta(actual);
      if(txt) lg(state, tSide, txt);
      else if(Object.keys(apply).length) lg(state, tSide, 'ランク変化なし(上限/下限)');
      var lowered = Object.keys(actual).some(function(k){ return actual[k] < 0; });
      if(lowered && ability(tSide)==='まけんき'){ var a1 = applyRaw(tSide, modify(tSide,{A:2})); lg(state, tSide, 'まけんき: '+(fmtDelta(a1)||'変化なし')); }
      if(lowered && ability(tSide)==='かちき'){ var a2 = applyRaw(tSide, modify(tSide,{C:2})); lg(state, tSide, 'かちき: '+(fmtDelta(a2)||'変化なし')); }
      if(Object.keys(reflected).length){
        lg(state, tSide, 'ミラーアーマーで'+ctx[sSide].label+'へ跳ね返す');
        opponentCaused(sSide, reflected, tSide, false);
      }
    }
    if(targetSide === sourceSide){
      var actualSelf = applyRaw(targetSide, modify(targetSide, deltas));
      lg(state, targetSide, fmtDelta(actualSelf)||'ランク変化なし(上限/下限)');
    } else {
      opponentCaused(targetSide, deltas, sourceSide, true);
    }
    // v2.5.0: しろいハーブ(手順28)・びんじょう(手順27)・ものまねハーブ(手順28)は技の後にまとめて処理する
    // (afterMoveRankItems)。ここでは、この技の間に実際に上昇した分を記録するだけ。
    ['A','D'].forEach(function(s){
      var g = gains[s];
      if(!Object.keys(g).length) return;
      var acc = state.extra.gains || (state.extra.gains = {});
      var gs = acc[s] || (acc[s] = {});
      Object.keys(g).forEach(function(k){ gs[k] = (gs[k]||0) + g[k]; });
    });
  }
  // 技の後の処理: 手順27 びんじょう → 手順28 しろいハーブ・ものまねハーブ(攻撃側→防御側の順)。
  // gains(この技で相手が上昇した分)は処理後に消去する。
  function afterMoveRankItems(state, ctx, sides, part){
    sides = sides || ['A','D'];
    var gains = state.extra.gains || {};
    function other(s){ return s==='A' ? 'D' : 'A'; }
    function modify(s, d){
      var out = {};
      Object.keys(d).forEach(function(k){ var v = d[k]; if(ctx[s].ability==='たんじゅん') v = v*2; if(ctx[s].ability==='あまのじゃく') v = -v; out[k] = v; });
      return out;
    }
    function copyFrom(t, src){
      var g = gains[other(t)] || {};
      if(!Object.keys(g).length) return false;
      var md = modify(t, g);
      var before = {}; RANK_KEYS.forEach(function(k){ before[k] = state.ranks[t][k]; });
      Object.keys(md).forEach(function(k){ state.ranks[t][k] = Math.max(-6, Math.min(6, state.ranks[t][k] + md[k])); });
      var act = {}; RANK_KEYS.forEach(function(k){ act[k] = state.ranks[t][k] - before[k]; });
      lg(state, t, src+': '+(fmtDelta(act)||'変化なし'));
      return true;
    }
    if(part !== 'item') sides.forEach(function(t){ if(ctx[t].ability==='びんじょう') copyFrom(t, 'びんじょう'); });
    if(part === 'ability') return;
    sides.forEach(function(t){
      if(ctx[t].item==='しろいハーブ' && !state.itemGone[t]){
        var neg = RANK_KEYS.filter(function(k){ return state.ranks[t][k] < 0; });
        if(neg.length){
          neg.forEach(function(k){ state.ranks[t][k] = 0; });
          consumeItem(state, ctx, t, false);
          lg(state, t, 'しろいハーブ: 下がった能力を元に戻す('+neg.map(function(k){return RANK_LABEL[k];}).join('、')+')');
        }
      }
      if(ctx[t].item==='ものまねハーブ' && !state.itemGone[t]){
        if(copyFrom(t, 'ものまねハーブ')) consumeItem(state, ctx, t, false);
      }
    });
    delete state.extra.gains;
  }

  // 持ち物を失う(消費・はたきおとす等)。かるわざの発動と、きのみを食べた場合のほおぶくろ(最大HPの1/3回復)も処理する。
  // eaten: きのみを食べた(ほおぶくろの対象)ならtrue。
  function consumeItem(state, ctx, side, eaten){
    state.itemGone[side] = true;
    if(state.extra.item) state.extra.item[side] = null;
    if(ctx[side].ability==='かるわざ'){ var ub = state.extra.unburden || (state.extra.unburden = {}); if(!ub[side]){ ub[side] = true; lg(state, side, 'かるわざ発動'); } }
    if(eaten){
      var hn = ctx[side].heldItem ? ctx[side].heldItem.name : null;
      if(hn){ var ea = state.extra.eaten || (state.extra.eaten = {}); ea[side] = hn; }
      cheekPouch(state, ctx, side);
    }
  }
  function setHeldItem(state, side, name){
    var it = state.extra.item || (state.extra.item = {});
    it[side] = name;
    state.itemGone[side] = !name;
  }
  function cheekPouch(state, ctx, side){
    if(ctx[side].ability!=='ほおぶくろ' || !ctx[side].hpMax) return;
    var h = Math.floor(ctx[side].hpMax/3);
    if(h <= 0) return;
    if(side==='A') state.hp.aHeal += h; else state.hp.dHeal += h;
    lg(state, side, 'ほおぶくろ: HP'+h+'回復');
  }
  // 状態異常をsideへ付与しようとする。source: 原因となった側(シンクロの判定用)。
  // 戻り値: 実際に付与されたらtrue。
  function tryInflictStatus(state, ctx, side, st, sourceSide, allowSync){
    var c = ctx[side];
    var ab = c.ability, it = state.itemGone[side] ? null : c.item;
    if(state.status[side] !== 'なし'){ lg(state, side, st+'：既に'+state.status[side]+'のため無効'); return false; }
    var reason = null;
    if(ab==='きよめのしお' || ab==='ぜったいねむり') reason = ab;
    else if(ab && (STATUS_BLOCK_ABILITY[st]||[]).indexOf(ab)>=0) reason = ab;
    else if(ab==='リーフガード' && isSunny(c.weather)) reason = 'リーフガード';
    else if(ab==='うるおいボディ' && isRainy(c.weather)) reason = 'うるおいボディ';
    else if(ab==='フラワーベール' && c.grass) reason = 'フラワーベール';
    else if(ab==='リミットシールド' && c.pokemon && c.pokemon.name==='メテノ(りゅうせい)') reason = 'リミットシールド';
    if(!reason){
      var immTypes = STATUS_IMMUNE_TYPES[st] || [];
      var corrosion = (st==='どく'||st==='もうどく') && ctx[sourceSide].ability==='ふしょく' && sourceSide!==side;
      var hitType = immTypes.filter(function(t){ return c.types.indexOf(t)>=0; })[0];
      if(hitType && !(corrosion && (hitType==='どく'||hitType==='はがね'))) reason = hitType+'タイプ';
    }
    var fieldNow = state.extra.field || ctx.field;
    if(!reason && c.grounded && fieldNow==='ミストフィールド') reason = 'ミストフィールド';
    if(!reason && st==='ねむり' && c.grounded && fieldNow==='エレキフィールド') reason = 'エレキフィールド';
    if(!reason && st==='こおり' && isSunny(c.weather)) reason = 'にほんばれ';
    if(reason){ lg(state, side, st+'：'+reason+'で無効'); return false; }
    var berry = STATUS_CURE_BERRY[st];
    if(it && (it===berry || it==='ラムのみ')){
      lg(state, side, st+' → '+it+'で回復(持ち物消費)');
      consumeItem(state, ctx, side, true);
    } else {
      state.status[side] = st;
      lg(state, side, st);
      // どくくぐつ: 攻撃側の技(追加効果・どくしゅ等)でどく/もうどくにしたとき、こんらんにもする。
      if(side==='D' && sourceSide==='A' && (st==='どく'||st==='もうどく') && ctx.A.ability==='どくくぐつ'){ lg(state, 'A', 'どくくぐつ'); tryConfuse(state, ctx); }
    }
    // シンクロ: やけど・まひ・どく・もうどくのみ、原因側へ同じ状態異常を返す。
    if(allowSync && side!==sourceSide && ab==='シンクロ' && ['やけど','まひ','どく','もうどく'].indexOf(st)>=0){
      lg(state, side, 'シンクロ: '+ctx[sourceSide].label+'へ'+st);
      tryInflictStatus(state, ctx, sourceSide, st, side, false);
    }
    return true;
  }
  function tryConfuse(state, ctx){
    var c = ctx.D, ab = c.ability, it = state.itemGone.D ? null : c.item;
    if(state.confusion){ lg(state, 'D', 'こんらん：既にこんらん'); return; }
    if(ab==='マイペース'){ lg(state, 'D', 'こんらん：マイペースで無効'); return; }
    if(c.grounded && (state.extra.field||ctx.field)==='ミストフィールド'){ lg(state, 'D', 'こんらん：ミストフィールドで無効'); return; }
    if(it==='キーのみ' || it==='ラムのみ'){ lg(state, 'D', 'こんらん → '+it+'で回復(持ち物消費)'); consumeItem(state, ctx, 'D', true); return; }
    state.confusion = true;
    lg(state, 'D', 'こんらん');
  }
  // きのみを食べた側(side)への効果(ついばむ/むしくいで攻撃側が食べる・なげつけるで防御側が食べる)。
  function applyBerryEffect(state, ctx, side, berryName, maxHp){
    if(STATUS_CURE_BERRY.まひ===berryName && state.status[side]==='まひ'){ state.status[side]='なし'; lg(state, side, berryName+': まひ回復'); return; }
    if(berryName==='カゴのみ' && state.status[side]==='ねむり'){ state.status[side]='なし'; lg(state, side, berryName+': ねむり回復'); return; }
    if(berryName==='モモンのみ' && (state.status[side]==='どく'||state.status[side]==='もうどく')){ state.status[side]='なし'; lg(state, side, berryName+': どく回復'); return; }
    if(berryName==='チーゴのみ' && state.status[side]==='やけど'){ state.status[side]='なし'; lg(state, side, berryName+': やけど回復'); return; }
    if(berryName==='ナナシのみ' && state.status[side]==='こおり'){ state.status[side]='なし'; lg(state, side, berryName+': こおり回復'); return; }
    if(berryName==='ラムのみ'){ if(state.status[side]!=='なし'){ lg(state, side, berryName+': '+state.status[side]+'回復'); state.status[side]='なし'; } if(side==='D' && state.confusion){ state.confusion=false; lg(state, side, berryName+': こんらん回復'); } return; }
    if(berryName==='キーのみ'){ if(side==='D' && state.confusion){ state.confusion=false; lg(state, side, berryName+': こんらん回復'); } else lg(state, side, berryName+': こんらん回復(記述のみ)'); return; }
    var heal = 0;
    if(berryName==='オボンのみ' || berryName==='ナゾのみ') heal = Math.floor(maxHp/4);
    else if(['フィラのみ','ウイのみ','マゴのみ','バンジのみ','イアのみ'].indexOf(berryName)>=0) heal = Math.floor(maxHp/3);
    else if(berryName==='オレンのみ') heal = 10;
    if(heal > 0){
      if(side==='A') state.hp.aHeal += heal; else state.hp.dHeal += heal;
      lg(state, side, berryName+': HP'+heal+'回復');
      return;
    }
    if(RANK_BERRY[berryName]){ lg(state, side, '['+berryName+']'); applyRankEvent(state, ctx, side, RANK_BERRY[berryName], side); return; }
    if(berryName==='サンのみ'){ if(side==='A'){ state.extra.critPlus = (state.extra.critPlus||0) + 2; lg(state, side, 'サンのみ: 急所ランク+2'); } else lg(state, side, 'サンのみ: 急所ランク+2(記述のみ)'); return; }
    if(berryName==='ミクルのみ'){ if(side==='A'){ state.extra.micle = true; lg(state, side, 'ミクルのみ: 次の技の命中率アップ'); } else lg(state, side, 'ミクルのみ(記述のみ)'); return; }
    if(berryName==='スターのみ'){ lg(state, side, 'スターのみ: ランダムな能力+2(記述のみ)'); return; }
    if(berryName==='ヒメリのみ'){ lg(state, side, 'ヒメリのみ: PP10回復(記述のみ)'); return; }
    lg(state, side, berryName+': 効果なし');
  }
  // はたきおとす/どろぼう/ほしがるで持ち物を失う(奪われる)かどうか(calc本体のはたきおとす威力
  // 判定と同じ条件: フォルムと結びつく持ち物・Zクリスタルは対象外)。
  function itemRemovable(ctx, side){
    var it = ctx[side].heldItem;
    if(!it) return false;
    var D = window.DAMEKE_DATA;
    if(D.findFormByLinkedItem && D.findFormByLinkedItem(ctx[side].pokemon, it.name)) return false;
    if(/Z$/.test(it.name||'')) return false;
    return true;
  }

  function effectConditionMet(e, input1, result1){
    if(!e.cond) return true;
    var o = input1.options || {};
    if(e.cond==='stellarTera') return o.attackerTeraType==='ステラ';
    if(e.cond.indexOf('field:')===0) return (o.field||'なし')===e.cond.slice(6);
    if(e.cond.indexOf('fieldNot:')===0) return e.cond.slice(9).split('|').indexOf(o.field||'なし') < 0;
    if(e.cond.indexOf('orderUp:')===0) return (o.orderUpForm||'なし')===e.cond.slice(8);
    if(e.cond==='oppositeGender') return (o.attackerGender==='male' && o.defenderGender==='female') || (o.attackerGender==='female' && o.defenderGender==='male');
    return false;
  }
  function effectDesc(e){
    switch(e.k){
      case 'rank': return (e.eot ? 'ターン終了時 ' : '') + fmtDelta(e.s);
      case 'status': return e.st;
      case 'statusOneOf': return e.sts.join('/')+'のいずれか';
      case 'confuse': return 'こんらん';
      case 'note': return e.text;
      default: return e.k;
    }
  }

  // 技①の追加効果を解決する。戻り値:
  //  { hit: { outcomes:[{prob, mods, logs}], certain:{mods, logs} },
  //    miss: {...}, notes:[{s,t}], suppressDefBerryInMove1, needsDealt, ... }
  //  mods: 技②のoptions・HPへ適用する最終値(applyEffectMods / 分岐ごとのHP処理で使う)
  function resolveMove1Effects(input1, result1, input2){
    var name = moveName(result1, input1);
    var H = window.DAMEKE_DATA_HELPERS;
    var table = window.DAMEKE_MOVE_EFFECTS || {};
    var list = (table[name] || []).slice();
    var o1 = input1.options || {};
    var ctx = { A: effectSideCtx(result1, input1, 'A'), D: effectSideCtx(result1, input1, 'D'), field: o1.field || 'なし' };
    var notes = [];
    var tagSheerForce = H.moveTagForEffective(input1.move, name, 'sheerForce');
    var sheerForce = ctx.A.ability==='ちからずく' && tagSheerForce;
    var subActive = substituteHpOrNull(result1, input1, o1) != null;
    var shieldDustName = ctx.D.ability==='りんぷん' ? 'りんぷん' : (ctx.D.item==='おんみつマント' ? 'おんみつマント' : null);
    var canHit = !(result1.accuracyResult==='当たらない' || result1.isInvalid || result1.effectiveCategory==='変化');
    var category = getMultiHitCategory(result1, input1, o1);
    var secondaryRolls = category.type==='fixed' ? category.count : 1;
    var aMG = ctx.A.ability==='マジックガード', dMG = ctx.D.ability==='マジックガード';
    // 追加効果の確率の倍率: てんのめぐみ(×2)・にじ(×2)。ひるみのみ両方あっても×2。強化技の効果は対象外。
    var chanceMul = (ctx.A.ability==='てんのめぐみ' ? 2 : 1) * (o1.attackerRainbow ? 2 : 1);
    // こおり状態の相手に、変更処理後のタイプがほのおの技を当てると解凍する(表とは別の共通ルール)。
    if(result1.effectiveType==='ほのお' && !list.some(function(e){ return e.k==='thawTarget'; })) list.push({k:'thawTarget', generic:1});
    // ひのうみ(防御側の場): 技①の結果に関わらず、ターン終了時に防御側へ最大HPの1/8(切り捨て・最低1)。
    // ほのおタイプ(テラスタル考慮)・マジックガードは0。
    if(o1.defenderSeaOfFire) list.push({k:'seaOfFire', always:1});
    var hitEvents = [], missEvents = [], planEvents = [];
    var suppressDefBerryInMove1 = false, needsDealt = false;
    list.forEach(function(e, idx){
      if(!effectConditionMet(e, input1, result1)) return;
      // always: 技①が外れても・無効でも発生する効果。missOnly: 外れた・無効のときだけ発生する効果。
      var missOnly = e.k==='crash';
      var always = !!(e.oc || e.always || e.k==='thawSelf' || e.k==='selfHalf');
      if(!canHit && !always && !missOnly) return;
      var isTarget = (e.k==='rank' || e.k==='note') ? e.t==='target' : !!TARGET_KINDS[e.k];
      var side = (isTarget || e.k==='seaOfFire') ? 'D' : 'A';
      var desc = effectDesc(e);
      var isSecondary = !e.enh && !e.oc && ((SHEER_FORCE_KINDS[e.k] && (e.c < 100 || tagSheerForce)) || e.sf);
      if(isSecondary && sheerForce){ notes.push({s:side, t:desc+'：ちからずくにより発生しない'}); return; }
      // v2.5.0: みがわりで防がれるかどうかは、1ヒットごとの状態シミュレーション(パイプライン)では
      // ヒットごとに判定する(連続攻撃の途中でみがわりが壊れた場合など)。ここでの静的な判定は、
      // 表示用の旧来の列挙(hitEvents)にのみ使う。ダイマックスわざの効果はみがわりに防がれても発生する。
      var subBlockable = isTarget && !SUBSTITUTE_EXEMPT[e.k] && !(e.k==='note' && e.subOk) && !e.maxMove;
      var staticSubBlocked = subBlockable && subActive;
      // ひるみ: 表示のみだが、ふくつのこころ(すばやさ+1)のためにパイプラインでは発生を追跡する。
      if(e.k==='note' && e.text==='ひるみ' && !(isSecondary && sheerForce) && !(shieldDustName && !e.dustOk && !e.maxMove)){
        var fc = e.c; if(fc < 100 && !e.enh) fc = Math.min(100, fc * Math.min(2, chanceMul));
        planEvents.push({ prob: fc/100, e: {k:'flinch'}, idx: idx, desc: 'ひるみ', stage: 'hit', at: 922, subBlockable: subBlockable, isSecondary: isSecondary,
                          onHit: true, onMiss: false, missOnly: false, always: false, order: 922 });
      }
      if(staticSubBlocked && e.k==='note'){ notes.push({s:side, t:desc+'：みがわりにより発生しない'}); return; }
      if(staticSubBlocked) notes.push({s:side, t:desc+'：みがわりにより発生しない'});
      var N = staticSubBlocked ? { push: function(){} } : notes;
      if(isTarget && shieldDustName && !SHIELD_DUST_EXEMPT[e.k] && !e.maxMove && !(e.k==='note' && e.dustOk)){ N.push({s:side, t:desc+'：'+shieldDustName+'により発生しない'}); return; }
      if(e.k==='note'){
        var nc = e.c;
        if(nc < 100 && !e.enh) nc = Math.min(100, nc * (e.text==='ひるみ' ? Math.min(2, chanceMul) : chanceMul));
        N.push({s:side, t:desc+(nc<100?'('+nc+'%)':'')+'（計算対象外）'});
        if(e.text !== 'ひるみ'){
          planEvents.push({ prob: nc/100, e: {k:'dispNote', text: e.text, t: e.t}, idx: idx, desc: e.text, stage: 'hit', at: 927,
                            subBlockable: subBlockable, isSecondary: isSecondary, onHit: true, onMiss: false, missOnly: false, always: false, order: 927 });
        }
        return;
      }
      if(e.k==='eotGmax' && ctx.D.types.indexOf(e.type)>=0){ N.push({s:'D', t:'ターン終了時のダメージ：'+e.type+'タイプのため無効'}); return; }
      if(e.k==='seaOfFire' && ctx.D.types.indexOf('ほのお')>=0){ N.push({s:'D', t:'ひのうみ：ほのおタイプのため無効'}); return; }
      if(e.k==='seaOfFire' && dMG){ N.push({s:'D', t:'ひのうみ：マジックガードで無効'}); return; }
      if(e.k==='eotGmax' && dMG){ N.push({s:'D', t:'ターン終了時のダメージ：マジックガードで無効'}); return; }
      if(e.k==='setWeather' && ['おおひでり','おおあめ','らんきりゅう'].indexOf(o1.weather||'なし')>=0){ N.push({s:'A', t:'天候は'+o1.weather+'のため変化しない'}); return; }
      // 種類ごとの前提条件(決定的)
      if(e.k==='crash' && aMG){ N.push({s:'A', t:'とびげり系の反動：マジックガードで無効'}); return; }
      if(e.k==='recoil' && (aMG || ctx.A.ability==='いしあたま')){ N.push({s:'A', t:'反動：'+(aMG?'マジックガード':'いしあたま')+'で無効'}); return; }
      if(e.k==='chloro' && (aMG || ctx.A.ability==='いしあたま')){ N.push({s:'A', t:'反動：'+(aMG?'マジックガード':'いしあたま')+'で無効'}); return; }
      if(e.k==='selfHalf' && aMG){ N.push({s:'A', t:'反動：マジックガードで無効'}); return; }
      if((e.k==='bind'||e.k==='saltCure') && dMG){ N.push({s:'D', t:(e.k==='bind'?'バインド':'しおづけ')+'のダメージ：マジックガードで無効'}); return; }
      if(e.k==='knockOff'){
        if(!itemRemovable(ctx,'D')){ return; }
        if(ctx.D.ability==='ねんちゃく'){ N.push({s:'D', t:'はたきおとす：ねんちゃくで持ち物はそのまま'}); return; }
        if(result1.resistBerryConsumed){ return; }
        suppressDefBerryInMove1 = true;
      }
      if(e.k==='thief'){
        // ジュエルを消費した場合も含め、技を使う時点で持ち物を持っていれば奪えない。
        if(ctx.A.heldItem){ return; }
        if(!itemRemovable(ctx,'D')){ return; }
        if(ctx.D.ability==='ねんちゃく'){ N.push({s:'D', t:'持ち物を奪う：ねんちゃくで無効'}); return; }
      }
      if(e.k==='pluck' || e.k==='incinerate'){
        var dHeld = ctx.D.heldItem;
        var eligible = dHeld && (dHeld.isBerry || (e.k==='incinerate' && /ジュエル$/.test(dHeld.name||'')));
        if(!eligible || result1.resistBerryConsumed) return;
        if(ctx.D.ability==='ねんちゃく'){ N.push({s:'D', t:(e.k==='pluck'?'きのみを食べる':'やきつくす')+'：ねんちゃくで無効'}); return; }
        if(dHeld.isBerry) suppressDefBerryInMove1 = true;
      }
      if(e.k==='fling' && !ctx.A.heldItem) return;
      if(e.k==='healBlock') suppressDefBerryInMove1 = true;
      if(e.k==='coreEnforcer' && (o1.moveOrder||'first')!=='second'){ N.push({s:'D', t:'特性をなくす：先攻のため発生しない'}); return; }
      if(e.k==='thawTarget' && !e.generic && e.sf && sheerForce){ return; }
      if(e.k==='recoil' || e.k==='drain') needsDealt = true;
      var chance = e.c == null ? 100 : e.c;
      if(chance < 100 && !e.enh) chance = Math.min(100, chance*chanceMul);
      var rolls = isSecondary ? secondaryRolls : 1;
      // パイプライン用の計画(ヒットごとの効果は1つだけ登録し、実際のヒットごとに判定する)。
      var pev = { prob: chance/100, e: e, idx: idx, desc: desc + (chance<100 ? '('+chance+'%)' : ''), stage: effectStageOf(e, name), subBlockable: subBlockable, isSecondary: isSecondary,
                  onHit: !missOnly || !canHit, onMiss: always || missOnly, missOnly: missOnly, always: always };
      pev.at = effectAt(pev, name);
      pev.order = pev.at * 1000 + idx;
      planEvents.push(pev);
      if(staticSubBlocked) return;
      for(var i=0;i<rolls;i++){
        var ev = { prob: chance/100, e: e, order: (KIND_ORDER[e.k]||5)*1000 + idx*10 + i, desc: desc + (chance<100 ? '('+chance+'%'+(rolls>1?'・ヒットごとに判定':'')+')' : '') };
        if(!missOnly || !canHit) hitEvents.push(ev);
        if(always || missOnly) missEvents.push(ev);
      }
    });
    hitEvents.sort(function(a,b){ return a.order-b.order; });
    missEvents.sort(function(a,b){ return a.order-b.order; });

    var aMax = ctx.A.hpMax || 1, dMax = result1.defenderMaxHp || 1;
    var ctx0 = ctx;
    function applyEvent(state, ev, rnd, cx){
      var ctx = cx || ctx0;
      var e = ev.e;
      switch(e.k){
        case 'rank':
          lg(state, null, '['+ev.desc+']');
          var logStart = state.logs.length, rankSide = e.t==='self' ? 'A' : 'D';
          applyRankEvent(state, ctx, rankSide, e.s, 'A');
          if(e.eot){ for(var li=logStart; li<state.logs.length; li++){ if(state.logs[li].s===rankSide){ state.logs[li] = {s:rankSide, t:'ターン終了時 '+state.logs[li].t}; break; } } }
          break;
        case 'status': tryInflictStatus(state, ctx, 'D', e.st, 'A', true); break;
        case 'statusOneOf': tryInflictStatus(state, ctx, 'D', e.sts[rnd], 'A', true); break;
        case 'confuse': tryConfuse(state, ctx); break;
        case 'thawSelf':
          if(state.status.A==='こおり'){ state.status.A='なし'; lg(state, 'A', 'こおり回復'); }
          break;
        case 'thawTarget':
          if(state.status.D==='こおり'){ state.status.D='なし'; lg(state, 'D', 'こおり回復'); }
          break;
        case 'cure':
          if(state.status.D===e.st){ state.status.D='なし'; lg(state, 'D', e.st+'回復'); }
          break;
        case 'relicSong':
          var P = window.DAMEKE_DATA.pokemons;
          var from = ctx.A.pokemon && ctx.A.pokemon.name;
          var to = from==='メロエッタ(ボイスフォルム)' ? 'メロエッタ(ステップフォルム)' : (from==='メロエッタ(ステップフォルム)' ? 'メロエッタ(ボイスフォルム)' : null);
          var toP = to ? P.find(function(p){ return p.name===to; }) : null;
          if(toP){ state.extra.attackerForm = toP.id; lg(state, 'A', to+'へフォルムチェンジ'); }
          break;
        case 'recoil':
          state.hp.recoil = e.r; lg(state, 'A', '反動(与えたダメージの'+e.r[0]+'/'+e.r[1]+')');
          break;
        case 'drain':
          var bigRoot = ctx.A.item==='おおきなねっこ' && !state.itemGone.A;
          var ooze = ctx.D.ability==='ヘドロえき';
          state.hp.drain = { r: e.r, bigRoot: bigRoot, ooze: ooze, oozeBlocked: ooze && aMG };
          lg(state, 'A', (ooze ? 'ヘドロえき: 回復のかわりにダメージ' + (aMG ? '(マジックガードで無効)' : '') : 'HP回復') + '(与えたダメージの'+e.r[0]+'/'+e.r[1]+(bigRoot?'・おおきなねっこ':'')+')');
          break;
        case 'crash': var cl = Math.floor(aMax/2); state.hp.aLoss += cl; lg(state, 'A', '外れ・無効の反動 '+cl); break;
        case 'selfKO': state.hp.aFaint = true; lg(state, 'A', 'ひんし（技②は発生しない）'); break;
        case 'selfHalf': var sh = Math.ceil(aMax/2); state.hp.aLoss += sh; lg(state, 'A', '反動 '+sh); break;
        case 'chloro': var ch = Math.ceil(aMax/2); state.hp.aLoss += ch; lg(state, 'A', '反動 '+ch); break;
        case 'struggle': var sl = Math.max(1, Math.round(aMax/4)); state.hp.aLoss += sl; lg(state, 'A', '反動 '+sl); break;
        case 'bind':
          if(state.extra.__bound) break;
          state.extra.__bound = true;
          var band = ctx.A.item==='しめつけバンド' && !state.itemGone.A;
          var bd = Math.max(1, Math.floor(dMax/(band?6:8)));
          state.hp.dBind += bd; lg(state, 'D', 'バインド '+bd+'ダメージ'+(band?'(しめつけバンド)':''));
          break;
        case 'saltCure':
          var wet = ctx.D.types.indexOf('みず')>=0 || ctx.D.types.indexOf('はがね')>=0;
          var sd = Math.max(1, Math.floor(dMax/(wet?8:16)));
          state.hp.dSalt += sd; lg(state, 'D', 'しおづけ '+sd+'ダメージ');
          break;
        case 'rankReset':
          RANK_KEYS.forEach(function(k){ state.ranks.D[k] = 0; }); lg(state, 'D', 'ランク補正をすべて0に');
          break;
        case 'healBlock':
          if(ctx.D.ability==='アロマベール'){ lg(state, 'D', 'かいふくふうじ：アロマベールで無効'); break; }
          if(ctx.D.item==='メンタルハーブ' && !state.itemGone.D){ lg(state, 'D', 'かいふくふうじ → メンタルハーブで回復'); consumeItem(state, ctx, 'D', false); break; }
          state.extra.healBlockD = true; lg(state, 'D', 'かいふくふうじ(きのみ等で回復しない)');
          break;
        case 'knockOff':
          if(!state.itemGone.D && ctx.D.heldItem){ lg(state, 'D', 'はたきおとす: '+ctx.D.heldItem.name+'を失う'); consumeItem(state, ctx, 'D', false); }
          break;
        case 'incinerate':
          if(!state.itemGone.D && ctx.D.heldItem && (ctx.D.heldItem.isBerry || /ジュエル$/.test(ctx.D.heldItem.name||''))){ lg(state, 'D', 'やきつくす: '+ctx.D.heldItem.name+'を失う'); consumeItem(state, ctx, 'D', false); }
          break;
        case 'pluck':
          if(!state.itemGone.D && ctx.D.heldItem && ctx.D.heldItem.isBerry){
            var plucked = ctx.D.heldItem.name;
            lg(state, 'D', plucked+'を食べられる');
            consumeItem(state, ctx, 'D', false);
            applyBerryEffect(state, ctx, 'A', plucked, aMax);
            cheekPouch(state, ctx, 'A');
          }
          break;
        case 'thief':
          if(!state.itemGone.D && ctx.D.heldItem && !ctx.A.heldItem){
            var stolen = ctx.D.heldItem.name;
            lg(state, 'A', stolen+'を奪う'); lg(state, 'D', stolen+'を奪われる');
            consumeItem(state, ctx, 'D', false);
            setHeldItem(state, 'A', stolen);
          }
          break;
        case 'fling':
          var fItem = ctx.A.heldItem;
          if(!fItem) break;
          lg(state, 'A', 'なげつける: '+fItem.name+'を失う');
          consumeItem(state, ctx, 'A', false);
          var fBlockedByDust = !!shieldDustName;
          var fst = FLING_STATUS[fItem.name];
          if(fst){ if(fBlockedByDust) lg(state, 'D', fst+'：'+shieldDustName+'により発生しない'); else tryInflictStatus(state, ctx, 'D', fst, 'A', true); }
          else if(FLING_FLINCH.indexOf(fItem.name)>=0){ lg(state, 'D', 'ひるみ（計算対象外）'); }
          else if(fItem.name==='メンタルハーブ'){ lg(state, 'D', 'メンタル系の状態を回復(記述のみ)'); }
          else if(fItem.name==='しろいハーブ'){
            if(fBlockedByDust) lg(state, 'D', 'しろいハーブ：'+shieldDustName+'により発生しない');
            else { var negs = RANK_KEYS.filter(function(k){ return state.ranks.D[k] < 0; }); negs.forEach(function(k){ state.ranks.D[k] = 0; }); lg(state, 'D', negs.length ? 'しろいハーブ: 下がった能力を元に戻す' : 'しろいハーブ: 効果なし'); }
          }
          else if(fItem.isBerry){
            var isCure = !!(STATUS_CURE_BERRY.まひ===fItem.name || ['カゴのみ','モモンのみ','チーゴのみ','ナナシのみ','ラムのみ','キーのみ'].indexOf(fItem.name)>=0);
            if(fBlockedByDust && !isCure) lg(state, 'D', fItem.name+'：'+shieldDustName+'により発生しない');
            else { applyBerryEffect(state, ctx, 'D', fItem.name, dMax); cheekPouch(state, ctx, 'D'); }
          }
          break;
        case 'fieldClear':
          if((state.extra.field||ctx.field||'なし')!=='なし'){ state.extra.field = 'なし'; lg(state, null, 'フィールドをなしにする'); }
          break;
        case 'screenClear':
          if(((input2.options||{}).defenderScreen||'none')!=='none'){ state.extra.defenderScreen = 'none'; lg(state, 'D', '壁をなしにする'); }
          break;
        case 'burnUp': state.extra.attackerBurnUp = true; lg(state, 'A', 'ほのおタイプを失う'); break;
        case 'doubleShock': state.extra.attackerDoubleShock = true; lg(state, 'A', 'でんきタイプを失う'); break;
        case 'smack': state.extra.defenderRootedSmacked = true; lg(state, 'D', 'うちおとす状態(接地)'); break;
        case 'coreEnforcer': state.extra.defenderNoAbility = true; lg(state, 'D', '特性がなくなる'); break;
        case 'setWeather':
          if((o1.weather||'なし')!==e.w){ state.extra.weather = e.w; lg(state, null, '天候を'+e.w+'にする'); }
          break;
        case 'setField':
          if((state.extra.field||ctx.field)!==e.f){ state.extra.field = e.f; lg(state, null, 'フィールドを'+e.f+'にする'); }
          break;
        case 'gravity':
          if(!o1.gravity){ state.extra.gravity = true; lg(state, null, 'じゅうりょく状態にする'); }
          break;
        case 'cureSelf':
          if(state.status.A!=='なし'){ lg(state, 'A', state.status.A+'回復'); state.status.A='なし'; }
          break;
        case 'gmaxRapid':
          state.extra.gmaxRapidPlus = (state.extra.gmaxRapidPlus||0) + 1; lg(state, 'A', 'キョダイシンゲキ+1(急所ランク+1)');
          break;
        case 'finaleHeal':
          state.hp.finale = true; lg(state, 'A', 'HP回復(ダイマックス時の最大HPの1/6)');
          break;
        case 'seaOfFire':
          var sfd = Math.max(1, Math.floor(dMax/8));
          state.hp.dSea += sfd; lg(state, 'D', 'ターン終了時 ひのうみ '+sfd+'ダメージ');
          break;
        case 'eotGmax':
          var gd = Math.floor(dMax/6);
          state.hp.dGmax += gd; lg(state, 'D', 'ターン終了時 '+gd+'ダメージ');
          break;
      }
    }
    function simulate(fired){
      var state = newEffectState(ctx, input2);
      fired.forEach(function(f){ applyEvent(state, f.ev, f.rnd); });
      afterMoveRankItems(state, ctx);
      var mods = {
        ranks: state.ranks, itemGone: state.itemGone,
        status: state.status, confusion: state.confusion,
        extra: state.extra, hp: state.hp
      };
      return { mods: mods, logs: state.logs };
    }
    // statusOneOfは「発生したら3つのうち1つを等確率で選ぶ」ので、発生時の選択肢ごとに分岐させる。
    function enumerate(events){
      var merged = {}, order = [];
      var n = events.length;
      function rec(i, prob, fired){
        if(prob <= 0) return;
        if(i === n){
          var sim = simulate(fired);
          // 結果(mods)が同じでも内容(logs、例:「やけど：ほのおタイプで無効」)が違えば別の分岐として
          // 表示する。技②の計算自体はメモ化されるので、分岐が増えても計算量はほぼ増えない。
          var key = JSON.stringify(sim.mods) + '#' + JSON.stringify(sim.logs);
          if(!merged[key]){ merged[key] = { prob: 0, mods: sim.mods, logs: sim.logs }; order.push(key); }
          merged[key].prob += prob;
          return;
        }
        var ev = events[i];
        rec(i+1, prob*(1-ev.prob), fired);
        if(ev.e.k==='statusOneOf'){
          var m = ev.e.sts.length;
          for(var j=0;j<m;j++) rec(i+1, prob*ev.prob/m, fired.concat([{ev:ev, rnd:j}]));
        } else {
          rec(i+1, prob*ev.prob, fired.concat([{ev:ev, rnd:0}]));
        }
      }
      rec(0, 1, []);
      var outcomes = order.map(function(k){ return merged[k]; });
      var certain = simulate(events.filter(function(ev){ return ev.prob >= 1 && ev.e.k!=='statusOneOf'; }).map(function(ev){ return {ev:ev, rnd:0}; }));
      return { outcomes: outcomes, certain: certain };
    }
    return {
      moveName: name,
      ctx: ctx,
      canHit: canHit,
      hasEffects: hitEvents.length > 0,
      hit: enumerate(hitEvents),
      miss: enumerate(missEvents),
      notes: notes,
      suppressDefBerryInMove1: suppressDefBerryInMove1,
      needsDealt: needsDealt,
      attackerStartHp: ctx.A.hpCur, attackerMaxHp: ctx.A.hpMax,
      // v2.5.0 パイプライン用
      sheerForceBoost: !!sheerForce,
      chanceMul: chanceMul,
      moveHasFlinch: list.some(function(e){ return e.k==='note' && e.text==='ひるみ'; }),
      plan: planEvents.sort(function(a,b){ return a.order-b.order; }),
      applyEvent: applyEvent,
      newState: function(){ return newEffectState(ctx, input2); },
      shieldDustName: shieldDustName
    };
  }
  // 技②のoptionsへ、追加効果の結果(ランク・持ち物・状態異常・場など)を反映する。
  function applyEffectMods(options2, mods){
    if(!mods) return options2;
    function withRanks(stats, ranks){
      var s = Object.assign({}, stats || {});
      s.ranks = Object.assign({}, s.ranks || {});
      RANK_KEYS.forEach(function(k){ s.ranks[k] = String(ranks[k]); });
      return s;
    }
    options2.attackerStats = withRanks(options2.attackerStats, mods.ranks.A);
    options2.defenderStats = withRanks(options2.defenderStats, mods.ranks.D);
    if(mods.itemGone.A){ options2.attackerItemId = 'none'; options2.attackerNoItem = true; }
    if(mods.itemGone.D){ options2.defenderItemId = 'none'; options2.defenderNoItem = true; }
    // もうどくは計算上「どく」として扱う(状態異常の入力欄にもうどくは無いため)。
    function calcStatus(s){ return s==='もうどく' ? 'どく' : s; }
    if(mods.status){ options2.attackerStatus = calcStatus(mods.status.A); options2.defenderStatus = calcStatus(mods.status.D); }
    if(mods.confusion) options2.defenderConfusion = true;
    var x = mods.extra || {};
    if(x.field) options2.field = x.field;
    if(x.defenderScreen) options2.defenderScreen = x.defenderScreen;
    if(x.attackerBurnUp) options2.attackerBurnUp = true;
    if(x.attackerDoubleShock) options2.attackerDoubleShock = true;
    if(x.defenderRootedSmacked) options2.defenderRootedSmacked = true;
    if(x.defenderNoAbility) options2.defenderNoAbility = true;
    if(x.critPlus) options2.critical = Math.min(3, (parseInt(options2.critical,10)||0) + x.critPlus);
    if(x.micle) options2.attackerMicleBerry = true;
    if(x.healBlockD) options2.__forceNoBerryOverride = true;
    if(x.weather) options2.weather = x.weather;
    if(x.gravity) options2.gravity = true;
    if(x.gmaxRapidPlus){ var gr = options2.attackerGMaxRapidStrike===true ? 1 : (parseInt(options2.attackerGMaxRapidStrike,10)||0); options2.attackerGMaxRapidStrike = gr + x.gmaxRapidPlus; }
    // v2.5.0: 持ち物の移動(どろぼう・マジシャン・わるいてぐせ・くっつきバリ)・特性の変化(ミイラ等)・
    // タイプの変化(へんしょく)・かるわざ・こだいかっせい/クォークチャージの発動。
    var ITEMS = window.DAMEKE_DATA.items || [], ABILS = window.DAMEKE_DATA.abilities || [];
    ['A','D'].forEach(function(side){
      var pre = side==='A' ? 'attacker' : 'defender';
      if(x.item && x.item[side] !== undefined && !mods.itemGone[side]){
        var it = x.item[side] ? ITEMS.find(function(i){ return i.name===x.item[side]; }) : null;
        if(it){ options2[pre+'ItemId'] = it.id; options2[pre+'NoItem'] = false; }
        else { options2[pre+'ItemId'] = 'none'; options2[pre+'NoItem'] = true; }
      }
      if(x.abil && x.abil[side] !== undefined){
        var ab = x.abil[side] ? ABILS.find(function(a){ return a.name===x.abil[side]; }) : null;
        if(ab){ options2[pre+'AbilityId'] = ab.id; options2[pre+'NoAbility'] = false; }
        else { options2[pre+'NoAbility'] = true; }
      }
      if(x.unburden && x.unburden[side]) options2[pre+'Unburden'] = true;
      if(x.paradox && x.paradox[side]) options2[pre+'ParadoxBoostStat'] = x.paradox[side];
    });
    if(x.typesD){ options2.defenderType1 = x.typesD[0] || 'なし'; options2.defenderType2 = x.typesD[1] || 'なし'; options2.defenderTypeOverride = 'none'; }
    return options2;
  }
  C.resolveMove1Effects = resolveMove1Effects;
  function effectLogText(l){ return (l.s==='A' ? '攻撃側 ' : (l.s==='D' ? '防御側 ' : '')) + l.t; }
  function fmtPct(p){ var v = Math.round(p*10000)/100; return String(v); }
  // 計算過程表の「追加効果」行用: 技の追加効果を、攻撃側・防御側それぞれの文字列にまとめる。
  // 確率1の結果しかない場合は内容のみ、分岐がある場合は「確率%：内容」を「 / 」区切りで並べる。
  function describeEffectsFromResolved(eff){
    var out = { A: '', D: '' };
    ['A','D'].forEach(function(side){
      var outs = eff.hit.outcomes;
      var parts = [];
      function sideTexts(logs){ return logs.filter(function(l){ return l.s===side || (l.s===null && side==='A' && !/^\[/.test(l.t)); }).map(function(l){ return l.t; }); }
      // 分岐ごとの内容を、この側の文字列が同じもの同士でまとめて確率を合算する(もう一方の側
      // だけが違う分岐を、この側で重複表示しないため)。合計確率が1なら確率は表示しない。
      var groups = [], byText = {};
      outs.forEach(function(oc){
        var t = sideTexts(oc.logs);
        if(!t.length) return;
        var txt = t.join('、');
        if(byText[txt] == null){ byText[txt] = groups.length; groups.push({ text: txt, prob: 0 }); }
        groups[byText[txt]].prob += oc.prob;
      });
      groups.forEach(function(g){ parts.push(g.prob >= 1 - 1e-9 ? g.text : fmtPct(g.prob)+'%：'+g.text); });
      var hitTexts = {}; outs.forEach(function(oc){ sideTexts(oc.logs).forEach(function(t){ hitTexts[t]=1; }); });
      var missOnly = [], alsoOnMiss = false;
      eff.miss.outcomes.forEach(function(oc){ sideTexts(oc.logs).forEach(function(t){ if(hitTexts[t]) alsoOnMiss = true; else if(missOnly.indexOf(t)<0) missOnly.push(t); }); });
      if(eff.canHit && alsoOnMiss) parts.push('※外れ・無効でも発生');
      if(eff.canHit && missOnly.length) parts.push('外れ・無効のとき：'+missOnly.join('、'));
      eff.notes.filter(function(n){ return n.s===side; }).forEach(function(n){ parts.push(n.t); });
      out[side] = parts.length ? parts.join(' / ') : '-';
    });
    return out;
  }
  // v2.5.1: 技の途中で確率100%以上で発生する効果(くだけるよろい・じきゅうりょく・溜めターンの上昇・
  // ジュエルの消費など)を、ヒットごとのダメージに反映した計算結果(ダメージ範囲・割合・確定数・計算過程表用)。
  // 命中前提・急所は入力どおり・連続攻撃は最大回数(相手がひんしでも最後まで)。確率で発生する効果は反映しない。
  C.calculateDamageWithEffects = function(input, flags){
    var base = C.calculateDamage(input);
    if(base && isFutureSightMove(input, base)){
      input = futureSightInput(input);
      base = C.calculateDamage(input);
      flags = Object.assign({}, flags || {}, { futureSight: true });
    }
    try{
      if(!base || base.accuracyResult==='当たらない' || base.isInvalid || base.effectiveCategory==='変化') return base;
      var inp = base.__formInput ? base.__formInput : input;
      var eff = resolveMove1Effects(inp, base, inp);
      var reg = makeRegistry();
      var m0 = eff.newState(), mk0 = reg.id(m0);
      var P = makeMoveContext(inp, base, 'display', 3, eff, reg, mk0, eff.attackerMaxHp, flags);
      P.track = false; P.noFaintStop = true; P.rollRec = [];
      runMovePipeline(P, { sub: P.env.subHp != null ? 0 : null, hp: base.defenderCurrentHp, bf: 0, fn: 0, dealt: 0, crit: 0, bh: 0,
                           aHp: eff.attackerStartHp != null ? eff.attackerStartHp : null, hit: 0, m: m0, mk: mk0 });
      var baseHits = P.hitsOf({ mk: mk0, m: m0 });
      var ov = [], changed = false;
      for(var k=0; k<P.model.maxHits; k++){
        var rec = P.rollRec[k] || {}, best = null;
        Object.keys(rec).forEach(function(mk){ if(!best || rec[mk].p > best.p) best = rec[mk]; });
        var h = best ? best.h : baseHits[Math.min(k, baseHits.length-1)];
        var bh = baseHits[Math.min(k, baseHits.length-1)];
        if(h.rolls.join(',') !== bh.rolls.join(',') || h.raw.join(',') !== bh.raw.join(',')) changed = true;
        ov.push({ rolls: h.rolls, raw: h.raw });
      }
      if(!changed) return base;
      var r2 = C.calculateDamage(Object.assign({}, inp, { options: freshOpts(inp.options, { __hitRollsOverride: ov }) }));
      if(r2){ r2.__effectsAdjusted = true; if(base.__formInput){ r2.__formInput = base.__formInput; r2.__formApplied = base.__formApplied; } }
      return r2 || base;
    } catch(e){
      if(window.console && console.error) console.error('[calculateDamageWithEffects] failed:', e);
      return base;
    }
  };
  C.describeMoveEffects = function(input, result){
    try{
      var eff = resolveMove1Effects(input, result, input);
      var reg = makeRegistry();
      var m0 = eff.newState(), mk0 = reg.id(m0);
      var P = makeMoveContext(input, result, 'prob', 1, eff, reg, mk0, eff.attackerMaxHp);
      var dist = runMovePipeline(P, { sub: P.env.subHp != null ? 0 : null, hp: result.defenderCurrentHp, bf: 0, fn: 0, dealt: 0, crit: 0, bh: 0,
                                      aHp: eff.attackerStartHp != null ? eff.attackerStartHp : null, hit: 0, m: m0, mk: mk0 });
      var sm = summarizeMove(P, dist, m0);
      return { A: sm.A, D: sm.D };
    }
    catch(e){ if(window.console && console.error) console.error('[describeMoveEffects] failed:', e); return null; }
  };

  // v2.3.0 技①→技②連続計算: 「単純加算」は追加効果(状態異常付与やランク変動などの副次効果)を
  // 考慮しないことのみを意味し、ダメージ・割合・確定数・瀕死率そのものは、みがわり・きのみ
  // 回復・連続攻撃・急所率・命中判定をすべて技①・技②それぞれ独立に厳密計算したうえで、技①の
  // 結果として起こりうる防御側の状態(実HP・みがわりの残りHP・きのみ消費済みフラグ)の分布
  // すべてを分岐として保持し、各分岐ごとに技②を厳密に適用して合成した、真の同時分布から
  // 導出する(いずれの値も近似やサンプリングではない)。
  //
  // buildMoveOutcomeDistribution(input, result, startKey): computeFaintProbability と同じ状態
  // 遷移エンジン(perHitDists/急所率ブレンド/命中回数分布/みがわり/きのみ)を使うが、瀕死確率
  // という1つのスカラーに潰さず、命中判定も含めた「技を1回使い切った後」の状態分布そのものを
  // 返す。startKeyが渡された場合はその1点(確率1)を開始状態とする(技②を技①の各分岐から
  // 続ける際に使う)。startKeyがなければ、通常の単発計算と同じ開始状態(実HP満タン、または
  // みがわりありなら's0')を使う。
  function buildMoveOutcomeDistribution(input, result, startKey, track){
    if(track){
      // 与えたダメージを追跡する版(技①の反動・吸収用)。開始キーに'|0'を付けて計算する。
      var base = buildMoveOutcomeDistributionCore(input, result, startKey, true);
      return base;
    }
    return buildMoveOutcomeDistributionCore(input, result, startKey, false);
  }
  function buildMoveOutcomeDistributionCore(input, result, startKey, track){
    var o = input.options || {};
    var subHp = substituteHpOrNull(result,input,o);
    var maxHp = result.defenderMaxHp;
    var berrySpec = getBerrySpec(result, maxHp, !!o.__forceNoBerryOverride);
    var hp = result.defenderCurrentHp;
    var baseStartState;
    if(startKey){ baseStartState = Object.create(null); baseStartState[startKey]=1; }
    else baseStartState = initialStatesFor(subHp, hp);
    if(track && !startKey) baseStartState = addDealtSuffix(baseStartState);
    var startKeyActual = startKey || Object.keys(baseStartState)[0];
    var fullSeq = track ? applyHitSequenceFullTracked : applyHitSequenceFull;

    // 必中判定に失敗する(当たらない)技、またはダメージを与えない技(変化技・無効)は、
    // 防御側の状態を一切変化させない。
    if(result.accuracyResult==='当たらない' || result.isInvalid || result.effectiveCategory==='変化'){
      var unchanged = Object.create(null); unchanged[startKeyActual]=1;
      return { states: unchanged, subHp: subHp, maxHp: maxHp, berrySpec: berrySpec, missProb: 1, startKey: startKeyActual };
    }
    var accProb = result.accuracyResult==='必中' ? 1 : Math.max(0,Math.min(1,(result.accuracyPercent||0)/100));

    var offOptions = Object.assign({}, o, {__forceCritOverride:'off'});
    var onOptions = Object.assign({}, o, {__forceCritOverride:'on'});
    var isKimagureLaser = moveName(result,input)==='きまぐレーザー';
    var category = getMultiHitCategory(result,input,o);
    var maxHitsNeeded = category.type==='fixed' ? category.count : (category.type==='variable2to5'||category.type==='perHitAcc' ? category.max : 1);
    var perHitDists;
    if(isKimagureLaser){
      var nnOptions = Object.assign({}, offOptions, {__forceKimagureLaserOverride:'off'});
      var ncOptions = Object.assign({}, offOptions, {__forceKimagureLaserOverride:'on'});
      var cnOptions = Object.assign({}, onOptions, {__forceKimagureLaserOverride:'off'});
      var ccOptions = Object.assign({}, onOptions, {__forceKimagureLaserOverride:'on'});
      var nnResult = C.calculateDamage({attacker:input.attacker, defender:input.defender, move:input.move, attackerLevel:input.attackerLevel, defenderLevel:input.defenderLevel, options:nnOptions});
      var ncResult = C.calculateDamage({attacker:input.attacker, defender:input.defender, move:input.move, attackerLevel:input.attackerLevel, defenderLevel:input.defenderLevel, options:ncOptions});
      var cnResult = C.calculateDamage({attacker:input.attacker, defender:input.defender, move:input.move, attackerLevel:input.attackerLevel, defenderLevel:input.defenderLevel, options:cnOptions});
      var ccResult = C.calculateDamage({attacker:input.attacker, defender:input.defender, move:input.move, attackerLevel:input.attackerLevel, defenderLevel:input.defenderLevel, options:ccOptions});
      var critRateK = critRateFromResult(result);
      perHitDists = buildPerHitDistsKimagureLaser(nnResult, ncResult, cnResult, ccResult, critRateK, maxHitsNeeded);
    } else {
      var normalResult = C.calculateDamage({attacker:input.attacker, defender:input.defender, move:input.move, attackerLevel:input.attackerLevel, defenderLevel:input.defenderLevel, options:offOptions});
      var critResult = C.calculateDamage({attacker:input.attacker, defender:input.defender, move:input.move, attackerLevel:input.attackerLevel, defenderLevel:input.defenderLevel, options:onOptions});
      var critRate = critRateFromResult(result);
      perHitDists = buildPerHitDists(normalResult, critResult, critRate, maxHitsNeeded);
    }

    var aAb = result.__coreState && result.__coreState.attackerAbility;
    var aAbState = result.__coreState && result.__coreState.attackerAbilityState;
    var aItem = result.__coreState && result.__coreState.attackerItem;
    var aItemState = result.__coreState && result.__coreState.attackerItemState;
    var hasSkillLink = !!(aAbState && aAbState.active && aAb && aAb.name==='スキルリンク');
    var hasLoadedDice = !!(aItemState && aItemState.active && aItem && aItem.name==='いかさまダイス');

    if(category.type==='perHitAcc' && !hasSkillLink && !hasLoadedDice){
      // トリプルキック等、1発ごとに命中判定がある技: applyHitSequenceFullSequentialが
      // 「途中で外れたらそこで状態はそのまま」まで含めて厳密に扱う。
      // (1発ごとに命中判定がある技には反動・吸収の技が無いため、追跡時は与えたダメージ0扱い)
      var seqBase = track ? (function(){ var s0=Object.create(null); for(var k0 in baseStartState) s0[k0.split('|')[0]]=baseStartState[k0]; return s0; })() : baseStartState;
      var seqStates = applyHitSequenceFullSequential(seqBase, perHitDists, subHp, hp, maxHp, berrySpec, accProb, category.max);
      if(track) seqStates = addDealtSuffix(seqStates);
      // missProb: 1発目で外れた(=技が1回も当たらなかった)確率。この分は開始状態(startKey)に
      // 含まれている(追加効果の判定で「当たった/外れた」を区別するために公開する)。
      return { states: seqStates, subHp: subHp, maxHp: maxHp, berrySpec: berrySpec, missProb: 1-accProb, startKey: startKeyActual };
    }

    // 技全体で1回だけ命中判定する技: 外れ(1-accProb)は状態そのまま、当たり(accProb)は
    // 連続攻撃の回数分布(hitCountDist)ごとに正確な状態遷移を行い、重み付けして合成する。
    var hitCountDist = getHitCountDist(category, hasSkillLink, hasLoadedDice);
    var merged = Object.create(null);
    merged[startKeyActual] = (merged[startKeyActual]||0) + (1-accProb);
    var keys = Object.keys(hitCountDist).map(Number).sort(function(a,b){return a-b;});
    for(var ki=0; ki<keys.length; ki++){
      var k = keys[ki], p = hitCountDist[k];
      var states1 = fullSeq(baseStartState, perHitDists.slice(0,k), subHp, hp, maxHp, berrySpec);
      for(var skey in states1){ merged[skey] = (merged[skey]||0) + accProb*p*states1[skey]; }
    }
    return { states: merged, subHp: subHp, maxHp: maxHp, berrySpec: berrySpec, missProb: 1-accProb, startKey: startKeyActual };
  }

  // buildMoveDisplayOutcome(input, result, startKey): 技単体の「ダメージ表示(最小～最大)」と
  // 全く同じ考え方(急所は確率ブレンドせず、現在の会心強制チェックボックス状態をそのまま反映した
  // 実際のロール集合を使い、命中判定は含めない=常に当たった前提)で、みがわり・きのみ回復を
  // 織り込んだ最終状態分布を返す。C.calculateDamage の内部(みがわり/きのみ用ルーティング、
  // 2517行目付近)が単発計算で行っているのと同じ遷移だが、startKeyを受け取れるようにして技①→
  // 技②の連結に使えるようにしたもの。瀕死率用のbuildMoveOutcomeDistribution(急所を確率的に
  // ブレンドする)とは目的が異なり、あくまで「表示するダメージ範囲」を技①単体・技②単体の表示と
  // 矛盾なく連結するためのもの。
  function buildMoveDisplayOutcome(input, result, startKey, track){
    var o = input.options || {};
    var subHp = substituteHpOrNull(result,input,o);
    var maxHp = result.defenderMaxHp;
    var berrySpec = getBerrySpec(result, maxHp, !!o.__forceNoBerryOverride);
    var hp = result.defenderCurrentHp;
    var baseStartState;
    if(startKey){ baseStartState = Object.create(null); baseStartState[startKey]=1; }
    else baseStartState = initialStatesFor(subHp, hp);
    var startKeyActual = startKey || Object.keys(baseStartState)[0];

    if(result.accuracyResult==='当たらない' || result.isInvalid || result.effectiveCategory==='変化'){
      var unchanged = Object.create(null); unchanged[startKeyActual + (track && !startKey ? '|0' : '')]=1;
      return { states: unchanged, subHp: subHp, maxHp: maxHp, berrySpec: berrySpec };
    }
    var hitDists = (result.independentHitRolls && result.independentHitRolls.length)
      ? result.independentHitRolls.map(function(r){ return distFromRolls(r); })
      : [distFromRolls(result.rolls || [0])];
    // 開始HP(技②の起点)は、単発技の表示ダメージ(minDamage/maxDamage)と同じ「表示上の最大回数
    // ヒット」の前提で計算する(スケイルショット等の2-5回技でも、瀕死率側の計算とは別に、常に
    // 最大回数分のヒットが起きたケースを基準にする)。この結果、技①だけで確実に瀕死する
    // ケースでは以下のfinalRangeStates側がすべて'f'(瀕死)状態になるが、その場合でも技②の
    // ダメージ自体は(技①で瀕死になるかどうかに関わらず)本来入るはずの値を別途計算して表示する
    // -- calculateCombinedSequence側でそれを行う。
    var states = track ? applyHitSequenceFullTracked(addDealtSuffix(baseStartState), hitDists, subHp, hp, maxHp, berrySpec)
                       : applyHitSequenceFull(baseStartState, hitDists, subHp, hp, maxHp, berrySpec);
    return { states: states, subHp: subHp, maxHp: maxHp, berrySpec: berrySpec };
  }

  // 技①→技②を厳密に連結する。input1/input2はcalculateDamageと同じ形({attacker, defender,
  // move, attackerLevel, defenderLevel, options})。技②側のoptionsは、呼び出し元(app.js)が
  // 技②固有条件・技②の急所チェックボックスなどを反映した状態で渡す(defenderCurrentHpInputは
  // ここで分岐ごとに上書きするので、呼び出し元が入れた値は無視される)。
  //
  // ダメージ範囲(技②単体・合計)と瀕死率/確定撃破判定は、それぞれ別の連結を行う:
  // ・ダメージ範囲は buildMoveDisplayOutcome(急所を確率ブレンドしない実ロール、命中前提)を
  //   技①→技②で連結する。これは技①単体・技②単体の表示レンジ(会心強制チェックボックスの
  //   状態をそのまま反映)と矛盾なく合算するためで、既存の単発ダメージ表示と同じ考え方。
  // ・瀕死率/確定撃破は buildMoveOutcomeDistribution(急所の実発生確率・連続攻撃の命中回数分布・
  //   命中判定をすべて厳密に織り込む)を技①→技②で連結する。これは真の意味で「この一連の行動で
  //   実際に瀕死する確率」を表す。
  // ==== v2.5.0 1ヒット単位の状態シミュレーション(技①・技②・単体の瀕死率で共通) ====
  // 状態キー: '<防御側状態>|<与えたダメージ>|<急所が出たか 0/1>|<本体へダメージが入ったヒット数>'
  //   防御側状態: 's<n>' = みがわり健在(みがわりへの累計ダメージn) / 'r<hp>_<0|1>' = 本体の残りHPと
  //   回復きのみ消費済みフラグ / 'f<hp>_<0|1>' = ひんし(以降のヒットは無効)。
  //   与えたダメージ: みがわりへはみがわりの残りHP、本体へは残りHPを上限とする(反動・吸収の計算用)。
  // 旧来の applyHitSequenceFull / applyHitSequenceFullSequential と同じ遷移に、急所の発生・本体への
  // ヒット数の追跡と、きあいのハチマキ(ひんしになるヒットを10%でHP1で耐える)を加えたもの。
  // 確率(0～1)を%表示用に小数第2位へ四捨五入する。ちょうど端数0.5になる値(例: 11.875%)が
  // 浮動小数点の加算順によって11.8749999…になり切り捨てられるのを防ぐため、微小量を足してから丸める。
  // 瀕死率(%)を小数第2位まで。ごくわずかでも可能性があれば0ではなく1e-9(表示上は0.00%)を返し、
  // 絶対に瀕死にならない場合(ちょうど0)と区別できるようにする(0なら画面上は「不可」と表示)。
  function roundPct2(x){ var v = Math.round(x*10000 + 1e-7)/100; return (v === 0 && x > 0) ? 1e-9 : v; }
  function stateKey(dk, dealt, crit, body){ return dk + '|' + dealt + '|' + crit + '|' + body; }
  function parseState(k){ var p = k.split('|'); return { dk: p[0], dealt: Number(p[1])||0, crit: Number(p[2])||0, body: Number(p[3])||0 }; }
  function addTo(map, k, p){ map[k] = (map[k]||0) + p; }
  // 1ヒット分の遷移。hit = { pCrit, nrm:{dmg:p}, crt:{dmg:p} }、w: このヒットが起こる確率の係数。
  function stepHit(states, hit, env, w){
    var next = Object.create(null);
    for(var key in states){
      var p = states[key];
      var st = parseState(key), dk = st.dk, ph = dk.charAt(0);
      if(ph === 'f'){ addTo(next, key, p*w); continue; }
      for(var c=0; c<2; c++){
        var pc = c ? hit.pCrit : 1 - hit.pCrit;
        if(pc <= 0) continue;
        var dist = c ? hit.crt : hit.nrm;
        var critFlag = (st.crit || c) ? 1 : 0;
        for(var hd in dist){
          var q = p * w * pc * dist[hd], dmg = Number(hd);
          if(q <= 0) continue;
          if(ph === 's'){
            var cum = Number(dk.slice(1));
            var inc = Math.min(dmg, env.subHp - cum);
            var nk = (cum + dmg >= env.subHp) ? ('r' + env.startHp + '_0') : ('s' + (cum + dmg));
            addTo(next, stateKey(nk, st.dealt + inc, critFlag, st.body), q);
          } else {
            var us = dk.slice(1).split('_'), hpNow = Number(us[0]), flag = us[1];
            var bodyInc = dmg > 0 ? 1 : 0;
            var newHp = hpNow - dmg;
            if(newHp <= 0){
              // きあいのハチマキ: 本体がひんしになるヒットのとき、env.focusBand の確率でHP1で耐える。
              if(env.focusBand > 0){
                var survHp = 1, fl2 = flag;
                if(fl2 === '0' && env.berrySpec && survHp <= env.berrySpec.threshold){ survHp = Math.min(env.maxHp, survHp + env.berrySpec.amount); fl2 = '1'; }
                addTo(next, stateKey('r' + survHp + '_' + fl2, st.dealt + (hpNow - 1), critFlag, st.body + bodyInc), q * env.focusBand);
                addTo(next, stateKey('f' + newHp + '_' + flag, st.dealt + hpNow, critFlag, st.body + bodyInc), q * (1 - env.focusBand));
              } else {
                addTo(next, stateKey('f' + newHp + '_' + flag, st.dealt + Math.min(dmg, hpNow), critFlag, st.body + bodyInc), q);
              }
              continue;
            }
            var fl = flag;
            if(fl === '0' && env.berrySpec && newHp <= env.berrySpec.threshold){ newHp = Math.min(env.maxHp, newHp + env.berrySpec.amount); fl = '1'; }
            addTo(next, stateKey('r' + newHp + '_' + fl, st.dealt + Math.min(dmg, hpNow), critFlag, st.body + bodyInc), q);
          }
        }
      }
    }
    return next;
  }
  function focusBandProb(result){
    var core = result && result.__coreState;
    var it = core && core.defenderItem, itSt = core && core.defenderItemState;
    return (it && itSt && itSt.active && it.name === 'きあいのハチマキ') ? 0.1 : 0;
  }
  // 技1回分の「ヒットのモデル」を作る。mode: 'prob'(瀕死率用: 急所は発生確率で分岐、命中判定・
  // 連続攻撃の回数分布・きあいのハチマキを含む) / 'display'(表示・確定数用: 急所は現在の急所
  // チェックボックス状態のまま、命中前提、表示上の最大回数ヒット、きあいのハチマキは考慮しない)。
  function buildHitModel(input, result, mode){
    var o = input.options || {};
    var env = {
      subHp: substituteHpOrNull(result, input, o),
      maxHp: result.defenderMaxHp,
      berrySpec: getBerrySpec(result, result.defenderMaxHp, !!o.__forceNoBerryOverride),
      startHp: result.defenderCurrentHp,
      focusBand: mode === 'prob' ? focusBandProb(result) : 0
    };
    var none = (result.accuracyResult==='当たらない' || result.isInvalid || result.effectiveCategory==='変化');
    if(none) return { env: env, none: true };
    if(mode === 'display'){
      var rollsList = (result.independentHitRolls && result.independentHitRolls.length) ? result.independentHitRolls : [result.rolls || [0]];
      var dispCrit = result.criticalRank >= 3 || !!result.criticalEffective ? 1 : 0;
      var hits = rollsList.map(function(r){ var d = distFromRolls(r); return { pCrit: dispCrit, nrm: d, crt: d }; });
      return { env: env, none: false, display: true, hits: hits };
    }
    var accProb = result.accuracyResult==='必中' ? 1 : Math.max(0, Math.min(1, (result.accuracyPercent||0)/100));
    var category = getMultiHitCategory(result, input, o);
    var maxHitsNeeded = category.type==='fixed' ? category.count : (category.type==='variable2to5'||category.type==='perHitAcc' ? category.max : 1);
    var offOptions = Object.assign({}, o, {__forceCritOverride:'off'});
    var onOptions = Object.assign({}, o, {__forceCritOverride:'on'});
    function calcWith(opts){ return C.calculateDamage({attacker:input.attacker, defender:input.defender, move:input.move, attackerLevel:input.attackerLevel, defenderLevel:input.defenderLevel, options:opts}); }
    function rollsAt(r, i){ var h = r.independentHitRolls || [r.rolls || [0]]; return h[i] || h[h.length-1] || [0]; }
    var critRate = critRateFromResult(result);
    var hitsP = [];
    if(moveName(result, input) === 'きまぐレーザー'){
      var nn = calcWith(Object.assign({}, offOptions, {__forceKimagureLaserOverride:'off'}));
      var nc = calcWith(Object.assign({}, offOptions, {__forceKimagureLaserOverride:'on'}));
      var cn = calcWith(Object.assign({}, onOptions, {__forceKimagureLaserOverride:'off'}));
      var cc = calcWith(Object.assign({}, onOptions, {__forceKimagureLaserOverride:'on'}));
      for(var i=0;i<maxHitsNeeded;i++){
        var notCrit = addDist(scaleDist(distFromRolls(rollsAt(nn,i)),1-KIMAGURE_LASER_DOUBLE_RATE), scaleDist(distFromRolls(rollsAt(nc,i)),KIMAGURE_LASER_DOUBLE_RATE));
        var isCrit = addDist(scaleDist(distFromRolls(rollsAt(cn,i)),1-KIMAGURE_LASER_DOUBLE_RATE), scaleDist(distFromRolls(rollsAt(cc,i)),KIMAGURE_LASER_DOUBLE_RATE));
        hitsP.push({ pCrit: critRate, nrm: notCrit, crt: isCrit });
      }
    } else {
      var normalResult = calcWith(offOptions), critResult = calcWith(onOptions);
      for(var j=0;j<maxHitsNeeded;j++) hitsP.push({ pCrit: critRate, nrm: distFromRolls(rollsAt(normalResult,j)), crt: distFromRolls(rollsAt(critResult,j)) });
    }
    var core = result.__coreState || {};
    var hasSkillLink = !!(core.attackerAbilityState && core.attackerAbilityState.active && core.attackerAbility && core.attackerAbility.name==='スキルリンク');
    var hasLoadedDice = !!(core.attackerItemState && core.attackerItemState.active && core.attackerItem && core.attackerItem.name==='いかさまダイス');
    var sequential = category.type==='perHitAcc' && !hasSkillLink && !hasLoadedDice;
    return { env: env, none: false, display: false, hits: hitsP, accProb: accProb, sequential: sequential,
             hitCountDist: sequential ? null : getHitCountDist(category, hasSkillLink, hasLoadedDice), maxHits: category.max };
  }
  // 開始状態(防御側状態dk)からヒットのモデルを適用し、技を1回使い終えた後の状態分布を返す。
  // missProb: 技が1回も当たらなかった確率(その分は開始状態に含まれる)。
  function runHitModel(model, dk){
    var start = stateKey(dk, 0, 0, 0);
    var s0 = Object.create(null); s0[start] = 1;
    if(model.none){ return { states: s0, missProb: 1, startKey: start }; }
    if(model.display){
      var st = s0;
      for(var h=0; h<model.hits.length; h++) st = stepHit(st, model.hits[h], model.env, 1);
      return { states: st, missProb: 0, startKey: start };
    }
    var acc = model.accProb;
    if(model.sequential){
      // 1発ごとに命中判定: 外れた時点でその分岐の状態はそのまま。
      var stopped = Object.create(null), cur = s0;
      for(var k=0; k<model.maxHits; k++){
        for(var ck in cur) addTo(stopped, ck, cur[ck]*(1-acc));
        cur = stepHit(cur, model.hits[k], model.env, acc);
      }
      for(var ck2 in cur) addTo(stopped, ck2, cur[ck2]);
      return { states: stopped, missProb: 1-acc, startKey: start };
    }
    var merged = Object.create(null);
    addTo(merged, start, 1-acc);
    var counts = Object.keys(model.hitCountDist).map(Number).sort(function(a,b){return a-b;});
    for(var ci=0; ci<counts.length; ci++){
      var n = counts[ci], pn = model.hitCountDist[n];
      var s = s0;
      for(var hh=0; hh<n; hh++) s = stepHit(s, model.hits[hh], model.env, 1);
      for(var sk in s) addTo(merged, sk, acc*pn*s[sk]);
    }
    return { states: merged, missProb: 1-acc, startKey: start };
  }
  // 防御側状態(dk)ごとに確率を合算する(追跡情報を捨てる)。
  function collapseToDk(states){
    var out = Object.create(null);
    for(var k in states) addTo(out, k.split('|')[0], states[k]);
    return out;
  }
  C.__buildHitModel = buildHitModel; C.__runHitModel = runHitModel;

  // ==== v2.5.0 技の処理パイプライン(1ヒット単位・全状態の同時分布を追跡) ====
  // 技①: 命中判定 → 前処理(特性による無効化で発動する効果等) → 1ヒットごとに[ダメージ → 手順9・10の効果
  //       → 連続攻撃のきのみ判定(13-1)] → 全ヒット後の効果(手順15～28) → ターン終了時の処理。
  // 技②: 命中判定 → 1ヒットごとに[ダメージ → 手順9・10の効果 → きのみ判定] → 回復きのみ(21)で打ち切り。
  // 状態 st:
  //   sub : みがわりへの累計ダメージ(みがわり無し/破壊済みならnull)
  //   hp  : 本体の残りHP(ひんし時は0以下。表示モードでは超過分を保持)
  //   bf  : 防御側がきのみを消費したか(0/1)   fn: 防御側ひんし(0/1)
  //   dealt: この技で与えたダメージの合計(反動・いのちのたま・かいがらのすず用。不要なら常に0)
  //   crit : (未使用・常に0)
  //   bh  : この技が本体に当たったか(みがわりに防がれず)
  //   aHp : 攻撃側の残りHP(不明ならnull)   hit: 技が命中したか(0/1)
  //   m/mk: 効果状態(ランク・状態異常・持ち物・特性・場など。newEffectStateの形)と識別番号
  // 確率はすべて厳密(サンプリングなし)。表示モード('display')では確率100%以上の事象のみ発生させる。
  function stableStr(v){
    if(v === null || typeof v !== 'object') return JSON.stringify(v);
    if(Array.isArray(v)) return '[' + v.map(stableStr).join(',') + ']';
    return '{' + Object.keys(v).sort().filter(function(k){ return v[k] !== undefined; }).map(function(k){ return JSON.stringify(k) + ':' + stableStr(v[k]); }).join(',') + '}';
  }
  function mKeyOf(m){ return stableStr([m.ranks, m.itemGone, m.status, m.confusion, m.extra, m.hp]); }
  function cloneM(m){
    var c = JSON.parse(JSON.stringify({ ranks:m.ranks, itemGone:m.itemGone, status:m.status, confusion:m.confusion, extra:m.extra, hp:m.hp }));
    c.logs = [];
    return c;
  }
  function stKey(s){ return (s.sub==null ? 'r' : 's'+s.sub) + ',' + s.hp + ',' + s.bf + ',' + s.fn + ',' + s.dealt + ',' + s.crit + ',' + s.bh + ',' + s.aHp + ',' + s.hit + ',' + s.mk; }
  function stCopy(s){ return { sub:s.sub, hp:s.hp, bf:s.bf, fn:s.fn, dealt:s.dealt, crit:s.crit, bh:s.bh, aHp:s.aHp, hit:s.hit, m:s.m, mk:s.mk }; }
  function dAdd(dist, s, p){ if(!(p > 0)) return; var k = stKey(s); var e = dist[k]; if(e) e.p += p; else dist[k] = { p:p, s:s }; }
  function aFainted(s){ return s.aHp != null && s.aHp <= 0; }
  var FAINT_STATE = { sub:null, hp:0, bf:0, fn:1, dealt:0, crit:0, bh:0, aHp:null, hit:0, m:null, mk:-1 };
  function freshOpts(o, extra){ var x = Object.assign({}, o, extra||{}); delete x.__coreState; return x; }
  function itemByName(n){ return n ? ((window.DAMEKE_DATA.items||[]).find(function(i){ return i.name===n; }) || { name:n, id:n }) : null; }
  function pokemonAbilityLocked(name){ return ABILITY_UNCHANGEABLE.indexOf(name) >= 0; }
  // ミイラ・とれないにおい・さまようたましいで上書き/交換できない特性(シートの記載どおり)。
  var ABILITY_UNCHANGEABLE = ['ARシステム','アイスフェイス','イリュージョン','うのミサイル','きずなへんげ','ぎょぐん','じんばいったい','スワームチェンジ','ダルマモード','テラスチェンジ','ばけのかわ','バトルスイッチ','マイティチェンジ','マルチタイプ','リミットシールド'];
  var WANDERING_EXTRA_LOCK = ['かがくへんかガス','はらぺこスイッチ','ふしぎなまもり'];

  // 技1回分の静的なモデル(命中率・連続攻撃の回数分布)と、オプションからヒットごとの乱数分布を作る関数。
  function buildMoveModel(input, result, mode){
    var o = input.options || {};
    var none = (result.accuracyResult==='当たらない' || result.isInvalid || result.effectiveCategory==='変化');
    var M = { none: none, mode: mode };
    if(none) return M;
    function calcWith(inp, opts){ return C.calculateDamage({attacker:inp.attacker, defender:inp.defender, move:inp.move, attackerLevel:inp.attackerLevel, defenderLevel:inp.defenderLevel, options:opts}); }
    function rollsAt(r, i){ var h = r.independentHitRolls || [r.rolls || [0]]; return h[i] || h[h.length-1] || [0]; }
    if(mode === 'display'){
      var rl0 = (result.independentHitRolls && result.independentHitRolls.length) ? result.independentHitRolls : [result.rolls || [0]];
      M.maxHits = rl0.length;
      M.hitsFor = function(inp, isBase){
        var r = isBase ? result : calcWith(inp, inp.options);
        var rl = (r.independentHitRolls && r.independentHitRolls.length) ? r.independentHitRolls : [r.rolls || [0]];
        var dispCrit = r.criticalRank >= 3 || !!r.criticalEffective ? 1 : 0;
        var out = [];
        var rawl = (r.rawIndependentHitRolls && r.rawIndependentHitRolls.length) ? r.rawIndependentHitRolls : [r.rawRolls || r.rolls || [0]];
        for(var i=0;i<M.maxHits;i++){
          var ro = rl[i] || rl[rl.length-1] || [0], rw = rawl[i] || rawl[rawl.length-1] || ro;
          out.push({ pCrit: dispCrit, nrm: distFromRolls(ro), crt: distFromRolls(ro), rolls: ro.slice(), raw: rw.slice() });
        }
        return out;
      };
      return M;
    }
    M.accProb = result.accuracyResult==='必中' ? 1 : Math.max(0, Math.min(1, (result.accuracyPercent||0)/100));
    var category = getMultiHitCategory(result, input, o);
    M.maxHits = category.type==='fixed' ? category.count : (category.type==='variable2to5'||category.type==='perHitAcc' ? category.max : 1);
    var core = result.__coreState || {};
    var hasSkillLink = !!(core.attackerAbilityState && core.attackerAbilityState.active && core.attackerAbility && core.attackerAbility.name==='スキルリンク');
    var hasLoadedDice = !!(core.attackerItemState && core.attackerItemState.active && core.attackerItem && core.attackerItem.name==='いかさまダイス');
    M.sequential = category.type==='perHitAcc' && !hasSkillLink && !hasLoadedDice;
    // stopAfter[k]: k回当てた時点で(ひんし等以外の理由で)連続攻撃が終わる条件付き確率 P(N=k | N>=k)。
    M.stopAfter = [];
    if(!M.sequential){
      var hcd = getHitCountDist(category, hasSkillLink, hasLoadedDice);
      var tail = 0;
      for(var k=M.maxHits; k>=1; k--){
        var pk = hcd[k] || 0;
        tail += pk;
        M.stopAfter[k] = tail > 0 ? pk/tail : 1;
      }
    }
    var critRate = critRateFromResult(result);
    var isKimagure = moveName(result, input) === 'きまぐレーザー';
    M.hitsFor = function(inp){
      var opts = inp.options || {};
      var offO = Object.assign({}, opts, {__forceCritOverride:'off'});
      var onO = Object.assign({}, opts, {__forceCritOverride:'on'});
      var out = [];
      if(isKimagure){
        var nn = calcWith(inp, Object.assign({}, offO, {__forceKimagureLaserOverride:'off'}));
        var nc = calcWith(inp, Object.assign({}, offO, {__forceKimagureLaserOverride:'on'}));
        var cn = calcWith(inp, Object.assign({}, onO, {__forceKimagureLaserOverride:'off'}));
        var cc = calcWith(inp, Object.assign({}, onO, {__forceKimagureLaserOverride:'on'}));
        for(var i=0;i<M.maxHits;i++){
          out.push({ pCrit: critRate,
            nrm: addDist(scaleDist(distFromRolls(rollsAt(nn,i)),1-KIMAGURE_LASER_DOUBLE_RATE), scaleDist(distFromRolls(rollsAt(nc,i)),KIMAGURE_LASER_DOUBLE_RATE)),
            crt: addDist(scaleDist(distFromRolls(rollsAt(cn,i)),1-KIMAGURE_LASER_DOUBLE_RATE), scaleDist(distFromRolls(rollsAt(cc,i)),KIMAGURE_LASER_DOUBLE_RATE)) });
        }
      } else {
        // 急所ランクが変化した状態(サンのみ等)でも正しく扱えるよう、急所率はオプションごとに求め直す。
        var nr = calcWith(inp, offO), cr = calcWith(inp, onO);
        var cRate = inp.__isBase ? critRate : critRateFromResult(calcWith(inp, opts));
        for(var j=0;j<M.maxHits;j++) out.push({ pCrit: cRate, nrm: distFromRolls(rollsAt(nr,j)), crt: distFromRolls(rollsAt(cr,j)) });
      }
      return out;
    };
    return M;
  }

  function makeRegistry(){
    var tbl = Object.create(null), arr = [];
    return { arr: arr, id: function(m){ var k = mKeyOf(m); var id = tbl[k]; if(id == null){ id = arr.length; tbl[k] = id; arr.push(m); } return id; } };
  }

  // ---- 効果状態 m に対する、その時点での両者の状態(特性・持ち物・タイプ・天候・フィールド) ----
  function buildView(P, m){
    var b = P.ctx, x = m.extra || {}, o = P.input.options || {};
    function side(sd){
      var base = b[sd], v = Object.assign({}, base);
      if(x.abil && x.abil[sd] !== undefined){ v.ability = x.abil[sd]; v.abilityRaw = x.abil[sd]; }
      if(sd==='D' && x.defenderNoAbility){ v.ability = null; v.abilityRaw = null; }
      var held = base.heldItem ? base.heldItem.name : null, overridden = false;
      if(x.item && x.item[sd] !== undefined){ held = x.item[sd]; overridden = true; }
      if(m.itemGone[sd]) held = null;
      v.heldName = held;
      v.heldItem = held ? (overridden ? itemByName(held) : base.heldItem) : null;
      if(!held) v.item = null;
      else if(overridden){
        var pre = sd==='A' ? 'attacker' : 'defender';
        v.item = (v.ability==='ぶきよう' || o.magicRoom || o[pre+'Embargo']) ? null : held;
      } else v.item = base.item;
      if(sd==='D' && x.typesD) v.types = x.typesD.slice();
      v.grass = v.types.indexOf('くさ') >= 0;
      if(x.weather) v.weather = x.weather;
      if(sd==='D'){
        if(base.item==='ふうせん' && v.item!=='ふうせん') v.grounded = v.types.indexOf('ひこう') < 0 && v.ability!=='ふゆう' && !o.defenderMagnetRise && !o.defenderTelekinesis;
        if(x.defenderRootedSmacked) v.grounded = true;
      }
      v.hpMax = sd==='A' ? P.aMax : P.dMax;
      return v;
    }
    return { A: side('A'), D: side('D'), field: x.field || b.field, __opts: o };
  }

  // ---- きのみ ----
  var PINCH_BERRY = { 'チイラのみ':'A', 'リュガのみ':'B', 'ヤタピのみ':'C', 'ズアのみ':'D', 'カムラのみ':'S' };
  function hpBerrySpecByName(name, maxHp, ability){
    var ripen = ability==='じゅくせい', glut = ability==='くいしんぼう';
    if(name==='オボンのみ') return { thr: Math.floor(maxHp/2), amt: ripen ? Math.floor(maxHp/2) : Math.floor(maxHp/4), berry: true };
    if(['フィラのみ','ウイのみ','マゴのみ','バンジのみ','イアのみ'].indexOf(name)>=0) return { thr: glut ? Math.floor(maxHp/2) : Math.floor(maxHp/4), amt: ripen ? Math.floor(maxHp*2/3) : Math.floor(maxHp/3), berry: true };
    if(name==='オレンのみ') return { thr: Math.floor(maxHp/2), amt: ripen ? 20 : 10, berry: true };
    if(name==='きのみジュース') return { thr: Math.floor(maxHp/2), amt: 20, berry: false };
    return null;
  }
  // side側の、残りHPで発動するきのみ(回復・ピンチきのみ)の分岐。発動しなければnull。
  function berryBranches(P, s, side, cx){
    var v = cx[side], name = v.item;
    if(!name) return null;
    var it = v.heldItem || itemByName(name);
    var isBerry = !!(it && it.isBerry) || /のみ$/.test(name);
    var opp = cx[side==='A' ? 'D' : 'A'];
    if(isBerry && (opp.ability==='きんちょうかん' || opp.ability==='じんばいったい')) return null;
    var hp, max;
    if(side==='A'){ if(s.aHp == null || s.aHp <= 0) return null; hp = s.aHp; max = P.aMax; }
    else { if(s.fn) return null; hp = s.hp; max = P.dMax; }
    var ripen = v.ability==='じゅくせい';
    var spec = hpBerrySpecByName(name, max, v.ability);
    if(spec){
      if(hp > spec.thr || (side==='D' && s.m.extra.healBlockD)) return null;
      return [{ p: 1, apply: function(m, s2, info, c2){
        if(side==='A') m.hp.aHeal += spec.amt; else m.hp.dHeal += spec.amt;
        lg(m, side, name+': HP'+spec.amt+'回復');
        consumeItem(m, c2, side, spec.berry);
        if(side==='D') s2.bf = 1;
      } }];
    }
    var thr = v.ability==='くいしんぼう' ? Math.floor(max/2) : Math.floor(max/4);
    if(hp > thr) return null;
    var n = ripen ? 2 : 1;
    if(PINCH_BERRY[name]){
      var st = PINCH_BERRY[name];
      return [{ p: 1, apply: function(m, s2, info, c2){
        var d = {}; d[st] = n;
        lg(m, side, '['+name+']');
        applyRankEvent(m, c2, side, d, side);
        consumeItem(m, c2, side, true);
        if(side==='D') s2.bf = 1;
      } }];
    }
    if(name==='サンのみ' || name==='ミクルのみ'){
      return [{ p: 1, apply: function(m, s2, info, c2){
        if(side==='A'){
          if(name==='サンのみ'){ m.extra.critPlus = (m.extra.critPlus||0) + 2; lg(m, side, 'サンのみ: 急所ランク+2'); }
          else { m.extra.micle = true; lg(m, side, 'ミクルのみ: 次の技の命中率アップ'); }
        } else lg(m, side, name+'（表示のみ）');
        consumeItem(m, c2, side, true);
        if(side==='D') s2.bf = 1;
      } }];
    }
    if(name==='スターのみ'){
      return RANK_KEYS.filter(function(k){ return k!=='acc' && k!=='eva'; }).slice(0,5).map(function(k, i, arr){
        return { p: 1/arr.length, apply: function(m, s2, info, c2){
          var d = {}; d[k] = 2*n;
          lg(m, side, '[スターのみ]');
          applyRankEvent(m, c2, side, d, side);
          consumeItem(m, c2, side, true);
          if(side==='D') s2.bf = 1;
        } };
      });
    }
    return null;
  }
  function berryEvent(side, stage, at, extraWhen){
    return { name: 'berry'+side, stage: stage, at: at, actor: '-', onHit: true, onMiss: true, subBlockable: false,
             when: extraWhen || null,
             branches: function(s, info, cx, P){ return berryBranches(P, s, side, cx); } };
  }

  // ---- 天候・フィールドの変化に伴う効果(シード系・こだいかっせい/クォークチャージ) ----
  var SEED_OF = { 'エレキシード':['エレキフィールド','B'], 'グラスシード':['グラスフィールド','B'], 'ミストシード':['ミストフィールド','D'], 'サイコシード':['サイコフィールド','D'] };
  function paradoxBestStat(P, m, side){
    // その時点のランク補正込み実数値(すばやさは補正後すばやさ)が最も高い能力(同値はA>B>C>D>Sの順)。
    var inp = P.input;
    var opts = applyEffectMods(freshOpts(inp.options), m);
    var r = C.calculateDamage({ attacker: inp.attacker, defender: inp.defender, move: inp.move, attackerLevel: inp.attackerLevel, defenderLevel: inp.defenderLevel, options: opts });
    var line = (r.trace||[]).find(function(t){ return String(t.label).indexOf(side==='A' ? '攻撃側ランク補正込み実数値' : '防御側ランク補正込み実数値') >= 0; });
    var sp = (r.trace||[]).find(function(t){ return String(t.label).indexOf(side==='A' ? 'すばやさ詳細（攻撃側）' : 'すばやさ詳細（防御側）') >= 0; });
    var mm = line && String(line.value||'').match(/\/\s*(\d+)\/(\d+)\/(\d+)\/(\d+)\/(\d+)\s*$/);
    if(!mm) return null;
    var vals = { A:+mm[1], B:+mm[2], C:+mm[3], D:+mm[4], S: sp ? Number(String(sp.value).match(/\d+/)||mm[5]) : +mm[5] };
    var best = 'A';
    ['B','C','D','S'].forEach(function(k){ if(vals[k] > vals[best]) best = k; });
    return best;
  }
  function onEnvChange(P, m, s, before){
    var cx = buildView(P, m);
    var o = P.input.options || {};
    var fieldNow = cx.field, fieldChanged = fieldNow !== before.field;
    ['A','D'].forEach(function(sd){
      var v = cx[sd];
      // シード系: フィールドがその種類に「なった」とき(入力時点で既にその状態だった場合は対象外)。
      if(fieldChanged && v.item && SEED_OF[v.item] && SEED_OF[v.item][0]===fieldNow){
        var d = {}; d[SEED_OF[v.item][1]] = 1;
        var seed = v.item;
        lg(m, sd, '['+seed+']');
        applyRankEvent(m, cx, sd, d, sd);
        consumeItem(m, cx, sd, false);
      }
      var pre = sd==='A' ? 'attacker' : 'defender';
      var already = (m.extra.paradox && m.extra.paradox[sd]) || (o[pre+'ParadoxBoostStat'] && o[pre+'ParadoxBoostStat']!=='none');
      if(!already && v.ability==='クォークチャージ' && fieldChanged && fieldNow==='エレキフィールド' && (P.ctx.field||'なし')!=='エレキフィールド'){
        var bs = paradoxBestStat(P, m, sd);
        if(bs){ (m.extra.paradox || (m.extra.paradox = {}))[sd] = bs; lg(m, sd, 'クォークチャージ発動('+RANK_LABEL[bs]+')'); }
      }
      if(!already && v.ability==='こだいかっせい' && isSunny(v.weather) && !isSunny(before['w'+sd]) && !isSunny(P.ctx[sd].weather)){
        var bs2 = paradoxBestStat(P, m, sd);
        if(bs2){ (m.extra.paradox || (m.extra.paradox = {}))[sd] = bs2; lg(m, sd, 'こだいかっせい発動('+RANK_LABEL[bs2]+')'); }
      }
    });
  }

  // 追跡用のHP項目(反動・吸収・HP消費・回復)を状態のHPへ反映して消去する。戻り値: 攻撃側のHPが減ったか。
  function flushHp(P, s, info){
    var h = s.m.hp, aMax = P.aMax, dMax = P.dMax;
    var roundFiveDown = window.DAMEKE_ROUNDING.roundFiveDown;
    var a0 = s.aHp;
    if(h.recoil){
      if(s.aHp != null && s.aHp > 0 && s.dealt > 0) s.aHp -= Math.max(1, Math.round(s.dealt*h.recoil[0]/h.recoil[1]));
      h.recoil = null;
    }
    if(h.drain){
      var d = info ? info.dealtHit : 0;
      if(s.aHp != null && s.aHp > 0 && d > 0){
        var amt = Math.max(1, Math.round(d*h.drain.r[0]/h.drain.r[1]));
        if(h.drain.bigRoot) amt = roundFiveDown(amt*5324/4096);
        if(h.drain.ooze){ if(!h.drain.oozeBlocked) s.aHp -= amt; }
        else s.aHp = Math.min(aMax, s.aHp + amt);
      }
      h.drain = null;
    }
    if(h.aLoss){ if(s.aHp != null && s.aHp > 0) s.aHp -= h.aLoss; h.aLoss = 0; }
    if(h.aFaint){ s.aHp = 0; h.aFaint = false; }
    if(h.aHeal){ if(s.aHp != null && s.aHp > 0) s.aHp = Math.min(aMax, s.aHp + h.aHeal); h.aHeal = 0; }
    if(h.finale){ if(s.aHp != null && s.aHp > 0) s.aHp = Math.min(aMax, Math.floor((2*s.aHp + Math.floor(2*aMax/6))/2)); h.finale = false; }
    if(h.dHeal){ if(!s.fn) s.hp = Math.min(dMax, s.hp + h.dHeal); h.dHeal = 0; }
    var d0 = s.hp, dDropped = false;
    if(h.dLoss){ if(!s.fn){ s.hp -= h.dLoss; if(s.hp <= 0) s.fn = 1; else dDropped = true; } h.dLoss = 0; }
    if(s.aHp != null && s.aHp < 0) s.aHp = 0;
    return { a: a0 != null && s.aHp != null && s.aHp < a0 && s.aHp > 0, d: dDropped };
  }
  function subBlockedNow(ev, s, info){
    if(!ev.subBlockable) return false;
    if(info) return !!info.toSub;
    if(ev.stage === 'pre') return s.sub != null;
    return !s.bh;
  }
  // ---- 表示用: どの種類(技・特性・持ち物・フィールド)の効果が、どの状態を変えたかを記録する ----
  var CAT_BY_NAME = { consumeOnHit:'持ち物', consumeGem:'持ち物', flinchItem:'持ち物', poisonTouch:'特性', defAbility:'特性', defItem1:'持ち物', defItem2:'持ち物',
    magician:'特性', colorChange:'特性', halfHpAbility:'特性', defItem3:'持ち物', attItem20:'持ち物', emergencyExit:'特性', pickpocket:'特性',
    throatSpray:'持ち物', naturalGift:'技', blunderPolicy:'持ち物', afterMove:'特性', afterMoveItems:'持ち物', steadfast:'特性', dancer:'特性', berryA:'持ち物', berryD:'持ち物',
    absorb:'特性', 'eot:sand':'フィールド', 'eot:weatherAbility':'特性', 'eot:grassy':'フィールド', 'eot:shedSkin':'特性', 'eot:leftovers':'持ち物',
    'eot:ingrain':'技', 'eot:poison':'状態異常', 'eot:burn':'状態異常', 'eot:speedBoost':'特性', 'eot:orbs':'持ち物', 'eot:whiteHerb':'持ち物',
    'eot:ひのうみ':'フィールド', 'eot:キョダイマックスわざ':'技', 'eot:バインド':'技', 'eot:しおづけ':'技', 'eot:harvest':'特性' };
  function catOf(ev){
    if(ev.cat) return ev.cat;
    var n = ev.name || '';
    if(n.indexOf('plan:') === 0) return '技';
    if(CAT_BY_NAME[n]) return CAT_BY_NAME[n];
    var base = n.replace(/:[AD]$/, '');
    return CAT_BY_NAME[base] || 'その他';
  }
  function recordTouch(P, ev, s, s2, cx, cx2, aBefore){
    var cat = catOf(ev), t = P.touch, m = s.m, m2 = s2.m;
    function mark(k){ var o = t[k] || (t[k] = {}); o[cat] = 1; }
    ['A','D'].forEach(function(sd){
      if(m.status[sd] !== m2.status[sd]) mark(sd+'.status');
      RANK_KEYS.forEach(function(k){ if(m.ranks[sd][k] !== m2.ranks[sd][k]) mark(sd+'.rank.'+k); });
      if(cx[sd].heldName !== cx2[sd].heldName) mark(sd+'.item');
      if(cx[sd].abilityRaw !== cx2[sd].abilityRaw) mark(sd+'.ability');
    });
    if(m.confusion !== m2.confusion) mark('D.confusion');
    if(stableStr(cx.D.types) !== stableStr(cx2.D.types)) mark('D.types');
    if(cx.field !== cx2.field) mark('field');
    if(cx.A.weather !== cx2.A.weather) mark('weather');
    if(aBefore != null && s2.aHp != null && s2.aHp <= 0 && (s.aHp == null || s.aHp > 0)) mark('A.faint');
    var d0 = m.extra.disp || {}, d2 = m2.extra.disp || {};
    Object.keys(d2).forEach(function(k){
      if(d0[k]) return;
      // ひるみは、ひるませた効果(技・持ち物・特性)の種類で表示する。
      if(k === 'D:ひるみ' && typeof m.extra.flinch === 'string'){ var o = t['disp.'+k] || (t['disp.'+k] = {}); o[m.extra.flinch] = 1; return; }
      mark('disp.'+k);
    });
  }

  // 1つの分岐を適用する(効果 → 天候・フィールド変化の連鎖 → HPの反映)。
  function fireBranch(P, s, b, info, ev){
    var m2 = cloneM(s.m);
    var s2 = stCopy(s);
    s2.m = m2;
    var cx = buildView(P, s.m);
    var before = { field: cx.field, wA: cx.A.weather, wD: cx.D.weather };
    b.apply(m2, s2, info, cx);
    var cx2 = buildView(P, m2);
    var envChanged = cx2.field !== before.field || cx2.A.weather !== before.wA || cx2.D.weather !== before.wD;
    if(envChanged) onEnvChange(P, m2, s2, before);
    var aBefore = s2.aHp;
    var dropped = flushHp(P, s2, info);
    if(P.touch && ev) recordTouch(P, ev, s, s2, cx, envChanged ? buildView(P, m2) : cx2, aBefore);
    s2.mk = P.reg.id(m2);
    if(s2.fn && P.mode === 'prob') return [{ w: 1, s: FAINT_STATE }];
    // ダメージを受けたら、その直後にきのみ(回復・ピンチ)の判定を割り込ませる(技のダメージ以外による
    // 防御側のHP減少(ターン終了時のダメージ等)と、攻撃側のHP減少)。
    var bev = [];
    if(dropped.a) bev.push(P.berryA);
    if(dropped.d) bev.push(P.berryD);
    if(bev.length) return runEvents(P, s2, bev, info, 'hit', P.mode, true);
    return [{ w: 1, s: s2 }];
  }
  // 1つの状態に効果の列を順に適用し、[{w, s}]の分岐を返す。path: 'hit' / 'miss'。
  function runEvents(P, s, evs, info, path, mode, force){
    var cur = [{ w: 1, s: s }];
    for(var i=0; i<evs.length; i++){
      var ev = evs[i], nxt = [];
      for(var j=0; j<cur.length; j++){
        var c = cur[j], st = c.s;
        // 表示モードでは、技①で相手がひんしになった分岐にも(相手が耐えた場合と同じく)効果を適用しておく
        // (技②の「本来入るはずのダメージ」の表示用)。瀕死率モードではひんしの分岐は終端。
        var ok = (!st.fn || mode === 'display') && (force || (path === 'hit' ? ev.onHit : ev.onMiss));
        // 使用者が場から去っている(ひんし)ときは、使用者の技・特性・持ち物の効果は発動しない。
        if(ok && ev.actor === 'A' && aFainted(st)) ok = false;
        if(ok && ev.subBlockable && subBlockedNow(ev, st, info) && !ev.subPartial) ok = false;
        var cx = ok ? P.view(st) : null;
        if(ok && ev.when && !ev.when(st, info, cx, P, path)) ok = false;
        var brs = ok ? ev.branches(st, info, cx, P, path) : null;
        if(!brs || !brs.length){ nxt.push(c); continue; }
        if(mode === 'display' && brs[0].displayAll){
          for(var da=0; da<brs.length; da++){
            if(!(brs[da].p > 0)) continue;
            var dOut = fireBranch(P, st, brs[da], info, ev);
            for(var dj=0; dj<dOut.length; dj++) nxt.push({ w: c.w*brs[da].p*dOut[dj].w, s: dOut[dj].s });
          }
          continue;
        }
        if(mode === 'display'){
          var fb = null;
          for(var bi=0; bi<brs.length; bi++) if(brs[bi].p >= 1 - 1e-12){ fb = brs[bi]; break; }
          if(!fb){ nxt.push(c); continue; }
          var fo = fireBranch(P, st, fb, info, ev);
          for(var fi=0; fi<fo.length; fi++) nxt.push({ w: c.w*fo[fi].w, s: fo[fi].s });
          continue;
        }
        var rest = 1;
        for(var bj=0; bj<brs.length; bj++) rest -= brs[bj].p;
        if(rest > 1e-12) nxt.push({ w: c.w*rest, s: st });
        for(var bk=0; bk<brs.length; bk++){
          if(!(brs[bk].p > 0)) continue;
          var outs = fireBranch(P, st, brs[bk], info, ev);
          for(var oi=0; oi<outs.length; oi++) nxt.push({ w: c.w*brs[bk].p*outs[oi].w, s: outs[oi].s });
        }
      }
      cur = nxt;
    }
    return cur;
  }

  // ---- 表(DAMEKE_MOVE_EFFECTS)由来の効果を、パイプラインの共通形式へ ----
  function planToEvent(pev, eff){
    // 使用者がひんしでも発生するもの: ほのお技による解凍、場の状態(ひのうみ)・ターン終了時の効果。
    var noActor = pev.e.k === 'thawTarget' || pev.stage === 'eot';
    return {
      name: 'plan:'+pev.e.k, stage: pev.stage, at: pev.at, actor: noActor ? '-' : 'A', onHit: pev.onHit, onMiss: pev.onMiss,
      subBlockable: pev.subBlockable, subPartial: pev.e.k === 'fling',
      branches: function(s, info, cx){
        var subBlocked = pev.subBlockable && subBlockedNow(pev, s, info);
        function mk(rnd){
          return function(m, s2, inf, c2){
            if(pev.e.k === 'fling' && subBlocked){ if(c2.A.heldItem){ lg(m, 'A', 'なげつける: '+c2.A.heldItem.name+'を失う'); consumeItem(m, c2, 'A', false); } return; }
            if(pev.e.k === 'flinch'){ if(!m.extra.flinch) m.extra.flinch = '技'; return; }
            if(pev.e.k === 'dispNote'){ dispNote(m, c2, pev.e.t==='self' ? 'A' : 'D', pev.e.text); return; }
            eff.applyEvent(m, pev, rnd, c2);
          };
        }
        if(pev.e.k === 'statusOneOf'){
          var n = pev.e.sts.length;
          return pev.e.sts.map(function(_, r){ return { p: pev.prob/n, apply: mk(r) }; });
        }
        return [{ p: pev.prob, apply: mk(0) }];
      }
    };
  }

  // ---- 特性・持ち物の効果(入力シートに基づく) ----
  function rankApply(m, cx, side, deltas, source, label){
    if(label) lg(m, side, '['+label+']');
    applyRankEvent(m, cx, side, deltas, source);
  }
  function one(apply){ return [{ p: 1, apply: apply }]; }
  function dmgToA(m, cx, frac){ if(cx.A.ability === 'マジックガード') return; m.hp.aLoss += Math.max(1, Math.floor(cx.A.hpMax/frac)); }
  function removableFrom(cx, sd){
    var it = cx[sd].heldItem;
    if(!it) return false;
    var D = window.DAMEKE_DATA;
    if(D.findFormByLinkedItem && D.findFormByLinkedItem(cx[sd].pokemon, it.name)) return false;
    if(/Z$/.test(it.name||'') || /メール$/.test(it.name||'')) return false;
    return true;
  }
  function buildTriggers(P, eff){
    var mv = P.mv, T = [];
    function add(ev){ ev.onHit = ev.onHit !== false; ev.onMiss = !!ev.onMiss; ev.subBlockable = !!ev.subBlockable; T.push(ev); }
    function bodyHit(info){ return !!info && !info.toSub; }
    function contactNoPads(cx){ return mv.contact && cx.A.item !== 'ぼうごパット'; }
    function dAb(cx, n){ return cx.D.ability === n; }

    // ---- 手順1前後: 半減きのみの消費(最初のヒット) ----
    add({ name:'consumeOnHit', stage:'hit', at:901, actor:'-', when: function(s, info, cx){ return !!info; },
      branches: function(s, info, cx){
        var resist = P.result.resistBerryConsumed && cx.D.heldItem && cx.D.heldItem.isBerry && !s.m.itemGone.D;
        if(!resist) return null;
        return one(function(m, s2, inf, c2){ consumeItem(m, c2, 'D', true); s2.bf = 1; });
      } });
    // ジュエル: 発動した場合は連続攻撃の全ヒットに補正がかかるため、状態としての消費は全ヒットの後に反映する。
    add({ name:'consumeGem', stage:'post', at:1450, actor:'-',
      when: function(s, info, cx){ return !!P.result.gemConsumed && !!cx.A.heldItem && /ジュエル$/.test(cx.A.heldItem.name||''); },
      branches: function(){ return one(function(m, s2, inf, c2){ consumeItem(m, c2, 'A', false); }); } });

    // ---- 手順9: おうじゃのしるし・するどいキバ・あくしゅう(ひるみ。技自体にひるみ効果があるときは対象外) ----
    if(!eff.moveHasFlinch){
      add({ name:'flinchItem', stage:'hit', at:926, actor:'A', subBlockable:true, when: function(s, info, cx){ return bodyHit(info) && (cx.A.item==='おうじゃのしるし' || cx.A.item==='するどいキバ' || cx.A.ability==='あくしゅう'); },
        branches: function(s, info, cx){
          var n = (cx.A.item==='おうじゃのしるし' || cx.A.item==='するどいキバ' ? 1 : 0) + (cx.A.ability==='あくしゅう' ? 1 : 0);
          var p1 = Math.min(1, 0.1 * Math.min(2, eff.chanceMul));
          var p = 1 - Math.pow(1 - p1, n);
          var fcat = (cx.A.item==='おうじゃのしるし' || cx.A.item==='するどいキバ') ? '持ち物' : '特性';
          return [{ p: p, apply: function(m){ if(!m.extra.flinch) m.extra.flinch = fcat; } }];
        } });
    }

    // ---- 手順10-6: どくしゅ(攻撃側) / どくのくさり ----
    add({ name:'poisonTouch', stage:'hit', at:1060, actor:'A', subBlockable:true,
      when: function(s, info, cx){ return bodyHit(info) && !P.shieldDust(cx) && ((cx.A.ability==='どくしゅ' && mv.contact) || cx.A.ability==='どくのくさり'); },
      branches: function(s, info, cx){
        var st = cx.A.ability==='どくしゅ' ? 'どく' : 'もうどく';
        return [{ p: 0.3, apply: function(m, s2, inf, c2){ lg(m, 'A', '['+c2.A.ability+']'); tryInflictStatus(m, c2, 'D', st, 'A', true); } }];
      } });

    // ---- 手順10-7: 防御側の特性 ----
    add({ name:'defAbility', stage:'hit', at:1070, actor:'-', subBlockable:true,
      when: function(s, info, cx){ return bodyHit(info) && !!cx.D.ability; },
      branches: function(s, info, cx){
        var ab = cx.D.ability, aAlive = !aFainted(s);
        var cnp = contactNoPads(cx);
        switch(ab){
          case 'てつのトゲ': case 'さめはだ':
            if(!cnp || !aAlive) return null;
            return one(function(m, s2, inf, c2){ lg(m, 'D', ab); dmgToA(m, c2, 8); });
          case 'どくのトゲ': case 'せいでんき': case 'ほのおのからだ':
            if(!cnp || !aAlive) return null;
            var st = ab==='どくのトゲ' ? 'どく' : (ab==='せいでんき' ? 'まひ' : 'やけど');
            return [{ p: 0.3, apply: function(m, s2, inf, c2){ lg(m, 'D', '['+ab+']'); tryInflictStatus(m, c2, 'A', st, 'D', true); } }];
          case 'ほうし':
            if(!cnp || !aAlive || cx.A.grass || cx.A.ability==='ぼうじん' || cx.A.item==='ぼうじんゴーグル') return null;
            return [['どく',0.09],['まひ',0.10],['ねむり',0.11]].map(function(x){
              return { p: x[1], apply: function(m, s2, inf, c2){ lg(m, 'D', '[ほうし]'); tryInflictStatus(m, c2, 'A', x[0], 'D', true); } };
            });
          case 'メロメロボディ':
            if(!cnp || !aAlive) return null;
            return [{ p: 0.3, apply: function(m, s2, inf, c2){ mentalEffect(m, c2, 'A', 'メロメロ', true); } }];
          case 'ミイラ': case 'とれないにおい':
            if(!cnp || !aAlive || !cx.A.abilityRaw || cx.A.abilityRaw===ab || pokemonAbilityLocked(cx.A.abilityRaw)) return null;
            return one(function(m){ (m.extra.abil || (m.extra.abil = {})).A = ab; lg(m, 'A', '特性が'+ab+'になる'); });
          case 'さまようたましい':
            if(!cnp || !aAlive || !cx.A.abilityRaw || pokemonAbilityLocked(cx.A.abilityRaw) || WANDERING_EXTRA_LOCK.indexOf(cx.A.abilityRaw)>=0) return null;
            return one(function(m, s2, inf, c2){ var a = c2.A.abilityRaw; var ab2 = m.extra.abil || (m.extra.abil = {}); ab2.A = 'さまようたましい'; ab2.D = a; lg(m, 'D', 'さまようたましい: 特性を入れ替える('+a+')'); });
          case 'ぬめぬめ': case 'カーリーヘアー':
            if(!cnp || !aAlive) return null;
            return one(function(m, s2, inf, c2){ rankApply(m, c2, 'A', {S:-1}, 'D', ab); });
          case 'ほろびのボディ':
            if(!cnp) return null;
            return one(function(m){ noteLog(m, null, 'ほろびのボディ: 両者ほろびのうた（表示のみ）'); });
          case 'のろわれボディ':
            if(!aAlive || P.futureSight) return null;
            return [{ p: 0.3, apply: function(m, s2, inf, c2){ mentalEffect(m, c2, 'A', 'かなしばり', false); } }];
          case 'じきゅうりょく': return one(function(m, s2, inf, c2){ rankApply(m, c2, 'D', {B:1}, 'D', ab); });
          case 'すなはき':
            var w0 = cx.D.weather || 'なし';
            if(w0==='すなあらし' || ['おおひでり','おおあめ','らんきりゅう'].indexOf(w0)>=0) return null;
            return one(function(m){ m.extra.weather = 'すなあらし'; lg(m, 'D', 'すなはき: すなあらしにする'); });
          case 'わたげ':
            if(!aAlive) return null;
            return one(function(m, s2, inf, c2){ rankApply(m, c2, 'A', {S:-1}, 'D', ab); });
          case 'こぼれダネ':
            if(cx.field==='グラスフィールド') return null;
            return one(function(m){ m.extra.field = 'グラスフィールド'; lg(m, 'D', 'こぼれダネ: グラスフィールドにする'); });
          case 'くだけるよろい':
            if(mv.cat!=='物理') return null;
            return one(function(m, s2, inf, c2){ rankApply(m, c2, 'D', {B:-1, S:2}, 'D', ab); });
          case 'どくげしょう':
            if(mv.cat!=='物理') return null;
            return one(function(m){ noteLog(m, 'A', 'どくげしょう: どくびし（表示のみ）'); });
          case 'みずがため': if(mv.type!=='みず') return null; return one(function(m, s2, inf, c2){ rankApply(m, c2, 'D', {B:2}, 'D', ab); });
          case 'せいぎのこころ': if(mv.type!=='あく') return null; return one(function(m, s2, inf, c2){ rankApply(m, c2, 'D', {A:1}, 'D', ab); });
          case 'びびり': if(['あく','ゴースト','むし'].indexOf(mv.type)<0) return null; return one(function(m, s2, inf, c2){ rankApply(m, c2, 'D', {S:1}, 'D', ab); });
          case 'じょうききかん': if(mv.type!=='みず' && mv.type!=='ほのお') return null; return one(function(m, s2, inf, c2){ rankApply(m, c2, 'D', {S:6}, 'D', ab); });
          case 'ねつこうかん': if(mv.type!=='ほのお') return null; return one(function(m, s2, inf, c2){ rankApply(m, c2, 'D', {A:1}, 'D', ab); });
          case 'いかりのつぼ': if(!info.crit) return null; return one(function(m, s2, inf, c2){ rankApply(m, c2, 'D', {A:12}, 'D', ab); });
        }
        return null;
      } });

    // ---- 手順10-8: 防御側の持ち物(その1) ----
    add({ name:'defItem1', stage:'hit', at:1080, actor:'-',
      when: function(s, info, cx){ return !!info && !!cx.D.item; },
      branches: function(s, info, cx){
        var it = cx.D.item, body = bodyHit(info), aAlive = !aFainted(s);
        // ふうせん: みがわりに当たっても割れる(2-7)。
        if(it==='ふうせん') return one(function(m, s2, inf, c2){ lg(m, 'D', 'ふうせんが割れる'); consumeItem(m, c2, 'D', false); });
        if(!body) return null;
        if(it==='ナゾのみ'){
          if(!mv.se || s.fn || s.m.extra.healBlockD) return null;
          if(cx.A.ability==='きんちょうかん' || cx.A.ability==='じんばいったい') return null;
          var amt = Math.floor(P.dMax/4) * (cx.D.ability==='じゅくせい' ? 2 : 1);
          return one(function(m, s2, inf, c2){ m.hp.dHeal += amt; lg(m, 'D', 'ナゾのみ: HP'+amt+'回復'); consumeItem(m, c2, 'D', true); s2.bf = 1; });
        }
        if(it==='じゃくてんほけん'){
          if(!mv.se || !(info.dmg > 0) || (mv.fixedDamage && !mv.ohko)) return null;
          return one(function(m, s2, inf, c2){ rankApply(m, c2, 'D', {A:2, C:2}, 'D', it); consumeItem(m, c2, 'D', false); });
        }
        var typeItems = { 'じゅうでんち':['でんき',{C:1}], 'ゆきだま':['こおり',{A:1}], 'きゅうこん':['みず',{C:1}], 'ひかりごけ':['みず',{D:1}] };
        if(typeItems[it]){
          if(mv.type !== typeItems[it][0]) return null;
          return one(function(m, s2, inf, c2){ rankApply(m, c2, 'D', typeItems[it][1], 'D', it); consumeItem(m, c2, 'D', false); });
        }
        if(it==='ゴツゴツメット'){
          if(!contactNoPads(cx) || !aAlive) return null;
          return one(function(m, s2, inf, c2){ lg(m, 'D', 'ゴツゴツメット'); dmgToA(m, c2, 6); });
        }
        if(it==='くっつきバリ'){
          if(!mv.contact || !aAlive || cx.A.heldName) return null;
          return one(function(m, s2, inf, c2){ lg(m, 'D', 'くっつきバリが攻撃側に移る'); consumeItem(m, c2, 'D', false); setHeldItem(m, 'A', 'くっつきバリ'); });
        }
        return null;
      } });

    // ---- 手順10-10: ジャポのみ・レンブのみ ----
    add({ name:'defItem2', stage:'hit', at:1100, actor:'-', subBlockable:true,
      when: function(s, info, cx){ return bodyHit(info) && (cx.D.item==='ジャポのみ' || (cx.D.item==='レンブのみ' && !P.futureSight)) && !aFainted(s); },
      branches: function(s, info, cx){
        var it = cx.D.item;
        if((it==='ジャポのみ' && mv.cat!=='物理') || (it==='レンブのみ' && mv.cat!=='特殊')) return null;
        if(cx.A.ability==='きんちょうかん' || cx.A.ability==='じんばいったい') return null;
        return one(function(m, s2, inf, c2){
          lg(m, 'D', it);
          if(c2.A.ability !== 'マジックガード') m.hp.aLoss += Math.max(1, Math.floor(P.aMax/8)) * (c2.D.ability==='じゅくせい' ? 2 : 1);
          consumeItem(m, c2, 'D', true);
          s2.bf = 1;
        });
      } });

    // ---- 手順13-1: 連続攻撃のきのみ判定(両者) ----
    // (攻撃側のきのみは、攻撃側がダメージを受けた直後に割り込んで判定する)
    if(P.multi) T.push(berryEvent('D', 'hit', 1311, function(s){ return !!s.bh; }));

    // ---- 手順16: マジシャン(攻撃側) / へんしょく・ぎゃくじょう・いかりのこうら(防御側) ----
    add({ name:'magician', stage:'post', at:1600, actor:'A',
      when: function(s, info, cx){ return s.bh && cx.A.ability==='マジシャン' && !P.ctx.A.heldItem && !cx.A.heldName && !!cx.D.heldName && cx.D.ability!=='ねんちゃく' && removableFrom(cx, 'D'); },
      branches: function(s, info, cx){
        var nm = cx.D.heldName;
        return one(function(m, s2, inf, c2){ lg(m, 'A', 'マジシャン: '+nm+'を奪う'); consumeItem(m, c2, 'D', false); setHeldItem(m, 'A', nm); });
      } });
    add({ name:'colorChange', stage:'post', at:1601, actor:'-',
      when: function(s, info, cx){
        var tera = (P.input.options||{}).defenderTeraType;
        return s.bh && !s.fn && cx.D.ability==='へんしょく' && (!tera || tera==='なし') && mv.type && mv.type!=='タイプなし' && mv.type!=='なし' && cx.D.types.indexOf(mv.type) < 0 && !eff.sheerForceBoost;
      },
      branches: function(){ return one(function(m){ m.extra.typesD = [mv.type]; lg(m, 'D', 'へんしょく: '+mv.type+'タイプになる'); }); } });
    add({ name:'halfHpAbility', stage:'post', at:1602, actor:'-',
      when: function(s, info, cx){ return s.bh && !s.fn && (cx.D.ability==='ぎゃくじょう' || cx.D.ability==='いかりのこうら') && P.startHp*2 > P.dMax && s.hp*2 <= P.dMax; },
      branches: function(s, info, cx){
        var ab = cx.D.ability;
        return one(function(m, s2, inf, c2){ rankApply(m, c2, 'D', ab==='ぎゃくじょう' ? {C:1} : {A:1, B:-1, C:1, D:-1, S:1}, 'D', ab); });
      } });

    // ---- 手順17: アッキのみ・タラプのみ / だっしゅつボタン・レッドカード(表示) ----
    add({ name:'defItem3', stage:'post', at:1700, actor:'-',
      when: function(s, info, cx){ return s.bh && !s.fn && !!cx.D.item; },
      branches: function(s, info, cx){
        var it = cx.D.item;
        if((it==='アッキのみ' && mv.cat==='物理') || (it==='タラプのみ' && mv.cat==='特殊')){
          if(cx.A.ability==='きんちょうかん' || cx.A.ability==='じんばいったい') return null;
          var n = cx.D.ability==='じゅくせい' ? 2 : 1;
          return one(function(m, s2, inf, c2){ var d = {}; d[it==='アッキのみ' ? 'B' : 'D'] = n; rankApply(m, c2, 'D', d, 'D', it); consumeItem(m, c2, 'D', true); s2.bf = 1; });
        }
        if(P.futureSight && (it==='だっしゅつボタン' || it==='レッドカード')) return null;
        if(it==='だっしゅつボタン' && !eff.sheerForceBoost) return one(function(m){ noteLog(m, 'D', 'だっしゅつボタン: 交代（表示のみ）'); });
        if(it==='レッドカード') return one(function(m){ noteLog(m, 'A', 'レッドカード: 強制交代（表示のみ）'); });
        return null;
      } });

    // ---- 手順20: いのちのたま・かいがらのすず ----
    add({ name:'attItem20', stage:'post', at:2000, actor:'A',
      when: function(s, info, cx){ return s.dealt > 0 && (cx.A.item==='いのちのたま' || cx.A.item==='かいがらのすず'); },
      branches: function(s, info, cx){
        if(cx.A.item==='いのちのたま'){
          if(cx.A.ability==='マジックガード' || eff.sheerForceBoost) return null;
          return one(function(m){ lg(m, 'A', 'いのちのたま'); m.hp.aLoss += Math.max(1, Math.floor(P.aMax/10)); });
        }
        if(eff.sheerForceBoost || (P.result.disguiseTriggered && P.startSub == null)) return null;
        var h = Math.max(1, Math.floor(s.dealt/8));
        return one(function(m){ lg(m, 'A', 'かいがらのすず: HP'+h+'回復'); m.hp.aHeal += h; });
      } });

    // ---- 手順21: 防御側のきのみ(回復・ピンチきのみ) ----
    T.push(berryEvent('D', 'post', 2100, function(s){ return !!s.bh; }));
    // ---- 手順22: ききかいひ・にげごし(表示) ----
    add({ name:'emergencyExit', stage:'post', at:2200, actor:'-',
      when: function(s, info, cx){ return s.bh && !s.fn && (cx.D.ability==='ききかいひ' || cx.D.ability==='にげごし') && P.startHp*2 > P.dMax && s.hp*2 <= P.dMax; },
      branches: function(s, info, cx){ var ab = cx.D.ability; return one(function(m){ noteLog(m, 'D', ab+': 交代（表示のみ）'); }); } });
    // ---- 手順24: わるいてぐせ ----
    add({ name:'pickpocket', stage:'post', at:2400, actor:'-',
      when: function(s, info, cx){ return s.bh && !s.fn && mv.contact && cx.D.ability==='わるいてぐせ' && !cx.D.heldName && !!cx.A.heldName && cx.A.ability!=='ねんちゃく' && removableFrom(cx, 'A') && !aFainted(s); },
      branches: function(s, info, cx){
        var nm = cx.A.heldName;
        return one(function(m, s2, inf, c2){ lg(m, 'D', 'わるいてぐせ: '+nm+'を奪う'); consumeItem(m, c2, 'A', false); setHeldItem(m, 'D', nm); });
      } });
    // ---- 手順25: しぜんのめぐみ(使ったきのみを消費) ----
    add({ name:'naturalGift', stage:'post', at:2501, actor:'A',
      when: function(s, info, cx){ return mv.name==='しぜんのめぐみ' && !!cx.A.heldItem && !!cx.A.heldItem.isBerry; },
      branches: function(s, info, cx){ var nm = cx.A.heldItem.name; return one(function(m, s2, inf, c2){ lg(m, 'A', 'しぜんのめぐみ: '+nm+'を消費'); consumeItem(m, c2, 'A', false); }); } });
    // ---- 手順26: のどスプレー・からぶりほけん ----
    add({ name:'throatSpray', stage:'post', at:2600, actor:'A',
      when: function(s, info, cx){ return cx.A.item==='のどスプレー' && mv.sound && s.dealt > 0; },
      branches: function(s, info, cx){ return one(function(m, s2, inf, c2){ rankApply(m, c2, 'A', {C:1}, 'A', 'のどスプレー'); consumeItem(m, c2, 'A', false); }); } });
    add({ name:'blunderPolicy', stage:'post', at:2601, actor:'A', onHit:false, onMiss:true,
      when: function(s, info, cx){ return cx.A.item==='からぶりほけん' && !P.model.none && !mv.ohko; },
      branches: function(s, info, cx){ return one(function(m, s2, inf, c2){ rankApply(m, c2, 'A', {S:2}, 'A', 'からぶりほけん'); consumeItem(m, c2, 'A', false); }); } });
    // ---- 手順27・28: 状態異常を治す特性 → びんじょう → しろいハーブ・ものまねハーブ ----
    add({ name:'afterMove', stage:'post', at:2700, actor:'-', onMiss:true,
      branches: function(s, info, cx){
        var need = false;
        ['A','D'].forEach(function(sd){
          var ab = cx[sd].abilityRaw, st = s.m.status[sd];
          if(CURE_ABILITY[ab] && CURE_ABILITY[ab].indexOf(st) >= 0) need = true;
          if(sd==='D' && ab==='マイペース' && s.m.confusion) need = true;
          if(cx[sd].ability==='びんじょう' || cx[sd].item==='しろいハーブ' || cx[sd].item==='ものまねハーブ') need = true;
        });
        if(!need && !s.m.extra.gains) return null;
        return one(function(m, s2, inf, c2){
          ['A','D'].forEach(function(sd){
            if(sd==='A' && aFainted(s2)) return;
            var ab = c2[sd].abilityRaw, st = m.status[sd];
            if(CURE_ABILITY[ab] && CURE_ABILITY[ab].indexOf(st) >= 0){ m.status[sd] = 'なし'; lg(m, sd, ab+': '+st+'が治る'); }
            if(sd==='D' && ab==='マイペース' && m.confusion){ m.confusion = false; lg(m, 'D', 'マイペース: こんらんが治る'); }
          });
          afterMoveRankItems(m, c2, aFainted(s2) ? ['D'] : ['A','D'], 'ability');
        });
      } });
    add({ name:'afterMoveItems', stage:'post', at:2800, actor:'-', onMiss:true,
      branches: function(s, info, cx){
        var need = !!s.m.extra.gains || !!s.m.extra.drops;
        ['A','D'].forEach(function(sd){ if(cx[sd].item==='しろいハーブ' || cx[sd].item==='ものまねハーブ') need = true; });
        if(!need) return null;
        return one(function(m, s2, inf, c2){
          var drops = m.extra.drops || {};
          afterMoveRankItems(m, c2, aFainted(s2) ? ['D'] : ['A','D'], 'item');
          // だっしゅつパック: この技の間に能力が下がった側が交代する(表示のみ)。
          ['A','D'].forEach(function(sd){
            if(drops[sd] && c2[sd].item==='だっしゅつパック' && !(sd==='A' && aFainted(s2)) && !(sd==='D' && s2.fn)) noteLog(m, sd, 'だっしゅつパック: 交代（表示のみ）');
          });
          delete m.extra.drops;
        });
      } });
    // ---- ふくつのこころ: ひるんだ(相手が技①の後に行動する)ときすばやさ+1 ----
    add({ name:'steadfast', stage:'post', at:2950, actor:'-',
      when: function(s){ return !!s.m.extra.flinch; },
      branches: function(s, info, cx){
        var o = P.input.options || {};
        var flinches = !s.fn && (o.moveOrder||'first')!=='second' && cx.D.ability!=='せいしんりょく' && o.defenderSpecialState!=='dynamax' && o.defenderSpecialState!=='gmax';
        return one(function(m, s2, inf, c2){
          if(flinches){ noteLog(m, 'D', 'ひるみ'); if(c2.D.ability==='ふくつのこころ') rankApply(m, c2, 'D', {S:1}, 'D', 'ふくつのこころ'); }
          delete m.extra.flinch;
        });
      } });
    // ---- 手順30: おどりこ(防御側が同じ踊り技を攻撃側へ使う) ----
    // 範囲: 入力ステータス・持ち物・特性・テラスタル・状態異常と、場の条件(天候・フィールド・じゅうりょく等)のみ
    // 考慮し、その他の攻撃側条件・防御側条件はすべて既定値。コピーした技をさらにコピーすることはない。
    add({ name:'dancer', stage:'post', at:3000, actor:'-',
      when: function(s, info, cx){ return mv.dance && mv.cat!=='変化' && s.bh && !s.fn && !aFainted(s) && s.aHp != null && cx.D.ability==='おどりこ'; },
      branches: function(s, info, cx){ return dancerBranches(P, s, cx); } });
    return T;
  }
  function dancerBranches(P, s, cx){
    var memo = P.dancerMemo || (P.dancerMemo = Object.create(null));
    var key = s.mk + '#' + s.hp + '#' + s.aHp;
    var dm = memo[key];
    if(!dm){
      var i = P.input;
      var o = applyEffectMods(freshOpts(i.options), s.m);
      var x = { weather: o.weather, field: o.field, gravity: o.gravity, magicRoom: o.magicRoom, neutralizingGasField: o.neutralizingGasField,
                fairyAuraField: o.fairyAuraField, darkAuraField: o.darkAuraField, critical: 0, transformOps: [], defenderScreen: 'none', defenderProtectState: 'none' };
      ['ItemId','NoItem','AbilityId','NoAbility','TeraType','Type1','Type2','Stats','Status','Gender','Unburden','ParadoxBoostStat'].forEach(function(k){
        x['attacker'+k] = o['defender'+k]; x['defender'+k] = o['attacker'+k];
      });
      x.attackerSpecialState = 'none'; x.defenderSpecialState = 'none';
      x.attackerCurrentHpInput = String(s.hp); x.defenderCurrentHpInput = String(s.aHp);
      var mvObj = (window.DAMEKE_DATA.moves||[]).find(function(mm){ return mm.name === P.mv.name; }) || i.move;
      var dinp = { attacker: i.defender, defender: i.attacker, move: mvObj, attackerLevel: i.defenderLevel, defenderLevel: i.attackerLevel, options: x };
      var base = C.calculateDamage(dinp);
      dm = { base: base, dinp: dinp };
      if(!(base.accuracyResult==='当たらない' || base.isInvalid || base.effectiveCategory==='変化')){
        dm.acc = base.accuracyResult==='必中' ? 1 : Math.max(0, Math.min(1, (base.accuracyPercent||0)/100));
        dm.crit = critRateFromResult(base);
        dm.nrm = distFromRolls(C.calculateDamage(Object.assign({}, dinp, { options: Object.assign({}, x, {__forceCritOverride:'off'}) })).rolls || [0]);
        dm.crt = distFromRolls(C.calculateDamage(Object.assign({}, dinp, { options: Object.assign({}, x, {__forceCritOverride:'on'}) })).rolls || [0]);
        dm.disp = distFromRolls(base.rolls || [0]);
        // コピーした技による、防御側自身のランク変化(ほのおのまい・アクアステップ)といのちのたま。
        var core = base.__coreState || {};
        var dAbName = core.attackerAbilityState && core.attackerAbilityState.active && core.attackerAbility ? core.attackerAbility.name : null;
        var dItName = core.attackerItemState && core.attackerItemState.active && core.attackerItem ? core.attackerItem.name : null;
        var sf = dAbName==='ちからずく' && window.DAMEKE_DATA_HELPERS.moveTag(mvObj, 'sheerForce');
        dm.selfRanks = ((window.DAMEKE_MOVE_EFFECTS||{})[P.mv.name] || []).filter(function(e){ return e.k==='rank' && e.t==='self' && !sf; }).map(function(e){
          var c = e.c == null ? 100 : e.c;
          if(c < 100) c = Math.min(100, c * (dAbName==='てんのめぐみ' ? 2 : 1));
          return { p: c/100, s: e.s };
        });
        dm.lifeOrb = dItName==='いのちのたま' && dAbName!=='マジックガード' && !sf;
      }
      memo[key] = dm;
    }
    if(dm.acc == null) return null;
    function mkApply(dmg, ranks){
      return function(m, s2, inf, c2){
        lg(m, 'D', 'おどりこ: '+P.mv.name+'で攻撃側に'+dmg+'ダメージ');
        m.hp.aLoss += Math.min(dmg, s2.aHp);
        ranks.forEach(function(r){ applyRankEvent(m, c2, 'D', r, 'D'); });
        if(dm.lifeOrb && dmg > 0){ m.hp.dLoss += Math.max(1, Math.floor(P.dMax/10)); lg(m, 'D', 'いのちのたま'); }
      };
    }
    // 自分へのランク変化(確率)の組み合わせ
    var rankCombos = [{ p: 1, r: [] }];
    dm.selfRanks.forEach(function(sr){
      var nx = [];
      rankCombos.forEach(function(rc){
        if(P.mode === 'display'){ nx.push(sr.p >= 1 ? { p: rc.p, r: rc.r.concat([sr.s]) } : rc); return; }
        if(sr.p < 1) nx.push({ p: rc.p*(1-sr.p), r: rc.r });
        nx.push({ p: rc.p*sr.p, r: rc.r.concat([sr.s]) });
      });
      rankCombos = nx;
    });
    var out = [];
    if(P.mode === 'display'){
      for(var dk in dm.disp) rankCombos.forEach(function(rc){ out.push({ p: dm.disp[dk]*rc.p, apply: mkApply(Number(dk), rc.r), displayAll: true }); });
      return out;
    }
    [[dm.nrm, 1-dm.crit], [dm.crt, dm.crit]].forEach(function(pair){
      if(!(pair[1] > 0)) return;
      for(var k in pair[0]) rankCombos.forEach(function(rc){ out.push({ p: dm.acc*pair[1]*pair[0][k]*rc.p, apply: mkApply(Number(k), rc.r) }); });
    });
    return out;
  }
  var CURE_ABILITY = { 'じゅうなん':['まひ'], 'すいほう':['やけど'], 'みずのベール':['やけど'], 'ねつこうかん':['やけど'], 'パステルベール':['どく','もうどく'], 'めんえき':['どく','もうどく'],
                       'ふみん':['ねむり'], 'やるき':['ねむり'], 'マグマのよろい':['こおり'] };
  // 表示のみの効果(メロメロ等)。状態として区別する必要はないため、状態には残さずログのみ。
  function noteLog(m, side, text){ lg(m, side, text); var d = m.extra.disp || (m.extra.disp = {}); d[(side||'-')+':'+text] = 1; }
  function oppositeGender(o){ return (o.attackerGender==='male' && o.defenderGender==='female') || (o.attackerGender==='female' && o.defenderGender==='male'); }
  var MENTAL_EFFECTS = ['メロメロ','かなしばり','かいふくふうじ'];
  // メンタル系の状態(表示のみ): アロマベールで無効、メンタルハーブで回復(持ち物は消費)、
  // メロメロはどんかんで無効・異性のみ・あかいいとで相手もメロメロ。
  function mentalEffect(m, cx, side, kind, allowRedString){
    var v = cx[side], o = cx.__opts || {};
    if(kind==='メロメロ' && (!oppositeGender(o) || v.ability==='どんかん')) return;
    if(MENTAL_EFFECTS.indexOf(kind) >= 0 && v.ability==='アロマベール') return;
    if(MENTAL_EFFECTS.indexOf(kind) >= 0 && v.item==='メンタルハーブ' && !m.itemGone[side]){
      noteLog(m, side, kind+'（メンタルハーブで回復）');
      consumeItem(m, cx, side, false);
      return;
    }
    noteLog(m, side, kind+'（表示のみ）');
    if(kind==='メロメロ' && allowRedString && v.item==='あかいいと') mentalEffect(m, cx, side==='A' ? 'D' : 'A', 'メロメロ', false);
  }
  // 技の「計算対象外」の効果(表示のみ)。にげられない状態は、ゴーストタイプ・きれいなぬけがら・にげあしには無効。
  function dispNote(m, cx, side, text){
    if(text==='メロメロ' || text==='いちゃもん'){
      if(text==='メロメロ'){ mentalEffect(m, cx, side, 'メロメロ', true); return; }
      noteLog(m, side, text+'（表示のみ）'); return;
    }
    if(/にげられない/.test(text)){
      var v = cx[side];
      if(v.types.indexOf('ゴースト') >= 0 || v.item==='きれいなぬけがら' || v.ability==='にげあし'){
        if(text==='お互いににげられない'){ noteLog(m, side==='A' ? 'D' : 'A', 'にげられない（表示のみ）'); }
        return;
      }
    }
    noteLog(m, side, text+'（表示のみ）');
  }

  // 特性による無効化(成功判定38)で発動する効果(命中判定より優先)。技が無効化された分岐でのみ発生。
  function buildAbsorbTriggers(P){
    var mv = P.mv, T = [];
    var HEAL = { 'ちょすい':'みず', 'ちくでん':'でんき', 'どしょく':'じめん', 'かんそうはだ':'みず' };
    var BOOST = { 'そうしょく':['くさ',{A:1}], 'でんきエンジン':['でんき',{S:1}], 'ひらいしん':['でんき',{C:1}], 'こんがりボディ':['ほのお',{B:2}] };
    T.push({ name:'absorb', stage:'pre', at:38, actor:'-', onHit:false, onMiss:true, subBlockable:false,
      when: function(s, info, cx){ return P.model.none && !!cx.D.ability && mv.cat !== '変化'; },
      branches: function(s, info, cx){
        var ab = cx.D.ability;
        if(HEAL[ab] === mv.type){
          var h = Math.floor(P.dMax/4);
          return one(function(m){ m.hp.dHeal += h; lg(m, 'D', ab+': HP'+h+'回復'); });
        }
        if(BOOST[ab] && BOOST[ab][0] === mv.type) return one(function(m, s2, inf, c2){ rankApply(m, c2, 'D', BOOST[ab][1], 'D', ab); });
        if(ab==='かぜのり' && mv.wind) return one(function(m, s2, inf, c2){ rankApply(m, c2, 'D', {A:1}, 'D', ab); });
        if(ab==='よびみず' && mv.type==='みず') return one(function(m){ noteLog(m, 'D', 'よびみず: とくこう+1（表示のみ）'); });
        if(ab==='もらいび' && mv.type==='ほのお') return one(function(m){ noteLog(m, 'D', 'もらいび: ほのお技の威力上昇（表示のみ）'); });
        return null;
      } });
    return T;
  }

  // ---- ターン終了時の処理(ターン経過一覧「5.ターン終了時の処理」の順。同じ番号は攻撃側→防御側) ----
  // ダメージは最大HPに対する割合の切り捨て(最低1)、回復は切り捨て。マジックガードはダメージを受けない。
  function buildEndOfTurnEvents(P){
    var T = [], o = P.input.options || {};
    function maxOf(sd){ return sd==='A' ? P.aMax : P.dMax; }
    function alive(s, sd){ return sd==='A' ? (s.aHp != null && s.aHp > 0) : !s.fn; }
    function hpOf(s, sd){ return sd==='A' ? s.aHp : s.hp; }
    function dmg(m, sd, amt){ if(sd==='A') m.hp.aLoss += amt; else m.hp.dLoss += amt; }
    function heal(m, sd, amt){ if(amt <= 0) return; if(sd==='A') m.hp.aHeal += amt; else m.hp.dHeal += amt; }
    function healBlocked(s, sd){ return sd==='D' && !!s.m.extra.healBlockD; }
    function frac(sd, den){ return Math.max(1, Math.floor(maxOf(sd)/den)); }
    function ev(sd, at, name, fn){
      T.push({ name: 'eot:'+name+':'+sd, stage: 'eot', at: at + (sd==='A' ? 0 : 0.5), actor: sd==='A' ? 'A' : '-', onHit: true, onMiss: true, subBlockable: false,
               when: function(s){ return alive(s, sd); },
               branches: function(s, info, cx){ return fn(s, cx, cx[sd], sd==='A' ? 'D' : 'A'); } });
    }
    ['A','D'].forEach(function(sd){
      var pre = sd==='A' ? 'attacker' : 'defender';
      // 1b すなあらしのダメージ
      ev(sd, 5012, 'sand', function(s, cx, v){
        if(v.weather !== 'すなあらし') return null;
        if(v.types.some(function(t){ return t==='いわ'||t==='じめん'||t==='はがね'; })) return null;
        if(['すなかき','すなのちから','すながくれ','ぼうじん','マジックガード'].indexOf(v.ability) >= 0 || v.item==='ぼうじんゴーグル') return null;
        if(sd==='D' && (o.defenderSemiInvulnerable==='あなをほる' || o.defenderSemiInvulnerable==='ダイビング')) return null;
        return one(function(m){ var a = frac(sd, 16); dmg(m, sd, a); lg(m, sd, 'すなあらし '+a+'ダメージ'); });
      });
      // 1c かんそうはだ・サンパワー・あめうけざら・アイスボディ
      ev(sd, 5013, 'weatherAbility', function(s, cx, v){
        var ab = v.ability, sun = isSunny(v.weather), rain = isRainy(v.weather), mg = ab==='マジックガード';
        if(ab==='かんそうはだ' && sun) return one(function(m){ var a = frac(sd, 8); dmg(m, sd, a); lg(m, sd, 'かんそうはだ '+a+'ダメージ'); });
        if(ab==='かんそうはだ' && rain && !healBlocked(s, sd)) return one(function(m){ var a = Math.floor(maxOf(sd)/8); heal(m, sd, a); lg(m, sd, 'かんそうはだ HP'+a+'回復'); });
        if(ab==='サンパワー' && sun && !mg) return one(function(m){ var a = frac(sd, 8); dmg(m, sd, a); lg(m, sd, 'サンパワー '+a+'ダメージ'); });
        if(ab==='あめうけざら' && rain && !healBlocked(s, sd)) return one(function(m){ var a = Math.floor(maxOf(sd)/16); heal(m, sd, a); lg(m, sd, 'あめうけざら HP'+a+'回復'); });
        if(ab==='アイスボディ' && v.weather==='ゆき' && !healBlocked(s, sd)) return one(function(m){ var a = Math.floor(maxOf(sd)/16); heal(m, sd, a); lg(m, sd, 'アイスボディ HP'+a+'回復'); });
        return null;
      });
      // 6b グラスフィールド / 6c うるおいボディ・だっぴ / 6d たべのこし・くろいヘドロ
      ev(sd, 5063, 'grassy', function(s, cx, v){
        if(cx.field !== 'グラスフィールド' || !v.grounded || healBlocked(s, sd)) return null;
        return one(function(m){ var a = Math.floor(maxOf(sd)/16); heal(m, sd, a); lg(m, sd, 'グラスフィールド HP'+a+'回復'); });
      });
      ev(sd, 5064, 'shedSkin', function(s, cx, v){
        var st = s.m.status[sd];
        if(st === 'なし') return null;
        if(v.ability==='うるおいボディ' && isRainy(v.weather)) return one(function(m){ m.status[sd] = 'なし'; lg(m, sd, 'うるおいボディ: '+st+'が治る'); });
        if(v.ability==='だっぴ') return [{ p: 1/3, apply: function(m){ m.status[sd] = 'なし'; lg(m, sd, 'だっぴ: '+st+'が治る'); } }];
        return null;
      });
      ev(sd, 5065, 'leftovers', function(s, cx, v){
        if(v.item==='たべのこし' && !healBlocked(s, sd)) return one(function(m){ var a = Math.floor(maxOf(sd)/16); heal(m, sd, a); lg(m, sd, 'たべのこし HP'+a+'回復'); });
        if(v.item==='くろいヘドロ'){
          if(v.types.indexOf('どく') >= 0){ if(healBlocked(s, sd)) return null; return one(function(m){ var a = Math.floor(maxOf(sd)/16); heal(m, sd, a); lg(m, sd, 'くろいヘドロ HP'+a+'回復'); }); }
          if(v.ability==='マジックガード') return null;
          return one(function(m){ var a = frac(sd, 8); dmg(m, sd, a); lg(m, sd, 'くろいヘドロ '+a+'ダメージ'); });
        }
        return null;
      });
      // 9 ねをはる
      ev(sd, 5090, 'ingrain', function(s, cx, v){
        if(!o[pre+'Ingrain'] || healBlocked(s, sd)) return null;
        return one(function(m){ var a = Math.floor(maxOf(sd)/16); heal(m, sd, a); lg(m, sd, 'ねをはる HP'+a+'回復'); });
      });
      // 11 どく・もうどく・ポイズンヒール / 12 やけど
      ev(sd, 5110, 'poison', function(s, cx, v){
        var st = s.m.status[sd];
        if(st !== 'どく' && st !== 'もうどく') return null;
        if(v.ability==='ポイズンヒール'){ if(healBlocked(s, sd)) return null; return one(function(m){ var a = Math.floor(maxOf(sd)/8); heal(m, sd, a); lg(m, sd, 'ポイズンヒール HP'+a+'回復'); }); }
        if(v.ability==='マジックガード') return null;
        var n = st==='もうどく' ? Math.max(1, Math.min(15, ((s.m.extra.toxicN||{})[sd]) || 1)) : 0;
        return one(function(m){ var a = st==='もうどく' ? Math.max(1, Math.floor(maxOf(sd)*n/16)) : frac(sd, 8); dmg(m, sd, a); lg(m, sd, st+' '+a+'ダメージ'); });
      });
      ev(sd, 5120, 'burn', function(s, cx, v){
        if(s.m.status[sd] !== 'やけど' || v.ability==='マジックガード') return null;
        return one(function(m){ var a = frac(sd, v.ability==='たいねつ' ? 32 : 16); dmg(m, sd, a); lg(m, sd, 'やけど '+a+'ダメージ'); });
      });
      // 32c かそく・ムラっけ・ナイトメア
      ev(sd, 5323, 'speedBoost', function(s, cx, v, opp){
        var out = [];
        if(v.ability==='かそく') return one(function(m, s2, inf, c2){ rankApply(m, c2, sd, {S:1}, sd, 'かそく'); });
        if(v.ability==='ムラっけ'){
          var ks = ['A','B','C','D','S'], r = s.m.ranks[sd];
          var ups = ks.filter(function(k){ return r[k] < 6; });
          var combos = [];
          (ups.length ? ups : [null]).forEach(function(u){
            var downs = ks.filter(function(k){ return k !== u && r[k] > -6; });
            (downs.length ? downs : [null]).forEach(function(d){ combos.push([u, d, 1/((ups.length||1)*(downs.length||1))]); });
          });
          return combos.map(function(c){ return { p: c[2], apply: function(m, s2, inf, c2){ var d = {}; if(c[0]) d[c[0]] = 2; if(c[1]) d[c[1]] = -1; rankApply(m, c2, sd, d, sd, 'ムラっけ'); } }; });
        }
        if(v.ability==='ナイトメア'){
          var os = opp==='A' ? 'A' : 'D';
          var asleep = s.m.status[os]==='ねむり' || cx[os].ability==='ぜったいねむり';
          if(!asleep || !alive(s, os) || cx[os].ability==='マジックガード') return null;
          return one(function(m){ var a = frac(os, 8); dmg(m, os, a); lg(m, os, 'ナイトメア '+a+'ダメージ'); });
        }
        return null;
      });
      // 32d くっつきバリ・どくどくだま・かえんだま
      ev(sd, 5324, 'orbs', function(s, cx, v){
        if(v.item==='くっつきバリ' && v.ability!=='マジックガード') return one(function(m){ var a = frac(sd, 8); dmg(m, sd, a); lg(m, sd, 'くっつきバリ '+a+'ダメージ'); });
        if((v.item==='どくどくだま' || v.item==='かえんだま') && s.m.status[sd]==='なし'){
          var st = v.item==='どくどくだま' ? 'もうどく' : 'やけど';
          return one(function(m, s2, inf, c2){ lg(m, sd, '['+v.item+']'); tryInflictStatus(m, c2, sd, st, sd, false); });
        }
        return null;
      });
      // 32f しろいハーブ
      ev(sd, 5326, 'whiteHerb', function(s, cx, v){
        if(v.item!=='しろいハーブ') return null;
        if(!RANK_KEYS.some(function(k){ return s.m.ranks[sd][k] < 0; })) return null;
        return one(function(m, s2, inf, c2){ afterMoveRankItems(m, c2, [sd], 'item'); });
      });
    });
    // 6a ひのうみ・キョダイ系(防御側、発生した順) / 15 バインド / 17 しおづけ
    function fixedEv(at, name, key, cond){
      T.push({ name: 'eot:'+name, stage: 'eot', at: at, actor: '-', onHit: true, onMiss: true, subBlockable: false,
               when: function(s){ return !s.fn && s.m.hp[key] > 0; },
               branches: function(s){
                 var ok = !cond || cond(s);
                 return one(function(m){ var a = m.hp[key]; m.hp[key] = 0; if(ok){ m.hp.dLoss += a; lg(m, 'D', name+' '+a+'ダメージ'); } });
               } });
    }
    fixedEv(5061, 'ひのうみ', 'dSea');
    fixedEv(5062, 'キョダイマックスわざ', 'dGmax');
    fixedEv(5150, 'バインド', 'dBind', function(s){ return !aFainted(s); });
    fixedEv(5170, 'しおづけ', 'dSalt');
    // 32e しゅうかく(防御側・瀕死率のみ)
    T.push({ name: 'eot:harvest', stage: 'eot', at: 5325.5, actor: '-', onHit: true, onMiss: true, subBlockable: false,
             when: function(s, info, cx){ return !s.fn && cx.D.ability==='しゅうかく' && !!(s.m.extra.eaten && s.m.extra.eaten.D) && !cx.D.heldName; },
             branches: function(s, info, cx){
               var berry = s.m.extra.eaten.D;
               var p = isSunny(cx.D.weather) ? 1 : 0.5;
               if(P.mode === 'display') return null;
               return [{ p: p, apply: function(m, s2){ setHeldItem(m, 'D', berry); delete m.extra.eaten.D; s2.bf = 0; lg(m, 'D', 'しゅうかく: '+berry+'を取り戻す'); m.extra.harvested = true; } }];
             } });
    T.push(Object.assign(berryEvent('D', 'eot', 5325.6), { when: function(s){ return !!s.m.extra.harvested; } }));
    T.push({ name: 'eot:cleanup', stage: 'eot', at: 5999, actor: '-', onHit: true, onMiss: true, subBlockable: false,
             when: function(s){ return !!(s.m.extra.harvested || s.m.extra.eaten || s.m.extra.drops); },
             branches: function(){ return one(function(m){ delete m.extra.harvested; delete m.extra.eaten; delete m.extra.drops; }); } });
    return T;
  }

  // ---- みらいよち・はめつのねがい(強化されていないもの) ----
  // 基本的に通常の技と同じ扱いで、例外として: まもる補正は4096(まもる・ダイウォール無視)、攻撃側の特性
  // アナライズ・おやこあい・かたやぶり・ターボブレイズ・テラボルテージ・マジシャン、攻撃側の持ち物
  // かいがらのすず・メトロノームは発動しない。防御側のろわれボディ・レンブのみ・だっしゅつボタン・
  // レッドカードも発動しない(トリガー側で除外)。
  var FUTURE_SIGHT = { 'みらいよち':1, 'はめつのねがい':1 };
  var FS_NO_ATTACKER_ABILITY = ['アナライズ','おやこあい','かたやぶり','ターボブレイズ','テラボルテージ','マジシャン'];
  var FS_POST_EVENTS = { colorChange:1, halfHpAbility:1, defItem3:1, berryD:1, emergencyExit:1, afterMove:1, afterMoveItems:1, attItem20:1 };
  function futureSightInput(input){
    var o = freshOpts(input.options);
    o.protect = false; o.defenderProtectState = 'none';
    var ab = (window.DAMEKE_DATA.abilities||[]).find(function(a){ return a.id === o.attackerAbilityId; });
    if(ab && FS_NO_ATTACKER_ABILITY.indexOf(ab.name) >= 0) o.attackerNoAbility = true;
    var it = (window.DAMEKE_DATA.items||[]).find(function(i){ return i.id === o.attackerItemId; });
    if(it && (it.name==='メトロノーム' || it.name==='かいがらのすず')){ o.attackerItemId = 'none'; o.attackerNoItem = true; }
    return Object.assign({}, input, { options: o });
  }
  function isFutureSightMove(input, result){ return !!FUTURE_SIGHT[moveName(result, input)]; }
  C.__futureSightInput = futureSightInput;

  // パイプラインの文脈(技1回分)を作る。eff: resolveMove1Effectsの戻り値。
  function makeMoveContext(input, result, mode, role, eff, reg, baseMk, aMaxHp, flags){
    flags = flags || {};
    var o = input.options || {};
    var H = window.DAMEKE_DATA_HELPERS;
    var nm = moveName(result, input);
    var effMove = result.effectiveMove || input.move || {};
    var P = {
      input: input, result: result, mode: mode, role: role, reg: reg, baseMk: baseMk, ctx: eff.ctx,
      model: buildMoveModel(input, result, mode),
      env: { subHp: substituteHpOrNull(result, input, o), maxHp: result.defenderMaxHp, focusBand: mode === 'prob' ? focusBandProb(result) : 0 },
      track: true,
      aMax: aMaxHp || (eff.ctx && eff.ctx.A.hpMax) || 1, dMax: result.defenderMaxHp || 1,
      hitsCache: Object.create(null), viewCache: Object.create(null),
      mv: {
        name: nm, contact: window.DAMEKE_CALC_SHARED.contactActive(result), type: result.effectiveType, cat: result.effectiveCategory,
        sound: !!H.moveTagForEffective(input.move, nm, 'sound'), wind: !!H.moveTagForEffective(input.move, nm, 'wind'),
        dance: !!H.moveTagForEffective(input.move, nm, 'dance'),
        se: (result.typeRate4096||0) > 4096,
        ohko: (input.move && input.move.fixedDamageKind==='ohko'),
        fixedDamage: !!(input.move && input.move.fixedDamageKind && input.move.fixedDamageKind!=='none')
      }
    };
    P.view = function(s){ return P.viewCache[s.mk] || (P.viewCache[s.mk] = buildView(P, s.m)); };
    P.touch = Object.create(null); P.dispAcc = Object.create(null);
    P.shieldDust = function(cx){ return cx.D.ability==='りんぷん' || cx.D.item==='おんみつマント'; };
    P.berryA = berryEvent('A', 'hit', 0);
    P.berryD = berryEvent('D', 'hit', 0);
    P.multi = !P.model.none && P.model.maxHits > 1;
    // 溜めターンの能力上昇: 技①では技①自身のダメージには反映せず、技①の後(技②の前提)にだけ反映する
    // (溜め中に能力を下げられた場合などは、ランクを手入力して計算できるようにするため)。
    // 技②と、技②の表示用(flags.chargeBoostInMove)では、技自身のダメージから反映する。
    var plan = eff.plan.filter(function(pev){
      if(pev.stage === 'pre' && pev.e.k === 'rank' && pev.e.oc) return (role === 2 && !flags.noChargeBoost) || !!flags.chargeBoostInMove;
      return true;
    });
    // みらいよち・はめつのねがい(強化されていないもの): flags.futureSightはダメージが発生する時点の処理用。
    P.futureSight = !!flags.futureSight;
    P.hpDep = !!flags.futureSight;
    var evs = plan.map(function(pev){ return planToEvent(pev, eff); });
    evs = evs.concat(buildTriggers(P, eff));
    if(role === 1) evs = evs.concat(buildAbsorbTriggers(P)).concat(buildEndOfTurnEvents(P));
    if(role === 2) evs = evs.filter(function(e){ return e.stage === 'hit' || e.stage === 'pre'; });
    if(role === 3) evs = evs.filter(function(e){ return e.stage === 'hit' || e.stage === 'pre'; });
    // role 4: みらいよち・はめつのねがいのダメージ(ターン終了時の手順4)。ヒットごとの効果と、防御側の
    // ダメージ後の反応(へんしょく・ぎゃくじょう等・きのみ・状態異常を治す特性・ハーブ類)、いのちのたま。
    if(role === 4) evs = evs.filter(function(e){ return e.stage === 'hit' || FS_POST_EVENTS[e.name]; });
    evs.sort(function(a, b){ return a.at - b.at; });
    P.preEvs = evs.filter(function(e){ return e.stage === 'pre'; });
    P.hitEvs = evs.filter(function(e){ return e.stage === 'hit'; });
    P.postEvs = evs.filter(function(e){ return e.stage === 'post'; });
    P.eotEvs = evs.filter(function(e){ return e.stage === 'eot'; });
    P.hitsOf = function(s){
      var ck = P.hpDep ? (s.mk + '#' + s.hp + '#' + s.aHp) : s.mk;
      var h = P.hitsCache[ck];
      if(h) return h;
      var inp;
      if(s.mk === P.baseMk && !P.hpDep){ inp = input; inp.__isBase = true; }
      else {
        var oo = s.mk === P.baseMk ? freshOpts(o) : applyEffectMods(freshOpts(o), reg.arr[s.mk]);
        // HPに依存する補正(マルチスケイル等)のため、ダメージが入る時点のHPで計算する(みらいよち用)。
        if(P.hpDep){ oo.defenderCurrentHpInput = String(Math.max(1, s.hp)); if(s.aHp != null && s.aHp > 0) oo.attackerCurrentHpInput = String(s.aHp); }
        inp = { attacker: input.attacker, defender: input.defender, move: input.move, attackerLevel: input.attackerLevel, defenderLevel: input.defenderLevel, options: oo };
      }
      h = P.model.hitsFor(inp, !!inp.__isBase);
      if(inp.__isBase) delete inp.__isBase;
      P.hitsCache[ck] = h;
      return h;
    };
    // 技①がみらいよち・はめつのねがいのとき: 使用時はダメージなし(命中扱い)、ターン終了時(手順4)にダメージ。
    if(role === 1 && !flags.futureSight && FUTURE_SIGHT[nm]){
      P.fsInput = futureSightInput(input);
      P.model = { none: false, mode: mode, maxHits: 0, accProb: 1, sequential: false, stopAfter: [], hitsFor: function(){ return []; } };
      P.multi = false;
    }
    return P;
  }

  // 1ヒット分のダメージ(みがわり・きあいのハチマキ込み)。戻り値 [{w, s, info}]。
  function applyDamage(P, s, dmg, c){
    var env = P.env;
    var s2 = stCopy(s);
    if(s.sub != null){
      var inc = Math.min(dmg, env.subHp - s.sub);
      s2.sub = (s.sub + dmg >= env.subHp) ? null : s.sub + dmg;
      if(P.track) s2.dealt += inc;
      return [{ w: 1, s: s2, info: { toSub: true, dealtHit: inc, crit: c, dmg: dmg } }];
    }
    s2.bh = 1;
    var hpNow = s.hp, newHp = hpNow - dmg;
    if(newHp <= 0){
      var out = [];
      if(env.focusBand > 0){
        var sv = stCopy(s2); sv.hp = 1; if(P.track) sv.dealt += hpNow - 1;
        out.push({ w: env.focusBand, s: sv, info: { toSub: false, dealtHit: hpNow - 1, crit: c, dmg: dmg, focusBand: true } });
      }
      var sf = s2; sf.fn = 1; sf.hp = newHp; if(P.track) sf.dealt += hpNow;
      out.push({ w: 1 - env.focusBand, s: sf, info: { toSub: false, dealtHit: hpNow, crit: c, dmg: dmg } });
      return out;
    }
    s2.hp = newHp;
    if(P.track) s2.dealt += dmg;
    return [{ w: 1, s: s2, info: { toSub: false, dealtHit: dmg, crit: c, dmg: dmg } }];
  }
  function hitStep(P, active, k){
    var next = Object.create(null);
    for(var key in active){
      var e = active[key], s = e.s;
      var hits = P.hitsOf(s);
      var hit = hits[Math.min(k, hits.length-1)];
      if(P.rollRec){ var rr = P.rollRec[k] || (P.rollRec[k] = {}); var re = rr[s.mk] || (rr[s.mk] = { h: hit, p: 0 }); re.p += e.p; }
      for(var c=0; c<2; c++){
        var pc = c ? hit.pCrit : 1 - hit.pCrit;
        if(pc <= 0) continue;
        var dd = c ? hit.crt : hit.nrm;
        for(var hd in dd){
          var q = e.p * pc * dd[hd];
          if(q <= 0) continue;
          var outs = applyDamage(P, s, Number(hd), c);
          for(var oi=0; oi<outs.length; oi++){
            var o = outs[oi];
            if(o.s.fn && P.mode === 'prob'){ dAdd(next, FAINT_STATE, q*o.w); continue; }
            o.info.hitIndex = k;
            var seq = runEvents(P, o.s, P.hitEvs, o.info, 'hit', P.mode);
            for(var si=0; si<seq.length; si++) dAdd(next, seq[si].s, q*o.w*seq[si].w);
          }
        }
      }
    }
    return next;
  }
  function stageEvents(P, dist, evs, pathOf){
    if(!evs.length) return dist;
    var out = Object.create(null);
    for(var key in dist){
      var e = dist[key], s = e.s;
      if(s.fn && P.mode === 'prob'){ dAdd(out, s, e.p); continue; }
      var r = runEvents(P, s, evs, null, pathOf(s), P.mode);
      for(var i=0; i<r.length; i++) dAdd(out, r[i].s, e.p * r[i].w);
    }
    return out;
  }
  function hitPath(s){ return s.hit ? 'hit' : 'miss'; }
  // ターン終了時の処理(buildEndOfTurnEventsの効果を手順どおりに適用する)。
  function endOfTurn(P, dist){
    if(!P.fsInput) return stageEvents(P, dist, P.eotEvs, hitPath);
    var d = stageEvents(P, dist, P.eotEvs.filter(function(e){ return e.at < 5040; }), hitPath);
    d = futureSightHit(P, d);
    return stageEvents(P, d, P.eotEvs.filter(function(e){ return e.at >= 5040; }), hitPath);
  }
  // ターン終了時の手順4: みらいよち・はめつのねがいのダメージ(攻撃側がひんしでも発生する)。
  function futureSightHit(P, dist){
    if(!P.fsP){
      var fi = P.fsInput, fr = C.calculateDamage(fi);
      var effF = resolveMove1Effects(fi, fr, fi);
      P.fsP = makeMoveContext(fi, fr, P.mode, 4, effF, P.reg, P.baseMk, P.aMax, { futureSight: true });
      P.fsP.touch = P.touch; P.fsP.dispAcc = P.dispAcc;
    }
    var F = P.fsP, out = Object.create(null);
    for(var k in dist){
      var e = dist[k], s = e.s;
      if(s.fn){ dAdd(out, s, e.p); continue; }
      var st = stCopy(s); st.dealt = 0; st.bh = 0; st.hit = 0;
      if(F.env.subHp == null) st.sub = null;
      var r = runMovePipeline(F, st);
      for(var rk in r){
        var x = r[rk].s;
        if(!x.fn || P.mode === 'display'){ x = stCopy(x); x.hit = s.hit; x.dealt = 0; x.bh = 0; }
        dAdd(out, x, e.p * r[rk].p);
      }
    }
    return out;
  }

  // 表示のみの効果(メロメロ・ひるみ等)の発生確率を集計し、状態からは取り除く(同じ状態をまとめるため)。
  function collectDisp(P, dist){
    var need = false;
    for(var k in dist){ if(dist[k].s.m && dist[k].s.m.extra.disp){ need = true; break; } }
    if(!need) return dist;
    var out = Object.create(null);
    for(var k2 in dist){
      var e = dist[k2], s = e.s;
      if(s.m && s.m.extra.disp){
        if(P.dispAcc) Object.keys(s.m.extra.disp).forEach(function(t){ P.dispAcc[t] = (P.dispAcc[t]||0) + e.p; });
        var m2 = cloneM(s.m); delete m2.extra.disp;
        s = stCopy(s); s.m = m2; s.mk = P.reg.id(m2);
      }
      dAdd(out, s, e.p);
    }
    return out;
  }
  // ---- 技①の効果の要約(計算過程表の「追加効果」行用) ----
  // 確率モードの状態分布(技①・ターン終了時の処理の後)から、開始時点と比べて変化した状態ごとの確率を求め、
  // その状態を変えた効果の種類(技・特性・持ち物・フィールド)ごとに、攻撃側・防御側に分けて並べる。
  // 防御側がひんしになった分岐は数えない(ひんしの確率は瀕死率として別に表示される)。
  var SUMMARY_CAT_ORDER = ['技','特性','持ち物','フィールド','状態異常','その他'];
  function fmtProb(p){ var v = Math.round(p*10000)/100; return (v >= 100 ? '' : (v <= 0 ? '0' : String(v))); }
  function summarizeMove(P, dist, m0){
    var v0 = buildView(P, m0);
    var acc = Object.create(null);   // key -> {side, aspect, text, p}
    function add(side, aspect, text, p){ var k = side+'|'+aspect+'|'+text; var e = acc[k] || (acc[k] = { side: side, aspect: aspect, text: text, p: 0 }); e.p += p; }
    for(var k in dist){
      var e = dist[k], s = e.s;
      if(s.fn || !s.m) continue;
      var m = s.m, v = buildView(P, m);
      ['A','D'].forEach(function(sd){
        var st0 = m0.status[sd], st = m.status[sd];
        if(st !== st0) add(sd, sd+'.status', st==='なし' ? st0+'回復' : st, e.p);
        RANK_KEYS.forEach(function(rk){ var d = m.ranks[sd][rk] - m0.ranks[sd][rk]; if(d) add(sd, sd+'.rank.'+rk, RANK_LABEL[rk]+(d>0?'+':'')+d, e.p); });
        if(v[sd].heldName !== v0[sd].heldName) add(sd, sd+'.item', v[sd].heldName ? '持ち物→'+v[sd].heldName : (v0[sd].heldName||'持ち物')+'#LOST', e.p);
        if(v[sd].abilityRaw !== v0[sd].abilityRaw) add(sd, sd+'.ability', '特性→'+(v[sd].abilityRaw||'なし'), e.p);
      });
      if(m.confusion && !m0.confusion) add('D', 'D.confusion', 'こんらん', e.p);
      if(stableStr(v.D.types) !== stableStr(v0.D.types)) add('D', 'D.types', v.D.types.join('/')+'タイプ', e.p);
      if(v.field !== v0.field) add('A', 'field', v.field==='なし' ? 'フィールド解除' : v.field, e.p);
      if(v.A.weather !== v0.A.weather) add('A', 'weather', v.A.weather==='なし' ? '天候なし' : v.A.weather, e.p);
      if(aFainted(s)) add('A', 'A.faint', 'ひんし（技②なし）', e.p);
    }
    Object.keys(P.dispAcc || {}).forEach(function(k){ var i = k.indexOf(':'); var sd = k.slice(0, i), t = k.slice(i+1); add(sd==='-' ? 'A' : sd, 'disp.'+k, t.replace(/（表示のみ）$/, ''), P.dispAcc[k]); });
    var out = { A: {}, D: {} };
    Object.keys(acc).forEach(function(k){
      var e = acc[k];
      if(e.p < 1e-9) return;
      var cats = (P.touch && P.touch[e.aspect]) || {};
      var cat = SUMMARY_CAT_ORDER.filter(function(c){ return cats[c]; })[0] || 'その他';
      if(/#LOST$/.test(e.text)){
        var itName = e.text.replace(/#LOST$/, ''), other = e.side==='A' ? 'D' : 'A';
        var stolen = !!acc[other+'|'+other+'.item|持ち物→'+itName];
        // 相手に移った → 奪われる / 防御側が相手の技で失った → 失う / それ以外(自分で使った) → 消費
        e.text = itName + (stolen ? 'を奪われる' : ((e.side==='D' && cat==='技') ? 'を失う' : '消費'));
      }
      (out[e.side][cat] || (out[e.side][cat] = [])).push(e);
    });
    var res = { A: '', D: '', lists: out };
    ['A','D'].forEach(function(sd){
      var parts = [];
      SUMMARY_CAT_ORDER.forEach(function(cat){
        var items = out[sd][cat];
        if(!items || !items.length) return;
        // 同じ状態(例: ぼうぎょ)の複数の結果は「ぼうぎょ-2 30%・-3 20%」のようにまとめる。
        var byAspect = {}, order = [];
        items.forEach(function(it){ if(!byAspect[it.aspect]){ byAspect[it.aspect] = []; order.push(it.aspect); } byAspect[it.aspect].push(it); });
        parts.push(cat+'：'+order.map(function(a){
          var its = byAspect[a].slice();
          if(a.indexOf('.rank.') >= 0) its.sort(function(x, y){ return Math.abs(parseInt(x.text.replace(/^[^+\-0-9]+/, ''),10)) - Math.abs(parseInt(y.text.replace(/^[^+\-0-9]+/, ''),10)); });
          return its.map(function(it, i){
            var pr = fmtProb(it.p), txt = it.text;
            if(i > 0 && a.indexOf('.rank.') >= 0) txt = txt.replace(/^[^+\-0-9]+/, '');
            return txt + (pr ? ' '+pr+'%' : '');
          }).join('・');
        }).join('、'));
      });
      res[sd] = parts.length ? parts.join(' / ') : '-';
    });
    return res;
  }

  // 技1回分をパイプラインで処理する。start: 開始状態(確率1)。戻り値: 状態分布。
  function runMovePipeline(P, start){
    var M = P.model, mode = P.mode;
    P.startHp = start.hp; P.startSub = start.sub;
    var hitD = Object.create(null), missD = Object.create(null);
    var s0 = stCopy(start);
    if(M.none){ s0.hit = 0; dAdd(missD, s0, 1); }
    else if(mode === 'display'){ s0.hit = 1; dAdd(hitD, s0, 1); }
    else {
      var sm = stCopy(start); sm.hit = 0; dAdd(missD, sm, 1 - M.accProb);
      s0.hit = 1; dAdd(hitD, s0, M.accProb);
    }
    hitD = stageEvents(P, hitD, P.preEvs, hitPath);
    missD = stageEvents(P, missD, P.preEvs, hitPath);
    var after = Object.create(null), active = hitD;
    for(var k=0; k<(M.none ? 0 : M.maxHits); k++){
      if(!Object.keys(active).length) break;
      if(k > 0 && mode === 'prob' && M.sequential){
        var cont = Object.create(null);
        for(var ck in active){ dAdd(after, active[ck].s, active[ck].p*(1-M.accProb)); dAdd(cont, active[ck].s, active[ck].p*M.accProb); }
        active = cont;
      }
      var next = hitStep(P, active, k);
      var stopFrac = (k === M.maxHits - 1) ? 1 : ((mode === 'prob' && !M.sequential) ? (M.stopAfter[k+1] || 0) : 0);
      active = Object.create(null);
      for(var nk in next){
        var ne = next[nk];
        // 13-2・13-3: 防御側ひんし・攻撃側ひんしで連続攻撃は終了。
        if(!P.noFaintStop && (ne.s.fn || aFainted(ne.s))){ dAdd(after, ne.s, ne.p); continue; }
        if(stopFrac > 0) dAdd(after, ne.s, ne.p*stopFrac);
        if(stopFrac < 1) dAdd(active, ne.s, ne.p*(1-stopFrac));
      }
    }
    for(var rk in active) dAdd(after, active[rk].s, active[rk].p);
    var all;
    if(P.role === 3) return after;
    if(P.role === 4){
      all = stageEvents(P, after, P.postEvs, hitPath);
      for(var mk4 in missD) dAdd(all, missD[mk4].s, missD[mk4].p);
      return collectDisp(P, all);
    }
    if(P.role === 2){
      // 技②: ダメージの後の回復きのみ(手順21)までを含めて打ち切る。
      all = stageEvents(P, after, [berryEvent('D', 'post', 2100, function(s){ return !!s.bh; })], hitPath);
      for(var mk2 in missD) dAdd(all, missD[mk2].s, missD[mk2].p);
      return collectDisp(P, all);
    }
    all = stageEvents(P, after, P.postEvs, hitPath);
    var missPost = stageEvents(P, missD, P.postEvs, hitPath);
    for(var mk in missPost) dAdd(all, missPost[mk].s, missPost[mk].p);
    all = collectDisp(P, all);
    all = endOfTurn(P, all);
    all = collectDisp(P, all);
    // 技①専用の追跡情報を捨てる(技②の開始状態として同じものをまとめる)。
    var fin = Object.create(null);
    for(var fk in all){
      var fe = all[fk], fs = fe.s;
      if(fs.dealt || fs.crit || fs.bh){ fs = stCopy(fs); fs.dealt = 0; fs.crit = 0; fs.bh = 0; }
      dAdd(fin, fs, fe.p);
    }
    return fin;
  }
  C.__runMovePipeline = runMovePipeline;
  C.__makeMoveContext = makeMoveContext;

  C.calculateCombinedSequence = function(input1, input2){
    try{
      var result1 = C.calculateDamage(input1);
      // フォルムチェンジ(技①の時点で条件を満たす場合)を技①・技②の入力の両方へ反映する。
      if(result1 && result1.__formApplied && result1.__formInput){
        var fa = result1.__formApplied, fi = result1.__formInput;
        input1 = Object.assign({}, fi, { options: freshOpts(fi.options) });
        var o2f = freshOpts(input2.options);
        var input2f = Object.assign({}, input2, { options: o2f });
        Object.keys(fa).forEach(function(side){
          var pre = side==='A' ? 'attacker' : 'defender';
          input2f[pre] = fi[pre];
          o2f[pre+'Type1'] = fi.options[pre+'Type1']; o2f[pre+'Type2'] = fi.options[pre+'Type2'];
          if(fa[side].dHp) o2f[pre+'CurrentHpInput'] = fi.options[pre+'CurrentHpInput'];
        });
        input2 = input2f;
        result1 = C.calculateDamage(input1);
      }
      var maxHp = result1.defenderMaxHp;
      var hpCur0 = result1.defenderCurrentHp;
      var hpMax = maxHp||1;
      // 技①の追加効果(表示用の列挙と、パイプライン用の段階つき計画)。
      // 技②がみらいよち・はめつのねがい: 技②の位置でダメージが入るものとし、例外(まもる無視・一部の特性/持ち物が
      // 発動しない)を適用する。
      var fs2 = false;
      try{ var probe2 = C.calculateDamage(Object.assign({}, input2, { options: freshOpts(input2.options) })); if(isFutureSightMove(input2, probe2)){ input2 = futureSightInput(input2); fs2 = true; } }catch(e0){}
      var eff = resolveMove1Effects(input1, result1, input2);
      var aStartHp = eff.attackerStartHp, aMaxHp = eff.attackerMaxHp;
      var reg = makeRegistry();

      function dkOf(s){ return s.sub != null ? ('s' + s.sub) : ((s.fn ? 'f' : 'r') + s.hp + '_' + s.bf); }
      function startHpOf(s){ return s.fn ? 0 : Math.max(0, s.hp); }

      // 技①の結果(状態 s)を反映して、技②の入力を作る。mode: 'hit'(技①が当たった) / 'miss'。
      function buildInput2Branch(s, mode){
        var isHit = mode !== 'miss';
        var baseKey = dkOf(s);
        var effMods = s.m, aHpNow = s.aHp;
        var options2 = freshOpts(input2.options, { defenderCurrentHpInput: String(startHpOf(s)) });
        var phase = baseKey.charAt(0);
        var berryFlag = s.bf ? '1' : '0';
        if(phase !== 's'){
          options2.defenderSubstitute = false;
          if(berryFlag === '1') options2.__forceNoBerryOverride = true;
        }
        // 技①で消費が確定した持ち物(半減実・ジュエル・回復きのみ)は技②では「なし」。
        if((isHit && result1.resistBerryConsumed) || berryFlag === '1'){
          options2.defenderItemId = 'none';
          options2.defenderNoItem = true;
        }
        if(isHit && result1.gemConsumed){
          options2.attackerItemId = 'none';
          options2.attackerNoItem = true;
        }
        // ばけのかわ・アイスフェイス: 技①が本体へ通った(みがわりに阻まれていない)分岐でだけ消費済み。
        var defender2 = input2.defender, attacker2 = input2.attacker;
        if(isHit && phase !== 's' && result1.disguiseTriggered){
          options2.__forceNoDisguiseOverride = true;
        }
        if(isHit && phase !== 's' && result1.iceFaceTriggered){
          var H = window.DAMEKE_DATA_HELPERS;
          var noice = H && H.findFormByAbility ? H.findFormByAbility(input2.defender, 'ナイスフェイス') : null;
          if(noice){
            defender2 = noice;
            options2.defenderAbilityId = (noice.abilities && noice.abilities[0]) || options2.defenderAbilityId;
          }
        }
        // ミクルのみの命中補正(入力)は技①で消費される(成功判定17)。技①の後にミクルのみを食べた場合のみ残る。
        options2.attackerMicleBerry = false;
        applyEffectMods(options2, effMods);
        var x = (effMods && effMods.extra) || {};
        if(x.attackerForm){
          var fp = (window.DAMEKE_DATA.pokemons||[]).find(function(p){ return p.id === x.attackerForm; });
          if(fp){ attacker2 = fp; options2.attackerType1 = (fp.types && fp.types[0]) || 'なし'; options2.attackerType2 = (fp.types && fp.types[1]) || 'なし'; }
        }
        if(aHpNow != null && aHpNow !== aStartHp) options2.attackerCurrentHpInput = String(aHpNow);
        return { attacker: attacker2, defender: defender2, move: input2.move, attackerLevel: input2.attackerLevel, defenderLevel: input2.defenderLevel, options: options2 };
      }

      // 技①のパイプライン(開始状態から、ターン終了時の処理まで)。
      function runMove1(inp1, res1, eff1, mode){
        var m0 = eff1.newState();
        var mk0 = reg.id(m0);
        var P = makeMoveContext(inp1, res1, mode, 1, eff1, reg, mk0, aMaxHp);
        var start = { sub: P.env.subHp != null ? 0 : null, hp: res1.defenderCurrentHp, bf: 0, fn: 0, dealt: 0, crit: 0, bh: 0,
                      aHp: eff1.attackerStartHp != null ? eff1.attackerStartHp : null, hit: 0, m: m0, mk: mk0 };
        var d = runMovePipeline(P, start);
        lastMove1 = { P: P, m0: m0, dist: d };
        return d;
      }
      var lastMove1 = null;

      // 技②の計算結果・状態分布のメモ(同じ入力・同じ開始状態の計算を繰り返さない)。
      var memo = Object.create(null);
      function optKey(inp){ return inp.attacker.id + '#' + inp.defender.id + '#' + JSON.stringify(inp.options, function(k, v){ return k === '__coreState' ? undefined : v; }); }
      function calc2(inp){ var k = 'calc#' + optKey(inp); return memo[k] || (memo[k] = C.calculateDamage(inp)); }
      // 表示用(技②の途中で100%発生する効果を反映したダメージ)。状態分布の計算にはcalc2を使う。
      function calc2Disp(inp){ var k = 'disp#' + optKey(inp); return memo[k] || (memo[k] = C.calculateDamageWithEffects(inp, { chargeBoostInMove: true })); }
      var ctx2Memo = Object.create(null);
      // 技②: 状態 s から1ヒット単位で処理し、終了時点の状態分布を返す。
      function runMove2(inp, res, s, mode){
        var ok = optKey(inp);
        var k = mode + '#' + stKey(s) + '#' + ok;
        if(memo[k]) return memo[k];
        var ck = mode + '#' + s.mk + '#' + ok;
        var P2 = ctx2Memo[ck];
        if(!P2){
          // 技②自身の効果のうち、ヒットごとに処理されるもの(連続攻撃・おやこあいの2発目に影響しうる)
          // だけを使う(全ヒット後・ターン終了時の効果は、技②のダメージの後なので計算に関係しない)。
          var eff2 = resolveMove1Effects(inp, res, inp);
          eff2.plan = eff2.plan.filter(function(pev){ return pev.stage === 'hit' || pev.stage === 'pre'; });
          P2 = ctx2Memo[ck] = makeMoveContext(inp, res, mode, 2, eff2, reg, s.mk, aMaxHp, { futureSight: fs2 });
          P2.track = false;
        }
        var st = stCopy(s);
        st.dealt = 0; st.crit = 0; st.bh = 0; st.hit = 0;
        // ターン終了時のフォルムチェンジ(スワームチェンジ)でHPが増えた場合は、技②の計算上のHPに合わせる。
        if(res.__formApplied && res.__formApplied.D && res.__formApplied.D.dHp && !st.fn) st.hp = res.defenderCurrentHp;
        if(P2.env.subHp == null) st.sub = null;     // 技②がみがわりを無視する(音技・すりぬけ等)
        return (memo[k] = runMovePipeline(P2, st));
      }
      function faintOf(dist){ var t = 0; for(var k in dist) if(dist[k].s.fn) t += dist[k].p; return t; }

      function getMove2Powers(result){
        var line = (result.trace||[]).find(function(x){ return String(x.label||'').indexOf('変動後威力') >= 0; });
        if(!line) return [];
        var txt = String(line.value||'');
        var re = /(\d+)回目=(\d+)/g, m, out=[];
        while((m = re.exec(txt))) out.push(Number(m[2]));
        if(out.length) return out;
        var single = txt.match(/(\d+)/);
        return single ? [Number(single[1])] : [];
      }

      // ---- ダメージ範囲・確定数用(命中前提、確率100%以上の効果のみ、急所はチェックボックスどおり) ----
      var dist1Range = runMove1(input1, result1, eff, 'display');
      var move2Name = '', move2AnyBranch = false, move2DamageVals = [];
      var finalRangeRemain = [];            // 技②まで終えた(または技①で終了した)分岐の防御側残りHP
      var finalSubRemain = [];
      var subHpFinal = result1.substituteActive ? result1.substituteMaxHp : null;
      var move1FaintFractionHit = 0, totalFaintFractionHit = 0;
      var move2PowerVals = [], move2StartHpVals = [];
      var move2RepResult = null, move2RepBranchHp = null, move2RepInput = null;
      var move2EasyResult = null, move2EasyBranchHp = null;
      var move2RecoveryName = null, move2RecoveryAmount = 0;
      var move2PreventedHit = 0;
      // adj: 技②の時点でスワームチェンジによりHPが増えた分(合計ダメージは技①開始時点のHPを基準にする)。
      function noteFinal(s, adj){
        finalRangeRemain.push(s.hp - (adj||0));
        if(s.sub != null && subHpFinal != null) finalSubRemain.push(subHpFinal - s.sub);
      }
      for(var rk in dist1Range){
        var re = dist1Range[rk], rs = re.s, p0 = re.p;
        if(rs.fn) move1FaintFractionHit += p0;
        var terminal = rs.fn || aFainted(rs);
        if(!rs.fn && aFainted(rs)) move2PreventedHit += p0;
        // 技②が発生しない分岐でも、技②のダメージは「本来入るはずの値」を表示用に求める。
        var rBranchHp = startHpOf(rs);
        move2StartHpVals.push(rBranchHp);
        var rInput2 = buildInput2Branch(rs, rs.hit ? 'hit' : 'miss');
        var rResult2 = calc2(rInput2);
        var rAdj = (rResult2.__formApplied && rResult2.__formApplied.D && rResult2.__formApplied.D.dHp) || 0;
        if(rAdj && !rs.fn){ rBranchHp += rAdj; move2StartHpVals[move2StartHpVals.length-1] = rBranchHp; }
        move2Name = rResult2.moveName || move2Name;
        move2AnyBranch = true;
        var rResult2D = calc2Disp(rInput2);
        move2DamageVals.push(rResult2D.minDamage, rResult2D.maxDamage);
        var rPowers = getMove2Powers(rResult2);
        if(rPowers.length) move2PowerVals.push.apply(move2PowerVals, rPowers);
        if(!move2RecoveryName && rResult2.recoveryAmount > 0){
          move2RecoveryName = rResult2.berryRecoveryName;
          move2RecoveryAmount = rResult2.recoveryAmount;
        }
        if(move2RepBranchHp === null || rBranchHp < move2RepBranchHp){ move2RepBranchHp = rBranchHp; move2RepResult = rResult2D; move2RepInput = rInput2; }
        if(move2EasyBranchHp === null || rBranchHp > move2EasyBranchHp){ move2EasyBranchHp = rBranchHp; move2EasyResult = rResult2D; }
        if(terminal){ noteFinal(rs); if(rs.fn) totalFaintFractionHit += p0; continue; }
        var rDist2 = runMove2(rInput2, rResult2, rs, 'display');
        for(var rk2 in rDist2){
          var e2 = rDist2[rk2];
          noteFinal(e2.s, rAdj);
          if(e2.s.fn) totalFaintFractionHit += p0 * e2.p;
        }
      }
      if(!finalRangeRemain.length) finalRangeRemain.push(hpCur0);
      var minRemainR = Math.min.apply(null, finalRangeRemain), maxRemainR = Math.max.apply(null, finalRangeRemain);
      var totalMinDamage = hpCur0 - maxRemainR, totalMaxDamage = hpCur0 - minRemainR;
      var totalRealMinDamage = totalMinDamage, totalRealMaxDamage = totalMaxDamage;

      // 合計ダメージ・合計割合は「みがわりが無かったら本来出るはずだった値」に揃える。
      if(result1.substituteActive){
        var input1NoSub = Object.assign({}, input1, { options: freshOpts(input1.options, { defenderSubstitute: false }) });
        var result1NoSub = C.calculateDamage(input1NoSub);
        var effNoSub = resolveMove1Effects(input1NoSub, result1NoSub, input2);
        var distNoSub = runMove1(input1NoSub, result1NoSub, effNoSub, 'display');
        var remainNoSub = [];
        for(var nk in distNoSub){
          var ns = distNoSub[nk].s;
          if(ns.fn || aFainted(ns)){ remainNoSub.push(ns.hp); continue; }
          var nInput2 = buildInput2Branch(ns, ns.hit ? 'hit' : 'miss');
          var nResult2 = calc2(nInput2);
          var nDist2 = runMove2(nInput2, nResult2, ns, 'display');
          var nAdj = (nResult2.__formApplied && nResult2.__formApplied.D && nResult2.__formApplied.D.dHp) || 0;
          for(var nk2 in nDist2) remainNoSub.push(nDist2[nk2].s.hp - nAdj);
        }
        if(!remainNoSub.length) remainNoSub.push(hpCur0);
        totalMinDamage = hpCur0 - Math.max.apply(null, remainNoSub);
        totalMaxDamage = hpCur0 - Math.min.apply(null, remainNoSub);
      }
      var substituteMinRemainingFinal = finalSubRemain.length ? Math.min.apply(null, finalSubRemain) : 0;
      var substituteMaxRemainingFinal = finalSubRemain.length ? Math.max.apply(null, finalSubRemain) : 0;

      // ---- 瀕死率(急所発生確率・連続攻撃の回数分布・命中判定・確率で発生する効果をすべて厳密に) ----
      var dist1Prob = runMove1(input1, result1, eff, 'prob');
      var effSummary = summarizeMove(lastMove1.P, dist1Prob, lastMove1.m0);
      var move1FaintFraction = 0, totalFaint = 0, move2PreventedProb = 0;
      for(var pk in dist1Prob){
        var pe = dist1Prob[pk], ps = pe.s, p = pe.p;
        if(ps.fn){ move1FaintFraction += p; totalFaint += p; continue; }
        if(aFainted(ps)){ move2PreventedProb += p; continue; }
        var pInput2 = buildInput2Branch(ps, ps.hit ? 'hit' : 'miss');
        var pResult2 = calc2(pInput2);
        totalFaint += p * faintOf(runMove2(pInput2, pResult2, ps, 'prob'));
      }

      var move2MinDamage = 0, move2MaxDamage = 0;
      if(move2DamageVals.length){
        move2MinDamage = Math.min.apply(null, move2DamageVals);
        move2MaxDamage = Math.max.apply(null, move2DamageVals);
      }
      var move2PowerMin = move2PowerVals.length ? Math.min.apply(null, move2PowerVals) : null;
      var move2PowerMax = move2PowerVals.length ? Math.max.apply(null, move2PowerVals) : null;
      var move2StartHpMin = move2StartHpVals.length ? Math.min.apply(null, move2StartHpVals) : hpCur0;
      var move2StartHpMax = move2StartHpVals.length ? Math.max.apply(null, move2StartHpVals) : hpCur0;

      var result1Disp = C.calculateDamageWithEffects(input1);
      return {
        move1Name: result1.moveName, move2Name: move2AnyBranch ? move2Name : ((input2.move && input2.move.name) || ''),
        move1MinDamage: result1Disp.minDamage, move1MaxDamage: result1Disp.maxDamage,
        move1MinRate: result1Disp.minRate, move1MaxRate: result1Disp.maxRate,
        move1RealMinDamage: result1Disp.realMinDamage, move1RealMaxDamage: result1Disp.realMaxDamage,
        move1AccuracyResult: result1.accuracyResult, move1AccuracyPercent: result1.accuracyPercent,
        move2MinDamage: move2MinDamage, move2MaxDamage: move2MaxDamage,
        move2MinRate: hpMax ? move2MinDamage/hpMax*100 : 0, move2MaxRate: hpMax ? move2MaxDamage/hpMax*100 : 0,
        move2PowerMin: move2PowerMin, move2PowerMax: move2PowerMax,
        move2RepresentativeResult: move2RepResult,
        move2RepresentativeStartHp: move2RepBranchHp,
        move2RepresentativeInput: move2RepInput,
        move2EasyResult: move2EasyResult,
        move2EasyStartHp: move2EasyBranchHp,
        move2RecoveryName: move2RecoveryName,
        move2RecoveryAmount: move2RecoveryAmount,
        move2StartHpMin: move2StartHpMin, move2StartHpMax: move2StartHpMax,
        totalMinDamage: totalMinDamage, totalMaxDamage: totalMaxDamage,
        totalMinRate: hpMax ? totalMinDamage/hpMax*100 : 0, totalMaxRate: hpMax ? totalMaxDamage/hpMax*100 : 0,
        totalRealMinDamage: totalRealMinDamage, totalRealMaxDamage: totalRealMaxDamage,
        faintPercent: roundPct2(totalFaint),
        certain: totalFaint >= 1-1e-9,
        move1FaintFraction: move1FaintFraction,
        totalFaintFraction: totalFaint,
        move1FaintFractionHit: move1FaintFractionHit,
        totalFaintFractionHit: totalFaintFractionHit,
        move2PreventedFraction: move2PreventedProb,
        move2PreventedFractionHit: move2PreventedHit,
        defenderMaxHp: maxHp, defenderCurrentHp: hpCur0,
        substituteActive: !!result1.substituteActive,
        substituteMaxHp: subHpFinal,
        substituteMinRemaining: substituteMinRemainingFinal,
        substituteMaxRemaining: substituteMaxRemainingFinal,
        move1Effects: {
          moveName: eff.moveName,
          hasEffects: eff.hasEffects,
          certainLogs: eff.hit.certain.logs.map(effectLogText),
          outcomes: eff.hit.outcomes.map(function(x){ return { prob: x.prob, logs: x.logs.map(effectLogText) }; }),
          missOutcomes: eff.miss.outcomes.map(function(x){ return { prob: x.prob, logs: x.logs.map(effectLogText) }; }),
          notes: eff.notes.map(effectLogText),
          summary: { A: effSummary.A, D: effSummary.D },
          summaryLists: effSummary.lists,
          legacySummary: describeEffectsFromResolved(eff)
        }
      };
    } catch(e){
      if(window.console && console.error) console.error('[combinedSequence] failed:', e);
      return null;
    }
  };

  // Substitute also affects what a single use of the move actually does to the real target, so
  // the HP bar (minDamage/maxDamage) and the KO-count both need to route through it too. This
  // reuses the CURRENT roll set (already reflecting the actual crit rank, not a probability
  // blend) as a single turn's body-damage outcome. One acknowledged approximation: this treats
  // each turn as facing a substitute in the same starting state, rather than tracking whatever's
  // left of a partially-damaged substitute across turns -- exact cross-turn tracking was judged
  // not worth the added complexity here.
  var prevSub = C.calculateDamage;
  C.calculateDamage = function(input){
    var result = prevSub(input);
    try{
      var o = (input && input.options) || {};
      var subHp = substituteHpOrNull(result, input, o);
      result.substituteActive = subHp != null;
      var maxHp = result.defenderMaxHp;
      var berrySpec = getBerrySpec(result, maxHp, !!o.__forceNoBerryOverride);
      result.berryRecoveryName = berrySpec ? berrySpec.name : null;
      // みがわり・きのみのどちらも無い場合でも、このブロック自体は必ず実行する。理由: 2-5回技等の
      // 複数回攻撃技では、baseパッチ側のminDamage/maxDamage(applyDataDrivenMultiHit等)は「全ヒット
      // 分を無条件に合算」しているだけで、道中で防御側が瀕死になった場合にそこで打撃が止まる
      // (それ以降のヒットは発生しない)ことを考慮していない。そのため例えば最大HPを超える
      // ダメージが確定しているスケイルショット等では、本来ありえない「全5ヒット分の合計」を
      // 上限として表示してしまっていた(実際にはどこかのヒットで瀕死になった時点のダメージが
      // 上限になるはず)。以下のapplyHitSequenceFull(瀕死になった状態'f'では以降のヒットを
      // 適用しない)を常に使ってminDamage/maxDamageを再計算することで、きのみ・みがわりの
      // 有無に関わらず正しい値になる。

      var hpCur0 = result.defenderCurrentHp;
      var hitDists = (result.independentHitRolls && result.independentHitRolls.length)
        ? result.independentHitRolls.map(function(r){ return distFromRolls(r); })
        : [distFromRolls(result.rolls || [0])];
      var oneTurnStates = applyHitSequenceFull(initialStatesFor(subHp, hpCur0), hitDists, subHp, hpCur0, maxHp, berrySpec);

      // Substitute's own remaining-HP range for the mini bar (only meaningful while still 's').
      if(subHp != null){
        result.substituteMaxHp = subHp;
        var subRemainVals = [];
        for(var skey in oneTurnStates){ subRemainVals.push(skey.charAt(0)==='s' ? (subHp-Number(skey.slice(1))) : 0); }
        result.substituteMinRemaining = subRemainVals.length ? Math.min.apply(null, subRemainVals) : 0;
        result.substituteMaxRemaining = subRemainVals.length ? Math.max.apply(null, subRemainVals) : subHp;
      }

      // Remaining real HP after this one use (0 counts as fainted); recovery can push this above
      // the pre-attack HP, which the HP bar renders as a partial refill.
      var remainVals = [], canRecover = false, neverReachesBody = true;
      for(var key in oneTurnStates){
        var isF = key.charAt(0)==='f', isR = key.charAt(0)==='r';
        var remain = (isF || isR) ? Number(key.slice(1).split('_')[0]) : hpCur0;
        remainVals.push(remain);
        if(key.charAt(0)!=='s') neverReachesBody = false;
        // Recovery may have triggered mid-sequence even on a path that ultimately still faints
        // (a guaranteed-KO multi-hit sequence can still heal partway through) -- check both phases.
        if((isF || isR) && key.slice(1).split('_')[1]==='1') canRecover = true;
      }
      result.substituteBlocksAll = subHp!=null && neverReachesBody;
      // The amount itself is a fixed constant determined by maxHP/ability (not a range) -- this
      // is just "does at least one outcome of this attack trigger the berry", so the display can
      // show a single number rather than implying the amount itself varies.
      result.recoveryAmount = (berrySpec && canRecover) ? berrySpec.amount : 0;

      var minRemain = Math.min.apply(null, remainVals), maxRemain = Math.max.apply(null, remainVals);
      var hpMax = maxHp || 1;
      // ダメージ("minDamage"/"maxDamage")は攻撃そのものが与えた量であって、回復は別の話 --
      // 回復によって実質的な被害が相殺されても、攻撃のダメージ自体が小さくなったわけではない。
      // そのため、回復を一切考慮しない(=きのみを常に不発として扱う)版の残りHP分布を別途求め、
      // それを基にダメージを計算する(みがわり由来の「本体には届かない」補正はそのまま反映する)。
      // 割合(minRate/maxRate)・確定数(koInfo)は、回復込みの実際の残りHPを見て判定するのが正しい
      // ので、従来通りremainVals(回復込み)を使う。
      var oneTurnStatesNoBerry = berrySpec
        ? applyHitSequenceFull(initialStatesFor(subHp, hpCur0), hitDists, subHp, hpCur0, maxHp, null)
        : oneTurnStates;
      var rawRemainVals = [];
      for(var rawKey in oneTurnStatesNoBerry){
        var rawIsF = rawKey.charAt(0)==='f', rawIsR = rawKey.charAt(0)==='r';
        rawRemainVals.push((rawIsF || rawIsR) ? Number(rawKey.slice(1).split('_')[0]) : hpCur0);
      }
      var rawMinRemain = Math.min.apply(null, rawRemainVals), rawMaxRemain = Math.max.apply(null, rawRemainVals);
      // みがわりの有無をそのまま反映した、本体に実際に入った(入りうる)ダメージ(回復は考慮しない)。
      // minDamage/maxDamage(下記)は「みがわりが無かったら」という仮定の値に変わったため、
      // 「技①は実際には本体に何もダメージを与えなかった(=みがわりに完全に防がれた/技自体が
      // 無効)」という判定に使う実数値は、こちらの方を別途公開しておく。
      result.realMinDamage = hpCur0 - rawMaxRemain;
      result.realMaxDamage = hpCur0 - rawMinRemain;

      // ダメージ("minDamage"/"maxDamage")は技そのものが生み出す数値であって、みがわりに防がれた
      // かどうかとは別の話 -- みがわりが技を完全に(あるいは部分的に)防いだ場合でも、「本来
      // (みがわりが無ければ)本体に出るはずだったダメージ」を表示する(確定数はみがわりの
      // 有無をそのまま反映した実際の値を使う、上のrawRemainVals/koInfo等は変更しない)。
      // そのため、みがわり・回復のどちらも考慮しない(=最初から本体に直接当たったものとして
      // 扱う)版の残りHP分布を別途求め、ダメージ表示にはそちらを使う。
      var oneTurnStatesRawDamage = subHp != null
        ? applyHitSequenceFull(initialStatesFor(null, hpCur0), hitDists, null, hpCur0, maxHp, null)
        : oneTurnStatesNoBerry;
      var rawDamageRemainVals = [];
      for(var rdKey in oneTurnStatesRawDamage){
        var rdIsF = rdKey.charAt(0)==='f', rdIsR = rdKey.charAt(0)==='r';
        rawDamageRemainVals.push((rdIsF || rdIsR) ? Number(rdKey.slice(1).split('_')[0]) : hpCur0);
      }
      var rawDamageMinRemain = Math.min.apply(null, rawDamageRemainVals), rawDamageMaxRemain = Math.max.apply(null, rawDamageRemainVals);
      result.minDamage = hpCur0 - rawDamageMaxRemain;
      result.maxDamage = hpCur0 - rawDamageMinRemain;
      // 割合(minRate/maxRate)は、ダメージ(minDamage/maxDamage、上記)と同じ「みがわりが
      // 無かったら本来出るはずだった値」を基準にする -- みがわりに防がれている間は常に0.0%に
      // なってしまい(なぜ0%なのか分かりにくい・技②がみがわりを抜けた場合だけ数値が出る、など
      // 一貫性がなく分かりにくいため)、ダメージ表示と揃えて統一する。
      result.minRate = hpMax ? (hpCur0 - rawDamageMaxRemain)/hpMax*100 : 0;
      result.maxRate = hpMax ? (hpCur0 - rawDamageMinRemain)/hpMax*100 : 0;

      if(result.substituteBlocksAll){
        result.koInfo = null;
      } else {
        var hpCur = result.defenderCurrentHp;
        if(hpCur && hpCur>0){
          // Carries substitute HP AND berry-consumed state across turns (rather than resetting
          // either each turn): same convention as before, ignoring accuracy per turn.
          var states = initialStatesFor(subHp, hpCur), partial = null, certain = null;
          for(var t=1;t<=MAX_TURNS;t++){
            states = applyHitSequenceFull(states, hitDists, subHp, hpCur, maxHp, berrySpec);
            var p2 = faintProbOf(states);
            if(p2 > 1e-9 && p2 < 1 - 1e-9 && !partial) partial = { hits:t, probability:p2 };
            if(p2 >= 1 - 1e-9){ certain = t; break; }
          }
          result.koInfo = { certain: certain, partial: (partial && (!certain || partial.hits < certain)) ? partial : null, cappedAt: certain ? null : MAX_TURNS };
        }
      }

      // みがわりのHPを普通のHPに見立てた「確定数」も別途公開する(みがわりが立っている間、
      // 表側の確定数(result.koInfo、本体の実数値HPが基準)は「みがわりが壊れてから本体に
      // ダメージが通るまで」を含む長い道のりになってしまい、そのターンにみがわりへダメージが
      // 入ったこと自体が全く見えなくなる。技自体が無効でない限り、みがわりを何回で壊せるかを
      // 別枠として示す)。1ターン分のダメージ分布(turnDist、result.independentHitRolls/rollsから
      // 計算、急所は現在のチェックボックス状態のまま・命中は前提=result.koInfoと同じ考え方)を
      // 使い回し、閾値だけをみがわりの最大HP(subHp、常に満タン前提)に差し替える。
      result.substituteKoInfo = null;
      if(subHp != null){
        var subTurnDist = (result.independentHitRolls && result.independentHitRolls.length)
          ? result.independentHitRolls.reduce(function(acc, r){ var d = distFromRolls(r); return acc ? convolve(acc, d) : d; }, null)
          : distFromRolls(result.rolls || [0]);
        var subCum = subTurnDist, subPartial = null, subCertain = null;
        for(var st=1; st<=MAX_TURNS; st++){
          if(st>1) subCum = convolve(subCum, subTurnDist);
          var sp = probAtLeast(subCum, subHp);
          if(sp > 1e-9 && sp < 1 - 1e-9 && !subPartial) subPartial = { hits:st, probability:sp };
          if(sp >= 1 - 1e-9){ subCertain = st; break; }
        }
        result.substituteKoInfo = { certain: subCertain, partial: (subPartial && (!subCertain || subPartial.hits < subCertain)) ? subPartial : null, cappedAt: subCertain ? null : MAX_TURNS };
      }
    } catch(e){
      if(window.console && console.error) console.error('[substituteRouting] failed:', e);
    }
    return result;
  };
})();

// v1.5.0 shared type-effectiveness patch (for ポケモン検索 and future tools).
// Exposes window.DAMEKE_CALC.computeTypeEffectiveness(defenderTypes, attackerType, abilityName)
// returning a multiplier (0, 0.25, 0.5, 1, 2, 4) that folds in ability-based immunities using the
// exact same data calculateDamage() itself already relies on (DATA.typeChart4096, the levitate
// ability tag, and the fixed table of type-immunity abilities), so this never risks disagreeing
// with what the calculator would actually compute for the same matchup.
(function(){
  var D = window.DAMEKE_DATA;
  var C = window.DAMEKE_CALC;
  if(!D || !C || C.__typeEffectivenessPatched) return;

  // Same table calc.js's own abilityImmunity() uses internally for damage calculation --
  // duplicated here (rather than reached into, since that copy is scoped inside a closure) so it
  // can't silently drift from what the calculator actually applies.
  var TYPE_IMMUNITY_ABILITIES = {
    'こんがりボディ':'ほのお', 'そうしょく':'くさ', 'ちくでん':'でんき', 'ちょすい':'みず',
    'でんきエンジン':'でんき', 'どしょく':'じめん', 'ひらいしん':'でんき', 'もらいび':'ほのお', 'よびみず':'みず',
    'おわりのだいち':'みず', 'はじまりのうみ':'ほのお'
  };
  // Not full immunity -- halves damage from specific types on top of whatever the type chart
  // already gives (stacks with any existing resistance), same as the real games. Requested
  // explicitly even though these sit slightly outside strict type-chart effectiveness.
  var HALF_DAMAGE_ABILITIES = {
    'あついしぼう': ['ほのお','こおり'], 'すいほう': ['ほのお'], 'たいねつ': ['ほのお'], 'きよめのしお': ['ゴースト']
  };
  function abilityHasTag(abilityName, tag){
    var ability = (D.abilities||[]).find(function(a){ return a.name === abilityName; });
    return !!(ability && window.DAMEKE_DATA_HELPERS && window.DAMEKE_DATA_HELPERS.abilityTag && window.DAMEKE_DATA_HELPERS.abilityTag(ability, tag));
  }
  // Grounding check, matching calc.js's own sideGrounded() -- levitate-tagged abilities (or the
  // two hardcoded exceptions that function also carries) make a Pokemon immune to じめん moves,
  // independent of the base type chart (which never lists an "immune" for じめん vs a grounded
  // Pokemon otherwise).
  function isLevitateAbility(abilityName){
    return abilityName === 'ふゆう' || abilityName === 'うなぎのぼり' || abilityHasTag(abilityName, 'levitate');
  }

  function typeRateRaw(attackerType, defenderType){
    if(!defenderType || defenderType === 'タイプなし') return 4096;
    return ((D.typeChart4096 && D.typeChart4096[attackerType]) || {})[defenderType] ?? 4096;
  }
  // defenderTypes: array of 1-2 defending types. attackerType: the single attacking move type.
  // abilityName: optional -- folds in every ability-based modifier this app tracks: the fixed
  // immunity table above, じめん immunity via levitate, プレラップ Delta Stream's weakness-only
  // cap on ひこう, and the half-damage abilities (applied after immunity, so an already-immune
  // matchup stays at 0 rather than becoming a fractional "half of immune").
  function computeTypeEffectiveness(defenderTypes, attackerType, abilityName){
    var types = (defenderTypes||[]).filter(function(t){ return t && t !== 'タイプなし'; });
    var rate = 4096;
    types.forEach(function(t){ rate = Math.floor(rate * typeRateRaw(attackerType, t) / 4096); });
    if(abilityName){
      if(attackerType === 'じめん' && isLevitateAbility(abilityName)){
        rate = 0;
      } else if(TYPE_IMMUNITY_ABILITIES[abilityName] === attackerType){
        rate = 0;
      } else {
        // デルタストリーム: removes a ひこう weakness specifically (clamps down to neutral) --
        // never touches an already-neutral-or-better matchup.
        if(abilityName === 'デルタストリーム' && attackerType === 'ひこう' && rate > 4096) rate = 4096;
        var halved = HALF_DAMAGE_ABILITIES[abilityName];
        if(halved && halved.indexOf(attackerType) >= 0) rate = Math.floor(rate / 2);
      }
    }
    return rate / 4096;
  }
  // Convenience: the full 18-type matchup row for a defender (optionally through one ability),
  // e.g. for a Pokedex-style "受けた時の相性" display.
  var ALL_TYPES = ['ノーマル','ほのお','みず','でんき','くさ','こおり','かくとう','どく','じめん','ひこう','エスパー','むし','いわ','ゴースト','ドラゴン','あく','はがね','フェアリー'];
  function computeAllTypeEffectiveness(defenderTypes, abilityName){
    var out = {};
    ALL_TYPES.forEach(function(t){ out[t] = computeTypeEffectiveness(defenderTypes, t, abilityName); });
    return out;
  }

  // Whether this ability changes type effectiveness for at least one attacking type -- i.e.
  // it's one of the fixed-immunity table entries, a levitate-style じめん immunity, one of the
  // half-damage abilities, or デルタストリーム's ひこう-weakness cap. Lets callers avoid
  // presenting an ability name when it has no bearing on the defensive profile being shown.
  function isTypeRelevantAbility(abilityName){
    if(!abilityName) return false;
    if(isLevitateAbility(abilityName)) return true;
    if(TYPE_IMMUNITY_ABILITIES.hasOwnProperty(abilityName)) return true;
    if(HALF_DAMAGE_ABILITIES.hasOwnProperty(abilityName)) return true;
    if(abilityName === 'デルタストリーム') return true;
    return false;
  }

  // フリーズドライ: real-effect override -- 2x specifically against a みず-type component,
  // regardless of the plain type chart's own こおり-vs-みず value (normally 0.5x). Every other
  // defending type still uses the ordinary こおり chart value.
  function computeFreezeDryEffectiveness(defenderTypes, abilityName){
    var types = (defenderTypes||[]).filter(function(t){ return t && t !== 'タイプなし'; });
    var rate = 4096;
    types.forEach(function(t){
      var componentRate = (t === 'みず') ? 8192 : typeRateRaw('こおり', t);
      rate = Math.floor(rate * componentRate / 4096);
    });
    if(abilityName){
      var halved = HALF_DAMAGE_ABILITIES[abilityName];
      if(halved && halved.indexOf('こおり') >= 0) rate = Math.floor(rate / 2);
    }
    return rate / 4096;
  }
  // フライングプレス: real-effect override -- deals damage as ノーマル and ひこう simultaneously,
  // i.e. the product of both types' own effectiveness (each already ability-aware).
  function computeFlyingPressEffectiveness(defenderTypes, abilityName){
    return computeTypeEffectiveness(defenderTypes, 'かくとう', abilityName) * computeTypeEffectiveness(defenderTypes, 'ひこう', abilityName);
  }
  // サウザンアロー: simplified per request -- only the ひこうタイプ / ふゆう / うなぎのぼり
  // (levitate-style) immunity-bypass is modeled; every other じめん interaction (resistances,
  // other immunity-granting abilities like どしょく) still applies normally.
  function computeThousandArrowsEffectiveness(defenderTypes, abilityName){
    var types = (defenderTypes||[]).filter(function(t){ return t && t !== 'タイプなし'; });
    var rate = 4096;
    types.forEach(function(t){
      var componentRate = (t === 'ひこう') ? 4096 : typeRateRaw('じめん', t);
      rate = Math.floor(rate * componentRate / 4096);
    });
    if(abilityName && TYPE_IMMUNITY_ABILITIES[abilityName] === 'じめん') rate = 0; // どしょく etc -- a
    // different (absorb) mechanic than levitate, so it's deliberately NOT bypassed here.
    return rate / 4096;
  }
  // Single entry point a caller can always use: applies the freezeDry/flyingPress/thousandArrows
  // overrides when the move carries the matching tag, and falls back to the plain type chart
  // (via the already-resolved effective type) otherwise. moveTags is the move's own tags array.
  function computeMoveEffectiveness(defenderTypes, resolvedType, abilityName, moveTags){
    moveTags = moveTags || [];
    if(moveTags.indexOf('freezeDry') >= 0) return computeFreezeDryEffectiveness(defenderTypes, abilityName);
    if(moveTags.indexOf('flyingPress') >= 0) return computeFlyingPressEffectiveness(defenderTypes, abilityName);
    if(moveTags.indexOf('thousandArrows') >= 0) return computeThousandArrowsEffectiveness(defenderTypes, abilityName);
    return computeTypeEffectiveness(defenderTypes, resolvedType, abilityName);
  }

  C.computeTypeEffectiveness = computeTypeEffectiveness;
  C.computeAllTypeEffectiveness = computeAllTypeEffectiveness;
  C.isTypeRelevantAbility = isTypeRelevantAbility;
  C.computeMoveEffectiveness = computeMoveEffectiveness;
  C.__typeEffectivenessAllTypes = ALL_TYPES;
  C.__typeEffectivenessPatched = true;
})();

// v1.6.0 shared タイプ補完度 (type-complementarity score) patch, for 補完ポケモン出力 and the
// upcoming party-level type-coverage evaluation. Exposes
// window.DAMEKE_CALC.computeComplementScore(inputRates, candidateRates) -> { S, M, W, rawScore }
// where inputRates/candidateRates are { typeName: multiplier } maps over exactly the types to be
// scored (callers exclude ステラ/タイプなし before calling). Implements the spec exactly:
// per-type scoring table, M/W theoretical bounds from the input's own weakness profile, and the
// piecewise S->0-100 conversion with the specified zero-division and empty-type-set fallbacks.
(function(){
  var C = window.DAMEKE_CALC;
  if(!C || C.__complementScorePatched) return;

  var TIER_SCORE_TABLE = {
    '4x': { immune: 9, quarter: 8, half: 7, neutral: -3, double: -10, quad: -15 },
    '2x': { immune: 7, quarter: 6, half: 5, neutral: -2, double: -8, quad: -11 },
    '1x': { immune: 3, quarter: 2, half: 1, neutral: -1, double: -3, quad: -5 }
  };
  var M_TABLE = { '4x': 9, '2x': 7, '1x': 3 };
  var W_TABLE = { '4x': -15, '2x': -11, '1x': -5 };

  // Normalizes a raw multiplier into a tier key -- throws on anything not a recognized rate
  // (NaN, Infinity, null, undefined, or an unexpected number) rather than silently computing
  // with it, per the spec's error-handling requirement.
  function tierOf(rate){
    if(rate == null || typeof rate !== 'number' || !isFinite(rate)){
      throw new Error('computeComplementScore: invalid multiplier ' + rate);
    }
    if(rate < 0) throw new Error('computeComplementScore: unrecognized multiplier ' + rate);
    if(rate === 0) return 'immune';
    // The spec's 6-tier table was written around the plain type chart's own six values (0, .25,
    // .5, 1, 2, 4). The half-damage abilities added afterward (あついしぼう on an already
    // double-resistant type combo, etc.) can legitimately stack down to 1/8 or finer, which that
    // table never anticipated -- rather than treat a real, in-game-accurate multiplier as an
    // error, anything strictly between 0 and 1/4 is folded into the "quarter" tier, since that's
    // already the strongest non-immune resistance category the scoring table defines.
    if(rate <= 0.25 + 1e-9) return 'quarter';
    if(Math.abs(rate - 0.5) < 1e-9) return 'half';
    if(Math.abs(rate - 1) < 1e-9) return 'neutral';
    if(Math.abs(rate - 2) < 1e-9) return 'double';
    if(Math.abs(rate - 4) < 1e-9) return 'quad';
    throw new Error('computeComplementScore: unrecognized multiplier ' + rate);
  }
  // Input-side tier: only 4x/2x/1x are scoreable; immune/quarter/half are excluded entirely
  // (0 points, and excluded from M/W too) regardless of the candidate's own multiplier there.
  function inputTierOf(rate){
    var t = tierOf(rate);
    if(t === 'quad') return '4x';
    if(t === 'double') return '2x';
    if(t === 'neutral') return '1x';
    return null;
  }

  function computeComplementScore(inputRates, candidateRates){
    var types = Object.keys(inputRates);
    var S = 0, M = 0, W = 0;
    types.forEach(function(t){
      var inTier = inputTierOf(inputRates[t]);
      if(inTier === null) return;
      M += M_TABLE[inTier];
      W += W_TABLE[inTier];
      var candTier = tierOf(candidateRates[t]);
      S += TIER_SCORE_TABLE[inTier][candTier];
    });
    var rawScore;
    if(M === 0 && W === 0){
      rawScore = 50; // no scoreable types at all
    } else if(S >= 0){
      rawScore = (M === 0) ? 50 : (50 + 50 * S / M);
    } else {
      rawScore = (W === 0) ? 50 : (50 - 50 * Math.abs(S) / Math.abs(W));
    }
    rawScore = Math.max(0, Math.min(100, rawScore)); // float-safety clamp
    return { S: S, M: M, W: W, rawScore: rawScore };
  }

  C.computeComplementScore = computeComplementScore;
  C.__complementScorePatched = true;
})();

// v1.7.0 shared タイプ一貫度 (type-consistency score) patch, for パーティタイプ評価. Exposes
// window.DAMEKE_CALC.computeTypeConsistency(rates) -> { A, C } | null, where rates is an array
// of already-computed final multipliers (one per selected party member, via
// computeTypeEffectiveness) for a single attacking type. Verified against all of the spec's
// worked examples (all-neutral -> 50, all-4x -> 100, the six mixed 2x/neutral splits, the two
// 2x/other mixes, and the N-independence check) before being wired in here.
(function(){
  var C = window.DAMEKE_CALC;
  if(!C || C.__typeConsistencyPatched) return;

  // Same "fold sub-quarter multipliers into the quarter tier" extension used in
  // computeComplementScore, for the same reason: the half-damage abilities can stack a plain
  // type-chart quarter resistance down further (e.g. 1/8), which this table was never written
  // to have its own entry for.
  function baseValueOf(rate){
    if(rate == null || typeof rate !== 'number' || !isFinite(rate) || rate < 0){
      throw new Error('computeTypeConsistency: invalid multiplier ' + rate);
    }
    if(rate === 0) return 0.00;
    if(rate <= 0.25 + 1e-9) return 0.05;
    if(Math.abs(rate - 0.5) < 1e-9) return 0.25;
    if(Math.abs(rate - 1) < 1e-9) return 0.50;
    if(Math.abs(rate - 2) < 1e-9) return 0.90;
    if(Math.abs(rate - 4) < 1e-9) return 1.00;
    throw new Error('computeTypeConsistency: unrecognized multiplier ' + rate);
  }

  // rates: array of final multipliers, one per selected party member (0 members -> null, since
  // an average over nothing isn't a 0% or 50% result -- it's simply not computable).
  function computeTypeConsistency(rates){
    if(!rates || rates.length === 0) return null;
    var sum = rates.reduce(function(s, r){ return s + baseValueOf(r); }, 0);
    var A = sum / rates.length;
    var Cval;
    if(A >= 0.5){
      Cval = 50 + 50 * (1 - Math.pow((1 - A) / 0.5, 1.5));
    } else {
      Cval = 50 * Math.pow(A / 0.5, 2);
    }
    Cval = Math.max(0, Math.min(100, Cval)); // float-safety clamp
    return { A: A, C: Cval };
  }

  C.computeTypeConsistency = computeTypeConsistency;
  C.__typeConsistencyPatched = true;
})();

/* v2.5.0 フォルムチェンジ(ダルマモード・ぎょぐん・リミットシールド・スワームチェンジ)。
   ターン終了時(手順34)の判定と同じ条件を、計算に使う時点のHPで判定して、ポケモンを置き換えて計算する
   (技①の時点で条件を満たしている場合も、技②の計算時点=技①・ターン終了時の処理の後も同じ)。
   スワームチェンジは、HP種族値の増分×2×レベル/100(切り捨て)だけ現在HPが増える。 */
(function(){
  var C = window.DAMEKE_CALC, D = window.DAMEKE_DATA;
  if(!C || C.__formChangePatched) return;
  var prev = C.calculateDamage;
  var ZEN = { 'ヒヒダルマ':'ヒヒダルマ_ダルマモード', 'ヒヒダルマ_ガラル':'ヒヒダルマ_ダルマモード_ガラル' };
  var ZEN_BACK = {}; Object.keys(ZEN).forEach(function(k){ ZEN_BACK[ZEN[k]] = k; });
  function byId(id){ return (D.pokemons||[]).find(function(p){ return p.id===id; }) || null; }
  function abilityOn(core, side){
    var ab = side==='A' ? core.attackerAbility : core.defenderAbility;
    var st = side==='A' ? core.attackerAbilityState : core.defenderAbilityState;
    if(!ab || !st) return null;
    if(st.active || /かたやぶり/.test(String(st.reason||''))) return ab.name;
    return null;
  }
  function hpOf(result, side){
    if(side==='D') return { cur: result.defenderCurrentHp, max: result.defenderMaxHp };
    var line = (result.trace||[]).find(function(t){ return String(t.label).indexOf('攻撃側ランク補正込み実数値') >= 0; });
    var m = line && String(line.value||'').match(/(\d+)\/(\d+)/);
    return m ? { cur: Number(m[1]), max: Number(m[2]) } : null;
  }
  // 条件に合うフォルム(変更がなければnull)と、現在HPの増分。
  function targetForm(p, ab, hp, level){
    if(!p || !hp) return null;
    var half = hp.cur*2 <= hp.max;
    if(ab==='ダルマモード'){
      if(ZEN[p.id] && half) return { to: byId(ZEN[p.id]), dHp: 0 };
      if(ZEN_BACK[p.id] && !half) return { to: byId(ZEN_BACK[p.id]), dHp: 0 };
    }
    if(ab==='リミットシールド'){
      if(p.id==='メテノ_りゅうせい' && half) return { to: byId('メテノ_コア'), dHp: 0 };
      if(p.id==='メテノ_コア' && !half) return { to: byId('メテノ_りゅうせい'), dHp: 0 };
    }
    if(ab==='ぎょぐん'){
      var school = level >= 20 && hp.cur*4 > hp.max;
      if(p.id==='ヨワシ_たんどく' && school) return { to: byId('ヨワシ_むれた'), dHp: 0 };
      if(p.id==='ヨワシ_むれた' && !school) return { to: byId('ヨワシ_たんどく'), dHp: 0 };
    }
    if(ab==='スワームチェンジ' && (p.id==='ジガルデ_10%フォルム' || p.id==='ジガルデ_50%フォルム') && half && hp.cur > 0){
      var to = byId('ジガルデ_パーフェクトフォルム');
      if(to) return { to: to, dHp: Math.floor((to.baseStats.H - p.baseStats.H)*2*level/100) };
    }
    return null;
  }
  function sameTypes(a, b){ return (a||[]).slice().sort().join('/') === (b||[]).filter(function(t){ return t && t!=='なし'; }).slice().sort().join('/'); }
  C.calculateDamage = function(input){
    var r = prev(input);
    if(!r || !r.__coreState || !input || input.__noFormAdjust) return r;
    var core = r.__coreState;
    var o = input.options || {};
    var changes = {};
    [['A','attacker'],['D','defender']].forEach(function(x){
      var side = x[0], pre = x[1];
      var p = input[pre];
      var t = targetForm(p, abilityOn(core, side), hpOf(r, side), Math.min(Math.max(parseInt(input[pre+'Level'],10)||50, 1), 100));
      if(t && t.to && t.to.id !== p.id) changes[side] = t;
    });
    if(!Object.keys(changes).length){ r.__formApplied = null; return r; }
    var o2 = Object.assign({}, o); delete o2.__coreState;
    var inp2 = Object.assign({}, input, { options: o2 });
    var applied = {};
    Object.keys(changes).forEach(function(side){
      var pre = side==='A' ? 'attacker' : 'defender', t = changes[side], old = input[pre];
      inp2[pre] = t.to;
      if(sameTypes(old.types, [o2[pre+'Type1'], o2[pre+'Type2']])){ o2[pre+'Type1'] = (t.to.types && t.to.types[0]) || 'なし'; o2[pre+'Type2'] = (t.to.types && t.to.types[1]) || 'なし'; }
      if(t.dHp){
        var hp = hpOf(r, side);
        o2[pre+'CurrentHpInput'] = String(hp.cur + t.dHp);
      }
      applied[side] = { from: old.name, to: t.to, dHp: t.dHp };
    });
    var r2 = prev(inp2);
    if(r2){ r2.__formApplied = applied; r2.__formInput = inp2; }
    if(r2 && r2.__coreState) (input.options || (input.options = {})).__coreState = r2.__coreState;
    return r2;
  };
  C.__formChangePatched = true;
})();

/* v2.5.2 ジュエル: 無効要素があるときは発動しない(みがわり・ばけのかわ・アイスフェイスに防がれたときは発動する)。
   一撃必殺以外の固定ダメージ技では消費する(ダメージは増えない)。 */
(function(){
  var C = window.DAMEKE_CALC, D = window.DAMEKE_DATA;
  if(!C || C.__gemRulesPatched) return;
  var prev = C.calculateDamage;
  C.calculateDamage = function(input){
    var r = prev(input);
    if(!r || !r.__coreState) return r;
    var core = r.__coreState, it = core.attackerItem, st = core.attackerItemState;
    var mv = (r.effectiveMove || (input && input.move)) || {};
    var isGem = !!(it && st && st.active && it.kind === 'Gem' && it.type === r.effectiveType);
    var invalid = r.typeRate4096 === 0 || !!r.isInvalid || r.effectiveCategory === '変化';
    if(r.gemConsumed && invalid){ r.gemConsumed = false; r.gemConsumedName = null; }
    if(!r.gemConsumed && isGem && !invalid && input && input.move && input.move.fixedDamageKind && input.move.fixedDamageKind !== 'ohko'
       && window.DAMEKE_GEM_ELIGIBLE(input.move, r.moveName)){
      r.gemConsumed = true; r.gemConsumedName = it.name;
    }
    return r;
  };
  C.__gemRulesPatched = true;
})();
