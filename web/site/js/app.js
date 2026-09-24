// Centro aproximado del área de estudio (bbox real del dataset, ver README).
const CENTRO = [6.269, -75.596];

const map = L.map("map").setView(CENTRO, 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap",
  maxZoom: 19,
}).addTo(map);

// Capa WMS publicada por GeoServer, vía el reverse proxy de Nginx
// (/geoserver/...) -> mismo origen que el visor, sin problemas de CORS.
L.tileLayer
  .wms("/geoserver/siata/wms", {
    layers: "siata:clc",
    format: "image/png",
    transparent: true,
    version: "1.1.0",
  })
  .addTo(map);

let capaResultado = null;
let capaConsulta = null;

function mostrarError(msg) {
  const box = document.getElementById("error-box");
  box.textContent = msg;
  box.style.display = "block";
}

function limpiarError() {
  const box = document.getElementById("error-box");
  box.style.display = "none";
  box.textContent = "";
}

async function verificarSalud() {
  const dot = document.getElementById("health-dot");
  const text = document.getElementById("health-text");
  try {
    const resp = await fetch("/api/health");
    const data = await resp.json();
    if (resp.ok && data.status === "ok") {
      dot.className = "health-dot ok";
      text.textContent = "API en línea (PostGIS " + data.postgis_version.split(" ")[0] + ")";
    } else {
      dot.className = "health-dot error";
      text.textContent = "API con problemas";
    }
  } catch (e) {
    dot.className = "health-dot error";
    text.textContent = "API no disponible";
  }
}

function renderTablaResultados(features, summary) {
  const cont = document.getElementById("results");
  if (features.length === 0) {
    cont.innerHTML = '<p class="hint">Sin coberturas en el área consultada.</p>';
    return;
  }

  let filas = features
    .map((f) => {
      const p = f.properties;
      return `<tr><td>${p.codigo}</td><td>${p.cobertura}</td><td>${p.area_ha.toFixed(2)}</td><td>${p.pct.toFixed(1)}%</td></tr>`;
    })
    .join("");

  cont.innerHTML = `
    <div class="summary">
      Área total: <strong>${summary.total_ha.toFixed(2)} ha</strong> ·
      Coberturas: <strong>${summary.n_coberturas}</strong>
    </div>
    <table>
      <thead><tr><th>Código</th><th>Cobertura</th><th>ha</th><th>%</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>
  `;
}

async function consultarInterseccion(lat, lon, radiusM) {
  limpiarError();

  if (capaResultado) map.removeLayer(capaResultado);
  if (capaConsulta) map.removeLayer(capaConsulta);

  try {
    const resp = await fetch("/api/intersect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ point: { lon, lat }, radius_m: radiusM }),
    });
    const data = await resp.json();

    if (!resp.ok) {
      const detalle = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
      mostrarError(`Error ${resp.status}: ${detalle}`);
      document.getElementById("results").innerHTML = "";
      return;
    }

    // Círculo de consulta: dibujo aproximado en pantalla (Leaflet usa
    // radio "plano" en metros sobre la proyección del mapa). El área
    // exacta la calcula el backend en PostGIS sobre EPSG:9377.
    capaConsulta = L.circle([lat, lon], { radius: radiusM, color: "#333", weight: 1, fill: false, dashArray: "4" }).addTo(map);

    capaResultado = L.geoJSON(
      { type: "FeatureCollection", features: data.features },
      { style: { color: "#0f5132", weight: 1, fillColor: "#0f5132", fillOpacity: 0.35 } }
    ).addTo(map);

    renderTablaResultados(data.features, data.summary);
  } catch (e) {
    mostrarError("No se pudo contactar la API.");
  }
}

map.on("click", (e) => {
  const radius = Number(document.getElementById("radius").value);
  if (!radius || radius <= 0 || radius > 50000) {
    mostrarError("El radio debe estar entre 1 y 50000 metros.");
    return;
  }
  consultarInterseccion(e.latlng.lat, e.latlng.lng, radius);
});

document.getElementById("btn-stats").addEventListener("click", async () => {
  limpiarError();
  try {
    const resp = await fetch("/api/stats");
    const data = await resp.json();
    if (!resp.ok) {
      mostrarError("No se pudieron obtener las estadísticas.");
      return;
    }
    renderTablaResultados(
      data.coberturas.map((c) => ({ properties: c })),
      { total_ha: data.total_ha, n_coberturas: data.coberturas.length }
    );
  } catch (e) {
    mostrarError("No se pudo contactar la API.");
  }
});

verificarSalud();
setInterval(verificarSalud, 30000);
