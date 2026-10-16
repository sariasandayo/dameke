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
    { id: 'typecard', label: '相性カードバトル', render: renderTypeCardGame },
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


  // ==================== 相性カードバトル ====================
  // 最終進化のポケモンをカードにして、CPUと1枚ずつ交互に出し合うゲーム。
  // ・出したカードは、場のカードへの「タイプ相性の倍率」を点数として得る。点数は出したカードの2タイプ
  //   それぞれの倍率の合計(単タイプは同じタイプで2回分)。倍率には場のカードの特性も反映する
  //   (計算はダメージ計算・補完ポケモン出力と同じ DAMEKE_CALC.computeTypeEffectiveness)。
  //   攻撃側の特性が かたやぶり/テラボルテージ/ターボブレイズ/かがくへんかガス のときは、場のカードの
  //   特性を見ない。
  // ・カードは姿違い(formGroup)を1枚にまとめたもの。タイプか相性に関わる特性が違う姿があれば、出すときに
  //   姿を選べる。特性は姿ごとにランダムに1つ付く。
  // ・18枚を公開し、場札1枚・手札6枚ずつ・山札5枚。始める前に後攻→先攻の順で1回ずつマリガン(手札1枚を山札に
  //   戻して1枚引く。戻した札・引いた札とも公開)。強化(Zワザ/ダイマックス/テラスタル)は1試合1回どれか。
  // ・CPUは3段階。つよいは、相手の手札としてありうる組み合わせを複数仮定し、それぞれを最後まで先読みして
  //   平均の点差が最もよい手を選ぶ。
  var TCB_HAND = 6, TCB_DECK = 5, TCB_POOL = 1 + TCB_HAND * 2 + TCB_DECK; // 18枚
  var TCB_MASKMUL = Math.pow(2, TCB_POOL);
  var TCB_Z_MULT = 2, TCB_D_MULT = 1.5, TCB_D_TAKEN = 0.5, TCB_T_MULT = 1.25;
  var TCB_BYPASS = { 'かたやぶり': true, 'テラボルテージ': true, 'ターボブレイズ': true, 'かがくへんかガス': true };
  var TCB_LEVELS = [['weak', 'よわい'], ['normal', 'ふつう'], ['strong', 'つよい']];
  var TCB_TYPES = ['ノーマル','ほのお','みず','でんき','くさ','こおり','かくとう','どく','じめん','ひこう','エスパー','むし','いわ','ゴースト','ドラゴン','あく','はがね','フェアリー'];
  // 相性表の見出し用の1文字(重ならない)。
  var TCB_TYPE_SHORT = { 'ノーマル':'ノ','ほのお':'炎','みず':'水','でんき':'電','くさ':'草','こおり':'氷','かくとう':'闘','どく':'毒','じめん':'地','ひこう':'飛','エスパー':'超','むし':'虫','いわ':'岩','ゴースト':'霊','ドラゴン':'竜','あく':'悪','はがね':'鋼','フェアリー':'妖' };

  function tcbRand(n){ return Math.floor(Math.random() * n); }
  function tcbShuffle(a){ for(var i = a.length - 1; i > 0; i--){ var j = tcbRand(i + 1); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  // 点数の表示(小数は最大3桁、末尾の0は付けない)。
  function tcbPts(x){ var v = Math.round(x * 1000) / 1000; return String(v); }

  // ---- 相性の計算 ----
  function tcbTypeEff(defTypes, atkType, defAbility){
    var C = window.DAMEKE_CALC;
    if(C && C.computeTypeEffectiveness) return C.computeTypeEffectiveness(defTypes, atkType, defAbility || null);
    var chart = DATA.typeChart4096 || {}, r = 4096;
    defTypes.forEach(function(t){ var x = (chart[atkType] || {})[t]; r = Math.floor(r * (x == null ? 4096 : x) / 4096); });
    return r / 4096;
  }
  // 受けるときの相性に関わる特性か(ダメージ計算側の判定をそのまま使う)。
  function tcbDefRelevant(ab){ var C = window.DAMEKE_CALC; return !!(ab && C && C.isTypeRelevantAbility && C.isTypeRelevantAbility(ab)); }
  // このゲーム独自に扱う特性(倍率を点数に掛ける)。
  var TCB_DEF_FILTER = { 'ハードロック': true, 'フィルター': true, 'プリズムアーマー': true }; // ばつぐんの点×0.75
  var TCB_DEF_EXTRA = { 'ふしぎなまもり': true, 'テラスシェル': true, 'ハードロック': true, 'フィルター': true, 'プリズムアーマー': true };
  var TCB_ATK_EXTRA = { 'いろめがね': true, 'きもったま': true, 'しんがん': true, 'ブレインフォース': true };
  var TCB_SCRAPPY = { 'きもったま': true, 'しんがん': true };
  // かたやぶり・テラボルテージ・ターボブレイズでは無視できない特性('gas' = かがくへんかガスなら無視できる。
  // 'all' = かがくへんかガスでも無視できない、は今は使っていない)。
  var TCB_UNBREAKABLE = { 'プリズムアーマー': 'gas', 'おわりのだいち': 'gas', 'はじまりのうみ': 'gas', 'デルタストリーム': 'gas' };
  var TCB_GAS = 'かがくへんかガス';
  var TCB_ANTICIPATION = 'きけんよち';
  var TCB_LIBERO = { 'リベロ': true, 'へんげんじざい': true };
  function tcbRelevant(ab){ return !!ab && (!!TCB_LIBERO[ab] || ab === 'ARシステム' || ab === 'マルチタイプ' || tcbDefRelevant(ab) || !!TCB_BYPASS[ab] || !!TCB_DEF_EXTRA[ab] || !!TCB_ATK_EXTRA[ab] || ab === TCB_ANTICIPATION); }
  // 攻撃側の姿 att が、場の姿 def に出したときのタイプごとの倍率。
  // eff = タイプ相性(場の特性による無効・半減を含む)、mult = 特性の補正を掛けた点数、notes = 内訳に出す特性の説明。
  function tcbParts(att, def){
    var atkAb = def.ab === TCB_GAS ? null : att.ab;          // 場がかがくへんかガスなら、出す側の特性は働かない
    var bypass = !!(atkAb && TCB_BYPASS[atkAb]);
    var unb = def.ab ? TCB_UNBREAKABLE[def.ab] : null;
    var defAb = def.ab && (!bypass || unb === 'all' || (unb === 'gas' && atkAb !== TCB_GAS)) ? def.ab : null;
    // 場のカードがかがくへんかガスなら、リベロ・へんげんじざいでタイプは変わらない(元のタイプで出す)
    var aTypes = att.libero && def.ab === TCB_GAS ? att.fromTypes : att.types;
    var ts = aTypes.length === 1 ? [aTypes[0], aTypes[0]] : aTypes.slice(0, 2);
    return ts.map(function(t){
      var notes = [];
      var dTypes = def.types;
      if(atkAb && TCB_SCRAPPY[atkAb] && (t === 'ノーマル' || t === 'かくとう') && def.types.indexOf('ゴースト') >= 0){
        dTypes = def.types.filter(function(x){ return x !== 'ゴースト'; });
        notes.push(atkAb + 'でゴーストに当たる');
      }
      var plain = tcbTypeEff(dTypes, t, null);
      var e = tcbTypeEff(dTypes, t, defAb && tcbDefRelevant(defAb) ? defAb : null);
      if(e !== plain) notes.push(defAb);
      if(bypass && def.ab && !defAb && (TCB_DEF_EXTRA[def.ab] || (tcbDefRelevant(def.ab) && tcbTypeEff(dTypes, t, def.ab) !== plain))) notes.push(atkAb + 'で' + def.ab + 'を無視');
      var e0 = e;
      if(defAb === 'テラスシェル' && e > 0){ e = 0.5; notes.push('テラスシェルで今ひとつ'); }
      var m = e;
      if(defAb === 'ふしぎなまもり' && e < 2 && e > 0){ m = 0; notes.push('ふしぎなまもり'); }
      if(m > 0 && e >= 2 && defAb && TCB_DEF_FILTER[defAb]){ m *= 0.75; notes.push(defAb + '×0.75'); }
      if(m > 0 && e > 0 && e < 1 && atkAb === 'いろめがね'){ m *= 2; notes.push('いろめがね×2'); }
      if(m > 0 && e >= 2 && atkAb === 'ブレインフォース'){ m *= 1.25; notes.push('ブレインフォース×1.25'); }
      return { type: t, eff0: e0, eff: e, mult: m, notes: notes };
    });
  }
  function tcbBase(att, def){ return tcbParts(att, def).reduce(function(s, p){ return s + p.mult; }, 0); }
  function tcbBoostMult(b){ return b === 'Z' ? TCB_Z_MULT : (b === 'D' ? TCB_D_MULT : (b === 'T' ? TCB_T_MULT : 1)); }
  var TCB_BOOST_NAME = { Z: 'Zワザ', D: 'ダイマックス', T: 'テラスタル' };

  var TCB_TYPE_CHOICE = { 'アルセウス': true, 'シルヴァディ': true };
  // ---- カードの元(姿違いをまとめたグループ)。最終進化のみ。1回だけ作る ----
  var tcbGroupsCache = null;
  function tcbGroups(){
    if(tcbGroupsCache) return tcbGroupsCache;
    var map = Object.create(null), order = [];
    (DATA.pokemons || []).forEach(function(p){
      if(p.canEvolve || !Array.isArray(p.types) || !p.types.length) return;
      var key = p.formGroup || ('#' + p.id);
      if(!map[key]){ map[key] = []; order.push(key); }
      map[key].push(p);
    });
    tcbGroupsCache = order.map(function(k){ return map[k]; });
    return tcbGroupsCache;
  }
  // グループからカードを作る。姿ごとに特性を1つ選び、タイプと「相性に関わる特性」が同じ姿は1つにまとめる。
  // テラスタイプが決まっているポケモン(オーガポン: お面ごと)。テラスタルした姿はデータの「(〇〇(テラスタル))」を使う。
  var TCB_OGERPON_TERA = { 'みどり': 'くさ', 'いど': 'みず', 'かまど': 'ほのお', 'いしずえ': 'いわ' };
  var TCB_NO_TERA = /^テラパゴス/;              // テラスタイプはステラのみ(このゲームではステラなし)なのでテラスタル不可
  var TCB_NO_DYN = /^(ザシアン|ザマゼンタ|ムゲンダイナ)/; // ダイマックスできない
  // そのポケモンの覚える技のタイプ(覚える技データがなければ空)。
  var tcbMoveTypeOf = null;
  function tcbLearnTypes(name){
    var LS = window.DAMEKE_LEARNSETS, CM = window.DAMEKE_COMMON;
    if(!LS || !CM) return [];
    var key = CM.learnsetKeyFor(name);
    if(!LS.hasLearnset(key)) return [];
    if(!tcbMoveTypeOf){ tcbMoveTypeOf = Object.create(null); (DATA.moves || []).forEach(function(m){ tcbMoveTypeOf[m.name] = m.type; }); }
    var seen = Object.create(null);
    (LS.getLearnset(key) || []).forEach(function(n){ var t = tcbMoveTypeOf[typeof n === 'string' ? n : (n && n.name)]; if(t && TCB_TYPES.indexOf(t) >= 0) seen[t] = true; });
    return TCB_TYPES.filter(function(t){ return seen[t]; });
  }
  function tcbMakeCard(members){
    var faces = [], seen = Object.create(null), bases = [];
    var noTera = members.some(function(m){ return TCB_NO_TERA.test(m.name); });
    var noDyn = members.some(function(m){ return TCB_NO_DYN.test(m.name); });
    members.forEach(function(m){
      // テラスタル済みの姿(オーガポンのお面のテラスタル)と、テラパゴスのステラは、ふつうの姿には入れない
      if(/\(テラスタル\)\)$/.test(m.name) || m.name === 'テラパゴス(ステラ)') return;
      var abs = (m.abilities || []).filter(function(a){ return a && a !== 'なし'; });
      var ab = abs.length ? abs[tcbRand(abs.length)] : null;
      // アルセウス・シルヴァディは、出すときにタイプを選べる(18タイプの姿にする)。
      if(TCB_TYPE_CHOICE[m.name]){
        TCB_TYPES.forEach(function(t){ faces.push({ name: m.name + '(' + t + ')', img: m.name, types: [t], ab: ab, typeChoice: true }); });
        return;
      }
      // リベロ・へんげんじざい: 覚える技のタイプごとの単タイプの姿にする(技データがなければふつうの姿のまま)
      var lt = TCB_LIBERO[ab] ? tcbLearnTypes(m.name) : [];
      // 元のタイプと同じタイプを先に並べる(手札で最初に出る姿)
      lt.sort(function(a, b){ return (m.types.indexOf(a) < 0) - (m.types.indexOf(b) < 0); });
      if(lt.length){
        var base = { name: m.name, types: m.types.slice(0, 2), ab: ab, base: true };
        bases.push(base);
        lt.forEach(function(t){
          var lk = 'L|' + t + '|' + ab;
          if(seen[lk]) return;
          seen[lk] = true;
          faces.push({ name: m.name + '(' + ab + '→' + t + ')', img: m.name, types: [t], ab: ab, libero: true, fromTypes: m.types.slice(0, 2), baseRef: base, teraShare: m.name });
        });
        return;
      }
      var key = m.types.slice(0, 2).slice().sort().join('/') + '|' + (tcbRelevant(ab) ? ab : '');
      if(seen[key]) return;
      seen[key] = true;
      var face = { name: m.name, types: m.types.slice(0, 2), ab: ab };
      var og = /^オーガポン\((.+)\)$/.exec(m.name);
      if(og && TCB_OGERPON_TERA[og[1]]){
        face.teraType = TCB_OGERPON_TERA[og[1]];
        face.teraName = 'オーガポン(' + og[1] + '(テラスタル))';
        face.teraAb = 'おもかげやどし';
      }
      faces.push(face);
    });
    // テラスタイプ: 18タイプからランダムに1つ(ステラは使わない)。カードに表示して両者に公開。
    return { faces: faces, bases: bases, liberoChoice: faces.some(function(f){ return f.libero; }), typeChoice: faces.length > 0 && !!faces[0].typeChoice, tera: noTera ? null : TCB_TYPES[tcbRand(TCB_TYPES.length)], noTera: noTera, noDyn: noDyn };
  }

  // カードのふだんの姿(リベロ等は元の姿)。
  function tcbDefaultFaceOf(card, ids){ return card.baseFaceId != null ? card.baseFaceId : ids[0]; }
  // ---- ゲームの状態 ----
  var tcbLevel = 'normal';
  var tcbState = null;
  var tcbTimer = null;

  function tcbNewGame(force){
    if(tcbTimer){ clearTimeout(tcbTimer); tcbTimer = null; }
    var groups = tcbGroups();
    var picked = Object.create(null), cards = [];
    // テスト用: 名前を指定したグループを必ず入れる
    (force || []).forEach(function(name){
      groups.forEach(function(g, gi){ if(!picked[gi] && cards.length < TCB_POOL && g.some(function(m){ return m.name === name; })){ picked[gi] = true; cards.push(tcbMakeCard(g)); } });
    });
    while(cards.length < TCB_POOL){
      var gi = tcbRand(groups.length);
      if(picked[gi]) continue;
      picked[gi] = true;
      cards.push(tcbMakeCard(groups[gi]));
    }
    // 姿を通し番号にする(CPUの先読み用)。faceIds[カード] = その姿の番号の配列。
    var faces = [], faceIds = [];
    cards.forEach(function(c, ci){ faceIds.push(c.faces.map(function(f){ f.card = ci; faces.push(f); return faces.length - 1; })); });
    // リベロ・へんげんじざいのカードの元の姿(出す前・最初の場札・かがくへんかガスの場に出したとき)。手札からは選べない。
    cards.forEach(function(c, ci){
      c.bases.forEach(function(b){ b.card = ci; faces.push(b); b.id = faces.length - 1; });
      c.baseFaceId = c.bases.length ? c.bases[0].id : null;
    });
    // テラスタルした姿(テラスタイプの単タイプ。特性はその姿のまま)。teraOf[姿の番号] = テラスタルした姿の番号。
    // タイプを選ぶカード(アルセウス等)は、どのタイプからでもテラスタルの姿は同じなので1つにまとめる。
    var teraOf = [];
    cards.forEach(function(c, ci){
      var shared = null, sharedBy = Object.create(null);
      faceIds[ci].forEach(function(fid){
        if(c.noTera) return;
        if(c.typeChoice && shared != null){ teraOf[fid] = shared; return; }
        // リベロの姿は、どのタイプからでもテラスタルした姿は同じ
        var share = faces[fid].teraShare;
        if(share && sharedBy[share] != null){ teraOf[fid] = sharedBy[share]; return; }
        var f = faces[fid], base = f.img || f.name, tt = f.teraType || c.tera;
        if(f.teraName) faces.push({ name: f.teraName, img: f.teraName, types: [tt], ab: f.teraAb, tera: true, card: ci, from: fid });
        else faces.push({ name: base + '(テラスタル' + tt + ')', img: base, types: [tt], ab: f.ab, tera: true, card: ci, from: fid, fromTypes: f.fromTypes });
        teraOf[fid] = faces.length - 1;
        if(c.typeChoice) shared = teraOf[fid];
        if(share) sharedBy[share] = teraOf[fid];
      });
    });
    var S = faces.map(function(a){ return faces.map(function(d){ return tcbBase(a, d); }); });
    var order = tcbShuffle(cards.map(function(_, i){ return i; }));
    var first = Math.random() < 0.5 ? 'me' : 'cpu';
    tcbState = {
      cards: cards, faces: faces, faceIds: faceIds, teraOf: teraOf, S: S,
      hands: { me: order.slice(1, 1 + TCB_HAND), cpu: order.slice(1 + TCB_HAND, 1 + TCB_HAND * 2) },
      deck: order.slice(1 + TCB_HAND * 2),
      field: { card: order[0], face: tcbDefaultFaceOf(cards[order[0]], faceIds[order[0]]), by: 'start', dyn: false },
      used: Object.create(null),       // カード -> 'me' | 'cpu'
      knownDeck: Object.create(null),  // 交換で山札に戻った(どこにあるか分かっている)カード
      scores: { me: 0, cpu: 0 },
      boost: { me: null, cpu: null },  // 使った強化('Z' | 'D' | 'T')
      first: first, turn: first, plies: 0,
      // マリガン: 後攻→先攻の順。phase は 'mull'(マリガン中) → 'play'。pubHand = マリガンで引いた(公開の)札
      phase: 'mull', mullWho: first === 'me' ? 'cpu' : 'me', mullLog: [], pubHand: { me: [], cpu: [] },
      log: [], finished: false, thinking: false,
      sel: null, selBoost: null, handFace: Object.create(null), message: null, busy: false
    };
  }

  // そのカードで使える強化か(テラスタル不可・ダイマックス不可のポケモンがいる)。
  function tcbBoostAllowed(st, ci, b){
    var c = st.cards[ci];
    return !b || !((b === 'T' && c.noTera) || (b === 'D' && c.noDyn));
  }
  // 場のカードへ、姿 faceId を強化 boost で出したときの点数と内訳。
  function tcbScore(st, faceId, boost){
    if(boost === 'T' && !st.faces[faceId].tera) faceId = st.teraOf[faceId];
    var att = st.faces[faceId], def = st.faces[st.field.face];
    var parts = tcbParts(att, def);
    var base = parts.reduce(function(s, p){ return s + p.mult; }, 0);
    var pts = base * tcbBoostMult(boost) * (st.field.dyn ? TCB_D_TAKEN : 1);
    return { parts: parts, base: base, pts: pts };
  }

  function tcbPlay(who, cardIdx, faceIdx, boost){
    var st = tcbState;
    if(!st || st.finished || st.turn !== who || st.phase !== 'play') return null;
    var hand = st.hands[who], pos = hand.indexOf(cardIdx);
    if(pos < 0) return null;
    if(boost && (st.boost[who] || !tcbBoostAllowed(st, cardIdx, boost))) boost = null;
    var faceId = st.faceIds[cardIdx][faceIdx] != null ? st.faceIds[cardIdx][faceIdx] : st.faceIds[cardIdx][0];
    if(boost === 'T') faceId = st.teraOf[faceId];
    // かがくへんかガスの場には、リベロ・へんげんじざいでもタイプを変えずに出る
    else if(st.faces[faceId].libero && st.faces[st.field.face].ab === TCB_GAS) faceId = st.faces[faceId].baseRef.id;
    var sc = tcbScore(st, faceId, boost);
    var entry = { who: who, face: faceId, target: st.field.face, targetDyn: st.field.dyn, boost: boost, parts: sc.parts, base: sc.base, pts: sc.pts, shudder: false };
    // きけんよち: 出したあと、相手の手札に(どの姿でも)ばつぐんになるカードがあれば みぶるいする。
    if(st.faces[faceId].ab === TCB_ANTICIPATION){
      var opp = st.hands[who === 'me' ? 'cpu' : 'me'];
      entry.shudder = opp.some(function(ci){ return st.faceIds[ci].some(function(f){ return tcbParts(st.faces[f], st.faces[faceId]).some(function(p){ return p.eff >= 2; }); }); });
    }
    st.log.push(entry);
    st.scores[who] += sc.pts;
    if(boost) st.boost[who] = boost;
    hand.splice(pos, 1);
    st.used[cardIdx] = who;
    if(st.field.by === 'start') st.used[st.field.card] = 'start'; // 最初の場札は出し終わり扱い
    st.field = { card: cardIdx, face: faceId, by: who, dyn: boost === 'D' };
    st.plies++;
    if(who === 'me'){ st.sel = null; st.selBoost = null; }
    if(!st.hands.me.length && !st.hands.cpu.length) st.finished = true;
    else st.turn = who === 'me' ? 'cpu' : 'me';
    return entry;
  }

  // マリガン: 山札からランダムに1枚引き、選んだ手札1枚を山札に戻す(戻した札・引いた札とも公開)。
  // ci が null ならマリガンしない。後攻→先攻の順で1回ずつ。先に戻された札を後の人が引くこともある。
  function tcbMulligan(who, ci){
    var st = tcbState;
    if(!st || st.phase !== 'mull' || st.mullWho !== who) return null;
    var res = { who: who, out: null, drew: null };
    var hand = st.hands[who], pos = ci == null ? -1 : hand.indexOf(ci);
    if(pos >= 0 && st.deck.length){
      var d = st.deck[tcbRand(st.deck.length)];
      hand[pos] = d;
      st.deck[st.deck.indexOf(d)] = ci;
      delete st.knownDeck[d];
      st.knownDeck[ci] = true;
      st.pubHand[who].push(d);
      if(st.handFace){ delete st.handFace[ci]; }
      res.out = ci; res.drew = d;
    }
    st.mullLog.push(res);
    if(who === 'me'){ st.sel = null; }
    if(who !== st.first) st.mullWho = st.first;
    else { st.phase = 'play'; st.mullWho = null; }
    return res;
  }

  // ---- CPU ----
  // 手札が両者に見えている前提で最後まで読む(負けの少ない手=点差が最もよい手)。
  // 値は「手番の側の、これから先の得点 - 相手のこれから先の得点」。
  function tcbSolver(st){
    var S = st.S, faceIds = st.faceIds, teraOf = st.teraOf, memo = new Map(), pruned = new Map();
    var noDyn = st.cards.map(function(c){ return !!c.noDyn; });
    // 姿が多いカード(アルセウス等)は、読みの中ではその場の点が高い姿4つだけを考える(速さのため)。
    function facesFor(ci, top){
      var fl = faceIds[ci];
      if(fl.length <= 4) return fl;
      var key = ci * 256 + top, c = pruned.get(key);
      if(c) return c;
      c = fl.slice().sort(function(a, b){ return S[b][top] - S[a][top] || a - b; }).slice(0, 4);
      pruned.set(key, c);
      return c;
    }
    function val(hM, hO, top, td, bM, bO){
      if(!hM) return hO ? -val(hO, hM, top, td, bO, bM) : 0;
      var key = ((((hM * TCB_MASKMUL + hO) * 256 + top) * 2 + td) * 2 + bM) * 2 + bO;
      var c = memo.get(key);
      if(c !== undefined) return c;
      var best = -1e9, k = td ? TCB_D_TAKEN : 1;
      for(var ci = 0; ci < TCB_POOL; ci++){
        if(!(hM & (1 << ci))) continue;
        var rest = hM & ~(1 << ci), fl = facesFor(ci, top);
        for(var fi = 0; fi < fl.length; fi++){
          var f = fl[fi], g = S[f][top] * k;
          var v = g - val(hO, rest, f, 0, bO, bM);
          if(v > best) best = v;
          if(bM){
            v = g * TCB_Z_MULT - val(hO, rest, f, 0, bO, 0); if(v > best) best = v;
            if(!noDyn[ci]){ v = g * TCB_D_MULT - val(hO, rest, f, 1, bO, 0); if(v > best) best = v; }
            var tf = teraOf[f];
            if(tf != null){ v = S[tf][top] * k * TCB_T_MULT - val(hO, rest, tf, 0, bO, 0); if(v > best) best = v; }
          }
        }
      }
      memo.set(key, best);
      return best;
    }
    return val;
  }
  function tcbMask(list){ var m = 0; list.forEach(function(i){ m |= (1 << i); }); return m; }
  // CPUから見て、どこにあるか分からないカード(人の手札か山札)。
  function tcbUnknownCards(st){
    var mine = Object.create(null);
    st.hands.cpu.forEach(function(i){ mine[i] = true; });
    return st.cards.map(function(_, i){ return i; }).filter(function(i){
      return !mine[i] && !st.used[i] && i !== st.field.card && !st.knownDeck[i] && st.pubHand.me.indexOf(i) < 0;
    });
  }
  // 人の手札のうち公開されている札(マリガンで引いた札)は必ず入れ、残りを仮定する。
  function tcbOppWorlds(st, unknown, max){
    var known = st.pubHand.me.filter(function(c){ return st.hands.me.indexOf(c) >= 0; });
    return tcbWorlds(unknown, st.hands.me.length - known.length, max).map(function(w){ return w.concat(known); });
  }
  // 人の手札としてありうる組み合わせ(多すぎるときはランダムに選んだもの)。
  function tcbWorlds(unknown, k, maxWorlds){
    var combos = [];
    function count(n, r){ var c = 1; for(var i = 0; i < r; i++) c = c * (n - i) / (i + 1); return c; }
    if(count(unknown.length, k) <= maxWorlds){
      (function rec(start, acc){
        if(acc.length === k){ combos.push(acc.slice()); return; }
        for(var i = start; i < unknown.length; i++){ acc.push(unknown[i]); rec(i + 1, acc); acc.pop(); }
      })(0, []);
      return combos;
    }
    var seen = Object.create(null);
    while(combos.length < maxWorlds){
      var w = tcbShuffle(unknown.slice()).slice(0, k).sort(function(a, b){ return a - b; });
      var key = w.join(',');
      if(seen[key]) continue;
      seen[key] = true;
      combos.push(w);
    }
    return combos;
  }
  // CPUが選べる手の一覧: [カード, 姿の順番, 強化]。
  function tcbOptions(st, who){
    var out = [];
    st.hands[who].forEach(function(ci){
      st.faceIds[ci].forEach(function(f, fi){
        out.push([ci, fi, null]);
        if(!st.boost[who]){
          out.push([ci, fi, 'Z']);
          if(tcbBoostAllowed(st, ci, 'D')) out.push([ci, fi, 'D']);
          if(tcbBoostAllowed(st, ci, 'T')) out.push([ci, fi, 'T']);
        }
      });
    });
    return out;
  }
  // 人が次に出せるカードのうち、姿 faceId に対していちばん点を取れるもの(CPUからは手札が見えないので、
  // どこにあるか分からないカード全体で考える)。
  function tcbThreat(st, faceId){
    var m = 0;
    tcbUnknownCards(st).forEach(function(ci){ st.faceIds[ci].forEach(function(f){ if(st.S[f][faceId] > m) m = st.S[f][faceId]; }); });
    return m;
  }
  function tcbGreedyPick(st, useBoost){
    var best = null, bestG = -1;
    st.hands.cpu.forEach(function(ci){
      st.faceIds[ci].forEach(function(f, fi){
        var g = tcbScore(st, f, null).pts - tcbThreat(st, f) * 0.001;
        if(g > bestG){ bestG = g; best = [ci, fi, null]; }
      });
    });
    if(best && useBoost && !st.boost.cpu){
      var f = st.faceIds[best[0]][best[1]];
      var base = tcbScore(st, f, null).base;
      var lastTurn = st.hands.cpu.length === 1;
      // テラスタルでいちばん点が取れるカード
      var tBest = null, tPts = -1;
      st.hands.cpu.forEach(function(ci){
        if(!tcbBoostAllowed(st, ci, 'T')) return;
        st.faceIds[ci].forEach(function(ff, fi){ var x = tcbScore(st, ff, 'T').pts; if(x > tPts){ tPts = x; tBest = [ci, fi, 'T']; } });
      });
      var plain = tcbScore(st, f, null).pts;
      if(base >= 4 || lastTurn) best[2] = 'Z';
      else if(base >= 3 && tcbThreat(st, f) >= 4 && tcbBoostAllowed(st, best[0], 'D')) best[2] = 'D';
      if(tBest && ((best[2] === 'Z' && tPts > plain * TCB_Z_MULT) || (!best[2] && tPts >= 5 && tPts >= plain + 2.5))) best = tBest;
    }
    return best;
  }
  function tcbStrongPick(st){
    var unknown = tcbUnknownCards(st);
    var worlds = tcbOppWorlds(st, unknown, 20);
    var opts = tcbOptions(st, 'cpu');
    var total = opts.map(function(){ return 0; });
    var cpuMask = tcbMask(st.hands.cpu), bCpu = st.boost.cpu ? 0 : 1, bMe = st.boost.me ? 0 : 1;
    var k = st.field.dyn ? TCB_D_TAKEN : 1;
    var t0 = Date.now();
    worlds.some(function(w, wi){
      // 時間がかかりすぎるときは、3通り以上読んだところで打ち切る
      if(wi >= 3 && Date.now() - t0 > 700) return true;
      var val = tcbSolver(st), meMask = tcbMask(w);
      opts.forEach(function(o, i){
        var f = st.faceIds[o[0]][o[1]];
        if(o[2] === 'T') f = st.teraOf[f];
        var g = st.S[f][st.field.face] * k * tcbBoostMult(o[2]);
        total[i] += g - val(meMask, cpuMask & ~(1 << o[0]), f, o[2] === 'D' ? 1 : 0, bMe, o[2] ? 0 : bCpu);
      });
      return false;
    });
    var bi = 0;
    for(var i = 1; i < opts.length; i++){
      // 同点なら強化を温存する(先に並ぶ「強化なし」を残す)。
      if(total[i] > total[bi] + 1e-9) bi = i;
    }
    return opts[bi];
  }
  // CPUのマリガン: 戻すカード(しないなら null)。
  // つよい: 戻す候補を「点が取りにくい」順に3枚まで絞り、相手の手札を4通り仮定、引く札も最大4枚に絞って先読みで比べる。
  var TCB_MULL_WORLDS = 4, TCB_MULL_CANDS = 3, TCB_MULL_DRAWS = 4;
  function tcbCardOffense(st, ci){
    // そのカード(いちばん良い姿)の、ほかのカード全部への平均点
    var best = 0;
    st.faceIds[ci].forEach(function(f){
      var sum = 0, n = 0;
      st.faces.forEach(function(g, gi){ if(!g.tera && g.card !== ci){ sum += st.S[f][gi]; n++; } });
      if(n && sum / n > best) best = sum / n;
    });
    return best;
  }
  function tcbCpuMulligan(st){
    if(tcbLevel === 'weak') return Math.random() < 0.5 ? st.hands.cpu[tcbRand(st.hands.cpu.length)] : null;
    var ranked = st.hands.cpu.slice().sort(function(a, b){ return tcbCardOffense(st, a) - tcbCardOffense(st, b); });
    if(tcbLevel === 'normal') return tcbCardOffense(st, ranked[0]) < 2 ? ranked[0] : null;
    var unknown = tcbUnknownCards(st);
    var worlds = tcbOppWorlds(st, unknown, TCB_MULL_WORLDS);
    var val = tcbSolver(st), myMask = tcbMask(st.hands.cpu), f = st.field.face;
    function startVal(m, o){ return st.first === 'cpu' ? val(m, o, f, 0, 1, 1) : -val(o, m, f, 0, 1, 1); }
    var opts = [null].concat(ranked.slice(0, TCB_MULL_CANDS)), tot = opts.map(function(){ return 0; });
    var t0 = Date.now();
    worlds.some(function(w, wi){
      // 時間がかかるとき(姿の多いカードがあるとき等)は、2通り読んだところで打ち切る
      if(wi >= 2 && Date.now() - t0 > 600) return true;
      var oppMask = tcbMask(w);
      // その世界での山札(人の手札でない、分からない札＋山札にあると分かっている札)から最大4枚
      var deck = unknown.filter(function(c){ return w.indexOf(c) < 0; }).concat(st.cards.map(function(_, i){ return i; }).filter(function(i){ return st.knownDeck[i]; }));
      var draws = tcbShuffle(deck.slice()).slice(0, TCB_MULL_DRAWS);
      opts.forEach(function(c, i){
        if(c == null){ tot[i] += startVal(myMask, oppMask); return; }
        var sum = 0;
        draws.forEach(function(d){ sum += startVal((myMask & ~(1 << c)) | (1 << d), oppMask); });
        tot[i] += draws.length ? sum / draws.length : -1e9;
      });
      return false;
    });
    var bi = 0;
    for(var i = 1; i < opts.length; i++) if(tot[i] > tot[bi] + 1e-9) bi = i;
    return opts[bi];
  }
  function tcbCpuPick(st){
    if(tcbLevel === 'strong') return tcbStrongPick(st);
    if(tcbLevel === 'normal') return tcbGreedyPick(st, true);
    // よわい: ときどき適当なカードを出す。強化はたまに・最後に使う。
    var pick;
    if(Math.random() < 0.4){
      var ci = st.hands.cpu[tcbRand(st.hands.cpu.length)];
      pick = [ci, tcbRand(st.faceIds[ci].length), null];
    } else pick = tcbGreedyPick(st, false);
    if(!st.boost.cpu && (st.hands.cpu.length === 1 || Math.random() < 0.15)) { pick[2] = ['Z', 'D', 'T'][tcbRand(3)]; if(!tcbBoostAllowed(st, pick[0], pick[2])) pick[2] = 'Z'; }
    return pick;
  }

  // テスト用(画面からは使わない): CPUどうしを対戦させる・状態を見る。
  window.__damekeTypeCardDebug = {
    newGame: function(force){ tcbNewGame(force); return tcbState; },
    parts: tcbParts,
    start: function(force){ tcbStartGame(force); },
    state: function(){ return tcbState; },
    setLevel: function(l){ tcbLevel = l; },
    pick: function(){ return tcbCpuPick(tcbState); },
    cpuMulligan: function(){ return tcbCpuMulligan(tcbState); },
    play: tcbPlay, mulligan: tcbMulligan, score: tcbScore
  };

  // ---- 画面 ----
  function tcbFaceTitle(f){ return f.name + '（' + f.types.join('/') + (f.ab ? '・' + f.ab : '') + '）'; }
  function tcbCardTitle(card){
    if(card.typeChoice){ var f = card.faces[0]; return (f.img || f.name) + '（出すときにタイプを選べる' + (f.ab ? '・' + f.ab : '') + '）'; }
    if(card.liberoChoice){ var b = card.bases[0]; return b.name + '（' + b.types.join('/') + '・' + b.ab + '：出すときに覚える技のタイプから選べる）'; }
    return card.faces.map(tcbFaceTitle).join(' ／ ');
  }
  // カード1枚。opts: size('s'|'m'|'l'), faceIdx か faceId, label, labelCls, cls, onClick, showAlt(姿を選べる印)
  function tcbBuildCard(st, ci, opts){
    opts = opts || {};
    var card = st.cards[ci];
    var fi = opts.faceId != null ? st.faceIds[ci].indexOf(opts.faceId) : (opts.faceIdx != null ? opts.faceIdx : -1);
    var face = fi >= 0 ? card.faces[fi] : null;
    // テラスタルした姿・リベロ等の元の姿
    if(!face && opts.faceId != null && st.faces[opts.faceId]) face = st.faces[opts.faceId];
    if(!face) face = card.baseFaceId != null ? st.faces[card.baseFaceId] : card.faces[0];
    if(face.tera) opts.cls = (opts.cls ? opts.cls + ' ' : '') + 'dameke-tcb-card-tera';
    var el = document.createElement(opts.onClick ? 'button' : 'div');
    if(opts.onClick){ el.type = 'button'; el.addEventListener('click', opts.onClick); }
    el.className = 'dameke-tcb-card dameke-tcb-card-' + (opts.size || 'm') + (opts.cls ? ' ' + opts.cls : '');
    el.title = tcbCardTitle(card);
    if(opts.label){
      var lab = document.createElement('span');
      lab.className = 'dameke-tcb-card-label' + (opts.labelCls ? ' ' + opts.labelCls : '');
      lab.textContent = opts.label;
      el.appendChild(lab);
    }
    var imgWrap = document.createElement('span');
    imgWrap.className = 'dameke-tcb-card-img';
    var imgName = face.img || face.name;
    var img = window.__damekeBuildPokemonImage ? window.__damekeBuildPokemonImage(imgName, function(){ imgWrap.classList.add('dameke-tcb-card-img-missing'); imgWrap.innerHTML = ''; }) : null;
    if(img) imgWrap.appendChild(img); else imgWrap.classList.add('dameke-tcb-card-img-missing');
    el.appendChild(imgWrap);
    var name = document.createElement('span');
    name.className = 'dameke-tcb-card-name';
    name.textContent = face.img || face.name;
    el.appendChild(name);
    el.appendChild(tcbTypeRow(face.types));
    var ab = document.createElement('span');
    ab.className = 'dameke-tcb-card-ability' + (tcbRelevant(face.ab) ? ' dameke-tcb-card-ability-key' : '');
    ab.textContent = face.ab || '特性なし';
    el.appendChild(ab);
    // リベロ等で選んだタイプのときは、元のタイプも出す
    if(face.libero){
      var fr = document.createElement('span');
      fr.className = 'dameke-tcb-card-teraline';
      fr.appendChild(document.createTextNode('元'));
      face.fromTypes.forEach(function(t){
        var fb = document.createElement('span');
        fb.className = 'dameke-party-type-badge dameke-tcb-type-badge dameke-tcb-tera-badge ' + statChartTypeColorClass(t);
        fb.textContent = t;
        fr.appendChild(fb);
      });
      el.appendChild(fr);
    }
    // テラスタイプ(テラスタル済みなら「テラスタル」の印)
    var tr = document.createElement('span');
    tr.className = 'dameke-tcb-card-teraline';
    if(face.tera){ tr.textContent = 'テラスタル'; tr.classList.add('dameke-tcb-card-teraline-on'); }
    else if(card.noTera){ tr.textContent = 'テラスタル不可'; tr.classList.add('dameke-tcb-card-teraline-no'); }
    else {
      var tt = face.teraType || card.tera;
      tr.appendChild(document.createTextNode('テラス'));
      var tb = document.createElement('span');
      tb.className = 'dameke-party-type-badge dameke-tcb-type-badge dameke-tcb-tera-badge ' + statChartTypeColorClass(tt);
      tb.textContent = tt;
      tr.appendChild(tb);
    }
    el.appendChild(tr);
    if(card.noDyn){
      var nd = document.createElement('span');
      nd.className = 'dameke-tcb-card-teraline dameke-tcb-card-teraline-no';
      nd.textContent = 'ダイマックス不可';
      el.appendChild(nd);
    }
    if(opts.showAlt && card.faces.length > 1){
      var alt = document.createElement('span');
      alt.className = 'dameke-tcb-card-alt';
      alt.textContent = card.typeChoice || card.liberoChoice ? 'タイプ' : '姿' + card.faces.length;
      el.appendChild(alt);
    }
    return el;
  }
  function tcbTypeRow(types){
    var row = document.createElement('span');
    row.className = 'dameke-tcb-card-types';
    types.forEach(function(t){
      var b = document.createElement('span');
      b.className = 'dameke-party-type-badge dameke-tcb-type-badge ' + statChartTypeColorClass(t);
      b.textContent = t;
      row.appendChild(b);
    });
    return row;
  }
  function tcbBack(){
    var el = document.createElement('div');
    el.className = 'dameke-tcb-back';
    el.textContent = '？';
    return el;
  }

  // 相性表(攻撃タイプ=行、受けるタイプ=列)。
  function tcbBuildChart(){
    var wrap = document.createElement('div');
    wrap.className = 'dameke-tcb-chart-wrap';
    var table = document.createElement('table');
    table.className = 'dameke-tcb-chart';
    var head = document.createElement('tr');
    var corner = document.createElement('th');
    corner.className = 'dameke-tcb-chart-corner';
    corner.textContent = '攻＼受';
    head.appendChild(corner);
    TCB_TYPES.forEach(function(t){
      var th = document.createElement('th');
      th.className = statChartTypeColorClass(t);
      th.textContent = TCB_TYPE_SHORT[t];
      th.title = t;
      head.appendChild(th);
    });
    table.appendChild(head);
    TCB_TYPES.forEach(function(a){
      var tr = document.createElement('tr');
      var th = document.createElement('th');
      th.className = 'dameke-tcb-chart-rowhead ' + statChartTypeColorClass(a);
      th.textContent = a;
      tr.appendChild(th);
      TCB_TYPES.forEach(function(d){
        var m = tcbTypeEff([d], a, null);
        var td = document.createElement('td');
        td.title = a + '→' + d + ' ×' + m;
        if(m === 2){ td.className = 'dameke-tcb-chart-2'; td.textContent = '◎'; }
        else if(m === 0.5){ td.className = 'dameke-tcb-chart-h'; td.textContent = '△'; }
        else if(m === 0){ td.className = 'dameke-tcb-chart-0'; td.textContent = '×'; }
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    wrap.appendChild(table);
    var note = document.createElement('p');
    note.className = 'dameke-tcb-note';
    note.textContent = '行が出すカードのタイプ、列が場のカードのタイプです。複合タイプの相手には2つの倍率を掛け合わせます。';
    // 凡例
    var legend = document.createElement('div');
    legend.className = 'dameke-tcb-chart-legend';
    [['dameke-tcb-chart-2', '◎', '2倍'], ['', '', '1倍'], ['dameke-tcb-chart-h', '△', '0.5倍'], ['dameke-tcb-chart-0', '×', '0倍']].forEach(function(x){
      var item = document.createElement('span');
      item.className = 'dameke-tcb-chart-legend-item';
      var sw = document.createElement('span');
      sw.className = 'dameke-tcb-chart-legend-mark ' + x[0];
      sw.textContent = x[1];
      item.appendChild(sw);
      item.appendChild(document.createTextNode(x[2] + (x[0] ? '' : '(空欄)')));
      legend.appendChild(item);
    });
    wrap.insertBefore(legend, table);
    wrap.appendChild(note);
    return wrap;
  }

  // 関係する特性の一覧(この試合のカードにあるものを先に、印を付けて出す)。
  function tcbAbilityRows(st){
    var present = Object.create(null);
    if(st) st.faces.forEach(function(f){ if(f.ab) present[f.ab] = true; });
    var defs = [];
    var lev = ['ふゆう'];
    (DATA.abilities || []).forEach(function(a){
      var tags = a.effectTags || [];
      if(tags.indexOf('levitate') >= 0 && lev.indexOf(a.name) < 0) lev.push(a.name);
    });
    if(lev.indexOf('うなぎのぼり') < 0) lev.push('うなぎのぼり');
    lev.forEach(function(n){ defs.push([n, 'じめんタイプの点が0']); });
    [['ちょすい','みず'],['よびみず','みず'],['ちくでん','でんき'],['でんきエンジン','でんき'],['ひらいしん','でんき'],
     ['もらいび','ほのお'],['こんがりボディ','ほのお'],['そうしょく','くさ'],['どしょく','じめん']]
      .forEach(function(x){ defs.push([x[0], x[1] + 'タイプの点が0']); });
    defs.push(['あついしぼう', 'ほのお・こおりタイプの点が半分']);
    defs.push(['すいほう', 'ほのおタイプの点が半分']);
    defs.push(['たいねつ', 'ほのおタイプの点が半分']);
    defs.push(['きよめのしお', 'ゴーストタイプの点が半分']);
    defs.push(['おわりのだいち', 'みずタイプの点が0(かたやぶり・テラボルテージ・ターボブレイズでは無視されない)']);
    defs.push(['はじまりのうみ', 'ほのおタイプの点が0(かたやぶり・テラボルテージ・ターボブレイズでは無視されない)']);
    defs.push(['デルタストリーム', 'ひこうタイプへのばつぐん(こおり・でんき・いわ)が、ひこうの分だけ等倍に(かたやぶり・テラボルテージ・ターボブレイズでは無視されない)']);
    defs.push(['ふしぎなまもり', 'ばつぐん以外の点が0']);
    defs.push(['ハードロック', 'ばつぐんの点が×0.75']);
    defs.push(['フィルター', 'ばつぐんの点が×0.75']);
    defs.push(['プリズムアーマー', 'ばつぐんの点が×0.75(かたやぶり・テラボルテージ・ターボブレイズでは無視されない)']);
    defs.push(['テラスシェル', '受ける相性がすべて今ひとつ(×0.5)になる(無効はそのまま)']);
    defs.push([TCB_GAS, '出すカードの特性をなくす']);
    defs.push([TCB_ANTICIPATION, '出したとき、相手の手札にばつぐんを取れるカードがあると みぶるいする(点数は変わらない)']);
    var atk = Object.keys(TCB_BYPASS).map(function(n){ return [n, n === TCB_GAS ? '場のカードの特性を無視' : '場のカードの特性を無視(プリズムアーマー・おわりのだいち・はじまりのうみ・デルタストリームは除く)']; });
    atk.push(['ARシステム', '出すとき、18タイプから1つ選んで、その単タイプになる(テラスタルするとテラスタイプ)']);
    atk.push(['へんげんじざい', '出すとき、そのポケモンの覚える技のタイプから1つ選んで、その単タイプになる(テラスタルするとテラスタイプ)']);
    atk.push(['マルチタイプ', '出すとき、18タイプから1つ選んで、その単タイプになる(テラスタルするとテラスタイプ)']);
    atk.push(['リベロ', '出すとき、そのポケモンの覚える技のタイプから1つ選んで、その単タイプになる(テラスタルするとテラスタイプ)']);
    atk.push(['いろめがね', '今ひとつの点が×2']);
    atk.push(['きもったま', 'ノーマル・かくとうの点がゴーストにも入る']);
    atk.push(['しんがん', 'ノーマル・かくとうの点がゴーストにも入る']);
    atk.push(['ブレインフォース', 'ばつぐんの点が×1.25']);
    function sortPresent(list){ return list.filter(function(x){ return present[x[0]]; }).concat(list.filter(function(x){ return !present[x[0]]; })); }
    return { def: sortPresent(defs), atk: sortPresent(atk), present: present };
  }
  function tcbBuildAbilityList(st){
    var data = tcbAbilityRows(st);
    var wrap = document.createElement('div');
    wrap.className = 'dameke-tcb-abil';
    [['場のカードの特性(受けるとき)', data.def], ['出すカードの特性(場のカードが' + TCB_GAS + 'なら働かない)', data.atk]].forEach(function(sec){
      var h = document.createElement('div');
      h.className = 'dameke-tcb-abil-head';
      h.textContent = sec[0];
      wrap.appendChild(h);
      var list = document.createElement('div');
      list.className = 'dameke-tcb-abil-list';
      sec[1].forEach(function(x){
        var row = document.createElement('div');
        row.className = 'dameke-tcb-abil-row' + (data.present[x[0]] ? ' dameke-tcb-abil-present' : '');
        var n = document.createElement('span'); n.className = 'dameke-tcb-abil-name'; n.textContent = x[0];
        var d = document.createElement('span'); d.className = 'dameke-tcb-abil-desc'; d.textContent = x[1];
        row.appendChild(n); row.appendChild(d);
        list.appendChild(row);
      });
      wrap.appendChild(list);
    });
    var note = document.createElement('p');
    note.className = 'dameke-tcb-note';
    note.textContent = '色付きは、この試合のカードに付いている特性です。';
    wrap.appendChild(note);
    return wrap;
  }

  // 1手の内訳の文章。
  function tcbPartText(p){
    return p.type + '×' + tcbPts(p.eff0) + (p.notes.length ? '(' + p.notes.join('、') + ')' : '') + (p.mult !== p.eff0 ? '→' + tcbPts(p.mult) : '');
  }
  function tcbExtraText(e){
    var t = '';
    if(e.boost === 'Z') t += '、Zワザ×2';
    if(e.boost === 'D') t += '、ダイマックス×1.5';
    if(e.boost === 'T') t += '、テラスタル×1.25';
    if(e.targetDyn) t += '、相手がダイマックス×0.5';
    return t;
  }
  function tcbShudderText(st, e){ return e.shudder ? st.faces[e.face].name + 'はみぶるいした！' : ''; }
  function tcbLogText(st, e){
    var att = st.faces[e.face], def = st.faces[e.target];
    var t = att.name + ' → ' + def.name + '：' + e.parts.map(tcbPartText).join(' + ') + ' = ' + tcbPts(e.base);
    var x = tcbExtraText(e);
    if(x) t += x + ' = ' + tcbPts(e.pts);
    t += '点';
    if(e.shudder) t += '　' + tcbShudderText(st, e);
    return t;
  }

  // ---- 演出(カットイン・出した札の表示)。画面を見ていないとき(別のゲームを開いている等)はすぐ次へ進む ----
  var tcbUI = null;          // 最後に描いた画面 { wrap, renderAll }
  var tcbFxCurrent = null;   // 表示中の演出 { el, finish }
  var TCB_FX_PLAY_MS = 2200, TCB_FX_SHUDDER_MS = 3000, TCB_FX_SWAP_MS = 1800, TCB_CUTIN_MS = 1000, TCB_CPU_WAIT_MS = 500, TCB_FX_LEAVE_MS = 260;
  function tcbRenderNow(){ if(tcbUI) tcbUI.renderAll(); }
  function tcbVisible(){ return !!(tcbUI && tcbUI.wrap.isConnected); }
  function tcbFxClear(){ if(tcbFxCurrent){ var f = tcbFxCurrent; tcbFxCurrent = null; f.cancel(); } }
  // el を全画面の重ね表示で ms ミリ秒出す(押すと早送り)。終わったら done。
  function tcbFxShow(el, ms, done){
    tcbFxClear();
    if(!tcbVisible()){ setTimeout(done, 0); return; }
    var layer = document.createElement('div');
    layer.className = 'dameke-tcb-fx-layer';
    layer.appendChild(el);
    var timer = null, ended = false;
    function remove(){ if(timer){ clearTimeout(timer); timer = null; } if(layer.parentNode) layer.parentNode.removeChild(layer); }
    // 終わるときも少しかけて消す(ぱっと消えないように)。動きを減らす設定のときはすぐ消す。
    function finish(){
      if(ended) return;
      ended = true;
      if(tcbFxCurrent && tcbFxCurrent.el === layer) tcbFxCurrent = null;
      if(timer){ clearTimeout(timer); timer = null; }
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if(reduce || !layer.isConnected){ remove(); done(); return; }
      layer.classList.add('dameke-tcb-fx-leaving');
      setTimeout(function(){ remove(); done(); }, TCB_FX_LEAVE_MS);
    }
    layer.addEventListener('click', finish);
    tcbUI.wrap.appendChild(layer);
    tcbFxCurrent = { el: layer, cancel: function(){ ended = true; remove(); } };
    timer = setTimeout(finish, ms);
  }
  function tcbCutin(text, who, done){
    var band = document.createElement('div');
    band.className = 'dameke-tcb-cutin' + (who ? ' dameke-tcb-cutin-' + who : '');
    var t = document.createElement('span');
    t.className = 'dameke-tcb-cutin-text';
    t.textContent = text;
    band.appendChild(t);
    tcbFxShow(band, TCB_CUTIN_MS, done);
  }
  function tcbFxHead(text, who){
    var h = document.createElement('div');
    h.className = 'dameke-tcb-fx-head dameke-tcb-fx-head-' + who;
    h.textContent = text;
    return h;
  }
  function tcbFxPair(st, fromCard, fromFace, toCard, toFace, toDyn, arrowText){
    var row = document.createElement('div');
    row.className = 'dameke-tcb-fx-cards';
    var a = tcbBuildCard(st, fromCard, { size: 'm', faceId: fromFace, cls: 'dameke-tcb-fx-attacker' });
    var arrow = document.createElement('span');
    arrow.className = 'dameke-tcb-fx-arrow';
    arrow.textContent = arrowText || '→';
    var b = tcbBuildCard(st, toCard, { size: 'm', faceId: toFace, cls: 'dameke-tcb-fx-target' + (toDyn ? ' dameke-tcb-card-dyn' : ''), label: toDyn ? 'ダイマックス' : null, labelCls: 'dameke-tcb-label-dyn' });
    row.appendChild(a); row.appendChild(arrow); row.appendChild(b);
    return row;
  }
  function tcbFxPlay(st, e, done){
    var panel = document.createElement('div');
    panel.className = 'dameke-tcb-fx-panel dameke-tcb-fx-panel-' + e.who + (e.boost ? ' dameke-tcb-fx-panel-boost dameke-tcb-fx-panel-boost-' + e.boost : '');
    var head = (e.who === 'me' ? 'あなた' : 'CPU') + 'のターン！';
    panel.appendChild(tcbFxHead(head, e.who));
    if(e.boost){
      var bt = document.createElement('div');
      bt.className = 'dameke-tcb-fx-boost dameke-tcb-fx-boost-' + e.boost;
      bt.textContent = e.boost === 'Z' ? 'Zワザ！ ×2' : e.boost === 'D' ? 'ダイマックス！ ×1.5' : 'テラスタル！ ×1.25';
      panel.appendChild(bt);
    }
    panel.appendChild(tcbFxPair(st, st.faces[e.face].card, e.face, st.faces[e.target].card, e.target, e.targetDyn));
    var parts = document.createElement('div');
    parts.className = 'dameke-tcb-fx-parts';
    e.parts.forEach(function(p){ var d = document.createElement('div'); d.textContent = tcbPartText(p); parts.appendChild(d); });
    var x = tcbExtraText(e);
    if(x){ var d2 = document.createElement('div'); d2.textContent = '計' + tcbPts(e.base) + x; parts.appendChild(d2); }
    panel.appendChild(parts);
    var pts = document.createElement('div');
    pts.className = 'dameke-tcb-fx-pts';
    pts.textContent = '+' + tcbPts(e.pts) + '点';
    panel.appendChild(pts);
    if(e.shudder){
      var sh = document.createElement('div');
      sh.className = 'dameke-tcb-fx-shudder';
      sh.textContent = tcbShudderText(st, e);
      panel.appendChild(sh);
    }
    var hint = document.createElement('div');
    hint.className = 'dameke-tcb-fx-hint';
    hint.textContent = '押すと先へ進みます';
    panel.appendChild(hint);
    tcbFxShow(panel, e.shudder ? TCB_FX_SHUDDER_MS : TCB_FX_PLAY_MS, done);
  }
  function tcbFxMull(st, res, done){
    var who = res.who;
    var panel = document.createElement('div');
    panel.className = 'dameke-tcb-fx-panel dameke-tcb-fx-panel-' + who;
    panel.appendChild(tcbFxHead((who === 'me' ? 'あなた' : 'CPU') + 'がマリガン！', who));
    panel.appendChild(tcbFxPair(st, res.out, tcbDefaultFaceOf(st.cards[res.out], st.faceIds[res.out]), res.drew, tcbDefaultFaceOf(st.cards[res.drew], st.faceIds[res.drew]), false, '⇄'));
    var note = document.createElement('div');
    note.className = 'dameke-tcb-fx-parts';
    note.textContent = '左の札を山札に戻し、右の札を引きました(どちらも公開)。';
    panel.appendChild(note);
    tcbFxShow(panel, TCB_FX_SWAP_MS, done);
  }

  var TCB_CYCLE_ICON = '<svg class="dameke-tcb-cycle-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">' +
    '<path d="M20 12a8 8 0 0 1-13.7 5.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>' +
    '<path d="M4 12a8 8 0 0 1 13.7-5.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>' +
    '<path d="M18.5 2.5v4.5H14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M5.5 21.5V17H10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  // 姿の詳細(一覧)。onPick があれば、押した姿を選ぶ(自分の手札用)。
  var tcbFacesModal = null;
  function tcbCloseFaces(){ if(tcbFacesModal){ var m = tcbFacesModal; tcbFacesModal = null; if(m.parentNode) m.parentNode.removeChild(m); } }
  function tcbShowFaces(st, ci, onPick){
    tcbCloseFaces();
    if(!st || !tcbVisible()) return;
    var card = st.cards[ci];
    var rows = tcbAbilityRows(null), desc = Object.create(null);
    rows.def.concat(rows.atk).forEach(function(x){ desc[x[0]] = desc[x[0]] ? desc[x[0]] + '／' + x[1] : x[1]; });
    var layer = document.createElement('div');
    layer.className = 'dameke-tcb-modal-layer';
    var panel = document.createElement('div');
    panel.className = 'dameke-tcb-modal';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    var head = document.createElement('div');
    head.className = 'dameke-tcb-modal-head';
    var ttl = document.createElement('span');
    ttl.className = 'dameke-tcb-modal-title';
    ttl.textContent = (card.faces[0].img || card.faces[0].name) + (card.typeChoice ? 'のタイプ（' : 'の姿（') + card.faces.length + '）';
    head.appendChild(ttl);
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'dameke-search-add-btn dameke-tcb-modal-close';
    close.textContent = '閉じる';
    close.addEventListener('click', tcbCloseFaces);
    head.appendChild(close);
    panel.appendChild(head);
    if(onPick){
      var note = document.createElement('p');
      note.className = 'dameke-tcb-note';
      note.textContent = '押すと、その姿にします。';
      panel.appendChild(note);
    }
    var cur = onPick ? (st.handFace[ci] || 0) : -1;
    var grid = document.createElement('div');
    grid.className = 'dameke-tcb-modal-grid';
    card.faces.forEach(function(f, fi){
      var item = document.createElement('div');
      item.className = 'dameke-tcb-modal-item';
      var c = tcbBuildCard(st, ci, { size: 's', faceIdx: fi, cls: fi === cur ? 'dameke-tcb-card-selected' : '', label: fi === cur ? '選択中' : null, labelCls: 'dameke-tcb-label-play',
        onClick: onPick ? function(){ tcbCloseFaces(); onPick(fi); } : null });
      // 姿の名前はフルで出す(カードは元の名前だけのことがある)
      var nm = c.querySelector('.dameke-tcb-card-name');
      if(nm && !card.typeChoice) nm.textContent = f.name;
      item.appendChild(c);
      if(f.ab && desc[f.ab]){
        var d = document.createElement('div');
        d.className = 'dameke-tcb-modal-desc';
        d.textContent = f.ab + '：' + desc[f.ab];
        item.appendChild(d);
      }
      grid.appendChild(item);
    });
    panel.appendChild(grid);
    layer.appendChild(panel);
    layer.addEventListener('click', function(ev){ if(ev.target === layer) tcbCloseFaces(); });
    layer.addEventListener('keydown', function(ev){ if(ev.key === 'Escape') tcbCloseFaces(); });
    tcbUI.wrap.appendChild(layer);
    tcbFacesModal = layer;
    close.focus();
  }

  // ---- 進行 ----
  function tcbResultText(st){
    var a = st.scores.me, b = st.scores.cpu;
    return a > b + 1e-9 ? 'あなたの勝ち！' : (b > a + 1e-9 ? 'CPUの勝ち' : '引き分け');
  }
  // 1手(出す)の後: 演出 → 交代のカットイン → 次の手番。
  function tcbAfterPlay(st, e){
    st.busy = true;
    tcbRenderNow();
    // 強化したときは、先に強化のカットインを出す
    function showPlay(){ tcbFxPlay(st, e, afterFx); }
    if(e.boost) tcbCutin((e.who === 'me' ? 'あなたの' : 'CPUの') + TCB_BOOST_NAME[e.boost] + '！', 'boost-' + e.boost, function(){ if(st === tcbState) showPlay(); });
    else showPlay();
    function afterFx(){
      if(st !== tcbState) return;
      if(st.finished){
        tcbCutin('試合終了　' + tcbResultText(st), null, function(){ if(st !== tcbState) return; st.busy = false; tcbRenderNow(); });
        return;
      }
      tcbCutin(st.turn === 'me' ? 'あなたの番' : 'CPUの番', st.turn, function(){
        if(st !== tcbState) return;
        st.busy = false;
        tcbRenderNow();
        if(st.turn === 'cpu') tcbScheduleCpu();
      });
    }
  }
  function tcbStartGame(force){
    tcbFxClear();
    tcbCloseFaces();
    tcbNewGame(Array.isArray(force) ? force : null);
    var st = tcbState;
    st.busy = true;
    tcbRenderNow();
    tcbCutin((st.first === 'me' ? 'あなた' : 'CPU') + 'が先攻', st.first, function(){
      if(st !== tcbState) return;
      tcbNextMull(st);
    });
  }
  // マリガンの段階を進める(CPUの番なら考えて実行、人の番なら操作を待つ。両方終わったら対戦開始)。
  function tcbNextMull(st){
    if(st !== tcbState) return;
    if(st.phase === 'play'){
      st.busy = true;
      tcbCutin(st.turn === 'me' ? 'あなたの番' : 'CPUの番', st.turn, function(){
        if(st !== tcbState) return;
        st.busy = false;
        tcbRenderNow();
        if(st.turn === 'cpu') tcbScheduleCpu();
      });
      return;
    }
    st.busy = false;
    if(st.mullWho === 'me'){ tcbRenderNow(); return; }
    if(tcbTimer) return;
    st.thinking = true;
    tcbRenderNow();
    tcbTimer = setTimeout(function(){
      tcbTimer = null;
      if(st !== tcbState || st.phase !== 'mull' || st.mullWho !== 'cpu') return;
      var c = tcbCpuMulligan(st);
      st.thinking = false;
      tcbAfterMull(st, tcbMulligan('cpu', c));
    }, TCB_CPU_WAIT_MS);
  }
  function tcbAfterMull(st, res){
    if(!res) return;
    st.busy = true;
    tcbRenderNow();
    function next(){ if(st === tcbState) tcbNextMull(st); }
    if(res.out != null) tcbFxMull(st, res, next);
    else tcbCutin((res.who === 'me' ? 'あなた' : 'CPU') + 'はマリガンしない', res.who, next);
  }
  function tcbHumanMull(ci){
    var st = tcbState;
    if(!st || st.busy || st.phase !== 'mull' || st.mullWho !== 'me') return;
    tcbAfterMull(st, tcbMulligan('me', ci));
  }
  function tcbQuitGame(){
    tcbFxClear();
    tcbCloseFaces();
    if(tcbTimer){ clearTimeout(tcbTimer); tcbTimer = null; }
    tcbState = null;
    tcbRenderNow();
  }
  function tcbHumanPlay(ci){
    var st = tcbState;
    if(!st || st.busy || st.finished || st.turn !== 'me' || st.phase !== 'play') return;
    var fi = st.handFace[ci] || 0;
    st.message = null;
    var e = tcbPlay('me', ci, fi, st.selBoost);
    if(e) tcbAfterPlay(st, e);
  }
  // CPUの番: 少し間を置いて考える → 出す。
  function tcbScheduleCpu(){
    var st = tcbState;
    if(!st || st.finished || st.turn !== 'cpu' || tcbTimer || st.busy || st.phase !== 'play') return;
    st.thinking = true;
    tcbRenderNow();
    tcbTimer = setTimeout(function(){
      tcbTimer = null;
      if(tcbState !== st || st.finished || st.turn !== 'cpu') return;
      function playNow(){
        if(tcbState !== st) return;
        var pick = tcbCpuPick(st);
        st.thinking = false;
        var e = pick ? tcbPlay('cpu', pick[0], pick[1], pick[2]) : null;
        if(e) tcbAfterPlay(st, e); else tcbRenderNow();
      }
      playNow();
    }, TCB_CPU_WAIT_MS);
  }

  function renderTypeCardGame(host){
    var wrap = document.createElement('div');
    wrap.className = 'dameke-tcb-wrap';
    var title = document.createElement('h3');
    title.className = 'dameke-minigame-title';
    title.textContent = '相性カードバトル';
    wrap.appendChild(title);

    var rulesFold = buildMinigameFold('ルール');
    rulesFold.body.className = 'dameke-minigame-rules-body';
    rulesFold.body.innerHTML =
      '<p>18枚のポケモンカードを使い、CPUと1枚ずつ交互に出し合います。カードは「今回のカード」で全部見られます。</p>' +
      '<p>はじめに場札が1枚置かれ、6枚ずつ手札が配られます。残りの5枚は山札(裏向き)です。</p>' +
      '<p>始める前に、後攻→先攻の順で1回ずつマリガンができます。手札1枚を山札に戻して、山札から1枚引きます。戻した札も引いた札も相手に公開されます(先に戻された札を引くこともあります)。マリガンしなくても構いません。</p>' +
      '<p>カードを出すと、そのカードの2つのタイプそれぞれの、場のカードへの相性の倍率を合計した点数が入ります(単タイプは同じタイプで2回分)。出したカードが次の場札になります。</p>' +
      '<p>カードの特性も点数に影響します(「相性に関わる特性」を参照)。</p>' +
      '<p>手札のカードを押すと選び、もう一度押すと出します。フォルム違いのあるカード(タイプか相性に関わる特性が違う姿があるとき)と、タイプを選べる特性(「相性に関わる特性」を参照)のカードは、カードの下で姿やタイプを選べます。</p>' +
      '<p>強化は1試合1回、どれか1つ: Zワザ(その手の点数2倍)／ダイマックス(その手の点数1.5倍、そのカードが次に受ける点数は半分)／テラスタル(そのカードがテラスタイプの単タイプになって、その手の点数1.25倍。場に残ったあとも、テラスタイプとして点を受けます)。</p>' +
      '<p>※オーガポンはお面ごとのテラスタイプ(テラスタルするとおもかげやどし)、テラパゴスはテラスタルできません。ザシアン・ザマゼンタ・ムゲンダイナはダイマックスできません。</p>' +
      '<p>お互い手札を出し切ったら、合計点の多い方の勝ちです。</p>';
    wrap.appendChild(rulesFold.fold);

    var settingRow = document.createElement('div');
    settingRow.className = 'dameke-stathl-mode-row dameke-tcb-setting-row';
    var lvLabel = document.createElement('span');
    lvLabel.className = 'dameke-adjust-nature-title dameke-stathl-mode-label';
    lvLabel.textContent = 'CPUの強さ：';
    settingRow.appendChild(lvLabel);
    TCB_LEVELS.forEach(function(lv){
      var l = document.createElement('label');
      l.className = 'dameke-stathl-mode-option';
      var r = document.createElement('input');
      r.type = 'radio'; r.name = 'damekeTcbLevel'; r.value = lv[0]; r.checked = tcbLevel === lv[0];
      r.addEventListener('change', function(){ if(r.checked) tcbLevel = lv[0]; });
      l.appendChild(r); l.appendChild(document.createTextNode(lv[1]));
      settingRow.appendChild(l);
    });
    var quitBtn = document.createElement('button');
    quitBtn.type = 'button';
    quitBtn.className = 'dameke-search-add-btn dameke-tcb-new-btn';
    quitBtn.textContent = 'ゲームをやめる';
    quitBtn.addEventListener('click', function(){
      var st = tcbState;
      if(st && !st.finished && st.plies > 0 && !window.confirm('いまのゲームをやめますか？')) return;
      tcbQuitGame();
    });
    settingRow.appendChild(quitBtn);
    wrap.appendChild(settingRow);

    var chartFold = buildMinigameFold('相性表');
    chartFold.body.appendChild(tcbBuildChart());
    wrap.appendChild(chartFold.fold);
    var abilFold = buildMinigameFold('相性に関わる特性');
    wrap.appendChild(abilFold.fold);

    var board = document.createElement('div');
    board.className = 'dameke-tcb-board';
    wrap.appendChild(board);

    var poolSec = document.createElement('div');
    poolSec.className = 'dameke-tcb-section';
    wrap.appendChild(poolSec);

    var logFold = buildMinigameFold('記録');
    wrap.appendChild(logFold.fold);

    host.appendChild(wrap);

    function scoreSide(who, label){
      var st = tcbState;
      var box = document.createElement('div');
      box.className = 'dameke-tcb-score dameke-tcb-score-' + who + (st.turn === who && !st.finished ? ' dameke-tcb-score-turn' : '');
      var top = document.createElement('div');
      top.className = 'dameke-tcb-score-top';
      var nm = document.createElement('span');
      nm.className = 'dameke-tcb-score-name';
      nm.textContent = label + (st.first === who ? '（先攻）' : '（後攻）');
      var pt = document.createElement('span');
      pt.className = 'dameke-tcb-score-pts';
      pt.textContent = tcbPts(st.scores[who]) + '点';
      top.appendChild(nm); top.appendChild(pt);
      box.appendChild(top);
      var sub = document.createElement('div');
      sub.className = 'dameke-tcb-score-sub';
      var chip = document.createElement('span');
      chip.className = 'dameke-tcb-boost-chip' + (st.boost[who] ? ' dameke-tcb-boost-chip-used dameke-tcb-boost-chip-' + st.boost[who] : '');
      chip.textContent = st.boost[who] ? TCB_BOOST_NAME[st.boost[who]] + ' 使用済み' : '強化 未使用';
      sub.appendChild(chip);
      var cnt = document.createElement('span');
      cnt.className = 'dameke-tcb-score-count';
      cnt.textContent = '手札' + st.hands[who].length + '枚';
      sub.appendChild(cnt);
      box.appendChild(sub);
      return box;
    }

    function renderStart(){
      board.innerHTML = '';
      var box = document.createElement('div');
      box.className = 'dameke-tcb-start';
      var p = document.createElement('p');
      p.className = 'dameke-tcb-start-text';
      p.textContent = 'CPUの強さを選んで「ゲームスタート」を押してください。先攻・後攻はランダムに決まります。';
      box.appendChild(p);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dameke-search-add-btn dameke-minigame-retry-btn dameke-tcb-start-btn';
      btn.textContent = 'ゲームスタート';
      btn.addEventListener('click', tcbStartGame);
      box.appendChild(btn);
      board.appendChild(box);
    }

    function renderBoard(){
      var st = tcbState;
      if(!st){ renderStart(); return; }
      board.innerHTML = '';
      var scores = document.createElement('div');
      scores.className = 'dameke-tcb-scores';
      scores.appendChild(scoreSide('me', 'あなた'));
      scores.appendChild(scoreSide('cpu', 'CPU'));
      board.appendChild(scores);

      // 相手の手札(裏向き)
      var oppRow = document.createElement('div');
      oppRow.className = 'dameke-tcb-row';
      var oppLab = document.createElement('div');
      oppLab.className = 'dameke-tcb-row-label';
      oppLab.textContent = 'CPUの手札';
      oppRow.appendChild(oppLab);
      var oppHand = document.createElement('div');
      oppHand.className = 'dameke-tcb-backs';
      // マリガンで引いた(公開の)札は表向き
      st.hands.cpu.forEach(function(ci){
        if(st.pubHand.cpu.indexOf(ci) >= 0) oppHand.appendChild(tcbBuildCard(st, ci, { size: 's', cls: 'dameke-tcb-opp-open', label: '公開', labelCls: 'dameke-tcb-label-open' }));
        else oppHand.appendChild(tcbBack());
      });
      if(!st.hands.cpu.length){ var none = document.createElement('span'); none.className = 'dameke-tcb-empty'; none.textContent = 'なし'; oppHand.appendChild(none); }
      oppRow.appendChild(oppHand);
      board.appendChild(oppRow);

      // 場札と山札
      var mid = document.createElement('div');
      mid.className = 'dameke-tcb-mid';
      var fieldBox = document.createElement('div');
      fieldBox.className = 'dameke-tcb-field';
      var fLab = document.createElement('div');
      fLab.className = 'dameke-tcb-row-label';
      fLab.textContent = st.field.by === 'start' ? '場札(最初の1枚)' : '場札(' + (st.field.by === 'me' ? 'あなた' : 'CPU') + 'が出したカード)';
      fieldBox.appendChild(fLab);
      fieldBox.appendChild(tcbBuildCard(st, st.field.card, { size: 'l', faceId: st.field.face, cls: st.field.dyn ? 'dameke-tcb-card-dyn' : '', label: st.field.dyn ? 'ダイマックス中' : (st.faces[st.field.face].tera ? 'テラスタル中' : null), labelCls: st.field.dyn ? 'dameke-tcb-label-dyn' : 'dameke-tcb-label-tera' }));
      mid.appendChild(fieldBox);
      var side = document.createElement('div');
      side.className = 'dameke-tcb-side';
      var deckBox = document.createElement('div');
      deckBox.className = 'dameke-tcb-deck';
      var dLab = document.createElement('div');
      dLab.className = 'dameke-tcb-row-label';
      dLab.textContent = '山札 ' + st.deck.length + '枚';
      deckBox.appendChild(dLab);
      var dBacks = document.createElement('div');
      dBacks.className = 'dameke-tcb-backs';
      st.deck.forEach(function(){ dBacks.appendChild(tcbBack()); });
      deckBox.appendChild(dBacks);
      side.appendChild(deckBox);
      var last = st.log[st.log.length - 1];
      if(last){
        var info = document.createElement('div');
        info.className = 'dameke-tcb-lastplay';
        var who = document.createElement('div');
        who.className = 'dameke-tcb-lastplay-head';
        who.textContent = '直前：' + (last.who === 'me' ? 'あなた' : 'CPU') + 'が ' + tcbPts(last.pts) + '点' + (last.boost ? '(' + TCB_BOOST_NAME[last.boost] + ')' : '');
        info.appendChild(who);
        var detail = document.createElement('div');
        detail.className = 'dameke-tcb-lastplay-detail';
        detail.textContent = tcbLogText(st, last).replace('　' + tcbShudderText(st, last), '');
        info.appendChild(detail);
        if(last.shudder){
          var sh = document.createElement('div');
          sh.className = 'dameke-tcb-lastplay-shudder';
          sh.textContent = tcbShudderText(st, last);
          info.appendChild(sh);
        }
        side.appendChild(info);
      }
      mid.appendChild(side);
      board.appendChild(mid);

      // メッセージ
      var msg = document.createElement('div');
      msg.className = 'dameke-tcb-message';
      var myTurn = st.turn === 'me' && !st.finished && !st.busy && st.phase === 'play';
      var myMull = st.phase === 'mull' && st.mullWho === 'me' && !st.busy;
      if(st.phase === 'mull'){
        if(st.mullWho === 'cpu') msg.textContent = st.thinking ? 'CPUがマリガンを考えています…' : 'CPUのマリガンです';
        else if(st.sel == null) msg.textContent = 'マリガン：山札に戻すカードを押してください(もう一度押すと戻して1枚引きます)。';
        else msg.textContent = '「' + st.cards[st.sel].faces[st.handFace[st.sel] || 0].name + '」を山札に戻して1枚引きます。もう一度押すと戻します。';
      } else if(st.finished){
        var a = st.scores.me, b = st.scores.cpu;
        msg.classList.add(a > b + 1e-9 ? 'dameke-tcb-message-win' : (b > a + 1e-9 ? 'dameke-tcb-message-lose' : 'dameke-tcb-message-draw'));
        msg.textContent = tcbResultText(st) + '　' + tcbPts(a) + ' 対 ' + tcbPts(b);
      } else if(st.turn === 'cpu'){
        msg.textContent = st.thinking ? 'CPUが考えています…' : 'CPUの番です';
      } else if(st.sel == null){
        msg.textContent = 'あなたの番です。出すカードを押してください。';
      } else {
        var f = st.cards[st.sel].faces[st.handFace[st.sel] || 0];
        msg.textContent = '「' + f.name + '」を' + (st.selBoost === 'Z' ? 'Zワザで' : st.selBoost === 'D' ? 'ダイマックスして' : st.selBoost === 'T' ? 'テラスタルして' : '') + '出します。もう一度押すと出します。';
      }
      if(st.message){ var m2 = document.createElement('div'); m2.className = 'dameke-tcb-message-sub'; m2.textContent = st.message; msg.appendChild(m2); }
      board.appendChild(msg);
      if(st.finished){
        var again = document.createElement('button');
        again.type = 'button';
        again.className = 'dameke-search-add-btn dameke-minigame-retry-btn dameke-tcb-again';
        again.textContent = 'もう一度';
        again.addEventListener('click', tcbStartGame);
        board.appendChild(again);
      }

      // 自分の操作(交換・強化)と手札
      if(!st.finished) board.appendChild(st.phase === 'mull' ? buildMullControls(myMull) : buildControls(myTurn));
      var myRow = document.createElement('div');
      myRow.className = 'dameke-tcb-row';
      var myLab = document.createElement('div');
      myLab.className = 'dameke-tcb-row-label';
      myLab.textContent = 'あなたの手札';
      // 場のカードがかがくへんかガスなら、手札の特性は働かない(取り消し線で表示)
      var gasField = st.phase === 'play' && !st.finished && st.faces[st.field.face].ab === TCB_GAS;
      myRow.appendChild(myLab);
      var hand = document.createElement('div');
      hand.className = 'dameke-tcb-hand' + (gasField ? ' dameke-tcb-hand-gas' : '');
      st.hands.me.forEach(function(ci){ hand.appendChild(buildHandItem(ci, myTurn, myMull)); });
      if(!st.hands.me.length){ var none2 = document.createElement('span'); none2.className = 'dameke-tcb-empty'; none2.textContent = 'なし'; hand.appendChild(none2); }
      myRow.appendChild(hand);
      board.appendChild(myRow);
    }

    function buildHandItem(ci, myTurn, myMull){
      var st = tcbState;
      var card = st.cards[ci];
      var item = document.createElement('div');
      item.className = 'dameke-tcb-handitem';
      if(myMull) return buildMullHandItem(ci, item);
      var selected = st.sel === ci && myTurn;
      var gasNow = st.phase === 'play' && st.faces[st.field.face].ab === TCB_GAS;
      var el = tcbBuildCard(st, ci, {
        size: 'm', faceIdx: st.handFace[ci] || 0, showAlt: true,
        // テラスタルを選んでいるときは、選んだカードをテラスタルした姿で見せる
        // かがくへんかガスの場では、リベロ等も元の姿(タイプは変わらない)で見せる
        faceId: selected && st.selBoost === 'T' ? st.teraOf[st.faceIds[ci][st.handFace[ci] || 0]]
          : (gasNow && st.faces[st.faceIds[ci][st.handFace[ci] || 0]].libero ? st.faces[st.faceIds[ci][st.handFace[ci] || 0]].baseRef.id : null),
        label: selected ? (st.selBoost === 'Z' ? 'Zワザで出す' : st.selBoost === 'D' ? 'ダイマで出す' : st.selBoost === 'T' ? 'テラスで出す' : '出す') : null,
        labelCls: 'dameke-tcb-label-play' + (selected && st.selBoost ? ' dameke-tcb-label-boost-' + st.selBoost : ''),
        cls: (selected ? 'dameke-tcb-card-selected' : '') + (selected && st.selBoost ? ' dameke-tcb-card-boost-' + st.selBoost : '') + (myTurn ? '' : ' dameke-tcb-card-wait'),
        onClick: function(){
          var s = tcbState;
          if(!s || s.busy || s.finished || s.turn !== 'me' || s.phase !== 'play') return;
          if(s.sel === ci){ tcbHumanPlay(ci); return; }
          s.sel = ci;
          s.message = null;
          if(s.selBoost && !tcbBoostAllowed(s, ci, s.selBoost)){
            s.message = 'このカードは' + TCB_BOOST_NAME[s.selBoost] + 'できないので、強化を「なし」にしました。';
            s.selBoost = null;
          }
          renderBoard();
        }
      });
      item.appendChild(el);
      if(card.faces.length > 1){
        var ctl = document.createElement('div');
        ctl.className = 'dameke-tcb-face-ctl';
        if(card.typeChoice || card.liberoChoice){
          // アルセウス・シルヴァディ・リベロ等はタイプを選ぶ(数が多いので一覧から)
          var sel = document.createElement('select');
          sel.className = 'dameke-tcb-face-select';
          sel.setAttribute('aria-label', 'タイプを選ぶ');
          card.faces.forEach(function(f, fi){
            var o = document.createElement('option');
            o.value = String(fi);
            var fm = /^[^（(]+[（(](.*)[)）]$/.exec(f.name);
            o.textContent = f.typeChoice || f.libero ? f.types[0] : (fm ? fm[1] : f.name);
            sel.appendChild(o);
          });
          sel.value = String(st.handFace[ci] || 0);
          sel.addEventListener('change', function(){ tcbState.handFace[ci] = +sel.value; renderBoard(); renderPool(); });
          ctl.appendChild(sel);
        } else {
          // フォルムチェンジ: 押すたびに次の姿へ(最後の次は最初)
          var cur = st.handFace[ci] || 0;
          var fc = document.createElement('button');
          fc.type = 'button';
          fc.className = 'dameke-tcb-face-btn dameke-tcb-face-cycle';
          fc.title = 'フォルムチェンジ';
          fc.setAttribute('aria-label', 'フォルムチェンジ(' + (cur + 1) + '/' + card.faces.length + ')');
          fc.innerHTML = TCB_CYCLE_ICON + '<span class="dameke-tcb-face-count">' + (cur + 1) + '/' + card.faces.length + '</span>';
          fc.addEventListener('click', function(){
            if(!tcbState) return;
            tcbState.handFace[ci] = ((tcbState.handFace[ci] || 0) + 1) % card.faces.length;
            renderBoard(); renderPool();
          });
          ctl.appendChild(fc);
        }
        var info = document.createElement('button');
        info.type = 'button';
        info.className = 'dameke-tcb-face-btn dameke-tcb-face-info';
        info.textContent = '詳細';
        info.setAttribute('aria-label', (card.faces[0].img || card.faces[0].name) + 'の姿の詳細');
        info.addEventListener('click', function(){
          tcbShowFaces(tcbState, ci, function(fi){
            if(!tcbState || tcbState.hands.me.indexOf(ci) < 0) return;
            tcbState.handFace[ci] = fi; renderBoard(); renderPool();
          });
        });
        ctl.appendChild(info);
        item.appendChild(ctl);
      }
      return item;
    }

    // マリガン中の手札: 押して選び、もう一度押すと戻す(出すときと同じ操作)。姿の切り替えは出す時と同じく下のボタン。
    function buildMullHandItem(ci, item){
      var st = tcbState;
      var selected = st.sel === ci;
      var el = tcbBuildCard(st, ci, {
        size: 'm', faceIdx: st.handFace[ci] || 0, showAlt: true,
        label: selected ? '戻す' : null, labelCls: 'dameke-tcb-label-play dameke-tcb-label-mull',
        cls: selected ? 'dameke-tcb-card-selected dameke-tcb-card-mull' : '',
        onClick: function(){
          var s = tcbState;
          if(!s || s.busy || s.phase !== 'mull' || s.mullWho !== 'me') return;
          if(s.sel === ci){ tcbHumanMull(ci); return; }
          s.sel = ci;
          renderBoard();
        }
      });
      item.appendChild(el);
      return item;
    }
    function buildMullControls(myMull){
      var st = tcbState;
      var box = document.createElement('div');
      box.className = 'dameke-tcb-actions';
      var row = document.createElement('div');
      row.className = 'dameke-tcb-action-row dameke-tcb-mull-row';
      var lab = document.createElement('span');
      lab.className = 'dameke-tcb-action-label';
      lab.textContent = 'マリガン';
      row.appendChild(lab);
      if(myMull){
        var skip = document.createElement('button');
        skip.type = 'button';
        skip.className = 'dameke-search-add-btn dameke-tcb-mull-skip';
        skip.textContent = 'マリガンしない';
        skip.addEventListener('click', function(){ tcbHumanMull(null); });
        row.appendChild(skip);
      }
      var note = document.createElement('span');
      note.className = 'dameke-tcb-note-inline';
      note.textContent = '後攻→先攻の順に1回ずつ。戻した札・引いた札は相手にも公開されます。';
      row.appendChild(note);
      box.appendChild(row);
      return box;
    }

    function buildControls(myTurn){
      var st = tcbState;
      var box = document.createElement('div');
      box.className = 'dameke-tcb-actions';
      var boostRow = document.createElement('div');
      boostRow.className = 'dameke-tcb-action-row';
      var bl = document.createElement('span');
      bl.className = 'dameke-tcb-action-label';
      bl.textContent = '強化';
      boostRow.appendChild(bl);
      if(st.boost.me){
        var used = document.createElement('span');
        used.className = 'dameke-tcb-note-inline';
        used.textContent = TCB_BOOST_NAME[st.boost.me] + 'を使ったので、もう使えません';
        boostRow.appendChild(used);
      } else {
        [[null, 'なし'], ['Z', 'Zワザ（×2）'], ['D', 'ダイマックス（×1.5・次に受ける点が半分）'], ['T', 'テラスタル（×1.25・テラスタイプになる）']].forEach(function(x){
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'dameke-tcb-choice' + (st.selBoost === x[0] ? ' dameke-tcb-choice-active' + (x[0] ? ' dameke-tcb-choice-boost-' + x[0] : '') : '');
          b.textContent = x[1];
          b.setAttribute('aria-pressed', st.selBoost === x[0] ? 'true' : 'false');
          // 選んでいるカードが使えない強化(テラスタル不可・ダイマックス不可)は押せない
          if(st.sel != null && !tcbBoostAllowed(st, st.sel, x[0])){ b.disabled = true; b.title = 'このカードは' + TCB_BOOST_NAME[x[0]] + 'できません'; }
          b.addEventListener('click', function(){ if(tcbState.busy) return; tcbState.selBoost = x[0]; renderBoard(); });
          boostRow.appendChild(b);
        });
      }
      box.appendChild(boostRow);
      return box;
    }

    function renderPool(){
      var st = tcbState;
      poolSec.innerHTML = '';
      poolSec.hidden = !st;
      if(!st) return;
      var head = document.createElement('div');
      head.className = 'dameke-tcb-section-head';
      head.textContent = '今回のカード（' + TCB_POOL + '枚）';
      poolSec.appendChild(head);
      var legend = document.createElement('div');
      legend.className = 'dameke-tcb-legend';
      [['dameke-tcb-st-mine', 'あなたの手札'], ['dameke-tcb-st-field', '場札'], ['dameke-tcb-st-opp', 'CPUの手札(公開)'], ['', '不明'], ['dameke-tcb-st-deck', '山札'], ['dameke-tcb-st-used', '使用済']].forEach(function(x){
        var s = document.createElement('span'); s.className = 'dameke-tcb-legend-item ' + x[0]; s.textContent = x[1]; legend.appendChild(s);
      });
      poolSec.appendChild(legend);
      var grid = document.createElement('div');
      grid.className = 'dameke-tcb-pool';
      var mine = Object.create(null);
      st.hands.me.forEach(function(i){ mine[i] = true; });
      var reveal = st.finished;
      // 出したカード・場札は出したときの姿、自分の手札は選んでいる姿で出す
      var faceOf = Object.create(null);
      st.log.forEach(function(e){ faceOf[st.faces[e.face].card] = e.face; });
      faceOf[st.field.card] = st.field.face;
      // グループごとに並べる: 手札 → 場 → CPUの手札(公開) → 不明(相手の手札か山札) → 山札 → 使用済(出した順)
      var playOrder = Object.create(null);
      st.log.forEach(function(e, i){ playOrder[st.faces[e.face].card] = i + 1; });
      var items = st.cards.map(function(_, ci){
        var label = null, cls = '', group = 2, sub = ci;
        if(ci === st.field.card){ label = '場'; cls = 'dameke-tcb-st-field'; group = 1; }
        else if(st.used[ci]){
          // 最初の場札は「使用済」、出したカードは誰が出したか
          label = st.used[ci] === 'me' ? 'あなた' : (st.used[ci] === 'cpu' ? 'CPU' : '使用済');
          cls = 'dameke-tcb-st-used dameke-tcb-st-used-' + st.used[ci]; group = 4; sub = playOrder[ci] || 0;
        }
        else if(mine[ci]){ label = '手札'; cls = 'dameke-tcb-st-mine'; group = 0; sub = st.hands.me.indexOf(ci); }
        else if(st.hands.cpu.indexOf(ci) >= 0 && st.pubHand.cpu.indexOf(ci) >= 0){ label = 'CPU'; cls = 'dameke-tcb-st-opp'; group = 1.5; }
        else if(st.knownDeck[ci] || (reveal && st.deck.indexOf(ci) >= 0)){ label = '山札'; cls = 'dameke-tcb-st-deck'; group = 3; }
        return { ci: ci, label: label, cls: cls, group: group, sub: sub };
      }).sort(function(a, b){ return a.group - b.group || a.sub - b.sub; });
      items.forEach(function(it){
        var ci = it.ci, label = it.label, cls = it.cls;
        var opts = { size: 's', label: label, cls: cls, showAlt: true };
        if(st.cards[ci].faces.length > 1) opts.onClick = function(){ tcbShowFaces(tcbState, ci, null); };
        if(faceOf[ci] != null) opts.faceId = faceOf[ci];
        else if(mine[ci]) opts.faceIdx = st.handFace[ci] || 0;
        grid.appendChild(tcbBuildCard(st, ci, opts));
      });
      poolSec.appendChild(grid);
      var note = document.createElement('p');
      note.className = 'dameke-tcb-note';
      note.textContent = '「姿」「タイプ」の付いたカードは、出すときに姿を選べます(押すと、選べる姿の一覧が出ます)。';
      poolSec.appendChild(note);
    }

    function renderLog(){
      var st = tcbState;
      logFold.fold.hidden = !st;
      logFold.body.innerHTML = '';
      if(!st) return;
      st.mullLog.forEach(function(m){
        var d = document.createElement('div');
        d.className = 'dameke-tcb-log-mull';
        d.textContent = 'マリガン(' + (m.who === 'me' ? 'あなた' : 'CPU') + ')：' + (m.out == null ? 'しない' : st.cards[m.out].faces[0].name + ' を戻して ' + st.cards[m.drew].faces[0].name + ' を引いた');
        logFold.body.appendChild(d);
      });
      if(!st.log.length){ var e = document.createElement('div'); e.className = 'dameke-tcb-empty'; e.textContent = 'まだカードは出ていません。'; logFold.body.appendChild(e); return; }
      var list = document.createElement('ol');
      list.className = 'dameke-tcb-log';
      st.log.forEach(function(e){
        var li = document.createElement('li');
        li.className = 'dameke-tcb-log-' + e.who;
        li.textContent = (e.who === 'me' ? 'あなた　' : 'CPU　') + tcbLogText(st, e);
        list.appendChild(li);
      });
      logFold.body.appendChild(list);
    }

    function renderAbil(){
      abilFold.body.innerHTML = '';
      abilFold.body.appendChild(tcbBuildAbilityList(tcbState));
    }

    function renderAll(){
      quitBtn.hidden = !tcbState;
      renderBoard(); renderPool(); renderLog(); renderAbil();
    }

    tcbUI = { wrap: wrap, renderAll: renderAll };
    renderAll();
    // 別のゲームから戻ったとき: 演出中だったものは飛ばして続きから。
    var st0 = tcbState;
    if(st0 && !st0.finished && !st0.busy){
      if(st0.phase === 'mull'){ if(st0.mullWho === 'cpu') tcbNextMull(st0); }
      else if(st0.turn === 'cpu') tcbScheduleCpu();
    }
  }
})();
