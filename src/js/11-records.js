// The pages beside the chart: the 5 Whys, and the RCA records (problem definition, team and dates,
// evidence log, causes ruled out, solutions, and the action plan).
//
// Fields are bound by data attributes: data-list names the record (or "meta", "problem", "node"),
// data-id the row, and data-field the dotted path of the value. Typing updates the state in
// place without rebuilding the page, so the field keeps its focus; data-refresh rebuilds it.
// Buttons and pickers carry data-act and are handled by one listener each.

const optionList = (values, current, blank) =>
  (blank !== undefined ? `<option value="">${blank}</option>` : '') +
  Object.entries(values).map(([k, v]) => `<option value="${k}" ${k === current ? 'selected' : ''}>${v}</option>`).join('');
const bind = (list, id, fieldPath) => `data-list="${list}"${id ? ` data-id="${id}"` : ''} data-field="${fieldPath}"`;
const cell = (list, id, fieldPath, value, label, attrs = '') =>
  `<input class="cell" ${bind(list, id, fieldPath)} value="${escapeHtml(value)}" aria-label="${escapeHtml(label)}" ${attrs}>`;
const cellArea = (list, id, fieldPath, value, label, attrs = '') =>
  `<textarea class="cell" rows="2" ${bind(list, id, fieldPath)} aria-label="${escapeHtml(label)}" ${attrs}>${escapeHtml(value)}</textarea>`;
const formField = (label, list, id, fieldPath, value, attrs = '') =>
  `<label class="field">${label}<input class="text" ${bind(list, id, fieldPath)} value="${escapeHtml(value)}" ${attrs}></label>`;
const formArea = (label, list, id, fieldPath, value, attrs = '') =>
  `<label class="field">${label}<textarea class="text" ${bind(list, id, fieldPath)} ${attrs}>${escapeHtml(value)}</textarea></label>`;
const pageHead = (title, lede, button = '') =>
  `<div class="page-head"><div><h1>${title}</h1><p class="lede">${lede}</p></div>${button}</div>`;
const teamList = () => `<datalist id="teamNames">${state.meta.team.map(m => `<option value="${escapeHtml(m.name)}">`).join('')}</datalist>`;
const nodeName = n => n.id === state.problem.primaryEffectId ? {kind: 'effect'} : n;
const causeChip = (n, removeAct, ownerId) => `<span class="cause-chip">${swatch(nodeName(n))}<button class="link" data-act="goto-node" data-node="${n.id}" title="Show on the chart">${escapeHtml(shorten(n.title, 60))}</button>${removeAct
  ? `<button class="unlink" data-act="${removeAct}" data-id="${ownerId}" data-node="${n.id}" aria-label="Remove ${escapeHtml(n.title)}">×</button>` : ''}</span>`;
const evidenceChip = (e, removeAct, ownerId) => `<span class="ev-chip" title="${escapeHtml(e.description)}"><span class="code">${escapeHtml(e.code)}</span>${removeAct
  ? `<button class="unlink" data-act="${removeAct}" data-id="${ownerId}" data-evidence="${e.id}" aria-label="Remove ${escapeHtml(e.code)}">×</button>` : ''}</span>`;
const empty = (cols, text) => `<tr><td colspan="${cols}" class="empty-row">${text}</td></tr>`;

// Moves to a page: 'chart' or one of the records.
function setRecord(name) {
  record = name;
  $('app').dataset.record = name;
  // Enter in a why's answer goes to the next why, adding one after the last.
$('records').addEventListener('keydown', e => {
  const field = e.target.closest('textarea.answer');
  if (!field || e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
  e.preventDefault();
  const chain = chainOf(field.dataset.step), i = chain.steps.findIndex(s => s.id === field.dataset.step);
  let next = chain.steps[i + 1];
  if (!next) { next = blankStep(); chain.steps.push(next); render(); persist(); }
  document.querySelector(`#records [data-step="${next.id}"]`)?.focus();
});

document.querySelectorAll('.rail [data-record]').forEach(b => {
    b.classList.toggle('active', b.dataset.record === name);
    if (b.dataset.record === name) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}
function showRecord(name, focusId) {
  linking = null; nodeDrag = null;
  setRecord(name);
  render();
  if (name === 'chart') { if (selected) scrollToNode(selected); return; }
  $('records').scrollTop = 0;
  if (focusId) {
    const target = document.querySelector(`#records [data-id="${focusId}"][data-field]`);
    target?.scrollIntoView({block: 'center'});
    target?.focus();
  }
}

function renderRecord() {
  const page = {whys: whysPage, problem: problemPage, team: teamPage, evidence: evidencePage, ruledOut: ruledOutPage, solutions: solutionsPage, actions: actionsPage}[record];
  const box = $('records'), focus = document.activeElement, scroll = box.scrollTop;
  // A rebuild keeps the focused field, so a picker or a status change does not lose the place.
  const key = box.contains(focus) && focus.dataset ? ['list', 'id', 'field', 'act', 'node'].map(k => focus.dataset[k] ?? '').join('|') : null;
  box.innerHTML = `<div class="page${['evidence', 'ruledOut', 'actions'].includes(record) ? ' wide' : ''}">${page()}</div>${teamList()}`;
  box.scrollTop = scroll;
  if (key) [...box.querySelectorAll('[data-list],[data-act]')].find(el => ['list', 'id', 'field', 'act', 'node'].map(k => el.dataset[k] ?? '').join('|') === key)?.focus();
}

// ---- Pages ----

function whysPage() {
  return `${pageHead('5 Whys', 'Ask why the problem happened, then why that happened, and so on, until you reach a cause you can act on. Five is a guide, not a rule. Add the steps to the cause-and-effect chart, where each one gains the other causes it needs.',
    '<button class="button primary" data-act="add-chain">+ New chain</button>')}
    ${state.fiveWhys.length ? state.fiveWhys.map(chainCard).join('') : '<p class="empty-card">No chains yet. <b>+ New chain</b> starts one from the primary effect.</p>'}
    <p class="note">In an answer, <kbd>Enter</kbd> goes to the next why, adding one after the last; <kbd>Shift+Enter</kbd> starts a new line.</p>`;
}

function chainCard(c) {
  const start = byId(c.effectId), off = c.steps.filter(s => !stepNode(s)).length;
  return `<article class="card chain">
    <div class="card-head">
      <h2>Why did “${escapeHtml(shorten(start?.title || '', 90))}” happen?</h2>
      <button class="unlink" data-act="delete-chain" data-id="${c.id}" aria-label="Delete this chain">×</button>
    </div>
    <label class="starts">Starts from <select class="picker" data-act="chain-effect" data-id="${c.id}" aria-label="The node this chain starts from">${state.nodes.map(n =>
      `<option value="${n.id}" ${n.id === c.effectId ? 'selected' : ''}>${escapeHtml(shorten(n.title, 70))}</option>`).join('')}</select></label>
    <ol class="whys">${c.steps.map((s, i) => stepRow(c, s, i)).join('')}</ol>
    <div class="decision-row">
      <button class="button" data-act="add-step" data-id="${c.id}">+ Why</button>
      <span class="spacer"></span>
      ${off ? `<span class="muted">${off} step${off > 1 ? 's' : ''} not on the chart</span><button class="button" data-act="chain-to-chart" data-id="${c.id}">Add all to chart</button>`
        : c.steps.length ? '<span class="muted">Every step is on the chart</span>' : ''}
    </div>
  </article>`;
}

function stepRow(c, s, i) {
  const n = stepNode(s), src = stepSource(s), last = i === c.steps.length - 1;
  const asked = i === 0 ? byId(c.effectId)?.title : whyAnswer(c.steps[i - 1]);
  const cited = src.evidenceIds.map(evidenceById).filter(Boolean), rest = state.evidence.filter(e => !src.evidenceIds.includes(e.id));
  const kind = n ? n.kind : s.kind, label = `Why ${i + 1}`;
  return `<li class="why${n ? ' on-chart' : ''}">
    <div class="why-num">${label}${last && c.steps.length > 1 ? '<small>root cause so far</small>' : ''}</div>
    <div class="why-body">
      <div class="why-q">Why did “${escapeHtml(shorten(asked?.trim() || '…', 90))}” happen?</div>
      ${n ? `<textarea class="cell answer" rows="1" ${bind('node', n.id, 'title')} data-step="${s.id}" aria-label="${label}">${escapeHtml(n.title)}</textarea>`
        : `<textarea class="cell answer" rows="1" ${bind('whySteps', s.id, 'answer')} data-step="${s.id}" aria-label="${label}" placeholder="Because…">${escapeHtml(s.answer)}</textarea>`}
      <div class="why-meta">
        <div class="seg" role="group" aria-label="${label} type">${['action', 'condition'].map(k =>
          `<button class="kind" data-act="step-kind" data-id="${s.id}" data-v="${k}" ${pressed(kind === k)}>${KINDS[k].name}</button>`).join('')}</div>
        <div class="chips">${cited.map(e => evidenceChip(e, 'step-remove-evidence', s.id)).join('')}
          ${rest.length ? `<select class="picker" data-act="step-add-evidence" data-id="${s.id}" aria-label="Cite evidence for ${label}"><option value="">+ Evidence…</option>${rest.map(e =>
            `<option value="${e.id}">${escapeHtml(e.code)} · ${escapeHtml(shorten(e.description, 50))}</option>`).join('')}</select>` : ''}</div>
        <span class="spacer"></span>
        ${n ? `<button class="link" data-act="goto-node" data-node="${n.id}" title="Show it on the chart">On the chart</button>`
          : `<button class="button" data-act="step-to-chart" data-id="${s.id}" ${stepParent(c, i) ? '' : 'disabled title="Add the step before it to the chart first"'}>Add to chart</button>`}
      </div>
    </div>
    <button class="unlink" data-act="delete-step" data-id="${s.id}" aria-label="Remove ${label}${n ? '; it stays on the chart' : ''}">×</button>
  </li>`;
}

function problemPage() {
  const p = state.problem, s = p.significance, effect = primaryEffect();
  return `${pageHead('Problem definition', 'What happened, when, where, and why it matters. The “what” is the primary effect: the first box of the chart.')}
    <section class="card">
      ${formArea('What <span class="muted">the primary effect</span>', 'node', effect.id, 'title', effect.title, 'rows="2"')}
      <div class="form-grid">
        ${formArea('When', 'problem', '', 'when', p.when, 'rows="2" placeholder="Date, time, and the circumstances"')}
        ${formArea('Where', 'problem', '', 'where', p.where, 'rows="2" placeholder="Unit, equipment, and position"')}
      </div>
    </section>
    <section class="card">
      <h2>Significance</h2>
      <p class="note">Why this RCA is worth the effort: the consequences, in each area.</p>
      <div class="form-grid">
        ${formArea('Safety', 'problem', '', 'significance.safety', s.safety, 'rows="3"')}
        ${formArea('Environment', 'problem', '', 'significance.environment', s.environment, 'rows="3"')}
        ${formArea('Production / cost', 'problem', '', 'significance.productionCost', s.productionCost, 'rows="3"')}
        ${formArea('Reliability', 'problem', '', 'significance.reliability', s.reliability, 'rows="3"')}
      </div>
    </section>`;
}

function teamPage() {
  const m = state.meta, d = m.dates;
  return `${pageHead('Team and dates', 'Who carries out the RCA, and its dates.')}
    <section class="card">
      <h2>RCA</h2>
      <div class="form-grid">
        ${formField('RCA number', 'meta', '', 'rcaNumber', m.rcaNumber, 'placeholder="e.g. RCA-2026-014"')}
        ${formField('Equipment / tag', 'meta', '', 'equipmentTag', m.equipmentTag, 'placeholder="e.g. P-101A"')}
        ${formField('Seal type', 'meta', '', 'sealType', m.sealType, 'placeholder="e.g. Single cartridge seal, API Plan 11"')}
      </div>
    </section>
    <section class="card">
      <h2>Dates</h2>
      <div class="form-grid dates">
        ${formField('Event', 'meta', '', 'dates.eventDate', d.eventDate, 'type="date"')}
        ${formField('RCA opened', 'meta', '', 'dates.opened', d.opened, 'type="date"')}
        ${formField('RCA closed', 'meta', '', 'dates.closed', d.closed, 'type="date"')}
      </div>
    </section>
    <section class="card">
      <div class="card-head"><h2>Team</h2><button class="button" data-act="add-member">+ Add member</button></div>
      <table class="log compact">
        <thead><tr><th>Name</th><th>Role</th><th class="center">Lead</th><th><span class="sr">Remove</span></th></tr></thead>
        <tbody>${m.team.length ? m.team.map(t => `<tr>
          <td>${cell('team', t.id, 'name', t.name, 'Name', 'placeholder="Name"')}</td>
          <td>${cell('team', t.id, 'role', t.role, 'Role', 'placeholder="Role or department"')}</td>
          <td class="center"><input type="radio" name="lead" data-act="lead" data-id="${t.id}" ${m.leadId === t.id ? 'checked' : ''} aria-label="${escapeHtml(t.name || 'Member')} leads the RCA"></td>
          <td class="row-actions"><button class="unlink" data-act="delete-member" data-id="${t.id}" aria-label="Remove ${escapeHtml(t.name || 'member')}">×</button></td>
        </tr>`).join('') : empty(4, 'No team members yet.')}</tbody>
      </table>
      <p class="note">Names entered here are offered for “collected by” and “owner” in the other records.</p>
    </section>`;
}

function evidencePage() {
  return `${pageHead('Evidence log', 'What was seen, measured, or inferred. Every cause on the chart needs evidence. Codes are never reused.',
    '<button class="button primary" data-act="add-evidence">+ Add evidence</button>')}
    <div class="table-wrap"><table class="log">
      <colgroup><col style="width:58px"><col style="width:30%"><col style="width:104px"><col style="width:18%"><col style="width:130px"><col style="width:136px"><col style="width:20%"><col style="width:76px"></colgroup>
      <thead><tr><th>Code</th><th>Description</th><th>Type</th><th>Source / location</th><th>Collected by</th><th>Date</th><th>Cited by</th><th><span class="sr">Actions</span></th></tr></thead>
      <tbody>${state.evidence.length ? state.evidence.map(e => {
        const nodes = citingNodes(e.id), ruled = citingRuledOut(e.id);
        return `<tr class="${highlight === e.id ? 'current' : ''}">
          <td><span class="code">${escapeHtml(e.code)}</span></td>
          <td>${cellArea('evidence', e.id, 'description', e.description, `Description of ${e.code}`, 'placeholder="What was seen or measured"')}</td>
          <td><select class="cell" ${bind('evidence', e.id, 'type')} aria-label="Type of ${e.code}">${optionList(EVIDENCE_TYPES, e.type)}</select></td>
          <td>${cellArea('evidence', e.id, 'source', e.source, `Source of ${e.code}`)}</td>
          <td>${cell('evidence', e.id, 'collectedBy', e.collectedBy, `Collected by, ${e.code}`, 'list="teamNames"')}</td>
          <td>${cell('evidence', e.id, 'date', e.date, `Date of ${e.code}`, 'type="date"')}</td>
          <td><div class="cited">${nodes.map(n => causeChip(n)).join('')}${ruled.length ? `<span class="muted">${ruled.length} ruled-out cause${ruled.length > 1 ? 's' : ''}</span>` : ''}${nodes.length || ruled.length ? '' : '<span class="muted">Not cited</span>'}</div></td>
          <td class="row-actions">${nodes.length ? `<button class="link" data-act="show-evidence" data-id="${e.id}" title="Highlight the nodes that cite ${e.code}">Show</button>` : ''}<button class="unlink" data-act="delete-evidence" data-id="${e.id}" aria-label="Delete ${e.code}">×</button></td>
        </tr>`;
      }).join('') : empty(8, 'No evidence yet. Add it here, or from a cause on the chart.')}</tbody>
    </table></div>`;
}

function ruledOutPage() {
  return `${pageHead('Causes ruled out', 'Possible causes that the evidence or a test ruled out, kept with the evidence that did it. On the chart, <b>Rule out</b> moves a candidate cause here.',
    '<button class="button primary" data-act="add-ruled">+ Add possible cause</button>')}
    <div class="table-wrap"><table class="log">
      <colgroup><col style="width:24%"><col style="width:118px"><col style="width:30%"><col style="width:20%"><col style="width:130px"><col style="width:44px"></colgroup>
      <thead><tr><th>Possible cause</th><th>Type</th><th>Evidence or test</th><th>Evidence</th><th>Status</th><th><span class="sr">Remove</span></th></tr></thead>
      <tbody>${state.ruledOut.length ? state.ruledOut.map(r => {
        const cited = r.evidenceIds.map(evidenceById).filter(Boolean), rest = state.evidence.filter(e => !r.evidenceIds.includes(e.id));
        return `<tr>
          <td>${cellArea('ruledOut', r.id, 'cause', r.cause, 'Possible cause', 'placeholder="The possible cause"')}</td>
          <td><select class="cell" ${bind('ruledOut', r.id, 'kind')} aria-label="Type">${optionList({action: 'Action', condition: 'Condition'}, r.kind, '—')}</select></td>
          <td>${cellArea('ruledOut', r.id, 'test', r.test, 'Evidence or test', 'placeholder="How it was ruled out"')}</td>
          <td><div class="chips">${cited.map(e => evidenceChip(e, 'ruled-remove-evidence', r.id)).join('')}
            ${rest.length ? `<select class="picker" data-act="ruled-add-evidence" data-id="${r.id}" aria-label="Cite evidence"><option value="">+ Cite…</option>${rest.map(e => `<option value="${e.id}">${escapeHtml(e.code)} · ${escapeHtml(shorten(e.description, 50))}</option>`).join('')}</select>` : ''}</div></td>
          <td><select class="cell" ${bind('ruledOut', r.id, 'status')} aria-label="Status">${optionList(RULED_OUT_STATUS, r.status)}</select></td>
          <td class="row-actions"><button class="unlink" data-act="delete-ruled" data-id="${r.id}" aria-label="Remove">×</button></td>
        </tr>`;
      }).join('') : empty(6, 'No causes ruled out yet.')}</tbody>
    </table></div>`;
}

function solutionsPage() {
  const causes = state.nodes.filter(n => n.id !== state.problem.primaryEffectId)
    .sort((a, b) => (b.controllable - a.controllable) || a.title.localeCompare(b.title));
  return `${pageHead('Solutions', 'Each solution attacks one or more causes, and is weighed against the four solution criteria. Controllable causes are the candidates.',
    '<button class="button primary" data-act="add-solution">+ Add solution</button>')}
    ${state.solutions.length ? state.solutions.map(s => {
      const linked = s.causeIds.map(byId).filter(Boolean), actions = actionsOf(s.id);
      const rest = causes.filter(n => !s.causeIds.includes(n.id));
      return `<article class="card solution" id="solution-${s.id}">
        <div class="card-head">
          <input class="cell title" ${bind('solutions', s.id, 'title')} value="${escapeHtml(s.title)}" aria-label="Solution" placeholder="Describe the solution">
          <span class="badge ${s.decision || 'none'}">${DECISIONS[s.decision] || 'Not decided'}</span>
          <button class="unlink" data-act="delete-solution" data-id="${s.id}" aria-label="Delete solution">×</button>
        </div>
        <div class="sub">Attacks</div>
        <div class="chips">${linked.map(n => causeChip(n, 'solution-remove-cause', s.id)).join('') || '<span class="muted">No cause linked yet</span>'}
          ${rest.length ? `<select class="picker" data-act="solution-add-cause" data-id="${s.id}" aria-label="Link a cause"><option value="">+ Link a cause…</option>${rest.map(n => `<option value="${n.id}">${n.controllable ? '● ' : ''}${escapeHtml(shorten(n.title, 70))}</option>`).join('')}</select>` : ''}</div>
        <table class="criteria"><tbody>${Object.entries(CRITERIA).map(([k, label]) => `<tr>
          <th scope="row">${label}</th>
          <td><div class="seg" role="group" aria-label="${label}">${Object.entries(CRITERION_VALUES).map(([v, text]) =>
            `<button class="${v}" data-act="criterion" data-id="${s.id}" data-key="${k}" data-v="${v}" ${pressed(s.criteria[k].v === v)}>${text}</button>`).join('')}</div></td>
          <td>${cell('solutions', s.id, `criteria.${k}.c`, s.criteria[k].c, `${label} comment`, 'placeholder="Comment"')}</td>
        </tr>`).join('')}</tbody></table>
        <div class="decision-row">
          <span class="sub">Decision</span>
          <div class="seg decision" role="group" aria-label="Decision">${Object.entries(DECISIONS).map(([v, text]) =>
            `<button class="${v}" data-act="decision" data-id="${s.id}" data-v="${v}" ${pressed(s.decision === v)}>${text}</button>`).join('')}</div>
          <span class="spacer"></span>
          <span class="muted">${actions.length ? `${actions.length} action${actions.length > 1 ? 's' : ''} in the plan` : 'No actions yet'}</span>
          <button class="button" data-act="add-action-for" data-id="${s.id}">+ Action</button>
        </div>
      </article>`;
    }).join('') : '<p class="empty-card">No solutions yet. Add one here, or from a cause on the chart.</p>'}`;
}

function actionsPage() {
  const solutions = Object.fromEntries(state.solutions.map(s => [s.id, shorten(s.title || 'Untitled solution', 60)]));
  const overdue = state.actions.filter(isOverdue).length;
  return `${pageHead('Action plan', `Who does what, by when, how it is verified, and whether it worked.${overdue ? ` <b class="overdue">${overdue} overdue.</b>` : ''}`,
    '<button class="button primary" data-act="add-action">+ Add action</button>')}
    <div class="table-wrap"><table class="log">
      <colgroup><col style="width:24%"><col style="width:16%"><col style="width:120px"><col style="width:136px"><col style="width:18%"><col style="width:118px"><col style="width:20%"><col style="width:44px"></colgroup>
      <thead><tr><th>Action</th><th>Solution</th><th>Owner</th><th>Due</th><th>Verification</th><th>Status</th><th>Effectiveness check</th><th><span class="sr">Remove</span></th></tr></thead>
      <tbody>${state.actions.length ? state.actions.map(a => `<tr class="${a.status === 'done' ? 'done' : ''}">
        <td>${cellArea('actions', a.id, 'action', a.action, 'Action', 'placeholder="What will be done"')}</td>
        <td><select class="cell" ${bind('actions', a.id, 'solutionId')} aria-label="Solution">${optionList(solutions, a.solutionId, '—')}</select></td>
        <td>${cell('actions', a.id, 'owner', a.owner, 'Owner', 'list="teamNames"')}</td>
        <td class="${isOverdue(a) ? 'overdue' : ''}">${cell('actions', a.id, 'due', a.due, 'Due', 'type="date" data-refresh')}${isOverdue(a) ? '<small>Overdue</small>' : ''}</td>
        <td>${cellArea('actions', a.id, 'verification', a.verification, 'Verification', 'placeholder="How it is checked"')}</td>
        <td><select class="cell" ${bind('actions', a.id, 'status')} data-refresh aria-label="Status">${optionList(ACTION_STATUS, a.status)}</select></td>
        <td>${cell('actions', a.id, 'effectiveness.date', a.effectiveness.date, 'Effectiveness check date', 'type="date"')}
          ${cellArea('actions', a.id, 'effectiveness.result', a.effectiveness.result, 'Effectiveness check result', 'placeholder="Result: did it stop recurrence?"')}</td>
        <td class="row-actions"><button class="unlink" data-act="delete-action" data-id="${a.id}" aria-label="Delete action">×</button></td>
      </tr>`).join('') : empty(8, 'No actions yet. Add one here, or from a solution.')}</tbody>
    </table></div>`;
}

// ---- Editing ----

function boundObject(el) {
  const {list, id} = el.dataset;
  if (list === 'meta') return state.meta;
  if (list === 'problem') return state.problem;
  if (list === 'node') return byId(id);
  if (list === 'whySteps') return stepById(id);
  return (list === 'team' ? state.meta.team : state[list]).find(r => r.id === id);
}
function setPath(obj, path, value) {
  const keys = path.split('.'), last = keys.pop();
  for (const k of keys) obj = obj[k];
  obj[last] = value;
}

$('records').addEventListener('input', e => {
  const el = e.target.closest('[data-field]');
  if (!el) return;
  const obj = boundObject(el);
  if (!obj) return;
  setPath(obj, el.dataset.field, el.value);
  renderTitle();
  if (el.hasAttribute('data-refresh') || el.tagName === 'SELECT') { render(); persist(); }
  else persist(`${el.dataset.list}:${el.dataset.id}:${el.dataset.field}`);
});

// Pickers: choosing an item adds it.
$('records').addEventListener('change', e => {
  const el = e.target.closest('select[data-act]');
  if (el && el.value) {
    const value = el.value;
    if (el.dataset.act === 'ruled-add-evidence') state.ruledOut.find(r => r.id === el.dataset.id).evidenceIds.push(value);
    if (el.dataset.act === 'solution-add-cause') state.solutions.find(s => s.id === el.dataset.id).causeIds.push(value);
    if (el.dataset.act === 'step-add-evidence') stepSource(stepById(el.dataset.id)).evidenceIds.push(value);
    if (el.dataset.act === 'chain-effect') state.fiveWhys.find(c => c.id === el.dataset.id).effectId = value;
    render(); persist();
  }
  const radio = e.target.closest('input[data-act="lead"]');
  if (radio) { state.meta.leadId = radio.dataset.id; persist(); }
});

$('records').addEventListener('click', e => {
  const el = e.target.closest('button[data-act]');
  if (!el) return;
  const {act, id} = el.dataset;
  const row = list => state[list].find(r => r.id === id);
  let focusId = null;
  switch (act) {
    case 'goto-node':
      selected = el.dataset.node; highlight = null;
      reveal(selected);
      showRecord('chart');
      return;
    case 'show-evidence':
      highlight = id; selected = null;
      citingNodes(id).forEach(n => reveal(n.id));
      showRecord('chart');
      return;
    case 'add-chain': focusId = addChain().steps[0].id; break;
    case 'delete-chain': {
      const chain = state.fiveWhys.find(c => c.id === id);
      if (chain.steps.some(s => whyAnswer(s).trim()) && !confirm(`Delete this chain of ${chain.steps.length} why${chain.steps.length > 1 ? 's' : ''}? Steps added to the chart stay on the chart.`)) return;
      state.fiveWhys = state.fiveWhys.filter(c => c !== chain);
      break;
    }
    case 'add-step': {
      const step = blankStep();
      state.fiveWhys.find(c => c.id === id).steps.push(step); focusId = step.id;
      break;
    }
    case 'delete-step': {
      const chain = chainOf(id);
      chain.steps = chain.steps.filter(s => s.id !== id);
      break;
    }
    case 'step-kind': {
      const step = stepById(id);
      stepSource(step).kind = el.dataset.v;
      if (!stepNode(step)) step.kind = el.dataset.v;
      break;
    }
    case 'step-remove-evidence': {
      const src = stepSource(stepById(id));
      src.evidenceIds = src.evidenceIds.filter(x => x !== el.dataset.evidence);
      break;
    }
    case 'step-to-chart': {
      const chain = chainOf(id), problem = stepToChart(chain, chain.steps.findIndex(s => s.id === id));
      if (problem) { setStatus(problem); return; }
      setStatus(`Added "${whyAnswer(stepById(id))}" to the chart`);
      break;
    }
    case 'chain-to-chart': {
      const added = chainToChart(state.fiveWhys.find(c => c.id === id));
      setStatus(`Added ${added} step${added === 1 ? '' : 's'} to the chart`);
      break;
    }
    case 'add-member': {
      const m = {id: uuid(), name: '', role: ''};
      state.meta.team.push(m); focusId = m.id;
      break;
    }
    case 'delete-member':
      state.meta.team = state.meta.team.filter(m => m.id !== id);
      if (state.meta.leadId === id) state.meta.leadId = '';
      break;
    case 'add-evidence': focusId = addEvidence().id; break;
    case 'delete-evidence': {
      const ev = evidenceById(id), uses = citingNodes(id).length + citingRuledOut(id).length;
      if (uses && !confirm(`${ev.code} is cited ${uses} time${uses > 1 ? 's' : ''}. Delete it and remove those citations? The code ${ev.code} will not be reused.`)) return;
      deleteEvidence(id);
      break;
    }
    case 'add-ruled': {
      const r = {id: uuid(), cause: '', kind: '', test: '', evidenceIds: [], status: 'ruled-out'};
      state.ruledOut.push(r); focusId = r.id;
      break;
    }
    case 'delete-ruled': state.ruledOut = state.ruledOut.filter(r => r.id !== id); break;
    case 'ruled-remove-evidence': row('ruledOut').evidenceIds = row('ruledOut').evidenceIds.filter(x => x !== el.dataset.evidence); break;
    case 'add-solution': focusId = addSolution().id; break;
    case 'delete-solution': {
      const linked = actionsOf(id).length;
      if (linked && !confirm(`${linked} action${linked > 1 ? 's are' : ' is'} linked to this solution. Delete the solution? The actions stay, without a solution.`)) return;
      state.solutions = state.solutions.filter(s => s.id !== id);
      for (const a of state.actions) if (a.solutionId === id) a.solutionId = '';
      break;
    }
    case 'solution-remove-cause': row('solutions').causeIds = row('solutions').causeIds.filter(x => x !== el.dataset.node); break;
    case 'criterion': {
      const c = row('solutions').criteria[el.dataset.key];
      c.v = c.v === el.dataset.v ? '' : el.dataset.v;
      break;
    }
    case 'decision': row('solutions').decision = row('solutions').decision === el.dataset.v ? '' : el.dataset.v; break;
    case 'add-action-for': {
      const a = addAction(id);
      render(); persist();
      showRecord('actions', a.id);
      return;
    }
    case 'add-action': focusId = addAction().id; break;
    case 'delete-action': state.actions = state.actions.filter(a => a.id !== id); break;
    default: return;
  }
  render(); persist();
  if (focusId) {
    const target = document.querySelector(`#records [data-id="${focusId}"][data-field]`);
    target?.scrollIntoView({block: 'center'});
    target?.focus();
  }
});

document.querySelectorAll('.rail [data-record]').forEach(b => b.onclick = () => showRecord(b.dataset.record));
