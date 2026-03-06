// Inisialisasi Data
let baseBalance = 1.3701;
let transactions = JSON.parse(localStorage.getItem('emas_transactions')) || [];

// Jalankan fungsi tampilkan data saat pertama kali buka aplikasi
document.addEventListener('DOMContentLoaded', updateDashboard);

function addData() {
    const note = document.getElementById('note').value;
    const idr = parseFloat(document.getElementById('input-idr').value) || 0;
    const gram = parseFloat(document.getElementById('input-gram').value) || 0;

    if (!note || gram === 0) {
        alert("Isi keterangan dan berat emas dengan benar!");
        return;
    }

    // Buat objek transaksi baru
    const newTransaction = {
        id: Date.now(),
        note: note,
        idr: idr,
        gram: gram
    };

    // Simpan ke array dan LocalStorage
    transactions.push(newTransaction);
    saveData();
    
    // Update Tampilan
    updateDashboard();

    // Reset Form
    document.getElementById('note').value = "";
    document.getElementById('input-idr').value = "";
    document.getElementById('input-gram').value = "";
}

function saveData() {
    localStorage.setItem('emas_transactions', JSON.stringify(transactions));
}

function updateDashboard() {
    let currentTotalGram = baseBalance;
    let currentTotalIdr = 0;
    const tbody = document.querySelector('#data-table tbody');
    tbody.innerHTML = '';

    transactions.forEach((item) => {
        currentTotalGram += item.gram;
        currentTotalIdr += item.idr;

        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${item.note}</td>
            <td>${item.idr.toLocaleString('id-ID')}</td>
            <td>${item.gram.toFixed(4)}</td>
            <td><button class="delete-btn" onclick="deleteRow(${item.id})">Hapus</button></td>
        `;
    });

    document.getElementById('total-gram').innerText = currentTotalGram.toFixed(4) + " Gr";
    document.getElementById('total-idr').innerText = "Rp " + currentTotalIdr.toLocaleString('id-ID');
}

function deleteRow(id) {
    if(confirm("Hapus transaksi ini?")) {
        transactions = transactions.filter(t => t.id !== id);
        saveData();
        updateDashboard();
    }
}

function calculateProfit() {
    const currentPrice = parseFloat(document.getElementById('current-price').value) || 0;
    const display = document.getElementById('profit-display');
    
    // Hitung total gram dan investasi saat ini
    let totalG = baseBalance;
    let totalI = 0;
    transactions.forEach(t => {
        totalG += t.gram;
        totalI += t.idr;
    });

    if (currentPrice > 0) {
        const currentAssetValue = totalG * currentPrice;
        const profit = currentAssetValue - totalI;
        const percent = totalI > 0 ? (profit / totalI * 100).toFixed(2) : 0;
        
        display.innerHTML = `Nilai Aset: <strong>Rp ${currentAssetValue.toLocaleString('id-ID')}</strong><br>
                             Estimasi Untung: <span style="color: ${profit >= 0 ? '#27ae60' : '#e74c3c'}">
                             Rp ${profit.toLocaleString('id-ID')} (${percent}%)</span>`;
    } else {
        alert("Masukkan harga emas saat ini dahulu!");
    }
}
