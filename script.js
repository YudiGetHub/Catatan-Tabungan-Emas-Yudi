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

// ===== Helper Tanggal (aman jika suatu saat format berubah) =====
function getDateParts(dateValue) {
  if (!dateValue) return null;

  // String "YYYY-MM-DD"
  if (typeof dateValue === "string" && dateValue.includes("-")) {
    const [y, m, d] = dateValue.split("-");
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

  // Object timestamp hasil JSON {seconds:..., nanoseconds:...} (jaga-jaga)
  if (typeof dateValue === "object" && typeof dateValue.seconds === "number") {
    const dt = new Date(dateValue.seconds * 1000);
    const y = String(dt.getFullYear());
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return { y, m, d, monthIndex: String(dt.getMonth()) };
  }

  return null;
}

function formatDateYMD(dateValue) {
  const p = getDateParts(dateValue);
  if (!p) return "";
  return `${p.y}-${p.m}-${p.d}`;
}

// ===== 1) AUTH =====
auth.onAuthStateChanged((user) => {
  const loginScreen = document.getElementById('login-screen');
  const mainApp = document.getElementById('main-app');

  if (user) {
    currentUser = user;
    loginScreen.style.display = 'none';
    mainApp.style.display = 'block';

    const now = new Date();
    document.getElementById('input-date').valueAsDate = now;

    // Tahun ini dipakai untuk REKAP, bukan menyaring tabel
    document.getElementById('filter-year').value = now.getFullYear();

    loadDataFromFirestore();
  } else {
    currentUser = null;
    loginScreen.style.display = 'flex';
    mainApp.style.display = 'none';

    if (unsubscribeEmas) {
      unsubscribeEmas();
      unsubscribeEmas = null;
    }
  }
});

function handleLogin() {
  const email = document.getElementById('login-email').value;
  const pass = document.getElementById('login-pass').value;
  const errorMsg = document.getElementById('login-error');

  if (!email || !pass) return alert("Masukkan email dan password!");

  errorMsg.style.display = 'none';
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

// ===== 2) DATABASE =====
function loadDataFromFirestore() {
  const ref = db.collection("users").doc(currentUser.uid).collection("emas");

  if (unsubscribeEmas) unsubscribeEmas();

  // Karena date Anda STRING, orderBy ini aman.
  // Tapi kita tetap kasih error handler agar kalau ada data campuran, aplikasi tidak diam.
  unsubscribeEmas = ref.orderBy("date", "desc").onSnapshot(
    (snapshot) => {
      transactions = [];
      snapshot.forEach((doc) => transactions.push({ id: doc.id, ...doc.data() }));
      updateDashboard();
    },
    (err) => {
      console.error("Firestore listener error:", err);
      alert("Gagal memuat data: " + err.message);

      // fallback: coba tanpa orderBy (agar data tetap bisa tampil)
      if (unsubscribeEmas) unsubscribeEmas();
      unsubscribeEmas = ref.onSnapshot(
        (snapshot) => {
          transactions = [];
          snapshot.forEach((doc) => transactions.push({ id: doc.id, ...doc.data() }));
          updateDashboard();
        },
        (err2) => {
          console.error("Firestore listener error (fallback):", err2);
          alert("Gagal memuat data: " + err2.message);
        }
      );
    }
  );
}

function saveData() {
  if (!currentUser) return alert("Silakan login dulu.");

  const id = document.getElementById('edit-id').value;

  const dateStr = document.getElementById('input-date').value; // "YYYY-MM-DD"
  const noteStr = (document.getElementById('note').value || "").trim();

  const data = {
    date: dateStr,
    note: noteStr,
    idr: Number(document.getElementById('input-idr').value) || 0,
    gram: Number(document.getElementById('input-gram').value) || 0
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
  if (!selectedId) return;
  if (confirm("Hapus data?")) {
    db.collection("users").doc(currentUser.uid).collection("emas")
      .doc(selectedId).delete()
      .then(() => closeModal());
  }
}

// ===== 3) DASHBOARD =====
// PENTING: TABEL TIDAK DIFILTER BERDASARKAN TAHUN.
// Tahun hanya untuk REKAP "tahun ini / tahun pilihan".
function updateDashboard() {
  const recapYear = (document.getElementById('filter-year').value || new Date().getFullYear()).toString();
  const filterMonth = document.getElementById('filter-month').value; // "all" atau "0..11"
  const filterSearch = (document.getElementById('filter-search').value || "").toLowerCase();

  // update label rekap tahun
  const y1 = document.getElementById('year-recap-label');
  const y2 = document.getElementById('year-recap-label-2');
  if (y1) y1.innerText = recapYear;
  if (y2) y2.innerText = recapYear;

  const tbody = document.querySelector('#data-table tbody');
  tbody.innerHTML = '';

  // Total all-time 
