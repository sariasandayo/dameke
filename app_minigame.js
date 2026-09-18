// v2.2.0 ミニゲーム
// ハンバーガーメニュー最下部の「ミニゲーム」パネル。内部にゲーム切り替えの枠組みを持ち、
// 現時点では「ポケモンWordle」のみを収録するが、今後別のミニゲームを追加できるよう、
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

  // ==================== ゲーム切り替えの枠組み ====================
  var GAMES = [
    { id: 'wordle', label: 'ポケモンWordle', render: renderWordleGame },
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

  // ==================== ポケモンWordle ====================
  var WORD_LENGTH = 5;
  var MAX_TRIES = 10;

  // ---- 候補リスト(括弧書きを除いて重複をなくした、ちょうど5文字のポケモン名)を
  //      1度だけ計算してキャッシュする ----
  var candidatesCache = null;
  function getCandidates(){
    if(candidatesCache) return candidatesCache;
    var seen = Object.create(null);
    var out = [];
    (DATA.pokemons || []).forEach(function(p){
      var stripped = stripParens(p.name);
      if(Array.from(stripped).length !== WORD_LENGTH) return;
      if(seen[stripped]) return;
      seen[stripped] = true;
      out.push(stripped);
    });
    out.sort(function(a,b){ return a.localeCompare(b, 'ja'); });
    candidatesCache = out;
    return out;
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
    getCandidates().forEach(function(n){ Array.from(n).forEach(function(c){ set[c] = true; }); });
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

  // ---- 判定ロジック(標準的なWordleのアルゴリズム) ----
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

  var wordleState = null;
  function newWordleGame(){
    var cands = getCandidates();
    var answer = cands[Math.floor(Math.random() * cands.length)];
    wordleState = { answer: answer, guesses: [], finished: false, won: false, charStatus: Object.create(null) };
  }

  function updateCharStatus(word, colors){
    var rank = { gray: 0, yellow: 1, green: 2 };
    Array.from(word).forEach(function(c, i){
      var cur = wordleState.charStatus[c];
      var next = colors[i];
      if(!cur || rank[next] > rank[cur]) wordleState.charStatus[c] = next;
    });
  }

  function renderWordleGame(host){
    if(!wordleState) newWordleGame();

    var wrap = document.createElement('div');
    wrap.className = 'dameke-wordle-wrap';

    var title = document.createElement('h3');
    title.className = 'dameke-wordle-title';
    title.textContent = 'ポケモンWordle';
    wrap.appendChild(title);

    var rulesFold = document.createElement('details');
    rulesFold.className = 'dameke-pokemon-edit-levelfold dameke-wordle-rules-fold';
    var rulesSummary = document.createElement('summary');
    rulesSummary.textContent = 'ルール';
    rulesFold.appendChild(rulesSummary);
    var rulesBody = document.createElement('div');
    rulesBody.className = 'dameke-wordle-rules-body';
    rulesBody.innerHTML =
      '<p>括弧書きのフォルム名等を除いた、ちょうど5文字のポケモン名が答えです。</p>' +
      '<p>ひらがな・カタカナ、半角・全角のどれで入力しても構いません。' + MAX_TRIES + '回以内に当ててください。</p>' +
      '<p>決定すると、1文字ごとに背景色が変わります。<br>' +
      '緑：位置・文字とも正解と一致　黄：文字は正解に含まれるが位置が違う　灰：正解に含まれない</p>' +
      '<p>正解・入力どちらかに同じ文字が複数ある場合は、緑判定を優先したうえで、位置が先頭に近い方から黄色が付きます。</p>';
    rulesFold.appendChild(rulesBody);
    wrap.appendChild(rulesFold);

    var actionsRow = document.createElement('div');
    actionsRow.className = 'dameke-wordle-actions';
    var giveUpBtn = document.createElement('button');
    giveUpBtn.type = 'button';
    giveUpBtn.className = 'dameke-search-add-btn dameke-wordle-giveup-btn';
    giveUpBtn.textContent = 'ギブアップ';
    actionsRow.appendChild(giveUpBtn);
    wrap.appendChild(actionsRow);

    var messageHost = document.createElement('div');
    messageHost.className = 'dameke-wordle-message';
    wrap.appendChild(messageHost);

    var boardRow = document.createElement('div');
    boardRow.className = 'dameke-wordle-board-row';
    wrap.appendChild(boardRow);

    var rowsHost = document.createElement('div');
    rowsHost.className = 'dameke-wordle-rows';
    boardRow.appendChild(rowsHost);

    var hintSection = document.createElement('div');
    hintSection.className = 'dameke-wordle-hint-section';
    var hintTitle = document.createElement('div');
    hintTitle.className = 'dameke-adjust-nature-title';
    hintTitle.textContent = '使った文字';
    hintSection.appendChild(hintTitle);
    var hintHost = document.createElement('div');
    hintHost.className = 'dameke-wordle-hint-table';
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
        rowEl.className = 'dameke-wordle-hint-row';
        row.forEach(function(c){
          var cell = document.createElement('span');
          cell.className = 'dameke-wordle-hint-cell';
          if(!c || !usedChars[c]){ cell.classList.add('dameke-wordle-hint-cell-empty'); rowEl.appendChild(cell); return; }
          var status = wordleState.charStatus[c];
          if(status) cell.classList.add('dameke-wordle-cell-' + status);
          cell.textContent = c;
          rowEl.appendChild(cell);
        });
        hintHost.appendChild(rowEl);
      });
    }

    function appendRetryButton(){
      var retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'dameke-search-add-btn dameke-wordle-retry-btn';
      retryBtn.textContent = 'リトライ';
      retryBtn.addEventListener('click', function(){
        newWordleGame();
        giveUpBtn.hidden = false;
        renderRows();
        renderHintTable();
        renderMessage();
      });
      messageHost.appendChild(retryBtn);
    }

    function renderMessage(){
      messageHost.innerHTML = '';
      if(wordleState.won){
        appendRetryButton();
      } else if(wordleState.finished){
        var lose = document.createElement('div');
        lose.className = 'dameke-wordle-lose-banner';
        lose.textContent = '正解は「' + wordleState.answer + '」でした。';
        messageHost.appendChild(lose);
        appendRetryButton();
      }
    }

    function buildResultRow(word, colors){
      var row = document.createElement('div');
      row.className = 'dameke-wordle-row dameke-wordle-row-result';
      var imgWrap = document.createElement('span');
      imgWrap.className = 'dameke-wordle-row-thumb';
      var pokemon = findPokemonForWord(word);
      var img = (pokemon && window.__damekeBuildPokemonImage)
        ? window.__damekeBuildPokemonImage(pokemon.name, function(){ imgWrap.classList.add('dameke-wordle-row-thumb-missing'); imgWrap.innerHTML = ''; })
        : null;
      if(img) imgWrap.appendChild(img); else imgWrap.classList.add('dameke-wordle-row-thumb-missing');
      row.appendChild(imgWrap);
      var lettersWrap = document.createElement('div');
      lettersWrap.className = 'dameke-wordle-letters';
      Array.from(word).forEach(function(ch, i){
        var box = document.createElement('span');
        box.className = 'dameke-wordle-letter-box dameke-wordle-cell-' + colors[i];
        box.textContent = ch;
        lettersWrap.appendChild(box);
      });
      row.appendChild(lettersWrap);
      // 正解した行(全マス緑)には、正解の解答の横に小さく「正解！」を添える
      // (決定ボタンと同程度の大きさ。以前あった大きなメッセージ枠の代わり)。
      if(colors.every(function(c){ return c === 'green'; })){
        var correctLabel = document.createElement('span');
        correctLabel.className = 'dameke-search-add-btn dameke-wordle-correct-label';
        correctLabel.textContent = '正解！';
        row.appendChild(correctLabel);
      }
      return row;
    }

    var guessError = null; // 直近の入力エラーメッセージ(あれば)

    function buildInputRow(active){
      var row = document.createElement('div');
      row.className = 'dameke-wordle-row dameke-wordle-row-input' + (active ? '' : ' dameke-wordle-row-input-inactive');
      var input = document.createElement('input');
      input.type = 'text';
      input.className = 'dameke-wordle-text-input';
      input.placeholder = 'ポケモン名';
      input.disabled = !active;
      row.appendChild(input);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dameke-search-add-btn dameke-wordle-submit-btn';
      btn.textContent = '決定';
      btn.disabled = !active;
      if(active){
        function doSubmit(){ submitGuess(input.value); }
        btn.addEventListener('click', doSubmit);
        input.addEventListener('keydown', function(e){ if(e.key === 'Enter') doSubmit(); });
      }
      row.appendChild(btn);
      if(active && guessError){
        var err = document.createElement('span');
        err.className = 'dameke-wordle-input-error';
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
      if(wordleState.finished) return;
      var normalized = normalizeForMatch(rawInput);
      var match = getCandidates().indexOf(normalized) >= 0 ? normalized : null;
      if(!match){
        guessError = '入力に誤りがあります';
        renderRows();
        return;
      }
      guessError = null;
      var word = match;
      var colors = computeColors(word, wordleState.answer);
      wordleState.guesses.push({ word: word, colors: colors });
      updateCharStatus(word, colors);
      if(colors.every(function(c){ return c === 'green'; })) wordleState.won = true;
      if(wordleState.won || wordleState.guesses.length >= MAX_TRIES) wordleState.finished = true;
      renderRows();
      renderHintTable();
      renderMessage();
      if(wordleState.finished) giveUpBtn.hidden = true;
    }

    function renderRows(){
      rowsHost.innerHTML = '';
      for(var i = 0; i < MAX_TRIES; i++){
        var g = wordleState.guesses[i];
        if(g){ rowsHost.appendChild(buildResultRow(g.word, g.colors)); continue; }
        var isActive = !wordleState.finished && i === wordleState.guesses.length;
        rowsHost.appendChild(buildInputRow(isActive));
      }
    }


    giveUpBtn.addEventListener('click', function(){
      if(wordleState.finished) return;
      wordleState.finished = true;
      renderRows();
      renderMessage();
      giveUpBtn.hidden = true;
    });

    giveUpBtn.hidden = wordleState.finished;
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
    title.className = 'dameke-wordle-title';
    title.textContent = '種族値High&Low';
    wrap.appendChild(title);

    var rulesFold = document.createElement('details');
    rulesFold.className = 'dameke-pokemon-edit-levelfold dameke-wordle-rules-fold';
    var rulesSummary = document.createElement('summary');
    rulesSummary.textContent = 'ルール';
    rulesFold.appendChild(rulesSummary);
    var rulesBody = document.createElement('div');
    rulesBody.className = 'dameke-wordle-rules-body';
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
    messageHost.className = 'dameke-wordle-message dameke-stathl-message';
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
        retryBtn.className = 'dameke-search-add-btn dameke-wordle-retry-btn';
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
        nextBtn.className = 'dameke-search-add-btn dameke-wordle-retry-btn';
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

  // タイプの色付きバッジ表示用(ポケモン管理などと同じ配色。この対応表自体は
  // 各ファイルにそれぞれ持たせる既存の構成に合わせて、ここにも独自に持つ)。
  var STATCHART_TYPE_COLOR_MAP = { 'なし':'none', 'ノーマル':'normal', 'ほのお':'fire', 'みず':'water', 'でんき':'electric', 'くさ':'grass', 'こおり':'ice', 'かくとう':'fighting', 'どく':'poison', 'じめん':'ground', 'ひこう':'flying', 'エスパー':'psychic', 'むし':'bug', 'いわ':'rock', 'ゴースト':'ghost', 'ドラゴン':'dragon', 'あく':'dark', 'はがね':'steel', 'フェアリー':'fairy', 'ステラ':'stellar' };
  function statChartTypeColorClass(t){ return 'dameke-type-' + (STATCHART_TYPE_COLOR_MAP[t] || 'none'); }

  // ---- チャンピオンズ参戦済み判定(ポケモン検索の「チャンピオンズ参戦済のみ」と同じロジック) ----
  function statChartLearnsetKeyFor(name){
    var m = String(name || '').match(/^(.+?)\(([^)]+)\)$/);
    return m ? (m[1] + '_' + m[2]) : name;
  }
  function statChartHasChampionsEntry(p){
    var LS = window.DAMEKE_LEARNSETS;
    if(!LS) return false;
    return LS.hasLearnset(statChartLearnsetKeyFor(p.name));
  }

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
  function findStatChartMatches(target, revealedTypeCount, revealedAbilityCount){
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
    title.className = 'dameke-wordle-title';
    title.textContent = '種族値チャートクイズ';
    wrap.appendChild(title);

    var rulesFold = document.createElement('details');
    rulesFold.className = 'dameke-pokemon-edit-levelfold dameke-wordle-rules-fold';
    var rulesSummary = document.createElement('summary');
    rulesSummary.textContent = 'ルール';
    rulesFold.appendChild(rulesSummary);
    var rulesBody = document.createElement('div');
    rulesBody.className = 'dameke-wordle-rules-body';
    rulesBody.innerHTML =
      '<p>ランダムに抽出されたポケモン1体の種族値(H・A・B・C・D・S)がレーダーチャートで表示されるので、' +
      'ポケモンを当てるゲームです。</p>' +
      '<p>「タイプ」「特性」の各ヒントボタンで、そのポケモンのタイプ・特性を1つずつ確認できます。</p>' +
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
    giveUpBtn.className = 'dameke-search-add-btn dameke-statchart-answer-btn dameke-wordle-giveup-btn';
    giveUpBtn.textContent = 'ギブアップ';

    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'dameke-search-add-btn dameke-statchart-answer-btn dameke-wordle-retry-btn';
    nextBtn.textContent = '次の問題へ';
    nextBtn.addEventListener('click', function(){
      newStatChartQuestion();
      renderAll();
    });

    var messageHost = document.createElement('div');
    messageHost.className = 'dameke-wordle-message dameke-stathl-message';
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
      var matches = findStatChartMatches(target, statChartState.revealedTypeCount, statChartState.revealedAbilityCount);
      var correct = matches.some(function(p){ return p.id === guessed.id; });
      statChartState.answered = true;
      statChartState.correct = correct;
      statChartState.gaveUp = false;
      statChartState.guessName = guessed.name;
      // 決定後は、その回のタイプ・特性ヒントをすべて公開する。
      statChartState.revealedTypeCount = (target.types || []).length;
      statChartState.revealedAbilityCount = (target.abilities || []).length;
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

  function getRandomGenPool(finalOnly, championsOnly, megaOnly, megaExclude, regulations){
    return (DATA.pokemons || []).filter(function(p){
      if(!p.baseStats) return false;
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
  var randomGenCount = 6;
  var randomGenState = null;

  function newRandomGenSet(){
    var pool = getRandomGenPool(randomGenFinalOnly, randomGenChampionsOnly, randomGenMegaOnly, randomGenMegaExclude, randomGenRegulations);
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
    title.className = 'dameke-wordle-title';
    title.textContent = 'ランダムポケモン出力';
    wrap.appendChild(title);

    var rulesFold = document.createElement('details');
    rulesFold.className = 'dameke-pokemon-edit-levelfold dameke-wordle-rules-fold';
    var rulesSummary = document.createElement('summary');
    rulesSummary.textContent = 'このツールについて';
    rulesFold.appendChild(rulesSummary);
    var rulesBody = document.createElement('div');
    rulesBody.className = 'dameke-wordle-rules-body';
    rulesBody.innerHTML =
      '<p>ポケモンをランダムに抽選・表示するツールです。同時に出力されるポケモンは重複しません。' +
      'フォルム違いなども重ならないようにしています。</p>' +
      '<p>各「再抽選」ボタンでは、そのポケモンだけを引き直します。</p>';
    rulesFold.appendChild(rulesBody);
    wrap.appendChild(rulesFold);

    var filterRow = document.createElement('div');
    filterRow.className = 'dameke-stathl-mode-row dameke-search-section-gap';

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

    wrap.appendChild(filterRow);

    // レギュレーション絞り込み(複数選択可。何もチェックしなければ絞り込みなし)。
    var regFold = document.createElement('details');
    regFold.className = 'dameke-pokemon-edit-levelfold';
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
    wrap.appendChild(regFold);

    var countRow = document.createElement('div');
    countRow.className = 'dameke-stathl-mode-row dameke-search-section-gap';
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
})();
