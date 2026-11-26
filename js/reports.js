/* Reportería — muestras por evaluador + avance diario. */
(function (root) {
  var QBE = root.QBE || (root.QBE = {});
  var bound = false;
  var lastRows = [];
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
    var e = document.getElementById("rep-evaluador");
    return {
      desde: a ? String(a.value || "").trim() : "",
      hasta: b ? String(b.value || "").trim() : "",
      evaluador: e ? String(e.value || "*").trim() : "*",
    };
  }
  function filterRecords(records) {
    var r = range();
    return (records || []).filter(function (row) {
      var f = dateKey(row.Fecha);
      if (!f) return false;
      if (r.desde && f < r.desde) return false;
      if (r.hasta && f > r.hasta) return false;
      if (r.evaluador && r.evaluador !== "*") {
        if (fold(row.Nombre) !== fold(r.evaluador)) return false;
      }
      return true;
    });
  }
  function build(records) {
    var byUser = {};
    var byDay = {};
    (records || []).forEach(function (row) {
      var dni = String(row.DNI || "").replace(/\D/g, "");
      var nombre = String(row.Nombre || "").replace(/\s+/g, " ").trim() || "Sin nombre";
      var key = dni || nombre;
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
    return { users: users, days: days, total: records.length };
  }
  function destroyCharts() {
    if (chartUsers) { try { chartUsers.destroy(); } catch (e) {} chartUsers = null; }
    if (chartDays) { try { chartDays.destroy(); } catch (e) {} chartDays = null; }
  }
  function fillEvaluadores(records) {
    if (!QBE.filters || !QBE.filters.fillSelect) return;
    var names = {};
    (records || []).forEach(function (r) {
      var n = String(r.Nombre || "").replace(/\s+/g, " ").trim();
      if (n) names[n] = 1;
    });
    var list = Object.keys(names).sort(function (a, b) {
      return a.localeCompare(b, "es");
    });
    QBE.filters.fillSelect("rep-evaluador", list, "Todos");
  }
  function paintRangeLabel(r) {
    var label = document.getElementById("report-range-label");
    if (!label) return;
    var desde = r.desde ? formatES(r.desde) : "—";
    var hasta = r.hasta ? formatES(r.hasta) : "—";
    var ev = r.evaluador && r.evaluador !== "*" ? r.evaluador : "Todos";
    label.textContent = desde + " → " + hasta + " · " + ev;
  }
  function paintTable(users, r) {
    var body = document.getElementById("report-body");
    if (!body) return;
    var desde = r.desde ? formatES(r.desde) : "—";
    var hasta = r.hasta ? formatES(r.hasta) : "—";
    if (!users.length) {
      body.innerHTML = '<tr class="empty"><td colspan="7">Sin muestras en el rango seleccionado.</td></tr>';
      return;
    }
    body.innerHTML = users.map(function (u) {
      return "<tr>" +
        '<td class="dni">' + esc(u.dni || "—") + "</td>" +
        '<td class="col-nombre">' + esc(u.nombre) + "</td>" +
        '<td class="num">' + esc(u.muestras) + "</td>" +
        '<td class="num">' + esc(u.lotes) + "</td>" +
        '<td class="num">' + esc(u.dias) + "</td>" +
        "<td>" + esc(desde) + "</td>" +
        "<td>" + esc(hasta) + "</td>" +
        "</tr>";
    }).join("");
  }
  function paintCharts(pack) {
    destroyCharts();
    if (typeof Chart === "undefined") return;
    var users = pack.users.slice(0, 12);
    var ctxU = document.getElementById("report-chart-users");
    var ctxD = document.getElementById("report-chart-days");
    if (ctxU) {
      chartUsers = new Chart(ctxU, {
        type: "bar",
        data: {
          labels: users.map(function (u) {
            var parts = String(u.nombre || "").split(" ");
            return parts.slice(0, 2).join(" ") || u.dni || "—";
          }),
          datasets: [{
            label: "Muestras",
            data: users.map(function (u) { return u.muestras; }),
            backgroundColor: users.map(function (_, i) { return palette[i % palette.length]; }),
            borderRadius: 8,
            maxBarThickness: 42,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: function (items) {
                  var i = items[0] && items[0].dataIndex;
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
        },
      });
    }
    if (ctxD) {
      chartDays = new Chart(ctxD, {
        type: "line",
        data: {
          labels: pack.days.map(function (d) { return formatES(d.fecha); }),
          datasets: [{
            label: "Muestras / día",
            data: pack.days.map(function (d) { return d.muestras; }),
            borderColor: "#2f5d22",
            backgroundColor: "rgba(47,93,34,0.12)",
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointBackgroundColor: "#2f5d22",
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
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
        },
      });
    }
  }
  function exportXls() {
    if (typeof XLSX === "undefined") return;
    var r = range();
    var desde = r.desde ? formatES(r.desde) : "";
    var hasta = r.hasta ? formatES(r.hasta) : "";
    var aoa = [["DNI", "Evaluador", "Muestras", "Lotes", "Días activos", "Desde", "Hasta"]];
    lastRows.forEach(function (u) {
      aoa.push([u.dni || "", u.nombre, u.muestras, u.lotes, u.dias, desde, hasta]);
    });
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, "Reporteria");
    XLSX.writeFile(wb, "reporteria-usuarios-qberries.xlsx");
    if (QBE.audit) QBE.audit.add("Exportar Excel reportería", lastRows.length + " usuarios");
    if (QBE.shell && QBE.shell.toast) QBE.shell.toast("Excel de reportería listo");
  }
  function render(records) {
    var all = records || [];
    fillEvaluadores(all);
    var r = range();
    var filtered = filterRecords(all);
    var pack = build(filtered);
    lastRows = pack.users;
    lastRows._days = pack.days;
    paintRangeLabel(r);
    paintTable(pack.users, r);
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
      ev.value = "*";
      if (QBE.filters && QBE.filters.syncPick) QBE.filters.syncPick(ev);
    }
    if (QBE.app && QBE.app.pack) render(QBE.app.pack().records || []);
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
      if (apply) {
        apply.addEventListener("click", function () {
          if (QBE.app && QBE.app.pack) render(QBE.app.pack().records || []);
          if (QBE.audit) {
            var r = range();
            QBE.audit.add(
              "Filtrar reportería",
              (r.desde || "…") + " → " + (r.hasta || "…") +
              (r.evaluador && r.evaluador !== "*" ? " · " + r.evaluador : "")
            );
          }
        });
      }
      if (clear) clear.addEventListener("click", clearFilters);
      if (xls) xls.addEventListener("click", exportXls);
      if (ev) {
        ev.addEventListener("change", function () {
          if (QBE.app && QBE.app.pack) render(QBE.app.pack().records || []);
        });
      }
    } else {
      setupDates();
    }
    if (QBE.app && QBE.app.pack) render(QBE.app.pack().records || []);
  }

  QBE.reports = { bind: bind, render: render };
})(typeof window !== "undefined" ? window : globalThis);
