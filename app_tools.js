(function(){
  'use strict';

  var HISTORY_KEY = 'dameke_calc_history_v1';
  var MAX_HISTORY = 50;

  function q(id){ return document.getElementById(id); }

  // ---- Hamburger menu ----
  function initMenu(){
    var btn = q('damekeMenuBtn'), nav = q('damekeMenuNav');
    if(!btn || !nav) return;
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      nav.hidden = !nav.hidden;
    });
    document.addEventListener('click', function(e){
      if(nav.hidden) return;
      if(nav.contains(e.target) || e.target === btn) return;
      nav.hidden = true;
    });
    nav.querySelectorAll('.dameke-menu-item').forEach(function(item){
      item.addEventListener('click', function(){
        showPanel(item.dataset.panel);
        nav.hidden = true;
      });
    });
    setActiveMenuItem('calculator');
  }

  function setActiveMenuItem(panelName){
    var nav = q('damekeMenuNav');
    if(!nav) return;
    nav.querySelectorAll('.dameke-menu-item').forEach(function(item){
      item.classList.toggle('dameke-menu-item-active', item.dataset.panel === panelName);
    });
  }

  // ---- Panel switching ----
  // Panels are just hidden/shown, never removed or rebuilt, so the calculator's own input
  // state (everything in #panel-calculator) is preserved automatically while another panel
  // is showing -- there is nothing to save/restore for that specific requirement.
  function showPanel(panelName){
    var panels = document.querySelectorAll('.dameke-tool-panel');
    panels.forEach(function(p){ p.hidden = true; });
    var target = q('panel-' + panelName);
    if(target) target.hidden = false;
    setActiveMenuItem(panelName);
    if(panelName === 'history') renderHistoryList();
    if(panelName === 'pokemon' && window.__damekeRenderPokemonList) window.__damekeRenderPokemonList();
    if(panelName === 'party' && window.__damekeRenderPartyList) window.__damekeRenderPartyList();
  }
  window.__damekeShowPanel = showPanel;

  // ---- History storage ----
  function loadHistory(){
    try{
      var raw = window.localStorage.getItem(HISTORY_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch(e){ return []; }
  }
  function saveHistoryList(list){
    try{ window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); return true; }
    catch(e){ if(window.console) console.error('[history] save failed:', e); return false; }
  }

  // Captures every input/select currently inside the calculator panel, keyed by element id.
  // This is deliberately generic (rather than an explicit field list) so it stays correct as
  // the calculator gains new fields, instead of needing to be kept in sync by hand.
  function captureCalculatorState(){
    var panel = q('panel-calculator');
    var state = {};
    if(!panel) return state;
    panel.querySelectorAll('input, select, textarea').forEach(function(el){
      if(!el.id) return;
      if(el.type === 'checkbox' || el.type === 'radio') state[el.id] = el.checked;
      else state[el.id] = el.value;
    });
    return state;
  }

  // Which fields are actually visible right now (offsetParent is null for anything hidden via
  // show()'s style.display toggling, including move-specific conditions for a different move).
  // Stored alongside a saved entry so 詳細 can skip fields that weren't shown when it was saved,
  // rather than listing a stale value from some other move's condition.
  function captureVisibleIds(){
    var panel = q('panel-calculator');
    var ids = [];
    if(!panel) return ids;
    panel.querySelectorAll('input, select, textarea').forEach(function(el){
      if(el.id && el.offsetParent !== null) ids.push(el.id);
    });
    return ids;
  }

  // Writes values into the calculator's DOM only -- no sync/recalculate. Used both for the full
  // "load into the visible calculator" path (which adds the sync afterward) and for the
  // "temporarily swap in historical values just to compute a card preview" path (which restores
  // the live state again right after, without ever letting the UI-facing sync run for it).
  function writeStateToDom(state){
    var panel = q('panel-calculator');
    if(!panel || !state) return;
    Object.keys(state).forEach(function(id){
      var el = q(id);
      if(!el || !panel.contains(el)) return;
      if(el.type === 'checkbox' || el.type === 'radio') el.checked = state[id];
      else el.value = state[id];
    });
  }

  function restoreCalculatorState(state){
    writeStateToDom(state);
    // Same principle as swapSides(): write values directly, then run the same sync/recalculate
    // sequence once at the end, rather than dispatching 'change' per field (which would trigger
    // the species-default handlers and overwrite what was just restored).
    if(window.__damekeApplyMoveFilter) window.__damekeApplyMoveFilter();
    if(window.__damekeUpdateTypeColors) window.__damekeUpdateTypeColors();
    if(window.__damekeRefreshAll) window.__damekeRefreshAll();
    if(window.__damekeCalculate) window.__damekeCalculate();
  }

  function findPokemon(id){ var D = window.DAMEKE_DATA; return D && D.pokemons ? D.pokemons.find(function(p){ return p.id === id; }) : null; }
  function findMove(id){ var D = window.DAMEKE_DATA; return D && D.moves ? D.moves.find(function(m){ return m.id === id; }) : null; }

  function summaryFromState(state){
    var atk = findPokemon(state.attackerSelect), def = findPokemon(state.defenderSelect), mv = findMove(state.moveSelect);
    var atkName = atk ? atk.name : (state.attackerSelect || '?');
    var defName = def ? def.name : (state.defenderSelect || '?');
    var mvName = mv ? mv.name : (state.moveSelect || '?');
    return atkName + ' の ' + mvName + ' → ' + defName;
  }

  // Same idea as statRefFor() below, but usable at save time against a live result's trace.
  function resolveStatRef(trace, labelKey, fallbackSide, fallbackKey){
    var line = (trace || []).find(function(t){ return String(t.label||'').indexOf(labelKey) >= 0; });
    var text = line ? (line.name||'') + ': ' + (line.value||'') + (line.note?(' / '+line.note):'') : '';
    var m = text.match(/(攻撃側|防御側)ランク補正込み([ABCD])参照/);
    if(m) return { side: m[1]==='攻撃側' ? 'attacker' : 'defender', key: m[2] };
    return { side: fallbackSide, key: fallbackKey };
  }

  // Computes the result once, at save time, using the live calculator state (already what's on
  // screen) -- rather than re-running the calculation every time the history panel is opened.
  // Only the fields the card preview actually needs are kept (not the full trace/result object),
  // so a saved entry stays small and rendering it later is a plain read, no DOM swapping needed.
  function computeResultSnapshot(state){
    if(!window.DAMEKE_CALC || !window.__damekeBuildOptions) return null;
    try{
      var attacker = findPokemon(state.attackerSelect), defender = findPokemon(state.defenderSelect), move = findMove(state.moveSelect);
      if(!attacker || !defender || !move) return null;
      var inputArgs = {
        attacker: attacker, defender: defender, move: move,
        attackerLevel: state.attackerLevel, defenderLevel: state.defenderLevel,
        options: window.__damekeBuildOptions()
      };
      var result = window.DAMEKE_CALC.calculateDamage(inputArgs);
      var faintPct = null;
      try{ faintPct = window.DAMEKE_CALC.computeFaintProbability ? window.DAMEKE_CALC.computeFaintProbability(inputArgs, result) : null; }
      catch(e){ faintPct = null; }
      var cat = result.effectiveCategory;
      var atkRef = resolveStatRef(result.trace, '補正後攻撃側実数値', 'attacker', cat==='特殊'?'C':'A');
      var defRef = resolveStatRef(result.trace, '補正後防御側実数値', 'defender', cat==='特殊'?'D':'B');
      return {
        attackerName: result.attackerName, defenderName: result.defenderName, moveName: result.moveName,
        effectiveCategory: cat, minDamage: result.minDamage, maxDamage: result.maxDamage,
        minRate: result.minRate, maxRate: result.maxRate, koInfo: result.koInfo,
        substituteBlocksAll: result.substituteBlocksAll, defenderCurrentHp: result.defenderCurrentHp,
        defenderMaxHp: result.defenderMaxHp, faintPct: faintPct, atkRef: atkRef, defRef: defRef
      };
    } catch(e){
      if(window.console) console.error('[history] compute failed:', e);
      return null;
    }
  }

  function saveCurrentAsHistory(){
    var state = captureCalculatorState();
    var visibleIds = captureVisibleIds();
    var entry = {
      id: 'h' + Date.now() + '_' + Math.floor(Math.random()*1000),
      savedAt: new Date().toISOString(),
      summary: summaryFromState(state),
      state: state,
      visibleIds: visibleIds,
      resultSnapshot: computeResultSnapshot(state)
    };
    var list = loadHistory();
    list.unshift(entry);
    var overflowed = list.length > MAX_HISTORY;
    if(overflowed) list = list.slice(0, MAX_HISTORY);
    saveHistoryList(list);
    if(q('panel-history') && !q('panel-history').hidden) renderHistoryList();
    var msg = '計算内容を履歴に保存しました。「計算履歴」から確認・呼び出しできます。';
    if(overflowed) msg += '\n（計算履歴が上限（' + MAX_HISTORY + '件）に達したため、最も古い履歴を1件削除しました。）';
    window.alert(msg);
  }

  function deleteHistoryEntry(id){
    var list = loadHistory().filter(function(e){ return e.id !== id; });
    saveHistoryList(list);
    renderHistoryList();
  }

  function loadHistoryEntry(id){
    var entry = loadHistory().find(function(e){ return e.id === id; });
    if(!entry) return;
    showPanel('calculator');
    restoreCalculatorState(entry.state);
  }

  function formatSavedAt(iso){
    try{
      var d = new Date(iso);
      var pad = function(n){ return (n<10?'0':'')+n; };
      return d.getFullYear()+'/'+pad(d.getMonth()+1)+'/'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes());
    } catch(e){ return ''; }
  }

  // ---- Miniature HP-bar reproduction (images, names/move, dmg/rate, certainty/faint rate, HP
  // bar) for a history card, using the same PokeAPI sprite id map the calculator uses.
  function buildMiniThumb(japaneseName){
    var wrap = document.createElement('div');
    wrap.className = 'dameke-history-thumb';
    var map = window.DAMEKE_POKEMON_IMAGE_IDS;
    var numId = map ? map[japaneseName] : null;
    if(numId){
      var img = document.createElement('img');
      img.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/' + numId + '.png';
      img.alt = japaneseName;
      img.loading = 'lazy';
      img.onerror = function(){ wrap.classList.add('dameke-history-thumb-missing'); wrap.innerHTML = ''; };
      wrap.appendChild(img);
    } else {
      wrap.classList.add('dameke-history-thumb-missing');
    }
    return wrap;
  }

  function formatKoText(koInfo, maxDamage, substituteBlocksAll){
    if(substituteBlocksAll) return 'みがわり';
    if(maxDamage === 0) return '無効';
    if(!koInfo) return '計算対象外';
    if(koInfo.partial) return '乱数' + koInfo.partial.hits + '発(' + (koInfo.partial.probability*100).toFixed(2) + '%)';
    if(koInfo.certain) return '確定' + koInfo.certain + '発';
    if(koInfo.cappedAt) return koInfo.cappedAt + '発以上でも確定せず';
    return '圏外';
  }

  function buildMiniHpBar(maxHp, minRemain, maxRemain){
    var track = document.createElement('div');
    track.className = 'dameke-history-hpbar-track';
    if(!maxHp){ return track; }
    function pct(v){ return Math.max(0, Math.min(100, (v/maxHp)*100)); }
    function colorFor(v){
      var r = v/maxHp;
      if(r > 0.5) return 'v082h-hp-green';
      if(r > 0.2) return 'v082h-hp-yellow';
      return 'v082h-hp-red';
    }
    var lo = Math.max(0, Math.min(minRemain, maxRemain)), hi = Math.max(minRemain, maxRemain);
    var solid = document.createElement('div');
    solid.className = 'dameke-history-hpbar-seg ' + colorFor(lo);
    solid.style.width = pct(lo) + '%';
    track.appendChild(solid);
    if(hi > lo){
      var uncertain = document.createElement('div');
      uncertain.className = 'dameke-history-hpbar-seg dameke-history-hpbar-uncertain ' + colorFor(hi);
      uncertain.style.width = (pct(hi)-pct(lo)) + '%';
      track.appendChild(uncertain);
    }
    return track;
  }

  // Backward compatibility for entries saved before resultSnapshot existed: falls back to a
  // one-off recomputation (the old temporary-DOM-swap approach) only for those.
  function computeResultSnapshotLive(state){
    var liveState = captureCalculatorState();
    try{
      writeStateToDom(state);
      if(window.__damekeApplyMoveFilter) window.__damekeApplyMoveFilter();
      return computeResultSnapshot(state);
    } finally {
      writeStateToDom(liveState);
      if(window.__damekeApplyMoveFilter) window.__damekeApplyMoveFilter();
    }
  }

  function buildHistoryCardPreview(snapshot, state){
    if(!snapshot) snapshot = computeResultSnapshotLive(state); // old entry, no saved snapshot
    var box = document.createElement('div');
    box.className = 'dameke-history-preview';
    if(!snapshot){
      box.classList.add('dameke-history-preview-unavailable');
      box.textContent = '再計算できませんでした（保存時と技・ポケモンの構成が変わった可能性があります）。';
      return box;
    }
    var result = snapshot, faintPct = snapshot.faintPct;
    var row = document.createElement('div');
    row.className = 'dameke-history-header-row';
    row.appendChild(buildMiniThumb(result.attackerName));
    var textCol = document.createElement('div');
    textCol.className = 'dameke-history-text-col';
    var namesLine = document.createElement('div');
    namesLine.className = 'dameke-history-title';
    namesLine.textContent = result.attackerName + ' → ' + result.defenderName;
    var moveLine = document.createElement('div');
    moveLine.className = 'dameke-history-move-line';
    moveLine.textContent = result.moveName;
    var dmgLine = document.createElement('div');
    dmgLine.className = 'dameke-history-infoline';
    dmgLine.textContent = result.minDamage + ' ～ ' + result.maxDamage + '（' + result.minRate.toFixed(1) + '% ～ ' + result.maxRate.toFixed(1) + '%）';
    var koLine = document.createElement('div');
    koLine.className = 'dameke-history-infoline2';
    var faintText = faintPct == null ? '計算不可' : faintPct.toFixed(2) + '%';
    koLine.textContent = formatKoText(result.koInfo, result.maxDamage, result.substituteBlocksAll) + '　瀕死率:' + faintText;
    textCol.appendChild(namesLine);
    textCol.appendChild(moveLine);
    textCol.appendChild(dmgLine);
    textCol.appendChild(koLine);
    row.appendChild(textCol);
    row.appendChild(buildMiniThumb(result.defenderName));
    box.appendChild(row);

    var curHp = result.defenderCurrentHp, maxHp = result.defenderMaxHp;
    var minRemain = Math.max(0, curHp - result.maxDamage), maxRemain = Math.max(0, curHp - result.minDamage);
    var barWrap = document.createElement('div');
    barWrap.className = 'dameke-history-hpbar-wrap';
    barWrap.appendChild(buildMiniHpBar(maxHp, minRemain, maxRemain));
    var nums = document.createElement('div');
    nums.className = 'dameke-history-hpbar-nums';
    nums.textContent = maxRemain + ' ～ ' + minRemain + ' / ' + maxHp;
    barWrap.appendChild(nums);
    box.appendChild(barWrap);
    box.appendChild(buildStatFocusRows(state, result));
    return box;
  }

  var NATURE_TEXT_BY_VALUE = {
    'がんばりや':'がんばりや 補正なし','さみしがり':'さみしがり A↑ B↓','いじっぱり':'いじっぱり A↑ C↓','やんちゃ':'やんちゃ A↑ D↓',
    'ゆうかん':'ゆうかん A↑ S↓','ずぶとい':'ずぶとい B↑ A↓','すなお':'すなお 補正なし','わんぱく':'わんぱく B↑ C↓',
    'のうてんき':'のうてんき B↑ D↓','のんき':'のんき B↑ S↓','ひかえめ':'ひかえめ C↑ A↓','おっとり':'おっとり C↑ B↓',
    'てれや':'てれや 補正なし','うっかりや':'うっかりや C↑ D↓','れいせい':'れいせい C↑ S↓','おだやか':'おだやか D↑ A↓',
    'おとなしい':'おとなしい D↑ B↓','しんちょう':'しんちょう D↑ C↓','きまぐれ':'きまぐれ 補正なし','なまいき':'なまいき D↑ S↓',
    'おくびょう':'おくびょう S↑ A↓','せっかち':'せっかち S↑ B↓','ようき':'ようき S↑ C↓','むじゃき':'むじゃき S↑ D↓','まじめ':'まじめ 補正なし'
  };

  function statFromState(state, side, key, kind){ var v = state[side+'_'+key+'_'+kind]; return v != null ? v : ''; }
  function natureTextFromState(state, side){ var v = state[side+'_nature'] || 'まじめ'; return NATURE_TEXT_BY_VALUE[v] || v; }

  // Reproduces the focused 性格/努力値/ランク rows shown directly under the calculator's own HP
  // bar (not the full input-side stat table) -- atkRef/defRef (which stat this move actually
  // references) come from the saved snapshot, computed once at save time.
  function buildStatFocusRows(state, snapshot){
    var wrap = document.createElement('div');
    wrap.className = 'dameke-history-stat-focus';
    var cat = snapshot.effectiveCategory;
    var atkRef = snapshot.atkRef, defRef = snapshot.defRef;

    var atkCol = document.createElement('div');
    var defCol = document.createElement('div');
    function addRow(col, label, value){
      var row = document.createElement('div');
      row.className = 'dameke-history-focus-row';
      var l = document.createElement('span'); l.className = 'dameke-history-focus-label'; l.textContent = label;
      var v = document.createElement('span'); v.textContent = value;
      row.appendChild(l); row.appendChild(v);
      col.appendChild(row);
    }
    addRow(atkCol, '性格', natureTextFromState(state, 'attacker'));
    addRow(defCol, '性格', natureTextFromState(state, 'defender'));
    if(cat !== '変化'){
      var atkSideJp = atkRef.side === 'attacker' ? '攻' : '防';
      addRow(atkCol, '努力値('+atkSideJp+atkRef.key+')', statFromState(state, atkRef.side, atkRef.key, 'ev'));
      addRow(defCol, '努力値(H/'+defRef.key+')', statFromState(state,'defender','H','ev') + ' / ' + statFromState(state,'defender',defRef.key,'ev'));
      addRow(atkCol, 'ランク('+atkSideJp+atkRef.key+')', statFromState(state, atkRef.side, atkRef.key, 'rank'));
      addRow(defCol, 'ランク('+defRef.key+')', statFromState(state,'defender',defRef.key,'rank'));
    }
    wrap.appendChild(atkCol);
    wrap.appendChild(defCol);
    return wrap;
  }

  // ---- "詳細" collapsible: lists meaningfully-set values -- checked checkboxes, and selects
  // whose value isn't a "not selected" sentinel, and number/text inputs left at their HTML-
  // defined default. Stat fields (already in the focus rows above) and type fields left
  // unchanged from the selected Pokemon's own natural types are excluded so this only surfaces
  // genuinely new information.
  var NONE_SENTINEL_VALUES = ['none', 'なし', ''];
  function isNoneLikeSelect(el, value){
    if(NONE_SENTINEL_VALUES.indexOf(value) >= 0) return true;
    var opt = Array.prototype.find.call(el.options, function(o){ return o.value === value; });
    if(opt && NONE_SENTINEL_VALUES.indexOf(opt.textContent.trim()) >= 0) return true;
    return false;
  }
  // A select's "default" is whichever <option> has the HTML selected attribute (or the first
  // option, if none does) -- this catches non-なし defaults too, like 行動順's 先攻 or
  // ステラ技回数's 1回目, without needing a hardcoded per-field default table.
  function isDefaultSelectedValue(el, value){
    var defaultOpt = Array.prototype.find.call(el.options, function(o){ return o.defaultSelected; }) || el.options[0];
    return !!defaultOpt && defaultOpt.value === value;
  }

  function labelTextFor(el){
    if(el.id){
      var forLabel = document.querySelector('label[for="' + el.id + '"]');
      if(forLabel) return forLabel.textContent.trim();
    }
    var wrapLabel = el.closest ? el.closest('label') : null;
    if(wrapLabel){
      var clone = wrapLabel.cloneNode(true);
      clone.querySelectorAll('input, select, textarea').forEach(function(inner){ inner.remove(); });
      var txt = clone.textContent.replace(/\s+/g, '').trim();
      if(txt) return txt;
    }
    return el.id || '';
  }

  // Fields already shown elsewhere in the card (basic selectors, HP, stats, gender -- both the
  // real field genderValue() reads and the unused static one -- and the EV quick-preset
  // selectors) are excluded so "詳細" only adds genuinely new information.
  var STAT_DETAIL_ID_SUFFIXES = ['_nature', '_iv', '_ev', '_rank'];
  var ALREADY_SHOWN_IDS = ['attackerSelect','defenderSelect','moveSelect','attackerLevel','defenderLevel','attackerCurrentHp','defenderCurrentHp','attackerSexSelect','defenderSexSelect','attackerGender','defenderGender','v082hEvPreset_attacker','v082hEvPreset_defender'];
  function isAlreadyShownElsewhere(id){
    if(ALREADY_SHOWN_IDS.indexOf(id) >= 0) return true;
    return STAT_DETAIL_ID_SUFFIXES.some(function(suf){ return id.indexOf(suf) >= 0; });
  }

  // Type1/Type2 fields left at the selected Pokemon's own natural type aren't worth listing --
  // only a genuinely overridden type is "new information".
  var TYPE_FIELD_TO_SLOT = { attackerType1:['attackerSelect',0], attackerType2:['attackerSelect',1], defenderType1:['defenderSelect',0], defenderType2:['defenderSelect',1] };
  function isUnchangedTypeField(id, state){
    var mapping = TYPE_FIELD_TO_SLOT[id];
    if(!mapping) return false;
    var pokemon = findPokemon(state[mapping[0]]);
    if(!pokemon || !pokemon.types) return false;
    var naturalType = pokemon.types[mapping[1]] || 'なし';
    return state[id] === naturalType;
  }

  function buildDetailSection(state, visibleIds){
    var wrap = document.createElement('details');
    wrap.className = 'dameke-history-detail';
    var summary = document.createElement('summary');
    summary.textContent = '詳細';
    wrap.appendChild(summary);

    var panel = q('panel-calculator');
    var list = document.createElement('div');
    list.className = 'dameke-history-detail-list';
    // visibleIds is only present on entries saved after this feature was added; older entries
    // fall back to "no visibility filtering" rather than hiding everything.
    var visibleSet = Array.isArray(visibleIds) ? {} : null;
    if(visibleSet) visibleIds.forEach(function(id){ visibleSet[id] = true; });
    var any = false;
    if(panel){
      Object.keys(state).forEach(function(id){
        if(isAlreadyShownElsewhere(id)) return;
        if(isUnchangedTypeField(id, state)) return;
        if(visibleSet && !visibleSet[id]) return; // wasn't actually shown for this move/state
        var el = q(id);
        if(!el || !panel.contains(el)) return;
        var val = state[id];
        var displayVal;
        if(el.type === 'checkbox' || el.type === 'radio'){
          if(val !== true) return; // unchecked -- not meaningfully set
          displayVal = 'あり';
        } else if(el.tagName === 'SELECT'){
          if(isNoneLikeSelect(el, val)) return; // なし/none/0 -- not meaningfully set
          if(isDefaultSelectedValue(el, val)) return; // e.g. 先攻/1回目 left at its own default
          var opt = Array.prototype.find.call(el.options, function(o){ return o.value === val; });
          displayVal = opt ? opt.textContent : val;
        } else {
          if(val === '' || val == null) return;
          if(val === el.defaultValue) return; // left at the field's own HTML default
          displayVal = val;
        }
        var line = document.createElement('div');
        line.className = 'dameke-history-detail-item';
        line.textContent = labelTextFor(el) + '： ' + displayVal;
        list.appendChild(line);
        any = true;
      });
    }
    if(!any){
      var none = document.createElement('div');
      none.className = 'dameke-history-detail-item dameke-history-detail-empty';
      none.textContent = '表示できる項目はありません。';
      list.appendChild(none);
    }
    wrap.appendChild(list);
    return wrap;
  }

  function renderHistoryList(){
    var host = q('damekeHistoryList');
    if(!host) return;
    host.innerHTML = '';
    var list = loadHistory();
    if(!list.length){
      var empty = document.createElement('div');
      empty.className = 'dameke-history-empty';
      empty.textContent = '保存された履歴はまだありません。';
      host.appendChild(empty);
      return;
    }
    list.forEach(function(entry){
      var card = document.createElement('div');
      card.className = 'dameke-history-card';

      var meta = document.createElement('div');
      meta.className = 'dameke-history-card-meta';
      var sub = document.createElement('span');
      sub.className = 'dameke-history-card-sub';
      sub.textContent = formatSavedAt(entry.savedAt);
      var actions = document.createElement('div');
      actions.className = 'dameke-history-card-actions';
      var loadBtn = document.createElement('button');
      loadBtn.type = 'button';
      loadBtn.className = 'dameke-history-load';
      loadBtn.textContent = '呼び出す';
      loadBtn.addEventListener('click', function(){ loadHistoryEntry(entry.id); });
      var delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.textContent = '削除';
      delBtn.addEventListener('click', function(){
        if(window.confirm('この履歴を削除しますか？')) deleteHistoryEntry(entry.id);
      });
      actions.appendChild(loadBtn);
      actions.appendChild(delBtn);
      meta.appendChild(sub);
      meta.appendChild(actions);

      card.appendChild(meta);
      card.appendChild(buildHistoryCardPreview(entry.resultSnapshot, entry.state));
      card.appendChild(buildDetailSection(entry.state, entry.visibleIds));
      host.appendChild(card);
    });
  }

  // ---- Inject the "履歴保存" button into the calculator's own toolbar, next to 攻防交代.
  function buildButtonGroup(label, groupClass, buttons){
    var group = document.createElement('div');
    group.className = 'dameke-btn-group ' + groupClass;
    var lbl = document.createElement('span');
    lbl.className = 'dameke-btn-group-label';
    lbl.textContent = label;
    var row = document.createElement('div');
    row.className = 'dameke-btn-group-buttons';
    buttons.forEach(function(b){
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dameke-btn-group-btn ' + (b.cls||'');
      btn.textContent = b.text;
      btn.addEventListener('click', b.onClick);
      row.appendChild(btn);
    });
    group.appendChild(lbl);
    group.appendChild(row);
    return group;
  }

  function injectHistorySaveButton(attemptsLeft){
    var toolbar = q('v082hToolbar');
    if(!toolbar){
      if(attemptsLeft > 0) setTimeout(function(){ injectHistorySaveButton(attemptsLeft-1); }, 200);
      return;
    }
    if(q('damekeHistoryGroup')) return;
    var group = buildButtonGroup('履歴', 'dameke-btn-group-history', [
      { text:'保存', cls:'dameke-btn-group-save', onClick: saveCurrentAsHistory },
      { text:'呼び出し', cls:'dameke-btn-group-load', onClick: function(){ showPanel('history'); } }
    ]);
    group.id = 'damekeHistoryGroup';
    toolbar.appendChild(group);
  }

  function init(){
    initMenu();
    injectHistorySaveButton(25); // installLayout() runs during the calculator's own init
                                   // sequence, which may finish slightly after this script does
    if(window.__damekeInitPokemonPanel) window.__damekeInitPokemonPanel();
    if(window.__damekeInitPartyPanel) window.__damekeInitPartyPanel();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.addEventListener('load', function(){
    injectHistorySaveButton(10);
    if(window.__damekeInitPokemonPanel) window.__damekeInitPokemonPanel();
    if(window.__damekeInitPartyPanel) window.__damekeInitPartyPanel();
  });
})();

// ==================== ポケモン管理 (Pokemon storage/management) ====================
(function(){
  'use strict';
  var POKEMON_KEY = 'dameke_saved_pokemon_v1';
  var STAT_KEYS_ALL = ['H','A','B','C','D','S'];
  var STAT_LABELS_ALL = { H:'H', A:'A', B:'B', C:'C', D:'D', S:'S' };

  // Returns 'dameke-stat-boost'/'dameke-stat-drop'/'' for a given stat key under a given nature,
  // using the shared window.DAMEKE_NATURE helper (same source of truth the calculator itself
  // uses for applying the +10%/-10% modifier).
  function natureColorClass(natureValue, statKey){
    if(!window.DAMEKE_NATURE || statKey==='H') return '';
    var pair = window.DAMEKE_NATURE.naturePair({nature: natureValue});
    if(pair.up === statKey) return 'dameke-stat-boost';
    if(pair.down === statKey) return 'dameke-stat-drop';
    return '';
  }
  var NATURE_LIST = ['がんばりや','さみしがり','いじっぱり','やんちゃ','ゆうかん','ずぶとい','すなお','わんぱく','のうてんき','のんき','ひかえめ','おっとり','てれや','うっかりや','れいせい','おだやか','おとなしい','しんちょう','きまぐれ','なまいき','おくびょう','せっかち','ようき','むじゃき','まじめ'];

  function q(id){ return document.getElementById(id); }
  function D(){ return window.DAMEKE_DATA; }
  function findPokemonById(id){ var d=D(); return d && d.pokemons ? d.pokemons.find(function(p){ return p.id===id; }) : null; }
  function findMoveById(id){ var d=D(); return d && d.moves ? d.moves.find(function(m){ return m.id===id; }) : null; }

  function loadPokemonList(){
    try{
      var raw = window.localStorage.getItem(POKEMON_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch(e){ return []; }
  }
  function savePokemonListToStorage(list){
    try{ window.localStorage.setItem(POKEMON_KEY, JSON.stringify(list)); return true; }
    catch(e){ if(window.console) console.error('[pokemon] save failed:', e); return false; }
  }

  function emptyStats(){ var o={}; STAT_KEYS_ALL.forEach(function(k){ o[k] = k==='H' ? '31' : '31'; }); return o; }
  function emptyEvs(){ var o={}; STAT_KEYS_ALL.forEach(function(k){ o[k]='0'; }); return o; }

  // ---- Capturing from the calculator's current side ----
  function captureSideForSave(side){
    function val(id){ var el = q(id); return el ? el.value : ''; }
    var pokemonId = val(side+'Select');
    var ivs = {}, evs = {};
    STAT_KEYS_ALL.forEach(function(k){
      ivs[k] = val(side+'_'+k+'_iv') || '31';
      evs[k] = val(side+'_'+k+'_ev') || '0';
    });
    return {
      pokemonId: pokemonId,
      nickname: '',
      gender: val(side+'SexSelect'),
      abilityId: val(side+'AbilitySelect'),
      itemId: val(side+'ItemSelect'),
      teraType: val(side+'TeraType'),
      nature: val(side+'_nature') || 'まじめ',
      level: val(side+'Level') || '50',
      ivs: ivs, evs: evs,
      moves: ['', '', '', ''],
      notes: ''
    };
  }

  function savePokemonFromSide(side){
    var captured = captureSideForSave(side);
    if(!captured.pokemonId){ window.alert('ポケモンが選択されていません。'); return; }
    var entry = Object.assign({
      id: 'pk' + Date.now() + '_' + Math.floor(Math.random()*1000),
      savedAt: new Date().toISOString()
    }, captured);
    var list = loadPokemonList();
    list.unshift(entry);
    savePokemonListToStorage(list);
    if(q('panel-pokemon') && !q('panel-pokemon').hidden) renderPokemonList();
    window.alert('ポケモンを保存しました。「ポケモン管理」から確認・編集できます。');
  }
  window.__damekeSavePokemonFromSide = savePokemonFromSide;

  // ---- Card rendering ----
  function buildPokemonThumbFor(japaneseName){
    var wrap = document.createElement('div');
    wrap.className = 'dameke-pokemon-card-thumb';
    var map = window.DAMEKE_POKEMON_IMAGE_IDS;
    var numId = map ? map[japaneseName] : null;
    if(numId){
      var img = document.createElement('img');
      img.crossOrigin = 'anonymous'; // set before src, so any canvas export of this thumb (party image output) isn't tainted
      img.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/' + numId + '.png';
      img.alt = japaneseName;
      img.onerror = function(){ wrap.classList.add('dameke-pokemon-card-thumb-missing'); wrap.innerHTML=''; };
      wrap.appendChild(img);
    } else {
      wrap.classList.add('dameke-pokemon-card-thumb-missing');
    }
    return wrap;
  }

  function loadPokemonIntoSide(entry, side){
    var panel = q('panel-calculator');
    function setVal(id, v){ var el = q(id); if(el && panel && panel.contains(el) && v != null) el.value = v; }
    setVal(side+'Select', entry.pokemonId);
    setVal(side+'SexSelect', entry.gender);
    setVal(side+'AbilitySelect', entry.abilityId);
    setVal(side+'ItemSelect', entry.itemId);
    setVal(side+'TeraType', entry.teraType);
    setVal(side+'_nature', entry.nature);
    setVal(side+'Level', entry.level);
    STAT_KEYS_ALL.forEach(function(k){
      setVal(side+'_'+k+'_iv', entry.ivs && entry.ivs[k]);
      setVal(side+'_'+k+'_ev', entry.evs && entry.evs[k]);
    });
    // moveSelect belongs to the attacker role only (not per-side), so only set it when loading
    // into the attacker, using the first saved move if one was set.
    if(side === 'attacker' && entry.moves && entry.moves[0]) setVal('moveSelect', entry.moves[0]);
    if(window.__damekeApplyMoveFilter) window.__damekeApplyMoveFilter();
    if(window.__damekeUpdateTypeColors) window.__damekeUpdateTypeColors();
    if(window.__damekeRefreshAll) window.__damekeRefreshAll();
    if(window.__damekeCalculate) window.__damekeCalculate();
    // Refresh search-combo displayed text for the fields we just wrote directly.
    [side+'Select', side+'AbilitySelect', side+'ItemSelect', 'moveSelect'].forEach(function(id){
      var el = q(id);
      if(el && el._v082hRefreshOptions) el._v082hRefreshOptions();
    });
    if(window.__damekeShowPanel) window.__damekeShowPanel('calculator');
  }

  function computeActualStatsFor(entry){
    var pokemon = findPokemonById(entry.pokemonId);
    if(!pokemon || !window.DAMEKE_CALC || !window.DAMEKE_CALC.getActualStats) return null;
    try{
      return window.DAMEKE_CALC.getActualStats(pokemon, Number(entry.level)||50, entry);
    } catch(e){ return null; }
  }

  // Forces ♂/♀ to render as text/symbol glyphs rather than color emoji glyphs wherever a
  // stored gender value is shown as display text (the stored value itself stays plain).
  function genderDisplayText(g){ return (g==='♂'||g==='♀') ? g+'\uFE0E' : g; }

  function buildLabeledRow(label, value){
    var row = document.createElement('div');
    row.className = 'dameke-pokemon-detail-row';
    var l = document.createElement('span'); l.className='dameke-pokemon-detail-label'; l.textContent = label;
    var v = document.createElement('span'); v.textContent = value;
    row.appendChild(l); row.appendChild(v);
    return row;
  }

  // Same shape as buildLabeledRow(), but each move name gets its own inline span (with
  // white-space:nowrap) so a narrow container wraps *between* move names instead of splitting
  // a single move name mid-way.
  function buildMovesRow(label, moveNames){
    var row = document.createElement('div');
    row.className = 'dameke-pokemon-detail-row';
    var l = document.createElement('span'); l.className='dameke-pokemon-detail-label'; l.textContent = label;
    var v = document.createElement('span'); v.className='dameke-pokemon-moves-value';
    moveNames.forEach(function(name){
      var m = document.createElement('span'); m.className='dameke-pokemon-move-name'; m.textContent = name;
      v.appendChild(m);
    });
    row.appendChild(l); row.appendChild(v);
    return row;
  }

  // Read-only version of the edit form's combined 努力値/実数値 table, for the card summary.
  function buildCombinedStatTable(entry, actual){
    var table = document.createElement('div');
    table.className = 'dameke-pokemon-combined-stat-table dameke-pokemon-combined-stat-table-readonly';
    var corner = document.createElement('span'); table.appendChild(corner);
    STAT_KEYS_ALL.forEach(function(k){ var s=document.createElement('span'); s.className='dameke-pokemon-stat-head '+natureColorClass(entry.nature, k); s.textContent=STAT_LABELS_ALL[k]; table.appendChild(s); });
    var pokemon = findPokemonById(entry.pokemonId);
    var baseLabel = document.createElement('span'); baseLabel.className='dameke-pokemon-stat-head'; baseLabel.textContent='種族値';
    table.appendChild(baseLabel);
    STAT_KEYS_ALL.forEach(function(k){ var s=document.createElement('span'); s.textContent=(pokemon&&pokemon.baseStats&&pokemon.baseStats[k]!=null)?pokemon.baseStats[k]:'-'; table.appendChild(s); });
    var evLabel = document.createElement('span'); evLabel.className='dameke-pokemon-stat-head'; evLabel.textContent='努力値';
    table.appendChild(evLabel);
    STAT_KEYS_ALL.forEach(function(k){ var s=document.createElement('span'); s.textContent=(entry.evs&&entry.evs[k])||'0'; table.appendChild(s); });
    var statLabel = document.createElement('span'); statLabel.className='dameke-pokemon-stat-head'; statLabel.textContent='実数値';
    table.appendChild(statLabel);
    STAT_KEYS_ALL.forEach(function(k){ var s=document.createElement('span'); s.textContent=actual?actual[k]:'-'; table.appendChild(s); });
    return table;
  }

  // Shared by buildPokemonCard() (management context, with edit/delete) and
  // buildSelectablePokemonCard() (party-selector context, with a selection toggle) -- builds the
  // thumbnail + info block, leaving card-level chrome (actions, selection state) to the caller.
  function buildPokemonCardInfo(entry, card){
    var pokemon = findPokemonById(entry.pokemonId);
    var pokemonName = pokemon ? pokemon.name : (entry.pokemonId || '(不明なポケモン)');
    var types = pokemon && Array.isArray(pokemon.types) ? pokemon.types.join('・') : '-';
    var ability = entry.abilityId && entry.abilityId!=='none' ? entry.abilityId : 'なし';
    var item = entry.itemId && entry.itemId!=='none' ? entry.itemId : 'なし';
    var tera = entry.teraType || 'なし';
    var actual = computeActualStatsFor(entry);

    card.appendChild(buildPokemonThumbFor(pokemonName));

    var main = document.createElement('div');
    main.className = 'dameke-pokemon-card-main';
    var title = document.createElement('div');
    title.className = 'dameke-pokemon-card-title';
    title.textContent = entry.nickname ? (entry.nickname + '（' + pokemonName + '）') : pokemonName;
    main.appendChild(title);

    var detailGrid = document.createElement('div');
    detailGrid.className = 'dameke-pokemon-detail-grid';
    detailGrid.appendChild(buildLabeledRow('タイプ', types));
    detailGrid.appendChild(buildLabeledRow('性別', genderDisplayText(entry.gender) || '指定なし'));
    detailGrid.appendChild(buildLabeledRow('特性', ability));
    detailGrid.appendChild(buildLabeledRow('持ち物', item));
    detailGrid.appendChild(buildLabeledRow('テラスタル', tera));
    var moveNames = (entry.moves||[]).map(function(id){ var m=id?findMoveById(id):null; return m ? m.name : '(未設定)'; });
    detailGrid.appendChild(buildMovesRow('技', moveNames));
    main.appendChild(detailGrid);
    main.appendChild(buildCombinedStatTable(entry, actual));

    if(entry.notes){
      var notes = document.createElement('div');
      notes.className = 'dameke-pokemon-card-notes';
      notes.textContent = '備考: ' + entry.notes;
      main.appendChild(notes);
    }
    return main;
  }

  function buildPokemonCard(entry){
    var card = document.createElement('div');
    card.className = 'dameke-pokemon-card';
    var main = buildPokemonCardInfo(entry, card);

    var loadBtns = document.createElement('div');
    loadBtns.className = 'dameke-pokemon-card-loadbtns';
    var loadAtk = document.createElement('button');
    loadAtk.type='button'; loadAtk.className='dameke-pokemon-load-attacker'; loadAtk.textContent='攻撃側で呼び出し';
    loadAtk.addEventListener('click', function(){ loadPokemonIntoSide(entry, 'attacker'); });
    var loadDef = document.createElement('button');
    loadDef.type='button'; loadDef.className='dameke-pokemon-load-defender'; loadDef.textContent='防御側で呼び出し';
    loadDef.addEventListener('click', function(){ loadPokemonIntoSide(entry, 'defender'); });
    loadBtns.appendChild(loadAtk); loadBtns.appendChild(loadDef);

    var actions = document.createElement('div');
    actions.className = 'dameke-pokemon-card-actions';
    var editBtn = document.createElement('button');
    editBtn.type='button'; editBtn.className='dameke-pokemon-edit'; editBtn.textContent='編集';
    editBtn.addEventListener('click', function(){ openPokemonEditor(entry); });
    var delBtn = document.createElement('button');
    delBtn.type='button'; delBtn.textContent='削除';
    delBtn.addEventListener('click', function(){
      if(window.confirm('このポケモンを削除しますか？')){
        savePokemonListToStorage(loadPokemonList().filter(function(e){ return e.id!==entry.id; }));
        renderPokemonList();
      }
    });
    actions.appendChild(editBtn); actions.appendChild(delBtn);

    card.appendChild(main);
    card.appendChild(loadBtns);
    card.appendChild(actions);
    return card;
  }

  function renderPokemonList(){
    var host = q('damekePokemonList');
    if(!host) return;
    host.innerHTML = '';
    var list = loadPokemonList();
    if(!list.length){
      var empty = document.createElement('div');
      empty.className = 'dameke-pokemon-empty';
      empty.textContent = '保存されたポケモンはまだありません。';
      host.appendChild(empty);
      return;
    }
    list.forEach(function(entry){ host.appendChild(buildPokemonCard(entry)); });
  }

  // Same rich display as buildPokemonCard(), but for the party selector: no edit/delete/load
  // buttons, just a click-to-toggle selection state with a visible checkmark/highlight.
  function buildSelectablePokemonCard(entry, isSelected, onToggle){
    var card = document.createElement('div');
    card.className = 'dameke-pokemon-card dameke-pokemon-card-selectable';
    if(isSelected) card.classList.add('dameke-pokemon-card-selected');
    var main = buildPokemonCardInfo(entry, card);
    card.appendChild(main);
    var badge = document.createElement('div');
    badge.className = 'dameke-pokemon-card-select-badge';
    badge.textContent = isSelected ? '✓ 選択中' : '選択する';
    card.appendChild(badge);
    card.addEventListener('click', function(){ onToggle(); });
    return card;
  }

  // ---- Move learnset filtering (standalone version of the calculator's own logic) ----
  function getLearnsetKeyFor(name){
    var m = String(name||'').match(/^(.+?)\(([^)]+)\)$/);
    return m ? (m[1] + '_' + m[2]) : name;
  }
  function getFilteredMovesForPokemon(pokemonId, showAll){
    var d = D();
    var allMoves = d.moves.filter(function(m){ return !(d.isExcludedSignatureZMove && d.isExcludedSignatureZMove(m)); });
    if(showAll) return allMoves;
    var pokemon = findPokemonById(pokemonId);
    var LS = window.DAMEKE_LEARNSETS;
    if(!pokemon || !LS) return allMoves;
    var key = getLearnsetKeyFor(pokemon.name);
    if(!LS.hasLearnset(key)) return allMoves;
    var learned = LS.getLearnset(key);
    var filtered = allMoves.filter(function(m){ return learned.indexOf(m.name) >= 0; });
    return filtered.length ? filtered : allMoves;
  }

  // ---- Edit form ----
  var editingEntry = null;

  function fillSelectEl(select, items, withNoneOption){
    select.textContent = '';
    if(withNoneOption){
      var noneOp = document.createElement('option'); noneOp.value='none'; noneOp.textContent='なし'; select.appendChild(noneOp);
    }
    items.forEach(function(item){
      var op = document.createElement('option'); op.value = item.id; op.textContent = item.name;
      select.appendChild(op);
    });
  }

  function makeField(labelText, controlEl, fullWidth){
    var label = document.createElement('label');
    if(fullWidth) label.className = 'dameke-pokemon-edit-fullwidth';
    var span = document.createElement('span'); span.textContent = labelText;
    label.appendChild(span); label.appendChild(controlEl);
    return label;
  }

  function refreshMoveOptionsInEditForm(){
    var pokemonId = q('damekePokeEdit_pokemon') ? q('damekePokeEdit_pokemon').value : '';
    var showAll = q('damekePokeEdit_moveShowAll') ? q('damekePokeEdit_moveShowAll').checked : false;
    var filtered = getFilteredMovesForPokemon(pokemonId, showAll);
    for(var i=1;i<=4;i++){
      var sel = q('damekePokeEdit_move'+i);
      if(!sel) continue;
      var prev = sel.value;
      fillSelectEl(sel, filtered, true);
      var stillHas = filtered.some(function(m){ return m.id===prev; });
      sel.value = stillHas ? prev : 'none';
      if(sel._v082hRefreshOptions) sel._v082hRefreshOptions();
    }
  }

  // Limits the ability select to whatever the selected Pokemon can actually have, falling back
  // to the full list if the Pokemon has no ability data. D.abilities already carries a native
  // "なし" entry first, so it's included in this filtered list too (no separate none-option).
  function refreshAbilityOptionsInEditForm(){
    var sel = q('damekePokeEdit_ability');
    if(!sel) return;
    var pokemonId = q('damekePokeEdit_pokemon') ? q('damekePokeEdit_pokemon').value : '';
    var pokemon = findPokemonById(pokemonId);
    var d = D();
    var allAbilities = d.abilities;
    var options = allAbilities;
    if(pokemon && Array.isArray(pokemon.abilities) && pokemon.abilities.length){
      var allowed = pokemon.abilities;
      var filtered = allAbilities.filter(function(a){ return a.id==='なし' || allowed.indexOf(a.id) >= 0; });
      if(filtered.length) options = filtered;
    }
    var prev = sel.value;
    fillSelectEl(sel, options, false);
    var stillHas = options.some(function(a){ return a.id===prev; });
    sel.value = stillHas ? prev : (options[0] ? options[0].id : 'なし');
    if(sel._v082hRefreshOptions) sel._v082hRefreshOptions();
  }

  function buildEditForm(entry){
    var host = q('damekePokemonEditHost');
    host.innerHTML = '';
    var form = document.createElement('div');
    form.className = 'dameke-pokemon-edit-form';
    var heading = document.createElement('h3');
    heading.textContent = entry.id ? 'ポケモンを編集' : '新規作成';
    form.appendChild(heading);

    var grid = document.createElement('div');
    grid.className = 'dameke-pokemon-edit-grid';

    var d = D();

    // 1. Pokemon select (search combo)
    var pokemonSel = document.createElement('select'); pokemonSel.id = 'damekePokeEdit_pokemon';
    fillSelectEl(pokemonSel, d.pokemons, false);
    pokemonSel.value = entry.pokemonId || (d.pokemons[0] && d.pokemons[0].id) || '';
    grid.appendChild(makeField('ポケモン名', pokemonSel));

    // 2. Nickname
    var nickInput = document.createElement('input'); nickInput.type='text'; nickInput.id='damekePokeEdit_nickname';
    nickInput.value = entry.nickname || '';
    grid.appendChild(makeField('ニックネーム', nickInput));

    // 2b. Gender (same options as the calculator's own gender select). The trailing \uFE0E on
    // the label forces ♂/♀ to render as text/symbol glyphs rather than color emoji glyphs on
    // mobile platforms that would otherwise substitute a lower-sitting, differently-shaped emoji
    // glyph for these two characters specifically -- the stored value stays plain ('♂'/'♀').
    var genderSel = document.createElement('select'); genderSel.id = 'damekePokeEdit_gender';
    [['','指定なし'], ['♂','♂\uFE0E'], ['♀','♀\uFE0E'], ['不明','性別不明']].forEach(function(x){
      var op = document.createElement('option'); op.value = x[0]; op.textContent = x[1]; genderSel.appendChild(op);
    });
    genderSel.value = entry.gender || (findPokemonById(pokemonSel.value) && findPokemonById(pokemonSel.value).fixedGender) || '';
    grid.appendChild(makeField('性別', genderSel));

    // 3. Ability -- limited to this Pokemon's own possible abilities (D.abilities already
    // includes "なし" as its first entry, so no extra none-option is added here).
    var abilitySel = document.createElement('select'); abilitySel.id = 'damekePokeEdit_ability';
    grid.appendChild(makeField('特性', abilitySel));

    // 4. Item (D.items has no native "なし" entry, so one is added explicitly)
    var itemSel = document.createElement('select'); itemSel.id = 'damekePokeEdit_item';
    // Defensively avoid a duplicate "なし" entry: only add our own none-option if the data
    // doesn't already carry one under some name/id variant.
    var itemHasOwnNone = d.items.some(function(it){ return it && (it.id==='なし' || it.name==='なし' || it.id==='none'); });
    fillSelectEl(itemSel, d.items, !itemHasOwnNone);
    itemSel.value = entry.itemId || 'none';
    grid.appendChild(makeField('持ち物', itemSel));

    // 5. Tera type
    var teraSel = document.createElement('select'); teraSel.id = 'damekePokeEdit_tera';
    fillSelectEl(teraSel, d.teraTypes, false);
    teraSel.value = entry.teraType || 'なし';
    grid.appendChild(makeField('テラスタル', teraSel));

    // 6. Nature
    var natureSel = document.createElement('select'); natureSel.id = 'damekePokeEdit_nature';
    NATURE_LIST.forEach(function(n){ var op=document.createElement('option'); op.value=n; op.textContent=n; natureSel.appendChild(op); });
    natureSel.value = entry.nature || 'まじめ';
    grid.appendChild(makeField('性格', natureSel));

    form.appendChild(grid);

    // 7. Combined 努力値/実数値 table: rows = 努力値, 実数値; columns = HP/攻撃/防御/特攻/特防/素早さ
    var combinedTable = document.createElement('div');
    combinedTable.className = 'dameke-pokemon-combined-stat-table';
    var cornerCell = document.createElement('span');
    combinedTable.appendChild(cornerCell);
    STAT_KEYS_ALL.forEach(function(k){ var s=document.createElement('span'); s.className='dameke-pokemon-stat-head'; s.setAttribute('data-stat-key', k); s.textContent=STAT_LABELS_ALL[k]; combinedTable.appendChild(s); });
    var baseRowLabel = document.createElement('span'); baseRowLabel.className='dameke-pokemon-stat-head'; baseRowLabel.textContent='種族値';
    combinedTable.appendChild(baseRowLabel);
    STAT_KEYS_ALL.forEach(function(k){
      var s = document.createElement('span'); s.id = 'damekePokeEdit_base_'+k; s.className='dameke-pokemon-base-stat-cell';
      combinedTable.appendChild(s);
    });
    var evRowLabel = document.createElement('span'); evRowLabel.className='dameke-pokemon-stat-head'; evRowLabel.textContent='努力値';
    combinedTable.appendChild(evRowLabel);
    STAT_KEYS_ALL.forEach(function(k){
      var evInput = document.createElement('input'); evInput.type='number'; evInput.min='0'; evInput.max='32';
      evInput.id = 'damekePokeEdit_ev_'+k;
      evInput.value = (entry.evs && entry.evs[k] != null) ? entry.evs[k] : '0';
      combinedTable.appendChild(evInput);
    });
    var statRowLabel = document.createElement('span'); statRowLabel.className='dameke-pokemon-stat-head'; statRowLabel.textContent='実数値';
    combinedTable.appendChild(statRowLabel);
    STAT_KEYS_ALL.forEach(function(k){
      var s = document.createElement('span'); s.id = 'damekePokeEdit_actual_'+k; s.className='dameke-pokemon-actual-stat-cell';
      combinedTable.appendChild(s);
    });
    form.appendChild(combinedTable);

    // Remaining EV (out of 66, matching this app's own 0-32-scale total cap), live-updating.
    var evRemaining = document.createElement('div');
    evRemaining.id = 'damekePokeEdit_evRemaining';
    evRemaining.className = 'dameke-pokemon-ev-remaining';
    form.appendChild(evRemaining);

    // Same EV quick-preset UI as the calculator itself: pick a pair of stats to max out (32),
    // everything else reset to 0.
    var evPresetWrap = document.createElement('div');
    evPresetWrap.className = 'dameke-pokemon-ev-preset';
    var evPresetLabel = document.createElement('span'); evPresetLabel.className='dameke-pokemon-detail-label'; evPresetLabel.textContent='努力値簡易入力';
    var evPresetSelect = document.createElement('select'); evPresetSelect.id='damekePokeEdit_evPreset';
    var EV_PRESET_OPTIONS = ['選択なし','HA','HB','HC','HD','HS','AB','AC','AD','AS','BC','BD','BS','CD','CS','DS'];
    EV_PRESET_OPTIONS.forEach(function(x){ var op=document.createElement('option'); op.value=x; op.textContent=x; evPresetSelect.appendChild(op); });
    evPresetSelect.value = '選択なし';
    var evResetBtn = document.createElement('button'); evResetBtn.type='button'; evResetBtn.className='dameke-pokemon-ev-reset'; evResetBtn.textContent='リセット';
    evPresetWrap.appendChild(evPresetLabel); evPresetWrap.appendChild(evPresetSelect); evPresetWrap.appendChild(evResetBtn);
    form.appendChild(evPresetWrap);

    function applyEvPreset(preset){
      STAT_KEYS_ALL.forEach(function(k){ var e=q('damekePokeEdit_ev_'+k); if(e) e.value='0'; });
      if(preset && preset!=='選択なし') preset.split('').forEach(function(k){ var e=q('damekePokeEdit_ev_'+k); if(e) e.value='32'; });
      updateEvRemaining();
      updateStatsPreview();
    }
    evPresetSelect.addEventListener('change', function(){ applyEvPreset(evPresetSelect.value); });
    evResetBtn.addEventListener('click', function(){ evPresetSelect.value='選択なし'; applyEvPreset('選択なし'); });

    function updateEvRemaining(){
      var total = 0;
      STAT_KEYS_ALL.forEach(function(k){ var e=q('damekePokeEdit_ev_'+k); total += e ? (parseInt(e.value,10)||0) : 0; });
      var remaining = 66 - total;
      evRemaining.textContent = '残り努力値：' + remaining;
      evRemaining.classList.toggle('dameke-pokemon-ev-remaining-over', remaining < 0);
    }

    // 8. Level + IV (now a single horizontal row, matching the 努力値/実数値 table's layout),
    // tucked into an unobtrusive collapsible directly below the stat table.
    var levelIvDetails = document.createElement('details');
    levelIvDetails.className = 'dameke-pokemon-edit-levelfold';
    var levelIvSummary = document.createElement('summary');
    levelIvSummary.textContent = 'レベル・個体値';
    levelIvDetails.appendChild(levelIvSummary);
    var levelIvGrid = document.createElement('div');
    levelIvGrid.className = 'dameke-pokemon-edit-grid';
    var levelInput = document.createElement('input'); levelInput.type='number'; levelInput.id='damekePokeEdit_level'; levelInput.min='1'; levelInput.max='100'; levelInput.className='dameke-pokemon-level-input';
    levelInput.value = entry.level || '50';
    levelIvGrid.appendChild(makeField('レベル', levelInput));
    levelIvDetails.appendChild(levelIvGrid);
    var ivTable = document.createElement('div');
    ivTable.className = 'dameke-pokemon-combined-stat-table dameke-pokemon-edit-iv-table';
    var ivCorner = document.createElement('span'); ivTable.appendChild(ivCorner);
    STAT_KEYS_ALL.forEach(function(k){ var s=document.createElement('span'); s.className='dameke-pokemon-stat-head'; s.setAttribute('data-stat-key', k); s.textContent=STAT_LABELS_ALL[k]; ivTable.appendChild(s); });
    var ivRowLabel = document.createElement('span'); ivRowLabel.className='dameke-pokemon-stat-head'; ivRowLabel.textContent='個体値';
    ivTable.appendChild(ivRowLabel);
    STAT_KEYS_ALL.forEach(function(k){
      var ivInput = document.createElement('input'); ivInput.type='number'; ivInput.min='0'; ivInput.max='31';
      ivInput.id = 'damekePokeEdit_iv_'+k;
      ivInput.value = (entry.ivs && entry.ivs[k] != null) ? entry.ivs[k] : '31';
      ivTable.appendChild(ivInput);
    });
    levelIvDetails.appendChild(ivTable);
    form.appendChild(levelIvDetails);

    // 9. Moves (4x, each already labeled 技1〜4 so no extra heading) + show-all toggle below,
    // left-aligned.
    var moveGrid = document.createElement('div'); moveGrid.className = 'dameke-pokemon-edit-grid dameke-pokemon-move-grid';
    for(var i=1;i<=4;i++){
      var moveSel = document.createElement('select'); moveSel.id = 'damekePokeEdit_move'+i;
      moveGrid.appendChild(makeField('技'+i, moveSel));
    }
    form.appendChild(moveGrid);
    var showAllLabel = document.createElement('label'); showAllLabel.className='dameke-pokemon-showall-label';
    var showAllCb = document.createElement('input'); showAllCb.type='checkbox'; showAllCb.id='damekePokeEdit_moveShowAll';
    showAllLabel.appendChild(showAllCb); showAllLabel.appendChild(document.createTextNode('全技表示'));
    form.appendChild(showAllLabel);

    // 10. Notes (moved below moves, with a bit of extra separation from the section above)
    var notesArea = document.createElement('textarea'); notesArea.id='damekePokeEdit_notes'; notesArea.rows=2;
    notesArea.value = entry.notes || '';
    var notesWrap = document.createElement('div'); notesWrap.className='dameke-pokemon-edit-grid dameke-pokemon-notes-wrap';
    notesWrap.appendChild(makeField('備考', notesArea, true));
    form.appendChild(notesWrap);

    // Actions
    var actions = document.createElement('div'); actions.className = 'dameke-pokemon-edit-actions';
    var saveBtn = document.createElement('button'); saveBtn.type='button'; saveBtn.className='dameke-pokemon-edit-save'; saveBtn.textContent='保存';
    var cancelBtn = document.createElement('button'); cancelBtn.type='button'; cancelBtn.className='dameke-pokemon-edit-cancel'; cancelBtn.textContent='キャンセル';
    actions.appendChild(saveBtn); actions.appendChild(cancelBtn);
    form.appendChild(actions);

    host.appendChild(form);

    // Wire up: search combos + number pickers via the calculator's own bridged UX helpers
    if(window.__damekeAttachSearchCombo){
      window.__damekeAttachSearchCombo('damekePokeEdit_pokemon');
      window.__damekeAttachSearchCombo('damekePokeEdit_ability');
      window.__damekeAttachSearchCombo('damekePokeEdit_item');
      for(var mi=1;mi<=4;mi++) window.__damekeAttachSearchCombo('damekePokeEdit_move'+mi);
    }
    if(window.__damekeAttachNumberPicker){
      window.__damekeAttachNumberPicker(levelInput, 1, 100);
      STAT_KEYS_ALL.forEach(function(k){
        window.__damekeAttachNumberPicker(q('damekePokeEdit_iv_'+k), 0, 31);
        window.__damekeAttachNumberPicker(q('damekePokeEdit_ev_'+k), 0, 32);
      });
    }

    // Ability options depend on the selected Pokemon -- populate now, restore saved value.
    refreshAbilityOptionsInEditForm();
    abilitySel.value = entry.abilityId || abilitySel.value;

    // Move options depend on the selected Pokemon -- populate now, refresh on change.
    refreshMoveOptionsInEditForm();
    for(var mi2=0;mi2<4;mi2++){
      var msel = q('damekePokeEdit_move'+(mi2+1));
      if(msel) msel.value = (entry.moves && entry.moves[mi2]) ? entry.moves[mi2] : 'none';
    }
    if(window.__damekeAttachSearchCombo){
      // refresh displayed text now that values are set post-population
      for(var mi3=1;mi3<=4;mi3++){ var s=q('damekePokeEdit_move'+mi3); if(s && s._v082hRefreshOptions) s._v082hRefreshOptions(); }
      if(abilitySel._v082hRefreshOptions) abilitySel._v082hRefreshOptions();
    }
    pokemonSel.addEventListener('change', function(){
      refreshAbilityOptionsInEditForm();
      refreshMoveOptionsInEditForm();
      if(pokemonSel._v082hRefreshOptions) pokemonSel._v082hRefreshOptions();
      var selectedForGender = findPokemonById(pokemonSel.value);
      if(selectedForGender && selectedForGender.fixedGender) genderSel.value = selectedForGender.fixedGender;
      updateStatsPreview();
    });
    showAllCb.addEventListener('change', refreshMoveOptionsInEditForm);

    // Live actual-stats preview: recompute whenever anything that feeds getActualStats changes.
    function updateStatsPreview(){
      var previewEntry = {
        pokemonId: pokemonSel.value,
        level: levelInput.value,
        nature: natureSel.value,
        ivs: {}, evs: {}
      };
      STAT_KEYS_ALL.forEach(function(k){
        previewEntry.ivs[k] = q('damekePokeEdit_iv_'+k).value;
        previewEntry.evs[k] = q('damekePokeEdit_ev_'+k).value;
      });
      var actual = computeActualStatsFor(previewEntry);
      STAT_KEYS_ALL.forEach(function(k){
        var cell = q('damekePokeEdit_actual_'+k);
        if(cell) cell.textContent = actual ? actual[k] : '-';
      });
      var selectedPokemon = findPokemonById(pokemonSel.value);
      STAT_KEYS_ALL.forEach(function(k){
        var cell = q('damekePokeEdit_base_'+k);
        if(cell) cell.textContent = (selectedPokemon && selectedPokemon.baseStats && selectedPokemon.baseStats[k]!=null) ? selectedPokemon.baseStats[k] : '-';
      });
      [combinedTable, ivTable].forEach(function(tbl){
        tbl.querySelectorAll('[data-stat-key]').forEach(function(labelEl){
          var k = labelEl.getAttribute('data-stat-key');
          labelEl.classList.remove('dameke-stat-boost', 'dameke-stat-drop');
          var cls = natureColorClass(natureSel.value, k);
          if(cls) labelEl.classList.add(cls);
        });
      });
    }
    [natureSel, levelInput].forEach(function(el){ el.addEventListener('change', updateStatsPreview); el.addEventListener('input', updateStatsPreview); });
    STAT_KEYS_ALL.forEach(function(k){
      var ivEl = q('damekePokeEdit_iv_'+k), evEl = q('damekePokeEdit_ev_'+k);
      [ivEl, evEl].forEach(function(el){ el.addEventListener('change', updateStatsPreview); el.addEventListener('input', updateStatsPreview); });
      evEl.addEventListener('change', updateEvRemaining);
      evEl.addEventListener('input', updateEvRemaining);
    });
    updateStatsPreview();
    updateEvRemaining();

    cancelBtn.addEventListener('click', closePokemonEditor);
    saveBtn.addEventListener('click', function(){ commitEditForm(entry); });
  }

  function commitEditForm(entry){
    var pokemonId = q('damekePokeEdit_pokemon').value;
    if(!pokemonId){ window.alert('ポケモンを選択してください。'); return; }
    var updated = Object.assign({}, entry, {
      pokemonId: pokemonId,
      nickname: q('damekePokeEdit_nickname').value,
      gender: q('damekePokeEdit_gender').value,
      abilityId: q('damekePokeEdit_ability').value,
      itemId: q('damekePokeEdit_item').value,
      teraType: q('damekePokeEdit_tera').value,
      nature: q('damekePokeEdit_nature').value,
      level: q('damekePokeEdit_level').value,
      notes: q('damekePokeEdit_notes').value,
      ivs: {}, evs: {},
      moves: [1,2,3,4].map(function(i){ var v=q('damekePokeEdit_move'+i).value; return v==='none' ? '' : v; })
    });
    STAT_KEYS_ALL.forEach(function(k){
      updated.ivs[k] = q('damekePokeEdit_iv_'+k).value;
      updated.evs[k] = q('damekePokeEdit_ev_'+k).value;
    });
    if(!updated.id){ updated.id = 'pk'+Date.now()+'_'+Math.floor(Math.random()*1000); updated.savedAt = new Date().toISOString(); }
    var list = loadPokemonList();
    var idx = list.findIndex(function(e){ return e.id===updated.id; });
    if(idx>=0) list[idx] = updated; else list.unshift(updated);
    savePokemonListToStorage(list);
    closePokemonEditor();
    renderPokemonList();
  }

  function openPokemonEditor(entry){
    editingEntry = entry;
    q('damekePokemonList').hidden = true;
    q('damekePokemonNewBtn').hidden = true;
    var host = q('damekePokemonEditHost');
    host.hidden = false;
    buildEditForm(entry);
    requestAnimationFrame(function(){ host.scrollIntoView({behavior:'smooth', block:'start'}); });
  }
  function closePokemonEditor(){
    editingEntry = null;
    q('damekePokemonEditHost').hidden = true;
    q('damekePokemonEditHost').innerHTML = '';
    q('damekePokemonList').hidden = false;
    q('damekePokemonNewBtn').hidden = false;
  }

  function newBlankEntry(){
    var d = D();
    return {
      id: null,
      pokemonId: (d.pokemons[0] && d.pokemons[0].id) || '',
      nickname: '', abilityId: 'none', itemId: 'none', teraType: 'なし', nature: 'まじめ',
      level: '50', ivs: emptyStats(), evs: emptyEvs(), moves: ['', '', '', ''], notes: ''
    };
  }

  function initPokemonPanel(){
    var newBtn = q('damekePokemonNewBtn');
    if(newBtn && !newBtn.getAttribute('data-dameke-init')){
      newBtn.setAttribute('data-dameke-init', '1');
      newBtn.addEventListener('click', function(){ openPokemonEditor(newBlankEntry()); });
    }
    var partyBtn = q('damekePartyNewFromPokemonBtn');
    if(partyBtn && !partyBtn.getAttribute('data-dameke-init')){
      partyBtn.setAttribute('data-dameke-init', '1');
      partyBtn.addEventListener('click', function(){ openPartySelectorAndShow(null); });
    }
  }

  // ==================== パーティ管理 (kept in this same IIFE so it can reuse all the
  // ポケモン管理 helpers above directly, rather than bridging across scripts/IIFEs) ====================
  var PARTY_KEY = 'dameke_saved_party_v1';
  var MAX_PARTY_SIZE = 6;

  // Local copy -- the original formatSavedAt() lives in a different IIFE (the menu/history one)
  // and isn't reachable from here.
  function formatSavedAtLocal(iso){
    try{
      var d = new Date(iso);
      var pad = function(n){ return (n<10?'0':'')+n; };
      return d.getFullYear()+'/'+pad(d.getMonth()+1)+'/'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes());
    } catch(e){ return ''; }
  }

  function loadPartyList(){
    try{
      var raw = window.localStorage.getItem(PARTY_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch(e){ return []; }
  }
  function savePartyListToStorage(list){
    try{ window.localStorage.setItem(PARTY_KEY, JSON.stringify(list)); return true; }
    catch(e){ if(window.console) console.error('[party] save failed:', e); return false; }
  }

  function openPartySelectorAndShow(party){
    if(window.__damekeShowPanel) window.__damekeShowPanel('party');
    openPartySelector(party);
  }

  // ---- Selector (create/edit): the Pokemon-management list, with checkboxes, up to 6 picks.
  var selectorEditingParty = null;
  function openPartySelector(party){
    selectorEditingParty = party;
    var listHost = q('damekePartyList');
    var newBtn = q('damekePartyNewBtn');
    if(listHost) listHost.hidden = true;
    if(newBtn) newBtn.hidden = true;
    var host = q('damekePartySelectorHost');
    host.hidden = false;
    buildPartySelectorForm(party);
    requestAnimationFrame(function(){ host.scrollIntoView({behavior:'smooth', block:'start'}); });
  }
  function closePartySelector(){
    selectorEditingParty = null;
    var host = q('damekePartySelectorHost');
    host.hidden = true;
    host.innerHTML = '';
    var listHost = q('damekePartyList');
    var newBtn = q('damekePartyNewBtn');
    if(listHost) listHost.hidden = false;
    if(newBtn) newBtn.hidden = false;
  }

  function buildPartySelectorForm(party){
    var host = q('damekePartySelectorHost');
    host.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.className = 'dameke-party-selector-form';
    var heading = document.createElement('h3');
    heading.textContent = party ? 'パーティを編集（最大6匹まで選択）' : '新しいパーティ（最大6匹まで選択）';
    wrap.appendChild(heading);

    var nameLabel = document.createElement('label');
    nameLabel.className = 'dameke-party-name-field';
    var nameLabelText = document.createElement('span'); nameLabelText.textContent = 'パーティ名';
    var nameInput = document.createElement('input');
    nameInput.type = 'text'; nameInput.id = 'damekePartyEdit_name';
    nameInput.placeholder = '（パーティ名未設定）';
    nameInput.value = (party && party.name) ? party.name : '';
    nameLabel.appendChild(nameLabelText); nameLabel.appendChild(nameInput);
    wrap.appendChild(nameLabel);

    var countLine = document.createElement('div');
    countLine.className = 'dameke-party-selector-count';
    wrap.appendChild(countLine);

    var pokemonList = loadPokemonList();
    var selected = (party && party.memberIds) ? party.memberIds.slice() : [];

    function updateCount(){
      countLine.textContent = '選択中: ' + selected.length + ' / ' + MAX_PARTY_SIZE;
    }

    var listBox = document.createElement('div');
    listBox.className = 'dameke-party-selector-list';
    if(!pokemonList.length){
      var empty = document.createElement('div');
      empty.className = 'dameke-pokemon-empty';
      empty.textContent = 'ポケモン管理に保存されたポケモンがまだありません。先にポケモンを保存してください。';
      listBox.appendChild(empty);
    }
    function renderCards(){
      listBox.innerHTML = '';
      pokemonList.forEach(function(entry){
        var isSelected = selected.indexOf(entry.id) >= 0;
        listBox.appendChild(buildSelectablePokemonCard(entry, isSelected, function(){
          if(isSelected){
            selected = selected.filter(function(id){ return id !== entry.id; });
          } else {
            if(selected.length >= MAX_PARTY_SIZE){ window.alert('パーティは最大6匹までです。'); return; }
            selected.push(entry.id);
          }
          updateCount();
          renderCards();
        }));
      });
    }
    renderCards();
    wrap.appendChild(listBox);
    updateCount();

    var actions = document.createElement('div');
    actions.className = 'dameke-pokemon-edit-actions';
    var saveBtn = document.createElement('button'); saveBtn.type='button'; saveBtn.className='dameke-pokemon-edit-save'; saveBtn.textContent = party ? '保存' : '作成';
    var cancelBtn = document.createElement('button'); cancelBtn.type='button'; cancelBtn.className='dameke-pokemon-edit-cancel'; cancelBtn.textContent='キャンセル';
    saveBtn.addEventListener('click', function(){
      if(!selected.length){ window.alert('少なくとも1匹は選択してください。'); return; }
      commitPartySelector(party, selected, nameInput.value);
    });
    cancelBtn.addEventListener('click', closePartySelector);
    actions.appendChild(saveBtn); actions.appendChild(cancelBtn);
    wrap.appendChild(actions);

    host.appendChild(wrap);
  }

  function commitPartySelector(party, selectedIds, name){
    var list = loadPartyList();
    if(party && party.id){
      var idx = list.findIndex(function(p){ return p.id === party.id; });
      var updated = Object.assign({}, party, { memberIds: selectedIds, name: name || '' });
      if(idx >= 0) list[idx] = updated; else list.unshift(updated);
    } else {
      list.unshift({ id: 'party'+Date.now()+'_'+Math.floor(Math.random()*1000), savedAt: new Date().toISOString(), memberIds: selectedIds, name: name || '' });
    }
    savePartyListToStorage(list);
    closePartySelector();
    renderPartyList();
  }

  function deleteParty(id){
    savePartyListToStorage(loadPartyList().filter(function(p){ return p.id !== id; }));
    renderPartyList();
  }

  // ---- Vertical stat table (rows = HP/攻撃/防御/特攻/特防/素早さ, columns = 努力値/実数値) --
  // used for the compact party-member card, where horizontal space is at a premium.
  // ---- Compact member card for the party list/export (smaller thumb, fewer detail rows, moves
  // wrapped to 2 lines, vertical stat table).
  function buildCompactMemberCard(entry){
    var card = document.createElement('div');
    card.className = 'dameke-party-member-card';
    if(!entry){ card.classList.add('dameke-party-member-empty'); card.textContent='（空き枠）'; return card; }
    var pokemon = findPokemonById(entry.pokemonId);
    var pokemonName = pokemon ? pokemon.name : (entry.pokemonId || '(不明)');
    var actual = computeActualStatsFor(entry);

    var head = document.createElement('div');
    head.className = 'dameke-party-member-head';
    head.appendChild(buildPokemonThumbFor(pokemonName));
    var titleWrap = document.createElement('div');
    var title = document.createElement('div');
    title.className = 'dameke-pokemon-card-title';
    title.textContent = entry.nickname ? (entry.nickname + '（' + pokemonName + '）') : pokemonName;
    titleWrap.appendChild(title);
    var sub = document.createElement('div');
    sub.className = 'dameke-pokemon-card-sub';
    var types = pokemon && Array.isArray(pokemon.types) ? pokemon.types.join('・') : '-';
    sub.textContent = entry.gender ? (types + '　' + genderDisplayText(entry.gender)) : types;
    titleWrap.appendChild(sub);
    head.appendChild(titleWrap);
    card.appendChild(head);

    var detailGrid = document.createElement('div');
    detailGrid.className = 'dameke-pokemon-detail-grid';
    detailGrid.appendChild(buildLabeledRow('特性', entry.abilityId && entry.abilityId!=='none' ? entry.abilityId : 'なし'));
    detailGrid.appendChild(buildLabeledRow('持ち物', entry.itemId && entry.itemId!=='none' ? entry.itemId : 'なし'));
    detailGrid.appendChild(buildLabeledRow('テラスタル', entry.teraType || 'なし'));
    var moveNames = (entry.moves||[]).map(function(id){ var m=id?findMoveById(id):null; return m ? m.name : '(未設定)'; });
    detailGrid.appendChild(buildMovesRow('技', moveNames));
    card.appendChild(detailGrid);

    card.appendChild(buildCombinedStatTable(entry, actual));
    return card;
  }

  function buildPartyCard(party){
    var card = document.createElement('div');
    card.className = 'dameke-party-card';

    var titleEl = document.createElement('div');
    titleEl.className = 'dameke-party-card-title';
    titleEl.textContent = party.name || '（パーティ名未設定）';
    card.appendChild(titleEl);

    var meta = document.createElement('div');
    meta.className = 'dameke-history-card-meta';
    var sub = document.createElement('span');
    sub.className = 'dameke-history-card-sub';
    sub.textContent = formatSavedAtLocal(party.savedAt);
    var actions = document.createElement('div');
    actions.className = 'dameke-history-card-actions';
    var imgBtn = document.createElement('button');
    imgBtn.type='button'; imgBtn.textContent='画像出力';
    imgBtn.addEventListener('click', function(){ exportPartyImage(party); });
    var editBtn = document.createElement('button');
    editBtn.type='button'; editBtn.className='dameke-history-load'; editBtn.textContent='編集';
    editBtn.addEventListener('click', function(){ openPartySelector(party); });
    var delBtn = document.createElement('button');
    delBtn.type='button'; delBtn.textContent='削除';
    delBtn.addEventListener('click', function(){
      if(window.confirm('このパーティを削除しますか？')) deleteParty(party.id);
    });
    actions.appendChild(imgBtn); actions.appendChild(editBtn); actions.appendChild(delBtn);
    meta.appendChild(sub); meta.appendChild(actions);
    card.appendChild(meta);

    var pokemonList = loadPokemonList();
    var grid = document.createElement('div');
    grid.className = 'dameke-party-member-grid';
    for(var i=0;i<MAX_PARTY_SIZE;i++){
      var memberId = (party.memberIds||[])[i];
      var entry = memberId ? pokemonList.find(function(e){ return e.id===memberId; }) : null;
      grid.appendChild(buildCompactMemberCard(entry));
    }
    card.appendChild(grid);
    return card;
  }

  function renderPartyList(){
    var host = q('damekePartyList');
    if(!host) return;
    host.innerHTML = '';
    var list = loadPartyList();
    if(!list.length){
      var empty = document.createElement('div');
      empty.className = 'dameke-pokemon-empty';
      empty.textContent = '保存されたパーティはまだありません。';
      host.appendChild(empty);
      return;
    }
    list.forEach(function(party){ host.appendChild(buildPartyCard(party)); });
  }

  // ---- Image export: renders the party onto a canvas (readable at mobile width) and offers it
  // via the Web Share API (so on mobile, "Save to Photos"/camera roll is one of the share
  // options) with a plain download link as a fallback for browsers without share support.
  function exportPartyImage(party){
    // Render a fresh copy of the actual on-screen card (not a hand-drawn approximation), so the
    // exported image matches what's shown in the browser. The action buttons (編集/削除/画像出力)
    // are stripped since they don't belong in a shareable image.
    var card = buildPartyCard(party);
    var actionsEl = card.querySelector('.dameke-history-card-actions');
    if(actionsEl) actionsEl.remove();
    card.style.width = '640px';

    // Off-screen but laid-out host, so offsetWidth/offsetHeight and image loading are accurate.
    var host = document.createElement('div');
    host.style.cssText = 'position:fixed;top:0;left:0;width:640px;background:#fff;visibility:hidden;z-index:-1;pointer-events:none;';
    host.appendChild(card);
    document.body.appendChild(host);

    var thumbs = card.querySelectorAll('img');
    thumbs.forEach(function(img){ img.crossOrigin = 'anonymous'; });

    function cleanupHost(){ if(host.parentNode) host.parentNode.removeChild(host); }

    function afterImagesSettled(cb){
      var pending = Array.prototype.filter.call(thumbs, function(img){ return !img.complete; });
      if(!pending.length){ cb(); return; }
      var remaining = pending.length;
      pending.forEach(function(img){
        function done(){ remaining--; if(remaining<=0) cb(); }
        img.addEventListener('load', done, { once:true });
        img.addEventListener('error', done, { once:true });
      });
    }

    function collectStyleText(){
      var text = '';
      Array.prototype.forEach.call(document.styleSheets, function(sheet){
        try{
          Array.prototype.forEach.call(sheet.cssRules || [], function(rule){ text += rule.cssText + '\n'; });
        } catch(e){ /* cross-origin stylesheet -- skip, nothing we control lives there */ }
      });
      return text;
    }

    function render(stripImages){
      var cardHtml = card.outerHTML;
      if(stripImages){
        var tmp = document.createElement('div');
        tmp.innerHTML = cardHtml;
        tmp.querySelectorAll('img').forEach(function(img){ img.remove(); });
        cardHtml = tmp.innerHTML;
      }
      var w = card.offsetWidth || 640, h = card.offsetHeight || 400;
      var styleText = collectStyleText();
      var xml = '<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'">' +
        '<foreignObject width="100%" height="100%">' +
        '<div xmlns="http://www.w3.org/1999/xhtml" style="width:'+w+'px;">' +
        '<style>'+styleText+'</style>' + cardHtml +
        '</div></foreignObject></svg>';
      var svgBlob = new Blob([xml], { type:'image/svg+xml;charset=utf-8' });
      var svgUrl = URL.createObjectURL(svgBlob);
      var img = new Image();
      img.onload = function(){
        var scale = 2; // export at 2x for readability when viewed/printed
        var canvas = document.createElement('canvas');
        canvas.width = w*scale; canvas.height = h*scale;
        var ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,w,h);
        try{
          ctx.drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(svgUrl);
          canvas.toBlob(function(blob){
            cleanupHost();
            if(!blob){ window.alert('画像の生成に失敗しました。'); return; }
            saveOrShareBlob(blob, (party.name||'party')+'.png');
          }, 'image/png');
        } catch(e){
          URL.revokeObjectURL(svgUrl);
          // Cross-origin sprite images can taint the canvas even with CORS set, since the SVG
          // foreignObject route is treated more strictly by some browsers -- retry once with the
          // sprite images stripped out, so the text content still exports successfully.
          if(!stripImages){
            render(true);
          } else {
            cleanupHost();
            window.alert('画像の生成に失敗しました。');
          }
        }
      };
      img.onerror = function(){
        URL.revokeObjectURL(svgUrl);
        if(!stripImages){ render(true); }
        else { cleanupHost(); window.alert('画像の生成に失敗しました。'); }
      };
      img.src = svgUrl;
    }

    afterImagesSettled(function(){ render(false); });
  }

  // Download is the primary, always-available path (works well on PC and Android/desktop
  // browsers). On platforms where the Web Share API can share files (mainly iOS/Android), an
  // additional share option is offered via a follow-up confirm, since that's the closest a web
  // page can get to a direct "save to camera roll" flow -- true silent camera-roll writes aren't
  // possible from a web page for security reasons.
  function saveOrShareBlob(blob, filename){
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);

    if(navigator.canShare){
      var file = new File([blob], filename, { type: 'image/png' });
      if(navigator.canShare({ files: [file] })){
        if(window.confirm('画像をダウンロードしました。共有シート（写真アプリへの保存など）も開きますか？')){
          navigator.share({ files: [file] }).catch(function(){});
        }
      }
    }
  }

  function initPartyPanel(){
    var newBtn = q('damekePartyNewBtn');
    if(newBtn && !newBtn.getAttribute('data-dameke-init')){
      newBtn.setAttribute('data-dameke-init', '1');
      newBtn.addEventListener('click', function(){ openPartySelector(null); });
    }
  }

  window.__damekeRenderPokemonList = renderPokemonList;
  window.__damekeInitPokemonPanel = initPokemonPanel;
  window.__damekeRenderPartyList = renderPartyList;
  window.__damekeInitPartyPanel = initPartyPanel;
})();
