/* Registro de movimientos del sistema. Se guarda solo en este equipo. */
(function (root) {
  var QBE = root.QBE || (root.QBE = {});
  var KEY = "qbe.proy.audit";
  var MAX = 400;
  var SIZE = 15;
  var page = 1;

  function userName() {
    var s = QBE.auth && QBE.auth.session && QBE.auth.session();
    return (s && (s.nombre || s.usuario)) || "Administrador";
  }
  function nowLabel() {
    try {
      return new Date().toLocaleString("es-PE", {
        timeZone: (QBE.config && QBE.config.tz) || "America/Lima",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch (err) {
      return new Date().toLocaleString("es-PE");
    }
  }
  function load() {
    var rows = QBE.perf.lsGet(KEY);
    return Array.isArray(rows) ? rows : [];
  }
  function save(rows) {
    QBE.perf.lsSet(KEY, rows.slice(0, MAX));
  }
  function add(accion, detalle) {
    var rows = load();
    rows.unshift({
      at: Date.now(),
      cuando: nowLabel(),
      usuario: userName(),
      accion: String(accion || "Movimiento"),
      detalle: String(detalle || ""),
    });
    save(rows);
    if (document.getElementById("audit-body")) render();
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function fold(s) {
    return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
  }
  function filtered() {
    var qEl = document.getElementById("q-audit");
    var q = fold(qEl && qEl.value);
    var rows = load();
    if (!q) return rows;
    return rows.filter(function (r) {
      return fold([r.cuando, r.usuario, r.accion, r.detalle].join(" ")).indexOf(q) >= 0;
    });
  }
  function exportRows() {
    var list = filtered();
    if (typeof XLSX === "undefined") return;
    var aoa = [["Fecha y hora", "Usuario", "Acción", "Detalle"]].concat(list.map(function (r) {
      return [r.cuando, r.usuario, r.accion, r.detalle];
    }));
    if (QBE.xls && QBE.xls.download) {
      QBE.xls.download(aoa, "Movimientos", "movimientos-qberries.xlsx", {
        leftCols: [1, 2, 3],
        zebra: true,
        colWidths: { 0: 18, 1: 22, 2: 22, 3: 40 },
      });
    } else {
      var wb = XLSX.utils.book_new();
      var ws = XLSX.utils.aoa_to_sheet(aoa);
      XLSX.utils.book_append_sheet(wb, ws, "Movimientos");
      XLSX.writeFile(wb, "movimientos-qberries.xlsx");
    }
  }
  function render() {
    var body = document.getElementById("audit-body");
    var pager = document.getElementById("audit-pager");
    var count = document.getElementById("audit-count");
    if (!body) return;
    var rows = filtered();
    var pages = Math.max(1, Math.ceil(rows.length / SIZE));
    if (page > pages) page = pages;
    if (page < 1) page = 1;
    var from = (page - 1) * SIZE;
    var slice = rows.slice(from, from + SIZE);
    if (!slice.length) {
      body.innerHTML = '<tr class="empty"><td colspan="4">Todavía no hay movimientos registrados.</td></tr>';
    } else {
      body.innerHTML = slice.map(function (r) {
        return "<tr><td>" + esc(r.cuando) + "</td><td>" + esc(r.usuario) + "</td><td>" + esc(r.accion) + "</td><td>" + esc(r.detalle) + "</td></tr>";
      }).join("");
    }
    if (count) count.textContent = rows.length.toLocaleString("es-PE") + " movimiento" + (rows.length === 1 ? "" : "s");
    if (pager) {
      pager.innerHTML = '<button type="button" data-pg="-1" ' + (page <= 1 ? "disabled" : "") + ">‹</button>" +
        "<span>Página " + page + " de " + pages + "</span>" +
        '<button type="button" data-pg="1" ' + (page >= pages ? "disabled" : "") + ">›</button>";
    }
  }
  function bind() {
    var pager = document.getElementById("audit-pager");
    if (pager && !pager.getAttribute("data-bound")) {
      pager.setAttribute("data-bound", "1");
      pager.addEventListener("click", function (e) {
        var btn = e.target.closest("button");
        if (!btn) return;
        page += Number(btn.getAttribute("data-pg") || 0);
        if (page < 1) page = 1;
        render();
      });
    }
    var q = document.getElementById("q-audit");
    if (q && !q._bound) {
      q._bound = true;
      q.addEventListener("input", function () {
        page = 1;
        render();
      });
    }
    var xls = document.getElementById("btn-audit-xls");
    if (xls && !xls._bound) {
      xls._bound = true;
      xls.addEventListener("click", exportRows);
    }
  }

  QBE.audit = { add: add, render: render, bind: bind, load: load };
})(typeof window !== "undefined" ? window : globalThis);
