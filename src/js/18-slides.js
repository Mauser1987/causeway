// PowerPoint decks, written here without any library: the full report, the 8D, and the one-page summary.
//
// As with the Word report, the slides are made from the printed report's markup, so all three agree.
// The markup is read into blocks (text, grids, tables, pictures), and the blocks flow down the slide,
// onto further slides when they run out of room: each report section starts a slide, and a long table
// continues on the next with its header repeated. Positions and sizes are in points; 16:9 slides.

const SLIDE = {w: 960, h: 540, x: 36, top: 84, bottom: 498};
const EMU_PER_PT = 12700;
const emu = pt => Math.round(pt * EMU_PER_PT);
const P_NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const SLIDE_FONT = 'Arial, "Liberation Sans", Helvetica, sans-serif';   // measured in place of Calibri, then narrowed to it

// How many lines a paragraph takes at a width, wrapping at spaces as PowerPoint does.
function slideLines(runs, size, width) {
  // Measured as Arial, plus a margin: Calibri is narrower, but where it is missing the stand-in can be
  // wider. Too generous leaves some white space; too tight lets text run into the next block.
  const scale = 1.08;
  let lines = 1, x = 0;
  for (const r of runs) {
    if (r.br) { lines++; x = 0; continue; }
    const sz = r.f.size ? size * 0.85 : size, weight = r.f.b ? 700 : 400;
    for (const word of r.t.split(/(?<= )/)) {
      const w = textWidth(word, sz, weight, r.f.mono ? MONO_FONT : SLIDE_FONT) * scale;
      if (x + w > width && x > 0 && word.trim()) { lines++; x = textWidth(word.trimStart(), sz, weight, SLIDE_FONT) * scale; }
      else x += w;
      while (x > width) { lines++; x -= width; }   // a word longer than the line breaks inside it
    }
  }
  return lines;
}
// A paragraph: its runs and how it looks. Its height at a width, and its DrawingML.
const para = (runs, o = {}) => ({runs, size: 11, after: 3, ...o});
const paraHeight = (p, width, k) => slideLines(p.runs, p.size * k, width - (p.bullet ? 14 : 0)) * p.size * k * 1.28 + p.after * k;
const parasHeight = (ps, width, k) => ps.reduce((h, p) => h + paraHeight(p, width, k), 0);
function trimRuns(runs) {
  runs = runs.slice();
  while (runs.length && (runs[0].br || !runs[0].t.trim())) runs.shift();
  while (runs.length && (runs.at(-1).br || !runs.at(-1).t.trim())) runs.pop();
  if (runs.length) {
    runs[0] = {...runs[0], t: runs[0].t.trimStart()};
    runs[runs.length - 1] = {...runs.at(-1), t: runs.at(-1).t.trimEnd()};
  }
  return runs;
}
function runXml(r, p, k) {
  const sz = Math.round((r.f.size ? p.size * 0.85 : p.size) * k * 100);
  const color = r.f.color || p.color || DOCX_COLORS.ink, b = r.f.b || p.b, caps = r.f.caps || p.caps;
  const pr = `lang="en-GB" sz="${sz}"${b ? ' b="1"' : ''}${r.f.i ? ' i="1"' : ''}${r.f.strike ? ' strike="sngStrike"' : ''}${caps ? ' cap="all" spc="60"' : ''} dirty="0"`;
  const inner = `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="${r.f.mono ? 'Consolas' : '+mn-lt'}"/>`;
  return r.br ? `<a:br><a:rPr ${pr}>${inner}</a:rPr></a:br>` : `<a:r><a:rPr ${pr}>${inner}</a:rPr><a:t>${xmlText(r.t)}</a:t></a:r>`;
}
function paraXml(p, k) {
  const bullet = p.bullet === '1.' ? `<a:buFont typeface="+mj-lt"/><a:buAutoNum type="arabicPeriod"${p.start > 1 ? ` startAt="${p.start}"` : ''}/>`
    : p.bullet ? `<a:buClr><a:srgbClr val="${DOCX_COLORS.accent}"/></a:buClr><a:buFont typeface="Arial"/><a:buChar char="•"/>` : '<a:buNone/>';
  const ind = p.bullet ? ` marL="${emu(14)}" indent="${emu(-14)}"` : p.indent ? ` marL="${emu(p.indent)}"` : '';
  return `<a:p><a:pPr${ind}${p.align ? ` algn="${p.align}"` : ''}><a:lnSpc><a:spcPct val="100000"/></a:lnSpc><a:spcBef><a:spcPts val="0"/></a:spcBef><a:spcAft><a:spcPts val="${Math.round(p.after * k * 100)}"/></a:spcAft>${bullet}</a:pPr>`
    + `${p.runs.map(r => runXml(r, p, k)).join('')}<a:endParaRPr lang="en-GB" sz="${Math.round(p.size * k * 100)}" dirty="0"/></a:p>`;
}

// ---- Shapes ----

class SlideShapes {
  constructor() { this.xml = []; this.id = 2; this.pictures = []; }
  frame(x, y, w, h) { return `<a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm>`; }
  text(x, y, w, h, paras, k = 1, {fill, anchor = 't'} = {}) {
    const id = this.id++;
    this.xml.push(`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Text ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
      <p:spPr>${this.frame(x, y, w, h)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fill ? `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>` : '<a:noFill/>'}</p:spPr>
      <p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="${anchor}"><a:noAutofit/></a:bodyPr><a:lstStyle/>${paras.map(p => paraXml(p, k)).join('')}</p:txBody></p:sp>`);
  }
  rect(x, y, w, h, fill) {
    const id = this.id++;
    this.xml.push(`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Shape ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
      <p:spPr>${this.frame(x, y, w, h)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>`);
  }
  picture(x, y, w, h, pic) {
    const id = this.id++, rid = `rIdPic${this.pictures.length + 1}`;
    this.pictures.push({rid, pic});
    this.xml.push(`<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Picture ${id}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>
      <p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${this.frame(x, y, w, h)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`);
  }
  table(x, y, widths, rows, k) {
    const id = this.id++, line = (tag, color) => color ? `<a:${tag} w="6350"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:${tag}>` : `<a:${tag} w="0"><a:noFill/></a:${tag}>`;
    const total = widths.reduce((a, b) => a + b, 0), height = rows.reduce((a, r) => a + r.h, 0);
    this.xml.push(`<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="Table ${id}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>
      <p:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(total)}" cy="${emu(height)}"/></p:xfrm>
      <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1"/>
      <a:tblGrid>${widths.map(w => `<a:gridCol w="${emu(w)}"/>`).join('')}</a:tblGrid>
      ${rows.map(r => `<a:tr h="${emu(r.h)}">${r.cells.map(c => `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>${(c.length ? c : [para([], {size: 9})]).map(p => paraXml(p, k)).join('')}</a:txBody>
        <a:tcPr marL="${emu(4)}" marR="${emu(4)}" marT="${emu(3)}" marB="${emu(3)}">${line('lnL')}${line('lnR')}${line('lnT', r.head ? DOCX_COLORS.rule : null)}${line('lnB', DOCX_COLORS.line)}${r.head ? `<a:solidFill><a:srgbClr val="${DOCX_COLORS.head}"/></a:solidFill>` : '<a:noFill/>'}</a:tcPr></a:tc>`).join('')}</a:tr>`).join('')}
      </a:tbl></a:graphicData></a:graphic></p:graphicFrame>`);
  }
}

// ---- Blocks ----
// Each block measures its height at a width and scale, draws itself, and, if it can, splits to fit a height.

const textBlock = (paras, keep = false) => ({
  keep,   // a heading: kept with the block after it
  height: (w, k) => parasHeight(paras, w, k),
  draw: (s, x, y, w, k) => s.text(x, y, w, parasHeight(paras, w, k), paras, k),
});

function gridBlock(items, cols) {
  const rowsOf = (w, k) => {
    const cw = w / cols, rows = [];
    for (let i = 0; i < items.length; i += cols) {
      const row = items.slice(i, i + cols);
      rows.push({row, h: Math.max(...row.map(it => parasHeight(it, cw - 10, k))) + 4 * k});
    }
    return rows;
  };
  const block = rows => ({
    height: (w, k) => rows(w, k).reduce((a, r) => a + r.h, 0),
    draw: (s, x, y, w, k) => {
      for (const r of rows(w, k)) {
        r.row.forEach((it, j) => s.text(x + j * w / cols, y, w / cols - 10, r.h, it, k));
        y += r.h;
      }
    },
    split: (w, k, room) => {
      const all = rows(w, k);
      let n = 0, h = 0;
      while (n < all.length && h + all[n].h <= room) h += all[n++].h;
      if (!n || n === all.length) return null;
      const keep = all.slice(0, n).flatMap(r => r.row), rest = all.slice(n).flatMap(r => r.row);
      return [gridBlock(keep, cols), gridBlock(rest, cols)];
    },
  });
  return block(rowsOf);
}

function tableBlock(head, body, weights) {
  const widths = w => { const t = weights.reduce((a, b) => a + b, 0); return weights.map(x => w * x / t); };
  const rowH = (cells, ws, k) => Math.max(...cells.map((c, i) => parasHeight(c, ws[i] - 10, k))) + 8;
  const rows = (w, k, list) => { const ws = widths(w); return list.map(cells => ({cells, h: rowH(cells, ws, k)})); };
  return {
    height: (w, k) => (head ? rows(w, k, [head])[0].h : 0) + rows(w, k, body).reduce((a, r) => a + r.h, 0),
    draw: (s, x, y, w, k) => s.table(x, y, widths(w), [...(head ? [{...rows(w, k, [head])[0], head: true}] : []), ...rows(w, k, body)], k),
    split: (w, k, room, fresh) => {
      const all = rows(w, k, body);
      let n = 0, h = head ? rows(w, k, [head])[0].h : 0;
      while (n < all.length && h + all[n].h <= room) h += all[n++].h;
      // A table does not start with fewer than three rows at the foot of a slide.
      if (!n || n < Math.min(3, all.length - 1) && !fresh || n === all.length) return null;
      return [tableBlock(head, body.slice(0, n), weights), tableBlock(head, body.slice(n), weights)];
    },
  };
}

// A picture fills the width, or the height left on a slide; it moves to a new slide rather than shrink below half.
function pictureBlock(pic, caption) {
  const capH = (w, k) => caption ? parasHeight(caption, w, k) + 4 : 0;
  const full = (w, k) => Math.min(w / pic.w, (SLIDE.bottom - SLIDE.top - capH(w, k)) / pic.h, 1.2);
  return {
    picture: true,
    height: (w, k) => pic.h * full(w, k) + capH(w, k),
    minHeight: (w, k) => pic.h * full(w, k) * 0.5 + capH(w, k),
    draw: (s, x, y, w, k, room) => {
      const scale = Math.min(full(w, k), ((room ?? Infinity) - capH(w, k)) / pic.h), pw = pic.w * scale, ph = pic.h * scale;
      s.picture(x + (w - pw) / 2, y, pw, ph, pic);
      if (caption) s.text(x, y + ph + 4, w, capH(w, k) - 4, caption, k);
      return ph + capH(w, k);
    },
  };
}

// ---- From the report markup to blocks ----

const slideRuns = (el, f = {}) => trimRuns([...el.childNodes].flatMap(n => docxRuns(n, f)));
// An element's text as paragraphs: inline content in one, each block child in its own.
function slideParas(el, o, f = {}) {
  const out = [];
  let runs = [];
  const flush = () => { const r = trimRuns(runs); if (r.length) out.push(para(r, o)); runs = []; };
  for (const n of el.childNodes) {
    if (n.nodeType === 1 && ['DIV', 'P', 'UL', 'OL'].includes(n.tagName)) {
      flush();
      const detail = n.classList.contains('r-chain');
      out.push(...slideParas(n, detail ? {...o, bullet: null, indent: o.bullet ? 14 : 0, size: o.size * 0.85, color: DOCX_COLORS.muted} : o, docxFormat(n, f)));
    } else runs.push(...docxRuns(n, f));
  }
  flush();
  return out;
}
const columnWeights = (head, body) => Array.from({length: Math.max(head.length, ...body.map(r => r.length))}, (_, i) =>
  Math.max(5, Math.min(48, Math.max(head[i]?.textContent.trim().length || 0, ...body.map(r => Math.sqrt((r[i]?.textContent.trim().length || 0) * 22))))));

// The blocks of one report section. A chart split into page-sized parts for print becomes one picture.
function slideBlocks(el, pictures, size, state = {chart: false}) {
  const blocks = [];
  for (const n of el.children) {
    const t = n.tagName, c = n.classList;
    if (c.contains('r-foot') || t === 'H2') continue;
    if (t === 'H3') blocks.push(textBlock([para(slideRuns(n, {}), {size: size + 2.5, b: true, after: 4, color: DOCX_COLORS.ink})], true));
    else if (t === 'H4') blocks.push(textBlock([para(slideRuns(n, {}), {size: size, b: true, after: 2, color: '3D4F60'})], true));
    else if (t === 'P') blocks.push(textBlock(slideParas(n, c.contains('r-legend') ? {size: size - 2, color: DOCX_COLORS.muted} : {size, after: 6}, docxFormat(n, {pre: c.contains('r-read')}))));
    else if (t === 'UL' || t === 'OL') blocks.push(textBlock([...n.children].flatMap(li => slideParas(li, {size, bullet: t === 'OL' ? '1.' : '•', after: 4}))));
    else if (t === 'DL') {
      const items = [...n.children].filter(d => d.querySelector('dt')).map(d => [
        para(slideRuns(d.querySelector('dt')), {size: size - 3.5, b: true, caps: true, color: DOCX_COLORS.muted, after: 1}),
        ...slideParas(d.querySelector('dd'), {size, after: 2}, {pre: true})]);
      blocks.push(gridBlock(items, c.contains('r-list') ? 1 : c.contains('two') ? 2 : 4));
    } else if (t === 'TABLE') {
      const head = [...n.querySelectorAll(':scope > thead > tr > th')], body = [...n.querySelectorAll(':scope > tbody > tr')].map(r => [...r.children]);
      const cell = (td, o) => slideParas(td, {after: 0, ...o}, {pre: true});
      blocks.push(tableBlock(head.length ? head.map(th => cell(th, {size: size - 3.5, b: true, caps: true, color: '3D4F60'})) : null,
        body.map(r => r.map(td => cell(td, {size: size - 2, align: td.classList.contains('r-mark') ? 'ctr' : undefined}))), columnWeights(head, body)));
    } else if (t === 'FIGURE') {
      const svg = n.querySelector('svg'), pic = svg && pictures.get(svg);
      if (!pic) continue;
      if (pic.chart) { if (!state.chart) { state.chart = true; blocks.push(pictureBlock(pictures.get('chart'), null)); } continue; }
      const cap = n.querySelector('figcaption');
      blocks.push(pictureBlock(pic, cap ? [para(slideRuns(cap), {size: size - 2, color: DOCX_COLORS.muted})] : null));
    } else blocks.push(...slideBlocks(n, pictures, size, state));
  }
  return blocks;
}

// ---- Laying out the slides ----

// Flows blocks down the given columns of a slide, onto new slides as needed. Returns the slides' shapes.
function flowSlides(blocks, {title, columns, k = 1, newSlide}) {
  const slides = [];
  let s, col, y;
  const start = cont => { s = newSlide(title, cont, slides.length); slides.push(s); col = 0; y = columns[0].top ?? SLIDE.top; };
  const next = () => { if (++col < columns.length) y = columns[col].top ?? SLIDE.top; else start(true); };
  start(false);
  const queue = blocks.slice();
  while (queue.length) {
    const b = queue.shift(), {x, w} = columns[col], bottom = columns[col].bottom ?? SLIDE.bottom, room = bottom - y;
    let h = b.height(w, k);
    const fresh = y === (columns[col].top ?? SLIDE.top);
    // A heading goes with the start of the block after it: it moves on unless that block can start below it.
    const after = queue[0], left = room - h - 8 * k;
    if (b.keep && after && !fresh && !(after.picture ? after.minHeight(w, k) <= left : after.height(w, k) <= left || after.split?.(w, k, left, false))) {
      queue.unshift(b); next(); continue;
    }
    if (h <= room || fresh && !b.split && !b.picture) { b.draw(s, x, y, w, k, room); y += b.height(w, k) + 8 * k; continue; }
    if (b.picture && (b.minHeight(w, k) <= room || fresh)) { y += b.draw(s, x, y, w, k, room) + 8 * k; continue; }
    // A short paragraph that runs a little past the foot stays, rather than go alone onto a slide.
    if (!b.split && !b.picture && !b.keep && h <= room + 12 && h < 40) { b.draw(s, x, y, w, k, room); y += h + 8 * k; continue; }
    const parts = b.split?.(w, k, room, fresh);
    if (parts) { parts[0].draw(s, x, y, w, k); queue.unshift(parts[1]); next(); continue; }
    if (fresh) { b.draw(s, x, y, w, k, room); y += b.height(w, k) + 8 * k; continue; }
    queue.unshift(b);
    next();
  }
  return slides;
}

// A content slide: the section's title with a rule under it, and the footer.
function contentSlide(kind) {
  return (title, cont) => {
    const s = new SlideShapes();
    s.title = title;
    // The title takes one line: a long one is set smaller.
    const runs = [...title, ...(cont ? [{t: '  continued', f: {color: DOCX_COLORS.muted, size: 15}}] : [])], w = SLIDE.w - 2 * SLIDE.x;
    const size = [22, 20, 18, 16, 15, 14].find(sz => slideLines(runs, sz, w) === 1) || 14;
    s.text(SLIDE.x, 22, w, 38, [para(runs, {size, b: true, color: DOCX_COLORS.accent, after: 0})], 1, {anchor: 'b'});
    s.rect(SLIDE.x, 64, SLIDE.w - 2 * SLIDE.x, 1.5, DOCX_COLORS.accent);
    s.kind = kind;
    return s;
  };
}
function slideFooters(slides, kind) {
  slides.forEach((s, i) => {
    s.text(SLIDE.x, 512, 700, 14, [para([{t: `${rcaName()} · ${kind}`, f: {}}], {size: 8, color: DOCX_COLORS.muted, after: 0})]);
    s.text(SLIDE.w - SLIDE.x - 100, 512, 100, 14, [para([{t: `${i + 1} / ${slides.length}`, f: {}}], {size: 8, color: DOCX_COLORS.muted, after: 0, align: 'r'})]);
  });
}

// The cover: kicker, title, a red rule, the references, and the team.
function coverSlide(header, after) {
  const s = new SlideShapes();
  s.rect(0, 0, 10, SLIDE.h, DOCX_COLORS.red);
  const kicker = para(slideRuns(header.querySelector('.r-kicker')), {size: 11, b: true, caps: true, color: DOCX_COLORS.muted, after: 6});
  const title = para(slideRuns(header.querySelector('h1')), {size: 30, b: true, after: 0});
  const w = SLIDE.w - 2 * SLIDE.x - 20, x = SLIDE.x + 20;
  let y = 70;
  s.text(x, y, w, 20, [kicker]); y += 22;
  const th = paraHeight(title, w, 1);
  s.text(x, y, w, th, [title]); y += th + 14;
  s.rect(x, y, w, 2.5, DOCX_COLORS.red); y += 22;
  for (const dl of [header.querySelector('dl'), after].filter(Boolean)) {
    const b = slideBlocks({children: [dl]}, new Map(), 12)[0];
    b.draw(s, x, y, w, 1);
    y += b.height(w, 1) + 14;
  }
  return s;
}

// ---- The package ----

const PPTX_THEME = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Causeway"><a:themeElements>
  <a:clrScheme name="Causeway"><a:dk1><a:srgbClr val="16232F"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="084F54"/></a:dk2><a:lt2><a:srgbClr val="F3F6F9"/></a:lt2>
    <a:accent1><a:srgbClr val="0B5F66"/></a:accent1><a:accent2><a:srgbClr val="B3261E"/></a:accent2><a:accent3><a:srgbClr val="C2570C"/></a:accent3><a:accent4><a:srgbClr val="2F8A3E"/></a:accent4>
    <a:accent5><a:srgbClr val="7B5AB7"/></a:accent5><a:accent6><a:srgbClr val="5B6B7A"/></a:accent6><a:hlink><a:srgbClr val="0B5F66"/></a:hlink><a:folHlink><a:srgbClr val="7B5AB7"/></a:folHlink></a:clrScheme>
  <a:fontScheme name="Causeway"><a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>
  <a:fmtScheme name="Causeway">
    <a:fillStyleLst>${'<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3)}</a:fillStyleLst>
    <a:lnStyleLst>${[6350, 12700, 19050].map(w => `<a:ln w="${w}"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>`).join('')}</a:lnStyleLst>
    <a:effectStyleLst>${'<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3)}</a:effectStyleLst>
    <a:bgFillStyleLst>${'<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3)}</a:bgFillStyleLst>
  </a:fmtScheme></a:themeElements></a:theme>`;
const PPTX_TREE = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
const PPTX_MASTER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster ${P_NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${PPTX_TREE}</p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
  <p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="2800"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles>
</p:sldMaster>`;
const PPTX_LAYOUT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout ${P_NS} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${PPTX_TREE}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;

async function pptxPackage(slides, title) {
  const rel = (id, type, target) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;
  const rels = body => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${body}</Relationships>`;
  const media = new Map();   // picture -> file name, so a picture used twice is stored once
  const files = [];
  slides.forEach((s, i) => {
    for (const {pic} of s.pictures) if (!media.has(pic)) media.set(pic, `image${media.size + 1}.png`);
    files.push({name: `ppt/slides/slide${i + 1}.xml`, data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld ${P_NS}><p:cSld><p:spTree>${PPTX_TREE}${s.xml.join('\n')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`});
    files.push({name: `ppt/slides/_rels/slide${i + 1}.xml.rels`, data: rels(rel('rIdLayout', 'slideLayout', '../slideLayouts/slideLayout1.xml')
      + s.pictures.map(p => rel(p.rid, 'image', `../media/${media.get(p.pic)}`)).join(''))});
  });
  const ct = 'application/vnd.openxmlformats-officedocument.presentationml';
  return zipBlob([
    {name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>
  <Override PartName="/ppt/presentation.xml" ContentType="${ct}.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="${ct}.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="${ct}.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/ppt/presProps.xml" ContentType="${ct}.presProps+xml"/>
  <Override PartName="/ppt/tableStyles.xml" ContentType="${ct}.tableStyles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  ${slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="${ct}.slide+xml"/>`).join('')}
</Types>`},
    {name: '_rels/.rels', data: rels(rel('rId1', 'officeDocument', 'ppt/presentation.xml')
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>')},
    {name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${xmlText(title)}</dc:title><dc:creator>Causeway</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`},
    {name: 'ppt/presentation.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation ${P_NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rIdMaster"/></p:sldMasterIdLst>
  <p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rIdSlide${i + 1}"/>`).join('')}</p:sldIdLst>
  <p:sldSz cx="${emu(SLIDE.w)}" cy="${emu(SLIDE.h)}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`},
    {name: 'ppt/_rels/presentation.xml.rels', data: rels(rel('rIdMaster', 'slideMaster', 'slideMasters/slideMaster1.xml') + rel('rIdTheme', 'theme', 'theme/theme1.xml')
      + rel('rIdPresProps', 'presProps', 'presProps.xml') + rel('rIdTableStyles', 'tableStyles', 'tableStyles.xml')
      + slides.map((_, i) => rel(`rIdSlide${i + 1}`, 'slide', `slides/slide${i + 1}.xml`)).join(''))},
    {name: 'ppt/presProps.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:presentationPr ${P_NS}/>`},
    {name: 'ppt/tableStyles.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>'},
    {name: 'ppt/slideMasters/slideMaster1.xml', data: PPTX_MASTER},
    {name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: rels(rel('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml') + rel('rId2', 'theme', '../theme/theme1.xml'))},
    {name: 'ppt/slideLayouts/slideLayout1.xml', data: PPTX_LAYOUT},
    {name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: rels(rel('rId1', 'slideMaster', '../slideMasters/slideMaster1.xml'))},
    {name: 'ppt/theme/theme1.xml', data: PPTX_THEME},
    ...files,
    ...[...media].map(([pic, name]) => ({name: `ppt/media/${name}`, data: pic.data})),
  ], `${ct}.presentation`);
}

// ---- The decks ----

const PPTX_REPORTS = {full: {kind: 'Root cause analysis', file: 'report'}, '8d': {kind: '8D report', file: '8D'}, summary: {kind: 'RCA summary', file: 'summary'}};

// The report's charts and figures as pictures. The cause-and-effect chart is drawn once, whole.
async function slidePictures(box) {
  const pictures = new Map(), png = async svgText => { const p = await svgPng(svgText); return {data: new Uint8Array(await p.blob.arrayBuffer()), w: p.w * 0.75, h: p.h * 0.75}; };
  for (const svg of box.querySelectorAll('figure svg')) {
    if (svg.querySelector('.node')) { pictures.set(svg, {chart: true}); continue; }
    pictures.set(svg, await png(new XMLSerializer().serializeToString(svg)));
  }
  if ([...pictures.values()].some(p => p.chart)) pictures.set('chart', await png(chartSvg(fullLayout(), {heading: false})));
  return pictures;
}

async function pptxReport(layout) {
  const box = document.createElement('div');
  box.innerHTML = REPORTS[layout]();
  const {kind} = PPTX_REPORTS[layout], pictures = await slidePictures(box);
  const full = [{x: SLIDE.x, w: SLIDE.w - 2 * SLIDE.x}];
  let slides = [];
  if (layout === 'summary') {
    // One slide, two columns, the text made smaller until it fits; a long RCA runs on to a second slide.
    const header = box.querySelector('header'), title = slideRuns(header.querySelector('h1'));
    const blocks = () => [...box.querySelectorAll('.r-block')].flatMap(b => {
      const h3 = b.querySelector('h3');
      return [textBlock([para(slideRuns(h3), {size: 13, b: true, color: DOCX_COLORS.accent, after: 3})], true), ...slideBlocks({children: [...b.children].filter(n => n !== h3)}, pictures, 11)];
    });
    const half = (SLIDE.w - 2 * SLIDE.x - 24) / 2, columns = [{x: SLIDE.x, w: half}, {x: SLIDE.x + half + 24, w: half}];
    const newSlide = (t, cont) => {
      const s = contentSlide(kind)(t, cont);
      s.text(SLIDE.x, 12, 600, 14, [para(slideRuns(header.querySelector('.r-kicker')), {size: 9, b: true, caps: true, color: DOCX_COLORS.muted, after: 0})]);
      return s;
    };
    for (const k of [1, 0.92, 0.85, 0.78, 0.72]) {
      slides = flowSlides(blocks(), {title, columns, k, newSlide});
      if (slides.length === 1) break;
    }
  } else {
    const header = box.querySelector('header');
    slides.push(coverSlide(header, header.nextElementSibling?.tagName === 'DL' ? header.nextElementSibling : null));
    for (const section of box.querySelectorAll(':scope > section')) {
      const h2 = section.querySelector(':scope > h2'), title = h2 ? slideRuns(h2, {}) : [{t: 'Sign-off', f: {}}];
      slides.push(...flowSlides(slideBlocks(section, pictures, 12), {title, columns: full, newSlide: contentSlide(kind)}));
    }
  }
  slideFooters(slides, kind);
  return pptxPackage(slides, `${kind}: ${primaryEffect()?.title || 'Untitled RCA'}`);
}

async function exportPptx(layout) {
  showMenu(false);
  const name = `${baseName()}-${PPTX_REPORTS[layout].file}.pptx`;
  setStatus(`Writing ${name}…`);
  try {
    download(name, await pptxReport(layout));
    setStatus(`Exported ${name}`);
  } catch (err) {
    setStatus('Export failed');
    alert('Could not write the PowerPoint deck: ' + err.message);
  }
}
$('exportPptxFull').onclick = () => exportPptx('full');
$('exportPptx8d').onclick = () => exportPptx('8d');
$('exportPptxSummary').onclick = () => exportPptx('summary');
