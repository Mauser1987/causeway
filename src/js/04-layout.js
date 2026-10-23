// Automatic left-to-right layout of the cause-and-effect chart.
//
// Each node sits in the column of its longest path from the primary effect, so a shared cause
// lands to the right of every effect it supports. Every node has one layout parent, the
// effect in the column just left of it; along those links the chart is a tree, laid out with
// subtree contours so branches pack closely without overlapping. Links to further effects of a
// shared cause are routed separately, through gaps between the nodes of the columns they cross.
//
// A cause moved by hand (its offsetY) moves up or down from there, with its branch; its effect stays
// where it was. It moves up only into free space, and moving down it pushes the causes below it.

const measureContext = document.createElement('canvas').getContext('2d');
const textWidth = (text, size, weight = 400, font = CHART_FONT) => {
  measureContext.font = `${weight} ${size}px ${font}`;
  return measureContext.measureText(text).width;
};

// Splits text into lines no wider than `width`, breaking long words where they must.
function wrapText(text, width, size, weight) {
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    let line = '';
    for (let word of paragraph.split(/\s+/).filter(Boolean)) {
      while (textWidth(word, size, weight) > width) {
        let cut = word.length - 1;
        while (cut > 1 && textWidth(word.slice(0, cut), size, weight) > width) cut--;
        if (line) { lines.push(line); line = ''; }
        lines.push(word.slice(0, cut)); word = word.slice(cut);
      }
      const next = line ? line + ' ' + word : word;
      if (line && textWidth(next, size, weight) > width) { lines.push(line); line = word; }
      else line = next;
    }
    lines.push(line);
  }
  return lines;
}

// The small line under a node's title: evidence codes, tags, and hidden causes.
function nodeFoot(n, hidden) {
  const codes = n.evidenceIds.map(evidenceById).filter(Boolean).map(e => e.code);
  return {codes, controllable: n.controllable, stop: !!n.stopPoint, hidden};
}
const hasFoot = f => f.codes.length || f.controllable || f.stop || f.hidden;

// In a cause tree a cause has no kind label: its status badge in the corner says it.
const statusBadge = n => treeStyle() && isCause(n);
const kindLine = n => statusBadge(n) ? 0 : KIND_LINE;

function nodeSize(n, hidden) {
  const lines = wrapText(n.title.trim() || 'Untitled', NODE_W - 2 * NODE_PAD_X - (statusBadge(n) ? BADGE_ROOM : 0), TITLE_SIZE, 600);
  const foot = nodeFoot(n, hidden);
  const h = NODE_PAD_Y * 2 + kindLine(n) + lines.length * TITLE_LINE + (hasFoot(foot) ? FOOT_LINE : 0);
  return {w: NODE_W, h, lines, foot};
}

function computeLayout() {
  const primaryId = state.problem.primaryEffectId;
  // Roots: the primary effect, then any node no effect links to (only in hand-edited files).
  const linked = new Set(state.links.map(l => l.causeId));
  const roots = [primaryId, ...state.nodes.filter(n => n.id !== primaryId && !linked.has(n.id)).map(n => n.id)].filter(byId);

  // Visible nodes: everything reached without passing through a collapsed node.
  const visible = new Set(), stack = [...roots];
  while (stack.length) {
    const id = stack.pop();
    if (visible.has(id)) continue;
    visible.add(id);
    if (!collapsed.has(id)) for (const l of causeLinks(id)) stack.push(l.causeId);
  }
  const links = state.links.filter(l => visible.has(l.effectId) && visible.has(l.causeId) && !collapsed.has(l.effectId));

  // Columns by longest path, visiting each node after all of its visible effects.
  const rank = new Map(), incoming = new Map();
  for (const l of links) incoming.set(l.causeId, (incoming.get(l.causeId) || 0) + 1);
  const queue = roots.filter(id => !incoming.get(id));
  for (const id of queue) rank.set(id, 0);
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    for (const l of links) {
      if (l.effectId !== id) continue;
      rank.set(l.causeId, Math.max(rank.get(l.causeId) ?? 0, rank.get(id) + 1));
      incoming.set(l.causeId, incoming.get(l.causeId) - 1);
      if (!incoming.get(l.causeId)) queue.push(l.causeId);
    }
  }

  // Layout parent: the first-linked effect in the column just to the left.
  const parent = new Map(), children = new Map();
  for (const l of links) {
    if (parent.has(l.causeId) || rank.get(l.effectId) !== rank.get(l.causeId) - 1) continue;
    parent.set(l.causeId, l.effectId);
    if (!children.has(l.effectId)) children.set(l.effectId, []);
    children.get(l.effectId).push(byId(l.causeId));
  }
  // Within an effect, its actions come above its conditions, and causes without a type below them.
  // In a cause tree, causes keep their order.
  const order = {action: 0, condition: 1, cause: 2, effect: 3};
  if (!treeStyle()) for (const list of children.values()) list.sort((a, b) => order[a.kind] - order[b.kind]);

  // Hidden causes under a collapsed node, for its "+N" tag.
  const hiddenCount = id => {
    if (!collapsed.has(id)) return 0;
    const seen = new Set(), todo = causeLinks(id).map(l => l.causeId);
    while (todo.length) {
      const c = todo.pop();
      if (seen.has(c) || visible.has(c)) continue;
      seen.add(c);
      for (const l of causeLinks(c)) todo.push(l.causeId);
    }
    return seen.size;
  };
  const sizes = new Map([...visible].map(id => [id, nodeSize(byId(id), hiddenCount(id))]));

  // Contour packing. A subtree is {contour: [[top, bottom] per column depth], members: [[id, top]]}
  // in coordinates relative to the subtree. With `hand`, causes are moved by hand; without, the
  // result places each effect, centred on its causes as they would be without hand moves.
  const plain = new Map();
  function subtree(id, hand) {
    if (!hand && plain.has(id)) return plain.get(id);
    const h = sizes.get(id).h, kids = children.get(id) || [];
    if (!kids.length) return {contour: [[0, h]], members: [[id, 0]]};
    const acc = [], members = [], offsets = [];
    let firstCenter = null, lastCenter = null;
    for (const [i, kid] of kids.entries()) {
      const t = subtree(kid.id, hand);
      // Packed below the causes before it; the first has nothing above it, except by hand.
      let offset = hand ? -Infinity : 0;
      if (members.length) {
        offset = -Infinity;
        for (let d = 0; d < Math.min(acc.length, t.contour.length); d++)
          offset = Math.max(offset, acc[d][1] + (d ? SUBTREE_GAP : SIBLING_GAP) - t.contour[d][0]);
      }
      // By hand, a cause goes where it would be without hand moves, moved by its offset, unless the
      // causes above it need the room.
      if (hand) offset = Math.max(offset, subtree(id, false).offsets[i] + (kid.offsetY || 0));
      offsets.push(offset);
      t.contour.forEach(([top, bottom], d) => {
        acc[d] = acc[d] ? [Math.min(acc[d][0], top + offset), Math.max(acc[d][1], bottom + offset)] : [top + offset, bottom + offset];
      });
      for (const [m, y] of t.members) members.push([m, y + offset]);
      // The kid's box is the first member, not necessarily at the top of its subtree.
      const center = offset + t.members[0][1] + sizes.get(kid.id).h / 2;
      firstCenter ??= center; lastCenter = center;
    }
    const top = hand ? subtree(id, false).members[0][1] : (firstCenter + lastCenter) / 2 - h / 2;
    const result = {contour: [[top, top + h], ...acc], members: [[id, top], ...members], offsets};
    if (!hand) plain.set(id, result);
    return result;
  }

  // Each tree is placed below the last, its top where it would be without hand moves, so that a
  // cause moved up into the space above does not move the rest of the chart.
  const boxes = new Map();
  let bottom = null;
  for (const root of roots) {
    if (!visible.has(root) || rank.get(root) !== 0) continue;
    const t = subtree(root, true), top = Math.min(...subtree(root, false).contour.map(c => c[0]));
    const origin = bottom === null ? 0 : bottom + SUBTREE_GAP * 2 - (Math.min(...t.contour.map(c => c[0])) - top);
    for (const [id, y] of t.members) {
      const size = sizes.get(id);
      boxes.set(id, {id, node: byId(id), x: rank.get(id) * (NODE_W + COL_GAP), y: y - top + origin, ...size});
    }
    bottom = origin + Math.max(...t.contour.map(c => c[1])) - top;
  }

  const placed = links.filter(l => boxes.has(l.effectId) && boxes.has(l.causeId));
  // parent and children: the effect each cause is drawn under, and each effect's causes in drawing order.
  return {boxes, edges: routeEdges(boxes, placed, parent, rank), bounds: chartBounds(boxes), parent, children};
}

// ---- Connectors ----

const midY = b => b.y + b.h / 2;

function routeEdges(boxes, links, parent, rank) {
  const edges = [];
  // Tree links: each effect has a bracket in the gap to its right, joining all its causes.
  const groups = new Map();
  for (const l of links) {
    if (parent.get(l.causeId) !== l.effectId) continue;
    if (!groups.has(l.effectId)) groups.set(l.effectId, []);
    groups.get(l.effectId).push(l);
  }
  for (const [effectId, group] of groups) {
    const e = boxes.get(effectId), bx = e.x + e.w + COL_GAP / 2;
    const ys = group.map(l => midY(boxes.get(l.causeId)));
    let d = `M ${e.x + e.w} ${midY(e)} H ${bx} M ${bx} ${Math.min(midY(e), ...ys)} V ${Math.max(midY(e), ...ys)}`;
    for (const l of group) d += ` M ${bx} ${midY(boxes.get(l.causeId))} H ${boxes.get(l.causeId).x}`;
    // Two or more causes under one effect are joined by AND, marked where the bracket meets the effect.
    edges.push({d, shared: false, effectId, linkIds: group.map(l => l.id), junction: group.length > 1 ? {x: bx, y: midY(e)} : null,
      from: {x: e.x + e.w, y: midY(e)}, bx, branches: group.map(l => ({id: l.causeId, x: boxes.get(l.causeId).x, y: midY(boxes.get(l.causeId))}))});
  }

  // Further links of shared causes get their own lanes beside the brackets.
  const columns = new Map();
  for (const b of boxes.values()) {
    const r = Math.round(b.x / (NODE_W + COL_GAP));
    if (!columns.has(r)) columns.set(r, []);
    columns.get(r).push(b);
  }
  const effectLanes = new Map(), causeLanes = new Map();
  const lane = (map, key) => { const i = map.get(key) || 0; map.set(key, i + 1); return i; };
  for (const l of links) {
    if (parent.get(l.causeId) === l.effectId) continue;
    const e = boxes.get(l.effectId), c = boxes.get(l.causeId), re = rank.get(l.effectId), rc = rank.get(l.causeId);
    const ey = midY(e), cy = midY(c);
    const lx = e.x + e.w + 14 + 7 * lane(effectLanes, re);
    let d = `M ${e.x + e.w} ${ey} H ${lx}`;
    if (rc === re + 1) d += ` V ${cy} H ${c.x}`;
    else {
      const rx = c.x - 14 - 7 * lane(causeLanes, rc);
      const crossed = [];
      for (let r = re + 1; r < rc; r++) crossed.push(...(columns.get(r) || []));
      const y = freeLane(crossed, ey, cy);
      d += ` V ${y} H ${rx} V ${cy} H ${c.x}`;
    }
    edges.push({d, shared: true, effectId: l.effectId, linkIds: [l.id]});
  }
  return edges;
}

// The y closest to both ends at which a horizontal run crosses none of the given boxes.
function freeLane(crossed, ey, cy) {
  const clear = 8;
  const free = y => crossed.every(b => y < b.y - clear || y > b.y + b.h + clear);
  const candidates = [ey, cy];
  const sorted = [...crossed].sort((a, b) => a.y - b.y);
  for (const b of sorted) candidates.push(b.y - clear * 2, b.y + b.h + clear * 2);
  return candidates.filter(free).sort((a, b) => Math.abs(a - ey) + Math.abs(a - cy) - Math.abs(b - ey) - Math.abs(b - cy))[0] ?? ey;
}

function chartBounds(boxes) {
  if (!boxes.size) return {l: 0, t: 0, r: 0, b: 0};
  const all = [...boxes.values()];
  return {
    l: Math.min(...all.map(b => b.x)), t: Math.min(...all.map(b => b.y)),
    r: Math.max(...all.map(b => b.x + b.w)), b: Math.max(...all.map(b => b.y + b.h)),
  };
}
