// Edits on the chart.

function addCauseToSelected(kind) {
  if (!byId(selected)) return;
  const n = addCause(selected, kind);
  selected = n.id;
  render(); persist();
  focusTitle();
}

// After adding a cause the title is selected, so typing replaces the placeholder.
function focusTitle() {
  const input = $('nodeTitle');
  if (input) { input.focus(); input.select(); }
}

function deleteSelected() {
  const n = byId(selected);
  if (!n || n.id === state.problem.primaryEffectId) return;
  const ids = deletionSet(n.id);
  const others = ids.length - 1;
  if (others && !confirm(`Delete "${n.title}" and ${others} cause${others > 1 ? 's' : ''} that only it supports?`)) return;
  const effect = effectsOf(n.id)[0];
  deleteNodes(ids);
  selected = effect?.id ?? null;
  render(); persist();
  setStatus(`Deleted ${ids.length} node${ids.length > 1 ? 's' : ''}`);
}

// A candidate cause that the evidence rejects moves to the causes ruled out, with its evidence.
function ruleOutSelected() {
  const n = byId(selected);
  if (!n || n.id === state.problem.primaryEffectId) return;
  const ids = deletionSet(n.id), others = ids.length - 1;
  if (others && !confirm(`Rule out "${n.title}"? The ${others} cause${others > 1 ? 's' : ''} that only it supports will be deleted.`)) return;
  const r = {id: uuid(), cause: n.title, kind: n.kind === 'effect' ? '' : n.kind, test: '', evidenceIds: [...n.evidenceIds], status: 'ruled-out'};
  state.ruledOut.push(r);
  // A fishbone cause that was this node is now this ruled-out cause.
  for (const c of fishCauses()) if (c.nodeId === n.id) Object.assign(c, {nodeId: null, ruledOutId: r.id});
  const effect = effectsOf(n.id)[0];
  deleteNodes(ids);
  selected = effect?.id ?? null;
  render(); persist();
  setStatus(`Moved "${n.title}" to the causes ruled out`);
}

// Collapsing is a view setting: saved with the file, but not an undo step.
function toggleCollapse(id = selected) {
  if (!causeLinks(id).length) return;
  if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id);
  render(); autosave();
}
function expandAll() {
  collapsed.clear();
  render(); autosave();
}

// Linking an existing node as a further cause of the selected effect: the next node clicked is linked.
function startLinking() {
  const n = byId(selected);
  if (!n) return;
  linking = {mode: 'link', effectId: n.id};
  render();
}
// Moving: the next node clicked becomes the effect of the selected cause.
function startMoving() {
  const n = byId(selected), from = layout.parent.get(selected);
  if (!n || !from) return;
  linking = {mode: 'move', causeId: n.id, fromId: from};
  render();
}
function pickNode(id) {
  if (linking.mode === 'move') moveTo(linking.causeId, linking.fromId, id);
  else linkTo(id);
}
function moveTo(causeId, fromId, toId) {
  const problem = moveCause(causeId, fromId, toId);
  if (problem) { setStatus(problem); return false; }
  linking = null; selected = causeId;
  render(); persist();
  scrollToNode(causeId);
  setStatus(`Moved "${byId(causeId).title}" under "${byId(toId).title}"`);
  return true;
}
// Alt+Up and Alt+Down: swap with the neighbouring cause of the same kind under the same effect.
function nudgeCause(direction) {
  const effect = layout.parent.get(selected), n = byId(selected);
  if (!effect || !n) return;
  const group = (layout.children.get(effect) || []).filter(c => c.kind === n.kind);
  const i = group.findIndex(c => c.id === n.id), other = group[i + direction];
  if (!other) return;
  placeCause(effect, n.id, other.id, direction > 0);
  render(); persist();
  scrollToNode(n.id);
}
function cancelLinking() {
  linking = null;
  render();
}
function linkTo(causeId) {
  const effectId = linking.effectId, problem = linkProblem(effectId, causeId);
  if (problem) { setStatus(problem); return; }
  addLink(effectId, causeId);
  collapsed.delete(effectId);
  linking = null; selected = effectId;
  render(); persist();
  setStatus(`Linked "${byId(causeId).title}" as a cause of "${byId(effectId).title}"`);
}
// A cause keeps at least one effect; to take it off the chart, delete it.
function unlinkFrom(effectId, causeId) {
  if (effectLinks(causeId).length < 2) return;
  state.links = state.links.filter(l => !(l.effectId === effectId && l.causeId === causeId));
  render(); persist();
}

$('addAction').onclick = () => addCauseToSelected('action');
$('addCondition').onclick = () => addCauseToSelected('condition');
$('deleteNode').onclick = deleteSelected;
$('linkCause').onclick = startLinking;
$('cancelLink').onclick = cancelLinking;
