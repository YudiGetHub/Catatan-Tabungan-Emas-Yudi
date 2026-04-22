// ============================================================
//  Firebase Config
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyBjZgLGUsSKHQM94KBAdhCRW7jwASKHYyE",
  authDomain: "emasku-yudi.firebaseapp.com",
  projectId: "emasku-yudi",
  storageBucket: "emasku-yudi.firebasestorage.app",
  messagingSenderId: "548455079268",
  appId: "1:548455079268:web:2c9f2b520be0b4eb316e71",
  measurementId: "G-VMNGN5SJ30"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ============================================================
//  State
// ============================================================
let transactions = [];
let selectedId = null;
let currentUser = null;
let unsubscribeEmas = null;
let availableYears = [];
let currentView = "dashboard";

const MONTHS = [
  "Januari","Februari","Maret","April","Mei","Juni",
  "Juli","Agustus","September","Oktober","November","Desember"
];

// ============================================================
//  Helpers
// ============================================================
function getDateParts(dateValue) {
  if (!dateValue) return null;
  if (typeof dateValue === "string" && dateValue.includes("-")) {
    const [y, m, d] = dateValue.split("-");
    if (!y || !m || !d) return null;
    return { y, m, d, monthIndex: String(parseInt(m, 10) - 1) };
  }
  if (dateValue && typeof dateValue.toDate === "function") {
    const dt = dateValue.toDate();
    const y = String(dt.getFullYear());
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return { y, m, d, monthIndex: String(dt.getMonth()) };
  }
  if (typeof dateValue === "object" && typeof dateValue.seconds === "number") {
    const dt = new Date(dateValue.seconds * 1000);
    const y = String(dt.getFullYear());
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return { y, m, d, monthIndex: String(dt.getMonth()) };
  }
  return null;
}

function toDateString(dateValue) {
  const p = getDateParts(dateValue);
  return p ? `${p.y}-${p.m}-${p.d}` : "";
}

function formatIDR(n) {
  return "Rp " + (Number(n) || 0).toLocaleString("id-ID");
}

function formatIDRPlain(n) {
  return (Number(n) || 0).toLocaleString("id-ID");
}

function parseIDR(str) {
  if (str == null) return 0;
  const digits = String(str).replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

function formatIDRInputValue(str) {
  const n = parseIDR(str);
  return n ? n.toLocaleString("id-ID") : "";
}

function setupIDRInput(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("input", () => { el.value = formatIDRInputValue(el.value); });
  el.addEventListener("blur", () => { el.value = formatIDRInputValue(el.value); });
}

function setLoginMessage(text, isError = false) {
  const el = document.getElementById("login-error");
  el.style.display = "block";
  el.classList.toggle("error", isError);
  el.innerText = text;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function formatRpPerGram(value) {
  if (!isFinite(value) || value <= 0) return "-";
  return "Rp " + Math.round(value).toLocaleString("id-ID") + "/Gr";
}

// ============================================================
//  Motivasi Harian (Online → Fallback Lokal)
// ============================================================
async function loadMotivation() {
  const textEl = document.getElementById("motivation-text");
  const authorEl = document.getElementById("motivation-author");

  const today = new Date().toISOString().slice(0, 10);
  const cached = localStorage.getItem("emasku_motivation");

  if (cached) {
    try {
      const data = JSON.parse(cached);
      if (data.date === today && data.text) {
        textEl.innerText = `"${data.text}"`;
        authorEl.innerText = data.author ? `— ${data.author}` : "";
        return;
      }
    } catch {}
  }

  try {
    let quote = null;

    // API 1: ZenQuotes via proxy
    try {
      const res = await fetch("https://api.allorigins.win/get?url=" + encodeURIComponent("https://zenquotes.io/api/today"));
      const json = await res.json();
      const parsed = JSON.parse(json.contents);
      if (parsed?.[0]) quote = { text: parsed[0].q, author: parsed[0].a };
    } catch {}

    // API 2: DummyJSON
    if (!quote) {
      try {
        const res = await fetch("https://dummyjson.com/quotes/random");
        const data = await res.json();
        if (data?.quote) quote = { text: data.quote, author: data.author };
      } catch {}
    }

    if (quote) {
      textEl.innerText = `"${quote.text}"`;
      authorEl.innerText = quote.author ? `— ${quote.author}` : "";
      localStorage.setItem("emasku_motivation", JSON.stringify({
        date: today, text: quote.text, author: quote.author || ""
      }));
    } else {
      showLocalMotivation(textEl, authorEl, today);
    }
  } catch {
    showLocalMotivation(textEl, authorEl, today);
  }
}

function showLocalMotivation(textEl, authorEl, today) {
  const dayNum = parseInt(today.replace(/-/g, ""), 10);
  const pool = [
    { t: "Kekayaan sejati adalah disiplin yang konsisten setiap hari.", a: "Anonim" },
    { t: "Sedikit demi sedikit, lama-lama menjadi bukit emas.", a: "Pepatah" },
    { t: "Investasi terbaik adalah investasi pada diri sendiri.", a: "Warren Buffett" },
    { t: "Jangan menunggu waktu yang tepat, buatlah waktu menjadi tepat.", a: "Anonim" },
    { t: "Emas tidak dibentuk tanpa api, begitu pula karakter tanpa tantangan.", a: "Anonim" },
    { t: "Perjalanan seribu mil dimulai dari satu langkah.", a: "Lao Tzu" },
    { t: "Menabung hari ini adalah hadiah untuk masa depanmu.", a: "Anonim" },
    { t: "Konsistensi kecil mengalahkan usaha besar yang jarang.", a: "Anonim" },
    { t: "Waktu adalah teman terbaik bagi penabung yang sabar.", a: "Anonim" },
    { t: "Setiap gram emas adalah bukti komitmenmu pada masa depan.", a: "Anonim" },
    { t: "Disiplin adalah jembatan antara tujuan dan pencapaian.", a: "Jim Rohn" },
    { t: "Orang bijak menyimpan untuk hari esok.", a: "Pepatah" },
    { t: "Mulai dari yang kecil, bermimpi yang besar, bertindak sekarang.", a: "Robin Sharma" },
    { t: "Kebebasan finansial bukan tentang kaya, tapi tentang pilihan.", a: "Anonim" },
    { t: "Yang penting bukan seberapa banyak yang kau hasilkan, tapi seberapa banyak yang kau simpan.", a: "Robert Kiyosaki" },
    { t: "Setiap hari adalah kesempatan baru untuk menabung lebih baik.", a: "Anonim" },
    { t: "Emas akan selalu bersinar, seperti usahamu yang tak pernah berhenti.", a: "Anonim" },
    { t: "Masa depan cerah dimulai dari keputusan bijak hari ini.", a: "Anonim" },
    { t: "Langkah kecil yang konsisten lebih kuat dari lompatan besar yang sekali.", a: "Anonim" },
    { t: "Rahasia kekayaan ada pada kebiasaan, bukan keberuntungan.", a: "Anonim" },
    { t: "Tetesan air yang terus-menerus bisa melubangi batu.", a: "Pepatah Latin" },
    { t: "Jangan takut lambat, takutlah berhenti.", a: "Pepatah Tiongkok" }
  ];
  const idx = dayNum % pool.length;
  textEl.innerText = `"${pool[idx].t}"`;
  authorEl.innerText = `— ${pool[idx].a}`;
}

// ============================================================
//  Views / Tabs
// ============================================================
function setView(view) {
  currentView = view;
  const views = ["dashboard", "rekap", "input", "history"];
  for (const v of views) {
    const el = document.getElementById(`view-${v}`);
    const tab = document.getElementById(`tab-${v}`);
    if (el) el.style.display = (v === view) ? "block" : "none";
    if (tab) tab.classList.toggle("active", v === view);
  }
  if (view === "rekap") {
    syncRekapYearSelect();
    updateRekapBulanan();
  }
}

// ============================================================
//  Year Selects
// ============================================================
function computeAvailableYears() {
  const yearsSet = new Set();
  for (const t of transactions) {
    const p = getDateParts(t.date);
    if (p?.y) yearsSet.add(p.y);
  }
  availableYears = Array.from(yearsSet).sort((a, b) => Number(b) - Number(a));
}

function populateYearSelects() {
  computeAvailableYears();

  const latest = availableYears[0] || String(new Date().getFullYear());
  const savedRecap = localStorage.getItem("recap-year");
  const savedHistory = localStorage.getItem("history-year");

  const recapYear = (savedRecap && availableYears.includes(savedRecap)) ? savedRecap : latest;
  const historyYear = (savedHistory && (savedHistory === "all" || availableYears.includes(savedHistory))) ? savedHistory : latest;

  const recapSel = document.getElementById("recap-year");
  recapSel.innerHTML = availableYears.length
    ? availableYears.map(y => `<option value="${y}">${y}</option>`).join("")
    : `<option value="${latest}">${latest}</option>`;
  recapSel.value = recapYear;

  const histSel = document.getElementById("history-year");
  histSel.innerHTML = `<option value="all">Semua Tahun</option>${availableYears.map(y => `<option value="${y}">${y}</option>`).join("")}`;
  histSel.value = historyYear;

  localStorage.setItem("recap-year", recapYear);
  localStorage.setItem("history-year", historyYear);

  syncRekapYearSelect();
}

function syncRekapYearSelect() {
  const rekapSel = document.getElementById("rekap-year-select");
  if (!rekapSel) return;
  const latest = availableYears[0] || String(new Date().getFullYear());
  const savedRecap = localStorage.getItem("recap-year") || latest;
  rekapSel.innerHTML = availableYears.length
    ? availableYears.map(y => `<option value="${y}">${y}</option>`).join("")
    : `<option value="${latest}">${latest}</option>`;
  rekapSel.value = availableYears.includes(savedRecap) ? savedRecap : latest;
}

// ============================================================
//  Targets – Logic: show form if not set or expired
// ============================================================
function targetKey(year) {
  const uid = currentUser?.uid || "anonymous";
  return `emasku_target_${uid}_${year}`;
}

function loadTargets(year) {
  try {
    const raw = localStorage.getItem(targetKey(year));
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return {
      idr: Number(obj.idr) || 0,
      gram: Number(obj.gram) || 0,
      setAt: obj.setAt || null  // ISO date string when target was set
    };
  } catch {
    return null;
  }
}

function isTargetExpired(year) {
  // Target dianggap expired jika tahun rekap sudah lewat
  // (tahun saat ini > tahun target)
  const currentYear = new Date().getFullYear();
  const targetYear = Number(year);
  return currentYear > targetYear;
}

function hasValidTarget(year) {
  const target = loadTargets(year);
  if (!target) return false;
  if (target.idr <= 0 && target.gram <= 0) return false;
  // Jika tahun sudah lewat, target expired → reset
  if (isTargetExpired(year)) {
    localStorage.removeItem(targetKey(year));
    return false;
  }
  return true;
}

function saveTargets() {
  const year = document.getElementById("recap-year").value;
  const idr = parseIDR(document.getElementById("target-idr").value);
  const gram = parseFloat(document.getElementById("target-gram").value) || 0;

  if (idr <= 0 && gram <= 0) {
    return alert("Isi minimal satu target (IDR atau Gram).");
  }

  const data = {
    idr,
    gram,
    setAt: new Date().toISOString()
  };

  localStorage.setItem(targetKey(year), JSON.stringify(data));
  updateTargetUI();
  updateDashboard();
}

function editTarget() {
  const year = document.getElementById("recap-year").value;
  const target = loadTargets(year);

  // Populate form with existing values
  document.getElementById("target-idr").value = target?.idr ? target.idr.toLocaleString("id-ID") : "";
  document.getElementById("target-gram").value = target?.gram || "";

  // Force show form, hide display
  document.getElementById("target-form-section").style.display = "block";
  document.getElementById("target-display-section").style.display = "none";
  document.getElementById("progress-section").style.display = "none";
}

function deleteTarget() {
  const year = document.getElementById("recap-year").value;
  if (confirm(`Hapus target tahun ${year}?`)) {
    localStorage.removeItem(targetKey(year));
    updateTargetUI();
    updateDashboard();
  }
}

function updateTargetUI() {
  const year = document.getElementById("recap-year").value;
  const formSection = document.getElementById("target-form-section");
  const displaySection = document.getElementById("target-display-section");
  const progressSection = document.getElementById("progress-section");

  // Update year label on form
  document.getElementById("target-form-year").innerText = year;

  if (hasValidTarget(year)) {
    // Target exists & not expired → show display, hide form
    const target = loadTargets(year);
    formSection.style.display = "none";
    displaySection.style.display = "block";
    progressSection.style.display = "grid";

    document.getElementById("target-display-year").innerText = year;
    document.getElementById("target-display-idr").innerText = target.idr > 0 ? formatIDR(target.idr) : "Tidak diatur";
    document.getElementById("target-display-gram").innerText = target.gram > 0 ? target.gram.toFixed(4) + " Gr" : "Tidak diatur";

    // Deadline info
    const deadlineEl = document.getElementById("target-display-deadline");
    const now = new Date();
    const endOfYear = new Date(Number(year), 11, 31);
    const currentYear = now.getFullYear();

    if (Number(year) === currentYear) {
      const diffDays = Math.ceil((endOfYear - now) / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        deadlineEl.innerText = `Sisa ${diffDays} hari lagi hingga akhir tahun ${year}`;
        deadlineEl.className = "target-display-meta";
      } else {
        deadlineEl.innerText = `Tahun ${year} telah berakhir`;
        deadlineEl.className = "target-display-meta expired";
      }
    } else if (Number(year) > currentYear) {
      deadlineEl.innerText = `Target untuk tahun mendatang`;
      deadlineEl.className = "target-display-meta";
    } else {
      deadlineEl.innerText = `Tahun ${year} telah berakhir — target di-reset`;
      deadlineEl.className = "target-display-meta expired";
    }
  } else {
    // No target or expired → show form, hide display
    formSection.style.display = "block";
    displaySection.style.display = "none";
    progressSection.style.display = "none";

    // Clear form
    document.getElementById("target-idr").value = "";
    document.getElementById("target-gram").value = "";
  }
}

// ============================================================
//  Auth
// ============================================================
auth.onAuthStateChanged((user) => {
  const loginScreen = document.getElementById("login-screen");
  const mainApp = document.getElementById("main-app");

  if (user) {
    currentUser = user;
    loginScreen.style.display = "none";
    mainApp.style.display = "block";

    setupIDRInput("input-idr");
    setupIDRInput("target-idr");

    document.getElementById("input-date").valueAsDate = new Date();

    loadDataFromFirestore();
    loadMotivation();
    setView("dashboard");
  } else {
    currentUser = null;
    if (unsubscribeEmas) { unsubscribeEmas(); unsubscribeEmas = null; }
    loginScreen.style.display = "flex";
    mainApp.style.display = "none";
  }
});

function handleLogin() {
  const email = (document.getElementById("login-email").value || "").trim();
  const pass = document.getElementById("login-pass").value || "";
  document.getElementById("login-error").style.display = "none";
  if (!email || !pass) return alert("Masukkan email dan password!");
  auth.signInWithEmailAndPassword(email, pass).catch((err) => {
    console.error(err);
    setLoginMessage("Gagal Masuk: " + err.message, true);
  });
}

function handleLogout() {
  if (confirm("Apakah Anda ingin keluar?")) auth.signOut();
}

function forgotPassword(ev) {
  if (ev) ev.preventDefault();
  let email = (document.getElementById("login-email").value || "").trim();
  if (!email) email = (prompt("Masukkan email untuk reset password:") || "").trim();
  if (!email) return alert("Email wajib diisi.");
  setLoginMessage("Mengirim email reset password...");
  const actionCodeSettings = { url: window.location.origin + "/", handleCodeInApp: false };
  auth.sendPasswordResetEmail(email, actionCodeSettings)
    .then(() => {
      setLoginMessage("Berhasil! Cek Inbox / Spam untuk email reset.");
      alert("Email reset terkirim. Cek Inbox / Spam.");
    })
    .catch((err) => {
      console.error(err);
      setLoginMessage("Gagal: " + err.message, true);
      alert("Gagal kirim reset: " + err.message);
    });
}

function changePassword() {
  const newPass = prompt("Password Baru (Min 6 Karakter):");
  if (newPass && newPass.length >= 6) {
    auth.currentUser.updatePassword(newPass)
      .then(() => alert("Password berhasil diganti!"))
      .catch((err) => alert(err.message));
  }
}

// ============================================================
//  Firestore
// ============================================================
function loadDataFromFirestore() {
  const ref = db.collection("users").doc(currentUser.uid).collection("emas");
  const debugEl = document.getElementById("debug-info");
  if (debugEl) debugEl.innerText = `UID: ${currentUser.uid} | Memuat...`;

  if (unsubscribeEmas) unsubscribeEmas();

  unsubscribeEmas = ref.orderBy("date", "desc").onSnapshot(
    (snapshot) => {
      transactions = [];
      snapshot.forEach((doc) => transactions.push({ id: doc.id, ...doc.data() }));
      transactions.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
      transactions = transactions.map(t => ({ ...t, category: t.category || "Lainnya" }));

      populateYearSelects();
      updateAll();

      if (debugEl) debugEl.innerText = `UID: ${currentUser.uid} | ${snapshot.size} data`;
    },
    (err) => {
      console.error("Firestore error:", err);
      if (debugEl) debugEl.innerText = `UID: ${currentUser.uid} | ERROR: ${err.message}`;
      alert("Gagal memuat data: " + err.message);
    }
  );
}

// ============================================================
//  CRUD
// ============================================================
async function saveData() {
  const btn = document.getElementById("btn-save");
  btn.disabled = true;
  try {
    const id = document.getElementById("edit-id").value;
    const dateStr = document.getElementById("input-date").value;
    const category = document.getElementById("category").value || "Lainnya";
    const note = (document.getElementById("note").value || "").trim();
    const idr = parseIDR(document.getElementById("input-idr").value);
    const gram = parseFloat(document.getElementById("input-gram").value) || 0;
    if (!dateStr || !note) return alert("Tanggal dan keterangan wajib diisi.");
    const data = { date: dateStr, category, note, idr, gram };
    const userRef = db.collection("users").doc(currentUser.uid).collection("emas");
    if (id) await userRef.doc(id).update(data);
    else await userRef.add(data);
    resetForm();
    setView("history");
  } catch (e) {
    console.error(e);
    alert("Gagal menyimpan: " + e.message);
  } finally {
    btn.disabled = false;
  }
}

function confirmDelete() {
  if (!selectedId) return alert("Tidak ada data yang dipilih.");
  if (confirm("Hapus data?")) {
    db.collection("users").doc(currentUser.uid).collection("emas")
      .doc(selectedId).delete()
      .then(() => closeModal())
      .catch((e) => alert("Gagal hapus: " + e.message));
  }
}

// ============================================================
//  Rendering
// ============================================================
function updateAll() {
  localStorage.setItem("recap-year", document.getElementById("recap-year").value);
  updateTargetUI();
  updateDashboard();
  updateRekapBulanan();
  updateHistory();
}

function updateDashboard() {
  const recapYear = document.getElementById("recap-year").value || (availableYears[0] || String(new Date().getFullYear()));

  document.getElementById("year-recap-label").innerText = recapYear;
  document.getElementById("year-recap-label-2").innerText = recapYear;
  document.getElementById("year-recap-label-3").innerText = recapYear;

  let tGramAll = 0, tIdrAll = 0;
  let tGramYear = 0, tIdrYear = 0;
  let priceIdrAll = 0, priceGramAll = 0;
  let priceIdrYear = 0, priceGramYear = 0;

  for (const item of transactions) {
    const p = getDateParts(item.date);
    if (!p) continue;
    const idr = Number(item.idr) || 0;
    const gram = Number(item.gram) || 0;

    tGramAll += gram;
    tIdrAll += idr;
    if (gram > 0 && idr > 0) { priceIdrAll += idr; priceGramAll += gram; }

    if (p.y === recapYear) {
      tGramYear += gram;
      tIdrYear += idr;
      if (gram > 0 && idr > 0) { priceIdrYear += idr; priceGramYear += gram; }
    }
  }

  document.getElementById("total-gram-all").innerText = tGramAll.toFixed(4) + " Gr";
  document.getElementById("total-idr-all").innerText = formatIDR(tIdrAll);
  document.getElementById("total-gram-year").innerText = tGramYear.toFixed(4) + " Gr";
  document.getElementById("total-idr-year").innerText = formatIDR(tIdrYear);

  const avgAll = priceGramAll > 0 ? priceIdrAll / priceGramAll : 0;
  const avgYear = priceGramYear > 0 ? priceIdrYear / priceGramYear : 0;
  document.getElementById("avg-price-all").innerText = formatRpPerGram(avgAll);
  document.getElementById("avg-price-year").innerText = formatRpPerGram(avgYear);

  // Progress (only if target exists)
  if (hasValidTarget(recapYear)) {
    const target = loadTargets(recapYear);
    const tIdr = target.idr || 0;
    const tGram = target.gram || 0;

    const idrPct = tIdr > 0 ? clamp((tIdrYear / tIdr) * 100, 0, 100) : 0;
    document.getElementById("progress-idr-text").innerText = `${formatIDR(tIdrYear)} / ${formatIDR(tIdr)}`;
    document.getElementById("progress-idr-fill").style.width = `${idrPct}%`;
    document.getElementById("progress-idr-pct").innerText = `${idrPct.toFixed(1)}%`;

    const gramPct = tGram > 0 ? clamp((tGramYear / tGram) * 100, 0, 100) : 0;
    document.getElementById("progress-gram-text").innerText = `${tGramYear.toFixed(4)} / ${tGram.toFixed(4)}`;
    document.getElementById("progress-gram-fill").style.width = `${gramPct}%`;
    document.getElementById("progress-gram-pct").innerText = `${gramPct.toFixed(1)}%`;
  }
}

// ============================================================
//  Rekap Bulanan (Tab Terpisah)
// ============================================================
function updateRekapBulanan() {
  const rekapSel = document.getElementById("rekap-year-select");
  if (!rekapSel) return;

  const recapYear = rekapSel.value || (availableYears[0] || String(new Date().getFullYear()));

  const labelIdr = document.getElementById("rekap-year-label-idr");
  const labelGram = document.getElementById("rekap-year-label-gram");
  const labelAvg = document.getElementById("rekap-year-label-avg");
  if (labelIdr) labelIdr.innerText = recapYear;
  if (labelGram) labelGram.innerText = recapYear;
  if (labelAvg) labelAvg.innerText = recapYear;

  const monthIDR = Array(12).fill(0);
  const monthGRAM = Array(12).fill(0);
  const monthPriceIDR = Array(12).fill(0);
  const monthPriceGRAM = Array(12).fill(0);
  const monthCount = Array(12).fill(0);

  let yearTotalIDR = 0, yearTotalGRAM = 0;
  let yearPriceIDR = 0, yearPriceGRAM = 0;

  for (const item of transactions) {
    const p = getDateParts(item.date);
    if (!p || p.y !== recapYear) continue;
    const idr = Number(item.idr) || 0;
    const gram = Number(item.gram) || 0;
    const mi = Number(p.monthIndex);
    if (mi >= 0 && mi <= 11) {
      monthIDR[mi] += idr;
      monthGRAM[mi] += gram;
      monthCount[mi]++;
      if (gram > 0 && idr > 0) { monthPriceIDR[mi] += idr; monthPriceGRAM[mi] += gram; }
    }
    yearTotalIDR += idr;
    yearTotalGRAM += gram;
    if (gram > 0 && idr > 0) { yearPriceIDR += idr; yearPriceGRAM += gram; }
  }

  document.getElementById("rekap-total-idr").innerText = formatIDR(yearTotalIDR);
  document.getElementById("rekap-total-gram").innerText = yearTotalGRAM.toFixed(4) + " Gr";
  const yearAvg = yearPriceGRAM > 0 ? yearPriceIDR / yearPriceGRAM : 0;
  document.getElementById("rekap-avg-price").innerText = formatRpPerGram(yearAvg);

  const monthlyBody = document.getElementById("monthly-body");
  monthlyBody.innerHTML = "";
  let grandIDR = 0, grandGRAM = 0, grandPIDR = 0, grandPGRAM = 0, grandCount = 0;

  for (let i = 0; i < 12; i++) {
    const avgM = monthPriceGRAM[i] > 0 ? monthPriceIDR[i] / monthPriceGRAM[i] : 0;
    grandIDR += monthIDR[i]; grandGRAM += monthGRAM[i];
    grandPIDR += monthPriceIDR[i]; grandPGRAM += monthPriceGRAM[i]; grandCount += monthCount[i];
    const hasData = monthIDR[i] > 0 || monthGRAM[i] > 0;
    const tr = document.createElement("tr");
    if (!hasData) tr.classList.add("row-empty");
    tr.innerHTML = `
      <td>${MONTHS[i]}</td>
      <td class="num">${hasData ? formatIDRPlain(monthIDR[i]) : "-"}</td>
      <td class="num">${hasData ? monthGRAM[i].toFixed(4) : "-"}</td>
      <td class="num">${avgM ? "Rp " + Math.round(avgM).toLocaleString("id-ID") : "-"}</td>
      <td class="num">${monthCount[i] > 0 ? monthCount[i] : "-"}</td>
    `;
    monthlyBody.appendChild(tr);
  }

  const monthlyFoot = document.getElementById("monthly-foot");
  const grandAvg = grandPGRAM > 0 ? grandPIDR / grandPGRAM : 0;
  monthlyFoot.innerHTML = `
    <tr class="foot-row">
      <td><b>TOTAL</b></td>
      <td class="num"><b>${formatIDRPlain(grandIDR)}</b></td>
      <td class="num"><b>${grandGRAM.toFixed(4)}</b></td>
      <td class="num"><b>${grandAvg ? "Rp " + Math.round(grandAvg).toLocaleString("id-ID") : "-"}</b></td>
      <td class="num"><b>${grandCount}</b></td>
    </tr>
  `;

  renderMonthlyChart(monthIDR);
}

function renderMonthlyChart(monthIDR) {
  const container = document.getElementById("chart-container");
  if (!container) return;
  const max = Math.max(...monthIDR, 1);
  const shortMonths = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  let html = '<div class="chart-bars">';
  for (let i = 0; i < 12; i++) {
    const pct = (monthIDR[i] / max) * 100;
    const hasData = monthIDR[i] > 0;
    html += `
      <div class="chart-bar-group">
        <div class="chart-bar-value">${hasData ? formatIDRPlain(monthIDR[i]) : ""}</div>
        <div class="chart-bar-track">
          <div class="chart-bar-fill ${hasData ? "" : "empty"}" style="height:${hasData ? Math.max(pct, 3) : 2}%"></div>
        </div>
        <div class="chart-bar-label">${shortMonths[i]}</div>
      </div>
    `;
  }
  html += '</div>';
  container.innerHTML = html;
}

function updateHistory() {
  const yearVal = document.getElementById("history-year").value || "all";
  const filterMonth = document.getElementById("filter-month").value;
  const filterCategory = document.getElementById("filter-category").value;
  const filterSearch = (document.getElementById("filter-search").value || "").toLowerCase();
  localStorage.setItem("history-year", yearVal);

  const tbody = document.querySelector("#data-table tbody");
  tbody.innerHTML = "";
  let fGram = 0, fIdr = 0;

  for (const item of transactions) {
    const p = getDateParts(item.date);
    if (!p) continue;
    const idr = Number(item.idr) || 0;
    const gram = Number(item.gram) || 0;
    const cat = item.category || "Lainnya";
    const note = item.note || "";

    if (
      (yearVal === "all" || p.y === yearVal) &&
      (filterMonth === "all" || p.monthIndex === filterMonth) &&
      (filterCategory === "all" || cat === filterCategory) &&
      note.toLowerCase().includes(filterSearch)
    ) {
      fGram += gram;
      fIdr += idr;
      const row = tbody.insertRow();
      row.onclick = () => openModal(item);
      row.innerHTML = `
        <td>${p.d}/${p.m}/${p.y}</td>
        <td>${cat}</td>
        <td>${note}</td>
        <td class="num">${idr.toLocaleString("id-ID")}</td>
        <td class="num">${gram.toFixed(4)}</td>
      `;
    }
  }

  document.getElementById("foot-idr").innerText = formatIDR(fIdr);
  document.getElementById("foot-gram").innerText = fGram.toFixed(4);
}

// ============================================================
//  Modal & Form
// ============================================================
function openModal(item) {
  selectedId = item.id;
  const idr = Number(item.idr) || 0;
  const gram = Number(item.gram) || 0;
  const avg = (gram > 0 && idr > 0) ? idr / gram : 0;
  document.getElementById("modal-body").innerHTML = `
    <div><b>Tanggal</b>: ${toDateString(item.date)}</div>
    <div><b>Kategori</b>: ${item.category || "Lainnya"}</div>
    <div><b>Keterangan</b>: ${item.note || ""}</div>
    <div><b>Nominal</b>: ${formatIDR(idr)}</div>
    <div><b>Berat</b>: ${gram.toFixed(4)} Gr</div>
    <div><b>Harga/Gram</b>: ${formatRpPerGram(avg)}</div>
  `;
  document.getElementById("detailModal").style.display = "block";
}

function closeModal() {
  document.getElementById("detailModal").style.display = "none";
}

function modalBackdropClose(e) {
  if (e.target?.id === "detailModal") closeModal();
}

function resetForm() {
  document.getElementById("edit-id").value = "";
  document.getElementById("input-date").valueAsDate = new Date();
  document.getElementById("category").value = "Nabung";
  document.getElementById("note").value = "";
  document.getElementById("input-idr").value = "";
  document.getElementById("input-gram").value = "";
  document.getElementById("form-title").innerText = "Input Tabungan";
  document.getElementById("btn-save").innerText = "Simpan ke Cloud";
  document.getElementById("btn-cancel").style.display = "none";
}

function prepareEdit() {
  const item = transactions.find((t) => t.id === selectedId);
  if (!item) return alert("Data tidak ditemukan.");
  document.getElementById("edit-id").value = item.id;
  document.getElementById("input-date").value = toDateString(item.date);
  document.getElementById("category").value = item.category || "Lainnya";
  document.getElementById("note").value = item.note || "";
  document.getElementById("input-idr").value = formatIDRInputValue(item.idr);
  document.getElementById("input-gram").value = Number(item.gram) || 0;
  document.getElementById("form-title").innerText = "Edit Transaksi";
  document.getElementById("btn-save").innerText = "Update Cloud";
  document.getElementById("btn-cancel").style.display = "inline-block";
  closeModal();
  setView("input");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ============================================================
//  Backup / Import
// ============================================================
function exportData() {
  const cleaned = transactions.map((t) => ({
    date: toDateString(t.date),
    category: t.category || "Lainnya",
    note: t.note ?? "",
    idr: Number(t.idr) || 0,
    gram: Number(t.gram) || 0
  }));
  const blob = new Blob([JSON.stringify(cleaned, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `backup_emas_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
}

async function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    let data;
    try { data = JSON.parse(e.target.result); } catch { return alert("JSON tidak valid."); }
    if (!Array.isArray(data)) return alert("Format JSON tidak valid (harus array).");
    if (!confirm(`Impor ${data.length} data ke Cloud?`)) return;
    try {
      const userRef = db.collection("users").doc(currentUser.uid).collection("emas");
      let batch = db.batch();
      let count = 0;
      for (const item of data) {
        const docRef = userRef.doc();
        const dateStr = toDateString(item.date) || (typeof item.date === "string" ? item.date : "");
        batch.set(docRef, {
          date: dateStr, category: item.category || "Lainnya",
          note: item.note ?? "", idr: Number(item.idr) || 0, gram: Number(item.gram) || 0
        });
        count++;
        if (count % 450 === 0) { await batch.commit(); batch = db.batch(); }
      }
      await batch.commit();
      alert("Impor selesai.");
    } catch (err) {
      console.error(err);
      alert("Gagal impor: " + err.message);
    }
  };
  reader.readAsText(file);
}

document.addEventListener("DOMContentLoaded", () => {});
