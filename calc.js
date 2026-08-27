// ==== shared active-item / active-ability helpers ====
// Consolidates ~16 near-duplicate copies of this logic that had accumulated across
// the file's many patch layers into one canonical implementation per behavior variant.
// Behavior is unchanged from before -- this only removes the duplicated text.
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
  H.pokemonKeys = H.pokemonKeys || keys;
  H.pokemonMatches = H.pokemonMatches || pokemonMatches;
  H.itemTargetsPokemon = H.itemTargetsPokemon || itemTargetsPokemon;
  H.abilityTag = H.abilityTag || abilityTag;
  H.itemTag = H.itemTag || itemTag;
  H.formMoveType = H.formMoveType || formMoveType;
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
    return (D && D.moves || []).find(function(m){ return m.name === name || m.id === name; }) || null;
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
  function spToEv(sp){sp=cl(i(sp,0),0,32);return sp<=0?0:(sp===32?252:4+(sp-1)*8);} function norm(src){const o={ivs:{},evs:{},ranks:{}};let total=0;src=src||{};for(const k of ['H','A','B','C','D','S']){o.ivs[k]=cl(i(src.ivs&&src.ivs[k],31),0,31);const raw=cl(i(src.evs&&src.evs[k],0),0,32);const use=Math.min(raw,Math.max(0,66-total));o.evs[k]=use;total+=use;}for(const k of ['A','B','C','D','S','acc','eva'])o.ranks[k]=cl(i(src.ranks&&src.ranks[k],0),-6,6);o.totalEv=total;return o;} function stat(base,level,iv,sp,hp){const ev=spToEv(sp);return hp?fl(((2*base+iv+fl(ev/4))*level)/100)+level+10:fl(((2*base+iv+fl(ev/4))*level)/100)+5;} function getActualStats(p,level,input){const n=norm(input),b=p.baseStats,o={input:n};for(const k of ['H','A','B','C','D','S']){o[k]=stat(b[k],level,n.ivs[k],n.evs[k],k==='H');if(k==='H'&&window.DAMEKE_DATA_HELPERS.pokemonMatches(p,'ヌケニン'))o[k]=1;if(k!=='H')o[k]=window.DAMEKE_NATURE.apply(o[k],k,input||{});}return o;} function previewBaseMaxHp(p,level,input){return getActualStats(p,cl(i(level,50),1,100),input).H;} function cloneStats(s){return Object.assign({},s,{input:s.input});}
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
  function itemActive(side,item,own,opp,o){if(!held(side,item,o))return{active:false,status:'持ち物なし',reason:'持ち物なし'};const b=itemBase(side,o);if(b.suppressed)return{active:false,status:'無効',reason:b.reason};var dynState=o[(side==='A'?'attacker':'defender')+'SpecialState'];if((dynState==='dynamax'||dynState==='gmax')&&(item.kind==='ChoiceScarf'||item.kind==='ChoiceBand'||item.kind==='ChoiceSpecs'))return{active:false,status:'無効',reason:'ダイマックス中はこだわり系持ち物が無効'};if(item.isBerry&&opp.active&&window.DAMEKE_DATA_HELPERS.abilityTag(opp.ability,'berrySuppressOpponent'))return{active:false,status:'無効',reason:'相手側特性'+opp.ability.name+'によりきのみ無効'};if(own.active&&window.DAMEKE_DATA_HELPERS.abilityTag(own.ability,'itemSuppress')&&item.kind!=='AbilityProtection')return{active:false,status:'無効',reason:'特性'+own.ability.name+'により無効'};return{active:true,status:'有効',reason:'有効'};} function itemActiveForMoveType(side,item,own,opp,o,moveName){const state=itemActive(side,item,own,opp,o);if(moveName==='しぜんのめぐみ'&&item&&item.isBerry&&held(side,item,o)&&state.reason.includes('きんちょうかん'))return{active:true,status:'有効',reason:'しぜんのめぐみではきんちょうかんによるきのみ無効を無視'};return state;}
  function hasMold(aState,m,o){if(o.moldBreaker)return true;if(aState.active&&window.DAMEKE_DATA_HELPERS.abilityTag(aState.ability,'moldBreakerEffect'))return true;if(m.ignoresAbilities)return true;return MOLD.has(m.name);} function ignored(aState,dState,dItem,m,o){if(!dState.active)return{ignored:false,reason:'防御側特性が有効ではない'};if(shield('D',dItem,o))return{ignored:false,reason:'防御側とくせいガード有効'};if(!dState.ability.ignorableByMoldBreaker)return{ignored:false,reason:'かたやぶり対象外'};if(!hasMold(aState,m,o))return{ignored:false,reason:'かたやぶり効果なし'};return{ignored:true,reason:'かたやぶり効果により無視'};}
  function ignoreWonderRawSwap(aState,move){return(aState.active&&aState.ability.name==='てんねん')||DEF_RANK_IGNORE_MOVES.has(move.name);} function applyTransformOps(aStats,dStats,ops,ignoreWonderRaw){const a=cloneStats(aStats),d=cloneStats(dStats),logs=[];let wonderActive=false;(ops||[]).forEach((op,idx)=>{if(op==='attackerPowerTrick'){const x=a.A;a.A=a.B;a.B=x;logs.push((idx+1)+'. 攻撃側パワートリック A/B入替');}else if(op==='defenderPowerTrick'){const x=d.A;d.A=d.B;d.B=x;logs.push((idx+1)+'. 防御側パワートリック A/B入替');}else if(op==='powerShare'){const avA=fl((a.A+d.A)/2),avC=fl((a.C+d.C)/2);a.A=d.A=avA;a.C=d.C=avC;logs.push((idx+1)+'. パワーシェア A='+avA+' C='+avC);}else if(op==='guardShare'){const avB=fl((a.B+d.B)/2),avD=fl((a.D+d.D)/2);a.B=d.B=avB;a.D=d.D=avD;logs.push((idx+1)+'. ガードシェア B='+avB+' D='+avD);}else if(op==='speedSwap'){const x=a.S;a.S=d.S;d.S=x;logs.push((idx+1)+'. スピードスワップ S入替');}else if(op==='wonderRoom'){wonderActive=!wonderActive;if(ignoreWonderRaw)logs.push((idx+1)+'. ワンダールーム '+(wonderActive?'発動':'解除')+'（実数値入替のみ無効）');else{const ab=a.B;a.B=a.D;a.D=ab;const db=d.B;d.B=d.D;d.D=db;logs.push((idx+1)+'. ワンダールーム '+(wonderActive?'発動':'解除')+' B/D入替');}}});return{attacker:a,defender:d,logs,wonderRoomActive:wonderActive,wonderRoomRawIgnored:ignoreWonderRaw};}
  function hazardDamage(max,num,den){return num<=0?0:Math.max(1,fl(max*num/den));} function hazardType(max,type,types){const r=combo(type,types).rate;return r<=0?0:Math.max(1,fl(max*r/(4096*8)));} function grounded(p,ab,itState,item,o){if(o.gravity)return true;if(itState.active&&item.kind==='Grounding')return true;if(p.types.includes('ひこう'))return false;if(ab.active&&ab.ability.kind==='Levitate')return false;if(itState.active&&item.kind==='Floating')return false;return true;} 
  function sideGrounded(side,p,ab,itState,item,o,calcTypes){
    const prefix = side === 'A' ? 'attacker' : 'defender';
    if(o[prefix+'RootedSmacked']) return {grounded:true, reason:'ねをはる・うちおとす'};
    if(o.gravity) return {grounded:true, reason:'じゅうりょく'};
    if(itState.active && item.kind === 'Grounding') return {grounded:true, reason:'くろいてっきゅう'};
    const teraType = o[prefix + 'TeraType'] || 'なし';
    const typeList = (teraType && teraType !== 'なし' && teraType !== 'ステラ') ? [teraType] : (Array.isArray(calcTypes) ? calcTypes : (p.types || []));
    if(typeList.includes('ひこう')) return {grounded:false, reason:(teraType && teraType !== 'なし' && teraType !== 'ステラ') ? 'テラスタイプがひこう' : '計算上タイプがひこう'};
    if(ab.active && (window.DAMEKE_DATA_HELPERS.abilityTag(ab.ability,'levitate') || ab.ability.name === 'ふゆう' || ab.ability.name === 'うなぎのぼり')) return {grounded:false, reason:'特性'+ab.ability.name};
    if(itState.active && item.kind === 'Floating') return {grounded:false, reason:'ふうせん'};
    if(o[prefix+'MagnetRise']) return {grounded:false, reason:'でんじふゆう'};
    if(o[prefix+'Telekinesis']) return {grounded:false, reason:'テレキネシス'};
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
    if(o.attackerGMaxRapidStrike){critRank+=1;notes.push('キョダイシンゲキ+1');}
    if(o.attackerFocusEnergy){critRank+=3;notes.push('とぎすます+3');}
    if(aState&&aState.active&&aState.ability&&aState.ability.name==='きょううん'){critRank+=1;notes.push('きょううん+1');}
    if(aIt&&aIt.active&&aItem&&(aItem.name==='ピントレンズ'||aItem.name==='するどいツメ')){critRank+=1;notes.push(aItem.name+'+1');}
    if(aIt&&aIt.active&&aItem&&aItem.name==='ラッキーパンチ'&&window.DAMEKE_DATA_HELPERS.pokemonMatches(atk,['ラッキー'])){critRank+=2;notes.push('ラッキー+ラッキーパンチ+2');}
    if(aIt&&aIt.active&&aItem&&aItem.name==='ながねぎ'&&window.DAMEKE_DATA_HELPERS.pokemonMatches(atk,['カモネギ','カモネギ(ガラル)','ネギガナイト'])){critRank+=2;notes.push('カモネギ系統+ながねぎ+2');}
    if(forced){critRank+=3;notes.push(name+'により確定+3');}
    if(name==='10000まんボルト'||name==='1000まんボルト'){critRank+=2;notes.push(name+'+2');}
    if(window.DAMEKE_DATA_HELPERS.moveTagByName(name,'highCritRatio')){critRank+=1;notes.push('急所に当たりやすい技+1');}
    critRank=Math.min(3,critRank);
    // ③ compare against the manual rank input; take the larger.
    var finalRank=Math.max(critRank,manualRank);
    var reason=(notes.length?notes.join('、')+'（計算上ランク'+critRank+'）':'条件なし（計算上ランク0）')+'、手入力ランク'+manualRank+' → 採用ランク'+finalRank;
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
  function positiveRankSum(r){let s=0;for(const k of ['A','B','C','D','S','acc','eva'])if((r[k]||0)>0)s+=r[k];return s;}
  function currentHp(max,input){return input===''||input==null?max:clamp(int(input,max),1,max);}
  function reversalPower(cur,max){const x=fl(cur*48/max);if(x>=33)return 20;if(x>=17)return 40;if(x>=10)return 80;if(x>=5)return 100;if(x>=2)return 150;return 200;}
  function speedValue(st){return rank(st.S, st.input.ranks.S||0);}
  function isGroundedForTerrain(result){ return window.DAMEKE_CALC_SHARED.isGrounded(result,'A'); }
  function getMoveType(result,move){return result.effectiveType || move.type || 'ノーマル';}
  function getDefTypes(result,def){return result.defenderTypes || def.types || [];}
  function onePower(move,ctx,hit){const o=ctx.o,kind=move.powerKind,base=move.power;switch(kind){
    case 'GForce': return {power:o.gravity?135:90,note:o.gravity?'じゅうりょく':'通常'};
    case 'Rollout': {const h=clamp(int(o.rolloutHit,1),1,5);let p=30*Math.pow(2,h-1);if(o.defenseCurl)p*=2;return{power:p,note:'回数'+h+(o.defenseCurl?'、まるくなる':'')}}
    case 'Acrobatics': return {power:(!ctx.holdingItem || ctx.itemKind==='Gem')?110:55,note:!ctx.holdingItem?'持ち物なし':ctx.itemKind==='Gem'?'ジュエル例外':'通常'};
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
    case 'WaterShuriken': return {power:ctx.window.DAMEKE_DATA_HELPERS.pokemonMatches(attacker,['ゲッコウガ(サトシゲッコウガ)','greninja_ash'])?20:15,note:'みずしゅりけん'};
    case 'DoubleIfTargetSleep': return {power:o.defenderStatus==='ねむり'?140:70,note:'ねむり'};
    case 'DoubleIfUserDamaged': return {power:o.userDamagedThisTurn?120:60,note:o.userDamagedThisTurn?'自分が被ダメ':'通常'};
    case 'Round': return {power:o.roundAllyUsed?120:60,note:o.roundAllyUsed?'他のりんしょう':'通常'};
    case 'FuryCutter': return {power:Math.min(160,40*Math.pow(2,clamp(int(o.furyCutterCount,1),1,3)-1)),note:'回数'};
    case 'TripleAxel': return {power:20*hit,note:'ヒットごと'};
    case 'TripleKick': return {power:10*hit,note:'ヒットごと'};
    default: return {power:base||1,note:'元威力'};
  }}
  function hitCount(move,ctx){if(move.powerKind==='TripleAxel'||move.powerKind==='TripleKick')return 3;if(move.powerKind==='WaterShuriken')return ctx.window.DAMEKE_DATA_HELPERS.pokemonMatches(attacker,['ゲッコウガ(サトシゲッコウガ)','greninja_ash'])?3:5;return 1;}
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
    const ctx={o,attacker:input.attacker,defender:input.defender,aStats,dStats,aMax,dMax,aCurrent,dCurrent,aSpeed:speedValue(aStats),dSpeed:speedValue(dStats),moveType:getMoveType(result,move),attackerGrounded:isGroundedForTerrain(result),holdingItem,itemKind:item.kind,itemNaturalGiftPower:item.naturalGiftPower,itemFlingPower:item.flingPower,atkWeight:input.attacker.weight||100,defWeight:input.defender.weight||100};
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
  function makeHitPlan(move,attacker,o){var plan=[];if(move.powerKind==='TripleAxel'){for(var i=1;i<=3;i++)plan.push({hitIndex:i,basePower:20*i,note:'トリプルアクセル '+i+'回目'});}else if(move.powerKind==='TripleKick'){for(var j=1;j<=3;j++)plan.push({hitIndex:j,basePower:10*j,note:'トリプルキック '+j+'回目'});}else if(move.powerKind==='WaterShuriken'){var count=window.DAMEKE_DATA_HELPERS.pokemonMatches(attacker,['ゲッコウガ(サトシゲッコウガ)','greninja_ash'])?3:5;var power=window.DAMEKE_DATA_HELPERS.pokemonMatches(attacker,['ゲッコウガ(サトシゲッコウガ)','greninja_ash'])?20:15;for(var k=1;k<=count;k++)plan.push({hitIndex:k,basePower:power,note:'みずしゅりけん'});}else if(move.powerKind==='BeatUp'){var party=partyForBeatUp(attacker,o);for(var h=0;h<party.length;h++){var mon=party[h];plan.push({hitIndex:h+1,basePower:fl((mon.baseStats.A||0)/10)+5,note:mon.name+' A種族値参照'});}}return plan;}
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
    if(aItemOk&&aItem.kind==='Gem'&&aItem.type===type)applyRate(state,'ジュエル',5325,logs);
    if(input.attacker&&/^オーガポン/.test(input.attacker.name||'')&&input.attacker.name!=='オーガポン(みどり)')applyRate(state,'オーガポンのめん',4915,logs);
    if((M('ソーラービーム')||M('ソーラーブレード'))&&['あめ','おおあめ','すなあらし','ゆき'].includes(o.attackerEffectiveWeather||o.weather))applyRate(state,'ソーラー系悪天候',2048,logs);
    if(M('Gのちから')&&o.gravity)applyRate(state,'Gのちから',6144,logs);
    if(M('はたきおとす')&&o.defenderItemId&&o.defenderItemId!=='none'&&!(D.findFormByLinkedItem&&D.findFormByLinkedItem(input.defender,dItem.name))&&!/Z$/.test(dItem.name||''))applyRate(state,'はたきおとす',6144,logs);
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
  function typeEffectInfo(result,input,o){var moveType=result.effectiveType||input.move.type;var name=effectiveMoveName(result,input);var logs=[];var invalid=false;
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
    if(o.defenderTelekinesis || special==='zmove' || special==='special_z' || special==='dynamax' || special==='gmax' || moveDataAlwaysHit(effMove) || rainAlwaysHit){
      var why = o.defenderTelekinesis?'防御側テレキネシス':(special!=='none'?'攻撃側強化技選択中':(rainAlwaysHit?'防御側あめ+天候技':'技データが必中'));
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
      var flingActive = aItemOk.active || (aItem.isBerry && String(aItemOk.reason||'').includes('きんちょうかん'));
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
      var ngActive=aItemOk.active || (aItem.isBerry && String(aItemOk.reason||'').includes('きんちょうかん'));
      if(!ngActive||!aItem.isBerry) return {invalid:true,reason:'しぜんのめぐみは有効なきのみが必要'};
    }
    if(n==='ポルターガイスト' && !dItemOk.active) return {invalid:true,reason:'ポルターガイストは相手が持ち物を持っていないと無効'};

    if(n==='いびき' && o.attackerStatus!=='ねむり') return {invalid:true,reason:'いびきは眠り状態でないと使用不可'};
    if(n==='ゆめくい' && o.defenderStatus!=='ねむり') return {invalid:true,reason:'ゆめくいは相手が眠り状態でないと無効'};

    var dynState=o.defenderSpecialState;
    if((dynState==='dynamax'||dynState==='gmax') && ['けたぐり','くさむすび','ヘビーボンバー','ヒートスタンプ','じわれ','ぜったいれいど','つのドリル','ハサミギロチン'].indexOf(n)>=0)
      return {invalid:true,reason:'防御側ダイマックス中は'+n+'無効'};

    if(['じばく','だいばくはつ','ビックリヘッド','ミストバースト'].indexOf(n)>=0 && dOk && dAb.name==='しめりけ')
      return {invalid:true,reason:'しめりけにより爆発技無効'};

    if(priority>=1 && dOk && ['ビビッドボディ','じょうおうのいげん','テイルアーマー'].indexOf(dAb.name)>=0)
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
  function burnRate(result,input,o){var aAb=by(D.abilities,o.attackerAbilityId||'なし');if(o.attackerStatus==='やけど' && !(activeAbility('A',aAb,o,result)&&aAb.name==='こんじょう') && moveName(result,input)!=='からげんき')return {rate:2048,reason:'やけど'};return {rate:4096,reason:'なし'};}
  function moldBreakerActive(result,input,o){var aAb=by(D.abilities,o.attackerAbilityId||'なし');var aA=activeAbility('A',aAb,o,result);var n=moveName(result,input);var moldMoves=['メテオドライブ','フォトンゲイザー','サンシャインスマッシャー','てんこがすめつぼうのひかり','キョダイコランダ'];var effMove=(result&&result.effectiveMove)||input.move;return !!((aA&&window.DAMEKE_DATA_HELPERS.abilityTag(aAb,'moldBreakerEffect'))||(effMove&&effMove.ignoresAbilities)||window.DAMEKE_DATA_HELPERS.moveTagByName(n,'ignoresAbilities')||moldMoves.indexOf(n)>=0);}
  function otherModifier(result,input,o){var aAb=by(D.abilities,o.attackerAbilityId||'なし'),dAb=by(D.abilities,o.defenderAbilityId||'なし'),aItem=by(D.items,o.attackerItemId||'none'),dItem=by(D.items,o.defenderItemId||'none');var aA=activeAbility('A',aAb,o,result),dA=activeAbility('D',dAb,o,result),aI=activeItem('A',aItem,o,result),dI=activeItem('D',dItem,o,result);var cat=moveCat(result,input),type=moveType(result,input),n=moveName(result,input),typeRate=result.typeRate4096||4096,crit=criticalActive(result),contact=contactActive(result);var state={rate:4096},logs=[];
    var screen=o.defenderScreen||'none';var wall=4096;if(!(aA&&window.DAMEKE_DATA_HELPERS.abilityTag(aAb,'screenBypass'))&&!crit){if((cat==='物理'&&(screen==='reflect'||screen==='auroraVeil'))||(cat==='特殊'&&(screen==='lightScreen'||screen==='auroraVeil')))wall=rangeIsSpread(result)?2703:2048;}if(wall!==4096)rateApply(state,'壁補正',wall,logs);
    if(aA&&window.DAMEKE_DATA_HELPERS.abilityTag(aAb,'superEffectiveBoost')&&typeRate>4096)rateApply(state,'ブレインフォース',5120,logs);
    if(['アクセルブレイク','イナズマドライブ'].includes(n)&&typeRate>4096)rateApply(state,'弱点強化技',5461,logs);
    if(aA&&window.DAMEKE_DATA_HELPERS.abilityTag(aAb,'criticalDamageBoost')&&crit)rateApply(state,'スナイパー',6144,logs);
    if(aA&&window.DAMEKE_DATA_HELPERS.abilityTag(aAb,'notVeryEffectiveBoost')&&typeRate<4096)rateApply(state,'いろめがね',8192,logs);
    if(dA&&dAb.name==='もふもふ'&&type==='ほのお')rateApply(state,'もふもふ ほのお',8192,logs);
    if(dA&&dAb.name==='こおりのりんぷん'&&cat==='特殊')rateApply(state,'こおりのりんぷん',2048,logs);
    if(dA&&dAb.name==='パンクロック'&&soundMove(input,result))rateApply(state,'防御側パンクロック',2048,logs);
    var hp=currentHp(result);if(dA&&['ファントムガード','マルチスケイル'].includes(dAb.name)&&hp.cur===hp.max)rateApply(state,dAb.name,2048,logs);
    if(dA&&dAb.name==='もふもふ'&&contact)rateApply(state,'もふもふ 接触',2048,logs);
    if(dA&&['ハードロック','フィルター','プリズムアーマー'].includes(dAb.name)&&typeRate>4096)rateApply(state,dAb.name,3072,logs);
    if(o.defenderFriendGuard&&!moldBreakerActive(result,input,o))rateApply(state,'フレンドガード',3072,logs);else if(o.defenderFriendGuard&&moldBreakerActive(result,input,o))logs.push('フレンドガード: かたやぶり効果により4096');
    if(aI&&window.DAMEKE_DATA_HELPERS.itemTag(aItem,'expertBelt')&&typeRate>4096)rateApply(state,'たつじんのおび',4915,logs);
    if(aI&&window.DAMEKE_DATA_HELPERS.itemTag(aItem,'metronomeItem')){var count=Math.min(Math.max(num(o.metronomeUseCount,1),1),6);var rate=R.roundHalfUp(4096*(1+0.2*(count-1)));rateApply(state,'メトロノーム '+count+'回',rate,logs);}
    if(aI&&window.DAMEKE_DATA_HELPERS.itemTag(aItem,'lifeOrb'))rateApply(state,'いのちのたま',5324,logs);
    if(dI&&window.DAMEKE_DATA_HELPERS.itemTag(dItem,'resistBerry')){if((dItem.name==='ホズのみ'&&type==='ノーマル')||(dItem.name!=='ホズのみ'&&dItem.type===type&&typeRate>4096)){rateApply(state,dItem.name,2048,logs);}}
    if(['じしん','マグニチュード'].includes(n)&&o.defenderSemiInvulnerable==='あなをほる')rateApply(state,'倍ダメージ あなをほる',8192,logs);
    if(n==='なみのり'&&o.defenderSemiInvulnerable==='ダイビング')rateApply(state,'倍ダメージ ダイビング',8192,logs);
    if(window.DAMEKE_DATA_HELPERS.moveTagByName(n,'minimizeDouble')&&o.defenderMinimized&&o.defenderSpecialState!=='dynamax'&&o.defenderSpecialState!=='gmax')rateApply(state,'倍ダメージ ちいさくなる',8192,logs);
    var dMaxLine=(result.trace||[]).find(x=>String(x.label).includes('ダイマックス（防御側）')||String(x.label).includes('Z・ダイマックス（防御側）'));var dMax=!!(dMaxLine&&String(dMaxLine.value).includes('有効'));if(window.DAMEKE_DATA_HELPERS.moveTagByName(n,'doubleVsDynamax')&&dMax)rateApply(state,'倍ダメージ 対ダイマックス',8192,logs);
    return {rate:state.rate,logs:logs.length?logs:['なし']};}
  var protectInfo = window.DAMEKE_CALC_SHARED.protectInfo;
  function postHitDamageAdjustment(result,input,o,hitOrdinal,damage,logs){if(hitOrdinal!==1)return damage;var dAb=by(D.abilities,o.defenderAbilityId||'なし'),dItem=by(D.items,o.defenderItemId||'none');var dA=activeAbility('D',dAb,o,result),dI=activeItem('D',dItem,o,result);var hp=currentHp(result);var n=moveName(result,input),cat=moveCat(result,input);if(dA&&dAb.name==='ばけのかわ'){var disguise=Math.floor(hp.max/8);logs.push('ばけのかわ: 1回目 '+damage+' -> '+disguise);return disguise;}if(input.defender&&input.defender.name==='コオリッポ(アイスフェイス)'&&dA&&dAb.name==='アイスフェイス'&&cat==='物理'){logs.push('アイスフェイス: 1回目 '+damage+' -> 0');return 0;}var holdBack=(n==='てかげん'||n==='みねうち');var sturdy=(dA&&dAb.name==='がんじょう'&&hp.cur===hp.max);var sash=(dI&&(dItem.name==='きあいのタスキ'||window.DAMEKE_DATA_HELPERS.itemTag(dItem,'focusSash'))&&hp.cur===hp.max);if((holdBack||sturdy||sash)&&damage>=hp.max){var adjusted=Math.max(0,hp.max-1);logs.push((holdBack?n:(sturdy?'がんじょう':'きあいのタスキ'))+': 1回目 '+damage+' -> '+adjusted);return adjusted;}return damage;}
  function calcOne(level,power,atk,def,rnd,rates,parentalRate){var a=Math.floor(level*2/5)+2,b=Math.floor(a*power*atk/def),d=Math.floor(b/50)+2;d=R.apply4096FiveDown(d,rates.range);d=R.apply4096FiveDown(d,parentalRate);d=R.apply4096FiveDown(d,rates.weather);d=R.apply4096FiveDown(d,rates.glaiveRush);d=R.apply4096FiveDown(d,rates.critical);d=Math.floor(d*rnd/100);d=R.apply4096FiveDown(d,rates.stab);d=R.apply4096Floor(d,rates.type);d=R.apply4096FiveDown(d,rates.burn);d=R.apply4096FiveDown(d,rates.other);d=R.apply4096FiveDown(d,rates.protect);return d<1?1:d;}
  function setTrace(result,label,name,value,note){var line=(result.trace||[]).find(x=>String(x.label).includes(label));if(line){line.name=name;line.value=value;if(note!=null)line.note=note;}else result.trace.push({label:label,name:name,value:value,note:note||'',implemented:true});}
  var prev=C.calculateDamage.bind(C);
  C.calculateDamage=function(input){var result=prev(input);if(result&&result.__coreState)(input.options||(input.options={})).__coreState=result.__coreState;var o=input.options||{},powers=[],line=(result.trace||[]).find(x=>String(x.label).includes('変動後威力'));if(line){var re=/(\d+)回目=(\d+)/g,m;while((m=re.exec(String(line.value))))powers.push(num(m[2],0));}if(!powers.length&&result.hitPlan)powers=result.hitPlan.map(h=>h.basePower||input.move.power||1);if(!powers.length)powers=[input.move.power||1];var atk=parseAfterArrow(result,'補正後攻撃側実数値'),def=parseAfterArrow(result,'補正後防御側実数値'),level=Math.min(Math.max(num(input.attackerLevel,50),1),100);var baseLine=(result.trace||[]).find(x=>String(x.label).includes('ダメージ補正値'));var range=(String(baseLine&&baseLine.value).match(/範囲=(\d+)/)||[])[1]||4096,weather=(String(baseLine&&baseLine.value).match(/天候=(\d+)/)||[])[1]||4096,glaive=(String(baseLine&&baseLine.value).match(/きょけんとつげき=(\d+)/)||[])[1]||4096,crit=(String(baseLine&&baseLine.value).match(/急所=(\d+)/)||[])[1]||4096,stab=(String(baseLine&&baseLine.value).match(/STAB=(\d+)/)||[])[1]||result.stabRate4096||4096,type=result.typeRate4096||4096;var invalidLine=(result.trace||[]).find(function(x){return String(x.label).includes('無効要素');});if(String(invalidLine&&invalidLine.value||'').includes('天候により無効'))weather=0;var burn=burnRate(result,input,o),other=otherModifier(result,input,o),protect=protectInfo(result,input,o);var rates={range:+range,weather:+weather,glaiveRush:+glaive,critical:+crit,stab:+stab,type:+type,burn:burn.rate,other:other.rate,protect:protect.rate};var typeRateForZero=(result.typeRate4096==null?4096:result.typeRate4096);var zero=!atk||!def||protect.invalid||rates.weather===0||typeRateForZero===0||(moveCat(result,input)==='変化');
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
  // only ever touches the very first hit.
  var rawHitRolls=[],adjHitRolls=[],postLogs=[],ord=0;
  for(var i=0;i<powers.length;i++){
    for(var j=0;j<parentRates.length;j++){
      ord++;
      var rawArr=[],adjArr=[];
      for(var rnd=85;rnd<=100;rnd++){
        var rawD=calcOne(level,powers[i],atk,def,rnd,rates,parentRates[j]);
        var d=postHitDamageAdjustment(result,input,o,ord,rawD,postLogs);
        rawArr.push(rawD);
        adjArr.push(d);
      }
      rawHitRolls.push(rawArr);
      adjHitRolls.push(adjArr);
    }
  }
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
  function byMoveName(name){ return (D && D.moves || []).find(function(m){return m.name === name || m.id === name;}) || null; }
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
    return rules.find(function(r){ return r.move === move.name && pokemonMatches(p, [].concat(arr(r.pokemonKeys), arr(r.speciesKeys), arr(r.pokemon))); }) || null;
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
    // unadjusted per-hit value, not a copy of the adjusted one.
    result.independentHitRolls = [];
    result.rawIndependentHitRolls = [];
    for(var ci=0; ci<countForSummary; ci++){
      result.independentHitRolls.push((ci===0 ? singleRolls : rawSingleRolls).slice());
      result.rawIndependentHitRolls.push(rawSingleRolls.slice());
    }
    var totalRolls = [];
    for(var ri=0; ri<16; ri++){
      var sum=0; for(var hi=0; hi<countForSummary; hi++) sum += result.independentHitRolls[hi][ri];
      totalRolls.push(sum);
    }
    var rawTotalRolls = [];
    for(var ri2=0; ri2<16; ri2++){
      var sum2=0; for(var hi2=0; hi2<countForSummary; hi2++) sum2 += rawSingleRolls[ri2];
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
  function getBerrySpec(result, maxHp){
    var dItem = result.__coreState && result.__coreState.defenderItem;
    var dItemState = result.__coreState && result.__coreState.defenderItemState;
    if(!dItemState || !dItemState.active || !dItem || !maxHp) return null;
    var dAb = result.__coreState && result.__coreState.defenderAbility;
    var dAbState = result.__coreState && result.__coreState.defenderAbilityState;
    var hasRipen = !!(dAbState && dAbState.active && dAb && dAb.name==='じゅくせい');
    var hasGluttony = !!(dAbState && dAbState.active && dAb && dAb.name==='くいしんぼう');
    var name = dItem.name;
    if(name==='オボンのみ'){
      var amt = Math.floor(maxHp/4);
      if(hasRipen) amt = Math.floor(amt/2);
      return {threshold:Math.floor(maxHp/2), amount:amt, name:name};
    }
    if(['フィラのみ','ウイのみ','マゴのみ','バンジのみ','イアのみ'].indexOf(name)>=0){
      var threshold = hasGluttony ? Math.floor(maxHp/2) : Math.floor(maxHp/4);
      var amt2 = hasRipen ? Math.floor(maxHp*2/3) : Math.floor(maxHp/3);
      return {threshold:threshold, amount:amt2, name:name};
    }
    if(name==='オレンのみ') return {threshold:Math.floor(maxHp/2), amount:(hasRipen?20:10), name:name};
    if(name==='きのみジュース') return {threshold:Math.floor(maxHp/2), amount:20, name:name};
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
              // Keep the actual (possibly negative, i.e. overkill) remaining HP so display code
              // can recover the true damage dealt -- collapsing this to a bare flag previously lost
              // that and made damage look capped at current HP whenever a berry/substitute wrapper
              // was active at all, even on hits that were never going to be survived.
              var nkf = 'f'+newHp;
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
            if(newHp<=0){ var nkf='f'+newHp; next[nkf]=(next[nkf]||0)+p*w2; continue; }
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
    if(n==='みずしゅりけん' && window.DAMEKE_DATA_HELPERS.pokemonMatches(input.attacker,['ゲッコウガ(サトシゲッコウガ)','greninja_ash'])) return {type:'fixed', count:3};
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
    if(category.type==='variable2to5') return {2:3/8, 3:3/8, 4:1/8, 5:1/8};
    return null; // perHitAcc without modifiers -- handled by the joint DP instead
  }

  C.computeFaintProbability = function(input, mainResult){
    try{
      var o = input.options || {};
      var result = mainResult || C.calculateDamage(input);
      if(result.accuracyResult==='当たらない') return 0;
      var accProb = result.accuracyResult==='必中' ? 1 : Math.max(0,Math.min(1,(result.accuracyPercent||0)/100));
      var hp = result.defenderCurrentHp;
      if(!hp || hp<=0) return 0;
      if(result.isInvalid) return 0;
      if((result.effectiveCategory)==='変化') return 0;

      var offOptions = Object.assign({}, o, {__forceCritOverride:'off'});
      var onOptions = Object.assign({}, o, {__forceCritOverride:'on'});
      var normalResult = C.calculateDamage({attacker:input.attacker, defender:input.defender, move:input.move, attackerLevel:input.attackerLevel, defenderLevel:input.defenderLevel, options:offOptions});
      var critResult = C.calculateDamage({attacker:input.attacker, defender:input.defender, move:input.move, attackerLevel:input.attackerLevel, defenderLevel:input.defenderLevel, options:onOptions});
      var critRate = critRateFromResult(result);

      var category = getMultiHitCategory(result,input,o);
      var maxHitsNeeded = category.type==='fixed' ? category.count : (category.type==='variable2to5'||category.type==='perHitAcc' ? category.max : 1);
      var perHitDists = buildPerHitDists(normalResult, critResult, critRate, maxHitsNeeded);

      var aAb = result.__coreState && result.__coreState.attackerAbility;
      var aAbState = result.__coreState && result.__coreState.attackerAbilityState;
      var aItem = result.__coreState && result.__coreState.attackerItem;
      var aItemState = result.__coreState && result.__coreState.attackerItemState;
      var hasSkillLink = !!(aAbState && aAbState.active && aAb && aAb.name==='スキルリンク');
      var hasLoadedDice = !!(aItemState && aItemState.active && aItem && aItem.name==='いかさまダイス');

      var subHp = substituteHpOrNull(result,input,o);
      var maxHp = result.defenderMaxHp;
      var berrySpec = getBerrySpec(result, maxHp);

      if(category.type==='perHitAcc' && !hasSkillLink && !hasLoadedDice){
        var states0 = applyHitSequenceFullSequential(initialStatesFor(subHp,hp), perHitDists, subHp, hp, maxHp, berrySpec, accProb, category.max);
        return Math.round(faintProbOf(states0)*10000)/100;
      }

      var hitCountDist = getHitCountDist(category, hasSkillLink, hasLoadedDice);
      var total = 0;
      var keys = Object.keys(hitCountDist).map(Number).sort(function(a,b){return a-b;});
      for(var ki=0; ki<keys.length; ki++){
        var k = keys[ki], p = hitCountDist[k];
        var states1 = applyHitSequenceFull(initialStatesFor(subHp,hp), perHitDists.slice(0,k), subHp, hp, maxHp, berrySpec);
        total += p * faintProbOf(states1);
      }
      return Math.round(accProb*total*10000)/100;
    } catch(e){
      if(window.console && console.error) console.error('[faintProbability] failed:', e);
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
      var berrySpec = getBerrySpec(result, maxHp);
      result.berryRecoveryName = berrySpec ? berrySpec.name : null;
      if(subHp == null && !berrySpec) return result;

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
        var remain = key.charAt(0)==='f' ? Number(key.slice(1)) : (key.charAt(0)==='r' ? Number(key.slice(1).split('_')[0]) : hpCur0);
        remainVals.push(remain);
        if(key.charAt(0)!=='s') neverReachesBody = false;
        if(key.charAt(0)==='r' && key.slice(1).split('_')[1]==='1') canRecover = true;
      }
      result.substituteBlocksAll = subHp!=null && neverReachesBody;
      // The amount itself is a fixed constant determined by maxHP/ability (not a range) -- this
      // is just "does at least one outcome of this attack trigger the berry", so the display can
      // show a single number rather than implying the amount itself varies.
      result.recoveryAmount = (berrySpec && canRecover) ? berrySpec.amount : 0;

      var minRemain = Math.min.apply(null, remainVals), maxRemain = Math.max.apply(null, remainVals);
      result.minDamage = hpCur0 - maxRemain;
      result.maxDamage = hpCur0 - minRemain;
      var hpMax = maxHp || 1;
      result.minRate = hpMax ? result.minDamage/hpMax*100 : 0;
      result.maxRate = hpMax ? result.maxDamage/hpMax*100 : 0;

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
    } catch(e){
      if(window.console && console.error) console.error('[substituteRouting] failed:', e);
    }
    return result;
  };
})();
