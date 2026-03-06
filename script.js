// Data Dasar
const baseBalance = 1.3701;
let transactions = JSON.parse(localStorage.getItem('yudi_emas_db')) || [];

// Load data saat pertama buka
document.addEventListener('DOMContentLoaded', updateDashboard);

function addData() {
    const date = document.getElementById('input-date').value;
    const note = document.getElementById('note').value;
    const idr = parseFloat(document.getElementById('input-idr').value) || 0;
    const gram = parseFloat(document.getElementById('input-gram').value) || 0;

    if (!date || !note || gram === 0) {
        alert("Data belum lengkap!");
        return;
    }

    const entry = {
        id: Date.now(),
        date: date,
        note: note,
        idr: idr,
        gram: gram
    };

    transactions.push(entry);
    
    // URUTKAN BERDASARKAN TANGGAL (Penting agar Januari-Maret terstruktur)
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    saveAndRefresh();

    // Clear form
    document.getElementById('note').value = "";
    document.getElementById('input-idr').value = "";
    document.getElementById('input-gram').value = "";
}

function saveAndRefresh() {
    localStorage.setItem('yudi_emas_db', JSON.stringify(transactions));
    updateDashboard();
}

function updateDashboard() {
    let currentGram = baseBalance;
    let currentIdr = 0;
    const tbody = document.querySelector('#data-table tbody');
    tbody.innerHTML = '';

    transactions.forEach(item => {
        currentGram += item.gram;
        currentIdr += item.idr;

        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${formatDate(item.date)}</td>
            <td>${item.note}</td>
            <td>${item.idr.toLocaleString('id-ID')}</td>
            <td>${item.gram.toFixed(4)}</td>
            <td><button onclick="deleteItem(${item.id})" style="color:red; border:none; background:none;">X</button></td>
        `;
    });

    document.getElementById('total-gram').innerText = currentGram.toFixed(4) + " Gr";
    document.getElementById('total-idr').innerText = "Rp " + currentIdr.toLocaleString('id-ID');
}

function formatDate(dateStr) {
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return new Date(dateStr).toLocaleDateString('id-ID', options);
}

function deleteItem(id) {
    if(confirm("Hapus data ini?")) {
        transactions = transactions.filter(t => t.id !== id);
        saveAndRefresh();
    }
}

// Backup & Restore
function exportData() {
    const blob = new Blob([JSON.stringify(transactions)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_emas_yudi_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
}

function importData(event) {
    const reader = new FileReader();
    reader.onload = function(e) {
        transactions = JSON.parse(e.target.result);
        saveAndRefresh();
        alert("Data berhasil diimpor!");
    };
    reader.readAsText(event.target.files[0]);
}
