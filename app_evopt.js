// v1.4.0 努力値最適化ツール
// Given a target actual stat spread (H/A/B/C/D/S), searches all 25 natures for the cheapest
// (lowest total EV) nature+EV allocation that meets every target simultaneously. All stat math
// reuses window.DAMEKE_CALC.getActualStats (the same function the calculator itself uses), so
// this never risks drifting from the app's own stat formula.
(function(){
  'use strict';
  function q(id){ return document.getElementById(id); }
  function fillSelect(select, items){ select.textContent=''; items.forEach(function(item){ var op=document.createElement('option'); op.value=item.id; op.textContent=item.name; select.appendChild(op); }); }

  var DATA = window.DAMEKE_DATA;
  var CALC = window.DAMEKE_CALC;
  var STAT_KEYS = ['H','A','B','C','D','S'];
  var STAT_LABELS = { H:'HP', A:'攻撃', B:'防御', C:'特攻', D:'特防', S:'素早さ' };

  var NATURE_STAT_MAP = {
    'さみしがり':['A','B'], 'いじっぱり':['A','C'], 'やんちゃ':['A','D'], 'ゆうかん':['A','S'],
    'ずぶとい':['B','A'], 'わんぱく':['B','C'], 'のうてんき':['B','D'], 'のんき':['B','S'],
    'ひかえめ':['C','A'], 'おっとり':['C','B'], 'うっかりや':['C','D'], 'れいせい':['C','S'],
    'おだやか':['D','A'], 'おとなしい':['D','B'], 'しんちょう':['D','C'], 'なまいき':['D','S'],
    'おくびょう':['S','A'], 'せっかち':['S','B'], 'ようき':['S','C'], 'むじゃき':['S','D'],
    'がんばりや':[null,null], 'すなお':[null,null], 'てれや':[null,null], 'きまぐれ':[null,null], 'まじめ':[null,null]
  };
  var ALL_NATURE_NAMES = Object.keys(NATURE_STAT_MAP);

  // ---- State ----
  var selectedPokemon = null;
  var currentIvs = { H:31, A:31, B:31, C:31, D:31, S:31 };
  var currentEvs = { H:0, A:0, B:0, C:0, D:0, S:0 };
  var currentNature = 'まじめ';
  var currentLevel = '50';
  var lastOptimizeResult = null; // { nature, evs, remaining } | { infeasible:true } | null

  function getPokemon(){ return selectedPokemon; }

  // ---- Core stat computation (wraps getActualStats with the tool's own current state) ----
  function actualFor(evs, natureName){
    if(!selectedPokemon) return null;
    var input = { ivs: currentIvs, evs: evs, ranks: { A:0,B:0,C:0,D:0,S:0,acc:0,eva:0 }, nature: natureName };
    return CALC.getActualStats(selectedPokemon, currentLevel, input);
  }
  // Minimum EV (0-32) such that the resulting actual value for stat k, under the given nature,
  // is >= target -- EV32 is used if even the maximum doesn't reach it (closest achievable).
  function minEvForTarget(statKey, natureName, target, otherEvs){
    for(var ev=0; ev<=32; ev++){
      var evs = Object.assign({}, otherEvs);
      evs[statKey] = ev;
      var actual = actualFor(evs, natureName)[statKey];
      if(actual >= target) return { ev: ev, achieved: actual, reachable: true };
    }
    var evs32 = Object.assign({}, otherEvs); evs32[statKey] = 32;
    return { ev: 32, achieved: actualFor(evs32, natureName)[statKey], reachable: false };
  }

  // ---- Main editable table: 種族値/個体値/努力値/実数値 ----
  // Red for the nature's boosted stat, blue for its lowered one -- the standard convention this
  // kind of tool uses, applied to the H/A/B/C/D/S header of both the input and output tables.
  function natureStatClass(natureName, statKey){
    var pair = NATURE_STAT_MAP[natureName];
    if(!pair) return '';
    if(pair[0] === statKey) return 'dameke-evopt-stat-up';
    if(pair[1] === statKey) return 'dameke-evopt-stat-down';
    return '';
  }
  function buildStatHeadRow(table, natureName){
    STAT_KEYS.forEach(function(k){
      var h=document.createElement('div');
      h.className='dameke-adjust-evspec-head '+natureStatClass(natureName, k);
      h.textContent=k;
      table.appendChild(h);
    });
  }

  function renderMainTable(){
    var host = q('damekeEvoptMainTable');
    host.innerHTML = '';
    if(!selectedPokemon){
      host.innerHTML = '<div class="dameke-adjust-summary-note">ポケモンを選択してください。</div>';
      return;
    }
    var table = document.createElement('div');
    table.className = 'dameke-adjust-evspec-table';
    table.style.gridTemplateColumns = '3.4em repeat(6,minmax(2.8em,4em))';
    var corner = document.createElement('div'); table.appendChild(corner);
    buildStatHeadRow(table, currentNature);

    var baseLabel = document.createElement('div'); baseLabel.className='dameke-adjust-evspec-rowlabel'; baseLabel.textContent='種族値'; table.appendChild(baseLabel);
    STAT_KEYS.forEach(function(k){ var c=document.createElement('div'); c.className='dameke-adjust-evspec-cell'; c.textContent=selectedPokemon.baseStats[k]; table.appendChild(c); });

    var evLabel = document.createElement('div'); evLabel.className='dameke-adjust-evspec-rowlabel'; evLabel.textContent='努力値'; table.appendChild(evLabel);
    STAT_KEYS.forEach(function(k){
      var cell = document.createElement('div'); cell.className='dameke-adjust-evspec-cell';
      var input = document.createElement('input');
      input.type='number'; input.min='0'; input.max='32';
      input.className='dameke-adjust-evspec-input';
      input.value = currentEvs[k];
      input.addEventListener('change', function(){
        var v = Math.max(0, Math.min(32, parseInt(input.value,10)||0));
        currentEvs[k] = v;
        renderMainTable();
        renderAndOptimize();
      });
      cell.appendChild(input);
      table.appendChild(cell);
    });

    var actualLabel = document.createElement('div'); actualLabel.className='dameke-adjust-evspec-rowlabel'; actualLabel.textContent='実数値'; table.appendChild(actualLabel);
    var actualNow = actualFor(currentEvs, currentNature);
    STAT_KEYS.forEach(function(k){
      var cell = document.createElement('div'); cell.className='dameke-adjust-evspec-cell';
      var input = document.createElement('input');
      input.type='number';
      // Restrict to this stat's achievable range for the current nature (EV0 - EV32), per request.
      var evs0 = Object.assign({}, currentEvs); evs0[k]=0;
      var evs32 = Object.assign({}, currentEvs); evs32[k]=32;
      var lo = actualFor(evs0, currentNature)[k], hi = actualFor(evs32, currentNature)[k];
      input.min = String(lo); input.max = String(hi);
      input.className='dameke-adjust-evspec-input';
      input.value = actualNow[k];
      input.addEventListener('change', function(){
        var target = Math.max(lo, Math.min(hi, parseInt(input.value,10)||lo));
        var found = minEvForTarget(k, currentNature, target, currentEvs);
        currentEvs[k] = found.ev;
        renderMainTable();
        renderAndOptimize();
      });
      cell.appendChild(input);
      table.appendChild(cell);
    });

    host.appendChild(table);

    var remainingEl = document.createElement('div');
    remainingEl.className = 'dameke-adjust-evspec-remaining';
    var total = STAT_KEYS.reduce(function(sum,k){ return sum + (currentEvs[k]||0); }, 0);
    var remaining = 66 - total;
    remainingEl.textContent = '残り努力値：' + remaining;
    remainingEl.classList.toggle('dameke-adjust-evspec-remaining-over', remaining < 0);
    var wrapper = document.createElement('div');
    wrapper.className = 'dameke-adjust-evspec-wrapper';
    wrapper.appendChild(table);
    wrapper.appendChild(remainingEl);
    host.innerHTML = '';
    host.appendChild(wrapper);
  }

  // ---- Optimization: search all 25 natures for the cheapest total-EV combo meeting every
  // target actual value simultaneously. Cheap (25 natures x 6 stats x <=33 points, pure
  // arithmetic via getActualStats -- no calculateDamage/calcSpeed overhead), so this runs live
  // on every input change rather than waiting for a button press. ----
  function optimize(){
    if(!selectedPokemon) return null;
    var targets = actualFor(currentEvs, currentNature); // the table's current 実数値 row is the target
    var best = null;
    ALL_NATURE_NAMES.forEach(function(natureName){
      var evs = { H:0,A:0,B:0,C:0,D:0,S:0 };
      var total = 0, feasible = true;
      // H is never nature-modified, and EV order otherwise doesn't matter since each stat's
      // minimum is independent of the others (nature only touches one up/one down stat).
      STAT_KEYS.forEach(function(k){
        if(!feasible) return;
        var found = minEvForTarget(k, natureName, targets[k], evs);
        if(!found.reachable){ feasible = false; return; }
        evs[k] = found.ev;
        total += found.ev;
      });
      if(!feasible || total > 66) return;
      var isBetter = !best || total < best.total
        || (total === best.total && !best.isPreferred && natureName === currentNature);
      if(isBetter){
        best = { nature: natureName, evs: evs, total: total, isPreferred: natureName === currentNature };
      }
    });
    if(!best) return { infeasible: true };
    return { nature: best.nature, evs: best.evs, total: best.total, remaining: 66 - best.total };
  }

  function renderResult(){
    var host = q('damekeEvoptResultHost');
    var saveBtn = q('damekeEvoptSaveBtn');
    host.innerHTML = '';
    if(!lastOptimizeResult){
      saveBtn.disabled = true;
      return;
    }
    if(lastOptimizeResult.infeasible){
      host.innerHTML = '<div class="dameke-adjust-coming-soon">この実数値をすべて満たす組み合わせは、努力値66の範囲内では見つかりませんでした。</div>';
      saveBtn.disabled = true;
      return;
    }
    var r = lastOptimizeResult;
    // If the optimal combo is exactly what's already entered (same nature, same EVs), there's
    // nothing new to show -- just confirm the current input is already optimal.
    if(r.nature === currentNature && evsEqual(r.evs, currentEvs)){
      host.innerHTML = '<div class="dameke-evopt-already-optimal">最適化されています</div>';
      saveBtn.disabled = false;
      return;
    }
    var actual = actualFor(r.evs, r.nature);
    var table = document.createElement('div');
    table.className = 'dameke-adjust-evspec-table';
    table.style.gridTemplateColumns = '3.4em repeat(6,minmax(2.8em,4em))';
    var corner = document.createElement('div'); table.appendChild(corner);
    buildStatHeadRow(table, r.nature);
    var evLabel = document.createElement('div'); evLabel.className='dameke-adjust-evspec-rowlabel'; evLabel.textContent='努力値'; table.appendChild(evLabel);
    STAT_KEYS.forEach(function(k){ var c=document.createElement('div'); c.className='dameke-adjust-evspec-cell'; c.textContent=r.evs[k]; table.appendChild(c); });
    var actualLabel = document.createElement('div'); actualLabel.className='dameke-adjust-evspec-rowlabel'; actualLabel.textContent='実数値'; table.appendChild(actualLabel);
    STAT_KEYS.forEach(function(k){ var c=document.createElement('div'); c.className='dameke-adjust-evspec-cell'; c.textContent=actual[k]; table.appendChild(c); });

    var natureLine = document.createElement('div');
    natureLine.className = 'dameke-adjust-summary-note';
    natureLine.textContent = '性格：' + r.nature;
    host.appendChild(natureLine);
    host.appendChild(table);

    var remainingEl = document.createElement('div');
    remainingEl.className = 'dameke-adjust-evspec-remaining';
    remainingEl.textContent = '余り努力値：' + r.remaining;
    var wrapper = document.createElement('div');
    wrapper.className = 'dameke-adjust-evspec-wrapper';
    wrapper.appendChild(natureLine);
    wrapper.appendChild(table);
    wrapper.appendChild(remainingEl);
    host.innerHTML = '';
    host.appendChild(wrapper);

    saveBtn.disabled = false;
  }

  function renderAndOptimize(){
    lastOptimizeResult = optimize();
    renderResult();
  }

  // ---- Image display (name is already shown by the select itself) ----
  function renderSummary(){
    var host = q('damekeEvoptImageHost');
    if(!selectedPokemon){
      host.innerHTML = '';
      return;
    }
    var map = window.DAMEKE_POKEMON_IMAGE_IDS;
    var numId = map ? map[selectedPokemon.name] : null;
    host.innerHTML = numId
      ? '<img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/'+numId+'.png" alt="'+selectedPokemon.name+'" loading="lazy">'
      : '';
  }

  // ---- IV table (in the レベル・個体値 fold) ----
  function renderIvTable(){
    var host = q('damekeEvoptIvTable');
    host.innerHTML = '';
    var corner = document.createElement('span'); host.appendChild(corner);
    STAT_KEYS.forEach(function(k){ var s=document.createElement('span'); s.className='dameke-pokemon-stat-head'; s.textContent=k; host.appendChild(s); });
    var rowLabel = document.createElement('span'); rowLabel.className='dameke-pokemon-stat-head'; rowLabel.textContent='個体値'; host.appendChild(rowLabel);
    STAT_KEYS.forEach(function(k){
      var input = document.createElement('input');
      input.type='number'; input.min='0'; input.max='31';
      input.value = currentIvs[k];
      input.addEventListener('change', function(){
        currentIvs[k] = Math.max(0, Math.min(31, parseInt(input.value,10)||0));
        renderMainTable();
        renderAndOptimize();
      });
      host.appendChild(input);
    });
  }

  // ---- "呼び出し" picker: shows saved Pokemon management entries as cards, inline in this panel. ----
  function closePicker(){
    var host = q('damekeEvoptPickerHost');
    host.hidden = true;
    host.innerHTML = '';
  }
  function openPicker(){
    var host = q('damekeEvoptPickerHost');
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
          applyEntry(picked);
          closePicker();
        }));
      });
    }
    host.hidden = false;
  }
  function applyEntry(entry){
    var pokemonSelect = q('damekeEvoptPokemon');
    pokemonSelect.value = entry.pokemonId;
    if(pokemonSelect._v082hRefreshOptions) pokemonSelect._v082hRefreshOptions();
    selectedPokemon = DATA.pokemons.find(function(p){ return p.id === entry.pokemonId; }) || null;
    currentLevel = entry.level || '50';
    q('damekeEvoptLevel').value = currentLevel;
    STAT_KEYS.forEach(function(k){
      currentIvs[k] = (entry.ivs && entry.ivs[k] != null) ? parseInt(entry.ivs[k],10) : 31;
      currentEvs[k] = (entry.evs && entry.evs[k] != null) ? parseInt(entry.evs[k],10) : 0;
    });
    currentNature = entry.nature || 'まじめ';
    q('damekeEvoptNature').value = currentNature;
    renderAll();
  }

  // ---- Save: find an exact match among saved entries (species+level+ivs+evs+nature -- this
  // fully determines 実数値 too, so no separate comparison is needed), and if found, offer to
  // update it instead of silently creating a duplicate. ----
  function evsEqual(a, b){ return STAT_KEYS.every(function(k){ return String(a[k])===String(b[k]); }); }
  function findExactMatch(){
    if(!selectedPokemon || !window.__damekeLoadPokemonList) return null;
    var list = window.__damekeLoadPokemonList();
    return list.find(function(e){
      return e.pokemonId === selectedPokemon.id
        && String(e.level) === String(currentLevel)
        && e.nature === currentNature
        && evsEqual(e.ivs||{}, currentIvs)
        && evsEqual(e.evs||{}, currentEvs);
    }) || null;
  }
  function doSave(){
    if(!lastOptimizeResult || lastOptimizeResult.infeasible || !selectedPokemon) return;
    var r = lastOptimizeResult;
    function buildNewEntry(existingId){
      return {
        id: existingId || null,
        pokemonId: selectedPokemon.id,
        nickname: '',
        abilityId: 'none', itemId: 'none', teraType: 'なし',
        nature: r.nature,
        level: currentLevel,
        ivs: Object.assign({}, currentIvs),
        evs: Object.assign({}, r.evs),
        moves: ['', '', '', ''],
        notes: ''
      };
    }
    var match = findExactMatch();
    if(!match){
      if(window.__damekeOpenPokemonEditorWithEntry) window.__damekeOpenPokemonEditorWithEntry(buildNewEntry(null));
      return;
    }
    // Preserve the matched entry's own fields (ability/item/tera/moves/nickname) -- only nature
    // and EVs are meant to change here.
    var chosen = window.confirm(
      '入力内容と完全に一致するポケモンが「'+ (match.nickname || selectedPokemon.name) +'」としてポケモン管理に見つかりました。\n'
      + 'OK：このポケモンを更新（性格・努力値のみ変更）\nキャンセル：新規のポケモンとして保存'
    );
    if(chosen){
      var updated = JSON.parse(JSON.stringify(match));
      updated.nature = r.nature;
      updated.evs = Object.assign({}, r.evs);
      if(window.__damekeOpenPokemonEditorWithEntry) window.__damekeOpenPokemonEditorWithEntry(updated);
    } else {
      if(window.__damekeOpenPokemonEditorWithEntry) window.__damekeOpenPokemonEditorWithEntry(buildNewEntry(null));
    }
  }

  // ---- Main render/run ----
  function renderAll(){
    renderSummary();
    renderMainTable();
    renderAndOptimize();
  }
  window.__damekeRenderEvoptPanel = renderAll;

  function init(){
    fillSelect(q('damekeEvoptPokemon'), [{id:'',name:'指定なし'}].concat(DATA.pokemons));
    fillSelect(q('damekeEvoptNature'), ALL_NATURE_NAMES.map(function(n){ return {id:n, name:n}; }));
    q('damekeEvoptNature').value = currentNature;
    if(window.__damekeAttachSearchCombo) window.__damekeAttachSearchCombo('damekeEvoptPokemon');
    renderIvTable();

    q('damekeEvoptPokemon').addEventListener('change', function(){
      var id = q('damekeEvoptPokemon').value;
      selectedPokemon = id ? DATA.pokemons.find(function(p){ return p.id===id; }) : null;
      renderAll();
    });
    q('damekeEvoptNature').addEventListener('change', function(){
      currentNature = q('damekeEvoptNature').value;
      renderAll();
    });
    q('damekeEvoptLevel').addEventListener('change', function(){
      currentLevel = String(Math.max(1, Math.min(100, parseInt(q('damekeEvoptLevel').value,10)||50)));
      q('damekeEvoptLevel').value = currentLevel;
      renderAll();
    });
    q('damekeEvoptLoadBtn').addEventListener('click', openPicker);
    q('damekeEvoptSaveBtn').addEventListener('click', doSave);

    renderAll();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
