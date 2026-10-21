// Properties panel for the selected node, or for the RCA when nothing is selected.

const pressed = on => `aria-pressed="${on ? 'true' : 'false'}"`;
const shorten = (s, max) => s.length > max ? s.slice(0, max - 1) + '…' : s;
const field = (label, id, value, attrs = '') =>
  `<label class="field" for="${id}">${label}</label><input class="text" id="${id}" value="${escapeHtml(value)}" ${attrs}>`;
const area = (label, id, value, attrs = '') =>
  `<label class="field" for="${id}">${label}</label><textarea class="text" id="${id}" ${attrs}>${escapeHtml(value)}</textarea>`;
const flagBox = (id, on, label, title) =>
  `<label class="flag" title="${title}"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}> ${label}</label>`;
const swatch = n => `<span class="sw ${n.kind}" aria-hidden="true"></span>`;

function renderProperties() {
  const box = $('properties');
  const n = byId(selected);
  if (n) renderNodeProperties(box, n); else renderRcaProperties(box);
}

function renderRcaProperties(box) {
  const issues = ruleIssues();
  box.innerHTML = `
    <div class="panel-title">RCA</div>
    ${field('RCA number', 'rcaNumber', state.meta.rcaNumber, 'placeholder="e.g. RCA-2026-014"')}
    ${field('Equipment / tag', 'equipmentTag', state.meta.equipmentTag, 'placeholder="e.g. P-101A"')}
    ${area('Primary effect', 'primaryTitle', primaryEffect()?.title || '', 'rows="2" style="min-height:44px"')}
    <p class="note">${state.nodes.length - 1} causes · ${state.evidence.length} evidence items · ${issues.filter(i => i.level === 'error').length} rule errors</p>
    ${collapsed.size ? `<button class="button block" id="expandAll">Expand all branches (${collapsed.size} collapsed)</button>` : ''}
    <div class="section">
      <div class="panel-title">How to chart</div>
      <ol class="steps">
        <li>Select the primary effect and add its causes with <b>+ Action</b> and <b>+ Condition</b>.</li>
        <li>Select a cause and add its own causes the same way.</li>
        <li>Each effect needs at least one action and one condition.</li>
        <li>When one cause supports several effects, select the second effect, choose <b>Link cause</b>, and click the cause.</li>
        <li>Back each cause with evidence: select it and search or type under <b>Evidence</b>.</li>
        <li>Save the RCA as a JSON file with <b>Save</b>.</li>
      </ol>
    </div>
    <div class="section">
      <div class="panel-title">Keys</div>
      <dl class="keys">
        <dt><kbd>Ins</kbd> or <kbd>A</kbd></dt><dd>Add an action to the selected effect</dd>
        <dt><kbd>Shift+Ins</kbd> or <kbd>C</kbd></dt><dd>Add a condition</dd>
        <dt><kbd>F2</kbd> or <kbd>Enter</kbd></dt><dd>Edit the title</dd>
        <dt><kbd>←↑↓→</kbd></dt><dd>Select the neighbouring node</dd>
        <dt><kbd>M</kbd></dt><dd>Move the cause under another effect</dd>
        <dt><kbd>Alt+↑</kbd> <kbd>Alt+↓</kbd></dt><dd>Reorder among its siblings</dd>
        <dt>Drag a node</dt><dd>Onto an effect: move. Between siblings: reorder</dd>
        <dt><kbd>L</kbd></dt><dd>Link an existing node as a cause</dd>
        <dt><kbd>Space</kbd></dt><dd>Collapse or expand the branch</dd>
        <dt><kbd>Esc</kbd></dt><dd>Cancel linking, moving, or a drag; or clear the selection</dd>
        <dt><kbd>Del</kbd></dt><dd>Delete the selected cause</dd>
        <dt><kbd>Ctrl+S</kbd></dt><dd>Save</dd>
        <dt><kbd>Ctrl+Z</kbd> <kbd>Ctrl+Y</kbd></dt><dd>Undo, redo</dd>
        <dt>Drag, wheel</dt><dd>Pan, zoom</dd>
      </dl>
    </div>`;
  if ($('expandAll')) $('expandAll').onclick = expandAll;
  $('rcaNumber').oninput = e => { state.meta.rcaNumber = e.target.value; renderTitle(); persist('rcaNumber'); };
  $('equipmentTag').oninput = e => { state.meta.equipmentTag = e.target.value; renderTitle(); persist('equipmentTag'); };
  $('primaryTitle').oninput = e => { primaryEffect().title = e.target.value; refreshChart(); persist('title:' + state.problem.primaryEffectId); };
}

function renderNodeProperties(box, n) {
  const isPrimary = n.id === state.problem.primaryEffectId;
  const causes = causesOf(n.id), effects = effectsOf(n.id);
  const issues = ruleIssues().filter(i => i.nodeId === n.id);
  const evidence = n.evidenceIds.map(evidenceById).filter(Boolean);
  const solutions = solutionsOf(n.id);
  const kindName = isPrimary ? 'Primary effect' : KINDS[n.kind].name;
  const about = [causes.length && !isPrimary ? 'also an effect' : '', causes.length ? `${causes.length} cause${causes.length > 1 ? 's' : ''}` : '',
    effects.length > 1 ? `supports ${effects.length} effects` : ''].filter(Boolean).join(' · ');
  box.innerHTML = `
    <div class="kind-row"><span class="kind-chip ${isPrimary ? 'effect' : n.kind}">${kindName.toUpperCase()}</span><span class="muted">${about}</span></div>
    ${issues.map(i => `<div class="info ${i.level === 'info' ? '' : i.level === 'error' ? 'error' : 'warn'}">${escapeHtml(i.text)}</div>`).join('')}
    ${isPrimary ? '' : `<div class="segmented" role="group" aria-label="Cause type">
      <button data-kind="action" ${pressed(n.kind === 'action')} title="A momentary cause that happened at a point in time">Action</button>
      <button data-kind="condition" ${pressed(n.kind === 'condition')} title="A cause that existed over time">Condition</button>
    </div>`}
    ${area('Title <span class="muted">required</span>', 'nodeTitle', n.title, 'rows="2" style="min-height:44px"')}
    <div class="flags">
      ${isPrimary ? '' : flagBox('nodeUnverified', n.unverified, 'Unverified (?)', 'A candidate cause that evidence has not confirmed yet')
        + flagBox('nodeControllable', n.controllable, 'Controllable', 'The organisation can change this cause: a candidate for a solution')}
      ${flagBox('nodeStop', !!n.stopPoint, 'Stop point', 'The branch ends here')}
    </div>
    ${n.stopPoint ? `<label class="field" for="nodeStopReason">Why the branch stops</label><select class="text" id="nodeStopReason">${Object.entries(STOP_REASONS).map(([k, v]) => `<option value="${k}" ${n.stopPoint.reason === k ? 'selected' : ''}>${v}</option>`).join('')}</select>` : ''}

    <div class="section">
      <div class="section-head"><div class="panel-title">Evidence · ${evidence.length} cited</div></div>
      ${evidence.length ? evidence.map(e => `<div class="evidence">
        <button class="code" data-highlight="${e.id}" title="Highlight every node that cites ${escapeHtml(e.code)}">${escapeHtml(e.code)}</button>
        <div class="body"><span>${escapeHtml(e.description)}</span><small>${escapeHtml([e.type === 'inferred' ? 'Inferred' : 'Sensed', e.collectedBy, e.date].filter(Boolean).join(' · '))}</small></div>
        <button class="unlink" data-unlink="${e.id}" title="Unlink ${escapeHtml(e.code)}; it stays in the evidence log" aria-label="Unlink ${escapeHtml(e.code)}">×</button>
      </div>`).join('') : isCause(n) ? '<p class="empty-note">No evidence linked yet. Every cause needs evidence.</p>' : ''}
      <div class="combo">
        <label class="field" for="evidenceSearch" style="margin-top:4px">Link or add evidence</label>
        <input class="text" id="evidenceSearch" role="combobox" aria-expanded="false" aria-controls="evidenceOptions" aria-autocomplete="list" autocomplete="off" placeholder="Type a code, a word, or new evidence">
        <ul class="options" id="evidenceOptions" role="listbox" aria-label="Evidence" hidden></ul>
      </div>
    </div>

    <div class="section">
      <div class="panel-title">${isPrimary ? 'Causes' : 'Causes of this effect'}</div>
      ${causes.length ? `<ul class="cause-list">${causes.map(c => `<li><button data-goto="${c.id}">${swatch(c)}${escapeHtml(c.title)}</button></li>`).join('')}</ul>` : '<p class="note" style="margin-top:0">No causes yet.</p>'}
      <div class="button-grid">
        <button class="button" id="inspAddAction" title="Insert or A">+ Action</button>
        <button class="button" id="inspAddCondition" title="Shift+Insert or C">+ Condition</button>
        <button class="button" id="inspLink" title="Link a node already on the chart as a further cause (L)">Link existing</button>
        ${causes.length ? `<button class="button" id="inspCollapse" title="Space">${collapsed.has(n.id) ? 'Expand branch' : 'Collapse branch'}</button>` : ''}
      </div>
    </div>
    ${isPrimary ? '' : `<div class="section">
      <div class="panel-title">Supports</div>
      <ul class="cause-list">${effects.map(e => `<li class="with-action"><button data-goto="${e.id}">${swatch(e.id === state.problem.primaryEffectId ? {kind: 'effect'} : e)}${escapeHtml(e.title)}</button>${effects.length > 1
        ? `<button class="unlink" data-unlink-effect="${e.id}" title="Stop this being a cause of “${escapeHtml(e.title)}”" aria-label="Unlink from ${escapeHtml(e.title)}">×</button>` : ''}</li>`).join('')}</ul>
      ${effects.length > 1 ? '<p class="note">A shared cause: it is needed for each of these effects.</p>' : ''}
      <button class="button block" id="inspMove" style="margin-top:8px" title="Move under another effect (M), or drag the node onto it">Move to another effect</button>
      <p class="note">Or drag the node: onto an effect to move it, or between its siblings to reorder (<kbd>Alt+↑</kbd> <kbd>Alt+↓</kbd>).</p>
    </div>`}

    ${isPrimary ? '' : `<div class="section">
      <div class="section-head"><div class="panel-title">Solutions · ${solutions.length}</div><button class="link" data-goto-record="solutions">All solutions</button></div>
      ${solutions.length ? `<ul class="cause-list">${solutions.map(s => `<li><button data-solution="${s.id}"><span class="badge small ${s.decision || 'none'}">${DECISIONS[s.decision] || 'Not decided'}</span>${escapeHtml(s.title || 'Untitled solution')}</button></li>`).join('')}</ul>` : ''}
      <button class="button block" id="inspAddSolution" style="margin-top:8px">+ Solution for this cause</button>
    </div>`}
    <div class="section">
      ${area('Description', 'nodeDescription', n.description).replace('class="field"', 'class="field" style="margin-top:0"')}
      ${area('Notes', 'nodeNotes', n.notes)}
    </div>
    ${isPrimary ? '' : `<div class="button-grid" style="margin-top:16px">
      <button class="button" id="inspRuleOut" title="Move to the causes ruled out, with its evidence">Rule out</button>
      <button class="button danger" id="inspDelete">Delete <kbd>Del</kbd></button>
    </div>`}`;

  $('nodeTitle').oninput = e => { n.title = e.target.value; refreshChart(); persist('title:' + n.id); };
  $('nodeDescription').oninput = e => { n.description = e.target.value; persist('description:' + n.id); };
  $('nodeNotes').oninput = e => { n.notes = e.target.value; persist('notes:' + n.id); };
  box.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => { n.kind = b.dataset.kind; render(); persist(); });
  const flag = (id, apply) => { if ($(id)) $(id).onchange = e => { apply(e.target.checked); render(); persist(); }; };
  flag('nodeUnverified', on => { n.unverified = on; });
  flag('nodeControllable', on => { n.controllable = on; });
  flag('nodeStop', on => { n.stopPoint = on ? {reason: 'solution-found', note: ''} : null; });
  if ($('nodeStopReason')) $('nodeStopReason').onchange = e => { n.stopPoint.reason = e.target.value; render(); persist(); };
  box.querySelectorAll('[data-unlink]').forEach(b => b.onclick = () => { n.evidenceIds = n.evidenceIds.filter(id => id !== b.dataset.unlink); render(); persist(); });
  box.querySelectorAll('[data-goto]').forEach(b => b.onclick = () => { select(b.dataset.goto); scrollToNode(b.dataset.goto); });
  evidenceCombo(n);
  $('inspAddAction').onclick = () => addCauseToSelected('action');
  $('inspAddCondition').onclick = () => addCauseToSelected('condition');
  $('inspLink').onclick = startLinking;
  if ($('inspMove')) $('inspMove').onclick = startMoving;
  if ($('inspCollapse')) $('inspCollapse').onclick = () => toggleCollapse(n.id);
  box.querySelectorAll('[data-unlink-effect]').forEach(b => b.onclick = () => unlinkFrom(b.dataset.unlinkEffect, n.id));
  if ($('inspDelete')) $('inspDelete').onclick = deleteSelected;
  if ($('inspRuleOut')) $('inspRuleOut').onclick = ruleOutSelected;
  box.querySelectorAll('[data-highlight]').forEach(b => b.onclick = () => { highlight = highlight === b.dataset.highlight ? null : b.dataset.highlight; render(); });
  box.querySelectorAll('[data-goto-record]').forEach(b => b.onclick = () => showRecord(b.dataset.gotoRecord));
  box.querySelectorAll('[data-solution]').forEach(b => b.onclick = () => showSolution(b.dataset.solution));
  if ($('inspAddSolution')) $('inspAddSolution').onclick = () => { const s = addSolution([n.id]); render(); persist(); showSolution(s.id, true); };
}

// The evidence search box: matching items from the evidence log, and an option to log what was typed
// as a new item. Arrow keys choose, Enter links, Escape closes.
function evidenceCombo(n) {
  const input = $('evidenceSearch'), list = $('evidenceOptions');
  let options = [], active = 0;

  const show = () => {
    const q = input.value.trim(), lower = q.toLowerCase();
    const matches = state.evidence.filter(e => !n.evidenceIds.includes(e.id)
      && (!q || e.code.toLowerCase() === lower || e.code.toLowerCase().startsWith(lower) || (e.description + ' ' + e.source).toLowerCase().includes(lower)));
    options = matches.slice(0, 6).map(e => ({evidence: e}));
    if (q && !state.evidence.some(e => e.code.toLowerCase() === lower)) options.push({create: q});
    active = Math.min(active, Math.max(0, options.length - 1));
    list.hidden = !options.length || document.activeElement !== input;
    input.setAttribute('aria-expanded', !list.hidden);
    list.innerHTML = options.map((o, i) => `<li role="option" id="evidenceOption${i}" data-option="${i}" aria-selected="${i === active}">${o.evidence
      ? `<span class="k">${escapeHtml(o.evidence.code)}</span><span>${escapeHtml(shorten(o.evidence.description, 90))}</span>`
      : `<span class="new">+ New</span><span id="evidenceNew">Add “${escapeHtml(shorten(o.create, 60))}” to the log as <b>${nextEvidenceCode()}</b> and cite it</span>`}</li>`).join('');
    input.setAttribute('aria-activedescendant', options.length ? `evidenceOption${active}` : '');
  };
  const pick = i => {
    const o = options[i];
    if (!o) return;
    n.evidenceIds.push(o.evidence ? o.evidence.id : addEvidence(o.create).id);
    render(); persist();
    $('evidenceSearch')?.focus();
  };

  input.oninput = () => { active = 0; show(); };
  input.onfocus = show;
  input.onblur = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); };
  input.onkeydown = e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (options.length) active = (active + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      show();
    } else if (e.key === 'Enter') { e.preventDefault(); if (!list.hidden) pick(active); }
    else if (e.key === 'Escape') { input.value = ''; input.blur(); }
  };
  // pointerdown rather than click, so the input keeps its focus.
  list.onpointerdown = e => {
    const li = e.target.closest('[data-option]');
    if (!li) return;
    e.preventDefault();
    pick(+li.dataset.option);
  };
}

function showSolution(id, focus = false) {
  showRecord('solutions');
  const card = $('solution-' + id);
  card?.scrollIntoView({block: 'start'});
  if (focus) card?.querySelector('[data-field="title"]').focus();
}

// Redraws the chart without rebuilding the panel, so a field being typed in keeps its focus.
function refreshChart() {
  layout = computeLayout();
  renderCanvas();
  renderTitle();
}
