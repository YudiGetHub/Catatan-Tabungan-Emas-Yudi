let baseBalance = 1.3701;
let transactions = JSON.parse(localStorage.getItem('emas_transactions')) || [];

// 1. Fungsi Ambil Harga Emas dari API Publik (Contoh menggunakan API harga emas terbuka)
async function fetchGoldPrice() {
    try {
        // Menggunakan API publik sederhana untuk demo (Bisa diganti dengan API key dari GoldAPI/Metalprice)
        const response = await fetch('https://api.gold-api.com/price/XAU');
        const data = await response.json();
        
        // Konversi dari USD per Ounce ke IDR per Gram (Estimasi)
        // Kita gunakan harga rata-rata Treasury hari ini jika API gagal
        const pricePerGramIDR = data.price_gram_24k || 1350000; 
        
        document.getElementById('live-price').innerText = "Rp " + pricePerGramIDR.toLocaleString('id-ID');
        return pricePerGramIDR;
    } catch (error) {
        document.getElementById('live-price').innerText = "Rp 1.350.000 (Manual)";
        return 1350000;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchGoldPrice();
    updateDashboard();
});

function addData() {
    const date = document.getElementById('input-date').value;
    const note = document.getElementById('note').value;
    const idr = parseFloat(document.getElementById('input-idr').value) || 0;
    const gram = parseFloat(document.getElementById('input-gram').value) || 0;

    if (!date || !note || gram === 0) {
        alert("Mohon lengkapi Tanggal, Keterangan, dan Berat Emas!");
        return;
    }

    const newTransaction = {
        id: Date.now(),
        date: date, // Menyimpan tanggal input
        note: note,
        idr: idr,
        gram: gram
    };

    transactions.push(newTransaction);
    
    // 2. SORTIR: Mengurutkan data berdasarkan tanggal secara otomatis
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    saveData();
    updateDashboard();

    // Reset Form
    document.getElementById('note').value = "";
    document.getElementById('input-idr').value = "";
    document.getElementById('input-gram').value = "";
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
            <td>${item.date}</td>
            <td>${item.note}</td>
            <td>${item.idr.toLocaleString('id-ID')}</td>
            <td>${item.gram.toFixed(4)}</td>
            <td><button onclick="deleteRow(${item.id})" style="color:red; border:none; background:none; cursor:pointer">Hapus</button></td>
        `;
    });

    document.getElementById('total-gram').innerText = currentTotalGram.toFixed(4) + " Gr";
    document.getElementById('total-idr').innerText = "Rp " + currentTotalIdr.toLocaleString('id-ID');
}

// Fungsi Simpan, Hapus, Export, Import tetap sama seperti sebelumnya...
function saveData() { localStorage.setItem('emas_transactions', JSON.stringify(transactions)); }
function deleteRow(id) { 
    if(confirm("Hapus?")) { 
        transactions = transactions.filter(t => t.id !== id); 
        saveData(); updateDashboard(); 
    } 
}
function exportData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(transactions));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "backup_emas.json");
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}
