#!/usr/bin/env python3
"""Generate a game-compatible save JSON for replay import.

Compatible with js/SaveSystem.importFromFile() format.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path


def make_level_key(level_id: str, color: int) -> str:
    return f"{level_id}_c{color}" if color > 0 else level_id


def main() -> int:
    p = argparse.ArgumentParser(description="Generate importable replay save JSON")
    p.add_argument("--level-id", required=True, help="Level ID used by game (e.g. 1, 61, custom_1-1, gen_0)")
    p.add_argument("--replay", required=True, help="Replay string, only U/D/L/R")
    p.add_argument("--steps", type=int, default=None, help="Best steps (default: len(replay))")
    p.add_argument("--color", type=int, default=0, help="Color override for official variants (1/2/3/4/6)")
    p.add_argument("--output", default="banmen_save_import.json", help="Output json path")
    args = p.parse_args()

    replay = args.replay.strip().upper()
    if any(ch not in "UDLR" for ch in replay):
        raise SystemExit("replay must contain only U/D/L/R")

    steps = args.steps if args.steps is not None else len(replay)
    level_key = make_level_key(args.level_id, args.color)

    payload = {
        "version": 1,
        "timestamp": int(time.time() * 1000),
        "game": "BanmenHTML5",
        "content": {
            "levels": {
                level_key: {
                    "cleared": True,
                    "bestSteps": steps,
                    "replay": replay,
                }
            }
        },
    }

    out = Path(args.output)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {out}")
    print(f"level_key={level_key}")
    print(f"steps={steps}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
