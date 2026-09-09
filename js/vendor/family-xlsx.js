/* Family Superapp lightweight XLSX writer v1.0
 * Generates Excel 2007+ .xlsx files directly in the browser without external dependencies.
 * OOXML cells use inline strings; numeric cells remain true numbers for SUM/filter/pivot workflows.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FamilyXLSX = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const encoder = new TextEncoder();
  const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  function xmlEscape(value) {
    return String(value ?? "")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function colName(index) {
    let n = Number(index) + 1;
    let name = "";
    while (n > 0) {
      const rem = (n - 1) % 26;
      name = String.fromCharCode(65 + rem) + name;
      n = Math.floor((n - 1) / 26);
    }
    return name;
  }

  function cell(value, style = 0, type = null) {
    if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "v")) return value;
    return { v: value, s: style, t: type };
  }

  function number(value, style = 0) {
    const n = Number(value);
    return { v: Number.isFinite(n) ? n : 0, s: style, t: "n" };
  }

  function text(value, style = 0) {
    return { v: value == null ? "" : String(value), s: style, t: "s" };
  }

  function normalizeCell(input) {
    if (input && typeof input === "object" && Object.prototype.hasOwnProperty.call(input, "v")) {
      const type = input.t || (typeof input.v === "number" ? "n" : "s");
      return { v: input.v, s: Number(input.s || 0), t: type };
    }
    if (typeof input === "number") return { v: Number.isFinite(input) ? input : 0, s: 0, t: "n" };
    return { v: input == null ? "" : String(input), s: 0, t: "s" };
  }

  function cellXml(address, input) {
    const c = normalizeCell(input);
    const style = c.s ? ` s="${c.s}"` : "";
    if (c.t === "n") {
      const n = Number(c.v);
      return `<c r="${address}"${style}><v>${Number.isFinite(n) ? n : 0}</v></c>`;
    }
    const value = c.v == null ? "" : String(c.v);
    const preserve = /^\s|\s$|\n/.test(value) ? ' xml:space="preserve"' : "";
    return `<c r="${address}" t="inlineStr"${style}><is><t${preserve}>${xmlEscape(value)}</t></is></c>`;
  }

  function sheetXml(sheet) {
    const rows = Array.isArray(sheet.rows) ? sheet.rows : [];
    const maxCols = Math.max(1, ...rows.map(row => Array.isArray(row) ? row.length : 0));
    const maxRows = Math.max(1, rows.length);
    const dimension = `A1:${colName(maxCols - 1)}${maxRows}`;
    const widths = Array.isArray(sheet.widths) ? sheet.widths : [];
    const colsXml = widths.length
      ? `<cols>${widths.map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.max(4, Math.min(80, Number(width || 12)))}" customWidth="1"/>`).join("")}</cols>`
      : "";

    const sheetRows = rows.map((row, rowIndex) => {
      const cells = (row || []).map((value, colIndex) => cellXml(`${colName(colIndex)}${rowIndex + 1}`, value)).join("");
      const height = sheet.rowHeights?.[rowIndex];
      const heightAttr = height ? ` ht="${Number(height)}" customHeight="1"` : "";
      return `<row r="${rowIndex + 1}"${heightAttr}>${cells}</row>`;
    }).join("");

    let sheetView = '<sheetView workbookViewId="0"/>';
    const freeze = Number(sheet.freezeRows || 0);
    if (freeze > 0) {
      sheetView = `<sheetView workbookViewId="0"><pane ySplit="${freeze}" topLeftCell="A${freeze + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${freeze + 1}" sqref="A${freeze + 1}"/></sheetView>`;
    }

    const merges = (sheet.merges || []).length
      ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map(ref => `<mergeCell ref="${xmlEscape(ref)}"/>`).join("")}</mergeCells>`
      : "";
    const filter = sheet.autoFilter ? `<autoFilter ref="${xmlEscape(sheet.autoFilter)}"/>` : "";

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<dimension ref="${dimension}"/><sheetViews>${sheetView}</sheetViews><sheetFormatPr defaultRowHeight="15"/>${colsXml}` +
      `<sheetData>${sheetRows}</sheetData>${merges}${filter}</worksheet>`;
  }

  function stylesXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="[$Rp-421] #,##0;[Red]-[$Rp-421] #,##0"/>
    <numFmt numFmtId="165" formatCode="0.0%"/>
  </numFmts>
  <fonts count="7">
    <font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="18"/><color rgb="FF1D2521"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FF167A45"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FFCF3D45"/><name val="Calibri"/><family val="2"/></font>
    <font><i/><sz val="10"/><color rgb="FF6B7470"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FF8B6508"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="6">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1D8A50"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEAF6EF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFDECEE"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF6D8"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFDDE4E0"/></left><right style="thin"><color rgb="FFDDE4E0"/></right><top style="thin"><color rgb="FFDDE4E0"/></top><bottom style="thin"><color rgb="FFDDE4E0"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="12">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="164" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="4" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="6" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
  }

  function workbookXml(sheets) {
    const nodes = sheets.map((sheet, index) => `<sheet name="${xmlEscape(String(sheet.name || `Sheet${index + 1}`).slice(0, 31))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="14000"/></bookViews><sheets>${nodes}</sheets><calcPr calcId="0" fullCalcOnLoad="1"/></workbook>`;
  }

  function workbookRelsXml(sheets) {
    const sheetRels = sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRels}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  }

  function contentTypesXml(sheets) {
    const sheetTypes = sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheetTypes}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
  }

  function rootRelsXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
  }

  function coreXml(meta) {
    const now = new Date().toISOString();
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(meta.title || "Laporan Keuangan Keluarga")}</dc:title><dc:creator>${xmlEscape(meta.creator || "Family Superapp")}</dc:creator><cp:lastModifiedBy>${xmlEscape(meta.creator || "Family Superapp")}</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
  }

  function appXml(sheets) {
    const names = sheets.map(sheet => `<vt:lpstr>${xmlEscape(String(sheet.name || "Sheet"))}</vt:lpstr>`).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Family Superapp</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${sheets.length}</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="${sheets.length}" baseType="lpstr">${names}</vt:vector></TitlesOfParts><Company></Company><LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>16.0300</AppVersion></Properties>`;
  }

  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function dosDateTime(date = new Date()) {
    const year = Math.max(1980, date.getFullYear());
    const time = ((date.getHours() & 31) << 11) | ((date.getMinutes() & 63) << 5) | (Math.floor(date.getSeconds() / 2) & 31);
    const day = ((year - 1980) << 9) | (((date.getMonth() + 1) & 15) << 5) | (date.getDate() & 31);
    return { time, day };
  }

  function u16(value) {
    const out = new Uint8Array(2);
    const view = new DataView(out.buffer);
    view.setUint16(0, value & 0xFFFF, true);
    return out;
  }

  function u32(value) {
    const out = new Uint8Array(4);
    const view = new DataView(out.buffer);
    view.setUint32(0, value >>> 0, true);
    return out;
  }

  function concatArrays(parts) {
    const length = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(length);
    let offset = 0;
    parts.forEach(part => { out.set(part, offset); offset += part.length; });
    return out;
  }

  function zipStore(entries) {
    const locals = [];
    const centrals = [];
    let offset = 0;
    const now = dosDateTime(new Date());

    entries.forEach(entry => {
      const name = encoder.encode(entry.name);
      const data = typeof entry.data === "string" ? encoder.encode(entry.data) : entry.data;
      const crc = crc32(data);
      const localHeader = concatArrays([
        u32(0x04034B50), u16(20), u16(0x0800), u16(0), u16(now.time), u16(now.day), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name
      ]);
      locals.push(localHeader, data);

      const central = concatArrays([
        u32(0x02014B50), u16(20), u16(20), u16(0x0800), u16(0), u16(now.time), u16(now.day), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name
      ]);
      centrals.push(central);
      offset += localHeader.length + data.length;
    });

    const centralOffset = offset;
    const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
    const end = concatArrays([
      u32(0x06054B50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(centralSize), u32(centralOffset), u16(0)
    ]);
    return concatArrays([...locals, ...centrals, end]);
  }

  function buildWorkbook(spec = {}) {
    const sheets = (spec.sheets || []).filter(Boolean);
    if (!sheets.length) throw new Error("Workbook harus memiliki minimal satu sheet.");
    const entries = [
      { name: "[Content_Types].xml", data: contentTypesXml(sheets) },
      { name: "_rels/.rels", data: rootRelsXml() },
      { name: "docProps/core.xml", data: coreXml(spec.meta || {}) },
      { name: "docProps/app.xml", data: appXml(sheets) },
      { name: "xl/workbook.xml", data: workbookXml(sheets) },
      { name: "xl/_rels/workbook.xml.rels", data: workbookRelsXml(sheets) },
      { name: "xl/styles.xml", data: stylesXml() }
    ];
    sheets.forEach((sheet, index) => entries.push({ name: `xl/worksheets/sheet${index + 1}.xml`, data: sheetXml(sheet) }));
    return zipStore(entries);
  }

  function save(filename, spec) {
    const bytes = buildWorkbook(spec);
    if (typeof document === "undefined") return bytes;
    const blob = new Blob([bytes], { type: MIME_XLSX });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename || "laporan.xlsx";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
    return bytes;
  }

  return {
    version: "1.0.0",
    MIME_XLSX,
    buildWorkbook,
    save,
    cell,
    number,
    text,
    styles: {
      DEFAULT: 0,
      TITLE: 1,
      SECTION: 2,
      HEADER: 3,
      CURRENCY: 4,
      PERCENT: 5,
      CURRENCY_BOLD: 6,
      GOOD: 7,
      BAD: 8,
      WARNING: 9,
      NOTE: 10,
      BORDER: 11
    }
  };
});
