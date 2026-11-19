/* Tabla detallada de proyecciones + paginación + export CSV/XLS. */
(function (root) {
  var QBE = root.QBE || (root.QBE = {});
  var state = { key: "Fecha", dir: -1, page: 1, size: (QBE.config && QBE.config.pageSize) || 10 };

  function cols() {
    return (QBE.config && QBE.config.columns) || [];
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
  function render(rows, opts) {
    opts = opts || {};
    var columns = cols();
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
    if (head) {
      head.innerHTML = columns.map(function (c) {
        var mark = state.key === c ? (state.dir > 0 ? " ▴" : " ▾") : "";
        return '<th data-key="' + esc(c) + '" class="' + (isNumCol(c) ? "num" : "") + '">' + esc(c) + mark + "</th>";
      }).join("");
    }
    if (body) {
      if (!pageRows.length) {
        body.innerHTML = '<tr class="empty"><td colspan="' + columns.length + '">No hay registros para los filtros seleccionados.</td></tr>';
      } else {
        var html = "";
        var i, j, r, c, v;
        for (i = 0; i < pageRows.length; i += 1) {
          r = pageRows[i];
          html += "<tr>";
          for (j = 0; j < columns.length; j += 1) {
            c = columns[j];
            v = r[c];
            html += '<td class="' + (isNumCol(c) ? "num" : "") + (c === "Evaluador" ? " col-evaluador" : "") + heatClass(v, colores && isNumCol(c)) + '">' + esc(v === "" || v == null ? "—" : v) + "</td>";
          }
          html += "</tr>";
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
  function csvEscape(v) {
    var s = String(v == null ? "" : v);
    if (/[",\n;]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function exportCsv() {
    var rows = state._rows || [];
    var columns = cols();
    var lines = [columns.join(";")];
    rows.forEach(function (r) {
      lines.push(columns.map(function (c) { return csvEscape(r[c]); }).join(";"));
    });
    var blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "proyecciones-qberries.csv";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
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
        if (!th || !th.getAttribute("data-key")) return;
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
    var csv = document.getElementById("btn-csv");
    var xls = document.getElementById("btn-xls");
    if (csv && !csv._bound) { csv._bound = true; csv.addEventListener("click", exportCsv); }
    if (xls && !xls._bound) { xls._bound = true; xls.addEventListener("click", exportXls); }
  }
  function resetPage() { state.page = 1; }

  QBE.table = { render: render, bind: bind, resetPage: resetPage, state: state };
})(typeof window !== "undefined" ? window : globalThis);
