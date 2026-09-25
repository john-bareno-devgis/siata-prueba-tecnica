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

// --- Capa D3 sincronizada con Leaflet (anillo estadístico animado) ---
// Patrón estándar "Leaflet + D3": un <svg> propio en el overlayPane que
// Leaflet reposiciona en cada pan/zoom. Los elementos dentro se ubican
// con layer points (map.latLngToLayerPoint), el mismo sistema de
// coordenadas que usan los layers nativos de Leaflet (circle, geoJSON).
const D3RingLayer = L.Layer.extend({
  onAdd(mapa) {
    this._map = mapa;
    this._svg = d3.select(mapa.getPanes().overlayPane).append("svg").attr("class", "d3-ring-layer");
    this._g = this._svg.append("g").attr("class", "leaflet-zoom-hide");
    mapa.on("viewreset moveend zoomend", this._reset, this);
    this._reset();
  },
  onRemove(mapa) {
    this._svg.remove();
    mapa.off("viewreset moveend zoomend", this._reset, this);
  },
  _reset() {
    const topLeft = this._map.containerPointToLayerPoint([0, 0]);
    this._svg
      .style("width", this._map.getSize().x + "px")
      .style("height", this._map.getSize().y + "px")
      .style("left", topLeft.x + "px")
      .style("top", topLeft.y + "px");
    this._g.attr("transform", `translate(${-topLeft.x},${-topLeft.y})`);
  },
  limpiar() {
    this._g.selectAll(".stat-ring").remove();
  },
});

const d3Layer = new D3RingLayer().addTo(map);

// codigo -> color: mismo color que ya usan mapa/leyenda/dashboard para
// ese codigo (vía su nivel3). Se arma una sola vez con el universo
// completo de /api/stats (ver IIFE de arranque más abajo), porque
// /api/intersect solo trae codigo/cobertura/area_ha/pct -- no nivel1/
// nivel3 -- y el color de cada nivel3 depende de compararlo contra
// TODOS los códigos de su mismo nivel1, no solo los de esta consulta.
let colorPorCodigo = {};

let ultimaConsultaAnillo = null;

// dibuja un anillo de arcos (D3) justo afuera del círculo de consulta,
// proporcional al % de área de cada cobertura encontrada. animar=false
// se usa al reposicionar tras un zoom (sin repetir la animación de
// entrada cada vez).
function dibujarAnilloEstadistico(latlng, features, animar) {
  d3Layer.limpiar();
  if (!features.length || !capaConsulta) return;

  const center = map.latLngToLayerPoint(latlng);
  const bounds = capaConsulta.getBounds();
  const ne = map.latLngToLayerPoint(bounds.getNorthEast());
  const sw = map.latLngToLayerPoint(bounds.getSouthWest());
  const radioCirculo = Math.abs(ne.x - sw.x) / 2;

  const innerRadius = radioCirculo + 6;
  const outerRadius = radioCirculo + 26;

  const datos = features.map((f) => ({
    cobertura: f.properties.cobertura,
    pct: f.properties.pct,
    color: colorPorCodigo[f.properties.codigo] ?? "#999",
  }));

  const arcos = d3.pie().value((d) => d.pct).sort(null)(datos);
  const arcGen = d3.arc().innerRadius(innerRadius).outerRadius(outerRadius);

  const gAnillo = d3Layer._g
    .append("g")
    .attr("class", "stat-ring")
    .attr("transform", `translate(${center.x},${center.y})`);

  const paths = gAnillo
    .selectAll("path")
    .data(arcos)
    .join("path")
    .attr("fill", (d) => d.data.color)
    .attr("stroke", "#fff")
    .attr("stroke-width", 1);

  if (animar) {
    // Barrido de entrada: cada arco crece desde ángulo 0 hasta su
    // ángulo real (interpolación estándar de D3 para pie charts).
    paths
      .each(function (d) {
        this._current = { startAngle: d.startAngle, endAngle: d.startAngle };
      })
      .transition()
      .duration(700)
      .attrTween("d", function (d) {
        const interp = d3.interpolate(this._current, d);
        this._current = interp(1);
        return (t) => arcGen(interp(t));
      });
  } else {
    paths.attr("d", arcGen);
  }

  // Etiqueta de % solo en arcos con espacio suficiente para que se lea.
  gAnillo
    .selectAll("text")
    .data(arcos.filter((d) => d.endAngle - d.startAngle > 0.28))
    .join("text")
    .attr("transform", (d) => `translate(${arcGen.centroid(d)})`)
    .attr("text-anchor", "middle")
    .attr("dy", "0.32em")
    .attr("font-size", "9px")
    .attr("font-weight", "600")
    .attr("fill", "#fff")
    .attr("opacity", animar ? 0 : 1)
    .text((d) => `${d.data.pct.toFixed(0)}%`)
    .transition()
    .delay(animar ? 700 : 0)
    .duration(200)
    .attr("opacity", 1);
}

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
  d3Layer.limpiar();
  ultimaConsultaAnillo = null;

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

    const latlng = L.latLng(lat, lon);
    dibujarAnilloEstadistico(latlng, data.features, true);
    ultimaConsultaAnillo = { latlng, features: data.features };

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

// El circulo (capa nativa de Leaflet) se re-renderiza solo en cada zoom;
// el anillo D3 no, porque su geometria (radios/centro) se calculo en
// pixeles de un zoom que ya no existe -- hay que rehacerla, sin repetir
// la animacion de entrada.
map.on("zoomend", () => {
  if (ultimaConsultaAnillo) {
    dibujarAnilloEstadistico(ultimaConsultaAnillo.latlng, ultimaConsultaAnillo.features, false);
  }
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

// --- Dashboard: KPIs + gráficas de barras (D3, interactivas) ---
let statsCache = null;

// Tooltip flotante único, reutilizado por todas las gráficas D3 (mapa y
// dashboard) en vez de crear un elemento nuevo por gráfica.
let tooltipD3 = null;
function obtenerTooltip() {
  if (!tooltipD3) {
    tooltipD3 = d3.select("body").append("div").attr("class", "d3-tooltip");
  }
  return tooltipD3;
}

// SVG no soporta text-overflow:ellipsis de forma nativa/confiable -- sin
// esto, una etiqueta más larga que el margen se recorta por donde el
// <text> se sale del <svg> (el borde izquierdo, no el final, porque el
// texto está anclado a la derecha). Se acorta caracter por caracter
// midiendo el ancho real ya renderizado (getComputedTextLength).
function truncarTextoSVG(seleccion, maxWidth) {
  seleccion.each(function () {
    const nodo = d3.select(this);
    const original = nodo.text();
    let texto = original;
    while (nodo.node().getComputedTextLength() > maxWidth && texto.length > 1) {
      texto = texto.slice(0, -1);
      nodo.text(texto + "…");
    }
  });
}

// Gráfica de barras horizontales genérica en D3: animación de entrada
// (ancho 0 -> valor real), resalta la barra y muestra un tooltip con el
// valor exacto al pasar el mouse. `accessor` decide qué mostrar/colorear
// para cada fila de `datos`, así una sola función sirve tanto para "área
// por nivel1" (5 barras) como para "coberturas nivel3" (23 barras).
function graficaBarrasD3(containerId, datos, accessor) {
  const contenedor = d3.select(`#${containerId}`);
  contenedor.selectAll("*").remove();
  if (!datos.length) return;

  const alturaFila = 22;
  const margen = { top: 2, right: 66, bottom: 2, left: 140 };
  const anchoTotal = contenedor.node().clientWidth || 320;
  const anchoBarras = Math.max(anchoTotal - margen.left - margen.right, 40);
  const altoTotal = datos.length * alturaFila + margen.top + margen.bottom;

  const svg = contenedor.append("svg").attr("width", anchoTotal).attr("height", altoTotal);
  const g = svg.append("g").attr("transform", `translate(${margen.left},${margen.top})`);

  const escalaX = d3
    .scaleLinear()
    .domain([0, d3.max(datos, accessor.valor) || 1])
    .range([0, anchoBarras]);
  const escalaY = d3
    .scaleBand()
    .domain(d3.range(datos.length))
    .range([0, datos.length * alturaFila])
    .padding(0.25);

  const tooltip = obtenerTooltip();

  const filas = g
    .selectAll("g.fila")
    .data(datos)
    .join("g")
    .attr("class", "fila")
    .attr("transform", (d, i) => `translate(0,${escalaY(i)})`);

  // Truncar ANTES de agregar el <title>: nodo.text(...) dentro de
  // truncarTextoSVG reemplaza todo el contenido del <text> (borraría el
  // <title> si ya estuviera ahí).
  const etiquetas = filas
    .append("text")
    .attr("x", -8)
    .attr("y", escalaY.bandwidth() / 2)
    .attr("dy", "0.32em")
    .attr("text-anchor", "end")
    .attr("class", "bar-label-svg")
    .text((d) => accessor.etiqueta(d));
  truncarTextoSVG(etiquetas, margen.left - 12);
  etiquetas.append("title").text((d) => accessor.etiqueta(d));

  const rects = filas
    .append("rect")
    .attr("class", "bar-rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("height", escalaY.bandwidth())
    .attr("rx", 2)
    .attr("fill", (d) => accessor.color(d))
    .attr("width", 0)
    .on("mouseenter", function (event, d) {
      d3.select(this).attr("opacity", 0.72);
      tooltip
        .style("opacity", 1)
        .html(
          `<strong>${accessor.etiqueta(d)}</strong><br>${accessor.valor(d).toLocaleString("es-CO", { maximumFractionDigits: 1 })} ha${
            accessor.pct ? ` · ${accessor.pct(d).toFixed(1)}%` : ""
          }`
        );
    })
    .on("mousemove", (event) => {
      tooltip.style("left", `${event.pageX + 12}px`).style("top", `${event.pageY + 10}px`);
    })
    .on("mouseleave", function () {
      d3.select(this).attr("opacity", 1);
      tooltip.style("opacity", 0);
    });

  rects
    .transition()
    .duration(600)
    .delay((d, i) => i * 18)
    .attr("width", (d) => escalaX(accessor.valor(d)));

  filas
    .append("text")
    .attr("x", (d) => escalaX(accessor.valor(d)) + 6)
    .attr("y", escalaY.bandwidth() / 2)
    .attr("dy", "0.32em")
    .attr("class", "bar-value-svg")
    .attr("opacity", 0)
    .text((d) => `${accessor.valor(d).toLocaleString("es-CO", { maximumFractionDigits: 1 })} ha`)
    .transition()
    .delay((d, i) => 600 + i * 18)
    .duration(200)
    .attr("opacity", 1);
}

function renderKPIs(coberturas, totalHa) {
  const nivel1Presentes = new Set(coberturas.map((c) => c.nivel1));
  const dominante = [...coberturas].sort((a, b) => b.area_ha - a.area_ha)[0];
  const haNatural = coberturas
    .filter((c) => ["3", "4", "5"].includes(c.nivel1))
    .reduce((acc, c) => acc + c.area_ha, 0);
  const pctNatural = totalHa > 0 ? (haNatural / totalHa) * 100 : 0;

  const kpis = [
    { label: "Área total", valor: `${totalHa.toLocaleString("es-CO", { maximumFractionDigits: 0 })} ha`, sub: "Medellín (recortado)" },
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
  const totalHa = Object.values(porNivel1).reduce((acc, v) => acc + v, 0);
  const datos = Object.entries(porNivel1)
    .map(([nivel1, ha]) => ({ nivel1, ha, pct: totalHa > 0 ? (ha / totalHa) * 100 : 0 }))
    .sort((a, b) => b.ha - a.ha);

  graficaBarrasD3("chart-nivel1", datos, {
    valor: (d) => d.ha,
    etiqueta: (d) => `${d.nivel1}. ${NIVEL1_NOMBRES[d.nivel1] ?? ""}`,
    color: (d) => colorNivel1(d.nivel1),
    pct: (d) => d.pct,
  });
}

function renderChartNivel3(coberturas, colorPorNivel3) {
  const datos = [...coberturas].sort((a, b) => b.area_ha - a.area_ha);

  graficaBarrasD3("chart-nivel3", datos, {
    valor: (d) => d.area_ha,
    etiqueta: (d) => d.nivel3,
    color: (d) => colorPorNivel3[d.nivel3],
    pct: (d) => d.pct,
  });
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

    // codigo -> color: /api/intersect no trae nivel1/nivel3 (ver
    // declaración de colorPorCodigo más arriba), así que se arma acá
    // sobre TODAS las filas crudas de /api/stats, no solo el resultado
    // de una consulta puntual.
    data.coberturas.forEach((c) => {
      colorPorCodigo[c.codigo] = colorPorNivel3[c.nivel3];
    });
  } catch (e) {
    // La leyenda y el anillo D3 quedan sin colores si /api/stats no
    // responde; el indicador de salud en el encabezado ya informa el
    // problema.
  }
})();

verificarSalud();
setInterval(verificarSalud, 30000);
