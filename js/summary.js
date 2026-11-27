/* Plantas escaneadas:
 * Fundo → Módulo → Turno → Lote (todo inicia cerrado).
 * lote = promedio última cartilla (solo datos);
 * turno / módulo / fundo = promedio de promedios hijos;
 * Total fila = promedio de promedios de lote.
 * Clasificación fundo←módulo según catálogo Licapa.
 */
(function (root) {
  var QBE = root.QBE || (root.QBE = {});

  var STAGES = [
    { key: "Botón Floral", label: "1) Flor cerrada" },
    { key: "Flor", label: "2) Flor abierta" },
    { key: "Cuaja", label: "3) Cuajo" },
    { key: "E1 (Verde)", label: "4) E1" },
    { key: "E2 (Rosado)", label: "5) E2" },
    { key: "E3 (Guinda)", label: "6) E3" },
    { key: "E4 (50%-70%)", label: "7) E4" },
    { key: "E5 (Maduro)", label: "8) E5" },
  ];

  var TOTAL_KEYS = ["E1 (Verde)", "E2 (Rosado)", "E3 (Guinda)", "E4 (50%-70%)", "E5 (Maduro)"];

  /** Catálogo Licapa: módulo → fundo (único). M10 se resuelve por lote/etapa. */
  var FUNDO_BY_MODULO = {
    M1: "Licapa I",
    M2: "Licapa I",
    M3: "Licapa I",
    M4: "Licapa I",
    M5: "Licapa I",
    M6: "Licapa II",
    M7: "Licapa II",
    M8: "Licapa II",
    M9: "Licapa II",
  };
  var M10_LOTES_II = { "213": 1, "214": 1, "215": 1, "216": 1, "223": 1, "224": 1 };
  var M10_LOTES_III = {
    "198": 1, "199": 1, "200": 1, "201": 1, "202": 1, "203": 1, "204": 1, "205": 1,
    "206": 1, "207": 1, "208": 1, "208A": 1, "208 B": 1, "209": 1, "210": 1, "211": 1, "212": 1,
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function fmt(n) {
    var x = Number(n || 0);
    if (!isFinite(x)) return "-";
    var s = x.toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    if (s === "0.0" || s === "0,0") return "-";
    return s;
  }
  function heat(n, on) {
    if (!on || n <= 0) return "";
    if (n < 1) return " heat-1";
    if (n < 3) return " heat-2";
    if (n < 6) return " heat-3";
    return " heat-4";
  }
  function num(v) {
    if (v === "" || v == null) return 0;
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }
  function isFundoName(s) {
    return /licapa/i.test(String(s || ""));
  }
  function normalizeFundo(s) {
    var t = String(s || "").replace(/\s+/g, " ").trim();
    var m = t.match(/licapa\s*(i{1,3}|iv|\d+)/i);
    if (!m) return t || "Sin fundo";
    var id = String(m[1]).toUpperCase();
    if (id === "1" || id === "I") return "Licapa I";
    if (id === "2" || id === "II") return "Licapa II";
    if (id === "3" || id === "III") return "Licapa III";
    if (id === "4" || id === "IV") return "Licapa IV";
    return "Licapa " + id;
  }
  function canonModulo(v) {
    var s = String(v || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!s) return "";
    // TM7 / M07 / M7 → M7 (nunca dejar "TM7" como nombre)
    var m = s.match(/^T?M0*(\d+)$/);
    if (m) return "M" + Number(m[1]);
    m = s.match(/M0*(\d+)/);
    if (m) return "M" + Number(m[1]);
    return "";
  }
  function looksLikeModuloToken(v) {
    return /^T?M0*\d+$/i.test(String(v || "").trim().replace(/\s+/g, ""));
  }
  function extractTurnoNum(v) {
    var s = String(v == null ? "" : v).trim();
    if (!s || s === "—") return "";
    // Si metieron el módulo en Turno (M7 / TM7), no es turno.
    if (looksLikeModuloToken(s)) return "";
    var m = s.match(/^T?0*(\d+)$/i);
    if (m) return String(Number(m[1]));
    m = s.match(/T0*(\d+)/i);
    if (m) return String(Number(m[1]));
    if (/^\d+$/.test(s)) return String(Number(s));
    return "";
  }
  function loteNumOf(r) {
    var n = String(r && r.Lotes != null ? r.Lotes : "").replace(/\s+/g, "").toUpperCase();
    if (n) return n;
    var raw = String((r && r.Lote) || "").trim().toUpperCase();
    var m = raw.match(/(?:LT|L)0*(\d+[A-Z]?)\s*$/i);
    if (m) return String(m[1]).toUpperCase();
    if (/^\d+[A-Z]?$/.test(raw)) return raw;
    return "";
  }
  function resolveM10Fundo(r) {
    var etapa = String(r.Etapa || r.Fundo || "").trim();
    if (isFundoName(etapa)) return normalizeFundo(etapa);
    var ln = loteNumOf(r);
    if (ln && M10_LOTES_III[ln]) return "Licapa III";
    if (ln && M10_LOTES_II[ln]) return "Licapa II";
    var bare = String(ln).replace(/\s+/g, "");
    if (bare && M10_LOTES_III[bare]) return "Licapa III";
    if (bare && M10_LOTES_II[bare]) return "Licapa II";
    return "Licapa II";
  }
  function moduloOf(r) {
    var modRaw = String(r.Modulo || "").trim();
    if (isFundoName(modRaw)) {
      return canonModulo(r.Lote) || canonModulo(r.Turno) || "General";
    }
    var mod = canonModulo(modRaw);
    if (mod) return mod;
    // Turno mal cargado como M7/TM7 → usar como módulo
    mod = canonModulo(r.Turno);
    if (mod) return mod;
    mod = canonModulo(r.Lote);
    if (mod) return mod;
    return "Sin módulo";
  }
  function fundoOf(r) {
    var etapa = String(r.Etapa || r.Fundo || r.fundo || "").trim();
    if (isFundoName(etapa)) return normalizeFundo(etapa);
    var modRaw = String(r.Modulo || "").trim();
    if (isFundoName(modRaw)) return normalizeFundo(modRaw);
    var mod = moduloOf(r);
    if (mod === "M10") return resolveM10Fundo(r);
    if (FUNDO_BY_MODULO[mod]) return FUNDO_BY_MODULO[mod];
    return "Sin fundo";
  }
  function turnoOf(r) {
    var fromField = extractTurnoNum(r.Turno);
    if (fromField) return fromField;
    // Si Turno traía M7/TM7, sacar el T del código de lote (M7T1LT…)
    var fromLote = extractTurnoNum(r.Lote);
    if (fromLote) return fromLote;
    return "—";
  }
  function turnoLabel(t) {
    var n = extractTurnoNum(t);
    if (!n) {
      // t ya normalizado a "7"
      if (t !== "" && t != null && t !== "—" && /^\d+$/.test(String(t))) return "T" + t;
      return "T—";
    }
    return "T" + n;
  }
  function loteDisplayName(r) {
    var n = String(r && r.Lotes != null ? r.Lotes : "").replace(/\D/g, "");
    if (!n) {
      var raw = String((r && r.Lote) || "").trim();
      var m = raw.match(/(?:LT|L)0*(\d+)\s*$/i);
      if (m) n = String(Number(m[1]));
      else if (/^\d+$/.test(raw)) n = String(Number(raw));
    } else {
      n = String(Number(n));
    }
    if (n && isFinite(Number(n))) return "Lote " + n;
    var fallback = String((r && r.Lote) || "").trim();
    return fallback || "Sin lote";
  }
  function zeros() {
    var o = {};
    STAGES.forEach(function (st) { o[st.key] = 0; });
    return o;
  }
  function totalE(vals) {
    var t = 0;
    TOTAL_KEYS.forEach(function (k) { t += vals[k] || 0; });
    return t;
  }
  function dateKey(r) {
    var f = String(r.Fecha || "").trim();
    var m = f.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + m[2] + m[3];
    m = f.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    if (m) {
      var dd = m[1].length < 2 ? "0" + m[1] : m[1];
      var mm = m[2].length < 2 ? "0" + m[2] : m[2];
      return m[3] + mm + dd;
    }
    return f;
  }
  function cartillaKey(r) {
    return [
      dateKey(r),
      String(r["Hora subida"] || "").trim(),
      String(r.DNI || "").trim(),
      String(r.Anexo || r["Foto cabecera"] || "").trim(),
    ].join("|");
  }
  function loteKey(r) {
    return [fundoOf(r), moduloOf(r), turnoOf(r), String(r.Lote || "").trim() || "Sin lote"].join("|");
  }
  function sortTurno(a, b) {
    var na = Number(a);
    var nb = Number(b);
    if (isFinite(na) && isFinite(nb)) return na - nb;
    return String(a).localeCompare(String(b), "es");
  }
  function sortModulo(a, b) {
    var ma = String(a).match(/^M(\d+)$/i);
    var mb = String(b).match(/^M(\d+)$/i);
    if (ma && mb) return Number(ma[1]) - Number(mb[1]);
    return String(a).localeCompare(String(b), "es");
  }
  function avgFromSamples(samples) {
    var out = zeros();
    var counts = zeros();
    if (!(samples && samples.length)) return out;
    samples.forEach(function (r) {
      STAGES.forEach(function (st) {
        var v = num(r[st.key]);
        if (!v) return;
        out[st.key] += v;
        counts[st.key] += 1;
      });
    });
    STAGES.forEach(function (st) {
      out[st.key] = counts[st.key] ? out[st.key] / counts[st.key] : 0;
    });
    return out;
  }
  function avgFromAvgs(items) {
    var out = zeros();
    STAGES.forEach(function (st) {
      var sum = 0;
      var n = 0;
      (items || []).forEach(function (item) {
        if (!item || !item.avg) return;
        var v = Number(item.avg[st.key]);
        if (!isFinite(v) || v === 0) return;
        sum += v;
        n += 1;
      });
      out[st.key] = n ? sum / n : 0;
    });
    return out;
  }
  function pickLastCartilla(samples) {
    var byCart = {};
    samples.forEach(function (r) {
      var ck = cartillaKey(r);
      if (!byCart[ck]) byCart[ck] = { key: ck, sort: dateKey(r) + "|" + String(r["Hora subida"] || ""), rows: [] };
      byCart[ck].rows.push(r);
    });
    var list = Object.keys(byCart).map(function (k) { return byCart[k]; });
    if (!list.length) return [];
    list.sort(function (a, b) {
      if (a.sort < b.sort) return -1;
      if (a.sort > b.sort) return 1;
      return a.rows.length - b.rows.length;
    });
    return list[list.length - 1].rows;
  }
  function aggregate(records) {
    var byLote = {};
    (records || []).forEach(function (r) {
      var lk = loteKey(r);
      if (!byLote[lk]) {
        byLote[lk] = {
          fundo: fundoOf(r),
          modulo: moduloOf(r),
          turno: turnoOf(r),
          name: loteDisplayName(r),
          samples: [],
        };
      }
      byLote[lk].samples.push(r);
    });

    var lots = Object.keys(byLote).map(function (lk) {
      var lot = byLote[lk];
      var last = pickLastCartilla(lot.samples);
      return {
        fundo: lot.fundo,
        modulo: lot.modulo,
        turno: lot.turno,
        name: lot.name,
        samples: last,
        muestras: last.length,
        avg: avgFromSamples(last),
      };
    });

    var byFundo = {};
    lots.forEach(function (lot) {
      if (!byFundo[lot.fundo]) {
        byFundo[lot.fundo] = { name: lot.fundo, modulos: {}, muestras: 0, lotCount: 0 };
      }
      var f = byFundo[lot.fundo];
      if (!f.modulos[lot.modulo]) {
        f.modulos[lot.modulo] = {
          fundo: lot.fundo,
          name: lot.modulo,
          turnos: {},
          muestras: 0,
          lotCount: 0,
        };
      }
      var mg = f.modulos[lot.modulo];
      if (!mg.turnos[lot.turno]) {
        mg.turnos[lot.turno] = {
          fundo: lot.fundo,
          modulo: lot.modulo,
          turno: lot.turno,
          label: turnoLabel(lot.turno),
          lots: [],
          muestras: 0,
          lotCount: 0,
        };
      }
      var tg = mg.turnos[lot.turno];
      tg.lots.push(lot);
      tg.lotCount += 1;
      tg.muestras += lot.muestras;
      mg.lotCount += 1;
      mg.muestras += lot.muestras;
      f.lotCount += 1;
      f.muestras += lot.muestras;
    });

    var groups = Object.keys(byFundo).sort(function (a, b) {
      return String(a).localeCompare(String(b), "es");
    }).map(function (fk) {
      var f = byFundo[fk];
      f.modulosList = Object.keys(f.modulos).sort(sortModulo).map(function (mk) {
        var mg = f.modulos[mk];
        mg.turnosList = Object.keys(mg.turnos).sort(sortTurno).map(function (tk) {
          var tg = mg.turnos[tk];
          tg.lots.sort(function (a, b) {
            return String(a.name).localeCompare(String(b.name), "es");
          });
          tg.avg = avgFromAvgs(tg.lots);
          return tg;
        });
        mg.turnoCount = mg.turnosList.length;
        mg.avg = avgFromAvgs(mg.turnosList);
        return mg;
      });
      f.moduloCount = f.modulosList.length;
      f.turnoCount = f.modulosList.reduce(function (n, mg) { return n + (mg.turnoCount || 0); }, 0);
      f.avg = avgFromAvgs(f.modulosList);
      return f;
    });

    return {
      groups: groups,
      grand: avgFromAvgs(lots),
      lotCount: lots.length,
      muestras: lots.reduce(function (n, l) { return n + (l.muestras || 0); }, 0),
    };
  }
  function cellsHtml(vals, on) {
    return STAGES.map(function (st) {
      var n = vals[st.key] || 0;
      return '<td class="num' + heat(n, on) + '">' + fmt(n) + "</td>";
    }).join("") + '<td class="num">' + fmt(totalE(vals)) + "</td>";
  }
  function metaFundo(group) {
    var mods = Number(group.moduloCount) || 0;
    var l = Number(group.lotCount) || 0;
    var t = Number(group.turnoCount) || 0;
    var m = Number(group.muestras) || 0;
    return mods + " mód. · " + l + " lote" + (l === 1 ? "" : "s") + " · " + t + " turno" + (t === 1 ? "" : "s") + " · " + m + " mues.";
  }
  function metaModulo(mg) {
    var l = Number(mg.lotCount) || 0;
    var t = Number(mg.turnoCount) || 0;
    var m = Number(mg.muestras) || 0;
    return l + " lote" + (l === 1 ? "" : "s") + " · " + t + " turno" + (t === 1 ? "" : "s") + " · " + m + " mues.";
  }
  function metaTurno(tg) {
    var l = Number(tg.lotCount) || 0;
    var m = Number(tg.muestras) || 0;
    return l + " lote" + (l === 1 ? "" : "s") + " · " + m + " mues.";
  }

  var page = 1;
  var pageSize = 6;
  var pagerBound = false;
  var exportBound = false;
  var toggleBound = false;
  var lastAgg = null;
  var collapsedFundo = {};
  var collapsedModulo = {};
  var collapsedTurno = {};

  function isFundoClosed(key) {
    if (!Object.prototype.hasOwnProperty.call(collapsedFundo, key)) return true;
    return !!collapsedFundo[key];
  }
  function isModuloClosed(key) {
    if (!Object.prototype.hasOwnProperty.call(collapsedModulo, key)) return true;
    return !!collapsedModulo[key];
  }
  function isTurnoClosed(key) {
    if (!Object.prototype.hasOwnProperty.call(collapsedTurno, key)) return true;
    return !!collapsedTurno[key];
  }
  function fundoRow(group) {
    var key = group.name;
    var closed = isFundoClosed(key);
    var cls = "row-campo" + (closed ? " is-collapsed" : " is-open");
    var first =
      '<span class="campo-toggle" aria-hidden="true"></span>' +
      '<span class="campo-name">' + esc(group.name) + "</span>" +
      '<span class="campo-meta">' + esc(metaFundo(group)) + "</span>";
    return '<tr class="' + cls + '" data-fundo-key="' + esc(key) + '" role="button" tabindex="0" aria-expanded="' +
      (closed ? "false" : "true") + '"><td class="campo-cell">' + first + "</td>" + cellsHtml(group.avg, false) + "</tr>";
  }
  function moduloRow(mg, fundoKey) {
    var mKey = fundoKey + "|" + mg.name;
    var fundoClosed = isFundoClosed(fundoKey);
    var closed = isModuloClosed(mKey);
    var cls = "row-modulo" + (closed ? " is-collapsed" : " is-open");
    var first =
      '<span class="modulo-toggle" aria-hidden="true"></span>' +
      '<span class="modulo-name">' + esc(mg.name) + "</span>" +
      '<span class="modulo-meta">' + esc(metaModulo(mg)) + "</span>";
    return '<tr class="' + cls + '" data-fundo-key="' + esc(fundoKey) + '" data-modulo-key="' + esc(mKey) +
      '" role="button" tabindex="0" aria-expanded="' + (closed ? "false" : "true") + '"' +
      (fundoClosed ? " hidden" : "") +
      '><td class="modulo-cell">' + first + "</td>" + cellsHtml(mg.avg, false) + "</tr>";
  }
  function turnoRow(tg, fundoKey, moduloKey) {
    var tKey = moduloKey + "|" + tg.turno;
    var hide = isFundoClosed(fundoKey) || isModuloClosed(moduloKey);
    var closed = isTurnoClosed(tKey);
    var cls = "row-turno" + (closed ? " is-collapsed" : " is-open");
    var first =
      '<span class="turno-toggle" aria-hidden="true"></span>' +
      '<span class="turno-name">' + esc(tg.label) + "</span>" +
      '<span class="turno-meta">' + esc(metaTurno(tg)) + "</span>";
    return '<tr class="' + cls + '" data-fundo-key="' + esc(fundoKey) + '" data-modulo-key="' + esc(moduloKey) +
      '" data-turno-key="' + esc(tKey) + '" role="button" tabindex="0" aria-expanded="' +
      (closed ? "false" : "true") + '"' + (hide ? " hidden" : "") +
      '><td class="turno-cell">' + first + "</td>" + cellsHtml(tg.avg, false) + "</tr>";
  }
  function loteRow(lot, fundoKey, moduloKey, turnoKey) {
    var hide = isFundoClosed(fundoKey) || isModuloClosed(moduloKey) || isTurnoClosed(turnoKey);
    var first = '<span class="lote-name">' + esc(lot.name) + "</span>";
    return '<tr class="row-lote" data-fundo-key="' + esc(fundoKey) + '" data-modulo-key="' + esc(moduloKey) +
      '" data-parent-turno="' + esc(turnoKey) + '"' + (hide ? " hidden" : "") +
      '><td class="lote-cell">' + first + "</td>" + cellsHtml(lot.avg, false) + "</tr>";
  }
  function totalRow(vals) {
    return '<tr class="row-total"><td>Total</td>' + cellsHtml(vals, false) + "</tr>";
  }
  function paintPager(pager, pages) {
    if (!pager) return;
    var html = '<button type="button" data-pg="first" ' + (page <= 1 ? "disabled" : "") + ">«</button>" +
      '<button type="button" data-pg="-1" ' + (page <= 1 ? "disabled" : "") + ">‹</button>";
    var start = Math.max(1, page - 2);
    var end = Math.min(pages, start + 4);
    start = Math.max(1, end - 4);
    var p;
    for (p = start; p <= end; p += 1) {
      html += '<button type="button" class="pg-num' + (p === page ? " on" : "") + '" data-goto="' + p + '">' + p + "</button>";
    }
    html += '<button type="button" data-pg="1" ' + (page >= pages ? "disabled" : "") + ">›</button>" +
      '<button type="button" data-pg="last" ' + (page >= pages ? "disabled" : "") + ">»</button>" +
      '<span class="pg-info">Página ' + page + " de " + pages + "</span>";
    pager.innerHTML = html;
  }
  function bindPager() {
    var pager = document.getElementById("kg-pager");
    if (!pager || pagerBound) return;
    pagerBound = true;
    pager.addEventListener("click", function (e) {
      var btn = e.target.closest("button");
      if (!btn || btn.disabled) return;
      var pages = Number(pager.getAttribute("data-pages") || 1);
      if (btn.getAttribute("data-goto")) page = Number(btn.getAttribute("data-goto")) || 1;
      else {
        var cmd = btn.getAttribute("data-pg");
        if (cmd === "first") page = 1;
        else if (cmd === "last") page = pages;
        else page += Number(cmd) || 0;
      }
      if (page < 1) page = 1;
      if (page > pages) page = pages;
      if (QBE.app && QBE.app.refresh) QBE.app.refresh();
    });
  }
  function exportRows() {
    var agg = lastAgg;
    if (!agg || typeof XLSX === "undefined") return;
    var cols = ["Fundo / Módulo / Turno / Lote"].concat(STAGES.map(function (st) { return st.label; })).concat(["Total"]);
    var aoa = [cols];
    agg.groups.forEach(function (f) {
      aoa.push([f.name].concat(STAGES.map(function (st) { return Number((f.avg[st.key] || 0).toFixed(2)); })).concat([Number(totalE(f.avg).toFixed(2))]));
      (f.modulosList || []).forEach(function (mg) {
        aoa.push([("  " + mg.name)].concat(STAGES.map(function (st) {
          return Number((mg.avg[st.key] || 0).toFixed(2));
        })).concat([Number(totalE(mg.avg).toFixed(2))]));
        (mg.turnosList || []).forEach(function (tg) {
          aoa.push([("    " + tg.label)].concat(STAGES.map(function (st) {
            return Number((tg.avg[st.key] || 0).toFixed(2));
          })).concat([Number(totalE(tg.avg).toFixed(2))]));
          (tg.lots || []).forEach(function (lot) {
            aoa.push([("      " + lot.name)].concat(STAGES.map(function (st) {
              return Number((lot.avg[st.key] || 0).toFixed(2));
            })).concat([Number(totalE(lot.avg).toFixed(2))]));
          });
        });
      });
    });
    aoa.push(["Total"].concat(STAGES.map(function (st) { return Number((agg.grand[st.key] || 0).toFixed(2)); })).concat([Number(totalE(agg.grand).toFixed(2))]));
    var softRows = [];
    var rowIdx = 1;
    agg.groups.forEach(function (f) {
      softRows.push(rowIdx);
      rowIdx += 1;
      (f.modulosList || []).forEach(function (mg) {
        rowIdx += 1;
        (mg.turnosList || []).forEach(function (tg) {
          rowIdx += 1;
          rowIdx += (tg.lots || []).length;
        });
      });
    });
    if (QBE.xls && QBE.xls.download) {
      QBE.xls.download(aoa, "Resumen", "plantas-escaneadas-qberries.xlsx", {
        leftCols: [0],
        softRows: softRows,
        totalRows: [aoa.length - 1],
        boldFirstCol: true,
        colWidths: { 0: 28 },
      });
    } else {
      var wb = XLSX.utils.book_new();
      var ws = XLSX.utils.aoa_to_sheet(aoa);
      XLSX.utils.book_append_sheet(wb, ws, "Resumen");
      XLSX.writeFile(wb, "plantas-escaneadas-qberries.xlsx");
    }
    if (QBE.audit) QBE.audit.add("Exportar Excel resumen", (aoa.length - 1) + " filas");
  }
  function bindExport() {
    if (exportBound) return;
    exportBound = true;
    var xls = document.getElementById("btn-kg-xls");
    if (xls) xls.addEventListener("click", exportRows);
  }
  function applyFundoCollapse(body, key, hide) {
    if (!body) return;
    body.querySelectorAll('tr.row-modulo[data-fundo-key="' + key + '"]').forEach(function (tr) {
      tr.hidden = !!hide;
      if (hide) return;
      var mKey = tr.getAttribute("data-modulo-key");
      var modHide = isModuloClosed(mKey);
      tr.classList.toggle("is-collapsed", modHide);
      tr.classList.toggle("is-open", !modHide);
      body.querySelectorAll('tr.row-turno[data-modulo-key="' + mKey + '"]').forEach(function (ttr) {
        ttr.hidden = modHide;
        if (modHide) return;
        var tKey = ttr.getAttribute("data-turno-key");
        var turnoHide = isTurnoClosed(tKey);
        ttr.classList.toggle("is-collapsed", turnoHide);
        ttr.classList.toggle("is-open", !turnoHide);
        body.querySelectorAll('tr.row-lote[data-parent-turno="' + tKey + '"]').forEach(function (lot) {
          lot.hidden = turnoHide;
        });
      });
      if (modHide) {
        body.querySelectorAll('tr.row-lote[data-modulo-key="' + mKey + '"]').forEach(function (lot) {
          lot.hidden = true;
        });
      }
    });
    if (hide) {
      body.querySelectorAll('tr.row-turno[data-fundo-key="' + key + '"], tr.row-lote[data-fundo-key="' + key + '"]').forEach(function (tr) {
        tr.hidden = true;
      });
    }
    var head = body.querySelector('tr.row-campo[data-fundo-key="' + key + '"]');
    if (!head) return;
    head.classList.toggle("is-collapsed", !!hide);
    head.classList.toggle("is-open", !hide);
    head.setAttribute("aria-expanded", hide ? "false" : "true");
  }
  function applyModuloCollapse(body, mKey, hide) {
    if (!body || !mKey) return;
    body.querySelectorAll('tr.row-turno[data-modulo-key="' + mKey + '"]').forEach(function (tr) {
      var fundoKey = tr.getAttribute("data-fundo-key");
      tr.hidden = !!hide || isFundoClosed(fundoKey);
      if (tr.hidden) return;
      var tKey = tr.getAttribute("data-turno-key");
      var turnoHide = isTurnoClosed(tKey);
      tr.classList.toggle("is-collapsed", turnoHide);
      tr.classList.toggle("is-open", !turnoHide);
      body.querySelectorAll('tr.row-lote[data-parent-turno="' + tKey + '"]').forEach(function (lot) {
        lot.hidden = turnoHide;
      });
    });
    if (hide) {
      body.querySelectorAll('tr.row-lote[data-modulo-key="' + mKey + '"]').forEach(function (tr) {
        tr.hidden = true;
      });
    }
    var head = body.querySelector('tr.row-modulo[data-modulo-key="' + mKey + '"]');
    if (!head) return;
    head.classList.toggle("is-collapsed", !!hide);
    head.classList.toggle("is-open", !hide);
    head.setAttribute("aria-expanded", hide ? "false" : "true");
  }
  function applyTurnoCollapse(body, tKey, hide) {
    if (!body || !tKey) return;
    body.querySelectorAll('tr.row-lote[data-parent-turno="' + tKey + '"]').forEach(function (tr) {
      var fundoKey = tr.getAttribute("data-fundo-key");
      var moduloKey = tr.getAttribute("data-modulo-key");
      tr.hidden = !!hide || isFundoClosed(fundoKey) || isModuloClosed(moduloKey);
    });
    var head = body.querySelector('tr.row-turno[data-turno-key="' + tKey + '"]');
    if (!head) return;
    head.classList.toggle("is-collapsed", !!hide);
    head.classList.toggle("is-open", !hide);
    head.setAttribute("aria-expanded", hide ? "false" : "true");
  }
  function bindToggle() {
    var body = document.getElementById("kg-body");
    if (!body || toggleBound) return;
    toggleBound = true;
    body.addEventListener("click", function (e) {
      var turnoTr = e.target.closest("tr.row-turno");
      if (turnoTr && body.contains(turnoTr)) {
        var tKey = turnoTr.getAttribute("data-turno-key");
        if (!tKey) return;
        var hideT = !isTurnoClosed(tKey);
        collapsedTurno[tKey] = hideT ? 1 : 0;
        applyTurnoCollapse(body, tKey, hideT);
        return;
      }
      var modTr = e.target.closest("tr.row-modulo");
      if (modTr && body.contains(modTr)) {
        var mKey = modTr.getAttribute("data-modulo-key");
        if (!mKey) return;
        var hideM = !isModuloClosed(mKey);
        collapsedModulo[mKey] = hideM ? 1 : 0;
        applyModuloCollapse(body, mKey, hideM);
        return;
      }
      var tr = e.target.closest("tr.row-campo");
      if (!tr || !body.contains(tr)) return;
      var key = tr.getAttribute("data-fundo-key");
      if (!key) return;
      var hide = !isFundoClosed(key);
      collapsedFundo[key] = hide ? 1 : 0;
      applyFundoCollapse(body, key, hide);
    });
    body.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var tr = e.target.closest("tr.row-campo, tr.row-modulo, tr.row-turno");
      if (!tr || !body.contains(tr)) return;
      e.preventDefault();
      tr.click();
    });
  }
  function render(records) {
    var head = document.getElementById("kg-head");
    var body = document.getElementById("kg-body");
    var count = document.getElementById("kg-count");
    var pager = document.getElementById("kg-pager");
    bindPager();
    bindExport();
    bindToggle();
    var agg = aggregate(records);
    lastAgg = agg;
    if (head) {
      head.innerHTML = '<th class="th-campo">Campo</th>' + STAGES.map(function (st) {
        return '<th class="num">' + esc(st.label) + "</th>";
      }).join("") + '<th class="num">Total</th>';
    }
    if (!body) return;
    var groups = agg.groups;
    var pages = Math.max(1, Math.ceil(groups.length / pageSize) || 1);
    if (page > pages) page = pages;
    if (page < 1) page = 1;
    var colSpan = STAGES.length + 2;
    if (!groups.length) {
      body.innerHTML = '<tr class="empty"><td colspan="' + colSpan + '">Sin datos para resumir. Revise los filtros.</td></tr>';
      if (count) count.innerHTML = "<strong>0</strong><span>lotes · toca un fundo</span>";
      paintPager(pager, 1);
      return;
    }
    var from = (page - 1) * pageSize;
    var slice = groups.slice(from, from + pageSize);
    var html = "";
    slice.forEach(function (fundo) {
      html += fundoRow(fundo);
      (fundo.modulosList || []).forEach(function (mg) {
        var mKey = fundo.name + "|" + mg.name;
        html += moduloRow(mg, fundo.name);
        (mg.turnosList || []).forEach(function (tg) {
          var tKey = mKey + "|" + tg.turno;
          html += turnoRow(tg, fundo.name, mKey);
          (tg.lots || []).forEach(function (lot) {
            html += loteRow(lot, fundo.name, mKey, tKey);
          });
        });
      });
    });
    html += totalRow(agg.grand);
    body.innerHTML = html;
    if (count) {
      count.innerHTML = "<strong>" + agg.lotCount + " lotes · " + agg.muestras + " muestras</strong><span>fundo → módulo → turno → lote · Total " + fmt(totalE(agg.grand)) + "</span>";
    }
    if (pager) pager.setAttribute("data-pages", String(pages));
    paintPager(pager, pages);
  }

  function resetPage() { page = 1; }

  QBE.summary = { render: render, stages: STAGES, resetPage: resetPage };
})(typeof window !== "undefined" ? window : globalThis);
