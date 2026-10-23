# Causeway

A root cause analysis workbench in one offline HTML file. Build the cause-and-effect chart, back each cause with evidence, and keep the RCA records alongside it: problem definition, team, evidence log, causes ruled out, solutions, and the action plan. No installation, server, account, or network connection is needed.

Each RCA picks one of two chart styles. **Apollo** follows the cause-and-effect principles of the Apollo method (Dean Gano): every effect has at least one action and one condition, joined by AND, and every cause is backed by evidence. A **cause tree** charts the possible causes of each effect, any of which may explain it, and each is a hypothesis, tested until it is confirmed or ruled out. Alongside the chart, the 5 Whys, the fishbone diagram, and the sequence of events help find the causes, and add what they find to the chart.

Causeway is independent. Apollo Root Cause Analysis is a trademark of its owner; Causeway is not affiliated with or endorsed by it.

## Run it

Open **https://mauser1987.github.io/causeway/** in Chrome, Edge, or Firefox, or download [`index.html`](index.html) and open it from disk; it works the same offline. Choose **Load example** to see a finished chart: high leakage on the single cartridge seal of pump P-101A.

RCAs are saved as files on your computer (see **Files** below). Nothing is sent anywhere, including from the hosted page.

## Build a chart

1. **New** asks for the chart style: **Apollo** or **Cause tree** (see [Chart styles](#chart-styles)). The steps below are for Apollo. A new RCA starts with the **primary effect**. Click it and type what happened in **Title**.
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

## Chart styles

Choose the style when you start an RCA with **New**; the RCA properties (click the empty canvas) show it under **Chart style**, where you can switch.

**Cause tree.** Each effect has its possible causes, drawn like an organisation chart lying on its side; there is no AND, because the branches are alternatives.

- **+ Cause** (**Insert** or **Alt+A**) adds a possible cause. A cause has no action or condition type.
- Each cause has a **status**, set in its properties or with **Alt+1**, **Alt+2**, **Alt+3**, and shown by the badge in its corner: **Hypothesis**, **H** (white, dashed outline: still to test), **Confirmed**, **✓** (solid teal; the path to it from the effect is drawn bold), or **Ruled out**, a red **✕** (grey and struck through, with a dashed link). The badge is orange while a hypothesis or a confirmed cause has no evidence. A ruled-out cause stays on the tree, so the chart shows what was eliminated; **Rule out** sets the status. The ruled-out causes are listed under **Causes ruled out** and in the report.
- A confirmed cause happened, so the effects it leads to did too: confirming a cause also confirms the possible effects between it and the primary effect, in the same undo step. A ruled-out effect on the way is left as it is. Making a confirmed cause a hypothesis again, or ruling it out, takes back what it confirmed: each effect on the way goes back to a hypothesis, unless another of its causes is confirmed or it has evidence of its own.
- **How it is tested**, in each cause's properties (in both styles): the check or test that will confirm it or rule it out, or that did.
- Issues: a confirmed cause without evidence (error), a ruled-out effect of a confirmed cause (error), a hypothesis not tested yet or whose cause is confirmed (warning), and a confirmed branch that ends without a stop point (note).

**Switching.** Choosing the other style shows what that style will still need, before anything changes, for example *4 causes without a type*, *3 effects missing an action or a condition*, *1 ruled-out cause to move to the causes ruled out*. Switch, and each shows in the issues list, which opens, and is outlined on the chart, so you can work through them. Nothing is lost, and the switch is one undo step:

- To a cause tree: a cause backed by evidence, and not unverified, becomes confirmed; the others become hypotheses. Actions and conditions keep their type for a move back.
- To Apollo: hypotheses become unverified (?). Causes made in the tree ask for a type (choose **Action** or **Condition** in their properties), each effect needs an action and a condition, and each ruled-out cause asks to be moved to the causes ruled out with **Rule out**, which takes its evidence and test along.

In a cause tree, the 5 Whys, the fishbone, and the sequence of events add causes without a type.

## Screen

- **Top bar**: the RCA number, tag, and primary effect; undo and redo; the **issues** button; the theme, export, and print buttons; the file commands.
- **Analysis** and **Records** on the left: the cause-and-effect chart, the 5 Whys, the fishbone, and the sequence of events, then the six RCA records, with their counts. Below them, the legend.
- **Chart** in the middle, with the edit bar at the bottom: **+ Action**, **+ Condition**, **Delete**, and zoom. Each button shows its key.
- **Properties** on the right, for the selected node, or for the RCA when nothing is selected.
- **Status bar** at the bottom: the last file action, the counts, and the keys.

## Shared causes

One cause can support more than one effect. To chart that:

1. Select the second effect.
2. Choose **Link cause** (or press **Alt+L**). A banner asks for the cause; nodes that cannot be linked are faded, because the link would make a loop or already exists.
3. Click the cause. The new link is drawn dashed in purple.

**Esc**, **Cancel**, or a click on the empty canvas stops linking. The selected cause's **Supports** section lists every effect it supports; **×** removes one link. A cause keeps at least one effect; to take it off the chart, delete it.

## Move and reorder causes

The chart lays itself out. Dragging a cause changes the structure:

- **Drop it on another node** to make it a cause of that node. Its own causes move with it. A blue outline and a label show what a drop will do; a drop that would make a loop, or onto an effect that already has the cause, is refused and says why.
- **Drop it on the top or bottom edge of a sibling, or in the gap next to it,** to place it above or below that sibling. A blue bar shows where it will go. Actions stay above conditions, so a cause is reordered among causes of its own kind.

**Esc** cancels a drag. The primary effect cannot be dragged.

Without the mouse: **Alt+M** (or **Move to another effect** in the Properties panel) asks for the new effect, the way **Link cause** does; **Alt+↑** and **Alt+↓** move a cause above or below its neighbour.

For a shared cause, moving changes only the link it is drawn along (the solid one); its dashed links stay.

### Move up or down by hand

To tidy the chart, for printing for example, **Shift+drag** a cause up or down, or press **Shift+↑** and **Shift+↓** (10 units a press). It moves with its own causes; its effect stays where it is.

- It moves up only into free space, as far as its effect can stay put; a cause right below another has no room above it.
- Moving down, it pushes the causes below it down too.
- While dragging, it snaps back to its place, and level with its effect, so the connector runs straight. **Esc** cancels.

The Properties panel shows how far a cause was moved, with **Put it back**; with nothing selected, **Put back N nodes moved by hand** resets them all. Moving a cause to another effect, or reordering it, puts it back too. A hand move is an edit: an undo step, saved in the file, and used by exports and the printed report.

## Copy and paste branches

**Ctrl+C** (on a Mac, **Cmd+C**) copies the selected node with every cause under it: titles, types, statuses, evidence, tests, stop points, notes, and the links among them. **Ctrl+V** adds the copy as a cause of the selected node, with new ids, in one undo step; the pasted node is then selected. **Ctrl+X** copies and then deletes, as **Delete** does. The Properties panel has **Copy branch** and **Paste as cause** too.

- The copy goes to the system clipboard, so it pastes into another tab or another RCA. There, the evidence it cited is left out, since that RCA has its own evidence log; the status line says how many citations were left out.
- Pasted into another program, it is a list of the titles, indented by level.
- Copying the primary effect copies the whole chart. Pasted, its top node becomes a cause without a type, for you to choose.
- In a text field, the keys copy and paste text as usual.

## Collapse branches

Click the **−** circle where a node's connector leaves it, press **Space**, or choose **Collapse branch** in the Properties panel. The node then shows **+N** for the causes it hides, and its circle turns to **+**. **Space**, the **+** circle, or **→** expands it again. With nothing selected, the Properties panel offers **Expand all branches**.

Collapsing is part of the view, not an edit: it is not an undo step and does not count as an unsaved change, but it is saved with the file. Choosing a hidden node from the issues list expands the branches that hide it.

## Link evidence

Select a cause. Its **Evidence** section lists the items it cites, each with its code, description, type, collector, and date.

- Type in **Link or add evidence**: a code (`E3`), or a word from the description or source. Matching items from the evidence log are listed; choose one with the arrow keys and **Enter**, or click it.
- To log something new, type what was seen or measured and choose **+ New**. It goes into the evidence log with the next free code and is cited by the cause. It is recorded as sensed, collected today; change its type, source, collector, and date in the evidence log.
- **×** unlinks an item. It stays in the evidence log.

The "?" marker goes away once a cause cites at least one item and is not marked unverified. Codes are never reused: after E11 is deleted, the next item is still E12. (Undoing the addition of E11 does free the code.) On the chart, codes show as pills under the title; when they do not fit, the last pill counts the rest (`+3`).

## 5 Whys

**5 Whys** in the left column. A chain starts from a node of the chart (the primary effect, unless you choose another under **Starts from**) and asks why it happened; each answer is asked why in turn, until you reach a cause you can act on. Five is a guide, not a rule.

- **+ New chain** starts a chain; **+ Why** adds a step. In an answer, **Enter** goes to the next why (adding one after the last) and **Shift+Enter** starts a new line.
- Each step has its type (action or condition) and the evidence it cites, as on the chart. The last step is marked "root cause so far".
- **Add to chart** makes the step a cause of the step before it, or of the chain's starting node for the first step; **Add all to chart** adds every step not yet on it, in order. A step on the chart is that node: editing its words, type, or evidence in either place changes both. On the chart it then gains the other causes it needs, such as the condition beside an action.
- **×** removes a step from the chain; its node stays on the chart. Deleting the node keeps the step, with its words, off the chart.

The printed report lists every chain after the chart.

## Fishbone

**Fishbone** in the left column: an Ishikawa diagram of the possible causes of an effect, sorted into categories so that no area is forgotten. The effect is the head, on the right; each category is a bone; each possible cause is a line on its bone, and its sub-causes hang from it. Then each possible cause is tested: added to the chart, where it needs evidence, or ruled out.

- **+ New diagram** starts one from the primary effect (choose another under **Effect**), with the categories chosen beside it: **Seal failure** (seal and materials, installation, operation, process fluid, support system, pump and equipment), **6M** (people, method, machine, material, measurement, environment), or four blank ones. Rename, add, and remove categories as you need.
- **+ Cause** adds a possible cause to a category, and **+ Sub-cause** a cause of that cause. In a cause, **Enter** adds the next one. Each has its type (action or condition) and the evidence it cites.
- **Add to chart** makes a cause a cause of the diagram's effect, and a sub-cause a cause of its cause, once that is on the chart. **Rule out** moves it to the causes ruled out, where you write the test that ruled it out; **Restore** takes it back to test again. A cause on the chart is that node, and one ruled out is that record: editing it in either place changes both. Deleting the node or the record keeps the cause, with its words, to test again.
- The diagram follows as you type. Click a cause or a category in it to edit it; the cause being edited is lit. Under the diagram, the counts: on the chart (marked with a small box in the colour of its type), ruled out (struck through), and to test.
- **SVG** and **PNG** save the diagram as an image, in the light colours.

The printed report draws every diagram, with a table of its causes and their status.

## Sequence of events

**Sequence of events** in the left column: what happened, in order, phase by phase, drawn as a Gantt chart. Each phase is a summary bar over its events; an event that lasted is a bar from its start to its end, and a moment is a diamond. **Deviations**, the events that departed from what should have happened, are drawn in orange: they are the candidate causes.

- **+ New timeline** starts one with the phases chosen beside it: **Test run** (pre-test work, testing, post-test work, report), **Field failure** (before the event, lead-up, failure, response), or three blank ones. Rename, add, and remove phases as you need. **Leads to** is the effect the events lead to, the primary effect unless you choose another.
- **+ Event** adds an event to a phase, starting at the time of the last one. Give it a start, and an end if it lasted; within a phase, events are in time order. In an event, **Enter** adds the next one, starting where this one ended. An event without a time is listed, without a mark.
- Each event has its type (action or condition) and the evidence it cites, as on the chart. **Deviation** marks it.
- **Add to chart** makes an event a cause of the effect it leads to; **Add N deviations to chart** adds every deviation not on it yet. An event on the chart is that node: editing its words, type, or evidence in either place changes both. Deleting the node keeps the event, with its words. On the chart, move it under the right effect by dragging it or with **Alt+M**.
- Click an event or a phase in the figure to edit it. **SVG** and **PNG** save the figure as an image, in the light colours.

Times are as written, without time zones. The printed report draws every timeline, with a table of its events.

## RCA records

Choose a record in the left column; **Chart** returns to the chart. Every field saves as you type, and every change is an undo step, as on the chart. The chart keys do nothing on a record page.

| Record | Content |
|---|---|
| **Problem definition** | What (the primary effect's title: editing either changes both), when, where, and the significance for safety, environment, production/cost, and reliability. |
| **Team and dates** | RCA number, equipment/tag, seal type; event, opened, and closed dates; team members with their roles, and the lead. Team names are offered for "collected by" and "owner". |
| **Evidence log** | One row per item: code, description, type (sensed or inferred), source, collected by, date, and the nodes and ruled-out causes that cite it. **Show** goes to the chart with those nodes outlined and the rest faded; **Esc** or **Clear** ends it. Deleting a cited item asks first and removes its citations. |
| **Causes ruled out** | Possible cause, its type, the evidence or test that ruled it out, the evidence items it cites, and the status (being tested, ruled out). |
| **Solutions** | The causes each solution attacks, the four solution criteria (prevents recurrence, within our control, meets our goals, no new problems) as Yes / Partly / No with a comment, and the decision (implement, study further, reject). Clicking a chosen value again clears it. Controllable causes are marked ● in the cause picker. |
| **Action plan** | Action, solution, owner, due date, verification, status (open, in progress, done, cancelled), and the effectiveness check: its date and result. An action past its due date that is not done or cancelled is marked overdue. |

From the chart, with a cause selected:

- **Rule out** moves the cause to the causes ruled out, with its evidence, and takes it off the chart. Causes that only it supported go with it; you are asked first. A fishbone cause that was that node is then ruled out as well.
- **+ Solution for this cause** starts a solution that attacks it. The cause's solutions are listed with their decisions; click one to open it.
- Click an evidence code to outline every node that cites it.

From a solution, **+ Action** adds an action for it to the action plan.

## Issues

The **issues** button in the top bar counts rule errors and warnings. Click it for the list, errors first, then warnings, then notes; click an issue to select its node and bring it into view, or to open the record it is about.

Besides each chart style's rules, Causeway checks what good RCA practice asks for, in both styles:

| Check | Level |
|---|---|
| A cause that ends at a human error ("operator error", "did not follow the procedure"): ask why the error was possible | Warning |
| A cause ruled out without a reason: no test written and no evidence cited, on the tree or in **Causes ruled out** | Warning |
| A confirmed cause backed by only one evidence item (cause tree) | Note |
| A stop point that says a solution was found, while no solution attacks the cause | Warning |
| A controllable cause that no solution attacks yet | Note |
| A solution that attacks no cause, or one to implement with no action in the plan | Warning |
| An action with no effectiveness check date (a warning once the action is done) | Note |
| An effectiveness check whose date has passed without a result | Warning |

Rejected solutions and cancelled actions are not checked. Notes are listed but not counted.

## Keyboard

With a node selected and no field focused:

| Key | Result |
|---|---|
| Type | Replace the title: the first key starts the new one. **Enter** finishes it, back to the chart's keys; **Shift+Enter** starts a new line |
| **Insert** or **Alt+A** | Add an action cause; in a cause tree, a cause |
| **Shift+Insert** or **Alt+C** | Add a condition cause (Apollo) |
| **Alt+1** **Alt+2** **Alt+3** | Cause tree: set the status to hypothesis, confirmed, or ruled out |
| **F2** or **Enter** | Edit the title, keeping it |
| **←** | Select the effect |
| **→** | Select a cause; on a collapsed node, expand it |
| **↑ ↓** | Select the node above or below in the same column |
| **Alt+M** | Move the cause under another effect |
| **Alt+↑ Alt+↓** | Move the cause above or below its neighbour |
| **Shift+↑ Shift+↓** | Move the cause up or down by hand, with its branch |
| **Ctrl+C** **Ctrl+X** **Ctrl+V** | Copy or cut the node with its causes; paste the copy as a cause of the selected node |
| **Alt+L** | Link an existing node as a further cause |
| **Space** | Collapse or expand the branch |
| **Esc** | Cancel linking, moving, or a drag; or clear the selection. In the title: undo what was typed since it was focused |
| **Delete** | Delete the selected cause |

With nothing selected, an arrow key selects the primary effect. Alt+A and Alt+C are there for laptops without an Insert key. The commands that are letters or digits take Alt so that typing always goes to the title; on a Mac, Alt is Option.

All causes under one effect are joined by AND: each was needed. Every effect needs at least one action and at least one condition.

**Delete** removes the selected cause. Causes that supported only that cause go with it; you are asked first. A cause that also supports another effect stays. The primary effect cannot be deleted.

Drag the empty canvas to pan, use the wheel to zoom, and **Fit** to see the whole chart.

## Export and print

| Control | Result |
|---|---|
| **Export ▾ → Chart as SVG** | The chart as one self-contained SVG file: colours are attributes, with no stylesheet, font, or image to fetch. It opens in browsers, Inkscape, and Office, and can be edited further. |
| **Export ▾ → Chart as PNG** | The chart as an image at twice screen resolution (less for very large charts, which browsers limit). |
| **Print report** or **Ctrl/Cmd+P** | The RCA report, on landscape pages: cover (RCA number, equipment, seal type, lead and team, dates), problem definition, chart and open rule issues, 5 Whys, fishbone diagrams, sequences of events, evidence log, causes ruled out, solutions with the four criteria, and the action plan. Choose **Save as PDF** as the printer for a PDF. |

Exports and the report always show the **whole chart**, with every branch expanded, in the light colours, whatever the screen shows. On the report, a chart that fits one page at 55 % or more is scaled to fit; a larger one is split into page-sized parts, numbered by row and column, with the cuts between columns so no box is split across.

## Theme

The theme button in the top bar switches between **System** (follows the operating system), **Light**, and **Dark**. The choice is kept in this browser; it is not part of the RCA file.

## Files

| Control | Result |
|---|---|
| **Save** | Saves the RCA as JSON. In Chrome and Edge you pick a file once, and later saves write to it; Firefox downloads a copy each time. **Ctrl/Cmd+S** |
| **Save as** | Saves under a new name. **Ctrl/Cmd+Shift+S** |
| **Open** | Opens a saved RCA, or imports an XMind mind map (`.xmind`) |
| **New** | Starts an empty RCA, in the chart style you choose |
| **Load example** | Replaces the current RCA with the P-101A example |

You are asked before unsaved changes are lost, and the browser warns when you close the tab with unsaved changes.

An XMind mind map (XMind 8, or XMind 2020 and later) opens as a new cause tree, from its first sheet. The central topic becomes the primary effect, every attached topic a possible cause under its parent topic, and topic notes the cause's notes. A topic "Evidence: …" without subtopics becomes an evidence item, cited by its parent. Floating topics, relationships, markers, and colours are left out. The import is unsaved: **Save** writes a new Causeway file and leaves the map as it was.

The RCA is also kept in browser storage after every edit, as crash recovery. Reopening the page brings it back, and the status line says so when it had unsaved changes. Browser storage belongs to one browser and can be cleared; the saved JSON file is the record.

## Undo and redo

**Undo** and **Redo** in the toolbar, **Ctrl/Cmd+Z**, and **Ctrl+Y** or **Ctrl/Cmd+Shift+Z**. The last 100 edits are kept for the session; consecutive typing in one field is one step. Pan, zoom, and selection are not edits.

## File format

The file is JSON with `"type": "causeway"` and `"schemaVersion": 1`. Files saved before the tool was named Causeway (`"type": "apollo-rca"`) open as well, and are saved with the new type. Every entity has a UUID that never changes, so the files can be imported into another system without renumbering.

| Key | Content |
|---|---|
| `id` | The RCA's UUID |
| `meta` | `rcaNumber`, `equipmentTag`, `sealType`, `style`: `apollo` \| `tree` (files without it are Apollo), `leadId` (a team member's id), `team` [{`id`, `name`, `role`}], `dates` {`opened`, `eventDate`, `closed`} |
| `problem` | `primaryEffectId`, `when`, `where`, `significance` {`safety`, `environment`, `productionCost`, `reliability`}. The "what" is the primary effect node's title. |
| `nodes` | {`id`, `kind`: `effect` \| `action` \| `condition` \| `cause` (no type yet: made in a cause tree), `title`, `description`, `evidenceIds`, `status`: `possible` (a hypothesis) \| `confirmed` \| `ruled-out` (used in a cause tree), `test` (how it is tested), `unverified`, `controllable`, `stopPoint`: null or {`reason`, `note`}, `notes`, `offsetY`: how far it is moved down by hand (negative: up) from where the layout places it, in chart units (pixels at 100 %)} |
| `links` | {`id`, `effectId`, `causeId`}: the cause supports the effect. Links form a directed acyclic graph rooted at the primary effect. |
| `evidence` | {`id`, `code` (`E1`, `E2`, …, never renumbered), `description`, `type`: `sensed` \| `inferred`, `source`, `collectedBy`, `date`} |
| `ruledOut` | {`id`, `cause`, `kind`: `action` \| `condition` \| `""`, `test`, `evidenceIds`, `status`: `testing` \| `ruled-out`} |
| `solutions` | {`id`, `title`, `causeIds`, `criteria` {`preventsRecurrence`, `withinControl`, `meetsGoals`, `noNewProblems`: {`v`: `yes` \| `no` \| `partly`, `c`: comment}}, `decision`: `implement` \| `reject` \| `study` \| `""` (not decided)}; criterion `v` may be `""` too |
| `fiveWhys` | {`id`, `effectId` (the node the chain starts from), `steps` [{`id`, `answer`, `kind`: `action` \| `condition`, `evidenceIds`, `nodeId`: the node on the chart, or null}]}. While a step is on the chart, its node's title, kind, and evidence are its own. |
| `fishbones` | {`id`, `effectId` (the head), `categories` [{`id`, `name`, `causes` [{`id`, `text`, `kind`: `action` \| `condition`, `evidenceIds`, `nodeId`: the node on the chart, or null, `ruledOutId`: the ruled-out record, or null, `parentId`: the cause it is a sub-cause of, or null}]}]}. While a cause is on the chart or ruled out, the node's or the record's words, kind, and evidence are its own. |
| `timelines` | {`id`, `effectId` (the effect the events lead to), `phases` [{`id`, `name`, `events` [{`id`, `text`, `start`, `end`: `YYYY-MM-DDTHH:MM` or `""`, `kind`: `action` \| `condition`, `deviation`, `evidenceIds`, `nodeId`: the node on the chart, or null}]}]}. While an event is on the chart, its node's title, kind, and evidence are its own. |
| `actions` | {`id`, `action`, `solutionId`, `owner`, `due`, `verification`, `status`: `open` \| `in-progress` \| `done` \| `cancelled`, `effectiveness` {`date`, `result`}} |
| `counters` | `evidence`: the number of the next evidence code, so deleted codes are not reused. Files without it start after the highest code. |
| `view` | `collapsed`: ids of nodes whose causes are hidden |

Stop point reasons are `outside-control`, `solution-found`, `no-evidence`, and `no-value`. Dates are `YYYY-MM-DD`. Opening a file drops links to missing nodes and links that would close a loop.

## Offline

The page has no external references and uses the system fonts, and its Content Security Policy (`default-src 'none'`) makes the browser refuse any network request. It contains no third-party code.

## Project files and development

`index.html` is generated. Edit the sources and rebuild; do not edit the HTML by hand.

- `src/index.html` — the page; `src/styles.css` — the styles.
- `src/js/` — the application, concatenated in filename order into one script: `01-constants`, `02-state` (state, undo, autosave), `03-model` (links, loop check, deletion, rule checks), `04-layout` (automatic layout and connector routing), `05-render`, `06-inspector` (Properties panel, evidence search), `07-issues` (issues list), `08-actions` (edits), `09-interactions` (pointer, pan, zoom, keys, arrow navigation), `10-io` (open, save, file checks), `11-records` (the 5 Whys, fishbone, sequence of events, and record pages), `12-fishbone` (fishbone layout and drawing), `13-timeline` (the sequence of events figure), `14-output` (SVG and PNG export, the printed report, themes), `15-example`, `16-main` (startup).
- `media/favicon.svg` — the tab icon.
- `scripts/build.py` — builds `index.html`; standard library only. It refuses to build if the page references a remote resource.
- `scripts/test-app.py` — Firefox regression tests; standard library only.

```
python3 scripts/build.py      # after editing src/ or media/
python3 scripts/test-app.py   # needs Firefox
```

The tests start a separate headless Firefox with a temporary profile. They check the script's syntax, then cover the example and its rule warnings, the layout (no overlaps, causes right of effects), adding, naming, and deleting causes, the Insert, A, C, and Delete keys, searching, linking, and adding evidence, arrow keys, the issues list and its good-practice checks, AND junctions, linking shared causes with loop refusal, moving and reordering by drag and by keys, moving up and down by hand, copying, cutting, and pasting branches (also into another RCA, and refusing bad clipboard data), unlinking, collapsing and expanding, the 5 Whys and adding its steps to the chart, the cause tree (statuses, ruling out on the tree, switching to Apollo and back with what each style still needs), the fishbone (editing from the diagram, sub-causes, adding to the chart, ruling out and restoring, and what happens when the node or record goes) and its SVG export, the sequence of events (phases, events in time order, deviations to the chart, what happens when the node or evidence goes, export, report, and file checks), each record page and its links to the chart (evidence numbering and highlighting, rule out, solutions and actions from causes), undo of record edits, SVG and PNG export, the printed report (also printed to PDF through Firefox), themes, undo and redo, the save and open round trip, importing XMind maps, shared causes and loop protection in opened files, refused files, cleared fishbone references, files and browser storage from the earlier name, autosave recovery, unavailable storage, and that no network request is made.
