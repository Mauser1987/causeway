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

$('addAction').onclick = () => addCauseToSelected('action');
$('addCondition').onclick = () => addCauseToSelected('condition');
$('deleteNode').onclick = deleteSelected;
