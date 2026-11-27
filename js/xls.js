/* Estilo formal QBerries para exports Excel (xlsx-js-style). */
(function (root) {
  var QBE = root.QBE || (root.QBE = {});

  var GREEN = "2F5D22";
  var GREEN_SOFT = "E7F0DF";
  var WHITE = "FFFFFF";
  var INK = "1F2937";
  var MUTED = "5B6470";
  var LINE = "D7E3C8";
  var ZEBRA = "F8FAF6";

  function borderAll(color) {
    var b = { style: "thin", color: { rgb: color || LINE } };
    return { top: b, bottom: b, left: b, right: b };
  }
  function headerStyle() {
    return {
      fill: { patternType: "solid", fgColor: { rgb: GREEN } },
      font: { bold: true, color: { rgb: WHITE }, name: "Calibri", sz: 11 },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: borderAll("A3C76B"),
    };
  }
  function bodyStyle(opts) {
    opts = opts || {};
    return {
      fill: { patternType: "solid", fgColor: { rgb: opts.fill || WHITE } },
      font: {
        bold: !!opts.bold,
        color: { rgb: opts.color || INK },
        name: "Calibri",
        sz: opts.sz || 10,
      },
      alignment: {
        horizontal: opts.align || "center",
        vertical: "center",
        wrapText: !!opts.wrap,
      },
      border: borderAll(LINE),
    };
  }
  function totalStyle() {
    return {
      fill: { patternType: "solid", fgColor: { rgb: GREEN } },
      font: { bold: true, color: { rgb: WHITE }, name: "Calibri", sz: 10 },
      alignment: { horizontal: "center", vertical: "center" },
      border: borderAll("A3C76B"),
    };
  }
  function softRowStyle() {
    return bodyStyle({ fill: GREEN_SOFT, bold: true, color: GREEN, align: "left" });
  }
  function colLetter(n) {
    var s = "";
    var x = n;
    while (x >= 0) {
      s = String.fromCharCode((x % 26) + 65) + s;
      x = Math.floor(x / 26) - 1;
    }
    return s;
  }
  function rangeRef(r0, c0, r1, c1) {
    return colLetter(c0) + (r0 + 1) + ":" + colLetter(c1) + (r1 + 1);
  }
  function applySheetStyle(ws, aoa, opts) {
    opts = opts || {};
    if (!ws || !aoa || !aoa.length) return ws;
    var rows = aoa.length;
    var cols = 0;
    var r;
    for (r = 0; r < rows; r += 1) {
      if (aoa[r] && aoa[r].length > cols) cols = aoa[r].length;
    }
    if (!cols) return ws;

    ws["!cols"] = [];
    var c;
    for (c = 0; c < cols; c += 1) {
      var maxLen = 10;
      for (r = 0; r < rows; r += 1) {
        var cell = aoa[r] && aoa[r][c];
        var len = String(cell == null ? "" : cell).length;
        if (len > maxLen) maxLen = len;
      }
      var wch = Math.min(36, Math.max(10, maxLen + 2));
      if (opts.colWidths && opts.colWidths[c] != null) wch = opts.colWidths[c];
      ws["!cols"].push({ wch: wch });
    }

    ws["!rows"] = [{ hpt: 22 }];
    for (r = 1; r < rows; r += 1) ws["!rows"].push({ hpt: 18 });

    var totalIdx = {};
    (opts.totalRows || []).forEach(function (i) { totalIdx[i] = 1; });
    var softIdx = {};
    (opts.softRows || []).forEach(function (i) { softIdx[i] = 1; });
    var leftCols = {};
    (opts.leftCols || [0]).forEach(function (i) { leftCols[i] = 1; });

    for (r = 0; r < rows; r += 1) {
      for (c = 0; c < cols; c += 1) {
        var addr = colLetter(c) + (r + 1);
        if (!ws[addr]) ws[addr] = { t: "s", v: "" };
        if (r === 0) {
          ws[addr].s = headerStyle();
        } else if (totalIdx[r]) {
          ws[addr].s = totalStyle();
          if (leftCols[c]) ws[addr].s.alignment = { horizontal: "left", vertical: "center" };
        } else if (softIdx[r]) {
          ws[addr].s = softRowStyle();
          if (!leftCols[c]) {
            ws[addr].s = bodyStyle({ fill: GREEN_SOFT, bold: true, color: GREEN, align: "center" });
          }
        } else {
          var zebra = opts.zebra && r % 2 === 0 ? ZEBRA : WHITE;
          var align = leftCols[c] ? "left" : "center";
          ws[addr].s = bodyStyle({ fill: zebra, align: align, color: MUTED });
          if (leftCols[c]) ws[addr].s.font.color = { rgb: INK };
          if (opts.boldFirstCol && leftCols[c]) ws[addr].s.font.bold = true;
        }
      }
    }

    ws["!autofilter"] = { ref: rangeRef(0, 0, Math.max(rows - 1, 0), cols - 1) };
    ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };
    return ws;
  }
  function download(aoa, sheetName, fileName, opts) {
    if (typeof XLSX === "undefined") return false;
    opts = opts || {};
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet(aoa || []);
    applySheetStyle(ws, aoa || [], opts);
    XLSX.utils.book_append_sheet(wb, ws, (sheetName || "Datos").slice(0, 31));
    XLSX.writeFile(wb, fileName || "qberries.xlsx");
    return true;
  }

  QBE.xls = {
    download: download,
    style: applySheetStyle,
  };
})(typeof window !== "undefined" ? window : globalThis);
