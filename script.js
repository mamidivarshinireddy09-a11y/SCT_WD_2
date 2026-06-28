const hoursEl = document.getElementById('hours');
const minutesEl = document.getElementById('minutes');
const secondsEl = document.getElementById('seconds');
const millisecondsEl = document.getElementById('milliseconds');
const displayDate = document.getElementById('displayDate');
const displayDay = document.getElementById('displayDay');
const displayClock = document.getElementById('displayClock');
const statusText = document.getElementById('statusText');
const runtimeLabel = document.getElementById('runtimeLabel');
const elapsedSummary = document.getElementById('elapsedSummary');
const lapCount = document.getElementById('lapCount');
const themeToggle = document.getElementById('themeToggle');
const startButton = document.getElementById('startButton');
const pauseButton = document.getElementById('pauseButton');
const lapButton = document.getElementById('lapButton');
const resetButton = document.getElementById('resetButton');
const fullscreenButton = document.getElementById('fullscreenButton');
const copyButton = document.getElementById('copyButton');
const downloadButton = document.getElementById('downloadButton');
const clearLapsButton = document.getElementById('clearLapsButton');
const lapList = document.getElementById('lapList');
const lapPlaceholder = document.getElementById('lapPlaceholder');
const toastContainer = document.getElementById('toastContainer');
const appShell = document.getElementById('appShell');
const pulseIndicator = document.getElementById('pulseIndicator');
const themeThumb = themeToggle.querySelector('.toggle-thumb');
const ringProgress = document.querySelector('.ring-progress');
const themeClass = 'light-theme';

let startTime = 0;
let elapsed = 0;
let pausedTime = 0;
let rafId = null;
let timerState = 'ready';
let laps = [];
let soundOn = true;

const audio = new Audio();
audio.src = 'data:audio/wav;base64,UklGRjSXAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YU0zAAAAAAD/';

const formatNumber = (value, digits = 2) => String(value).padStart(digits, '0');

const formatTime = (ms) => {
  const totalMilliseconds = Math.max(ms, 0);
  const hours = Math.floor(totalMilliseconds / 3600000);
  const minutes = Math.floor((totalMilliseconds % 3600000) / 60000);
  const seconds = Math.floor((totalMilliseconds % 60000) / 1000);
  const milliseconds = totalMilliseconds % 1000;
  return {
    hours,
    minutes,
    seconds,
    milliseconds,
    string: `${formatNumber(hours)}:${formatNumber(minutes)}:${formatNumber(seconds)}.${String(milliseconds).padStart(3, '0')}`
  };
};

const setStatus = (state) => {
  timerState = state;
  const statusMap = {
    ready: { text: 'Ready', style: 'status-ready', label: 'Ready', runtime: 'Idle' },
    running: { text: 'Running', style: 'status-running', label: 'Running', runtime: 'Active' },
    paused: { text: 'Paused', style: 'status-paused', label: 'Paused', runtime: 'Paused' },
    reset: { text: 'Reset', style: 'status-reset', label: 'Reset', runtime: 'Reset' }
  };

  const current = statusMap[state] || statusMap.ready;
  statusText.innerHTML = `<span class="status-dot ${current.style}"></span> ${current.text}`;
  runtimeLabel.textContent = current.runtime;
  const startButtonText = state === 'running' ? 'Pause' : state === 'paused' ? 'Resume' : 'Start';
  startButton.textContent = state === 'running' ? '⏸ Pause' : state === 'paused' ? '▶ Resume' : '▶ Start';
  startButton.classList.toggle('primary', state !== 'running');
  startButton.classList.toggle('secondary', state === 'running');
};

const showToast = (title, message) => {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<strong>${title}</strong><span>${message}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.classList.add('visible'), 20);
  setTimeout(() => toast.remove(), 2800);
};

const updateTimerDisplay = (timeMs) => {
  const time = formatTime(timeMs);
  hoursEl.textContent = formatNumber(time.hours);
  minutesEl.textContent = formatNumber(time.minutes);
  secondsEl.textContent = formatNumber(time.seconds);
  millisecondsEl.textContent = String(time.milliseconds).padStart(3, '0');
  elapsedSummary.textContent = time.string;
  lapCount.textContent = laps.length;
  const progress = 1 - ((timeMs % 60000) / 60000);
  const circumference = 615;
  ringProgress.style.strokeDashoffset = String(circumference * progress);
};

const updateDashboard = () => {
  const now = new Date();
  const options = { month: 'short', day: 'numeric', year: 'numeric' };
  displayDate.textContent = now.toLocaleDateString(undefined, options);
  displayDay.textContent = now.toLocaleDateString(undefined, { weekday: 'long' });
  displayClock.textContent = now.toLocaleTimeString(undefined, { hour12: false });
};

const updateButtons = () => {
  const isRunning = timerState === 'running';
  const isPaused = timerState === 'paused';
  startButton.disabled = false;
  pauseButton.disabled = !isRunning;
  lapButton.disabled = !isRunning;
  resetButton.disabled = timerState === 'ready' && elapsed === 0;
  clearLapsButton.disabled = laps.length === 0;
  pauseButton.classList.toggle('disabled', !isRunning);
  lapButton.classList.toggle('disabled', !isRunning);
  resetButton.classList.toggle('disabled', timerState === 'ready' && elapsed === 0);
  clearLapsButton.classList.toggle('disabled', laps.length === 0);
  if (isRunning) {
    startButton.setAttribute('aria-label', 'Pause stopwatch');
  } else if (isPaused) {
    startButton.setAttribute('aria-label', 'Resume stopwatch');
  } else {
    startButton.setAttribute('aria-label', 'Start stopwatch');
  }
};

const animateRing = (active) => {
  if (active) {
    ringProgress.style.filter = 'drop-shadow(0 0 32px rgba(68, 217, 255, 0.4))';
    pulseIndicator.style.animation = 'pulseGlow 1.2s infinite ease-in-out';
  } else {
    ringProgress.style.filter = 'none';
    pulseIndicator.style.animation = 'none';
  }
};

const updateLapHighlighting = () => {
  if (laps.length === 0) return;
  const lapDurations = laps.map((lap) => lap.time);
  const fastest = Math.min(...lapDurations);
  const slowest = Math.max(...lapDurations);
  const items = lapList.querySelectorAll('.lap-item');
  items.forEach((item) => {
    const lapIndex = Number(item.dataset.index);
    const lap = laps[lapIndex];
    item.classList.toggle('fastest', lap.time === fastest);
    item.classList.toggle('slowest', lap.time === slowest);
  });
};

const renderLaps = () => {
  lapList.innerHTML = '';
  if (laps.length === 0) {
    lapPlaceholder.style.display = 'block';
    return;
  }
  lapPlaceholder.style.display = 'none';
  laps.forEach((lap, index) => {
    const listItem = document.createElement('li');
    listItem.className = 'lap-item recent';
    listItem.dataset.index = index;
    listItem.innerHTML = `
      <span class="lap-number">#${lap.number}</span>
      <div class="lap-detail">
        <strong class="lap-time">${lap.label}</strong>
        <small>${lap.duration}</small>
      </div>
      <span class="lap-label">${lap.badge}</span>
    `;
    lapList.prepend(listItem);
  });
  updateLapHighlighting();
  lapList.scrollTo({ top: 0, behavior: 'smooth' });
};

const createLapText = () => {
  if (laps.length === 0) return 'No lap data available.';
  return laps.map((lap) => `Lap ${lap.number}: ${lap.label}`).join('\n');
};

const recordLap = () => {
  if (timerState !== 'running') return;
  const lapTime = elapsed;
  const lapNumber = laps.length + 1;
  const lapLabel = formatTime(lapTime).string;
  const lapBadge = lapNumber === 1 ? 'First' : 'Recent';
  laps.push({ number: lapNumber, time: lapTime, label: lapLabel, duration: lapLabel, badge: lapBadge });
  if (laps.length > 1) {
    laps.slice(0, -1).forEach((item) => { item.badge = 'Lap'; });
  }
  renderLaps();
  updateButtons();
  showToast('Lap recorded', `Lap ${lapNumber} at ${lapLabel}`);
};

const resetTimer = () => {
  cancelAnimationFrame(rafId);
  startTime = 0;
  elapsed = 0;
  pausedTime = 0;
  rafId = null;
  laps = [];
  updateTimerDisplay(0);
  renderLaps();
  setStatus('reset');
  animateRing(false);
  updateButtons();
  showToast('Timer reset', 'All stopwatch data has been cleared.');
};

const tick = () => {
  const now = performance.now();
  elapsed = now - startTime + pausedTime;
  updateTimerDisplay(elapsed);
  rafId = requestAnimationFrame(tick);
};

const startTimer = () => {
  if (timerState === 'running') {
    pauseTimer();
    return;
  }

  if (timerState === 'ready' || timerState === 'reset') {
    startTime = performance.now();
    pausedTime = 0;
  } else if (timerState === 'paused') {
    startTime = performance.now();
  }

  setStatus('running');
  animateRing(true);
  updateButtons();
  rafId = requestAnimationFrame(tick);
  showToast('Timer started', 'Your stopwatch is now running.');
};

const pauseTimer = () => {
  if (timerState !== 'running') return;
  cancelAnimationFrame(rafId);
  pausedTime = elapsed;
  rafId = null;
  setStatus('paused');
  animateRing(false);
  updateButtons();
  showToast('Timer paused', 'Stopwatch paused successfully.');
};

const toggleTheme = () => {
  const isLight = appShell.classList.toggle(themeClass);
  if (isLight) {
    themeToggle.classList.add('active');
    document.documentElement.style.setProperty('--bg', '#f5f7ff');
    document.documentElement.style.setProperty('--surface', 'rgba(255, 255, 255, 0.94)');
    document.documentElement.style.setProperty('--surface-strong', 'rgba(255, 255, 255, 0.96)');
    document.documentElement.style.setProperty('--surface-soft', 'rgba(250, 249, 255, 0.88)');
    document.documentElement.style.setProperty('--text', '#111827');
    document.documentElement.style.setProperty('--muted', '#4b5563');
    document.documentElement.style.setProperty('--border', 'rgba(17, 24, 39, 0.06)');
    document.documentElement.style.setProperty('--shadow', '0 28px 64px rgba(15, 23, 42, 0.08)');
  } else {
    themeToggle.classList.remove('active');
    document.documentElement.style.setProperty('--bg', '#090b14');
    document.documentElement.style.setProperty('--surface', 'rgba(22, 24, 38, 0.9)');
    document.documentElement.style.setProperty('--surface-strong', 'rgba(18, 20, 34, 0.97)');
    document.documentElement.style.setProperty('--surface-soft', 'rgba(23, 26, 47, 0.72)');
    document.documentElement.style.setProperty('--text', '#eef2ff');
    document.documentElement.style.setProperty('--muted', '#a8b0d8');
    document.documentElement.style.setProperty('--border', 'rgba(255, 255, 255, 0.11)');
    document.documentElement.style.setProperty('--shadow', '0 32px 80px rgba(5, 8, 23, 0.45)');
  }
  localStorage.setItem('chronoTheme', isLight ? 'light' : 'dark');
  showToast('Theme toggled', isLight ? 'Light mode enabled' : 'Dark mode enabled');
};

const loadTheme = () => {
  const savedTheme = localStorage.getItem('chronoTheme');
  if (savedTheme === 'light') {
    appShell.classList.add(themeClass);
    themeToggle.classList.add('active');
    toggleTheme();
  }
};

const copyLaps = async () => {
  if (laps.length === 0) {
    showToast('Nothing to copy', 'Record a lap before copying lap data.');
    return;
  }
  const text = createLapText();
  await navigator.clipboard.writeText(text);
  showToast('Laps copied', 'Lap times are ready on your clipboard.');
};

const downloadLaps = () => {
  if (laps.length === 0) {
    showToast('No laps to download', 'Record a lap before downloading lap times.');
    return;
  }
  const text = `ChronoPulse Lap Report\n${new Date().toLocaleString()}\n\n${createLapText()}`;
  const blob = new Blob([text], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `ChronoPulse-Laps-${Date.now()}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  showToast('Lap file downloaded', 'Your lap history has been saved.');
};

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => showToast('Fullscreen unavailable', 'Your browser does not permit fullscreen mode.'));
    return;
  }
  document.exitFullscreen();
};

const handleShortcut = (event) => {
  if (event.target.matches('input, textarea')) return;
  if (event.code === 'Space') {
    event.preventDefault();
    startTimer();
  }
  if (event.key.toLowerCase() === 'l') {
    recordLap();
  }
  if (event.key.toLowerCase() === 'r') {
    resetTimer();
  }
  if (event.key.toLowerCase() === 't') {
    toggleTheme();
  }
};

const init = () => {
  updateDashboard();
  updateTimerDisplay(0);
  updateButtons();
  loadTheme();
  renderLaps();
  setStatus('ready');
  animateRing(false);
  setInterval(updateDashboard, 1000);
  themeToggle.addEventListener('click', toggleTheme);
  startButton.addEventListener('click', startTimer);
  pauseButton.addEventListener('click', pauseTimer);
  lapButton.addEventListener('click', recordLap);
  resetButton.addEventListener('click', resetTimer);
  fullscreenButton.addEventListener('click', toggleFullscreen);
  copyButton.addEventListener('click', copyLaps);
  downloadButton.addEventListener('click', downloadLaps);
  clearLapsButton.addEventListener('click', () => {
    laps = [];
    renderLaps();
    updateButtons();
    showToast('Lap history cleared', 'All laps have been removed.');
  });
  window.addEventListener('keydown', handleShortcut);
};

window.addEventListener('DOMContentLoaded', init);
