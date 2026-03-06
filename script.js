// Data Dasar - Saldo awal sekarang dimulai dari 0
let baseBalance = 0; 
let transactions = JSON.parse(localStorage.getItem('yudi_emas_db')) || [];
let selectedId = null;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('input-date').valueAsDate = new Date();
    updateDashboard();
});

function saveData() {
    const id = document.getElementById('edit-id').value;
    const date = document.getElementById('input-date').value;
    const note = document.getElementById('note').value;
    const idr = parseFloat(document.getElementById('input-idr').value) || 0;
    const gram = parseFloat(document.getElementById('input-gram').value) || 0;

    if (!date || !note) return alert("Isi tanggal & keterangan!");

    if (id) {
        // Mode Edit
        const index = transactions.findIndex(t => t.id == id);
        transactions[index] = { id: parseInt(id), date, note, idr, gram };
    } else {
        // Mode Baru
        transactions.push({ id: Date.now(), date, note, idr, gram });
    }

    // Urutkan berdasarkan tanggal
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    localStorage.setItem('yudi_emas_db', JSON.stringify(transactions));
    resetForm();
    updateDashboard();
}

function updateDashboard() {
    const filterMonth = document.getElementById('filter-month').value;
    const tbody = document.querySelector('#data-table tbody');
    tbody.innerHTML = '';

    let totalGramAll = baseBalance;
    let totalIdrAll = 0;
    let filteredGram = 0;
    let filteredIdr = 0;

    transactions.forEach(item => {
        totalGramAll += item.gram;
        totalIdrAll += item.idr;

        const m = new Date(item.date).getMonth().toString();
        if (filterMonth === "all" || filterMonth === m) {
            filteredGram += item.gram;
            filteredIdr += item.idr;
            
            const row = tbody.insertRow();
            row.onclick = () => openModal(item);
            row.innerHTML = `
                <td>${item.date.split('-')[2]}/${item.date.split('-')[1]}</td>
                <td>${item.note}</td>
                <td>${item.idr.toLocaleString('id-ID')}</td>
                <td>${item.gram.toFixed(4)}</td>
            `;
        }
    });

    document.getElementById('total-gram-all').innerText = totalGramAll.toFixed(4) + " Gr";
    document.getElementById('total-idr-all').innerText = "Rp " + totalIdrAll.toLocaleString('id-ID');
    document.getElementById('foot-idr').innerText = "Rp " + filteredIdr.toLocaleString('id-ID');
    document.getElementById('foot-gram').innerText = filteredGram.toFixed(4);
}

// Logika Modal, Edit, Hapus, Export/Import tetap sama...
function openModal(item) {
    selectedId = item.id;
    const body = document.getElementById('modal-body');
    body.innerHTML = `
        <p><strong>Tanggal:</strong> ${item.date}</p>
        <p><strong>Keterangan:</strong> ${item.note}</p>
        <p><strong>Nominal:</strong> Rp ${item.idr.toLocaleString('id-ID')}</p>
        <p><strong>Berat:</strong> ${item.gram.toFixed(4)} Gr</p>
    `;
    document.getElementById('detailModal').style.display = 'block';
}

function closeModal() { document.getElementById('detailModal').style.display = 'none'; }

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

function confirmDelete() {
    if(confirm("Hapus data ini?")) {
        transactions = transactions.filter(t => t.id !== selectedId);
        localStorage.setItem('yudi_emas_db', JSON.stringify(transactions));
        updateDashboard();
        closeModal();
    }
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
