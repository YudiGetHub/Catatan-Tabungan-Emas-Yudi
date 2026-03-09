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
        document.getElementById('filter-year').value = now.getFullYear();
        loadDataFromFirestore(); 
    } else {
        currentUser = null;
        loginScreen.style.display = 'flex';
        mainApp.style.display = 'none';
    }
});

function handleLogin() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    const errorMsg = document.getElementById('login-error');
    if(!email || !pass) return alert("Masukkan email dan password!");
    auth.signInWithEmailAndPassword(email, pass).catch(err => {
        errorMsg.innerText = "Gagal Masuk: " + err.message;
        errorMsg.style.display = 'block';
    });
}

function handleLogout() {
    if(confirm("Apakah Anda ingin keluar?")) auth.signOut();
}

function forgotPassword() {
    const email = document.getElementById('login-email').value;
    if (!email) return alert("Ketik email di kotak login!");
    auth.sendPasswordResetEmail(email).then(() => alert("Email reset terkirim!")).catch(err => alert(err.message));
}

function changePassword() {
    const newPass = prompt("Password Baru (Min 6 Karakter):");
    if (newPass && newPass.length >= 6) {
        auth.currentUser.updatePassword(newPass).then(() => alert("Berhasil!")).catch(err => alert(err.message));
    }
}

// --- 2. DATABASE ---
function loadDataFromFirestore() {
    db.collection("users").doc(currentUser.uid).collection("emas")
    .orderBy("date", "desc") 
    .onSnapshot((snapshot) => {
        transactions = [];
        snapshot.forEach((doc) => { transactions.push({ id: doc.id, ...doc.data() }); });
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
    if (!data.date || !data.note) return alert("Data tidak lengkap!");
    const userRef = db.collection("users").doc(currentUser.uid).collection("emas");
    if (id) {
        userRef.doc(id).update(data).then(() => resetForm());
    } else {
        userRef.add(data).then(() => resetForm());
    }
}

function confirmDelete() {
    if(confirm("Hapus data?")) {
        db.collection("users").doc(currentUser.uid).collection("emas").doc(selectedId).delete().then(() => closeModal());
    }
}

// --- 3. DASHBOARD ---
function updateDashboard() {
    const filterYear = document.getElementById('filter-year').value;
    const filterMonth = document.getElementById('filter-month').value;
    const filterSearch = document.getElementById('filter-search').value.toLowerCase();
    const tbody = document.querySelector('#data-table tbody');
    tbody.innerHTML = '';

    let tGramAll = 0, tIdrAll = 0, fGram = 0, fIdr = 0;

    transactions.forEach(item => {
        const d = new Date(item.date);
        tGramAll += item.gram; tIdrAll += item.idr;
        const mY = (filterYear === "" || filterYear === d.getFullYear().toString());
        const mM = (filterMonth === "all" || filterMonth === d.getMonth().toString());
        const mS = item.note.toLowerCase().includes(filterSearch);

        if (mY && mM && mS) {
            fGram += item.gram; fIdr += item.idr;
            const row = tbody.insertRow();
            row.onclick = () => openModal(item);
            row.innerHTML = `<td>${d.getDate()}/${d.getMonth()+1}</td><td>${item.note}</td><td>${item.idr.toLocaleString('id-ID')}</td><td>${item.gram.toFixed(4)}</td>`;
        }
    });

    document.getElementById('total-gram-all').innerText = tGramAll.toFixed(4) + " Gr";
    document.getElementById('total-idr-all').innerText = "Rp " + tIdrAll.toLocaleString('id-ID');
    document.getElementById('foot-idr').innerText = "Rp " + fIdr.toLocaleString('id-ID');
    document.getElementById('foot-gram').innerText = fGram.toFixed(4);
}

// --- 4. UI HELPER ---
function openModal(item) {
    selectedId = item.id;
    document.getElementById('modal-body').innerHTML = `
        <p><strong>Tanggal:</strong> ${item.date}</p>
        <p><strong>Keterangan:</strong> ${item.note}</p>
        <p><strong>Nominal:</strong> Rp ${item.idr.toLocaleString('id-ID')}</p>
        <p><strong>Berat:</strong> ${item.gram.toFixed(4)} Gr</p>
    `;
    document.getElementById('detailModal').style.display = 'block';
}
function closeModal() { document.getElementById('detailModal').style.display = 'none'; }
function resetForm() {
    document.getElementById('edit-id').value = ""; 
    document.getElementById('input-date').valueAsDate = new Date();
    document.getElementById('note').value = ""; document.getElementById('input-idr').value = "";
    document.getElementById('input-gram').value = ""; document.getElementById('form-title').innerText = "Input Transaksi";
    document.getElementById('btn-save').innerText = "Simpan ke Cloud"; document.getElementById('btn-cancel').style.display = "none";
}
function prepareEdit() {
    const item = transactions.find(t => t.id === selectedId);
    document.getElementById('edit-id').value = item.id; 
    document.getElementById('input-date').value = item.date;
    document.getElementById('note').value = item.note; 
    document.getElementById('input-idr').value = item.idr;
    document.getElementById('input-gram').value = item.gram;
    document.getElementById('form-title').innerText = "Edit Transaksi"; 
    document.getElementById('btn-save').innerText = "Update Cloud"; 
    document.getElementById('btn-cancel').style.display = "block"; closeModal(); window.scrollTo(0,0);
}
function changeYear(step) { 
    const input = document.getElementById('filter-year');
    input.value = parseInt(input.value) + step; 
    updateDashboard(); 
}

// --- 5. BACKUP ---
function exportData() {
    const blob = new Blob([JSON.stringify(transactions)], {type: "application/json"});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `backup_emas_${new Date().toLocaleDateString()}.json`;
    a.click();
}
function importData(event) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = JSON.parse(e.target.result);
        if(confirm(`Impor ${data.length} data ke Cloud?`)) {
            const userRef = db.collection("users").doc(currentUser.uid).collection("emas");
            data.forEach(item => { const {id, ...pureData} = item; userRef.add(pureData); });
        }
    };
    reader.readAsText(event.target.files[0]);
}
