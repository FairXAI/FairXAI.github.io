"""Copy the three v8 view pages of one scene next to causal.html.

    python3 demos/causal/copy_views.py            # run from html_wm_demo/

The pages come from causal-game-synthesis/v8/visualize/data/{2d,3d,fp}/<scene>.html (built by v8/visualize/build.py).
Two changes: the state message a view sends its parent also carries the current state's values, so causal.html can
show them under the games; and each page gets a Title Case <title> (without the internal v8 tag) and Title Case panel headings.
"""
import re
from pathlib import Path

SCENE = "paint_shop-classic"
HERE = Path(__file__).resolve().parent
SRC = HERE.parents[2] / "causal-game-synthesis" / "v8" / "visualize" / "data"
OLD = "node:cur, first:!v8Ready"
NEW = "node:cur, state:(E.nodes && E.nodes[cur]) ? E.nodes[cur].state : null, first:!v8Ready"
HEADINGS = [("Reachable state graph</h2>", "Reachable State Graph</h2>"), ("Causal relations</h2>", "Causal Relations</h2>")]
TITLES = {"2d": "Paint Shop · Top-Down 2D", "3d": "Paint Shop · Overhead 3D", "fp": "Paint Shop · First-Person 3D"}

for kind in ("2d", "3d", "fp"):
    page = (SRC / kind / f"{SCENE}.html").read_text()
    assert page.count(OLD) == 1, f"{kind}: state message not found"
    page, n = re.subn(r"<title>.*?</title>", f"<title>{TITLES[kind]}</title>", page.replace(OLD, NEW), count=1)
    assert n == 1, f"{kind}: <title> not found"
    for a, b in HEADINGS:
        assert page.count(a) == 1, f"{kind}: {a} not found"
        page = page.replace(a, b)
    (HERE / f"{kind}.html").write_text(page)
    print(kind, len(page) // 1024, "KB")
