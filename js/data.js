/* Datos de proyecciones: normalización, filtros y opciones de catálogo. */
(function (root) {
  var QBE = root.QBE || (root.QBE = {});

  function fold(s) {
    var t = String(s == null ? "" : s).toLowerCase();
    try { t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (err) {
      t = t.replace(/á/g, "a").replace(/é/g, "e").replace(/í/g, "i").replace(/ó/g, "o").replace(/ú/g, "u").replace(/ñ/g, "n");
    }
    return t.replace(/\s+/g, " ").trim();
  }
  function asText(v) {
    if (v == null || v === "") return "";
    if (Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime())) {
      var y = v.getFullYear();
      var m = String(v.getMonth() + 1);
      var d = String(v.getDate());
      if (m.length < 2) m = "0" + m;
      if (d.length < 2) d = "0" + d;
      return y + "-" + m + "-" + d;
    }
    return String(v).replace(/\s+/g, " ").trim();
  }
  function asNumber(v) {
    if (v == null || v === "") return 0;
    if (typeof v === "number") return isFinite(v) ? v : 0;
    var s = String(v).trim().replace(",", ".");
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }
  function get(rec, key) {
    if (!rec) return "";
    if (rec[key] != null && rec[key] !== "") return rec[key];
    var map = {
      Lote: ["lote", "loteCode"],
      Fecha: ["fecha"],
      DNI: ["dni", "evaluadorId"],
      Nombre: ["nombre", "evaluadorNombre", "Evaluador", "evaluador"],
      "N° Muestra": ["nMuestra", "muestra", "N Muestra"],
      "N° Ramas": ["nRamas", "ramas"],
      "Yema Productiva": ["yemaProductiva"],
      "Yema Abierta": ["yemaAbierta"],
      "Yemas Cerradas": ["yemasCerradas"],
      "Yemas Muertas": ["yemasMuertas"],
      "Botón Floral": ["botonFloral", "Boton Floral"],
      Flor: ["flor"],
      Cuaja: ["cuaja", "cuajo"],
      "E1 (Verde)": ["e1", "E1"],
      "E2 (Rosado)": ["e2", "E2"],
      "E3 (Guinda)": ["e3", "E3"],
      "E4 (50%-70%)": ["e4", "E4"],
      "E5 (Maduro)": ["e5", "E5"],
      Observación: ["observacion", "Observacion"],
      "Foto cabecera": ["foto", "Foto cabeza", "fotoCabecera"],
      Modulo: ["modulo", "Módulo", "Nódulo", "Nodulo"],
      Turno: ["turno"],
      Lotes: ["lotes", "loteNum"],
      Semana: ["semana"],
      Etapa: ["etapa"],
      Variedad: ["variedad"],
      Area: ["area", "Área"],
      Campaña: ["campana", "campaña"],
    };
    var alts = map[key] || [];
    var i;
    for (i = 0; i < alts.length; i += 1) {
      if (rec[alts[i]] != null && rec[alts[i]] !== "") return rec[alts[i]];
    }
    return "";
  }
  function normalize(rec) {
    var cols = (QBE.config && QBE.config.columns) || [];
    var out = {};
    var i;
    for (i = 0; i < cols.length; i += 1) {
      out[cols[i]] = get(rec, cols[i]);
    }
    out.Fecha = asText(out.Fecha);
    ["N° Muestra", "N° Ramas", "Yema Productiva", "Yema Abierta", "Yemas Cerradas", "Yemas Muertas",
      "Botón Floral", "Flor", "Cuaja", "E1 (Verde)", "E2 (Rosado)", "E3 (Guinda)", "E4 (50%-70%)", "E5 (Maduro)",
      "Turno", "Lotes", "Semana", "Area"].forEach(function (k) {
      if (out[k] !== "" && out[k] != null) out[k] = asNumber(out[k]) || out[k];
    });
    out._q = fold([out.Lote, out.DNI, out.Nombre, out.Modulo, out.Variedad, out.Campaña, out.Etapa].join(" "));
    return out;
  }
  function uniqueSorted(list) {
    var seen = {};
    var out = [];
    (list || []).forEach(function (v) {
      if (v == null || v === "") return;
      var k = String(v);
      if (seen[k]) return;
      seen[k] = 1;
      out.push(v);
    });
    out.sort(function (a, b) {
      var na = Number(a);
      var nb = Number(b);
      if (isFinite(na) && isFinite(nb) && String(a).trim() !== "" && String(b).trim() !== "") return na - nb;
      return String(a).localeCompare(String(b), "es");
    });
    return out;
  }
  function optionsFrom(records) {
    var campanas = [];
    var modulos = [];
    var turnos = [];
    var lotes = [];
    var evaluadores = [];
    (records || []).forEach(function (r) {
      if (r.Campaña) campanas.push(r.Campaña);
      if (r.Modulo) modulos.push(r.Modulo);
      if (r.Turno !== "" && r.Turno != null) turnos.push(r.Turno);
      if (r.Lote) lotes.push(r.Lote);
      if (r.Nombre) evaluadores.push(r.Nombre);
    });
    return {
      campanas: uniqueSorted(campanas),
      modulos: uniqueSorted(modulos),
      turnos: uniqueSorted(turnos),
      lotes: uniqueSorted(lotes),
      evaluadores: uniqueSorted(evaluadores),
    };
  }
  function matchesFilter(rec, f) {
    if (f.campana && f.campana !== "*" && String(rec.Campaña) !== String(f.campana)) return false;
    if (f.modulo && f.modulo !== "*" && String(rec.Modulo) !== String(f.modulo)) return false;
    if (f.turno && f.turno !== "*" && String(rec.Turno) !== String(f.turno)) return false;
    if (f.lote && f.lote !== "*" && String(rec.Lote) !== String(f.lote)) return false;
    if (f.evaluador && f.evaluador !== "*" && String(rec.Nombre) !== String(f.evaluador)) return false;
    if (f.desde && rec.Fecha && String(rec.Fecha) < String(f.desde)) return false;
    if (f.hasta && rec.Fecha && String(rec.Fecha) > String(f.hasta)) return false;
    if (f.q) {
      if ((rec._q || fold([rec.Lote, rec.DNI, rec.Nombre].join(" "))).indexOf(fold(f.q)) < 0) return false;
    }
    return true;
  }
  function filterRecords(records, f) {
    return (records || []).filter(function (r) { return matchesFilter(r, f || {}); });
  }
  function sortRecords(records, key, dir) {
    var d = dir < 0 ? -1 : 1;
    var rows = (records || []).slice();
    rows.sort(function (a, b) {
      var va = a[key];
      var vb = b[key];
      var na = Number(va);
      var nb = Number(vb);
      if (isFinite(na) && isFinite(nb) && String(va).trim() !== "" && String(vb).trim() !== "") {
        return (na - nb) * d;
      }
      return String(va == null ? "" : va).localeCompare(String(vb == null ? "" : vb), "es") * d;
    });
    return rows;
  }

  QBE.data = {
    fold: fold,
    asText: asText,
    asNumber: asNumber,
    normalize: normalize,
    optionsFrom: optionsFrom,
    filterRecords: filterRecords,
    sortRecords: sortRecords,
  };
})(typeof window !== "undefined" ? window : globalThis);
