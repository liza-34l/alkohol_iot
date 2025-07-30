const client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt");

const mqttStatusElement = document.getElementById("mqttStatus");
const statusIndicator = document.querySelector(".status-indicator");
const alcoholValueElement = document.getElementById("alcoholValue");
const alcoholStatusElement = document.getElementById("alcoholStatus");
const distanceValueEl = document.getElementById("distanceValue");
const distanceUnitEl = document.getElementById("distanceUnit");
const lastUpdateElement = document.getElementById("lastUpdate");

const alertIndicator = document.getElementById("alertIndicator");
const viewAlertsBtn = document.getElementById("viewAlertsBtn");
const latestAlertEntry = document.getElementById("latestAlertEntry");
const alertModal = new bootstrap.Modal(document.getElementById('alertModal'));

let lastWarningData = null;

function updateLatestAlertDisplay(data = null) {
    if (data && data.status === "BAHAYA") {
        let formattedDistance = data.distance;
        if (!isNaN(data.distance) && data.distance >= 100) {
            formattedDistance = `${(data.distance / 100).toFixed(2)} m`;
        } else if (!isNaN(data.distance) && data.distance >= 0) {
            formattedDistance = `${data.distance.toFixed(1)} cm`;
        } else {
            formattedDistance = "--- cm";
        }

        latestAlertEntry.innerHTML = `Kadar: ${data.value} PPM (Jarak: ${formattedDistance}) pada ${data.time}`;
        alertIndicator.textContent = "🚨 Ada peringatan BAHAYA!";
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

client.on("connect", () => {
    console.log("Terhubung ke broker MQTT");
    mqttStatusElement.textContent = "Terhubung";
    statusIndicator.classList.remove("status-disconnected");
    statusIndicator.classList.add("status-connected");
    client.subscribe("alkohol/kadar");
});

client.on("error", (error) => {
    console.error("Gagal terhubung ke broker:", error);
    mqttStatusElement.textContent = "Gagal Terhubung";
    statusIndicator.classList.add("status-disconnected");
    statusIndicator.classList.remove("status-connected");
});

client.on("close", () => {
    console.log("Koneksi ke broker terputus.");
    mqttStatusElement.textContent = "Terputus";
    statusIndicator.classList.remove("status-connected");
    statusIndicator.classList.add("status-disconnected");
});

// === GRAFIK DENGAN GAYA NEON ===
const ctx = document.getElementById("chart").getContext("2d");

const gradientCyan = ctx.createLinearGradient(0, 0, 0, 300);
gradientCyan.addColorStop(0, 'rgba(0, 255, 255, 0.3)');
gradientCyan.addColorStop(1, 'rgba(0, 255, 255, 0.0)');

const chart = new Chart(ctx, {
    type: "line",
    data: {
        labels: [],
        datasets: [
            {
                label: "Kadar Alkohol (PPM)",
                data: [],
                backgroundColor: gradientCyan,
                borderColor: "rgba(0, 255, 255, 0.9)",
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: "#00FFFF",
                pointBorderColor: "#00FFFF",
                pointBorderWidth: 1,
                pointRadius: 3,
                pointHoverRadius: 6,
            },
            {
                label: "Jarak (cm)",
                data: [],
                borderColor: "#FFDD00",
                borderWidth: 2,
                fill: false,
                tension: 0.4,
                pointBackgroundColor: "#ffffff",
                pointBorderColor: "#FFDD00",
                pointBorderWidth: 1,
                pointRadius: 3,
                pointHoverRadius: 5,
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                title: { display: true, text: "Waktu", color: '#00ffff' },
                ticks: { color: '#dddddd' },
                grid: { color: "rgba(0, 255, 255, 0.1)", drawBorder: false }
            },
            y: {
                title: { display: true, text: "Nilai", color: '#00ffff' },
                ticks: { color: '#dddddd' },
                grid: { color: "rgba(0, 255, 255, 0.1)", drawBorder: false }
            }
        },
        plugins: {
            legend: {
                labels: {
                    color: '#ffffff',
                    font: { size: 13 }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                titleColor: '#00ffff',
                bodyColor: '#ffffff',
                borderColor: '#00ffff',
                borderWidth: 1,
                padding: 10,
                cornerRadius: 6,
                displayColors: false,
            }
        }
    }
});

// === LOGIKA DATA MASUK ===
client.on("message", (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        const value = parseInt(data.nilai);
        const status = data.status;
        const distance = parseFloat(data.jarak);
        const time = new Date().toLocaleTimeString('id-ID');

        alcoholValueElement.textContent = `${value} PPM`;

        if (status === "BAHAYA") {
            alcoholStatusElement.textContent = "Kadar Alkohol BERBAHAYA!";
            alcoholStatusElement.className = "status-text text-danger fw-bold";
        } else {
            alcoholStatusElement.textContent = "Kadar Alkohol Normal";
            alcoholStatusElement.className = "status-text text-success fw-bold";
        }
        lastUpdateElement.textContent = time;

        if (isNaN(distance) || distance < 0) {
            distanceValueEl.textContent = "---";
            distanceUnitEl.textContent = "cm";
        } else if (distance < 100) {
            distanceValueEl.textContent = distance.toFixed(1);
            distanceUnitEl.textContent = "cm";
        } else {
            distanceValueEl.textContent = (distance / 100).toFixed(2);
            distanceUnitEl.textContent = "m";
        }

        chart.data.labels.push(time);
        chart.data.datasets[0].data.push(value);
        chart.data.datasets[1].data.push(distance);

        if (chart.data.labels.length > 20) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
            chart.data.datasets[1].data.shift();
        }
        chart.update();

        if (status === "BAHAYA") {
            const currentWarning = {
                value: value,
                status: status,
                time: time,
                distance: isNaN(distance) || distance < 0 ? "NaN" : distance,
                timestamp: new Date().toISOString()
            };

            if (lastWarningData) {
                const lastLogTimestamp = new Date(lastWarningData.timestamp);
                const timeDiff = new Date() - lastLogTimestamp;
                const isSimilarValue = lastWarningData.value === value;

                if (timeDiff < 30000 && isSimilarValue) return;
            }

            lastWarningData = currentWarning;
            updateLatestAlertDisplay(currentWarning);
        } else {
            updateLatestAlertDisplay(null);
        }

    } catch (err) {
        console.error("Format data tidak valid:", err);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    alcoholValueElement.textContent = "---";
    alcoholStatusElement.textContent = "Menunggu Data";
    distanceValueEl.textContent = "---";
    distanceUnitEl.textContent = "cm";
    updateLatestAlertDisplay(null);
});
