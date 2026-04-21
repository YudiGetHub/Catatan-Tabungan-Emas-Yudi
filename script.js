// Konfigurasi Firebase Milik Yudi
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

let transactions = [];
let selectedId = null;
let currentUser = null;
let unsubscribeEmas = null;

// ---------- Helper tanggal (aman) ----------
function getDateParts(dateValue) {
  if (!dateValue) return null;

  // String "YYYY-MM-DD"
  if (typeof dateValue === "string" && dateValue.includes("-")) {
    const [y, m, d] = dateValue.split("-");
    return { y, m, d, monthIndex: String(parseInt(m, 10) - 1) };
  }

  // Firestore Timestamp (jaga-jaga jika suatu saat berubah)
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

// --- 1. AUTHENTICATION ---
auth.onAuthStateChanged((user) => {
  const loginScreen = document.getElementById('login-screen');
  const mainApp = document.getElementById('main-app');

  if (user) {
    currentUser = user;
    loginScreen.style.display = 'none';
    mainApp.style.display = 'block';

    const now = new Date();
    document.getElementById('input-date').valueAsDate = now;

    // Tahun dipakai untuk REKAP saja (tabel tetap semua tahun)
    document.getElementById('filter-year').value = now.getFullYear();

    loadDataFromFirestore();
  } else {
    currentUser = null;

    // stop listener saat logout
    if (unsubscribeEmas) {
      unsubscribeEmas();
      unsubscribeEmas = null;
    }

    loginScreen.style.display = 'flex';
    mainApp.style.display = 'none';
  }
});

function handleLogin() {
  const email = document.getElementById('login-email').value;
  const pass = document.getElementById('login-pass').value;
  const errorMsg = document.getElementById('login-error');

  if (!email || !pass) return alert("Masukkan email dan password!");

  auth.signInWithEmailAndPassword(email, pass).catch(err => {
    errorMsg.innerText = "Gagal Masuk: " + err.message;
    errorMsg.style.display = 'block';
  });
}

function handleLogout() {
  if (confirm("Apakah Anda ingin keluar?")) auth.signOut();
}

function forgotPassword() {
  const email = document.getElementById('login-email').value;
  if (!email) return alert("Ketik email di kotak login!");
  auth.sendPasswordResetEmail(email)
    .then(() => alert("Email reset terkirim!"))
    .catch(err => alert(err.message));
}

function changePassword() {
  const newPass = prompt("Password Baru (Min 6 Karakter):");
  if (newPass && newPass.length >= 6) {
    auth.currentUser.updatePassword(newPass)
      .then(() => alert("Berhasil!"))
      .catch(err => alert(err.message));
  }
}

// --- 2. DATABASE ---
function loadDataFromFirestore() {
  const ref = db.collection("users").doc(currentUser.uid).collection("emas");

  // stop listener lama kalau ada
  if (unsubscribeEmas) unsubscribeEmas();

  // Coba pakai orderBy dulu
  unsubscribeEmas = ref.orderBy("date", "desc").onSnapshot(
    (snapshot) => {
      transactions = [];
      snapshot.forEach((doc) => {
        transactions.push({ id: doc.id, ...doc.data() });
      });
      updateDashboard();
    },
    (err) => {
      console.error("Firestore listener error (orderBy date):", err);

      // Fallback: tanpa orderBy (biar data tetap muncul)
      if (unsubscribeEmas) unsubscribeEmas();

      unsubscribeEmas = ref.onSnapshot(
        (snapshot) => {
          transactions = [];
          snapshot.forEach((doc) => {
            transactions.push({ id: doc.id, ...doc.data() });
          });
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

function saveData() {
  const id = document.getElementById('edit-id').value;

  const data = {
    date: document.getElementById('input-date').value, // string YYYY-MM-DD
    note: document.getElementById('note').value,
    idr: parseFloat(document.getElementById('input-idr').value) || 0,
    gram: parseFloat(document.getElementById('input-gram').value) || 0
  };

  if (!data.date || !data.note) return alert("Data tidak lengkap!");

  const userRef = db.collection("users").doc(currentUser.uid).collection("emas");

  if (id) {
    userRef.doc(id).update(data).then(() => resetForm());
  } else {
    userRef.add(data).then(() => resetForm());
  }
}

function confirmDelete() {
  if (!selectedId) return alert("Tidak ada data yang dipilih.");
  if (confirm("Hapus data?")) {
    db.collection("users").doc(currentUser.uid).collection("emas")
      .doc(selectedId).delete()
      .then(() => closeModal());
  }
}

// --- 3. DASHBOARD ---
// Tabel: tampilkan semua tahun (filter hanya bulan + search)
// Rekap Tahun: pakai filter-year
function updateDashboard() {
  const recapYear = String(document.getElementById('filter-year').value || new Date().getFullYear());
  const filterMonth = document.getElementById('filter-month').value;
  const filterSearch = (document.getElementById('filter-search').value || "").toLowerCase();

  // label tahun rekap
  const y1 = document.getElementById('year-recap-label');
  const y2 = document.getElementById('year-recap-label-2');
  if (y1) y1.innerText = recapYear;
  if (y2) y2.innerText = recapYear;

  const tbody = document.querySelector('#data-table tbody');
  tbody.innerHTML = '';

  let tGramAll = 0, tIdrAll = 0;
  let tGramYear = 0, tIdrYear = 0;
  let fGram = 0, fIdr = 0;

  transactions.forEach(item => {
    const parts = getDateParts(item.date);
    if (!parts) return;

    const itemYear = parts.y;
    const itemMonth = parts.monthIndex;

    const idr = Number(item.idr) || 0;
    const gram = Number(item.gram) || 0;
    const noteLower = (item.note || "").toLowerCase();

    // Total semua tahun
    tGramAll += gram;
    tIdrAll += idr;

    // Rekap khusus tahun yang dipilih
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

      // Tampilkan tahun juga karena tabel lintas tahun
      row.innerHTML = `
        <td>${parts.d}/${parts.m}/${parts.y}</td>
        <td>${item.note || ""}</td>
        <td>${idr.toLocaleString('id-ID')}</td>
        <td>${gram.toFixed(4)}</td>
      `;
    }
  });

  // Summary semua tahun
  document.getElementById('total-gram-all').innerText = tGramAll.toFixed(4) + " Gr";
  document.getElementById('total-idr-all').innerText = "Rp " + tIdrAll.toLocaleString('id-ID');

  // Summary tahun dipilih
  const gramYearEl = document.getElementById('total-gram-year');
  const idrYearEl = document.getElementById('total-idr-year');
  if (gramYearEl) gramYearEl.innerText = tGramYear.toFixed(4) + " Gr";
  if (idrYearEl) idrYearEl.innerText = "Rp " + tIdrYear.toLocaleString('id-ID');

  // Footer total tabel (bulan+search)
  document.getElementById('foot-idr').innerText = "Rp " + fIdr.toLocaleString('id-ID');
  document.getElementById('foot-gram').innerText = fGram.toFixed(4);
}

// --- 4. UI HELPER ---
function openModal(item) {
  selectedId = item.id;

  const idr = Number(item.idr) || 0;
  const gram = Number(item.gram) || 0;

  document.getElementById('modal-body').innerHTML = `
    <p><strong>Tanggal:</strong> ${toDateString(item.date)}</p>
    <p><strong>Keterangan:</strong> ${item.note || ""}</p>
    <p><strong>Nominal:</strong> Rp ${idr.toLocaleString('id-ID')}</p>
    <p><strong>Berat:</strong> ${gram.toFixed(4)} Gr</p>
  `;
  document.getElementById('detailModal').style.display = 'block';
}

function closeModal() {
  document.getElementById('detailModal').style.display = 'none';
}

function resetForm() {
  document.getElementById('edit-id').value = "";
  document.getElementById('input-date').valueAsDate = new Date();
  document.getElementById('note').value = "";
  document.getElementById('input-idr').value = "";
  document.getElementById('input-gram').value = "";
  document.getElementById('form-title').innerText = "Input Transaksi";
  document.getElementById('btn-save').innerText = "Simpan ke Cloud";
  document.getElementById('btn-cancel').style.display = "none";
}

function prepareEdit() {
  const item = transactions.find(t => t.id === selectedId);
  if (!item) return alert("Data tidak ditemukan.");

  document.getElementById('edit-id').value = item.id;
  document.getElementById('input-date').value = toDateString(item.date);
  document.getElementById('note').value = item.note || "";
  document.getElementById('input-idr').value = Number(item.idr) || 0;
  document.getElementById('input-gram').value = Number(item.gram) || 0;

  document.getElementById('form-title').innerText = "Edit Transaksi";
  document.getElementById('btn-save').innerText = "Update Cloud";
  document.getElementById('btn-cancel').style.display = "block";

  closeModal();
  window.scrollTo(0, 0);
}

function changeYear(step) {
  const input = document.getElementById('filter-year');
  const base = parseInt(input.value || new Date().getFullYear(), 10);
  input.value = base + step;
  updateDashboard();
}

// --- 5. BACKUP (dinormalisasi) ---
function exportData() {
  const cleaned = transactions.map(t => ({
    date: toDateString(t.date),          // pastikan string YYYY-MM-DD
    note: t.note ?? "",
    idr: Number(t.idr) || 0,
    gram: Number(t.gram) || 0
  }));

  const blob = new Blob([JSON.stringify(cleaned)], { type: "application/json" });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `backup_emas_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
}

function importData(event) {
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

    const userRef = db.collection("users").doc(currentUser.uid).collection("emas");

    for (const item of data) {
      const dateStr = toDateString(item.date) || (typeof item.date === "string" ? item.date : "");
      await userRef.add({
        date: dateStr,
        note: item.note ?? "",
        idr: Number(item.idr) || 0,
        gram: Number(item.gram) || 0
      });
    }

    alert("Impor selesai.");
  };

  reader.readAsText(file);
}
