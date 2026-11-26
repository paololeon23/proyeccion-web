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
  /** "25/11/2026 14:31:43" / "2026-11-25 14:31:43" / Date → "14:31:43". Solo fecha → "". */
  function onlyTime(v) {
    if (v != null && Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime())) {
      var hh = String(v.getHours());
      var mm = String(v.getMinutes());
      var ss = String(v.getSeconds());
      if (hh.length < 2) hh = "0" + hh;
      if (mm.length < 2) mm = "0" + mm;
      if (ss.length < 2) ss = "0" + ss;
      if (hh === "00" && mm === "00" && ss === "00") return "";
      return hh + ":" + mm + ":" + ss;
    }
    var s = String(v == null ? "" : v).trim();
    if (!s) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(s)) return "";
    var m = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return "";
    var h2 = m[1].length < 2 ? "0" + m[1] : m[1];
    var s2 = m[3] != null ? m[3] : "00";
    return h2 + ":" + m[2] + ":" + s2;
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
      "Foto cabecera": ["foto", "Foto cabeza", "fotoCabecera", "Anexo", "anexo", "fotoUrl", "imagen"],
      Anexo: ["anexo", "Foto cabecera", "foto", "fotoCabecera"],
      "Hora subida": ["horaSubida", "hora_subida", "Hora Subida"],
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
    out.Lote = canonLote(out.Lote);
    if (out.Campaña) out.Campaña = campanaYear(out.Campaña);
    out.Anexo = String(get(rec, "Anexo") || rec.Anexo || rec.anexo || "").trim();
    out["Hora subida"] = onlyTime(get(rec, "Hora subida") || "");
    out["Foto cabecera"] = out.Anexo || String(get(rec, "Foto cabecera") || rec.foto || rec.Foto || "").trim();
    ["N° Muestra", "N° Ramas", "Yema Productiva", "Yema Abierta", "Yemas Cerradas", "Yemas Muertas",
      "Botón Floral", "Flor", "Cuaja", "E1 (Verde)", "E2 (Rosado)", "E3 (Guinda)", "E4 (50%-70%)", "E5 (Maduro)",
      "Turno", "Lotes", "Semana", "Area"].forEach(function (k) {
      if (out[k] !== "" && out[k] != null) out[k] = asNumber(out[k]) || out[k];
    });
    out._q = fold([out.Lote, out.DNI, out.Nombre, out.Modulo, out.Variedad, out.Campaña, out.Etapa].join(" "));
    var sheetRow = Number(rec._row || rec.row || rec._sheetRow || 0);
    if (sheetRow > 1) out._row = sheetRow;
    return out;
  }
  function canonLote(raw) {
    var s = String(raw == null ? "" : raw).trim().toUpperCase().replace(/\s+/g, "");
    if (!s) return "";
    var m = s.match(/^M0*(\d+)T0*(\d+)(?:LT|L)0*(\d+)$/i);
    if (m) return "M" + m[1] + "T" + m[2] + "LT" + m[3];
    return String(raw == null ? "" : raw).trim();
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
  function campanaYear(v) {
    var m = String(v || "").match(/(20\d{2}|\d{4})/);
    return m ? m[1] : String(v || "").trim();
  }
  function optionsFrom(records) {
    var campanas = [];
    var modulos = [];
    var turnos = [];
    var lotes = [];
    var evaluadores = [];
    var variedades = [];
    var etapas = [];
    var semanas = [];
    (records || []).forEach(function (r) {
      if (r.Campaña) campanas.push(campanaYear(r.Campaña));
      if (r.Modulo) modulos.push(r.Modulo);
      if (r.Turno !== "" && r.Turno != null) turnos.push(r.Turno);
      if (r.Lote) lotes.push(r.Lote);
      if (r.Nombre) evaluadores.push(r.Nombre);
      if (r.Variedad) variedades.push(r.Variedad);
      if (r.Etapa) etapas.push(r.Etapa);
      if (r.Semana !== "" && r.Semana != null) semanas.push(r.Semana);
    });
    return {
      campanas: uniqueSorted(campanas),
      modulos: uniqueSorted(modulos),
      turnos: uniqueSorted(turnos),
      lotes: uniqueSorted(lotes),
      evaluadores: uniqueSorted(evaluadores),
      variedades: uniqueSorted(variedades),
      etapas: uniqueSorted(etapas),
      semanas: uniqueSorted(semanas),
    };
  }
  function canonModulo(v) {
    var s = String(v == null ? "" : v).trim().toUpperCase();
    var m = s.match(/^M0*(\d+)$/i);
    return m ? "M" + m[1] : s;
  }
  function matchesFilter(rec, f) {
    if (f.modulo && f.modulo !== "*" && canonModulo(rec.Modulo) !== canonModulo(f.modulo)) return false;
    if (f.evaluador && f.evaluador !== "*" && fold(rec.Nombre) !== fold(f.evaluador)) return false;
    if (f.etapa && f.etapa !== "*" && fold(rec.Etapa) !== fold(f.etapa)) return false;
    if (f.semana && f.semana !== "*" && String(rec.Semana) !== String(f.semana)) return false;
    if (f.desde) {
      if (!rec.Fecha || dateSortKey(rec.Fecha) < dateSortKey(f.desde)) return false;
    }
    if (f.hasta) {
      if (!rec.Fecha || dateSortKey(rec.Fecha) > dateSortKey(f.hasta)) return false;
    }
    if (f.q) {
      if ((rec._q || fold([rec.Lote, rec.DNI, rec.Nombre].join(" "))).indexOf(fold(f.q)) < 0) return false;
    }
    return true;
  }
  function filterRecords(records, f) {
    return (records || []).filter(function (r) { return matchesFilter(r, f || {}); });
  }
  function dateSortKey(v) {
    var s = String(v == null ? "" : v).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + m[2] + m[3];
    m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    if (m) {
      var dd = m[1].length < 2 ? "0" + m[1] : m[1];
      var mm = m[2].length < 2 ? "0" + m[2] : m[2];
      return m[3] + mm + dd;
    }
    return s;
  }
  function sortRecords(records, key, dir) {
    var d = dir < 0 ? -1 : 1;
    var rows = (records || []).slice();
    rows.sort(function (a, b) {
      var va = a[key];
      var vb = b[key];
      if (key === "Fecha") {
        var cmp = dateSortKey(va).localeCompare(dateSortKey(vb));
        if (cmp) return cmp * d;
        return Number(a._ord || 0) - Number(b._ord || 0);
      }
      var na = Number(va);
      var nb = Number(vb);
      if (isFinite(na) && isFinite(nb) && String(va).trim() !== "" && String(vb).trim() !== "") {
        var ncmp = (na - nb) * d;
        if (ncmp) return ncmp;
        return Number(a._ord || 0) - Number(b._ord || 0);
      }
      var cmp2 = String(va == null ? "" : va).localeCompare(String(vb == null ? "" : vb), "es") * d;
      if (cmp2) return cmp2;
      return Number(a._ord || 0) - Number(b._ord || 0);
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
