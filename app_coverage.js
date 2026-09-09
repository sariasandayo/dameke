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
  // Each slot is just the move id, or '' if left to the automatic maximizer. A non-empty slot
  // IS the "fixed" state now -- typing a move name fixes it; clearing it frees it back up. There
  // is no separate 固定 checkbox or 範囲最大化 button anymore: every change (Pokemon, a move
  // slot, or any 詳細条件設定 field) immediately recomputes the full output live.
  var moveSlots = ['', '', '', ''];
  // The 4 moves actually shown in 出力 last time computeAndRenderOutput ran (manual picks plus
  // whatever the auto-maximizer filled the empty slots with) -- used by 保存 to know what to
  // save. null only when there's genuinely nothing to show (e.g. free slots but zero candidates).
  var lastComputedMoveIds = null;
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
  function computeAndRenderOutput(){
    var movesHost = q('damekeCoverageMovesHost');
    var statsHost = q('damekeCoverageStatsHost');
    movesHost.innerHTML = '';
    statsHost.innerHTML = '';
    lastComputedMoveIds = null;
    if(!selectedPokemon){
      statsHost.innerHTML = '<div class="dameke-adjust-summary-note">ポケモンを選択してください。</div>';
      return;
    }
    var conditions = readConditions();
    var categoryPhysical = q('damekeCoverageCategoryPhysical').checked;
    var categorySpecial = q('damekeCoverageCategorySpecial').checked;
    var allowedCategories = categoryPhysical ? ['物理'] : (categorySpecial ? ['特殊'] : ['物理','特殊']);
    var excludeNormal = q('damekeCoverageExcludeNormal').checked;

    var fixedMoves = moveSlots.map(function(id){ return id ? findMoveById(id) : null; }).filter(Boolean);
    var freeSlotCount = moveSlots.filter(function(id){ return !id; }).length;
    var finalMoves;

    if(freeSlotCount === 0){
      // Every slot was typed in manually -- nothing to search for, just use exactly those 4.
      finalMoves = fixedMoves;
    } else {
      var LS = window.DAMEKE_LEARNSETS;
      var key = learnsetKeyFor(selectedPokemon.name);
      if(!LS || !LS.hasLearnset(key)){
        finalMoves = fixedMoves; // no learnset data -- can't auto-fill the empty slots
      } else {
        var learned = LS.getLearnset(key);
        var learnableMoves = DATA.moves.filter(function(m){
          return isEligibleForCoverage(m) && learned.indexOf(m.name)>=0 && allowedCategories.indexOf(m.category)>=0;
        });
        // The ノーマル技除外 check happens AFTER type resolution (skin abilities etc), so a
        // Normal-type move that a skin ability turns into something else is no longer excluded,
        // while a move that's still Normal after every condition is applied still gets filtered.
        var resolvedPool = learnableMoves.map(function(m){
          return { move: m, resolvedType: resolveEffectiveType(m, conditions) };
        }).filter(function(rm){ return !(excludeNormal && rm.resolvedType === 'ノーマル'); });
        var SPECIAL_EFFECT_TAGS = ['freezeDry', 'flyingPress', 'thousandArrows'];
        // freezeDry と thousandArrows は、同じ解決後タイプの通常技を全ての対面で厳密に上回る
        // (もしくは同等)の技であるため、その通常技を候補に残すと「冗長なだけの2本目」として
        // 一緒に選ばれてしまう(フリーズドライ+ふぶきが両方出る等)。よってこれらのタグを持つ技
        // がある場合は、同タイプの通常枠(plain bucket)を丸ごと差し替える(通常技は候補から外す)。
        // flyingPress は複合相性により通常技より劣る対面もあり得るため、この扱いはしない(引き
        // 続き通常枠とは別の専用枠として両方を候補に残し、探索に判断させる)。
        var DOMINANT_TAGS = ['freezeDry', 'thousandArrows'];
        function specialTagOf(move){
          return SPECIAL_EFFECT_TAGS.filter(function(t){ return (move.tags||[]).indexOf(t) >= 0; })[0] || null;
        }
        var dominantTypesPresent = {};
        resolvedPool.forEach(function(rm){
          var tag = specialTagOf(rm.move);
          if(tag && DOMINANT_TAGS.indexOf(tag) >= 0) dominantTypesPresent[rm.resolvedType] = true;
        });
        function bucketKeyFor(rm){
          var tag = specialTagOf(rm.move);
          if(tag) return 'special:'+tag; // both dominant (freezeDry/thousandArrows) and non-
          // dominant (flyingPress) special-tag moves always get their own bucket, on top of the
          // plain one. Plain (untagged) move of a type a dominant special move already covers is
          // skipped entirely -- it can never add anything the dominant move doesn't provide.
          if(dominantTypesPresent[rm.resolvedType]) return null;
          return rm.resolvedType;
        }
        var byType = {};
        resolvedPool.forEach(function(rm){
          var bkey = bucketKeyFor(rm);
          if(bkey === null) return;
          if(!byType[bkey] || (rm.move.power||0) > (byType[bkey].move.power||0)) byType[bkey] = rm;
        });
        var fixedMoveIdSet = {};
        fixedMoves.forEach(function(m){ fixedMoveIdSet[m.id] = true; });
        var pool = Object.keys(byType).map(function(t){ return byType[t].move; }).filter(function(m){ return !fixedMoveIdSet[m.id]; });

        if(!pool.length){
          // Genuinely nothing left to offer for the empty slots (e.g. ノーマルスキン +
          // ノーマル技除外 leaves almost nothing) -- a normal, expected outcome, not an error.
          finalMoves = fixedMoves;
          if(!finalMoves.length){
            statsHost.innerHTML = '<div class="dameke-adjust-summary-note">該当する技がありません。</div>';
            return;
          }
        } else {
          var champions = championsPool();
          // Precompute each candidate move's rate against every defender/ability once, reused
          // across every combination tried below (same optimization pattern as パーティタイプ
          // 評価's swap search).
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
              fixedMoves.filter(isEligibleForCoverage).forEach(function(m){ var r = effectiveRateFor(d.types, ab, m, conditions); if(r>best) best=r; });
              return best;
            });
          });

          function evaluateCombo(indices){
            var neutralOrMore = 0, weakOrMore = 0;
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
              if(worstForAttacker >= 1) neutralOrMore++;
              if(worstForAttacker > 1) weakOrMore++;
            }
            // Tie-break 3: how many of the resulting 4 moves are same-type as the attacking
            // Pokemon itself (STAB) -- counts fixed moves too, since they're part of the final 4.
            var stabCount = 0;
            var pokemonTypes = (selectedPokemon && selectedPokemon.types) || [];
            indices.forEach(function(i){ if(pokemonTypes.indexOf(resolveEffectiveType(pool[i], conditions)) >= 0) stabCount++; });
            fixedMoves.forEach(function(m){ if(pokemonTypes.indexOf(resolveEffectiveType(m, conditions)) >= 0) stabCount++; });
            return { neutralOrMore: neutralOrMore, weakOrMore: weakOrMore, stabCount: stabCount };
          }
          function isBetter(a, b){
            // Tie-break order per request: 等倍以上 -> 弱点以上 -> 自タイプ一致数 -> どれでもよい
            if(a.neutralOrMore !== b.neutralOrMore) return a.neutralOrMore > b.neutralOrMore;
            if(a.weakOrMore !== b.weakOrMore) return a.weakOrMore > b.weakOrMore;
            return a.stabCount > b.stabCount;
          }

          var poolIndices = pool.map(function(_,i){ return i; });
          var k = Math.min(freeSlotCount, poolIndices.length);
          var combos = k > 0 ? combinations(poolIndices, k) : [[]];
          var best = null;
          combos.forEach(function(combo){
            var evalResult = evaluateCombo(combo);
            if(!best || isBetter(evalResult, best.evalResult)) best = { combo: combo, evalResult: evalResult };
          });
          var chosenMoves = best ? best.combo.map(function(i){ return pool[i]; }) : [];
          finalMoves = fixedMoves.concat(chosenMoves);
        }
      }
    }

    finalMoves.sort(function(a,b){
      return ALL_TYPES.indexOf(resolveEffectiveType(a, conditions)) - ALL_TYPES.indexOf(resolveEffectiveType(b, conditions));
    });
    lastComputedMoveIds = finalMoves.map(function(m){ return m.id; });

    finalMoves.forEach(function(m){
      var resolvedType = resolveEffectiveType(m, conditions);
      var cell = document.createElement('div'); cell.className = 'dameke-typecell ' + typeColorClass(resolvedType);
      cell.innerHTML = '<span class="dameke-typecell-name">'+m.name+'</span>';
      movesHost.appendChild(cell);
    });
    for(var pad=finalMoves.length; pad<4; pad++){
      var emptyCell = document.createElement('div'); emptyCell.className = 'dameke-typecell ' + typeColorClass('なし');
      emptyCell.innerHTML = '<span class="dameke-typecell-name">（未選択）</span>';
      movesHost.appendChild(emptyCell);
    }

    var selectedMoves = finalMoves.filter(isEligibleForCoverage);
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
    moveSlots.forEach(function(moveId, i){
      var cell = document.createElement('div'); cell.className = 'dameke-coverage-move-slot';
      var label = document.createElement('label'); label.className = 'dameke-coverage-move-slot-label'; label.textContent = '技'+(i+1);
      var select = document.createElement('select'); select.id = 'damekeCoverageMove'+i;
      fillSelect(select, learnableMoves, '指定なし');
      select.value = moveId;
      select.addEventListener('change', function(){
        moveSlots[i] = select.value;
        computeAndRenderOutput();
      });
      label.appendChild(select);
      cell.appendChild(label);
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
      moveSlots[i] = (mid && mid !== 'none') ? mid : '';
    }
    renderAll();
    if(entry.abilityId && entry.abilityId !== 'none' && entry.abilityId !== 'なし'){
      var abilitySelect = q('damekeCoverageAbility');
      abilitySelect.value = entry.abilityId;
      if(abilitySelect._v082hRefreshOptions) abilitySelect._v082hRefreshOptions();
      computeAndRenderOutput();
    }
  }

  // ==================== Save to ポケモン管理 ====================
  function currentMoveIds(){
    var ids = lastComputedMoveIds || moveSlots;
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
    computeAndRenderOutput();
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
      moveSlots = ['', '', '', ''];
      renderAll();
    });
    q('damekeCoverageLoadBtn').addEventListener('click', openPicker);
    q('damekeCoverageSaveBtn').addEventListener('click', doSave);
    // Every condition that could change the automatic result -- category filters, ノーマル技
    // 除外, ability, or any 詳細条件設定 field -- recomputes and re-renders output immediately.
    // There is no 範囲最大化 button or 固定 checkbox: typing a move into a slot IS fixing it,
    // and clearing a slot frees it back up for the automatic search.
    var physicalCb = q('damekeCoverageCategoryPhysical');
    var specialCb = q('damekeCoverageCategorySpecial');
    physicalCb.addEventListener('change', function(){ if(physicalCb.checked) specialCb.checked = false; computeAndRenderOutput(); });
    specialCb.addEventListener('change', function(){ if(specialCb.checked) physicalCb.checked = false; computeAndRenderOutput(); });
    q('damekeCoverageExcludeNormal').addEventListener('change', computeAndRenderOutput);
    q('damekeCoverageAbility').addEventListener('change', computeAndRenderOutput);
    q('damekeCoverageWeather').addEventListener('change', computeAndRenderOutput);
    q('damekeCoverageField').addEventListener('change', computeAndRenderOutput);
    q('damekeCoverageItem').addEventListener('change', computeAndRenderOutput);
    teraSelect.addEventListener('change', function(){ updateTeraTypeColor(); computeAndRenderOutput(); });

    renderAll();
  }
  window.__damekeRenderCoveragePanel = function(){
    if(!q('damekeCoveragePokemon').options.length) init();
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
