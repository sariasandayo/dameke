#!/usr/bin/env node
// 技・特性・持ち物の 日本語名 -> 英語slug 対応表を生成する、一度だけ実行するセットアップ
// スクリプト。日次のGitHub Actionsワークフローには含めない(これらの名前対応はゲームの
// アップデートで新要素が追加されない限りほぼ不変なので、毎日再生成する必要がない)。
//
// 使い方:
//   node tools/generate-name-maps.mjs
//
// PokeAPIの各リソース一覧を取得し、日本語名(ja-Hrkt優先、なければja)が取れたものだけを
// tools/name-maps/*.json に書き出す。既存ファイルがあれば、新たに解決できたエントリで
// 追記マージする(手動で補った分を上書きしない)。
//
// 件数が多い(技900+、持ち物800+、特性300+)ため、レート制限を避けるよう待機を挟みながら
// 逐次フェッチする。実行には数分かかる。

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAP_DIR = path.join(__dirname, 'name-maps');
if (!existsSync(MAP_DIR)) mkdirSync(MAP_DIR, { recursive: true });

const REQUEST_DELAY_MS = 60; // PokeAPIのFair Use Policyに配慮した緩やかな間隔

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function readExisting(p) {
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return {}; }
}

function japaneseNameFrom(namesArray) {
  // ja-Hrkt (かな表記) を優先し、なければ ja (漢字混じり) を使う。だめけー側のデータは
  // 主にカタカナ/かな表記のため、ja-Hrktの方が一致率が高い。
  const hrkt = namesArray.find(n => n.language?.name === 'ja-Hrkt');
  if (hrkt) return hrkt.name;
  const ja = namesArray.find(n => n.language?.name === 'ja');
  return ja ? ja.name : null;
}

async function generateFor(resource, outFile) {
  const outPath = path.join(MAP_DIR, outFile);
  const existing = readExisting(outPath);
  const existingCount = Object.keys(existing).length;

  const listUrl = `https://pokeapi.co/api/v2/${resource}?limit=2000`;
  const list = await fetchJson(listUrl);
  const results = list.results || [];
  console.log(`${resource}: ${results.length} 件を処理します (既存 ${existingCount} 件)`);

  const merged = { ...existing };
  const existingEnglish = new Set(Object.values(existing));
  let added = 0;

  for (const item of results) {
    if (existingEnglish.has(item.name)) continue; // 既に対応済みの英語名はスキップ
    try {
      const detail = await fetchJson(item.url);
      const ja = japaneseNameFrom(detail.names || []);
      if (ja && !merged[ja]) {
        merged[ja] = item.name;
        added++;
      }
    } catch (e) {
      console.warn(`  警告: ${item.name} の取得に失敗 (${e.message})`);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  writeFileSync(outPath, JSON.stringify(merged, null, 2) + '\n');
  console.log(`${resource}: ${added} 件を新たに追加、合計 ${Object.keys(merged).length} 件を ${outFile} に保存しました。`);
}

async function main() {
  await generateFor('move', 'moves-ja-en.json');
  await generateFor('ability', 'abilities-ja-en.json');
  // 持ち物は、だめけー本体の data_item_images.js (既に本番の持ち物画像表示機能で
  // 使用・検証済み)をそのまま再利用するため、ここでは生成しない。
  console.log('完了しました。natures-ja-en.json(手動作成済み)・持ち物(data_item_images.js を再利用)はそのまま使用します。');
}

main().catch((e) => {
  console.error('致命的エラー:', e);
  process.exit(1);
});
