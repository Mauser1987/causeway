# Build: Apollo RCA Cause-and-Effect Chart Builder (standalone, offline)

## Who this is for

I work at a mechanical seal supplier with an in-house dynamic seal testing lab. We run root cause analyses (RCAs) on seal failures using the **Apollo RCA method** (Dean Gano). I want a free, standalone tool to build Apollo cause-and-effect charts and the surrounding RCA records. No SaaS, no paid tools, no accounts.

## Hard constraints

1. **One self-contained HTML file** (`apollo-rca.html`) that opens by double-clicking, in current Chrome, Edge and Firefox.
2. **Fully offline.** No CDN links, no web fonts, no network requests of any kind at runtime.
3. Third-party libraries are allowed only if they are permissively licensed (MIT, BSD, Apache, EPL) and **inlined** into the HTML. Record each library's name, version and license in a comment at the top of the file. Prefer writing our own code when the library would be large relative to the value it adds.
4. A small build script (e.g. `build.py` or `build.mjs`) that inlines vendored sources into the final HTML is fine. The *output* must have zero external dependencies.
5. If there is an existing tool of mine in this repo (for example the P&ID builder), **read it first and follow its conventions**: file structure, code style, UI look and feel, save/load pattern, undo/redo approach. Consistency across my tools matters more than novelty. If no such tool is present, ask me before inventing conventions.

## Apollo method rules the tool must understand

- The chart reads **left to right**: the **primary effect** sits on the left, and its causes are to the right.
- Every cause is itself an effect and can have its own causes. The chain continues until a stop point.
- Cause types:
  - **Action**: a momentary cause that happened at a point in time (e.g. "filter bypass opened").
  - **Condition**: a cause that existed over time (e.g. "no strainer upstream of orifice").
- **Every effect needs at least one action AND at least one condition.** There is no upper limit: 2 actions + 1 condition, 1 action + 3 conditions, and so on are all valid.
- All causes under one effect are joined by **AND**: they were all needed together.
- **OR** (alternative explanations) is handled as *candidate* causes: they are drawn, marked **"?"** (unverified), and resolved by evidence. A rejected candidate moves to a "causes ruled out" list together with the evidence that ruled it out.
- **Every cause must be backed by evidence.** A cause without evidence shows a "?" marker.
- **Shared causes:** one cause can support more than one effect. The chart is therefore a **directed acyclic graph (DAG)**, not a strict tree. Prevent cycles.
- **Stop points:** a branch ends when the cause is outside our control, when an effective solution has been found, when there is no further evidence, or when going further adds nothing. Let the user mark a node as a stop point and pick the reason.
- **"Controllable"** is our own tag (not formal Apollo). It marks causes the organisation can change; those are the candidates for solutions.
- Solutions can be attached to **any** cause.

## Features (MVP)

### Chart editor
- Node types: primary effect (exactly one per RCA), action, condition. Each type is visually distinct: effect in red, action in dark teal with white text, condition in light fill with a border.
- Per node: short title (required), description, evidence references (IDs from the evidence log), flags (`unverified` "?", `controllable`, `stopPoint` + reason), and optional notes.
- **Automatic layout**, left to right, with no manual dragging needed. Recompute on every change. The layout must handle shared causes (DAG) cleanly and keep edges readable, using orthogonal connectors if feasible. Manual nudging is optional and can come later.
- **Keyboard-driven editing** on the selected node:
  - `A`: add an action cause
  - `C`: add a condition cause
  - `Enter`/`F2`: edit title inline
  - `Delete`: delete the node (ask for confirmation if it has children)
  - arrow keys: move selection through the graph
  - `Ctrl+Z` / `Ctrl+Y`: undo / redo
- Link an existing node as an additional cause of another effect (this is how shared causes are created).
- Collapse/expand branches, zoom and pan, and fit to screen.
- Side inspector panel for the selected node's fields.

### Rule checks (live, non-blocking)
- Highlight any effect that lacks at least one action or at least one condition.
- Show "?" on causes with no evidence linked.
- Show a summary count of open issues, which can be clicked to jump to each one.

### RCA records (tabs or panels alongside the chart)
1. **Problem definition:** what, when, where, plus significance (safety, environment, production/cost, reliability). The "what" text is the primary effect node's title, kept in sync.
2. **RCA metadata:** RCA number, equipment/tag, seal type, team members and roles, lead, dates.
3. **Evidence log:** ID (auto `E1`, `E2`, …), description, type (sensed / inferred), source/location, collected by, date. Clicking an evidence item highlights the nodes that cite it.
4. **Causes ruled out:** possible cause, evidence/test, evidence IDs, status.
5. **Solutions:** linked to one or more cause nodes, evaluated against the four Apollo criteria (prevents recurrence? within our control? meets our goals? no new problems?), each Yes / No / Partly + comment, plus a decision (implement / reject / study further).
6. **Action plan:** action, linked solution, owner, due date, verification method, status, plus an effectiveness-check row (date and result).

### Files and output
- **Save / Open** the whole RCA as a `.json` file, using the File System Access API where available with a download/upload fallback. Include `schemaVersion` and use stable UUIDs for all entities so a future backend (our Django testlab app) can import the files without rework.
- **Autosave** to `localStorage` as crash recovery only. Wrap all storage access in try/catch, and make the app work if storage is unavailable.
- **Export the chart** as SVG and PNG. The SVG must be self-contained, with no external CSS.
- **Print / PDF report** via a print stylesheet: cover block (metadata), problem definition, chart (scaled to fit or split across pages), evidence log, ruled-out causes, solutions, action plan.
- **Load example** button that loads the built-in worked example below.

### General UI
- Clean, technical look. Light and dark themes.
- Works with mouse and keyboard. No touch requirement.
- Confirm before destructive actions. Warn about unsaved changes on close.

## Built-in worked example (use as test data)

High leakage on a single cartridge seal, pump P-101A, API Plan 11 flush, OH2 pump.

- **Primary effect:** High seal leakage, 15 ml/min (limit under 1 ml/min).
  - Action: Leak path opened across primary faces. Condition: Seal chamber pressurised with process fluid.
- **Leak path opened**
  - Action: Faces damaged (heat checking on SiC, chipping on carbon). Condition: Seal relies on a stable liquid film.
- **Faces damaged**
  - Action: Fluid film flashed to vapour (intermittent dry running). Condition: Carbon/SiC pair has limited dry-run tolerance.
- **Film flashed**
  - Action: Seal chamber temperature rose 18 °C. Condition: Product close to its vapour pressure.
- **Product close to vapour pressure**
  - Condition: Seal selected without checking vapour-pressure margin. Tagged controllable.
- **Temperature rose**
  - Action: Plan 11 flush flow dropped to near zero. Condition: Heat input from face friction and pump.
- **Flush flow dropped**
  - Action: Solids entered the flush line. Condition: 3 mm orifice, no strainer or cyclone. Tagged controllable.
- **Solids entered**
  - Action: Filter bypass opened during process upset. Tagged controllable.
  - Condition: No seal-system check after upset or bypass. Tagged controllable.

**Ruled out:** misalignment, vibration, installation error, elastomer attack, and face manufacturing defect (closed by a lab dynamic test on a spare from the same batch).

**Solutions:**
- Cyclone (Plan 11+31): implement.
- Upset procedure check: implement.
- Vapour-pressure margin step in seal selection: implement.
- Temperature alarm: secondary barrier.
- SiC/SiC faces: reject.
- Bigger orifice: study first.
- "Train operators": reject.

Invent plausible evidence entries (E1…E10) and link them to the nodes.

## Working process

1. **Read first:** look for my existing tools in the repo and summarise the conventions you will follow.
2. **Propose a plan** before coding: data model (JSON schema), layout approach (own algorithm vs. inlined library, with size and licence), file structure, and milestones. Wait for my OK.
3. Build in milestones. After each one, tell me what to test:
   - M1: data model, chart rendering with auto layout, add/edit/delete nodes, save/open JSON, example data.
   - M2: keyboard editing, undo/redo, rule checks, inspector panel, shared causes, collapse, zoom/pan.
   - M3: RCA record panels (problem definition, evidence, ruled out, solutions, action plan) and their links to nodes.
   - M4: SVG/PNG export, print/PDF report, themes, autosave/recovery, polish.
4. **Verify each milestone yourself** before handing it over:
   - Syntax check the script.
   - Run an automated smoke test (e.g. Playwright or jsdom) that loads the example, adds/deletes nodes, checks the rule warnings, round-trips JSON save/open, and exports SVG.
   - Confirm that no network requests occur.
5. Keep a short `CHANGELOG.md` and a `README.md` (what it is, how to use it, keyboard shortcuts, file format).
6. Ask me when a decision is genuinely mine. Don't guess on UX conventions that conflict with my existing tools.

## Out of scope for now
Multi-user editing, a server/backend, user accounts, integrations. Keep the data model ready for these, but don't build them.
