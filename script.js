// ---------------- Firebase Config ----------------
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

// ---------------- State ----------------
let transactions = [];
let selectedId = null;
let currentUser = null;
let unsubscribeEmas = null;

// tahun yang tersedia dari data
let availableYears = []; // ["2026","2025",...]
let currentView = "dashboard";

// ---------------- Helpers ----------------
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
  const num = Number(n) || 0;
  return "Rp " + num.toLocaleString("id-ID");
}

// parse "4.200.000" => 4200000
function parseIDR(str) {
  if (str == null) return 0;
  const digits = String(str).replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

function formatIDRInputValue(str) {
  const n = parseIDR(str);
  return n ? n.toLocaleString("id-ID") : "";
}

function setupIDRInput() {
  const el = document.getElementById("input-idr");
  if (!el) return;

  el.addEventListener("input", () => {
    // format sederhana (tanpa manajemen caret kompleks)
    const formatted = formatIDRInputValue(el.value);
    el.value = formatted;
  });

  el.addEventListener("blur", () => {
    el.value = formatIDRInputValue(el.value);
  });
}

function setLoginMessage(text, isError = false) {
  const el = document.getElementById("login-error");
  el.style.display = "block";
  el.classList.toggle("error", isError);
  el.innerText = text;
}

// ---------------- Views / Tabs ----------------
function setView(view) {
  currentView = view;

  const views = ["dashboard", "input", "history"];
  for (const v of views) {
    document.getElementById(`view-${v}`).style.display = (v === view) ? "block" : "none";
    document.getElementById(`tab-${v}`).classList.toggle("active", v === view);
  }
}

function ensureDefaultYearSelection() {
  const yearSelect = document.getElementById("filter-year");
  if (!yearSelect) return;

  // Prioritas:
  // 1) terakhir dipakai (localStorage)
  // 2) tahun terbaru yang ada di data
  // 3) tahun sekarang
  const saved = localStorage.getItem("filter-year");
  const latest = availableYears[0] || String(new Date().getFullYear());
  const desired = (saved && (saved === "all" || availableYears.includes(saved))) ? saved : latest;

  yearSelect.value = desired;
  localStorage.setItem("filter-year", desired);
}

function populateYearOptions() {
  const yearSelect = document.getElementById("filter-year");
  if (!yearSelect) return;

  const yearsSet = new Set();
  for (const t of transactions) {
    const p = getDateParts(t.date);
    if (p?.y) yearsSet.add(p.y);
  }

  availableYears = Array.from(yearsSet).sort((a, b) => Number(b) - Number(a)); // desc

  yearSelect.innerHTML = `
    <option value="all">Semua Tahun</option>
    ${availableYears.map(y => `<option value="${y}">${y}</option>`).join("")}
  `;

  ensureDefaultYearSelection();
}

// step tahun berdasarkan daftar tahun yang tersedia (desc)
function stepYear(dir) {
  const yearSelect = document.getElementById("filter-year");
  if (!yearSelect) return;

  const val = yearSelect.value;
  if (val === "all") {
    if (availableYears.length) {
      yearSelect.value = availableYears[0];
      updateDashboard();
    }
    return;
  }

  const idx = availableYears.indexOf(val);
  if (idx === -1) return;

  const nextIdx = idx + dir;
  if (nextIdx < 0 || nextIdx >= availableYears.length) return;

  yearSelect.value = availableYears[nextIdx];
  updateDashboard();
}

// ---------------- Auth ----------------
auth.onAuthStateChanged((user) => {
  const loginScreen = document.getElementById("login-screen");
  const mainApp = document.getElementById("main-app");

  if (user) {
    currentUser = user;
    loginScreen.style.display = "none";
    mainApp.style.display = "block";

    setupIDRInput();

    const now = new Date();
    document.getElementById("input-date").valueAsDate = now;

    loadDataFromFirestore();
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

  // agar link reset mengarah balik ke domain vercel Anda
  const actionCodeSettings = {
    url: window.location.origin + "/",
    handleCodeInApp: false
  };

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
    auth.currentUser
      .updatePassword(newPass)
      .then(() => alert("Password berhasil diganti!"))
      .catch((err) => alert(err.message));
  }
}

// ---------------- Firestore ----------------
function loadDataFromFirestore() {
  const ref = db.collection("users").doc(currentUser.uid).collection("emas");
  const debugEl = document.getElementById("debug-info");
  if (debugEl) debugEl.innerText = `Login UID: ${currentUser.uid} | Memuat data...`;

  if (unsubscribeEmas) unsubscribeEmas();

  unsubscribeEmas = ref.orderBy("date", "desc").onSnapshot(
    (snapshot) => {
      transactions = [];
      snapshot.forEach((doc) => transactions.push({ id: doc.id, ...doc.data() }));

      // safety: sort lokal juga
      transactions.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

      populateYearOptions();
      updateDashboard();

      if (debugEl) debugEl.innerText = `Login UID: ${currentUser.uid} | Data: ${snapshot.size} dokumen`;
    },
    (err) => {
      console.error("Firestore error:", err);
      if (debugEl) debugEl.innerText = `Login UID: ${currentUser.uid} | ERROR: ${err.message}`;
      alert("Gagal memuat data: " + err.message);
    }
  );
}

// ---------------- CRUD ----------------
async function saveData() {
  const btn = document.getElementById("btn-save");
  btn.disabled = true;

  try {
    const id = document.getElementById("edit-id").value;
    const dateStr = document.getElementById("input-date").value;
    const note = (document.getElementById("note").value || "").trim();

    const idr = parseIDR(document.getElementById("input-idr").value);
    const gram = parseFloat(document.getElementById("input-gram").value) || 0;

    if (!dateStr || !note) return alert("Tanggal dan keterangan wajib diisi.");

    const data = { date: dateStr, note, idr, gram };
    const userRef = db.collection("users").doc(currentUser.uid).collection("emas");

    if (id) await userRef.doc(id).update(data);
    else await userRef.add(data);

    resetForm();
    setView("history"); // setelah simpan, langsung ke riwayat (lebih enak)
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
      .doc(selectedId)
      .delete()
      .then(() => closeModal())
      .catch((e) => alert("Gagal hapus: " + e.message));
  }
}

// ---------------- Dashboard + History render ----------------
function updateDashboard() {
  const yearVal = document.getElementById("filter-year")?.value || "all";
  const filterMonth = document.getElementById("filter-month")?.value || "all";
  const filterSearch = (document.getElementById("filter-search")?.value || "").toLowerCase();

  localStorage.setItem("filter-year", yearVal);

  const recapYear = (yearVal === "all")
    ? (availableYears[0] || String(new Date().getFullYear()))
    : yearVal;

  document.getElementById("year-recap-label").innerText = recapYear;
  document.getElementById("year-recap-label-2").innerText = recapYear;

  // totals
  let tGramAll = 0, tIdrAll = 0;
  let tGramYear = 0, tIdrYear = 0;
  let fGram = 0, fIdr = 0;

  // render table (riwayat)
  const tbody = document.querySelector("#data-table tbody");
  if (tbody) tbody.innerHTML = "";

  for (const item of transactions) {
    const p = getDateParts(item.date);
    if (!p) continue;

    const idr = Number(item.idr) || 0;
    const gram = Number(item.gram) || 0;
    const note = item.note || "";
    const noteLower = note.toLowerCase();

    tGramAll += gram;
    tIdrAll += idr;

    if (p.y === recapYear) {
      tGramYear += gram;
      tIdrYear += idr;
    }

    // Filter riwayat (tahun benar-benar memfilter tabel)
    const mY = (yearVal === "all" || p.y === yearVal);
    const mM = (filterMonth === "all" || p.monthIndex === filterMonth);
    const mS = noteLower.includes(filterSearch);

    if (mY && mM && mS) {
      fGram += gram;
      fIdr += idr;

      if (tbody) {
        const row = tbody.insertRow();
        row.onclick = () => openModal(item);

        row.innerHTML = `
          <td>${p.d}/${p.m}/${p.y}</td>
          <td>${note}</td>
          <td class="num">${idr.toLocaleString("id-ID")}</td>
          <td class="num">${gram.toFixed(4)}</td>
        `;
      }
    }
  }

  // update dashboard cards
  document.getElementById("total-gram-all").innerText = tGramAll.toFixed(4) + " Gr";
  document.getElementById("total-idr-all").innerText = formatIDR(tIdrAll);
  document.getElementById("total-gram-year").innerText = tGramYear.toFixed(4) + " Gr";
  document.getElementById("total-idr-year").innerText = formatIDR(tIdrYear);

  // update history footer
  document.getElementById("foot-idr").innerText = formatIDR(fIdr);
  document.getElementById("foot-gram").innerText = fGram.toFixed(4);
}

// ---------------- Modal & Form ----------------
function openModal(item) {
  selectedId = item.id;

  const idr = Number(item.idr) || 0;
  const gram = Number(item.gram) || 0;

  document.getElementById("modal-body").innerHTML = `
    <div><b>Tanggal</b>: ${toDateString(item.date)}</div>
    <div><b>Keterangan</b>: ${item.note || ""}</div>
    <div><b>Nominal</b>: ${formatIDR(idr)}</div>
    <div><b>Berat</b>: ${gram.toFixed(4)} Gr</div>
  `;
  document.getElementById("detailModal").style.display = "block";
}

function closeModal() {
  document.getElementById("detailModal").style.display = "none";
}

function modalBackdropClose(e) {
  if (e.target && e.target.id === "detailModal") closeModal();
}

function resetForm() {
  document.getElementById("edit-id").value = "";
  document.getElementById("input-date").valueAsDate = new Date();
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

// ---------------- Backup / Import ----------------
function exportData() {
  const cleaned = transactions.map((t) => ({
    date: toDateString(t.date),
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
    try {
      data = JSON.parse(e.target.result);
    } catch {
      return alert("JSON tidak valid.");
    }

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
          date: dateStr,
          note: item.note ?? "",
          idr: Number(item.idr) || 0,
          gram: Number(item.gram) || 0
        });

        count++;
        if (count % 450 === 0) {
          await batch.commit();
          batch = db.batch();
        }
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
