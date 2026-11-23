/* Sidebar, menú, cuenta y rutas — entorno Proyecciones. */
(function (root) {
  var QBE = root.QBE || (root.QBE = {});
  var booted = false;

  function $(id) { return document.getElementById(id); }
  function toast(msg, bad) {
    var el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.className = "toast" + (bad ? " is-bad" : "");
    el.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { el.hidden = true; }, 2800);
  }
  function closeMenu() {
    var side = $("sidebar");
    var back = $("backdrop");
    if (side) side.classList.remove("open");
    if (back) back.classList.remove("show");
  }
  function paintUser() {
    var s = QBE.auth.session() || {};
    var name = s.nombre || s.usuario || "Administrador";
    ["hello-name", "hello-menu-name"].forEach(function (id) {
      var el = $(id);
      if (el) el.textContent = name;
    });
  }
  function placeFilters(h) {
    var bar = $("filters-bar");
    if (!bar) return;
    var reg = document.querySelector('.page[data-page="registros"]');
    var esc = document.querySelector('.page[data-page="escaneadas"]');
    if (h === "#/escaneadas" && esc) {
      var top = esc.querySelector(".escaneadas-top");
      if (top) top.insertAdjacentElement("afterend", bar);
      bar.hidden = false;
    } else if (h === "#/registros" && reg) {
      var hero = reg.querySelector(".hero-row");
      if (hero) hero.insertAdjacentElement("afterend", bar);
      else reg.insertBefore(bar, reg.firstChild);
      bar.hidden = false;
    } else {
      bar.hidden = true;
    }
  }
  function route() {
    var h = String(location.hash || "#/registros");
    if (h === "#/" || h === "#" || h === "#/dashboard") h = "#/registros";
    document.querySelectorAll(".nav a").forEach(function (a) {
      a.classList.toggle("on", a.getAttribute("href") === h);
    });
    document.querySelectorAll(".page").forEach(function (p) {
      var id = "#/" + p.getAttribute("data-page");
      p.classList.toggle("on", id === h);
    });
    placeFilters(h);
    closeMenu();
    if (h === "#/movimientos" && QBE.audit) {
      QBE.audit.bind();
      QBE.audit.render();
    }
    if (h === "#/usuarios" && QBE.users) {
      QBE.users.bind();
    }
    if (QBE.audit && route.last && route.last !== h) {
      var names = {
        "#/registros": "Registros",
        "#/escaneadas": "Plantas escaneadas",
        "#/usuarios": "Usuarios activos",
        "#/movimientos": "Movimientos del sistema",
      };
      QBE.audit.add("Página", names[h] || h);
    }
    route.last = h;
  }
  function bind() {
    if ($("menu")) $("menu").addEventListener("click", function () {
      $("sidebar").classList.toggle("open");
      $("backdrop").classList.toggle("show");
    });
    if ($("backdrop")) $("backdrop").addEventListener("click", closeMenu);
    var hello = $("hello-btn");
    var menu = $("hello-menu");
    if (hello && menu) {
      hello.addEventListener("click", function () {
        var open = hello.getAttribute("aria-expanded") === "true";
        hello.setAttribute("aria-expanded", open ? "false" : "true");
        menu.hidden = open;
      });
      document.addEventListener("click", function (e) {
        if (!hello.contains(e.target) && !menu.contains(e.target)) {
          hello.setAttribute("aria-expanded", "false");
          menu.hidden = true;
        }
      });
    }
    function logout() {
      QBE.auth.logout();
      location.hash = "#/registros";
      location.reload();
    }
    if ($("logout-btn")) $("logout-btn").addEventListener("click", logout);
    if ($("side-logout")) $("side-logout").addEventListener("click", logout);
    if ($("refresh-btn")) $("refresh-btn").addEventListener("click", function () {
      if (QBE.app && QBE.app.reload) QBE.app.reload();
    });
    var topQ = $("q");
    if (topQ) {
      topQ.addEventListener("input", QBE.perf.debounce(function () {
        var el = $("q-detalle");
        if (el) el.value = topQ.value;
        if (QBE.app && QBE.app.onFilter) QBE.app.onFilter();
      }, 180, "topq"));
    }
    window.addEventListener("hashchange", route);
  }
  function afterLogin() {
    paintUser();
    if (!booted && QBE.app && QBE.app.boot) {
      booted = true;
      QBE.app.boot();
    }
    if (!location.hash || location.hash === "#/dashboard") location.hash = "#/registros";
    route();
    toast("Bienvenido a Proyecciones");
  }
  function start() {
    bind();
    if (QBE.auth.require()) afterLogin();
  }

  QBE.shell = { start: start, afterLogin: afterLogin, toast: toast, route: route };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})(typeof window !== "undefined" ? window : globalThis);
