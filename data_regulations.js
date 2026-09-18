// だめけー Web -- チャンピオンズ・レギュレーション対応表
//
// data.js(ポケモン基礎データ)とは別ファイルに分離している。レギュレーションは今後も
// 改定のたびにポケモンが追加されていく見込みのため、その都度手を入れる箇所を
// data.js本体(自動生成された大きなファイル)から切り離し、この小さなファイルの
// 配列を書き換えるだけで済むようにするための設計。
//
// レギュレーションM-A: レギュレーションM-B/M-C以外の、覚える技が設定されている
//   (=チャンピオンズに参戦済みの)ポケモン。明示的なリストは持たず、実行時に
//   「M-B/M-Cに含まれない」かつ「data_learnsets.jsに採用技データがある」の2条件で判定する。
// レギュレーションM-B追加 / レギュレーションM-C追加: 明示的に指定されたポケモン名の配列。
//   新しいレギュレーションが追加されたら、このファイルに新しい配列(REGULATION_MD等)を
//   追加し、下のTAG_ORDER・LABELS・regulationOf()にも同様に反映すること。
(function(){
  "use strict";

  var REGULATION_MB = [
    "メガライチュウX","メガライチュウY","ラフレシア","ハリーセン","ジュカイン","メガジュカイン",
    "バシャーモ","メガバシャーモ","ラグラージ","メガラグラージ","クチート","メガクチート",
    "メタグロス","メガメタグロス","ムクホーク","メガムクホーク","ムシャーナ","ペンドラー",
    "メガペンドラー","ズルズキン","メガズルズキン","シビルドン","メガシビルドン","カエンジシ",
    "メガカエンジシ","カラマネロ","メガカラマネロ","ガメノデス","メガガメノデス","ドラミドロ",
    "メガドラミドロ","オーロンゲ","タイレーツ","メガタイレーツ","ハリーマン","ハカドッグ",
    "コノヨザル","サーフゴー"
  ];
  var REGULATION_MC = [
    "プクリン","ペルシアン","ペルシアン(アローラ)","カモネギ","バリヤード","マルノーム",
    "メガアブソルZ","ボーマンダ","メガボーマンダ","メガガブリアスZ","メガルカリオZ","ゴーゴート",
    "グソクムシャ","メガグソクムシャ","ゴリランダー","エースバーン","インテレオン","フォクスライ",
    "ストリンダー(ハイ)","ストリンダー(ロー)","オトスパス","ニャイキング","ネギガナイト","バチンウニ",
    "イエッサン(オス)","イエッサン(メス)","パーモット","オリーヴァ","イキリンコ(グリーンフェザー)",
    "イキリンコ(イエローフェザー)","イキリンコ(ブルーフェザー)","イキリンコ(ホワイトフェザー)",
    "マフィティフ","セグレイブ","メガセグレイブ"
  ];

  var mbSet = Object.create(null); REGULATION_MB.forEach(function(n){ mbSet[n] = true; });
  var mcSet = Object.create(null); REGULATION_MC.forEach(function(n){ mcSet[n] = true; });

  // data_learnsets.js側のキー形式(フォルム名を「ベース名(サフィックス)」ではなく
  // 「ベース名_サフィックス」で持つ)に合わせて変換する。app_search.jsのlearnsetKeyFor()と
  // 同じロジック。
  function learnsetKeyFor(name){
    var m = String(name || '').match(/^(.+?)\(([^)]+)\)$/);
    return m ? (m[1] + '_' + m[2]) : name;
  }

  // ポケモン名から、該当するレギュレーションタグ('mb'|'mc'|'ma'|null)を判定する。
  // M-B/M-Cのいずれにも含まれず、かつチャンピオンズの採用技データが存在する場合のみ
  // M-Aとして扱う(採用技データ自体がない=チャンピオンズ未参戦のポケモンは、
  // いずれのレギュレーションにも属さない)。
  function regulationOf(name){
    if(mcSet[name]) return 'mc';
    if(mbSet[name]) return 'mb';
    var LS = window.DAMEKE_LEARNSETS;
    if(LS && LS.hasLearnset(learnsetKeyFor(name))) return 'ma';
    return null;
  }

  var TAG_ORDER = ['ma', 'mb', 'mc'];
  var LABELS = {
    ma: 'レギュレーションM-A',
    mb: 'レギュレーションM-B追加',
    mc: 'レギュレーションM-C追加'
  };

  window.DAMEKE_REGULATIONS = Object.freeze({
    mb: REGULATION_MB.slice(),
    mc: REGULATION_MC.slice(),
    tagOrder: TAG_ORDER.slice(),
    labels: LABELS,
    regulationOf: regulationOf
  });
})();
