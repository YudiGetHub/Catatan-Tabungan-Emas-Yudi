let baseBalance = 1.3701;
let totalGram = baseBalance;
let totalInvested = 0;

function addData() {
    const note = document.getElementById('note').value;
    const idr = parseFloat(document.getElementById('input-idr').value) || 0;
    const gram = parseFloat(document.getElementById('input-gram').value) || 0;

    if (!note || gram === 0) {
        alert("Isi keterangan dan berat emas dengan benar!");
        return;
    }

    // Update Logika
    totalGram += gram;
    totalInvested += idr;

    // Update Tampilan
    updateDashboard();

    // Tambah ke Tabel
    const table = document.getElementById('data-table').getElementsByTagName('tbody')[0];
    const row = table.insertRow();
    row.innerHTML = `
        <td>${note}</td>
        <td>${idr.toLocaleString('id-ID')}</td>
        <td>${gram.toFixed(4)}</td>
        <td><button class="delete-btn" onclick="deleteRow(this, ${idr}, ${gram})">Hapus</button></td>
    `;

    // Reset Form
    document.getElementById('note').value = "";
    document.getElementById('input-idr').value = "";
    document.getElementById('input-gram').value = "";
}

function updateDashboard() {
    document.getElementById('total-gram').innerText = totalGram.toFixed(4) + " Gr";
    document.getElementById('total-idr').innerText = "Rp " + totalInvested.toLocaleString('id-ID');
}

function deleteRow(btn, idr, gram) {
    if(confirm("Hapus transaksi ini?")) {
        const row = btn.parentNode.parentNode;
        row.parentNode.removeChild(row);
        totalGram -= gram;
        totalInvested -= idr;
        updateDashboard();
    }
}

function calculateProfit() {
    const currentPrice = parseFloat(document.getElementById('current-price').value) || 0;
    const display = document.getElementById('profit-display');
    
    if (currentPrice > 0) {
        const currentAssetValue = totalGram * currentPrice;
        const profit = currentAssetValue - totalInvested;
        const percent = totalInvested > 0 ? (profit / totalInvested * 100).toFixed(2) : 0;
        
        display.innerText = `Nilai Aset: Rp ${currentAssetValue.toLocaleString('id-ID')} (Untung: Rp ${profit.toLocaleString('id-ID')} / ${percent}%)`;
    } else {
        alert("Masukkan harga emas saat ini dahulu!");
    }
}
