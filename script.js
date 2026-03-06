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
const db = firebase.firestore(); // Inisialisasi Firestore

let transactions = [];
let selectedId = null;
let currentUser = null;

// --- AUTHENTICATION ---
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
        document.getElementById('user-display').innerText = user.email;
        loadDataFromFirestore(); // Ambil data dari awan saat login
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
    }
});

function handleLogin() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    auth.signInWithEmailAndPassword(email, pass).catch(err => alert(err.message));
}

function handleLogout() { auth.signOut(); }

// --- DATABASE CLOUD (FIRESTORE) ---
function loadDataFromFirestore() {
    // Mengambil data spesifik milik user yang sedang login
    db.collection("users").doc(currentUser.uid).collection("emas")
    .orderBy("date", "asc")
    .onSnapshot((snapshot) => {
        transactions = [];
        snapshot.forEach((doc) => {
            transactions.push({ id: doc.id, ...doc.data() });
        });
        updateDashboard();
    });
}

function saveData() {
    const id = document.getElementById('edit-id').value;
    const data = {
        date: document.getElementById('input-date').value,
        note: document.getElementById('note').value,
        idr: parseFloat(document.getElementById('input-idr').value) || 0,
        gram: parseFloat(document.getElementById('input-gram').value) || 0
    };

    if (!data.date || !data.note) return alert("Lengkapi data!");

    const userRef = db.collection("users").doc(currentUser.uid).collection("emas");

    if (id) {
        // Update data di Cloud
        userRef.doc(id).update(data).then(() => resetForm());
    } else {
        // Tambah data baru ke Cloud
        userRef.add(data).then(() => resetForm());
    }
}

function confirmDelete() {
    if(confirm("Hapus data dari Cloud?")) {
        db.collection("users").doc(currentUser.uid).collection("emas")
        .doc(selectedId).delete().then(() => closeModal());
    }
}

// --- DASHBOARD & UI (TETAP SAMA) ---
function updateDashboard() {
    const filterYear = document.getElementById('filter-year').value;
    const filterMonth = document.getElementById('filter-month').value;
    const filterSearch = document.getElementById('filter-search').value.toLowerCase();
    const tbody = document.querySelector('#data-table tbody');
    tbody.innerHTML = '';

    let tGramAll = 0; let tIdrAll = 0;
    let fGram = 0; let fIdr = 0;

    transactions.forEach(item => {
        const d = new Date(item.date);
        tGramAll += item.gram;
        tIdrAll += item.idr;

        const mY = (filterYear === "" || filterYear === d.getFullYear().toString());
        const mM = (filterMonth === "all" || filterMonth === d.getMonth().toString());
        const mS = item.note.toLowerCase().includes(filterSearch);

        if (mY && mM && mS) {
            fGram += item.gram; fIdr += item.idr;
            const row = tbody.insertRow();
            row.onclick = () => openModal(item);
            row.innerHTML = `<td>${d.getDate()}/${d.getMonth()+1}</td><td>${item.note}</td><td>${item.idr.toLocaleString()}</td><td>${item.gram.toFixed(4)}</td>`;
        }
    });

    document.getElementById('total-gram-all').innerText = tGramAll.toFixed(4) + " Gr";
    document.getElementById('total-idr-all').innerText = "Rp " + tIdrAll.toLocaleString('id-ID');
    document.getElementById('foot-idr').innerText = "Rp " + fIdr.toLocaleString();
    document.getElementById('foot-gram').innerText = fGram.toFixed(4);
}

// Fungsi Modal & Form Reset (Sama seperti sebelumnya)
function openModal(item) {
    selectedId = item.id;
    document.getElementById('modal-body').innerHTML = `<p><strong>Keterangan:</strong> ${item.note}</p><p><strong>Nominal:</strong> Rp ${item.idr.toLocaleString()}</p><p><strong>Berat:</strong> ${item.gram.toFixed(4)} Gr</p>`;
    document.getElementById('detailModal').style.display = 'block';
}
function closeModal() { document.getElementById('detailModal').style.display = 'none'; }
function resetForm() {
    document.getElementById('edit-id').value = ""; document.getElementById('input-date').valueAsDate = new Date();
    document.getElementById('note').value = ""; document.getElementById('input-idr').value = "";
    document.getElementById('input-gram').value = ""; document.getElementById('form-title').innerText = "Input";
    document.getElementById('btn-save').innerText = "Simpan"; document.getElementById('btn-cancel').style.display = "none";
}
function prepareEdit() {
    const item = transactions.find(t => t.id === selectedId);
    document.getElementById('edit-id').value = item.id; document.getElementById('input-date').value = item.date;
    document.getElementById('note').value = item.note; document.getElementById('input-idr').value = item.idr;
    document.getElementById('input-gram').value = item.gram;
    document.getElementById('form-title').innerText = "Edit"; document.getElementById('btn-save').innerText = "Update";
    document.getElementById('btn-cancel').style.display = "block"; closeModal();
}
function changeYear(step) { document.getElementById('filter-year').value = parseInt(document.getElementById('filter-year').value) + step; updateDashboard(); }
