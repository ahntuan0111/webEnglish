/* =====================================================
   APP.JS — VocabBlast Core Logic
   ===================================================== */

// ── State ──────────────────────────────────────────────
let deck = [];           // danh sách từ đã shuffle
let currentIndex = 0;   // vị trí câu hỏi hiện tại
let score = 0;          // điểm tích luỹ
let assembled = [];      // mảng chữ đã ghép (mode 2)
let tileOrder = [];      // chỉ số tile gốc đã xáo trộn (mode 2)
let skipTimer = null;    // Timer cho nút Skip

// ── DOM refs ───────────────────────────────────────────
const screenIntro    = document.getElementById('screen-intro');
const screenQuiz     = document.getElementById('screen-quiz');
const screenResult   = document.getElementById('screen-result');

const totalCountEl   = document.getElementById('total-count');
const progressText   = document.getElementById('progress-text');
const progressFill   = document.getElementById('progress-fill');
const modeBadge      = document.getElementById('mode-badge');
const meaningDisplay = document.getElementById('meaning-display');
const feedbackMsg    = document.getElementById('feedback-msg');
const scrambleFeedback = document.getElementById('scramble-feedback');
const scoreVal       = document.getElementById('score-val');

const modeInput      = document.getElementById('mode-input');
const modeScramble   = document.getElementById('mode-scramble');

const wordInput      = document.getElementById('word-input');
const assembledSlots = document.getElementById('assembled-slots');
const scrambleTiles  = document.getElementById('scramble-tiles');

// ── Buttons ────────────────────────────────────────────
document.getElementById('btn-start').addEventListener('click', startQuiz);
document.getElementById('btn-check').addEventListener('click', checkInput);
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

// ── Utility: Switch screens ────────────────────────────
function showScreen(screen) {
  [screenIntro, screenQuiz, screenResult].forEach(s => s.classList.remove('active'));
  screen.classList.add('active');
}

// ── Init & start ───────────────────────────────────────
function startQuiz() {
  deck = shuffleArray(vocabularies).map(v => ({
    ...v,
    // Mỗi từ ngẫu nhiên chọn 1 trong 2 chế độ
    mode: Math.random() < 0.5 ? 'input' : 'scramble'
  }));
  currentIndex = 0;
  score = 0;
  totalCountEl.textContent = vocabularies.length;
  showScreen(screenQuiz);
  renderQuestion();
}

// ── Render câu hỏi hiện tại ────────────────────────────
function renderQuestion() {
  clearSkipTimer();
  const item = deck[currentIndex];

  // Progress bar
  progressText.textContent = `${currentIndex + 1} / ${deck.length}`;
  progressFill.style.width = `${(currentIndex / deck.length) * 100}%`;

  // Meaning
  meaningDisplay.textContent = item.meaning;

  // Feedback clear
  setFeedback(feedbackMsg, '', '');
  setFeedback(scrambleFeedback, '', '');

  if (item.mode === 'input') {
    showInputMode();
  } else {
    showScrambleMode(item.word);
  }
}

// ── Mode 1: Input ──────────────────────────────────────
function showInputMode() {
  modeScramble.classList.add('hidden');
  modeInput.classList.remove('hidden');

  modeBadge.textContent = '⌨️ Gõ Từ';
  modeBadge.className = 'mode-badge';

  wordInput.value = '';
  wordInput.className = 'word-input';
  wordInput.focus();
}

function checkInput() {
  clearSkipTimer();
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
    setTimeout(() => { wordInput.className = 'word-input'; wordInput.select(); }, 600);
  }
}

// ── Mode 2: Scramble ───────────────────────────────────
function showScrambleMode(word) {
  modeInput.classList.add('hidden');
  modeScramble.classList.remove('hidden');

  modeBadge.textContent = '🔀 Ghép Chữ';
  modeBadge.className = 'mode-badge scramble-mode';

  assembled = [];
  const chars = word.toUpperCase().split('');
  tileOrder = shuffleArray(chars.map((c, i) => ({ char: c, idx: i })));

  // Ensure scrambled isn't the same as the answer (for short words)
  if (tileOrder.map(t => t.char).join('') === word.toUpperCase() && word.length > 1) {
    // Quick re-shuffle
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
    assembledSlots.innerHTML = '<p class="assembled-hint" style="color:rgba(255,255,255,0.2);font-size:0.8rem;margin:auto">Nhấp chữ cái để ghép từ 👇</p>';
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
    el.dataset.tileIdx = i;
    if (!tile.used) {
      el.addEventListener('click', () => addToAssembled(i));
    }
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

  // Auto-check when all tiles placed
  if (assembled.length === tileOrder.length) {
    checkScramble();
  }
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
  const answer = deck[currentIndex].word;
  const item = deck[currentIndex];

  if (item.mode === 'input') {
    wordInput.className = 'word-input';
    wordInput.value = answer;
    setFeedback(feedbackMsg, `💡 Đáp án: ${answer}`, 'reveal');
  } else {
    setFeedback(scrambleFeedback, `💡 Đáp án: ${answer}`, 'reveal');
  }

  skipTimer = setTimeout(nextQuestion, 2000);
}

function clearSkipTimer() {
  if (skipTimer) { clearTimeout(skipTimer); skipTimer = null; }
}

// ── Next question or finish ────────────────────────────
function nextQuestion() {
  clearSkipTimer();
  currentIndex++;
  if (currentIndex >= deck.length) {
    finishQuiz();
  } else {
    renderQuestion();
  }
}

// ── Finish ─────────────────────────────────────────────
function finishQuiz() {
  progressFill.style.width = '100%';
  scoreVal.textContent = score;
  showScreen(screenResult);
}

// ── Helpers ────────────────────────────────────────────
function setFeedback(el, msg, type) {
  el.textContent = msg;
  el.className = 'feedback-msg' + (type ? ' ' + type : '');
}

// ── Boot ───────────────────────────────────────────────
totalCountEl.textContent = vocabularies.length;
