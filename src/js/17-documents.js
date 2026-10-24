// Office documents, written here without any library: a zip writer, and the Word report.
//
// The Word report is made from the same markup as the printed one (fullReport, report8D), walked
// element by element into WordprocessingML, so the two always say the same. Charts become pictures.

// ---- Zip ----

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = ~0;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return ~c >>> 0;
}

// A zip of [{name, data}], data a string or bytes. Text is deflated where the browser can; pictures,
// already compressed, are stored.
async function zipBlob(files, type) {
  const enc = new TextEncoder(), parts = [], central = [];
  const now = new Date(), time = now.getHours() << 11 | now.getMinutes() << 5 | now.getSeconds() >> 1;
  const date = (now.getFullYear() - 1980) << 9 | (now.getMonth() + 1) << 5 | now.getDate();
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), raw = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const deflate = typeof f.data === 'string' && typeof CompressionStream === 'function';
    const body = deflate ? new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()) : raw;
    const head = new DataView(new ArrayBuffer(30));
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, deflate ? 8 : 0, 2], [10, time, 2], [12, date, 2], [14, crc32(raw), 4],
      [18, body.length, 4], [22, raw.length, 4], [26, name.length, 2], [28, 0, 2]].forEach(([at, v, n]) => n === 4 ? head.setUint32(at, v, true) : head.setUint16(at, v, true));
    const dir = new DataView(new ArrayBuffer(46));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, deflate ? 8 : 0, 2], [12, time, 2], [14, date, 2], [16, crc32(raw), 4],
      [20, body.length, 4], [24, raw.length, 4], [28, name.length, 2], [42, offset, 4]].forEach(([at, v, n]) => n === 4 ? dir.setUint32(at, v, true) : dir.setUint16(at, v, true));
    parts.push(head, name, body);
    central.push(dir, name);
    offset += 30 + name.length + body.length;
  }
  const size = central.reduce((n, p) => n + p.byteLength, 0), end = new DataView(new ArrayBuffer(22));
  [[0, 0x06054b50, 4], [8, files.length, 2], [10, files.length, 2], [12, size, 4], [16, offset, 4]].forEach(([at, v, n]) => n === 4 ? end.setUint32(at, v, true) : end.setUint16(at, v, true));
  return new Blob([...parts, ...central, end], {type});
}

// Text for XML: escaped, without the control characters XML does not allow.
const xmlText = s => escapeHtml(String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ''));

// ---- Word ----

// Landscape A4 with 18 mm margins, in twentieths of a point; pictures in EMU.
const DOCX_PAGE = {w: 16838, h: 11906, margin: 1020};
const DOCX_TEXT_W = DOCX_PAGE.w - 2 * DOCX_PAGE.margin;
const EMU_PER_PX = 9525, EMU_PER_TWIP = 635;
const DOCX_COLORS = {ink: '16232F', muted: '5B6B7A', accent: '0B5F66', accentInk: '084F54', red: 'B3261E', line: 'D5DDE4', rule: '8796A4', head: 'F3F6F9'};
const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

// Runs: pieces of text with their formatting, or line breaks.
function docxFormat(el, f) {
  const c = el.classList, g = {...f};
  if (el.tagName === 'B' || el.tagName === 'STRONG') g.b = true;
  if (el.tagName === 'S') g.strike = true;
  if (el.tagName === 'SMALL') Object.assign(g, {size: 15, color: DOCX_COLORS.muted});
  if (c.contains('r-code')) Object.assign(g, {mono: true, b: true, color: DOCX_COLORS.accentInk});
  if (c.contains('r-none')) Object.assign(g, {i: true, color: DOCX_COLORS.muted});
  if (c.contains('r-issue-error')) g.color = DOCX_COLORS.red;
  if (c.contains('r-sub') || c.contains('r-tagline')) Object.assign(g, {b: false, color: DOCX_COLORS.muted});
  if (c.contains('r-dnum')) Object.assign(g, {b: true, color: 'FFFFFF', fill: DOCX_COLORS.accent});
  return g;
}
function docxRuns(node, f) {
  if (node.nodeType === 3) {
    const text = f.pre ? node.data.replace(/[ \t]+/g, ' ') : node.data.replace(/\s+/g, ' ');
    return text.split('\n').flatMap((t, i) => [...(i ? [{br: true, f}] : []), ...(t ? [{t, f}] : [])]);
  }
  if (node.nodeType !== 1) return [];
  if (node.tagName === 'BR') return [{br: true, f}];
  const g = docxFormat(node, f), runs = [...node.childNodes].flatMap(n => docxRuns(n, g));
  // The D-number badge is followed by a space; the tags under an action start a new line.
  if (node.classList.contains('r-dnum')) runs.push({t: ' ', f});
  if (node.classList.contains('r-tags') && runs.length) runs.unshift({br: true, f});
  return runs;
}
function docxRunXml(r) {
  const f = r.f, pr = [f.mono && '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>', f.b && '<w:b/>', f.i && '<w:i/>', f.caps && '<w:caps/>',
    f.strike && '<w:strike/>', f.color && `<w:color w:val="${f.color}"/>`, f.size && `<w:sz w:val="${f.size}"/>`, f.fill && `<w:shd w:val="clear" w:color="auto" w:fill="${f.fill}"/>`].filter(Boolean).join('');
  return `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}${r.br ? '<w:br/>' : `<w:t xml:space="preserve">${xmlText(r.t)}</w:t>`}</w:r>`;
}
// A paragraph from its runs, trimmed at both ends; null when nothing is left.
function docxPara(runs, pPr = '') {
  runs = runs.slice();
  while (runs.length && (runs[0].br || !runs[0].t.trim())) runs.shift();
  while (runs.length && (runs.at(-1).br || !runs.at(-1).t.trim())) runs.pop();
  if (!runs.length) return null;
  runs[0] = {...runs[0], t: runs[0].t.trimStart()};
  runs[runs.length - 1] = {...runs.at(-1), t: runs.at(-1).t.trimEnd()};
  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${runs.map(docxRunXml).join('')}</w:p>`;
}
const pStyle = id => `<w:pStyle w:val="${id}"/>`;

// The document being written: its blocks, pictures, and numbered lists.
class DocxWriter {
  constructor(pictures) {
    this.pictures = pictures;   // svg element -> {name, rid, w, h}
    this.lists = 0;
    this.pageBreak = false;     // the next paragraph starts a new page
    this.first = true;
  }
  pPr(extra = '') {
    const brk = this.pageBreak && !this.first ? '<w:pageBreakBefore/>' : '';
    this.pageBreak = false;
    return extra.replace(/^(<w:pStyle [^>]+>)?(<w:keepNext\/>)?/, m => m + brk);
  }
  // Only a paragraph with text takes the page break, so blank space between elements does not use it up.
  para(runs, extra) {
    if (!docxPara(runs)) return null;
    this.first = false;
    return docxPara(runs, this.pPr(extra));
  }
  // The blocks of an element's children: inline content gathers into paragraphs with the given properties.
  children(el, ctx, extra = '') {
    const out = [];
    let runs = [];
    const flush = () => { const p = runs.length && this.para(runs, extra); if (p) out.push(p); runs = []; };
    for (const n of el.childNodes) {
      if (n.nodeType === 1 && this.isBlock(n)) { flush(); out.push(...this.block(n, ctx)); }
      else runs.push(...docxRuns(n, ctx.f));
    }
    flush();
    return out;
  }
  isBlock(n) {
    return ['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'TABLE', 'FIGURE', 'FIGCAPTION', 'DL', 'SECTION', 'HEADER'].includes(n.tagName)
      || n.tagName === 'svg';
  }
  block(el, ctx) {
    const t = el.tagName, c = el.classList, f = docxFormat(el, ctx.f), sub = {...ctx, f};
    if (c.contains('r-foot')) return [];
    if (t === 'SECTION') {
      if (c.contains('r-page')) this.pageBreak = true;
      return this.children(el, sub);
    }
    if (t === 'HEADER') {
      const out = this.children(el, sub);
      return [...out, `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="18" w:space="1" w:color="${DOCX_COLORS.red}"/></w:pBdr><w:spacing w:after="240"/></w:pPr></w:p>`];
    }
    if (t === 'H1') return this.children(el, sub, pStyle('Title'));
    if (t === 'H2') return this.children(el, sub, pStyle('Heading1'));
    if (t === 'H3') return this.children(el, sub, pStyle('Heading2'));
    if (t === 'H4') return this.children(el, sub, pStyle('Heading3'));
    if (c.contains('r-kicker')) return this.children(el, sub, pStyle('Kicker'));
    if (t === 'FIGCAPTION' || c.contains('r-legend')) return this.children(el, sub, pStyle('Caption'));
    if (c.contains('r-read')) return this.children(el, {...sub, f: {...f, pre: true}});
    if (c.contains('r-chain') && ctx.list) return this.children(el, sub, `${pStyle('ListDetail')}`);
    if (t === 'P') return this.children(el, sub, ctx.cell ? pStyle('TableText') : '');
    if (t === 'UL' || t === 'OL') {
      const num = t === 'UL' ? 1 : 2 + this.lists++;
      return [...el.children].flatMap(li => this.children(li, {...sub, list: true}, `${pStyle('ListParagraph')}<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${num}"/></w:numPr>`));
    }
    if (t === 'DL') return [this.grid(el, sub)];
    if (t === 'TABLE') return [this.table(el, sub)];
    if (t === 'FIGURE' || t === 'svg') {
      // A chart split into parts has one part on each page, as in print.
      if (el.previousElementSibling?.tagName === 'FIGURE') this.pageBreak = true;
      const svg = t === 'svg' ? el : el.querySelector('svg');
      const out = svg ? [this.picture(svg)] : [];
      return [...out, ...[...el.children].filter(n => n.tagName === 'FIGCAPTION').flatMap(n => this.block(n, sub))];
    }
    return this.children(el, sub, ctx.cell ? pStyle('TableText') : '');
  }
  picture(svg) {
    const pic = this.pictures.get(svg);
    if (!pic) return '';
    // Fit the text width, and the page height less room for a heading.
    const maxW = DOCX_TEXT_W * EMU_PER_TWIP, maxH = (DOCX_PAGE.h - 2 * DOCX_PAGE.margin - 1400) * EMU_PER_TWIP;
    const k = Math.min(1, maxW / (pic.w * EMU_PER_PX), maxH / (pic.h * EMU_PER_PX));
    const cx = Math.round(pic.w * EMU_PER_PX * k), cy = Math.round(pic.h * EMU_PER_PX * k);
    this.first = false;
    return `<w:p><w:pPr>${this.pPr('<w:keepNext/><w:jc w:val="center"/>')}</w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/>
      <wp:docPr id="${pic.id}" name="${pic.name}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
      <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${pic.id}" name="${pic.name}"/><pic:cNvPicPr/></pic:nvPicPr>
      <pic:blipFill><a:blip r:embed="${pic.rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
      <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  }
  // A description list: a grid of label and value, four or two across; a list of them, label beside value.
  grid(el, ctx) {
    const items = [...el.children].map(d => [d.querySelector('dt'), d.querySelector('dd')]).filter(([dt]) => dt);
    const cell = (blocks, w) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr>${blocks.join('') || '<w:p/>'}</w:tc>`;
    const value = dd => this.children(dd, {...ctx, cell: true, f: {...ctx.f, pre: true}}, pStyle('Value'));
    const label = dt => this.children(dt, {...ctx, cell: true}, pStyle('Label'));
    let rows, widths;
    if (el.classList.contains('r-list')) {
      widths = [2400, DOCX_TEXT_W - 2400];
      rows = items.map(([dt, dd]) => [label(dt), value(dd)]);
    } else {
      const n = el.classList.contains('two') ? 2 : 4;
      widths = Array(n).fill(Math.floor(DOCX_TEXT_W / n));
      rows = [];
      for (let i = 0; i < items.length; i += n) rows.push(Array.from({length: n}, (_, j) => items[i + j] ? [...label(items[i + j][0]), ...value(items[i + j][1])] : []));
    }
    this.first = false;
    return `<w:tbl><w:tblPr><w:tblW w:w="${DOCX_TEXT_W}" w:type="dxa"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblLayout w:type="fixed"/>
      <w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="160" w:type="dxa"/></w:tblCellMar></w:tblPr>
      <w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>
      ${rows.map(r => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${r.map((b, i) => cell(b, widths[i])).join('')}</w:tr>`).join('')}</w:tbl>${this.spacer()}`;
  }
  // A table: the header row repeats on each page; column widths follow the length of their contents.
  table(el, ctx) {
    const head = [...el.querySelectorAll(':scope > thead > tr > th')], body = [...el.querySelectorAll(':scope > tbody > tr')];
    const cols = Math.max(head.length, ...body.map(r => r.children.length));
    const weight = Array.from({length: cols}, (_, i) => Math.max(5, Math.min(48, Math.max(head[i]?.textContent.trim().length || 0,
      ...body.map(r => Math.sqrt((r.children[i]?.textContent.trim().length || 0) * 22))))));
    const total = weight.reduce((a, b) => a + b, 0), widths = weight.map(w => Math.floor(DOCX_TEXT_W * w / total));
    const tc = (blocks, w, pr = '') => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${pr}</w:tcPr>${blocks.join('') || '<w:p><w:pPr>' + pStyle('TableText') + '</w:pPr></w:p>'}</w:tc>`;
    const cellCtx = {...ctx, cell: true, f: {...ctx.f, pre: true}};
    const headRow = head.length ? `<w:tr><w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>${head.map((th, i) =>
      tc(this.children(th, {...ctx, cell: true}, pStyle('TableHead')), widths[i], `<w:shd w:val="clear" w:color="auto" w:fill="${DOCX_COLORS.head}"/>`)).join('')}</w:tr>` : '';
    const rows = body.map(tr => {
      const signature = tr.querySelector('.r-signature');
      const cells = [...tr.children].map((td, i) => tc(this.children(td, cellCtx, pStyle('TableText') + (td.classList.contains('r-mark') ? '<w:jc w:val="center"/>' : '')), widths[i]));
      for (let i = cells.length; i < cols; i++) cells.push(tc([], widths[i]));
      return `<w:tr><w:trPr><w:cantSplit/>${signature ? '<w:trHeight w:val="760"/>' : ''}</w:trPr>${cells.join('')}</w:tr>`;
    });
    this.first = false;
    return `<w:tbl><w:tblPr><w:tblW w:w="${DOCX_TEXT_W}" w:type="dxa"/>
      <w:tblBorders><w:top w:val="single" w:sz="6" w:color="${DOCX_COLORS.rule}"/><w:left w:val="nil"/><w:bottom w:val="single" w:sz="4" w:color="${DOCX_COLORS.line}"/><w:right w:val="nil"/>
      <w:insideH w:val="single" w:sz="4" w:color="${DOCX_COLORS.line}"/><w:insideV w:val="nil"/></w:tblBorders><w:tblLayout w:type="fixed"/>
      <w:tblCellMar><w:top w:w="50" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="50" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr>
      <w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${headRow}${rows.join('')}</w:tbl>${this.spacer()}`;
  }
  // Word joins two tables that touch, and runs text into a table's edge: a small gap after each.
  spacer() { return '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="120" w:lineRule="exact"/></w:pPr></w:p>'; }
}

const DOCX_STYLES = (() => {
  const C = DOCX_COLORS;
  const style = (id, name, ppr, rpr, extra = '') => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/>${extra}<w:qFormat/>
    <w:pPr>${ppr}</w:pPr><w:rPr>${rpr}</w:rPr></w:style>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${W_NS}>
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:color w:val="${C.ink}"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-GB"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
  ${style('Title', 'Title', '<w:spacing w:before="60" w:after="200"/>', '<w:b/><w:sz w:val="40"/>')}
  ${style('Kicker', 'Kicker', '<w:spacing w:before="0" w:after="60"/>', `<w:b/><w:caps/><w:color w:val="${C.muted}"/><w:spacing w:val="10"/><w:sz w:val="17"/>`)}
  ${style('Heading1', 'heading 1', `<w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="10" w:space="3" w:color="${C.accent}"/></w:pBdr><w:spacing w:before="280" w:after="160"/><w:outlineLvl w:val="0"/>`, `<w:b/><w:color w:val="${C.accent}"/><w:sz w:val="27"/>`, '<w:next w:val="Normal"/>')}
  ${style('Heading2', 'heading 2', '<w:keepNext/><w:spacing w:before="220" w:after="100"/><w:outlineLvl w:val="1"/>', '<w:b/><w:sz w:val="22"/>', '<w:next w:val="Normal"/>')}
  ${style('Heading3', 'heading 3', '<w:keepNext/><w:spacing w:before="160" w:after="60"/><w:outlineLvl w:val="2"/>', '<w:b/><w:color w:val="3D4F60"/><w:sz w:val="19"/>', '<w:next w:val="Normal"/>')}
  ${style('Caption', 'caption', '<w:spacing w:before="60" w:after="120"/>', `<w:color w:val="${C.muted}"/><w:sz w:val="16"/>`)}
  ${style('Label', 'Label', '<w:keepNext/><w:spacing w:before="60" w:after="0"/>', `<w:b/><w:caps/><w:color w:val="${C.muted}"/><w:sz w:val="15"/>`)}
  ${style('Value', 'Value', '<w:spacing w:before="20" w:after="80"/>', '')}
  ${style('TableText', 'Table text', '<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>', '<w:sz w:val="17"/>')}
  ${style('TableHead', 'Table head', '<w:keepNext/><w:spacing w:before="0" w:after="0"/>', `<w:b/><w:caps/><w:color w:val="3D4F60"/><w:sz w:val="14"/>`)}
  ${style('ListParagraph', 'List Paragraph', '<w:spacing w:after="60"/><w:ind w:left="360" w:hanging="260"/>', '')}
  ${style('ListDetail', 'List detail', '<w:spacing w:before="0" w:after="80"/><w:ind w:left="360"/>', `<w:color w:val="${C.muted}"/><w:sz w:val="17"/>`)}
</w:styles>`;
})();

function docxNumbering(lists) {
  const level = (fmt, text) => `<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="260"/></w:pPr>${fmt === 'bullet' ? `<w:rPr><w:color w:val="${DOCX_COLORS.accent}"/></w:rPr>` : ''}</w:lvl>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering ${W_NS}>
  <w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/>${level('bullet', '•')}</w:abstractNum>
  <w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/>${level('decimal', '%1.')}</w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  ${Array.from({length: lists}, (_, i) => `<w:num w:numId="${i + 2}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`).join('')}
</w:numbering>`;
}

const docxFooter = kind => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr ${W_NS}><w:p><w:pPr><w:tabs><w:tab w:val="right" w:pos="${DOCX_TEXT_W}"/></w:tabs><w:spacing w:after="0"/></w:pPr>
  ${[`${rcaName()} · ${kind}`].map(t => `<w:r><w:rPr><w:color w:val="${DOCX_COLORS.muted}"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">${xmlText(t)}</w:t></w:r>`).join('')}
  <w:r><w:rPr><w:color w:val="${DOCX_COLORS.muted}"/><w:sz w:val="16"/></w:rPr><w:tab/><w:t xml:space="preserve">Page </w:t></w:r>
  <w:fldSimple w:instr=" PAGE "><w:r><w:rPr><w:color w:val="${DOCX_COLORS.muted}"/><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>
  <w:r><w:rPr><w:color w:val="${DOCX_COLORS.muted}"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve"> of </w:t></w:r>
  <w:fldSimple w:instr=" NUMPAGES "><w:r><w:rPr><w:color w:val="${DOCX_COLORS.muted}"/><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>
</w:p></w:ftr>`;

const DOCX_REPORTS = {full: {kind: 'Root cause analysis', file: 'report'}, '8d': {kind: '8D report', file: '8D'}};

// The report as a .docx blob. The charts in it are drawn into PNG pictures first.
async function docxReport(layout) {
  const box = document.createElement('div');
  box.innerHTML = REPORTS[layout]();
  const pictures = new Map(), media = [];
  for (const svg of box.querySelectorAll('svg')) {
    const png = await svgPng(new XMLSerializer().serializeToString(svg));
    const n = media.length + 1;
    media.push({name: `word/media/image${n}.png`, data: new Uint8Array(await png.blob.arrayBuffer())});
    pictures.set(svg, {id: n, rid: `rIdImage${n}`, name: `Figure ${n}`, w: png.w, h: png.h});
  }
  const w = new DocxWriter(pictures), body = w.children(box, {f: {}}).join('\n');
  const {kind} = DOCX_REPORTS[layout], title = `${kind}: ${primaryEffect()?.title || 'Untitled RCA'}`;
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${W_NS} xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>
${body}
<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="${DOCX_PAGE.w}" w:h="${DOCX_PAGE.h}" w:orient="landscape"/>
<w:pgMar w:top="${DOCX_PAGE.margin}" w:right="${DOCX_PAGE.margin}" w:bottom="${DOCX_PAGE.margin}" w:left="${DOCX_PAGE.margin}" w:header="567" w:footer="510" w:gutter="0"/></w:sectPr>
</w:body></w:document>`;
  const rel = (id, type, target) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;
  return zipBlob([
    {name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`},
    {name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'officeDocument', 'word/document.xml')}
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`},
    {name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${xmlText(title)}</dc:title><dc:subject>${xmlText(state.meta.rcaNumber)}</dc:subject><dc:creator>Causeway</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`},
    {name: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rIdStyles', 'styles', 'styles.xml')}${rel('rIdNumbering', 'numbering', 'numbering.xml')}${rel('rIdFooter', 'footer', 'footer1.xml')}
  ${[...pictures.values()].map(p => rel(p.rid, 'image', `media/image${p.id}.png`)).join('')}</Relationships>`},
    {name: 'word/document.xml', data: docXml},
    {name: 'word/styles.xml', data: DOCX_STYLES},
    {name: 'word/numbering.xml', data: docxNumbering(w.lists)},
    {name: 'word/footer1.xml', data: docxFooter(kind)},
    ...media,
  ], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}

async function exportDocx(layout) {
  showMenu(false);
  const name = `${baseName()}-${DOCX_REPORTS[layout].file}.docx`;
  setStatus(`Writing ${name}…`);
  try {
    download(name, await docxReport(layout));
    setStatus(`Exported ${name}`);
  } catch (err) {
    setStatus('Export failed');
    alert('Could not write the Word report: ' + err.message);
  }
}
$('exportDocxFull').onclick = () => exportDocx('full');
$('exportDocx8d').onclick = () => exportDocx('8d');
