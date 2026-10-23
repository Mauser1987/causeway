// RCA files: new, open, save, and checking files on the way in.

let fileHandle = null;   // the file last opened or saved, where the File System Access API exists
const canPickFiles = typeof window.showSaveFilePicker === 'function' && typeof window.showOpenFilePicker === 'function';
const FILE_TYPES = [{description: 'Causeway RCA', accept: {'application/json': ['.json']}}];
const OPEN_TYPES = [{description: 'Causeway RCA or XMind mind map', accept: {'application/json': ['.json'], 'application/zip': ['.xmind']}}];

function download(name, blob) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
const baseName = () => (state.meta.rcaNumber.trim() || primaryEffect()?.title.trim() || 'rca')
  .replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'rca';
const projectBlob = () => new Blob([JSON.stringify(serialize(), null, 2)], {type: 'application/json'});

async function saveProject(saveAs = false) {
  try {
    if (canPickFiles) {
      if (saveAs || !fileHandle) fileHandle = await window.showSaveFilePicker({suggestedName: baseName() + '.json', types: FILE_TYPES});
      const writable = await fileHandle.createWritable();
      await writable.write(projectBlob());
      await writable.close();
    } else download(baseName() + '.json', projectBlob());
    markSaved(); autosave();
    setStatus(`Saved ${fileHandle?.name || baseName() + '.json'}`);
  } catch (err) {
    if (err.name !== 'AbortError') alert('Could not save: ' + err.message);
  }
}

const confirmDiscard = what => !isDirty() || confirm(`${what} The current RCA has unsaved changes, which will be lost. Continue?`);

// Checks a file and fills in what older or hand-edited files leave out. Throws when it is not an RCA.
function normalizeProject(p) {
  if (p?.type !== FILE_TYPE && p?.type !== LEGACY_FILE_TYPE) throw Error('This is not a Causeway RCA file.');
  if (!Number.isInteger(p.schemaVersion) || p.schemaVersion > SCHEMA_VERSION) throw Error(`File format version ${p.schemaVersion} is newer than this tool understands (${SCHEMA_VERSION}).`);
  if (!Array.isArray(p.nodes) || !Array.isArray(p.links)) throw Error('The file has no chart.');
  const blank = blankState(p.meta?.style === 'tree' ? 'tree' : 'apollo');
  const s = {
    ...blank, ...p, type: FILE_TYPE,
    meta: {...blank.meta, ...p.meta, style: blank.meta.style, dates: {...blank.meta.dates, ...p.meta?.dates}},
    problem: {...blank.problem, ...p.problem, significance: {...blank.problem.significance, ...p.problem?.significance}},
  };
  for (const key of ['evidence', 'ruledOut', 'solutions', 'actions']) s[key] = Array.isArray(p[key]) ? p[key] : [];
  s.nodes = p.nodes.filter(n => n?.id).map(n => ({...blankNode(n.kind in KINDS ? n.kind : 'condition', ''), ...n,
    kind: n.kind in KINDS ? n.kind : 'condition', status: n.status in STATUSES ? n.status : 'possible', test: typeof n.test === 'string' ? n.test : '',
    offsetY: Number.isFinite(n.offsetY) ? n.offsetY : 0, causeType: n.causeType in CAUSE_TYPES ? n.causeType : '',
    evidenceIds: Array.isArray(n.evidenceIds) ? n.evidenceIds : []}));
  if (!s.nodes.some(n => n.id === s.problem.primaryEffectId)) throw Error('The primary effect is missing.');
  s.meta.team = Array.isArray(s.meta.team) ? s.meta.team.filter(m => m?.id) : [];
  s.equipment = Object.fromEntries(EQUIPMENT_KEYS.filter(k => typeof p.equipment?.[k] === 'string').map(k => [k, p.equipment[k]]));
  s.counters = {evidence: Number.isInteger(p.counters?.evidence) ? p.counters.evidence : 1};
  s.evidence = s.evidence.filter(e => e?.id).map(e => ({code: '', description: '', type: 'sensed', source: '', collectedBy: '', date: '', ...e}));
  s.ruledOut = s.ruledOut.filter(r => r?.id).map(r => ({cause: '', kind: '', test: '', status: 'ruled-out', ...r, evidenceIds: Array.isArray(r.evidenceIds) ? r.evidenceIds : []}));
  s.solutions = s.solutions.filter(x => x?.id).map(x => ({title: '', decision: '', ...x, causeIds: Array.isArray(x.causeIds) ? x.causeIds : [],
    criteria: Object.fromEntries(Object.keys(CRITERIA).map(k => [k, {v: '', c: '', ...x.criteria?.[k]}]))}));
  s.fiveWhys = (Array.isArray(p.fiveWhys) ? p.fiveWhys : []).filter(c => c?.id).map(c => ({...c,
    effectId: s.nodes.some(n => n.id === c.effectId) ? c.effectId : s.problem.primaryEffectId,
    steps: (Array.isArray(c.steps) ? c.steps : []).filter(x => x?.id).map(x => ({answer: '', kind: 'condition', ...x,
      evidenceIds: Array.isArray(x.evidenceIds) ? x.evidenceIds : [], nodeId: s.nodes.some(n => n.id === x.nodeId) ? x.nodeId : null}))}));
  const nodeIds = new Set(s.nodes.map(n => n.id)), ruledIds = new Set(s.ruledOut.map(r => r.id));
  s.fishbones = (Array.isArray(p.fishbones) ? p.fishbones : []).filter(f => f?.id).map(f => ({...f,
    effectId: nodeIds.has(f.effectId) ? f.effectId : s.problem.primaryEffectId,
    categories: (Array.isArray(f.categories) ? f.categories : []).filter(g => g?.id).map(g => {
      const causes = (Array.isArray(g.causes) ? g.causes : []).filter(c => c?.id);
      const top = new Set(causes.filter(c => !c.parentId).map(c => c.id));
      return {name: '', ...g, causes: causes.map(c => ({text: '', kind: 'condition', ...c,
        evidenceIds: Array.isArray(c.evidenceIds) ? c.evidenceIds : [],
        nodeId: nodeIds.has(c.nodeId) ? c.nodeId : null,
        ruledOutId: !nodeIds.has(c.nodeId) && ruledIds.has(c.ruledOutId) ? c.ruledOutId : null,
        parentId: top.has(c.parentId) ? c.parentId : null}))};
    })}));
  const when = v => typeof v === 'string' && eventMinutes(v) !== null ? v : '';
  s.timelines = (Array.isArray(p.timelines) ? p.timelines : []).filter(t => t?.id).map(t => ({...t,
    effectId: nodeIds.has(t.effectId) ? t.effectId : s.problem.primaryEffectId,
    phases: (Array.isArray(t.phases) ? t.phases : []).filter(ph => ph?.id).map(ph => ({name: '', ...ph,
      events: (Array.isArray(ph.events) ? ph.events : []).filter(ev => ev?.id).map(ev => ({text: '', ...ev,
        start: when(ev.start), end: when(ev.end), kind: ['action', 'condition'].includes(ev.kind) ? ev.kind : 'action', deviation: ev.deviation === true,
        evidenceIds: Array.isArray(ev.evidenceIds) ? ev.evidenceIds : [], nodeId: nodeIds.has(ev.nodeId) ? ev.nodeId : null}))}))}));
  s.actions = s.actions.filter(a => a?.id).map(a => ({action: '', solutionId: '', owner: '', due: '', verification: '', ...a,
    status: a.status === 'done' ? 'implemented' : a.status in ACTION_STATUS ? a.status : 'open',
    kind: a.kind in ACTION_KINDS ? a.kind : 'corrective', strength: a.strength in ACTION_STRENGTH ? a.strength : '',
    effectiveness: {date: '', result: '', ...a.effectiveness}}));
  // Links to missing nodes, duplicates, and links that would close a loop are dropped.
  const previous = state;
  state = {...s, links: []};
  try {
    for (const l of p.links) if (byId(l?.effectId) && byId(l?.causeId) && !linkProblem(l.effectId, l.causeId)) state.links.push({id: l.id || uuid(), effectId: l.effectId, causeId: l.causeId});
    return {...state};
  } finally { state = previous; }
}

function loadProject(data, handle = null) {
  replaceState(normalizeProject(data));
  fileHandle = handle;
  setStatus('Opened ' + (handle?.name || 'RCA'));
}

// ---- XMind mind maps ----
// An .xmind file is a zip: XMind 8 keeps the map in content.xml, XMind 2020 and later in content.json.
// The first sheet opens as a new, unsaved cause tree: the central topic is the primary effect and each
// attached topic a possible cause, with its notes. A topic "Evidence: …" without subtopics becomes an
// evidence item that its parent cites. Floating topics, relationships, markers, and styles are left out.

const isZip = bytes => bytes[0] === 0x50 && bytes[1] === 0x4b;

// The text of one file in a zip, or null when it is not there.
async function zipText(buffer, name) {
  const v = new DataView(buffer), bytes = new Uint8Array(buffer), text = new TextDecoder();
  let end = buffer.byteLength - 22;
  while (end >= 0 && v.getUint32(end, true) !== 0x06054b50) end--;
  if (end < 0) throw Error('The file is not a zip archive.');
  for (let i = 0, at = v.getUint32(end + 16, true); i < v.getUint16(end + 10, true) && v.getUint32(at, true) === 0x02014b50; i++) {
    const method = v.getUint16(at + 10, true), size = v.getUint32(at + 20, true), local = v.getUint32(at + 42, true);
    const nameLength = v.getUint16(at + 28, true);
    if (text.decode(bytes.subarray(at + 46, at + 46 + nameLength)) === name) {
      const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true), data = bytes.subarray(start, start + size);
      if (method === 0) return text.decode(data);
      if (method !== 8) throw Error(`${name} is packed in a way this tool cannot read.`);
      if (typeof DecompressionStream !== 'function') throw Error('This browser cannot unpack the file; use a recent Chrome, Edge, or Firefox.');
      return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    }
    at += 46 + nameLength + v.getUint16(at + 30, true) + v.getUint16(at + 32, true);
  }
  return null;
}

// The sheets of a map, each as its central topic: {title, notes, topics}.
async function xmindSheets(buffer) {
  const json = await zipText(buffer, 'content.json');
  if (json !== null) {
    const topic = t => ({title: t?.title || '', notes: t?.notes?.plain?.content || '', topics: (t?.children?.attached || []).map(topic)});
    return (JSON.parse(json) || []).filter(sheet => sheet?.rootTopic).map(sheet => topic(sheet.rootTopic));
  }
  const xml = await zipText(buffer, 'content.xml');
  if (xml === null) throw Error('The file has no mind map in it.');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw Error('The mind map could not be read.');
  const kids = (el, name) => [...el?.children || []].filter(c => c.localName === name);
  const topic = t => ({title: kids(t, 'title')[0]?.textContent || '', notes: kids(kids(t, 'notes')[0], 'plain')[0]?.textContent || '',
    topics: kids(kids(t, 'children')[0], 'topics').filter(g => g.getAttribute('type') === 'attached').flatMap(g => kids(g, 'topic')).map(topic)});
  return kids(doc.documentElement, 'sheet').map(sheet => kids(sheet, 'topic')[0]).filter(Boolean).map(topic);
}

function xmindProject(root) {
  const s = blankState('tree'), clean = text => text.replace(/\r/g, '').split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
  const add = (t, parent) => {
    const title = clean(t.title), evidence = parent && !t.topics.length && /^evidence\s*:\s*(.+)$/is.exec(title);
    if (evidence) {
      const e = {id: uuid(), code: `E${s.counters.evidence++}`, description: evidence[1], type: 'sensed', source: '', collectedBy: '', date: ''};
      s.evidence.push(e); parent.evidenceIds.push(e.id);
      return;
    }
    const n = {...blankNode(parent ? 'cause' : 'effect', title), notes: t.notes.trim()};
    s.nodes.push(n);
    if (parent) s.links.push({id: uuid(), effectId: parent.id, causeId: n.id});
    for (const kid of t.topics) add(kid, n);
    return n;
  };
  s.nodes = [];
  s.problem.primaryEffectId = add(root, null).id;
  return s;
}

async function openFile(file, handle = null) {
  const buffer = await file.arrayBuffer();
  if (!/\.xmind$/i.test(file.name) && !isZip(new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength)))) {
    loadProject(JSON.parse(new TextDecoder().decode(buffer)), handle);
    return;
  }
  const sheets = await xmindSheets(buffer);
  if (!sheets.length) throw Error('The mind map is empty.');
  // Imported, not opened: Save writes a new Causeway file and leaves the map as it was.
  replaceState(normalizeProject(xmindProject(sheets[0])), {saved: false});
  fileHandle = null;
  setStatus(`Imported ${file.name}${sheets.length > 1 ? ` (the first of its ${sheets.length} sheets)` : ''} as a cause tree`);
}

async function openProject() {
  if (!confirmDiscard('Open another RCA?')) return;
  if (!canPickFiles) { $('projectFile').click(); return; }
  try {
    const [handle] = await window.showOpenFilePicker({types: OPEN_TYPES});
    await openFile(await handle.getFile(), handle);
  } catch (err) {
    if (err.name !== 'AbortError') alert('Could not open the file: ' + err.message);
  }
}
$('projectFile').onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  try { await openFile(file); }
  catch (err) { alert('Could not open the file: ' + err.message); }
  e.target.value = '';
};

$('openProject').onclick = openProject;
$('saveProject').onclick = () => saveProject();
$('saveProjectAs').onclick = () => saveProject(true);
// A new RCA starts with its chart style chosen.
$('newProject').onclick = () => {
  if (!confirmDiscard('Start a new RCA?')) return;
  openDialog(`<h2>New RCA</h2>
    <p>Choose how the causes are charted. You can switch later; Causeway then shows what the other style still needs.</p>
    <div class="style-choices">${Object.entries(CHART_STYLES).map(([k, st], i) =>
      `<button class="style-choice" data-choice="${k}" ${i ? '' : 'autofocus'}><b>${st.name}</b><span>${st.about}</span></button>`).join('')}</div>
    <div class="dialog-foot"><button class="button" data-choice="">Cancel</button></div>`, newProject);
};
function newProject(style) {
  fileHandle = null;
  replaceState(blankState(style));
  select(state.problem.primaryEffectId);
  focusTitle();
  setStatus(`New RCA: ${CHART_STYLES[style].name}`);
}
$('loadExample').onclick = () => {
  if (!confirmDiscard('Load the example?')) return;
  fileHandle = null;
  replaceState(exampleRca());
  setStatus('Loaded the P-101A example');
};

window.addEventListener('beforeunload', e => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });
