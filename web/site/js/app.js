// Centro aproximado del área de estudio (bbox real del dataset, ver README).
const CENTRO = [6.269, -75.596];
const COLOR_MARCA = "#176f7c";

// --- Paleta nivel3: mismo criterio y mismos valores que las reglas SLD
// (geoserver/init/clc_nivel3.sld) -- un tono (hue) fijo por nivel1, con
// luminosidad creciente según la posición del código dentro de su grupo.
// Se recalcula aquí en vez de duplicar una lista fija de 23 colores: así
// tabla, leyenda y gráficas quedan sincronizadas con lo que de verdad
// devuelve /api/stats, sin mantener dos listas a mano.
const NIVEL1_NOMBRES = {
  1: "Territorios artificializados",
  2: "Territorios agrícolas",
  3: "Bosques y áreas seminaturales",
  4: "Áreas húmedas",
  5: "Superficies de agua",
};
const NIVEL1_HUE = { 1: 345, 2: 45, 3: 100, 4: 270, 5: 195 };

function hslToHex(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function colorNivel1(nivel1) {
  const hue = NIVEL1_HUE[nivel1] ?? 0;
  return hslToHex(hue, 0.65, 0.45);
}

// /api/stats trae una fila por codigo (nivel 4/5), pero varios codigo
// pueden compartir el mismo nivel3 (ej. 31111 y 31121 -> "3.1.1. Bosque
// denso"; ver README). Para leyenda/gráficas/KPIs hay que agregarlas a
// nivel3 -- si no, el mismo nombre aparece repetido y el índice usado
// para calcular el color queda desalineado con el que usó geoserver-init
// al generar el SLD (que sí agrupa por nivel3 único).
function agruparPorNivel3(coberturas) {
  const porNivel3 = {};
  coberturas.forEach((c) => {
    const clave = c.nivel1 + "|" + c.nivel3;
    if (!porNivel3[clave]) {
      porNivel3[clave] = { nivel1: c.nivel1, nivel3: c.nivel3, codigo: c.codigo, area_ha: 0 };
    }
    porNivel3[clave].area_ha += c.area_ha;
    // codigo más bajo como representante del grupo, para el orden estable
    // (mismo criterio que "left(codigo,3)" usado al generar el SLD).
    if (c.codigo < porNivel3[clave].codigo) porNivel3[clave].codigo = c.codigo;
  });
  const total = Object.values(porNivel3).reduce((acc, c) => acc + c.area_ha, 0);
  return Object.values(porNivel3).map((c) => ({
    ...c,
    pct: total > 0 ? (c.area_ha / total) * 100 : 0,
  }));
}

// coberturas: filas ya agrupadas por nivel3 (ver agruparPorNivel3),
// ordenadas dentro de cada nivel1 por código, para asignar el mismo
// color que calculó geoserver-init al generar el SLD (misma fórmula,
// mismo orden).
function construirPaletaNivel3(coberturas) {
  const porNivel1 = {};
  coberturas.forEach((c) => {
    (porNivel1[c.nivel1] ??= []).push(c);
  });
  const colorPorNivel3 = {};
  Object.entries(porNivel1).forEach(([nivel1, filas]) => {
    filas.sort((a, b) => a.codigo.localeCompare(b.codigo));
    const hue = NIVEL1_HUE[nivel1] ?? 0;
    filas.forEach((fila, i) => {
      const light = 0.32 + (0.4 * i) / Math.max(filas.length - 1, 1);
      colorPorNivel3[fila.nivel3] = hslToHex(hue, 0.65, light);
    });
  });
  return colorPorNivel3;
}

// --- Mapa ---
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
      { style: { color: COLOR_MARCA, weight: 1, fillColor: COLOR_MARCA, fillOpacity: 0.35 } }
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

// --- Pestañas Mapa / Dashboard ---
function activarVista(vista) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === vista));
  document.getElementById("view-mapa").hidden = vista !== "mapa";
  document.getElementById("view-dashboard").hidden = vista !== "dashboard";
  document.getElementById("panel-mapa").hidden = vista !== "mapa";
  document.getElementById("panel-dashboard").hidden = vista !== "dashboard";

  if (vista === "mapa") {
    // Leaflet no recalcula el tamaño de un contenedor que estuvo oculto
    // (display:none) hasta que se le pide explícitamente.
    setTimeout(() => map.invalidateSize(), 0);
  } else if (vista === "dashboard") {
    cargarDashboard();
  }
}

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => activarVista(btn.dataset.view));
});

document.getElementById("btn-goto-dashboard").addEventListener("click", () => activarVista("dashboard"));

// --- Leyenda (nivel 3, agrupada por nivel 1) ---
function renderLeyenda(coberturas, colorPorNivel3) {
  const porNivel1 = {};
  coberturas.forEach((c) => {
    (porNivel1[c.nivel1] ??= []).push(c);
  });

  const html = Object.keys(porNivel1)
    .sort()
    .map((nivel1) => {
      const filas = [...porNivel1[nivel1]].sort((a, b) => a.codigo.localeCompare(b.codigo));
      const items = filas
        .map(
          (f) =>
            `<div class="legend-item"><span class="legend-swatch" style="background:${colorPorNivel3[f.nivel3]}"></span>${f.nivel3}</div>`
        )
        .join("");
      return `
        <details class="legend-group" open>
          <summary><span class="legend-swatch" style="background:${colorNivel1(nivel1)}"></span>${nivel1}. ${NIVEL1_NOMBRES[nivel1] ?? ""}</summary>
          ${items}
        </details>
      `;
    })
    .join("");

  document.getElementById("legend-list").innerHTML = html;
}

// --- Dashboard: KPIs + gráficas de barras ---
let statsCache = null;

function filaBarra(label, valor, maxValor, color, sufijo) {
  const pct = maxValor > 0 ? (valor / maxValor) * 100 : 0;
  return `
    <div class="bar-row">
      <span class="bar-label" title="${label}">${label}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${pct}%;background:${color}"></span></span>
      <span class="bar-value">${valor.toLocaleString("es-CO", { maximumFractionDigits: 1 })}${sufijo}</span>
    </div>
  `;
}

function renderKPIs(coberturas, totalHa) {
  const nivel1Presentes = new Set(coberturas.map((c) => c.nivel1));
  const dominante = [...coberturas].sort((a, b) => b.area_ha - a.area_ha)[0];
  const haNatural = coberturas
    .filter((c) => ["3", "4", "5"].includes(c.nivel1))
    .reduce((acc, c) => acc + c.area_ha, 0);
  const pctNatural = totalHa > 0 ? (haNatural / totalHa) * 100 : 0;

  const kpis = [
    { label: "Área total", valor: `${totalHa.toLocaleString("es-CO", { maximumFractionDigits: 0 })} ha`, sub: "Valle de Aburrá recortado" },
    { label: "Coberturas (nivel 3)", valor: coberturas.length, sub: "categorías distintas" },
    { label: "Cobertura dominante", valor: dominante.nivel3.replace(/^\d+(\.\d+)*\.\s*/, ""), sub: `${dominante.pct.toFixed(1)}% del área` },
    { label: "Área natural (nivel 1: 3, 4, 5)", valor: `${pctNatural.toFixed(1)}%`, sub: "bosques, humedales y agua" },
  ];

  document.getElementById("kpi-row").innerHTML = kpis
    .map(
      (k) => `
      <div class="kpi-card">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value">${k.valor}</div>
        <div class="kpi-sub">${k.sub}</div>
      </div>`
    )
    .join("");
}

function renderChartNivel1(coberturas) {
  const porNivel1 = {};
  coberturas.forEach((c) => {
    porNivel1[c.nivel1] = (porNivel1[c.nivel1] ?? 0) + c.area_ha;
  });
  const entradas = Object.entries(porNivel1).sort((a, b) => b[1] - a[1]);
  const max = entradas[0]?.[1] ?? 1;

  document.getElementById("chart-nivel1").innerHTML = entradas
    .map(([nivel1, ha]) => filaBarra(`${nivel1}. ${NIVEL1_NOMBRES[nivel1] ?? ""}`, ha, max, colorNivel1(nivel1), " ha"))
    .join("");
}

function renderChartNivel3(coberturas, colorPorNivel3) {
  const ordenado = [...coberturas].sort((a, b) => b.area_ha - a.area_ha);
  const max = ordenado[0]?.area_ha ?? 1;

  document.getElementById("chart-nivel3").innerHTML = ordenado
    .map((c) => filaBarra(c.nivel3, c.area_ha, max, colorPorNivel3[c.nivel3], " ha"))
    .join("");
}

async function obtenerStats() {
  if (statsCache) return statsCache;
  const resp = await fetch("/api/stats");
  const data = await resp.json();
  if (!resp.ok) throw new Error("stats no disponible");
  statsCache = data;
  return data;
}

async function cargarDashboard() {
  try {
    const data = await obtenerStats();
    const agrupado = agruparPorNivel3(data.coberturas);
    const colorPorNivel3 = construirPaletaNivel3(agrupado);
    renderKPIs(agrupado, data.total_ha);
    renderChartNivel1(agrupado);
    renderChartNivel3(agrupado, colorPorNivel3);
  } catch (e) {
    mostrarError("No se pudieron cargar las estadísticas del dashboard.");
  }
}

// La leyenda se necesita desde el arranque (vista Mapa por defecto); el
// resto del dashboard se difiere hasta que se abra esa pestaña por
// primera vez (ver activarVista), reutilizando la misma respuesta cacheada.
(async () => {
  try {
    const data = await obtenerStats();
    const agrupado = agruparPorNivel3(data.coberturas);
    const colorPorNivel3 = construirPaletaNivel3(agrupado);
    renderLeyenda(agrupado, colorPorNivel3);
  } catch (e) {
    // La leyenda queda vacía si /api/stats no responde; el indicador de
    // salud en el encabezado ya informa el problema.
  }
})();

verificarSalud();
setInterval(verificarSalud, 30000);
