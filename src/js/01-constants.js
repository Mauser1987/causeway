// Constants: file format, node kinds, chart geometry and colours.

const NS = 'http://www.w3.org/2000/svg';
const FILE_TYPE = 'causeway';
const LEGACY_FILE_TYPE = 'apollo-rca';   // files saved before the tool was named Causeway
const SCHEMA_VERSION = 1;
const STORAGE_KEY = 'causeway-v1';
const LEGACY_STORAGE_KEY = 'apollo-rca-v1';
const HISTORY_LIMIT = 100;

const KINDS = {
  effect: {name: 'Primary effect', label: 'PRIMARY EFFECT'},
  action: {name: 'Action', label: 'ACTION'},
  condition: {name: 'Condition', label: 'CONDITION'},
  cause: {name: 'Cause', label: 'CAUSE'},          // a cause without a type: made in a cause tree
};
// The two chart styles an RCA can have. Apollo: each effect has its actions and conditions, all
// needed (AND). Cause tree: each effect has its possible causes, any of which may explain it.
const CHART_STYLES = {
  apollo: {name: 'Apollo', about: 'Each effect has at least one action and one condition, all needed (AND).'},
  tree: {name: 'Cause tree', about: 'Each effect has its possible causes, any of which may explain it. Test each hypothesis until it is confirmed or ruled out.'},
};
// A cause's status in a cause tree.
const STATUSES = {
  possible: {name: 'Hypothesis', label: 'HYPOTHESIS', mark: 'H'},
  confirmed: {name: 'Confirmed', label: '✓ CONFIRMED', mark: '✓'},
  'ruled-out': {name: 'Ruled out', label: '✕ RULED OUT', mark: '✕'},
};
// A root cause's type, as 8D asks for it: why the failure happened, why it was not caught, and why
// the system allowed it.
const CAUSE_TYPES = {
  occurrence: {name: 'Occurrence', tag: 'OCCURRENCE', about: 'Why the failure happened'},
  escape: {name: 'Escape point', tag: 'ESCAPE', about: 'Why it was not detected or caught earlier', missing: 'No cause is marked as escape point: why was the failure not detected or caught earlier?'},
  systemic: {name: 'Systemic', tag: 'SYSTEMIC', about: 'Why the system (design, planning, procedures, management) allowed it', missing: 'No cause is marked systemic: what in design, planning, procedures, or management allowed it?'},
};
const STOP_REASONS = {
  'outside-control': 'Outside our control',
  'solution-found': 'Effective solution found',
  'no-evidence': 'No further evidence',
  'no-value': 'Going further adds nothing',
};

// Record values. Keys are what the file stores; values are what the page shows.
const EVIDENCE_TYPES = {sensed: 'Sensed', inferred: 'Inferred'};
const RULED_OUT_STATUS = {'testing': 'Being tested', 'ruled-out': 'Ruled out'};
const CRITERIA = {
  preventsRecurrence: 'Prevents recurrence?', withinControl: 'Within our control?',
  meetsGoals: 'Meets our goals?', noNewProblems: 'No new problems?',
};
const CRITERION_VALUES = {yes: 'Yes', partly: 'Partly', no: 'No'};
const DECISIONS = {implement: 'Implement', study: 'Study further', reject: 'Reject'};
const ACTION_STATUS = {open: 'Open', 'in-progress': 'In progress', done: 'Done', cancelled: 'Cancelled'};
// Starting categories for a fishbone diagram; each can be renamed, added, or removed.
const FISHBONE_PRESETS = {
  seal: {name: 'Seal failure', categories: ['Seal and materials', 'Installation', 'Operation', 'Process fluid', 'Support system', 'Pump and equipment']},
  '6m': {name: '6M', categories: ['People', 'Method', 'Machine', 'Material', 'Measurement', 'Environment']},
  blank: {name: 'Four blank categories', categories: ['Category 1', 'Category 2', 'Category 3', 'Category 4']},
};
// Starting phases for a sequence of events; each can be renamed, added, or removed.
const TIMELINE_PRESETS = {
  test: {name: 'Test run', phases: ['Pre-test work', 'Testing', 'Post-test work', 'Report']},
  field: {name: 'Field failure', phases: ['Before the event', 'Lead-up', 'Failure', 'Response']},
  blank: {name: 'Three blank phases', phases: ['Phase 1', 'Phase 2', 'Phase 3']},
};

// Chart geometry, in chart units (one unit is one CSS pixel at 100 %).
const NODE_W = 200;
const NODE_PAD_X = 12;
const NODE_PAD_Y = 9;
const KIND_LINE = 15;        // the small kind label above the title
const BADGE_ROOM = 14;       // in a cause tree, what the title leaves free for the status badge
const TITLE_LINE = 16;
const TITLE_SIZE = 12.5;
const FOOT_LINE = 20;        // evidence codes and tags under the title
const COL_GAP = 84;          // horizontal space between columns, where the connectors run
const SIBLING_GAP = 16;      // vertical space between neighbouring causes
const SUBTREE_GAP = 30;      // and between neighbouring branches
const CHART_FONT = '"Segoe UI", system-ui, -apple-system, Arial, sans-serif';

// Colours are written into the SVG as attributes, so an exported chart needs no stylesheet.
// Exports and print use the light palette; the canvas uses the dark one in the dark theme.
const CHART_COLORS = {
  panel: '#ffffff',
  effect: {fill: '#b3261e', stroke: '#8f1c16', text: '#ffffff', sub: '#ffd9d6', code: {fill: 'rgba(255,255,255,.18)', text: '#ffffff'}},
  action: {fill: '#0b5f66', stroke: '#084a50', text: '#ffffff', sub: '#bfe6e8', code: {fill: 'rgba(255,255,255,.16)', text: '#ffffff'}},
  condition: {fill: '#eef7f7', stroke: '#0d858f', text: '#16232f', sub: '#0b6e75', code: {fill: '#ffffff', stroke: '#b9dfe2', text: '#084f54'}},
  cause: {fill: '#ffffff', stroke: '#5b6b7a', text: '#16232f', sub: '#5b6b7a', dash: '5 3', code: {fill: '#e3f2f3', text: '#084f54'}},
  // Cause tree: a cause is drawn by its status.
  possible: {fill: '#ffffff', stroke: '#5b6b7a', text: '#16232f', sub: '#8a3f00', dash: '5 3', code: {fill: '#e3f2f3', text: '#084f54'}},
  confirmed: {fill: '#0b5f66', stroke: '#084a50', text: '#ffffff', sub: '#bfe6e8', code: {fill: 'rgba(255,255,255,.16)', text: '#ffffff'}},
  ruled: {fill: '#eef1f4', stroke: '#cbd5de', text: '#6a7884', sub: '#6a7884', code: {fill: '#ffffff', stroke: '#dde3e8', text: '#6a7884'}},
  confirmedWire: '#0b5f66',
  ruledWire: '#a9b5c0',
  wire: '#8796a4',
  junctionText: '#3d4f60',
  shared: '#7b5ab7',
  select: '#2563eb',
  highlight: '#e0a100',
  issue: '#c2570c',
  unverified: {fill: '#c2570c', text: '#ffffff'},
  controllable: {fill: '#2f7a3a', text: '#ffffff'},
  stop: '#16232f',
  stopText: '#ffffff',
};
const CHART_COLORS_DARK = {
  panel: '#161f28',
  effect: {fill: '#b8312a', stroke: '#e0574f', text: '#ffffff', sub: '#ffd9d6', code: {fill: 'rgba(255,255,255,.2)', text: '#ffffff'}},
  action: {fill: '#0d6e76', stroke: '#2a9aa2', text: '#ffffff', sub: '#c5ecee', code: {fill: 'rgba(255,255,255,.18)', text: '#ffffff'}},
  condition: {fill: '#13272c', stroke: '#3fb5bd', text: '#e3eef0', sub: '#7fd0d6', code: {fill: '#0e1c20', stroke: '#2f6e74', text: '#9fe2e6'}},
  cause: {fill: '#161f28', stroke: '#93a3b2', text: '#e3eaf0', sub: '#93a3b2', dash: '5 3', code: {fill: '#123238', text: '#8fdde2'}},
  possible: {fill: '#161f28', stroke: '#93a3b2', text: '#e3eaf0', sub: '#f3b27a', dash: '5 3', code: {fill: '#123238', text: '#8fdde2'}},
  confirmed: {fill: '#0d6e76', stroke: '#2a9aa2', text: '#ffffff', sub: '#c5ecee', code: {fill: 'rgba(255,255,255,.18)', text: '#ffffff'}},
  ruled: {fill: '#1b252f', stroke: '#2b3844', text: '#7d8b97', sub: '#7d8b97', code: {fill: '#161f28', stroke: '#2b3844', text: '#7d8b97'}},
  confirmedWire: '#3fb5bd',
  ruledWire: '#3a4955',
  wire: '#6f8294',
  junctionText: '#c9d5df',
  shared: '#a58be0',
  select: '#6b97ff',
  highlight: '#f2b632',
  issue: '#f08a3c',
  unverified: {fill: '#e0782f', text: '#ffffff'},
  controllable: {fill: '#3f9a4c', text: '#ffffff'},
  stop: '#e3eaf0',
  stopText: '#0e151c',
};
const MONO_FONT = 'ui-monospace, "Cascadia Mono", Consolas, "Liberation Mono", monospace';
