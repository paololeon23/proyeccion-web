/* QBerries Proyecciones — configuración. URL de Apps Script en meta qberries-api. */
(function (root) {
  var DEFAULT_API = "";
  var stored = "";
  try {
    stored = String((root.localStorage && root.localStorage.getItem("qbe.proy.apiUrl")) || "");
  } catch (err) {
    stored = "";
  }
  var meta = typeof document !== "undefined" ? document.querySelector('meta[name="qberries-api"]') : null;
  var fromMeta = meta ? String(meta.getAttribute("content") || "").trim() : "";

  root.QBE = root.QBE || {};
  var apiUrl = String(root.QBE_API_URL || fromMeta || stored || DEFAULT_API).trim();
  if (fromMeta && root.localStorage) {
    try { root.localStorage.setItem("qbe.proy.apiUrl", fromMeta); } catch (err2) {}
  }
  root.QBE.config = {
    apiUrl: apiUrl,
    timeoutMs: 20000,
    retries: 1,
    empresa: "QBerries",
    pageSize: 10,
    cacheKey: "qbe.proy.pack",
    tz: "America/Lima",
    usuario: "Administrador",
    clave: "12345",
    pesoBayaDefault: 3.5,
    columns: [
      "Lote",
      "Fecha",
      "DNI",
      "Nombre",
      "N° Muestra",
      "N° Ramas",
      "Yemas Cerradas",
      "Yema Abierta",
      "Yemas Muertas",
      "Botón Floral",
      "Flor",
      "Cuaja",
      "E1 (Verde)",
      "E2 (Rosado)",
      "E3 (Guinda)",
      "E4 (50%-70%)",
      "E5 (Maduro)",
      "Observación",
      "Modulo",
      "Turno",
      "Lotes",
      "Semana",
      "Etapa",
      "Variedad",
      "Area",
      "Campaña",
      "Anexo",
      "Hora subida",
    ],
    tableHide: [
      "Anexo",
      "Hora subida",
      "Observación",
      "Modulo",
      "Turno",
      "Lotes",
      "Semana",
      "Etapa",
      "Variedad",
      "Area",
      "Campaña",
    ],
    detailFields: [
      "Semana",
      "Etapa",
      "Variedad",
      "Area",
      "Campaña",
      "Lotes",
      "Observación",
    ],
  };
})(typeof window !== "undefined" ? window : globalThis);
