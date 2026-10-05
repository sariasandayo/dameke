// v2.2.0 ミニゲーム
// ハンバーガーメニュー最下部の「ミニゲーム」パネル。内部にゲーム切り替えの枠組みを持ち、
// ゲームを追加・変更しやすいよう、
// スイッチャー(GAMES配列に追加するだけ)+ホスト(現在選択中のゲームのUIを描画する領域)
// という構成にしてある。
(function(){
  'use strict';
  function q(id){ return document.getElementById(id); }
  var DATA = window.DAMEKE_DATA;

  // ---- 括弧書き(全角/半角、入れ子含む)を正しく除去する ----
  // 単純な正規表現(非貪欲マッチ)だと、入れ子の括弧(例:「ヒヒダルマ(ダルマモード(ガラル))」)で
  // 閉じ括弧が1つ余ってしまう。深さを数えながら括弧の外側の文字だけを拾う。
  function stripParens(name){
    var result = '';
    var depth = 0;
    var chars = Array.from(String(name||''));
    for(var i = 0; i < chars.length; i++){
      var c = chars[i];
      if(c === '(' || c === '（'){ depth++; continue; }
      if(c === ')' || c === '）'){ if(depth > 0) depth--; continue; }
      if(depth === 0) result += c;
    }
    return result;
  }

  // ---- 世代による範囲指定(各ゲーム共通) ----
  // 各ポケモンの世代は data.js の generation(1〜9)。フォルム違い・メガシンカ・リージョンフォーム等も
  // 元のポケモンと同じ世代になっている。
  var GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  function newGenSelection(){
    var sel = Object.create(null);
    GENERATIONS.forEach(function(g){ sel[g] = true; });
    return sel;
  }

  // 「ルール」と同じ見た目の折り畳みを作る。中身は返り値の body に追加する。
  function buildMinigameFold(summaryText){
    var fold = document.createElement('details');
    fold.className = 'dameke-pokemon-edit-levelfold dameke-minigame-rules-fold';
    var summary = document.createElement('summary');
    summary.textContent = summaryText;
    fold.appendChild(summary);
    var body = document.createElement('div');
    body.className = 'dameke-minigame-range-body';
    fold.appendChild(body);
    return { fold: fold, body: body };
  }

  // 世代のチェックボックス(+全選択/全解除)の行を作る。selection を直接書き換え、変更のたびに
  // onChange を呼ぶ。
  function buildGenRangeRow(selection, onChange){
    var row = document.createElement('div');
    row.className = 'dameke-stathl-mode-row dameke-minigame-range-row';
    var checks = [];
    GENERATIONS.forEach(function(g){
      var label = document.createElement('label');
      label.className = 'dameke-stathl-mode-option';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!selection[g];
      cb.addEventListener('change', function(){
        selection[g] = cb.checked;
        onChange();
      });
      label.appendChild(cb);
      label.appendChild(document.createTextNode('第' + g + '世代'));
      row.appendChild(label);
      checks.push({ gen: g, cb: cb });
    });
    [['全選択', true], ['全解除', false]].forEach(function(def){
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dameke-search-add-btn dameke-minigame-range-btn';
      btn.textContent = def[0];
      btn.addEventListener('click', function(){
        checks.forEach(function(c){ selection[c.gen] = def[1]; c.cb.checked = def[1]; });
        onChange();
      });
      row.appendChild(btn);
    });
    return row;
  }

  // ==================== ゲーム切り替えの枠組み ====================
  var GAMES = [
    { id: 'nameguess', label: 'ポケモン名推理', render: renderNameGuessGame },
    { id: 'dexfill', label: 'ポケモン図鑑埋め', render: renderDexFillGame },
    { id: 'stathl', label: '種族値High&Low', render: renderStatHLGame },
    { id: 'statchart', label: '種族値チャートクイズ', render: renderStatChartGame },
    { id: 'randomgen', label: 'ランダムポケモン出力', render: renderRandomGenGame }
  ];
  var currentGameId = GAMES[0].id;

  function renderSwitcher(){
    var host = q('damekeMinigameSwitcher');
    if(!host) return;
    host.innerHTML = '';
    if(GAMES.length <= 1) return; // ゲームが1つしかない間はスイッチャー自体を出さない
    GAMES.forEach(function(g){
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dameke-minigame-switch-btn' + (g.id === currentGameId ? ' dameke-minigame-switch-btn-active' : '');
      btn.textContent = g.label;
      btn.addEventListener('click', function(){
        if(currentGameId === g.id) return;
        currentGameId = g.id;
        renderSwitcher();
        renderCurrentGame();
      });
      host.appendChild(btn);
    });
  }

  function renderCurrentGame(){
    var host = q('damekeMinigameHost');
    if(!host) return;
    host.innerHTML = '';
    var game = GAMES.filter(function(g){ return g.id === currentGameId; })[0];
    if(game) game.render(host);
  }

  window.__damekeRenderMinigamePanel = function(){
    var host = q('damekeMinigameHost');
    if(host && !host.childElementCount){
      renderSwitcher();
      renderCurrentGame();
    }
  };

  // ==================== ポケモン名推理 ====================
  var WORD_LENGTH = 5;
  var MAX_TRIES = 10;

  // 出題範囲(世代)。変更するとゲームをリセットする。
  var nameGuessGens = newGenSelection();

  // ---- 候補リスト(括弧書きを除いて重複をなくした、ちょうど5文字のポケモン名)を
  //      1度だけ計算してキャッシュする。inRangeOnly なら出題範囲の世代のものだけ ----
  function buildCandidates(inRangeOnly){
    var seen = Object.create(null);
    var out = [];
    (DATA.pokemons || []).forEach(function(p){
      if(inRangeOnly && !nameGuessGens[p.generation]) return;
      var stripped = stripParens(p.name);
      if(Array.from(stripped).length !== WORD_LENGTH) return;
      if(seen[stripped]) return;
      seen[stripped] = true;
      out.push(stripped);
    });
    out.sort(function(a,b){ return a.localeCompare(b, 'ja'); });
    return out;
  }
  var candidatesCache = null;
  function getCandidates(){
    if(!candidatesCache) candidatesCache = buildCandidates(true);
    return candidatesCache;
  }
  // 入力として受け付ける名前(全世代の候補)。範囲は「正解がどの世代から選ばれるか」だけを決め、
  // 範囲外のポケモンも解答として入力できる。
  var allCandidatesCache = null;
  function getAllCandidates(){
    if(!allCandidatesCache) allCandidatesCache = buildCandidates(false);
    return allCandidatesCache;
  }
  // 出題範囲を変えたときに、範囲に依存するキャッシュを捨てる。
  function resetNameGuessRangeCaches(){
    candidatesCache = null;
  }

  // ---- 候補全体で実際に使われている文字だけを対象にした五十音表(+濁音/半濁音/
  //      小さい文字/記号・数字)。実際の候補に出てこない行・文字は表示しない。 ----
  var GOJUON_ROWS = [
    ['ア','イ','ウ','エ','オ'],
    ['カ','キ','ク','ケ','コ'],
    ['ガ','ギ','グ','ゲ','ゴ'],
    ['サ','シ','ス','セ','ソ'],
    ['ザ','ジ','ズ','ゼ','ゾ'],
    ['タ','チ','ツ','テ','ト'],
    ['ダ','ヂ','ヅ','デ','ド'],
    ['ナ','ニ','ヌ','ネ','ノ'],
    ['ハ','ヒ','フ','ヘ','ホ'],
    ['バ','ビ','ブ','ベ','ボ'],
    ['パ','ピ','プ','ペ','ポ'],
    ['マ','ミ','ム','メ','モ'],
    ['ヤ','','ユ','','ヨ'],
    ['ラ','リ','ル','レ','ロ'],
    ['ワ','','','','ン'],
    ['ァ','ィ','ゥ','ェ','ォ'],
    ['ッ','ャ','ュ','ョ','ー'],
    ['ヴ','♀','♂','2','Z']
  ];
  var candidateCharsCache = null;
  function getCandidateCharSet(){
    if(candidateCharsCache) return candidateCharsCache;
    var set = Object.create(null);
    getAllCandidates().forEach(function(n){ Array.from(n).forEach(function(c){ set[c] = true; }); });
    candidateCharsCache = set;
    return set;
  }

  // ---- 括弧書きを除いた名前(word)から、画像表示に使える実在のポケモンを1件探す。
  //      姿違い等は考慮せず、最初に見つかったものを使う(どの姿でもよいとのご要望のため)。 ----
  function findPokemonForWord(word){
    var list = DATA.pokemons || [];
    for(var i = 0; i < list.length; i++){
      if(stripParens(list[i].name) === word) return list[i];
    }
    return null;
  }

  // ---- 判定ロジック(1文字ごとの3段階判定) ----
  // 1巡目: 位置が完全一致する文字を緑にし、正解側の「残りプール」からその分を消費する。
  // 2巡目: 緑にならなかった解答側の文字を先頭から順に見て、残りプールにまだあれば黄色に
  //        して1つ消費、なければ灰色。これにより、正解・解答どちらに同じ文字が複数あっても、
  //        緑を優先しつつ、先頭に近い方から黄色が付く(ご要望の通りの)動作になる。
  function computeColors(guess, answer){
    var g = Array.from(guess);
    var a = Array.from(answer);
    var colors = g.map(function(){ return 'gray'; });
    var remaining = Object.create(null);
    a.forEach(function(c, i){
      if(g[i] === c) colors[i] = 'green';
      else remaining[c] = (remaining[c] || 0) + 1;
    });
    g.forEach(function(c, i){
      if(colors[i] === 'green') return;
      if(remaining[c] > 0){ colors[i] = 'yellow'; remaining[c]--; }
    });
    return colors;
  }

  // 候補数表示のON/OFF(既定はOFF)。リトライしても引き継ぐ。
  var nameGuessShowCount = false;

  // これまでの解答(guessesの先頭からuptoCount件)の判定結果(緑・黄・灰すべて)と矛盾しない
  // 候補の数を数える。候補cが矛盾しない ⇔ 各解答gについて、cを正解と仮定したときの
  // computeColors(g.word, c)が、実際に表示されたg.colorsと完全に一致する。
  // (正解そのものは必ず条件を満たすので、候補数は常に1以上になる。)
  function countConsistentCandidates(guesses, uptoCount){
    var used = guesses.slice(0, uptoCount);
    var n = 0;
    getCandidates().forEach(function(c){
      for(var i = 0; i < used.length; i++){
        var cols = computeColors(used[i].word, c);
        for(var j = 0; j < cols.length; j++){ if(cols[j] !== used[i].colors[j]) return; }
      }
      n++;
    });
    return n;
  }

  var nameGuessState = null;
  function newNameGuessGame(){
    var cands = getCandidates();
    // 範囲内に候補が1つもないとき(世代を1つも選んでいない等)は answer が null のまま終了扱いにする。
    var answer = cands.length ? cands[Math.floor(Math.random() * cands.length)] : null;
    nameGuessState = { answer: answer, guesses: [], finished: !answer, won: false, charStatus: Object.create(null) };
  }

  function updateCharStatus(word, colors){
    var rank = { gray: 0, yellow: 1, green: 2 };
    Array.from(word).forEach(function(c, i){
      var cur = nameGuessState.charStatus[c];
      var next = colors[i];
      if(!cur || rank[next] > rank[cur]) nameGuessState.charStatus[c] = next;
    });
  }

  function renderNameGuessGame(host){
    if(!nameGuessState) newNameGuessGame();

    var wrap = document.createElement('div');
    wrap.className = 'dameke-nameguess-wrap';

    var title = document.createElement('h3');
    title.className = 'dameke-minigame-title';
    title.textContent = 'ポケモン名推理';
    wrap.appendChild(title);

    var rulesFold = document.createElement('details');
    rulesFold.className = 'dameke-pokemon-edit-levelfold dameke-minigame-rules-fold';
    var rulesSummary = document.createElement('summary');
    rulesSummary.textContent = 'ルール';
    rulesFold.appendChild(rulesSummary);
    var rulesBody = document.createElement('div');
    rulesBody.className = 'dameke-minigame-rules-body';
    rulesBody.innerHTML =
      '<p>括弧書きのフォルム名等を除いた、ちょうど5文字のポケモン名が答えです。</p>' +
      '<p>ひらがな・カタカナ、半角・全角のどれで入力しても構いません。' + MAX_TRIES + '回以内に当ててください。</p>' +
      '<p>決定すると、1文字ごとに背景色が変わります。<br>' +
      '緑：位置・文字とも正解と一致　黄：文字は正解に含まれるが位置が違う　灰：正解に含まれない</p>' +
      '<p>正解・入力どちらかに同じ文字が複数ある場合は、緑判定を優先したうえで、位置が先頭に近い方から黄色が付きます。</p>' +
      '<p>「範囲」で、正解が選ばれる世代を選べます。変更するとリセットされます。範囲外のポケモンも入力できます。</p>' +
      '<p>「初手をランダムで選ぶ」を押すと、正解以外の候補からランダムに選んだポケモンで1手目を決定します。</p>' +
      '<p>「候補数表示」にチェックを入れると、各解答欄の右に、その欄に解答する時点での確定情報(緑・黄・灰すべて)と矛盾しない、正解となりうるポケモンの数を表示します。</p>';
    rulesFold.appendChild(rulesBody);
    wrap.appendChild(rulesFold);

    var rangeFold = buildMinigameFold('範囲');
    rangeFold.body.appendChild(buildGenRangeRow(nameGuessGens, function(){
      resetNameGuessRangeCaches();
      newNameGuessGame();
      guessError = null;
      giveUpBtn.hidden = nameGuessState.finished;
      renderRows();
      renderHintTable();
      renderMessage();
    }));
    wrap.appendChild(rangeFold.fold);

    var actionsRow = document.createElement('div');
    actionsRow.className = 'dameke-nameguess-actions';
    var giveUpBtn = document.createElement('button');
    giveUpBtn.type = 'button';
    giveUpBtn.className = 'dameke-search-add-btn dameke-minigame-giveup-btn';
    giveUpBtn.textContent = 'ギブアップ';
    actionsRow.appendChild(giveUpBtn);
    var countToggleLabel = document.createElement('label');
    countToggleLabel.className = 'dameke-stathl-mode-option dameke-nameguess-count-toggle';
    var countToggle = document.createElement('input');
    countToggle.type = 'checkbox';
    countToggle.checked = nameGuessShowCount;
    countToggle.addEventListener('change', function(){
      nameGuessShowCount = countToggle.checked;
      renderRows();
    });
    countToggleLabel.appendChild(countToggle);
    countToggleLabel.appendChild(document.createTextNode('候補数表示'));
    actionsRow.appendChild(countToggleLabel);
    wrap.appendChild(actionsRow);

    var messageHost = document.createElement('div');
    messageHost.className = 'dameke-minigame-message';
    wrap.appendChild(messageHost);

    var boardRow = document.createElement('div');
    boardRow.className = 'dameke-nameguess-board-row';
    wrap.appendChild(boardRow);

    var rowsHost = document.createElement('div');
    rowsHost.className = 'dameke-nameguess-rows';
    boardRow.appendChild(rowsHost);

    var hintSection = document.createElement('div');
    hintSection.className = 'dameke-nameguess-hint-section';
    var hintTitle = document.createElement('div');
    hintTitle.className = 'dameke-adjust-nature-title';
    hintTitle.textContent = '使った文字';
    hintSection.appendChild(hintTitle);
    var hintHost = document.createElement('div');
    hintHost.className = 'dameke-nameguess-hint-table';
    hintSection.appendChild(hintHost);
    boardRow.appendChild(hintSection);

    host.appendChild(wrap);

    function renderHintTable(){
      hintHost.innerHTML = '';
      var usedChars = getCandidateCharSet();
      GOJUON_ROWS.forEach(function(row){
        // その行の文字が候補内で1つも使われていなければ、行ごと表示しない。
        var anyUsed = row.some(function(c){ return c && usedChars[c]; });
        if(!anyUsed) return;
        var rowEl = document.createElement('div');
        rowEl.className = 'dameke-nameguess-hint-row';
        row.forEach(function(c){
          var cell = document.createElement('span');
          cell.className = 'dameke-nameguess-hint-cell';
          if(!c || !usedChars[c]){ cell.classList.add('dameke-nameguess-hint-cell-empty'); rowEl.appendChild(cell); return; }
          var status = nameGuessState.charStatus[c];
          if(status) cell.classList.add('dameke-nameguess-cell-' + status);
          cell.textContent = c;
          rowEl.appendChild(cell);
        });
        hintHost.appendChild(rowEl);
      });
    }

    function appendRetryButton(){
      var retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'dameke-search-add-btn dameke-minigame-retry-btn';
      retryBtn.textContent = 'リトライ';
      retryBtn.addEventListener('click', function(){
        newNameGuessGame();
        giveUpBtn.hidden = nameGuessState.finished;
        renderRows();
        renderHintTable();
        renderMessage();
      });
      messageHost.appendChild(retryBtn);
    }

    function renderMessage(){
      messageHost.innerHTML = '';
      if(nameGuessState.won){
        appendRetryButton();
      } else if(nameGuessState.finished && nameGuessState.answer){
        var lose = document.createElement('div');
        lose.className = 'dameke-nameguess-lose-banner';
        lose.textContent = '正解は「' + nameGuessState.answer + '」でした。';
        messageHost.appendChild(lose);
        appendRetryButton();
      }
    }

    // index番目(0始まり)の解答欄に、その欄に解答する時点(=それより前の解答の結果をすべて
    // 反映した時点)での候補数を表示する要素を作る。候補数表示がOFFならnull。
    function buildCountLabel(index){
      if(!nameGuessShowCount) return null;
      var el = document.createElement('span');
      el.className = 'dameke-nameguess-count';
      el.textContent = '候補' + countConsistentCandidates(nameGuessState.guesses, index);
      return el;
    }

    function buildResultRow(word, colors, index){
      var row = document.createElement('div');
      row.className = 'dameke-nameguess-row dameke-nameguess-row-result';
      var imgWrap = document.createElement('span');
      imgWrap.className = 'dameke-nameguess-row-thumb';
      var pokemon = findPokemonForWord(word);
      var img = (pokemon && window.__damekeBuildPokemonImage)
        ? window.__damekeBuildPokemonImage(pokemon.name, function(){ imgWrap.classList.add('dameke-nameguess-row-thumb-missing'); imgWrap.innerHTML = ''; })
        : null;
      if(img) imgWrap.appendChild(img); else imgWrap.classList.add('dameke-nameguess-row-thumb-missing');
      row.appendChild(imgWrap);
      var lettersWrap = document.createElement('div');
      lettersWrap.className = 'dameke-nameguess-letters';
      Array.from(word).forEach(function(ch, i){
        var box = document.createElement('span');
        box.className = 'dameke-nameguess-letter-box dameke-nameguess-cell-' + colors[i];
        box.textContent = ch;
        lettersWrap.appendChild(box);
      });
      row.appendChild(lettersWrap);
      var resultCount = buildCountLabel(index);
      if(resultCount) row.appendChild(resultCount);
      // 正解した行(全マス緑)には、正解の解答の横に小さく「正解！」を添える
      // (決定ボタンと同程度の大きさ。以前あった大きなメッセージ枠の代わり)。
      if(colors.every(function(c){ return c === 'green'; })){
        var correctLabel = document.createElement('span');
        correctLabel.className = 'dameke-search-add-btn dameke-nameguess-correct-label';
        correctLabel.textContent = '正解！';
        row.appendChild(correctLabel);
      }
      return row;
    }

    var guessError = null; // 直近の入力エラーメッセージ(あれば)

    function buildInputRow(active, index){
      var row = document.createElement('div');
      row.className = 'dameke-nameguess-row dameke-nameguess-row-input' + (active ? '' : ' dameke-nameguess-row-input-inactive');
      var input = document.createElement('input');
      input.type = 'text';
      input.className = 'dameke-nameguess-text-input';
      input.placeholder = 'ポケモン名';
      input.disabled = !active;
      row.appendChild(input);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dameke-search-add-btn dameke-nameguess-submit-btn';
      btn.textContent = '決定';
      btn.disabled = !active;
      if(active){
        function doSubmit(){ submitGuess(input.value); }
        btn.addEventListener('click', doSubmit);
        input.addEventListener('keydown', function(e){ if(e.key === 'Enter') doSubmit(); });
      }
      row.appendChild(btn);
      if(active){
        var inputCount = buildCountLabel(index);
        if(inputCount) row.appendChild(inputCount);
      }
      if(active && guessError){
        var err = document.createElement('span');
        err.className = 'dameke-nameguess-input-error';
        err.textContent = guessError;
        row.appendChild(err);
      }
      return row;
    }

    // ---- 入力の表記ゆれ(ひらがな/カタカナ、半角/全角)を吸収して候補と突き合わせる ----
    // NFKC正規化で「半角カタカナ→全角カタカナ(濁点・半濁点の合成含む)」「全角英数字→半角
    // 英数字」をまとめて処理し、続けてひらがな→カタカナの変換(コードポイントを+0x60)を行う。
    function normalizeForMatch(s){
      var nfkc = String(s||'').normalize('NFKC');
      return nfkc.replace(/[\u3041-\u3096]/g, function(c){ return String.fromCharCode(c.charCodeAt(0) + 0x60); }).trim();
    }

    function submitGuess(rawInput){
      if(nameGuessState.finished) return;
      var normalized = normalizeForMatch(rawInput);
      var match = getAllCandidates().indexOf(normalized) >= 0 ? normalized : null;
      if(!match){
        guessError = '入力に誤りがあります';
        renderRows();
        return;
      }
      applyGuess(match);
    }

    function applyGuess(word){
      if(nameGuessState.finished) return;
      guessError = null;
      var colors = computeColors(word, nameGuessState.answer);
      nameGuessState.guesses.push({ word: word, colors: colors });
      updateCharStatus(word, colors);
      if(colors.every(function(c){ return c === 'green'; })) nameGuessState.won = true;
      if(nameGuessState.won || nameGuessState.guesses.length >= MAX_TRIES) nameGuessState.finished = true;
      renderRows();
      renderHintTable();
      renderMessage();
      if(nameGuessState.finished) giveUpBtn.hidden = true;
    }

    // 初手をランダムに選ぶ。候補のうち正解そのものを除いたものから1つ選び、そのまま1手目として
    // 決定する(初手でいきなり正解してしまうことはない)。
    function pickRandomFirstGuess(){
      if(nameGuessState.finished || nameGuessState.guesses.length) return;
      var pool = getCandidates().filter(function(c){ return c !== nameGuessState.answer; });
      if(!pool.length) return;
      applyGuess(pool[Math.floor(Math.random() * pool.length)]);
    }

    function renderRows(){
      rowsHost.innerHTML = '';
      if(!nameGuessState.answer){
        var empty = document.createElement('div');
        empty.className = 'dameke-minigame-empty';
        empty.textContent = '範囲に当てはまるポケモンがいません。「範囲」で世代を選んでください。';
        rowsHost.appendChild(empty);
        return;
      }
      // 1手目の前(まだ1つも解答しておらず、ゲームも終わっていない間)だけ、1枠目の上に
      // 初手ランダム選出ボタンを出す。
      if(!nameGuessState.finished && !nameGuessState.guesses.length){
        var randomRow = document.createElement('div');
        randomRow.className = 'dameke-nameguess-random-row';
        var randomBtn = document.createElement('button');
        randomBtn.type = 'button';
        randomBtn.className = 'dameke-search-add-btn dameke-nameguess-random-btn';
        randomBtn.textContent = '初手をランダムで選ぶ';
        randomBtn.addEventListener('click', pickRandomFirstGuess);
        randomRow.appendChild(randomBtn);
        rowsHost.appendChild(randomRow);
      }
      for(var i = 0; i < MAX_TRIES; i++){
        var g = nameGuessState.guesses[i];
        if(g){ rowsHost.appendChild(buildResultRow(g.word, g.colors, i)); continue; }
        var isActive = !nameGuessState.finished && i === nameGuessState.guesses.length;
        rowsHost.appendChild(buildInputRow(isActive, i));
      }
    }


    giveUpBtn.addEventListener('click', function(){
      if(nameGuessState.finished) return;
      nameGuessState.finished = true;
      renderRows();
      renderMessage();
      giveUpBtn.hidden = true;
    });

    giveUpBtn.hidden = nameGuessState.finished;
    renderRows();
    renderHintTable();
    renderMessage();
  }

  // ==================== 種族値High&Low ====================
  var STAT_KEYS = ['H', 'A', 'B', 'C', 'D', 'S'];
  var STAT_LABELS = { H: 'HP', A: 'こうげき', B: 'ぼうぎょ', C: 'とくこう', D: 'とくぼう', S: 'すばやさ' };
  var GUESS_DEFS = [
    { key: 'HIGH', label: 'HIGH（高い）', cls: 'dameke-stathl-guess-btn-high' },
    { key: 'SAME', label: 'SAME（同じ）', cls: 'dameke-stathl-guess-btn-same' },
    { key: 'LOW', label: 'LOW（低い）', cls: 'dameke-stathl-guess-btn-low' }
  ];

  // ---- パネル表示用に、名前を1～2行に分割する ----
  // 括弧書きがあれば、その最初の開き括弧の直前で改行する(名前部分と括弧部分の2行)。
  // 括弧が入れ子(例:ネクロズマ(たそがれのたてがみ(ウルトラネクロズマ)))であっても、
  // 改行するのはこの最初の1箇所だけで、入れ子部分では再改行しない(2行目の中に
  // 入れ子の括弧がそのまま残る)。
  function formatPanelNameLines(name){
    var s = String(name || '');
    var idx = -1;
    for(var i = 0; i < s.length; i++){
      var c = s[i];
      if(c === '(' || c === '（'){ idx = i; break; }
    }
    if(idx === -1) return [s];
    return [s.slice(0, idx), s.slice(idx)];
  }

  // ---- 出題対象(最終進化のポケモン)を1度だけ計算してキャッシュする ----
  // 「最終進化」の判定は、ポケモン検索の「最終進化のみ」フィルタと同じ、canEvolveが
  // falseであることを基準とする(この判定基準はアプリ全体で統一済み)。
  var statHLPoolCache = null;
  function getStatHLPool(){
    if(statHLPoolCache) return statHLPoolCache;
    statHLPoolCache = (DATA.pokemons || []).filter(function(p){ return !p.canEvolve && p.baseStats; });
    return statHLPoolCache;
  }

  function pickRandomStatHLPokemon(exclude){
    var list = getStatHLPool();
    if(!list.length) return null;
    if(list.length === 1) return list[0];
    var p;
    do { p = list[Math.floor(Math.random() * list.length)]; } while(exclude && p === exclude);
    return p;
  }

  var statHLMode = 'mix'; // 'H'|'A'|'B'|'C'|'D'|'S'|'mix' -- モード選択は再挑戦しても引き継ぐ
  var statHLShowMode = 'view'; // 'view'|'hide' -- 基準の数値を見る/隠す(こちらも再挑戦時に引き継ぐ)
  var statHLState = null;

  function resolveStatHLRoundStat(){
    if(statHLMode === 'mix') return STAT_KEYS[Math.floor(Math.random() * STAT_KEYS.length)];
    return statHLMode;
  }

  // 新しいラウンドを開始する。1問目は基準・対象とも新規抽選、2問目以降は前回の
  // 「対象」ポケモンが新しい「基準」になり、対象だけ新規抽選する。
  function newStatHLRound(isFirstRound){
    var base = isFirstRound ? pickRandomStatHLPokemon(null) : statHLState.challenger;
    var challenger = pickRandomStatHLPokemon(base);
    statHLState.base = base;
    statHLState.challenger = challenger;
    statHLState.stat = resolveStatHLRoundStat();
    statHLState.hintUsed = false;
    statHLState.answered = false;
    statHLState.guess = null;
    statHLState.correct = null;
  }

  function newStatHLGame(){
    statHLState = { correctCount: 0, streak: 0, bestStreak: 0, wrongCount: 0, finished: false };
    newStatHLRound(true);
  }

  function renderStatHLGame(host){
    if(!statHLState) newStatHLGame();

    var wrap = document.createElement('div');
    wrap.className = 'dameke-stathl-wrap';

    var title = document.createElement('h3');
    title.className = 'dameke-minigame-title';
    title.textContent = '種族値High&Low';
    wrap.appendChild(title);

    var rulesFold = document.createElement('details');
    rulesFold.className = 'dameke-pokemon-edit-levelfold dameke-minigame-rules-fold';
    var rulesSummary = document.createElement('summary');
    rulesSummary.textContent = 'ルール';
    rulesFold.appendChild(rulesSummary);
    var rulesBody = document.createElement('div');
    rulesBody.className = 'dameke-minigame-rules-body';
    rulesBody.innerHTML =
      '<p>最終進化のポケモンから2体をランダムに表示します。左側が基準、右側が予想対象です。</p>' +
      '<p>対象の種族値(H・A・B・C・D・Sから選択。「ミックス」の場合は毎回ランダムな1つ)について、' +
      '右側のポケモンが左側の基準ポケモンと比べて「HIGH(高い)」「SAME(同じ)」「LOW(低い)」のどれかを予想してください。</p>' +
      '<p>「基準の数値」を「見る」にしていると、基準ポケモンの数値は常に見えており、「隠す」にしていると、' +
      '決定した後も含めて数値は一切表示されませんが、「ヒント」を押すと基準ポケモンの数値を確認できます。</p>' +
      '<p>正解すると、右側のポケモンが次の基準になり、新しい対象ポケモンが出てきます。3回間違えるとゲーム終了です。</p>';
    rulesFold.appendChild(rulesBody);
    wrap.appendChild(rulesFold);

    var modeRow = document.createElement('div');
    modeRow.className = 'dameke-stathl-mode-row';
    var modeLabel = document.createElement('span');
    modeLabel.className = 'dameke-adjust-nature-title dameke-stathl-mode-label';
    modeLabel.textContent = '対象の種族値：';
    modeRow.appendChild(modeLabel);
    STAT_KEYS.concat(['mix']).forEach(function(key){
      var lbl = document.createElement('label');
      lbl.className = 'dameke-stathl-mode-option';
      var radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'damekeStatHLMode';
      radio.value = key;
      radio.checked = statHLMode === key;
      radio.addEventListener('change', function(){
        if(!radio.checked || statHLMode === key) return;
        statHLMode = key;
        newStatHLGame();
        renderScore(); renderPanels(); renderGuessButtons(); renderMessage();
      });
      lbl.appendChild(radio);
      lbl.appendChild(document.createTextNode(key === 'mix' ? 'ミックス' : key));
      modeRow.appendChild(lbl);
    });
    wrap.appendChild(modeRow);

    var showModeRow = document.createElement('div');
    showModeRow.className = 'dameke-stathl-mode-row';
    var showModeLabel = document.createElement('span');
    showModeLabel.className = 'dameke-adjust-nature-title dameke-stathl-mode-label';
    showModeLabel.textContent = '基準の数値：';
    showModeRow.appendChild(showModeLabel);
    [['view', '見る'], ['hide', '隠す']].forEach(function(pair){
      var key = pair[0];
      var lbl = document.createElement('label');
      lbl.className = 'dameke-stathl-mode-option';
      var radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'damekeStatHLShowMode';
      radio.value = key;
      radio.checked = statHLShowMode === key;
      radio.addEventListener('change', function(){
        if(!radio.checked || statHLShowMode === key) return;
        statHLShowMode = key;
        newStatHLGame();
        renderScore(); renderPanels(); renderGuessButtons(); renderMessage();
      });
      lbl.appendChild(radio);
      lbl.appendChild(document.createTextNode(pair[1]));
      showModeRow.appendChild(lbl);
    });
    wrap.appendChild(showModeRow);

    var scoreHost = document.createElement('div');
    scoreHost.className = 'dameke-stathl-score';
    wrap.appendChild(scoreHost);

    var panelsHost = document.createElement('div');
    panelsHost.className = 'dameke-stathl-panels';
    wrap.appendChild(panelsHost);

    var guessRow = document.createElement('div');
    guessRow.className = 'dameke-stathl-guess-row';
    wrap.appendChild(guessRow);

    var messageHost = document.createElement('div');
    messageHost.className = 'dameke-minigame-message dameke-stathl-message';
    wrap.appendChild(messageHost);

    host.appendChild(wrap);

    function buildStatHLPanel(pokemon, opts){
      var panel = document.createElement('div');
      panel.className = 'dameke-stathl-panel';
      if(opts.resultClass) panel.classList.add('dameke-stathl-panel-' + opts.resultClass);
      var roleEl = document.createElement('div');
      roleEl.className = 'dameke-stathl-role';
      roleEl.textContent = opts.roleLabel;
      panel.appendChild(roleEl);
      var imgWrap = document.createElement('div');
      imgWrap.className = 'dameke-stathl-thumb';
      var img = (pokemon && window.__damekeBuildPokemonImage)
        ? window.__damekeBuildPokemonImage(pokemon.name, function(){ imgWrap.classList.add('dameke-stathl-thumb-missing'); imgWrap.innerHTML = ''; })
        : null;
      if(img) imgWrap.appendChild(img); else imgWrap.classList.add('dameke-stathl-thumb-missing');
      panel.appendChild(imgWrap);
      var nameEl = document.createElement('div');
      nameEl.className = 'dameke-stathl-name';
      formatPanelNameLines(pokemon ? pokemon.name : '').forEach(function(line){
        var lineEl = document.createElement('div');
        lineEl.className = 'dameke-stathl-name-line';
        lineEl.textContent = line;
        nameEl.appendChild(lineEl);
      });
      panel.appendChild(nameEl);
      var statEl = document.createElement('div');
      statEl.className = 'dameke-stathl-statvalue';
      if(opts.showValue && pokemon){
        statEl.textContent = STAT_LABELS[statHLState.stat] + '：' + pokemon.baseStats[statHLState.stat];
      } else {
        statEl.classList.add('dameke-stathl-statvalue-hidden');
        statEl.textContent = STAT_LABELS[statHLState.stat] + '：？';
      }
      panel.appendChild(statEl);
      return panel;
    }

    // 基準の数値をこのラウンドで見せてよいか(見る/隠すの設定に応じる)。「見る」モードは常時
    // 公開(ヒント不要)、「隠す」モードはヒントを押すまで(押した後は決定後も含めて)非公開。
    function computeBaseShow(){
      if(statHLShowMode === 'view') return true;
      return statHLState.hintUsed;
    }
    // 予想対象の数値をこのラウンドで見せてよいか
    function computeChallengerShow(){
      if(statHLShowMode === 'hide') return false;
      return statHLState.answered;
    }

    function renderScore(){
      scoreHost.innerHTML = '';
      var items = [
        '正解数：' + statHLState.correctCount,
        '連続正解：' + statHLState.streak,
        'ミス：' + statHLState.wrongCount + ' / 3'
      ];
      items.forEach(function(text){
        var s = document.createElement('span');
        s.className = 'dameke-stathl-score-item';
        s.textContent = text;
        scoreHost.appendChild(s);
      });
    }

    function renderPanels(){
      panelsHost.innerHTML = '';

      var baseSide = document.createElement('div');
      baseSide.className = 'dameke-stathl-side';
      baseSide.appendChild(buildStatHLPanel(statHLState.base, {
        showValue: computeBaseShow(), roleLabel: '基準'
      }));
      // ヒントボタンはパネルの外、基準パネルの直下に置く。「見る」モードでは基準は
      // 最初から常に公開されているため不要。「隠す」モードでのみ表示し、押すと基準の
      // 数値が(決定後も含めて)見えるようになる。1回押したら再度は不要なのでグレーアウト。
      if(statHLShowMode === 'hide'){
        var hintBtn = document.createElement('button');
        hintBtn.type = 'button';
        hintBtn.className = 'dameke-search-add-btn dameke-stathl-hint-btn';
        hintBtn.textContent = 'ヒント';
        hintBtn.disabled = statHLState.hintUsed;
        hintBtn.addEventListener('click', function(){
          statHLState.hintUsed = true;
          renderPanels();
        });
        baseSide.appendChild(hintBtn);
      }
      panelsHost.appendChild(baseSide);

      var vsEl = document.createElement('div');
      vsEl.className = 'dameke-stathl-vs';
      vsEl.textContent = 'VS';
      panelsHost.appendChild(vsEl);

      var challengerResultClass = statHLState.answered ? (statHLState.correct ? 'correct' : 'incorrect') : null;
      var challengerSide = document.createElement('div');
      challengerSide.className = 'dameke-stathl-side';
      challengerSide.appendChild(buildStatHLPanel(statHLState.challenger, {
        showValue: computeChallengerShow(), roleLabel: '予想対象', resultClass: challengerResultClass
      }));
      panelsHost.appendChild(challengerSide);
    }

    function renderGuessButtons(){
      guessRow.innerHTML = '';
      if(statHLState.finished) return;
      // 決定後にどれが正解肢かを求めるため、先に実際の判定を計算しておく。
      var actual = null;
      if(statHLState.answered){
        var baseVal = statHLState.base.baseStats[statHLState.stat];
        var challengerVal = statHLState.challenger.baseStats[statHLState.stat];
        actual = challengerVal > baseVal ? 'HIGH' : (challengerVal < baseVal ? 'LOW' : 'SAME');
      }
      GUESS_DEFS.forEach(function(def){
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dameke-search-add-btn dameke-stathl-guess-btn ' + def.cls;
        btn.disabled = statHLState.answered;
        var labelSpan = document.createElement('span');
        labelSpan.textContent = def.label;
        btn.appendChild(labelSpan);
        if(statHLState.answered){
          // 正解肢は選んだかどうかに関わらず常に緑にするが、○印は実際に選んだ場合のみ
          // 付ける(選ばなかった正解肢には印を付けない)。外した場合は、自分が選んだ
          // (不正解の)肢だけ赤+×で示す。
          if(def.key === actual) btn.classList.add('dameke-stathl-guess-btn-correct');
          if(def.key === statHLState.guess){
            var mark = document.createElement('span');
            mark.className = 'dameke-stathl-guess-mark';
            if(def.key === actual){
              mark.textContent = '○';
            } else {
              btn.classList.add('dameke-stathl-guess-btn-incorrect');
              mark.textContent = '×';
            }
            btn.appendChild(mark);
          }
        }
        if(!statHLState.answered){
          btn.addEventListener('click', function(){ submitStatHLGuess(def.key); });
        }
        guessRow.appendChild(btn);
      });
    }

    function submitStatHLGuess(guess){
      if(statHLState.answered || statHLState.finished) return;
      var baseVal = statHLState.base.baseStats[statHLState.stat];
      var challengerVal = statHLState.challenger.baseStats[statHLState.stat];
      var actual = challengerVal > baseVal ? 'HIGH' : (challengerVal < baseVal ? 'LOW' : 'SAME');
      var correct = guess === actual;
      statHLState.answered = true;
      statHLState.guess = guess;
      statHLState.correct = correct;
      if(correct){
        statHLState.correctCount++;
        statHLState.streak++;
        if(statHLState.streak > statHLState.bestStreak) statHLState.bestStreak = statHLState.streak;
      } else {
        statHLState.streak = 0;
        statHLState.wrongCount++;
        if(statHLState.wrongCount >= 3) statHLState.finished = true;
      }
      renderScore();
      renderPanels();
      renderGuessButtons();
      renderMessage();
    }

    function renderMessage(){
      messageHost.innerHTML = '';
      if(statHLState.finished){
        var over = document.createElement('div');
        over.className = 'dameke-stathl-gameover-message';
        over.textContent = 'ゲームオーバー：正解数' + statHLState.correctCount + '、最高連続正解' + statHLState.bestStreak;
        messageHost.appendChild(over);
        var retryBtn = document.createElement('button');
        retryBtn.type = 'button';
        retryBtn.className = 'dameke-search-add-btn dameke-minigame-retry-btn';
        retryBtn.textContent = 'リトライ';
        retryBtn.addEventListener('click', function(){
          newStatHLGame();
          renderScore(); renderPanels(); renderGuessButtons(); renderMessage();
        });
        messageHost.appendChild(retryBtn);
        return;
      }
      if(statHLState.answered){
        var nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'dameke-search-add-btn dameke-minigame-retry-btn';
        nextBtn.textContent = '次の問題へ';
        nextBtn.addEventListener('click', function(){
          newStatHLRound(false);
          renderPanels(); renderGuessButtons(); renderMessage();
        });
        messageHost.appendChild(nextBtn);
      }
    }

    renderScore();
    renderPanels();
    renderGuessButtons();
    renderMessage();
  }

  // ==================== 種族値チャートクイズ ====================
  var SVG_NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs){
    var el = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function(k){ el.setAttribute(k, attrs[k]); });
    return el;
  }

  // タイプの色付きバッジ表示用(ポケモン管理などと同じ配色。common.js の共通処理を使う)。
  function statChartTypeColorClass(t){ return window.DAMEKE_COMMON.typeColorClass(t); }

  // ---- チャンピオンズ参戦済み判定(ポケモン検索の「チャンピオンズ参戦済のみ」と同じロジック) ----
  function statChartHasChampionsEntry(p){ return window.DAMEKE_COMMON.hasChampionsEntry(p); }

  function getStatChartPool(finalOnly, championsOnly){
    return (DATA.pokemons || []).filter(function(p){
      if(!p.baseStats) return false;
      if(finalOnly && p.canEvolve) return false;
      if(championsOnly && !statChartHasChampionsEntry(p)) return false;
      return true;
    });
  }

  // ---- 種族値・(現在公開済みの)タイプ/特性ヒントすべてに一致するポケモンを探す ----
  // 未公開のヒント(まだ押していない分)は判定に含めない。種族値が完全一致するポケモンが
  // 複数いる場合、その全員が正解候補になる。
  function findStatChartMatches(target, revealedTypeCount, revealedAbilityCount, revealedGeneration){
    return (DATA.pokemons || []).filter(function(p){
      if(!p.baseStats) return false;
      return STAT_KEYS.every(function(k){ return p.baseStats[k] === target.baseStats[k]; });
    }).filter(function(p){
      for(var i = 0; i < revealedTypeCount; i++){
        if((p.types || [])[i] !== (target.types || [])[i]) return false;
      }
      return true;
    }).filter(function(p){
      for(var i = 0; i < revealedAbilityCount; i++){
        if((p.abilities || [])[i] !== (target.abilities || [])[i]) return false;
      }
      return true;
    }).filter(function(p){
      return !revealedGeneration || p.generation === target.generation;
    });
  }

  var statChartFinalOnly = false;
  var statChartChampionsOnly = false;
  var statChartState = null;

  function newStatChartQuestion(){
    var pool = getStatChartPool(statChartFinalOnly, statChartChampionsOnly);
    statChartState.pool = pool;
    statChartState.target = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    statChartState.revealedTypeCount = 0;
    statChartState.revealedAbilityCount = 0;
    statChartState.revealedGeneration = false;
    statChartState.answered = false;
    statChartState.correct = null;
    statChartState.gaveUp = false;
    statChartState.guessName = null;
  }

  function newStatChartGame(){
    statChartState = {};
    newStatChartQuestion();
  }

  // ---- 種族値レーダーチャート(SVG) ----
  // 目盛りの上限は200だが、それを超える値はそのまま外側にはみ出させる(クランプしない)。
  var STATCHART_STAT_LABELS = { H: 'HP', A: 'こうげき', B: 'ぼうぎょ', C: 'とくこう', D: 'とくぼう', S: 'すばやさ' };
  // 上がHPで、時計回りにHP→とくこう→とくぼう→すばやさ→ぼうぎょ→こうげき、の順で配置する。
  var STATCHART_AXIS_ORDER = ['H', 'C', 'D', 'S', 'B', 'A'];
  function statChartPointAtRadius(index, r, cx, cy){
    var angleDeg = -90 + index * 60;
    var rad = angleDeg * Math.PI / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  }
  function buildRadarChart(baseStats){
    // ラベル・数値・合計の文字サイズを大きくした分、はみ出さないようキャンバス自体を
    // 一回り広げておく(チャート本体の半径maxR/farRは変えない)。
    var size = 480, cx = 240, cy = 240, maxR = 120, farR = 150;
    var svg = svgEl('svg', { viewBox: '0 0 ' + size + ' ' + size, class: 'dameke-statchart-svg' });

    // 目盛りの補助線(50/100/150/200)
    [50, 100, 150, 200].forEach(function(ringVal){
      var pts = STATCHART_AXIS_ORDER.map(function(k, i){
        var r = maxR * (ringVal / 200);
        return statChartPointAtRadius(i, r, cx, cy).join(',');
      }).join(' ');
      svg.appendChild(svgEl('polygon', { points: pts, class: 'dameke-statchart-grid' + (ringVal === 200 ? ' dameke-statchart-grid-outer' : '') }));
    });

    // 軸線(はみ出す分もカバーできるよう、目盛り最外周よりさらに外まで伸ばしておく)
    STATCHART_AXIS_ORDER.forEach(function(k, i){
      var far = statChartPointAtRadius(i, farR, cx, cy);
      svg.appendChild(svgEl('line', { x1: cx, y1: cy, x2: far[0], y2: far[1], class: 'dameke-statchart-axis' }));
    });

    // 目盛りの数値(50刻み)を、目立たない文字で上の軸に沿って表示する。
    [50, 100, 150, 200].forEach(function(ringVal){
      var r = maxR * (ringVal / 200);
      var pt = statChartPointAtRadius(0, r, cx, cy);
      var tickText = svgEl('text', { x: pt[0] + 5, y: pt[1] - 2, class: 'dameke-statchart-tick-label', 'text-anchor': 'start' });
      tickText.textContent = String(ringVal);
      svg.appendChild(tickText);
    });

    // データ多角形(200を超える値はmaxRを超えてそのまま外側に描画される)
    var dataPts = STATCHART_AXIS_ORDER.map(function(k, i){
      var r = maxR * ((baseStats[k] || 0) / 200);
      return statChartPointAtRadius(i, r, cx, cy).join(',');
    }).join(' ');
    svg.appendChild(svgEl('polygon', { points: dataPts, class: 'dameke-statchart-data' }));
    STATCHART_AXIS_ORDER.forEach(function(k, i){
      var r = maxR * ((baseStats[k] || 0) / 200);
      var pt = statChartPointAtRadius(i, r, cx, cy);
      svg.appendChild(svgEl('circle', { cx: pt[0], cy: pt[1], r: 3.5, class: 'dameke-statchart-data-dot' }));
    });

    // 軸ラベル(種族値名+実際の値)。左右どちら寄りかで文字の揃えを変える。
    STATCHART_AXIS_ORDER.forEach(function(k, i){
      var labelPt = statChartPointAtRadius(i, farR + 18, cx, cy);
      var angleDeg = -90 + i * 60;
      var cos = Math.cos(angleDeg * Math.PI / 180);
      var anchor = cos > 0.3 ? 'start' : (cos < -0.3 ? 'end' : 'middle');
      var nameText = svgEl('text', { x: labelPt[0], y: labelPt[1] - 4, class: 'dameke-statchart-label-name', 'text-anchor': anchor });
      nameText.textContent = STATCHART_STAT_LABELS[k];
      svg.appendChild(nameText);
      var valText = svgEl('text', { x: labelPt[0], y: labelPt[1] + 17, class: 'dameke-statchart-label-value', 'text-anchor': anchor });
      valText.textContent = String(baseStats[k]);
      svg.appendChild(valText);
    });

    // 種族値合計を右下に表示する。
    var total = STAT_KEYS.reduce(function(sum, k){ return sum + (baseStats[k] || 0); }, 0);
    var totalText = svgEl('text', { x: size - 14, y: size - 16, class: 'dameke-statchart-total', 'text-anchor': 'end' });
    totalText.textContent = '合計：' + total;
    svg.appendChild(totalText);

    return svg;
  }

  function renderStatChartGame(host){
    if(!statChartState) newStatChartGame();

    var wrap = document.createElement('div');
    wrap.className = 'dameke-statchart-wrap';

    var title = document.createElement('h3');
    title.className = 'dameke-minigame-title';
    title.textContent = '種族値チャートクイズ';
    wrap.appendChild(title);

    var rulesFold = document.createElement('details');
    rulesFold.className = 'dameke-pokemon-edit-levelfold dameke-minigame-rules-fold';
    var rulesSummary = document.createElement('summary');
    rulesSummary.textContent = 'ルール';
    rulesFold.appendChild(rulesSummary);
    var rulesBody = document.createElement('div');
    rulesBody.className = 'dameke-minigame-rules-body';
    rulesBody.innerHTML =
      '<p>ランダムに抽出されたポケモン1体の種族値(H・A・B・C・D・S)がレーダーチャートで表示されるので、' +
      'ポケモンを当てるゲームです。</p>' +
      '<p>「タイプ」「特性」の各ヒントボタンで、そのポケモンのタイプ・特性を1つずつ確認できます。' +
      '「世代」のヒントボタンでは、そのポケモンの世代を確認できます。</p>' +
      '<p>入力欄にポケモン名を入力すると正誤判定します。</p>' +
      '<p>なお、種族値と、その時点で公開済みのヒントすべてに一致するポケモンが他にもいる場合は、' +
      'そのポケモンで答えても正解として扱われます。</p>';
    rulesFold.appendChild(rulesBody);
    wrap.appendChild(rulesFold);

    var filterRow = document.createElement('div');
    filterRow.className = 'dameke-stathl-mode-row';
    var finalLabel = document.createElement('label');
    finalLabel.className = 'dameke-stathl-mode-option';
    var finalCb = document.createElement('input');
    finalCb.type = 'checkbox';
    finalCb.checked = statChartFinalOnly;
    finalCb.addEventListener('change', function(){
      statChartFinalOnly = finalCb.checked;
      newStatChartGame();
      renderAll();
    });
    finalLabel.appendChild(finalCb);
    finalLabel.appendChild(document.createTextNode('最終進化のみ'));
    filterRow.appendChild(finalLabel);
    var champLabel = document.createElement('label');
    champLabel.className = 'dameke-stathl-mode-option';
    var champCb = document.createElement('input');
    champCb.type = 'checkbox';
    champCb.checked = statChartChampionsOnly;
    champCb.addEventListener('change', function(){
      statChartChampionsOnly = champCb.checked;
      newStatChartGame();
      renderAll();
    });
    champLabel.appendChild(champCb);
    champLabel.appendChild(document.createTextNode('チャンピオンズ参戦済みのみ'));
    filterRow.appendChild(champLabel);
    wrap.appendChild(filterRow);

    var chartHost = document.createElement('div');
    chartHost.className = 'dameke-statchart-chart-host';
    wrap.appendChild(chartHost);

    var hintsFrame = document.createElement('div');
    hintsFrame.className = 'dameke-statchart-hints-frame';
    var hintsLegend = document.createElement('div');
    hintsLegend.className = 'dameke-statchart-hints-legend';
    hintsLegend.textContent = 'ヒント';
    hintsFrame.appendChild(hintsLegend);
    var hintsHost = document.createElement('div');
    hintsHost.className = 'dameke-statchart-hints';
    hintsFrame.appendChild(hintsHost);
    wrap.appendChild(hintsFrame);

    var answerRow = document.createElement('div');
    answerRow.className = 'dameke-statchart-answer-row';
    wrap.appendChild(answerRow);

    var giveUpBtn = document.createElement('button');
    giveUpBtn.type = 'button';
    giveUpBtn.className = 'dameke-search-add-btn dameke-statchart-answer-btn dameke-minigame-giveup-btn';
    giveUpBtn.textContent = 'ギブアップ';

    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'dameke-search-add-btn dameke-statchart-answer-btn dameke-minigame-retry-btn';
    nextBtn.textContent = '次の問題へ';
    nextBtn.addEventListener('click', function(){
      newStatChartQuestion();
      renderAll();
    });

    var messageHost = document.createElement('div');
    messageHost.className = 'dameke-minigame-message dameke-stathl-message';
    wrap.appendChild(messageHost);

    host.appendChild(wrap);

    function renderChart(){
      chartHost.innerHTML = '';
      if(!statChartState.target){
        var empty = document.createElement('div');
        empty.textContent = '条件に当てはまるポケモンがいません。絞り込みを見直してください。';
        chartHost.appendChild(empty);
        return;
      }
      chartHost.appendChild(buildRadarChart(statChartState.target.baseStats));
    }

    function buildTypeBadge(t){
      var badge = document.createElement('span');
      badge.className = 'dameke-party-type-badge dameke-statchart-type-badge ' + statChartTypeColorClass(t);
      badge.textContent = t;
      return badge;
    }

    function renderHints(){
      hintsHost.innerHTML = '';
      if(!statChartState.target) return;
      var target = statChartState.target;

      var typeRow = document.createElement('div');
      typeRow.className = 'dameke-statchart-hint-row';
      var typeBtn = document.createElement('button');
      typeBtn.type = 'button';
      typeBtn.className = 'dameke-search-add-btn dameke-statchart-hint-btn';
      typeBtn.textContent = 'タイプ';
      var typeMax = (target.types || []).length;
      var typeExhausted = statChartState.revealedTypeCount >= typeMax;
      typeBtn.disabled = statChartState.answered || typeExhausted;
      if(typeExhausted) typeBtn.classList.add('dameke-statchart-hint-btn-exhausted');
      typeBtn.addEventListener('click', function(){
        statChartState.revealedTypeCount = Math.min(typeMax, statChartState.revealedTypeCount + 1);
        renderHints();
      });
      typeRow.appendChild(typeBtn);
      var typeValues = document.createElement('span');
      typeValues.className = 'dameke-statchart-hint-values';
      for(var i = 0; i < statChartState.revealedTypeCount; i++){
        typeValues.appendChild(buildTypeBadge(target.types[i]));
      }
      typeRow.appendChild(typeValues);
      hintsHost.appendChild(typeRow);

      var abilityRow = document.createElement('div');
      abilityRow.className = 'dameke-statchart-hint-row';
      var abilityBtn = document.createElement('button');
      abilityBtn.type = 'button';
      abilityBtn.className = 'dameke-search-add-btn dameke-statchart-hint-btn';
      abilityBtn.textContent = '特性';
      var abilityMax = (target.abilities || []).length;
      var abilityExhausted = statChartState.revealedAbilityCount >= abilityMax;
      abilityBtn.disabled = statChartState.answered || abilityExhausted;
      if(abilityExhausted) abilityBtn.classList.add('dameke-statchart-hint-btn-exhausted');
      abilityBtn.addEventListener('click', function(){
        statChartState.revealedAbilityCount = Math.min(abilityMax, statChartState.revealedAbilityCount + 1);
        renderHints();
      });
      abilityRow.appendChild(abilityBtn);
      var abilityValues = document.createElement('span');
      abilityValues.className = 'dameke-statchart-hint-values';
      abilityValues.textContent = (target.abilities || []).slice(0, statChartState.revealedAbilityCount).join('、');
      abilityRow.appendChild(abilityValues);
      hintsHost.appendChild(abilityRow);

      var genRow = document.createElement('div');
      genRow.className = 'dameke-statchart-hint-row';
      var genBtn = document.createElement('button');
      genBtn.type = 'button';
      genBtn.className = 'dameke-search-add-btn dameke-statchart-hint-btn';
      genBtn.textContent = '世代';
      var genExhausted = !!statChartState.revealedGeneration;
      genBtn.disabled = statChartState.answered || genExhausted;
      if(genExhausted) genBtn.classList.add('dameke-statchart-hint-btn-exhausted');
      genBtn.addEventListener('click', function(){
        statChartState.revealedGeneration = true;
        renderHints();
      });
      genRow.appendChild(genBtn);
      var genValues = document.createElement('span');
      genValues.className = 'dameke-statchart-hint-values';
      genValues.textContent = statChartState.revealedGeneration ? '第' + target.generation + '世代' : '';
      genRow.appendChild(genValues);
      hintsHost.appendChild(genRow);
    }

    function renderAnswerRow(){
      answerRow.innerHTML = '';
      if(!statChartState.target) return;
      if(statChartState.answered){
        answerRow.appendChild(nextBtn);
        return;
      }
      var select = document.createElement('select');
      select.className = 'dameke-statchart-answer-select';
      (DATA.pokemons || []).forEach(function(p){
        var op = document.createElement('option');
        op.value = p.id; op.textContent = p.name;
        select.appendChild(op);
      });
      select.value = '';
      var placeholderOp = document.createElement('option');
      placeholderOp.value = ''; placeholderOp.textContent = 'ポケモン名';
      select.insertBefore(placeholderOp, select.firstChild);
      select.value = '';
      answerRow.appendChild(select);
      if(window.__damekeAttachSearchCombo){
        Promise.resolve().then(function(){ window.__damekeAttachSearchCombo(select); });
      }
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dameke-search-add-btn dameke-statchart-answer-btn';
      btn.textContent = '決定';
      btn.addEventListener('click', function(){
        if(!select.value) return;
        submitStatChartGuess(select.value);
      });
      answerRow.appendChild(btn);
      giveUpBtn.hidden = false;
      answerRow.appendChild(giveUpBtn);
    }

    function submitStatChartGuess(pokemonId){
      var target = statChartState.target;
      var guessed = (DATA.pokemons || []).find(function(p){ return p.id === pokemonId; });
      if(!guessed || statChartState.answered) return;
      var matches = findStatChartMatches(target, statChartState.revealedTypeCount, statChartState.revealedAbilityCount, statChartState.revealedGeneration);
      var correct = matches.some(function(p){ return p.id === guessed.id; });
      statChartState.answered = true;
      statChartState.correct = correct;
      statChartState.gaveUp = false;
      statChartState.guessName = guessed.name;
      // 決定後は、その回のタイプ・特性・世代ヒントをすべて公開する。
      statChartState.revealedTypeCount = (target.types || []).length;
      statChartState.revealedAbilityCount = (target.abilities || []).length;
      statChartState.revealedGeneration = true;
      renderAll();
    }

    function giveUpStatChart(){
      var target = statChartState.target;
      if(!target || statChartState.answered) return;
      statChartState.answered = true;
      statChartState.correct = false;
      statChartState.gaveUp = true;
      statChartState.guessName = null;
      statChartState.revealedTypeCount = (target.types || []).length;
      statChartState.revealedAbilityCount = (target.abilities || []).length;
      statChartState.revealedGeneration = true;
      renderAll();
    }

    giveUpBtn.addEventListener('click', giveUpStatChart);

    function renderMessage(){
      messageHost.innerHTML = '';
      if(!statChartState.target || !statChartState.answered) return;
      var target = statChartState.target;
      var resultLine = document.createElement('div');
      resultLine.className = statChartState.correct ? 'dameke-statchart-result-correct' : 'dameke-statchart-result-incorrect';
      resultLine.textContent = statChartState.gaveUp ? 'ギブアップ' : (statChartState.correct ? '正解！' : '不正解');
      messageHost.appendChild(resultLine);
      if(statChartState.gaveUp){
        // ギブアップ時は回答自体がないため、回答行は表示しない。
      } else if(!statChartState.correct){
        var guessLine = document.createElement('div');
        guessLine.className = 'dameke-statchart-guess-line';
        guessLine.textContent = 'あなたの回答：' + statChartState.guessName;
        messageHost.appendChild(guessLine);
      } else if(statChartState.guessName !== target.name){
        var altLine = document.createElement('div');
        altLine.className = 'dameke-statchart-guess-line';
        altLine.textContent = 'あなたの回答（' + statChartState.guessName + '）も、公開済みの情報からは正解として扱っています。';
        messageHost.appendChild(altLine);
      }
      var answerRowEl = document.createElement('div');
      answerRowEl.className = 'dameke-statchart-answer-reveal';
      var imgWrap = document.createElement('span');
      imgWrap.className = 'dameke-stathl-thumb dameke-statchart-answer-thumb';
      var img = window.__damekeBuildPokemonImage
        ? window.__damekeBuildPokemonImage(target.name, function(){ imgWrap.classList.add('dameke-stathl-thumb-missing'); imgWrap.innerHTML = ''; })
        : null;
      if(img) imgWrap.appendChild(img); else imgWrap.classList.add('dameke-stathl-thumb-missing');
      answerRowEl.appendChild(imgWrap);
      var nameEl = document.createElement('span');
      nameEl.className = 'dameke-statchart-answer-name';
      nameEl.textContent = '正解：' + target.name;
      answerRowEl.appendChild(nameEl);
      messageHost.appendChild(answerRowEl);
    }

    function renderAll(){
      renderChart();
      renderHints();
      renderAnswerRow();
      renderMessage();
    }

    renderAll();
  }

  // ==================== ランダムポケモン出力 ====================
  // ゲームではなく、条件を指定してランダムにポケモンを抽選・表示するだけの単純なツール。

  // メガシンカ形態かどうか(formLabelが「メガ」「メガX」「メガY」等、「メガ」で始まるもの)。
  // ポケモン自体の名前が偶然「メガ」で始まる場合(メガニウム、メガヤンマ等)と区別するため、
  // 名前ではなくformLabelで判定する。ゲンシグラードン/ゲンシカイオーガ(formLabelが「ゲンシ」
  // で始まる)も、専用アイテムで姿・種族値・特性が変化する点でメガシンカと同様に扱う。
  function isMegaPokemon(p){
    var label = p.formLabel || '';
    return /^メガ/.test(label) || /^ゲンシ/.test(label);
  }

  // フォルム違い・メガシンカ前後の重複判定用グループキー。
  // 同一種内で戦闘中に姿を変えられるもの(メガシンカ、フォルムチェンジ等)はformGroupが共通なのでそれを優先し、
  // フォルムチェンジできない別種扱いのリージョンフォーム(アローラ等)はformGroupを持たないため、
  // baseSpecies(フォルムをまたいで共通の名称)で束ねる。
  function randomGenGroupKey(p){
    return p.formGroup || p.baseSpecies || p.speciesKey || p.name;
  }

  function getRandomGenPool(finalOnly, championsOnly, megaOnly, megaExclude, regulations, gens){
    return (DATA.pokemons || []).filter(function(p){
      if(!p.baseStats) return false;
      if(gens && !gens[p.generation]) return false;
      if(finalOnly && p.canEvolve) return false;
      if(championsOnly && !statChartHasChampionsEntry(p)) return false;
      var mega = isMegaPokemon(p);
      if(megaOnly && !mega) return false;
      if(megaExclude && mega) return false;
      if(regulations && regulations.length){
        var R = window.DAMEKE_REGULATIONS;
        var regTag = R ? R.regulationOf(p.name) : null;
        if(regulations.indexOf(regTag) === -1) return false;
      }
      return true;
    });
  }

  function shuffleArray(list){
    var a = list.slice();
    for(var i = a.length - 1; i > 0; i--){
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // 指定数だけ抽選する。同一ポケモン(id)の重複は必ず避け、
  // 可能な範囲でフォルム違い・メガシンカ前後(=randomGenGroupKeyが同じもの)の重複も避ける。
  function drawRandomGenSet(pool, count){
    var shuffled = shuffleArray(pool);
    var results = [];
    var usedIds = Object.create(null);
    var usedGroups = Object.create(null);
    shuffled.forEach(function(p){
      if(results.length >= count) return;
      var g = randomGenGroupKey(p);
      if(usedGroups[g]) return;
      usedGroups[g] = true;
      usedIds[p.id] = true;
      results.push(p);
    });
    if(results.length < count){
      shuffled.forEach(function(p){
        if(results.length >= count) return;
        if(usedIds[p.id]) return;
        usedIds[p.id] = true;
        results.push(p);
      });
    }
    return results;
  }

  var randomGenFinalOnly = false;
  var randomGenChampionsOnly = true;
  var randomGenMegaOnly = false;
  var randomGenMegaExclude = false;
  var randomGenRegulations = [];
  var randomGenGens = newGenSelection();
  var randomGenCount = 6;
  var randomGenState = null;

  function newRandomGenSet(){
    var pool = getRandomGenPool(randomGenFinalOnly, randomGenChampionsOnly, randomGenMegaOnly, randomGenMegaExclude, randomGenRegulations, randomGenGens);
    randomGenState = { pool: pool, results: drawRandomGenSet(pool, randomGenCount) };
  }

  // 1枠だけ再抽選する。表示中の他の枠とid・(可能な範囲で)グループキーが被らないようにする。
  function redrawRandomGenSlot(index){
    if(!randomGenState) return;
    var pool = randomGenState.pool;
    var usedIds = Object.create(null);
    var usedGroups = Object.create(null);
    randomGenState.results.forEach(function(p, i){
      if(i === index || !p) return;
      usedIds[p.id] = true;
      usedGroups[randomGenGroupKey(p)] = true;
    });
    var shuffled = shuffleArray(pool);
    var pick = shuffled.filter(function(p){ return !usedIds[p.id]; })
      .find(function(p){ return !usedGroups[randomGenGroupKey(p)]; });
    if(!pick){
      pick = shuffled.find(function(p){ return !usedIds[p.id]; }) || null;
    }
    randomGenState.results[index] = pick;
  }

  function renderRandomGenGame(host){
    if(!randomGenState) newRandomGenSet();

    var wrap = document.createElement('div');
    wrap.className = 'dameke-randomgen-wrap';

    var title = document.createElement('h3');
    title.className = 'dameke-minigame-title';
    title.textContent = 'ランダムポケモン出力';
    wrap.appendChild(title);

    var rulesFold = document.createElement('details');
    rulesFold.className = 'dameke-pokemon-edit-levelfold dameke-minigame-rules-fold';
    var rulesSummary = document.createElement('summary');
    rulesSummary.textContent = 'このツールについて';
    rulesFold.appendChild(rulesSummary);
    var rulesBody = document.createElement('div');
    rulesBody.className = 'dameke-minigame-rules-body';
    rulesBody.innerHTML =
      '<p>ポケモンをランダムに抽選・表示するツールです。同時に出力されるポケモンは重複しません。' +
      'フォルム違いなども重ならないようにしています。</p>' +
      '<p>各「再抽選」ボタンでは、そのポケモンだけを引き直します。</p>';
    rulesFold.appendChild(rulesBody);
    wrap.appendChild(rulesFold);

    // 範囲の折り畳み: 世代・絞り込みのチェックボックス・レギュレーション(折り畳み)をまとめる。
    var rangeFold = buildMinigameFold('範囲');
    rangeFold.body.appendChild(buildGenRangeRow(randomGenGens, function(){
      newRandomGenSet();
      renderGrid();
    }));
    wrap.appendChild(rangeFold.fold);

    var filterRow = document.createElement('div');
    filterRow.className = 'dameke-stathl-mode-row';

    var finalLabel = document.createElement('label');
    finalLabel.className = 'dameke-stathl-mode-option';
    var finalCb = document.createElement('input');
    finalCb.type = 'checkbox';
    finalCb.checked = randomGenFinalOnly;
    finalLabel.appendChild(finalCb);
    finalLabel.appendChild(document.createTextNode('最終進化のみ'));
    filterRow.appendChild(finalLabel);

    var champLabel = document.createElement('label');
    champLabel.className = 'dameke-stathl-mode-option';
    var champCb = document.createElement('input');
    champCb.type = 'checkbox';
    champCb.checked = randomGenChampionsOnly;
    champLabel.appendChild(champCb);
    champLabel.appendChild(document.createTextNode('チャンピオンズ参戦済みのみ'));
    filterRow.appendChild(champLabel);

    var megaOnlyLabel = document.createElement('label');
    megaOnlyLabel.className = 'dameke-stathl-mode-option';
    var megaOnlyCb = document.createElement('input');
    megaOnlyCb.type = 'checkbox';
    megaOnlyCb.checked = randomGenMegaOnly;
    megaOnlyLabel.appendChild(megaOnlyCb);
    megaOnlyLabel.appendChild(document.createTextNode('メガシンカのみ'));
    filterRow.appendChild(megaOnlyLabel);

    var megaExcludeLabel = document.createElement('label');
    megaExcludeLabel.className = 'dameke-stathl-mode-option';
    var megaExcludeCb = document.createElement('input');
    megaExcludeCb.type = 'checkbox';
    megaExcludeCb.checked = randomGenMegaExclude;
    megaExcludeLabel.appendChild(megaExcludeCb);
    megaExcludeLabel.appendChild(document.createTextNode('メガシンカ除外'));
    filterRow.appendChild(megaExcludeLabel);

    rangeFold.body.appendChild(filterRow);

    // レギュレーション絞り込み(複数選択可。何もチェックしなければ絞り込みなし)。
    var regFold = document.createElement('details');
    regFold.className = 'dameke-pokemon-edit-levelfold dameke-minigame-range-subfold';
    var regSummary = document.createElement('summary');
    regSummary.textContent = 'レギュレーション';
    regFold.appendChild(regSummary);
    var regRow = document.createElement('div'); regRow.className = 'dameke-stathl-mode-row';
    var RG = window.DAMEKE_REGULATIONS;
    if(RG){
      RG.tagOrder.forEach(function(tag){
        var label = document.createElement('label'); label.className = 'dameke-stathl-mode-option';
        var cb = document.createElement('input'); cb.type = 'checkbox';
        cb.checked = randomGenRegulations.indexOf(tag) >= 0;
        cb.addEventListener('change', function(){
          var idx = randomGenRegulations.indexOf(tag);
          if(cb.checked && idx === -1) randomGenRegulations.push(tag);
          else if(!cb.checked && idx >= 0) randomGenRegulations.splice(idx, 1);
          newRandomGenSet();
          renderGrid();
        });
        label.appendChild(cb); label.appendChild(document.createTextNode(RG.labels[tag]));
        regRow.appendChild(label);
      });
    }
    regFold.appendChild(regRow);
    rangeFold.body.appendChild(regFold);

    var countRow = document.createElement('div');
    countRow.className = 'dameke-stathl-mode-row';
    var countLabel = document.createElement('label');
    countLabel.className = 'dameke-randomgen-count-label';
    countLabel.appendChild(document.createTextNode('同時出力数：'));
    var countSelect = document.createElement('select');
    countSelect.className = 'dameke-randomgen-count-select';
    for(var c = 1; c <= 6; c++){
      var countOp = document.createElement('option');
      countOp.value = String(c);
      countOp.textContent = c + '体';
      countSelect.appendChild(countOp);
    }
    countSelect.value = String(randomGenCount);
    countLabel.appendChild(countSelect);
    countRow.appendChild(countLabel);
    wrap.appendChild(countRow);

    var actionsRow = document.createElement('div');
    actionsRow.className = 'dameke-randomgen-actions-row';
    var redrawAllBtn = document.createElement('button');
    redrawAllBtn.type = 'button';
    redrawAllBtn.className = 'dameke-search-add-btn';
    redrawAllBtn.textContent = '出力しなおす';
    actionsRow.appendChild(redrawAllBtn);
    wrap.appendChild(actionsRow);

    var gridHost = document.createElement('div');
    gridHost.className = 'dameke-randomgen-grid';
    wrap.appendChild(gridHost);

    host.appendChild(wrap);

    function renderGrid(){
      gridHost.innerHTML = '';
      if(!randomGenState.pool.length){
        var empty = document.createElement('div');
        empty.className = 'dameke-randomgen-empty';
        empty.textContent = '条件に当てはまるポケモンがいません。絞り込みを見直してください。';
        gridHost.appendChild(empty);
        return;
      }
      randomGenState.results.forEach(function(p, idx){
        var card = document.createElement('div');
        card.className = 'dameke-randomgen-card';

        var body = document.createElement('div');
        body.className = 'dameke-randomgen-card-body';
        if(p){
          var imgWrap = document.createElement('div');
          imgWrap.className = 'dameke-randomgen-thumb';
          var img = window.__damekeBuildPokemonImage
            ? window.__damekeBuildPokemonImage(p.name, function(){ imgWrap.classList.add('dameke-randomgen-thumb-missing'); imgWrap.innerHTML = ''; })
            : null;
          if(img) imgWrap.appendChild(img); else imgWrap.classList.add('dameke-randomgen-thumb-missing');
          body.appendChild(imgWrap);

          var nameEl = document.createElement('div');
          nameEl.className = 'dameke-randomgen-name';
          nameEl.textContent = p.name;
          body.appendChild(nameEl);

          var typesRow = document.createElement('div');
          typesRow.className = 'dameke-randomgen-types';
          (p.types || []).forEach(function(t){
            var badge = document.createElement('span');
            badge.className = 'dameke-party-type-badge dameke-statchart-type-badge ' + statChartTypeColorClass(t);
            badge.textContent = t;
            typesRow.appendChild(badge);
          });
          body.appendChild(typesRow);
        } else {
          var none = document.createElement('div');
          none.className = 'dameke-randomgen-card-empty';
          none.textContent = '候補切れ';
          body.appendChild(none);
        }
        card.appendChild(body);

        var redrawRow = document.createElement('div');
        redrawRow.className = 'dameke-randomgen-redraw-row';
        var redrawBtn = document.createElement('button');
        redrawBtn.type = 'button';
        redrawBtn.className = 'dameke-search-add-btn dameke-randomgen-redraw-btn';
        redrawBtn.textContent = '再抽選';
        redrawBtn.addEventListener('click', function(){
          redrawRandomGenSlot(idx);
          renderGrid();
        });
        redrawRow.appendChild(redrawBtn);
        card.appendChild(redrawRow);

        gridHost.appendChild(card);
      });
    }

    finalCb.addEventListener('change', function(){
      randomGenFinalOnly = finalCb.checked;
      newRandomGenSet();
      renderGrid();
    });
    champCb.addEventListener('change', function(){
      randomGenChampionsOnly = champCb.checked;
      newRandomGenSet();
      renderGrid();
    });
    megaOnlyCb.addEventListener('change', function(){
      randomGenMegaOnly = megaOnlyCb.checked;
      if(randomGenMegaOnly && randomGenMegaExclude){
        randomGenMegaExclude = false;
        megaExcludeCb.checked = false;
      }
      newRandomGenSet();
      renderGrid();
    });
    megaExcludeCb.addEventListener('change', function(){
      randomGenMegaExclude = megaExcludeCb.checked;
      if(randomGenMegaExclude && randomGenMegaOnly){
        randomGenMegaOnly = false;
        megaOnlyCb.checked = false;
      }
      newRandomGenSet();
      renderGrid();
    });
    countSelect.addEventListener('change', function(){
      randomGenCount = parseInt(countSelect.value, 10) || 1;
      newRandomGenSet();
      renderGrid();
    });
    redrawAllBtn.addEventListener('click', function(){
      newRandomGenSet();
      renderGrid();
    });

    renderGrid();
  }

  // ==================== ポケモン図鑑埋め ====================
  // ポケモン名を入力して、図鑑番号順に並んだ空欄の枠を埋めていくゲーム。
  // ・枠はデータ(DATA.pokemons)の1件ごとに1つ。並び順はデータの順(図鑑番号順)のまま。
  // ・フォルム違い・メガシンカ・ゲンシカイキ・リージョンフォーム等は「同じ種」としてまとめ、
  //   1回の解答ですべて開く。まとめる単位は speciesKey から括弧書きを除いた名前
  //   (例: 「ロコン」と「ロコン(アローラ)」、「フシギバナ」と「メガフシギバナ」)。
  // ・範囲は世代(各ポケモンの generation。data.js で設定)ごとに切り替えられる。
  // ・解答済みの記録は世代の切り替えでは消えない(リトライ・リセットで消える)。端末に保存され、
  //   再読み込み後も続きから遊べる。
  // 記号が入っていて入力しづらい名前の別表記(正規化後の文字列 → 種の名前)。
  var DEXFILL_ALIASES = { 'ニドランメス': 'ニドラン♀', 'ニドランオス': 'ニドラン♂' };

  // 入力と候補名の両方にかける正規化。半角/全角・ひらがな/カタカナの違いに加えて、
  // 空白・中黒・コロン・括弧の有無も無視する(例: 「かぷこけこ」「タイプヌル」「ろこんあろーら」)。
  function dexFillNormalize(s){
    return String(s || '').normalize('NFKC')
      .replace(/[ぁ-ゖ]/g, function(c){ return String.fromCharCode(c.charCodeAt(0) + 0x60); })
      .replace(/[\s・:()]/g, '')
      .toUpperCase();
  }

  // 種ごとのまとまりと、解答文字列から種を引く表を1度だけ作る。
  var dexFillIndexCache = null;
  function getDexFillIndex(){
    if(dexFillIndexCache) return dexFillIndexCache;
    var groups = [];                      // データ順。{ root, generation, members:[pokemon] }
    var byRoot = Object.create(null);
    var byKey = Object.create(null);      // 正規化した解答文字列 → group
    (DATA.pokemons || []).forEach(function(p){
      var root = stripParens(p.speciesKey || p.name);
      var group = byRoot[root];
      if(!group){
        group = byRoot[root] = { root: root, generation: p.generation, members: [] };
        groups.push(group);
      }
      group.members.push(p);
      // 種の名前そのもの/データの登録名(括弧書きあり・なし)のどれで解答しても、その種が開く。
      [root, p.speciesKey, p.name, stripParens(p.name)].forEach(function(n){
        var key = dexFillNormalize(n);
        if(key && !byKey[key]) byKey[key] = group;
      });
    });
    Object.keys(DEXFILL_ALIASES).forEach(function(alias){
      var g = byRoot[DEXFILL_ALIASES[alias]];
      if(g && !byKey[alias]) byKey[alias] = g;
    });
    dexFillIndexCache = { groups: groups, byKey: byKey };
    return dexFillIndexCache;
  }

  // ゲームの状態(ミニゲームを切り替えても保持する)。
  var dexFillGens = newGenSelection();       // 世代 → 範囲に含めるか
  var dexFillOpened = Object.create(null);   // 種の名前 → 解答済みか
  var dexFillGaveUp = false;
  var dexFillLastRoots = [];                 // 直前の解答で開いた種(枠を強調表示する)
  var dexFillMessage = null;                 // { text, kind:'ok'|'bad'|'info' }

  // ---- 進行状況の保存(端末のlocalStorage) ----
  // 解答済みの種の名前・選択中の世代・ギブアップ済みかどうかを保存し、再読み込み後も続きから遊べる
  // ようにする。種は名前で持つので、あとからポケモンが追加されても記録はずれない。保存できない環境
  // (プライベートブラウズ等)では何もせず、保存なしでそのまま遊べる。
  var DEXFILL_SAVE_KEY = 'dameke_dexfill_progress_v1';
  function saveDexFillProgress(){
    try {
      localStorage.setItem(DEXFILL_SAVE_KEY, JSON.stringify({
        v: 1,
        opened: Object.keys(dexFillOpened),
        gens: GENERATIONS.filter(function(g){ return !!dexFillGens[g]; }),
        gaveUp: dexFillGaveUp
      }));
    } catch(e){}
  }
  var dexFillProgressLoaded = false;
  function loadDexFillProgress(index){
    if(dexFillProgressLoaded) return;
    dexFillProgressLoaded = true;
    try {
      var saved = JSON.parse(localStorage.getItem(DEXFILL_SAVE_KEY) || 'null');
      if(!saved || typeof saved !== 'object') return;
      // 現在のデータに存在する種だけを復元する(名前が変わった・消えたものは捨てる)。
      var known = Object.create(null);
      index.groups.forEach(function(g){ known[g.root] = true; });
      if(Array.isArray(saved.opened)){
        saved.opened.forEach(function(root){ if(known[root]) dexFillOpened[root] = true; });
      }
      if(Array.isArray(saved.gens)){
        GENERATIONS.forEach(function(g){ dexFillGens[g] = saved.gens.indexOf(g) >= 0; });
      }
      dexFillGaveUp = saved.gaveUp === true;
    } catch(e){}
  }

  function renderDexFillGame(host){
    var index = getDexFillIndex();
    loadDexFillProgress(index);

    var wrap = document.createElement('div');
    wrap.className = 'dameke-dexfill-wrap';

    var title = document.createElement('h3');
    title.className = 'dameke-minigame-title';
    title.textContent = 'ポケモン図鑑埋め';
    wrap.appendChild(title);

    var rulesFold = document.createElement('details');
    rulesFold.className = 'dameke-pokemon-edit-levelfold dameke-minigame-rules-fold';
    var rulesSummary = document.createElement('summary');
    rulesSummary.textContent = 'ルール';
    rulesFold.appendChild(rulesSummary);
    var rulesBody = document.createElement('div');
    rulesBody.className = 'dameke-minigame-rules-body';
    rulesBody.innerHTML =
      '<p>ポケモンの名前を入力して、図鑑番号順に並んだ枠を埋めていきます。順番は問いません。</p>' +
      '<p>ひらがな・カタカナ、半角・全角のどれで入力しても構いません。</p>' +
      '<p>フォルム違い・メガシンカ・ゲンシカイキ・リージョンフォームなどは、1回の解答でまとめて開きます。' +
      'ポケモン名だけ(例：ロコン)でも、フォルム名を含む名前(例：メガフシギバナ、ロコン(アローラ))でも解答できます。' +
      '解答数は種類の数で数えます。</p>' +
      '<p>「範囲」で、出題する世代を選べます。</p>' +
      '<p>「ギブアップ」を押すと、残りの枠をすべて表示します。</p>';
    rulesFold.appendChild(rulesBody);
    wrap.appendChild(rulesFold);

    // ---- 範囲(世代) ----
    var rangeFold = buildMinigameFold('範囲');
    rangeFold.body.appendChild(buildGenRangeRow(dexFillGens, function(){ onRangeChanged(); }));
    wrap.appendChild(rangeFold.fold);

    // ---- 解答の入力 ----
    var inputRow = document.createElement('div');
    inputRow.className = 'dameke-dexfill-input-row';
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'dameke-dexfill-text-input';
    input.placeholder = 'ポケモン名';
    input.autocomplete = 'off';
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('autocorrect', 'off');
    input.spellcheck = false;
    inputRow.appendChild(input);
    var submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = 'dameke-search-add-btn dameke-dexfill-submit-btn';
    submitBtn.textContent = '決定';
    inputRow.appendChild(submitBtn);
    var messageEl = document.createElement('span');
    messageEl.className = 'dameke-dexfill-message';
    inputRow.appendChild(messageEl);
    wrap.appendChild(inputRow);

    // ---- 進み具合とギブアップ/リトライ ----
    var statusRow = document.createElement('div');
    statusRow.className = 'dameke-dexfill-status-row';
    var progressEl = document.createElement('span');
    progressEl.className = 'dameke-dexfill-progress';
    statusRow.appendChild(progressEl);
    var completeEl = document.createElement('span');
    completeEl.className = 'dameke-dexfill-complete';
    completeEl.textContent = 'コンプリート！';
    statusRow.appendChild(completeEl);
    var giveUpBtn = document.createElement('button');
    giveUpBtn.type = 'button';
    giveUpBtn.className = 'dameke-search-add-btn dameke-minigame-giveup-btn';
    giveUpBtn.textContent = 'ギブアップ';
    statusRow.appendChild(giveUpBtn);
    // リセット: ゲーム中に、解答済みの枠をすべて消して最初からやり直す(範囲はそのまま)。
    var resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'dameke-search-add-btn dameke-dexfill-reset-btn';
    resetBtn.textContent = 'リセット';
    statusRow.appendChild(resetBtn);
    var retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'dameke-search-add-btn dameke-minigame-retry-btn';
    retryBtn.textContent = 'リトライ';
    statusRow.appendChild(retryBtn);
    wrap.appendChild(statusRow);

    var boardHost = document.createElement('div');
    boardHost.className = 'dameke-dexfill-board';
    wrap.appendChild(boardHost);

    host.appendChild(wrap);

    // 描画中の枠と世代見出しへの参照(解答のたびに全体を作り直さず、該当する枠だけ書き換える)。
    var cellsByRoot = Object.create(null);   // 種の名前 → [{ cell, pokemon }]
    var genCountEls = Object.create(null);   // 世代 → 件数表示の要素

    function groupsInRange(){
      return index.groups.filter(function(g){ return !!dexFillGens[g.generation]; });
    }

    // 枠の中身を入れる。画像を出し、取得できなければ名前を出す。
    function fillCell(cell, pokemon, missed){
      cell.innerHTML = '';
      cell.classList.remove('dameke-dexfill-cell-name');
      cell.classList.add(missed ? 'dameke-dexfill-cell-missed' : 'dameke-dexfill-cell-open');
      cell.title = pokemon.name;
      function showName(){
        cell.innerHTML = '';
        cell.classList.add('dameke-dexfill-cell-name');
        cell.textContent = pokemon.name;
      }
      var img = window.__damekeBuildPokemonImage ? window.__damekeBuildPokemonImage(pokemon.name, showName) : null;
      if(img) cell.appendChild(img); else showName();
    }

    function renderBoard(){
      boardHost.innerHTML = '';
      cellsByRoot = Object.create(null);
      genCountEls = Object.create(null);
      var selected = GENERATIONS.filter(function(g){ return !!dexFillGens[g]; });
      if(!selected.length){
        var empty = document.createElement('div');
        empty.className = 'dameke-dexfill-empty';
        empty.textContent = '「範囲」で世代を1つ以上選んでください。';
        boardHost.appendChild(empty);
        return;
      }
      var gridByGen = Object.create(null);
      selected.forEach(function(g){
        var section = document.createElement('div');
        section.className = 'dameke-dexfill-gen';
        var head = document.createElement('div');
        head.className = 'dameke-dexfill-gen-title';
        head.appendChild(document.createTextNode('第' + g + '世代'));
        var count = document.createElement('span');
        count.className = 'dameke-dexfill-gen-count';
        head.appendChild(count);
        genCountEls[g] = count;
        section.appendChild(head);
        var grid = document.createElement('div');
        grid.className = 'dameke-dexfill-grid';
        section.appendChild(grid);
        gridByGen[g] = grid;
        boardHost.appendChild(section);
      });
      index.groups.forEach(function(group){
        var grid = gridByGen[group.generation];
        if(!grid) return;
        var opened = !!dexFillOpened[group.root];
        var list = cellsByRoot[group.root] = [];
        group.members.forEach(function(p){
          var cell = document.createElement('div');
          cell.className = 'dameke-dexfill-cell';
          if(opened) fillCell(cell, p, false);
          else if(dexFillGaveUp) fillCell(cell, p, true);
          if(opened && dexFillLastRoots.indexOf(group.root) >= 0) cell.classList.add('dameke-dexfill-cell-new');
          grid.appendChild(cell);
          list.push({ cell: cell, pokemon: p });
        });
      });
    }

    function renderStatus(){
      var inRange = groupsInRange();
      var done = 0;
      var perGen = Object.create(null);
      inRange.forEach(function(g){
        var s = perGen[g.generation] || (perGen[g.generation] = { total: 0, done: 0 });
        s.total++;
        if(dexFillOpened[g.root]){ s.done++; done++; }
      });
      Object.keys(genCountEls).forEach(function(g){
        var s = perGen[g] || { total: 0, done: 0 };
        genCountEls[g].textContent = s.done + ' / ' + s.total;
      });
      progressEl.textContent = '解答済み ' + done + ' / ' + inRange.length + '種';
      var complete = inRange.length > 0 && done === inRange.length;
      completeEl.hidden = !complete || dexFillGaveUp;
      giveUpBtn.hidden = dexFillGaveUp || complete || !inRange.length;
      resetBtn.hidden = giveUpBtn.hidden;
      retryBtn.hidden = !(dexFillGaveUp || complete);
      var canAnswer = !dexFillGaveUp && inRange.length > 0;
      input.disabled = !canAnswer;
      submitBtn.disabled = !canAnswer;
      messageEl.className = 'dameke-dexfill-message' + (dexFillMessage ? ' dameke-dexfill-message-' + dexFillMessage.kind : '');
      messageEl.textContent = dexFillMessage ? dexFillMessage.text : '';
    }

    function clearNewMarks(){
      dexFillLastRoots.forEach(function(root){
        (cellsByRoot[root] || []).forEach(function(c){ c.cell.classList.remove('dameke-dexfill-cell-new'); });
      });
      dexFillLastRoots = [];
    }

    function onRangeChanged(){
      dexFillMessage = null;
      saveDexFillProgress();
      renderBoard();
      renderStatus();
    }

    // 枠の一覧(boardHost)だけを動かして、開いた枠が見える位置までスクロールする。ページ全体は
    // 動かさない(入力欄が画面外へ行かないようにするため)。すでに全部見えていれば何もしない。
    function scrollBoardToCells(list){
      if(!list || !list.length) return;
      var board = boardHost.getBoundingClientRect();
      var first = list[0].cell.getBoundingClientRect();
      var last = list[list.length - 1].cell.getBoundingClientRect();
      if(first.top >= board.top && last.bottom <= board.bottom) return;
      var middle = (first.top + last.bottom) / 2 - board.top + boardHost.scrollTop;
      var top = Math.max(0, Math.round(middle - boardHost.clientHeight / 2));
      if(boardHost.scrollTo) boardHost.scrollTo({ top: top, behavior: 'smooth' });
      else boardHost.scrollTop = top;
    }

    function submitAnswer(){
      if(dexFillGaveUp) return;
      var raw = input.value;
      var key = dexFillNormalize(raw);
      if(!key) return;
      var group = index.byKey[key];
      if(!group){
        dexFillMessage = { text: '「' + raw.trim() + '」に当てはまるポケモンがいません', kind: 'bad' };
        renderStatus();
        input.select();
        return;
      }
      if(!dexFillGens[group.generation]){
        dexFillMessage = { text: '「' + group.root + '」は範囲外です', kind: 'info' };
        renderStatus();
        input.select();
        return;
      }
      if(dexFillOpened[group.root]){
        dexFillMessage = { text: '「' + group.root + '」は解答済みです', kind: 'info' };
        renderStatus();
        input.select();
        return;
      }
      clearNewMarks();
      dexFillOpened[group.root] = true;
      dexFillLastRoots = [group.root];
      (cellsByRoot[group.root] || []).forEach(function(c){
        fillCell(c.cell, c.pokemon, false);
        c.cell.classList.add('dameke-dexfill-cell-new');
      });
      dexFillMessage = {
        text: '正解！ ' + group.root + (group.members.length > 1 ? '(' + group.members.length + '体)' : ''),
        kind: 'ok'
      };
      input.value = '';
      saveDexFillProgress();
      renderStatus();
      input.focus();
      scrollBoardToCells(cellsByRoot[group.root]);
    }

    submitBtn.addEventListener('click', submitAnswer);
    input.addEventListener('keydown', function(e){
      // 日本語入力の変換確定のEnterでは決定しない(確定後のEnterで決定する)。
      if(e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      submitAnswer();
    });

    giveUpBtn.addEventListener('click', function(){
      if(dexFillGaveUp) return;
      if(!window.confirm('ギブアップして、残りの枠をすべて表示しますか？')) return;
      dexFillGaveUp = true;
      dexFillMessage = null;
      saveDexFillProgress();
      renderBoard();
      renderStatus();
      boardHost.scrollTop = 0;
    });

    // 解答済みの記録をすべて消して最初からやり直す(リトライ・リセット共通。範囲はそのまま)。
    function restartDexFill(){
      dexFillOpened = Object.create(null);
      dexFillGaveUp = false;
      dexFillLastRoots = [];
      dexFillMessage = null;
      input.value = '';
      saveDexFillProgress();
      renderBoard();
      renderStatus();
    }
    retryBtn.addEventListener('click', restartDexFill);
    resetBtn.addEventListener('click', function(){
      // 1つも解答していなければ確認なしでよい(消えるものがないため)。
      if(Object.keys(dexFillOpened).length && !window.confirm('解答済みの枠をすべて消して、最初からやり直しますか？')) return;
      restartDexFill();
    });

    renderBoard();
    renderStatus();
  }
})();
