#!/usr/bin/env python3
"""vigil-recorder — capture from a webcam and segment into rolling mp4 files.

Wraps ffmpeg's segment muxer. Detects platform to pick the right input
format (avfoundation on macOS, v4l2 on Linux) so the same config works
on a dev Mac and on the target Raspberry Pi.
"""
from __future__ import annotations

import argparse
import os
import platform
import signal
import subprocess
import sys
from pathlib import Path

import yaml


def load_config(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def build_ffmpeg_cmd(cfg: dict, output_dir: Path) -> list[str]:
    cam = cfg["camera"]
    rec = cfg["recording"]
    system = platform.system()

    if system == "Darwin":
        input_args = [
            "-f", "avfoundation",
            "-framerate", str(cam["fps"]),
            "-video_size", cam["resolution"],
            "-i", str(cam["device_macos"]),
        ]
    elif system == "Linux":
        input_args = [
            "-f", "v4l2",
            "-framerate", str(cam["fps"]),
            "-video_size", cam["resolution"],
            "-i", cam["device_linux"],
        ]
    else:
        raise SystemExit(f"unsupported platform: {system}")

    output_template = str(output_dir / rec["filename_pattern"])

    return [
        "ffmpeg",
        "-hide_banner",
        "-loglevel", "info",
        "-nostdin",
        *input_args,
        "-an",
        "-c:v", rec["codec"],
        "-preset", rec["preset"],
        "-pix_fmt", "yuv420p",
        "-f", "segment",
        "-segment_time", str(rec["segment_seconds"]),
        "-segment_format", rec["format"],
        "-strftime", "1",
        "-reset_timestamps", "1",
        output_template,
    ]


def main() -> int:
    parser = argparse.ArgumentParser(description="vigil recorder")
    parser.add_argument(
        "--config",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "config" / "vigil.yaml",
    )
    parser.add_argument(
        "--print-cmd",
        action="store_true",
        help="print the ffmpeg command and exit",
    )
    args = parser.parse_args()

    cfg = load_config(args.config)

    repo_root = Path(__file__).resolve().parent.parent
    output_dir = Path(cfg["recording"]["output_dir"])
    if not output_dir.is_absolute():
        output_dir = (repo_root / output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    cmd = build_ffmpeg_cmd(cfg, output_dir)

    if args.print_cmd:
        print(" ".join(cmd))
        return 0

    print(f"[vigil] device={cfg['device']['id']} output={output_dir}", flush=True)
    print(f"[vigil] starting: {' '.join(cmd)}", flush=True)

    proc = subprocess.Popen(cmd)

    def forward(signum, _frame):
        # Pass SIGINT/SIGTERM to ffmpeg so it finalises the current segment.
        proc.send_signal(signum)

    signal.signal(signal.SIGINT, forward)
    signal.signal(signal.SIGTERM, forward)

    return proc.wait()


if __name__ == "__main__":
    sys.exit(main())
