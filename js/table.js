/* Tabla detallada de proyecciones + paginación + export CSV/XLS. */
(function (root) {
  var QBE = root.QBE || (root.QBE = {});
  var state = { key: "Fecha", dir: -1, page: 1, size: (QBE.config && QBE.config.pageSize) || 10 };

  function cols() {
    return (QBE.config && QBE.config.columns) || [];
  }
  function hideMap() {
    var map = {};
    ((QBE.config && QBE.config.tableHide) || []).forEach(function (c) { map[c] = 1; });
    return map;
  }
  function tableCols() {
    var hide = hideMap();
    return cols().filter(function (c) { return !hide[c]; });
  }
  function detailFields() {
    return (QBE.config && QBE.config.detailFields) || [];
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function isNumCol(name) {
    return /^(N°|Yema|Yemas|Botón|Flor|Cuaja|E[1-5]|Turno|Lotes|Semana|Area)/i.test(name) || name === "Flor" || name === "Cuaja";
  }
  function heatClass(v, on) {
    if (!on) return "";
    var n = Number(v);
    if (!isFinite(n) || n <= 0) return "";
    if (n < 10) return " heat-1";
    if (n < 50) return " heat-2";
    if (n < 200) return " heat-3";
    return " heat-4";
  }
  function icoDetail() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 11.2V16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="12" cy="8.2" r="1.1" fill="currentColor"/></svg>';
  }
  function paintPager(pager, pages) {
    if (!pager) return;
    var html = '<button type="button" data-pg="first" ' + (state.page <= 1 ? "disabled" : "") + " title=\"Primera\">«</button>" +
      '<button type="button" data-pg="-1" ' + (state.page <= 1 ? "disabled" : "") + " title=\"Anterior\">‹</button>";
    var start = Math.max(1, state.page - 2);
    var end = Math.min(pages, start + 4);
    start = Math.max(1, end - 4);
    var p;
    for (p = start; p <= end; p += 1) {
      html += '<button type="button" class="pg-num' + (p === state.page ? " on" : "") + '" data-goto="' + p + '">' + p + "</button>";
    }
    html += '<button type="button" data-pg="1" ' + (state.page >= pages ? "disabled" : "") + " title=\"Siguiente\">›</button>" +
      '<button type="button" data-pg="last" ' + (state.page >= pages ? "disabled" : "") + " title=\"Última\">»</button>" +
      "<span class=\"pg-info\">Página " + state.page + " de " + pages + "</span>";
    pager.innerHTML = html;
  }
  function closeDetail() {
    var box = document.getElementById("detail-modal");
    if (box) box.hidden = true;
  }
  function openDetail(row) {
    var box = document.getElementById("detail-modal");
    var body = document.getElementById("detail-body");
    var title = document.getElementById("detail-title");
    var sub = document.getElementById("detail-sub");
    if (!box || !body || !row) return;
    if (title) title.textContent = row.Lote || "Detalle de registro";
    if (sub) {
      sub.textContent = [row.Fecha, row.Nombre, row.DNI ? "DNI " + row.DNI : ""]
        .filter(Boolean)
        .join(" · ");
    }
    var fields = detailFields();
    var html = '<div class="detail-grid">';
    fields.forEach(function (key) {
      var val = row[key];
      var empty = val === "" || val == null;
      var cls = key === "Observación" ? "detail-item detail-item-wide" : "detail-item";
      html += '<div class="' + cls + '"><span class="detail-label">' + esc(key) + '</span>' +
        '<strong class="detail-value">' + esc(empty ? "—" : val) + "</strong></div>";
    });
    html += "</div>";
    var fen = ["N° Muestra", "N° Ramas", "Yema Productiva", "Yema Abierta", "Yemas Cerradas", "Yemas Muertas",
      "Botón Floral", "Flor", "Cuaja", "E1 (Verde)", "E2 (Rosado)", "E3 (Guinda)", "E4 (50%-70%)", "E5 (Maduro)"];
    html += '<div class="detail-fen"><h3>Conteo fenológico</h3><div class="detail-fen-grid">';
    fen.forEach(function (key) {
      html += '<div class="detail-fen-item"><span>' + esc(key) + "</span><strong>" + esc(row[key] == null || row[key] === "" ? "0" : row[key]) + "</strong></div>";
    });
    html += "</div></div>";
    body.innerHTML = html;
    box.hidden = false;
  }
  function render(rows, opts) {
    opts = opts || {};
    var columns = tableCols();
    var sorted = QBE.data.sortRecords(rows || [], state.key, state.dir);
    var size = state.size;
    var pages = Math.max(1, Math.ceil(sorted.length / size) || 1);
    if (state.page > pages) state.page = pages;
    if (state.page < 1) state.page = 1;
    var from = (state.page - 1) * size;
    var pageRows = sorted.slice(from, from + size);
    var head = document.getElementById("table-head");
    var body = document.getElementById("table-body");
    var pager = document.getElementById("table-pager");
    var count = document.getElementById("table-count");
    var colores = !!opts.colores;
    var colSpan = columns.length + 1;
    if (head) {
      head.innerHTML = columns.map(function (c) {
        var mark = state.key === c
          ? '<span class="sort-mark">' + (state.dir > 0 ? "▴" : "▾") + "</span>"
          : "";
        var cls = [];
        if (isNumCol(c)) cls.push("num");
        if (c === "Nombre") cls.push("col-nombre");
        if (c === "Fecha") cls.push("col-fecha");
        if (c === "Etapa") cls.push("col-etapa");
        return '<th data-key="' + esc(c) + '" class="' + cls.join(" ") + '">' + esc(c) + mark + "</th>";
      }).join("") + '<th class="col-acciones" data-no-sort>Acciones</th>';
    }
    if (body) {
      if (!pageRows.length) {
        body.innerHTML = '<tr class="empty"><td colspan="' + colSpan + '">No hay registros para los filtros seleccionados.</td></tr>';
      } else {
        var html = "";
        var i, j, r, c, v, cellCls, abs;
        for (i = 0; i < pageRows.length; i += 1) {
          r = pageRows[i];
          abs = from + i;
          html += '<tr data-row="' + abs + '">';
          for (j = 0; j < columns.length; j += 1) {
            c = columns[j];
            v = r[c];
            cellCls = [];
            if (isNumCol(c)) cellCls.push("num");
            if (c === "Nombre" || c === "Evaluador") cellCls.push("col-nombre");
            if (c === "Fecha") cellCls.push("col-fecha");
            if (c === "Etapa") cellCls.push("col-etapa");
            html += '<td class="' + cellCls.join(" ") + heatClass(v, colores && isNumCol(c)) + '">' + esc(v === "" || v == null ? "—" : v) + "</td>";
          }
          html += '<td class="col-acciones"><button type="button" class="detail-btn" data-act="detail" data-row="' + abs + '" title="Ver detalles" aria-label="Ver detalles">' +
            icoDetail() + "<span>Detalles</span></button></td></tr>";
        }
        body.innerHTML = html;
      }
    }
    if (count) {
      var hasta = Math.min(from + pageRows.length, sorted.length);
      if (!sorted.length) {
        count.innerHTML = '<strong>0</strong><span>registros</span>';
      } else {
        count.innerHTML = "<strong>" + (from + 1) + "-" + hasta + " de " + sorted.length.toLocaleString("es-PE") + "</strong><span>registros</span>";
      }
    }
    paintPager(pager, pages);
    state._rows = sorted;
    state._pages = pages;
  }
  function exportCsv() {
    var rows = state._rows || [];
    var columns = cols();
    var aoa = [columns].concat(rows.map(function (r) {
      return columns.map(function (c) { return r[c] == null ? "" : r[c]; });
    }));
    if (QBE.perf && QBE.perf.downloadCsv) QBE.perf.downloadCsv("proyecciones-qberries.csv", aoa);
    if (QBE.audit) QBE.audit.add("Exportar CSV", rows.length + " registros");
  }
  function exportXls() {
    var rows = state._rows || [];
    var columns = cols();
    if (typeof XLSX === "undefined") return exportCsv();
    var aoa = [columns];
    rows.forEach(function (r) {
      aoa.push(columns.map(function (c) { return r[c]; }));
    });
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, "Proyecciones");
    XLSX.writeFile(wb, "proyecciones-qberries.xlsx");
    if (QBE.audit) QBE.audit.add("Exportar Excel", rows.length + " registros");
  }
  function goPage(deltaOrCmd) {
    var pages = state._pages || 1;
    if (deltaOrCmd === "first") state.page = 1;
    else if (deltaOrCmd === "last") state.page = pages;
    else state.page += Number(deltaOrCmd) || 0;
    if (state.page < 1) state.page = 1;
    if (state.page > pages) state.page = pages;
    if (QBE.app && QBE.app.refreshTable) QBE.app.refreshTable();
  }
  function bind() {
    var head = document.getElementById("table-head");
    if (head && !head._bound) {
      head._bound = true;
      head.addEventListener("click", function (e) {
        var th = e.target.closest("th");
        if (!th || !th.getAttribute("data-key") || th.hasAttribute("data-no-sort")) return;
        var key = th.getAttribute("data-key");
        if (state.key === key) state.dir *= -1;
        else { state.key = key; state.dir = 1; }
        state.page = 1;
        if (QBE.app && QBE.app.refreshTable) QBE.app.refreshTable();
      });
    }
    var pager = document.getElementById("table-pager");
    if (pager && !pager._bound) {
      pager._bound = true;
      pager.addEventListener("click", function (e) {
        var btn = e.target.closest("button");
        if (!btn || btn.disabled) return;
        if (btn.getAttribute("data-goto")) {
          state.page = Number(btn.getAttribute("data-goto")) || 1;
          if (QBE.app && QBE.app.refreshTable) QBE.app.refreshTable();
          return;
        }
        goPage(btn.getAttribute("data-pg"));
      });
    }
    var body = document.getElementById("table-body");
    if (body && !body._detailBound) {
      body._detailBound = true;
      body.addEventListener("click", function (e) {
        var btn = e.target.closest("button[data-act='detail']");
        if (!btn) return;
        var idx = Number(btn.getAttribute("data-row"));
        var row = (state._rows || [])[idx];
        if (row) openDetail(row);
      });
    }
    var detail = document.getElementById("detail-modal");
    if (detail && !detail._bound) {
      detail._bound = true;
      detail.addEventListener("click", function (e) {
        if (e.target === detail || e.target.closest("[data-detail-close]")) closeDetail();
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closeDetail();
      });
    }
    var csv = document.getElementById("btn-csv");
    var xls = document.getElementById("btn-xls");
    if (csv && !csv._bound) { csv._bound = true; csv.addEventListener("click", exportCsv); }
    if (xls && !xls._bound) { xls._bound = true; xls.addEventListener("click", exportXls); }
  }
  function resetPage() { state.page = 1; }

  QBE.table = { render: render, bind: bind, resetPage: resetPage, state: state, openDetail: openDetail };
})(typeof window !== "undefined" ? window : globalThis);
