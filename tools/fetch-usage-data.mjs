#!/usr/bin/env node
// 使用率データ取得・変換スクリプト (v2.1.0)
//
// データソース: Pokemon Champions Battle Data (https://championsbattledata.com/)
// - ファンメイドの非公式サイト。運営者自身の明言により、データはPokemon Championsの
//   ランクバトルプレイから収集されている(Showdownではない)。
// - 利用規約(/api-rules/)で、出典表記付きでのキャッシュ・商用利用を含む再利用を許可。
//
// 設計方針:
// - このスクリプトはGitHub Actionsから1日1回だけ実行される想定。
// - 失敗した場合は既存の data/data.usage.json を一切変更しない(exit code 1で終了)。
// - シングル/ダブルの片方だけ取得に失敗した場合は、成功した方だけ更新し、失敗した方は
//   前回の値をそのまま維持する。
// - だめけー側のポケモンID(日本語名)と、championsbattledata側のslug/showdownIdを
//   対応付けるため、PokeAPIの英語名を橋渡しとして使う(だめけー側は既に
//   data_pokemon_images.js で 日本語名→PokeAPI数値ID を持っているため、これに
//   PokeAPIの pokemon-species 一覧(数値ID→英語名)を組み合わせて 日本語名→英語名 を得て、
//   championsbattledata側のslugと突き合わせる)。

import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(REPO_ROOT, 'data', 'data.usage.json');
const POKEMON_IMAGE_IDS_PATH = path.join(REPO_ROOT, 'data_pokemon_images.js');
const ABILITY_JA_TO_EN_PATH = path.join(__dirname, 'name-maps', 'abilities-ja-en.json');
const ITEM_IMAGE_SLUGS_PATH = path.join(REPO_ROOT, 'data_item_images.js');
const MOVE_JA_TO_EN_PATH = path.join(__dirname, 'name-maps', 'moves-ja-en.json');
const NATURE_JA_TO_EN_PATH = path.join(__dirname, 'name-maps', 'natures-ja-en.json');

const CHAMPIONS_API = 'https://championsbattledata.com/api';
const POKEAPI_SPECIES_LIST = 'https://pokeapi.co/api/v2/pokemon-species?limit=5000';
const POKEAPI_POKEMON_LIST = 'https://pokeapi.co/api/v2/pokemon?limit=5000';

const FETCH_TIMEOUT_MS = 20000;
const RETRY_COUNT = 3;
const RETRY_DELAY_MS = 1500;

const summaryLines = [];
function summary(line) { summaryLines.push(line); console.log(line); }
function writeSummaryAndExit(code) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    appendFileSync(summaryPath, '## 使用率データ更新結果\n\n' + summaryLines.map(l => '- ' + l).join('\n') + '\n');
  }
  process.exit(code);
}

// ---- 汎用フェッチ (タイムアウト + 短いリトライ) ----
async function fetchJsonWithRetry(url, { retries = RETRY_COUNT } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        // HTMLエラーページ等が返ってきた場合を弾く
        throw new Error(`Unexpected content-type "${contentType}" for ${url}`);
      }
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch (e) {
        throw new Error(`JSON parse failed for ${url}: ${e.message}`);
      }
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (attempt < retries) await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
    }
  }
  throw lastErr;
}

function readJsonIfExists(p) {
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return null; }
}

// ---- だめけー側 日本語名 -> PokeAPI数値ID (既存の data_pokemon_images.js を再利用) ----
function loadDamekePokemonImageIds() {
  const raw = readFileSync(POKEMON_IMAGE_IDS_PATH, 'utf-8');
  const jsonLike = raw.replace('window.DAMEKE_POKEMON_IMAGE_IDS = ', '').trim().replace(/;\s*$/, '');
  // このファイルはシングルクォートのJS風オブジェクトリテラルなので、JSON.parseではなく
  // Function経由で安全に評価する(このスクリプト自身がdamekeーリポジトリ内で完結しており、
  // 外部入力ではないため許容する)。
  // eslint-disable-next-line no-new-func
  const obj = new Function('return (' + jsonLike + ')')();
  return obj; // { '日本語名': 数値ID, ... }
}

// ---- だめけー側 日本語名 -> 英語slug (持ち物) : 既に本番の持ち物画像表示機能で使用・検証
// 済みの data_item_images.js をそのまま再利用する。個別に日英対応表を作り直す必要はない。
function loadDamekeItemImageSlugs() {
  const raw = readFileSync(ITEM_IMAGE_SLUGS_PATH, 'utf-8');
  const jsonLike = raw.replace('window.DAMEKE_ITEM_IMAGE_SLUGS = ', '').trim().replace(/;\s*$/, '');
  // eslint-disable-next-line no-new-func
  const obj = new Function('return (' + jsonLike + ')')();
  return obj; // { '日本語名': '英語slug', ... }
}

// ---- PokeAPI 数値ID -> 英語slug 一覧を取得。pokemon-species(基本種、id 1〜1025程度)だけでは
// メガシンカ等のフォルム(idが10000番台の"pokemon"リソース側にのみ存在する)を拾えないため、
// pokemon-species と pokemon の両方の一覧を取得してマージする。
async function loadPokeApiIdToEnglishSlug() {
  const map = {};
  const [speciesData, pokemonData] = await Promise.all([
    fetchJsonWithRetry(POKEAPI_SPECIES_LIST, { retries: RETRY_COUNT }),
    fetchJsonWithRetry(POKEAPI_POKEMON_LIST, { retries: RETRY_COUNT }),
  ]);
  for (const entry of speciesData.results || []) {
    const m = String(entry.url || '').match(/\/pokemon-species\/(\d+)\/?$/);
    if (!m) continue;
    map[Number(m[1])] = entry.name;
  }
  for (const entry of pokemonData.results || []) {
    const m = String(entry.url || '').match(/\/pokemon\/(\d+)\/?$/);
    if (!m) continue;
    // pokemon側のidは基本種と重複するもの(同じ数値)もあるが、フォルム固有の高いidは
    // ここでしか手に入らないため、基本種側の値を上書きしないよう、まだ無い時だけ設定する。
    const id = Number(m[1]);
    if (map[id] == null) map[id] = entry.name;
  }
  return map;
}

// だめけー側の表記ゆれ(フォルム名の括弧書きなど)を落とし、素のポケモン名部分だけ取り出す。
// 例: "ロトム(ウォッシュ)" -> "ロトム"
function baseJapaneseName(name) {
  const m = String(name || '').match(/^(.+?)[（(]/);
  return m ? m[1] : name;
}

// PokeAPI(本編シリーズのデータ)には存在しない、Pokemon Champions独自のフォルム
// (「メガ○○Z」等)は、PokeAPI経由の橋渡しでは原理的に対応できない。件数が少ないため、
// 判明している分だけこの上書きマップで直接 championsbattledata 側のslugを指定する。
// 新しい独自フォルムが追加された場合は、ここに追記する。
const KNOWN_CHAMPIONS_ONLY_SLUGS = {
  'メガガブリアスZ': 'mega-garchomp-z',
  'メガアブソルZ': 'mega-absol-z',
  'メガルカリオZ': 'mega-lucario-z',
  // 以下、championsbattledata.com の実際のpokemonPages一覧を直接確認して判明した対応関係。
  // PokeAPIの数値IDだけでは正しく橋渡しできない(フォルムごとに独立したランキングがある、
  // または逆に複数のだめけー側フォルムを1つのランキングに統合すべき)ケース。
  //
  // タウロス(パルデア地方3品種): それぞれ独立したページ/ランキングが存在する。
  'ケンタロス(コンバット種)': 'paldean-tauros-combat-breed',
  'ケンタロス(ブレイズ種)': 'paldean-tauros-blaze-breed',
  'ケンタロス(ウォーター種)': 'paldean-tauros-aqua-breed',
  // ビビヨン: サイト側はコスメティック違いを区別せず単一ページ(Fancy Pattern)のみ。
  // だめけー側に複数の柄違いエントリがあっても、すべてこの1つに統合する。
  'ビビヨン': 'vivillon-fancy-pattern',
  // ニャオニクス(メオスティック): 性別で独立したページがある。オスは基本種のIDで橋渡しできる
  // ため、メスのみここで明示指定する。
  'ニャオニクス(メス)': 'meowstic-female',
  // ギルガルド: ブレードフォルムは独立ページを持たず、シールドフォルムと同一データを使う。
  'ギルガルド(ブレードフォルム)': 'aegislash-shield-forme',
  // イエッサン(インディーデ): 性別で独立したページがある。オスは基本種のIDで橋渡しできる
  // ため、メスのみここで明示指定する。
  'イエッサン(メス)': 'indeedee-female',
  // モルペコ: サイト側は「はらもち」の状態を区別せず単一ページのみ。まんぷくもようの
  // データと統合する。
  'モルペコ(はらぺこもよう)': 'morpeko',
  // イダイトウ(バスカレジ): 性別で独立したページがある。オスは基本種のIDで橋渡しできる
  // ため、メスのみここで明示指定する。
  'イダイトウ(メス)': 'basculegion-female',
  // イッカネズミ(マウストドン): サイト側は家族の人数を区別せず単一ページのみ。両方とも
  // 同じ基本種データに統合する。
  'イッカネズミ(3びきかぞく)': 'maushold',
  'イッカネズミ(4ひきかぞく)': 'maushold',
  // イキリンコ(スカウビリー): 実際に対戦で機能が異なるのは色の「ペア」単位(グリーン/
  // ブルーが同一グループ、イエロー/ホワイトが同一グループ)。サイト側もこの2グループで
  // しかページを分けていないため、それぞれ対応するグループの代表ページに統合する。
  'イキリンコ(グリーンフェザー)': 'squawkabilly',
  'イキリンコ(ブルーフェザー)': 'squawkabilly',
  'イキリンコ(イエローフェザー)': 'squawkabilly-form-2',
  'イキリンコ(ホワイトフェザー)': 'squawkabilly-form-2',
  // イルカマン(パルデア): マイティフォルムは独立ページを持たず、ナイーブフォルムと同一
  // データを使う。
  'イルカマン(マイティ)': 'palafin-zero-form',
};

// PokeAPIの数値IDが基本種と衝突する等の理由で、自動橋渡しでは正しく区別できず、かつ
// championsbattledata側にも存在しない(チャンピオンズ未参戦の)だめけー側フォルム。
// ここに含めたフォルムは、対応表構築の対象から完全に除外する。
const EXCLUDED_FROM_MAPPING = new Set([
  'ピカチュウ(サトシ)', // 基本種ピカチュウとPokeAPIの数値IDが同一のため、自動橋渡しでは
  // 区別できない。チャンピオンズ未参戦のため、対応表自体から除外する。
]);

function normalizeSlug(s) {
  const cleaned = String(s || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  // PokeAPI側は "garchomp-mega" のように種族名が先、championsbattledata側は
  // "mega-garchomp" のように "mega" が先に来る語順の違いがあるため、"mega"/"megax"/
  // "megay"がどこにあっても先頭に来るよう並べ替えてから比較する。
  const parts = cleaned.split('-').filter(Boolean);
  const megaIdx = parts.findIndex(p => p === 'mega');
  if (megaIdx > 0) {
    const rest = parts.filter((_, i) => i !== megaIdx);
    return ['mega', ...rest].join('');
  }
  return parts.join('');
}

// championsbattledata側の pokemon[] を、slug正規化した形でインデックス化。
function indexChampionsPokemonBySlug(apiIndex) {
  const bySlug = new Map();
  for (const p of apiIndex.pokemon || []) {
    bySlug.set(normalizeSlug(p.slug), p);
    if (p.showdownId) bySlug.set(normalizeSlug(p.showdownId), p);
  }
  return bySlug;
}

// ---- だめけーポケモンID(日本語名) -> championsbattledata側エントリ の対応表を構築 ----
async function buildPokemonIdMap(championsIndex, auditLog) {
  const damekeIds = loadDamekePokemonImageIds();
  const pokeApiIdToSlug = await loadPokeApiIdToEnglishSlug();
  const championsBySlug = indexChampionsPokemonBySlug(championsIndex);

  const map = {}; // だめけー日本語名 -> championsPokemonエントリ
  let matched = 0;
  let noPokeApiSlug = 0; // PokeAPI側で数値IDに対応する英語slugが見つからない
  let noChampionsMatch = 0; // 英語slugは分かったが、champions側に該当エントリがない
  let overrideFailed = 0; // 手動オーバーライド指定があるのに、そのslugでchampions側に
  // 一致エントリが見つからない(オーバーライドのslug自体が誤っている可能性が高い)
  const noPokeApiSlugSamples = [];
  const noChampionsMatchSamples = [];
  const overrideFailedSamples = [];

  for (const [jaName, numericId] of Object.entries(damekeIds)) {
    // チャンピオンズ未参戦であることが判明しているフォルムは、自動橋渡しの対象から
    // 完全に除外する(基本種と数値IDが衝突する等の理由で誤って基本種のデータが
    // 割り当てられてしまうことを防ぐため)。
    if (EXCLUDED_FROM_MAPPING.has(jaName)) continue;
    // 既知のPokemon Champions独自フォルムを優先的にチェック(PokeAPIには存在しないため)。
    if (KNOWN_CHAMPIONS_ONLY_SLUGS[jaName]) {
      const overrideSlug = KNOWN_CHAMPIONS_ONLY_SLUGS[jaName];
      const candidate = championsBySlug.get(normalizeSlug(overrideSlug));
      if (candidate) { map[jaName] = candidate; matched++; continue; }
      // オーバーライド指定はあるのに一致しなかった場合、通常の橋渡しにフォールバックせず、
      // ここで明確に記録する(サイレントに別の結果へすり替わるのを防ぐため)。
      overrideFailed++;
      auditLog.unmatchedPokemon.push(jaName);
      if (overrideFailedSamples.length < 20) overrideFailedSamples.push(`${jaName}->${overrideSlug}(正規化:${normalizeSlug(overrideSlug)})`);
      continue;
    }
    const englishSlug = pokeApiIdToSlug[numericId];
    if (!englishSlug) {
      noPokeApiSlug++;
      auditLog.unmatchedPokemon.push(jaName);
      if (noPokeApiSlugSamples.length < 15) noPokeApiSlugSamples.push(`${jaName}(id:${numericId})`);
      continue;
    }
    const candidate = championsBySlug.get(normalizeSlug(englishSlug));
    if (candidate) { map[jaName] = candidate; matched++; continue; }
    noChampionsMatch++;
    auditLog.unmatchedPokemon.push(jaName);
    if (noChampionsMatchSamples.length < 15) noChampionsMatchSamples.push(`${jaName}->${englishSlug}(正規化:${normalizeSlug(englishSlug)})`);
  }
  summary(`ポケモンID対応: 成功 ${matched} 件 / 未対応 ${noPokeApiSlug + noChampionsMatch + overrideFailed} 件`);
  summary(`  - PokeAPI側で数値IDから英語名が見つからない: ${noPokeApiSlug} 件`);
  summary(`  - 英語名は判明したがchampions側に一致エントリなし: ${noChampionsMatch} 件`);
  summary(`  - 手動オーバーライド指定ありだが一致エントリなし(slug要確認): ${overrideFailed} 件`);
  if (overrideFailedSamples.length) summary(`  - サンプル(オーバーライド不一致): ${overrideFailedSamples.join(', ')}`);
  if (noPokeApiSlugSamples.length) summary(`  - サンプル(PokeAPI未解決): ${noPokeApiSlugSamples.join(', ')}`);
  if (noChampionsMatchSamples.length) summary(`  - サンプル(champions側不一致): ${noChampionsMatchSamples.join(', ')}`);
  summary(`  - championsBySlug 総登録数: ${championsBySlug.size} / pokeApiIdToSlug 総登録数: ${Object.keys(pokeApiIdToSlug).length}`);
  return map;
}

// ---- 技・特性・持ち物・性格の 日本語<->英語 対応表 (別ファイルで管理、随時拡充) ----
function loadNameMap(p) { return readJsonIfExists(p) || {}; }

function buildReverseMap(jaToEn) {
  const rev = {};
  for (const [ja, en] of Object.entries(jaToEn)) rev[normalizeSlug(en)] = ja;
  return rev;
}

// ---- 1匹分の battleSummary から、公開用JSONの1エントリを作る ----
async function fetchBattleRows(format, showdownId){
  const url = `https://championsbattledata.com/api/battle/${format}/${encodeURIComponent(showdownId)}`;
  const data = await fetchJsonWithRetry(url, { retries: RETRY_COUNT });
  return Array.isArray(data.rows) ? data.rows : [];
}

async function buildPokemonEntry(jaName, championsPokemon, format, nameMaps, auditLog, reversePokemonMap){
  // メインの/apiインデックスのbattleSummaryは1位(top)しか%を持たないため、ポケモンごとの
  // 詳細エンドポイント(/api/battle/{format}/{showdownId})を別途取得する。こちらは各カテゴリ
  // 最大10位まで、すべての順位に%(または努力値配分の内訳)が付与されている。
  let rows;
  try {
    rows = await fetchBattleRows(format, championsPokemon.showdownId || championsPokemon.slug);
  } catch (e) {
    auditLog.unmatchedPokemon.push(`${jaName}(battle取得失敗:${e.message})`);
    return null;
  }
  if (!rows.length) return null;

  function rowsFor(category){ return rows.filter(r => r.category === category).sort((a,b) => (a.rank||0) - (b.rank||0)); }

  function mapCategory(categoryKey, jaToEnMap, auditKey){
    const revMap = buildReverseMap(jaToEnMap);
    const out = [];
    rowsFor(categoryKey).forEach((row) => {
      const ja = revMap[normalizeSlug(row.name)];
      if (!ja) { auditLog[auditKey].push(row.name); return; }
      const rate = row.percentage_value != null ? Number(Number(row.percentage_value).toFixed(1)) : null;
      out.push({ id: ja, rate });
    });
    return out;
  }

  const abilities = mapCategory('ability', nameMaps.abilities, 'unmatchedAbilities');
  const items = mapCategory('held_item', nameMaps.items, 'unmatchedItems');
  const moves = mapCategory('move', nameMaps.moves, 'unmatchedMoves');
  const natures = mapCategory('stat_alignment', nameMaps.natures, 'unmatchedNatures');

  // 努力値配分(stat_points)は日本語訳の必要がない数値情報。各順位のhp_points等の内訳から、
  // だめけー側の表記(H32/A0/B20/C14/D0/S0)へ、全順位について統一して変換する。
  function formatEvSpread(row){
    const parts = [];
    if (row.hp_points !== '' && row.hp_points != null) parts.push('H' + row.hp_points);
    if (row.attack_points !== '' && row.attack_points != null) parts.push('A' + row.attack_points);
    if (row.defense_points !== '' && row.defense_points != null) parts.push('B' + row.defense_points);
    if (row.sp_atk_points !== '' && row.sp_atk_points != null) parts.push('C' + row.sp_atk_points);
    if (row.sp_def_points !== '' && row.sp_def_points != null) parts.push('D' + row.sp_def_points);
    if (row.speed_points !== '' && row.speed_points != null) parts.push('S' + row.speed_points);
    return parts.length ? parts.join('/') : null;
  }
  const evSpreads = rowsFor('stat_points').map((row) => {
    const label = formatEvSpread(row);
    const rate = row.percentage_value != null ? Number(Number(row.percentage_value).toFixed(1)) : null;
    return label ? { label, rate } : null;
  }).filter(Boolean);

  // 味方ポケモンは、既に構築済みのポケモンID対応表(英語battleName -> だめけー日本語名)の
  // 逆引きで変換する。変換できない場合はその行だけ除外し、監査対象に記録する。
  const teammates = rowsFor('teammate')
    .map((row) => {
      const teamJaName = reversePokemonMap.get(normalizeSlug(row.name));
      if (!teamJaName) { auditLog.unmatchedTeammates.push(row.name); return null; }
      return { id: teamJaName, rate: null };
    })
    .filter(Boolean);

  // position(=column_position)は、その形式(シングル/ダブル)における使用率ランキング上の
  // 列位置であり、実質的にそのポケモン自体の使用率順位として扱える。ポケモンごとの詳細
  // エンドポイントにはこの値が含まれないため、メインインデックス側(championsPokemon)から
  // 引き続き取得する。
  const bs = championsPokemon?.summary?.battleSummary?.Current?.[format];
  const rank = bs?.top?.move?.position ?? bs?.position ?? null;

  return {
    sourcePokemonId: championsPokemon.slug,
    rank,
    usageRate: null, // ポケモン自体の採用率(%)は現時点でAPIレスポンスから直接確認できて
    // いないため null のまま。rankによる順位付けは可能。
    natures,
    evSpreads,
    abilities,
    items,
    moves,
    teammates,
  };
}

async function main() {
  const auditLog = {
    unmatchedPokemon: [], unmatchedAbilities: [], unmatchedItems: [],
    unmatchedMoves: [], unmatchedNatures: [], unmatchedTeammates: [],
  };

  let championsIndex;
  try {
    championsIndex = await fetchJsonWithRetry(CHAMPIONS_API);
  } catch (e) {
    summary(`❌ championsbattledata.com からの取得に失敗: ${e.message}`);
    summary('既存の data.usage.json は変更せず終了します。');
    writeSummaryAndExit(1);
    return;
  }

  // ゲーム内由来であることを裏付ける最低限のメタ情報チェック。
  if (!Array.isArray(championsIndex.pokemon) || championsIndex.pokemon.length < 100) {
    summary(`❌ 取得したポケモン件数が異常に少ない(${championsIndex.pokemon?.length ?? 0}件)。更新を中止します。`);
    writeSummaryAndExit(1);
    return;
  }

  const nameMaps = {
    abilities: loadNameMap(ABILITY_JA_TO_EN_PATH),
    items: loadDamekeItemImageSlugs(),
    moves: loadNameMap(MOVE_JA_TO_EN_PATH),
    natures: loadNameMap(NATURE_JA_TO_EN_PATH),
  };

  const pokemonIdMap = await buildPokemonIdMap(championsIndex, auditLog);

  // 味方ポケモン変換用: championsPokemon側の名前(slug/battleName/name いずれか)を正規化した
  // ものから、だめけー日本語名を引けるようにする逆引きマップ。
  const reversePokemonMap = new Map();
  for (const [jaName, championsPokemon] of Object.entries(pokemonIdMap)) {
    for (const key of [championsPokemon.slug, championsPokemon.showdownId, championsPokemon.name, championsPokemon.battleName]) {
      if (key) reversePokemonMap.set(normalizeSlug(key), jaName);
    }
  }

  const existing = readJsonIfExists(OUTPUT_PATH);
  const nowIso = new Date().toISOString();

  const formatsOut = { singles: null, doubles: null };
  let anyFormatSucceeded = false;
  const REQUEST_DELAY_MS = 150; // ポケモンごとの詳細エンドポイントを多数叩くため、サーバー
  // への負荷を抑えるために一定間隔を空ける。
  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

  for (const [outKey, apiFormat] of [['singles', 'Singles'], ['doubles', 'Doubles']]) {
    try {
      const pokemonOut = {};
      let count = 0;
      for (const [jaName, championsPokemon] of Object.entries(pokemonIdMap)) {
        const entry = await buildPokemonEntry(jaName, championsPokemon, apiFormat, nameMaps, auditLog, reversePokemonMap);
        await sleep(REQUEST_DELAY_MS);
        if (!entry) continue;
        pokemonOut[jaName] = entry;
        count++;
      }
      if (count === 0) throw new Error('0件のポケモンしか変換できませんでした');
      formatsOut[outKey] = {
        season: championsIndex.defaultSeason || 'Current',
        regulation: null,
        generatedAt: nowIso,
        sampleSize: null,
        pokemon: pokemonOut,
      };
      anyFormatSucceeded = true;
      summary(`${outKey}: ${count} 件のポケモンを変換しました。`);
    } catch (e) {
      summary(`⚠ ${outKey} の変換に失敗: ${e.message}。前回値を維持します。`);
      formatsOut[outKey] = existing?.formats?.[outKey] || null;
    }
  }

  if (!anyFormatSucceeded) {
    summary('❌ シングル・ダブルの両方が失敗しました。data.usage.json は更新しません。');
    writeSummaryAndExit(1);
    return;
  }

  const output = {
    schemaVersion: 1,
    source: {
      name: 'Pokemon Champions Battle Data',
      url: 'https://championsbattledata.com/',
      sourceType: 'pokemon-champions-in-game',
      game: 'pokemon-champions',
    },
    retrievedAt: nowIso,
    formats: formatsOut,
  };

  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(output));

  summary(`未対応ポケモン: ${auditLog.unmatchedPokemon.length} 件`);
  summary(`未対応特性: ${new Set(auditLog.unmatchedAbilities).size} 種`);
  summary(`未対応持ち物: ${new Set(auditLog.unmatchedItems).size} 種`);
  summary(`未対応技: ${new Set(auditLog.unmatchedMoves).size} 種`);
  summary(`未対応性格: ${new Set(auditLog.unmatchedNatures).size} 種`);
  summary('✅ data.usage.json を更新しました。');
  writeSummaryAndExit(0);
}

main().catch((e) => {
  summary(`❌ 予期しないエラー: ${e?.stack || e}`);
  writeSummaryAndExit(1);
});
