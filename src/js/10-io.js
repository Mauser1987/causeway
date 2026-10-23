// RCA files: new, open, save, and checking files on the way in.

let fileHandle = null;   // the file last opened or saved, where the File System Access API exists
const canPickFiles = typeof window.showSaveFilePicker === 'function' && typeof window.showOpenFilePicker === 'function';
const FILE_TYPES = [{description: 'Causeway RCA', accept: {'application/json': ['.json']}}];

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
    offsetY: Number.isFinite(n.offsetY) ? n.offsetY : 0,
    evidenceIds: Array.isArray(n.evidenceIds) ? n.evidenceIds : []}));
  if (!s.nodes.some(n => n.id === s.problem.primaryEffectId)) throw Error('The primary effect is missing.');
  s.meta.team = Array.isArray(s.meta.team) ? s.meta.team.filter(m => m?.id) : [];
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
  s.actions = s.actions.filter(a => a?.id).map(a => ({action: '', solutionId: '', owner: '', due: '', verification: '', status: 'open', ...a,
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

async function openProject() {
  if (!confirmDiscard('Open another RCA?')) return;
  if (!canPickFiles) { $('projectFile').click(); return; }
  try {
    const [handle] = await window.showOpenFilePicker({types: FILE_TYPES});
    loadProject(JSON.parse(await (await handle.getFile()).text()), handle);
  } catch (err) {
    if (err.name !== 'AbortError') alert('Could not open the RCA: ' + err.message);
  }
}
$('projectFile').onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  try { loadProject(JSON.parse(await file.text())); }
  catch (err) { alert('Could not open the RCA: ' + err.message); }
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
