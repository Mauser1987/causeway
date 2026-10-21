// Pointer and keyboard: selecting, panning, zooming.

const MIN_ZOOM = .15, MAX_ZOOM = 3;

function point(e) {
  const r = svg.getBoundingClientRect();
  return {x: view.x + (e.clientX - r.left) / view.k, y: view.y + (e.clientY - r.top) / view.k};
}

function select(id) {
  selected = id;
  render();
}

svg.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  const node = e.target.closest('.node');
  if (node) { select(node.dataset.id); return; }
  drag = {x: e.clientX, y: e.clientY, view: {...view}, moved: false};
  svg.setPointerCapture(e.pointerId);
});
svg.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 4) return;
  drag.moved = true;
  svg.classList.add('panning');
  view.x = drag.view.x - dx / view.k; view.y = drag.view.y - dy / view.k;
  renderCanvas();
});
svg.addEventListener('pointerup', () => {
  if (drag && !drag.moved && selected) select(null);
  drag = null;
  svg.classList.remove('panning');
});
svg.addEventListener('dblclick', e => { if (e.target.closest('.node')) focusTitle(); });

function zoom(factor, at) {
  const k = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.k * factor));
  at ??= {x: view.x + svg.clientWidth / view.k / 2, y: view.y + svg.clientHeight / view.k / 2};
  view.x = at.x - (at.x - view.x) * view.k / k;
  view.y = at.y - (at.y - view.y) * view.k / k;
  view.k = k;
  renderCanvas();
}
function zoomToFit() {
  const b = layout?.bounds, width = svg.clientWidth, height = svg.clientHeight;
  if (!b || !width || !height) return;
  const margin = 40, w = b.r - b.l + 2 * margin, h = b.b - b.t + 2 * margin;
  view.k = Math.max(MIN_ZOOM, Math.min(1.25, width / w, height / h));
  view.x = (b.l + b.r) / 2 - width / view.k / 2;
  view.y = (b.t + b.b) / 2 - height / view.k / 2;
  renderCanvas();
}
svg.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, point(e)); }, {passive: false});
$('zoomIn').onclick = () => zoom(1.25);
$('zoomOut').onclick = () => zoom(.8);
$('zoomReset').onclick = () => zoom(1 / view.k);
$('zoomFit').onclick = zoomToFit;
new ResizeObserver(() => { if (layout) renderCanvas(); }).observe(svg);

$('undo').onclick = () => restoreHistory();
$('redo').onclick = () => restoreHistory(true);

window.addEventListener('keydown', e => {
  const key = e.key.toLowerCase(), command = (e.ctrlKey || e.metaKey) && !e.altKey;
  if (command && key === 's') { e.preventDefault(); saveProject(e.shiftKey); return; }
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return;
  if (command && (key === 'z' || key === 'y')) {
    e.preventDefault();
    restoreHistory(key === 'y' || e.shiftKey);
    return;
  }
  if (command || e.altKey || !byId(selected)) return;
  // Insert adds an action and Shift+Insert a condition; A and C do the same on keyboards without Insert.
  const kind = key === 'insert' ? (e.shiftKey ? 'condition' : 'action') : !e.shiftKey && {a: 'action', c: 'condition'}[key];
  if (kind) { e.preventDefault(); addCauseToSelected(kind); }
  else if (key === 'f2' || key === 'enter' && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); focusTitle(); }
  else if (key === 'delete') { e.preventDefault(); deleteSelected(); }
});

// Arrow keys move the selection: left to the effect, right to the first cause, up and down within the column.
window.addEventListener('keydown', e => {
  if (!e.key.startsWith('Arrow') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return;
  e.preventDefault();
  const from = layout.boxes.get(selected);
  const next = from ? neighbour(from, e.key) : layout.boxes.get(state.problem.primaryEffectId);
  if (!next) return;
  select(next.id);
  scrollToNode(next.id);
});

function neighbour(from, key) {
  const boxes = [...layout.boxes.values()], cy = midY(from);
  const near = list => list.sort((a, b) => Math.abs(midY(a) - cy) - Math.abs(midY(b) - cy))[0];
  if (key === 'ArrowLeft') return near(effectsOf(from.id).map(n => layout.boxes.get(n.id)).filter(Boolean));
  if (key === 'ArrowRight') return near(causesOf(from.id).map(n => layout.boxes.get(n.id)).filter(Boolean));
  const column = boxes.filter(b => b.x === from.x && (key === 'ArrowUp' ? b.y < from.y : b.y > from.y));
  return near(column);
}

// Pans just enough to bring a node fully into view.
function scrollToNode(id) {
  const b = layout.boxes.get(id);
  if (!b) return;
  const margin = 40 / view.k, w = svg.clientWidth / view.k, h = svg.clientHeight / view.k;
  if (b.x - margin < view.x) view.x = b.x - margin;
  else if (b.x + b.w + margin > view.x + w) view.x = b.x + b.w + margin - w;
  if (b.y - margin < view.y) view.y = b.y - margin;
  else if (b.y + b.h + margin * 2.5 > view.y + h) view.y = b.y + b.h + margin * 2.5 - h;   // clear of the edit bar
  renderCanvas();
}
