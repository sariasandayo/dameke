# だめけー Web β v0.88 公開用パッケージ

このフォルダは GitHub Pages に置くための公開用ファイルだけを含みます。

## 含めているもの

- index.html
- style.css
- app.js
- calc.js
- data.js
- data/ 配下の index.html が参照する JS
- runtime/ 配下の index.html が参照する JS
- .nojekyll

## 含めていないもの

- archive/
- tools/
- data_import/
- apply_*.js / apply_fix_*.js
- backup-before-* ファイル
- Excel 原本

## GitHub Pages 公開手順の例

1. GitHubで新しいリポジトリを作る。
2. この beta_publish フォルダの中身をリポジトリ直下へアップロードする。
3. GitHubの Settings > Pages で Source を Deploy from a branch にする。
4. Branch を main、folder を / root にする。
5. 発行された URL をスマホで開く。

## 注意

公開リポジトリに置いたファイルは外部から見えます。Excel原本や archive、tools は入れないでください。
