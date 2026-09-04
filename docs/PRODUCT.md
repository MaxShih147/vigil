# vigil box — product & architecture plan

> 放在機器旁邊，看著它做完該做的事；做壞了，在還來得及的時候說。

**Status:** planning. Recording/delivery platform is built and running;
inspection is the next build. Nothing in §6 exists yet.
**Anchor use case:** MSLA / resin 3D printing — *is the object printing
correctly?*
**Audience:** anyone who needs to understand, diagram, or build this system.
This document is self-contained; it does not assume you have read the code.

---

## 1. What the product is

A self-contained box you put next to a machine. It watches the machine work
through a camera, decides whether the work is going right, and reports that
judgement to three places: a cloud dashboard, a screen at the machine, and a
notification channel.

It attaches to machines it was never designed for. No integration with the
machine's controller, no API, no vendor cooperation, no cable into the
machine — the box learns the machine's rhythm by looking at it. That
constraint is the product; everything in §4 exists to honour it.

The system today already does the boring half: capture video, segment it,
ship it to object storage, report device health to a dashboard, and accept
remote commands. This plan adds the half that makes it worth buying —
judgement.

---

## 2. Why resin 3D printing is the first target

The pain is unusually easy to quantify, which makes the box easy to sell and
easy to evaluate honestly.

A resin print runs 4–12 hours unattended. The dominant failure — the part
detaching from the build plate — typically happens in the first 10% of the
print, and the printer has no idea it happened. It keeps cycling for the
remaining ten hours, curing nothing, while:

- the resin in the vat is consumed and partly cured into a solid blob,
- that blob risks puncturing the FEP film — a consumable, and a resin spill
  if it goes,
- the machine-hours are gone,
- and the deadline slips by a full print cycle, because nobody finds out
  until morning.

Catching it within one layer — roughly ten seconds — turns a ruined night
into a twenty-minute setback. There is no ambiguity about whether the box
paid for itself.

**Buyers:** operations running several printers where attention does not
scale — dental and orthodontic labs, jewellery wax casting, model and figure
print farms, prototyping shops, university labs. A print farm running eight
machines is the ideal first customer: the value scales with machine count,
their attention does not, and they are small enough to sell to without a
twelve-month enterprise cycle.

**This is explicitly not AOI.** We are not judging a finished part against a
tolerance. We answer a cheaper and more valuable question: *is this run still
worth continuing?* That reframing is what lets one box work on machines we
have never seen, and it is the difference between a hard computer-vision
product and a tractable one.

---

## 3. Physical constraints — the part that decides whether this works

Everything downstream depends on getting a usable image. Resin printing is
actively hostile to cameras. Stating the problems precisely, because the
mount and light design follows directly from them:

**Geometry.** In MSLA the object grows *downward* from the build plate. Each
layer is cured at the bottom of the object, against the FEP film at the
bottom of the vat; then the plate lifts by one layer thickness. So the object
hangs upside down beneath the plate, and the fraction of it visible above the
resin surface *grows* as the print proceeds. Early layers — exactly when
detachment is most likely — are the hardest to see, because the object is
still down at the resin surface. This is the single most awkward fact about
the problem, and §5 explains how the detection ladder works around it.

**Contrast.** The object is dripping wet, translucent, and usually grey or
black, hanging above a vat of the same grey or black resin. There is very
little separating figure from ground.

**Light.** The interior is dark, and you cannot simply add a white LED: its
blue component slowly cures the resin surface in the vat over a long print.
Illumination must sit above roughly 600 nm — deep red (620–660 nm) or
near-IR (850 nm) — wavelengths the photopolymer is effectively blind to.

**The hood, which turns out to be an asset.** The orange UV-blocking cover
exists to keep short wavelengths *out*. It is therefore highly transparent to
exactly the red and near-IR light we want to use. The camera does not have to
live inside the hood among the fumes and heat, and does not have to be
re-aimed every time the operator opens the lid: **mount it outside, light
from outside, shoot through the cover.** The cost is acrylic reflection,
handled with an off-axis mounting angle and, if needed, a polarising filter.

### Recommended optical setup

| | v1 (uses the USB webcam the platform already supports) | Productised |
| --- | --- | --- |
| Camera | UVC webcam, **exposure/white-balance/focus locked to manual** | Pi Camera Module 3 NoIR |
| Light | 620–660 nm red LED strip, diffused, mounted off-axis | 850 nm IR illuminator — invisible to the operator |
| Position | Side view at build-plate height, ~20–30° off the hood normal | Same, articulated arm on a magnetic base |
| Framing | Plate travel range fills the frame vertically; vat rim visible as a fixed reference | Same |

**Auto-exposure must be disabled.** A camera that re-exposes as the object
grows destroys the frame-to-frame comparison that everything in §5 depends
on. This is a hard requirement, not a tuning preference.

---

## 4. The core insight

A resin printer is a metronome. Every layer it performs the same motion:
lift the plate, dwell, descend, expose, repeat — thousands of times, with
mechanical repeatability.

That yields something a general-purpose monitoring camera never gets: if we
sample **one frame per cycle at the same phase of the motion** — at the top
of the lift, after the object has drained and settled — the resulting image
stack is *already registered*. No alignment, no pose estimation. Frame 842
and frame 843 differ by one layer of 0.05 mm, which is to say they differ by
nothing. Any meaningful frame-to-frame difference is therefore signal, and
the noise floor is set by drips and reflections rather than by camera motion.

Two consequences worth stating plainly:

- **The cycle is detected from the video alone.** We watch for the periodic
  motion signature and lock onto it. We never ask the printer. This is what
  keeps the "clips onto any machine" promise, and it generalises directly to
  any other cyclic machine (§10).
- **The per-layer frame stack is a layer-by-layer timelapse for free** — a
  feature users already want, falling out of the pipeline at zero extra cost.

---

## 5. Detection ladder

Built in this order. Each level is independently shippable and useful
without the levels above it.

| | What it checks | Catches | Runs where | Cost |
| --- | --- | --- | --- | --- |
| **L0** | Is the machine still cycling, at the expected period? | finished, jammed, crashed, powered off, mid-print stall | edge | negligible |
| **L1** | Is anything still hanging from the plate? (silhouette vs. learned empty-plate baseline) | **detachment — the #1 failure** | edge, OpenCV | ms/layer |
| **L2** | Frame N vs N−1; is the silhouette growing monotonically? | delamination, support failure, partial drop-off | edge, OpenCV | ms/layer |
| **L3** | Observed silhouette vs. expected cross-section from the sliced file | wrong file printed, missing regions, dead LCD pixels | edge + slicer parse | ms/layer |
| **L4** | Cloud model reads the flagged frame | failure vs. reflection, failure classification, plain-language explanation | cloud | a few calls/print |

**L1 is the product.** L0 is a day's work and makes the box useful
immediately. L2 is where it starts feeling intelligent. L3 is the real moat:
we have the sliced file, so we know what the object is *supposed* to look
like at every layer — nobody doing generic anomaly detection has that
reference. L4 is what turns a threshold crossing into something a human
trusts at 3 a.m.

**On the early-layer problem from §3:** even when the object is too close to
the resin surface to segment cleanly, detachment remains detectable, because
after it happens the silhouette **stops growing** while the plate keeps
rising. Monotonic growth is a weaker signal than direct segmentation, but it
degrades gracefully and it covers precisely the window where segmentation is
worst. L1 and L2 are therefore complementary, not redundant.

---

## 6. System architecture

### 6.1 Deployment topology and trust boundaries

Four zones, three of which already exist:

| Zone | Contents | Notes |
| --- | --- | --- |
| **Machine** | The resin printer. Camera + light aimed at it. | Not networked to us. We never touch it in v1. |
| **Edge (the box)** | Raspberry Pi 5, USB webcam, red/IR light, optional HDMI screen. Four services. | Behind workshop NAT. Runs standalone when the network is down. |
| **Cloud** | Next.js app on Vercel, Postgres (Neon), object storage (Cloudflare R2), cloud judge model. | |
| **Clients** | Browser (dashboard), kiosk screen at the machine, phone notification. | |

**The controlling network fact:** the Pi is behind NAT with no inbound
reachability. *Every* edge→cloud interaction is an outbound call initiated by
the Pi. There is no push channel to the device; remote control works by the
device polling a command queue. Any diagram must show all arrows crossing the
NAT boundary originating on the edge side.

Object storage is written by the edge and read *directly* by browsers via
presigned URLs — video bytes never transit the Vercel functions. This is
deliberate (egress cost) and should appear as a distinct data path.

### 6.2 Component inventory

**Edge services** (independent processes, each restartable alone):

| Component | State | Responsibility |
| --- | --- | --- |
| `recorder` | exists | Owns the camera. Runs one ffmpeg process producing two outputs (see 6.3). Segments video into rolling 10-minute mp4 files. |
| `uploader` | exists | Scans for finalised mp4s and event thumbnails, ships them to object storage, moves or deletes locals. Retries on failure. |
| `agent` | exists | Posts device health every 10 s; pulls and executes queued commands; posts results; runs local disk cleanup. |
| `inspector` | **new** | The judgement engine. Consumes frames, locks onto the machine cycle, learns a baseline, runs L0–L3, emits events into a local queue. |
| `slice-parser` | **new** | Library, not a service. Parses `.ctb` / `.pwmx` / `.sl1` into expected per-layer cross-section area for L3. |
| `kiosk` | **new** | Chromium in full-screen kiosk mode on the Pi's HDMI output, pointed at a cloud route, with a local fallback page. |

**Cloud components:**

| Component | State | Responsibility |
| --- | --- | --- |
| Dashboard app | exists | Auth (Google OAuth + email allowlist), recordings browser, device list, remote commands. |
| Device API | exists | Bearer-token endpoints the Pi calls: heartbeat, command pull, command result. |
| Events API | **new** | Receives inspection events and job lifecycle from the edge. |
| Cloud judge | **new** | Server-side. Sends a flagged frame to a vision model, stores the verdict, decides whether to notify. |
| Job & event UI | **new** | Per-print timeline with thumbnails, layer numbers, verdicts, and the layer timelapse. |
| Kiosk route | **new** | Machine-side status page, designed for glanceability at three metres. |
| Notifier | **new** | Fan-out to webhook / chat / push on confirmed failure. |

### 6.3 Camera ownership — the one genuinely new architectural problem

A USB webcam cannot be opened by two processes. `recorder` already holds it,
and `inspector` needs frames. Three options were considered:

1. *inspector owns the camera and re-encodes video* — collapses two clean
   services into one, and puts the recording path at the mercy of inspection
   bugs. Rejected.
2. *`v4l2loopback` to fan the device out* — needs an out-of-tree kernel
   module on every box, a support burden on a fleet appliance. Rejected.
3. **ffmpeg stays the single camera owner and tees a second output.**
   Chosen.

`recorder`'s existing ffmpeg invocation gains a second mapped output: the
current segmented mp4 for post-mortem review, plus a low-rate still stream
(~5 fps, downscaled) written to a small numbered ring buffer on `tmpfs`
(`/dev/shm`) so it never touches the SD card. `inspector` reads the newest
complete frame from the ring.

This keeps each service's responsibility intact, adds no kernel dependency,
survives inspector crashes without interrupting recording, and costs one
ffmpeg output filter. The frame rate is deliberately low: cycle detection
needs to resolve a multi-second lift stroke, not motion blur.

*Open item for Phase 1:* confirm the ring buffer gives torn-free reads under
load, and confirm 5 fps resolves the lift/dwell transition on real machines.

### 6.4 The inspection pipeline

Stages inside `inspector`, in order. Each stage's output is the next one's
input; this is the primary dataflow diagram.

| # | Stage | In | Out |
| --- | --- | --- | --- |
| 1 | **Frame source** | `/dev/shm` ring | newest complete frame, ~5 fps |
| 2 | **Motion signal** | frame | scalar: mean absolute difference vs. previous frame, within the plate ROI → a 1-D signal over time |
| 3 | **Cycle lock** | motion signal | detected period + current phase; confidence. Locks by autocorrelation / peak spacing on the motion signal. |
| 4 | **Phase-locked capture** | frames + phase | one *layer frame* per cycle, taken during the quiet dwell at the top of the lift (median of a few frames to suppress drips) |
| 5 | **Baseline learn** | first N layer frames of a run marked good | plate ROI, empty-plate silhouette, noise floor, expected cycle period |
| 6 | **Feature extraction** | layer frame | silhouette mask, area, bounding box, centroid |
| 7 | **Checks** | features + baseline (+ slice data) | L0/L1/L2/L3 verdicts with confidence |
| 8 | **Debounce & escalate** | verdict stream | requires *k* consecutive agreeing layers before raising; assigns severity |
| 9 | **Event emit** | raised event | row in a local SQLite queue + a cropped thumbnail on disk |
| 10 | **Delivery** | queue | `agent` posts events when the network is up; `uploader` ships thumbnails. Survives outages by design. |

Stage 8 is where false-positive rate is actually controlled, and it is the
stage most likely to need tuning against real footage. Stage 5 is why every
install must *learn* rather than ship with fixed thresholds — different
printer, hood, bench, and angle every time.

### 6.5 Print job state machine

A **job** is one print run. The edge infers job boundaries from the cycle —
it is not told when a print starts.

| State | Meaning | Exits to |
| --- | --- | --- |
| `IDLE` | No cycle detected. Machine off or finished. | `LEARNING` when periodic motion appears |
| `LEARNING` | Cycle detected, acquiring period and baseline. | `RUNNING` on lock; `IDLE` if motion stops |
| `RUNNING` | Locked, checks active, layers counting. | `SUSPECT`, `COMPLETED`, `LOST` |
| `SUSPECT` | A check fired; holding for debounce and cloud confirmation. | `RUNNING` if it clears; `FAILED` if confirmed |
| `FAILED` | Confirmed failure. Notified. | `IDLE` on operator acknowledgement |
| `COMPLETED` | Cycling stopped cleanly after a plausible layer count. | `IDLE` |
| `LOST` | Camera obstructed, moved, or cycle lock broken — *we can no longer judge*. | `LEARNING` on recovery |

`LOST` is a first-class state, not an error. A box that silently produces
garbage after someone knocks the camera is worse than one that says "I can't
see any more" — and this state is what makes the difference.

### 6.6 Event lifecycle

The escalation path, end to end:

1. `inspector` raises a verdict at layer *N* (edge, L0–L3).
2. Debounce holds it for *k* layers. Most noise dies here.
3. Event written to the local queue with a cropped thumbnail; job → `SUSPECT`.
4. `agent` posts the event; `uploader` ships the thumbnail.
5. Events API stores it and, for suspect-severity events, invokes the **cloud
   judge** (L4) with the thumbnail.
6. Judge returns a verdict, classification, and confidence. Stored on the
   event.
7. On confirmation: job → `FAILED`, notifier fans out, kiosk turns red.
   On rejection: event marked false positive — and retained, because these
   are the training data for tuning stage 8.

Note the direction of the L4 call: the Pi never talks to the model. The Pi
posts an event to our API, and our API decides whether a model call is
warranted. This keeps model credentials in one place and makes per-print
cloud cost enforceable server-side.

### 6.7 Data model

Existing tables: `allowed_emails`, `access_requests`, `devices`,
`device_commands`.

New:

**`print_jobs`** — one row per print run.
`id`, `device_id` (fk → devices), `status` (§6.5), `started_at`, `ended_at`,
`layers_observed`, `layers_expected` (null unless a slice file is bound),
`slice_file_key`, `label`, `thumbnail_key`, `baseline` (jsonb — the learned
ROI and reference silhouette).

**`inspection_events`** — one row per raised event.
`id`, `job_id` (fk → print_jobs), `device_id`, `layer`, `kind`
(`cycle_lost` | `detachment` | `growth_stall` | `geometry_mismatch` |
`job_started` | `job_completed`), `severity` (`info` | `suspect` |
`confirmed`), `edge_confidence`, `thumbnail_key`, `edge_verdict` (jsonb),
`cloud_verdict` (jsonb, null until L4 runs), `created_at`, `notified_at`.

`devices` gains an `inspection_config` jsonb column for per-install tuning
(ROI, thresholds, debounce *k*), so that tuning never requires a code deploy
to the fleet.

### 6.8 API surface

Device-facing, bearer-token authenticated (existing scheme):

| Method | Path | State | Purpose |
| --- | --- | --- | --- |
| POST | `/api/devices/heartbeat` | exists, **extend** | Device health; gains job state, current layer, cycle-lock confidence |
| GET | `/api/devices/commands` | exists | Pull queued commands |
| POST | `/api/devices/commands/{id}/result` | exists | Report command result |
| POST | `/api/devices/events` | **new** | Submit inspection events (batched, idempotent by client-supplied id — the edge may retry after an outage) |
| POST | `/api/devices/jobs` | **new** | Open/close a job, report state transitions |

User-facing routes: the existing dashboard, plus `/jobs/{id}` (timeline) and
`/kiosk/{device_id}` (machine-side display).

New commands for the existing queue: `mark_job_good` (trigger baseline
learn), `relearn_baseline`, `acknowledge_failure`, and — Phase 5 only —
`abort_print`.

### 6.9 The screen at the machine

Build it as a route in the dashboard app the box already talks to, and run
Chromium full-screen on the Pi's HDMI output pointed at that URL. No new
hardware, no second codebase, no display driver, and the same URL works on a
wall-mounted tablet or the operator's phone.

It must degrade honestly: cache the last known state locally and serve a
fallback page from the Pi when the network is down, showing local state and
saying plainly that it is offline. A status screen that freezes on stale good
news is worse than no screen.

Content, in priority order: current state as a large colour block readable
across a room, layer count and elapsed/remaining, the live frame, and the
last few events. A physical light tower driven from the Pi's GPIO is a cheap
later addition for people who want to read state from the far side of a
workshop.

---

## 7. Phases

| # | Goal | Exit criteria |
| --- | --- | --- |
| **0** | **Optical feasibility.** Phone or webcam + red light, one real print, capture the whole run — including a deliberately induced failure. | We can look at the footage and identify, by eye, the layer at which the failure began — *including for a failure in the first 10% of layers*. If we cannot, no software fixes it, and the mount/light design changes before anything else is built. |
| **1** | Camera tee + cycle lock + L0. | Layer count derived from video matches the printer's own count over a full print, ±2. Machine-stopped is reported within one cycle. Ring buffer verified torn-free. |
| **2** | L1 detachment detection + event pipeline end to end. | A sabotaged print raises an event within 3 layers, visible on the dashboard with a thumbnail. Zero false positives across 3 clean prints. Events survive a network outage during the run. |
| **3** | Kiosk screen + notification channel. | Operator at the machine sees live state without a laptop, including a truthful offline state. A failure reaches a phone within a minute. |
| **4** | L2 + L4 cloud judgement. | Failure events carry a classification and a plain-language explanation. False-positive rate low enough to leave alerts on overnight for a week. |
| **5** | L3 slice comparison, and auto-abort. | The box can stop a doomed print, not merely report it. |

**On auto-abort**, the feature everyone asks for first: stopping the print is
where most of the remaining value sits, and it is also exactly where the
"works with any machine" promise breaks. Newer Elegoo and Anycubic machines
expose a local network protocol; Chitu-based boards largely do not. The
universal fallback — cutting power via a smart plug — is crude, leaves the
plate down in the vat, and is not a graceful abort. It stops the waste and
the FEP risk from growing, and nothing more. It must be opt-in per machine
and never a default. **Ship detection first; earn the right to act later.**

---

## 8. Risks

Worst first.

1. **The image isn't separable.** Grey object, grey resin, dark cabinet. If
   Phase 0 fails, the thesis fails. Mitigated only by the fact that it takes
   one day to find out, and it comes before everything else.
2. **Clear and translucent resins** are materially harder than filled greys.
   May need a different angle, a backlight, or an explicit unsupported-material
   list in v1.
3. **Every install is different** — printer, hood, bench, angle. Baselines
   must be learned per install, never shipped. Re-learn must be one click.
4. **False positives at night are fatal to trust.** One spurious 3 a.m. alert
   and the operator disables notifications permanently. This is the entire
   argument for the debounce stage and for L4: hold the alert until a second
   opinion agrees.
5. **The box must survive a workshop** — resin fumes, IPA, dust, and someone
   knocking the camera arm. Mount rigidity is a product requirement. A moved
   camera must be *detected* (the `LOST` state) rather than silently
   producing nonsense.
6. **Cycle lock on unfamiliar machines.** The lock is validated on the
   printers we own; a machine with an unusual motion profile may not lock.
   The `LEARNING`/`LOST` states make this a visible, honest failure rather
   than a wrong answer.

---

## 9. What we are deliberately not building

- Part-level dimensional inspection (AOI). Different product, different price,
  different sales motion.
- Anything requiring the printer's cooperation in v1 — no controller
  integration, no firmware, no cable into the machine.
- A trained per-object model. L0–L3 are geometry, not learning, which is why
  the edge never needs a model pushed to it and why the box works on the
  first print of an object it has never seen.
- Multi-camera rigs. One camera, one machine, one box.

---

## 10. Generalisation

Nothing in §4–§6 is specific to resin. The box locks onto a cyclic machine's
rhythm from video alone, learns what a good cycle looks like, and reports
deviation. That is the same product for an injection moulding machine, a CNC
running a repeated program, a filling or labelling line, or a pick-and-place
feeder — any machine that repeats itself and cannot tell you when it has
stopped repeating itself correctly.

Only three things in this document are resin-specific: the illumination
wavelength constraint (§3), the L3 slice-file parser (§5), and the failure
taxonomy (§6.7). The cycle lock, phase-locked sampling, baseline learning,
debounce, state machine, and the entire cloud and reporting path carry over
unchanged.

Resin printing is the beachhead because the failure is dramatic, the cost of
missing it is easy to put a number on, the machines are cheap enough to
experiment on, and the buyers are reachable. The generalisation is the reason
to build it properly rather than as a one-printer hack.

---

## Appendix A — diagrams to produce

This document intentionally contains no diagrams. The structured tables above
are written to be drawn from directly. The diagrams worth having, and what
each must show:

1. **Deployment topology.** The four zones of §6.1 with the NAT boundary drawn
   explicitly, every edge→cloud arrow originating on the edge, and the direct
   browser→object-storage path shown as distinct from the app path.
2. **Edge component diagram.** The four services of §6.2, with **camera
   ownership** (§6.3) as the visual centrepiece: one ffmpeg process, two
   outputs, the `tmpfs` ring buffer between `recorder` and `inspector`, and
   the local event queue between `inspector` and `agent`.
3. **Inspection pipeline.** The ten stages of §6.4 as a linear dataflow,
   annotated with what flows between stages (frames → scalar signal → phase →
   layer frames → features → verdicts → events). Stage 5's baseline should be
   shown feeding stage 7 from the side, not inline.
4. **Job state machine.** §6.5 exactly, with `LOST` given equal visual weight
   to the happy path.
5. **Failure escalation sequence.** The seven steps of §6.6 as a sequence
   diagram across four lifelines: inspector, agent, events API, cloud judge —
   showing the debounce hold, and making clear that the Pi never calls the
   model.
6. **Detection ladder.** §5 as five stacked levels, annotated with where each
   runs (edge vs. cloud) and what each costs. Should make "L1 is the product"
   visually obvious.
7. **Data model ERD.** §6.7 plus the four existing tables, with the new tables
   visually distinguished from the existing ones.
8. **Optical setup.** A physical illustration: printer, orange hood, vat,
   build plate mid-lift with the object hanging beneath it, camera and light
   mounted outside the hood off-axis. Must convey the §3 geometry — that the
   object grows *downward* and emerges from the resin as the print proceeds —
   because that fact is unintuitive to anyone who has only seen FDM printing.
9. **Phase roadmap.** §7 as a milestone sequence, with Phase 0 drawn as a gate
   that everything else sits behind.

Diagrams 2, 3, 4 and 8 carry the most information per pixel. If only four are
made, make those.
