// Isi lengkap untuk file dash.js

const client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt");

// Dapatkan referensi ke elemen HTML yang relevan
const mqttStatusElement = document.getElementById("mqttStatus");
const statusIndicator = document.querySelector(".status-indicator");
const alcoholValueElement = document.getElementById("alcoholValue");
const alcoholStatusElement = document.getElementById("alcoholStatus");
const distanceValueEl = document.getElementById("distanceValue");
const distanceUnitEl = document.getElementById("distanceUnit");
const lastUpdateElement = document.getElementById("lastUpdate");

// Elemen-elemen untuk peringatan pop-up
const alertIndicator = document.getElementById("alertIndicator");
const viewAlertsBtn = document.getElementById("viewAlertsBtn");
const latestAlertEntry = document.getElementById("latestAlertEntry");

// Inisialisasi modal Bootstrap
const alertModal = new bootstrap.Modal(document.getElementById('alertModal'));

// Variabel untuk menyimpan peringatan terakhir
let lastWarningData = null;

// Fungsi untuk memperbarui tampilan peringatan di modal dan indikator utama
function updateLatestAlertDisplay(data = null) {
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
        alertIndicator.className = "text-danger fw-bold fa-beat";
        viewAlertsBtn.classList.remove("d-none");
        
        if (!alertModal._isShown) {
            alertModal.show();
        }
    } else {
        latestAlertEntry.textContent = "Tidak ada peringatan berbahaya yang terdeteksi terkini.";
        alertIndicator.textContent = "Tidak ada peringatan.";
        alertIndicator.className = "text-success fw-bold";
        viewAlertsBtn.classList.add("d-none");
    }
}


// Fungsi saat berhasil terhubung ke Broker MQTT
client.on("connect", () => {
    console.log("Terhubung ke broker MQTT");
    mqttStatusElement.textContent = "Terhubung";
    statusIndicator.classList.remove("status-disconnected");
    statusIndicator.classList.add("status-connected");
    client.subscribe("alkohol/kadar");
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

const ctx = document.getElementById("chart").getContext("2d");

const gradient = ctx.createLinearGradient(0, 0, 0, 300);
gradient.addColorStop(0, 'rgba(0, 123, 255, 0.2)');
gradient.addColorStop(1, 'rgba(0, 123, 255, 0.0)');

const chart = new Chart(ctx, {
    type: "line",
    data: {
        labels: [],
        datasets: [{
            label: "Nilai Sensor Alkohol",
            data: [],
            backgroundColor: gradient,
            borderColor: "#007BFF",
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: "#ffffff",
            pointBorderColor: "#007BFF",
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 7,
        },
        {
            label: "Jarak (cm)",
            data: [],
            borderColor: "#FFC107",
            borderWidth: 3,
            fill: false,
            tension: 0.4,
            pointBackgroundColor: "#ffffff",
            pointBorderColor: "#FFC107",
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
                title: { display: true, text: "Waktu", color: '#6c757d' },
                ticks: { color: '#6c757d' },
                grid: {
                    color: "rgba(0, 0, 0, 0.1)",
                    drawBorder: false,
                }
            },
            y: { 
                title: { display: true, text: "Nilai", color: '#6c757d' },
                ticks: { color: '#6c757d' },
                grid: {
                    color: "rgba(0, 0, 0, 0.1)",
                    drawBorder: false,
                }
            }
        },
        plugins: {
            legend: {
                labels: {
                    color: '#343a40',
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
        const time = new Date().toLocaleTimeString('id-ID');

        // --- Update Tampilan Real-Time (Kadar Alkohol) ---
        alcoholValueElement.textContent = `${value} PPM`; 
        
        if (status === "BAHAYA") {
            alcoholStatusElement.textContent = "Kadar Alkohol BERBAHAYA!";
            alcoholStatusElement.className = "status-text text-danger fw-bold";
        } else {
            alcoholStatusElement.textContent = "Kadar Alkohol Normal";
            alcoholStatusElement.className = "status-text text-success fw-bold";
        }
        lastUpdateElement.textContent = time;

        // --- LOGIKA UNTUK JARAK (cm/m) ---
        if (isNaN(distance) || distance < 0) { 
            distanceValueEl.textContent = "---";
            distanceUnitEl.textContent = "cm";
        } else if (distance < 100) {
            distanceValueEl.textContent = distance.toFixed(1);
            distanceUnitEl.textContent = "cm";
        } else {
            const distanceInMeters = distance / 100;
            distanceValueEl.textContent = distanceInMeters.toFixed(2);
            distanceUnitEl.textContent = "m";
        }

        // Update data grafik
        chart.data.labels.push(time);
        chart.data.datasets[0].data.push(value);
        chart.data.datasets[1].data.push(distance);

        if (chart.data.labels.length > 20) { // Pertahankan 20 data terakhir
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
                    return; 
                }
            }

            lastWarningData = currentWarning;
            updateLatestAlertDisplay(lastWarningData);

        } else { // Jika status NORMAL
            alertIndicator.textContent = "Tidak ada peringatan.";
            alertIndicator.className = "text-success fw-bold";
            viewAlertsBtn.classList.add("d-none");
        }

    } catch (err) {
        console.error("Gagal memproses pesan. Format JSON tidak valid:", err);
    }
});


// Panggil updateLatestAlertDisplay() saat DOMContentLoaded untuk inisialisasi awal
document.addEventListener('DOMContentLoaded', () => {
    // Inisialisasi teks awal untuk elemen-elemen UI
    alcoholValueElement.textContent = "---";
    alcoholStatusElement.textContent = "Menunggu Data";
    distanceValueEl.textContent = "---";
    distanceUnitEl.textContent = "cm"; 
    updateLatestAlertDisplay(null); // Awalnya tidak ada peringatan di UI utama
});


// Fungsi toggleDistanceChart tidak lagi dipicu oleh tombol di HTML baru.
// Fungsi ini tetap ada jika sewaktu-waktu ingin ditambahkan tombol kembali.
function toggleDistanceChart() {
    const distanceDataset = chart.data.datasets[1];
    distanceDataset.hidden = !distanceDataset.hidden;
    chart.update();
}