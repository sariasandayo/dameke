// だめけー Web -- Service Worker (オフライン対応)
//
// 方針:
// ・このアプリ自身のファイル(HTML/JS/CSS/アイコン)は「アプリシェル」として初回アクセス時に
//   まとめてキャッシュし、次回以降オフラインでも起動できるようにする。
// ・index.html(ナビゲーションリクエスト)だけは「まずネットワークを試し、失敗したら
//   キャッシュ」という順序にする。こうしないと、アップデートを配信しても訪問者がずっと
//   古いindex.html(=古い?v=を参照するHTML)を見続けてしまうため。
// ・ポケモン/持ち物画像はPokeAPIのスプライトを都度取得する方式のままなので(画像を
//   保存・再配布しない方針)、一度表示した画像だけ実行時キャッシュに載せて、次回以降
//   オフラインでも同じ画像が出せるようにする。一度も見ていない画像はオフラインでは
//   従来通りフォールバック表示になる(レイアウト崩れにはならない)。
//
// キャッシュ名のバージョン番号は、index.html側の ?v= キャッシュバスターの値と
// 手動で揃えている。アプリを更新するときは、キャッシュバスターと合わせてここの
// CACHE_VERSION も必ず書き換えること(揃え忘れると新しいSWが古いキャッシュ名のまま
// 動いてしまい、更新が反映されない)。
const CACHE_VERSION = '20260917z';
const SHELL_CACHE = 'dameke-shell-' + CACHE_VERSION;
const IMAGE_CACHE = 'dameke-images-v1'; // 画像キャッシュはバージョン更新のたびに消さない

const SHELL_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './app_adjust.js',
  './app_complement.js',
  './app_coverage.js',
  './app_evopt.js',
  './app_minigame.js',
  './app_partytype.js',
  './app_search.js',
  './app_speed.js',
  './app_tools.js',
  './calc.js',
  './data.js',
  './data_item_images.js',
  './data_learnsets.js',
  './data_regulations.js',
  './data_pokemon_images.js',
  './icon/favicon.ico',
  './icon/favicon-32.png',
  './icon/apple-touch-icon.png',
  './icon/icon-192.png',
  './icon/icon-512.png',
  './icon/icon-maskable-512.png'
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function(cache){
      // 1つでも取得に失敗するとaddAll全体が失敗するため、失敗したファイルがあっても
      // インストール自体は継続できるよう、個別にcatchして続行する。
      return Promise.all(SHELL_FILES.map(function(url){
        return cache.add(url).catch(function(err){
          console.warn('[sw] precache failed for', url, err);
        });
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(key){
        if(key !== SHELL_CACHE && key !== IMAGE_CACHE) return caches.delete(key);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

function isImageRequest(request, url){
  return request.destination === 'image' || /\.(png|jpg|jpeg|gif|webp)$/i.test(url.pathname);
}

self.addEventListener('fetch', function(event){
  var request = event.request;
  if(request.method !== 'GET') return;
  var url = new URL(request.url);

  // ナビゲーション(index.htmlの取得): ネットワーク優先、失敗時のみキャッシュ済みシェルへ
  // フォールバック -- 更新を配信したら訪問者がすぐ新しいHTMLを受け取れるようにするため。
  if(request.mode === 'navigate'){
    event.respondWith(
      fetch(request).catch(function(){
        return caches.match('./index.html').then(function(res){ return res || caches.match('./'); });
      })
    );
    return;
  }

  var sameOrigin = url.origin === self.location.origin;

  if(sameOrigin){
    // アプリ自身のJS/CSS/アイコンはキャッシュ優先(?v=付きなので内容が変われば
    // URL自体が変わり、自動的に新しいキャッシュが使われる)。
    event.respondWith(
      caches.match(request).then(function(cached){
        if(cached) return cached;
        return fetch(request).then(function(res){
          var resClone = res.clone();
          caches.open(SHELL_CACHE).then(function(cache){ cache.put(request, resClone); });
          return res;
        }).catch(function(){ return cached; });
      })
    );
    return;
  }

  // 外部(PokeAPIスプライト等)の画像: 一度取得できたものはオフラインでも表示できるよう
  // 実行時キャッシュに保存する(全ポケモン・全道具分を事前取得することはしない)。
  if(isImageRequest(request, url)){
    event.respondWith(
      caches.open(IMAGE_CACHE).then(function(cache){
        return cache.match(request).then(function(cached){
          if(cached) return cached;
          return fetch(request).then(function(res){
            if(res && res.ok) cache.put(request, res.clone());
            return res;
          }).catch(function(){
            // オフラインかつ未キャッシュの画像 -- 呼び出し側(buildPokemonImageEl等)の
            // onAllFailedコールバックがフォールバック表示に切り替えるので、ここでは
            // 単に失敗をそのまま伝播させる(レイアウトは崩れない)。
            return Promise.reject(new Error('image unavailable offline'));
          });
        });
      })
    );
    return;
  }
  // その他の外部リクエストはそのままネットワークへ委ねる。
});
