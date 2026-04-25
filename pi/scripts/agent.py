#!/usr/bin/env python3
"""vigil-agent — periodic heartbeat + command poll for the dashboard.

Every `heartbeat_interval_seconds`:
  1. POST device state to /api/devices/heartbeat
  2. GET pending commands from /api/devices/commands
  3. Run each command, POST the result back

Also runs a periodic local cleanup that deletes uploaded mp4s older than
`storage.keep_local_days` so the SSD doesn't fill up.

Auth: shared bearer token via `VIGIL_DEVICE_API_KEY` env var (matches the
same name on the dashboard side).
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import shutil
import signal
import socket
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError

import yaml


STOP = False


# ---------- helpers ----------

def load_config(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def resolve_dir(rel_or_abs: str, base: Path) -> Path:
    p = Path(rel_or_abs)
    return p if p.is_absolute() else (base / p).resolve()


def http_post(url: str, key: str, body: dict) -> dict:
    req = urlrequest.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
    )
    with urlrequest.urlopen(req, timeout=15) as resp:
        raw = resp.read().decode("utf-8") or "{}"
        return json.loads(raw)


def http_get(url: str, key: str) -> dict:
    req = urlrequest.Request(
        url,
        method="GET",
        headers={"Authorization": f"Bearer {key}"},
    )
    with urlrequest.urlopen(req, timeout=15) as resp:
        raw = resp.read().decode("utf-8") or "{}"
        return json.loads(raw)


# ---------- state collection ----------

def is_ffmpeg_running() -> bool:
    """True if a vigil ffmpeg process (segment muxer) is alive."""
    try:
        out = subprocess.check_output(
            ["pgrep", "-f", "ffmpeg.*-f segment"], text=True,
        )
        return bool(out.strip())
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def disk_stats(path: Path) -> tuple[int, int]:
    """Return (used_pct, free_gb) for the filesystem holding `path`."""
    target = path
    while not target.exists() and target.parent != target:
        target = target.parent
    usage = shutil.disk_usage(target)
    used_pct = round(100 * (usage.total - usage.free) / max(usage.total, 1))
    free_gb = round(usage.free / 1024 ** 3)
    return used_pct, free_gb


def newest_mtime_iso(path: Path, pattern: str = "*.mp4") -> str | None:
    if not path.exists():
        return None
    files = list(path.glob(pattern))
    if not files:
        return None
    newest = max(files, key=lambda p: p.stat().st_mtime)
    return datetime.fromtimestamp(
        newest.stat().st_mtime, tz=timezone.utc,
    ).isoformat()


def primary_ip() -> str | None:
    """Best-effort: the IP the kernel would use to reach the internet."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.3)
        try:
            s.connect(("1.1.1.1", 80))
            return s.getsockname()[0]
        finally:
            s.close()
    except OSError:
        return None


# ---------- command handlers ----------

def systemctl(action: str, unit: str) -> tuple[bool, str]:
    if shutil.which("systemctl") is None:
        return True, f"(no systemctl on host — would {action} {unit})"
    try:
        out = subprocess.run(
            ["systemctl", action, unit],
            capture_output=True, text=True, timeout=15,
        )
        ok = out.returncode == 0
        msg = (out.stderr or out.stdout).strip() or f"{action} {unit} done"
        return ok, msg[:500]
    except Exception as e:
        return False, str(e)[:500]


def cmd_force_upload_now(_payload, repo_root: Path) -> tuple[bool, str]:
    """Run uploader --once in-process so we don't have to poke a daemon."""
    uploader = repo_root / "scripts" / "uploader.py"
    try:
        out = subprocess.run(
            [sys.executable, str(uploader), "--once"],
            capture_output=True, text=True, timeout=600,
            cwd=str(repo_root),
        )
        ok = out.returncode == 0
        tail = (out.stderr or out.stdout).strip().splitlines()[-3:]
        msg = " | ".join(tail) or "uploader scan done"
        return ok, msg[:500]
    except Exception as e:
        return False, str(e)[:500]


def make_dispatch(repo_root: Path):
    handlers = {
        "start_recording": lambda p: systemctl("start", "vigil-recorder"),
        "stop_recording": lambda p: systemctl("stop", "vigil-recorder"),
        "restart_recorder": lambda p: systemctl("restart", "vigil-recorder"),
        "restart_uploader": lambda p: systemctl("restart", "vigil-uploader"),
        "force_upload_now": lambda p: cmd_force_upload_now(p, repo_root),
    }

    def dispatch(command: str, payload):
        h = handlers.get(command)
        if h is None:
            return False, f"unknown command: {command}"
        return h(payload)

    return dispatch


# ---------- cleanup ----------

def cleanup_uploaded(uploaded_dir: Path, keep_days: int, log: logging.Logger):
    if keep_days <= 0 or not uploaded_dir.exists():
        return
    cutoff = time.time() - keep_days * 86400
    deleted = 0
    for p in uploaded_dir.glob("*.mp4"):
        try:
            if p.stat().st_mtime < cutoff:
                p.unlink()
                deleted += 1
        except FileNotFoundError:
            pass
    if deleted:
        log.info(
            "cleanup: removed %d uploaded mp4 older than %dd", deleted, keep_days,
        )


# ---------- main loop ----------

def main() -> int:
    parser = argparse.ArgumentParser(description="vigil agent")
    parser.add_argument(
        "--config",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "config" / "vigil.yaml",
    )
    parser.add_argument(
        "--once", action="store_true", help="single iteration then exit",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [agent] %(levelname)s %(message)s",
    )
    log = logging.getLogger("vigil-agent")

    cfg = load_config(args.config)
    device_id = cfg["device"]["id"]
    label = cfg["device"].get("label") or cfg["device"].get("id")
    location = cfg["device"].get("location")

    dashboard_url = (
        os.environ.get("VIGIL_DASHBOARD_URL")
        or "https://vigil-two-olive.vercel.app"
    ).rstrip("/")
    api_key = os.environ.get("VIGIL_DEVICE_API_KEY", "")
    if not api_key:
        log.error("VIGIL_DEVICE_API_KEY not set in env — exiting")
        return 1

    agent_cfg = cfg.get("agent", {}) or {}
    interval = int(agent_cfg.get("heartbeat_interval_seconds", 10))
    cleanup_every = int(agent_cfg.get("cleanup_every_iterations", 60))
    keep_days = int(cfg.get("storage", {}).get("keep_local_days", 3))

    repo_root = Path(__file__).resolve().parent.parent
    rec_dir = resolve_dir(cfg["recording"]["output_dir"], repo_root)
    uploaded_dir = rec_dir.parent / "uploaded"

    dispatch = make_dispatch(repo_root)

    def on_signal(signum, _frame):
        global STOP
        STOP = True
        log.info("signal %s — stopping", signum)

    signal.signal(signal.SIGINT, on_signal)
    signal.signal(signal.SIGTERM, on_signal)

    log.info(
        "agent start device=%s dashboard=%s interval=%ss",
        device_id, dashboard_url, interval,
    )

    iteration = 0
    while not STOP:
        iteration += 1

        # 1. Heartbeat
        try:
            used_pct, free_gb = disk_stats(rec_dir)
            pending = len(list(rec_dir.glob("*.mp4"))) if rec_dir.exists() else 0
            last_up = newest_mtime_iso(uploaded_dir)
            body = {
                "device_id": device_id,
                "label": label,
                "location": location,
                "recording": is_ffmpeg_running(),
                "disk_used_pct": used_pct,
                "disk_free_gb": free_gb,
                "pending_uploads": pending,
                "last_upload_at": last_up,
                "ip": primary_ip(),
                "vigil_version": "0.1.0",
            }
            http_post(f"{dashboard_url}/api/devices/heartbeat", api_key, body)
            log.info(
                "heartbeat ok recording=%s disk=%d%% free=%dGB pending=%d",
                body["recording"], used_pct, free_gb, pending,
            )
        except (HTTPError, URLError, OSError) as e:
            log.warning("heartbeat failed: %s", e)

        # 2. Pull commands
        try:
            resp = http_get(
                f"{dashboard_url}/api/devices/commands?device_id={device_id}",
                api_key,
            )
            for cmd in resp.get("commands", []):
                ok, message = dispatch(cmd["command"], cmd.get("payload"))
                log.info("cmd %s → ok=%s %s", cmd["command"], ok, message)
                try:
                    http_post(
                        f"{dashboard_url}/api/devices/commands/{cmd['id']}/result",
                        api_key,
                        {"ok": ok, "message": message},
                    )
                except (HTTPError, URLError, OSError) as e:
                    log.warning("result post failed: %s", e)
        except (HTTPError, URLError, OSError) as e:
            log.warning("commands poll failed: %s", e)

        # 3. Periodic cleanup
        if iteration % cleanup_every == 0:
            try:
                cleanup_uploaded(uploaded_dir, keep_days, log)
            except OSError as e:
                log.warning("cleanup failed: %s", e)

        if args.once:
            return 0

        for _ in range(interval):
            if STOP:
                break
            time.sleep(1)

    return 0


if __name__ == "__main__":
    sys.exit(main())
