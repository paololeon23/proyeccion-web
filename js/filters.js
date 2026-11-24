/* Filtros de proyecciones: campaña, fechas, módulo, evaluador, etapa, semana. */
(function (root) {
  var QBE = root.QBE || (root.QBE = {});

  function val(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || "").trim() : "";
  }
  function fillSelect(id, items, placeholder) {
    var el = document.getElementById(id);
    if (!el) return;
    var prev = el.value;
    var html = '<option value="*">' + placeholder + "</option>";
    (items || []).forEach(function (it) {
      html += '<option value="' + String(it).replace(/"/g, "&quot;") + '">' + String(it) + "</option>";
    });
    el.innerHTML = html;
    if (prev && Array.prototype.some.call(el.options, function (o) { return o.value === prev; })) {
      el.value = prev;
    } else {
      el.value = "*";
    }
    syncPick(el);
  }
  function syncPick(el) {
    var field = el.closest ? el.closest(".field") : null;
    if (!field || field.classList.contains("field-action")) return;
    var pick = field.querySelector(".pick");
    if (!pick) {
      pick = document.createElement("div");
      pick.className = "pick";
      pick.innerHTML = '<button type="button" class="pick-btn" aria-haspopup="listbox" aria-expanded="false"></button><div class="pick-menu" hidden role="listbox"></div>';
      el.classList.add("is-native");
      el.insertAdjacentElement("afterend", pick);
      var btn = pick.querySelector(".pick-btn");
      var menu = pick.querySelector(".pick-menu");
      btn.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var willOpen = menu.hidden;
        document.querySelectorAll(".pick-menu, .cal-pop").forEach(function (m) { m.hidden = true; });
        document.querySelectorAll(".pick-btn, .cal-btn").forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
        menu.hidden = !willOpen;
        btn.setAttribute("aria-expanded", menu.hidden ? "false" : "true");
      });
      menu.addEventListener("click", function (ev) {
        var item = ev.target.closest("button[data-value]");
        if (!item) return;
        el.value = item.getAttribute("data-value");
        menu.hidden = true;
        btn.setAttribute("aria-expanded", "false");
        syncPick(el);
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
      if (!syncPick.bound) {
        syncPick.bound = true;
        document.addEventListener("click", function () {
          document.querySelectorAll(".pick-menu").forEach(function (m) { m.hidden = true; });
          document.querySelectorAll(".pick-btn").forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
        });
      }
    }
    var currentOpt = el.options[el.selectedIndex];
    pick.querySelector(".pick-btn").textContent = currentOpt ? currentOpt.text : "";
    var menuEl = pick.querySelector(".pick-menu");
    var html = "";
    Array.prototype.forEach.call(el.options, function (o) {
      html += '<button type="button" role="option" data-value="' + String(o.value).replace(/"/g, "&quot;") + '"' +
        (o.value === el.value ? ' class="on"' : "") + ">" + o.text + "</button>";
    });
    menuEl.innerHTML = html;
  }
  function searchValue() {
    var a = document.getElementById("q-detalle");
    var b = document.getElementById("q");
    return String((a && a.value) || (b && b.value) || "").trim();
  }
  function current() {
    return {
      desde: val("f-desde"),
      hasta: val("f-hasta"),
      modulo: val("f-modulo") || "*",
      evaluador: val("f-evaluador") || "*",
      etapa: val("f-etapa") || "*",
      semana: val("f-semana") || "*",
      q: searchValue(),
      colores: !!(document.getElementById("f-colores") && document.getElementById("f-colores").checked),
    };
  }
  function render(options) {
    fillSelect("f-modulo", options.modulos, "Todos");
    fillSelect("f-evaluador", options.evaluadores, "Todos");
    fillSelect("f-etapa", options.etapas, "Todas");
    fillSelect("f-semana", options.semanas, "Todas");
  }
  var MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  function pad(n) { return n < 10 ? "0" + n : String(n); }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function formatES(value) {
    var p = String(value || "").split("-");
    return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : "";
  }
  function closePops() {
    document.querySelectorAll(".cal-pop, .pick-menu").forEach(function (m) { m.hidden = true; });
    document.querySelectorAll(".cal-btn, .pick-btn").forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
  }
  function setDateValue(id, value) {
    var el = document.getElementById(id);
    if (!el) return;
    el.value = value || "";
    var node = el.parentNode && el.parentNode.querySelector(".cal-val");
    if (!node) return;
    if (el.value) {
      node.textContent = formatES(el.value);
      node.classList.remove("is-empty");
    } else {
      node.textContent = "dd/mm/aaaa";
      node.classList.add("is-empty");
    }
  }
  function todayIso() { return iso(new Date()); }
  function ensureTodayDates() {
    var t = todayIso();
    ["f-desde", "f-hasta"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && !el.value) el.value = t;
    });
  }
  function clearFilters(onChange) {
    ["f-modulo", "f-evaluador", "f-etapa", "f-semana"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.value = "*";
      syncPick(el);
    });
    var t = todayIso();
    setDateValue("f-desde", t);
    setDateValue("f-hasta", t);
    ["q", "q-detalle"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = "";
    });
    var colores = document.getElementById("f-colores");
    if (colores) colores.checked = false;
    if (typeof onChange === "function") onChange();
  }
  function mountDate(id) {
    var el = document.getElementById(id);
    if (!el || el.dataset.cal) return;
    el.dataset.cal = "1";
    el.classList.add("is-native");
    if (!el.value) el.value = todayIso();
    var box = document.createElement("div");
    box.className = "cal";
    box.innerHTML = '<button type="button" class="cal-btn" aria-haspopup="dialog" aria-expanded="false"><span class="cal-val is-empty">dd/mm/aaaa</span></button><div class="cal-pop" hidden></div>';
    el.insertAdjacentElement("afterend", box);
    var btn = box.querySelector(".cal-btn");
    var pop = box.querySelector(".cal-pop");
    var base = el.value ? new Date(el.value + "T12:00:00") : new Date();
    var cursor = new Date(base.getFullYear(), base.getMonth(), 1);
    function label() {
      var node = box.querySelector(".cal-val");
      if (el.value) {
        node.textContent = formatES(el.value);
        node.classList.remove("is-empty");
      } else {
        node.textContent = "dd/mm/aaaa";
        node.classList.add("is-empty");
      }
    }
    function paint() {
      var year = cursor.getFullYear();
      var month = cursor.getMonth();
      var first = new Date(year, month, 1);
      var start = new Date(first);
      start.setDate(1 - ((first.getDay() + 6) % 7));
      var today = iso(new Date());
      var cells = "";
      var i;
      for (i = 0; i < 42; i += 1) {
        var day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        var value = iso(day);
        var cls = "";
        if (day.getMonth() !== month) cls += " is-out";
        if (value === today) cls += " is-today";
        if (value === el.value) cls += " is-on";
        cells += '<button type="button" data-day="' + value + '" class="' + cls.trim() + '">' + day.getDate() + "</button>";
      }
      var heads = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"].map(function (d) { return "<span>" + d + "</span>"; }).join("");
      pop.innerHTML =
        '<div class="cal-head"><button type="button" data-nav="-1" aria-label="Mes anterior">‹</button><strong>' +
        MESES[month] + " " + year +
        '</strong><button type="button" data-nav="1" aria-label="Mes siguiente">›</button></div>' +
        '<div class="cal-week">' + heads + "</div>" +
        '<div class="cal-grid">' + cells + "</div>" +
        '<button type="button" class="cal-clear" data-clear>Quitar fecha</button>';
    }
    btn.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      var willOpen = pop.hidden;
      closePops();
      pop.hidden = !willOpen;
      btn.setAttribute("aria-expanded", pop.hidden ? "false" : "true");
      if (!pop.hidden) paint();
    });
    pop.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var nav = ev.target.closest("[data-nav]");
      var day = ev.target.closest("[data-day]");
      var clear = ev.target.closest("[data-clear]");
      if (nav) {
        cursor.setMonth(cursor.getMonth() + Number(nav.getAttribute("data-nav")));
        paint();
        return;
      }
      if (clear) el.value = "";
      if (day) el.value = day.getAttribute("data-day");
      if (clear || day) {
        label();
        pop.hidden = true;
        btn.setAttribute("aria-expanded", "false");
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    label();
  }
  function bind(onChange) {
    ensureTodayDates();
    mountDate("f-desde");
    mountDate("f-hasta");
    if (!bind.outside) {
      bind.outside = true;
      document.addEventListener("click", closePops);
    }
    // Colores de calor: live. Gramos ya no se usan en el resumen.
    ["f-colores", "f-colores-kg"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("change", onChange);
    });
    var filtrar = document.getElementById("btn-filtrar");
    if (filtrar && !filtrar._bound) {
      filtrar._bound = true;
      filtrar.addEventListener("click", function () {
        if (typeof onChange === "function") onChange({ apply: true });
      });
    }
    var limpiar = document.getElementById("btn-limpiar");
    if (limpiar && !limpiar._bound) {
      limpiar._bound = true;
      limpiar.addEventListener("click", function () {
        clearFilters(function () {
          if (typeof onChange === "function") onChange({ apply: true, clear: true });
        });
      });
    }
    var q = document.getElementById("q-detalle");
    if (q) {
      q.addEventListener("input", QBE.perf.debounce(function () {
        var top = document.getElementById("q");
        if (top) top.value = q.value;
        if (typeof onChange === "function") onChange({ apply: true });
      }, 180, "search"));
    }
  }

  QBE.filters = { current: current, render: render, bind: bind, clearFilters: clearFilters };
})(typeof window !== "undefined" ? window : globalThis);
