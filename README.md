# GymOS

**Camera-based gym spotter. Counts your reps, tracks bilateral asymmetry, and calls out your form — so you can zone out and lift.**

---

## What this is

GymOS is a single-file web app that turns your phone into a spotter.

You prop your phone against your water bottle, scan a QR code on the machine, and lift. The camera watches you. It counts your reps out loud. It tracks whether your left arm is keeping up with your right. If your form breaks down or your velocity drops — signs of muscle failure — it tells you. When the set is done, it tells you to rest, counts down your rest timer, and tells you when to go again.

You never touch the screen during a set. You never count in your head. You just lift.

Every exercise app has videos showing you how to do a movement. None of them watch you do it and say *"hey, your left arm isn't coming up as high as your right — fix that."* None of them count for you automatically so your mind can disengage and actually focus on the muscle. GymOS does both.

---

## What problem it solves

When you lift with a training partner, something changes. You stop counting. You stop monitoring yourself. You zone out and just move the weight. That mental offloading is not a comfort feature — it produces better muscle activation. Internal focus (thinking about the muscle contracting) outperforms external focus (counting, watching the clock, monitoring form in a mirror) by a measurable margin.

Every existing app makes you *more* engaged with your screen during a set. GymOS makes you *less* engaged. The screen goes to your peripheral vision. The voice handles everything. Including the commands — you never have to touch the phone at all.

---

## How it works

- **Scan a QR code** on the machine. The app loads the exercise config automatically — which joints to track, what angles define a rep, how to detect asymmetry.
- **Prop your phone** in the stand on the machine. Rear camera points at you.
- **Lift.** The app tracks both sides independently using on-device pose detection (MediaPipe). No cloud. No latency. Your data stays on your device.
- **Voice calls each rep** the moment you return to the bottom position — confirming full range of motion was completed. No half-rep credit.
- **Bilateral asymmetry** is tracked continuously. If your left arm peaks 15% lower than your right across recent reps, the app says "left arm lagging." Not a video tip. Your body, right now, this set.
- **Velocity failure detection** builds a baseline from your first three reps and watches for slowdown. If your reps start taking 30% longer than your baseline, it tells you to consider ending the set.
- **Voice commands** let you control the entire session hands-free. Say "next set," the app confirms "Ending set," then executes. No touching the screen mid-lift.
- **Rest timer** counts down automatically between sets, speaks the last three seconds, and cues "Go" when it's time.
- **Session summary** shows total reps, average asymmetry, failure alerts, and — based on your progression schema — what weight to use next session.

---

## Voice commands

GymOS listens continuously during your session. Commands are context-aware — rest commands won't fire mid-set and vice versa. Every command is confirmed out loud before it executes.

| Say | When | Result |
|---|---|---|
| "next set" / "set done" / "done" / "end set" | Lifting | Ends set, starts rest timer |
| "skip rest" / "go" / "next" | Resting | Skips rest, starts next set |
| "pause" / "stop" | Lifting | Freezes rep detection |
| "resume" / "continue" | Paused | Resumes session |
| "failure" / "muscle failure" | Lifting | Logs failure, alerts on screen |
| "end session" / "finish session" | Lifting or resting | Goes to session summary |

The mic indicator sits in the lower left of the camera view. It pulses green when listening, amber when a command was heard.

> **Browser note:** Chrome on Android is the most reliable for both camera and voice recognition. Safari on iOS works but may require re-granting microphone permissions between sessions. Firefox does not support the Web Speech API.

---

## Tech stack

- Vanilla HTML/CSS/JS — single file, no build step, no dependencies to install
- [MediaPipe Pose](https://google.github.io/mediapipe/solutions/pose) — on-device skeleton tracking, 33 landmarks at ~30fps
- Web Speech API (SpeechSynthesis + SpeechRecognition) — voice output and voice commands through any connected audio device
- GitHub Pages — deploy directly, no server required

---

## Current build status

### Done — v4

- [x] Schema-driven exercise engine — exercises defined as JSON config objects, not hardcoded logic
- [x] Landmark alias map — human-readable joint names (`left_elbow`) resolve to MediaPipe indices internally
- [x] Bilateral elbow angle tracking — both arms tracked independently every frame
- [x] Rep detection on descend — rep counts when you return to bottom, confirming full range completed
- [x] Velocity failure detection — baseline built from first 3 reps, alerts fire when reps slow 30%+
- [x] Bilateral asymmetry detection — peak flexion compared across recent reps, lagging side identified and spoken
- [x] Full extension form rule — alerts if elbows not returning to full extension at bottom
- [x] Form rule engine — rules evaluated as typed configs, new rule types added without touching core logic
- [x] Voice rep counting — each rep spoken on completion, no screen interaction required
- [x] Voice command engine — continuous listening, context-aware command matching, confirmation before execution
- [x] Pause / resume via voice
- [x] Set and rest management — rest timer with spoken countdown, auto-advance to next set
- [x] Skip rest via voice
- [x] Progression logic — session summary calculates next session weight based on whether rep target was hit
- [x] Session summary screen — total reps, avg asymmetry, failure alerts, next weight
- [x] Single HTML file — deployable to GitHub Pages with no build step
- [x] Cadence tone engine — Web Audio API tones through earbuds guiding concentric, hold, and eccentric phases
- [x] Cadence schema per exercise — tempo configurable (concentric secs, hold secs, eccentric secs, tone frequencies)
- [x] Cadence phase indicator — HUD shows CURL / HOLD / LOWER in sync with tones
- [x] Cadence resets cleanly between sets and on session end

**Exercise library:** Dumbbell Curl (bilateral elbow flexion)

---

## Roadmap to completion

### Phase 3 — QR + URL parameter loading ← next
Each machine gets a QR code that encodes the exercise and program parameters as URL query strings:
```
gymos.app/?exercise=lat-pulldown&weight=120&reps=10&sets=4
```
App reads parameters on load, skips the setup screen, goes straight to that exercise. Gym puts the QR on the machine stand. User scans, their program is pre-loaded. This is the feature that makes the gym partnership model work.

### Phase 4 — Local memory
`localStorage` stores your last session per exercise: weight, reps completed, asymmetry log. Next time you scan that machine's QR, the app already knows what you did. Progressive overload logic fires automatically — hit your target, next session bumps the weight by the configured increment. No manual entry. No app account required.

### Phase 5 — Exercise library expansion
Add the major movement patterns, each as a schema entry:

- **Pull:** Lat pulldown, seated cable row, face pull
- **Push:** Dumbbell shoulder press, chest press, lateral raise
- **Hinge:** Romanian deadlift, cable pull-through
- **Squat:** Goblet squat, leg press
- **Isolation:** Tricep pushdown, hammer curl, bicep curl machine

Each exercise defines its own joint angles, form rules, and progression increment. The engine handles all of them without modification.

### Phase 6 — Program layer
A workout program is a JSON file — ordered list of exercises, sets, reps, and rest periods. Load it once. The app routes you machine to machine through your full session. "Next: Seated Row — Bay 7." Supports push/pull/legs splits, full body, upper/lower — any structure expressible as an ordered list.

### Phase 7 — Gym integration
- QR stand hardware spec — standardized phone mount dimensions for machine attachment
- Gym admin dashboard — aggregate anonymized usage data per machine
- Per-machine licensing model — gyms pay a flat monthly fee per active machine
- Onboarding flow for gym staff to configure and assign QR codes to machines

### Phase 8 — Backend and multi-device sync
- Supabase backend — user accounts, session history, program assignment
- History sync across devices
- Coach/trainer accounts — assign programs to clients, view session data
- Export to common fitness formats (CSV, Apple Health, Google Fit)

---

## Running it

No installation. No build step.

1. Download `index.html`
2. Open in Chrome on Android or Safari on iOS
3. Allow camera and microphone access when prompted
4. Prop your phone so the camera has a clear view of both arms
5. Configure your set, rep, and weight targets on the start screen
6. Lift

Or deploy to GitHub Pages:

1. Fork this repo
2. Go to Settings → Pages
3. Set source to main branch, root folder
4. Your app is live at `yourusername.github.io/gymos`

---

## Camera setup tips

- Portrait orientation is easier to prop than landscape
- 3–8 feet of distance from the camera
- Make sure both arms are fully visible in frame throughout the movement
- Good lighting matters — the pose model struggles in low light
- For best bilateral tracking, face the camera straight on
- A water bottle or gym bag works as a stand — anything that holds the phone stable at roughly waist height

---

## Contributing

The exercise schema is designed to be extended. To add a new exercise:

1. Add any new landmark aliases to `LANDMARKS` if joints beyond the current set are needed
2. Define the exercise config object in `EXERCISES` following the existing schema
3. Implement any new `form_rule` types in the engine if the existing types don't cover the movement
4. Test rep detection by confirming the angle range on yourself before committing

Pull requests for new exercises, new form rule types, and camera setup improvements are welcome.

---

## Architecture note

GymOS runs entirely on-device. MediaPipe Pose inference happens locally in the browser — no video is transmitted anywhere. Voice recognition runs through the browser's Web Speech API, which on most platforms also processes locally. No account is required. No data leaves the device until Phase 8 (opt-in backend sync).

This is intentional. A gym is a place people go to focus. The last thing the app should do is add network latency, login friction, or surveillance overhead to that experience.

---


---

## Built by

James Keith Harwood II
Sentinel AI Systems — Antonito, Colorado
[jameskeithharwood.com](https://www.jameskeithharwood.com)
Built for Mike Simone based on his original concept
---

## License

Copyright (c) 2026 James Keith Harwood II — Sentinel AI Systems. All Rights Reserved.

This software may not be copied, modified, distributed, or used in any commercial
setting without express written permission from the copyright holder. Viewing and
personal evaluation are permitted.

The concepts embodied in this software — including camera-based bilateral asymmetry
detection during strength training, schema-driven exercise configuration, on-device
rep counting via pose estimation, voice-commanded gym sessions, and QR-code-driven
workout delivery to gym machines — constitute documented prior art originating with
James Keith Harwood II, established through timestamped development records in 2026.

For commercial licensing and partnership inquiries: [jameskeithharwood.com](https://www.jameskeithharwood.com)

See [LICENSE](./LICENSE) for full terms.
