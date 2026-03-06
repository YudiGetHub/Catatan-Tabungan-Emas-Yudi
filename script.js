const baseBalance = 1.3701;
let transactions = JSON.parse(localStorage.getItem('yudi_emas_db')) || [];

document.addEventListener('DOMContentLoaded', () => {
    // Set default tanggal ke hari ini
    document.getElementById('input-date').valueAsDate = new Date();
    updateDashboard();
});

function addData() {
    const date = document.getElementById('input-date').value;
    const note = document.getElementById('note').value;
    const idr = parseFloat(document.getElementById('input-idr').value) || 0;
    const gram = parseFloat(document.getElementById('input-gram').value) || 0;

    if (!date || !note || gram === 0) {
        alert("Data belum lengkap!");
        return;
    }

    const entry = { id: Date.now(), date: date, note: note, idr: idr, gram: gram };
    transactions.push(entry);
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    saveAndRefresh();

    document.getElementById('note').value = "";
    document.getElementById('input-idr').value = "";
    document.getElementById('input-gram').value = "";
}

function saveAndRefresh() {
    localStorage.setItem('yudi_emas_db', JSON.stringify(transactions));
    updateDashboard();
}

function updateDashboard() {
    const filterMonth = document.getElementById('filter-month').value;
    const tbody = document.querySelector('#data-table tbody');
    tbody.innerHTML = '';

    let totalGramAll = baseBalance;
    let totalIdrAll = 0;
    
    let totalGramFiltered = 0;
    let totalIdrFiltered = 0;

    transactions.forEach(item => {
        const itemDate = new Date(item.date);
        const itemMonth = itemDate.getMonth().toString();

        // Hitung akumulasi global (tetap berjalan di latar belakang)
        totalGramAll += item.gram;
        totalIdrAll += item.idr;

        // Logika Filter
        if (filterMonth === "all" || filterMonth === itemMonth) {
            totalGramFiltered += item.gram;
            totalIdrFiltered += item.idr;

            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${formatDate(item.date)}</td>
                <td>${item.note}</td>
                <td>${item.idr.toLocaleString('id-ID')}</td>
                <td>${item.gram.toFixed(4)}</td>
                <td><button onclick="deleteItem(${item.id})" style="color:red; border:none; background:none; cursor:pointer">X</button></td>
            `;
        }
    });

    // Update Header (Total Keseluruhan)
    document.getElementById('total-gram-all').innerText = totalGramAll.toFixed(4) + " Gr";
    document.getElementById('total-idr-all').innerText = "Rp " + totalIdrAll.toLocaleString('id-ID');

    // Update Footer (Total Hasil Filter)
    document.getElementById('foot-idr').innerText = "Rp " + totalIdrFiltered.toLocaleString('id-ID');
    document.getElementById('foot-gram').innerText = totalGramFiltered.toFixed(4);
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return `${d.getDate()} ${d.toLocaleDateString('id-ID', {month: 'short'})}`;
}

function deleteItem(id) {
    if(confirm("Hapus data?")) {
        transactions = transactions.filter(t => t.id !== id);
        saveAndRefresh();
    }
}

// Fungsi Export & Import tetap sama
function exportData() {
    const blob = new Blob([JSON.stringify(transactions)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_emas_yudi.json`;
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
