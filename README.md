# Apollo RCA Builder

An offline, single-file HTML tool for root cause analyses with the Apollo method: build the cause-and-effect chart, back each cause with evidence, and keep the RCA records alongside it. No installation, server, account, or network connection is needed.

> Status: milestone M1, plus the new layout, evidence linking, the keyboard, and the issues list from M2. Linking an existing cause to a second effect, collapsing branches, the RCA record panels (M3), export, printing, and the dark theme (M4) follow.

## Run it

Open [`apollo-rca.html`](apollo-rca.html) in Chrome, Edge, or Firefox. Choose **Load example** to see a finished chart: high leakage on the single cartridge seal of pump P-101A.

## Build a chart

1. A new RCA starts with the **primary effect**. Click it and type what happened in **Title**.
2. With the effect selected, choose **+ Action** or **+ Condition**. The new cause is selected with its title ready to type over.
3. Select any cause and add its own causes the same way. The chart lays itself out from left to right: the primary effect on the left, causes to the right of their effects.
4. Tick **Stop point** where a branch ends and pick the reason. Tick **Controllable** on causes the organisation can change; they are the candidates for solutions.

| Element | Meaning |
|---|---|
| Red box | The primary effect |
| Dark teal box | **Action**: a momentary cause, at a point in time |
| Light box with a teal border | **Condition**: a cause that existed over time |
| **AND** on a connector | The causes joined there were all needed |
| Orange **?** | A cause with no evidence linked, or marked as an unverified candidate |
| Dashed orange outline | An effect that lacks an action or a condition cause |
| Double bar and **STOP** | A stop point |
| **CONTROLLABLE** | A cause the organisation can change |
| Dashed purple connector | A further link of a shared cause (one cause supporting several effects) |
| `E1` `E4` pills | Evidence items the cause cites |

## Screen

- **Top bar**: the RCA number, tag, and primary effect; undo and redo; the **issues** button; the file commands.
- **Records** on the left: the chart now; the problem definition, evidence log, ruled-out causes, solutions, and action plan arrive in M3. Below them, the legend.
- **Chart** in the middle, with the edit bar at the bottom: **+ Action**, **+ Condition**, **Delete**, and zoom. Each button shows its key.
- **Properties** on the right, for the selected node, or for the RCA when nothing is selected.
- **Status bar** at the bottom: the last file action, the counts, and the keys.

## Link evidence

Select a cause. Its **Evidence** section lists the items it cites, each with its code, description, type, collector, and date.

- Type in **Link or add evidence**: a code (`E3`), or a word from the description or source. Matching items from the evidence log are listed; choose one with the arrow keys and **Enter**, or click it.
- To log something new, type what was seen or measured and choose **+ New**. It goes into the evidence log with the next free code and is cited by the cause. Its type, source, collector, and date are edited in the evidence log (M3); until then it is recorded as sensed, collected today.
- **×** unlinks an item. It stays in the evidence log.

The "?" marker goes away once a cause cites at least one item and is not marked unverified. Codes are never reused: after E11 is deleted, the next item is still E12. On the chart, codes show as pills under the title; when they do not fit, the last pill counts the rest (`+3`).

## Issues

The **issues** button in the top bar counts rule errors and warnings. Click it for the list, errors first; click an issue to select its node and bring it into view.

## Keyboard

With a node selected and no field focused:

| Key | Result |
|---|---|
| **Insert** or **A** | Add an action cause |
| **Shift+Insert** or **C** | Add a condition cause |
| **F2** or **Enter** | Edit the title |
| **←** | Select the effect |
| **→** | Select a cause |
| **↑ ↓** | Select the node above or below in the same column |
| **Delete** | Delete the selected cause |

With nothing selected, an arrow key selects the primary effect. A and C are there for laptops without an Insert key.

All causes under one effect are joined by AND: each was needed. Every effect needs at least one action and at least one condition.

**Delete** removes the selected cause. Causes that supported only that cause go with it; you are asked first. A cause that also supports another effect stays. The primary effect cannot be deleted.

Drag the empty canvas to pan, use the wheel to zoom, and **Fit** to see the whole chart.

## Files

| Control | Result |
|---|---|
| **Save** | Saves the RCA as JSON. In Chrome and Edge you pick a file once, and later saves write to it; Firefox downloads a copy each time. **Ctrl/Cmd+S** |
| **Save as** | Saves under a new name. **Ctrl/Cmd+Shift+S** |
| **Open** | Opens a saved RCA |
| **New** | Starts an empty RCA |
| **Load example** | Replaces the current RCA with the P-101A example |

You are asked before unsaved changes are lost, and the browser warns when you close the tab with unsaved changes.

The RCA is also kept in browser storage after every edit, as crash recovery. Reopening the page brings it back, and the status line says so when it had unsaved changes. Browser storage belongs to one browser and can be cleared; the saved JSON file is the record.

## Undo and redo

**Undo** and **Redo** in the toolbar, **Ctrl/Cmd+Z**, and **Ctrl+Y** or **Ctrl/Cmd+Shift+Z**. The last 100 edits are kept for the session; consecutive typing in one field is one step. Pan, zoom, and selection are not edits.

## File format

The file is JSON with `"type": "apollo-rca"` and `"schemaVersion": 1`. Every entity has a UUID that never changes, so the files can be imported into another system without renumbering.

| Key | Content |
|---|---|
| `id` | The RCA's UUID |
| `meta` | `rcaNumber`, `equipmentTag`, `sealType`, `leadId` (a team member's id), `team` [{`id`, `name`, `role`}], `dates` {`opened`, `eventDate`, `closed`} |
| `problem` | `primaryEffectId`, `when`, `where`, `significance` {`safety`, `environment`, `productionCost`, `reliability`}. The "what" is the primary effect node's title. |
| `nodes` | {`id`, `kind`: `effect` \| `action` \| `condition`, `title`, `description`, `evidenceIds`, `unverified`, `controllable`, `stopPoint`: null or {`reason`, `note`}, `notes`} |
| `links` | {`id`, `effectId`, `causeId`}: the cause supports the effect. Links form a directed acyclic graph rooted at the primary effect. |
| `evidence` | {`id`, `code` (`E1`, `E2`, …, never renumbered), `description`, `type`: `sensed` \| `inferred`, `source`, `collectedBy`, `date`} |
| `ruledOut` | {`id`, `cause`, `kind`, `test`, `evidenceIds`, `status`} |
| `solutions` | {`id`, `title`, `causeIds`, `criteria` {`preventsRecurrence`, `withinControl`, `meetsGoals`, `noNewProblems`: {`v`: `yes` \| `no` \| `partly`, `c`: comment}}, `decision`: `implement` \| `reject` \| `study`} |
| `actions` | {`id`, `action`, `solutionId`, `owner`, `due`, `verification`, `status`, `effectiveness` {`date`, `result`}} |
| `view` | `collapsed`: ids of nodes whose causes are hidden |

Stop point reasons are `outside-control`, `solution-found`, `no-evidence`, and `no-value`. Dates are `YYYY-MM-DD`. Opening a file drops links to missing nodes and links that would close a loop.

## Offline

The page has no external references, and its Content Security Policy (`default-src 'none'`) makes the browser refuse any network request. It contains no third-party code.

## Project files and development

`apollo-rca.html` is generated. Edit the sources and rebuild; do not edit the HTML by hand.

- `src/index.html` — the page; `src/styles.css` — the styles.
- `src/js/` — the application, concatenated in filename order into one script: `01-constants`, `02-state` (state, undo, autosave), `03-model` (links, loop check, deletion, rule checks), `04-layout` (automatic layout and connector routing), `05-render`, `06-inspector` (Properties panel, evidence search), `07-issues` (issues list), `08-actions` (edits), `09-interactions` (pointer, pan, zoom, keys, arrow navigation), `10-io` (open, save, file checks), `11-example`, `12-main` (startup).
- `media/favicon.svg` — the tab icon.
- `scripts/build.py` — builds `apollo-rca.html`; standard library only. It refuses to build if the page references a remote resource.
- `scripts/test-app.py` — Firefox regression tests; standard library only.

```
python3 scripts/build.py      # after editing src/ or media/
python3 scripts/test-app.py   # needs Firefox
```

The tests start a separate headless Firefox with a temporary profile. They check the script's syntax, then cover the example and its rule warnings, the layout (no overlaps, causes right of effects), adding, naming, and deleting causes, the Insert, A, C, and Delete keys, searching, linking, and adding evidence, arrow keys, the issues list, AND junctions, undo and redo, the save and open round trip, shared causes and loop protection in opened files, refused files, autosave recovery, unavailable storage, and that no network request is made.
