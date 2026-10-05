/*
 * GymOS engine — pure rep-tracking logic. No DOM, no camera.
 * Runs in the browser (window.GymEngine) and in Node (module.exports) so
 * every rule here is covered by tests/engine.test.js.
 *
 * Copyright (c) 2026 James Keith Harwood II — Sentinel AI Systems. All Rights Reserved.
 */
(function (root) {
  'use strict';

  // MediaPipe pose landmark indices (person's own left/right)
  var LM = {
    nose: 0,
    left_shoulder: 11, right_shoulder: 12,
    left_elbow: 13, right_elbow: 14,
    left_wrist: 15, right_wrist: 16,
    left_hip: 23, right_hip: 24,
    left_knee: 25, right_knee: 26,
    left_ankle: 27, right_ankle: 28
  };

  // ───────────────────────────────────────────────────────────────
  // EXERCISE LIBRARY
  //
  // metric.type 'angle' — joint angle in degrees from three joints
  // metric.type 'span'  — wrist-to-wrist distance ÷ shoulder width
  // view   'front' tracks both sides and measures asymmetry
  //        'side'  tracks whichever side faces the camera
  // start  the position every rep begins and ends in ('open' = joint
  //        extended / arms wide, 'closed' = joint bent / arms together)
  // concentric  'out'  — the lift is the move away from start (curl)
  //             'back' — the lift is the return to start (squat, bench)
  // range  default open/closed values, replaced by calibration
  // ───────────────────────────────────────────────────────────────
  var EXERCISES = [
    { id: 'curl', name: 'Dumbbell curl', group: 'Arms', view: 'front',
      metric: { type: 'angle', joints: ['shoulder', 'elbow', 'wrist'] },
      start: 'open', concentric: 'out', range: { open: 160, closed: 45 },
      limb: 'arm', inc: { lb: 5, kg: 2 }, dflt: { lb: 25, kg: 10 },
      setup: 'Face the camera from 6–8 feet. Both arms in view.' },
    { id: 'hammer-curl', name: 'Hammer curl', group: 'Arms', view: 'front',
      metric: { type: 'angle', joints: ['shoulder', 'elbow', 'wrist'] },
      start: 'open', concentric: 'out', range: { open: 160, closed: 50 },
      limb: 'arm', inc: { lb: 5, kg: 2 }, dflt: { lb: 25, kg: 10 },
      setup: 'Face the camera from 6–8 feet. Both arms in view.' },
    { id: 'shoulder-press', name: 'Shoulder press', group: 'Shoulders', view: 'front',
      metric: { type: 'angle', joints: ['shoulder', 'elbow', 'wrist'] },
      start: 'closed', concentric: 'out', range: { open: 165, closed: 80 },
      limb: 'arm', inc: { lb: 5, kg: 2 }, dflt: { lb: 30, kg: 12 },
      setup: 'Face the camera, phone low and tilted up so your hands stay in frame overhead.' },
    { id: 'lateral-raise', name: 'Lateral raise', group: 'Shoulders', view: 'front',
      metric: { type: 'angle', joints: ['hip', 'shoulder', 'elbow'] },
      start: 'closed', concentric: 'out', range: { open: 85, closed: 15 },
      limb: 'arm', inc: { lb: 5, kg: 1 }, dflt: { lb: 15, kg: 6 },
      setup: 'Face the camera from 6–8 feet. Hips to hands in view.' },
    { id: 'lat-pulldown', name: 'Lat pulldown', group: 'Back', view: 'front',
      metric: { type: 'angle', joints: ['shoulder', 'elbow', 'wrist'] },
      start: 'open', concentric: 'out', range: { open: 165, closed: 65 },
      limb: 'arm', inc: { lb: 10, kg: 5 }, dflt: { lb: 100, kg: 45 },
      setup: 'Phone in front of the machine, facing you. Hands on the bar in frame.' },
    { id: 'pec-fly', name: 'Pec deck fly', group: 'Chest', view: 'front',
      metric: { type: 'span' },
      start: 'open', concentric: 'out', range: { open: 2.6, closed: 0.6 },
      limb: 'arm', inc: { lb: 10, kg: 5 }, dflt: { lb: 80, kg: 35 },
      setup: 'Phone straight in front of you at chest height. Both hands in view when open.' },
    { id: 'bench-press', name: 'Bench press', group: 'Chest', view: 'side', rackable: true,
      metric: { type: 'angle', joints: ['shoulder', 'elbow', 'wrist'] },
      start: 'open', concentric: 'back', range: { open: 165, closed: 75 },
      limb: 'arm', inc: { lb: 5, kg: 2.5 }, dflt: { lb: 135, kg: 60 },
      setup: 'Phone at bench height, side-on, 6 feet away. Shoulder, elbow and wrist in view.' },
    { id: 'incline-press', name: 'Incline press', group: 'Chest', view: 'side', rackable: true,
      metric: { type: 'angle', joints: ['shoulder', 'elbow', 'wrist'] },
      start: 'open', concentric: 'back', range: { open: 160, closed: 75 },
      limb: 'arm', inc: { lb: 5, kg: 2.5 }, dflt: { lb: 95, kg: 40 },
      setup: 'Phone at bench height, side-on, 6 feet away. Shoulder, elbow and wrist in view.' },
    { id: 'push-up', name: 'Push-up', group: 'Chest', view: 'side', bodyweight: true,
      metric: { type: 'angle', joints: ['shoulder', 'elbow', 'wrist'] },
      start: 'open', concentric: 'back', range: { open: 165, closed: 85 },
      limb: 'arm', inc: { lb: 0, kg: 0 }, dflt: { lb: 0, kg: 0 },
      setup: 'Phone on the floor, side-on, 5 feet away. Whole body in view.' },
    { id: 'squat', name: 'Squat', group: 'Legs', view: 'side', rackable: true,
      metric: { type: 'angle', joints: ['hip', 'knee', 'ankle'] },
      start: 'open', concentric: 'back', range: { open: 170, closed: 90 },
      limb: 'leg', inc: { lb: 10, kg: 5 }, dflt: { lb: 135, kg: 60 },
      setup: 'Phone at hip height, side-on, 8 feet away. Hip to ankle in view.' },
    { id: 'deadlift', name: 'Deadlift', group: 'Back', view: 'side',
      metric: { type: 'angle', joints: ['shoulder', 'hip', 'knee'] },
      start: 'closed', concentric: 'out', range: { open: 170, closed: 75 },
      limb: 'side', inc: { lb: 10, kg: 5 }, dflt: { lb: 185, kg: 80 },
      setup: 'Phone at hip height, side-on, 8 feet away. Shoulder to knee in view.' },
    { id: 'rdl', name: 'Romanian deadlift', group: 'Legs', view: 'side',
      metric: { type: 'angle', joints: ['shoulder', 'hip', 'knee'] },
      start: 'open', concentric: 'back', range: { open: 170, closed: 100 },
      limb: 'side', inc: { lb: 10, kg: 5 }, dflt: { lb: 135, kg: 60 },
      setup: 'Phone at hip height, side-on, 8 feet away. Shoulder to knee in view.' },
    { id: 'seated-row', name: 'Seated cable row', group: 'Back', view: 'side',
      metric: { type: 'angle', joints: ['shoulder', 'elbow', 'wrist'] },
      start: 'open', concentric: 'out', range: { open: 165, closed: 80 },
      limb: 'arm', inc: { lb: 10, kg: 5 }, dflt: { lb: 90, kg: 40 },
      setup: 'Phone beside the machine at chest height, side-on.' },
    { id: 'tricep-pushdown', name: 'Tricep pushdown', group: 'Arms', view: 'side',
      metric: { type: 'angle', joints: ['shoulder', 'elbow', 'wrist'] },
      start: 'closed', concentric: 'out', range: { open: 165, closed: 75 },
      limb: 'arm', inc: { lb: 5, kg: 2.5 }, dflt: { lb: 40, kg: 20 },
      setup: 'Phone beside the cable stack at chest height, side-on.' },
    { id: 'leg-extension', name: 'Leg extension', group: 'Legs', view: 'side',
      metric: { type: 'angle', joints: ['hip', 'knee', 'ankle'] },
      start: 'closed', concentric: 'out', range: { open: 165, closed: 90 },
      limb: 'leg', inc: { lb: 10, kg: 5 }, dflt: { lb: 70, kg: 30 },
      setup: 'Phone beside the machine at seat height, side-on.' },
    { id: 'leg-curl', name: 'Seated leg curl', group: 'Legs', view: 'side',
      metric: { type: 'angle', joints: ['hip', 'knee', 'ankle'] },
      start: 'open', concentric: 'out', range: { open: 160, closed: 75 },
      limb: 'leg', inc: { lb: 10, kg: 5 }, dflt: { lb: 60, kg: 25 },
      setup: 'Phone beside the machine at seat height, side-on.' }
  ];
  var BY_ID = {};
  EXERCISES.forEach(function (e) { BY_ID[e.id] = e; });

  // Progress thresholds, as a fraction of the calibrated range of motion
  var Z = 0.2;            // inside this = at the start position
  var F = 0.8;            // past this = full range reached
  var PARTIAL_MIN = 0.35; // a turnaround past this but short of F = partial rep
  var MEASURE = F - Z;    // the slice of the rep we time for speed

  // ───────────────────────────────────────────────────────────────
  // GEOMETRY
  // ───────────────────────────────────────────────────────────────
  function angle3(a, b, c) {
    var ux = a.x - b.x, uy = a.y - b.y, uz = (a.z || 0) - (b.z || 0);
    var vx = c.x - b.x, vy = c.y - b.y, vz = (c.z || 0) - (b.z || 0);
    var m = Math.sqrt(ux * ux + uy * uy + uz * uz) * Math.sqrt(vx * vx + vy * vy + vz * vz);
    if (!m) return null;
    var d = (ux * vx + uy * vy + uz * vz) / m;
    return Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI;
  }
  function dist(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y, dz = (a.z || 0) - (b.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  // Image landmarks are normalized to width and height separately, so
  // angles from them are skewed unless x is scaled by the aspect ratio.
  function aspectCorrect(lm, aspect) {
    return lm.map(function (p) { return { x: p.x * (aspect || 1), y: p.y, z: 0 }; });
  }

  // One Euro filter: smooths jitter when still, stays responsive when moving.
  function OneEuro(minCutoff, beta) {
    this.minCutoff = minCutoff; this.beta = beta; this.dCutoff = 1;
    this.x = null; this.dx = 0; this.t = null;
  }
  OneEuro.prototype.a = function (cutoff, dt) {
    var tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt);
  };
  OneEuro.prototype.filter = function (x, t) {
    if (this.x === null) { this.x = x; this.t = t; return x; }
    var dt = Math.max(0.001, (t - this.t) / 1000); this.t = t;
    var dx = (x - this.x) / dt;
    var ad = this.a(this.dCutoff, dt);
    this.dx = ad * dx + (1 - ad) * this.dx;
    var a = this.a(this.minCutoff + this.beta * Math.abs(this.dx), dt);
    this.x = a * x + (1 - a) * this.x;
    return this.x;
  };
  OneEuro.prototype.reset = function () { this.x = null; this.dx = 0; this.t = null; };

  // ───────────────────────────────────────────────────────────────
  // METRIC READER — turns a pose frame into one number per side
  // frame = { t: ms, lm: [{x,y,z,visibility}], world: [{x,y,z}] | null, aspect }
  // ───────────────────────────────────────────────────────────────
  function MetricReader(ex, opts) {
    opts = opts || {};
    this.ex = ex;
    this.minVis = opts.minVis || 0.5;
    var r = Math.abs(ex.range.open - ex.range.closed) || 1;
    var beta = 2 / r;
    this.f = { left: new OneEuro(1.5, beta), right: new OneEuro(1.5, beta), span: new OneEuro(1.5, beta) };
    this.lastSeen = { left: -1e9, right: -1e9, span: -1e9 };
    this.side = null;
    this.altSince = null;
  }
  MetricReader.prototype.requiredJoints = function () {
    return this.ex.metric.type === 'span' ? ['shoulder', 'wrist'] : this.ex.metric.joints;
  };
  MetricReader.prototype._vis = function (lm, name) {
    var p = lm[LM[name]];
    return p && typeof p.visibility === 'number' ? p.visibility : (p ? 1 : 0);
  };
  MetricReader.prototype._filt = function (key, v, t) {
    if (t - this.lastSeen[key] > 400) this.f[key].reset();
    this.lastSeen[key] = t;
    return this.f[key].filter(v, t);
  };
  MetricReader.prototype.read = function (frame) {
    var ex = this.ex, self = this, t = frame.t;
    var out = { ok: false, value: null, sides: null, side: null, missing: [] };
    if (!frame.lm || !frame.lm.length) { out.missing = ['body']; return out; }
    var lm = frame.lm;
    var geo = frame.world && frame.world.length ? frame.world : aspectCorrect(lm, frame.aspect);

    if (ex.metric.type === 'span') {
      var need = ['left_wrist', 'right_wrist', 'left_shoulder', 'right_shoulder'];
      need.forEach(function (n) { if (self._vis(lm, n) < self.minVis) out.missing.push(n.replace('_', ' ')); });
      if (out.missing.length) return out;
      var sw = dist(geo[LM.left_shoulder], geo[LM.right_shoulder]);
      if (!sw) { out.missing = ['shoulders']; return out; }
      var raw = dist(geo[LM.left_wrist], geo[LM.right_wrist]) / sw;
      out.ok = true; out.value = this._filt('span', raw, t);
      return out;
    }

    var j = ex.metric.joints;
    var per = {};
    ['left', 'right'].forEach(function (s) {
      var names = j.map(function (n) { return s + '_' + n; });
      var vis = names.map(function (n) { return self._vis(lm, n); });
      var score = vis[0] + vis[1] + vis[2];
      var missing = names.filter(function (n, i) { return vis[i] < self.minVis; });
      var ang = missing.length ? null : angle3(geo[LM[names[0]]], geo[LM[names[1]]], geo[LM[names[2]]]);
      per[s] = { score: score, missing: missing, raw: ang };
    });

    if (ex.view === 'side') {
      // Track the side facing the camera; switch only if the other side is
      // clearly better for over half a second.
      var cand = ['left', 'right'].filter(function (s) { return per[s].raw !== null; });
      if (!cand.length) {
        var best = per.left.score >= per.right.score ? 'left' : 'right';
        out.missing = per[best].missing.map(function (n) { return n.split('_')[1]; });
        return out;
      }
      if (!this.side || per[this.side].raw === null) { this.side = cand.length === 2 ? (per.left.score >= per.right.score ? 'left' : 'right') : cand[0]; this.altSince = null; }
      else {
        var other = this.side === 'left' ? 'right' : 'left';
        if (per[other].raw !== null && per[other].score > per[this.side].score + 0.3) {
          if (this.altSince === null) this.altSince = t;
          else if (t - this.altSince > 600) { this.side = other; this.altSince = null; this.f[other].reset(); }
        } else this.altSince = null;
      }
      out.ok = true; out.side = this.side;
      out.value = this._filt(this.side, per[this.side].raw, t);
      return out;
    }

    // Front view: both sides, average whichever are visible
    var sides = { left: null, right: null }, vals = [];
    ['left', 'right'].forEach(function (s) {
      if (per[s].raw !== null) { sides[s] = self._filt(s, per[s].raw, t); vals.push(sides[s]); }
      else per[s].missing.forEach(function (n) { out.missing.push(n.replace('_', ' ')); });
    });
    if (!vals.length) return out;
    out.ok = true; out.sides = sides;
    out.value = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    return out;
  };

  function interp(t0, p0, t1, p1, target) {
    if (p1 === p0) return t1;
    var k = (target - p0) / (p1 - p0);
    return t0 + Math.max(0, Math.min(1, k)) * (t1 - t0);
  }

  // ───────────────────────────────────────────────────────────────
  // SET ENGINE
  // o = { calib, target, fatigue: {warn, stop} | null, tempo: true|false,
  //       asymPct, autoEnd, idleBeforeMs, idleAfterMs, awayMs }
  // update(frame) returns an array of events for the UI.
  // ───────────────────────────────────────────────────────────────
  function createEngine(ex, o) {
    o = o || {};
    var range = o.calib || ex.range;
    var startVal = range[ex.start];
    var farVal = range[ex.start === 'open' ? 'closed' : 'open'];
    var span = (farVal - startVal) || 1;
    var target = o.target || 10;
    var fatigue = o.fatigue === undefined ? { warn: 0.30, stop: 0.45 } : o.fatigue;
    var tempo = o.tempo !== false;
    var asymPct = o.asymPct || 12;
    var autoEnd = o.autoEnd !== false;
    var idleBefore = o.idleBeforeMs || 8000;
    var idleAfter = o.idleAfterMs || 3500;
    var awayMs = o.awayMs || 4000;
    var reader = new MetricReader(ex, o);

    function toP(v) { return (v - startVal) / span; }

    var S = {
      phase: 'start', reps: 0, partials: 0, failed: 0,
      prevP: null, prevT: null, prevLead: null,
      rep: null, log: [], bestVel: 0,
      lastActive: null, lostSince: null, lostReported: false, ended: false,
      cool: {}, fastEcc: 0, fatigueLevel: 0, asymRecent: [],
      firstSeen: null
    };

    function newRep(tLeave) {
      return { tLeave: tLeave, tLeadFar: null, maxP: 0, minP: 1e9, reachedFar: false, tFarIn: null, tFarOut: null,
               sideMax: { left: null, right: null }, conBest: null, conImproved: null,
               stall: 0, tFarHoldStart: null };
    }
    function cooled(key, n) {
      var c = S.cool[key];
      return c === undefined || S.reps - c >= n;
    }
    function inConcentric(r, p) {
      if (ex.concentric === 'out') return !r.reachedFar;
      return r.reachedFar && p < F;
    }

    function finishRep(t, events) {
      var r = S.rep;
      // Front view: time the leading side, so a lagging arm reads as asymmetry, not fatigue
      var outMs = (r.tLeadFar !== null ? Math.min(r.tLeadFar, r.tFarIn) : r.tFarIn) - r.tLeave;
      var backMs = t - (r.tFarOut !== null ? r.tFarOut : r.tFarIn);
      var conMs = ex.concentric === 'out' ? outMs : backMs;
      var eccMs = ex.concentric === 'out' ? backMs : outMs;
      conMs = Math.max(conMs, 60);
      var vel = MEASURE / (conMs / 1000); // range-of-motion fractions per second
      var loss = S.bestVel > 0 ? Math.max(0, (S.bestVel - vel) / S.bestVel) : 0;
      S.bestVel = Math.max(S.bestVel, vel);

      var asym = null, lagging = null;
      if (ex.view === 'front' && r.sideMax.left !== null && r.sideMax.right !== null) {
        asym = Math.abs(r.sideMax.left - r.sideMax.right) * 100;
        lagging = r.sideMax.left < r.sideMax.right ? 'left' : 'right';
      }

      S.reps++;
      var rec = { n: S.reps, t: t, conMs: Math.round(conMs), eccMs: Math.round(eccMs),
                  holdMs: r.tFarOut !== null ? Math.round(r.tFarOut - r.tFarIn) : 0,
                  vel: vel, loss: loss, asym: asym, lagging: lagging, peak: r.maxP, stalled: r.stall > 0 };
      S.log.push(rec);
      events.push({ type: 'rep', n: S.reps, rep: rec, target: target, hitTarget: S.reps === target });

      // Fatigue (velocity loss). Compared against the fastest rep this set.
      if (fatigue && S.reps >= 3) {
        if (loss >= fatigue.stop && S.fatigueLevel < 2) {
          S.fatigueLevel = 2;
          events.push({ type: 'cue', key: 'fatigue2', prio: 1, text: 'Grinding. Last rep.', level: 2, loss: loss });
        } else if (loss >= fatigue.warn && S.fatigueLevel < 1) {
          S.fatigueLevel = 1;
          events.push({ type: 'cue', key: 'fatigue1', prio: 1, text: 'Slowing down. A couple left.', level: 1, loss: loss });
        }
      }

      // Asymmetry: flag when it shows up on two of the last three reps
      if (asym !== null) {
        S.asymRecent.push(asym >= asymPct ? lagging : null);
        if (S.asymRecent.length > 3) S.asymRecent.shift();
        var same = S.asymRecent.filter(function (x) { return x === lagging; }).length;
        if (asym >= asymPct && same >= 2 && cooled('asym', 3)) {
          S.cool.asym = S.reps;
          events.push({ type: 'cue', key: 'asym', prio: 1, side: lagging,
                        text: (lagging === 'left' ? 'Left ' : 'Right ') + ex.limb + ' is lagging.' });
        }
      }

      // Tempo: lowering phase dropped too fast twice in a row
      if (tempo) {
        var eccFull = eccMs / MEASURE / 1000;
        if (eccFull < 0.7) S.fastEcc++; else S.fastEcc = 0;
        if (S.fastEcc >= 2 && cooled('tempo', 4)) {
          S.cool.tempo = S.reps; S.fastEcc = 0;
          events.push({ type: 'cue', key: 'tempo', prio: 1, text: 'Control the way down.' });
        }
      }
    }

    function update(frame) {
      var events = [];
      var t = frame.t;
      if (S.ended) return events;
      var m = reader.read(frame);

      if (!m.ok) {
        if (S.lostSince === null) S.lostSince = t;
        if (!S.lostReported && t - S.lostSince > 1500) {
          S.lostReported = true;
          events.push({ type: 'tracking', ok: false, missing: m.missing });
        }
        if (autoEnd && S.reps > 0 && t - S.lostSince > awayMs) {
          S.ended = true; events.push({ type: 'setEnd', reason: 'away' });
        }
        events.push({ type: 'frame', ok: false, missing: m.missing });
        return events;
      }
      if (S.lostReported) events.push({ type: 'tracking', ok: true });
      S.lostSince = null; S.lostReported = false;
      if (S.firstSeen === null) { S.firstSeen = t; S.lastActive = t; }

      var p = toP(m.value);
      var pp = S.prevP, pt = S.prevT;
      var sideP = null;
      if (m.sides) sideP = { left: m.sides.left === null ? null : toP(m.sides.left), right: m.sides.right === null ? null : toP(m.sides.right) };

      if (pp !== null) {
        if (S.phase === 'start') {
          if (p > Z) {
            S.phase = 'out';
            S.rep = newRep(interp(pt, pp, t, p, Z));
          }
        }
        if (S.phase === 'out') {
          var r = S.rep;
          S.lastActive = t;
          r.maxP = Math.max(r.maxP, p);
          if (sideP) ['left', 'right'].forEach(function (s) {
            if (sideP[s] !== null) r.sideMax[s] = r.sideMax[s] === null ? sideP[s] : Math.max(r.sideMax[s], sideP[s]);
          });
          if (sideP) {
            var lead = Math.max(sideP.left === null ? -9 : sideP.left, sideP.right === null ? -9 : sideP.right);
            if (lead >= F && r.tLeadFar === null) r.tLeadFar = S.prevLead !== null && S.prevLead < F ? interp(pt, S.prevLead, t, lead, F) : t;
            S.prevLead = lead;
          }
          if (p >= F && !r.reachedFar) { r.reachedFar = true; r.tFarIn = interp(pt, pp, t, p, F); r.tFarHoldStart = r.tFarIn; }
          if (r.reachedFar && pp >= F && p < F) r.tFarOut = interp(pt, pp, t, p, F);
          if (r.reachedFar && p >= F && pp < F) { r.tFarOut = null; r.tFarHoldStart = t; }

          // Stall: no progress in the lifting direction while mid-range
          if (inConcentric(r, p)) {
            var better = ex.concentric === 'out' ? p : -p;
            if (r.conBest === null || better > r.conBest + 0.03) { r.conBest = better; r.conImproved = t; }
            var mid = p > Z + 0.05 && p < F;
            if (mid && r.conImproved !== null) {
              var still = t - r.conImproved;
              if (still > 1300 && r.stall < 1) { r.stall = 1; events.push({ type: 'stall', level: 1 }); events.push({ type: 'cue', key: 'stall1', prio: 3, text: 'Drive!' }); }
              if (still > 3500 && r.stall < 2) {
                r.stall = 2; events.push({ type: 'stall', level: 2 });
                events.push({ type: 'cue', key: 'stall2', prio: 3, text: ex.rackable ? 'Rack it. Safety first.' : 'Set it down.' });
              }
            }
          } else if (ex.concentric === 'back' && r.reachedFar && p >= F && r.tFarHoldStart !== null && t - r.tFarHoldStart > 5000 && r.stall < 2) {
            r.stall = 2; events.push({ type: 'stall', level: 2 });
            events.push({ type: 'cue', key: 'stall2', prio: 3, text: ex.rackable ? 'Rack it. Safety first.' : 'Set it down.' });
          }

          if (p <= Z) {
            var tEnd = interp(pt, pp, t, p, Z);
            if (r.reachedFar) finishRep(tEnd, events);
            else if (r.maxP >= PARTIAL_MIN) {
              S.partials++;
              events.push({ type: 'partial', peak: r.maxP });
              if (cooled('partial', 2)) {
                S.cool.partial = S.reps;
                events.push({ type: 'cue', key: 'partial', prio: 1, text: partialCue(ex) });
              }
            }
            S.phase = 'start'; S.rep = null; S.lastActive = t;
          }
        }
      }
      S.prevP = p; S.prevT = t;

      // Auto end: resting at the start position after reps are done
      if (autoEnd && S.phase === 'start' && S.reps > 0 && S.lastActive !== null) {
        var limit = S.reps >= target ? idleAfter : idleBefore;
        if (t - S.lastActive > limit) { S.ended = true; events.push({ type: 'setEnd', reason: 'idle' }); }
      }

      events.push({ type: 'frame', ok: true, p: p, value: m.value, sides: m.sides, sideP: sideP, side: m.side, phase: S.phase });
      return events;
    }

    function summary() {
      var log = S.log;
      var asyms = log.filter(function (r) { return r.asym !== null; }).map(function (r) { return r.asym; });
      var last = log[log.length - 1];
      var failedInProgress = S.rep && (S.rep.stall > 0 || (ex.concentric === 'back' ? S.rep.reachedFar : S.rep.maxP >= PARTIAL_MIN)) ? 1 : 0;
      return {
        reps: S.reps, partials: S.partials, failed: S.failed + failedInProgress,
        bestVel: S.bestVel, lastLoss: last ? last.loss : 0,
        maxLoss: log.reduce(function (a, r) { return Math.max(a, r.loss); }, 0),
        avgAsym: asyms.length ? asyms.reduce(function (a, b) { return a + b; }, 0) / asyms.length : null,
        avgConMs: log.length ? log.reduce(function (a, r) { return a + r.conMs; }, 0) / log.length : null,
        avgEccMs: log.length ? log.reduce(function (a, r) { return a + r.eccMs; }, 0) / log.length : null,
        stalls: log.filter(function (r) { return r.stalled; }).length + (S.rep && S.rep.stall ? 1 : 0),
        log: log.map(function (r) { return { n: r.n, vel: Math.round(r.vel * 1000) / 1000, conMs: r.conMs, eccMs: r.eccMs, loss: Math.round(r.loss * 100) / 100, asym: r.asym === null ? null : Math.round(r.asym), lagging: r.lagging }; })
      };
    }

    return {
      update: update,
      summary: summary,
      markFailed: function () { S.failed++; },
      end: function () { S.ended = true; },
      get reps() { return S.reps; },
      get phase() { return S.phase; },
      range: { start: startVal, far: farVal }
    };
  }

  function partialCue(ex) {
    if (ex.concentric === 'back') {
      if (ex.id === 'squat') return 'Get deeper.';
      if (ex.id === 'push-up') return 'Chest lower.';
      return 'Full range. All the way down.';
    }
    if (ex.start === 'closed' && ex.metric.type === 'angle' && ex.metric.joints[1] === 'elbow') return 'Lock it out.';
    return 'Full range. All the way.';
  }

  // ───────────────────────────────────────────────────────────────
  // CALIBRATION — learn this person's range from two slow reps
  // ───────────────────────────────────────────────────────────────
  function createCalibrator(ex, o) {
    o = o || {};
    var reader = new MetricReader(ex, o);
    var minRange = ex.metric.type === 'span' ? 0.6 : 35;
    var lo = Infinity, hi = -Infinity, state = null, transitions = 0, v0 = null;
    var phaseExt = null, hiList = [], loList = [];
    var done = false, result = null;

    function update(frame) {
      var m = reader.read(frame);
      if (done) return { ok: m.ok, done: true, result: result, progress: 1, missing: m.missing, value: m.value };
      if (!m.ok) return { ok: false, done: false, progress: transitions / 4, missing: m.missing };
      var v = m.value;
      if (v0 === null) v0 = v;
      lo = Math.min(lo, v); hi = Math.max(hi, v);
      if (hi - lo >= minRange) {
        var mid = (hi + lo) / 2, band = (hi - lo) * 0.25;
        if (state === null) {
          // the lifter started at one end; credit that end as the first phase
          state = v0 > mid ? 'hi' : 'lo';
          phaseExt = state === 'hi' ? hi : lo;
        }
        var ns = v > mid + band ? 'hi' : (v < mid - band ? 'lo' : state);
        if (ns !== state) {
          if (state === 'hi') hiList.push(phaseExt);
          if (state === 'lo') loList.push(phaseExt);
          if (state !== null) transitions++;
          state = ns; phaseExt = v;
        } else if (state === 'hi') phaseExt = Math.max(phaseExt, v);
        else if (state === 'lo') phaseExt = Math.min(phaseExt, v);
        if (transitions >= 4) {
          // the phase just entered is still in motion, so only completed phases count
          var open = hiList.reduce(function (a, b) { return a + b; }, 0) / hiList.length;
          var closed = loList.reduce(function (a, b) { return a + b; }, 0) / loList.length;
          var defRange = Math.abs(ex.range.open - ex.range.closed);
          result = { open: round1(open), closed: round1(closed), small: (open - closed) < defRange * 0.45 };
          done = true;
        }
      }
      return { ok: true, done: done, result: result, progress: Math.min(1, transitions / 4), value: v, missing: [] };
    }
    return { update: update };
  }
  function round1(x) { return Math.round(x * 10) / 10; }

  // ───────────────────────────────────────────────────────────────
  // PROGRESSION — what to lift next time
  // sets: [{reps, failed, maxLoss, stalls}], prev: the session before (same exercise) or null
  // ───────────────────────────────────────────────────────────────
  function recommend(ex, unit, weight, targetReps, sets, prev, fatigue) {
    var inc = ex.inc[unit] || 0;
    var stop = fatigue ? fatigue.stop : 0.45;
    if (ex.bodyweight || !inc) {
      var all = sets.length && sets.every(function (s) { return s.reps >= targetReps; });
      return { weight: weight, delta: 0, note: all ? 'Every set hit target. Add a rep or two next time.' : 'Repeat this next time.' };
    }
    if (!sets.length) return { weight: weight, delta: 0, note: 'No sets logged.' };
    var hitAll = sets.every(function (s) { return s.reps >= targetReps && !s.failed; });
    var last = sets[sets.length - 1];
    var grind = last.maxLoss >= stop || last.stalls > 0;
    var missedBig = sets.filter(function (s) { return s.reps <= targetReps - 2 || s.failed; }).length;
    if (hitAll && !grind) return { weight: weight + inc, delta: inc, note: 'Every set hit target with speed to spare. Go up.' };
    if (hitAll && grind) return { weight: weight, delta: 0, note: 'Target hit, but the last set was a grind. Repeat it and own it.' };
    if (missedBig >= 2 && prev && prev.weight === weight && prev.missedBig >= 2) {
      var dl = Math.max(inc, Math.round(weight * 0.1 / inc) * inc);
      return { weight: Math.max(0, weight - dl), delta: -dl, note: 'Two tough sessions at this weight. Drop back and build up again.' };
    }
    return { weight: weight, delta: 0, note: 'Stay here until every set hits target.' };
  }

  // ───────────────────────────────────────────────────────────────
  // SIMULATOR — synthetic lifters for tests and the in-app demo
  // ───────────────────────────────────────────────────────────────
  function blankPose() {
    var lm = [], w = [];
    for (var i = 0; i < 33; i++) { lm.push({ x: 0.5, y: 0.5, z: 0, visibility: 0.05 }); w.push({ x: 0, y: 0, z: 0 }); }
    return { lm: lm, world: w };
  }
  function setPt(pose, name, X, Y, Z2, vis) {
    var i = LM[name];
    pose.world[i] = { x: X, y: Y, z: Z2 || 0 };
    // camera image: person faces camera, so their left appears on image right
    pose.lm[i] = { x: 0.5 + X * 0.62, y: 0.4 + Y * 0.62, z: Z2 || 0, visibility: vis === undefined ? 0.95 : vis };
  }
  function rot(dx, dy, deg) {
    var r = deg * Math.PI / 180;
    return { x: dx * Math.cos(r) - dy * Math.sin(r), y: dx * Math.sin(r) + dy * Math.cos(r) };
  }
  // Standing lifter facing the camera with elbows at the given angles (curl plane).
  function simCurlFigure(lA, rA, opts) {
    opts = opts || {};
    var p = blankPose();
    setPt(p, 'nose', 0, -0.68);
    [['left', 1, lA], ['right', -1, rA]].forEach(function (s) {
      var side = s[0], sx = s[1], ang = s[2];
      var vis = opts['vis_' + side] === undefined ? 0.95 : opts['vis_' + side];
      setPt(p, side + '_shoulder', 0.18 * sx, -0.5, 0, vis);
      setPt(p, side + '_elbow', 0.2 * sx, -0.22, 0, vis);
      var phi = (180 - ang) * Math.PI / 180;
      setPt(p, side + '_wrist', 0.2 * sx, -0.22 + 0.26 * Math.cos(phi), -0.26 * Math.sin(phi), vis);
      setPt(p, side + '_hip', 0.11 * sx, 0, 0, vis);
      setPt(p, side + '_knee', 0.12 * sx, 0.44, 0, vis);
      setPt(p, side + '_ankle', 0.12 * sx, 0.86, 0, vis);
    });
    return p;
  }
  // Generic chain: the tracked joint at the origin with the given angle.
  // Side view puts the far side behind the body with low visibility.
  function simChain(ex, vals, opts) {
    opts = opts || {};
    var p = blankPose();
    if (ex.metric.type === 'span') {
      var half = vals.left / 2 * 0.36;
      setPt(p, 'left_shoulder', 0.18, -0.5, 0); setPt(p, 'right_shoulder', -0.18, -0.5, 0);
      setPt(p, 'left_elbow', Math.max(0.2, half * 0.9), -0.48, -0.15); setPt(p, 'right_elbow', -Math.max(0.2, half * 0.9), -0.48, -0.15);
      setPt(p, 'left_wrist', half, -0.47, -0.3); setPt(p, 'right_wrist', -half, -0.47, -0.3);
      return p;
    }
    var j = ex.metric.joints;
    ['left', 'right'].forEach(function (side, k) {
      var v = vals[side];
      if (v === undefined || v === null) return;
      var vis = opts['vis_' + side];
      if (vis === undefined) vis = ex.view === 'side' && side === 'right' ? 0.15 : 0.95;
      var ox = ex.view === 'front' ? (k === 0 ? 0.2 : -0.2) : 0;
      var oz = ex.view === 'side' && side === 'right' ? 0.25 : 0;
      setPt(p, side + '_' + j[1], ox, 0, oz, vis);
      setPt(p, side + '_' + j[0], ox, -0.3, oz, vis);
      var d = rot(0, -0.3, v);
      setPt(p, side + '_' + j[2], ox + d.x, d.y, oz, vis);
    });
    return p;
  }

  // Build a timed stream of frames from a rep plan.
  // plan: [{ dur, from: {left,right}, to: {left,right} }] segments; fps default 30
  function simStream(ex, plan, opts) {
    opts = opts || {};
    var fps = opts.fps || 30, t = opts.t0 || 0, frames = [];
    var rnd = seeded(opts.seed || 7);
    plan.forEach(function (seg) {
      var n = Math.max(1, Math.round(seg.dur * fps));
      for (var i = 0; i < n; i++) {
        var k = n === 1 ? 1 : i / (n - 1);
        var e = seg.hold ? 0 : 0.5 - 0.5 * Math.cos(Math.PI * k);
        var vals = {};
        ['left', 'right'].forEach(function (s) {
          var a = seg.from[s], b = seg.to[s];
          if (a === undefined || a === null) { vals[s] = null; return; }
          vals[s] = a + (b - a) * e + (opts.noise ? (rnd() - 0.5) * 2 * opts.noise : 0);
        });
        var pose = ex.id === 'curl' && !opts.chain ? simCurlFigure(vals.left, vals.right, seg.opts || opts) : simChain(ex, vals, seg.opts || opts);
        if (seg.lost) pose.lm.forEach(function (q) { q.visibility = 0.05; });
        frames.push({ t: t, lm: pose.lm, world: pose.world, aspect: 0.75 });
        t += 1000 / fps;
      }
    });
    return frames;
  }
  function seeded(s) {
    return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }

  var api = {
    LM: LM, EXERCISES: EXERCISES, byId: function (id) { return BY_ID[id]; },
    Z: Z, F: F, angle3: angle3, OneEuro: OneEuro, MetricReader: MetricReader,
    createEngine: createEngine, createCalibrator: createCalibrator, recommend: recommend,
    sim: { curlFigure: simCurlFigure, chain: simChain, stream: simStream }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GymEngine = api;
})(typeof window !== 'undefined' ? window : this);
