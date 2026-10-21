// Fishbone diagram: layout and drawing.
//
// The effect is the head, on the right, at the end of the spine. The categories are bones, from left
// to right, alternately above and below the spine. Each possible cause is a horizontal line that
// meets its bone, with its words above the line; its sub-causes hang from a twig parallel to the
// bone. Rows run downwards in both halves: above the spine from the category label, below it from
// the spine. Coordinates put the spine at y = 0.

const FISH = {
  text: 12, subText: 11, line: 15, subLine: 14, width: 170, subWidth: 150, rowGap: 9,
  slope: .45,          // horizontal run of a bone for each unit it falls
  label: 26, labelGap: 12, twig: 22, head: 190, slotGap: 26, minHalf: 110,
};

// One possible cause: its wrapped words, evidence codes, and size.
function fishRowBox(c) {
  const sub = !!c.parentId, size = sub ? FISH.subText : FISH.text, weight = sub ? 400 : 600;
  const text = fishText(c).trim(), width = sub ? FISH.subWidth : FISH.width;
  const lines = wrapText(text || 'New cause', width, size, weight);
  const codes = fishSource(c).evidenceIds.map(evidenceById).filter(Boolean).map(e => e.code).join(' ');
  const cw = codes ? textWidth(codes, 10, 700, MONO_FONT) + 6 : 0;
  if (cw && textWidth(lines.at(-1), size, weight) + cw > width) lines.push('');   // codes on a line of their own
  const lineW = lines.map(l => textWidth(l, size, weight));
  const swatch = fishStatus(c) === 'chart' ? 19 : 0;
  const w = Math.max(24, ...lineW.slice(0, -1), lineW.at(-1) + cw) + swatch;
  return {c, sub, size, weight, lines, lineW, codes, cw, swatch, w, empty: !text,
    h: lines.length * (sub ? FISH.subLine : FISH.line) + 4};
}

// Above the spine a bone leans left as it rises, so a cause's words clear it at their top line.
const fishTextY = (k, r) => k.top ? r.y - r.h : r.y;

function fishLayout(f) {
  const cats = f.categories.map((g, i) => {
    const rows = fishRows(g).map(fishRowBox);
    let y = 0;
    for (const r of rows) { y += r.h; r.dy = y; y += FISH.rowGap; }
    const labelW = textWidth(g.name.trim() || 'Category', 12, 700) + 22;
    return {g, rows, top: i % 2 === 0, labelW, need: FISH.label + FISH.labelGap + y + 14};
  });
  const half = top => Math.max(FISH.minHalf, ...cats.filter(k => k.top === top).map(k => k.need));
  const H = {top: half(true), bottom: half(false)};
  // Rows start below the label above the spine, and just below the spine under it.
  for (const k of cats) {
    const start = k.top ? -H.top + FISH.label + FISH.labelGap : 16;
    for (const r of k.rows) r.y = start + r.dy;
    k.reach = (k.top ? H.top : H.bottom) - FISH.label;     // how far the bone runs from the spine
  }
  // Each pair of bones, one above and one below, shares a slot; a slot ends where they meet the spine.
  const left = (k, r) => Math.abs(fishTextY(k, r)) * FISH.slope + (r.sub ? FISH.twig : 0) + 10 + r.w;
  let x = 0;
  for (let s = 0; s < cats.length; s += 2) {
    const pair = cats.slice(s, s + 2);
    const need = Math.max(...pair.map(k => Math.max(k.reach * FISH.slope + k.labelW / 2, ...k.rows.map(r => left(k, r)))));
    const over = Math.max(0, ...pair.map(k => k.labelW / 2 - k.reach * FISH.slope));
    for (const k of pair) k.x = x + need;
    x += need + over + FISH.slotGap;
  }
  const effect = byId(f.effectId);
  const headLines = wrapText(effect?.title.trim() || 'Effect', FISH.head - 24, 13, 700);
  const hh = Math.max(56, headLines.length * 17 + 22);
  const head = {x: Math.max(x + 4, 60), y: -hh / 2, w: FISH.head, h: hh, lines: headLines};
  return {f, cats, H, head, bounds: {l: -16, t: -H.top - 4, r: head.x + head.w + 12, b: H.bottom + 4}};
}

// The diagram's markup, in chart units; `on` is the cause whose row is lit.
function fishMarkup(L, C, on = null) {
  const boneX = (k, y) => k.x - Math.abs(y) * FISH.slope;
  const twigX = (k, y) => boneX(k, y) - FISH.twig;
  const font = (size, weight) => `font-size="${size}" font-weight="${weight}"`;
  let s = `<line x1="-6" y1="0" x2="${L.head.x}" y2="0" stroke="${C.stop}" stroke-width="3" stroke-linecap="round"/>`;
  for (const k of L.cats) {
    const endY = k.top ? -k.reach : k.reach, ex = boneX(k, endY);
    s += `<line x1="${k.x}" y1="0" x2="${ex}" y2="${endY}" stroke="${C.junctionText}" stroke-width="2" stroke-linecap="round"/>`;
    // A twig from each cause with sub-causes down to its last sub-cause.
    for (const r of k.rows) {
      const subs = k.rows.filter(x => x.c.parentId === r.c.id);
      if (subs.length) s += `<line x1="${twigX(k, r.y)}" y1="${r.y}" x2="${twigX(k, subs.at(-1).y)}" y2="${subs.at(-1).y}" stroke="${C.wire}" stroke-width="1.2"/>`;
    }
    for (const r of k.rows) {
      const status = fishStatus(r.c), meet = r.sub ? twigX(k, r.y) : boneX(k, r.y);
      const end = (r.sub ? twigX(k, fishTextY(k, r)) : boneX(k, fishTextY(k, r))) - 8;
      const ink = status === 'ruled' || r.empty ? C.wire : C.stop, lh = r.sub ? FISH.subLine : FISH.line;
      const lit = on === r.c.id;
      s += `<g class="fish-row" data-fish="${r.c.id}">`;
      s += `<rect x="${end - r.w - 4}" y="${r.y - r.h - 1}" width="${meet - end + r.w + 4}" height="${r.h + 4}" rx="3" fill="${lit ? C.highlight : 'transparent'}" fill-opacity="${lit ? .28 : 1}"/>`;
      s += `<line x1="${end - r.w - 2}" y1="${r.y}" x2="${meet}" y2="${r.y}" stroke="${status === 'ruled' ? C.wire : C.junctionText}" stroke-width="1.3"${status === 'ruled' ? ' stroke-dasharray="4 3"' : ''}/>`;
      r.lines.forEach((line, i) => {
        const base = r.y - 5 - (r.lines.length - 1 - i) * lh, x = end - (i === r.lines.length - 1 ? r.cw : 0);
        if (!line) return;
        s += `<text x="${x}" y="${base}" text-anchor="end" ${font(r.size, r.weight)} fill="${ink}"${r.empty ? ' font-style="italic"' : ''}>${escapeHtml(line)}</text>`;
        if (status === 'ruled') s += `<line x1="${x - r.lineW[i]}" y1="${base - r.size * .32}" x2="${x}" y2="${base - r.size * .32}" stroke="${C.wire}" stroke-width="1"/>`;
      });
      if (r.codes) s += `<text x="${end}" y="${r.y - 5}" text-anchor="end" font-family="${escapeHtml(MONO_FONT)}" ${font(10, 700)} fill="${C.condition.code.text}">${escapeHtml(r.codes)}</text>`;
      if (r.swatch) {
        const kind = C[fishKind(r.c)] || C.condition, top = r.y - 5 - (r.lines.length - 1) * lh - 9;
        s += `<rect x="${end - r.w}" y="${top + 1}" width="14" height="8" rx="2" fill="${kind.fill}" stroke="${kind.stroke}" stroke-width="1.2"/>`;
      }
      s += '</g>';
    }
    const ly = k.top ? -L.H.top : L.H.bottom - FISH.label;
    s += `<g class="fish-cat" data-fish-cat="${k.g.id}"><rect x="${ex - k.labelW / 2}" y="${ly}" width="${k.labelW}" height="${FISH.label}" rx="6" fill="${C.action.fill}"/>`;
    s += `<text x="${ex}" y="${ly + 17}" text-anchor="middle" ${font(12, 700)} fill="${C.action.text}">${escapeHtml(k.g.name.trim() || 'Category')}</text></g>`;
  }
  const h = L.head;
  s += `<g class="fish-head"><rect x="${h.x}" y="${h.y}" width="${h.w}" height="${h.h}" rx="8" fill="${C.effect.fill}" stroke="${C.effect.stroke}" stroke-width="1.5"/>`;
  h.lines.forEach((line, i) => {
    s += `<text x="${h.x + 12}" y="${h.y + (h.h - h.lines.length * 17) / 2 + 13 + i * 17}" ${font(13, 700)} fill="${C.effect.text}">${escapeHtml(line)}</text>`;
  });
  return s + '</g>';
}

// A self-contained SVG of the diagram, light unless `colors` says otherwise.
function fishboneSvg(f, {colors = CHART_COLORS, scale = 1, on = null} = {}) {
  const L = fishLayout(f), b = L.bounds, w = b.r - b.l, h = b.b - b.t;
  return `<svg xmlns="${NS}" width="${w * scale}" height="${h * scale}" viewBox="${b.l} ${b.t} ${w} ${h}" font-family="${escapeHtml(CHART_FONT)}">`
    + `<title>Fishbone: ${escapeHtml(byId(f.effectId)?.title || '')}</title>`
    + `<rect x="${b.l}" y="${b.t}" width="${w}" height="${h}" fill="${colors.panel}"/>${fishMarkup(L, colors, on)}</svg>`;
}
