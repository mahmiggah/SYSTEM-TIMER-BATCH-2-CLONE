// --- DOM elements ---
const timerHours = document.querySelector('.timer-hours');
const timerMins = document.querySelector('.timer-minutes');
const timerSecs = document.querySelector('.timer-seconds');
const startPauseBtn = document.getElementById('startPauseBtn');
const resetBtn = document.getElementById('resetBtn');
const menuBtn = document.getElementById('menuBtn');
const helpBtn = document.getElementById('helpBtn');

// modals
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettingsBtn');
const setTimeBtn = document.getElementById('setTimeBtn');
const modeRadios = document.querySelectorAll('input[name="countMode"]');

const timeModal = document.getElementById('timeModal');
const modHours = document.getElementById('modalHours');
const modMins = document.getElementById('modalMinutes');
const modSecs = document.getElementById('modalSeconds');
const confirmTime = document.getElementById('modalConfirmBtn');
const cancelTime = document.getElementById('modalCancelBtn');

const eventModal = document.getElementById('eventModal');
const eventHours = document.getElementById('eventHours');
const eventMins = document.getElementById('eventMinutes');
const eventSecs = document.getElementById('eventSeconds');
const confirmEvent = document.getElementById('eventConfirmBtn');
const cancelEvent = document.getElementById('eventCancelBtn');
const addEventBtn = document.getElementById('addEventBtn');
const eventsListDiv = document.getElementById('eventsList');

const helpModal = document.getElementById('helpModal');
const closeHelp = document.getElementById('closeHelpBtn');

// checkboxes & inputs
const continueCheck = document.getElementById('continueDescending');
const prepIndicator = document.getElementById('prepIndicator');
const prepTimerDisplay = document.getElementById('prepTimerDisplay');
const prepHoursInp = document.getElementById('prepHours');
const prepMinsInp = document.getElementById('prepMinutes');
const prepSecsInp = document.getElementById('prepSeconds');

const greenLight = document.querySelector('.light.green');
const yellowLight = document.querySelector('.light.yellow');
const redLight = document.querySelector('.light.red');
const timerDiv = document.querySelector('.timer');

// label elements
const labelDiv = document.getElementById('customLabel');
const labelInput = document.getElementById('customLabelInput');

// --- state variables ---
let timerActive = false;          // whether the timer is running (instead of intervalId)
let remaining = 0;                // current seconds (can be negative for descending continue)
let target = 0;                   // originally set duration
let mode = "down";                // "down" or "up"
let halfTriggered = false;
let finishNotified = false;
let zeroCrossed = false;
let events = [];

// preparation
let prepTotal = 0;
let prepCurrent = 0;
let isPreparing = false;
let prepUsed = false;
let savedRemaining = 0;
let savedTarget = 0;
let continueDesc = false;

// --- accurate timer variables ---
let expected = 0;                 // expected timestamp for next tick
let timerTimeout = null;          // timeout handle

// --- load / save preferences (unchanged) ---
function loadContinue() {
  const saved = localStorage.getItem('continueDescending');
  if (saved !== null) continueDesc = (saved === 'true');
  if (continueCheck) continueCheck.checked = continueDesc;
}
function saveContinue() {
  localStorage.setItem('continueDescending', continueDesc);
}
if (continueCheck) {
  continueCheck.addEventListener('change', () => {
    continueDesc = continueCheck.checked;
    saveContinue();
  });
}

function loadPrep() {
  const saved = localStorage.getItem('prepTimeSeconds');
  if (saved !== null) prepTotal = parseInt(saved);
  if (prepHoursInp) {
    const h = Math.floor(prepTotal / 3600);
    const m = Math.floor((prepTotal % 3600) / 60);
    const s = prepTotal % 60;
    prepHoursInp.value = h;
    prepMinsInp.value = m;
    prepSecsInp.value = s;
  }
}
function savePrep() {
  localStorage.setItem('prepTimeSeconds', prepTotal);
}
function updatePrepFromInputs() {
  let h = parseInt(prepHoursInp.value) || 0;
  let m = parseInt(prepMinsInp.value) || 0;
  let s = parseInt(prepSecsInp.value) || 0;
  if (s > 59) s = 59;
  if (m > 59) m = 59;
  prepTotal = h*3600 + m*60 + s;
  savePrep();
  prepUsed = false;
}
if (prepHoursInp && prepMinsInp && prepSecsInp) {
  prepHoursInp.addEventListener('change', updatePrepFromInputs);
  prepMinsInp.addEventListener('change', updatePrepFromInputs);
  prepSecsInp.addEventListener('change', updatePrepFromInputs);
}

if (labelDiv && labelInput) {
  const savedLabel = localStorage.getItem('timerCustomLabel');
  if (savedLabel) {
    labelDiv.textContent = savedLabel;
    labelInput.value = savedLabel;
  } else {
    labelDiv.textContent = 'My Timer';
    labelInput.value = 'My Timer';
  }
  labelInput.addEventListener('change', () => {
    let name = labelInput.value.trim();
    if (name === '') return;
    localStorage.setItem('timerCustomLabel', name);
    labelDiv.textContent = name;
  });
}

// --- helper functions (formatTime, updateDisplay, updatePrepDisplay, flash, beep, toast) ---
function formatTime(sec) {
  const sign = sec < 0 ? '-' : '';
  const abs = Math.abs(sec);
  const hrs = Math.floor(abs / 3600);
  const mins = Math.floor((abs % 3600) / 60);
  const secs = abs % 60;
  return {
    hrs: (sign + hrs.toString().padStart(2,'0')).slice(-3),
    mins: mins.toString().padStart(2,'0'),
    secs: secs.toString().padStart(2,'0')
  };
}
function updateDisplay() {
  const t = formatTime(remaining);
  timerHours.textContent = t.hrs;
  timerMins.textContent = t.mins;
  timerSecs.textContent = t.secs;
  if (mode === "down" && remaining < 0 && continueDesc) {
    timerDiv.style.color = '#ef4444';
  } else {
    timerDiv.style.color = '#0f172a';
  }
}
function updatePrepDisplay(sec) {
  if (!prepTimerDisplay) return;
  const abs = Math.abs(sec);
  const hrs = Math.floor(abs / 3600);
  const mins = Math.floor((abs % 3600) / 60);
  const secs = abs % 60;
  const str = `${hrs.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
  prepTimerDisplay.textContent = `⏳ Prep: ${str}`;
}
function flash(col) {
  const orig = timerDiv.style.color;
  timerDiv.style.color = col;
  setTimeout(() => { if (timerDiv.style.color === col) timerDiv.style.color = orig; }, 400);
}
function stopTimer() {
  if (timerTimeout) {
    clearTimeout(timerTimeout);
    timerTimeout = null;
  }
  timerActive = false;
}
function beep(freq=880, dur=0.5) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.value = 0.2;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + dur);
    osc.stop(ctx.currentTime + dur);
  } catch(e) {}
}
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast-message';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// --- traffic light (unchanged) ---
function updateTraffic() {
  greenLight.classList.remove('active');
  yellowLight.classList.remove('active');
  redLight.classList.remove('active');

  if (mode === "down" && remaining < 0 && continueDesc) {
    redLight.classList.add('active');
    return;
  }

  let value = (mode === "down") ? remaining : target - remaining;
  if (value < 0) value = 0;

  let workingEvents = [...events];
  const hasUserYellow = workingEvents.some(ev => ev.color === 'yellow');
  const hasUserRed = workingEvents.some(ev => ev.color === 'red');

  if (!hasUserYellow && target >= 10) workingEvents.push({ seconds: 10, color: 'yellow' });
  if (!hasUserRed && target >= 2) workingEvents.push({ seconds: 2, color: 'red' });

  const sorted = [...workingEvents].sort((a, b) => a.seconds - b.seconds);
  let active = null;
  for (let ev of sorted) {
    if (value <= ev.seconds) {
      active = ev;
      break;
    }
  }

  if (active) {
    if (active.color === 'green') greenLight.classList.add('active');
    else if (active.color === 'yellow') yellowLight.classList.add('active');
    else redLight.classList.add('active');
  }
}

// --- events management (unchanged) ---
function renderEvents() {
  if (!eventsListDiv) return;
  eventsListDiv.innerHTML = '';
  events.sort((a,b) => a.seconds - b.seconds);
  events.forEach((ev, idx) => {
    const t = formatTime(ev.seconds);
    const str = (t.hrs !== '00' ? `${t.hrs}:` : '') + `${t.mins}:${t.secs}`;
    const div = document.createElement('div');
    div.className = 'event-item';
    div.innerHTML = `
      <div><span class="color-badge ${ev.color}"></span><span class="time">${str}</span></div>
      <button data-idx="${idx}">✖</button>
    `;
    div.querySelector('button').addEventListener('click', () => {
      events.splice(idx, 1);
      renderEvents();
      updateTraffic();
    });
    eventsListDiv.appendChild(div);
  });
}
function addEvent(hrs, mins, secs, color) {
  let h = parseInt(hrs)||0, m = parseInt(mins)||0, s = parseInt(secs)||0;
  if (s > 59) s = 59;
  const total = h*3600 + m*60 + s;
  if (total < 0) return false;
  if (target === 0) {
    alert('Set timer time first.');
    return false;
  }
  if (total > target) {
    alert('Event time cannot exceed timer duration.');
    return false;
  }
  events.push({ seconds: total, color: color });
  events.sort((a,b) => a.seconds - b.seconds);
  renderEvents();
  updateTraffic();
  return true;
}
function openEventModal() {
  eventHours.value = 0;
  eventMins.value = 0;
  eventSecs.value = 0;
  eventModal.style.display = 'flex';
  eventHours.focus();
}
function closeEventModal() { eventModal.style.display = 'none'; }
if (addEventBtn) addEventBtn.addEventListener('click', openEventModal);
confirmEvent.addEventListener('click', () => {
  const sel = document.querySelector('input[name="eventColor"]:checked').value;
  addEvent(eventHours.value, eventMins.value, eventSecs.value, sel);
  closeEventModal();
});
cancelEvent.addEventListener('click', closeEventModal);
eventModal.addEventListener('click', (e) => { if (e.target === eventModal) closeEventModal(); });

// --- actual timer update (the "tick" that changes remaining) ---
function timerUpdate() {
  if (!timerActive) return;

  if (mode === "down") {
    if (remaining <= 0 && !continueDesc) {
      if (remaining === 0) {
        stopTimer();
        startPauseBtn.innerHTML = '▶';
        if (!zeroCrossed) {
          beep(880,1);
          toast('⏰ Time\'s up!');
          flash('#dc2626');
          zeroCrossed = true;
        }
        updateTraffic();
        updateDisplay();
      }
      return;
    }
    remaining--;
    if (!zeroCrossed && remaining < 0) {
      zeroCrossed = true;
      beep(880,1);
      toast('⏰ Time\'s up! (continuing)');
      flash('#dc2626');
    }
    if (!halfTriggered && target>0 && remaining <= target/2 && remaining>=0) {
      halfTriggered = true;
      flash('#eab308');
    }
  } else { // ascending
    remaining++;
    if (!finishNotified && remaining >= target && target>0) {
      finishNotified = true;
      beep(880,1);
      toast('⏰ Target reached – continuing');
      flash('#dc2626');
    }
    if (!halfTriggered && target>0 && remaining >= target/2) {
      halfTriggered = true;
      flash('#eab308');
    }
  }
  updateDisplay();
  updateTraffic();
}

// --- accurate timer scheduling ---
function scheduleTick() {
  if (!timerActive) return;
  expected = performance.now() + 1000;
  timerTimeout = setTimeout(accurateTick, 1000);
}
function accurateTick() {
  if (!timerActive) return;
  const now = performance.now();
  const drift = now - expected;

  timerUpdate();      // perform one second update

  // schedule next tick, correcting for drift
  expected += 1000;
  const nextDelay = Math.max(0, 1000 - drift);
  timerTimeout = setTimeout(accurateTick, nextDelay);
}

// --- start / pause / main timer ---
function startMainTimer() {
  if (timerActive) return;
  if (mode === "down" && remaining <= 0 && !continueDesc) return;
  timerActive = true;
  // reset drift compensation
  expected = performance.now() + 1000;
  timerTimeout = setTimeout(accurateTick, 1000);
  startPauseBtn.innerHTML = '⏸';
  flash('#10b981');
}
function startTimer() {
  if (timerActive) return;
  if (mode === "down" && remaining <= 0 && !continueDesc) return;

  if (prepTotal > 0 && !isPreparing && !prepUsed) {
    isPreparing = true;
    savedRemaining = remaining;
    savedTarget = target;
    prepCurrent = prepTotal;
    if (prepTimerDisplay) {
      prepTimerDisplay.style.display = 'inline-block';
      updatePrepDisplay(prepCurrent);
    }
    if (prepIndicator) prepIndicator.style.display = 'inline-block';
    updateDisplay();
    flash('#10b981');
    timerActive = true;
    expected = performance.now() + 1000;
    timerTimeout = setTimeout(function prepTickLoop() {
      if (!timerActive) return;
      if (prepCurrent <= 0) {
        stopTimer();
        startPauseBtn.innerHTML = '▶';
        isPreparing = false;
        prepUsed = true;
        if (prepTimerDisplay) prepTimerDisplay.style.display = 'none';
        if (prepIndicator) prepIndicator.style.display = 'none';
        remaining = savedRemaining;
        target = savedTarget;
        updateDisplay();
        updateTraffic();
        return;
      }
      prepCurrent--;
      updatePrepDisplay(prepCurrent);
      expected += 1000;
      const delay = Math.max(0, 1000 - (performance.now() - expected));
      timerTimeout = setTimeout(prepTickLoop, delay);
    }, 1000);
    startPauseBtn.innerHTML = '⏸';
    return;
  }
  startMainTimer();
}
function pauseTimer() {
  if (!timerActive) return;
  stopTimer();
  startPauseBtn.innerHTML = '▶';
}
function toggleStartPause() {
  if (timerActive) pauseTimer();
  else startTimer();
}

// --- preparation tick (separate) but we moved it inside startTimer; keep old prepTick removed ---
// (preparation is handled inline in startTimer, no separate prepTick needed)

// --- set timer, mode, reset ---
function setTimer(h,m,s) {
  stopTimer();
  startPauseBtn.innerHTML = '▶';
  if (isPreparing) {
    isPreparing = false;
    if (prepTimerDisplay) prepTimerDisplay.style.display = 'none';
    if (prepIndicator) prepIndicator.style.display = 'none';
    prepUsed = false;
  }
  let hh = parseInt(h)||0, mm = parseInt(m)||0, ss = parseInt(s)||0;
  if (ss > 59) ss = 59;
  const total = hh*3600 + mm*60 + ss;
  target = total;
  if (mode === "down") remaining = target;
  else remaining = 0;
  halfTriggered = false;
  finishNotified = false;
  zeroCrossed = false;
  prepUsed = false;
  updateDisplay();
  updateTraffic();
  timerDiv.style.color = '#0f172a';
}
function toggleMode() {
  const sel = document.querySelector('input[name="countMode"]:checked').value;
  const newMode = (sel === "up") ? "up" : "down";
  if (newMode === mode) return;
  mode = newMode;
  if (isPreparing) {
    isPreparing = false;
    if (prepTimerDisplay) prepTimerDisplay.style.display = 'none';
    if (prepIndicator) prepIndicator.style.display = 'none';
    stopTimer();
    startPauseBtn.innerHTML = '▶';
  }
  prepUsed = false;
  if (mode === "down") remaining = target;
  else remaining = 0;
  halfTriggered = false;
  finishNotified = false;
  zeroCrossed = false;
  updateDisplay();
  updateTraffic();
  timerDiv.style.color = '#0f172a';
}
function resetTimer() {
  stopTimer();
  startPauseBtn.innerHTML = '▶';
  prepUsed = false;
  if (isPreparing) {
    isPreparing = false;
    if (prepTimerDisplay) prepTimerDisplay.style.display = 'none';
    if (prepIndicator) prepIndicator.style.display = 'none';
    remaining = (mode === "down") ? target : 0;
  } else {
    remaining = (mode === "down") ? target : 0;
  }
  halfTriggered = false;
  finishNotified = false;
  zeroCrossed = false;
  updateDisplay();
  updateTraffic();
  timerDiv.style.color = '#0f172a';
}

// --- modal handlers (unchanged) ---
function openSettings() {
  const toCheck = (mode === "down") ? document.querySelector('input[value="down"]') : document.querySelector('input[value="up"]');
  if (toCheck) toCheck.checked = true;
  settingsModal.style.display = 'flex';
}
function closeSettingsModal() { settingsModal.style.display = 'none'; }
menuBtn.addEventListener('click', openSettings);
closeSettings.addEventListener('click', closeSettingsModal);
settingsModal.addEventListener('click', (e) => { if (e.target === settingsModal) closeSettingsModal(); });

setTimeBtn.addEventListener('click', () => {
  closeSettingsModal();
  openTimeModal();
});
function openTimeModal() {
  const cur = (mode === "down") ? target : remaining;
  modHours.value = Math.floor(cur / 3600);
  modMins.value = Math.floor((cur % 3600) / 60);
  modSecs.value = cur % 60;
  timeModal.style.display = 'flex';
  modHours.focus();
}
function closeTimeModal() { timeModal.style.display = 'none'; }
confirmTime.addEventListener('click', () => {
  setTimer(modHours.value, modMins.value, modSecs.value);
  closeTimeModal();
  openSettings();
});
cancelTime.addEventListener('click', () => {
  closeTimeModal();
  openSettings();
});
timeModal.addEventListener('click', (e) => { if (e.target === timeModal) closeTimeModal(); });

modeRadios.forEach(r => {
  r.addEventListener('change', () => {
    toggleMode();
  });
});

resetBtn.addEventListener('click', resetTimer);
startPauseBtn.addEventListener('click', toggleStartPause);

if (helpBtn && helpModal) {
  helpBtn.addEventListener('click', () => helpModal.style.display = 'flex');
  closeHelp.addEventListener('click', () => helpModal.style.display = 'none');
  helpModal.addEventListener('click', (e) => { if (e.target === helpModal) helpModal.style.display = 'none'; });
}

// --- hotkeys ---
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
  switch (e.key) {
    case ' ': case 'Space': e.preventDefault(); toggleStartPause(); break;
    case 'r': case 'R': e.preventDefault(); resetTimer(); break;
    case 's': case 'S': e.preventDefault(); openSettings(); break;
    case 'e': case 'E': e.preventDefault(); if (typeof openEventModal === 'function') openEventModal(); break;
  }
});

// --- initialisation ---
loadContinue();
loadPrep();
remaining = 0;
target = 0;
updateDisplay();
updateTraffic();
timerDiv.style.color = '#0f172a';
