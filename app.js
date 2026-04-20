const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwFSwe_MHBJudplfglxooUTRlF0QdHdw9Eu9o9obrD8coKBP_9jas4xKKGSLTUfjO44/exec";
const STORAGE_KEY = "registroDonacionesProV1";

const appState = {
  records: [],
  filteredRecords: []
};

const elements = {
  form: document.getElementById("donationForm"),
  fecha: document.getElementById("fecha"),
  hora: document.getElementById("hora"),
  nombre: document.getElementById("nombre"),
  telefono: document.getElementById("telefono"),
  monto: document.getElementById("monto"),
  tarjeta: document.getElementById("tarjeta"),
  estatus: document.getElementById("estatus"),
  metodoPago: document.getElementById("metodoPago"),
  notas: document.getElementById("notas"),
  capturadoPor: document.getElementById("capturadoPor"),
  totalRegistros: document.getElementById("totalRegistros"),
  montoTotal: document.getElementById("montoTotal"),
  promedioMonto: document.getElementById("promedioMonto"),
  ultimoHora: document.getElementById("ultimoHora"),
  amountSummary: document.getElementById("amountSummary"),
  tablaBody: document.getElementById("tablaBody"),
  mensaje: document.getElementById("mensaje"),
  btnExportar: document.getElementById("btnExportar"),
  btnLimpiar: document.getElementById("btnLimpiar"),
  buscar: document.getElementById("buscar"),
  themeToggle: document.getElementById("themeToggle")
};

function init() {
  initTheme();
  initHours();
  loadRecords();
  setDefaultFormValues();
  attachEvents();
  applyFilter();
  if (appState.records.length) showMessage("Respaldo local recuperado correctamente.", "success");
}

function initTheme() {
  const savedTheme = localStorage.getItem("theme-registro-donaciones");
  const preferred = savedTheme || "light";
  document.documentElement.setAttribute("data-theme", preferred);
  updateThemeButton(preferred);
}

function updateThemeButton(theme) {
  elements.themeToggle.textContent = theme === "dark" ? "Modo claro" : "Modo oscuro";
}

function initHours() {
  elements.hora.innerHTML = '<option value="">Selecciona</option>';
  for (let h = 7; h <= 18; h++) {
    const value = String(h).padStart(2, "0") + ":00";
    const label = new Date(2025, 0, 1, h, 0).toLocaleTimeString("es-MX", {
      hour: "numeric",
      minute: "2-digit"
    });
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    elements.hora.appendChild(option);
  }
}

function attachEvents() {
  elements.form.addEventListener("submit", handleSubmit);
  elements.tarjeta.addEventListener("input", () => {
    elements.tarjeta.value = elements.tarjeta.value.replace(/\D/g, "").slice(0, 16);
  });
  elements.btnExportar.addEventListener("click", exportCsv);
  elements.btnLimpiar.addEventListener("click", clearLocalBackup);
  elements.buscar.addEventListener("input", applyFilter);
  elements.themeToggle.addEventListener("click", toggleTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme-registro-donaciones", next);
  updateThemeButton(next);
}

function setDefaultFormValues() {
  elements.fecha.value = new Date().toISOString().split("T")[0];
  elements.monto.value = "100";
}

function validateCardNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return /^\d{16}$/.test(digits) ? digits : "";
}

function buildPayload() {
  return {
    fecha: elements.fecha.value,
    hora: elements.hora.value,
    nombre: elements.nombre.value.trim(),
    telefono: elements.telefono.value.trim(),
    monto: Number(elements.monto.value),
    tarjeta: validateCardNumber(elements.tarjeta.value),
    estatus: elements.estatus.value,
    metodoPago: elements.metodoPago.value,
    notas: elements.notas.value.trim(),
    capturadoPor: elements.capturadoPor.value.trim()
  };
}

function validatePayload(data) {
  if (!data.fecha || !data.hora || !data.nombre || !data.telefono || !data.estatus || !data.metodoPago) {
    return "Completa todos los campos obligatorios.";
  }
  if (!Number.isFinite(data.monto) || data.monto < 100) {
    return "El monto debe ser mayor o igual a 100.";
  }
  if (!data.tarjeta) {
    return "La tarjeta debe tener exactamente 16 dígitos.";
  }
  const hour = Number(data.hora.split(":")[0]);
  if (hour < 7 || hour > 18) {
    return "La hora debe estar entre 7:00 AM y 6:00 PM.";
  }
  return "";
}

async function handleSubmit(event) {
  event.preventDefault();
  const payload = buildPayload();
  const validationError = validatePayload(payload);

  if (validationError) {
    showMessage(validationError, "error");
    return;
  }

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!result.ok) {
      showMessage(result.message || "No se pudo guardar en Google Sheets.", "error");
      return;
    }

    const record = { ...payload, id: result.id };
    appState.records.unshift(record);
    persistRecords();
    elements.form.reset();
    setDefaultFormValues();
    applyFilter();
    showMessage("Registro guardado correctamente en Google Sheets.", "success");
  } catch (error) {
    showMessage("No se pudo conectar con Google Sheets. Revisa el deployment del Apps Script.", "error");
  }
}

function persistRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.records));
}

function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) appState.records = parsed;
  } catch {
    appState.records = [];
  }
}

function clearLocalBackup() {
  if (!appState.records.length) {
    showMessage("No hay respaldo local para borrar.", "error");
    return;
  }
  const confirmed = confirm("¿Seguro que quieres borrar el respaldo local del navegador?");
  if (!confirmed) return;
  localStorage.removeItem(STORAGE_KEY);
  appState.records = [];
  applyFilter();
  showMessage("Respaldo local borrado correctamente.", "success");
}

function applyFilter() {
  const term = elements.buscar.value.trim().toLowerCase();
  appState.filteredRecords = appState.records.filter(record => {
    if (!term) return true;
    const haystack = [
      record.id,
      record.fecha,
      record.hora,
      record.nombre,
      record.telefono,
      record.monto,
      record.tarjeta,
      record.estatus,
      record.metodoPago,
      record.capturadoPor,
      record.notas
    ].join(" ").toLowerCase();
    return haystack.includes(term);
  });
  renderAll();
}

function renderAll() {
  renderStats();
  renderAmountSummary();
  renderTable();
}

function renderStats() {
  const total = appState.records.reduce((sum, record) => sum + Number(record.monto), 0);
  elements.totalRegistros.textContent = appState.records.length;
  elements.montoTotal.textContent = formatCurrency(total);
  elements.promedioMonto.textContent = formatCurrency(appState.records.length ? total / appState.records.length : 0);
  elements.ultimoHora.textContent = appState.records.length ? formatHour(appState.records[0].hora) : "—";
}

function renderAmountSummary() {
  const counts = {};
  appState.records.forEach(record => {
    const key = Number(record.monto).toFixed(2);
    counts[key] = (counts[key] || 0) + 1;
  });

  const keys = Object.keys(counts).sort((a, b) => Number(a) - Number(b));
  if (!keys.length) {
    elements.amountSummary.innerHTML = '<div class="amount-card"><strong>Sin datos</strong><span>Cuando captures registros aparecerán aquí.</span></div>';
    return;
  }

  elements.amountSummary.innerHTML = keys.map(key => `
    <article class="amount-card">
      <strong>${formatCurrency(Number(key))}</strong>
      <span>${counts[key]} registro${counts[key] === 1 ? "" : "s"}</span>
    </article>
  `).join("");
}

function renderTable() {
  if (!appState.filteredRecords.length) {
    elements.tablaBody.innerHTML = '<tr><td colspan="12" class="empty-state">No hay registros que coincidan con tu búsqueda.</td></tr>';
    return;
  }

  elements.tablaBody.innerHTML = appState.filteredRecords.map((record, index) => `
    <tr>
      <td>${escapeHtml(record.id || "")}</td>
      <td>${escapeHtml(record.fecha)}</td>
      <td>${formatHour(record.hora)}</td>
      <td>${escapeHtml(record.nombre)}</td>
      <td>${escapeHtml(record.telefono)}</td>
      <td>${formatCurrency(Number(record.monto))}</td>
      <td>${escapeHtml(record.tarjeta)}</td>
      <td><span class="status-pill ${statusClass(record.estatus)}">${escapeHtml(record.estatus)}</span></td>
      <td>${escapeHtml(record.metodoPago)}</td>
      <td>${escapeHtml(record.capturadoPor || "")}</td>
      <td>${escapeHtml(record.notas || "")}</td>
      <td><button type="button" class="small-btn" onclick="removeRecord('${escapeJs(record.id || String(index))}')">Eliminar</button></td>
    </tr>
  `).join("");
}

function removeRecord(id) {
  const confirmed = confirm("¿Seguro que quieres eliminar este registro del respaldo local?");
  if (!confirmed) return;
  appState.records = appState.records.filter(record => String(record.id) !== String(id));
  persistRecords();
  applyFilter();
  showMessage("Registro eliminado del respaldo local.", "success");
}
window.removeRecord = removeRecord;

function exportCsv() {
  if (!appState.records.length) {
    showMessage("No hay registros para exportar.", "error");
    return;
  }

  const rows = [
    ["ID", "Fecha", "Hora", "Nombre", "Telefono", "Monto", "NumeroTarjeta", "Estatus", "MetodoPago", "Notas", "CapturadoPor"],
    ...appState.records.map(record => [
      record.id || "",
      record.fecha,
      formatHour(record.hora),
      record.nombre,
      record.telefono,
      record.monto,
      record.tarjeta,
      record.estatus,
      record.metodoPago,
      record.notas || "",
      record.capturadoPor || ""
    ])
  ];

  const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "registro-donaciones.csv";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showMessage("CSV exportado correctamente.", "success");
}

function showMessage(text, type) {
  elements.mensaje.textContent = text;
  elements.mensaje.className = `message show ${type}`;
  clearTimeout(showMessage.timer);
  showMessage.timer = setTimeout(() => {
    elements.mensaje.className = "message";
  }, 3500);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN"
  }).format(value || 0);
}

function formatHour(value) {
  if (!value) return "—";
  const [h, m] = String(value).split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function escapeJs(str) {
  return String(str).replace(/'/g, "\\'");
}

function statusClass(status) {
  return "s-" + String(status || "").toLowerCase().replace(/\s+/g, "-");
}

init();