// GymOS engine tests — simulated lifters, no camera needed.
// Run: node tests/engine.test.js
'use strict';
const G = require('../engine.js');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + '\n      ' + e.message); }
}
function eq(a, b, msg) { if (a !== b) throw new Error((msg || '') + ` expected ${b}, got ${a}`); }
function ok(c, msg) { if (!c) throw new Error(msg || 'assertion failed'); }

// Build a rep plan. Values per side; right may be null for side view.
function reps(n, o) {
  const plan = [];
  const start = o.start, far = o.far;
  const farR = o.farR === undefined ? far : o.farR;
  plan.push({ dur: o.lead || 0.8, hold: true, from: { left: start, right: start }, to: { left: start, right: start } });
  for (let i = 0; i < n; i++) {
    const out = typeof o.out === 'function' ? o.out(i) : (o.out || 1.0);
    const back = typeof o.back === 'function' ? o.back(i) : (o.back || 1.2);
    const fL = typeof far === 'function' ? far(i) : far;
    const fR = typeof farR === 'function' ? farR(i) : farR;
    plan.push({ dur: out, from: { left: start, right: start }, to: { left: fL, right: fR } });
    if (o.hold) plan.push({ dur: o.hold, hold: true, from: { left: fL, right: fR }, to: { left: fL, right: fR } });
    plan.push({ dur: back, from: { left: fL, right: fR }, to: { left: start, right: start } });
    plan.push({ dur: o.pause || 0.3, hold: true, from: { left: start, right: start }, to: { left: start, right: start } });
  }
  return plan;
}
function run(ex, frames, opts) {
  const eng = G.createEngine(ex, Object.assign({ target: 10 }, opts || {}));
  const ev = [];
  frames.forEach(f => eng.update(f).forEach(e => { if (e.type !== 'frame') ev.push(e); }));
  return { eng, ev, count: t => ev.filter(e => e.type === t).length, cues: k => ev.filter(e => e.type === 'cue' && e.key === k) };
}

const curl = G.byId('curl'), squat = G.byId('squat'), bench = G.byId('bench-press');

console.log('\nRep counting');
test('curl, 10 clean reps face-on → 10 reps, no partials', () => {
  const r = run(curl, G.sim.stream(curl, reps(10, { start: 165, far: 40 }), { noise: 1.5 }));
  eq(r.count('rep'), 10, 'reps'); eq(r.count('partial'), 0, 'partials');
});
test('noisy hold right at the full-range threshold does not double count', () => {
  const near = 165 - 0.8 * (165 - 40);
  const plan = reps(3, { start: 165, far: 40 });
  plan.push({ dur: 3, hold: true, from: { left: near, right: near }, to: { left: near, right: near } });
  const r = run(curl, G.sim.stream(curl, plan, { noise: 4 }), { autoEnd: false });
  eq(r.count('rep'), 3);
});
test('BUG FIX: squat side view with far leg hidden still counts (old engine counted 0)', () => {
  const r = run(squat, G.sim.stream(squat, reps(5, { start: 172, far: 85 }), { noise: 1.5 }));
  eq(r.count('rep'), 5);
});
test('BUG FIX: failed squat rep stuck halfway is NOT counted (old engine counted at the bottom)', () => {
  const plan = reps(4, { start: 172, far: 85 });
  plan.push({ dur: 1.0, from: { left: 172 }, to: { left: 85 } });
  plan.push({ dur: 0.6, from: { left: 85 }, to: { left: 125 } });
  plan.push({ dur: 4.5, hold: true, from: { left: 125 }, to: { left: 125 } });
  const r = run(squat, G.sim.stream(squat, plan, { noise: 0.5 }), { autoEnd: false });
  eq(r.count('rep'), 4, 'reps');
  ok(r.ev.some(e => e.type === 'stall' && e.level === 1), 'expected a stall alert');
  ok(r.ev.some(e => e.type === 'stall' && e.level === 2), 'expected a rack-it alert');
  eq(r.cues('stall2')[0].text, 'Rack it. Safety first.');
  eq(r.eng.summary().failed, 1, 'failed rep logged');
});
test('bench press counts on lockout, not when the bar touches the chest', () => {
  const plan = reps(2, { start: 165, far: 75 });
  plan.push({ dur: 1.0, from: { left: 165 }, to: { left: 75 } });  // lower to chest, no press yet
  const r = run(bench, G.sim.stream(bench, plan), { autoEnd: false });
  eq(r.count('rep'), 2);
});
test('deadlift (starts at the floor) counts each pull', () => {
  const dl = G.byId('deadlift');
  const r = run(dl, G.sim.stream(dl, reps(5, { start: 72, far: 172, hold: 0.5 })));
  eq(r.count('rep'), 5);
});
test('half-range curls count as partials, not reps, with a full-range cue', () => {
  const r = run(curl, G.sim.stream(curl, reps(3, { start: 165, far: 100 })));
  eq(r.count('rep'), 0); eq(r.count('partial'), 3);
  ok(r.cues('partial').length >= 1);
});
test('pec deck fly tracked by hand span (old version could not see this movement)', () => {
  const fly = G.byId('pec-fly');
  const r = run(fly, G.sim.stream(fly, reps(6, { start: 2.7, far: 0.5 }), { noise: 0.03 }));
  eq(r.count('rep'), 6);
});
test('every exercise in the library counts 4 simulated reps', () => {
  G.EXERCISES.forEach(ex => {
    const s = ex.range[ex.start], f = ex.range[ex.start === 'open' ? 'closed' : 'open'];
    const over = (f - s) * 0.1;
    const r = run(ex, G.sim.stream(ex, reps(4, { start: s - over * 0.3, far: f + over }), { chain: true }));
    eq(r.count('rep'), 4, ex.id);
  });
});

console.log('\nForm and fatigue');
test('BUG FIX: no form cues at all on clean full-range curls (old build cued every rep)', () => {
  const r = run(curl, G.sim.stream(curl, reps(10, { start: 165, far: 40, back: 2 })));
  eq(r.count('cue'), 0, 'cues: ' + r.ev.filter(e => e.type === 'cue').map(e => e.text).join(' | '));
});
test('left arm short of full curl → "Left arm is lagging"', () => {
  const r = run(curl, G.sim.stream(curl, reps(6, { start: 165, far: 70, farR: 40, back: 2 })));
  const c = r.cues('asym');
  ok(c.length >= 1, 'expected asymmetry cue'); eq(c[0].side, 'left'); eq(c[0].text, 'Left arm is lagging.');
  ok(r.eng.summary().avgAsym > 15, 'avg asym ' + r.eng.summary().avgAsym);
});
test('a lagging arm is not mistaken for fatigue (speed timed on the leading arm)', () => {
  const r = run(curl, G.sim.stream(curl, reps(8, { start: 165, far: 40, farR: i => (i >= 3 ? 75 : 40), back: 2 })));
  eq(r.cues('fatigue1').length, 0, 'fatigue cues');
  ok(r.eng.summary().maxLoss < 0.12, 'max loss ' + r.eng.summary().maxLoss);
});
test('asymmetry is averaged per rep, not per frame', () => {
  const r = run(curl, G.sim.stream(curl, reps(4, { start: 165, far: 40, back: 2 })));
  const s = r.eng.summary();
  eq(s.log.filter(x => x.asym !== null).length, 4);
});
test('BUG FIX: speed measured on the lift itself — slowing reps trigger fatigue cues in order', () => {
  const r = run(curl, G.sim.stream(curl, reps(10, { start: 165, far: 40, out: i => 0.8 + i * 0.16, back: 2 })));
  const f1 = r.cues('fatigue1'), f2 = r.cues('fatigue2');
  ok(f1.length === 1, 'expected one "slowing" cue'); ok(f2.length === 1, 'expected one "grinding" cue');
  ok(r.ev.indexOf(f1[0]) < r.ev.indexOf(f2[0]), 'warn before stop');
  ok(r.eng.summary().maxLoss > 0.45, 'max loss ' + r.eng.summary().maxLoss);
});
test('a slow lowering does not count as fatigue (only the lifting phase is timed)', () => {
  const r = run(curl, G.sim.stream(curl, reps(10, { start: 165, far: 40, out: 0.9, back: i => 1.5 + i * 0.4 })));
  eq(r.cues('fatigue1').length, 0);
});
test('for squats the lifting phase is standing up', () => {
  const r = run(squat, G.sim.stream(squat, reps(8, { start: 172, far: 85, out: 1.2, back: i => 0.8 + i * 0.25 })));
  ok(r.cues('fatigue1').length === 1, 'expected fatigue on the way up');
});
test('dropping the weight fast twice → "Control the way down"', () => {
  const r = run(curl, G.sim.stream(curl, reps(5, { start: 165, far: 40, back: 0.35 })));
  ok(r.cues('tempo').length >= 1);
});
test('fatigue alerts can be turned off', () => {
  const r = run(curl, G.sim.stream(curl, reps(10, { start: 165, far: 40, out: i => 0.8 + i * 0.2, back: 2 })), { fatigue: null });
  eq(r.cues('fatigue1').length + r.cues('fatigue2').length, 0);
});

console.log('\nSet flow');
test('set ends on its own after target reps and a short rest at the start position', () => {
  const plan = reps(10, { start: 165, far: 40 });
  plan.push({ dur: 4.5, hold: true, from: { left: 165, right: 165 }, to: { left: 165, right: 165 } });
  const r = run(curl, G.sim.stream(curl, plan));
  eq(r.count('rep'), 10); eq(r.count('setEnd'), 1);
});
test('no auto end before the first rep while setting up', () => {
  const plan = [{ dur: 20, hold: true, from: { left: 165, right: 165 }, to: { left: 165, right: 165 } }];
  eq(run(curl, G.sim.stream(curl, plan)).count('setEnd'), 0);
});
test('walking out of frame mid-set reports tracking loss, then ends the set', () => {
  const plan = reps(3, { start: 165, far: 40 });
  plan.push({ dur: 5, lost: true, hold: true, from: { left: 165, right: 165 }, to: { left: 165, right: 165 } });
  const r = run(curl, G.sim.stream(curl, plan));
  ok(r.ev.some(e => e.type === 'tracking' && !e.ok), 'tracking lost event');
  ok(r.ev.some(e => e.type === 'setEnd' && e.reason === 'away'), 'away end');
});
test('keeps counting past the target if the lifter keeps going', () => {
  const r = run(curl, G.sim.stream(curl, reps(12, { start: 165, far: 40 })));
  eq(r.count('rep'), 12);
  ok(r.ev.some(e => e.type === 'rep' && e.hitTarget && e.n === 10));
});

console.log('\nCalibration');
test('two slow reps learn a short-armed lifter\'s range, then their reps count', () => {
  const cal = G.createCalibrator(curl);
  let res = null;
  G.sim.stream(curl, reps(2, { start: 150, far: 70, out: 2, back: 2 }), { noise: 1 }).forEach(f => { const u = cal.update(f); if (u.done) res = u.result; });
  ok(res, 'calibration finished');
  ok(Math.abs(res.open - 150) < 6 && Math.abs(res.closed - 70) < 6, `got ${res.open}/${res.closed}`);
  // with defaults, a 70° top is short of full range → partials
  eq(run(curl, G.sim.stream(curl, reps(5, { start: 150, far: 70 }))).count('rep'), 0, 'default range');
  eq(run(curl, G.sim.stream(curl, reps(5, { start: 150, far: 70 })), { calib: res }).count('rep'), 5, 'calibrated');
});
test('calibration flags a tiny range', () => {
  const cal = G.createCalibrator(curl);
  let res = null;
  G.sim.stream(curl, reps(2, { start: 150, far: 110, out: 2, back: 2 })).forEach(f => { const u = cal.update(f); if (u.done) res = u.result; });
  ok(res && res.small, 'expected small-range flag');
});

console.log('\nProgression');
test('all sets hit, no grind → add weight', () => {
  const r = G.recommend(curl, 'lb', 30, 10, [1, 2, 3].map(() => ({ reps: 10, failed: 0, maxLoss: 0.2, stalls: 0 })), null);
  eq(r.weight, 35);
});
test('all sets hit but last set ground out → hold', () => {
  const r = G.recommend(curl, 'lb', 30, 10, [{ reps: 10, maxLoss: 0.1 }, { reps: 10, maxLoss: 0.5 }].map(s => Object.assign({ failed: 0, stalls: 0 }, s)), null);
  eq(r.weight, 30);
});
test('second rough session in a row at the same weight → deload', () => {
  const sets = [{ reps: 6 }, { reps: 5 }].map(s => Object.assign({ failed: 0, stalls: 0, maxLoss: 0.5 }, s));
  const r = G.recommend(squat, 'lb', 225, 8, sets, { weight: 225, missedBig: 2 });
  ok(r.weight < 225 && r.weight % 10 === 5, 'got ' + r.weight);
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
