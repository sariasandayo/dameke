// v1.7.0 パーティタイプ評価
// For up to 6 selected party members (Pokemon + ability each, same input shape as 補完ポケモン
// 出力), computes タイプ一貫度 for every attacking type via the shared
// window.DAMEKE_CALC.computeTypeEffectiveness / computeTypeConsistency functions.
(function(){
  'use strict';
  function q(id){ return document.getElementById(id); }
  var DATA = window.DAMEKE_DATA;
  var CALC = window.DAMEKE_CALC;
  var ALL_TYPES = CALC.__typeEffectivenessAllTypes || ['ノーマル','ほのお','みず','でんき','くさ','こおり','かくとう','どく','じめん','ひこう','エスパー','むし','いわ','ゴースト','ドラゴン','あく','はがね','フェアリー'];
  var TYPE_COLOR_MAP = { 'なし':'none', 'ノーマル':'normal', 'ほのお':'fire', 'みず':'water', 'でんき':'electric', 'くさ':'grass', 'こおり':'ice', 'かくとう':'fighting', 'どく':'poison', 'じめん':'ground', 'ひこう':'flying', 'エスパー':'psychic', 'むし':'bug', 'いわ':'rock', 'ゴースト':'ghost', 'ドラゴン':'dragon', 'あく':'dark', 'はがね':'steel', 'フェアリー':'fairy', 'ステラ':'stellar' };
  function typeColorClass(t){ return 'dameke-type-' + (TYPE_COLOR_MAP[t] || 'none'); }
  function typeBadgesHtml(types){
    return (types||[]).map(function(t){ return '<span class="dameke-party-type-badge '+typeColorClass(t)+'">'+t+'</span>'; }).join('');
  }

  var SLOT_COUNT = 6;
  var slots = []; // { pokemon, abilityName } per slot
  for(var i=0;i<SLOT_COUNT;i++) slots.push({ pokemon: null, abilityName: null });

  function fillSelect(select, items, placeholder){
    select.textContent = '';
    if(placeholder){ var op0=document.createElement('option'); op0.value=''; op0.textContent=placeholder; select.appendChild(op0); }
    items.forEach(function(item){ var op=document.createElement('option'); op.value=item.id; op.textContent=item.name; select.appendChild(op); });
  }

  // Same 特性1-by-default convention as 補完ポケモン出力/素早さ調整/etc, and the same exclusion
  // of the literal "なし" ability entry (never a real Pokemon's actual ability).
  function ensureSlotAbilityOptions(slot, selectEl){
    var list = [];
    if(slot.pokemon && slot.pokemon.abilities && slot.pokemon.abilities.length){
      slot.pokemon.abilities.forEach(function(name){
        var found = DATA.abilities.find(function(a){ return a.name===name && a.id!=='なし'; });
        if(found) list.push(found);
      });
    }
    if(!list.length) list.push({ id:'', name:'（特性なし）' });
    fillSelect(selectEl, list);
    // If slot.abilityName was already set to something valid for this Pokemon (e.g. just loaded
    // from a saved party), keep it instead of silently resetting to 特性1.
    var stillValid = slot.abilityName && list.some(function(a){ return a.id === slot.abilityName; });
    selectEl.value = stillValid ? slot.abilityName : (list[0] ? list[0].id : '');
    if(selectEl._v082hRefreshOptions) selectEl._v082hRefreshOptions();
    slot.abilityName = selectEl.value || null;
  }

  function renderSlot(index){
    var slot = slots[index];
    var row = document.createElement('div');
    row.className = 'dameke-partytype-slot';

    var pokemonSelect = document.createElement('select');
    pokemonSelect.id = 'damekePartyTypePokemon' + index;
    fillSelect(pokemonSelect, DATA.pokemons, '指定なし');
    pokemonSelect.value = slot.pokemon ? slot.pokemon.id : '';
    var abilitySelect = document.createElement('select');
    abilitySelect.id = 'damekePartyTypeAbility' + index;
    ensureSlotAbilityOptions(slot, abilitySelect);
    var imageCol = document.createElement('div');
    imageCol.className = 'dameke-partytype-slot-image-col';
    var imageHost = document.createElement('div');
    imageHost.className = 'dameke-partytype-slot-image';
    var typesHost = document.createElement('div');
    typesHost.className = 'dameke-search-detail-types';
    imageCol.appendChild(imageHost);
    imageCol.appendChild(typesHost);

    var pokemonLabel = document.createElement('label'); pokemonLabel.textContent = (index+1)+'体目';
    pokemonLabel.appendChild(pokemonSelect);
    var abilityLabel = document.createElement('label'); abilityLabel.textContent = '特性';
    abilityLabel.appendChild(abilitySelect);

    var fieldsCol = document.createElement('div'); fieldsCol.className = 'dameke-partytype-slot-fields';
    fieldsCol.appendChild(pokemonLabel);
    fieldsCol.appendChild(abilityLabel);
    row.appendChild(fieldsCol);
    row.appendChild(imageCol);

    function renderImage(){
      imageHost.innerHTML = '';
      typesHost.innerHTML = '';
      if(!slot.pokemon) return;
      var img = window.__damekeBuildPokemonImage ? window.__damekeBuildPokemonImage(slot.pokemon.name, function(){ imageHost.innerHTML=''; }) : null;
      if(img) imageHost.appendChild(img);
      typesHost.innerHTML = typeBadgesHtml(slot.pokemon.types);
    }

    pokemonSelect.addEventListener('change', function(){
      var id = pokemonSelect.value;
      slot.pokemon = id ? DATA.pokemons.find(function(p){ return p.id===id; }) : null;
      ensureSlotAbilityOptions(slot, abilitySelect);
      renderImage();
      renderResults();
    });
    abilitySelect.addEventListener('change', function(){
      slot.abilityName = abilitySelect.value || null;
      renderResults();
    });

    renderImage();
    return row;
  }

  function renderSlots(){
    var host = q('damekePartyTypeSlotsHost');
    host.innerHTML = '';
    for(var i=0;i<SLOT_COUNT;i++) host.appendChild(renderSlot(i));
    // attachSearchCombo looks its target up via getElementById, so it only works once each
    // select is actually in the document -- must run after every row is appended above, not
    // inside renderSlot() itself (which builds a detached row and returns it).
    if(window.__damekeAttachSearchCombo){
      for(var j=0;j<SLOT_COUNT;j++){
        window.__damekeAttachSearchCombo('damekePartyTypePokemon'+j);
        // 特性 stays a plain native select, per request -- only ポケモン gets the hiragana-search combo.
      }
    }
  }

  // ==================== 1体入れ替えによる改善候補 ====================
  // Reuses this same file's own computeTypeConsistency-backed consistency values and
  // CALC.computeTypeEffectiveness (identical ability handling as the 一貫度 grid above) --
  // no separate scoring formula or ability logic is introduced for this feature.

  function learnsetKeyFor(name){
    var m = String(name||'').match(/^(.+?)\(([^)]+)\)$/);
    return m ? (m[1] + '_' + m[2]) : name;
  }
  function hasChampionsEntry(p){
    var LS = window.DAMEKE_LEARNSETS;
    return !!(LS && LS.hasLearnset(learnsetKeyFor(p.name)));
  }
  // Candidate pool -- filterable via the two checkboxes (both default-checked, matching the
  // previous fixed scope exactly). Because the whole evaluation is recomputed from scratch on
  // every party or filter change (nothing here is incremental), a filter change safely produces
  // a fully re-ranked result rather than patching the previous one.
  function swapCandidatePool(){
    var finalEvoOnly = q('damekePartyTypeSwapFinalEvoOnly').checked;
    var championsOnly = q('damekePartyTypeSwapChampionsOnly').checked;
    return DATA.pokemons.filter(function(p){
      if(finalEvoOnly && p.canEvolve) return false;
      if(championsOnly && !hasChampionsEntry(p)) return false;
      return true;
    });
  }

  function weightedTop3(values){
    var sorted = values.slice().sort(function(a,b){ return b-a; });
    return (3*sorted[0] + 2*sorted[1] + sorted[2]) / 6;
  }
  // Same sub-quarter fold-in as computeTypeConsistency's own tier table, so two candidates that
  // are defensively identical in every game-relevant sense never split into separate groups over
  // float noise or an unlisted fractional resistance.
  function normalizedRateKey(rate){
    if(rate === 0) return '0';
    if(rate <= 0.25 + 1e-9) return '0.25';
    if(Math.abs(rate-0.5) < 1e-9) return '0.5';
    if(Math.abs(rate-1) < 1e-9) return '1';
    if(Math.abs(rate-2) < 1e-9) return '2';
    if(Math.abs(rate-4) < 1e-9) return '4';
    return 'x'+rate;
  }
  function defensiveProfileFor(pokemon, abilityName){
    return ALL_TYPES.map(function(t){ return CALC.computeTypeEffectiveness(pokemon.types, t, abilityName); });
  }
  // Two different type-relevant abilities (あついしぼう vs たいねつ, うなぎのぼり vs ふゆう, etc.)
  // must never collapse into the same displayed candidate just because they happen to produce
  // an identical numeric profile for this particular matchup -- they're still mechanically
  // distinct abilities, so the ability name (when it actually matters) is folded into the group
  // key itself. Abilities that don't affect type matchup at all are never shown anyway, so they
  // keep merging purely by profile, avoiding needless duplicate-looking entries.
  function profileKeyFor(profileArr, abilityName){
    var base = profileArr.map(normalizedRateKey).join('|');
    return CALC.isTypeRelevantAbility(abilityName) ? base + '::ability:' + abilityName : base;
  }

  // selectedSlots: the occupied slots (pokemon+abilityName), each carrying its own original
  // slot index. Returns { patterns, Hbefore, beforeConsistencies, cutoffRank, groups } or null
  // if fewer than 1 member is selected (nothing to evaluate against).
  function evaluateSwapCandidates(selectedSlotsWithIndex){
    var occupied = selectedSlotsWithIndex;
    var N = occupied.length;
    if(N < 1) return null;

    var beforeConsist = ALL_TYPES.map(function(t){
      var rates = occupied.map(function(m){ return CALC.computeTypeEffectiveness(m.pokemon.types, t, m.abilityName); });
      var r = CALC.computeTypeConsistency(rates);
      return r ? r.C : null;
    });
    var Hbefore = weightedTop3(beforeConsist);

    // Excludes not just the exact same Pokemon already in the party, but every other form of it
    // too (mega evolution, in-battle form changes like ロトム's appliances, and regional forms)
    // -- matched via either speciesKey or baseSpecies, since mega forms share the base's
    // speciesKey while regional forms share the base's baseSpecies instead.
    var excludedFamilyKeys = {};
    occupied.forEach(function(m){
      if(m.pokemon.speciesKey) excludedFamilyKeys['s:'+m.pokemon.speciesKey] = true;
      if(m.pokemon.baseSpecies) excludedFamilyKeys['b:'+m.pokemon.baseSpecies] = true;
    });
    var candidates = swapCandidatePool().filter(function(p){
      if(p.speciesKey && excludedFamilyKeys['s:'+p.speciesKey]) return false;
      if(p.baseSpecies && excludedFamilyKeys['b:'+p.baseSpecies]) return false;
      return true;
    });
    // Precomputed once per (candidate, ability) -- reused across every removal slot below,
    // since a candidate's own defensive profile never depends on which member it's replacing.
    var candidateProfiles = [];
    candidates.forEach(function(p){
      var abilities = (p.abilities && p.abilities.length) ? p.abilities : [null];
      abilities.forEach(function(abName){
        var profile = defensiveProfileFor(p, abName);
        candidateProfiles.push({ pokemon: p, abilityName: abName, profile: profile, key: profileKeyFor(profile, abName) });
      });
    });

    var patterns = [];
    var orderCounter = 0;
    for(var slotPos=0; slotPos<N; slotPos++){
      var removed = occupied[slotPos];
      var others = occupied.filter(function(_, i){ return i !== slotPos; });
      // Other members' per-type rates computed once per removal slot, reused across every
      // candidate tried in that slot.
      var otherRatesByType = ALL_TYPES.map(function(t){
        return others.map(function(m){ return CALC.computeTypeEffectiveness(m.pokemon.types, t, m.abilityName); });
      });
      candidateProfiles.forEach(function(cp){
        var consistArr = ALL_TYPES.map(function(t, ti){
          var rates = otherRatesByType[ti].concat([cp.profile[ti]]);
          var r = CALC.computeTypeConsistency(rates);
          return r ? r.C : null;
        });
        var sorted = consistArr.slice().sort(function(a,b){ return b-a; });
        var Hafter = (3*sorted[0] + 2*sorted[1] + sorted[2]) / 6;
        var overallAverage = consistArr.reduce(function(s,v){ return s+v; }, 0) / consistArr.length;
        var typesAtOrAbove80 = consistArr.filter(function(v){ return v >= 80; }).length;
        patterns.push({
          removedSlotIndex: removed.slotIndex,
          removedPokemonId: removed.pokemon.id,
          removedPokemonName: removed.pokemon.name,
          removedPokemonTypes: removed.pokemon.types,
          candidatePokemonId: cp.pokemon.id,
          candidatePokemonName: cp.pokemon.name,
          candidatePokemonTypes: cp.pokemon.types,
          candidateAbilityName: cp.abilityName,
          defensiveProfileKey: cp.key,
          consistencies: ALL_TYPES.map(function(t,i){ return { type:t, consistency: consistArr[i] }; }),
          maxConsistency: sorted[0],
          weightedTop3: Hafter,
          overallAverage: overallAverage,
          typesAtOrAbove80: typesAtOrAbove80,
          beforeWeightedTop3: Hbefore,
          improvementDelta: Hbefore - Hafter,
          otherMembers: others,
          _orderIndex: orderCounter++
        });
      });
    }

    // Initial ranking -- six criteria, exactly per spec section 8.
    patterns.sort(function(a,b){
      if(a.weightedTop3 !== b.weightedTop3) return a.weightedTop3 - b.weightedTop3;
      if(a.maxConsistency !== b.maxConsistency) return a.maxConsistency - b.maxConsistency;
      if(a.typesAtOrAbove80 !== b.typesAtOrAbove80) return a.typesAtOrAbove80 - b.typesAtOrAbove80;
      if(a.overallAverage !== b.overallAverage) return a.overallAverage - b.overallAverage;
      if(a.improvementDelta !== b.improvementDelta) return b.improvementDelta - a.improvementDelta;
      return a._orderIndex - b._orderIndex;
    });
    patterns.forEach(function(p, i){ p.initialRank = i+1; });

    // Compression to top-5 distinct defensive-profile groups -- reads only the already-ranked
    // "patterns" array; never re-evaluates or re-searches beyond it (spec section 10).
    // Patterns that don't genuinely improve anything (Delta <= 0 -- same-type swaps that barely
    // move the needle, or outright worse trades) are skipped entirely here: they never start a
    // new group, and never get added as an alternate 入れ替え先 within one either. This reuses
    // the already-computed improvementDelta rather than introducing a new metric.
    var groups = [], groupByKey = {}, cutoffRank = patterns.length ? patterns[patterns.length-1].initialRank : 0;
    for(var i=0;i<patterns.length;i++){
      var p = patterns[i];
      if(p.improvementDelta <= 0) continue;
      var g = groupByKey[p.defensiveProfileKey];
      if(!g){
        if(groups.length >= 5){ cutoffRank = patterns[i-1].initialRank; break; }
        g = { defensiveProfileKey: p.defensiveProfileKey, replacementOptions: [], candidateVariants: [], removedVariants: [] };
        groupByKey[p.defensiveProfileKey] = g;
        groups.push(g);
      }
      // Multiple type-irrelevant-ability variants of the same candidate produce byte-identical
      // outcomes when removing the same slot (same profile, same other members) -- only the
      // first (best-ranked) pattern for a given removed Pokemon is kept as a selectable option,
      // so the 入れ替え先 list never shows the same name several times over.
      if(!g.replacementOptions.some(function(ro){ return ro.removedPokemonId === p.removedPokemonId; })){
        g.replacementOptions.push(p);
      }
      // An ability that doesn't affect type matchup at all shouldn't be shown as if it mattered
      // for this defensive profile -- drop the name and dedupe by Pokemon alone in that case, so
      // three type-irrelevant abilities on the same species don't render as three "variants".
      var relevant = CALC.isTypeRelevantAbility(p.candidateAbilityName);
      var shownAbility = relevant ? p.candidateAbilityName : null;
      if(!g.candidateVariants.some(function(v){ return v.pokemonId===p.candidatePokemonId && v.abilityName===shownAbility; })){
        g.candidateVariants.push({ pokemonId: p.candidatePokemonId, pokemonName: p.candidatePokemonName, abilityName: shownAbility, types: p.candidatePokemonTypes });
      }
      if(!g.removedVariants.some(function(v){ return v.pokemonId===p.removedPokemonId; })){
        g.removedVariants.push({ pokemonId: p.removedPokemonId, pokemonName: p.removedPokemonName, types: p.removedPokemonTypes });
      }
    }
    groups.forEach(function(g){ g.representativeResult = g.replacementOptions[0]; g.selectedReplacementIndex = 0; });

    return { patterns: patterns, Hbefore: Hbefore, beforeConsistencies: beforeConsist, groups: groups, cutoffRank: cutoffRank };
  }

  var lastSwapEval = null; // cached full evaluation -- only rebuilt when the party itself changes

  function buildPortraitChip(name){
    var chip = document.createElement('div'); chip.className = 'dameke-partytype-swap-portrait';
    var imgHost = document.createElement('div'); imgHost.className = 'dameke-partytype-swap-portrait-img';
    var img = window.__damekeBuildPokemonImage ? window.__damekeBuildPokemonImage(name, function(){ imgHost.innerHTML=''; }) : null;
    if(img) imgHost.appendChild(img);
    var nameEl = document.createElement('div'); nameEl.className = 'dameke-partytype-swap-portrait-name'; nameEl.textContent = name;
    chip.appendChild(imgHost); chip.appendChild(nameEl);
    return chip;
  }
  function buildInOutBox(title, cls, entries){
    var box = document.createElement('div'); box.className = 'dameke-partytype-swap-inout-box ' + cls;
    var titleEl = document.createElement('div'); titleEl.className = 'dameke-partytype-swap-inout-title'; titleEl.textContent = title;
    box.appendChild(titleEl);
    var list = document.createElement('div'); list.className = 'dameke-partytype-swap-inout-list';
    entries.forEach(function(e){
      list.appendChild(buildPortraitChip(e.pokemonName));
    });
    box.appendChild(list);
    return box;
  }

  // consistencyPairs: the 一貫度 grid's own [{type, consistency}], reused for its "before" data.
  // Renders each type's CHANGE (before - after, matching the same positive=improved sign
  // convention as H's own Delta) as a percentage-point figure, since the previously shown
  // "+X pt" summary was based on the ranking-only H statistic and wasn't self-explanatory.
  function renderConsistencyDeltaGrid(host, beforeValues, afterPairs){
    host.innerHTML = '';
    afterPairs.forEach(function(pair, i){
      var before = beforeValues[i];
      var after = pair.consistency;
      var cell = document.createElement('div');
      cell.className = 'dameke-typecell ' + typeColorClass(pair.type);
      var valueClass, valueText;
      if(before == null || after == null){
        valueClass = 'dameke-partytype-tier-unrated'; valueText = '未評価';
      } else {
        var delta = Math.round((before - after) * 100) / 100;
        valueText = (delta > 0 ? '+' : '') + delta.toFixed(1) + '%';
        valueClass = delta > 0.05 ? 'dameke-partytype-delta-improve' : (delta < -0.05 ? 'dameke-partytype-delta-worsen' : 'dameke-partytype-delta-neutral');
      }
      cell.innerHTML = '<span class="dameke-typecell-name">'+pair.type+'</span><span class="dameke-typecell-value '+valueClass+'">'+valueText+'</span>';
      host.appendChild(cell);
    });
  }

  // Renders one group's expanded body (交換元 select + resulting per-type deltas) purely from
  // the already-computed replacementOptions/beforeConsistencies -- never recomputes anything.
  function renderSwapCardBody(bodyEl, group, beforeValues){
    bodyEl.innerHTML = '';
    var result = group.replacementOptions[group.selectedReplacementIndex];

    if(group.replacementOptions.length > 1){
      var replRow = document.createElement('div'); replRow.className = 'dameke-partytype-swap-replacement-row';
      var label = document.createElement('label'); label.textContent = '入れ替え先';
      var select = document.createElement('select');
      group.replacementOptions.forEach(function(ro, i){
        var op = document.createElement('option'); op.value = i; op.textContent = ro.removedPokemonName;
        select.appendChild(op);
      });
      select.value = group.selectedReplacementIndex;
      select.addEventListener('change', function(){
        group.selectedReplacementIndex = parseInt(select.value, 10);
        renderSwapCardBody(bodyEl, group, beforeValues);
      });
      replRow.appendChild(label);
      replRow.appendChild(select);
      bodyEl.appendChild(replRow);
    }

    var partyList = document.createElement('div'); partyList.className = 'dameke-partytype-swap-party-list';
    var newMember = { name: result.candidatePokemonName, isNew: true };
    var afterMembers = result.otherMembers.map(function(m){ return { name: m.pokemon.name, isNew: false }; });
    var displayMembers = afterMembers.slice();
    displayMembers.splice(Math.min(result.removedSlotIndex, displayMembers.length), 0, newMember);
    displayMembers.forEach(function(m){
      var chip = document.createElement('span');
      chip.className = 'dameke-partytype-swap-member-chip' + (m.isNew ? ' dameke-partytype-swap-member-new' : '');
      chip.textContent = m.name;
      partyList.appendChild(chip);
    });
    bodyEl.appendChild(partyList);

    var gridHost = document.createElement('div'); gridHost.className = 'dameke-partytype-result-host';
    renderConsistencyDeltaGrid(gridHost, beforeValues, result.consistencies);
    bodyEl.appendChild(gridHost);
  }

  function renderSwapCandidates(selectedSlotsWithIndex){
    var headerHost = q('damekePartyTypeSwapHeader');
    var host = q('damekePartyTypeSwapHost');
    if(!selectedSlotsWithIndex || !selectedSlotsWithIndex.length){
      headerHost.textContent = '';
      host.innerHTML = '';
      lastSwapEval = null;
      return;
    }
    var evalResult = evaluateSwapCandidates(selectedSlotsWithIndex);
    lastSwapEval = evalResult;
    headerHost.textContent = '候補 ' + evalResult.groups.length + '件';
    host.innerHTML = '';
    if(!evalResult.groups.length){
      host.innerHTML = '<div class="dameke-adjust-summary-note">現在のパーティは、タイプ相性評価上、1体交換ではこれ以上改善が見込めません。</div>';
      return;
    }
    evalResult.groups.forEach(function(group, i){
      var card = document.createElement('div');
      card.className = 'dameke-partytype-swap-card';
      var rankRow = document.createElement('div'); rankRow.className = 'dameke-partytype-swap-rank-row';
      var rankEl = document.createElement('span'); rankEl.className = 'dameke-partytype-swap-rank'; rankEl.textContent = (i+1)+'位';
      rankRow.appendChild(rankEl);
      var rankTypesEl = document.createElement('div'); rankTypesEl.className = 'dameke-search-detail-types';
      rankTypesEl.innerHTML = typeBadgesHtml(group.candidateVariants[0].types);
      rankRow.appendChild(rankTypesEl);
      var namedAbilityVariant = group.candidateVariants.filter(function(v){ return v.abilityName; })[0];
      if(namedAbilityVariant){
        var abilityEl = document.createElement('span'); abilityEl.className = 'dameke-partytype-swap-rank-ability';
        abilityEl.textContent = '（'+namedAbilityVariant.abilityName+'）';
        rankRow.appendChild(abilityEl);
      }
      card.appendChild(rankRow);

      var inOutRow = document.createElement('div'); inOutRow.className = 'dameke-partytype-swap-inout-row';
      inOutRow.appendChild(buildInOutBox('in', 'dameke-partytype-swap-in', group.candidateVariants));
      inOutRow.appendChild(buildInOutBox('out', 'dameke-partytype-swap-out', group.removedVariants));
      card.appendChild(inOutRow);

      var details = document.createElement('details'); details.className = 'dameke-partytype-swap-details';
      var summary = document.createElement('summary'); summary.textContent = '詳細';
      details.appendChild(summary);
      var body = document.createElement('div'); body.className = 'dameke-partytype-swap-body';
      details.appendChild(body);
      details.addEventListener('toggle', function(){
        if(details.open && !body.childElementCount) renderSwapCardBody(body, group, evalResult.beforeConsistencies);
      });
      card.appendChild(details);

      host.appendChild(card);
    });
  }

  // consistencyPairs: [{type, consistency}] in ALL_TYPES order, consistency possibly null.
  // Shared by the main 一貫度 grid and the swap-candidate detail view, per spec section 14's
  // requirement to reuse the exact same display rather than building a second one.
  // Tiers centered on the all-neutral-team baseline (50): far above/below it is where a type is
  // genuinely a team-wide threat or a team-wide non-issue.
  function consistencyColorClass(C){
    if(C >= 90) return 'dameke-partytype-tier-veryhigh';
    if(C >= 65) return 'dameke-partytype-tier-high';
    if(C >= 35) return 'dameke-partytype-tier-mid';
    if(C >= 10) return 'dameke-partytype-tier-low';
    return 'dameke-partytype-tier-verylow';
  }

  function renderConsistencyGrid(host, consistencyPairs){
    host.innerHTML = '';
    consistencyPairs.forEach(function(pair){
      var cell = document.createElement('div');
      cell.className = 'dameke-typecell ' + typeColorClass(pair.type);
      var valueClass = pair.consistency == null ? 'dameke-partytype-tier-unrated' : consistencyColorClass(pair.consistency);
      var valueText = pair.consistency == null ? '未評価' : (Math.round(pair.consistency * 100) / 100).toFixed(2) + '%';
      cell.innerHTML = '<span class="dameke-typecell-name">'+pair.type+'</span><span class="dameke-typecell-value '+valueClass+'">'+valueText+'</span>';
      host.appendChild(cell);
    });
  }

  function renderResults(){
    var headerHost = q('damekePartyTypeResultHeader');
    var host = q('damekePartyTypeResultHost');
    var selectedSlots = slots
      .map(function(s, i){ return { pokemon: s.pokemon, abilityName: s.abilityName, slotIndex: i }; })
      .filter(function(s){ return s.pokemon; });
    headerHost.textContent = '';
    if(!selectedSlots.length){
      host.innerHTML = '<div class="dameke-adjust-summary-note">ポケモンを1体以上選択してください。</div>';
      renderSwapCandidates(null);
      return;
    }
    var consistencyPairs = ALL_TYPES.map(function(t){
      var rates = selectedSlots.map(function(s){ return CALC.computeTypeEffectiveness(s.pokemon.types, t, s.abilityName); });
      var result = CALC.computeTypeConsistency(rates);
      return { type: t, consistency: result ? result.C : null };
    });
    renderConsistencyGrid(host, consistencyPairs);
    renderSwapCandidates(selectedSlots);
  }

  function closePartyPicker(){
    var host = q('damekePartyTypePickerHost');
    host.hidden = true;
    host.innerHTML = '';
  }
  function openPartyPicker(){
    var host = q('damekePartyTypePickerHost');
    var list = window.__damekeLoadPartyList ? window.__damekeLoadPartyList() : [];
    host.innerHTML = '';
    var banner = document.createElement('div');
    banner.className = 'dameke-pokemon-create-banner';
    var text = document.createElement('span');
    text.textContent = list.length ? '呼び出すパーティのカードを下から選んでください。' : 'パーティ管理に保存されたパーティがまだありません。';
    banner.appendChild(text);
    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button'; cancelBtn.className = 'dameke-pokemon-edit-cancel'; cancelBtn.textContent = 'キャンセル';
    cancelBtn.addEventListener('click', closePartyPicker);
    banner.appendChild(cancelBtn);
    host.appendChild(banner);
    if(window.__damekeBuildPartyCard){
      list.forEach(function(party){
        host.appendChild(window.__damekeBuildPartyCard(party, function(members){
          applyPickedParty(members);
          closePartyPicker();
        }));
      });
    }
    host.hidden = false;
  }
  // members: array of up to 6 { pokemonId, abilityId } | null, one per party slot (already
  // resolved from ポケモン管理 entries by buildPartyCard's own pick callback).
  function applyPickedParty(members){
    for(var i=0;i<SLOT_COUNT;i++){
      var m = (members||[])[i];
      var pokemon = m && m.pokemonId ? DATA.pokemons.find(function(p){ return p.id===m.pokemonId; }) : null;
      var abilityValid = m && m.abilityId && m.abilityId !== 'none' && m.abilityId !== 'なし';
      slots[i] = { pokemon: pokemon || null, abilityName: (pokemon && abilityValid) ? m.abilityId : null };
    }
    renderSlots();
    renderResults();
  }

  function init(){
    renderSlots();
    renderResults();
    q('damekePartyTypeLoadBtn').addEventListener('click', openPartyPicker);
    // These only affect the swap-candidate pool, not the 一貫度 grid itself -- re-run just the
    // swap evaluation (which already recomputes fully from scratch) rather than the whole panel.
    var rerunSwapOnly = function(){
      var selectedSlots = slots
        .map(function(s, i){ return { pokemon: s.pokemon, abilityName: s.abilityName, slotIndex: i }; })
        .filter(function(s){ return s.pokemon; });
      renderSwapCandidates(selectedSlots.length ? selectedSlots : null);
    };
    q('damekePartyTypeSwapFinalEvoOnly').addEventListener('change', rerunSwapOnly);
    q('damekePartyTypeSwapChampionsOnly').addEventListener('change', rerunSwapOnly);
  }
  window.__damekeRenderPartyTypePanel = function(){
    if(!q('damekePartyTypeSlotsHost').childElementCount) init();
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
