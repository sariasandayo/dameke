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

  // ---- 採用率データ(data/data.usage.json) ----
  // ポケモン検索と、ダメージ計算の「採用率上位の提案」で共通に使う。読み込みは1回だけ。
  // 取得できない・形式が違う場合は null のまま(呼び出し側は「データなし」として何も表示しない)。
  var usageData = null;
  var usageLoadPromise = null;
  // 最低限のスキーマ検証。ここを通らないデータは一切使用しない(ブラウザ側は安全性優先)。
  function validateUsageData(obj){
    if(!obj || typeof obj !== 'object') return 'obj not an object';
    if(obj.schemaVersion !== 1) return 'schemaVersion !== 1 (got ' + obj.schemaVersion + ')';
    if(!obj.source || obj.source.sourceType !== 'pokemon-champions-in-game') return 'source.sourceType mismatch';
    if(!obj.formats || typeof obj.formats !== 'object') return 'formats missing/not object';
    if(!obj.formats.singles && !obj.formats.doubles) return 'both formats.singles and formats.doubles are empty';
    return null; // null = 検証OK
  }
  // 解決値は、検証に通ったデータ(なければ null)。失敗しても reject しない。
  function loadUsageData(){
    if(usageLoadPromise) return usageLoadPromise;
    // ブラウザのHTTPキャッシュ(cache:'no-store')に加え、GitHub Pages側のCDNキャッシュも
    // 回避するため、日付ベースのクエリを付与する(このデータは1日1回しか更新されないため、
    // 日付単位での区別で十分)。
    var cacheBustDate = new Date().toISOString().slice(0, 10);
    var url = 'data/data.usage.json?v=' + cacheBustDate;
    var resolvedUrl = (function(){ try{ return new URL(url, document.baseURI).href; }catch(e){ return url; } })();
    usageLoadPromise = fetch(url, { cache: 'no-store' })
      .then(function(res){ if(!res.ok) throw new Error('HTTP ' + res.status + '（URL: ' + resolvedUrl + '）'); return res.json(); })
      .then(function(json){
        var invalidReason = validateUsageData(json);
        if(invalidReason){ console.warn('[使用率] スキーマ検証に失敗したため無効化します。理由: ' + invalidReason); return null; }
        usageData = json;
        return usageData;
      })
      .catch(function(e){
        // 使用率データがまだ存在しない/取得できない場合は、使用率関連の表示なしで動作させる
        // だけでよいので、警告のみに留める(エラー表示やダイアログは出さない)。
        console.warn('[使用率] 読み込みに失敗しました。使用率機能なしで動作します。', e);
        return null;
      });
    return usageLoadPromise;
  }
  // format('singles'|'doubles')でのポケモン p の採用率データ。なければ null。
  // メガシンカのフォルムはデータがないので、メガシンカ前のポケモンのデータを返す。
  function usageEntryForPokemon(format, p){
    if(!usageData || !p) return null;
    var fd = usageData.formats && usageData.formats[format];
    var table = fd && fd.pokemon;
    if(!table) return null;
    if(table[p.name]) return table[p.name];
    if(!/^メガ[XYZ]?$/.test(p.formKey || '') || String(p.name).indexOf('メガ') !== 0) return null;
    var baseName = String(p.name).replace(/^メガ/, '').replace(/[XYZ]$/, '');
    if(table[baseName]) return table[baseName];
    // 名前から決まらない場合(例: フラエッテ)は、同じ種族でデータのあるフォルムが1つだけならそれを使う。
    var list = (window.DAMEKE_DATA && window.DAMEKE_DATA.pokemons) || [];
    var same = list.filter(function(x){ return x.speciesKey === p.speciesKey && table[x.name]; });
    return same.length === 1 ? table[same[0].name] : null;
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
    formatDateTime: formatDateTime,
    loadUsageData: loadUsageData,
    usageEntryForPokemon: usageEntryForPokemon
  };
})();
