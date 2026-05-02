# GymOS

**Camera-based gym spotter. Counts your reps, tracks bilateral asymmetry, and calls out your form — so you can zone out and lift.**

**[Try it now →](https://jkh2.github.io/gymos)**

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

- **Select your exercise** from the start screen. The app loads the correct joint tracking, rep angles, and form rules automatically.
- **Prop your phone** using the camera position hint shown for each exercise — front view for curls and presses, side view for squats and deadlifts.
- **Lift.** The app tracks both sides independently using on-device pose detection (MediaPipe). No cloud. No latency. Your data stays on your device.
- **Voice calls each rep** the moment you return to the bottom position — confirming full range of motion was completed. No half-rep credit.
- **Bilateral asymmetry** is tracked continuously. If your left arm peaks 15% lower than your right across recent reps, the app says "left arm lagging." Not a video tip. Your body, right now, this set.
- **Velocity failure detection** builds a baseline from your first three reps and watches for slowdown. If your reps start taking 30% longer than your baseline, it tells you to consider ending the set.
- **Cadence tones** guide your tempo through earbuds — a high tone to start the lift, a mid tone to hold, a low tone to lower. Three tones per rep. Nothing else.
- **Voice commands** let you control the entire session hands-free. Say "next set," the app confirms "Ending set," then executes.
- **Rest timer** counts down automatically between sets, speaks the last three seconds, and cues "Go" when it's time.
- **Session summary** shows total reps, average asymmetry, failure alerts, and what weight to use next session.

---

## Exercise library

| Exercise | Movement | Joints tracked | Camera position |
|---|---|---|---|
| Dumbbell Curl | Flexion | Shoulder → Elbow → Wrist | Face camera |
| Shoulder Press | Extension | Shoulder → Elbow → Wrist | Face camera |
| Bench Press | Extension | Shoulder → Elbow → Wrist | Side view |
| Incline Press | Extension | Shoulder → Elbow → Wrist | Side view |
| Squat | Extension | Hip → Knee → Ankle | Side view |
| Deadlift | Extension | Shoulder → Hip → Knee | Side view |
| Pec Fly | Flexion | Hip → Shoulder → Wrist | Side view · limited accuracy |

The engine handles both flexion (angle decreases toward peak) and extension (angle increases toward peak) movements correctly. Bilateral asymmetry comparison, peak tracking, and phase bar direction all branch on movement type automatically. Adding a new exercise is a matter of defining its schema object — no engine changes required.

---

## Voice commands

GymOS listens continuously during your session. Commands are context-aware — rest commands won't fire mid-set and vice versa. Every command is confirmed out loud before it executes.

| Say | When | Result |
|---|---|---|
| "next set" / "set done" / "done" / "end set" | Lifting | Ends set, starts rest timer |
| "skip rest" / "go" / "next" | Resting | Skips rest, starts next set |
| "pause" / "stop" | Lifting | Freezes rep detection and cadence |
| "resume" / "continue" | Paused | Resumes session and cadence |
| "failure" / "muscle failure" | Lifting | Logs failure, alerts on screen |
| "end session" / "finish session" | Lifting or resting | Goes to session summary |

The mic indicator sits in the lower left of the camera view. It pulses green when listening, amber when a command was heard.

> **Browser note:** Chrome on Android is the most reliable for both camera and voice recognition. Safari on iOS works but may require re-granting microphone permissions between sessions. Firefox does not support the Web Speech API.

---

## Tech stack

- Vanilla HTML/CSS/JS — single file, no build step, no dependencies to install
- [MediaPipe Pose](https://google.github.io/mediapipe/solutions/pose) — on-device skeleton tracking, 33 landmarks at ~30fps
- Web Speech API (SpeechSynthesis + SpeechRecognition) — voice output and voice commands
- Web Audio API — cadence tones, no external audio files
- GitHub Pages — deploy directly, no server required

---

## Current build status

### Done — v4

- [x] Schema-driven exercise engine — exercises defined as config objects, not hardcoded logic
- [x] `movement_type` field — engine handles both flexion and extension movements correctly
- [x] Landmark alias map — human-readable joint names resolve to MediaPipe indices internally
- [x] Bilateral tracking — both sides tracked independently every frame, peak comparison correct for both movement types
- [x] Rep detection on descend — rep counts when you return to bottom, confirming full range completed
- [x] Velocity failure detection — baseline from first 3 reps, alerts on 30%+ slowdown
- [x] Bilateral asymmetry detection — lagging side identified and spoken
- [x] Form rule engine — stackable typed rules per exercise (`bilateral_peak_diff`, `angle_floor`, `angle_ceiling`)
- [x] Squat depth check — `angle_ceiling` rule fires during descent, not after
- [x] Voice rep counting — each rep spoken, no screen interaction required
- [x] Voice command engine — continuous listening, context-aware, confirms before executing
- [x] Cadence tone engine — three-phase audio guide (UP / HOLD / DOWN), tone gate prevents stacking
- [x] Cadence per exercise — hold phase skipped automatically for exercises that don't use it
- [x] Exercise selector — start screen grid, tap to select, weight auto-fills to exercise default
- [x] Camera position hint — displayed on live view per exercise
- [x] Set and rest management — rest timer with spoken countdown, auto-advance
- [x] Progression logic — session summary calculates next session weight
- [x] Session summary screen — total reps, avg asymmetry, failure alerts, next weight
- [x] Proprietary license — all rights reserved, prior art on record
- [x] Single HTML file — deployable to GitHub Pages with no build step

**Exercise library:** Dumbbell Curl, Shoulder Press, Bench Press, Incline Press, Squat, Deadlift, Pec Fly

---

## Roadmap to completion

### Phase 3 — QR + URL parameter loading ← next
Each machine gets a QR code that encodes the exercise and program parameters as URL query strings:
```
gymos.app/?exercise=squat&weight=135&reps=5&sets=4
```
App reads parameters on load, skips the setup screen, goes straight to that exercise. Gym puts the QR on the machine stand. User scans, their program is pre-loaded. This is the feature that makes the gym partnership model work.

### Phase 4 — Local memory
`localStorage` stores your last session per exercise: weight, reps completed, asymmetry log. Next time you scan that machine's QR, the app already knows what you did. Progressive overload logic fires automatically — hit your target, next session bumps the weight by the configured increment. No manual entry. No app account required.

### Phase 5 — Additional exercises
The schema is ready. Priority additions based on real user needs: lat pulldown, seated cable row, Romanian deadlift, tricep pushdown, hammer curl, lateral raise. Each is a schema entry — no engine changes needed.

### Phase 6 — Program layer
A workout program is an ordered list of exercises, sets, reps, and rest periods. Load it once. The app routes you machine to machine through your full session. "Next: Bench Press." Supports any split structure expressible as an ordered list.

### Phase 7 — Gym integration
- QR stand hardware spec — standardized phone mount for machine attachment
- Gym admin dashboard — aggregate anonymized usage per machine
- Per-machine licensing model
- Onboarding flow for gym staff

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
4. Select your exercise on the start screen
5. Note the camera position hint — face camera or side view depending on the exercise
6. Prop your phone accordingly and lift

Or deploy to GitHub Pages:

1. Fork this repo
2. Go to Settings → Pages
3. Set source to main branch, root folder
4. Your app is live at `yourusername.github.io/gymos`

---

## Camera setup tips

- Portrait orientation is easier to prop than landscape
- 3–8 feet of distance from the camera
- Good lighting matters — the pose model struggles in low light
- For face-camera exercises (curl, shoulder press): stand straight on to the camera
- For side-view exercises (squat, deadlift, bench, pec fly): position the camera perpendicular to your movement plane so the full joint arc is visible
- A water bottle, gym bag, or any stable object works as a stand
- Pec fly tracking is limited — the movement happens in the transverse plane which a single phone camera cannot capture accurately. Rep counting may work but bilateral asymmetry readouts will be unreliable. Machine fly or cable fly tracks better.
---

## Contributing

The exercise schema is designed to be extended. To add a new exercise:

1. Add any new landmark aliases to `LANDMARKS` if joints beyond the current set are needed
2. Determine `movement_type` — flexion if angle decreases toward peak, extension if it increases
3. Define the exercise config object in `EXERCISES` following the existing schema
4. Add appropriate `form_rules` — `bilateral_peak_diff` for asymmetry, `angle_floor` for extension checks, `angle_ceiling` for depth checks
5. Test rep detection by confirming the angle range on yourself before committing

Pull requests for new exercises, new form rule types, and camera setup improvements are welcome.

---

## Architecture note

GymOS runs entirely on-device. MediaPipe Pose inference happens locally in the browser — no video is transmitted anywhere. Voice recognition runs through the browser's Web Speech API, which on most platforms also processes locally. No account is required. No data leaves the device until Phase 8 (opt-in backend sync).

This is intentional. A gym is a place people go to focus. The last thing the app should do is add network latency, login friction, or surveillance overhead to that experience.

---

## Built by

James Keith Harwood II
Sentinel AI Systems — Antonito, Colorado
[jameskeithharwood.com](https://www.jameskeithharwood.com)

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
