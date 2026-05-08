# Pi deployment runbook

End-to-end flow for taking a Raspberry Pi 5 from box to a vigil node on the
dashboard. Battle-tested on `vigil-dev-01` (Taipei dev, 2026-05-08).

> Production install at `/opt/vigil/` with a dedicated `vigil` user is a
> separate hardening pass. This runbook gets you to a working dev/pilot Pi
> running under your normal user, reachable from anywhere, talking to the
> dashboard. Layer systemd on once it's earning its keep.

## Hardware

- Raspberry Pi 5 (4GB+ recommended)
- **5V/5A USB-C PSU** (Pi 5 will throttle / refuse to power USB peripherals
  on the 3A bricks that worked for Pi 4)
- 32GB+ SD card (or USB SSD for prod)
- USB webcam, UVC (Logitech C270 / C920 are reliable)
- Mac with Pi Imager, Tailscale, and an SSH key

## Step 1 — Pi Imager

Install Raspberry Pi Imager on the Mac (`brew install --cask raspberry-pi-imager`),
pick **Raspberry Pi OS Lite (64-bit)**, then click the gear icon and fill in:

| Field | Value |
| --- | --- |
| Hostname | `vigil-<location>-<NN>` (e.g. `vigil-dev-01`, `vigil-hsinchu-01`) — this becomes `device.id` and the R2 key prefix |
| Username | `max` (avoid the default `pi` — it's the first thing scanners try) |
| Password | something memorable; you'll only need it once |
| Wi-Fi SSID / pass | see Step 2 |
| Wi-Fi country | `TW` |
| Timezone / Keyboard | `Asia/Taipei` / `us` |
| Services → SSH | **Enable**, **Allow public-key authentication only**, paste `~/.ssh/<your-key>.pub` |

Generate a per-Pi SSH key on the Mac so you can revoke it without nuking
your GitHub keys:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/vigil-<hostname> -N "" -C "max@mac → vigil-<hostname>"
```

## Step 2 — Wi-Fi for first boot

Pi Imager only stores ONE Wi-Fi credential. Pick wisely:

- **iPhone Personal Hotspot** is the most reliable choice — you control the
  SSID/password, it goes everywhere with you, and it has zero AP isolation.
  The phone must keep the Personal Hotspot screen open until first connect.
- **Home Wi-Fi** if you'll boot at home and never move the Pi.
- **Avoid corporate / managed Wi-Fi** unless you control the router. AP
  isolation is common on those networks and will block your Mac from
  reaching the Pi *even when both are on the same /24*. Pi will appear in
  the router's client list, ARP returns "(incomplete)" from the Mac,
  Tailscale is the only way through.

Add more SSIDs after first boot — see Step 5.

## Step 3 — First boot

Insert SD card, plug in power. First boot runs `firstrun.sh` which applies
the Imager customisation; expect 90s–2 min before the Pi is on the network.

LED reading:
- Red solid = power good (and on Pi 5, it stays on after `shutdown -h now`
  — that is normal Pi 5 behavior, the PMIC is awake to listen for the PWR
  button. Different from Pi 4, which fully extinguishes the red LED.)
- Green blinking = filesystem activity (boot in progress or kernel work)
- Green steady-off = boot finished, idle

From the Mac (must be on the same network as the Pi):

```bash
ssh max@<hostname>.local
```

If `.local` doesn't resolve, ARP-scan the subnet and look for OUI
`2c:cf:67`, `d8:3a:dd`, or `dc:a6:32` (Pi 5 Wi-Fi/Ethernet vendor prefixes,
varies by board batch).

If the Mac and Pi are on separate networks (or there's AP isolation),
*don't fight the LAN* — go straight to Step 4 via screen+keyboard or a
phone hotspot bridge.

## Step 4 — Tailscale (do this immediately)

This is the single most important step. Once the Pi is on Tailscale, every
subsequent step works regardless of which Wi-Fi the Pi joins.

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --ssh
```

The second command prints a `https://login.tailscale.com/a/...` URL. Open
it on the Mac, log in with your tailnet account (vigil's tailnet is on
`bigweiweig@gmail.com`), and approve the device.

On the Mac side, add the Pi to `~/.ssh/config`:

```
Host vigil-<hostname>
  HostName vigil-<hostname>
  User max
  IdentityFile ~/.ssh/vigil-<hostname>
  IdentitiesOnly yes
```

The `HostName` is just the bare MagicDNS name — Tailscale resolves it to a
`100.x.x.x` IP. From now on `ssh vigil-<hostname>` works from anywhere.

**Tailscale SSH gotcha**: with `--ssh` enabled, the *first* SSH from each
new client triggers a one-time device-check redirect (visit URL, approve,
retry). Once approved, the check is cached for 90 days.

## Step 5 — Multi-Wi-Fi via NetworkManager

Pi OS uses NetworkManager. Add as many SSIDs as you want; the Pi will
auto-pick whichever is in range:

```bash
sudo nmcli device wifi connect "<SSID>" password "<password>"
# or, for an SSID not currently in range:
sudo nmcli connection add type wifi \
  con-name "<name>" ssid "<SSID>" \
  wifi-sec.key-mgmt wpa-psk wifi-sec.psk "<password>"
```

Set priority if you want one to win when both are visible:

```bash
sudo nmcli connection modify "<name>" connection.autoconnect-priority 20
```

Quote SSIDs and passwords. Use single quotes if `$` or backticks appear.
The "missing key-mgmt" error from `nmcli device wifi connect` usually
means a stale half-built profile — `nmcli connection delete <name>` and
retry, or use the explicit `add` form.

## Step 6 — Passwordless sudo (dev convenience)

Optional but unblocks remote-driving the Pi from your Mac without
interactive password prompts. Acceptable for dev/pilot Pis behind
Tailscale + SSH key auth — both layers must be passed before you reach
this user.

```bash
echo 'max ALL=(ALL) NOPASSWD: ALL' | sudo tee /etc/sudoers.d/010-max-nopasswd
sudo chmod 0440 /etc/sudoers.d/010-max-nopasswd
```

(For prod Yvonne deploy, leave sudo password-protected and grant only the
specific systemctl/nmcli verbs you need.)

## Step 7 — Repo + venv

```bash
git clone https://github.com/MaxShih147/vigil.git ~/vigil
cd ~/vigil/pi
python3 -m venv .venv --system-site-packages
.venv/bin/pip install -r requirements.txt
```

`--system-site-packages` lets the venv inherit Trixie's apt-installed
PyYAML/etc. without you re-pinning them. Drop the flag if you want full
isolation.

## Step 8 — Secrets

`pi/.env` is gitignored. Easiest path: `scp` it from a known-good
workstation:

```bash
scp /path/to/local/pi/.env vigil-<hostname>:vigil/pi/.env
```

Required keys (from `pi/.env.example`):

```
VIGIL_S3_ENDPOINT=https://<R2-ACCOUNT-ID>.r2.cloudflarestorage.com
VIGIL_S3_ACCESS_KEY_ID=...
VIGIL_S3_SECRET_ACCESS_KEY=...
VIGIL_DASHBOARD_URL=https://vigil-two-olive.vercel.app
VIGIL_DEVICE_API_KEY=...   # must match the Vercel env on the dashboard side
```

## Step 9 — Customise `vigil.yaml`

`pi/config/vigil.yaml` ships pointing at the dev Mac. Set the per-device
fields:

```yaml
device:
  id: vigil-<hostname>            # MUST match the hostname; becomes R2 key prefix
  label: <human description>
  location: <where it sits>
camera:
  device_linux: /dev/video0       # USB webcam
recording:
  codec: libx264                  # Pi 5 has no h264 HW encoder, software is fine
```

Everything else can stay default. Codec note: Pi 4 used `h264_v4l2m2m`
for hardware encode; Pi 5 removed that block (HEVC decode only). 1080p30
software encode on the A76 cores is comfortable.

## Step 10 — Smoke tests

Smoke tests, in order. Each must pass before moving on.

```bash
cd ~/vigil/pi
set -a && source .env && set +a    # export VIGIL_* into shell
```

**Agent → dashboard:**

```bash
.venv/bin/python scripts/agent.py --once
# expect: "heartbeat ok recording=False disk=NN% free=NNGB pending=0"
```

Then visit `https://vigil-two-olive.vercel.app/devices` and confirm the
device appears.

**R2 connectivity:**

```bash
.venv/bin/python -c '
import os, boto3
s3 = boto3.client("s3",
  endpoint_url=os.environ["VIGIL_S3_ENDPOINT"],
  aws_access_key_id=os.environ["VIGIL_S3_ACCESS_KEY_ID"],
  aws_secret_access_key=os.environ["VIGIL_S3_SECRET_ACCESS_KEY"],
  region_name="auto")
print(s3.list_objects_v2(Bucket="vigil-recordings", MaxKeys=1).get("KeyCount"))'
```

Should print a number (0 if first deploy). Any boto3 exception means R2
keys are wrong or the bucket name in `vigil.yaml` is mistyped.

**Recorder (after webcam plugged in):**

```bash
ls /dev/video0 && \
ffmpeg -f v4l2 -i /dev/video0 -t 5 -y /tmp/test.mp4 && \
ls -la /tmp/test.mp4
```

A 5-second mp4 confirms ffmpeg can talk to the webcam. Then run the real
recorder script for ~12 minutes to get one full segment, and watch the
uploader pick it up:

```bash
./scripts/start_recording.sh &     # in one shell
./scripts/start_uploader.sh        # in another
```

After ~11 minutes a `vigil_*.mp4` should appear in
`data/recordings/`, get marked stable, ship to R2 under
`<device-id>/<YYYY>/<MM>/<DD>/`, then move to `data/uploaded/`.

## Step 11 — systemd (production-only)

For a Pi that should auto-start vigil on boot, follow the README's
`/opt/vigil/` instructions. Summary: copy the repo's `pi/*` into
`/opt/vigil/`, create the `vigil` user, install the three `.service`
files, `systemctl enable --now`. The service files reference
`/etc/vigil/vigil.yaml` and `/etc/vigil/.env` so move those there.

For dev Pis (like `vigil-dev-01`) running everything under `~/vigil`,
don't bother with systemd until you need persistence across reboots.

## Pi 5 quirks worth remembering

- **Active Cooler is silent below ~50°C.** PWM kicks in at 50°C, ramps
  through 60/67.5°C trip points, full speed by 80°C. Idle = 0 RPM is
  normal. Verify with `cat /sys/class/hwmon/hwmon*/fan1_input`.
- **Red LED stays solid after `shutdown -h now`.** PMIC keeps the PWR
  button alive. Wait for the green LED to stop (system actually halted)
  and SSH to time out, then it's safe to unplug. Set
  `POWER_OFF_ON_HALT=1` in EEPROM if you want the red LED to also die,
  but you lose the PWR-button wake.
- **No hardware H.264 encoder** — `h264_v4l2m2m` is gone. Use `libx264`.
- **5V/5A PSU is non-negotiable.** A 5V/3A brick will boot the Pi but
  brown out USB peripherals (cameras, SSDs) and may not power-negotiate
  high USB current at all. Symptom: undervoltage warnings in dmesg.
- **Built-in `/dev/video*` are not cameras.** Pi 5 ships v4l2 device
  nodes for `pispbe` (image processor) and `rpi-hevc-dec` — those occupy
  `/dev/video19`-`/dev/video35`. Your USB webcam is `/dev/video0` and
  doesn't appear until plugged in. Verify with
  `v4l2-ctl --list-devices`.

## Recovery: Pi is unreachable

If `ssh vigil-<hostname>` fails:

1. **Tailscale view first.** From the Mac: `tailscale status | grep
   vigil-<hostname>`. If "offline N min ago" → Pi has no internet (the
   only network it knows isn't around). If absent → Pi never came up.
2. **The hotspot bridge.** Open your iPhone hotspot with the SSID you've
   already configured on the Pi. Wait a minute, retry SSH. This is the
   reason to keep `artemis` (or your phone hotspot SSID) saved on every
   Pi.
3. **Screen + keyboard.** Pi 5 uses **micro-HDMI** (not regular HDMI).
   Plug in a screen, USB keyboard, log in via the local console, run
   `nmtui` to add a working Wi-Fi.
4. **SD card edit.** Pop SD, mount on Mac (only the FAT32 `bootfs`
   partition is visible). The rootfs is ext4 — tooling on macOS is
   flaky. Easier to re-flash.
