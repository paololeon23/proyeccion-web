/* Cliente GET de la API Apps Script de proyecciones. */
(function (root) {
  var QBE = root.QBE || (root.QBE = {});

  function apiUrl() {
    return String((QBE.config && QBE.config.apiUrl) || "").trim();
  }
  function online() {
    try { if (navigator && navigator.onLine === false) return false; } catch (err) {}
    return true;
  }
  function fetchJson(url, timeout) {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeout || 20000);
    return fetch(url, { method: "GET", cache: "no-store", signal: ctrl ? ctrl.signal : undefined })
      .then(function (res) {
        return res.text().then(function (t) {
          var data = null;
          try { data = t ? JSON.parse(t) : null; } catch (err) {}
          if (!res.ok) throw { status: res.status, message: "No se pudo leer la API." };
          return data;
        });
      })
      .finally(function () { clearTimeout(timer); });
  }
  function get(action, params, timeoutMs) {
    var url = apiUrl();
    if (!url) return Promise.reject({ message: "Falta configurar la URL de la API (meta qberries-api)." });
    if (!online()) return Promise.reject({ message: "Sin conexión." });
    var q = ["action=" + encodeURIComponent(action), "_=" + Date.now()];
    var key;
    params = params || {};
    for (key in params) {
      if (!Object.prototype.hasOwnProperty.call(params, key)) continue;
      if (params[key] == null || params[key] === "" || params[key] === "*") continue;
      q.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(params[key])));
    }
    var sep = url.indexOf("?") >= 0 ? "&" : "?";
    var ms = timeoutMs != null ? timeoutMs : ((QBE.config && QBE.config.timeoutMs) || 20000);
    return fetchJson(url + sep + q.join("&"), ms).then(function (data) {
      if (!data || data.ok === false) {
        throw { message: (data && (data.message || data.error)) || "La API no devolvió datos." };
      }
      return data;
    });
  }
  function list(filters, opts) {
    opts = opts || {};
    var params = { limit: opts.limit || 2000 };
    filters = filters || {};
    var key;
    for (key in filters) {
      if (Object.prototype.hasOwnProperty.call(filters, key)) params[key] = filters[key];
    }
    return get("list", params, opts.timeoutMs).then(function (data) {
      var rows = data && (data.records || data.registros);
      if (!data || !Array.isArray(rows)) {
        throw { message: "La hoja Proyecciones no devolvió filas." };
      }
      data.records = rows;
      return data;
    });
  }
  function meta() {
    return get("meta", {});
  }
  function ping() {
    return get("ping", {});
  }
  function evaluadores() {
    return get("evaluadores", {});
  }
  function post(body) {
    var url = apiUrl();
    if (!url) return Promise.reject({ message: "Falta configurar la URL de la API." });
    return fetch(url, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body || {}),
    }).then(function (res) {
      return res.text().then(function (t) {
        var data = null;
        try { data = t ? JSON.parse(t) : null; } catch (err) {}
        if (!data || data.ok === false) {
          throw { message: (data && (data.message || data.error)) || "No se pudo guardar en la hoja." };
        }
        return data;
      });
    });
  }
  function setAcceso(payload) {
    payload = payload || {};
    return post({
      action: "setAcceso",
      dni: payload.dni,
      activo: !!payload.activo,
      nombre: payload.nombre || "",
      rol: payload.rol || "Evaluador",
      modulo: payload.modulo || "",
    });
  }
  function addEvaluador(payload) {
    payload = payload || {};
    /* Preferir setAcceso: ya crea en Evaluadores con Activo=true en todas las versiones. */
    return setAcceso({
      dni: payload.dni,
      nombre: payload.nombre || "",
      rol: payload.rol || "Evaluador",
      modulo: payload.modulo || "",
      activo: true,
    });
  }

  QBE.api = {
    url: apiUrl,
    online: online,
    list: list,
    evaluadores: evaluadores,
    setAcceso: setAcceso,
    addEvaluador: addEvaluador,
    meta: meta,
    ping: ping,
    get: get,
  };
})(typeof window !== "undefined" ? window : globalThis);
