/* Tabla detallada de proyecciones + paginación + export Excel. */
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
  var STICKY_COLS = {
    Lote: "sticky-col sticky-c1",
    Fecha: "sticky-col sticky-c2",
    DNI: "sticky-col sticky-c3",
    Nombre: "sticky-col sticky-c4",
    "N° Muestra": "sticky-col sticky-c5",
  };
  function stickyCls(name) {
    return STICKY_COLS[name] || "";
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
  function icoTrash() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5.8A1.8 1.8 0 0 1 11.8 4h.4A1.8 1.8 0 0 1 14 5.8V7m-5.5 3v7m3.5-7v7m3.5-7v7M7.5 7l.6 12.2A1.8 1.8 0 0 0 9.9 21h4.2a1.8 1.8 0 0 0 1.8-1.8L16.5 7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
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
  function rawPhoto(row) {
    return String((row && (row["Foto cabecera"] || row.Anexo || row.anexo || row.foto || row.Foto)) || "").trim();
  }
  function driveId(s) {
    var m = String(s || "").match(/\/(?:file\/d|d)\/([a-zA-Z0-9_-]+)/) ||
      String(s || "").match(/[?&]id=([a-zA-Z0-9_-]+)/);
    return m ? m[1] : "";
  }
  function photoUrls(row) {
    var s = rawPhoto(row);
    if (!s) return { thumb: "", full: "", open: "" };
    if (/^data:image\//i.test(s)) return { thumb: s, full: s, open: s };
    if (/^\/\//.test(s)) s = "https:" + s;
    var id = driveId(s);
    if (id) {
      return {
        thumb: "https://drive.google.com/thumbnail?id=" + id + "&sz=w800",
        full: "https://drive.google.com/thumbnail?id=" + id + "&sz=w2000",
        open: "https://drive.google.com/uc?export=view&id=" + id,
      };
    }
    if (/^https?:\/\//i.test(s)) return { thumb: s, full: s, open: s };
    return { thumb: "", full: "", open: "" };
  }
  function icoExpand() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function closeLightbox() {
    var box = document.getElementById("photo-lightbox");
    if (box) box.hidden = true;
  }
  function openLightbox(url, caption) {
    var box = document.getElementById("photo-lightbox");
    var img = document.getElementById("photo-lightbox-img");
    var cap = document.getElementById("photo-lightbox-cap");
    if (!box || !img || !url) return;
    img.src = url;
    img.alt = caption || "Foto completa";
    if (cap) cap.textContent = caption || "";
    box.hidden = false;
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
    var foto = photoUrls(row);
    var html = '<div class="detail-top">';
    html += '<figure class="detail-photo' + (foto.thumb ? "" : " is-empty") + '">';
    if (foto.thumb) {
      html += '<img src="' + esc(foto.thumb) + '" alt="Foto cabecera" loading="lazy" referrerpolicy="no-referrer" data-full="' + esc(foto.full || foto.thumb) + '" />';
      html += '<button type="button" class="detail-photo-expand" data-act="photo-full" title="Ver completa" aria-label="Ver foto completa">' +
        icoExpand() + "</button>";
    } else {
      html += '<span class="detail-photo-empty">Sin foto</span>';
    }
    html += "</figure>";
    html += '<div class="detail-top-main">';
    html += '<div class="detail-trio" role="group" aria-label="Ubicación de campo">';
    [
      { key: "Módulo", val: row.Modulo },
      { key: "Turno", val: row.Turno },
      { key: "Lote", val: row.Lote },
    ].forEach(function (item) {
      html += '<div class="detail-trio-item"><span class="detail-label">' + esc(item.key) + "</span>" +
        '<strong class="detail-value">' + esc(item.val === "" || item.val == null ? "—" : item.val) + "</strong></div>";
    });
    html += "</div>";
    html += '<div class="detail-grid detail-grid-compact">';
    detailFields().forEach(function (key) {
      if (key === "Observación") return;
      var val = row[key];
      var empty = val === "" || val == null;
      html += '<div class="detail-item"><span class="detail-label">' + esc(key) + "</span>" +
        '<strong class="detail-value">' + esc(empty ? "—" : val) + "</strong></div>";
    });
    html += "</div></div></div>";
    var obs = row["Observación"];
    html += '<div class="detail-item detail-item-wide detail-obs"><span class="detail-label">Observación</span>' +
      '<strong class="detail-value">' + esc(obs === "" || obs == null ? "—" : obs) + "</strong></div>";
    var fen = ["N° Muestra", "N° Ramas", "Yemas Cerradas", "Yema Abierta", "Yemas Muertas",
      "Botón Floral", "Flor", "Cuaja", "E1 (Verde)", "E2 (Rosado)", "E3 (Guinda)", "E4 (50%-70%)", "E5 (Maduro)"];
    html += '<div class="detail-fen"><h3>Conteo fenológico</h3><div class="detail-fen-grid">';
    fen.forEach(function (key) {
      html += '<div class="detail-fen-item"><span>' + esc(key) + "</span><strong>" + esc(row[key] == null || row[key] === "" ? "0" : row[key]) + "</strong></div>";
    });
    html += "</div></div>";
    body.innerHTML = html;
    var fig = body.querySelector(".detail-photo");
    var img = fig && fig.querySelector("img");
    if (img) {
      img.addEventListener("error", function () {
        if (foto.open && img.src !== foto.open) {
          img.src = foto.open;
          return;
        }
        if (!fig) return;
        fig.classList.add("is-empty");
        fig.innerHTML = '<span class="detail-photo-empty">Sin foto</span>';
      });
    }
    var expand = body.querySelector("[data-act='photo-full']");
    if (expand) {
      expand.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        openLightbox(foto.full || foto.open || foto.thumb, row.Lote || "Foto cabecera");
      });
    }
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
        if (c === "Tipo") cls.push("col-tipo");
        if (stickyCls(c)) cls.push(stickyCls(c));
        return '<th data-key="' + esc(c) + '" class="' + cls.join(" ") + '">' + esc(c) + mark + "</th>";
      }).join("") + '<th class="col-acciones" data-no-sort>Acciones</th>';
    }
    if (body) {
      if (!pageRows.length) {
        body.innerHTML = '<tr class="empty"><td colspan="' + colSpan + '">No hay registros para los filtros seleccionados.</td></tr>';
      } else {
        var html = "";
        var i, j, r, c, v, cellCls, abs, stick;
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
            if (c === "Tipo") cellCls.push("col-tipo");
            stick = stickyCls(c);
            if (stick) cellCls.push(stick);
            html += '<td class="' + cellCls.join(" ") + heatClass(v, colores && isNumCol(c)) + '">' + esc(v === "" || v == null ? "—" : v) + "</td>";
          }
          html += '<td class="col-acciones"><div class="act-row act-row-reg">' +
            '<button type="button" class="detail-btn" data-act="detail" data-row="' + abs + '" title="Ver detalles" aria-label="Ver detalles">' +
            icoDetail() + "<span>Detalles</span></button>" +
            '<button type="button" class="act-btn act-del" data-act="delete" data-row="' + abs + '" title="Eliminar muestra" aria-label="Eliminar muestra">' +
            icoTrash() + "<span>Eliminar</span></button>" +
            "</div></td></tr>";
        }
        body.innerHTML = html;
      }
    }
    if (count) {
      var hasta = Math.min(from + pageRows.length, sorted.length);
      if (!sorted.length) {
        count.innerHTML = "<strong>0</strong> <span>registros</span>";
      } else {
        count.innerHTML = "<strong>" + (from + 1) + "-" + hasta + " de " + sorted.length.toLocaleString("es-PE") + "</strong> <span>registros</span>";
      }
    }
    paintPager(pager, pages);
    state._rows = sorted;
    state._pages = pages;
  }
  var FILL_META = ["Lote", "Fecha", "DNI", "Nombre", "Tipo", "Modulo", "Turno", "Lotes", "Semana", "Etapa", "Variedad", "Area", "Campaña"];
  function cellEmpty(v) {
    return v == null || v === "" || v === "-";
  }
  function exportHora(v) {
    var s = String(v == null ? "" : v).trim();
    if (!s || s === "-") return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
    var tm = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!tm) return "";
    var hh = tm[1].length < 2 ? "0" + tm[1] : tm[1];
    var ss = tm[3] != null ? tm[3] : "00";
    return hh + ":" + tm[2] + ":" + ss;
  }
  function exportVal(c, r, carry) {
    var v;
    if (c === "Anexo") {
      v = r.Anexo || r["Foto cabecera"] || "";
      if (cellEmpty(v)) return "";
      return v;
    }
    if (c === "Hora subida") {
      return exportHora(r["Hora subida"]);
    }
    if (c === "Observación") {
      v = r["Observación"];
      return cellEmpty(v) ? "" : v;
    }
    if (c === "Tipo") {
      v = r.Tipo;
      if (cellEmpty(v) && carry && !cellEmpty(carry.Tipo)) v = carry.Tipo;
      return cellEmpty(v) ? "" : v;
    }
    v = r[c];
    if (cellEmpty(v) && carry && !cellEmpty(carry[c])) v = carry[c];
    if (cellEmpty(v)) return "";
    return v;
  }
  function exportXls() {
    var rows = state._rows || [];
    var columns = cols();
    if (typeof XLSX === "undefined") return;
    var aoa = [columns];
    var carry = {};
    var prevKey = "";
    rows.forEach(function (r) {
      var key = String(r.Fecha || "") + "|" + String(r.DNI || "") + "|" + String(r.Lote || carry.Lote || "");
      if (prevKey && key !== prevKey && r.Lote) {
        carry = {};
      }
      prevKey = key;
      FILL_META.forEach(function (k) {
        var val = r[k];
        if (!cellEmpty(val)) carry[k] = val;
      });
      aoa.push(columns.map(function (c) {
        return exportVal(c, r, carry);
      }));
    });
    if (QBE.xls && QBE.xls.download) {
      QBE.xls.download(aoa, "Proyecciones", "proyecciones-qberries.xlsx", {
        leftCols: [0, 1, 2, 3],
        zebra: true,
        boldFirstCol: true,
        colWidths: { 0: 14, 1: 12, 2: 12, 3: 28, 18: 14 },
      });
    } else {
      var wb = XLSX.utils.book_new();
      var ws = XLSX.utils.aoa_to_sheet(aoa);
      XLSX.utils.book_append_sheet(wb, ws, "Proyecciones");
      XLSX.writeFile(wb, "proyecciones-qberries.xlsx");
    }
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
  function closeAsk() {
    var box = document.getElementById("confirm");
    if (box) box.hidden = true;
  }
  function askDelete(idx) {
    var row = (state._rows || [])[idx];
    var box = document.getElementById("confirm");
    var text = document.getElementById("confirm-text");
    var yes = document.getElementById("confirm-yes");
    var no = document.getElementById("confirm-no");
    if (!row || !box || !yes) return;
    var nom = row.Nombre || "sin nombre";
    var mues = row["N° Muestra"] != null && row["N° Muestra"] !== "" ? row["N° Muestra"] : "—";
    text.textContent = "¿Eliminar N° Muestra " + mues + " de " + nom +
      (row.Lote ? " · " + row.Lote : "") + "? Solo esa fila.";
    yes.textContent = "Eliminar";
    yes.className = "confirm-yes off";
    yes.onclick = function () { closeAsk(); deleteRow(idx); };
    no.onclick = closeAsk;
    box.hidden = false;
    yes.focus();
  }
  function deleteRow(idx) {
    var row = (state._rows || [])[idx];
    if (!row) return;
    var nombre = String(row.Nombre || "").trim();
    var nMuestra = Number(row["N° Muestra"]);
    if (!nombre || !isFinite(nMuestra) || nMuestra < 1) {
      if (QBE.shell && QBE.shell.toast) QBE.shell.toast("Falta Nombre o N° Muestra", true);
      return;
    }
    if (!QBE.api || !QBE.api.deleteRegistro) {
      if (QBE.shell && QBE.shell.toast) QBE.shell.toast("API sin eliminar. Redeploy Code.gs", true);
      return;
    }
    if (QBE.app && QBE.app.setLoading) QBE.app.setLoading(true, "Eliminando muestra…");
    else {
      var load = document.getElementById("loading");
      var loadText = document.getElementById("loading-text");
      if (loadText) loadText.textContent = "Eliminando muestra…";
      if (load) load.hidden = false;
    }
    QBE.api.deleteRegistro({
      nombre: nombre,
      nMuestra: nMuestra,
      lote: row.Lote || "",
      fecha: row.Fecha || "",
      dni: String(row.DNI || "").replace(/\D/g, ""),
      row: Number(row._row) || 0,
      _row: Number(row._row) || 0,
    }).then(function () {
      if (QBE.audit) QBE.audit.add("Eliminar registro", "Muestra " + nMuestra + " · " + nombre);
      if (QBE.shell && QBE.shell.toast) QBE.shell.toast("Muestra " + nMuestra + " eliminada");
      if (QBE.app && QBE.app.reload) QBE.app.reload();
      else if (QBE.app && QBE.app.refresh) QBE.app.refresh();
    }).catch(function (err) {
      if (QBE.shell && QBE.shell.toast) QBE.shell.toast((err && err.message) || "No se pudo eliminar", true);
    }).finally(function () {
      var load = document.getElementById("loading");
      if (load) load.hidden = true;
    });
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
        var btn = e.target.closest("button[data-act]");
        if (!btn || !body.contains(btn)) return;
        var idx = Number(btn.getAttribute("data-row"));
        var act = btn.getAttribute("data-act");
        if (act === "delete") {
          askDelete(idx);
          return;
        }
        if (act === "detail") {
          var row = (state._rows || [])[idx];
          if (row) openDetail(row);
        }
      });
    }
    var askBox = document.getElementById("confirm");
    if (askBox && !askBox._regBound) {
      askBox._regBound = true;
      askBox.addEventListener("click", function (e) {
        if (e.target === askBox) closeAsk();
      });
    }
    var detail = document.getElementById("detail-modal");
    if (detail && !detail._bound) {
      detail._bound = true;
      detail.addEventListener("click", function (e) {
        if (e.target === detail || e.target.closest("[data-detail-close]")) closeDetail();
      });
    }
    var light = document.getElementById("photo-lightbox");
    if (light && !light._bound) {
      light._bound = true;
      light.addEventListener("click", function (e) {
        if (e.target === light || e.target.closest("[data-light-close]")) closeLightbox();
      });
    }
    if (!bind._esc) {
      bind._esc = true;
      document.addEventListener("keydown", function (e) {
        if (e.key !== "Escape") return;
        var lightBox = document.getElementById("photo-lightbox");
        if (lightBox && !lightBox.hidden) { closeLightbox(); return; }
        closeDetail();
      });
    }
    var xls = document.getElementById("btn-xls");
    if (xls && !xls._bound) { xls._bound = true; xls.addEventListener("click", exportXls); }
  }
  function resetPage() { state.page = 1; }

  QBE.table = { render: render, bind: bind, resetPage: resetPage, state: state, openDetail: openDetail };
})(typeof window !== "undefined" ? window : globalThis);
