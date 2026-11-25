/* Usuarios activos — evaluadores con acciones y paginación. */
(function (root) {
  var QBE = root.QBE || (root.QBE = {});
  var rows = [];
  var bound = false;
  var page = 1;
  var size = 11;

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
  function setFromApi(list) {
    /* Hoja: filas nuevas al final → invertir para mostrar el más reciente primero */
    var src = (list || []).slice().reverse();
    rows = src.map(function (u, i) {
      var dni = String(u.dni || "").trim();
      var nombre = String(u.nombre || "").replace(/\s+/g, " ").trim();
      return {
        id: dni || ("row-" + i),
        dni: dni,
        nombre: nombre || dni || "Sin nombre",
        rol: u.rol || "Evaluador",
        modulo: u.modulo || "—",
        activo: !!u.activo,
      };
    });
    render();
  }
  function icoToggle(on) {
    if (on) {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.5 7.5 10 16l-4.5-4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  }
  function icoUser() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="10" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
  }
  function filtered() {
    var qEl = document.getElementById("q-usuarios");
    var estadoEl = document.getElementById("f-estado-usuarios");
    var q = fold(qEl && qEl.value);
    var estado = estadoEl ? String(estadoEl.value || "*") : "*";
    return rows.filter(function (u) {
      if (estado === "1" && !u.activo) return false;
      if (estado === "0" && u.activo) return false;
      if (!q) return true;
      return fold(u.nombre + " " + u.dni + " " + u.rol + " " + u.modulo).indexOf(q) >= 0;
    });
  }
  function exportRows() {
    var list = filtered();
    if (typeof XLSX === "undefined") return;
    var cols = ["DNI", "Usuario", "Rol", "Estado"];
    var aoa = [cols].concat(list.map(function (u) {
      return [u.dni, u.nombre, u.rol, u.activo ? "Activo" : "Sin acceso"];
    }));
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, "Evaluadores");
    XLSX.writeFile(wb, "evaluadores-qberries.xlsx");
    if (QBE.audit) QBE.audit.add("Exportar Excel usuarios", list.length + " evaluadores");
  }
  function render() {
    var body = document.getElementById("users-body");
    var pager = document.getElementById("users-pager");
    if (!body) return;
    var list = filtered();
    var pages = Math.max(1, Math.ceil(list.length / size) || 1);
    if (page > pages) page = pages;
    if (page < 1) page = 1;
    var from = (page - 1) * size;
    var pageRows = list.slice(from, from + size);

    if (!pageRows.length) {
      body.innerHTML = '<tr class="empty"><td colspan="5">No hay evaluadores en la hoja Evaluadores.</td></tr>';
    } else {
      body.innerHTML = pageRows.map(function (u) {
        var badge = u.activo
          ? '<span class="badge badge-ok">Activo</span>'
          : '<span class="badge badge-off">Sin acceso</span>';
        var actionLabel = u.activo ? "Desactivar acceso" : "Activar acceso";
        var actionCls = u.activo ? "act-btn act-off" : "act-btn act-on";
        return "<tr data-id=\"" + esc(u.id) + "\">" +
          "<td class=\"dni\">" + esc(u.dni || "—") + "</td>" +
          '<td class="col-user"><span class="user-cell">' + icoUser() + "<strong>" + esc(u.nombre) + "</strong></span></td>" +
          "<td>" + esc(u.rol) + "</td>" +
          "<td>" + badge + "</td>" +
          '<td class="col-actions"><button type="button" class="' + actionCls + '" data-act="toggle" title="' + actionLabel + '" aria-label="' + actionLabel + '">' +
          icoToggle(u.activo) + "<span>" + (u.activo ? "Desactivar" : "Activar") + "</span></button></td>" +
          "</tr>";
      }).join("");
    }

    if (pager) {
      pager.innerHTML = '<button type="button" data-pg="-1" ' + (page <= 1 ? "disabled" : "") + ">‹</button>" +
        "<span class=\"pg-info\">Página " + page + " de " + pages + "</span>" +
        '<button type="button" data-pg="1" ' + (page >= pages ? "disabled" : "") + ">›</button>";
    }
  }
  function findUser(id) {
    var i;
    for (i = 0; i < rows.length; i += 1) {
      if (rows[i].id === id) return rows[i];
    }
    return null;
  }
  function closeAsk() {
    var box = document.getElementById("confirm");
    if (box) box.hidden = true;
  }
  function showCredModal(next, user) {
    var box = document.getElementById("cred-modal");
    var title = document.getElementById("cred-title");
    var text = document.getElementById("cred-text");
    var sub = document.getElementById("cred-sub");
    if (!box) return;
    if (title) title.textContent = next ? "Activando credenciales" : "Desactivando credenciales";
    if (text) {
      text.textContent = next
        ? "Se están activando las credenciales de acceso…"
        : "Se están desactivando las credenciales de acceso…";
    }
    if (sub) sub.textContent = (user.nombre || "") + (user.dni ? " · DNI " + user.dni : "");
    box.hidden = false;
  }
  function hideCredModal() {
    var box = document.getElementById("cred-modal");
    if (box) box.hidden = true;
  }
  function ask(id) {
    var user = findUser(id);
    var box = document.getElementById("confirm");
    var text = document.getElementById("confirm-text");
    var yes = document.getElementById("confirm-yes");
    var no = document.getElementById("confirm-no");
    if (!user || !box || !yes) { toggle(id); return; }
    var next = !user.activo;
    text.textContent = next
      ? "¿Activar el acceso de " + user.nombre + " · DNI " + user.dni + "?"
      : "¿Seguro que quieres quitar el acceso de " + user.nombre + " · DNI " + user.dni + "?";
    yes.textContent = next ? "Activar" : "Desactivar";
    yes.className = next ? "confirm-yes on" : "confirm-yes off";
    yes.onclick = function () { closeAsk(); toggle(id); };
    no.onclick = closeAsk;
    box.hidden = false;
    yes.focus();
  }
  function toggle(id) {
    var i;
    var user = null;
    for (i = 0; i < rows.length; i += 1) {
      if (rows[i].id === id) { user = rows[i]; break; }
    }
    if (!user || !user.dni) return;
    var next = !user.activo;
    showCredModal(next, user);
    var done = function () {
      user.activo = next;
      if (QBE.audit) QBE.audit.add(next ? "Activar usuario" : "Desactivar usuario", user.nombre);
      hideCredModal();
      if (QBE.shell && QBE.shell.toast) QBE.shell.toast(user.nombre + (next ? " · activo" : " · sin acceso"));
      render();
    };
    var fail = function (err) {
      hideCredModal();
      if (QBE.shell && QBE.shell.toast) QBE.shell.toast((err && err.message) || "No se guardó el acceso", true);
    };
    if (!QBE.api || !QBE.api.setAcceso) {
      setTimeout(done, 900);
      return;
    }
    QBE.api.setAcceso({ dni: user.dni, activo: next, nombre: user.nombre, rol: user.rol, modulo: user.modulo === "—" ? "" : user.modulo })
      .then(function () { setTimeout(done, 450); })
      .catch(fail);
  }
  function closeUserModal() {
    var box = document.getElementById("user-modal");
    if (box) box.hidden = true;
  }
  function openUserModal() {
    var box = document.getElementById("user-modal");
    var form = document.getElementById("user-form");
    var dni = document.getElementById("user-dni");
    var nombre = document.getElementById("user-nombre");
    if (!box) return;
    if (form) form.reset();
    if (dni) dni.value = "";
    if (nombre) nombre.value = "";
    box.hidden = false;
    if (dni) dni.focus();
  }
  function reloadFromApi() {
    if (!QBE.api || !QBE.api.evaluadores) return Promise.resolve();
    return QBE.api.evaluadores().then(function (data) {
      setFromApi((data && data.evaluadores) || []);
    });
  }
  function saveNewUser(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    var dniEl = document.getElementById("user-dni");
    var nomEl = document.getElementById("user-nombre");
    var saveBtn = document.getElementById("user-save");
    var dni = String((dniEl && dniEl.value) || "").replace(/\D/g, "");
    var nombre = String((nomEl && nomEl.value) || "").replace(/\s+/g, " ").trim();
    if (!/^\d{8}$/.test(dni)) {
      if (QBE.shell && QBE.shell.toast) QBE.shell.toast("DNI inválido (8 dígitos)", true);
      if (dniEl) dniEl.focus();
      return;
    }
    if (nombre.length < 3) {
      if (QBE.shell && QBE.shell.toast) QBE.shell.toast("Ingrese el nombre completo", true);
      if (nomEl) nomEl.focus();
      return;
    }
    var exists = rows.some(function (u) { return u.dni === dni; });
    if (exists && !window.confirm("El DNI ya está en la lista. ¿Actualizar nombre y dejarlo activo?")) return;

    if (saveBtn) saveBtn.disabled = true;
    showCredModal(true, { dni: dni, nombre: nombre });
    var title = document.getElementById("cred-title");
    var text = document.getElementById("cred-text");
    if (title) title.textContent = "Registrando evaluador";
    if (text) text.textContent = "Guardando en la hoja Evaluadores…";

    /* setAcceso crea/activa en hoja Evaluadores (API actual). addEvaluador si ya está desplegado. */
    function registerUser() {
      var payload = { dni: dni, nombre: nombre, rol: "Evaluador", activo: true };
      if (!QBE.api || !QBE.api.setAcceso) {
        return Promise.reject({ message: "API no disponible" });
      }
      if (!QBE.api.addEvaluador) return QBE.api.setAcceso(payload);
      return QBE.api.addEvaluador(payload).catch(function (err) {
        var msg = String((err && err.message) || "");
        if (/clientId|desconocida|addEvaluador/i.test(msg)) {
          return QBE.api.setAcceso(payload);
        }
        return Promise.reject(err);
      });
    }

    registerUser().then(function (res) {
      page = 1;
      return reloadFromApi().then(function () { return res; });
    }).then(function (res) {
      hideCredModal();
      closeUserModal();
      if (QBE.audit) QBE.audit.add("Registrar evaluador", dni + " · " + nombre);
      if (QBE.shell && QBE.shell.toast) {
        var updated = res && (res.created === false || res.updated === true);
        QBE.shell.toast(updated ? "Evaluador actualizado · activo" : "Evaluador registrado · con acceso");
      }
    }).catch(function (err) {
      hideCredModal();
      if (QBE.shell && QBE.shell.toast) QBE.shell.toast((err && err.message) || "No se pudo registrar", true);
    }).finally(function () {
      if (saveBtn) saveBtn.disabled = false;
    });
  }
  function bind() {
    if (!bound) {
      bound = true;
      var q = document.getElementById("q-usuarios");
      if (q) q.addEventListener("input", QBE.perf.debounce(function () { page = 1; render(); }, 160, "usersq"));
      var estado = document.getElementById("f-estado-usuarios");
      if (estado) estado.addEventListener("change", function () { page = 1; render(); });
      var xls = document.getElementById("btn-users-xls");
      if (xls) xls.addEventListener("click", exportRows);
      var addBtn = document.getElementById("btn-users-add");
      if (addBtn) addBtn.addEventListener("click", openUserModal);
      var form = document.getElementById("user-form");
      if (form) form.addEventListener("submit", saveNewUser);
      var dniInput = document.getElementById("user-dni");
      if (dniInput) {
        dniInput.addEventListener("input", function () {
          dniInput.value = String(dniInput.value || "").replace(/\D/g, "").slice(0, 8);
        });
      }
      var userModal = document.getElementById("user-modal");
      if (userModal) {
        userModal.addEventListener("click", function (e) {
          if (e.target === userModal || e.target.closest("[data-user-close]")) closeUserModal();
        });
      }
      var body = document.getElementById("users-body");
      if (body) {
        body.addEventListener("click", function (e) {
          var btn = e.target.closest("button[data-act='toggle']");
          if (!btn) return;
          var tr = btn.closest("tr[data-id]");
          if (!tr) return;
          ask(tr.getAttribute("data-id"));
        });
      }
      var askBox = document.getElementById("confirm");
      if (askBox) {
        askBox.addEventListener("click", function (e) { if (e.target === askBox) closeAsk(); });
      }
      document.addEventListener("keydown", function (e) {
        if (e.key !== "Escape") return;
        var userBox = document.getElementById("user-modal");
        if (userBox && !userBox.hidden) { closeUserModal(); return; }
        var box = document.getElementById("confirm");
        if (!box || box.hidden) return;
        closeAsk();
      });
      var pager = document.getElementById("users-pager");
      if (pager) {
        pager.addEventListener("click", function (e) {
          var btn = e.target.closest("button");
          if (!btn || btn.disabled) return;
          page += Number(btn.getAttribute("data-pg") || 0);
          if (page < 1) page = 1;
          render();
        });
      }
    }
    render();
  }

  QBE.users = { bind: bind, render: render, setFromApi: setFromApi };
})(typeof window !== "undefined" ? window : globalThis);
