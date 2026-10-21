// RCA files: new, open, save, and checking files on the way in.

let fileHandle = null;   // the file last opened or saved, where the File System Access API exists
const canPickFiles = typeof window.showSaveFilePicker === 'function' && typeof window.showOpenFilePicker === 'function';
const FILE_TYPES = [{description: 'Apollo RCA', accept: {'application/json': ['.json']}}];

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
  if (p?.type !== FILE_TYPE) throw Error('This is not an Apollo RCA file.');
  if (!Number.isInteger(p.schemaVersion) || p.schemaVersion > SCHEMA_VERSION) throw Error(`File format version ${p.schemaVersion} is newer than this tool understands (${SCHEMA_VERSION}).`);
  if (!Array.isArray(p.nodes) || !Array.isArray(p.links)) throw Error('The file has no chart.');
  const blank = blankState();
  const s = {
    ...blank, ...p,
    meta: {...blank.meta, ...p.meta, dates: {...blank.meta.dates, ...p.meta?.dates}},
    problem: {...blank.problem, ...p.problem, significance: {...blank.problem.significance, ...p.problem?.significance}},
  };
  for (const key of ['evidence', 'ruledOut', 'solutions', 'actions']) s[key] = Array.isArray(p[key]) ? p[key] : [];
  s.nodes = p.nodes.filter(n => n?.id).map(n => ({...blankNode(n.kind in KINDS ? n.kind : 'condition', ''), ...n,
    evidenceIds: Array.isArray(n.evidenceIds) ? n.evidenceIds : []}));
  if (!s.nodes.some(n => n.id === s.problem.primaryEffectId)) throw Error('The primary effect is missing.');
  for (const sol of s.solutions) sol.causeIds = Array.isArray(sol.causeIds) ? sol.causeIds : [];
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
$('newProject').onclick = () => {
  if (!confirmDiscard('Start a new RCA?')) return;
  fileHandle = null;
  replaceState(blankState());
  select(state.problem.primaryEffectId);
  focusTitle();
};
$('loadExample').onclick = () => {
  if (!confirmDiscard('Load the example?')) return;
  fileHandle = null;
  replaceState(exampleRca());
  setStatus('Loaded the P-101A example');
};

window.addEventListener('beforeunload', e => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });
