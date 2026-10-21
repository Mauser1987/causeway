// Chart rendering. The chart is written as SVG markup with colours in attributes, so the same
// markup serves the canvas and the exported SVG.

let layout = null;

function setStatus(text) { $('status').textContent = text; }

const attrs = o => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== false).map(([k, v]) => `${k}="${escapeHtml(v)}"`).join(' ');

function nodeMarkup(b, opts) {
  const C = opts.colors || CHART_COLORS, n = b.node, c = C[n.kind], {w, h} = b;
  const isPrimary = n.id === state.problem.primaryEffectId;
  const issue = opts.issues?.get(n.id);
  let s = `<g class="node" data-id="${n.id}" transform="translate(${b.x} ${b.y})"${opts.dimmed?.has(n.id) || opts.highlight && !opts.highlight.has(n.id) || opts.dragging?.id === n.id ? ' opacity="0.35"' : ''}>`;
  if (opts.highlight?.has(n.id) && opts.selectedId !== n.id) s += `<rect x="-6" y="-6" width="${w + 12}" height="${h + 12}" rx="12" fill="none" stroke="${C.highlight}" stroke-width="4"/>`;
  if (opts.selectedId === n.id) s += `<rect x="-5" y="-5" width="${w + 10}" height="${h + 10}" rx="11" fill="none" stroke="${C.select}" stroke-width="3"/>`;
  else if (issue === 'error') s += `<rect x="-5" y="-5" width="${w + 10}" height="${h + 10}" rx="11" fill="none" stroke="${C.issue}" stroke-width="2" stroke-dasharray="5 4"/>`;
  s += `<rect width="${w}" height="${h}" rx="8" ${attrs({fill: c.fill, stroke: c.stroke, 'stroke-width': n.kind === 'condition' ? 1.5 : isPrimary ? 2 : 1})}/>`;
  const kind = isPrimary ? KINDS.effect.label : n.kind === 'effect' ? 'EFFECT' : KINDS[n.kind].label;
  s += `<text x="${NODE_PAD_X}" y="${NODE_PAD_Y + 9}" font-size="9.5" font-weight="700" letter-spacing="0.8" fill="${c.sub}">${kind}</text>`;
  s += `<text x="${NODE_PAD_X}" font-size="${TITLE_SIZE}" font-weight="600" fill="${c.text}">`;
  b.lines.forEach((line, i) => { s += `<tspan x="${NODE_PAD_X}" y="${NODE_PAD_Y + KIND_LINE + TITLE_LINE * i + 12}">${escapeHtml(line)}</tspan>`; });
  s += '</text>';

  const f = b.foot;
  if (hasFoot(f)) {
    const top = h - NODE_PAD_Y - 15, base = top + 11;
    // Tags from the right, then evidence codes from the left in the space that is left.
    let right = w - NODE_PAD_X;
    const pill = (label, fill, text, stroke) => {
      const pw = textWidth(label, 8.5, 700) + 12;
      right -= pw;
      s += `<rect x="${right}" y="${top}" width="${pw}" height="15" rx="7.5" ${attrs({fill, stroke})}/><text x="${right + pw / 2}" y="${base}" font-size="8.5" font-weight="700" letter-spacing="0.4" text-anchor="middle" fill="${text}">${label}</text>`;
      right -= 4;
    };
    if (f.hidden) pill(`+${f.hidden}`, C.panel, C.stop, C.wire);
    if (f.stop) pill('STOP', C.stop, C.stopText);
    if (f.controllable) pill('CONTROLLABLE', C.controllable.fill, C.controllable.text);
    let left = NODE_PAD_X;
    const codeWidth = code => textWidth(code, 10, 700, MONO_FONT) + 12;
    // Codes that do not fit are counted in a last "+N" pill.
    for (const [i, code] of f.codes.entries()) {
      const rest = f.codes.length - i, more = `+${rest}`;
      const fits = left + codeWidth(code) + (rest > 1 ? 4 + codeWidth(more) : 0) <= right;
      const label = fits ? code : more, cw = codeWidth(label);
      s += `<rect x="${left}" y="${top}" width="${cw}" height="15" rx="7.5" ${attrs({fill: c.code.fill, stroke: c.code.stroke})}/><text x="${left + cw / 2}" y="${base}" font-family="${escapeHtml(MONO_FONT)}" font-size="10" font-weight="700" text-anchor="middle" fill="${c.code.text}">${escapeHtml(label)}</text>`;
      if (!fits) break;
      left += cw + 4;
    }
  }
  // A stop point closes the branch with a double bar on the right.
  if (n.stopPoint) s += `<path d="M ${w + 7} ${h * .25} V ${h * .75} M ${w + 12} ${h * .25} V ${h * .75}" stroke="${C.stop}" stroke-width="3"/>`;
  // On the canvas only: the collapse toggle where the node's connector leaves it.
  if (opts.toggles && causeLinks(n.id).length) {
    const open = !collapsed.has(n.id);
    s += `<g class="toggle" transform="translate(${w} ${h / 2})"><title>${open ? 'Collapse' : 'Expand'} this branch (Space)</title><circle r="8" fill="${C.panel}" stroke="${C.wire}" stroke-width="1.5"/><path d="M -3.5 0 H 3.5${open ? '' : ' M 0 -3.5 V 3.5'}" stroke="${C.stop}" stroke-width="1.6"/></g>`;
  }
  if (isCause(n) && needsEvidence(n)) {
    s += `<g transform="translate(${w - 3} 3)"><title>${n.unverified ? 'Unverified' : 'No evidence linked'}</title><circle r="11" fill="${C.unverified.fill}" stroke="${C.panel}" stroke-width="2"/><text y="4.5" font-size="13" font-weight="800" text-anchor="middle" fill="${C.unverified.text}">?</text></g>`;
  }
  return s + '</g>';
}

// The chart's elements, without the outer <svg>.
function chartMarkup(l, opts = {}) {
  const C = opts.colors || CHART_COLORS;
  let s = `<g font-family="${escapeHtml(CHART_FONT)}">`;
  for (const e of l.edges) {
    s += `<path class="edge" data-effect="${e.effectId}" d="${e.d}" fill="none" stroke="${e.shared ? C.shared : C.wire}" stroke-width="1.6"${e.shared ? ' stroke-dasharray="6 4"' : ''}/>`;
  }
  for (const e of l.edges) {
    if (!e.junction) continue;
    const {x, y} = e.junction;
    s += `<g class="junction"><rect x="${x - 16}" y="${y - 8}" width="32" height="16" rx="8" fill="${C.panel}" stroke="${C.wire}" stroke-width="1.5"/><text x="${x}" y="${y + 3}" font-size="8.5" font-weight="800" letter-spacing="0.5" text-anchor="middle" fill="${C.junctionText}">AND</text></g>`;
  }
  for (const b of l.boxes.values()) s += nodeMarkup(b, opts);
  if (opts.dragging) s += dragMarkup(l, opts.dragging, C);
  return s + '</g>';
}

// While a node is dragged: the drop target, a copy of the node under the pointer, and what a drop does.
function dragMarkup(l, d, C) {
  let s = '', label = 'Drop on an effect to move, or between causes to reorder';
  const drop = d.drop;
  if (drop?.type === 'move') {
    const t = l.boxes.get(drop.target), ok = !drop.problem;
    s += `<rect x="${t.x - 6}" y="${t.y - 6}" width="${t.w + 12}" height="${t.h + 12}" rx="12" fill="none" stroke="${ok ? C.select : C.issue}" stroke-width="3"${ok ? '' : ' stroke-dasharray="6 4"'}/>`;
    label = ok ? `Move under “${shorten(t.node.title, 40)}”` : drop.problem;
  } else if (drop?.type === 'order') {
    const t = l.boxes.get(drop.sibling), y = drop.after ? t.y + t.h + SIBLING_GAP / 2 : t.y - SIBLING_GAP / 2;
    s += `<rect x="${t.x - 6}" y="${y - 2}" width="${t.w + 12}" height="4" rx="2" fill="${C.select}"/>`;
    label = `Place ${drop.after ? 'below' : 'above'} “${shorten(t.node.title, 40)}”`;
  }
  // The copy and the label keep one size on screen whatever the zoom, below and right of the pointer,
  // so the drop target stays in view. Inside the group, units are screen pixels.
  const b = l.boxes.get(d.id), k = .7, bad = drop?.type === 'move' && drop.problem;
  const lw = textWidth(label, 12, 600) + 18, ly = 14 + b.h * k + 6, wide = Math.max(lw, b.w * k);
  // Near the right edge of the canvas, both go to the left of the pointer instead.
  const ox = (d.at.x - view.x) * view.k + 14 + wide > svg.clientWidth ? -14 - wide : 14;
  s += `<g class="ghost" pointer-events="none" transform="translate(${d.at.x} ${d.at.y}) scale(${1 / view.k})">`;
  s += `<g opacity="0.85" transform="translate(${ox} 14) scale(${k})">${nodeMarkup({...b, x: 0, y: 0}, {colors: C}).replace(/class="node" data-id="[^"]*" /, '')}</g>`;
  s += `<rect x="${ox}" y="${ly}" width="${lw}" height="24" rx="6" fill="${bad ? C.issue : C.stop}"/><text x="${ox + 9}" y="${ly + 16}" font-size="12" font-weight="600" fill="${C.stopText}">${escapeHtml(label)}</text></g>`;
  return s;
}

function issueMap(issues) {
  const map = new Map(), weight = {error: 3, warning: 2, info: 1};
  for (const i of issues) if (!map.has(i.nodeId) || weight[i.level] > weight[map.get(i.nodeId)]) map.set(i.nodeId, i.level);
  return map;
}

function renderCanvas() {
  const width = svg.clientWidth || 1, height = svg.clientHeight || 1;
  svg.setAttribute('viewBox', `${view.x} ${view.y} ${width / view.k} ${height / view.k}`);
  const cannot = !linking ? null : linking.mode === 'move' ? n => n.id === linking.causeId || moveProblem(linking.causeId, linking.fromId, n.id) : n => linkProblem(linking.effectId, n.id);
  const dimmed = cannot ? new Set(state.nodes.filter(cannot).map(n => n.id)) : null;
  const lit = highlight && !linking ? new Set(citingNodes(highlight).map(n => n.id)) : null;
  svg.innerHTML = chartMarkup(layout, {colors: darkTheme() ? CHART_COLORS_DARK : CHART_COLORS, selectedId: linking ? linking.effectId ?? linking.causeId : selected, issues: issueMap(ruleIssues()), dimmed, highlight: lit, toggles: true, dragging: nodeDrag?.moved ? nodeDrag : null});
  svg.classList.toggle('linking', !!linking);
  $('zoomReset').textContent = `${Math.round(view.k * 100)}%`;
}
function render() {
  layout = computeLayout();
  if (selected && !layout.boxes.has(selected)) selected = null;
  if (highlight && !evidenceById(highlight)) highlight = null;
  const issues = ruleIssues(), causes = state.nodes.length - 1;
  $('count').textContent = `${causes} cause${causes === 1 ? '' : 's'} · ${state.evidence.length} evidence item${state.evidence.length === 1 ? '' : 's'}`;
  for (const [id, n] of [['railCauses', causes], ['railWhys', state.fiveWhys.length], ['railFish', state.fishbones.length], ['railTeam', state.meta.team.length], ['railEvidence', state.evidence.length], ['railRuledOut', state.ruledOut.length],
    ['railSolutions', state.solutions.length], ['railActions', state.actions.length]]) $(id).textContent = n;
  renderIssues(issues);
  renderTitle();
  if (record !== 'chart') { renderRecord(); return; }
  renderCanvas();
  const n = byId(selected);
  $('addAction').disabled = $('addCondition').disabled = !n;
  $('deleteNode').disabled = !n || n.id === state.problem.primaryEffectId;
  $('linkCause').disabled = !n;
  $('linkBanner').hidden = !linking;
  if (linking) $('linkText').innerHTML = linking.mode === 'move'
    ? `Click the effect to move <b>${escapeHtml(byId(linking.causeId)?.title || '')}</b> under. Faded nodes would make a loop or already have it as a cause.`
    : `Click the node to link as a cause of <b>${escapeHtml(byId(linking.effectId)?.title || '')}</b>. Faded nodes would make a loop or are already linked.`;
  const ev = highlight && !linking ? evidenceById(highlight) : null;
  $('evidenceBanner').hidden = !ev;
  if (ev) {
    const count = citingNodes(ev.id).length;
    $('evidenceBannerText').innerHTML = `<b>${escapeHtml(ev.code)}</b> is cited by ${count} node${count === 1 ? '' : 's'}, outlined: ${escapeHtml(shorten(ev.description, 80))}`;
  }
  renderProperties();
}

function renderTitle() {
  $('sheetTitle').textContent = primaryEffect()?.title.trim() || 'Untitled RCA';
  document.title = `${rcaName()} · Causeway`;
  $('sheetMeta').textContent = [state.meta.rcaNumber, state.meta.equipmentTag].filter(s => s?.trim()).join(' · ') || 'Causeway';
}
