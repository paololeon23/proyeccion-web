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
  function aggregate(records) {
    var g = grams();
    var byCampo = {};
    (records || []).forEach(function (r) {
      var campo = campoOf(r);
      var lote = String(r.Lote || "Sin lote").trim() || "Sin lote";
      if (!byCampo[campo]) byCampo[campo] = { name: campo, lots: {}, totals: zeros(), area: 0 };
      var group = byCampo[campo];
      if (!group.lots[lote]) group.lots[lote] = { name: lote, vals: zeros(), area: 0 };
      var lot = group.lots[lote];
      STAGES.forEach(function (st) {
        var kg = toKg(r[st.key], g);
        lot.vals[st.key] += kg;
        group.totals[st.key] += kg;
      });
      var area = Number(r.Area) || 0;
      if (area > lot.area) lot.area = area;
      if (area > group.area) group.area = area;
    });
    return { g: g, groups: Object.keys(byCampo).sort().map(function (k) { return byCampo[k]; }) };
  }
  function rowHtml(label, vals, kind, on) {
    var total = sumVals(vals);
    var cells = STAGES.map(function (st) {
      var n = vals[st.key] || 0;
      return '<td class="num' + heat(n, on) + '">' + fmt(n) + "</td>";
    }).join("");
    var cls = kind === "campo" ? "row-campo" : (kind === "total" ? "row-total" : "row-lote");
    return "<tr class=\"" + cls + "\"><td>" + esc(label) + "</td>" + cells +
      '<td class="num">' + fmt(total) + "</td></tr>";
  }
  var page = 1;
  var pageSize = 8;
  var pagerBound = false;

  function flatLots(groups) {
    var rows = [];
    groups.forEach(function (g) {
      Object.keys(g.lots).sort().forEach(function (lk) {
        rows.push({ campo: g.name, lot: g.lots[lk] });
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
  function render(records) {
    var head = document.getElementById("kg-head");
    var body = document.getElementById("kg-body");
    var count = document.getElementById("kg-count");
    var pager = document.getElementById("kg-pager");
    bindPager();
    var agg = aggregate(records);
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
    slice.forEach(function (item) {
      if (item.campo !== lastCampo) {
        var group = null;
        var i;
        for (i = 0; i < agg.groups.length; i += 1) {
          if (agg.groups[i].name === item.campo) { group = agg.groups[i]; break; }
        }
        if (group) html += rowHtml(group.name, group.totals, "campo", false);
        lastCampo = item.campo;
      }
      html += rowHtml(item.lot.name, item.lot.vals, "lote", false);
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
