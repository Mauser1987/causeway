// The cause-and-effect graph: links, cycle check, deletion, and the Apollo rule checks.
// Links run from an effect to one of its causes; together they form a DAG rooted at the
// primary effect.

const causeLinks = id => state.links.filter(l => l.effectId === id);
const effectLinks = id => state.links.filter(l => l.causeId === id);
const causesOf = id => causeLinks(id).map(l => byId(l.causeId)).filter(Boolean);
const effectsOf = id => effectLinks(id).map(l => byId(l.effectId)).filter(Boolean);

// True when `from` reaches `to` by following causes.
function reaches(from, to) {
  const seen = new Set(), stack = [from];
  while (stack.length) {
    const id = stack.pop();
    if (id === to) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const l of causeLinks(id)) stack.push(l.causeId);
  }
  return false;
}

// Why `causeId` cannot become a cause of `effectId`, or null when it can.
function linkProblem(effectId, causeId) {
  if (effectId === causeId) return 'A cause cannot cause itself.';
  if (causeId === state.problem.primaryEffectId) return 'The primary effect cannot be a cause.';
  if (state.links.some(l => l.effectId === effectId && l.causeId === causeId)) return 'It is already a cause of this effect.';
  if (reaches(causeId, effectId)) return 'That would make a loop: the effect is already among its causes.';
  return null;
}
function addLink(effectId, causeId) {
  if (linkProblem(effectId, causeId)) return null;
  const link = {id: uuid(), effectId, causeId};
  state.links.push(link);
  return link;
}

function addCause(effectId, kind, title = kind === 'action' ? 'New action' : 'New condition') {
  const n = blankNode(kind, title);
  state.nodes.push(n);
  addLink(effectId, n.id);
  collapsed.delete(effectId);
  return n;
}

// Evidence codes are E1, E2, … and are never reused: the counter remembers codes of deleted items.
const nextEvidenceNumber = () => Math.max(state.counters.evidence || 1, ...state.evidence.map(e => (+/^E(\d+)$/.exec(e.code)?.[1] || 0) + 1));
const nextEvidenceCode = () => 'E' + nextEvidenceNumber();
function addEvidence(description = '') {
  const number = nextEvidenceNumber();
  const e = {id: uuid(), code: 'E' + number, description, type: 'sensed', source: '', collectedBy: '', date: today()};
  state.evidence.push(e);
  state.counters.evidence = number + 1;
  return e;
}
// Where an evidence item is cited: chart nodes and ruled-out causes.
const citingNodes = id => state.nodes.filter(n => n.evidenceIds.includes(id));
const citingRuledOut = id => state.ruledOut.filter(r => r.evidenceIds.includes(id));
function deleteEvidence(id) {
  state.evidence = state.evidence.filter(e => e.id !== id);
  for (const x of [...state.nodes, ...state.ruledOut]) x.evidenceIds = x.evidenceIds.filter(e => e !== id);
  if (highlight === id) highlight = null;
}
const solutionsOf = id => state.solutions.filter(s => s.causeIds.includes(id));
const actionsOf = id => state.actions.filter(a => a.solutionId === id);
const blankCriteria = () => Object.fromEntries(Object.keys(CRITERIA).map(k => [k, {v: '', c: ''}]));
function addSolution(causeIds = []) {
  const s = {id: uuid(), title: '', causeIds, criteria: blankCriteria(), decision: ''};
  state.solutions.push(s);
  return s;
}
function addAction(solutionId = '') {
  const a = {id: uuid(), action: '', solutionId, owner: '', due: '', verification: '', status: 'open', effectiveness: {date: '', result: ''}};
  state.actions.push(a);
  return a;
}
const isOverdue = a => a.due && a.due < today() && !['done', 'cancelled'].includes(a.status);

// Nodes reachable from the primary effect.
function reachable(links = state.links) {
  const seen = new Set(), stack = [state.problem.primaryEffectId];
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    for (const l of links) if (l.effectId === id) stack.push(l.causeId);
  }
  return seen;
}

// Deleting a node also deletes the causes that only it supported. Returns their ids,
// the node itself first, without changing anything.
function deletionSet(id) {
  if (id === state.problem.primaryEffectId) return [];
  const remaining = state.links.filter(l => l.effectId !== id && l.causeId !== id);
  const keep = reachable(remaining);
  return [id, ...state.nodes.filter(n => n.id !== id && !keep.has(n.id)).map(n => n.id)];
}
function deleteNodes(ids) {
  const gone = new Set(ids);
  state.nodes = state.nodes.filter(n => !gone.has(n.id));
  state.links = state.links.filter(l => !gone.has(l.effectId) && !gone.has(l.causeId));
  for (const s of state.solutions) s.causeIds = s.causeIds.filter(id => !gone.has(id));
  for (const id of gone) collapsed.delete(id);
}
function removeLink(linkId) {
  state.links = state.links.filter(l => l.id !== linkId);
}

// Expands every collapsed branch that hides the node. Returns whether anything changed.
function reveal(id) {
  const hiding = [...collapsed].filter(c => c !== id && reaches(c, id));
  hiding.forEach(c => collapsed.delete(c));
  return hiding.length > 0;
}

// ---- Rule checks ----
// A node is an effect when something is charted as its cause. Each effect needs at least one
// action and one condition; each cause needs evidence; each branch ends in a stop point.

const isCause = n => n.kind !== 'effect';
const needsEvidence = n => n.unverified || !n.evidenceIds.some(evidenceById);

function ruleIssues() {
  const issues = [];
  const live = reachable();
  for (const n of state.nodes) {
    if (!live.has(n.id)) continue;
    const causes = causesOf(n.id);
    const isEffect = causes.length > 0 || n.kind === 'effect';
    if (isEffect) {
      const missing = ['action', 'condition'].filter(kind => !causes.some(c => c.kind === kind));
      if (missing.length) issues.push({nodeId: n.id, level: 'error', code: 'causal-set',
        text: `Needs ${missing.length === 2 ? 'an action and a condition' : missing[0] === 'action' ? 'an action' : 'a condition'} cause`});
    }
    if (isCause(n) && needsEvidence(n)) issues.push({nodeId: n.id, level: 'warning', code: 'evidence',
      text: n.unverified ? 'Marked unverified' : 'No evidence linked'});
    if (isCause(n) && !causes.length && !n.stopPoint) issues.push({nodeId: n.id, level: 'info', code: 'open-branch',
      text: 'Branch ends without a stop point'});
  }
  return issues;
}
