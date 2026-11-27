/* Reportería — muestras por evaluador + avance diario. */
(function (root) {
  var QBE = root.QBE || (root.QBE = {});
  var bound = false;
  var lastRows = [];
  var lastPack = null;
  var lastSig = "";
  var chartUsers = null;
  var chartDays = null;
  var palette = ["#2f5d22", "#4f7c35", "#7aa84a", "#a3c76b", "#c5dea0", "#1f3d16", "#5b8a3c", "#8bb85a"];

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
  function dateKey(v) {
    var s = String(v || "").trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + "-" + m[2] + "-" + m[3];
    m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    if (m) {
      var dd = m[1].length < 2 ? "0" + m[1] : m[1];
      var mm = m[2].length < 2 ? "0" + m[2] : m[2];
      return m[3] + "-" + mm + "-" + dd;
    }
    return "";
  }
  function formatES(iso) {
    if (QBE.filters && QBE.filters.formatES) return QBE.filters.formatES(iso);
    var p = String(iso || "").split("-");
    return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : "";
  }
  function range() {
    var a = document.getElementById("rep-desde");
    var b = document.getElementById("rep-hasta");
    var ev = "*";
    if (QBE.filters && QBE.filters.pickFilterValue) {
      ev = QBE.filters.pickFilterValue("rep-evaluador");
    } else {
      var e = document.getElementById("rep-evaluador");
      ev = e ? String(e.value || "*").trim() : "*";
    }
    var t = document.getElementById("rep-tipo");
    return {
      desde: a ? String(a.value || "").trim() : "",
      hasta: b ? String(b.value || "").trim() : "",
      evaluador: ev,
      tipo: t ? String(t.value || "*").trim() || "*" : "*",
    };
  }
  function canonTipo(v) {
    if (QBE.data && QBE.data.canonTipo) return QBE.data.canonTipo(v);
    var s = fold(v);
    if (!s) return "";
    if (s.indexOf("fenolog") >= 0) return "Fenología";
    if (s.indexOf("proyeccion") >= 0) return "Proyecciones";
    return String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  }
  function filterRecords(records) {
    var r = range();
    var evList = null;
    if (r.evaluador && r.evaluador !== "*") {
      evList = (Array.isArray(r.evaluador) ? r.evaluador : String(r.evaluador).split("||"))
        .map(function (n) { return fold(n); })
        .filter(Boolean);
    }
    var tipoWant = r.tipo && r.tipo !== "*" ? canonTipo(r.tipo) : "";
    return (records || []).filter(function (row) {
      var f = dateKey(row.Fecha);
      if (!f) return false;
      if (r.desde && f < r.desde) return false;
      if (r.hasta && f > r.hasta) return false;
      if (evList && evList.length) {
        if (evList.indexOf(fold(row.Nombre)) < 0) return false;
      }
      if (tipoWant && canonTipo(row.Tipo) !== tipoWant) return false;
      return true;
    });
  }
  function build(records) {
    var byUser = {};
    var byDay = {};
    (records || []).forEach(function (row) {
      var dni = String(row.DNI || "").replace(/\D/g, "");
      var nombre = String(row.Nombre || "").replace(/\s+/g, " ").trim() || "Sin nombre";
      var key = dni || fold(nombre);
      var fecha = dateKey(row.Fecha);
      var lote = String(row.Lote || "").trim();
      if (!byUser[key]) {
        byUser[key] = {
          dni: dni,
          nombre: nombre,
          muestras: 0,
          lotes: {},
          dias: {},
        };
      }
      var u = byUser[key];
      u.muestras += 1;
      if (nombre && u.nombre === "Sin nombre") u.nombre = nombre;
      if (dni && !u.dni) u.dni = dni;
      if (lote) u.lotes[lote] = 1;
      if (fecha) {
        u.dias[fecha] = 1;
        byDay[fecha] = (byDay[fecha] || 0) + 1;
      }
    });
    var users = Object.keys(byUser).map(function (k) {
      var u = byUser[k];
      return {
        dni: u.dni,
        nombre: u.nombre,
        muestras: u.muestras,
        lotes: Object.keys(u.lotes).length,
        dias: Object.keys(u.dias).length,
      };
    }).sort(function (a, b) {
      return b.muestras - a.muestras || a.nombre.localeCompare(b.nombre, "es");
    });
    var days = Object.keys(byDay).sort().map(function (d) {
      return { fecha: d, muestras: byDay[d] };
    });
    var totalMuestras = users.reduce(function (n, u) { return n + u.muestras; }, 0);
    var totalLotes = users.reduce(function (n, u) { return n + u.lotes; }, 0);
    var totalDias = Object.keys(byDay).length;
    return {
      users: users,
      days: days,
      total: totalMuestras,
      totalLotes: totalLotes,
      totalDias: totalDias,
    };
  }
  function packSig(pack, r) {
    var evSig = "*";
    if (Array.isArray(r.evaluador)) evSig = r.evaluador.length ? r.evaluador.join("||") : "*";
    else if (r.evaluador) evSig = String(r.evaluador);
    return [
      r.desde || "",
      r.hasta || "",
      evSig,
      r.tipo || "*",
      pack.total,
      pack.totalDias,
      pack.users.map(function (u) { return u.dni + ":" + u.muestras; }).join(","),
      pack.days.map(function (d) { return d.fecha + ":" + d.muestras; }).join(","),
    ].join("|");
  }
  function fillEvaluadores(records) {
    if (!QBE.filters || !QBE.filters.fillSelect) return;
    var names = {};
    (records || []).forEach(function (row) {
      var n = String(row.Nombre || "").replace(/\s+/g, " ").trim();
      if (n) names[n] = 1;
    });
    var list = Object.keys(names).sort(function (a, b) {
      return a.localeCompare(b, "es");
    });
    QBE.filters.fillSelect("rep-evaluador", list, "Todos");
    var tipos = (QBE.filters.TIPO_OPTS || ["Fenología", "Proyecciones"]).slice();
    QBE.filters.fillSelect("rep-tipo", tipos, "Todas");
  }
  function paintRangeLabel(r, pack) {
    var label = document.getElementById("report-range-label");
    if (!label) return;
    var desde = r.desde ? formatES(r.desde) : "—";
    var hasta = r.hasta ? formatES(r.hasta) : "—";
    var ev = "Todos";
    if (r.evaluador && r.evaluador !== "*") {
      ev = Array.isArray(r.evaluador) ? (r.evaluador.length + " seleccionados") : r.evaluador;
    }
    var tipo = r.tipo && r.tipo !== "*" ? r.tipo : "Todas";
    label.textContent = desde + " → " + hasta + " · " + ev + " · " + tipo + " · " + (pack.total || 0) + " muestras";
  }
  function paintTable(users, r, pack) {
    var body = document.getElementById("report-body");
    if (!body) return;
    var desde = r.desde ? formatES(r.desde) : "—";
    var hasta = r.hasta ? formatES(r.hasta) : "—";
    if (!users.length) {
      body.innerHTML = '<tr class="empty"><td colspan="7">Sin muestras en el rango seleccionado.</td></tr>';
      return;
    }
    var rows = users.map(function (u) {
      return "<tr>" +
        '<td class="dni">' + esc(u.dni || "—") + "</td>" +
        '<td class="col-nombre">' + esc(u.nombre) + "</td>" +
        '<td class="num">' + esc(u.muestras) + "</td>" +
        '<td class="num">' + esc(u.lotes) + "</td>" +
        '<td class="num">' + esc(u.dias) + "</td>" +
        "<td>" + esc(desde) + "</td>" +
        "<td>" + esc(hasta) + "</td>" +
        "</tr>";
    });
    rows.push(
      '<tr class="row-total report-total">' +
        "<td></td>" +
        "<td>Total</td>" +
        '<td class="num">' + esc(pack.total || 0) + "</td>" +
        '<td class="num">' + esc(pack.totalLotes || 0) + "</td>" +
        '<td class="num">' + esc(pack.totalDias || 0) + "</td>" +
        "<td>" + esc(desde) + "</td>" +
        "<td>" + esc(hasta) + "</td>" +
      "</tr>"
    );
    body.innerHTML = rows.join("");
  }
  function chartOptsBase() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      animations: false,
      plugins: { legend: { display: false } },
    };
  }
  function ensureCharts() {
    if (typeof Chart === "undefined") return;
    var ctxU = document.getElementById("report-chart-users");
    var ctxD = document.getElementById("report-chart-days");
    if (ctxU && !chartUsers) {
      chartUsers = new Chart(ctxU, {
        type: "bar",
        data: { labels: [], datasets: [{ label: "Muestras", data: [], backgroundColor: [], borderRadius: 8, maxBarThickness: 42 }] },
        options: Object.assign(chartOptsBase(), {
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: function (items) {
                  var i = items[0] && items[0].dataIndex;
                  var users = (lastPack && lastPack.users) || [];
                  return users[i] ? users[i].nombre : "";
                },
              },
            },
          },
          scales: {
            x: {
              ticks: { color: "#5b6470", maxRotation: 40, minRotation: 0, font: { size: 11, weight: "600" } },
              grid: { display: false },
            },
            y: {
              beginAtZero: true,
              ticks: { color: "#8b93a0", precision: 0 },
              grid: { color: "rgba(47,93,34,0.08)" },
            },
          },
        }),
      });
    }
    if (ctxD && !chartDays) {
      chartDays = new Chart(ctxD, {
        type: "line",
        data: {
          labels: [],
          datasets: [{
            label: "Muestras / día",
            data: [],
            borderColor: "#2f5d22",
            backgroundColor: "rgba(47,93,34,0.12)",
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointBackgroundColor: "#2f5d22",
          }],
        },
        options: Object.assign(chartOptsBase(), {
          scales: {
            x: {
              ticks: { color: "#5b6470", font: { size: 11, weight: "600" } },
              grid: { display: false },
            },
            y: {
              beginAtZero: true,
              ticks: { color: "#8b93a0", precision: 0 },
              grid: { color: "rgba(47,93,34,0.08)" },
            },
          },
        }),
      });
    }
  }
  function paintCharts(pack) {
    ensureCharts();
    if (!chartUsers && !chartDays) return;
    var users = pack.users.slice(0, 12);
    if (chartUsers) {
      chartUsers.data.labels = users.map(function (u) {
        var parts = String(u.nombre || "").split(" ");
        return parts.slice(0, 2).join(" ") || u.dni || "—";
      });
      chartUsers.data.datasets[0].data = users.map(function (u) { return u.muestras; });
      chartUsers.data.datasets[0].backgroundColor = users.map(function (_, i) {
        return palette[i % palette.length];
      });
      chartUsers.update("none");
    }
    if (chartDays) {
      chartDays.data.labels = pack.days.map(function (d) { return formatES(d.fecha); });
      chartDays.data.datasets[0].data = pack.days.map(function (d) { return d.muestras; });
      chartDays.update("none");
    }
  }
  function exportXls() {
    if (typeof XLSX === "undefined") return;
    var r = range();
    var desde = r.desde ? formatES(r.desde) : "";
    var hasta = r.hasta ? formatES(r.hasta) : "";
    var pack = lastPack || { users: lastRows, total: 0, totalLotes: 0, totalDias: 0 };
    var aoa = [["DNI", "Evaluador", "Muestras", "Lotes", "Días activos", "Desde", "Hasta"]];
    (pack.users || []).forEach(function (u) {
      aoa.push([u.dni || "", u.nombre, u.muestras, u.lotes, u.dias, desde, hasta]);
    });
    aoa.push(["", "Total", pack.total || 0, pack.totalLotes || 0, pack.totalDias || 0, desde, hasta]);
    if (QBE.xls && QBE.xls.download) {
      QBE.xls.download(aoa, "Reporteria", "reporteria-usuarios-qberries.xlsx", {
        leftCols: [1],
        zebra: true,
        totalRows: [aoa.length - 1],
        boldFirstCol: false,
        colWidths: { 0: 12, 1: 28, 2: 12, 3: 10, 4: 12, 5: 12, 6: 12 },
      });
    } else {
      var wb = XLSX.utils.book_new();
      var ws = XLSX.utils.aoa_to_sheet(aoa);
      XLSX.utils.book_append_sheet(wb, ws, "Reporteria");
      XLSX.writeFile(wb, "reporteria-usuarios-qberries.xlsx");
    }
    if (QBE.audit) QBE.audit.add("Exportar Excel reportería", (pack.users || []).length + " usuarios");
    if (QBE.shell && QBE.shell.toast) QBE.shell.toast("Excel de reportería listo");
  }
  function isReporteriaPage() {
    return String(location.hash || "").indexOf("reporteria") >= 0;
  }
  function render(records, opts) {
    opts = opts || {};
    if (!opts.force && !isReporteriaPage() && bound) {
      /* Fuera de /reporteria no re-pintar gráficos (evita parpadeo por poll). */
      return;
    }
    var all = records || [];
    fillEvaluadores(all);
    var r = range();
    var filtered = filterRecords(all);
    var pack = build(filtered);
    var sig = packSig(pack, r);
    if (sig === lastSig && chartUsers && chartDays) {
      lastPack = pack;
      lastRows = pack.users;
      return;
    }
    lastSig = sig;
    lastPack = pack;
    lastRows = pack.users;
    lastRows._days = pack.days;
    paintRangeLabel(r, pack);
    paintTable(pack.users, r, pack);
    paintCharts(pack);
  }
  function todayIso() {
    var t = new Date();
    var m = String(t.getMonth() + 1);
    var d = String(t.getDate());
    if (m.length < 2) m = "0" + m;
    if (d.length < 2) d = "0" + d;
    return t.getFullYear() + "-" + m + "-" + d;
  }
  function setupDates() {
    if (!QBE.filters || !QBE.filters.mountDate) return;
    var a = document.getElementById("rep-desde");
    var b = document.getElementById("rep-hasta");
    if (a && !a.value) {
      var iso = todayIso();
      a.value = iso;
      if (b && !b.value) b.value = iso;
    }
    QBE.filters.mountDate("rep-desde");
    QBE.filters.mountDate("rep-hasta");
    if (QBE.filters.setDateValue) {
      if (a) QBE.filters.setDateValue("rep-desde", a.value);
      if (b) QBE.filters.setDateValue("rep-hasta", b.value);
    }
  }
  function clearFilters() {
    var iso = todayIso();
    if (QBE.filters && QBE.filters.setDateValue) {
      QBE.filters.setDateValue("rep-desde", iso);
      QBE.filters.setDateValue("rep-hasta", iso);
    } else {
      var a = document.getElementById("rep-desde");
      var b = document.getElementById("rep-hasta");
      if (a) a.value = iso;
      if (b) b.value = iso;
    }
    var ev = document.getElementById("rep-evaluador");
    if (ev) {
      if (QBE.filters && QBE.filters.setMultiValues) QBE.filters.setMultiValues(ev, ["*"]);
      else ev.value = "*";
      if (QBE.filters && QBE.filters.syncPick) QBE.filters.syncPick(ev);
    }
    var tipo = document.getElementById("rep-tipo");
    if (tipo) {
      tipo.value = "*";
      if (QBE.filters && QBE.filters.syncPick) QBE.filters.syncPick(tipo);
    }
    lastSig = "";
    if (QBE.app && QBE.app.pack) render(QBE.app.pack().records || [], { force: true });
    if (QBE.audit) QBE.audit.add("Desfiltrar reportería", iso + " → " + iso);
    if (QBE.shell && QBE.shell.toast) QBE.shell.toast("Filtros de reportería limpios");
  }
  function bind() {
    if (!bound) {
      bound = true;
      setupDates();
      var apply = document.getElementById("rep-aplicar");
      var clear = document.getElementById("rep-limpiar");
      var xls = document.getElementById("rep-xls");
      var ev = document.getElementById("rep-evaluador");
      var tipoEl = document.getElementById("rep-tipo");
      if (apply) {
        apply.addEventListener("click", function () {
          lastSig = "";
          if (QBE.app && QBE.app.pack) render(QBE.app.pack().records || [], { force: true });
          if (QBE.audit) {
            var r = range();
            QBE.audit.add(
              "Filtrar reportería",
              (r.desde || "…") + " → " + (r.hasta || "…") +
              (r.evaluador && r.evaluador !== "*"
                ? " · " + (Array.isArray(r.evaluador) ? r.evaluador.join(", ") : r.evaluador)
                : "") +
              (r.tipo && r.tipo !== "*" ? " · " + r.tipo : "")
            );
          }
        });
      }
      if (clear) clear.addEventListener("click", clearFilters);
      if (xls) xls.addEventListener("click", exportXls);
      if (ev) {
        if (ev.getAttribute("data-multi") !== "1") ev.setAttribute("data-multi", "1");
        if (QBE.filters && QBE.filters.syncPick) QBE.filters.syncPick(ev);
        ev.addEventListener("change", function () {
          lastSig = "";
          if (QBE.app && QBE.app.pack) render(QBE.app.pack().records || [], { force: true });
        });
      }
      if (tipoEl) {
        if (QBE.filters && QBE.filters.fillSelect) {
          QBE.filters.fillSelect("rep-tipo", QBE.filters.TIPO_OPTS || ["Fenología", "Proyecciones"], "Todas");
        } else if (QBE.filters && QBE.filters.syncPick) {
          QBE.filters.syncPick(tipoEl);
        }
        tipoEl.addEventListener("change", function () {
          lastSig = "";
          if (QBE.app && QBE.app.pack) render(QBE.app.pack().records || [], { force: true });
        });
      }
    } else {
      setupDates();
    }
    lastSig = "";
    if (QBE.app && QBE.app.pack) render(QBE.app.pack().records || [], { force: true });
  }

  QBE.reports = { bind: bind, render: render };
})(typeof window !== "undefined" ? window : globalThis);
