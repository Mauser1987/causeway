// Constants: file format, node kinds, chart geometry and colours.

const NS = 'http://www.w3.org/2000/svg';
const FILE_TYPE = 'apollo-rca';
const SCHEMA_VERSION = 1;
const STORAGE_KEY = 'apollo-rca-v1';
const HISTORY_LIMIT = 100;

const KINDS = {
  effect: {name: 'Primary effect', label: 'PRIMARY EFFECT'},
  action: {name: 'Action', label: 'ACTION'},
  condition: {name: 'Condition', label: 'CONDITION'},
};
const STOP_REASONS = {
  'outside-control': 'Outside our control',
  'solution-found': 'Effective solution found',
  'no-evidence': 'No further evidence',
  'no-value': 'Going further adds nothing',
};

// Chart geometry, in chart units (one unit is one CSS pixel at 100 %).
const NODE_W = 200;
const NODE_PAD_X = 12;
const NODE_PAD_Y = 9;
const KIND_LINE = 15;        // the small kind label above the title
const TITLE_LINE = 16;
const TITLE_SIZE = 12.5;
const FOOT_LINE = 20;        // evidence codes and tags under the title
const COL_GAP = 84;          // horizontal space between columns, where the connectors run
const SIBLING_GAP = 16;      // vertical space between neighbouring causes
const SUBTREE_GAP = 30;      // and between neighbouring branches
const CHART_FONT = '"Segoe UI", system-ui, -apple-system, Arial, sans-serif';

// Colours are written into the SVG as attributes, so an exported chart needs no stylesheet.
const CHART_COLORS = {
  background: '#ffffff',
  effect: {fill: '#b3261e', stroke: '#8f1c16', text: '#ffffff', sub: '#ffd9d6', code: {fill: 'rgba(255,255,255,.18)', text: '#ffffff'}},
  action: {fill: '#0b5f66', stroke: '#084a50', text: '#ffffff', sub: '#bfe6e8', code: {fill: 'rgba(255,255,255,.16)', text: '#ffffff'}},
  condition: {fill: '#eef7f7', stroke: '#0d858f', text: '#16232f', sub: '#0b6e75', code: {fill: '#ffffff', stroke: '#b9dfe2', text: '#084f54'}},
  wire: '#8796a4',
  junction: {fill: '#ffffff', text: '#3d4f60'},
  shared: '#7b5ab7',
  select: '#2563eb',
  issue: '#c2570c',
  unverified: {fill: '#c2570c', text: '#ffffff'},
  controllable: {fill: '#2f7a3a', text: '#ffffff'},
  stop: '#16232f',
};
const MONO_FONT = 'ui-monospace, "Cascadia Mono", Consolas, "Liberation Mono", monospace';
