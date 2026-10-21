// The built-in worked example: high leakage on the single cartridge seal of pump P-101A.
// People and dates are invented. Fresh ids are made on every load, as for any new RCA.

function exampleRca() {
  const s = blankState();
  const ids = {};
  const ev = {};

  const evidence = [
    ['Leakage measured at the gland drain: 15 ml/min against an acceptance limit under 1 ml/min.', 'sensed', 'Field measurement, graduated cylinder, P-101A gland drain', 'K. Osei', '2026-09-14'],
    ['Teardown: heat checking across the SiC seat, chipped OD edge on the carbon face, continuous wear track.', 'sensed', 'Seal workshop teardown report and photos', 'L. Moreau', '2026-09-17'],
    ['DCS trend TI-104: seal chamber temperature up 18 °C over the 6 h before the leak was reported.', 'sensed', 'DCS historian, tag TI-104', 'R. Haddad', '2026-09-15'],
    ['Plan 11 orifice (3 mm) about 90 % blocked with catalyst fines; flush line has no strainer or cyclone.', 'sensed', 'Orifice removed at teardown; P&ID and line walk', 'L. Moreau', '2026-09-17'],
    ['Process upset on 12 Sep; filter F-101 bypass valve opened for 40 min.', 'sensed', 'Operations upset report and DCS valve position log', 'R. Haddad', '2026-09-15'],
    ['Vapour-pressure margin in the seal chamber about 0.3 bar at 92 °C; flashes with a further 10–15 °C.', 'inferred', 'Calculation from product vapour-pressure curve and chamber pressure', 'S. Varga', '2026-09-18'],
    ['Seal selection datasheet records no vapour-pressure margin check.', 'sensed', 'Seal selection file, datasheet rev. B', 'S. Varga', '2026-09-18'],
    ['No seal-system walkdown after the upset or the bypass; none is required by the procedure.', 'sensed', 'Shift log and operator interview', 'K. Osei', '2026-09-16'],
    ['Vibration 2.1 mm/s overall; laser alignment within 0.05 mm; set screws and setting clips correctly removed.', 'sensed', 'Condition monitoring report and teardown', 'R. Haddad', '2026-09-16'],
    ['Lab dynamic test on a spare seal from the same batch: 0.2 ml/min at duty pressure and temperature, faces as new.', 'sensed', 'In-house dynamic test rig, test report LT-2026-118', 'L. Moreau', '2026-09-24'],
  ];
  evidence.forEach(([description, type, source, collectedBy, date], i) => {
    const e = {id: uuid(), code: `E${i + 1}`, description, type, source, collectedBy, date};
    s.evidence.push(e); ev[e.code] = e.id;
  });

  const node = (key, kind, title, opts = {}) => {
    const n = {...blankNode(kind, title), ...opts, evidenceIds: (opts.evidence || []).map(code => ev[code])};
    delete n.evidence;
    s.nodes.push(n); ids[key] = n.id;
  };
  const causes = (effect, ...keys) => { for (const key of keys) s.links.push({id: uuid(), effectId: ids[effect], causeId: ids[key]}); };
  const stop = reason => ({reason, note: ''});

  s.nodes = [];
  node('leak', 'effect', 'High seal leakage, 15 ml/min (limit under 1 ml/min)', {evidence: ['E1']});
  s.problem.primaryEffectId = ids.leak;

  node('path', 'action', 'Leak path opened across primary faces', {evidence: ['E1', 'E2']});
  node('pressurised', 'condition', 'Seal chamber pressurised with process fluid', {evidence: ['E7'], stopPoint: stop('no-value')});
  node('damaged', 'action', 'Faces damaged (heat checking on SiC, chipping on carbon)', {evidence: ['E2']});
  node('film', 'condition', 'Seal relies on a stable liquid film', {stopPoint: stop('no-value')});
  node('flashed', 'action', 'Fluid film flashed to vapour (intermittent dry running)', {evidence: ['E2', 'E6']});
  node('dryrun', 'condition', 'Carbon/SiC pair has limited dry-run tolerance', {evidence: ['E2'], stopPoint: stop('no-value')});
  node('temp', 'action', 'Seal chamber temperature rose 18 °C', {evidence: ['E3']});
  node('vapour', 'condition', 'Product close to its vapour pressure', {evidence: ['E6']});
  node('selection', 'condition', 'Seal selected without checking vapour-pressure margin', {evidence: ['E7'], controllable: true, stopPoint: stop('solution-found')});
  node('flow', 'action', 'Plan 11 flush flow dropped to near zero', {evidence: ['E3', 'E4']});
  node('heat', 'condition', 'Heat input from face friction and pump', {stopPoint: stop('no-value')});
  node('solids', 'action', 'Solids entered the flush line', {evidence: ['E4']});
  node('orifice', 'condition', '3 mm orifice, no strainer or cyclone', {evidence: ['E4'], controllable: true, stopPoint: stop('solution-found')});
  node('bypass', 'action', 'Filter bypass opened during process upset', {evidence: ['E5'], controllable: true, stopPoint: stop('solution-found')});
  node('nocheck', 'condition', 'No seal-system check after upset or bypass', {evidence: ['E8'], controllable: true, stopPoint: stop('solution-found')});

  causes('leak', 'path', 'pressurised');
  causes('path', 'damaged', 'film');
  causes('damaged', 'flashed', 'dryrun');
  causes('flashed', 'temp', 'vapour');
  causes('vapour', 'selection');
  causes('temp', 'flow', 'heat');
  causes('flow', 'solids', 'orifice');
  causes('solids', 'bypass', 'nocheck');

  s.meta = {
    rcaNumber: 'RCA-2026-014', equipmentTag: 'P-101A', sealType: 'Single cartridge seal, API Plan 11, OH2 pump',
    leadId: '', team: [], dates: {opened: '2026-09-15', eventDate: '2026-09-14', closed: ''},
  };
  const team = [['L. Moreau', 'Seal specialist, test lab'], ['R. Haddad', 'Reliability engineer'], ['K. Osei', 'Operations supervisor'], ['S. Varga', 'Process engineer']];
  s.meta.team = team.map(([name, role]) => ({id: uuid(), name, role}));
  s.meta.leadId = s.meta.team[0].id;
  s.problem = {
    primaryEffectId: ids.leak,
    when: '14 Sep 2026, 06:30, found on morning round; two days after a process upset',
    where: 'Unit 2, pump P-101A, inboard single cartridge seal',
    significance: {
      safety: 'Flammable hydrocarbon leaking at the gland; area barriered off.',
      environment: 'Hydrocarbon release to the drain system; VOC emissions above permit for the seal.',
      productionCost: 'Switched to spare P-101B; seal replacement and repair about €12k.',
      reliability: 'Second seal failure on P-101A in 14 months; no spare pump while P-101A is down.',
    },
  };

  s.ruledOut = [
    ['Shaft misalignment', 'Laser alignment check after the failure', ['E9']],
    ['Excessive vibration', 'Condition monitoring trend before and after the event', ['E9']],
    ['Installation error', 'Teardown: setting clips removed, set screws tight, correct compression', ['E2', 'E9']],
    ['Elastomer chemical attack', 'Teardown: O-rings intact, no swelling or hardening', ['E2']],
    ['Face manufacturing defect', 'Lab dynamic test on a spare seal from the same batch', ['E10']],
  ].map(([cause, test, codes]) => ({id: uuid(), cause, kind: '', test, evidenceIds: codes.map(c => ev[c]), status: 'ruled-out'}));

  const crit = (a, b, c, d) => Object.fromEntries(['preventsRecurrence', 'withinControl', 'meetsGoals', 'noNewProblems'].map((k, i) => [k, {v: [a, b, c, d][i][0], c: [a, b, c, d][i][1] || ''}]));
  const solution = (title, keys, criteria, decision) => ({id: uuid(), title, causeIds: keys.map(k => ids[k]), criteria, decision});
  s.solutions = [
    solution('Add a cyclone separator to the flush (Plan 11 + 31)', ['orifice'], crit(['yes'], ['yes'], ['yes'], ['yes']), 'implement'),
    solution('Seal-system check in the upset and filter-bypass procedure', ['nocheck', 'bypass'], crit(['yes'], ['yes'], ['yes'], ['yes']), 'implement'),
    solution('Vapour-pressure margin step in seal selection', ['selection'], crit(['yes', 'Prevents recurrence on future selections'], ['yes'], ['yes'], ['yes']), 'implement'),
    solution('Seal chamber high-temperature alarm on TI-104', ['temp'], crit(['partly', 'Secondary barrier: detects, does not prevent'], ['yes'], ['yes'], ['yes']), 'implement'),
    solution('Change to SiC/SiC faces', ['dryrun'], crit(['no', 'SiC/SiC tolerates dry running worse'], ['yes'], ['no'], ['no', 'Brittle pair, worse dry-run behaviour']), 'reject'),
    solution('Larger flush orifice', ['orifice'], crit(['partly', 'Less prone to blocking'], ['yes'], ['partly'], ['partly', 'More flush flow, more heat and erosion; needs a study']), 'study'),
    solution('Train operators', ['bypass'], crit(['no', 'Does not change the conditions'], ['yes'], ['no'], ['yes']), 'reject'),
  ];
  const action = (text, sol, owner, due, verification, status = 'open') =>
    ({id: uuid(), action: text, solutionId: s.solutions[sol].id, owner, due, verification, status, effectiveness: {date: '', result: ''}});
  s.actions = [
    action('Engineer and install cyclone separator on P-101A/B flush', 0, 'S. Varga', '2026-12-15', 'Installation check and flush flow test'),
    action('Revise upset procedure OP-212 to require a seal-system walkdown', 1, 'K. Osei', '2026-11-15', 'Procedure review and a field audit after the next upset'),
    action('Add vapour-pressure margin step to the seal selection checklist', 2, 'L. Moreau', '2026-11-01', 'Checklist audit on the next three selections', 'in-progress'),
    action('Configure TI-104 high alarm at 85 °C', 3, 'R. Haddad', '2026-10-31', 'Alarm test from the DCS', 'done'),
  ];
  return {...s, view: {collapsed: []}};
}
