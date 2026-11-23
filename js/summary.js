/* Plantas escaneadas — resumen KG por campo / lote y etapas fenológicas. */
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

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  function fmt(n) {
    return Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function heat(n, on) {
    if (!on || n <= 0) return "";
    if (n < 0.05) return " heat-1";
    if (n < 0.2) return " heat-2";
    if (n < 0.5) return " heat-3";
    return " heat-4";
  }
  function grams() {
    var el = document.getElementById("f-gramos");
    var n = el ? Number(el.value) : (QBE.config.pesoBayaDefault || 3.5);
    return isFinite(n) && n > 0 ? n : 3.5;
  }
  function coloresOn() {
    var el = document.getElementById("f-colores-kg");
    return !!(el && el.checked);
  }
  function toKg(count, g) {
    return (Number(count) || 0) * g / 1000;
  }
  function campoOf(r) {
    var m = String(r.Modulo || "").trim();
    if (m) return m;
    var v = String(r.Variedad || "").trim();
    if (v) return v;
    return "General";
  }
  function zeros() {
    var o = {};
    STAGES.forEach(function (st) { o[st.key] = 0; });
    return o;
  }
  function sumVals(vals) {
    var t = 0;
    STAGES.forEach(function (st) { t += vals[st.key] || 0; });
    return t;
  }
  function turnoOf(r) {
    var t = r.Turno;
    if (t === "" || t == null) return "—";
    return String(t);
  }
  function sortTurnoKeys(keys) {
    return keys.slice().sort(function (a, b) {
      var na = Number(a);
      var nb = Number(b);
      if (isFinite(na) && isFinite(nb)) return na - nb;
      return String(a).localeCompare(String(b), "es");
    });
  }
  function aggregate(records) {
    var g = grams();
    var byCampo = {};
    (records || []).forEach(function (r) {
      var campo = campoOf(r);
      var turno = turnoOf(r);
      var lote = String(r.Lote || "Sin lote").trim() || "Sin lote";
      if (!byCampo[campo]) byCampo[campo] = { name: campo, turnos: {}, totals: zeros(), area: 0 };
      var group = byCampo[campo];
      if (!group.turnos[turno]) group.turnos[turno] = { name: turno, lots: {}, totals: zeros() };
      var turn = group.turnos[turno];
      if (!turn.lots[lote]) turn.lots[lote] = { name: lote, vals: zeros(), area: 0 };
      var lot = turn.lots[lote];
      STAGES.forEach(function (st) {
        var kg = toKg(r[st.key], g);
        lot.vals[st.key] += kg;
        turn.totals[st.key] += kg;
        group.totals[st.key] += kg;
      });
      var area = Number(r.Area) || 0;
      if (area > lot.area) lot.area = area;
      if (area > group.area) group.area = area;
    });
    return { g: g, groups: Object.keys(byCampo).sort().map(function (k) { return byCampo[k]; }) };
  }
  function rowHtml(label, vals, kind, on, meta) {
    var total = sumVals(vals);
    var cells = STAGES.map(function (st) {
      var n = vals[st.key] || 0;
      return '<td class="num' + heat(n, on) + '">' + fmt(n) + "</td>";
    }).join("");
    var cls = kind === "campo" ? "row-campo" : (kind === "turno" ? "row-turno" : (kind === "total" ? "row-total" : "row-lote"));
    var attrs = "";
    var first = esc(label);
    if (kind === "turno" && meta && meta.turnoKey) {
      var closed = !!collapsed[meta.turnoKey];
      cls += closed ? " is-collapsed" : " is-open";
      attrs = ' data-turno-key="' + esc(meta.turnoKey) + '" role="button" tabindex="0" aria-expanded="' + (closed ? "false" : "true") + '"';
      first = '<span class="turno-toggle" aria-hidden="true"></span>' + esc(label);
    }
    if (kind === "lote" && meta && meta.turnoKey) {
      attrs = ' data-parent-turno="' + esc(meta.turnoKey) + '"' + (collapsed[meta.turnoKey] ? " hidden" : "");
    }
    return "<tr class=\"" + cls + "\"" + attrs + "><td>" + first + "</td>" + cells +
      '<td class="num">' + fmt(total) + "</td></tr>";
  }
  var page = 1;
  var pageSize = 8;
  var pagerBound = false;
  var exportBound = false;
  var toggleBound = false;
  var lastAgg = null;
  var collapsed = {};

  function flatLots(groups) {
    var rows = [];
    groups.forEach(function (g) {
      sortTurnoKeys(Object.keys(g.turnos || {})).forEach(function (tk) {
        var turn = g.turnos[tk];
        Object.keys(turn.lots).sort().forEach(function (lk) {
          rows.push({ campo: g.name, turno: turn.name, turnTotals: turn.totals, lot: turn.lots[lk] });
        });
      });
    });
    return rows;
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
  function exportRows(asXls) {
    var agg = lastAgg;
    if (!agg) return;
    var cols = ["Campo / Lote"].concat(STAGES.map(function (st) { return st.label; })).concat(["Total"]);
    var aoa = [cols];
    agg.groups.forEach(function (g) {
      aoa.push([g.name].concat(STAGES.map(function (st) { return Number((g.totals[st.key] || 0).toFixed(4)); })).concat([Number(sumVals(g.totals).toFixed(4))]));
      sortTurnoKeys(Object.keys(g.turnos || {})).forEach(function (tk) {
        var turn = g.turnos[tk];
        aoa.push(["Turno " + turn.name].concat(STAGES.map(function (st) { return Number((turn.totals[st.key] || 0).toFixed(4)); })).concat([Number(sumVals(turn.totals).toFixed(4))]));
        Object.keys(turn.lots).sort().forEach(function (lk) {
          var lot = turn.lots[lk];
          aoa.push([lot.name].concat(STAGES.map(function (st) { return Number((lot.vals[st.key] || 0).toFixed(4)); })).concat([Number(sumVals(lot.vals).toFixed(4))]));
        });
      });
    });
    var grand = zeros();
    agg.groups.forEach(function (g) {
      STAGES.forEach(function (st) { grand[st.key] += g.totals[st.key]; });
    });
    aoa.push(["Total"].concat(STAGES.map(function (st) { return Number((grand[st.key] || 0).toFixed(4)); })).concat([Number(sumVals(grand).toFixed(4))]));
    if (asXls && typeof XLSX !== "undefined") {
      var wb = XLSX.utils.book_new();
      var ws = XLSX.utils.aoa_to_sheet(aoa);
      XLSX.utils.book_append_sheet(wb, ws, "KG");
      XLSX.writeFile(wb, "plantas-escaneadas-qberries.xlsx");
    } else if (QBE.perf && QBE.perf.downloadCsv) {
      QBE.perf.downloadCsv("plantas-escaneadas-qberries.csv", aoa);
    }
    if (QBE.audit) QBE.audit.add(asXls ? "Exportar Excel KG" : "Exportar CSV KG", (aoa.length - 1) + " filas");
  }
  function bindExport() {
    if (exportBound) return;
    exportBound = true;
    var csv = document.getElementById("btn-kg-csv");
    var xls = document.getElementById("btn-kg-xls");
    if (csv) csv.addEventListener("click", function () { exportRows(false); });
    if (xls) xls.addEventListener("click", function () { exportRows(true); });
  }
  function applyTurnoCollapse(body, key, hide) {
    if (!body) return;
    body.querySelectorAll('tr.row-lote[data-parent-turno="' + key + '"]').forEach(function (tr) {
      tr.hidden = !!hide;
    });
    var head = body.querySelector('tr.row-turno[data-turno-key="' + key + '"]');
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
      var tr = e.target.closest("tr.row-turno");
      if (!tr || !body.contains(tr)) return;
      var key = tr.getAttribute("data-turno-key");
      if (!key) return;
      var hide = !collapsed[key];
      if (hide) collapsed[key] = 1;
      else delete collapsed[key];
      applyTurnoCollapse(body, key, hide);
    });
    body.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var tr = e.target.closest("tr.row-turno");
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
    var lots = flatLots(agg.groups);
    var pages = Math.max(1, Math.ceil(lots.length / pageSize) || 1);
    if (page > pages) page = pages;
    if (page < 1) page = 1;
    if (!lots.length) {
      body.innerHTML = '<tr class="empty"><td colspan="10">Sin datos para resumir. Revise los filtros de Registros.</td></tr>';
      if (count) count.innerHTML = "<strong>0</strong><span>lotes</span>";
      paintPager(pager, 1);
      return;
    }
    var from = (page - 1) * pageSize;
    var slice = lots.slice(from, from + pageSize);
    var html = "";
    var lastCampo = "";
    var lastTurno = "";
    slice.forEach(function (item) {
      var turnoKey = item.campo + "|" + item.turno;
      if (item.campo !== lastCampo) {
        var group = null;
        var i;
        for (i = 0; i < agg.groups.length; i += 1) {
          if (agg.groups[i].name === item.campo) { group = agg.groups[i]; break; }
        }
        if (group) html += rowHtml(group.name, group.totals, "campo", false);
        lastCampo = item.campo;
        lastTurno = "";
      }
      if (String(item.turno) !== String(lastTurno)) {
        html += rowHtml("Turno " + item.turno, item.turnTotals, "turno", false, { turnoKey: turnoKey });
        lastTurno = item.turno;
      }
      html += rowHtml(item.lot.name, item.lot.vals, "lote", false, { turnoKey: turnoKey });
    });
    var grand = zeros();
    agg.groups.forEach(function (g) {
      STAGES.forEach(function (st) { grand[st.key] += g.totals[st.key]; });
    });
    html += rowHtml("Total", grand, "total", false);
    body.innerHTML = html;
    var hasta = Math.min(from + slice.length, lots.length);
    if (count) {
      count.innerHTML = "<strong>" + (from + 1) + "-" + hasta + " de " + lots.length + "</strong><span>lotes · " + fmt(sumVals(grand)) + " kg</span>";
    }
    if (pager) pager.setAttribute("data-pages", String(pages));
    paintPager(pager, pages);
  }

  QBE.summary = { render: render, stages: STAGES };
})(typeof window !== "undefined" ? window : globalThis);
