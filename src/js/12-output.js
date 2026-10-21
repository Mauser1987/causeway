// Output: chart export as SVG and PNG, the printed report, and the light and dark themes.

// ---- Chart images ----
// Exports and print show the whole chart, with every branch expanded, in the light palette.

function fullLayout() {
  const shown = collapsed;
  collapsed = new Set();
  try { return computeLayout(); } finally { collapsed = shown; }
}
const CHART_PAD = 28;      // room around the boxes for stop bars, "?" badges, and outlines

// A self-contained SVG of the chart, or of the part of it inside `area` (chart units).
function chartSvg(l, {area, heading = true, scale = 1} = {}) {
  const b = l.bounds;
  const full = {x: b.l - CHART_PAD, y: b.t - CHART_PAD, w: b.r - b.l + 2 * CHART_PAD, h: b.b - b.t + 2 * CHART_PAD};
  const v = area || full, top = heading ? 44 : 0;
  const w = v.w * scale, h = (v.h + top) * scale;
  let s = `<svg xmlns="${NS}" width="${w}" height="${h}" viewBox="${v.x} ${v.y - top} ${v.w} ${v.h + top}" font-family="${escapeHtml(CHART_FONT)}">`;
  s += `<title>${escapeHtml(rcaName())}</title>`;
  s += `<rect x="${v.x}" y="${v.y - top}" width="${v.w}" height="${v.h + top}" fill="${CHART_COLORS.panel}"/>`;
  if (heading) {
    const meta = [state.meta.rcaNumber, state.meta.equipmentTag, today()].filter(x => x?.trim()).join(' · ');
    s += `<text x="${v.x + CHART_PAD}" y="${v.y - top + 22}" font-size="15" font-weight="700" fill="${CHART_COLORS.stop}">${escapeHtml(primaryEffect()?.title || 'Untitled RCA')}</text>`;
    s += `<text x="${v.x + CHART_PAD}" y="${v.y - top + 38}" font-size="10.5" fill="#5b6b7a">${escapeHtml(meta)}</text>`;
  }
  s += chartMarkup(l, {issues: issueMap(ruleIssues())});
  return s + '</svg>';
}

const rcaName = () => [state.meta.rcaNumber, primaryEffect()?.title].filter(x => x?.trim()).join(' · ') || 'Untitled RCA';

function exportSvg() {
  showMenu(false);
  download(baseName() + '-chart.svg', new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + chartSvg(fullLayout())], {type: 'image/svg+xml'}));
  setStatus(`Exported ${baseName()}-chart.svg`);
}

// The SVG is drawn into a canvas at twice its size, or less where browsers limit canvas size.
async function exportPng() {
  showMenu(false);
  const svgText = chartSvg(fullLayout());
  const [, w, h] = /width="([\d.]+)" height="([\d.]+)"/.exec(svgText).map(Number);
  const scale = Math.min(2, 16000 / Math.max(w, h), Math.sqrt(120e6 / (w * h)));
  const url = URL.createObjectURL(new Blob([svgText], {type: 'image/svg+xml'}));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(done => canvas.toBlob(done, 'image/png'));
    if (!blob) throw Error('the browser could not encode the image');
    download(baseName() + '-chart.png', blob);
    setStatus(`Exported ${baseName()}-chart.png`);
  } catch (err) {
    alert('Could not export the PNG: ' + err.message);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function showMenu(open) {
  $('exportMenu').hidden = !open;
  $('exportButton').setAttribute('aria-expanded', open);
  if (open) $('exportMenu').querySelector('button').focus();
}
$('exportButton').onclick = () => showMenu($('exportMenu').hidden);
$('exportSvg').onclick = exportSvg;
$('exportPng').onclick = exportPng;
document.addEventListener('pointerdown', e => { if (!e.target.closest('.menu-wrap')) showMenu(false); });
$('exportMenu').addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Escape') { showMenu(false); $('exportButton').focus(); }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const items = [...$('exportMenu').querySelectorAll('button')], i = items.indexOf(document.activeElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
  }
});

// ---- Printed report ----
// Built just before printing, so Ctrl+P prints the current RCA as well.

// The printable area of a landscape A4 or Letter page, less the chart heading, in CSS pixels.
const PRINT_W = 1000, PRINT_H = 600, PRINT_MIN_SCALE = 0.55;

// The chart as one or more page-sized figures. When it cannot fit one page at a readable size, it is
// split into tiles; horizontal cuts fall between columns, so no box is cut across.
function chartFigures() {
  const l = fullLayout(), b = l.bounds;
  const cw = b.r - b.l + 2 * CHART_PAD, ch = b.b - b.t + 2 * CHART_PAD;
  const fit = Math.min(1, PRINT_W / cw, PRINT_H / ch);
  if (fit >= PRINT_MIN_SCALE) return [`<figure>${chartSvg(l, {heading: false, scale: fit})}</figure>`];
  const s = PRINT_MIN_SCALE, column = NODE_W + COL_GAP;
  const perTile = Math.max(1, Math.floor((PRINT_W / s - 2 * CHART_PAD) / column));
  const tileW = perTile * column, tileH = PRINT_H / s;
  const cols = Math.ceil((b.r - b.l + COL_GAP) / tileW), rows = Math.ceil(ch / tileH);
  const figures = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const area = {x: b.l - CHART_PAD + c * tileW, y: b.t - CHART_PAD + r * tileH, w: tileW + (c === cols - 1 ? 2 * CHART_PAD : CHART_PAD), h: Math.min(tileH, ch - r * tileH)};
    figures.push(`<figure>${chartSvg(l, {area, heading: false, scale: s})}<figcaption>Chart, part ${figures.length + 1} of ${rows * cols}: row ${r + 1}, column ${c + 1}. Read left to right.</figcaption></figure>`);
  }
  return figures;
}

function buildReport() {
  const m = state.meta, p = state.problem, sig = p.significance;
  const text = v => v?.trim() ? escapeHtml(v) : '<span class="r-none">—</span>';
  const item = (label, value) => `<div><dt>${label}</dt><dd>${text(value)}</dd></div>`;
  const lead = m.team.find(t => t.id === m.leadId);
  const table = (heads, rows, none) => rows.length
    ? `<table><thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`
    : `<p class="r-none">${none}</p>`;
  const codes = ids => ids.map(evidenceById).filter(Boolean).map(e => `<span class="r-code">${escapeHtml(e.code)}</span>`).join(' ') || '—';
  const issues = ruleIssues().filter(i => i.level !== 'info');

  $('report').innerHTML = `
    <header class="r-cover">
      <div class="r-kicker">Root cause analysis${m.rcaNumber ? ' · ' + escapeHtml(m.rcaNumber) : ''}</div>
      <h1>${escapeHtml(primaryEffect()?.title || 'Untitled RCA')}</h1>
      <dl class="r-grid">
        ${item('Equipment / tag', m.equipmentTag)}${item('Seal type', m.sealType)}${item('Lead', lead && `${lead.name}${lead.role ? ', ' + lead.role : ''}`)}
        ${item('Team', m.team.filter(t => t.id !== m.leadId).map(t => `${t.name}${t.role ? ' (' + t.role + ')' : ''}`).join('\n'))}
        ${item('Event', m.dates.eventDate)}${item('RCA opened', m.dates.opened)}${item('RCA closed', m.dates.closed)}${item('Report printed', today())}
      </dl>
    </header>
    <section>
      <h2>Problem definition</h2>
      <dl class="r-grid two">${item('What', primaryEffect()?.title)}${item('When', p.when)}${item('Where', p.where)}</dl>
      <h3>Significance</h3>
      <dl class="r-grid">${item('Safety', sig.safety)}${item('Environment', sig.environment)}${item('Production / cost', sig.productionCost)}${item('Reliability', sig.reliability)}</dl>
    </section>
    <section class="r-page">
      <h2>Cause-and-effect chart</h2>
      <p class="r-legend">Read left to right: each effect, then the causes that were all needed for it (AND). Red: primary effect. Dark: action. Light: condition. E-codes: evidence. ?: no evidence or unverified. Double bar and STOP: stop point. Dashed purple: a further link of a shared cause.</p>
      ${chartFigures().join('')}
      ${issues.length ? `<h3>Open rule issues</h3><ul>${issues.map(i => `<li class="${i.level === 'error' ? 'r-issue-error' : ''}">${escapeHtml(byId(i.nodeId)?.title || '')}: ${escapeHtml(i.text)}</li>`).join('')}</ul>` : ''}
    </section>
    <section class="r-page">
      <h2>Evidence log</h2>
      ${table(['Code', 'Description', 'Type', 'Source / location', 'Collected by', 'Date', 'Cited by'], state.evidence.map(e => `<tr>
        <td class="r-code">${escapeHtml(e.code)}</td><td>${text(e.description)}</td><td>${EVIDENCE_TYPES[e.type] || ''}</td><td>${text(e.source)}</td>
        <td>${text(e.collectedBy)}</td><td class="r-crit">${text(e.date)}</td><td>${citingNodes(e.id).map(n => escapeHtml(n.title)).join('\n') || '—'}</td></tr>`), 'No evidence recorded.')}
    </section>
    <section>
      <h2>Causes ruled out</h2>
      ${table(['Possible cause', 'Type', 'Evidence or test', 'Evidence', 'Status'], state.ruledOut.map(r => `<tr>
        <td>${text(r.cause)}</td><td>${{action: 'Action', condition: 'Condition'}[r.kind] || '—'}</td><td>${text(r.test)}</td><td>${codes(r.evidenceIds)}</td><td>${RULED_OUT_STATUS[r.status] || ''}</td></tr>`), 'No causes ruled out.')}
    </section>
    <section class="r-page">
      <h2>Solutions</h2>
      ${table(['Solution', 'Attacks', ...Object.values(CRITERIA), 'Decision'], state.solutions.map(s => `<tr>
        <td>${text(s.title)}</td><td>${s.causeIds.map(byId).filter(Boolean).map(n => escapeHtml(n.title)).join('\n') || '—'}</td>
        ${Object.keys(CRITERIA).map(k => `<td><b>${CRITERION_VALUES[s.criteria[k].v] || '—'}</b>${s.criteria[k].c ? '\n' + escapeHtml(s.criteria[k].c) : ''}</td>`).join('')}
        <td><b>${DECISIONS[s.decision] || 'Not decided'}</b></td></tr>`), 'No solutions recorded.')}
    </section>
    <section>
      <h2>Action plan</h2>
      ${table(['Action', 'Solution', 'Owner', 'Due', 'Verification', 'Status', 'Effectiveness check'], state.actions.map(a => `<tr>
        <td>${text(a.action)}</td><td>${text(state.solutions.find(s => s.id === a.solutionId)?.title)}</td><td>${text(a.owner)}</td>
        <td class="r-crit">${text(a.due)}${isOverdue(a) ? '\n<b class="r-issue-error">Overdue</b>' : ''}</td><td>${text(a.verification)}</td><td>${ACTION_STATUS[a.status] || ''}</td>
        <td>${[a.effectiveness.date, a.effectiveness.result].filter(x => x?.trim()).map(escapeHtml).join('\n') || '—'}</td></tr>`), 'No actions recorded.')}
    </section>
    <p class="r-foot">Causeway · ${escapeHtml(rcaName())} · printed ${today()}</p>`;
}

function printReport() {
  buildReport();
  window.print();
}
$('printReport').onclick = printReport;
window.addEventListener('beforeprint', buildReport);

// ---- Theme ----
// System follows the operating system; the choice is kept in this browser only.

const THEME_KEY = 'causeway-theme', LEGACY_THEME_KEY = 'apollo-rca-theme';
const THEMES = {system: 'System', light: 'Light', dark: 'Dark'};
let theme = 'system';
try {
  const stored = localStorage.getItem(THEME_KEY) ?? localStorage.getItem(LEGACY_THEME_KEY);
  theme = THEMES[stored] ? stored : 'system';
  if (localStorage.getItem(LEGACY_THEME_KEY)) { localStorage.setItem(THEME_KEY, theme); localStorage.removeItem(LEGACY_THEME_KEY); }
} catch {}
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const darkTheme = () => theme === 'dark' || theme === 'system' && systemDark.matches;

function applyTheme() {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = theme;
  const next = {system: 'light', light: 'dark', dark: 'system'}[theme];
  $('themeButton').title = `Theme: ${THEMES[theme]}. Click for ${THEMES[next]}.`;
  $('themeButton').setAttribute('aria-label', `Theme: ${THEMES[theme]}`);
  if (layout && record === 'chart') renderCanvas();
}
$('themeButton').onclick = () => {
  theme = {system: 'light', light: 'dark', dark: 'system'}[theme];
  try { localStorage.setItem(THEME_KEY, theme); } catch {}
  applyTheme();
  setStatus(`Theme: ${THEMES[theme]}`);
};
systemDark.addEventListener('change', () => { if (theme === 'system') applyTheme(); });
applyTheme();
