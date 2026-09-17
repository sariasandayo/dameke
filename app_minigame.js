// v1.9.0 ミニゲーム
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
    { id: 'stathl', label: '種族値High&Low', render: renderStatHLGame }
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

  // ---- 括弧が入れ子になっているか(深さ2以上に達するか)を判定する ----
  function hasNestedParens(name){
    var depth = 0, maxDepth = 0;
    Array.from(String(name || '')).forEach(function(c){
      if(c === '(' || c === '（'){ depth++; if(depth > maxDepth) maxDepth = depth; }
      else if(c === ')' || c === '）'){ if(depth > 0) depth--; }
    });
    return maxDepth >= 2;
  }

  // ---- パネル表示用に、名前を1～2行に分割する ----
  // 括弧書きがあれば、その開き括弧の直前で改行する(名前部分と括弧部分の2行)。
  // ただし括弧が入れ子(例:ネクロズマ(たそがれのたてがみ(ウルトラネクロズマ)))の場合は
  // 改行せず1行のまま返す(この1行が両パネル共通の最大幅の基準になる)。
  function formatPanelNameLines(name){
    var s = String(name || '');
    if(hasNestedParens(s)) return [s];
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
    statHLState = { correctCount: 0, streak: 0, wrongCount: 0, finished: false };
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
      '<p>「基準の数値」を「見る」にしていると、基準ポケモンの数値は常に見えており、決定すると予想対象の数値も見えるようになります。' +
      '「隠す」にしていると、決定した後も含めて数値は一切表示されません(正誤の結果だけで進めます)。</p>' +
      '<p>「見る」の場合のみ、「ヒント」を押すと決定前に基準ポケモンの数値だけ先に確認できます。</p>' +
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
    messageHost.className = 'dameke-wordle-message';
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

    // 基準の数値をこのラウンドで見せてよいか(見る/隠すの設定に応じる)
    function computeBaseShow(){
      if(statHLShowMode === 'hide') return false;
      return statHLState.answered || statHLState.hintUsed;
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
      // 最初から常に公開されているため不要、「隠す」モードでは終始非公開のため
      // 意味を持たない。いずれの場合もヒントで先出しする意義がある間(=決定前かつ
      // 未使用)だけ表示する。
      if(statHLShowMode === 'view' && !statHLState.answered){
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
          // 正解肢は選んだかどうかに関わらず常に緑+○で示し、外した場合は自分が
          // 選んだ(不正解の)肢だけ赤+×で示す。
          if(def.key === actual){
            btn.classList.add('dameke-stathl-guess-btn-correct');
            var okMark = document.createElement('span');
            okMark.className = 'dameke-stathl-guess-mark';
            okMark.textContent = '○';
            btn.appendChild(okMark);
          } else if(def.key === statHLState.guess){
            btn.classList.add('dameke-stathl-guess-btn-incorrect');
            var ngMark = document.createElement('span');
            ngMark.className = 'dameke-stathl-guess-mark';
            ngMark.textContent = '×';
            btn.appendChild(ngMark);
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
        over.textContent = 'ゲームオーバー：正解数' + statHLState.correctCount + '、最終連続正解' + statHLState.streak;
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
})();
