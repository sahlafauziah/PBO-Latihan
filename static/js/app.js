// =====================================================================
// app.js — logika UI mobile: navigasi tab, koneksi ke API Flask
// (yang dibangun di atas class OOP: ScreenTimeTracker, ReminderManager,
// TaskManager), dan notifikasi browser.
// =====================================================================

const DIAL_CIRCUMFERENCE = 2 * Math.PI * 84;   // r=84, dial screen time
const SCORE_RING_CIRCUMFERENCE = 2 * Math.PI * 58; // r=58, ring skor home

// ----------------------- TOAST -----------------------

function showToast(message, variant = "default") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.remove("toast--danger", "toast--success");
  if (variant === "danger") toast.classList.add("toast--danger");
  if (variant === "success") toast.classList.add("toast--success");
  toast.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

// ----------------------- API HELPER -----------------------

async function api(path, method = "GET", body = null) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.error || "Terjadi kesalahan");
  }
  return data;
}

// ----------------------- BOTTOM NAV -----------------------

function goToScreen(name) {
  document.querySelectorAll(".screen").forEach((el) => {
    el.classList.toggle("is-active", el.dataset.screen === name);
  });
  document.querySelectorAll(".bottomnav__item").forEach((el) => {
    el.classList.toggle("is-active", el.dataset.nav === name);
  });
}

document.querySelectorAll(".bottomnav__item").forEach((btn) => {
  btn.addEventListener("click", () => goToScreen(btn.dataset.nav));
});

// ----------------------- BROWSER NOTIFICATIONS -----------------------
// Catatan: notifikasi ini hanya akan muncul selama tab/browser ini
// terbuka (boleh di-minimize atau pindah app sebentar di HP), karena
// pengecekan jadwal dijalankan oleh JavaScript di halaman ini.

function updateBellIcon() {
  const btn = document.getElementById("enableNotifBtn");
  const icon = document.getElementById("bellIcon");
  if (!("Notification" in window)) {
    icon.textContent = "🔕";
    return;
  }
  if (Notification.permission === "granted") {
    btn.classList.add("is-on");
    icon.textContent = "🔔";
  } else {
    btn.classList.remove("is-on");
    icon.textContent = "🔕";
  }
}

function requestNotificationPermission() {
  if (!("Notification" in window)) {
    showToast("Browser ini tidak mendukung notifikasi", "danger");
    return;
  }
  if (Notification.permission === "default") {
    Notification.requestPermission().then(() => {
      updateBellIcon();
      if (Notification.permission === "granted") {
        showToast("Notifikasi diaktifkan ✅", "success");
      }
    });
  } else if (Notification.permission === "granted") {
    showToast("Notifikasi sudah aktif ✅", "success");
  } else {
    showToast("Notifikasi diblokir. Aktifkan lewat setelan browser.", "danger");
  }
}

document.getElementById("enableNotifBtn").addEventListener("click", requestNotificationPermission);

function sendBrowserNotification(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body });
  } else {
    showToast(`${title} — ${body}`);
  }
}

// ----------------------- ALARM SOUND -----------------------
// Dibuat langsung lewat Web Audio API (tanpa file suara eksternal),
// supaya ringan dan tidak bergantung pada koneksi internet/lisensi audio.
// Bunyinya 3 nada pendek berurutan, seperti bip alarm sederhana.

function playAlarmSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const beepTimes = [0, 0.3, 0.6];
    beepTimes.forEach((startAt) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.18;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime + startAt;
      osc.start(t);
      osc.stop(t + 0.22);
    });
  } catch (err) {
    console.error("Tidak bisa memutar bunyi alarm:", err);
  }
}

// ----------------------- MODAL: WAKTU HABIS -----------------------
// Modal besar di tengah layar, tidak hilang otomatis — baru tertutup
// kalau user menekan tombol "OK, Mengerti". Dipakai supaya peringatan
// waktu habis tidak terlewat begitu saja seperti toast kecil.

function showTimeUpModal(message) {
  document.getElementById("timeUpModalText").textContent = message;
  document.getElementById("timeUpModal").hidden = false;
}

function hideTimeUpModal() {
  document.getElementById("timeUpModal").hidden = true;
}

document.getElementById("timeUpModalOkBtn").addEventListener("click", hideTimeUpModal);

// Menyimpan id reminder yang sudah dinotifikasi HARI INI, supaya tidak
// berulang-ulang kirim notifikasi yang sama.
const notifiedKey = () => `notified-${new Date().toDateString()}`;
function getNotifiedToday() {
  try {
    return JSON.parse(sessionStorage.getItem(notifiedKey()) || "[]");
  } catch {
    return [];
  }
}
function markNotifiedToday(id) {
  const list = getNotifiedToday();
  if (!list.includes(id)) {
    list.push(id);
    sessionStorage.setItem(notifiedKey(), JSON.stringify(list));
  }
}

async function checkReminderNotifications() {
  try {
    const summary = await api("/api/reminders");
    const nowHHMM = new Date().toTimeString().slice(0, 5);
    const notifiedToday = getNotifiedToday();

    summary.reminders.forEach((r) => {
      if (r.is_done || notifiedToday.includes(r.id)) return;
      if (r.time && r.time <= nowHHMM) {
        sendBrowserNotification("Waktunya belajar 📚", r.title);
        markNotifiedToday(r.id);
      }
    });
  } catch (err) {
    console.error("Gagal memeriksa reminder:", err);
  }
}

let lastKnownOverLimit = false;
function notifyIfOverLimit(summary) {
  if (summary.over_limit && !lastKnownOverLimit) {
    sendBrowserNotification(
      "Waktu screen time sudah habis ⏰",
      `Kamu sudah memakai HP ${summary.today_usage_minutes} menit hari ini, melebihi target ${summary.daily_limit_minutes} menit.`
    );
  }
  lastKnownOverLimit = summary.over_limit;
}

async function checkScreenTimeNotification() {
  try {
    const summary = await api("/api/screentime");
    notifyIfOverLimit(summary);
  } catch (err) {
    console.error("Gagal memeriksa screen time:", err);
  }
}

// ----- Pengingat berulang untuk tugas yang belum selesai (overdue) -----
// Berbeda dari reminder jadwal (yang cuma sekali notif saat jamnya tiba),
// tugas yang sudah lewat deadline dan masih belum selesai akan terus
// diingatkan ulang setiap beberapa menit, supaya tidak terlupakan.
const OVERDUE_REMINDER_INTERVAL_MS = 60 * 60 * 1000; // 1 jam
let lastOverdueNotifAt = 0;

async function checkOverdueTaskNotifications() {
  try {
    const summary = await api("/api/tasks");
    const overdue = summary.needs_reminder || [];
    if (overdue.length === 0) return;

    const now = Date.now();
    if (now - lastOverdueNotifAt < OVERDUE_REMINDER_INTERVAL_MS) return;

    if (overdue.length === 1) {
      sendBrowserNotification("Tugas belum selesai 📌", `"${overdue[0].title}" sudah lewat/jatuh deadline hari ini.`);
    } else {
      sendBrowserNotification("Tugas belum selesai 📌", `Ada ${overdue.length} tugas yang sudah lewat/jatuh deadline dan belum selesai.`);
    }
    lastOverdueNotifAt = now;
  } catch (err) {
    console.error("Gagal memeriksa tugas overdue:", err);
  }
}

// ----- Ajakan belajar di waktu kosong -----
// Mengecek apakah waktu saat ini berada tepat di AWAL salah satu slot
// kosong (dihitung dari jam aktif dikurangi jam reminder yang sudah
// ada). Dinotifikasi sekali per slot per hari.
async function checkFreeSlotNotifications() {
  try {
    const summary = await api("/api/reminders");
    const nowHHMM = new Date().toTimeString().slice(0, 5);
    const notifiedToday = getNotifiedToday();

    (summary.free_slots || []).forEach((slot) => {
      const slotKey = `freeslot-${slot.start}`;
      if (notifiedToday.includes(slotKey)) return;
      if (slot.start === nowHHMM) {
        sendBrowserNotification("Waktu kosong, yuk belajar 📖", `Kamu punya waktu kosong ${slot.start}–${slot.end}. Cocok untuk mengerjakan tugas.`);
        markNotifiedToday(slotKey);
      }
    });
  } catch (err) {
    console.error("Gagal memeriksa slot kosong:", err);
  }
}

// ----------------------- SCREEN TIME -----------------------

function renderScreenTime(summary) {
  const statusEl = document.getElementById("usageStatus");
  const totalValueEl = document.getElementById("todayTotalValue");
  const badgeEl = document.getElementById("todayTotalBadge");

  totalValueEl.textContent = `${summary.today_usage_minutes} menit`;
  badgeEl.textContent = summary.over_limit ? "Lewat batas" : "Aman";
  badgeEl.classList.toggle("is-over", summary.over_limit);

  if (summary.over_limit) {
    statusEl.textContent = `Sudah lewat ${summary.today_usage_minutes - summary.daily_limit_minutes} menit dari target ${summary.daily_limit_minutes} menit.`;
  } else if (summary.today_usage_minutes === 0) {
    statusEl.textContent = `Belum ada aktivitas tercatat. Target harianmu ${summary.daily_limit_minutes} menit.`;
  } else {
    statusEl.textContent = `Sisa ${summary.remaining_minutes} menit sebelum target ${summary.daily_limit_minutes} menit tercapai.`;
  }

  document.getElementById("limitInput").value = summary.daily_limit_minutes;

  // mini stat di home
  document.getElementById("miniScreenTime").textContent = `${summary.today_usage_minutes}m`;
}

async function loadScreenTime() {
  const summary = await api("/api/screentime");
  renderScreenTime(summary);
  return summary;
}

async function logUsage(minutes) {
  try {
    const res = await api("/api/screentime/log", "POST", { minutes });
    renderScreenTime(res.summary);
    notifyIfOverLimit(res.summary);
    refreshReport();
  } catch (err) {
    showToast(err.message, "danger");
  }
}

document.getElementById("setLimitForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("limitInput");
  const limit_minutes = parseInt(input.value, 10);
  try {
    const res = await api("/api/screentime/limit", "PUT", { limit_minutes });
    renderScreenTime(res.summary);
    showToast("Target screen time diperbarui ✓", "success");
    refreshReport();
  } catch (err) {
    showToast(err.message, "danger");
  }
});

// ----------------------- TIMER COUNTDOWN -----------------------
// Timer sesi penggunaan HP: user set durasi, tekan Mulai, lalu waktu
// berjalan mundur sendiri (tanpa jeda/stop, sesuai keputusan desain).
// Begitu mencapai 0, sistem otomatis mencatat durasi tersebut ke total
// screen time hari ini DAN mengirim notifikasi peringatan.

const TIMER_CIRCUMFERENCE = DIAL_CIRCUMFERENCE; // dial timer pakai svg yg sama
let timerState = {
  running: false,
  totalSeconds: 0,
  remainingSeconds: 0,
  endAt: 0,        // timestamp (ms) target selesai -- patokan akurasi
  intervalId: null,
  minutes: 0,
};

function formatMMSS(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function renderTimerTick() {
  const display = document.getElementById("timerDisplay");
  const progress = document.getElementById("timerProgress");

  display.textContent = formatMMSS(timerState.remainingSeconds);

  const ratio = timerState.totalSeconds > 0
    ? timerState.remainingSeconds / timerState.totalSeconds
    : 0;
  // progress menyusut seiring waktu berjalan (lingkaran "habis" pelan-pelan)
  progress.style.strokeDashoffset = TIMER_CIRCUMFERENCE * (1 - ratio);
  progress.style.stroke = "var(--primary)";
}

function setTimerFormDisabled(disabled) {
  document.getElementById("timerMinutesInput").disabled = disabled;
  document.getElementById("startTimerBtn").disabled = disabled;
  document.querySelectorAll("#timerSetupArea .chip").forEach((c) => (c.disabled = disabled));
  document.getElementById("startTimerBtn").textContent = disabled ? "Sedang berjalan..." : "Mulai";
}

function startTimer(minutes) {
  if (!minutes || minutes <= 0) return;
  if (timerState.running) {
    showToast("Timer sedang berjalan, tunggu sampai selesai.", "danger");
    return;
  }

  timerState.totalSeconds = minutes * 60;
  timerState.remainingSeconds = minutes * 60;
  timerState.endAt = Date.now() + minutes * 60 * 1000;
  timerState.running = true;
  timerState.minutes = minutes;

  document.querySelector(".dial-card").classList.add("is-running");
  document.getElementById("timerUnit").textContent = "menit:detik tersisa";
  document.getElementById("timerStatus").textContent =
    `Sesi sedang berjalan. Notifikasi akan muncul setelah ${minutes} menit.`;
  setTimerFormDisabled(true);
  renderTimerTick();

  // Pakai patokan timestamp absolut (endAt - now), bukan sekadar -1 tiap
  // tick. Ini penting di HP: kalau tab di-minimize sebentar, setInterval
  // bisa "ditahan" oleh browser, tapi begitu tab aktif lagi, sisa waktu
  // tetap terhitung akurat berdasarkan jam asli, bukan jumlah tick yang
  // sempat berjalan.
  timerState.intervalId = setInterval(() => {
    const remainingMs = timerState.endAt - Date.now();
    if (remainingMs <= 0) {
      finishTimer(timerState.minutes);
      return;
    }
    timerState.remainingSeconds = Math.ceil(remainingMs / 1000);
    renderTimerTick();
  }, 1000);
}

async function finishTimer(minutes) {
  clearInterval(timerState.intervalId);
  timerState.running = false;
  timerState.remainingSeconds = 0;
  renderTimerTick();

  document.querySelector(".dial-card").classList.remove("is-running");
  document.getElementById("timerUnit").textContent = "menit:detik";
  document.getElementById("timerStatus").textContent =
    "Waktu habis! Durasi sesi sudah ditambahkan ke total hari ini.";
  setTimerFormDisabled(false);
  document.getElementById("timerMinutesInput").value = "";

  sendBrowserNotification(
    "Waktu habis ⏰",
    `Sesi ${minutes} menit kamu sudah selesai. Yuk berhenti scroll dan lanjut ke aktivitas lain.`
  );
  playAlarmSound();
  showTimeUpModal(`Sesi ${minutes} menit sudah selesai. Yuk berhenti scroll dan lanjut ke aktivitas lain 🙂`);

  // Catat otomatis ke total screen time hari ini
  await logUsage(minutes);
}

document.querySelectorAll("#timerSetupArea .chip").forEach((btn) => {
  btn.addEventListener("click", () => startTimer(parseInt(btn.dataset.timerMinutes, 10)));
});

document.getElementById("startTimerForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("timerMinutesInput");
  const minutes = parseInt(input.value, 10);
  startTimer(minutes);
});

// Saat tab/HP kembali aktif setelah di-minimize/terkunci, langsung cek
// apakah timer sebenarnya sudah habis selagi tab tidak aktif. Browser
// HP sering "menahan" setInterval saat tab di background, jadi
// pengecekan ekstra ini memastikan finishTimer tidak terlewat.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && timerState.running) {
    const remainingMs = timerState.endAt - Date.now();
    if (remainingMs <= 0) {
      finishTimer(timerState.minutes);
    } else {
      timerState.remainingSeconds = Math.ceil(remainingMs / 1000);
      renderTimerTick();
    }
  }
});

// ----------------------- REMINDERS -----------------------

function renderReminders(summary) {
  const list = document.getElementById("reminderList");
  list.innerHTML = "";

  if (summary.reminders.length === 0) {
    list.innerHTML = `<li class="empty-hint">Belum ada pengingat. Tambahkan jadwal belajarmu di atas.</li>`;
  } else {
    summary.reminders.forEach((r) => {
      const li = document.createElement("li");
      li.className = "list-item" + (r.is_done ? " is-done" : "");
      li.innerHTML = `
        <div class="list-item__main">
          <span class="list-item__title">${escapeHtml(r.title)}</span>
          <span class="list-item__meta">
            <span>🕐 ${r.time}</span>
            <span>${escapeHtml(r.repeat)}</span>
          </span>
        </div>
        <div class="list-item__actions">
          ${!r.is_done ? `<button class="icon-btn icon-btn--done" data-action="complete-reminder" data-id="${r.id}">✓</button>` : ""}
          <button class="icon-btn icon-btn--danger" data-action="delete-reminder" data-id="${r.id}">✕</button>
        </div>
      `;
      list.appendChild(li);
    });
  }

  document.getElementById("miniReminders").textContent = summary.active_count;
  renderAgenda(summary);
  renderFreeSlots(summary);
}

function renderAgenda(reminderSummary) {
  const agenda = document.getElementById("agendaList");
  const active = reminderSummary.reminders.filter((r) => !r.is_done);
  if (active.length === 0) {
    agenda.innerHTML = `<li class="empty-hint">Belum ada jadwal hari ini.</li>`;
    return;
  }
  const sorted = [...active].sort((a, b) => a.time.localeCompare(b.time));
  agenda.innerHTML = sorted
    .slice(0, 4)
    .map(
      (r) => `
      <li class="agenda-item">
        <span class="agenda-item__time">${r.time}</span>
        <span class="agenda-item__title">${escapeHtml(r.title)}</span>
      </li>`
    )
    .join("");
}

function renderFreeSlots(reminderSummary) {
  document.getElementById("activeHoursHint").textContent =
    `Jam aktif: ${reminderSummary.active_hours.start} – ${reminderSummary.active_hours.end}`;
  document.getElementById("activeStartInput").value = reminderSummary.active_hours.start;
  document.getElementById("activeEndInput").value = reminderSummary.active_hours.end;

  const list = document.getElementById("freeSlotList");
  const slots = reminderSummary.free_slots || [];
  if (slots.length === 0) {
    list.innerHTML = `<li class="empty-hint">Tidak ada waktu kosong tersisa hari ini — jadwalmu sudah penuh 🎉</li>`;
    return;
  }
  list.innerHTML = slots
    .map(
      (s) => `
      <li class="freeslot-item">
        <span class="freeslot-item__icon">📖</span>
        <span class="freeslot-item__text">${s.start} – ${s.end} kosong, cocok untuk belajar</span>
      </li>`
    )
    .join("");
}

document.getElementById("editActiveHoursBtn").addEventListener("click", () => {
  const form = document.getElementById("activeHoursForm");
  form.hidden = !form.hidden;
});

document.getElementById("activeHoursForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const start = document.getElementById("activeStartInput").value;
  const end = document.getElementById("activeEndInput").value;
  try {
    const res = await api("/api/reminders/active-hours", "PUT", { start, end });
    renderFreeSlots(res.summary);
    document.getElementById("activeHoursForm").hidden = true;
    showToast("Jam aktif diperbarui ✓", "success");
  } catch (err) {
    showToast(err.message, "danger");
  }
});

async function loadReminders() {
  const summary = await api("/api/reminders");
  renderReminders(summary);
  return summary;
}

document.getElementById("reminderForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("reminderTitle");
  const time = document.getElementById("reminderTime");
  const repeat = document.getElementById("reminderRepeat");
  try {
    await api("/api/reminders", "POST", {
      title: title.value,
      time: time.value,
      repeat: repeat.value,
    });
    title.value = "";
    time.value = "";
    repeat.value = "sekali";
    await loadReminders();
    showToast("Pengingat ditambahkan ✓", "success");
    refreshReport();
  } catch (err) {
    showToast(err.message, "danger");
  }
});

// ----------------------- TASKS -----------------------

function renderTasks(summary) {
  const list = document.getElementById("taskList");
  list.innerHTML = "";

  if (summary.tasks.length === 0) {
    list.innerHTML = `<li class="empty-hint">Belum ada tugas. Tugas barumu akan muncul di sini.</li>`;
  } else {
    summary.tasks.forEach((t) => {
      const li = document.createElement("li");
      li.className = "list-item" + (t.is_done ? " is-done" : "");
      li.innerHTML = `
        <div class="list-item__main">
          <span class="list-item__title">${escapeHtml(t.title)}</span>
          <span class="list-item__meta">
            <span class="tag tag--${t.priority}">${t.priority}</span>
            ${t.deadline ? `<span>📅 ${t.deadline}</span>` : ""}
          </span>
        </div>
        <div class="list-item__actions">
          ${!t.is_done ? `<button class="icon-btn icon-btn--done" data-action="complete-task" data-id="${t.id}">✓</button>` : ""}
          <button class="icon-btn icon-btn--danger" data-action="delete-task" data-id="${t.id}">✕</button>
        </div>
      `;
      list.appendChild(li);
    });
  }

  document.getElementById("miniTasks").textContent = `${summary.done_count}/${summary.total_tasks}`;
}

async function loadTasks() {
  const summary = await api("/api/tasks");
  renderTasks(summary);
  return summary;
}

document.getElementById("taskForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("taskTitle");
  const deadline = document.getElementById("taskDeadline");
  const priority = document.getElementById("taskPriority");
  try {
    await api("/api/tasks", "POST", {
      title: title.value,
      deadline: deadline.value || null,
      priority: priority.value,
    });
    title.value = "";
    deadline.value = "";
    priority.value = "sedang";
    await loadTasks();
    showToast("Tugas ditambahkan ✓", "success");
    refreshReport();
  } catch (err) {
    showToast(err.message, "danger");
  }
});

// ----------------------- DELEGATED ACTIONS -----------------------

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;

  try {
    if (action === "complete-reminder") {
      await api(`/api/reminders/${id}/complete`, "PUT");
      await loadReminders();
    } else if (action === "delete-reminder") {
      await api(`/api/reminders/${id}`, "DELETE");
      await loadReminders();
    } else if (action === "complete-task") {
      await api(`/api/tasks/${id}/complete`, "PUT");
      await loadTasks();
    } else if (action === "delete-task") {
      await api(`/api/tasks/${id}`, "DELETE");
      await loadTasks();
    }
    refreshReport();
  } catch (err) {
    showToast(err.message, "danger");
  }
});

// ----------------------- DAILY REPORT (home score) -----------------------

async function refreshReport() {
  const report = await api("/api/report");
  const score = report.productivity_score;

  const ring = document.getElementById("scoreRingProgress");
  const ratio = Math.max(0, Math.min(score / 100, 1));
  ring.style.strokeDashoffset = SCORE_RING_CIRCUMFERENCE * (1 - ratio);
  ring.style.stroke = score >= 70 ? "var(--teal)" : score >= 40 ? "var(--yellow)" : "var(--danger)";

  document.getElementById("scoreValue").textContent = score;

  const msgEl = document.getElementById("scoreMessage");
  if (score >= 80) {
    msgEl.textContent = "Mantap! Produktivitasmu hari ini bagus sekali 🎉";
  } else if (score >= 50) {
    msgEl.textContent = "Lumayan! Coba selesaikan beberapa tugas lagi ya.";
  } else {
    msgEl.textContent = "Masih bisa lebih baik. Yuk kurangi screen time & kerjakan tugas.";
  }

  return report;
}

// ----------------------- DATE HEADER -----------------------

function renderTodayDate() {
  const el = document.getElementById("todayDate");
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const now = new Date();
  el.textContent = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

// ----------------------- UTIL -----------------------

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// ----------------------- INIT -----------------------

(async function init() {
  renderTodayDate();
  updateBellIcon();

  // render dial timer dalam keadaan kosong/penuh sebelum timer dimulai
  document.getElementById("timerProgress").style.strokeDashoffset = 0;

  try {
    const [st] = await Promise.all([loadScreenTime(), loadReminders(), loadTasks()]);
    lastKnownOverLimit = st.over_limit;
    await refreshReport();

    setInterval(checkReminderNotifications, 30000);
    setInterval(checkScreenTimeNotification, 30000);
    setInterval(checkOverdueTaskNotifications, 30000);
    setInterval(checkFreeSlotNotifications, 30000);
  } catch (err) {
    showToast("Gagal memuat data awal", "danger");
    console.error(err);
  }
})();
