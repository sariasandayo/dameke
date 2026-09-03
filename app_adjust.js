// v1.3.0 攻撃・防御調整ツール
// Reads the calculator's current input as a fixed snapshot (see window.__damekeSnapshotCalculatorInput
// in app.js), then re-runs CALC.calculateDamage() many times with only the chosen side's nature/EVs
// varied, to visualize how much EV investment is needed to cross a given damage threshold.
// calculateDamage() itself is a pure function (verified: no DOM access, no shared mutable state), so
// calling it repeatedly here is safe and does not touch or disturb the live calculator's own state.
(function(){
  'use strict';
  function q(id){ return document.getElementById(id); }

  var NATURE_STAT_MAP = {
    'さみしがり':['A','B'], 'いじっぱり':['A','C'], 'やんちゃ':['A','D'], 'ゆうかん':['A','S'],
    'ずぶとい':['B','A'], 'わんぱく':['B','C'], 'のうてんき':['B','D'], 'のんき':['B','S'],
    'ひかえめ':['C','A'], 'おっとり':['C','B'], 'うっかりや':['C','D'], 'れいせい':['C','S'],
    'おだやか':['D','A'], 'おとなしい':['D','B'], 'しんちょう':['D','C'], 'なまいき':['D','S'],
    'おくびょう':['S','A'], 'せっかち':['S','B'], 'ようき':['S','C'], 'むじゃき':['S','D'],
    'がんばりや':[null,null], 'すなお':[null,null], 'てれや':[null,null], 'きまぐれ':[null,null], 'まじめ':[null,null]
  };
  var ALL_NATURE_NAMES = Object.keys(NATURE_STAT_MAP);
  var STAT_KEYS = ['H','A','B','C','D','S'];

  var STAT_DEPENDENT_MOVE_NAMES = ['フォトンゲイザー', 'てんこがすめつぼうのひかり', 'テラバースト', 'シェルアームズ'];
  function isStatDependentCategoryMove(move){
    if(!move) return false;
    if(STAT_DEPENDENT_MOVE_NAMES.indexOf(move.name) >= 0) return true;
    var H = window.DAMEKE_DATA_HELPERS;
    return !!(H && H.moveTagByName && H.moveTagByName(move.name, 'teraCluster'));
  }
  function normalizeCategory(cat){
    cat = String(cat||'');
    if(cat.indexOf('物理')>=0) return '物理';
    if(cat.indexOf('特殊')>=0) return '特殊';
    if(cat.indexOf('変化')>=0) return '変化';
    return cat;
  }

  var currentMode = 'attacker';
  var selectedNatures = {};
  var selectedNaturesForMoveId = null;
  var manualEvSpec = { H:null, A:null, B:null, C:null, D:null, S:null };
  var selectedThresholdPick = null; // { nature, statKey, ev }

  function getSnapshot(){
    return window.__damekeSnapshotCalculatorInput ? window.__damekeSnapshotCalculatorInput() : null;
  }

  function defaultNaturesForMove(move, mode){
    if(isStatDependentCategoryMove(move)) return ['いじっぱり','ようき','ひかえめ','おくびょう'];
    var cat = normalizeCategory(move.category);
    if(mode === 'attacker'){
      if(cat === '物理') return ['いじっぱり','ようき'];
      if(cat === '特殊') return ['ひかえめ','おくびょう'];
    } else {
      if(cat === '物理') return ['ずぶとい','がんばりや'];
      if(cat === '特殊') return ['しんちょう','がんばりや'];
    }
    return ['がんばりや'];
  }

  // ---- Which stat actually drives this move's damage, for a given nature ----
  // Two layers, checked in order:
  // 1. A handful of moves override the "source stat" outright, independent of category --
  //    confirmed directly against calc.js's own runtime patch (the one piece of code that
  //    actually decides which stat feeds the attack-side multiplier): ボディプレス always uses
  //    the attacker's own B, イカサマ always uses the *defender's* A (meaning the attacker's own
  //    stat investment has no effect on this move's damage at all -- returns null so the UI can
  //    say so rather than plotting a misleadingly flat "sweep").
  // 2. Otherwise, category (物理→A, 特殊→C) applies as usual -- but for the handful of moves
  //    whose category itself depends on stats (see isStatDependentCategoryMove), that category
  //    can come out differently for different natures (a nature that boosts C over A can flip
  //    which side of the comparison wins even before any EV is added), so this is decided fresh
  //    per nature rather than once for the whole tool.
  function probeEvs(){
    var evs = {};
    STAT_KEYS.forEach(function(k){ evs[k] = manualEvSpec[k] != null ? manualEvSpec[k] : 0; });
    return evs;
  }
  function decideRelevantStatKey(snapshot, natureName){
    if(snapshot.move.name === 'ボディプレス') return 'B';
    if(snapshot.move.name === 'イカサマ') return null;
    var CALC = window.DAMEKE_CALC;
    var baseStats = snapshot.options.attackerStats;
    var probeStats = Object.assign({}, baseStats, { nature: natureName, evs: probeEvs() });
    var probeOptions = Object.assign({}, snapshot.options, { attackerStats: probeStats });
    var input = { attacker: snapshot.attacker, defender: snapshot.defender, move: snapshot.move, attackerLevel: snapshot.attackerLevel, defenderLevel: snapshot.defenderLevel, options: probeOptions };
    var result = CALC.calculateDamage(input);
    return result.effectiveCategory === '物理' ? 'A' : 'C';
  }
  // Groups the selected natures by which stat each one actually sweeps -- for ordinary moves
  // this collapses to a single group (every nature agrees), but for the stats-dependent-category
  // moves different natures can genuinely need different axes, so each gets its own graph/table
  // rather than being forced onto a shared, sometimes-wrong axis.
  function groupNaturesByStatKey(snapshot, natures){
    var groups = {};
    var order = [];
    natures.forEach(function(n){
      var key = decideRelevantStatKey(snapshot, n) || '__na__';
      if(!groups[key]){ groups[key] = []; order.push(key); }
      groups[key].push(n);
    });
    return { groups: groups, order: order };
  }

  function computeSweepRange(sweptStatKey){
    var otherSum = 0;
    STAT_KEYS.forEach(function(k){
      if(k === sweptStatKey) return;
      otherSum += manualEvSpec[k] != null ? manualEvSpec[k] : 0;
    });
    var start = manualEvSpec[sweptStatKey] != null ? manualEvSpec[sweptStatKey] : 0;
    var max = Math.min(32, 66 - otherSum);
    if(max < start) max = start;
    return { start: start, max: max, otherSum: otherSum };
  }
  function buildAttackerEvs(sweptStatKey, sweptEv){
    var evs = { H:0, A:0, B:0, C:0, D:0, S:0 };
    STAT_KEYS.forEach(function(k){
      evs[k] = (k === sweptStatKey) ? sweptEv : (manualEvSpec[k] != null ? manualEvSpec[k] : 0);
    });
    return evs;
  }
  function runAttackerSweep(snapshot, natures, statKey, range){
    var CALC = window.DAMEKE_CALC;
    var baseStats = snapshot.options.attackerStats;
    var lines = {};
    natures.forEach(function(natureName){
      var points = [];
      for(var ev=range.start; ev<=range.max; ev++){
        var stats = Object.assign({}, baseStats, { nature: natureName, evs: buildAttackerEvs(statKey, ev) });
        var options = Object.assign({}, snapshot.options, { attackerStats: stats });
        var input = { attacker: snapshot.attacker, defender: snapshot.defender, move: snapshot.move, attackerLevel: snapshot.attackerLevel, defenderLevel: snapshot.defenderLevel, options: options };
        var result = CALC.calculateDamage(input);
        points.push({ ev: ev, minDamage: result.minDamage, maxDamage: result.maxDamage, minRate: result.minRate, maxRate: result.maxRate, category: result.effectiveCategory });
      }
      lines[natureName] = points;
    });
    return lines;
  }

  // ---- SVG graph ----
  var NATURE_COLORS = ['#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed', '#0891b2'];
  function renderAttackerGraph(host, lines, natures, defenderMaxHp, range, statKey){
    var w = 640, h = 340, padL = 52, padR = 16, padT = 16, padB = 36;
    var innerW = w - padL - padR, innerH = h - padT - padB;
    var evSpan = Math.max(1, range.max - range.start);

    var maxDamage = 0;
    natures.forEach(function(n){ (lines[n]||[]).forEach(function(p){ if(p.maxDamage > maxDamage) maxDamage = p.maxDamage; }); });
    var yMax = Math.max(maxDamage, defenderMaxHp) * 1.08;
    if(yMax <= 0) yMax = 10;

    function xPos(ev){ return padL + ((ev-range.start)/evSpan) * innerW; }
    function yPos(val){ return padT + innerH - (val/yMax) * innerH; }

    var svg = '<svg viewBox="0 0 '+w+' '+h+'" xmlns="http://www.w3.org/2000/svg" class="dameke-adjust-svg">';
    var steps = 5;
    for(var s=0; s<=steps; s++){
      var val = Math.round(yMax * s / steps);
      var y = yPos(val);
      svg += '<line x1="'+padL+'" y1="'+y+'" x2="'+(w-padR)+'" y2="'+y+'" class="dameke-adjust-grid"/>';
      svg += '<text x="'+(padL-6)+'" y="'+(y+3)+'" text-anchor="end" class="dameke-adjust-axis-label">'+val+'</text>';
    }
    var xTicks = [];
    for(var t=0;t<=4;t++) xTicks.push(Math.round(range.start + evSpan*t/4));
    xTicks.forEach(function(ev){
      var x = xPos(ev);
      svg += '<text x="'+x+'" y="'+(h-padB+16)+'" text-anchor="middle" class="dameke-adjust-axis-label">'+ev+'</text>';
    });
    svg += '<text x="'+(w/2)+'" y="'+(h-4)+'" text-anchor="middle" class="dameke-adjust-axis-title">'+statKey+'努力値 ('+range.start+'-'+range.max+')</text>';

    if(defenderMaxHp > 0){
      [1,2,3,4].forEach(function(n){
        var val = defenderMaxHp / n;
        if(val > yMax) return;
        var y = yPos(val);
        svg += '<line x1="'+padL+'" y1="'+y+'" x2="'+(w-padR)+'" y2="'+y+'" class="dameke-adjust-hp-line"/>';
        svg += '<text x="'+(w-padR-4)+'" y="'+(y-3)+'" text-anchor="end" class="dameke-adjust-hp-label">確定'+n+'発ライン</text>';
      });
    }
    natures.forEach(function(natureName, idx){
      var points = lines[natureName];
      if(!points || !points.length) return;
      var color = NATURE_COLORS[idx % NATURE_COLORS.length];
      var bandPath = 'M ' + points.map(function(p){ return xPos(p.ev)+','+yPos(p.maxDamage); }).join(' L ');
      bandPath += ' L ' + points.slice().reverse().map(function(p){ return xPos(p.ev)+','+yPos(p.minDamage); }).join(' L ') + ' Z';
      svg += '<path d="'+bandPath+'" fill="'+color+'" fill-opacity="0.15" stroke="none"/>';
      var maxLine = 'M ' + points.map(function(p){ return xPos(p.ev)+','+yPos(p.maxDamage); }).join(' L ');
      var minLine = 'M ' + points.map(function(p){ return xPos(p.ev)+','+yPos(p.minDamage); }).join(' L ');
      svg += '<path d="'+maxLine+'" fill="none" stroke="'+color+'" stroke-width="2"/>';
      svg += '<path d="'+minLine+'" fill="none" stroke="'+color+'" stroke-width="2" stroke-dasharray="4 3"/>';
    });
    svg += '</svg>';
    var legend = '<div class="dameke-adjust-legend">' + natures.map(function(natureName, idx){
      var color = NATURE_COLORS[idx % NATURE_COLORS.length];
      return '<span class="dameke-adjust-legend-item"><span class="dameke-adjust-legend-swatch" style="background:'+color+'"></span>'+natureName+'（実線=最高乱数, 破線=最低乱数）</span>';
    }).join('') + '</div>';
    host.innerHTML = svg + legend;
  }

  // ---- Dynamic threshold detection ----
  function computeDynamicThresholds(points, defenderMaxHp, natureName, statKey){
    if(!defenderMaxHp) return [];
    var rows = [];
    var prevConfirmed = null, prevPossible = null;
    points.forEach(function(p){
      var confirmedN = p.minDamage > 0 ? Math.ceil(defenderMaxHp / p.minDamage) : Infinity;
      var possibleN = p.maxDamage > 0 ? Math.ceil(defenderMaxHp / p.maxDamage) : Infinity;
      if(confirmedN !== prevConfirmed){
        if(prevConfirmed !== null) rows.push({ nature: natureName, statKey: statKey, ev: p.ev, kind: '確定', n: confirmedN, minDamage: p.minDamage, maxDamage: p.maxDamage });
        prevConfirmed = confirmedN;
      }
      if(possibleN !== prevPossible){
        if(prevPossible !== null) rows.push({ nature: natureName, statKey: statKey, ev: p.ev, kind: '乱数', n: possibleN, minDamage: p.minDamage, maxDamage: p.maxDamage });
        prevPossible = possibleN;
      }
    });
    return rows;
  }
  function renderThresholdTable(host, allRows){
    selectedThresholdPick = null;
    var saveBtn = q('damekeAdjustSaveBtn');
    if(saveBtn) saveBtn.disabled = true;
    if(!allRows.length){
      host.innerHTML = '<div class="dameke-adjust-coming-soon">この範囲では、確定n発・乱数n発の数字が変化する地点がありませんでした。</div>';
      return;
    }
    var html = '<table class="dameke-adjust-threshold-table"><thead><tr><th></th><th>性格</th><th>確定数</th><th>必要努力値</th><th>ダメージ幅</th></tr></thead><tbody>';
    allRows.forEach(function(row, i){
      html += '<tr>'
        + '<td><input type="radio" name="damekeAdjustThresholdPick" data-idx="'+i+'"></td>'
        + '<td>'+row.nature+'</td>'
        + '<td>'+row.kind+row.n+'発</td>'
        + '<td>'+row.statKey+'：'+row.ev+'</td>'
        + '<td>'+row.minDamage+' ～ '+row.maxDamage+'</td>'
        + '</tr>';
    });
    html += '</tbody></table>';
    host.innerHTML = html;
    host.querySelectorAll('input[type="radio"]').forEach(function(radio){
      radio.addEventListener('change', function(){
        var row = allRows[parseInt(radio.getAttribute('data-idx'), 10)];
        selectedThresholdPick = { nature: row.nature, statKey: row.statKey, ev: row.ev };
        if(saveBtn) saveBtn.disabled = false;
      });
    });
  }

  // ---- 努力値指定 (attacker mode only): a table shaped like the calculator's own stat grid
  // (種族値/努力値 rows across H/A/B/C/D/S columns) rather than a plain list, and with no
  // "(可変軸)" annotation -- the graph/table below already say which stat ends up swept.
  function renderManualEvSpec(host, snapshot){
    host.innerHTML = '';
    var title = document.createElement('div');
    title.className = 'dameke-adjust-nature-title';
    title.textContent = '努力値指定（任意）：指定した分は固定し、残りだけを自由に動かします';
    host.appendChild(title);
    var base = snapshot.attacker.baseStats;
    var table = document.createElement('div');
    table.className = 'dameke-adjust-evspec-table';
    table.style.gridTemplateColumns = '4em repeat(6,minmax(0,1fr))';
    var corner = document.createElement('div');
    table.appendChild(corner);
    STAT_KEYS.forEach(function(k){ var h=document.createElement('div'); h.className='dameke-adjust-evspec-head'; h.textContent=k; table.appendChild(h); });
    var baseLabel = document.createElement('div'); baseLabel.className='dameke-adjust-evspec-rowlabel'; baseLabel.textContent='種族値'; table.appendChild(baseLabel);
    STAT_KEYS.forEach(function(k){ var c=document.createElement('div'); c.className='dameke-adjust-evspec-cell'; c.textContent=base[k]; table.appendChild(c); });
    var evLabel = document.createElement('div'); evLabel.className='dameke-adjust-evspec-rowlabel'; evLabel.textContent='努力値'; table.appendChild(evLabel);
    STAT_KEYS.forEach(function(k){
      var cell = document.createElement('div');
      cell.className = 'dameke-adjust-evspec-cell';
      var input = document.createElement('input');
      input.type = 'number'; input.min = '0'; input.max = '32'; input.placeholder = '-';
      input.className = 'dameke-adjust-evspec-input';
      input.value = manualEvSpec[k] != null ? manualEvSpec[k] : '';
      input.addEventListener('change', function(){
        var v = input.value === '' ? null : Math.max(0, Math.min(32, parseInt(input.value,10)||0));
        manualEvSpec[k] = v;
        renderAndRun();
      });
      cell.appendChild(input);
      table.appendChild(cell);
    });
    host.appendChild(table);
  }

  // ---- Nature selector: collapsed into a <details> so it doesn't dominate the screen. ----
  function renderNatureSelector(host, move, mode){
    if(!selectedNaturesForMoveId || selectedNaturesForMoveId !== (move.id+'|'+mode)){
      selectedNatures = {};
      defaultNaturesForMove(move, mode).forEach(function(n){ selectedNatures[n] = true; });
      selectedNaturesForMoveId = move.id+'|'+mode;
    }
    host.innerHTML = '';
    var details = document.createElement('details');
    details.className = 'dameke-adjust-nature-details';
    var summary = document.createElement('summary');
    summary.className = 'dameke-adjust-nature-summary';
    function summaryText(){ return '表示する性格（'+Object.keys(selectedNatures).length+'件選択中）'; }
    summary.textContent = summaryText();
    details.appendChild(summary);
    var grid = document.createElement('div');
    grid.className = 'dameke-adjust-nature-grid';
    ALL_NATURE_NAMES.forEach(function(natureName){
      var label = document.createElement('label');
      label.className = 'dameke-adjust-nature-check';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!selectedNatures[natureName];
      cb.addEventListener('change', function(){
        if(cb.checked) selectedNatures[natureName] = true; else delete selectedNatures[natureName];
        summary.textContent = summaryText();
        renderAndRun();
      });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(natureName));
      grid.appendChild(label);
    });
    details.appendChild(grid);
    host.appendChild(details);
  }

  // ---- Summary card ----
  function buildMiniThumb(japaneseName){
    var wrap = document.createElement('div');
    wrap.className = 'dameke-history-thumb';
    var map = window.DAMEKE_POKEMON_IMAGE_IDS;
    var numId = map ? map[japaneseName] : null;
    if(numId){
      var img = document.createElement('img');
      img.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/' + numId + '.png';
      img.alt = japaneseName; img.loading = 'lazy';
      img.onerror = function(){ wrap.classList.add('dameke-history-thumb-missing'); wrap.innerHTML = ''; };
      wrap.appendChild(img);
    } else {
      wrap.classList.add('dameke-history-thumb-missing');
    }
    return wrap;
  }
  // Renders the defender's full stat profile (nature + EV per stat) -- in attacker-adjustment
  // mode the defender side is entirely fixed, so unlike the attacker's own nature/EV (which this
  // tool is actively sweeping), it's certain information worth always showing, not hidden info.
  function buildDefenderStatBlock(snapshot){
    var wrap = document.createElement('div');
    wrap.className = 'dameke-adjust-defender-stats';
    var title = document.createElement('div');
    title.className = 'dameke-adjust-detail-subtitle';
    title.textContent = '防御側ステータス（性格：'+snapshot.options.defenderStats.nature+'）';
    wrap.appendChild(title);
    var CALC = window.DAMEKE_CALC;
    var actual = CALC.getActualStats(snapshot.defender, snapshot.defenderLevel, snapshot.options.defenderStats);
    var base = snapshot.defender.baseStats;
    var table = document.createElement('div');
    table.className = 'dameke-adjust-evspec-table';
    table.style.gridTemplateColumns = '4em repeat(6,minmax(0,1fr))';
    var corner = document.createElement('div'); table.appendChild(corner);
    STAT_KEYS.forEach(function(k){ var h=document.createElement('div'); h.className='dameke-adjust-evspec-head'; h.textContent=k; table.appendChild(h); });
    function addRow(label, valueFn){
      var rowLabel = document.createElement('div'); rowLabel.className='dameke-adjust-evspec-rowlabel'; rowLabel.textContent=label; table.appendChild(rowLabel);
      STAT_KEYS.forEach(function(k){ var c=document.createElement('div'); c.className='dameke-adjust-evspec-cell'; c.textContent=valueFn(k); table.appendChild(c); });
    }
    addRow('種族値', function(k){ return base[k]; });
    addRow('努力値', function(k){ return snapshot.options.defenderStats.evs[k]; });
    addRow('実数値', function(k){ return actual[k]; });
    wrap.appendChild(table);
    return wrap;
  }
  function renderSummary(host, snapshot){
    host.innerHTML = '';
    // The note explaining where this data came from sits at the very top of the box, as the
    // first thing read.
    var note = document.createElement('div');
    note.className = 'dameke-adjust-summary-note';
    note.textContent = 'この条件は計算機の現在の入力から引き継いでいます。変更するには「条件変更」を押してください。';
    host.appendChild(note);

    var row = document.createElement('div');
    row.className = 'dameke-history-header-row';
    row.appendChild(buildMiniThumb(snapshot.attacker.name));
    var textCol = document.createElement('div');
    textCol.className = 'dameke-history-text-col';
    var namesLine = document.createElement('div');
    namesLine.className = 'dameke-history-title';
    namesLine.textContent = snapshot.attacker.name + ' → ' + snapshot.defender.name;
    var moveLine = document.createElement('div');
    moveLine.className = 'dameke-history-move-line';
    moveLine.textContent = snapshot.move.name;
    textCol.appendChild(namesLine); textCol.appendChild(moveLine);
    row.appendChild(textCol);
    row.appendChild(buildMiniThumb(snapshot.defender.name));
    host.appendChild(row);

    // Always visible (not tucked inside 詳細): the defender's full stat profile is entirely
    // fixed in attacker-adjustment mode, so it's certain information worth surfacing directly,
    // not hidden behind a toggle the way the other, more situational conditions are.
    host.appendChild(buildDefenderStatBlock(snapshot));

    var detailToggle = document.createElement('button');
    detailToggle.type = 'button';
    detailToggle.className = 'dameke-adjust-detail-toggle';
    detailToggle.textContent = '詳細を表示';
    var detailBody = document.createElement('div');
    detailBody.className = 'dameke-adjust-detail-body';
    detailBody.hidden = true;
    var o = snapshot.options;
    var lines = [];
    function addIfSet(label, value){ if(value && value!=='none' && value!=='なし') lines.push(label+'：'+value); }
    addIfSet('攻撃側特性', o.attackerAbilityId);
    addIfSet('攻撃側持ち物', o.attackerItemId);
    addIfSet('攻撃側テラスタル', o.attackerTeraType);
    addIfSet('防御側特性', o.defenderAbilityId);
    addIfSet('防御側持ち物', o.defenderItemId);
    addIfSet('防御側テラスタル', o.defenderTeraType);
    addIfSet('天候', o.weather);
    addIfSet('フィールド', o.field);
    detailBody.innerHTML = lines.length ? lines.map(function(l){ return '<div class="dameke-adjust-detail-line">'+l+'</div>'; }).join('') : '<div class="dameke-adjust-detail-line">その他の特記条件はありません。</div>';
    detailToggle.addEventListener('click', function(){
      detailBody.hidden = !detailBody.hidden;
      detailToggle.textContent = detailBody.hidden ? '詳細を表示' : '詳細を閉じる';
    });
    host.appendChild(detailToggle);
    host.appendChild(detailBody);
  }

  // ---- 保存 ----
  function saveSelectedToPokemonManagement(snapshot){
    if(!selectedThresholdPick) return;
    var evs = buildAttackerEvs(selectedThresholdPick.statKey, selectedThresholdPick.ev);
    var entry = {
      id: null,
      pokemonId: snapshot.attacker.id,
      nickname: '',
      abilityId: snapshot.options.attackerAbilityId || 'none',
      itemId: snapshot.options.attackerItemId || 'none',
      teraType: snapshot.options.attackerTeraType || 'なし',
      nature: selectedThresholdPick.nature,
      level: snapshot.attackerLevel,
      ivs: snapshot.options.attackerStats.ivs,
      evs: evs,
      moves: ['', '', '', ''],
      notes: ''
    };
    if(window.__damekeOpenPokemonEditorWithEntry) window.__damekeOpenPokemonEditorWithEntry(entry);
  }

  // ---- Main render/run ----
  function renderAndRun(){
    var summaryHost = q('damekeAdjustSummary');
    var evSpecHost = q('damekeAdjustEvSpec');
    var natureHost = q('damekeAdjustNatureSelect');
    var graphHost = q('damekeAdjustGraphHost');
    var thresholdHost = q('damekeAdjustThresholdHost');
    var saveBtn = q('damekeAdjustSaveBtn');
    if(!summaryHost || !graphHost) return;

    var snapshot = getSnapshot();
    if(!snapshot || !snapshot.attacker || !snapshot.defender || !snapshot.move){
      summaryHost.innerHTML = '<div class="dameke-adjust-summary-note">計算機側でポケモン・技を選択してから、こちらのツールをご利用ください。</div>';
      if(evSpecHost) evSpecHost.innerHTML = '';
      natureHost.innerHTML = ''; graphHost.innerHTML = ''; thresholdHost.innerHTML = '';
      if(saveBtn) saveBtn.disabled = true;
      return;
    }

    renderSummary(summaryHost, snapshot);

    if(currentMode === 'defender'){
      if(evSpecHost) evSpecHost.innerHTML = '';
      natureHost.innerHTML = '';
      graphHost.innerHTML = '<div class="dameke-adjust-coming-soon">防御側調整は準備中です。まずは攻撃側調整からご利用ください。</div>';
      thresholdHost.innerHTML = '';
      if(saveBtn) saveBtn.disabled = true;
      return;
    }

    if(evSpecHost) renderManualEvSpec(evSpecHost, snapshot);
    renderNatureSelector(natureHost, snapshot.move, currentMode);
    var natures = Object.keys(selectedNatures);
    if(!natures.length){
      graphHost.innerHTML = '<div class="dameke-adjust-coming-soon">性格を1つ以上選択してください。</div>';
      thresholdHost.innerHTML = '';
      if(saveBtn) saveBtn.disabled = true;
      return;
    }

    var grouped = groupNaturesByStatKey(snapshot, natures);
    var CALC = window.DAMEKE_CALC;
    var probeInput = { attacker: snapshot.attacker, defender: snapshot.defender, move: snapshot.move, attackerLevel: snapshot.attackerLevel, defenderLevel: snapshot.defenderLevel, options: snapshot.options };
    var probeResult = CALC.calculateDamage(probeInput);
    var defenderMaxHp = probeResult.minRate ? Math.round(probeResult.minDamage / (probeResult.minRate/100)) : 0;

    graphHost.innerHTML = '';
    var allThresholdRows = [];
    var hadRealGroup = false;
    grouped.order.forEach(function(statKey){
      var groupNatures = grouped.groups[statKey];
      if(statKey === '__na__'){
        var msg = document.createElement('div');
        msg.className = 'dameke-adjust-coming-soon';
        msg.textContent = (groupNatures.join('・')) + '：' + snapshot.move.name + 'は攻撃側の努力値の影響を受けない技のため、ここでは調整できません。';
        graphHost.appendChild(msg);
        return;
      }
      hadRealGroup = true;
      var range = computeSweepRange(statKey);
      var lines = runAttackerSweep(snapshot, groupNatures, statKey, range);
      var groupHost = document.createElement('div');
      groupHost.className = 'dameke-adjust-graph-group';
      graphHost.appendChild(groupHost);
      renderAttackerGraph(groupHost, lines, groupNatures, defenderMaxHp, range, statKey);
      groupNatures.forEach(function(natureName){
        allThresholdRows = allThresholdRows.concat(computeDynamicThresholds(lines[natureName], defenderMaxHp, natureName, statKey));
      });
    });
    if(!hadRealGroup && !graphHost.innerHTML) graphHost.innerHTML = '<div class="dameke-adjust-coming-soon">選択した性格では調整できる項目がありませんでした。</div>';

    renderThresholdTable(thresholdHost, allThresholdRows);

    if(saveBtn){
      saveBtn.onclick = function(){ saveSelectedToPokemonManagement(snapshot); };
    }
  }
  window.__damekeRenderAdjustPanel = renderAndRun;

  function setMode(mode){
    currentMode = mode;
    var atkBtn = q('damekeAdjustModeAttacker'), defBtn = q('damekeAdjustModeDefender');
    if(atkBtn) atkBtn.classList.toggle('dameke-adjust-mode-active', mode==='attacker');
    if(defBtn) defBtn.classList.toggle('dameke-adjust-mode-active', mode==='defender');
    renderAndRun();
  }
  window.__damekeSetAdjustMode = setMode;

  function init(){
    var atkBtn = q('damekeAdjustModeAttacker'), defBtn = q('damekeAdjustModeDefender');
    if(atkBtn) atkBtn.addEventListener('click', function(){ setMode('attacker'); });
    if(defBtn) defBtn.addEventListener('click', function(){ setMode('defender'); });
    var goCalcBtn = q('damekeAdjustGoCalcBtn');
    if(goCalcBtn) goCalcBtn.addEventListener('click', function(){ if(window.__damekeShowPanel) window.__damekeShowPanel('calculator'); });
    var goAdjustAtk = q('damekeGoAdjustAttackerBtn');
    if(goAdjustAtk) goAdjustAtk.addEventListener('click', function(){ if(window.__damekeShowPanel) window.__damekeShowPanel('adjust'); setMode('attacker'); });
    var goAdjustDef = q('damekeGoAdjustDefenderBtn');
    if(goAdjustDef) goAdjustDef.addEventListener('click', function(){ if(window.__damekeShowPanel) window.__damekeShowPanel('adjust'); setMode('defender'); });
    setMode('attacker');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
