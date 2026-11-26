/* Orquesta filtros, tabla y resumen sobre datos de la API GET. */
(function (root) {
  var QBE = root.QBE || (root.QBE = {});
  var pack = { records: [], source: "empty", generatedAt: "" };
  var filtered = [];
  var busy = false;
  var lastFilterKey = "";
  var seenKeys = {};
  var primed = false;
  var notes = [];
  var unseen = 0;
  var pollTimer = 0;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  function setStatus(text, kind) {
    var el = $("src-status");
    if (el) {
      el.textContent = text;
      el.className = "src-status" + (kind ? " " + kind : "");
    }
  }
  function paintCloud(pct, note, done) {
    var card = $("cloud-card");
    var p = $("cloud-pct");
    var n = $("cloud-note");
    var b = $("cloud-bar");
    if (card) card.classList.toggle("is-done", !!done);
    if (p) p.textContent = pct + "%";
    if (n) n.textContent = note;
    if (b) b.style.width = Math.max(0, Math.min(100, pct)) + "%";
  }
  function setLoading(on, text) {
    var el = $("loading");
    if (!el) return;
    el.hidden = !on;
    var t = $("loading-text");
    if (t && text) t.textContent = text;
  }
  function filterLabel() {
    var f = QBE.filters.current();
    var bits = [];
    function one(id, label) {
      var el = $(id);
      if (!el || !el.value || el.value === "*") return;
      bits.push(label + " " + (el.tagName === "SELECT" ? el.options[el.selectedIndex].text : el.value));
    }
    one("f-modulo", "Módulo");
    one("f-evaluador", "Evaluador");
    one("f-etapa", "Etapa");
    one("f-semana", "Semana");
    if (f.desde) bits.push("Desde " + f.desde);
    if (f.hasta) bits.push("Hasta " + f.hasta);
    if (f.q) bits.push('Búsqueda "' + f.q + '"');
    return bits.length ? bits.join(" · ") : "Todos los registros";
  }
  function dedupe(rows) {
    var cols = (QBE.config && QBE.config.columns) || [];
    var seen = {};
    return rows.filter(function (r) {
      var key = cols.map(function (c) { return String(r[c] == null ? "" : r[c]); }).join("|");
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }
  function rowKey(r) {
    var cols = (QBE.config && QBE.config.columns) || [];
    return cols.map(function (c) { return String(r[c] == null ? "" : r[c]); }).join("|");
  }
  function paintNotify() {
    var badge = $("notify-badge");
    var list = $("notify-list");
    if (badge) {
      badge.hidden = unseen < 1;
      badge.textContent = unseen > 9 ? "9+" : String(unseen);
    }
    if (!list) return;
    if (!notes.length) {
      list.innerHTML = '<p class="notify-empty">Sin avisos nuevos</p>';
      return;
    }
    list.innerHTML = notes.map(function (n) {
      return '<div class="notify-item"><strong>' + n.title + "</strong><small>" + n.meta + "</small></div>";
    }).join("");
  }
  function pushNotes(rows) {
    rows.forEach(function (r) {
      var bits = [r.Fecha, r.Nombre, r["Modulo"]].filter(function (v) { return v; });
      notes.unshift({
        title: esc(r.Lote || r.Nombre || "Nueva cartilla"),
        meta: esc(bits.join(" · ") || "Registro de campo"),
      });
    });
    notes = notes.slice(0, 12);
    unseen += rows.length;
    paintNotify();
    if (QBE.shell && QBE.shell.toast) {
      QBE.shell.toast(rows.length === 1 ? "Ingresó 1 registro nuevo" : "Ingresaron " + rows.length + " registros nuevos");
    }
  }
  function bindNotify() {
    var btn = $("notify-btn");
    var menu = $("notify-menu");
    if (!btn || !menu || btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var open = menu.hidden;
      menu.hidden = !open;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        unseen = 0;
        paintNotify();
      }
    });
    document.addEventListener("click", function (ev) {
      if (btn.contains(ev.target) || menu.contains(ev.target)) return;
      menu.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    });
  }
  function usePack(next, source, quiet) {
    var raw = (next && next.records) || [];
    var incoming = dedupe(raw.map(function (r) { return QBE.data.normalize(r); }));
    incoming.reverse();
    incoming.forEach(function (r, i) { r._ord = i; });
    var fresh = [];
    incoming.forEach(function (r) {
      var key = rowKey(r);
      if (!seenKeys[key]) {
        if (primed) fresh.push(r);
        seenKeys[key] = true;
      }
    });
    pack = {
      records: incoming,
      source: source || "api",
      generatedAt: (next && next.generatedAt) || "",
    };
    if (!quiet || fresh.length) {
      QBE.filters.render(QBE.data.optionsFrom(pack.records));
      QBE.table.resetPage();
    }
    refresh({ skipSummary: !!quiet && !fresh.length });
    if (primed && fresh.length) pushNotes(fresh);
    primed = true;
    var n = pack.records.length;
    if (n) setStatus("Planilla · " + n.toLocaleString("es-PE") + " registros", "ok");
    else setStatus("La hoja Proyecciones no tiene filas.", "warn");
  }
  function refresh(opts) {
    opts = opts || {};
    if (busy) return;
    busy = true;
    var t0 = QBE.perf.nowMs();
    try {
      var f = QBE.filters.current();
      filtered = QBE.data.filterRecords(pack.records, f);
      QBE.table.render(filtered, { colores: f.colores });
      if (!opts.skipSummary && QBE.summary) QBE.summary.render(filtered);
      if (QBE.reports && QBE.reports.render) QBE.reports.render(pack.records || []);
      var chip = $("escaneadas-chip");
      if (chip) chip.textContent = "Filtros: " + filterLabel() + ".";
    } finally {
      busy = false;
    }
    var ms = Math.round(QBE.perf.nowMs() - t0);
    var stamp = $("perf-stamp");
    if (stamp) stamp.textContent = filtered.length.toLocaleString("es-PE") + " filas · " + ms + " ms";
  }
  function refreshTable() {
    refresh();
  }
  function onFilter(opts) {
    opts = opts || {};
    var withLoader = opts.apply !== false;
    QBE.table.resetPage();
    if (QBE.summary && QBE.summary.resetPage) QBE.summary.resetPage();
    function run() {
      refresh();
      var key = filterLabel();
      if (key !== lastFilterKey) {
        lastFilterKey = key;
        if (QBE.audit) QBE.audit.add(opts.clear ? "Desfiltrar" : "Filtrar", key);
      }
    }
    if (!withLoader) {
      run();
      return;
    }
    setLoading(true, "Cargando datos…");
    setTimeout(function () {
      try { run(); }
      finally { setLoading(false); }
    }, 180);
  }
  function spinRefresh(on) {
    var btn = $("refresh-btn");
    if (btn) {
      btn.classList.toggle("is-spin", !!on);
      btn.disabled = !!on;
    }
  }
  function loadRemote() {
    if (!QBE.api.url()) {
      usePack({ records: [] }, "api");
      setStatus("Falta la URL de la API.", "err");
      spinRefresh(false);
      return Promise.resolve();
    }
    setLoading(true, "Cargando datos…");
    paintCloud(35, "Analizando data de campo", false);
    var people = QBE.api.evaluadores().then(function (data) {
      var list = (data && data.evaluadores) || [];
      if (QBE.users && QBE.users.setFromApi) QBE.users.setFromApi(list);
      return list.length;
    }).catch(function () { return 0; });
    var rowsPromise = QBE.api.list({}).then(function (data) {
      usePack(data, "api");
      if (QBE.audit) QBE.audit.add("Actualizar API", ((data && data.records) || []).length + " registros");
      return true;
    }).catch(function (err) {
      usePack({ records: [] }, "api");
      setStatus((err && err.message) || "No se pudo leer Proyecciones.", "err");
      return false;
    });
    return Promise.all([people, rowsPromise]).then(function (out) {
      var n = pack.records.length;
      if (out[1]) paintCloud(100, n + " registro" + (n === 1 ? "" : "s") + " de campo", true);
      else paintCloud(100, "No se pudo leer Proyecciones", false);
      if (QBE.shell && QBE.shell.toast) QBE.shell.toast("Evaluadores · " + out[0]);
    }).finally(function () {
      setLoading(false);
      spinRefresh(false);
    });
  }
  function reload() {
    spinRefresh(true);
    loadRemote();
  }
  var pollBusy = false;
  function pollOnce() {
    if (document.hidden || busy || pollBusy || !QBE.api || !QBE.api.url()) return;
    pollBusy = true;
    QBE.api.list({}, { timeoutMs: 12000 }).then(function (data) {
      usePack(data, "api", true);
    }).catch(function () {}).finally(function () {
      pollBusy = false;
    });
  }
  function watchNew() {
    if (pollTimer || !QBE.api || !QBE.api.url()) return;
    pollTimer = setInterval(pollOnce, 8000);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) pollOnce();
    });
    root.addEventListener("focus", pollOnce);
  }
  function boot() {
    QBE.filters.bind(onFilter);
    QBE.table.bind();
    bindNotify();
    if (QBE.audit) QBE.audit.bind();
    if (root.lucide && typeof root.lucide.createIcons === "function") {
      root.lucide.createIcons({ attrs: { "stroke-width": 2.4 } });
    }
    setLoading(false);
    loadRemote();
    watchNew();
  }

  QBE.app = {
    boot: boot,
    refresh: refresh,
    refreshTable: refreshTable,
    onFilter: onFilter,
    reload: reload,
    pack: function () { return pack; },
  };
})(typeof window !== "undefined" ? window : globalThis);
