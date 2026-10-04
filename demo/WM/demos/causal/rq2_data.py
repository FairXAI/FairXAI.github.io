"""Write rq2.js, the RQ2 numbers shown in causal.html, from the v8 eval runs.

    python3.11 demos/causal/rq2_data.py           # run from html_wm_demo/

Serial runs: causal-game-synthesis/v8/eval/results/serial/<model>; parallel (independent) runs: .../independent/<model>.
The per-round counts come from v8/eval/plot.py (per_round, per_request), so the page and curves.html agree.
Metric definitions: v8/eval/METRICS.md.
"""
import json
import sys
from pathlib import Path

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
EVAL = HERE.parents[2] / "causal-game-synthesis" / "v8" / "eval"
sys.path.insert(0, str(EVAL))
from plot import load, per_round, per_request  # noqa: E402
from report import MEASURED  # noqa: E402

MODELS = ["gpt-6-luna", "deepseek-v4-flash", "gpt-5-nano", "gpt-4o-mini"]   # fixed order = fixed colour slot


def overall(run):
    rows = run["rows"]
    convs = list(run["conversations"].values())
    judged = [r for r in rows if r["cell"] in MEASURED]
    return {
        "scenes": len(convs),
        "requests": len(rows),
        "admitted": sum(v[0]["round1"]["admitted"] for v in convs if "round1" in v[0]),
        "correct": sum(r["cell"] == "correct" for r in rows),
        "violating": sum(r["cell"] in ("phenomenon", "failed") for r in rows),
        "not_judged": len(rows) - len(judged),
    }


def serial(name):
    run = load(EVAL / "results" / "serial" / name)
    d = per_round(run)
    o = overall(run)
    kept = [v for v in d["kept"] if v]
    o["kept"] = [sum(v[0] for v in kept), sum(v[1] for v in kept)]
    o["clean_scenes"] = d["survival"][-1][0]
    return {"name": name, "overall": o,
            "rounds": {key: d[key] for key in ("correct", "violating_cum", "kept", "survival")}}


def parallel(name):
    path = EVAL / "results" / "independent" / name
    if not path.exists():
        return None
    run = load(path)
    d = per_request(run)
    return {"name": name, "overall": overall(run), "requests": d}


data = {"models": MODELS, "serial": [serial(m) for m in MODELS], "parallel": [p for p in map(parallel, MODELS) if p]}
for s in data["serial"]:
    assert s["rounds"]["violating_cum"][-1][0] == s["overall"]["violating"], s["name"]
(HERE / "rq2.js").write_text("// Written by rq2_data.py from causal-game-synthesis/v8/eval/results. Do not edit.\n"
                             f"window.RQ2 = {json.dumps(data, separators=(',', ':'))};\n")
for s in data["serial"]:
    o = s["overall"]
    print(f"serial   {s['name']:18} CR {o['correct']}/{o['requests']}  VR {o['violating']}/{o['requests']}  "
          f"RR {o['kept'][0]}/{o['kept'][1]}  clean {o['clean_scenes']}/{o['scenes']}  not judged {o['not_judged']}")
for p in data["parallel"]:
    o = p["overall"]
    print(f"parallel {p['name']:18} CR {o['correct']}/{o['requests']}  VR {o['violating']}/{o['requests']}  "
          f"admitted {o['admitted']}/{o['scenes']}  not judged {o['not_judged']}")
