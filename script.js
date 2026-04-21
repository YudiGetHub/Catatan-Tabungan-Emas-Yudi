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

// ---------------- Helpers ----------------
function getDateParts(dateValue) {
  if (!dateValue) return null;

  // string "YYYY-MM-DD"
  if (typeof dateValue === "string" && dateValue.includes("-")) {
    const [y, m, d] = dateValue.split("-");
    if (!y || !m || !d) return null;
    return { y, m, d, monthIndex: String(parseInt(m, 10) - 1) };
  }

  // Firestore Timestamp (jaga-jaga)
  if (dateValue && typeof dateValue.toDate === "function") {
    const dt = dateValue.toDate();
    const y = String(dt.getFullYear());
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return { y, m, d, monthIndex: String(dt.getMonth()) };
  }

  // Object {seconds, nanoseconds} (jaga-jaga dari JSON)
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

function formatIDR(num) {
  const n = Number(num) || 0;
  return "Rp " + n.toLocaleString("id-ID");
}

function setLoginMessage(text, isError = false) {
  const el = document.getElementById("login-error");
  el.style.display = "block";
  el.classList.toggle("error", isError);
  el.innerText = text;
}

// ---------------- Auth ----------------
auth.onAuthStateChanged((user) => {
  const loginScreen = document.getElementById("login-screen");
  const mainApp = document.getElementById("main-app");

  if (user) {
    currentUser = user;
    loginScreen.style.display = "none";
    mainApp.style.display = "block";

    const now = new Date();
    document.getElementById("input-date").valueAsDate = now;

    // Tahun rekap default: tahun sekarang (ini tidak menyaring tabel)
    document.getElementById("filter-year").value = now.getFullYear();

    loadDataFromFirestore();
  } else {
    currentUser = null;
    if (unsubscribeEmas) {
      unsubscribeEmas();
      unsubscribeEmas = null;
    }
    loginScreen.style.display = "flex";
    mainApp.style.display = "none";
  }
});

function handleLogin() {
  const email = (document.getElementById("login-email").value || "").trim();
  const pass = document.getElementById("login-pass").value || "";

  const errorMsg = document.getElementById("login-error");
  errorMsg.style.display = "none";

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

  auth.sendPasswordResetEmail(email)
    .then(() => {
      setLoginMessage("Berhasil! Cek Inbox / Spam untuk email reset.");
      alert("Link reset password sudah dikirim. Cek Inbox / Spam.");
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

  if (unsubscribeEmas) unsubscribeEmas();

  // Coba orderBy date (string YYYY-MM-DD aman untuk sorting)
  unsubscribeEmas = ref.orderBy("date", "desc").onSnapshot(
    (snapshot) => {
      transactions = [];
      snapshot.forEach((doc) => transactions.push({ id: doc.id, ...doc.data() }));
      updateDashboard();
    },
    (err) => {
      console.error("Firestore listener error (orderBy date):", err);

      // Fallback tanpa orderBy (biar data tetap muncul)
      if (unsubscribeEmas) unsubscribeEmas();
      unsubscribeEmas = ref.onSnapshot(
        (snapshot) => {
          transactions = [];
          snapshot.forEach((doc) => transactions.push({ id: doc.id, ...doc.data() }));

          // sort lokal supaya tetap rapi
          transactions.sort((a, b) => (String(b.date || "")).localeCompare(String(a.date || "")));
          updateDashboard();
        },
        (err2) => {
          console.error("Firestore listener error (no orderBy):", err2);
          alert("Gagal memuat data: " + err2.message);
        }
      );
    }
  );
}

async function saveData() {
  const btn = document.getElementById("btn-save");
  btn.disabled = true;

  try {
    const id = document.getElementById("edit-id").value;

    const dateStr = document.getElementById("input-date").value; // YYYY-MM-DD
    const note = (document.getElementById("note").value || "").trim();
    const idr = parseFloat(document.getElementById("input-idr").value) || 0;
    const gram = parseFloat(document.getElementById("input-gram").value) || 0;

    if (!dateStr || !note) return alert("Tanggal dan keterangan wajib diisi.");

    const data = { date: dateStr, note, idr, gram };

    const userRef = db.collection("users").doc(currentUser.uid).collection("emas");

    if (id) {
      await userRef.doc(id).update(data);
    } else {
      await userRef.add(data);
    }

    resetForm();
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

// ---------------- Dashboard ----------------
// Tabel selalu semua tahun (filter hanya bulan+search).
// Tahun dipakai untuk REKAP saja.
function updateDashboard() {
  const recapYear = String(document.getElementById("filter-year").value || new Date().getFullYear());
  const filterMonth = document.getElementById("filter-month").value;
  const filterSearch = (document.getElementById("filter-search").value || "").toLowerCase();

  // Label tahun rekap di kartu
  document.getElementById("year-recap-label").innerText = recapYear;
  document.getElementById("year-recap-label-2").innerText = recapYear;

  const tbody = document.querySelector("#data-table tbody");
  tbody.innerHTML = "";

  let tGramAll = 0, tIdrAll = 0;
  let tGramYear = 0, tIdrYear = 0;
  let fGram = 0, fIdr = 0;

  transactions.forEach((item) => {
    const parts = getDateParts(item.date);
    if (!parts) return;

    const itemYear = parts.y;
    const itemMonth = parts.monthIndex;

    const idr = Number(item.idr) || 0;
    const gram = Number(item.gram) || 0;
    const note = item.note || "";
    const noteLower = note.toLowerCase();

    // Total all-time
    tGramAll += gram;
    tIdrAll += idr;

    // Rekap tahun dipilih
    if (itemYear === recapYear) {
      tGramYear += gram;
      tIdrYear += idr;
    }

    // Filter untuk tabel (tanpa tahun)
    const mM = (filterMonth === "all" || filterMonth === itemMonth);
    const mS = noteLower.includes(filterSearch);

    if (mM && mS) {
      fGram += gram;
      fIdr += idr;

      const row = tbody.insertRow();
      row.onclick = () => openModal(item);

      row.innerHTML = `
        <td>${parts.d}/${parts.m}/${parts.y}</td>
        <td>${note}</td>
        <td class="num">${idr.toLocaleString("id-ID")}</td>
        <td class="num">${gram.toFixed(4)}</td>
      `;
    }
  });

  // Update summary
  document.getElementById("total-gram-all").innerText = tGramAll.toFixed(4) + " Gr";
  document.getElementById("total-idr-all").innerText = formatIDR(tIdrAll);

  document.getElementById("total-gram-year").innerText = tGramYear.toFixed(4) + " Gr";
  document.getElementById("total-idr-year").innerText = formatIDR(tIdrYear);

  // Footer total tabel
  document.getElementById("foot-idr").innerText = formatIDR(fIdr);
  document.getElementById("foot-gram").innerText = fGram.toFixed(4);
}

// ---------------- UI Helpers ----------------
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
  // klik area gelap (bukan konten) untuk tutup modal
  if (e.target && e.target.id === "detailModal") closeModal();
}

function resetForm() {
  document.getElementById("edit-id").value = "";
  document.getElementById("input-date").valueAsDate = new Date();
  document.getElementById("note").value = "";
  document.getElementById("input-idr").value = "";
  document.getElementById("input-gram").value = "";

  document.getElementById("form-title").innerText = "Input Transaksi";
  document.getElementById("btn-save").innerText = "Simpan ke Cloud";
  document.getElementById("btn-cancel").style.display = "none";
}

function prepareEdit() {
  const item = transactions.find((t) => t.id === selectedId);
  if (!item) return alert("Data tidak ditemukan.");

  document.getElementById("edit-id").value = item.id;
  document.getElementById("input-date").value = toDateString(item.date);
  document.getElementById("note").value = item.note || "";
  document.getElementById("input-idr").value = Number(item.idr) || 0;
  document.getElementById("input-gram").value = Number(item.gram) || 0;

  document.getElementById("form-title").innerText = "Edit Transaksi";
  document.getElementById("btn-save").innerText = "Update Cloud";
  document.getElementById("btn-cancel").style.display = "inline-block";

  closeModal();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function changeYear(step) {
  const input = document.getElementById("filter-year");
  const base = parseInt(input.value || new Date().getFullYear(), 10);
  input.value = base + step;
  updateDashboard();
}

// ---------------- Backup / Import ----------------
function exportData() {
  const cleaned = transactions.map((t) => ({
    date: toDateString(t.date),   // paksa string YYYY-MM-DD
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

      // Batch agar lebih cepat & rapi (maks 500 per batch)
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
