# vigil

Raspberry Pi 5 + USB webcam edge recorder, with cloud storage and a
Vercel-hosted dashboard — on its way to becoming a box you put next to a
machine to watch whether its work is going right.

> 插電即開機、開機即錄影、錄影即切檔、切檔即上傳。

## Roles

| Role | Responsibility | Typically located |
| --- | --- | --- |
| **Operator** | Installs the box at the machine, powers it, keeps the camera aimed | On the shop floor, at the site |
| **Consumer** | Pulls footage and reads status; does not touch the device | Any office, any city |
| **Maintainer** | Owns the code, the cloud account, and the fleet | Anywhere with a laptop |

The three roles are rarely in the same building → footage and status must
live in the cloud, not on a NAS that requires VPN/port-forwarding to reach.
Nothing in the system assumes anyone can walk over and look at the device.

## Layout

```
pi/      Edge code that runs on the Raspberry Pi (and on Mac for dev)
web/     Next.js dashboard hosted on Vercel
docs/    Product direction and design notes
```

## Phases

**Platform** — recording and delivery, shipped:

| # | Goal | State |
| --- | --- | --- |
| 1 | Single-host webcam recording | ✅ |
| 2 | Auto segmentation (10-min mp4) | ✅ |
| 3 | Auto upload to Cloudflare R2 | ✅ |
| 4 | Heartbeat / device agent + command channel | ✅ |
| 5 | Web dashboard (`web/`) — Google OAuth, allowlist, device control | ✅ |

**Inspection** — next, and the reason the rest exists. The box stops being a
camera that uploads and becomes a box that *judges whether the machine's
work is going right*, with the anchor use case being MSLA/resin 3D printing.
See **[docs/PRODUCT.md](docs/PRODUCT.md)** for the full plan — optical
constraints, detection ladder, system architecture, data model, and phases.

Numbering below matches `docs/PRODUCT.md` §7 and is a separate track from
the platform phases above.

| # | Goal | State |
| --- | --- | --- |
| 0 | Optical feasibility — can a camera even see a resin print fail? | ⏳ |
| 1 | Camera tee + cycle lock: find the layer rhythm from video alone | ⏳ |
| 2 | Detachment detection + event pipeline | ⏳ |
| 3 | Kiosk screen at the machine + notifications | ⏳ |
| 4 | Cloud judgement on flagged frames | ⏳ |
| 5 | Slice-file comparison + auto-abort | ⏳ |

---

## Cloudflare R2 setup (one-time, by the Maintainer)

1. https://dash.cloudflare.com → **R2 Object Storage** → enable (requires
   payment method; storage is $0.015/GB/month, egress is **free**).
2. **Create a bucket** named `vigil-recordings` (any name works, just
   match it in `pi/config/vigil.yaml › upload.bucket`).
3. Note your **Account ID** from the R2 sidebar
   (e.g. `abc123def456...`).
4. R2 sidebar → **Manage R2 API Tokens** → **Create API Token**:
   - Permissions: **Object Read & Write**
   - Specify bucket: `vigil-recordings`
   - Save the **Access Key ID** and **Secret Access Key** — Cloudflare
     only shows the secret once.
5. In `pi/`, copy `.env.example` to `.env` and fill in the three values.

```bash
cp pi/.env.example pi/.env
$EDITOR pi/.env
```

---

## Dev workflow on Mac

```bash
cd pi
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Start the recorder (uses config/vigil.yaml by default)
./scripts/start_recording.sh

# In a separate shell: start the uploader
./scripts/start_uploader.sh
```

The first ffmpeg run prompts for camera permission — allow it and
re-run. Recordings land in `pi/data/recordings/`, one file per
`recording.segment_seconds`. Once a file is stable for
`upload.stability_grace_seconds`, the uploader ships it to R2 and (by
default) moves it to `pi/data/uploaded/`.

### Quick smoke tests

```bash
# Verify the recorder ffmpeg invocation without actually recording
./pi/scripts/start_recording.sh --print-cmd

# Verify the uploader can authenticate and find files (one pass, then exit)
./pi/scripts/start_uploader.sh --once
```

---

## Pi deployment

The repo is intended to be deployed to `/opt/vigil/` on the Pi (i.e.
`pi/scripts/...` becomes `/opt/vigil/scripts/...`). Config goes to
`/etc/vigil/vigil.yaml` and secrets to `/etc/vigil/.env`.

```bash
# on the Pi, after cloning to /opt/vigil and creating the venv:
sudo cp pi/systemd/vigil-recorder.service /etc/systemd/system/
sudo cp pi/systemd/vigil-uploader.service /etc/systemd/system/
sudo systemctl enable --now vigil-recorder vigil-uploader vigil-agent
```
