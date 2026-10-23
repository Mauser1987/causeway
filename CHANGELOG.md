# Changelog

## v1.4 — 2026-10-23

Tidy the chart by hand, and copy branches.

- **Shift+drag** a cause up or down, or press **Shift+↑** and **Shift+↓**, to tidy the chart, for printing for example. It moves with its own causes and its effect stays. It moves up only into free space, and moving down it pushes the causes below it. While dragging, it snaps back to its place and level with its effect; **Esc** cancels. The Properties panel shows how far it was moved, with **Put it back**, or puts back every moved node at once. Hand moves are undo steps, saved in the file (`offsetY` on each node), and used by exports and the printed report.
- **Ctrl+C** copies the selected node with every cause under it, **Ctrl+V** pastes the copy as a cause of the selected node, and **Ctrl+X** cuts. The copy pastes into another tab or RCA, without its evidence citations there, and into other programs as an indented list of titles. The Properties panel has **Copy branch** and **Paste as cause** too.

## v1.3 — 2026-10-22

Faster keyboard editing, and confirmed causes that confirm what they lead to.

- Typing on a selected node replaces its title, as in a spreadsheet cell. **Enter** finishes the title and goes back to the chart's keys, **Shift+Enter** starts a new line, and **Esc** takes back what was typed. Each time a title is edited is one undo step.
- The commands that were letters or digits now take Alt, so that typing always goes to the title: **Alt+A** and **Alt+C** add an action and a condition (in a cause tree, Alt+A adds a cause), **Alt+L** links, **Alt+M** moves, and **Alt+1**, **Alt+2**, **Alt+3** set a cause's status. On a Mac, Alt is Option. Insert, Shift+Insert, F2, Enter, Space, Delete, and the arrows are unchanged.
- In a cause tree, confirming a cause also confirms the possible effects between it and the primary effect, in the same undo step. A ruled-out effect on the way is left as it is and flagged in the issues list; a possible effect whose cause is confirmed is flagged too, for RCAs made before this change.
- The chart layout centres each effect on its causes; effects whose causes had causes of their own sat too high.

## v1.2 — 2026-10-21

Two chart styles per RCA, Apollo or cause tree, with guided switching between them.

- Two chart styles, chosen with **New**: **Apollo** (actions and conditions, AND) or **Cause tree** (possible causes, each possible, confirmed, or ruled out, like an organisation chart lying on its side). In a cause tree the confirmed path is drawn bold and ruled-out causes stay on the tree, struck through; keys 1, 2, and 3 set the status.
- Switching an RCA to the other style first lists what that style still needs (causes without a type, effects missing an action or a condition, ruled-out causes to move, untested causes), then flags each in the issues list. Nothing is lost; the switch is one undo step.
- Every cause has **How it is tested**: the test planned for it, or the one that confirmed or ruled it out. Rule out takes it to the causes ruled out.

## v1.1 — 2026-10-21

New methods beside the chart: the 5 Whys and the fishbone diagram, both able to add their causes to the chart; and causes can be moved and reordered.

- Fishbone (Ishikawa) diagrams: the possible causes of an effect, sorted into categories, with sub-causes. Start from seal-failure categories, 6M, or blank ones. Add each cause to the chart or rule it out; one on the chart is that node, and one ruled out is that record. The diagram follows as you type, and clicking it edits a cause. Export as SVG or PNG; the printed report draws each diagram with a table of its causes. The example has a seal-failure diagram.
- Answers in the 5 Whys and the fishbone grow with their text.
- 5 Whys: chains of why-steps from any node of the chart, each step with its type and evidence; Enter goes to the next why. Add a step, or the whole chain, to the chart as causes one under another; a step on the chart is that node. The example has one chain on the chart and one not yet. The printed report lists the chains.
- The left column groups the chart, the 5 Whys, and the fishbone under Analysis, and the RCA records under Records.
- Drag a cause onto another node to move it there, with its own causes; refused, with the reason, when it would make a loop or the node already has it. M, or Move to another effect in the Properties panel, does the same from the keyboard.
- Drag a cause to a sibling's top or bottom edge, or the gap beside it, to reorder; Alt+↑ and Alt+↓ do the same. Actions stay above conditions.
- While dragging, a copy of the node, the drop target, and a label show what a drop does; Esc cancels.

## v1.0 — 2026-10-21

First release as Causeway: milestones M1–M4 below, then the rename.

### Renamed to Causeway

- The tool is now **Causeway**, a root cause analysis workbench, ready for further methods such as 5 Whys and fishbone diagrams. It was the Apollo RCA Builder.
- The page is `index.html` (was `apollo-rca.html`), so GitHub Pages serves it at the repository's address.
- Files have `"type": "causeway"`. Files with the old type `apollo-rca` still open, and are saved with the new type.
- The autosave and the theme choice move to new browser-storage keys; the old ones are taken over once, then removed.
- On screen, solutions are weighed against "the four solution criteria".

## M4 — 2026-10-21

- Export the chart as a self-contained SVG, or as a PNG at twice screen resolution. Exports show the whole chart, expanded, in the light colours, with a heading.
- Print report (also Ctrl/Cmd+P; Save as PDF for a PDF): cover, problem definition, chart and open issues, evidence log, causes ruled out, solutions, action plan, on landscape pages. A chart too large for one page at a readable size is split into numbered parts, cut between columns.
- Light and dark themes, or the system setting, from the button in the top bar; the chart has its own dark palette.
- The browser tab shows the RCA number and primary effect.

## M3 — 2026-10-21

- RCA record pages, opened from the left column: problem definition, team and dates, evidence log, causes ruled out, solutions, action plan. Fields save as you type; every change is an undo step.
- Problem definition: "what" is the primary effect's title, kept in sync.
- Evidence log: full editing; cited-by list; Show outlines the citing nodes on the chart; delete asks when cited and removes citations. Codes are never reused (new `counters.evidence` in the file).
- Causes ruled out: Rule out on the chart moves a cause here with its evidence; cite and uncite evidence; status.
- Solutions: linked causes, the four Apollo criteria with comments, decision; started from a cause on the chart; actions added from a solution.
- Action plan: solution, owner, due, verification, status, effectiveness check; overdue actions marked.
- Properties panel: a cause's solutions, + Solution, Rule out, and evidence codes that highlight on the chart.
- Files are filled in on opening where a record lacks fields.

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
