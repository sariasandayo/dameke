// v1.3.0 素早さ調整ツール
// Reuses calc.js's own calcSpeed() (see window.DAMEKE_CALC.calcSpeed, exposed for this purpose)
// so every ability/item/tailwind/swamp/paralysis modifier here is computed by the exact same
// logic the calculator itself uses -- no separate reimplementation to drift out of sync.
(function(){
  'use strict';
  function q(id){ return document.getElementById(id); }
  function fillSelect(select, items){ select.textContent=''; items.forEach(function(item){ var op=document.createElement('option'); op.value=item.id; op.textContent=item.name; select.appendChild(op); }); }

  var DATA = window.DAMEKE_DATA;
  var CALC = window.DAMEKE_CALC;
  var STAT_KEYS = ['H','A','B','C','D','S'];

  // Abilities with any speed-related effect, and what options-object field(s) need to be set for
  // calcSpeed() to treat them as active -- taken directly from calc.js's own abilityRate()
  // switch, so this list can't silently drift from what calcSpeed itself actually checks.
  // こだいかっせい/クォークチャージ can, in the real game, boost either an attacking stat or
  // speed depending on the Pokemon's own stats -- per the agreed simplification, this tool only
  // ever treats their 発動 checkbox as "speed is boosted", not the attack-stat branch.
  var SPEED_ABILITY_CONFIG = {
    'ようりょくそ': { weather: 'にほんばれ' },
    'すいすい': { weather: 'あめ' },
    'すなかき': { weather: 'すなあらし' },
    'ゆきかき': { weather: 'ゆき' },
    'サーフテール': { field: 'エレキフィールド' },
    'かるわざ': { attackerUnburden: true },
    'はやあし': { forceStatus: 'まひ' },
    'こだいかっせい': { attackerParadoxBoostStat: 'S' },
    'クォークチャージ': { attackerParadoxBoostStat: 'S' }
  };

  function computeSpeedValue(pokemon, natureName, evValue, rankStage, opts){
    opts = opts || {};
    var statsInput = {
      ivs: { H:31,A:31,B:31,C:31,D:31,S:31 },
      evs: { H:0,A:0,B:0,C:0,D:0,S: evValue },
      ranks: { A:0,B:0,C:0,D:0,S:0,acc:0,eva:0 },
      nature: natureName
    };
    var actual = CALC.getActualStats(pokemon, '50', statsInput);
    var o = {
      attackerAbilityId: opts.abilityId || 'none',
      attackerItemId: opts.itemId || 'none',
      attackerTailwind: !!opts.tailwind,
      attackerSwamp: !!opts.swamp,
      weather: opts.weather || 'なし',
      field: opts.field || 'なし',
      attackerUnburden: !!opts.attackerUnburden,
      attackerParadoxBoostStat: opts.attackerParadoxBoostStat || null
    };
    var status = opts.status || 'なし';
    return CALC.calcSpeed('A', pokemon, actual.S, rankStage||0, status, o).final;
  }
  function buildActivationOpts(abilityName, activated, shared){
    var out = Object.assign({}, shared);
    if(!activated) return out;
    var cfg = SPEED_ABILITY_CONFIG[abilityName];
    if(!cfg) return out;
    if(cfg.weather) out.weather = cfg.weather;
    if(cfg.field) out.field = cfg.field;
    if(cfg.attackerUnburden) out.attackerUnburden = true;
    if(cfg.attackerParadoxBoostStat) out.attackerParadoxBoostStat = cfg.attackerParadoxBoostStat;
    if(cfg.forceStatus) out.status = cfg.forceStatus;
    return out;
  }

  // こだいかっせい/クォークチャージ boost whichever of A/B/C/D/S is highest. For most Paradox
  // Pokemon, a Speed-boosting nature that also lowers whichever other stat would otherwise win
  // (おくびょう/せっかち/ようき/むじゃき, each pairing +S with a different one of -A/-B/-C/-D)
  // is enough for Speed to have a shot. アラブルタケ and テツノカイナ are the exception: their A
  // is so far ahead that even that best-case nature swing can't bring Speed above it, so the
  // ability could never boost Speed for them in practice.
  var PARADOX_SPEED_IMPOSSIBLE_NAMES = ['アラブルタケ', 'テツノカイナ'];
  function canParadoxAbilityEverBoostSpeed(pokemon){
    return PARADOX_SPEED_IMPOSSIBLE_NAMES.indexOf(pokemon.name) === -1;
  }
  function isParadoxSpeedAbility(abilityName){ return abilityName === 'こだいかっせい' || abilityName === 'クォークチャージ'; }

  // Electric-type Pokemon cannot be paralyzed at all (a real, longstanding game rule), so まひ
  // never applies to them regardless of the checkbox.
  function canBeParalyzed(pokemon){ return (pokemon.types||[]).indexOf('でんき') === -1; }

  var selectedPokemon = null;
  var lastAbilityPopulatedForId = undefined;
  // The ability select is restricted to the selected Pokemon's own abilities (plain dropdown,
  // no free-text search -- there are at most a handful of options, so search adds nothing).
  // Only repopulated when the Pokemon itself changes, so picking a different *ability* doesn't
  // reset the list out from under the user.
  function ensureAbilityOptionsForPokemon(pokemon){
    var key = pokemon ? pokemon.id : null;
    if(lastAbilityPopulatedForId === key) return;
    lastAbilityPopulatedForId = key;
    var list = [];
    if(pokemon && pokemon.abilities && pokemon.abilities.length){
      pokemon.abilities.forEach(function(name){
        var found = DATA.abilities.find(function(a){ return a.name===name; });
        if(found) list.push(found);
      });
    }
    if(!list.length) list.push({ id:'none', name:'なし' });
    fillSelect(q('damekeSpeedAbility'), list); // selects index 0 (ability1) by default
  }
  var lastItemPopulatedForId = undefined;
  // Mirrors the calculator's own form-linked-item auto-fill (Mega Stones, Plates, Memories,
  // etc.) -- only reapplied when the Pokemon itself changes, same as the ability list, so
  // manually picking a different item afterward isn't overwritten on every re-render.
  function ensureItemForPokemon(pokemon){
    var key = pokemon ? pokemon.id : null;
    if(lastItemPopulatedForId === key) return;
    lastItemPopulatedForId = key;
    var itemSelect = q('damekeSpeedItem');
    if(pokemon && pokemon.formLinkedItem1){
      var found = DATA.items.find(function(i){ return i.name === pokemon.formLinkedItem1; });
      if(found) itemSelect.value = found.id;
    } else {
      itemSelect.value = 'none';
    }
  }
  function renderPlayerSection(){
    var summaryHost = q('damekeSpeedSummary');
    var pokemonId = q('damekeSpeedPokemon').value;
    selectedPokemon = pokemonId ? DATA.pokemons.find(function(p){ return p.id===pokemonId; }) : null;
    ensureAbilityOptionsForPokemon(selectedPokemon);
    ensureItemForPokemon(selectedPokemon);

    var abilitySelect = q('damekeSpeedAbility');
    var activateWrap = q('damekeSpeedAbilityActivateWrap');
    var activateCb = q('damekeSpeedAbilityActivate');
    var abilityName = abilitySelect.options[abilitySelect.selectedIndex] ? abilitySelect.options[abilitySelect.selectedIndex].textContent : '';
    // こだいかっせい/クォークチャージ only show the checkbox when Speed could plausibly be the
    // boosted stat at all -- for a Pokemon where it structurally never can be, showing "発動"
    // would let the tool suggest an outcome the real game can never produce.
    var showActivate = !!SPEED_ABILITY_CONFIG[abilityName]
      && (!isParadoxSpeedAbility(abilityName) || (selectedPokemon && canParadoxAbilityEverBoostSpeed(selectedPokemon)));
    activateWrap.hidden = !showActivate;
    if(!showActivate) activateCb.checked = false;

    if(!selectedPokemon){
      summaryHost.innerHTML = '<div class="dameke-adjust-summary-note">ポケモンを選択してください。</div>';
      playerCurves = null;
      renderRoster();
      return;
    }

    var map = window.DAMEKE_POKEMON_IMAGE_IDS;
    var numId = map ? map[selectedPokemon.name] : null;
    var thumbHtml = numId
      ? '<img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/'+numId+'.png" alt="'+selectedPokemon.name+'" loading="lazy">'
      : '';
    var baseLine = STAT_KEYS.map(function(k){ return k+':'+selectedPokemon.baseStats[k]; }).join('　');
    summaryHost.innerHTML = '<div class="dameke-history-header-row"><div class="dameke-history-thumb">'+thumbHtml+'</div>'
      + '<div class="dameke-history-text-col"><div class="dameke-history-title">'+selectedPokemon.name+'</div>'
      + '<div class="dameke-speed-base-line">'+baseLine+'</div></div></div>';

    var itemId = q('damekeSpeedItem').value;
    var rankStage = parseInt(q('damekeSpeedRank').value, 10) || 0;
    // Electric-types cannot be paralyzed at all, regardless of the checkbox.
    var status = (q('damekeSpeedMyParalysis').checked && canBeParalyzed(selectedPokemon)) ? 'まひ' : 'なし';
    var shared = {
      itemId: itemId,
      abilityId: abilitySelect.value,
      tailwind: q('damekeSpeedMyTailwind').checked,
      swamp: q('damekeSpeedMySwamp').checked,
      status: status
    };
    var activated = showActivate && activateCb.checked;
    var abilityOpts = buildActivationOpts(abilityName, activated, shared);
    if(abilityOpts.status && abilityName !== 'はやあし') abilityOpts.status = shared.status;

    function buildCurve(natureName){
      var curve = [];
      for(var ev=0; ev<=32; ev++) curve.push(computeSpeedValue(selectedPokemon, natureName, ev, rankStage, abilityOpts));
      return curve;
    }
    playerCurves = { boost: buildCurve('ようき'), neutral: buildCurve('まじめ') };
    renderRoster();
  }

  var playerCurves = null;
  var rosterCacheKey = null;
  var rosterGroupsCache = null;
  function buildRosterConditionKey(){
    var p = q('damekeSpeedRosterParalysis').checked, t = q('damekeSpeedRosterTailwind').checked, s = q('damekeSpeedRosterSwamp').checked;
    return (p?'1':'0')+(t?'1':'0')+(s?'1':'0');
  }
  function buildRosterGroups(){
    var key = buildRosterConditionKey();
    if(rosterGroupsCache && rosterCacheKey === key) return rosterGroupsCache;
    var rosterParalysisChecked = q('damekeSpeedRosterParalysis').checked;
    var sharedBase = {
      tailwind: q('damekeSpeedRosterTailwind').checked,
      swamp: q('damekeSpeedRosterSwamp').checked
    };
    var byValue = {}; // value -> { labelKey -> { label, pokemons: [] } }
    DATA.pokemons.forEach(function(p){
      if(p.canEvolve) return;
      // Electric-types cannot be paralyzed at all.
      var shared = Object.assign({}, sharedBase, { status: (rosterParalysisChecked && canBeParalyzed(p)) ? 'まひ' : 'なし' });
      var speedAbilityName = (p.abilities||[]).find(function(a){ return !!SPEED_ABILITY_CONFIG[a]; });
      // こだいかっせい/クォークチャージ: skip entirely for Pokemon where Speed could never
      // actually be the boosted stat (see canParadoxAbilityEverBoostSpeed).
      if(speedAbilityName && isParadoxSpeedAbility(speedAbilityName) && !canParadoxAbilityEverBoostSpeed(p)) speedAbilityName = null;
      // A Pokemon whose form requires holding a specific item (Mega Stone, Plate, Memory, etc.)
      // can't also hold こだわりスカーフ -- its held-item slot is already spoken for.
      var hasLinkedItem = !!p.formLinkedItem1;
      var variants = [
        { label: '最速', nature: 'ようき', ev: 32, itemId: 'none' },
        { label: '準速', nature: 'まじめ', ev: 32, itemId: 'none' },
        { label: '最速+スカーフ', nature: 'ようき', ev: 32, itemId: 'こだわりスカーフ' },
        { label: '準速+スカーフ', nature: 'まじめ', ev: 32, itemId: 'こだわりスカーフ' }
      ];
      // 族 groups by base Speed stat (the standard "100族"-style convention), not by species
      // name -- two different Pokemon sharing both a base Speed stat and the same variant/
      // ability end up in the exact same group, since nothing else affects this calculation.
      function addEntry(v, abilitySuffix, opts){
        var val = computeSpeedValue(p, v.nature, v.ev, 0, opts);
        var label = v.label + p.baseStats.S + '族' + abilitySuffix;
        if(!byValue[val]) byValue[val] = {};
        if(!byValue[val][label]) byValue[val][label] = { label: label, pokemons: [] };
        byValue[val][label].pokemons.push(p);
      }
      variants.forEach(function(v){
        if(hasLinkedItem && v.itemId !== 'none') return;
        addEntry(v, '', Object.assign({}, shared, { itemId: v.itemId, abilityId: 'none' }));
      });
      if(speedAbilityName){
        var isUnburden = speedAbilityName === 'かるわざ';
        variants.forEach(function(v){
          if(isUnburden && v.itemId !== 'none') return;
          if(hasLinkedItem && v.itemId !== 'none') return;
          var opts = buildActivationOpts(speedAbilityName, true, Object.assign({}, shared, { itemId: v.itemId, abilityId: speedAbilityName }));
          addEntry(v, '+'+speedAbilityName, opts);
        });
      }
      // 無振り: no EV, neutral nature, no item, no ability -- a separate baseline tier alongside
      // 最速/準速, deliberately excluding both ability and held-item effects.
      addEntry({ label: '無振り', nature: 'まじめ', ev: 0 }, '', { status: shared.status, tailwind: shared.tailwind, swamp: shared.swamp, itemId: 'none', abilityId: 'none' });
    });
    // Group by value only -- when the same value is reached by several genuinely different
    // conditions (different base Speed stat, different variant, different ability), they're
    // kept as one box with each condition listed as its own subsection inside, rather than
    // separate boxes per condition.
    var groups = [];
    Object.keys(byValue).forEach(function(valKey){
      var val = parseInt(valKey, 10);
      var subGroups = Object.keys(byValue[valKey]).map(function(labelKey){
        return byValue[valKey][labelKey];
      });
      subGroups.sort(function(a,b){ return a.label.localeCompare(b.label, 'ja'); });
      groups.push({ value: val, subGroups: subGroups });
    });
    groups.sort(function(a,b){ return b.value - a.value; });
    rosterGroupsCache = groups;
    rosterCacheKey = key;
    return groups;
  }
  function buildMiniThumb(japaneseName){
    var map = window.DAMEKE_POKEMON_IMAGE_IDS;
    var numId = map ? map[japaneseName] : null;
    if(!numId) return '<div class="dameke-speed-roster-thumb dameke-speed-roster-thumb-missing"></div>';
    return '<div class="dameke-speed-roster-thumb"><img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/'+numId+'.png" alt="'+japaneseName+'" loading="lazy"></div>';
  }
  function findRequiredEv(curve, targetValue){
    if(curve[32] < targetValue) return { type: 'unreachable' };
    if(curve[32] === targetValue) return { type: 'tie', value: 32 };
    for(var ev=0; ev<=32; ev++){ if(curve[ev] > targetValue) return { type: 'ev', value: ev }; }
    return { type: 'unreachable' };
  }
  function requiredEvText(r){
    if(r.type === 'tie') return '32<br>（同速）';
    if(r.type === 'ev') return String(r.value);
    return '－';
  }
  function renderRoster(){
    var host = q('damekeSpeedRosterHost');
    var groups = buildRosterGroups();
    var firstReachableIdx = -1;
    var html = groups.map(function(g, i){
      var subHtml = g.subGroups.map(function(sub){
        var namesHtml = sub.pokemons.map(function(p){ return '<span class="dameke-speed-roster-name-chip">'+buildMiniThumb(p.name)+'<span class="dameke-speed-roster-name-text">'+p.name+'</span></span>'; }).join('');
        return '<div class="dameke-speed-roster-subgroup"><div class="dameke-speed-roster-labels">'+sub.label+'</div>'+namesHtml+'</div>';
      }).join('');

      var boostText = '－', neutralText = '－', reachable = false;
      if(playerCurves){
        var rb = findRequiredEv(playerCurves.boost, g.value);
        var rn = findRequiredEv(playerCurves.neutral, g.value);
        boostText = requiredEvText(rb);
        neutralText = requiredEvText(rn);
        reachable = rb.type !== 'unreachable' || rn.type !== 'unreachable';
      }
      if(reachable && firstReachableIdx === -1) firstReachableIdx = i;
      var cls = 'dameke-speed-roster-row' + (reachable ? ' dameke-speed-roster-row-outsped' : '');
      return '<div class="'+cls+'" data-idx="'+i+'">'
        + '<div class="dameke-speed-roster-col dameke-speed-roster-col-value">'+g.value+'</div>'
        + '<div class="dameke-speed-roster-col dameke-speed-roster-col-names">'+subHtml+'</div>'
        + '<div class="dameke-speed-roster-col dameke-speed-roster-col-ev">'+boostText+'</div>'
        + '<div class="dameke-speed-roster-col dameke-speed-roster-col-ev">'+neutralText+'</div>'
        + '</div>';
    }).join('');
    var header = '<div class="dameke-speed-roster-row dameke-speed-roster-headerrow">'
      + '<div class="dameke-speed-roster-col dameke-speed-roster-col-value">実数値</div>'
      + '<div class="dameke-speed-roster-col dameke-speed-roster-col-names">ポケモン</div>'
      + '<div class="dameke-speed-roster-col dameke-speed-roster-col-ev">必要努力値<br>（補正あり）</div>'
      + '<div class="dameke-speed-roster-col dameke-speed-roster-col-ev">必要努力値<br>（補正なし）</div>'
      + '</div>';
    host.innerHTML = header + html;

    if(firstReachableIdx >= 0){
      var el = host.querySelector('[data-idx="'+firstReachableIdx+'"]');
      if(el) el.scrollIntoView({ block: 'center' });
    }
  }

  function init(){
    fillSelect(q('damekeSpeedPokemon'), [{id:'',name:'指定なし'}].concat(DATA.pokemons));
    ensureAbilityOptionsForPokemon(null);
    fillSelect(q('damekeSpeedItem'), [{id:'none',name:'なし'}].concat(DATA.items));

    if(window.__damekeAttachSearchCombo){
      window.__damekeAttachSearchCombo('damekeSpeedPokemon');
      window.__damekeAttachSearchCombo('damekeSpeedItem');
    }

    ['damekeSpeedPokemon','damekeSpeedAbility','damekeSpeedItem','damekeSpeedAbilityActivate','damekeSpeedRank','damekeSpeedMyParalysis','damekeSpeedMyTailwind','damekeSpeedMySwamp'].forEach(function(id){
      var el = q(id);
      if(el) el.addEventListener('change', renderPlayerSection);
    });
    ['damekeSpeedRosterParalysis','damekeSpeedRosterTailwind','damekeSpeedRosterSwamp'].forEach(function(id){
      var el = q(id);
      if(el) el.addEventListener('change', function(){ rosterGroupsCache = null; renderRoster(); });
    });

    renderPlayerSection();
  }
  window.__damekeRenderSpeedPanel = function(){ renderPlayerSection(); };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
