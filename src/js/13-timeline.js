// Sequence of events: the Gantt-style figure.
//
// One row for each phase, then one for each of its events, in time order. The labels are on the
// left and the time axis on the right: an event that lasted is a bar from its start to its end, a
// moment is a diamond, and a phase is a summary bar over its events. Deviations are drawn in the
// issue colour. Events without a time are listed without a mark.

const GANTT = {label: 300, plot: 680, codes: 70, pad: 14, head: 42, phase: 28, row: 24, bar: 12};
// Tick steps, in minutes: from a minute to a month.
const GANTT_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 180, 360, 720, 1440, 2880, 10080, 20160, 43200];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ganttDate = t => { const d = new Date(t * 60000); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
const ganttClock = t => new Date(t * 60000).toISOString().slice(11, 16);

// A single line of text, cut with an ellipsis to fit the width.
function fitLine(text, width, size, weight) {
  text = String(text).replace(/\s*\n\s*/g, ' ');
  if (textWidth(text, size, weight) <= width) return text;
  let cut = text.length;
  while (cut > 1 && textWidth(text.slice(0, cut) + '…', size, weight) > width) cut--;
  return text.slice(0, cut).trimEnd() + '…';
}

function timelineLayout(t) {
  const rows = [];
  let y = GANTT.head;
  for (const phase of t.phases) {
    rows.push({phase, y, h: GANTT.phase});
    y += GANTT.phase;
    for (const ev of eventsInOrder(phase)) {
      const start = eventMinutes(ev.start), end = eventMinutes(ev.end);
      rows.push({ev, phase, y, h: GANTT.row, start, end: end !== null && start !== null && end > start ? end : null});
      y += GANTT.row;
    }
  }
  // The time range of every event, with a margin; a single moment gets an hour either side.
  const times = rows.flatMap(r => [r.start, r.end]).filter(v => v !== null && v !== undefined);
  let lo = Math.min(...times), hi = Math.max(...times);
  if (!times.length) lo = hi = 0;
  if (hi - lo < 60) { lo -= 60; hi += 60; }
  const margin = (hi - lo) * .04;
  lo -= margin; hi += margin;
  const step = GANTT_STEPS.find(s => (hi - lo) / s <= 9) ?? GANTT_STEPS.at(-1);
  const ticks = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  const x = v => GANTT.label + (v - lo) / (hi - lo) * GANTT.plot;
  // A phase's summary bar spans its events.
  for (const r of rows.filter(r => !r.ev)) {
    const own = rows.filter(e => e.ev && e.phase === r.phase && e.start !== null).flatMap(e => [e.start, e.end ?? e.start]);
    if (own.length) { r.start = Math.min(...own); r.end = Math.max(...own); }
  }
  const width = GANTT.label + GANTT.plot + GANTT.codes;
  return {t, rows, ticks, step, x, timed: times.length > 0, bounds: {l: -GANTT.pad, t: 0, r: width + GANTT.pad, b: y + GANTT.pad}};
}

// The figure's markup; `on` is the event whose row is lit.
function timelineMarkup(L, C, on = null) {
  const font = (size, weight) => `font-size="${size}" font-weight="${weight}"`;
  const right = GANTT.label + GANTT.plot, grid = C.ruled.stroke;
  let s = '';
  // Time axis: a label at each tick, and the date where it changes when the ticks are within a day.
  let lastDate = null;
  for (const v of L.timed ? L.ticks : []) {
    const x = L.x(v), date = ganttDate(v), daily = L.step >= 1440;
    s += `<line x1="${x}" y1="${GANTT.head - 6}" x2="${x}" y2="${L.bounds.b - GANTT.pad}" stroke="${grid}" stroke-width="1"/>`;
    s += `<text x="${x}" y="${GANTT.head - 11}" text-anchor="middle" ${font(10.5, 600)} fill="${C.junctionText}">${daily ? date : ganttClock(v)}</text>`;
    if (!daily && date !== lastDate) s += `<text x="${x}" y="${GANTT.head - 26}" text-anchor="middle" ${font(10.5, 700)} fill="${C.stop}">${date}</text>`;
    lastDate = date;
  }
  s += `<line x1="0" y1="${GANTT.head}" x2="${right}" y2="${GANTT.head}" stroke="${C.wire}" stroke-width="1.2"/>`;
  for (const r of L.rows) {
    const mid = r.y + r.h / 2;
    if (!r.ev) {
      if (r !== L.rows[0]) s += `<line x1="0" y1="${r.y}" x2="${right}" y2="${r.y}" stroke="${grid}" stroke-width="1"/>`;
      s += `<g class="tl-phase" data-phase="${r.phase.id}"><text x="2" y="${mid + 4.5}" ${font(12.5, 700)} fill="${C.stop}">${escapeHtml(fitLine(r.phase.name.trim() || 'Phase', GANTT.label - 12, 12.5, 700))}</text></g>`;
      if (r.start !== undefined) {
        // At least wide enough to show its ends, centred on a phase that is a moment.
        let x1 = L.x(r.start), x2 = L.x(r.end);
        if (x2 - x1 < 14) { x1 = (x1 + x2) / 2 - 7; x2 = x1 + 14; }
        const y1 = mid - 3;
        s += `<path d="M ${x1} ${y1} H ${x2} V ${y1 + 9} L ${x2 - 5} ${y1 + 5} H ${x1 + 5} L ${x1} ${y1 + 9} Z" fill="${C.stop}"/>`;
      }
      continue;
    }
    const ev = r.ev, n = eventNode(ev), lit = on === ev.id, text = eventText(ev).trim();
    const ink = ev.deviation ? C.issue : C.junctionText;
    s += `<g class="tl-row" data-event="${ev.id}"><rect x="-4" y="${r.y + 1}" width="${right + GANTT.codes + 4}" height="${r.h - 2}" rx="3" fill="${lit ? C.highlight : 'transparent'}" fill-opacity="${lit ? .28 : 1}"/>`;
    // On the chart: a small box in the colour of its type, as in the fishbone.
    let lx = 14;
    if (n) {
      const kind = C[eventKind(ev)] || C.condition;
      s += `<rect x="${lx}" y="${mid - 4}" width="14" height="8" rx="2" fill="${kind.fill}" stroke="${kind.stroke}" stroke-width="1.2"/>`;
      lx += 19;
    }
    s += `<text x="${lx}" y="${mid + 4}" ${font(12, ev.deviation ? 600 : 400)} fill="${text ? (ev.deviation ? C.issue : C.stop) : C.wire}"${text ? '' : ' font-style="italic"'}>${escapeHtml(fitLine(text || 'New event', GANTT.label - lx - 10, 12, ev.deviation ? 600 : 400))}</text>`;
    let after = GANTT.label + 6;
    if (r.start === null) s += `<text x="${after}" y="${mid + 4}" ${font(10.5, 400)} font-style="italic" fill="${C.wire}">no time</text>`;
    else if (r.end !== null) {
      const x1 = L.x(r.start), x2 = Math.max(L.x(r.end), x1 + 3);
      s += `<rect x="${x1}" y="${mid - GANTT.bar / 2}" width="${x2 - x1}" height="${GANTT.bar}" rx="3" fill="${ink}"/>`;
      after = x2 + 6;
    } else {
      const x0 = L.x(r.start), d = 6.5;
      s += `<path d="M ${x0} ${mid - d} L ${x0 + d} ${mid} L ${x0} ${mid + d} L ${x0 - d} ${mid} Z" fill="${ink}"/>`;
      after = x0 + d + 5;
    }
    const codes = eventSource(ev).evidenceIds.map(evidenceById).filter(Boolean).map(e => e.code).join(' ');
    if (codes && r.start !== null) s += `<text x="${after}" y="${mid + 3.5}" font-family="${escapeHtml(MONO_FONT)}" ${font(10, 700)} fill="${C.condition.code.text}">${escapeHtml(codes)}</text>`;
    s += '</g>';
  }
  if (!L.rows.some(r => r.ev)) s += `<text x="${GANTT.label + GANTT.plot / 2}" y="${GANTT.head + 18}" text-anchor="middle" ${font(12, 400)} font-style="italic" fill="${C.wire}">No events yet</text>`;
  return s;
}

// A self-contained SVG of the figure, light unless `colors` says otherwise.
function timelineSvg(t, {colors = CHART_COLORS, scale = 1, on = null} = {}) {
  const L = timelineLayout(t), b = L.bounds, w = b.r - b.l, h = b.b - b.t;
  return `<svg xmlns="${NS}" width="${w * scale}" height="${h * scale}" viewBox="${b.l} ${b.t} ${w} ${h}" font-family="${escapeHtml(CHART_FONT)}">`
    + `<title>Sequence of events: ${escapeHtml(byId(t.effectId)?.title || '')}</title>`
    + `<rect x="${b.l}" y="${b.t}" width="${w}" height="${h}" fill="${colors.panel}"/>${timelineMarkup(L, colors, on)}</svg>`;
}
