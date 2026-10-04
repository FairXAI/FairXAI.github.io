"""Headless check of the Views block in causal.html: the three views load, start on the chosen world, stay in step
after a model switch, "Show the break" and an action button. Saves screenshots to the directory given (default: here).

    ~/mycode/envs/uvs/py312_evogenui/bin/python demos/causal/check.py [SHOT_DIR]     # run on a compute node
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
PAGE = HERE.parent / "causal.html"
SHOTS = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE
STATE = "()=>({idx:T.entries.indexOf(E), trail:[...trail]})"


def views(page):
    return {k: page.frame_locator(f'.game[data-k="{k}"] iframe') for k in ("2d", "3d", "fp")}


def states(page):
    out = {}
    for f in page.frames:
        for k in ("2d", "3d", "fp"):
            if f.url.endswith(f"causal/{k}.html#embed"):
                try:
                    out[k] = f.evaluate(STATE)
                except Exception as e:          # not ready yet
                    out[k] = str(e)[:60]
    return out


def settle(page, want=None, limit=60000):
    waited = 0
    while waited < limit:
        page.wait_for_timeout(500)
        waited += 500
        s = states(page)
        if len(s) == 3 and len({json.dumps(v, sort_keys=True) for v in s.values()}) == 1:
            v = next(iter(s.values()))
            if want is None or (v["idx"], v["trail"]) == want:
                return v, waited
    raise SystemExit(f"views did not agree after {limit} ms: {states(page)}")


with sync_playwright() as p:
    browser = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    page = browser.new_page(viewport={"width": 1280, "height": 1000})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.goto(PAGE.as_uri())
    block = page.locator("#demo-2-views")
    block.scroll_into_view_if_needed()

    v, ms = settle(page, (1, []))
    print("start", v, f"{ms} ms")
    print("state chips:", page.locator("#state").inner_text().replace("\n", " | "))
    print("actions:", page.locator("#game-actions").inner_text().replace("\n", " | "))
    block.screenshot(path=str(SHOTS / "views-start.png"))

    page.click('#game-actions button[data-a="break"]')
    v, ms = settle(page, (1, ["load_panel_into_cell"]))
    print("break gpt-6-luna", v, f"{ms} ms")
    print("verdict:", page.locator("#verdict").inner_text())
    print("state chips:", page.locator("#state").inner_text().replace("\n", " | "))
    block.screenshot(path=str(SHOTS / "views-break.png"))
    page.locator(".case").screenshot(path=str(SHOTS / "case-luna.png"))
    page.locator("#demo-2-views").evaluate("e => e.previousElementSibling.scrollIntoView()")
    page.locator(".themes").screenshot(path=str(SHOTS / "rq.png"))

    page.click('#models button[data-i="1"]')
    settle(page, (12, []))
    page.click('#game-actions button[data-a="break"]')
    v, ms = settle(page, (12, ["toggle_extractor", "load_cell"]))
    print("break deepseek", v, f"{ms} ms")
    print("verdict:", page.locator("#verdict").inner_text())
    print("trace:", page.locator("#trace").inner_text())
    page.locator(".case").screenshot(path=str(SHOTS / "case-deepseek.png"))

    page.click('#game-actions button[data-a="reset"]')
    settle(page, (12, []))
    # walk the 2D player to a station would take keys; the bar shows the active view's menu only near a station
    for k in ("3d", "fp", "2d"):
        page.locator(f'.game[data-k="{k}"]').click(position={"x": 5, "y": 5})
    print("menu after clicks:", page.locator("#game-actions").inner_text().replace("\n", " | "))
    block.screenshot(path=str(SHOTS / "views-deepseek.png"))

    box = {k: page.locator(f'.game[data-k="{k}"]').bounding_box() for k in ("2d", "3d", "fp")}
    print("frames:", {k: (round(b["x"], 1), round(b["y"], 1), round(b["width"], 1), round(b["height"], 1)) for k, b in box.items()})
    print("errors:", errors or "none")
    browser.close()
