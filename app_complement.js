// v1.6.0 補完ポケモン出力
// For an input Pokemon+ability, ranks every candidate Pokemon by how well it complements the
// input's own type weaknesses (タイプ補完度), using the shared window.DAMEKE_CALC.
// computeAllTypeEffectiveness / computeComplementScore functions so the scoring logic itself
// stays identical to whatever the future party-level evaluation feature also uses.
(function(){
  'use strict';
  function q(id){ return document.getElementById(id); }
  var DATA = window.DAMEKE_DATA;
  var CALC = window.DAMEKE_CALC;

  var ALL_TYPES = CALC.__typeEffectivenessAllTypes || ['ノーマル','ほのお','みず','でんき','くさ','こおり','かくとう','どく','じめん','ひこう','エスパー','むし','いわ','ゴースト','ドラゴン','あく','はがね','フェアリー'];
  function matchupClassFor(rate){ return window.DAMEKE_COMMON.matchupClassFor(rate); }
  function typeColorClass(t){ return window.DAMEKE_COMMON.typeColorClass(t); }
  function typeBadgesHtml(types){ return window.DAMEKE_COMMON.typeBadgesHtml(types); }

  function fillSelect(select, items, placeholder){ return window.DAMEKE_COMMON.fillSelect(select, items, placeholder); }

  function hasChampionsEntry(p){ return window.DAMEKE_COMMON.hasChampionsEntry(p); }

  var selectedPokemon = null;
  var lastAbilityPopulatedForId = undefined;

  // Same "特性1 by default, keep an existing valid pick" convention used across this app's other
  // tools -- "なし" is excluded entirely (D.abilities carries it as a literal entry, but it's
  // never a real Pokemon's actual ability).
  function ensureAbilityOptions(pokemon){
    var key = pokemon ? pokemon.id : null;
    if(lastAbilityPopulatedForId === key) return;
    lastAbilityPopulatedForId = key;
    var select = q('damekeComplementAbility');
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

  // For a candidate, the ability that gives the best possible complement score is used -- this
  // represents the best realistic version of that species as a teammate, since a player would
  // simply pick whichever of its abilities actually helps. Also tracks whether that ability
  // actually changed anything versus no ability at all, so the UI can note it only when it
  // genuinely mattered (not for every candidate that merely has an ability).
  function bestScoreForCandidate(inputRates, candidate){
    var baselineRates = CALC.computeAllTypeEffectiveness(candidate.types, null);
    var baseline = CALC.computeComplementScore(inputRates, baselineRates);
    var abilities = (candidate.abilities && candidate.abilities.length) ? candidate.abilities : [];
    var best = Object.assign({ abilityName: null }, baseline);
    abilities.forEach(function(abName){
      var rates = CALC.computeAllTypeEffectiveness(candidate.types, abName);
      var score = CALC.computeComplementScore(inputRates, rates);
      if(score.S > best.S || (score.S === best.S && score.rawScore > best.rawScore)){
        best = Object.assign({ abilityName: abName }, score);
      }
    });
    best.abilityMattered = best.abilityName != null && best.S !== baseline.S;
    return best;
  }

  function computeResults(){
    if(!selectedPokemon) return [];
    var abilitySelect = q('damekeComplementAbility');
    var abilityName = abilitySelect.value || null;
    var inputRates = CALC.computeAllTypeEffectiveness(selectedPokemon.types, abilityName);
    var finalEvoOnly = q('damekeComplementFinalEvoOnly').checked;
    var championsOnly = q('damekeComplementChampionsOnly').checked;

    var candidates = DATA.pokemons.filter(function(p){
      if(finalEvoOnly && p.canEvolve) return false;
      if(p.id === selectedPokemon.id) return false; // recommending the input itself isn't useful
      if(championsOnly && !hasChampionsEntry(p)) return false;
      return true;
    });

    var scored = candidates.map(function(p){
      var score = bestScoreForCandidate(inputRates, p);
      return { pokemon: p, S: score.S, rawScore: score.rawScore, abilityName: score.abilityName, abilityMattered: score.abilityMattered };
    });
    // Ranking must match S order exactly; rawScore only matters as an (effectively redundant,
    // given S/rawScore are monotonically related for a fixed input) tiebreak, per spec.
    scored.sort(function(a,b){ return (b.S - a.S) || (b.rawScore - a.rawScore); });
    return scored.slice(0, 30);
  }

  function renderResults(){
    var headerHost = q('damekeComplementResultHeader');
    var host = q('damekeComplementResultHost');
    if(!selectedPokemon){
      headerHost.textContent = '';
      host.innerHTML = '<div class="dameke-adjust-summary-note">ポケモンを選択してください。</div>';
      return;
    }
    var results = computeResults();
    headerHost.textContent = '補完度 上位' + results.length + '件';
    host.innerHTML = '';
    results.forEach(function(r, i){
      var row = document.createElement('div');
      row.className = 'dameke-complement-result-row';
      var rankEl = document.createElement('div'); rankEl.className='dameke-complement-rank'; rankEl.textContent = (i+1);
      var imgHost = document.createElement('div'); imgHost.className='dameke-complement-thumb';
      var img = window.__damekeBuildPokemonImage ? window.__damekeBuildPokemonImage(r.pokemon.name, function(){ imgHost.classList.add('dameke-search-thumb-missing'); }) : null;
      if(img) imgHost.appendChild(img); else imgHost.classList.add('dameke-search-thumb-missing');
      var infoEl = document.createElement('div'); infoEl.className='dameke-complement-info';
      infoEl.innerHTML = '<div class="dameke-complement-name">'+r.pokemon.name+'</div>'
        + '<div class="dameke-complement-types">'+typeBadgesHtml(r.pokemon.types)+'</div>'
        + (r.abilityMattered ? '<div class="dameke-complement-ability-note">'+r.abilityName+'</div>' : '');
      var scoreEl = document.createElement('div'); scoreEl.className='dameke-complement-score';
      scoreEl.textContent = (Math.round(r.rawScore * 100) / 100).toFixed(2);
      row.appendChild(rankEl); row.appendChild(imgHost); row.appendChild(infoEl); row.appendChild(scoreEl);
      host.appendChild(row);
    });
  }

  function renderInputTypes(){
    var host = q('damekeComplementInputTypes');
    host.innerHTML = selectedPokemon ? typeBadgesHtml(selectedPokemon.types) : '';
  }

  function renderTypeMatchup(){
    var host = q('damekeComplementTypeMatchupHost');
    host.innerHTML = '';
    if(!selectedPokemon) return;
    var abilityName = q('damekeComplementAbility').value || null;
    var matchup = CALC.computeAllTypeEffectiveness(selectedPokemon.types, abilityName);
    ALL_TYPES.forEach(function(t){
      var rate = matchup[t];
      var cell = document.createElement('div');
      cell.className = 'dameke-typecell ' + typeColorClass(t);
      cell.innerHTML = '<span class="dameke-typecell-name">'+t+'</span><span class="dameke-typecell-value '+matchupClassFor(rate)+'">×'+(rate===0?'0':rate)+'</span>';
      host.appendChild(cell);
    });
  }

  function renderImage(){
    var host = q('damekeComplementImageHost');
    host.innerHTML = '';
    if(!selectedPokemon) return;
    var img = window.__damekeBuildPokemonImage ? window.__damekeBuildPokemonImage(selectedPokemon.name, function(){ host.innerHTML=''; }) : null;
    if(img) host.appendChild(img);
  }

  function renderAll(){
    ensureAbilityOptions(selectedPokemon);
    renderImage();
    renderInputTypes();
    renderTypeMatchup();
    renderResults();
  }

  function closePicker(){
    var host = q('damekeComplementPickerHost');
    host.hidden = true;
    host.innerHTML = '';
  }
  function openPicker(){
    var host = q('damekeComplementPickerHost');
    var list = window.__damekeLoadPokemonList ? window.__damekeLoadPokemonList() : [];
    host.innerHTML = '';
    var banner = document.createElement('div');
    banner.className = 'dameke-pokemon-create-banner';
    var text = document.createElement('span');
    text.textContent = list.length ? '呼び出すポケモンのカードを下から選んでください。' : 'ポケモン管理に保存されたポケモンがまだありません。';
    banner.appendChild(text);
    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button'; cancelBtn.className = 'dameke-pokemon-edit-cancel'; cancelBtn.textContent = 'キャンセル';
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
    var pokemonSelect = q('damekeComplementPokemon');
    pokemonSelect.value = entry.pokemonId;
    if(pokemonSelect._v082hRefreshOptions) pokemonSelect._v082hRefreshOptions();
    selectedPokemon = DATA.pokemons.find(function(p){ return p.id === entry.pokemonId; }) || null;
    ensureAbilityOptions(selectedPokemon);
    var abilitySelect = q('damekeComplementAbility');
    if(entry.abilityId && entry.abilityId !== 'none' && entry.abilityId !== 'なし'){
      abilitySelect.value = entry.abilityId;
      if(abilitySelect._v082hRefreshOptions) abilitySelect._v082hRefreshOptions();
    }
    renderAll();
  }

  function init(){
    var pokemonSelect = q('damekeComplementPokemon');
    fillSelect(pokemonSelect, DATA.pokemons, '指定なし');
    if(window.__damekeAttachSearchCombo) window.__damekeAttachSearchCombo('damekeComplementPokemon');

    var abilitySelect = q('damekeComplementAbility');
    ensureAbilityOptions(null);
    if(window.__damekeAttachSearchCombo) window.__damekeAttachSearchCombo('damekeComplementAbility');

    pokemonSelect.addEventListener('change', function(){
      var id = pokemonSelect.value;
      selectedPokemon = id ? DATA.pokemons.find(function(p){ return p.id===id; }) : null;
      renderAll();
    });
    abilitySelect.addEventListener('change', function(){ renderTypeMatchup(); renderResults(); });
    q('damekeComplementFinalEvoOnly').addEventListener('change', renderResults);
    q('damekeComplementChampionsOnly').addEventListener('change', renderResults);
    q('damekeComplementLoadBtn').addEventListener('click', openPicker);

    renderAll();
  }

  window.__damekeRenderComplementPanel = function(){
    if(!q('damekeComplementPokemon').options.length) init();
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
