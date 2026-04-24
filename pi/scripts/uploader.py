#!/usr/bin/env python3
"""vigil-uploader — ship recorded mp4 files to S3-compatible object storage.

Scans the recordings dir on a fixed interval. Each mp4 whose mtime is older
than the stability grace period is considered finalised and uploaded. On
success the file is moved to `uploaded/` (or deleted) so the next scan skips
it. On failure the file stays put and is retried next loop.

The client talks generic S3 — it works against AWS S3, Cloudflare R2,
Backblaze B2, MinIO, etc. Endpoint and credentials are supplied via env
vars (or the config file as a fallback for non-secret local tests).
"""
from __future__ import annotations

import argparse
import logging
import os
import signal
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import boto3
import yaml
from botocore.exceptions import BotoCoreError, ClientError


STOP = False


def load_config(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def resolve_output_dir(cfg: dict) -> Path:
    out = Path(cfg["recording"]["output_dir"])
    if not out.is_absolute():
        out = (Path(__file__).resolve().parent.parent / out).resolve()
    return out


def make_client(cfg: dict):
    up = cfg["upload"]
    endpoint = os.environ.get("VIGIL_S3_ENDPOINT") or up.get("endpoint")
    access_key = os.environ.get("VIGIL_S3_ACCESS_KEY_ID") or up.get("access_key_id")
    secret_key = os.environ.get("VIGIL_S3_SECRET_ACCESS_KEY") or up.get("secret_access_key")
    region = up.get("region", "auto")

    missing = [
        name for name, val in [
            ("VIGIL_S3_ENDPOINT", endpoint),
            ("VIGIL_S3_ACCESS_KEY_ID", access_key),
            ("VIGIL_S3_SECRET_ACCESS_KEY", secret_key),
        ] if not val
    ]
    if missing:
        raise SystemExit(f"missing S3 credentials: {', '.join(missing)}")

    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=region,
    )


def file_is_stable(path: Path, grace_seconds: int) -> bool:
    try:
        mtime = path.stat().st_mtime
    except FileNotFoundError:
        return False
    return (time.time() - mtime) >= grace_seconds


def object_key(device_id: str, path: Path) -> str:
    # filename looks like vigil_2026-04-24_23-10-00.mp4 — use the embedded
    # date to partition the bucket by day. fall back to upload-time date if
    # the filename doesn't match the pattern.
    name = path.name
    try:
        date_part = name.split("_", 2)[1]   # 2026-04-24
        y, m, d = date_part.split("-")
        int(y), int(m), int(d)  # sanity check
    except (IndexError, ValueError):
        now = datetime.now(timezone.utc)
        y, m, d = f"{now.year:04d}", f"{now.month:02d}", f"{now.day:02d}"
    return f"{device_id}/{y}/{m}/{d}/{name}"


def upload_one(s3, bucket: str, path: Path, key: str, log: logging.Logger) -> bool:
    try:
        s3.upload_file(
            str(path),
            bucket,
            key,
            ExtraArgs={"ContentType": "video/mp4"},
        )
        log.info("uploaded %s → s3://%s/%s", path.name, bucket, key)
        return True
    except (ClientError, BotoCoreError) as e:
        log.warning("upload failed for %s: %s", path.name, e)
        return False


def finalize_local(path: Path, uploaded_dir: Path, delete: bool):
    if delete:
        path.unlink(missing_ok=True)
    else:
        uploaded_dir.mkdir(parents=True, exist_ok=True)
        path.rename(uploaded_dir / path.name)


def scan_and_upload(cfg: dict, s3, log: logging.Logger):
    rec_dir = resolve_output_dir(cfg)
    uploaded_dir = rec_dir.parent / "uploaded"
    bucket = cfg["upload"]["bucket"]
    device_id = cfg["device"]["id"]
    delete_after = bool(cfg["upload"].get("delete_after_upload", False))
    grace = int(cfg["upload"].get("stability_grace_seconds", 30))

    if not rec_dir.exists():
        return

    for path in sorted(rec_dir.glob("*.mp4")):
        if STOP:
            return
        if not file_is_stable(path, grace):
            continue
        key = object_key(device_id, path)
        if upload_one(s3, bucket, path, key, log):
            finalize_local(path, uploaded_dir, delete_after)


def main() -> int:
    parser = argparse.ArgumentParser(description="vigil uploader")
    parser.add_argument(
        "--config",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "config" / "vigil.yaml",
    )
    parser.add_argument("--once", action="store_true", help="scan once and exit")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [uploader] %(levelname)s %(message)s",
    )
    log = logging.getLogger("vigil-uploader")

    cfg = load_config(args.config)
    if not cfg["upload"].get("enabled", False):
        log.info("upload.enabled=false — nothing to do")
        return 0

    s3 = make_client(cfg)
    interval = int(cfg["upload"].get("scan_interval_seconds", 30))

    def on_signal(signum, _frame):
        global STOP
        STOP = True
        log.info("signal %s — stopping after current scan", signum)

    signal.signal(signal.SIGINT, on_signal)
    signal.signal(signal.SIGTERM, on_signal)

    log.info(
        "uploader start device=%s bucket=%s interval=%ss",
        cfg["device"]["id"], cfg["upload"]["bucket"], interval,
    )

    if args.once:
        scan_and_upload(cfg, s3, log)
        return 0

    while not STOP:
        scan_and_upload(cfg, s3, log)
        for _ in range(interval):
            if STOP:
                break
            time.sleep(1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
