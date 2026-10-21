// The cause-and-effect graph: links, cycle check, deletion, and the rule checks.
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
  for (const x of [...state.nodes, ...state.ruledOut, ...state.fiveWhys.flatMap(c => c.steps), ...fishCauses()]) x.evidenceIds = x.evidenceIds.filter(e => e !== id);
  if (highlight === id) highlight = null;
}
// ---- 5 Whys ----
// A chain starts from a chart node (effectId) and asks why, step after step; each answer is a cause
// of the one before. A step added to the chart is that node: its words, type, and evidence are the
// node's. Otherwise the step keeps its own.

const blankStep = () => ({id: uuid(), answer: '', kind: 'condition', evidenceIds: [], nodeId: null});
function addChain(effectId = state.problem.primaryEffectId) {
  const chain = {id: uuid(), effectId, steps: [blankStep()]};
  state.fiveWhys.push(chain);
  return chain;
}
const stepNode = step => step.nodeId ? byId(step.nodeId) : null;
const whyAnswer = step => stepNode(step)?.title ?? step.answer;
const stepSource = step => stepNode(step) ?? step;
const chainOf = stepId => state.fiveWhys.find(c => c.steps.some(s => s.id === stepId));
const stepById = id => chainOf(id)?.steps.find(s => s.id === id);

// The node a step's cause is added under: the previous step's node, or the chain's start for step 1.
function stepParent(chain, i) {
  return i === 0 ? byId(chain.effectId) : stepNode(chain.steps[i - 1]);
}
function stepToChart(chain, i) {
  const step = chain.steps[i];
  if (stepNode(step)) return null;
  const parent = stepParent(chain, i);
  if (!parent) return `Add why ${i} to the chart first.`;
  const n = addCause(parent.id, step.kind, step.answer.trim() || 'Untitled cause');
  n.evidenceIds = [...step.evidenceIds];
  step.nodeId = n.id;
  return null;
}
// Adds every step not yet on the chart, in order. Returns how many were added.
function chainToChart(chain) {
  let added = 0;
  for (let i = 0; i < chain.steps.length; i++) {
    if (stepNode(chain.steps[i])) continue;
    if (stepToChart(chain, i)) break;
    added++;
  }
  return added;
}

// ---- Fishbone ----
// A fishbone (Ishikawa) diagram sorts the possible causes of an effect into categories, so that no
// area is forgotten. Each possible cause is then tested: added to the chart, where it needs evidence,
// or ruled out. One on the chart is that node, and one ruled out is that record: its words, type, and
// evidence are kept there. A cause can have sub-causes (parentId), one level down.

const blankFishCause = (parentId = null) => ({id: uuid(), text: '', kind: 'condition', evidenceIds: [], nodeId: null, ruledOutId: null, parentId});
function addFishbone(preset = 'seal', effectId = state.problem.primaryEffectId) {
  const f = {id: uuid(), effectId, categories: FISHBONE_PRESETS[preset].categories.map(name => ({id: uuid(), name, causes: []}))};
  state.fishbones.push(f);
  return f;
}
const fishCauses = () => state.fishbones.flatMap(f => f.categories.flatMap(g => g.causes));
const fishNode = c => c.nodeId ? byId(c.nodeId) : null;
const fishRuled = c => c.ruledOutId ? state.ruledOut.find(r => r.id === c.ruledOutId) : null;
const fishSource = c => fishNode(c) ?? fishRuled(c) ?? c;
const fishText = c => fishNode(c)?.title ?? fishRuled(c)?.cause ?? c.text;
const fishKind = c => fishSource(c).kind || c.kind;
const fishStatus = c => fishNode(c) ? 'chart' : fishRuled(c) ? 'ruled' : 'open';
const fishCategory = id => state.fishbones.flatMap(f => f.categories).find(g => g.id === id);
function fishFind(id) {
  for (const fishbone of state.fishbones) for (const category of fishbone.categories) {
    const cause = category.causes.find(c => c.id === id);
    if (cause) return {fishbone, category, cause};
  }
  return null;
}
// Top-level causes in order, each followed by its sub-causes.
const fishRows = g => g.causes.filter(c => !c.parentId).flatMap(c => [c, ...g.causes.filter(x => x.parentId === c.id)]);

// A cause goes under the diagram's effect; a sub-cause under its cause, which must be on the chart.
function fishToChart(id) {
  const {fishbone, category, cause} = fishFind(id);
  if (fishStatus(cause) !== 'open') return null;
  const parent = cause.parentId ? fishNode(category.causes.find(c => c.id === cause.parentId) || {}) : byId(fishbone.effectId);
  if (!parent) return 'Add the cause above it to the chart first.';
  const n = addCause(parent.id, cause.kind, cause.text.trim() || 'Untitled cause');
  n.evidenceIds = [...cause.evidenceIds];
  cause.nodeId = n.id;
  return null;
}
function fishRuleOut(id) {
  const {cause} = fishFind(id);
  if (fishStatus(cause) !== 'open') return null;
  const r = {id: uuid(), cause: cause.text, kind: cause.kind, test: '', evidenceIds: [...cause.evidenceIds], status: 'ruled-out'};
  state.ruledOut.push(r);
  cause.ruledOutId = r.id;
  return r;
}
// A cause that leaves the chart or the causes ruled out takes its words, type, and evidence back.
function releaseFish(c) {
  const src = fishSource(c);
  Object.assign(c, {text: fishText(c), kind: ['action', 'condition'].includes(src.kind) ? src.kind : c.kind, evidenceIds: [...src.evidenceIds], nodeId: null, ruledOutId: null});
}
// Restoring a ruled-out cause takes it back from the causes ruled out.
function fishRestore(id) {
  const {cause} = fishFind(id), r = fishRuled(cause);
  if (!r) return;
  releaseFish(cause);
  state.ruledOut = state.ruledOut.filter(x => x !== r);
}
function deleteRuledOut(id) {
  for (const c of fishCauses()) if (c.ruledOutId === id) releaseFish(c);
  state.ruledOut = state.ruledOut.filter(r => r.id !== id);
}
// Deleting a cause deletes its sub-causes; on the chart and in the causes ruled out, they stay.
function deleteFishCause(id) {
  const {category} = fishFind(id);
  category.causes = category.causes.filter(c => c.id !== id && c.parentId !== id);
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
  // A why-step on the chart keeps its words, type, and evidence when its node goes, and is no longer on the chart.
  for (const chain of state.fiveWhys) {
    if (gone.has(chain.effectId)) chain.effectId = state.problem.primaryEffectId;
    for (const step of chain.steps) {
      const n = gone.has(step.nodeId) && stepNode(step);
      if (n) Object.assign(step, {answer: n.title, kind: n.kind === 'effect' ? 'condition' : n.kind, evidenceIds: [...n.evidenceIds], nodeId: null});
    }
  }
  for (const f of state.fishbones) {
    if (gone.has(f.effectId)) f.effectId = state.problem.primaryEffectId;
    for (const c of f.categories.flatMap(g => g.causes)) if (gone.has(c.nodeId)) releaseFish(c);
  }
  state.nodes = state.nodes.filter(n => !gone.has(n.id));
  state.links = state.links.filter(l => !gone.has(l.effectId) && !gone.has(l.causeId));
  for (const s of state.solutions) s.causeIds = s.causeIds.filter(id => !gone.has(id));
  for (const id of gone) collapsed.delete(id);
}
function removeLink(linkId) {
  state.links = state.links.filter(l => l.id !== linkId);
}

// Moving a cause to another effect moves the one link it is drawn along, from `fromId`; its other
// links (a shared cause) and its own causes stay as they are. The link goes last among the new
// effect's causes.
function moveProblem(causeId, fromId, toId) {
  if (toId === fromId) return 'It is already a cause of that effect.';
  return linkProblem(toId, causeId);
}
function moveCause(causeId, fromId, toId) {
  const problem = moveProblem(causeId, fromId, toId);
  if (problem) return problem;
  const link = state.links.find(l => l.effectId === fromId && l.causeId === causeId);
  state.links.splice(state.links.indexOf(link), 1);
  link.effectId = toId;
  state.links.push(link);
  collapsed.delete(toId);
  return null;
}
// The causes of an effect are drawn actions first, then conditions, each group in link order.
// Places the cause's link just before or after a sibling's link.
function placeCause(effectId, causeId, siblingId, after) {
  const link = state.links.find(l => l.effectId === effectId && l.causeId === causeId);
  const anchor = state.links.find(l => l.effectId === effectId && l.causeId === siblingId);
  if (!link || !anchor || link === anchor) return;
  state.links.splice(state.links.indexOf(link), 1);
  state.links.splice(state.links.indexOf(anchor) + (after ? 1 : 0), 0, link);
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
