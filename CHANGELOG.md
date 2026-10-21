# Changelog

## M2 — 2026-10-21

- Shared causes: Link cause (L) links a node already on the chart as a further cause of the selected effect. Nodes that would make a loop or are already linked are faded; Esc cancels. The Properties panel lists the effects a cause supports and unlinks all but the last.
- Collapse and expand branches: the circle on a node's connector, Space, → on a collapsed node, or the Properties panel; Expand all. Saved with the file, not an undo step. Choosing a hidden issue expands its branch.

- New layout: light top bar with the issues button, records list and legend on the left, floating edit bar on the chart showing each key, status bar.
- AND junction marked where an effect's connector splits to its causes; evidence codes drawn as pills, `+N` when they do not fit; dot-grid canvas.
- Evidence on a cause: search the evidence log by code, description, or source; link with Enter or a click; type new evidence to log it with the next code; × unlinks. Each cited item shows its description, type, collector, and date.
- Issues list: click the issues button, then an issue to select its node and bring it into view.
- Keys on the selected node: Insert or A adds an action, Shift+Insert or C a condition, F2 or Enter edits the title, Delete deletes, arrow keys move the selection.
- Properties panel: equipment tag on the RCA; causes of the selected effect listed, click one to select it.

## M1 — 2026-10-21

- Data model with `schemaVersion` 1 and UUIDs for every entity: nodes, links, evidence, ruled-out causes, solutions, actions, team members.
- Chart with automatic left-to-right layout. Columns follow the longest path from the primary effect, branches pack by subtree contours, and connectors are orthogonal. A shared cause's further links are dashed and routed through gaps between nodes.
- Add action and condition causes, edit titles and fields in the Properties panel, delete a cause together with the causes that only it supported (asks first).
- Rule markers on the chart: dashed outline on an effect without an action or a condition, "?" on causes without evidence or marked unverified, bars and a STOP tag on stop points, CONTROLLABLE tag.
- Save and Save as (File System Access API, or a download where the browser lacks it), Open, New, with a warning before unsaved changes are lost.
- Files are checked on opening: wrong type, newer format, missing primary effect, and links that would close a loop are refused or dropped.
- Undo and redo (100 steps; typing in one field is one step).
- Autosave to browser storage as crash recovery; the app works without storage.
- Built-in P-101A seal leakage example.
- Content Security Policy that blocks every network request; Firefox regression tests.
