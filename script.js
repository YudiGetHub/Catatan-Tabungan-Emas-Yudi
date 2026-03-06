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

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

let transactions = JSON.parse(localStorage.getItem('yudi_emas_db')) || [];
let selectedId = null;

// --- SISTEM LOGIN FIREBASE ---
function handleLogin() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    const errorMsg = document.getElementById('login-error');

    auth.signInWithEmailAndPassword(email, pass)
        .catch((error) => {
            errorMsg.innerText = "Error: " + error.message;
            errorMsg.style.display = 'block';
        });
}

function handleLogout() {
    auth.signOut();
}

// Cek status login
auth.onAuthStateChanged((user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
        document.getElementById('user-display').innerText = user.email;
        updateDashboard();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
    }
});

// --- LOGIKA APLIKASI ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('input-date').valueAsDate = new Date();
    document.getElementById('filter-year').value = new Date().getFullYear();
});

function changeYear(step) {
    const yearInput = document.getElementById('filter-year');
    yearInput.value = parseInt(yearInput.value) + step;
    updateDashboard();
}

function saveData() {
    const id = document.getElementById('edit-id').value;
    const date = document.getElementById('input-date').value;
    const note = document.getElementById('note').value;
    const idr = parseFloat(document.getElementById('input-idr').value) || 0;
    const gram = parseFloat(document.getElementById('input-gram').value) || 0;

    if (!date || !note) return alert("Isi tanggal & keterangan!");

    if (id) {
        const index = transactions.findIndex(t => t.id == id);
        transactions[index] = { id: parseInt(id), date, note, idr, gram };
    } else {
        transactions.push({ id: Date.now(), date, note, idr, gram });
    }

    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    localStorage.setItem('yudi_emas_db', JSON.stringify(transactions));
    resetForm();
    updateDashboard();
}

function updateDashboard() {
    const filterYear = document.getElementById('filter-year').value;
    const filterMonth = document.getElementById('filter-month').value;
    const filterSearch = document.getElementById('filter-search').value.toLowerCase();
    const tbody = document.querySelector('#data-table tbody');
    tbody.innerHTML = '';

    let totalGramAll = 0; let totalIdrAll = 0;
    let filteredGram = 0; let filteredIdr = 0;

    transactions.forEach(item => {
        const d = new Date(item.date);
        totalGramAll += item.gram;
        totalIdrAll += item.idr;

        const matchYear = (filterYear === "" || filterYear === d.getFullYear().toString());
        const matchMonth = (filterMonth === "all" || filterMonth === d.getMonth().toString());
        const matchSearch = item.note.toLowerCase().includes(filterSearch);

        if (matchYear && matchMonth && matchSearch) {
            filteredGram += item.gram;
            filteredIdr += item.idr;
            const row = tbody.insertRow();
            row.onclick = () => openModal(item);
            row.innerHTML = `<td>${d.getDate()}/${d.getMonth()+1}</td><td>${item.note}</td><td>${item.idr.toLocaleString()}</td><td>${item.gram.toFixed(4)}</td>`;
        }
    });

    document.getElementById('total-gram-all').innerText = totalGramAll.toFixed(4) + " Gr";
    document.getElementById('total-idr-all').innerText = "Rp " + totalIdrAll.toLocaleString('id-ID');
    document.getElementById('foot-idr').innerText = "Rp " + filteredIdr.toLocaleString();
    document.getElementById('foot-gram').innerText = filteredGram.toFixed(4);
}

// MODAL & FORM
function openModal(item) {
    selectedId = item.id;
    document.getElementById('modal-body').innerHTML = `
        <p><strong>Tanggal:</strong> ${item.date}</p>
        <p><strong>Keterangan:</strong> ${item.note}</p>
        <p><strong>Nominal:</strong> Rp ${item.idr.toLocaleString()}</p>
        <p><strong>Berat:</strong> ${item.gram.toFixed(4)} Gr</p>
    `;
    document.getElementById('detailModal').style.display = 'block';
}

function closeModal() { document.getElementById('detailModal').style.display = 'none'; }

function confirmDelete() {
    if(confirm("Hapus data ini?")) {
        transactions = transactions.filter(t => t.id !== selectedId);
        localStorage.setItem('yudi_emas_db', JSON.stringify(transactions));
        updateDashboard();
        closeModal();
    }
}

function prepareEdit() {
    const item = transactions.find(t => t.id === selectedId);
    document.getElementById('edit-id').value = item.id;
    document.getElementById('input-date').value = item.date;
    document.getElementById('note').value = item.note;
    document.getElementById('input-idr').value = item.idr;
    document.getElementById('input-gram').value = item.gram;
    document.getElementById('form-title').innerText = "Edit Transaksi";
    document.getElementById('btn-save').innerText = "Update";
    document.getElementById('btn-cancel').style.display = "block";
    closeModal();
    window.scrollTo(0,0);
}

function resetForm() {
    document.getElementById('edit-id').value = "";
    document.getElementById('form-title').innerText = "Input Transaksi";
    document.getElementById('btn-save').innerText = "Simpan";
    document.getElementById('btn-cancel').style.display = "none";
    document.getElementById('input-date').valueAsDate = new Date();
    document.getElementById('note').value = "";
    document.getElementById('input-idr').value = "";
    document.getElementById('input-gram').value = "";
}

// EXPORT IMPORT
function exportData() {
    const blob = new Blob([JSON.stringify(transactions)], {type: "application/json"});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = "emas_yudi_backup.json";
    a.click();
}

function importData(event) {
    const reader = new FileReader();
    reader.onload = (e) => {
        transactions = JSON.parse(e.target.result);
        localStorage.setItem('yudi_emas_db', JSON.stringify(transactions));
        updateDashboard();
    };
    reader.readAsText(event.target.files[0]);
}
