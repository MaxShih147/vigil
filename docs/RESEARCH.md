# vigil — research plan

> Camera outside the hood, no printer integration, geometry before learning.
> Prove it works, prove it generalises, publish the dataset.

**Status:** planning (2026-09). Runs alongside product Phases 0–4; shares
their hardware, footage and induction protocol.
**Companion documents:** `PRODUCT.md` (system), `vigil-failure-modes.pdf`
(failure taxonomy and induction methods), `literature/` (bibliography).

---

## 1. Why this is publishable

Vat-photopolymerization *failure mechanics* are well studied (separation
force, cupping, resin refill — Ye 2017, Liravi 2015, Paral 2023). In-situ
*monitoring* research exists but is entirely invasive: thermistor arrays in
the vat (Purdue, Mao 2022), interferometry, ultrasound, in-hood cameras for
repair. Three gaps, none filled:

1. No non-invasive, no-integration detection of in-print failure.
2. No systematic failure taxonomy with occurrence statistics — every
   classification in use comes from vendor troubleshooting guides.
3. No public image dataset of resin print failures with ground truth.
   FDM has several; resin has none.

The unfair advantage: we make the printers. Firmware layer index, Z
position, and Z-axis motor current are available as ground truth in the
lab — while the product deliberately uses none of them.

## 2. Research questions

| | Question | Product level | Measured by |
| --- | --- | --- | --- |
| **RQ1** | Can layer rhythm and layer count be recovered from video alone, across printers? | L0 | layer count vs. firmware count, ±2; lock time; lock rate |
| **RQ2** | How soon after detachment can an outside-the-hood camera detect it — including in the first 10 % of layers? | L1, L2 | detection latency in layers; recall; false alarms per print-hour |
| **RQ3** | Under per-install variation (printer, hood, angle, resin), does a geometric ladder generalise better than learned detectors? | L1–L2 vs. baselines | cross-install recall / false-alarm rate when tuned on install A and tested on B, C |
| **RQ4** (secondary) | Does a local vision-language judge on edge GPU reach the same confirmation quality as a cloud model? | L4 | agreement with cloud verdict and with human labels; latency; cost |

RQ3 is the thesis. RQ4 is what justifies the Jetson tier.

## 3. Contributions

1. **Method** — cycle lock + phase-locked sampling + per-install baseline +
   geometric checks + debounce, running on a Pi 5 with no model.
2. **Dataset** — *vigil-resin-failures*: full-print video at ~5 fps, one
   registered layer frame per cycle, firmware layer index and Z-force /
   current trace, induced-failure labels with the layer of onset. Released
   on Zenodo with DOI, subject to company approval.
3. **Failure taxonomy with occurrence statistics** — from Phrozen support
   and test-department records; the first published numbers for resin.
4. **Cross-install generalisation benchmark** — geometric ladder vs.
   fine-tuned CNN vs. memory-bank anomaly detection (PatchCore/PaDiM),
   all run at the edge (Jetson Orin Nano) so the comparison is fair.

## 4. Experiment design

### 4.1 Factors

| Factor | Levels | Notes |
| --- | --- | --- |
| Resin | opaque grey, black, clear | clear is the known hard case (Risk 2 in PRODUCT.md) |
| Geometry | large solid cross-section, fine supports / thin features, mixed | 2–3 STLs per class; all printed with our own slicer |
| Illumination | 620–660 nm red, 850 nm IR, white (control) | white is expected to fail over long prints (cures the vat) |
| Camera angle | 20°, 30° off the hood normal, on-axis | on-axis is expected to fail on reflection |

Fractional factorial: fix illumination (red) and angle (25°), run resin ×
geometry first; then sweep illumination and angle on one resin/geometry
pair.

### 4.2 Failure induction protocol

Reproducible, so others can replicate. Per failure mode (see
`vigil-failure-modes.pdf` §2):

| Mode | Induction | Expected onset |
| --- | --- | --- |
| Complete detachment | bottom exposure ×0.5, or 1–2 bottom layers, or thin release agent on plate | first 10 % of layers |
| Support failure / shear-off | support density ×0.5, minimum tip diameter, lift speed ×2 | where cross-section jumps |
| Delamination | normal exposure ×0.6, zero transition layers, lift speed ×2 | mid-print |
| Nothing prints | exposure 0.1 s | layer 1 |
| Stall | pause / power cut | chosen layer |
| Camera events | open hood, nudge arm, block lens | chosen time |

Each induced run records the intended failure and the observed onset layer
from ground truth.

### 4.3 Ground truth (lab only — never used by the product)

1. Firmware layer index + Z position, timestamp-synced to video.
2. Z-axis motor current (every Phrozen board) — separation-force proxy; a
   detachment shows as a drop in peak lift current. Load cell only if
   current proves too noisy.
3. Post-print inspection: part, plate, vat floor photographed and labelled.

### 4.4 Sample size

Initial: 3 resins × 3 geometries × 4 runs (2 clean, 2 induced) = 36 runs,
4–8 h each. On three printers in parallel: ~2 weeks of machine time.
Phase 0 needs 2 of these. Product-only validation could stop at 12–15.

### 4.5 Metrics

| Metric | Why this one |
| --- | --- |
| Detection latency (layers) | the unit operators reason in; ties to wasted resin |
| Recall per failure mode | at fixed debounce k |
| **False alarms per print-hour** | maps directly to "how many times a night is someone woken" — more persuasive than precision |
| Cycle-lock accuracy and time-to-lock | RQ1 |
| Cross-install degradation | metric above on install B/C after tuning on A (RQ3) |

### 4.6 Baselines (run on Jetson Orin Nano)

1. Naive frame-difference threshold — to show the problem is not trivial.
2. Fine-tuned CNN in the style of Jin 2020 / Brion 2022 on our dataset.
3. Memory-bank anomaly detection (PatchCore / PaDiM) using the first N
   layer frames as normal samples — the learning-free middle ground, and
   the fallback if silhouette area proves insufficient on clear resin.

The geometric ladder must win on cross-install generalisation and zero
training; it need not win on single-install absolute accuracy.

## 5. Hardware

| Role | Board | Why |
| --- | --- | --- |
| Product / base tier | Raspberry Pi 5 | L0–L3 in ms on CPU |
| Research bench + judge tier | NVIDIA Jetson Orin Nano Super dev kit | runs learned baselines at the edge; runs the local L4 judge (RQ4) |

One Orin Nano dev kit is the only purchase this plan adds.

## 6. Timeline

| Month | Milestone | Product phase |
| --- | --- | --- |
| 1 | Optical feasibility; mount and light fixed; induction protocol validated on 2 runs | Phase 0 |
| 2–3 | Dataset collection (36 runs); L0/L1 implemented; baselines running on Orin Nano | Phases 1–2 |
| 4 | Cross-install experiment; local judge on Orin Nano; writing | Phase 4 (partial) |
| 5 | Submission; dataset release | — |

## 7. Publication and exposure targets

- **Journal:** *Additive Manufacturing* (first choice), *Rapid Prototyping
  Journal*, *Virtual and Physical Prototyping*.
- **Fast feedback:** IEEE CASE or ICRA workshop paper.
- **Dataset:** Zenodo with DOI.
- **NVIDIA channels** (the Jetson AI Specialist/Ambassador certification
  was discontinued in 2024): GTC Taipei / Computex session or Jetson
  showcase, NVIDIA Developer Blog guest post, Jetson Community Projects.
  Story line: geometry on an $80 board catches the failure; Orin Nano gives
  a second opinion on-premises without sending images off-site.
- **Possible collaboration:** NTUST (Jeng Jeng-Ywan's group — authors of
  the 2023 LCD-VPP review) for separation-force expertise and library
  access.

## 8. Decisions needed before month 2

1. **Dataset release** — public (impact, citations) vs. internal. Needs
   management sign-off because failure images of Phrozen machines are in it.
2. **Ground truth source** — motor current (no hardware change) vs. load
   cell (cleaner, needs a modified plate). Try current first; if it is
   sufficient, even the ground truth is "no modification".
3. **Notification channel** for Phase 3 (LINE Messaging API / Telegram /
   Slack webhook) — pick one now to avoid a later meeting.

## 9. Risks specific to the research

- Phase 0 fails on clear resin → scope v1 to opaque resins, state it.
- Cycle lock fails on a non-Phrozen printer → report it as a LEARNING/LOST
  case, not a silent miss; that honesty is part of the contribution.
- Learned baselines under-tuned → invite the reviewer's obvious objection;
  use published recipes (Brion 2022) and report the tuning budget.
- Company declines dataset release → publish method + statistics, release
  a synthetic or partial subset.
