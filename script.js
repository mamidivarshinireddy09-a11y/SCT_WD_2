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
const ringProgress = document.querySelector('.ring-progress');
const themeClass = 'light-theme';
const timerStates = {
  READY: 'ready',
  RUNNING: 'running',
  PAUSED: 'paused',
  RESET: 'reset'
};

let elapsedMs = 0;
let accumulatedMs = 0;
let startTimestamp = null;
let rafId = null;
let timerState = timerStates.READY;
let laps = [];
let isLightTheme = false;

const formatNumber = (value, digits = 2) => String(value).padStart(digits, '0');

const formatTime = (ms) => {
  const totalMilliseconds = Math.max(0, Math.floor(ms));
  const hours = Math.floor(totalMilliseconds / 3600000);
  const minutes = Math.floor((totalMilliseconds % 3600000) / 60000);
  const seconds = Math.floor((totalMilliseconds % 60000) / 1000);
  const milliseconds = totalMilliseconds % 1000;

  return {
    hours,
    minutes,
    seconds,
    milliseconds,
    string: `${formatNumber(hours)}:${formatNumber(minutes)}:${formatNumber(seconds)}.${formatNumber(milliseconds, 3)}`
  };
};

const setStatus = (state) => {
  timerState = state;
  const statusMap = {
    [timerStates.READY]: { text: 'Ready', style: 'status-ready', runtime: 'Idle' },
    [timerStates.RUNNING]: { text: 'Running', style: 'status-running', runtime: 'Active' },
    [timerStates.PAUSED]: { text: 'Paused', style: 'status-paused', runtime: 'Paused' },
    [timerStates.RESET]: { text: 'Reset', style: 'status-reset', runtime: 'Reset' }
  };

  const current = statusMap[state] || statusMap[timerStates.READY];
  statusText.innerHTML = `<span class="status-dot ${current.style}"></span> ${current.text}`;
  runtimeLabel.textContent = current.runtime;
  pulseIndicator.className = `indicator ${state === timerStates.RUNNING ? 'running' : ''}`;
  startButton.textContent = state === timerStates.RUNNING ? '⏸ Pause' : state === timerStates.PAUSED ? '▶ Resume' : '▶ Start';
  startButton.classList.toggle('primary', state !== timerStates.RUNNING);
  startButton.classList.toggle('secondary', state === timerStates.RUNNING);
};

const showToast = (title, message) => {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<strong>${title}</strong><span>${message}</span>`;
  toastContainer.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  window.setTimeout(() => toast.remove(), 2800);
};

const updateTimerDisplay = (timeMs) => {
  const time = formatTime(timeMs);
  hoursEl.textContent = formatNumber(time.hours);
  minutesEl.textContent = formatNumber(time.minutes);
  secondsEl.textContent = formatNumber(time.seconds);
  millisecondsEl.textContent = formatNumber(time.milliseconds, 3);
  elapsedSummary.textContent = time.string;
  lapCount.textContent = laps.length;

  const progress = 1 - ((timeMs % 60000) / 60000);
  const circumference = 615;
  ringProgress.style.strokeDashoffset = `${circumference * progress}`;
};

const updateDashboard = () => {
  const now = new Date();
  displayDate.textContent = now.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  displayDay.textContent = now.toLocaleDateString(undefined, { weekday: 'long' });
  displayClock.textContent = now.toLocaleTimeString(undefined, { hour12: false });
};

const updateButtons = () => {
  const isRunning = timerState === timerStates.RUNNING;
  const isReady = timerState === timerStates.READY || timerState === timerStates.RESET;
  const canReset = !(isReady && elapsedMs === 0);

  startButton.disabled = false;
  pauseButton.disabled = !isRunning;
  lapButton.disabled = !isRunning;
  resetButton.disabled = !canReset;
  clearLapsButton.disabled = laps.length === 0;

  pauseButton.classList.toggle('disabled', !isRunning);
  lapButton.classList.toggle('disabled', !isRunning);
  resetButton.classList.toggle('disabled', !canReset);
  clearLapsButton.classList.toggle('disabled', laps.length === 0);

  pauseButton.setAttribute('aria-disabled', String(!isRunning));
  lapButton.setAttribute('aria-disabled', String(!isRunning));
  resetButton.setAttribute('aria-disabled', String(!canReset));
  clearLapsButton.setAttribute('aria-disabled', String(laps.length === 0));

  if (isRunning) {
    startButton.setAttribute('aria-label', 'Pause stopwatch');
  } else if (timerState === timerStates.PAUSED) {
    startButton.setAttribute('aria-label', 'Resume stopwatch');
  } else {
    startButton.setAttribute('aria-label', 'Start stopwatch');
  }
};

const animateRing = (active) => {
  ringProgress.style.filter = active ? 'drop-shadow(0 0 32px rgba(68, 217, 255, 0.4))' : 'none';
  pulseIndicator.style.animation = active ? 'pulseGlow 1.2s infinite ease-in-out' : 'none';
};

const updateLapHighlighting = () => {
  if (laps.length === 0) return;

  const lapDurations = laps.map((lap) => lap.time);
  const fastest = Math.min(...lapDurations);
  const slowest = Math.max(...lapDurations);
  const items = lapList.querySelectorAll('.lap-item');

  items.forEach((item, index) => {
    const lap = laps[index];
    item.classList.toggle('fastest', lap.time === fastest);
    item.classList.toggle('slowest', lap.time === slowest);
    item.classList.toggle('latest', index === laps.length - 1);
  });
};

const renderLaps = () => {
  lapList.innerHTML = '';
  if (laps.length === 0) {
    lapPlaceholder.classList.remove('hidden');
    lapPlaceholder.style.display = 'grid';
    return;
  }

  lapPlaceholder.style.display = 'none';
  laps.slice().reverse().forEach((lap, index) => {
    const listItem = document.createElement('li');
    listItem.className = 'lap-item';
    listItem.dataset.index = laps.length - 1 - index;
    listItem.innerHTML = `
      <span class="lap-number">#${lap.number}</span>
      <div class="lap-detail">
        <strong class="lap-time">${lap.label}</strong>
        <small>${lap.duration}</small>
      </div>
      <span class="lap-label">${lap.badge}</span>
    `;
    lapList.appendChild(listItem);
  });

  updateLapHighlighting();
  lapList.scrollTo({ top: 0, behavior: 'smooth' });
};

const createLapText = () => {
  if (laps.length === 0) return 'No lap data available.';
  return laps.map((lap) => `Lap ${lap.number}: ${lap.label}`).join('\n');
};

const recordLap = () => {
  if (timerState !== timerStates.RUNNING) return;

  const lapNumber = laps.length + 1;
  const lapLabel = formatTime(elapsedMs).string;
  const lapBadge = lapNumber === 1 ? 'First' : lapNumber === laps.length + 1 && laps.length > 0 ? 'Latest' : 'Lap';

  laps.push({ number: lapNumber, time: elapsedMs, label: lapLabel, duration: lapLabel, badge: lapBadge });
  renderLaps();
  updateButtons();
  showToast('Lap recorded', `Lap ${lapNumber} at ${lapLabel}`);
};

const resetTimer = () => {
  cancelAnimationFrame(rafId);
  rafId = null;
  startTimestamp = null;
  accumulatedMs = 0;
  elapsedMs = 0;
  laps = [];
  updateTimerDisplay(0);
  renderLaps();
  setStatus(timerStates.RESET);
  animateRing(false);
  updateButtons();
  showToast('Timer reset', 'All stopwatch data has been cleared.');
};

const tick = () => {
  if (timerState !== timerStates.RUNNING) return;

  const now = performance.now();
  elapsedMs = accumulatedMs + Math.max(0, now - startTimestamp);
  updateTimerDisplay(elapsedMs);
  rafId = requestAnimationFrame(tick);
};

const startTimer = () => {
  if (timerState === timerStates.RUNNING) {
    pauseTimer();
    return;
  }

  if (timerState === timerStates.READY || timerState === timerStates.RESET) {
    accumulatedMs = 0;
    elapsedMs = 0;
    startTimestamp = performance.now();
  } else if (timerState === timerStates.PAUSED) {
    startTimestamp = performance.now();
  }

  setStatus(timerStates.RUNNING);
  animateRing(true);
  updateButtons();
  if (!rafId) {
    rafId = requestAnimationFrame(tick);
  }
  showToast('Timer started', 'Your stopwatch is now running.');
};

const pauseTimer = () => {
  if (timerState !== timerStates.RUNNING) return;

  cancelAnimationFrame(rafId);
  rafId = null;
  accumulatedMs = elapsedMs;
  startTimestamp = null;
  setStatus(timerStates.PAUSED);
  animateRing(false);
  updateButtons();
  showToast('Timer paused', 'Stopwatch paused successfully.');
};

const applyTheme = (lightTheme, shouldNotify = false) => {
  isLightTheme = lightTheme;
  appShell.classList.toggle(themeClass, lightTheme);
  themeToggle.classList.toggle('active', lightTheme);
  themeToggle.setAttribute('aria-pressed', String(lightTheme));
  themeToggle.querySelector('.toggle-label').textContent = lightTheme ? '☀️ Light' : '🌙 Dark';

  if (lightTheme) {
    document.documentElement.style.setProperty('--bg', '#f5f7ff');
    document.documentElement.style.setProperty('--surface', 'rgba(255, 255, 255, 0.94)');
    document.documentElement.style.setProperty('--surface-strong', 'rgba(255, 255, 255, 0.96)');
    document.documentElement.style.setProperty('--surface-soft', 'rgba(250, 249, 255, 0.88)');
    document.documentElement.style.setProperty('--text', '#111827');
    document.documentElement.style.setProperty('--muted', '#4b5563');
    document.documentElement.style.setProperty('--border', 'rgba(17, 24, 39, 0.06)');
    document.documentElement.style.setProperty('--shadow', '0 28px 64px rgba(15, 23, 42, 0.08)');
  } else {
    document.documentElement.style.setProperty('--bg', '#090b14');
    document.documentElement.style.setProperty('--surface', 'rgba(22, 24, 38, 0.9)');
    document.documentElement.style.setProperty('--surface-strong', 'rgba(18, 20, 34, 0.97)');
    document.documentElement.style.setProperty('--surface-soft', 'rgba(23, 26, 47, 0.72)');
    document.documentElement.style.setProperty('--text', '#eef2ff');
    document.documentElement.style.setProperty('--muted', '#a8b0d8');
    document.documentElement.style.setProperty('--border', 'rgba(255, 255, 255, 0.11)');
    document.documentElement.style.setProperty('--shadow', '0 32px 80px rgba(5, 8, 23, 0.45)');
  }

  localStorage.setItem('chronoTheme', lightTheme ? 'light' : 'dark');
  if (shouldNotify) {
    showToast('Theme toggled', lightTheme ? 'Light mode enabled' : 'Dark mode enabled');
  }
};

const toggleTheme = () => applyTheme(!isLightTheme, true);

const loadTheme = () => {
  const savedTheme = localStorage.getItem('chronoTheme');
  applyTheme(savedTheme === 'light');
};

const createRipple = (event) => {
  const button = event.currentTarget;
  const ripple = document.createElement('span');
  ripple.className = 'button-ripple';

  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  ripple.style.left = `${event.clientX - rect.left}px`;
  ripple.style.top = `${event.clientY - rect.top}px`;
  ripple.style.transform = 'translate(-50%, -50%) scale(0)';

  button.appendChild(ripple);
  window.requestAnimationFrame(() => {
    ripple.style.transform = 'translate(-50%, -50%) scale(1)';
  });

  ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
};

const copyLaps = async () => {
  if (laps.length === 0) {
    showToast('Nothing to copy', 'Record a lap before copying lap data.');
    return;
  }

  const text = createLapText();
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    showToast('Laps copied', 'Lap times are ready on your clipboard.');
  } else {
    showToast('Clipboard unavailable', 'Your browser does not support clipboard access.');
  }
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
  setStatus(timerStates.READY);
  animateRing(false);
  window.setInterval(updateDashboard, 1000);

  [themeToggle, startButton, pauseButton, lapButton, resetButton, fullscreenButton, copyButton, downloadButton, clearLapsButton].forEach((button) => {
    button.addEventListener('click', createRipple);
  });

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
