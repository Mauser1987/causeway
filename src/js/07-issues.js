// The issues list in the top bar: every rule issue, and a click selects its node.

const ISSUE_ORDER = {error: 0, warning: 1, info: 2};

function renderIssues(issues) {
  const open = issues.filter(i => i.level !== 'info');
  $('issuesCount').textContent = `${open.length} issue${open.length === 1 ? '' : 's'}`;
  $('issuesButton').classList.toggle('has', open.length > 0);
  if (!$('issuesList').hidden) fillIssues(issues);
}

function fillIssues(issues = ruleIssues()) {
  const sorted = [...issues].sort((a, b) => ISSUE_ORDER[a.level] - ISSUE_ORDER[b.level]);
  $('issuesList').innerHTML = sorted.length
    ? sorted.map(i => `<button role="menuitem" data-node="${i.nodeId}"><b>${escapeHtml(byId(i.nodeId)?.title || 'Untitled')}</b><small class="${i.level}">${escapeHtml(i.text)}</small></button>`).join('')
    : '<div class="empty">No issues: every effect has an action and a condition, and every cause has evidence.</div>';
  $('issuesList').querySelectorAll('[data-node]').forEach(b => b.onclick = () => {
    showIssues(false);
    select(b.dataset.node);
    scrollToNode(b.dataset.node);
  });
}

function showIssues(open) {
  $('issuesList').hidden = !open;
  $('issuesButton').setAttribute('aria-expanded', open);
  if (open) { fillIssues(); $('issuesList').querySelector('button')?.focus(); }
}
$('issuesButton').onclick = () => showIssues($('issuesList').hidden);
document.addEventListener('pointerdown', e => { if (!e.target.closest('.issues-wrap')) showIssues(false); });
$('issuesList').addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Escape') { showIssues(false); $('issuesButton').focus(); }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const items = [...$('issuesList').querySelectorAll('button')], i = items.indexOf(document.activeElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  }
});
