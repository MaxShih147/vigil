# vigil — detachment detection guide

> One defect, one signal, one week to find out.
> Is there still something hanging under the build plate?

**Status:** the first inspection task. Covers product Phases 0–2 for a
single failure mode; nothing else is in scope until this works.
**Defect:** complete detachment — the whole print lets go of the build plate
and stays on the FEP film. The #1 failure, usually in the first 10 % of
layers, and the one that turns a night into waste.
**Companion documents:** `PRODUCT.md` §3–§5 (optics, cycle lock, ladder),
`vigil-failure-modes.pdf` §2 row 1 (mechanism and induction),
`RESEARCH.md` §4 (how this run becomes a dataset).

---

## 1. Principle

A resin printer repeats the same lift–dwell–descend motion every layer. If
we take **one photo per layer at the top of the lift**, every photo is
framed identically, and the only thing that changes from layer to layer is
the object growing by 0.05 mm. Under the plate there is a dark silhouette:
the object. Its area grows slowly and never shrinks.

**Detachment is the silhouette disappearing.** Nothing else in a healthy
print makes the area drop. That is the whole detector.

We do not classify, segment the object, or learn anything from other
prints. We measure one number per layer and watch for it to collapse.

---

## 2. Setup

| Item | Requirement | Why |
| --- | --- | --- |
| Camera | Any UVC webcam or phone. **Exposure, white balance, focus locked to manual.** | Auto-exposure re-normalises the image as the object grows and destroys the comparison. Non-negotiable. |
| Position | Outside the hood, side view, lens at build-plate height, 20–30° off the hood surface | Off-axis kills the acrylic reflection of the camera itself |
| Light | 620–660 nm red LED strip, diffused, also outside the hood, from the side opposite the camera or from above | Resin is blind to red; white light slowly cures the vat. The orange hood passes red freely. |
| Framing | Full plate travel fills the frame vertically; vat rim visible at the bottom as a fixed reference | The rim is the anchor for the ROI and for detecting a moved camera |
| Frame rate | 5 fps is enough; 30 fps is fine for the feasibility run | We only need to resolve a multi-second lift |
| Room | Turn off or block other light sources that flicker or change (windows, fluorescent) | Constant illumination is the assumption everything rests on |

Rule of thumb: if you cannot see the object and the plate clearly on the
phone screen with your own eyes, no software will either.

---

## 3. Step 0 — feasibility run (do this first, one day)

Print one real part with the setup above. Make it fail on purpose:

1. Set bottom-layer exposure to half the resin's normal value, **or** reduce
   bottom layers to 1–2, **or** wipe a thin film of release agent on the
   plate. Pick one; note which.
2. Record the whole print from before the first layer until well after the
   failure. Note the printer's layer counter when you notice the failure.
3. Also record one **clean** print of the same part with the same setup.

**Pass criterion:** a person scrubbing the failed video can point to the
layer at which the object stopped following the plate, and can see the
cured slab left on the vat floor. And the same person, scrubbing the clean
video, sees the silhouette grow steadily with no visual "events".

**If it fails:** change the light (position, diffusion, wavelength) or the
angle and repeat. Do not write detection code against footage a human
cannot read. Common causes: reflection of the LED in the hood (move it
off-axis), object and resin the same grey (try a backlight or a different
resin), camera too high (you are looking at the plate top, not under it).

Keep both videos. They are the first two entries of the dataset.

---

## 4. Detector

Ten steps, all classical OpenCV. Each has one or two parameters; defaults
are starting points to tune on the Step 0 footage.

| # | Step | What it does | Parameters |
| --- | --- | --- | --- |
| 1 | Grab frames | Read frames from the camera (or the Step 0 video) | fps ≈ 5 |
| 2 | Motion signal | Mean absolute difference between consecutive frames inside the plate-travel ROI → one number per frame | ROI: set by hand once per install |
| 3 | Find the cycle | Motion is high during lift/descend, near zero during dwell. Detect the quiet dwell that follows a lift. | dwell threshold; minimum dwell length (s) |
| 4 | Layer frame | Take the median of 3–5 frames from the middle of the dwell | reduces drips and flicker |
| 5 | Silhouette | Grayscale → subtract a reference frame taken with an empty plate (or the first layer frame) → threshold → morphological open/close | threshold `T` (tune on Step 0 footage); kernel 5–7 px |
| 6 | Area | Count silhouette pixels in the region **below the plate edge** and above the vat rim | plate edge y: found once by looking for the plate's horizontal line |
| 7 | Baseline | Over the first `N` layers, record area per layer and its noise (std) | `N` = 20–30 layers |
| 8 | Check | Detachment candidate if `area < r × max_area_so_far` and the drop persists | `r` = 0.3 (area falls to under 30 % of its peak) |
| 9 | Debounce | Raise the event only after `k` consecutive candidate layers | `k` = 3 |
| 10 | Report | Log layer number, area trace, the layer frame, and the frame before the drop | — |

Notes on the steps that will need care:

- **Step 3** is the only piece of signal processing. Start with a simple
  state machine (moving → quiet → moving) before trying autocorrelation.
  Log the detected period; it should match the printer's layer time.
- **Step 5** — for early layers the object is at the resin surface and
  hard to separate. Do not fight it. Accept that the area is small and
  noisy for the first ~20 layers; the baseline (step 7) absorbs that, and
  a detachment at layer 15 still shows as the area failing to keep growing
  while the plate keeps rising (see §6).
- **Step 8** — compare against the running maximum, not the previous
  layer, so a single noisy layer cannot mask a real drop.
- **Step 9** — three layers at ~10 s each means an alert within ~30 s of
  the failure. Raise `k` if drips cause false alarms; do not lower `r`.

---

## 5. Ground truth and acceptance

For every induced run, record the true detachment layer from the printer's
own counter (or, in the lab, from firmware / Z-motor current — see
`RESEARCH.md` §4.3). Then:

| Metric | Target for this task |
| --- | --- |
| Detection latency | event raised ≤ 3 layers after the true detachment layer |
| Misses | zero across the induced runs |
| False alarms | zero across 3 clean prints of the same part |
| Camera moved / hood opened | detector reports LOST (area trace invalid), not a detachment |

When these hold on one printer, one resin, one part, the task is done and
the next defect (support failure, `vigil-failure-modes.pdf` row 3) can
start. Do not generalise to other resins or geometries until this passes.

---

## 6. Where this detector is weak, and what we do about it

| Situation | Effect | Response |
| --- | --- | --- |
| Drips falling from the object during dwell | area flickers | median over frames (step 4); debounce (step 9) |
| Object still at the resin surface (first ~20 layers) | silhouette faint, area noisy | accept a noisy baseline; detachment still shows as growth stopping — this is the L2 check in `PRODUCT.md` §5 and is added after L1 works |
| Clear or translucent resin | object nearly invisible | out of scope for the first task; state it |
| Hood opened, camera nudged, light changed | whole frame changes | check the vat-rim reference each layer; if it moved, mark LOST and stop judging |
| Partial detachment (one part of several) | area drops but not to near zero | out of scope; later, per-part silhouettes |

---

## 7. What we are not doing in this task

- No cycle detection beyond "find the quiet dwell after a lift".
- No neural network, no training, no dataset beyond the runs above.
- No cloud, no dashboard changes, no Jetson. Run it on a laptop against
  the Step 0 video first; port to the Pi once it works.
- No other failure mode.

Small, boring, and finished beats broad and half-working.
