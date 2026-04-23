// ---------- Storage ----------
const KEY = "rst_v1"; // realtime study tracker
const todayKey = () => new Date().toISOString().slice(0, 10);

function load() {
  return JSON.parse(localStorage.getItem(KEY) || "{}");
}
function save(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}
function ensureData() {
  const data = load();
  data.days = data.days || {}; // { "YYYY-MM-DD": {focusSec, sessions} }
  save(data);
  return data;
}
function addFocusSeconds(sec) {
  const data = ensureData();
  const d = todayKey();
  data.days[d] = data.days[d] || { focusSec: 0, sessions: 0 };
  data.days[d].focusSec += sec;
  data.days[d].sessions += 1;
  save(data);
}

// ---------- UI elements ----------
const modePomodoro = document.getElementById("modePomodoro");
const modeStopwatch = document.getElementById("modeStopwatch");
const timeDisplay = document.getElementById("timeDisplay");
const statusText = document.getElementById("statusText");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const focusMin = document.getElementById("focusMin");
const breakMin = document.getElementById("breakMin");
const pomoSettings = document.getElementById("pomoSettings");
const todayFocus = document.getElementById("todayFocus");
const todaySessions = document.getElementById("todaySessions");
const clearToday = document.getElementById("clearToday");

// ---------- Timer logic ----------
let mode = "pomodoro"; // "pomodoro" | "stopwatch"
let running = false;
let t = 25 * 60;          // seconds remaining (pomodoro)
let sw = 0;               // stopwatch seconds elapsed
let phase = "focus";      // "focus" | "break"
let tick = null;
let focusStartSec = null; // to count focus sessions

function fmt(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
function render() {
  timeDisplay.textContent = mode === "pomodoro" ? fmt(t) : fmt(sw);
  if (mode === "pomodoro") {
    statusText.textContent =
      phase === "focus" ? "Focus time. Stay sharp!" : "Break time. Recharge!";
  } else {
    statusText.textContent = running ? "Tracking time…" : "Ready to start.";
  }
  pomoSettings.style.display = mode === "pomodoro" ? "flex" : "none";
  modePomodoro.classList.toggle("active", mode === "pomodoro");
  modeStopwatch.classList.toggle("active", mode === "stopwatch");
}
function stopTick() {
  if (tick) clearInterval(tick);
  tick = null;
  running = false;
}
function startTick() {
  if (running) return;
  running = true;
  tick = setInterval(() => {
    if (mode === "pomodoro") {
      t -= 1;
      if (t <= 0) {
        // finish phase
        if (phase === "focus") {
          // completed one focus session
          const focusSeconds = Number(focusMin.value || 25) * 60;
          addFocusSeconds(focusSeconds);
          updateStats();
          phase = "break";
          t = Number(breakMin.value || 5) * 60;
          beep();
        } else {
          phase = "focus";
          t = Number(focusMin.value || 25) * 60;
          beep();
        }
      }
    } else {
      sw += 1;
    }
    render();
  }, 1000);
}
function resetTimer() {
  stopTick();
  phase = "focus";
  t = Number(focusMin.value || 25) * 60;
  sw = 0;
  render();
}
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.value = 0.05;
    o.start();
    setTimeout(() => { o.stop(); ctx.close(); }, 180);
  } catch (_) {}
}

// ---------- Stats + chart ----------
function getLast7() {
  const data = ensureData();
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const val = data.days[key] || { focusSec: 0, sessions: 0 };
    out.push({ day: key.slice(5), ...val });
  }
  return out;
}
function updateStats() {
  const data = ensureData();
  const d = todayKey();
  const val = data.days[d] || { focusSec: 0, sessions: 0 };
  todayFocus.textContent = `${Math.round(val.focusSec / 60)}m`;
  todaySessions.textContent = `${val.sessions}`;
  updateChart();
}
let chart;
function updateChart() {
  const last7 = getLast7();
  const labels = last7.map(x => x.day);
  const minutes = last7.map(x => Math.round(x.focusSec / 60));
  const ctx = document.getElementById("chart").getContext("2d");
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Focus minutes",
        data: minutes,
        borderColor: "#4f7cff",
        backgroundColor: "rgba(79,124,255,.18)",
        tension: 0.35,
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: "#e8eefc" } } },
      scales: {
        x: { ticks: { color: "#9fb0d0" }, grid: { color: "rgba(255,255,255,.06)" } },
        y: { ticks: { color: "#9fb0d0" }, grid: { color: "rgba(255,255,255,.06)" }, beginAtZero: true }
      }
    }
  });
}

// ---------- Events ----------
modePomodoro.onclick = () => { mode = "pomodoro"; resetTimer(); };
modeStopwatch.onclick = () => { mode = "stopwatch"; resetTimer(); };

startBtn.onclick = () => startTick();
pauseBtn.onclick = () => stopTick();
resetBtn.onclick = () => resetTimer();

focusMin.onchange = () => { if (mode === "pomodoro" && !running) resetTimer(); };
breakMin.onchange = () => { if (mode === "pomodoro" && !running) resetTimer(); };

clearToday.onclick = () => {
  const data = ensureData();
  delete data.days[todayKey()];
  save(data);
  updateStats();
};

// init
ensureData();
resetTimer();
updateStats();
