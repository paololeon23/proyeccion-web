/* Plantas escaneadas — misma lógica del app:
 * lote = promedio de la última cartilla;
 * módulo / turno / total = promedio ponderado por muestras;
 * Total columna = E1+E2+E3+E4+E5.
 * Despliegue: Módulo → Turno → Lote (como app Campo).
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

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function fmt(n) {
    return Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
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
  function campoOf(r) {
    var m = String(r.Modulo || "").trim();
    if (m) return m;
    var v = String(r.Variedad || "").trim();
    if (v) return v;
    return "General";
  }
  function turnoOf(r) {
    var t = r.Turno;
    if (t === "" || t == null) return "—";
    return String(t);
  }
  function turnoLabel(t) {
    if (t === "—" || t == null || t === "") return "T—";
    return "T" + t;
  }
  /** M01T01L3 / M1T1LT3 / Lotes=3 → "Lote 3" */
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
    return [campoOf(r), turnoOf(r), String(r.Lote || "").trim() || "Sin lote"].join("|");
  }
  function sortTurno(a, b) {
    var na = Number(a);
    var nb = Number(b);
    if (isFinite(na) && isFinite(nb)) return na - nb;
    return String(a).localeCompare(String(b), "es");
  }
  function avgFromSamples(samples) {
    var out = zeros();
    var n = samples.length || 0;
    if (!n) return out;
    samples.forEach(function (r) {
      STAGES.forEach(function (st) {
        out[st.key] += num(r[st.key]);
      });
    });
    STAGES.forEach(function (st) {
      out[st.key] = out[st.key] / n;
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
          campo: campoOf(r),
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
        campo: lot.campo,
        turno: lot.turno,
        name: lot.name,
        samples: last,
        muestras: last.length,
        avg: avgFromSamples(last),
      };
    });

    var byCampo = {};
    lots.forEach(function (lot) {
      if (!byCampo[lot.campo]) {
        byCampo[lot.campo] = { name: lot.campo, turnos: {}, samples: [], muestras: 0, lotCount: 0 };
      }
      var g = byCampo[lot.campo];
      if (!g.turnos[lot.turno]) {
        g.turnos[lot.turno] = {
          campo: lot.campo,
          turno: lot.turno,
          label: turnoLabel(lot.turno),
          lots: [],
          samples: [],
          muestras: 0,
          lotCount: 0,
        };
      }
      var tg = g.turnos[lot.turno];
      tg.lots.push(lot);
      tg.lotCount += 1;
      lot.samples.forEach(function (s) {
        tg.samples.push(s);
        g.samples.push(s);
      });
      tg.muestras += lot.muestras;
      g.muestras += lot.muestras;
      g.lotCount += 1;
    });

    var groups = Object.keys(byCampo).sort().map(function (k) {
      var g = byCampo[k];
      g.turnosList = Object.keys(g.turnos).sort(sortTurno).map(function (tk) {
        var tg = g.turnos[tk];
        tg.lots.sort(function (a, b) {
          return String(a.name).localeCompare(String(b.name), "es");
        });
        tg.avg = avgFromSamples(tg.samples);
        return tg;
      });
      g.turnoCount = g.turnosList.length;
      g.avg = avgFromSamples(g.samples);
      return g;
    });

    var allSamples = [];
    groups.forEach(function (g) {
      g.samples.forEach(function (s) { allSamples.push(s); });
    });

    return {
      groups: groups,
      grand: avgFromSamples(allSamples),
      lotCount: lots.length,
      muestras: allSamples.length,
    };
  }
  function cellsHtml(vals, on) {
    return STAGES.map(function (st) {
      var n = vals[st.key] || 0;
      return '<td class="num' + heat(n, on) + '">' + fmt(n) + "</td>";
    }).join("") + '<td class="num">' + fmt(totalE(vals)) + "</td>";
  }
  function metaCampo(group) {
    var l = Number(group.lotCount) || 0;
    var t = Number(group.turnoCount) || 0;
    var m = Number(group.muestras) || 0;
    return l + " lote" + (l === 1 ? "" : "s") + " · " + t + " turno" + (t === 1 ? "" : "s") + " · " + m + " mues.";
  }
  function metaTurno(tg) {
    var l = Number(tg.lotCount) || 0;
    var m = Number(tg.muestras) || 0;
    return l + " lote" + (l === 1 ? "" : "s") + " · " + m + " mues.";
  }
  function campoRow(group) {
    var key = group.name;
    var closed = !!collapsed[key];
    var cls = "row-campo" + (closed ? " is-collapsed" : " is-open");
    var first =
      '<span class="campo-toggle" aria-hidden="true"></span>' +
      '<span class="campo-name">' + esc(group.name) + "</span>" +
      '<span class="campo-meta">' + esc(metaCampo(group)) + "</span>";
    return '<tr class="' + cls + '" data-campo-key="' + esc(key) + '" role="button" tabindex="0" aria-expanded="' +
      (closed ? "false" : "true") + '"><td class="campo-cell">' + first + "</td>" + cellsHtml(group.avg, false) + "</tr>";
  }
  function turnoRow(tg, campoKey) {
    var tKey = campoKey + "|" + tg.turno;
    var campoClosed = !!collapsed[campoKey];
    var turnoClosed = !!collapsedTurno[tKey];
    var cls = "row-turno" + (turnoClosed ? " is-collapsed" : " is-open");
    var first =
      '<span class="turno-toggle" aria-hidden="true"></span>' +
      '<span class="turno-name">' + esc(tg.label) + "</span>" +
      '<span class="turno-meta">' + esc(metaTurno(tg)) + "</span>";
    return '<tr class="' + cls + '" data-campo-key="' + esc(campoKey) + '" data-turno-key="' + esc(tKey) +
      '" role="button" tabindex="0" aria-expanded="' + (turnoClosed ? "false" : "true") + '"' +
      (campoClosed ? " hidden" : "") +
      '><td class="turno-cell">' + first + "</td>" + cellsHtml(tg.avg, false) + "</tr>";
  }
  function loteRow(lot, campoKey, turnoKey) {
    var campoClosed = !!collapsed[campoKey];
    var turnoClosed = !!collapsedTurno[turnoKey];
    var hide = campoClosed || turnoClosed;
    var first = '<span class="lote-name">' + esc(lot.name) + "</span>";
    return '<tr class="row-lote" data-parent-campo="' + esc(campoKey) + '" data-parent-turno="' + esc(turnoKey) + '"' +
      (hide ? " hidden" : "") +
      '><td class="lote-cell">' + first + "</td>" + cellsHtml(lot.avg, false) + "</tr>";
  }
  function totalRow(vals) {
    return '<tr class="row-total"><td>Total</td>' + cellsHtml(vals, false) + "</tr>";
  }

  var page = 1;
  var pageSize = 6;
  var pagerBound = false;
  var exportBound = false;
  var toggleBound = false;
  var lastAgg = null;
  var collapsed = {};
  var collapsedTurno = {};

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
    var cols = ["Campo / Turno / Lote"].concat(STAGES.map(function (st) { return st.label; })).concat(["Total"]);
    var aoa = [cols];
    agg.groups.forEach(function (g) {
      aoa.push([g.name].concat(STAGES.map(function (st) { return Number((g.avg[st.key] || 0).toFixed(2)); })).concat([Number(totalE(g.avg).toFixed(2))]));
      (g.turnosList || []).forEach(function (tg) {
        aoa.push([("  " + tg.label)].concat(STAGES.map(function (st) {
          return Number((tg.avg[st.key] || 0).toFixed(2));
        })).concat([Number(totalE(tg.avg).toFixed(2))]));
        (tg.lots || []).forEach(function (lot) {
          aoa.push([("    " + lot.name)].concat(STAGES.map(function (st) {
            return Number((lot.avg[st.key] || 0).toFixed(2));
          })).concat([Number(totalE(lot.avg).toFixed(2))]));
        });
      });
    });
    aoa.push(["Total"].concat(STAGES.map(function (st) { return Number((agg.grand[st.key] || 0).toFixed(2)); })).concat([Number(totalE(agg.grand).toFixed(2))]));
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, "Resumen");
    XLSX.writeFile(wb, "plantas-escaneadas-qberries.xlsx");
    if (QBE.audit) QBE.audit.add("Exportar Excel resumen", (aoa.length - 1) + " filas");
  }
  function bindExport() {
    if (exportBound) return;
    exportBound = true;
    var xls = document.getElementById("btn-kg-xls");
    if (xls) xls.addEventListener("click", exportRows);
  }
  function applyCampoCollapse(body, key, hide) {
    if (!body) return;
    body.querySelectorAll('tr.row-turno[data-campo-key="' + key + '"]').forEach(function (tr) {
      tr.hidden = !!hide;
      if (hide) return;
      var tKey = tr.getAttribute("data-turno-key");
      var turnoHide = !!collapsedTurno[tKey];
      tr.classList.toggle("is-collapsed", turnoHide);
      tr.classList.toggle("is-open", !turnoHide);
      body.querySelectorAll('tr.row-lote[data-parent-turno="' + tKey + '"]').forEach(function (lot) {
        lot.hidden = turnoHide;
      });
    });
    if (hide) {
      body.querySelectorAll('tr.row-lote[data-parent-campo="' + key + '"]').forEach(function (tr) {
        tr.hidden = true;
      });
    }
    var head = body.querySelector('tr.row-campo[data-campo-key="' + key + '"]');
    if (!head) return;
    head.classList.toggle("is-collapsed", !!hide);
    head.classList.toggle("is-open", !hide);
    head.setAttribute("aria-expanded", hide ? "false" : "true");
  }
  function applyTurnoCollapse(body, tKey, hide) {
    if (!body || !tKey) return;
    body.querySelectorAll('tr.row-lote[data-parent-turno="' + tKey + '"]').forEach(function (tr) {
      var campoKey = tr.getAttribute("data-parent-campo");
      tr.hidden = !!hide || !!collapsed[campoKey];
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
        var hideT = !collapsedTurno[tKey];
        if (hideT) collapsedTurno[tKey] = 1;
        else delete collapsedTurno[tKey];
        applyTurnoCollapse(body, tKey, hideT);
        return;
      }
      var tr = e.target.closest("tr.row-campo");
      if (!tr || !body.contains(tr)) return;
      var key = tr.getAttribute("data-campo-key");
      if (!key) return;
      var hide = !collapsed[key];
      if (hide) collapsed[key] = 1;
      else delete collapsed[key];
      applyCampoCollapse(body, key, hide);
    });
    body.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var tr = e.target.closest("tr.row-campo, tr.row-turno");
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
      if (count) count.innerHTML = "<strong>0</strong><span>lotes · toca un módulo</span>";
      paintPager(pager, 1);
      return;
    }
    var from = (page - 1) * pageSize;
    var slice = groups.slice(from, from + pageSize);
    var html = "";
    slice.forEach(function (group) {
      html += campoRow(group);
      (group.turnosList || []).forEach(function (tg) {
        var tKey = group.name + "|" + tg.turno;
        html += turnoRow(tg, group.name);
        (tg.lots || []).forEach(function (lot) {
          html += loteRow(lot, group.name, tKey);
        });
      });
    });
    html += totalRow(agg.grand);
    body.innerHTML = html;
    if (count) {
      count.innerHTML = "<strong>" + agg.lotCount + " lotes · " + agg.muestras + " muestras</strong><span>módulo → turno → lote · Total " + fmt(totalE(agg.grand)) + "</span>";
    }
    if (pager) pager.setAttribute("data-pages", String(pages));
    paintPager(pager, pages);
  }

  function resetPage() { page = 1; }

  QBE.summary = { render: render, stages: STAGES, resetPage: resetPage };
})(typeof window !== "undefined" ? window : globalThis);
