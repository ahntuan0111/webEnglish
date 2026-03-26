/* =====================================================
   APP.JS — VocabBlast Core Logic (v2 — Two Tabs)
   Tab 1 (Học):     Multiple Choice A/B/C/D
   Tab 2 (Kiểm tra): Input + Scramble xen kẽ ngẫu nhiên
   ===================================================== */

// ── State ──────────────────────────────────────────────
let deckLearn = [];      // deck cho tab Học (MC)
let deckTest  = [];      // deck cho tab Kiểm tra (Input+Scramble)
let currentIndex = 0;
let score = 0;
let currentTab = 'learn'; // 'learn' | 'test'

// scramble
let assembled = [];
let tileOrder = [];
let skipTimer = null;

// ── DOM refs ───────────────────────────────────────────
const screenIntro     = document.getElementById('screen-intro');
const screenQuiz      = document.getElementById('screen-quiz');
const screenResult    = document.getElementById('screen-result');

const totalCountEl    = document.getElementById('total-count');
const progressText    = document.getElementById('progress-text');
const progressFill    = document.getElementById('progress-fill');
const modeBadge       = document.getElementById('mode-badge');
const meaningDisplay  = document.getElementById('meaning-display');
const questionLabel   = document.getElementById('question-label');
const scoreVal        = document.getElementById('score-val');

const modeMC          = document.getElementById('mode-mc');
const modeInput       = document.getElementById('mode-input');
const modeScramble    = document.getElementById('mode-scramble');

const mcOptions       = document.getElementById('mc-options');
const mcFeedback      = document.getElementById('mc-feedback');

const feedbackMsg     = document.getElementById('feedback-msg');
const wordInput       = document.getElementById('word-input');
const assembledSlots  = document.getElementById('assembled-slots');
const scrambleTiles   = document.getElementById('scramble-tiles');
const scrambleFeedback = document.getElementById('scramble-feedback');

// ── Button listeners ───────────────────────────────────
document.getElementById('btn-start').addEventListener('click', startQuiz);
document.getElementById('btn-check').addEventListener('click', checkInput);
document.getElementById('btn-skip-mc').addEventListener('click', () => skipCurrent());
document.getElementById('btn-skip-input').addEventListener('click', () => skipCurrent());
document.getElementById('btn-skip-scramble').addEventListener('click', () => skipCurrent());
document.getElementById('btn-restart').addEventListener('click', startQuiz);
wordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') checkInput(); });

// ── Utility: Fisher-Yates Shuffle ──────────────────────
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Tab switching ──────────────────────────────────────
function switchTab(tab) {
  if (tab === currentTab) return;
  currentTab = tab;

  document.getElementById('tab-learn').classList.toggle('active', tab === 'learn');
  document.getElementById('tab-test').classList.toggle('active', tab === 'test');

  // Reset và chơi lại tab mới
  currentIndex = 0;
  score = 0;
  clearSkipTimer();
  renderQuestion();
}

// ── Screen helpers ─────────────────────────────────────
function showScreen(screen) {
  [screenIntro, screenQuiz, screenResult].forEach(s => s.classList.remove('active'));
  screen.classList.add('active');
}

// ── Start / Restart ────────────────────────────────────
function startQuiz() {
  const shuffled = shuffleArray(vocabularies);

  // Deck Học — mỗi từ là Multiple Choice
  deckLearn = shuffled.map(v => ({ ...v, mode: 'mc' }));

  // Deck Kiểm tra — mỗi từ ngẫu nhiên input hoặc scramble
  deckTest = shuffleArray(vocabularies).map(v => ({
    ...v,
    mode: Math.random() < 0.5 ? 'input' : 'scramble'
  }));

  currentIndex = 0;
  score = 0;
  currentTab = 'learn';

  document.getElementById('tab-learn').classList.add('active');
  document.getElementById('tab-test').classList.remove('active');

  totalCountEl.textContent = vocabularies.length;
  showScreen(screenQuiz);
  renderQuestion();
}

// ── Get active deck ────────────────────────────────────
function getDeck() {
  return currentTab === 'learn' ? deckLearn : deckTest;
}

// ── Render câu hỏi ─────────────────────────────────────
function renderQuestion() {
  clearSkipTimer();
  const deck = getDeck();
  const item = deck[currentIndex];

  progressText.textContent = `${currentIndex + 1} / ${deck.length}`;
  progressFill.style.width = `${(currentIndex / deck.length) * 100}%`;

  clearAllFeedback();

  if (item.mode === 'mc') {
    showMCMode(item);
  } else if (item.mode === 'input') {
    showInputMode(item);
  } else {
    showScrambleMode(item.word);
  }
}

// ── Clear all feedback/state ───────────────────────────
function clearAllFeedback() {
  setFeedback(mcFeedback, '', '');
  setFeedback(feedbackMsg, '', '');
  setFeedback(scrambleFeedback, '', '');
  wordInput.className = 'word-input';
  wordInput.value = '';
  assembledSlots.className = 'assembled-slots';
}

// ══════════════════════════════════════════════════════════
//  TAB 1 — MULTIPLE CHOICE
// ══════════════════════════════════════════════════════════

function showMCMode(item) {
  modeMC.classList.remove('hidden');
  modeInput.classList.add('hidden');
  modeScramble.classList.add('hidden');

  modeBadge.textContent = '🔠 Trắc Nghiệm';
  modeBadge.className = 'mode-badge mc-mode';

  // Hiển thị NGHĨA → đoán từ tiếng Anh
  questionLabel.textContent = 'Nghĩa của từ';
  meaningDisplay.textContent = item.meaning;

  // Tạo 4 đáp án: 1 đúng + 3 sai ngẫu nhiên
  const options = buildMCOptions(item);
  renderMCButtons(options, item.word);
}

function buildMCOptions(correctItem) {
  const correct = { word: correctItem.word, isCorrect: true };

  // Lấy 3 từ sai ngẫu nhiên, khác từ đúng
  const wrongs = shuffleArray(
    vocabularies.filter(v => v.word !== correctItem.word)
  ).slice(0, 3).map(v => ({ word: v.word, isCorrect: false }));

  return shuffleArray([correct, ...wrongs]);
}

function renderMCButtons(options, correctWord) {
  const labels = ['A', 'B', 'C', 'D'];
  mcOptions.innerHTML = '';

  options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'mc-option';
    btn.innerHTML = `<span class="mc-label">${labels[idx]}</span> ${opt.word}`;
    btn.addEventListener('click', () => handleMCAnswer(btn, opt.isCorrect, correctWord, options));
    mcOptions.appendChild(btn);
  });
}

function handleMCAnswer(clickedBtn, isCorrect, correctWord, options) {
  // Disable all buttons
  mcOptions.querySelectorAll('.mc-option').forEach(b => (b.disabled = true));

  // Highlight correct answer green anyway
  mcOptions.querySelectorAll('.mc-option').forEach(b => {
    if (b.textContent.trim().slice(1).trim() === correctWord) {
      b.classList.add('correct');
    }
  });

  if (isCorrect) {
    clickedBtn.classList.add('correct');
    setFeedback(mcFeedback, '✅ Chính xác! +10 điểm', 'correct');
    score += 10;
    setTimeout(nextQuestion, 900);
  } else {
    clickedBtn.classList.add('wrong');
    setFeedback(mcFeedback, `❌ Sai! Đáp án đúng: ${correctWord}`, 'wrong');
    setTimeout(nextQuestion, 1400);
  }
}

// ══════════════════════════════════════════════════════════
//  TAB 2 — INPUT (Gõ từ)
// ══════════════════════════════════════════════════════════

function showInputMode(item) {
  modeMC.classList.add('hidden');
  modeInput.classList.remove('hidden');
  modeScramble.classList.add('hidden');

  modeBadge.textContent = '⌨️ Gõ Từ';
  modeBadge.className = 'mode-badge';

  questionLabel.textContent = 'Nghĩa của từ';
  meaningDisplay.textContent = item.meaning;
  wordInput.focus();
}

function checkInput() {
  clearSkipTimer();
  const deck = getDeck();
  const item = deck[currentIndex];
  const guess = wordInput.value.trim().toUpperCase();
  const answer = item.word.toUpperCase();

  if (!guess) return;

  if (guess === answer) {
    wordInput.className = 'word-input success';
    setFeedback(feedbackMsg, '✅ Chính xác! +10 điểm', 'correct');
    score += 10;
    setTimeout(nextQuestion, 900);
  } else {
    wordInput.className = 'word-input error';
    setFeedback(feedbackMsg, '❌ Sai rồi, thử lại nhé!', 'wrong');
    setTimeout(() => {
      wordInput.className = 'word-input';
      wordInput.select();
    }, 600);
  }
}

// ══════════════════════════════════════════════════════════
//  TAB 2 — SCRAMBLE (Ghép chữ cái)
// ══════════════════════════════════════════════════════════

function showScrambleMode(word) {
  modeMC.classList.add('hidden');
  modeInput.classList.add('hidden');
  modeScramble.classList.remove('hidden');

  modeBadge.textContent = '🔀 Ghép Chữ';
  modeBadge.className = 'mode-badge scramble-mode';

  const deck = getDeck();
  questionLabel.textContent = 'Nghĩa của từ';
  meaningDisplay.textContent = deck[currentIndex].meaning;

  assembled = [];
  const chars = word.toUpperCase().split('');
  tileOrder = shuffleArray(chars.map((c, i) => ({ char: c, idx: i })));

  // Đảm bảo không giống thứ tự gốc
  if (tileOrder.map(t => t.char).join('') === word.toUpperCase() && word.length > 1) {
    const first = tileOrder.shift();
    tileOrder.push(first);
  }

  renderAssembled();
  renderTiles();
  assembledSlots.className = 'assembled-slots';
}

function renderAssembled() {
  assembledSlots.innerHTML = '';
  if (assembled.length === 0) {
    assembledSlots.innerHTML = '<p style="color:rgba(255,255,255,0.2);font-size:0.8rem;margin:auto">Nhấp chữ cái để ghép từ 👇</p>';
    return;
  }
  assembled.forEach((tile, pos) => {
    const el = document.createElement('div');
    el.className = 'slot-tile';
    el.textContent = tile.char;
    el.title = 'Nhấp để xoá';
    el.addEventListener('click', () => removeFromAssembled(pos));
    assembledSlots.appendChild(el);
  });
}

function renderTiles() {
  scrambleTiles.innerHTML = '';
  tileOrder.forEach((tile, i) => {
    const el = document.createElement('div');
    el.className = 'char-tile' + (tile.used ? ' used' : '');
    el.textContent = tile.char;
    if (!tile.used) el.addEventListener('click', () => addToAssembled(i));
    scrambleTiles.appendChild(el);
  });
}

function addToAssembled(tileIdx) {
  const tile = tileOrder[tileIdx];
  if (tile.used) return;
  tile.used = true;
  assembled.push({ char: tile.char, tileIdx });
  renderAssembled();
  renderTiles();
  if (assembled.length === tileOrder.length) checkScramble();
}

function removeFromAssembled(pos) {
  const tile = assembled.splice(pos, 1)[0];
  tileOrder[tile.tileIdx].used = false;
  setFeedback(scrambleFeedback, '', '');
  assembledSlots.className = 'assembled-slots';
  renderAssembled();
  renderTiles();
}

function checkScramble() {
  clearSkipTimer();
  const deck = getDeck();
  const answer = deck[currentIndex].word.toUpperCase();
  const guess = assembled.map(t => t.char).join('');

  if (guess === answer) {
    assembledSlots.className = 'assembled-slots success-border';
    setFeedback(scrambleFeedback, '✅ Chính xác! +10 điểm', 'correct');
    score += 10;
    setTimeout(nextQuestion, 900);
  } else {
    assembledSlots.className = 'assembled-slots error-border';
    setFeedback(scrambleFeedback, '❌ Sai! Nhấp chữ để xoá và thử lại.', 'wrong');
    setTimeout(() => { assembledSlots.className = 'assembled-slots'; }, 700);
  }
}

// ── Skip ───────────────────────────────────────────────
function skipCurrent() {
  clearSkipTimer();
  const deck = getDeck();
  const item = deck[currentIndex];

  if (item.mode === 'mc') {
    // Highlight đáp án đúng và chuyển
    mcOptions.querySelectorAll('.mc-option').forEach(b => {
      b.disabled = true;
      if (b.textContent.trim().slice(1).trim() === item.word) b.classList.add('correct');
    });
    setFeedback(mcFeedback, `💡 Đáp án: ${item.word}`, 'reveal');
  } else if (item.mode === 'input') {
    wordInput.value = item.word;
    setFeedback(feedbackMsg, `💡 Đáp án: ${item.word}`, 'reveal');
  } else {
    setFeedback(scrambleFeedback, `💡 Đáp án: ${item.word}`, 'reveal');
  }

  skipTimer = setTimeout(nextQuestion, 2000);
}

function clearSkipTimer() {
  if (skipTimer) { clearTimeout(skipTimer); skipTimer = null; }
}

// ── Next / Finish ──────────────────────────────────────
function nextQuestion() {
  clearSkipTimer();
  currentIndex++;
  if (currentIndex >= getDeck().length) {
    finishQuiz();
  } else {
    renderQuestion();
  }
}

function finishQuiz() {
  progressFill.style.width = '100%';
  scoreVal.textContent = score;
  const maxScore = getDeck().length * 10;
  document.querySelector('.result-sub').textContent =
    `Bạn đạt ${score}/${maxScore} điểm. Hãy thử tab còn lại nhé!`;
  showScreen(screenResult);
}

// ── Helpers ────────────────────────────────────────────
function setFeedback(el, msg, type) {
  el.textContent = msg;
  el.className = 'feedback-msg' + (type ? ' ' + type : '');
}

// ── Boot ───────────────────────────────────────────────
totalCountEl.textContent = vocabularies.length;
