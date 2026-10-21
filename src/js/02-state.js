// RCA state, selection, undo history, and autosave.

const $ = id => document.getElementById(id);
const svg = $('chart');

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const mk = (tag, attrs = {}, parent) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (parent) parent.appendChild(el);
  return el;
};

// Stable identifiers, so a future server can import files without renumbering anything.
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = b[6] & 0x0f | 0x40; b[8] = b[8] & 0x3f | 0x80;
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
const today = () => new Date().toISOString().slice(0, 10);

const blankNode = (kind, title) => ({
  id: uuid(), kind, title, description: '', evidenceIds: [],
  unverified: false, controllable: false, stopPoint: null, notes: '',
});

function blankState() {
  const effect = blankNode('effect', 'Describe the primary effect');
  return {
    type: FILE_TYPE, schemaVersion: SCHEMA_VERSION, id: uuid(),
    meta: {rcaNumber: '', equipmentTag: '', sealType: '', leadId: '', team: [], dates: {opened: today(), eventDate: '', closed: ''}},
    problem: {primaryEffectId: effect.id, when: '', where: '', significance: {safety: '', environment: '', productionCost: '', reliability: ''}},
    nodes: [effect], links: [], evidence: [], ruledOut: [], solutions: [], actions: [],
    counters: {evidence: 1},
  };
}

let state = blankState();
let selected = null;           // node id
let collapsed = new Set();     // node ids whose causes are hidden; view state, not undoable
let view = {x: 0, y: 0, k: 1}; // chart point at the top-left of the canvas, and pixels per unit
let drag = null;               // the pointer gesture in progress
let linking = null;            // while picking a node: {mode: 'link', effectId} or {mode: 'move', causeId, fromId}
let nodeDrag = null;           // a node being dragged: {id, from, start, moved, at, drop}
let highlight = null;          // evidence id whose citing nodes are highlighted on the chart
let record = 'chart';          // the page shown: the chart or one of the RCA records

const byId = id => state.nodes.find(n => n.id === id);
const primaryEffect = () => byId(state.problem.primaryEffectId);
const evidenceById = id => state.evidence.find(e => e.id === id);

function resetInteraction() {
  selected = null; drag = null; nodeDrag = null; linking = null; highlight = null;
}

// The file and the autosave hold the RCA and the collapsed branches.
const serialize = () => ({...state, view: {collapsed: [...collapsed].filter(byId)}});

// ---- Undo history and autosave ----
// History stores serialized snapshots. persist() is called after every edit; passing the
// same group name for consecutive edits (typing in one field) merges them.

let undoStack = [], redoStack = [], historyCurrent = null, historyGroup = null;
let savedSnapshot = null;      // the RCA as last saved or opened, for the unsaved-changes warning

function updateHistoryButtons() {
  $('undo').disabled = undoStack.length === 0;
  $('redo').disabled = redoStack.length === 0;
}
function resetHistory() {
  undoStack = []; redoStack = []; historyCurrent = JSON.stringify(state); historyGroup = null;
  updateHistoryButtons();
}
const markSaved = () => { savedSnapshot = JSON.stringify(state); };
const isDirty = () => JSON.stringify(state) !== savedSnapshot;

// The autosave is crash recovery: it records whether the RCA had unsaved changes.
function autosave() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({savedAt: new Date().toISOString(), dirty: isDirty(), rca: serialize()})); }
  catch { setStatus('Autosave unavailable; use Save'); }
}
function persist(group = null) {
  const data = JSON.stringify(state);
  if (historyCurrent !== null && data !== historyCurrent) {
    if (!group || historyGroup !== group) {
      undoStack.push(historyCurrent);
      if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    }
    redoStack = []; historyCurrent = data; historyGroup = group;
  }
  updateHistoryButtons();
  autosave();
}
function restoreHistory(isRedo = false) {
  if (JSON.stringify(state) !== historyCurrent) persist();
  const source = isRedo ? redoStack : undoStack, destination = isRedo ? undoStack : redoStack;
  if (!source.length) return;
  destination.push(historyCurrent);
  state = JSON.parse(source.pop());
  historyCurrent = JSON.stringify(state); historyGroup = null;
  if (!byId(selected)) selected = null;
  render(); persist();
}

// Replaces the whole RCA: new, open, example, and startup.
function replaceState(next, {saved = true, fit = true} = {}) {
  const {view: saveView, ...rest} = next;
  state = rest;
  collapsed = new Set(saveView?.collapsed || []);
  resetInteraction();
  if (saved) markSaved(); else savedSnapshot = null;
  setRecord('chart');
  render(); persist(); resetHistory();
  if (fit) zoomToFit();
}
