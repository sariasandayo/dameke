// だめけー Web -- 画面側(app*.js)と data_regulations.js で共通に使う小さな関数・対応表。
// 以前は同じものが各ファイルにそれぞれ書かれていた。他のどのファイルにも依存しないので、
// index.html では最初に読み込む。
(function(){
  'use strict';

  // タイプ名 -> 色分け用CSSクラスの接尾辞(style.css の .dameke-type-xxx)。
  var TYPE_COLOR_MAP = { 'なし':'none', 'ノーマル':'normal', 'ほのお':'fire', 'みず':'water', 'でんき':'electric', 'くさ':'grass', 'こおり':'ice', 'かくとう':'fighting', 'どく':'poison', 'じめん':'ground', 'ひこう':'flying', 'エスパー':'psychic', 'むし':'bug', 'いわ':'rock', 'ゴースト':'ghost', 'ドラゴン':'dragon', 'あく':'dark', 'はがね':'steel', 'フェアリー':'fairy', 'ステラ':'stellar' };
  function typeColorClass(t){ return 'dameke-type-' + (TYPE_COLOR_MAP[t] || 'none'); }
  // タイプの色付きバッジ(HTML文字列)。
  function typeBadgesHtml(types){
    return (types||[]).map(function(t){ return '<span class="dameke-party-type-badge '+typeColorClass(t)+'">'+t+'</span>'; }).join('');
  }
  // タイプ相性の倍率 -> 相性表のセルのCSSクラス。
  function matchupClassFor(rate){
    if(rate === 0) return 'dameke-search-matchup-immune';
    if(rate >= 4) return 'dameke-search-matchup-weak4';
    if(rate === 2) return 'dameke-search-matchup-weak2';
    if(rate === 1) return 'dameke-search-matchup-neutral';
    if(rate === 0.5) return 'dameke-search-matchup-resist2';
    return 'dameke-search-matchup-resist4';
  }

  // 性格 -> [上がる能力, 下がる能力](補正なしの性格は [null, null])。
  var NATURE_STAT_MAP = {
    'さみしがり':['A','B'], 'いじっぱり':['A','C'], 'やんちゃ':['A','D'], 'ゆうかん':['A','S'],
    'ずぶとい':['B','A'], 'わんぱく':['B','C'], 'のうてんき':['B','D'], 'のんき':['B','S'],
    'ひかえめ':['C','A'], 'おっとり':['C','B'], 'うっかりや':['C','D'], 'れいせい':['C','S'],
    'おだやか':['D','A'], 'おとなしい':['D','B'], 'しんちょう':['D','C'], 'なまいき':['D','S'],
    'おくびょう':['S','A'], 'せっかち':['S','B'], 'ようき':['S','C'], 'むじゃき':['S','D'],
    'がんばりや':[null,null], 'すなお':[null,null], 'てれや':[null,null], 'きまぐれ':[null,null], 'まじめ':[null,null]
  };

  // 覚える技データ(data_learnsets.js)のキー。フォルム名を「ベース名(サフィックス)」ではなく
  // 「ベース名_サフィックス」で持っているので、それに合わせて変換する。
  function learnsetKeyFor(name){
    var m = String(name || '').match(/^(.+?)\(([^)]+)\)$/);
    return m ? (m[1] + '_' + m[2]) : name;
  }
  // チャンピオンズ参戦済み(覚える技データがある)かどうか。
  function hasChampionsEntry(p){
    var LS = window.DAMEKE_LEARNSETS;
    return !!(LS && LS.hasLearnset(learnsetKeyFor(p.name)));
  }

  // <select> に items({id, name}) を並べる。placeholder を渡すと先頭に値が空の選択肢を置く。
  function fillSelect(select, items, placeholder){
    select.textContent = '';
    if(placeholder){ var op0=document.createElement('option'); op0.value=''; op0.textContent=placeholder; select.appendChild(op0); }
    items.forEach(function(item){ var op=document.createElement('option'); op.value=item.id; op.textContent=item.name; select.appendChild(op); });
  }

  // カタカナ -> ひらがな・小文字化(ひらがなでの検索用)。
  function kanaNormalize(s){
    return String(s||'').replace(/[ァ-ヶ]/g, function(c){ return String.fromCharCode(c.charCodeAt(0) - 0x60); }).toLowerCase();
  }

  // 保存日時の表示(YYYY/MM/DD HH:MM、端末のタイムゾーン)。
  function formatDateTime(iso){
    try{
      var d = new Date(iso);
      var pad = function(n){ return (n<10?'0':'')+n; };
      return d.getFullYear()+'/'+pad(d.getMonth()+1)+'/'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes());
    } catch(e){ return ''; }
  }

  window.DAMEKE_COMMON = {
    TYPE_COLOR_MAP: TYPE_COLOR_MAP,
    typeColorClass: typeColorClass,
    typeBadgesHtml: typeBadgesHtml,
    matchupClassFor: matchupClassFor,
    NATURE_STAT_MAP: NATURE_STAT_MAP,
    learnsetKeyFor: learnsetKeyFor,
    hasChampionsEntry: hasChampionsEntry,
    fillSelect: fillSelect,
    kanaNormalize: kanaNormalize,
    formatDateTime: formatDateTime
  };
})();
