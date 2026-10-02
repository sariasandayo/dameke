// v2.5.0 習得技比較(覚える技比較)
// ポケモンを2体選び、覚える技(data_learnsets.js)を 物理 / 特殊 / 変化 ごとに
// 「1体目だけが覚える技」「共通して覚える技」「2体目だけが覚える技」に分けて表示する。
// 選べるのは覚える技が登録されているポケモンのみ。計算は行わない(表示だけのツール)。
(function(){
  'use strict';
  function q(id){ return document.getElementById(id); }
  var DATA = window.DAMEKE_DATA;
  var COMMON = window.DAMEKE_COMMON;

  var CATEGORIES = ['物理', '特殊', '変化'];
  // 技の並び順: タイプ順(タイプ相性表と同じ順) -> 技データの順(50音順)。
  var TYPE_ORDER = ['ノーマル','ほのお','みず','でんき','くさ','こおり','かくとう','どく','じめん','ひこう','エスパー','むし','いわ','ゴースト','ドラゴン','あく','はがね','フェアリー'];
  var SIDES = ['A', 'B'];
  var selected = { A: null, B: null };

  // 技名 -> { move, order }。覚える技データは技名で持っているので、技名で引く。
  var moveIndex = null;
  function getMoveIndex(){
    if(moveIndex) return moveIndex;
    moveIndex = Object.create(null);
    DATA.moves.forEach(function(m, i){ moveIndex[m.name] = { move: m, order: i }; });
    return moveIndex;
  }
  function learnsetOf(pokemon){
    var LS = window.DAMEKE_LEARNSETS;
    if(!LS || !pokemon) return [];
    return LS.getLearnset(COMMON.learnsetKeyFor(pokemon.name)) || [];
  }

  // 戻り値: { 物理:{onlyA:[],common:[],onlyB:[]}, 特殊:{...}, 変化:{...} }(中身は技データ)。
  // 技データにない技名は分類できないので表示しない(現行データでは該当なし)。
  function compareLearnsets(pokemonA, pokemonB){
    var index = getMoveIndex();
    var setA = Object.create(null), setB = Object.create(null);
    learnsetOf(pokemonA).forEach(function(n){ setA[n] = true; });
    learnsetOf(pokemonB).forEach(function(n){ setB[n] = true; });
    var result = {};
    CATEGORIES.forEach(function(c){ result[c] = { onlyA: [], common: [], onlyB: [] }; });
    var names = Object.keys(setA);
    Object.keys(setB).forEach(function(n){ if(!setA[n]) names.push(n); });
    names.forEach(function(n){
      var entry = index[n];
      if(!entry || !result[entry.move.category]) return;
      var bucket = setA[n] && setB[n] ? 'common' : (setA[n] ? 'onlyA' : 'onlyB');
      result[entry.move.category][bucket].push(entry);
    });
    function typeRank(t){ var i = TYPE_ORDER.indexOf(t); return i < 0 ? TYPE_ORDER.length : i; }
    CATEGORIES.forEach(function(c){
      ['onlyA', 'common', 'onlyB'].forEach(function(b){
        result[c][b] = result[c][b]
          .sort(function(x, y){ return (typeRank(x.move.type) - typeRank(y.move.type)) || (x.order - y.order); })
          .map(function(e){ return e.move; });
      });
    });
    return result;
  }

  // ==================== 表示 ====================
  function el(tag, className, text){
    var node = document.createElement(tag);
    if(className) node.className = className;
    if(text != null) node.textContent = text;
    return node;
  }
  function moveChip(move){
    var chip = el('span', 'dameke-learncmp-chip ' + COMMON.typeColorClass(move.type), move.name);
    var info = [move.type, move.category];
    if(move.category !== '変化'){
      info.push('威力' + (move.power ? move.power : '-'));
    }
    if(move.accuracy != null && move.accuracy !== '') info.push('命中' + move.accuracy);
    chip.title = info.join(' / ');
    return chip;
  }
  function groupBox(kind, label, moves){
    var box = el('div', 'dameke-learncmp-group dameke-learncmp-group-' + kind);
    var head = el('div', 'dameke-learncmp-group-head');
    head.appendChild(el('span', 'dameke-learncmp-group-label', label));
    head.appendChild(el('span', 'dameke-learncmp-group-count', moves.length + '件'));
    box.appendChild(head);
    var list = el('div', 'dameke-learncmp-chips');
    if(moves.length) moves.forEach(function(m){ list.appendChild(moveChip(m)); });
    else list.appendChild(el('span', 'dameke-learncmp-empty', 'なし'));
    box.appendChild(list);
    return box;
  }

  function renderSlot(side){
    var pokemon = selected[side];
    var imageHost = q('damekeLearnCmpImage' + side);
    imageHost.innerHTML = '';
    if(pokemon){
      var img = window.__damekeBuildPokemonImage ? window.__damekeBuildPokemonImage(pokemon.name, function(){ imageHost.innerHTML = ''; }) : null;
      if(img) imageHost.appendChild(img);
    }
    q('damekeLearnCmpTypes' + side).innerHTML = pokemon ? COMMON.typeBadgesHtml(pokemon.types) : '';
  }

  function renderResult(){
    var summaryHost = q('damekeLearnCmpSummaryHost');
    var host = q('damekeLearnCmpResultHost');
    summaryHost.innerHTML = '';
    host.innerHTML = '';
    var a = selected.A, b = selected.B;
    if(!a || !b){
      host.appendChild(el('div', 'dameke-adjust-summary-note', 'ポケモンを2体選択してください。'));
      return;
    }
    var result = compareLearnsets(a, b);
    var labels = { onlyA: a.name + 'のみ', common: '共通', onlyB: b.name + 'のみ' };
    var kinds = { onlyA: 'a', common: 'common', onlyB: 'b' };
    // 表示順: 1体目のみ・2体目のみ(上段に左右で並べる) -> 共通(下段)
    var order = ['onlyA', 'onlyB', 'common'];

    // 全体の件数(物理・特殊・変化の合計)
    order.forEach(function(key){
      var total = CATEGORIES.reduce(function(sum, c){ return sum + result[c][key].length; }, 0);
      var pill = el('div', 'dameke-learncmp-summary-item dameke-learncmp-group-' + kinds[key]);
      pill.appendChild(el('span', 'dameke-learncmp-summary-label', labels[key]));
      pill.appendChild(el('span', 'dameke-learncmp-summary-count', total + '件'));
      summaryHost.appendChild(pill);
    });
    if(a.id === b.id){
      host.appendChild(el('div', 'dameke-adjust-summary-note dameke-learncmp-same-note', '同じポケモンが選択されています。'));
    }

    CATEGORIES.forEach(function(c){
      var section = el('section', 'dameke-learncmp-category');
      var count = order.reduce(function(sum, key){ return sum + result[c][key].length; }, 0);
      var head = el('div', 'dameke-learncmp-category-head');
      head.appendChild(el('h4', 'dameke-learncmp-category-title', c));
      head.appendChild(el('span', 'dameke-learncmp-category-count', '全' + count + '件'));
      section.appendChild(head);
      var grid = el('div', 'dameke-learncmp-groups');
      order.forEach(function(key){ grid.appendChild(groupBox(kinds[key], labels[key], result[c][key])); });
      section.appendChild(grid);
      host.appendChild(section);
    });
  }

  function renderAll(){
    SIDES.forEach(renderSlot);
    renderResult();
  }

  // いちばん長い技名の文字数(覚える技データに出てくる技のみ)。技名の列幅を決めるのに使う(style.css)。
  function applyMoveNameWidth(){
    var LS = window.DAMEKE_LEARNSETS;
    var max = 0;
    if(LS && LS.data){
      Object.keys(LS.data).forEach(function(key){
        LS.data[key].forEach(function(name){ if(name.length > max) max = name.length; });
      });
    }
    if(max) q('damekeLearnCmpResultSection').style.setProperty('--dameke-learncmp-chars', String(max));
  }
  // ポケモン名を手入力(ひらがな・カタカナ検索)できる欄にする。まだなっていなければ付ける。
  function ensureSearchCombos(){
    if(!window.__damekeAttachSearchCombo) return;
    SIDES.forEach(function(side){
      var select = q('damekeLearnCmpPokemon' + side);
      if(!select.getAttribute('data-v082h-search')) window.__damekeAttachSearchCombo(select);
    });
  }

  function init(){
    var pool = DATA.pokemons.filter(COMMON.hasChampionsEntry);
    applyMoveNameWidth();
    SIDES.forEach(function(side){
      var select = q('damekeLearnCmpPokemon' + side);
      COMMON.fillSelect(select, pool, '指定なし');
      select.addEventListener('change', function(){
        var id = select.value;
        selected[side] = id ? (DATA.pokemons.find(function(p){ return p.id === id; }) || null) : null;
        renderSlot(side);
        renderResult();
      });
    });
    ensureSearchCombos();
    renderAll();
  }

  window.__damekeRenderLearnComparePanel = function(){
    if(!q('damekeLearnCmpPokemonA').options.length) init();
    ensureSearchCombos();
  };
  // テスト用(画面からは使わない)
  window.__damekeCompareLearnsets = compareLearnsets;

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
