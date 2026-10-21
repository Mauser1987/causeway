#!/usr/bin/env python3
"""Browser regression tests, run through Firefox using Marionette; no Python dependencies.

Checks the script's syntax, then loads apollo-rca.html and covers the example, the layout,
editing the chart with the mouse and keyboard, rule checks, shared causes, collapsing, the RCA
record pages, undo and redo, opening and saving files, export, the printed report, themes,
autosave, and that the page makes no network requests.

Run directly to start a temporary headless Firefox, or pass --port to use an
existing Firefox started with --headless --marionette and a temporary profile.
"""
import argparse
import json
from pathlib import Path
import re
import shutil
import socket
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
STORAGE = 'apollo-rca-v1'


class Browser:
    def __init__(self, port):
        self.socket = socket.create_connection(('127.0.0.1', port), timeout=10)
        self.sequence = 0
        self.read()

    def read(self):
        prefix = b''
        while not prefix.endswith(b':'):
            chunk = self.socket.recv(1)
            if not chunk:
                raise RuntimeError('Browser connection closed')
            prefix += chunk
        length = int(prefix[:-1])
        data = b''
        while len(data) < length:
            chunk = self.socket.recv(length - len(data))
            if not chunk:
                raise RuntimeError('Browser connection closed')
            data += chunk
        return json.loads(data)

    def call(self, name, args=None):
        self.sequence += 1
        data = json.dumps([0, self.sequence, name, args or {}]).encode()
        self.socket.sendall(str(len(data)).encode() + b':' + data)
        result = self.read()
        if result[2]:
            raise RuntimeError(result[2])
        return result[3]

    def js(self, script, args=None):
        return self.call('WebDriver:ExecuteScript', {
            'script': script, 'args': args or [], 'newSandbox': False,
        })['value']

    def async_js(self, script, args=None):
        return self.call('WebDriver:ExecuteAsyncScript', {
            'script': script, 'args': args or [],
        })['value']


def check_syntax(b):
    """Parses the built script without running it. Done on a blank page, outside the app's CSP."""
    html = (ROOT / 'apollo-rca.html').read_text(encoding='utf-8')
    source = re.search(r'<script>\n(.*)</script>', html, re.S).group(1)
    b.call('WebDriver:Navigate', {'url': 'about:blank'})
    error = b.js('try{new Function(arguments[0]);return null}catch(e){return e.name+": "+e.message+" (line "+e.lineNumber+")"}', [source])
    assert error is None, 'Syntax error in the built script: ' + error
    print('PASS: script syntax', flush=True)


def run_tests(b):
    url = (ROOT / 'apollo-rca.html').as_uri()

    def open_app(clear=False):
        b.call('WebDriver:Navigate', {'url': url})
        if clear:
            b.js('localStorage.clear();return true')
            b.call('WebDriver:Navigate', {'url': url})
        # Dialogs answer yes and are recorded; violations of the page's CSP are recorded too.
        b.js('''window.__dialogs=[];window.confirm=m=>{__dialogs.push(m);return true};window.alert=m=>{__dialogs.push(m)};
            window.__violations=[];document.addEventListener('securitypolicyviolation',e=>__violations.push(e.blockedURI));
            window.__downloads=[];const create=URL.createObjectURL;URL.createObjectURL=blob=>{__downloads.push(blob);return create(blob)};
            HTMLAnchorElement.prototype.click=function(){};return true''')

    def saved():
        return b.js(f"return JSON.parse(localStorage.getItem('{STORAGE}'))")

    def rca():
        return saved()['rca']

    def click(element_id):
        b.js('document.getElementById(arguments[0]).click();return true', [element_id])

    def node_id(title):
        found = [n['id'] for n in rca()['nodes'] if n['title'] == title]
        assert found, 'no node titled ' + title
        return found[0]

    def select(title):
        b.js('''const n=document.querySelector(`#chart .node[data-id="${arguments[0]}"] rect:not([fill=none])`),r=n.getBoundingClientRect();
            n.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:r.x+5,clientY:r.y+5}));return true''', [node_id(title)])

    def type_into(field, value):
        b.js('const i=document.getElementById(arguments[0]);i.focus();i.value=arguments[1];i.dispatchEvent(new Event("input",{bubbles:true}));return true', [field, value])

    def boxes():
        return b.js('''return [...document.querySelectorAll('#chart .node')].map(g=>{const t=g.transform.baseVal[0].matrix,r=g.querySelector('rect:not([fill=none])');
            return {id:g.dataset.id,x:t.e,y:t.f,w:+r.getAttribute('width'),h:+r.getAttribute('height')}})''')

    def issue_outlines():
        return b.js("return document.querySelectorAll('#chart rect[stroke-dasharray]').length")

    def question_marks():
        return b.js("return [...document.querySelectorAll('#chart text')].filter(t=>t.textContent==='?').length")

    open_app(clear=True)
    assert b.js("return document.querySelectorAll('#chart .node').length") == 1, 'a new RCA shows the primary effect'
    assert b.js("return document.getElementById('undo').disabled&&document.getElementById('redo').disabled")
    print('PASS: starts with an empty RCA', flush=True)

    # ---- Example ----
    click('loadExample')
    data = rca()
    assert len(data['nodes']) == 16 and len(data['links']) == 15 and len(data['evidence']) == 10
    assert [e['code'] for e in data['evidence']] == [f'E{i}' for i in range(1, 11)]
    assert len(data['ruledOut']) == 5 and len(data['solutions']) == 7 and len(data['actions']) == 4
    assert data['schemaVersion'] == 1 and data['type'] == 'apollo-rca'
    uuid = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
    every_id = [x['id'] for key in ('nodes', 'links', 'evidence', 'ruledOut', 'solutions', 'actions') for x in data[key]] + [data['id']]
    assert all(uuid.match(i) for i in every_id) and len(set(every_id)) == len(every_id), 'every entity has its own UUID'
    assert len(boxes()) == 16
    # "Product close to its vapour pressure" has a condition but no action.
    assert issue_outlines() == 1, 'one effect lacks an action'
    assert question_marks() == 2, 'two causes without evidence'
    print('PASS: example loads with its rule warnings', flush=True)

    # ---- Layout ----
    def check_layout():
        placed = {x['id']: x for x in boxes()}
        for one in placed.values():
            for other in placed.values():
                if one['id'] < other['id']:
                    apart = (one['x'] + one['w'] <= other['x'] or other['x'] + other['w'] <= one['x']
                             or one['y'] + one['h'] <= other['y'] or other['y'] + other['h'] <= one['y'])
                    assert apart, 'nodes overlap'
        for link in rca()['links']:
            if link['effectId'] in placed and link['causeId'] in placed:
                assert placed[link['effectId']]['x'] + placed[link['effectId']]['w'] < placed[link['causeId']]['x'], 'causes are right of their effects'
        return placed
    placed = check_layout()
    primary = rca()['problem']['primaryEffectId']
    assert min(x['x'] for x in placed.values()) == placed[primary]['x'], 'the primary effect is leftmost'
    print('PASS: layout reads left to right without overlaps', flush=True)

    # ---- Adding and editing causes ----
    select('Heat input from face friction and pump')
    assert b.js("return document.getElementById('nodeTitle').value") == 'Heat input from face friction and pump'
    click('addAction')
    assert len(rca()['nodes']) == 17
    assert b.js("return document.activeElement.id") == 'nodeTitle', 'the new cause is ready to be named'
    type_into('nodeTitle', 'Pump ran at minimum flow')
    type_into('nodeTitle', 'Pump ran at minimum flow for 3 h')
    new = node_id('Pump ran at minimum flow for 3 h')
    heat = node_id('Heat input from face friction and pump')
    assert {'effectId': heat, 'causeId': new} == {k: v for k, v in next(l for l in rca()['links'] if l['causeId'] == new).items() if k != 'id'}
    assert issue_outlines() == 2, 'heat input now needs a condition as well'
    check_layout()
    print('PASS: add an action cause and name it', flush=True)

    before = rca()
    click('undo')
    assert len(rca()['nodes']) == 17 and rca()['nodes'][-1]['title'] == 'New action', 'typing in one field is one undo step'
    click('undo')
    assert len(rca()['nodes']) == 16
    click('redo'); click('redo')
    assert rca() == before
    print('PASS: undo and redo', flush=True)

    # ---- Keyboard ----
    def key(name, shift=False):
        b.js('document.activeElement.blur();window.dispatchEvent(new KeyboardEvent("keydown",{key:arguments[0],shiftKey:arguments[1],bubbles:true}));return true', [name, shift])

    select('Heat input from face friction and pump')
    key('Insert')
    assert rca()['nodes'][-1]['kind'] == 'action' and b.js("return document.activeElement.id") == 'nodeTitle', 'Insert adds an action'
    select('Heat input from face friction and pump')
    key('Insert', shift=True)
    assert rca()['nodes'][-1]['kind'] == 'condition', 'Shift+Insert adds a condition'
    select('Heat input from face friction and pump')
    key('c')
    assert rca()['nodes'][-1]['kind'] == 'condition' and len(rca()['nodes']) == 20
    key('Delete')
    assert len(rca()['nodes']) == 19, 'Delete removes the selected cause'
    click('undo'); click('undo'); click('undo'); click('undo')
    assert rca() == before
    print('PASS: Insert, Shift+Insert, C and Delete keys', flush=True)

    # ---- Evidence ----
    def search(text):
        type_into('evidenceSearch', text)
        return b.js("return [...document.querySelectorAll('#evidenceOptions li')].map(li=>li.textContent)")

    def search_key(name):
        b.js('document.getElementById("evidenceSearch").dispatchEvent(new KeyboardEvent("keydown",{key:arguments[0],bubbles:true}));return true', [name])

    def cited(title):
        return next(n for n in rca()['nodes'] if n['title'] == title)['evidenceIds']

    heat_title = 'Heat input from face friction and pump'
    select(heat_title)
    before_ev = rca()
    e3 = next(e['id'] for e in rca()['evidence'] if e['code'] == 'E3')
    options = search('e3')
    assert options[0].startswith('E3') and not any('New' in o for o in options), 'a code finds its item, without offering a new one'
    search_key('Enter')
    assert e3 in cited(heat_title), 'Enter links the item'
    assert b.js("return document.activeElement.id") == 'evidenceSearch', 'the search box keeps the focus for the next item'
    assert not any(o.startswith('E3') for o in search('DCS')), 'linked items are not offered again'
    options = search('Motor current 8 % above the curve')
    assert options[-1].startswith('+ New') and 'E11' in options[-1]
    b.js("const li=[...document.querySelectorAll('#evidenceOptions li')].at(-1);li.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}));return true")
    added = rca()['evidence'][-1]
    assert added['code'] == 'E11' and added['description'] == 'Motor current 8 % above the curve'
    assert added['id'] in cited(heat_title), 'new evidence is logged and linked'
    assert b.js("return [...document.querySelectorAll('#chart text')].some(t=>t.textContent==='E11')"), 'the chart shows the new code'
    b.js('document.querySelector(`[data-unlink="${arguments[0]}"]`).click();return true', [e3])
    assert e3 not in cited(heat_title), 'evidence unlinks'
    click('undo'); click('undo'); click('undo')
    assert rca() == before_ev
    print('PASS: search, link, add, and unlink evidence', flush=True)

    # ---- Arrow keys and the issues list ----
    def selected_title():
        return b.js("return document.getElementById('nodeTitle')?.value ?? null")

    select('Seal chamber temperature rose 18 °C')
    key('ArrowLeft')
    assert selected_title() == 'Fluid film flashed to vapour (intermittent dry running)', 'left goes to the effect'
    key('ArrowRight')
    assert selected_title() == 'Seal chamber temperature rose 18 °C', 'right goes to a cause'
    key('ArrowDown')
    assert selected_title() == 'Product close to its vapour pressure', 'down goes to the next node in the column'
    key('ArrowUp')
    assert selected_title() == 'Seal chamber temperature rose 18 °C'

    # Two effects lack a cause type (errors), three causes lack evidence (warnings).
    assert b.js("return document.getElementById('issuesCount').textContent") == '5 issues'
    click('issuesButton')
    items = b.js("return [...document.querySelectorAll('#issuesList [data-node]')].map(x=>x.textContent)")
    assert all('Needs' in i for i in items[:2]) and not any('Needs' in i for i in items[2:]), 'errors come first'
    b.js("[...document.querySelectorAll('#issuesList [data-node]')].find(x=>x.textContent.startsWith('Product close')).click();return true")
    assert selected_title() == 'Product close to its vapour pressure' and b.js("return document.getElementById('issuesList').hidden")
    assert b.js("return document.querySelectorAll('#chart .junction').length") > 0, 'AND junctions are drawn'
    print('PASS: arrow keys, issues list, AND junctions', flush=True)

    # ---- Shared causes: linking an existing node ----
    def banner_shown():
        return not b.js("return document.getElementById('linkBanner').hidden")

    def has_link(effect, cause):
        return any(l['effectId'] == node_id(effect) and l['causeId'] == node_id(cause) for l in rca()['links'])

    film, orifice = 'Fluid film flashed to vapour (intermittent dry running)', '3 mm orifice, no strainer or cyclone'
    before_link = rca()
    select(film)
    key('l')
    assert banner_shown(), 'L starts linking'
    assert b.js("return document.querySelectorAll('#chart .node[opacity]').length") > 0, 'nodes that cannot be linked are faded'
    select('Leak path opened across primary faces')
    assert 'loop' in b.js("return document.getElementById('status').textContent") and banner_shown(), 'a loop is refused'
    assert rca()['links'] == before_link['links']
    select(orifice)
    assert has_link(film, orifice) and not banner_shown(), 'clicking a node links it'
    assert b.js("return document.querySelectorAll('#chart path[stroke-dasharray]').length") == 1, 'the further link is dashed'
    check_layout()
    select(orifice)
    assert b.js("return document.querySelectorAll('[data-unlink-effect]').length") == 2, 'a shared cause lists both effects'
    b.js('document.querySelector(`[data-unlink-effect="${arguments[0]}"]`).click();return true', [node_id(film)])
    assert not has_link(film, orifice) and b.js("return document.querySelectorAll('[data-unlink-effect]').length") == 0, 'unlinking keeps the last effect'
    click('undo')
    assert has_link(film, orifice)
    click('undo')
    assert rca() == before_link
    select(film)
    click('linkCause')
    key('Escape')
    assert not banner_shown() and rca() == before_link, 'Escape cancels linking'
    print('PASS: link an existing node as a shared cause, unlink, cancel', flush=True)

    # ---- Collapse and expand ----
    plan = 'Plan 11 flush flow dropped to near zero'
    shown = len(boxes())
    select(plan)
    key(' ')
    assert len(boxes()) == shown - 4, 'Space collapses the branch'
    assert b.js("return [...document.querySelectorAll('#chart text')].some(t=>t.textContent==='+4')"), 'the collapsed node counts its hidden causes'
    assert rca()['view']['collapsed'] == [node_id(plan)], 'collapsing is saved with the RCA'
    assert b.js('return document.getElementById("undo").disabled') is False and rca()['nodes'] == before_link['nodes']
    key('ArrowRight')
    assert len(boxes()) == shown, 'right expands a collapsed node'
    b.js('''const t=document.querySelector(`#chart .node[data-id="${arguments[0]}"] .toggle circle`);
        t.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}));return true''', [node_id(plan)])
    assert len(boxes()) == shown - 4, 'the toggle on the chart collapses'
    select(film)
    key(' ')
    click('issuesButton')
    b.js("[...document.querySelectorAll('#issuesList [data-node]')].find(x=>x.textContent.startsWith('Product close')).click();return true")
    assert selected_title() == 'Product close to its vapour pressure', 'choosing a hidden issue expands its branch'
    b.js("document.getElementById('chart').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:5,clientY:5}));document.getElementById('chart').dispatchEvent(new PointerEvent('pointerup',{bubbles:true,button:0,clientX:5,clientY:5}));return true")
    click('expandAll')
    assert len(boxes()) == len(rca()['nodes']) and rca() == before_link
    print('PASS: collapse and expand branches', flush=True)

    # ---- Deleting ----
    solutions_before = sum(len(s['causeIds']) for s in rca()['solutions'])
    select('Plan 11 flush flow dropped to near zero')
    b.js('__dialogs.length=0;return true')
    click('deleteNode')
    assert len(b.js('return __dialogs')) == 1 and '4 causes' in b.js('return __dialogs[0]'), 'asks before deleting a branch'
    assert len(rca()['nodes']) == 12
    titles = {n['title'] for n in rca()['nodes']}
    assert not titles & {'Solids entered the flush line', '3 mm orifice, no strainer or cyclone', 'Filter bypass opened during process upset'}
    assert sum(len(s['causeIds']) for s in rca()['solutions']) == solutions_before - 5, 'solutions lose the deleted causes'
    click('undo')
    assert rca() == before
    select('Pump ran at minimum flow for 3 h')
    b.js('__dialogs.length=0;return true')
    click('deleteNode')
    assert b.js('return __dialogs.length') == 0, 'a cause without causes is deleted without asking'
    assert len(rca()['nodes']) == 16
    select('High seal leakage, 15 ml/min (limit under 1 ml/min)')
    assert b.js("return document.getElementById('deleteNode').disabled"), 'the primary effect cannot be deleted'
    print('PASS: delete a cause and its branch, with confirmation', flush=True)

    # ---- RCA records ----
    def page(name):
        b.js('document.querySelector(`.rail [data-record="${arguments[0]}"]`).click();return true', [name])

    def set_field(lst, row, path, value):
        b.js('''const el=document.querySelector(`#records [data-list="${arguments[0]}"]${arguments[1]?`[data-id="${arguments[1]}"]`:''}[data-field="${arguments[2]}"]`);
            el.focus();el.value=arguments[3];el.dispatchEvent(new Event("input",{bubbles:true}));return true''', [lst, row, path, value])

    def act(name, row=None, **data):
        sel = f'#records button[data-act="{name}"]' + (f'[data-id="{row}"]' if row else '') + ''.join(f'[data-{k}="{v}"]' for k, v in data.items())
        b.js('document.querySelector(arguments[0]).click();return true', [sel])

    def pick(name, row, value):
        b.js('''const el=document.querySelector(`#records select[data-act="${arguments[0]}"][data-id="${arguments[1]}"]`);
            el.value=arguments[2];el.dispatchEvent(new Event("change",{bubbles:true}));return true''', [name, row, value])

    def focused():
        return b.js("const a=document.activeElement;return a?[a.dataset.list,a.dataset.id,a.dataset.field]:null")

    before_records = rca()
    primary = rca()['problem']['primaryEffectId']

    # Problem definition: the "what" is the primary effect's title.
    page('problem')
    assert b.js("return getComputedStyle(document.getElementById('chart')).display") == 'none' or b.js("return getComputedStyle(document.querySelector('main')).display") == 'none'
    set_field('node', primary, 'title', 'High seal leakage, 16 ml/min')
    assert next(n for n in rca()['nodes'] if n['id'] == primary)['title'] == 'High seal leakage, 16 ml/min'
    assert b.js("return document.getElementById('sheetTitle').textContent") == 'High seal leakage, 16 ml/min'
    set_field('problem', None, 'significance.safety', 'Flammable leak')
    assert rca()['problem']['significance']['safety'] == 'Flammable leak'
    click('undo'); click('undo')
    assert rca() == before_records, 'record edits undo'
    print('PASS: problem definition, synced with the primary effect', flush=True)

    # Team and dates.
    page('team')
    act('add-member')
    member = rca()['meta']['team'][-1]['id']
    assert focused() == ['team', member, 'name'], 'a new member is ready to be named'
    set_field('team', member, 'name', 'A. Tester')
    b.js('document.querySelector(`#records input[data-act="lead"][data-id="${arguments[0]}"]`).click();return true', [member])
    assert rca()['meta']['leadId'] == member
    set_field('meta', None, 'dates.closed', '2026-10-30')
    assert rca()['meta']['dates']['closed'] == '2026-10-30'
    act('delete-member', member)
    assert rca()['meta']['leadId'] == '' and len(rca()['meta']['team']) == 4, 'removing the lead clears the lead'
    page('evidence')
    assert b.js("return [...document.querySelectorAll('#teamNames option')].map(o=>o.value).length") == 4, 'team names are offered'
    print('PASS: team and dates', flush=True)

    # Evidence log: codes are never reused; deleting removes citations; Show highlights on the chart.
    act('add-evidence')
    e11 = rca()['evidence'][-1]
    assert e11['code'] == 'E11' and focused() == ['evidence', e11['id'], 'description']
    set_field('evidence', e11['id'], 'type', 'inferred')
    assert rca()['evidence'][-1]['type'] == 'inferred'
    b.js('__dialogs.length=0;return true')
    act('delete-evidence', e11['id'])
    assert b.js('return __dialogs.length') == 0, 'an uncited item is deleted without asking'
    act('add-evidence')
    assert rca()['evidence'][-1]['code'] == 'E12', 'a deleted code is not reused'
    e3 = next(e['id'] for e in rca()['evidence'] if e['code'] == 'E3')
    act('delete-evidence', e3)
    assert 'cited 2 times' in b.js('return __dialogs[0]')
    assert not any(e3 in n['evidenceIds'] for n in rca()['nodes']) and not any(e['id'] == e3 for e in rca()['evidence'])
    click('undo')
    assert any(e3 in n['evidenceIds'] for n in rca()['nodes']), 'undo restores the evidence and its citations'
    e4 = next(e['id'] for e in rca()['evidence'] if e['code'] == 'E4')
    act('show-evidence', e4)
    assert b.js("return getComputedStyle(document.querySelector('main')).display") != 'none', 'Show goes to the chart'
    assert not b.js("return document.getElementById('evidenceBanner').hidden")
    lit = b.js("return document.querySelectorAll('#chart rect[stroke=\"#e0a100\"]').length")
    assert lit == 3, f'the three nodes citing E4 are outlined, got {lit}'
    assert b.js("return document.querySelectorAll('#chart .node[opacity]').length") == len(boxes()) - 3, 'the others are faded'
    key('Escape')
    assert b.js("return document.getElementById('evidenceBanner').hidden") and b.js("return document.querySelectorAll('#chart .node[opacity]').length") == 0
    select('Seal chamber temperature rose 18 °C')
    b.js("document.querySelector('#properties [data-highlight]').click();return true")
    assert not b.js("return document.getElementById('evidenceBanner').hidden"), 'a code in the Properties panel highlights too'
    key('Escape')
    print('PASS: evidence log, code numbering, deleting, and highlighting on the chart', flush=True)

    # Causes ruled out: from the chart, and edited in the list.
    heat = 'Heat input from face friction and pump'
    ruled_before = len(rca()['ruledOut'])
    select('Seal relies on a stable liquid film')
    click('inspRuleOut')
    moved = rca()['ruledOut'][-1]
    assert len(rca()['ruledOut']) == ruled_before + 1 and moved['cause'] == 'Seal relies on a stable liquid film' and moved['kind'] == 'condition'
    assert not any(n['title'] == 'Seal relies on a stable liquid film' for n in rca()['nodes']), 'the cause leaves the chart'
    click('undo')
    assert any(n['title'] == 'Seal relies on a stable liquid film' for n in rca()['nodes'])
    page('ruledOut')
    act('add-ruled')
    r = rca()['ruledOut'][-1]['id']
    set_field('ruledOut', r, 'cause', 'Wrong spring compression')
    pick('ruled-add-evidence', r, e4)
    assert rca()['ruledOut'][-1]['evidenceIds'] == [e4]
    act('ruled-remove-evidence', r, evidence=e4)
    assert rca()['ruledOut'][-1]['evidenceIds'] == []
    print('PASS: causes ruled out', flush=True)

    # Solutions: started from a cause, the four criteria, the decision, and an action from the solution.
    page('chart')
    select('Seal relies on a stable liquid film')
    click('inspAddSolution')
    sol = rca()['solutions'][-1]
    assert sol['causeIds'] == [node_id('Seal relies on a stable liquid film')] and focused() == ['solutions', sol['id'], 'title']
    set_field('solutions', sol['id'], 'title', 'Monitor film with a temperature probe')
    act('criterion', sol['id'], key='preventsRecurrence', v='partly')
    assert rca()['solutions'][-1]['criteria']['preventsRecurrence']['v'] == 'partly'
    act('criterion', sol['id'], key='preventsRecurrence', v='partly')
    assert rca()['solutions'][-1]['criteria']['preventsRecurrence']['v'] == '', 'clicking the chosen value clears it'
    set_field('solutions', sol['id'], 'criteria.meetsGoals.c', 'Cheap')
    act('decision', sol['id'], v='study')
    assert rca()['solutions'][-1]['decision'] == 'study'
    pick('solution-add-cause', sol['id'], node_id(heat))
    assert len(rca()['solutions'][-1]['causeIds']) == 2
    act('add-action-for', sol['id'])
    action = rca()['actions'][-1]
    assert action['solutionId'] == sol['id'] and focused() == ['actions', action['id'], 'action'], 'the action plan opens on the new action'
    print('PASS: solutions and their criteria', flush=True)

    # Action plan: overdue actions are marked until done.
    set_field('actions', action['id'], 'due', '2020-01-01')
    assert b.js("return document.querySelectorAll('#records td.overdue').length") == 1
    set_field('actions', action['id'], 'status', 'done')
    assert b.js("return document.querySelectorAll('#records td.overdue').length") == 0
    key('Insert')
    assert len(rca()['nodes']) == len(before_records['nodes']), 'chart keys do nothing on a record page'
    page('solutions')
    b.js('__dialogs.length=0;return true')
    act('delete-solution', sol['id'])
    assert len(b.js('return __dialogs')) == 1 and rca()['actions'][-1]['solutionId'] == '', 'deleting a solution keeps its actions'
    page('chart')
    print('PASS: action plan', flush=True)

    # Every record edit is in the undo history.
    for _ in range(60):
        if b.js('return document.getElementById("undo").disabled'):
            break
        click('undo')
        if rca() == before_records:
            break
    assert rca() == before_records, 'undo returns to the RCA before the record edits'
    print('PASS: record edits undo', flush=True)

    # ---- Files ----
    b.js('__downloads.length=0;return true')
    click('saveProject')
    text = b.async_js('const done=arguments[arguments.length-1];__downloads.at(-1).text().then(done)')
    saved_file = json.loads(text)
    assert saved_file['type'] == 'apollo-rca' and saved_file['schemaVersion'] == 1
    assert saved()['dirty'] is False, 'saving clears the unsaved-changes flag'

    def load(project):
        b.async_js('''const done=arguments[arguments.length-1],input=document.getElementById('projectFile'),dt=new DataTransfer();
            dt.items.add(new File([JSON.stringify(arguments[0])],'test.json',{type:'application/json'}));input.files=dt.files;
            input.onchange({target:input}).then(()=>done(true));''', [project])

    click('newProject')
    assert len(rca()['nodes']) == 1
    load(saved_file)
    reopened = rca()
    reopened.pop('view', None)
    expected = dict(saved_file)
    expected.pop('view', None)
    assert reopened == expected, 'a saved file opens unchanged'
    print('PASS: save and open round trip', flush=True)

    # A hand-edited file with a shared cause and a loop: the loop link is dropped, the shared cause drawn once.
    shared = json.loads(text)
    ids = {n['title']: n['id'] for n in shared['nodes']}
    shared['links'].append({'id': 'x1', 'effectId': ids['Fluid film flashed to vapour (intermittent dry running)'], 'causeId': ids['3 mm orifice, no strainer or cyclone']})
    shared['links'].append({'id': 'x2', 'effectId': ids['Solids entered the flush line'], 'causeId': ids['Plan 11 flush flow dropped to near zero']})
    load(shared)
    links = {l['id'] for l in rca()['links']}
    assert 'x1' in links and 'x2' not in links, 'the shared link is kept, the loop is dropped'
    assert len(boxes()) == 16 and b.js("return document.querySelectorAll('#chart path[stroke-dasharray]').length") == 1
    check_layout()
    print('PASS: shared causes and loop protection when opening a file', flush=True)

    b.js('__dialogs.length=0;return true')
    load({'type': 'something-else', 'nodes': []})
    assert 'not an Apollo RCA file' in b.js('return __dialogs[0]')
    load({**saved_file, 'schemaVersion': 99})
    assert 'newer' in b.js('return __dialogs[1]')
    assert len(rca()['nodes']) == 16, 'a rejected file leaves the RCA as it was'
    print('PASS: invalid files are refused', flush=True)

    # ---- Export, print, theme ----
    import base64
    nodes_total = len(rca()['nodes'])
    select('Plan 11 flush flow dropped to near zero')
    key(' ')
    assert len(boxes()) < nodes_total
    b.js('__downloads.length=0;return true')
    click('exportButton'); click('exportSvg')
    svg_text = b.async_js('const done=arguments[arguments.length-1];__downloads.at(-1).text().then(done)')
    parsed = b.js('''const d=new DOMParser().parseFromString(arguments[0],"image/svg+xml");
        return {error:!!d.querySelector("parsererror"),nodes:d.querySelectorAll(".node").length,root:d.documentElement.tagName,toggles:d.querySelectorAll(".toggle").length}''', [svg_text])
    assert parsed == {'error': False, 'nodes': nodes_total, 'root': 'svg', 'toggles': 0}, parsed
    assert not re.search(r'href|url\(|<style|https?:', svg_text.replace('xmlns="http://www.w3.org/2000/svg"', '')), 'the SVG references nothing outside itself'
    assert 'fill="#0b5f66"' in svg_text, 'colours are attributes'
    assert b.js('return document.getElementById("exportMenu").hidden')
    print('PASS: SVG export: whole chart, self-contained', flush=True)

    b.js('__downloads.length=0;return true')
    click('exportButton'); click('exportPng')
    png = b.async_js('''const done=arguments[arguments.length-1];const t0=Date.now();
        (function wait(){ const png=__downloads.find(d=>d.type==='image/png'); if(png) done({type:png.type,size:png.size}); else if(Date.now()-t0>8000) done(null); else setTimeout(wait,50); })()''')
    assert png and png['type'] == 'image/png' and png['size'] > 20000, png
    print('PASS: PNG export', flush=True)

    b.js('window.dispatchEvent(new Event("beforeprint"));return true')
    report = b.js('''const r=document.getElementById("report");return {h2:[...r.querySelectorAll("h2")].map(h=>h.textContent),
        figures:r.querySelectorAll("figure").length,nodes:[...r.querySelectorAll("figure svg")].map(s=>s.querySelectorAll(".node").length),
        evidence:r.querySelectorAll("section:nth-of-type(3) tbody tr").length,text:r.textContent}''')
    assert report['h2'] == ['Problem definition', 'Cause-and-effect chart', 'Evidence log', 'Causes ruled out', 'Solutions', 'Action plan'], report['h2']
    assert report['figures'] == 2 and all(n > 0 for n in report['nodes']), 'the wide chart is split across two pages'
    assert report['evidence'] == len(rca()['evidence'])
    assert 'RCA-2026-014' in report['text'] and 'Add a cyclone separator' in report['text'] and 'Revise upset procedure OP-212' in report['text']
    pdf = base64.b64decode(b.call('WebDriver:Print', {'orientation': 'landscape', 'background': True})['value'])
    assert pdf.startswith(b'%PDF') and pdf.count(b'/Type /Page') - pdf.count(b'/Type /Pages') >= 5, 'the report prints over several pages'
    print('PASS: printed report', flush=True)

    def node_fill(title):
        return b.js('return document.querySelector(`#chart .node[data-id="${arguments[0]}"] rect:not([fill=none])`).getAttribute("fill")', [node_id(title)])
    assert b.js('return document.documentElement.dataset.theme ?? null') is None, 'the theme follows the system at first'
    click('themeButton')
    assert b.js('return document.documentElement.dataset.theme') == 'light'
    click('themeButton')
    assert b.js('return document.documentElement.dataset.theme') == 'dark'
    assert b.js("return localStorage.getItem('apollo-rca-theme')") == 'dark'
    assert node_fill('Plan 11 flush flow dropped to near zero') == '#0d6e76', 'the canvas uses the dark palette'
    assert b.js("return getComputedStyle(document.body).backgroundColor") == 'rgb(22, 31, 40)'
    b.js('__downloads.length=0;return true')
    click('exportButton'); click('exportSvg')
    assert 'fill="#0b5f66"' in b.async_js('const done=arguments[arguments.length-1];__downloads.at(-1).text().then(done)'), 'exports stay light'
    click('themeButton')
    assert b.js('return document.documentElement.dataset.theme ?? null') is None and node_fill('Plan 11 flush flow dropped to near zero') == '#0b5f66'
    key(' ')
    print('PASS: light, dark, and system themes', flush=True)

    # ---- Autosave recovery ----
    select('Seal relies on a stable liquid film')
    type_into('nodeNotes', 'Check with the seal vendor')
    assert saved()['dirty'] is True
    b.call('WebDriver:Navigate', {'url': url})
    assert any(n['notes'] == 'Check with the seal vendor' for n in rca()['nodes'])
    assert 'Recovered' in b.js("return document.getElementById('status').textContent")
    assert len(b.js("return document.querySelectorAll('#chart .node')")) == 16
    print('PASS: autosave recovers unsaved changes after a reload', flush=True)

    # Storage that throws must not stop the app.
    open_app()
    b.js("Storage.prototype.setItem=()=>{throw new Error('quota')};return true")
    click('loadExample')
    assert len(b.js("return document.querySelectorAll('#chart .node')")) == 16
    print('PASS: works when storage is unavailable', flush=True)

    # ---- No network ----
    assert b.js("return performance.getEntriesByType('resource').filter(r=>!r.name.startsWith('blob:')&&!r.name.startsWith('data:')).length") == 0, 'no resources were fetched'
    assert b.js('return __violations') == []
    assert b.js("return document.querySelector('meta[http-equiv=Content-Security-Policy]').content").startswith("default-src 'none'")
    html = (ROOT / 'apollo-rca.html').read_text(encoding='utf-8')
    assert not re.search(r'''(?:src|href)\s*=\s*["']?(?:https?:)?//''', html), 'no remote references in the page'
    print('PASS: no network requests', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, help='Connect to an existing temporary Firefox')
    args = parser.parse_args()
    process = None
    b = None
    with tempfile.TemporaryDirectory(prefix='apollo-rca-test-') as profile:
        try:
            port = args.port
            if port is None:
                firefox = shutil.which('firefox')
                if not firefox:
                    raise RuntimeError('Firefox is required to run this test')
                with socket.socket() as sock:
                    sock.bind(('127.0.0.1', 0))
                    port = sock.getsockname()[1]
                Path(profile, 'user.js').write_text(f'user_pref("marionette.port", {port});\n')
                process = subprocess.Popen([firefox, '--headless', '--marionette', '--no-remote', '--profile', profile],
                                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            deadline = time.monotonic() + 20
            while True:
                try:
                    b = Browser(port)
                    break
                except OSError:
                    if time.monotonic() >= deadline:
                        raise
                    time.sleep(.2)
            b.call('WebDriver:NewSession')
            b.call('WebDriver:SetWindowRect', {'width': 1440, 'height': 1000})
            check_syntax(b)
            run_tests(b)
        finally:
            if b:
                try:
                    b.call('WebDriver:DeleteSession')
                finally:
                    b.socket.close()
            if process:
                process.terminate()
                process.wait(timeout=10)


if __name__ == '__main__':
    main()
