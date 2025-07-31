// Isi lengkap untuk file script.js
// Pastikan library MQTT.js, Chart.js, dan Bootstrap JS sudah dimuat di HTML

const client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt");

// Dapatkan referensi ke elemen HTML yang relevan
const mqttStatusElement = document.getElementById("broker-status");
const statusIndicator = document.getElementById("broker-status-indicator");
const alcoholValueElement = document.getElementById("alcohol-value");
const alcoholStatusElement = document.getElementById("alcohol-status");
const distanceValueEl = document.getElementById("distance-value");
const distanceUnitEl = document.getElementById("distance-unit");
const lastUpdateElement = document.getElementById("last-update");

// Elemen-elemen untuk peringatan pop-up
const alertIndicator = document.getElementById("alertIndicator");
const viewAlertsBtn = document.getElementById("viewAlertsBtn");
const latestAlertEntry = document.getElementById("latestAlertEntry");
const warningLogCard = document.querySelector('.warning-log');

// Inisialisasi modal Bootstrap
const alertModal = new bootstrap.Modal(document.getElementById('alertModal'));
const modalAlertMessage = document.getElementById('modalAlertMessage');
const alertList = document.getElementById('alertList');

// Variabel untuk menyimpan peringatan terakhir
let lastWarningData = null;
let alertHistory = []; // Untuk menyimpan riwayat peringatan di modal

// Variabel untuk batas data tabel dan grafik
const sampleDataLimit = 5; // Batas maksimal 5 baris data di tabel
const chartDataLimit = 20; // Batas maksimal 20 data di grafik (bisa disesuaikan)
let sampleDataCounter = 0; // Untuk nomor urut tabel data sampel

// Fungsi untuk memperbarui tampilan peringatan di modal dan indikator utama
function updateLatestAlertDisplay(data = null) {
    // Clear previous alerts in modal
    alertList.innerHTML = '';

    if (data && data.status === "BAHAYA") {
        let formattedDistance = data.distance;
        if (!isNaN(data.distance) && data.distance >= 100) {
            formattedDistance = `${(data.distance / 100).toFixed(2)} m`;
        } else if (!isNaN(data.distance) && data.distance >= 0) {
            formattedDistance = `${data.distance.toFixed(1)} cm`;
        } else {
            formattedDistance = "--- cm"; // Untuk kasus NaN atau negatif
        }

        latestAlertEntry.innerHTML = `Kadar: ${data.value} PPM (Jarak: ${formattedDistance}) pada ${data.time}`;
        alertIndicator.textContent = "Ada peringatan BAHAYA!";
        alertIndicator.className = "text-danger fw-bold fa-beat"; // Tambahkan animasi
        viewAlertsBtn.classList.remove("d-none");
        warningLogCard.classList.add('active-warning'); // Tambahkan kelas untuk style card

        // Tambahkan peringatan ke riwayat (jika belum ada duplikat dalam 30 detik & nilai sama)
        const isDuplicateWarning = alertHistory.some(
            (item) => item.value === data.value && (new Date() - new Date(item.timestamp)) < 30000
        );

        if (!isDuplicateWarning) {
            alertHistory.unshift(data); // Tambahkan ke depan
            if (alertHistory.length > 5) { // Batasi riwayat di modal (misalnya 5 peringatan terakhir)
                alertHistory.pop();
            }
        }
        
        // Tampilkan semua riwayat peringatan yang disimpan
        alertHistory.forEach(alert => {
            let item = document.createElement('li');
            let itemFormattedDistance = alert.distance;
            if (!isNaN(alert.distance) && alert.distance >= 100) {
                itemFormattedDistance = `${(alert.distance / 100).toFixed(2)} m`;
            } else if (!isNaN(alert.distance) && alert.distance >= 0) {
                itemFormattedDistance = `${alert.distance.toFixed(1)} cm`;
            } else {
                itemFormattedDistance = "--- cm";
            }
            item.innerHTML = `<i class="fas fa-exclamation-triangle text-warning me-2"></i>Kadar: ${alert.value} PPM (Jarak: ${itemFormattedDistance}) pada ${alert.time}`;
            alertList.appendChild(item);
        });

        // Set pesan di modal
        modalAlertMessage.textContent = `Kadar alkohol ${data.value} PPM terdeteksi berbahaya!`;
        
        if (!alertModal._isShown) { // Tampilkan modal hanya jika belum terbuka
            alertModal.show();
        }
    } else {
        latestAlertEntry.textContent = "Tidak ada peringatan berbahaya yang terdeteksi terkini.";
        alertIndicator.textContent = "Tidak ada peringatan.";
        alertIndicator.className = "text-success fw-bold"; // Hapus animasi
        viewAlertsBtn.classList.add("d-none");
        warningLogCard.classList.remove('active-warning'); // Hapus kelas style card
        
        // Sembunyikan modal jika tidak ada peringatan berbahaya dan modal sedang terbuka
        if (alertModal._isShown) {
            alertModal.hide();
        }
        alertHistory = []; // Hapus riwayat peringatan saat kondisi normal kembali
    }
}

// Event listener untuk tombol "Lihat Peringatan"
viewAlertsBtn.addEventListener('click', () => {
    alertModal.show();
});


// Fungsi saat berhasil terhubung ke Broker MQTT
client.on("connect", () => {
    console.log("Terhubung ke broker MQTT");
    mqttStatusElement.textContent = "Terhubung";
    statusIndicator.classList.remove("status-disconnected");
    statusIndicator.classList.add("status-connected");
    client.subscribe("alkohol/kadar"); // Pastikan topik ini benar
});

// Fungsi jika terjadi error koneksi
client.on("error", (error) => {
    console.error("Gagal terhubung ke broker:", error);
    mqttStatusElement.textContent = "Gagal Terhubung";
    statusIndicator.classList.add("status-disconnected");
    statusIndicator.classList.remove("status-connected");
});

// Fungsi saat koneksi terputus (WebSocket event)
client.on("close", () => {
    console.log("Koneksi ke broker terputus.");
    mqttStatusElement.textContent = "Terputus";
    statusIndicator.classList.remove("status-connected");
    statusIndicator.classList.add("status-disconnected");
});


// =================================================================================
// --- BAGIAN GRAFIK ---
// =================================================================================

// Dapatkan konteks 2D dari elemen canvas
const ctx = document.getElementById("historisChart").getContext("2d");

// Membuat gradient untuk background area chart (menggunakan warna accent baru)
const gradient = ctx.createLinearGradient(0, 0, 0, 300);
gradient.addColorStop(0, 'rgba(77, 194, 248, 0.2)');
gradient.addColorStop(1, 'rgba(77, 194, 248, 0.0)');

const chart = new Chart(ctx, {
    type: "line",
    data: {
        labels: [],
        datasets: [{
            label: "Kadar Alkohol (PPM)",
            data: [],
            backgroundColor: gradient,
            borderColor: "#4dc2f8", // Menggunakan warna accent baru
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: "#ffffff",
            pointBorderColor: "#4dc2f8", // Menggunakan warna accent baru
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 7,
        },
        {
            label: "Jarak (cm)",
            data: [],
            borderColor: "#ffc107", // Warna kuning/orange untuk jarak
            borderWidth: 3,
            fill: false,
            tension: 0.4,
            pointBackgroundColor: "#ffffff",
            pointBorderColor: "#ffc107",
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 7,
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: { 
                title: { display: true, text: "Waktu", color: '#aebfd6' }, // Warna teks title
                ticks: { color: '#aebfd6' }, // Warna teks ticks
                grid: {
                    color: "rgba(174, 191, 214, 0.1)", // Warna garis grid (dari aebfd6)
                    drawBorder: false,
                }
            },
            y: { 
                title: { display: true, text: "Nilai", color: '#aebfd6' }, // Warna teks title
                ticks: { color: '#aebfd6' }, // Warna teks ticks
                max: 1000, // Batas maksimal untuk nilai alkohol (sesuaikan jika perlu)
                min: 0,    // Batas minimal untuk nilai alkohol
                grid: {
                    color: "rgba(174, 191, 214, 0.1)", // Warna garis grid
                    drawBorder: false,
                }
            }
        },
        plugins: {
            legend: {
                labels: {
                    color: '#e3f2fd', // Warna teks legenda
                    font: {
                        size: 14
                    }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: '#ffffff',
                bodyColor: '#dddddd',
                padding: 10,
                cornerRadius: 8,
                displayColors: false,
            }
        }
    }
});

// =================================================================================
// --- AKHIR BAGIAN GRAFIK ---
// =================================================================================


// Fungsi saat menerima pesan dari Broker MQTT
client.on("message", (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        const value = parseInt(data.nilai);
        const status = data.status;
        const distance = parseFloat(data.jarak);
        // Format waktu lebih detail (misal: 10:30:45)
        const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        // --- Update Waktu Terakhir ---
        lastUpdateElement.textContent = time;

        // --- Update Tampilan Real-Time (Kadar Alkohol) ---
        alcoholValueElement.textContent = `${value} PPM`; 
        
        if (status === "BAHAYA") {
            alcoholStatusElement.textContent = "Kadar Alkohol BERBAHAYA!";
            alcoholStatusElement.className = "data-status status-text text-danger fw-bold";
        } else {
            alcoholStatusElement.textContent = "Kadar Alkohol Normal";
            alcoholStatusElement.className = "data-status status-text text-success fw-bold";
        }

        // --- LOGIKA UNTUK JARAK (cm/m) ---
        if (isNaN(distance) || distance < 0) { 
            distanceValueEl.textContent = "---";
            distanceUnitEl.textContent = "cm";
            document.getElementById('distance-status').textContent = 'Invalid Data';
            document.getElementById('distance-status').className = 'data-status text-danger';
        } else if (distance < 100) {
            distanceValueEl.textContent = distance.toFixed(1);
            distanceUnitEl.textContent = "cm";
            document.getElementById('distance-status').textContent = 'Terukur';
            document.getElementById('distance-status').className = 'data-status text-success';
        } else {
            const distanceInMeters = distance / 100;
            distanceValueEl.textContent = distanceInMeters.toFixed(2);
            distanceUnitEl.textContent = "m";
            document.getElementById('distance-status').textContent = 'Terukur';
            document.getElementById('distance-status').className = 'data-status text-success';
        }

        // Update data grafik
        chart.data.labels.push(time);
        chart.data.datasets[0].data.push(value);
        chart.data.datasets[1].data.push(distance);

        if (chart.data.labels.length > chartDataLimit) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
            chart.data.datasets[1].data.shift();
        }
        chart.update();

        // --- LOGIKA PERINGATAN POP-UP ---
        if (status === "BAHAYA") {
            const currentWarning = {
                value: value,
                status: status, 
                time: time,
                distance: isNaN(distance) || distance < 0 ? "NaN" : distance, 
                timestamp: new Date().toISOString()
            };

            // Cek duplikasi: jika peringatan terbaru serupa dalam 30 detik DAN nilainya sama
            if (lastWarningData) {
                const lastLogTimestamp = new Date(lastWarningData.timestamp);
                const timeDiff = new Date() - lastLogTimestamp;
                const isSimilarValue = lastWarningData.value === value; 

                if (timeDiff < 30000 && isSimilarValue) {
                    return; // Abaikan jika duplikat dalam waktu singkat dengan nilai yang sama
                }
            }
            lastWarningData = currentWarning; // Update last warning
            updateLatestAlertDisplay(lastWarningData); // Tampilkan di UI
        } else { // Jika status NORMAL
            updateLatestAlertDisplay(null); // Setel ulang tampilan peringatan
        }

        // --- Update Tabel Data Sampel ---
        const sampleTableBody = document.getElementById('sample-table-body');
        const noDataRow = sampleTableBody.querySelector('.no-data-row');
        if (noDataRow) {
            noDataRow.remove(); // Hapus pesan "Tidak ada data" jika ada data pertama
        }

        // Jika jumlah baris sudah mencapai batas, hapus baris terakhir (paling lama)
        if (sampleTableBody.rows.length >= sampleDataLimit) {
            sampleTableBody.deleteRow(sampleDataLimit - 1); // Hapus baris paling bawah (indeksnya = batas - 1)
        }

        sampleDataCounter++; // Tingkatkan counter untuk nomor urut
        const newRow = sampleTableBody.insertRow(0); // Selalu insert di paling atas (data terbaru)
        
        let displayDistance = isNaN(distance) ? "---" : distance.toFixed(1); // Format distance for table
        if (distance >= 100) {
            displayDistance = `${(distance / 100).toFixed(2)} m`;
        } else if (distance >= 0) {
            displayDistance = `${distance.toFixed(1)} cm`;
        }

        newRow.innerHTML = `
            <td>${sampleDataCounter}</td>
            <td>${value}</td>
            <td>${status}</td>
            <td>${displayDistance}</td>
            <td>${time}</td>
        `;

    } catch (err) {
        console.error("Gagal memproses pesan. Format JSON tidak valid:", err);
    }
});


// Panggil fungsi inisialisasi saat DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    // Inisialisasi teks awal untuk elemen-elemen UI
    alcoholValueElement.textContent = "---";
    alcoholStatusElement.textContent = "Menunggu Data";
    distanceValueEl.textContent = "---";
    distanceUnitEl.textContent = "cm"; 
    
    // Set status broker awal sebagai 'Terputus'
    mqttStatusElement.textContent = "Terputus";
    statusIndicator.classList.add("status-disconnected");
    statusIndicator.classList.remove("status-connected");

    updateLatestAlertDisplay(null); // Awalnya tidak ada peringatan di UI utama

    // Kosongkan grafik saat inisialisasi
    chart.data.labels = [];
    chart.data.datasets[0].data = [];
    chart.data.datasets[1].data = [];
    chart.update();

    // Reset counter tabel saat DOM dimuat
    sampleDataCounter = 0; 

    // Pastikan tabel kosong saat DOM dimuat, kecuali pesan "tidak ada data"
    const sampleTableBody = document.getElementById('sample-table-body');
    sampleTableBody.innerHTML = `<tr><td colspan="5" class="no-data-row">Tidak ada data sampel terkumpul.</td></tr>`;
});

// Fungsi toggleDistanceChart (tidak digunakan di HTML saat ini, tapi bisa disimpan)
function toggleDistanceChart() {
    const distanceDataset = chart.data.datasets[1];
    distanceDataset.hidden = !distanceDataset.hidden;
    chart.update();
}
