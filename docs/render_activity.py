"""
Renders UML activity diagrams with two swimlanes directly to PNG using Pillow.

Why not Mermaid: mermaid's `subgraph` is not a swimlane -- its dagre layout
scatters nodes and cannot draw a true bullseye end node. Drawing at explicit
coordinates gives correct UML notation and clean parallel lanes.

Node placement is explicit: every node declares (lane, row, col) so layout is
deterministic rather than auto-guessed.

Usage:
    py render_activity.py
"""

import os
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "activity-diagrams")

# ---------------------------------------------------------------- geometry ---
LANE_W = 560          # width of one swimlane
HEADER_H = 44         # swimlane title bar height
ROW_H = 116           # vertical pitch between rows
NODE_W = 200          # action box width
NODE_H = 62           # action box height
DIA_W = 240           # decision diamond width
DIA_H = 100           # decision diamond height
# Side-by-side nodes use col -1 / +1 which leaves the lane centre free as a
# vertical pass-through channel for skip edges.
COL_STEP = 115        # horizontal offset for one "col" unit inside a lane
PAD_TOP = 30
PAD_BOTTOM = 60
CHANNEL = 52          # gutter used for loop-back / skip routing
CHANNEL_STEP = 17     # stagger between concurrent channel edges
SCALE = 2             # supersample factor for crisp text

BLACK = (0, 0, 0)
WHITE = (255, 255, 255)


def _font(size, bold=False):
    names = ["arialbd.ttf", "arial.ttf"] if bold else ["arial.ttf", "segoeui.ttf"]
    for n in names:
        try:
            return ImageFont.truetype(n, size)
        except OSError:
            continue
    return ImageFont.load_default()


F_NODE = _font(13 * SCALE)
F_LANE = _font(15 * SCALE, bold=True)
F_EDGE = _font(11 * SCALE)


class Node:
    def __init__(self, nid, kind, lane, row, label="", col=0):
        self.id = nid
        self.kind = kind          # action | decision | start | end
        self.lane = lane
        self.row = row
        self.col = col
        self.label = label

    # centre point
    @property
    def cx(self):
        return self.lane * LANE_W + LANE_W // 2 + self.col * COL_STEP

    @property
    def cy(self):
        return PAD_TOP + HEADER_H + self.row * ROW_H + ROW_H // 2

    @property
    def w(self):
        return {"action": NODE_W, "decision": DIA_W, "start": 30, "end": 38}[self.kind]

    @property
    def h(self):
        return {"action": NODE_H, "decision": DIA_H, "start": 30, "end": 38}[self.kind]

    @property
    def left(self):
        return self.cx - self.w // 2

    @property
    def right(self):
        return self.cx + self.w // 2

    @property
    def top(self):
        return self.cy - self.h // 2

    @property
    def bottom(self):
        return self.cy + self.h // 2


def wrap(draw, text, font, max_w):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if draw.textlength(trial, font=font) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def draw_text_centred(draw, text, font, cx, cy, max_w):
    lines = wrap(draw, text, font, max_w)
    lh = font.size + 3 * SCALE
    total = lh * len(lines)
    y = cy - total // 2
    for ln in lines:
        w = draw.textlength(ln, font=font)
        draw.text((cx - w / 2, y), ln, font=font, fill=BLACK)
        y += lh


def s(v):
    return int(v * SCALE)


def draw_node(draw, n):
    l, t, r, b = s(n.left), s(n.top), s(n.right), s(n.bottom)
    if n.kind == "action":
        draw.rounded_rectangle([l, t, r, b], radius=8 * SCALE, fill=WHITE,
                               outline=BLACK, width=2)
        draw_text_centred(draw, n.label, F_NODE, s(n.cx), s(n.cy), s(NODE_W - 20))
    elif n.kind == "decision":
        draw.polygon([(s(n.cx), t), (r, s(n.cy)), (s(n.cx), b), (l, s(n.cy))],
                     fill=WHITE, outline=BLACK)
        # Pillow polygon outline width is 1; redraw edges thicker
        pts = [(s(n.cx), t), (r, s(n.cy)), (s(n.cx), b), (l, s(n.cy)), (s(n.cx), t)]
        draw.line(pts, fill=BLACK, width=2)
        draw_text_centred(draw, n.label, F_NODE, s(n.cx), s(n.cy), s(DIA_W - 70))
    elif n.kind == "start":
        draw.ellipse([l, t, r, b], fill=BLACK, outline=BLACK)
    elif n.kind == "end":
        draw.ellipse([l, t, r, b], fill=WHITE, outline=BLACK, width=3)
        pad = s(9)
        draw.ellipse([l + pad, t + pad, r - pad, b - pad], fill=BLACK, outline=BLACK)


def arrow_head(draw, x, y, direction):
    a = s(7)
    if direction == "down":
        pts = [(x, y), (x - a, y - a), (x + a, y - a)]
    elif direction == "up":
        pts = [(x, y), (x - a, y + a), (x + a, y + a)]
    elif direction == "right":
        pts = [(x, y), (x - a, y - a), (x - a, y + a)]
    else:
        pts = [(x, y), (x + a, y - a), (x + a, y + a)]
    draw.polygon(pts, fill=BLACK)


def polyline(draw, pts, head):
    p = [(s(x), s(y)) for x, y in pts]
    draw.line(p, fill=BLACK, width=2)
    arrow_head(draw, p[-1][0], p[-1][1], head)


def label_at(draw, text, x, y, canvas_w=None):
    """Draw an edge label centred on (x, y), clamped inside the canvas."""
    if not text:
        return
    w = draw.textlength(text, font=F_EDGE)
    pad = s(4)
    half = w / 2 + pad
    cx = s(x)
    if canvas_w is not None:
        cx = max(half + s(2), min(cx, s(canvas_w) - half - s(2)))
    box = [cx - half, s(y) - F_EDGE.size / 2 - pad,
           cx + half, s(y) + F_EDGE.size / 2 + pad]
    draw.rectangle(box, fill=WHITE)
    draw.text((cx - w / 2, s(y) - F_EDGE.size / 2), text, font=F_EDGE, fill=BLACK)


def _channel_x(a, b, side, chan):
    """X of a routing channel, outside both nodes so cross-lane edges work.

    Staggered by `chan` so several parallel channel edges do not collapse onto
    one another.
    """
    if side == "right":
        lane = max(a.lane, b.lane)
        return (lane + 1) * LANE_W - CHANNEL - chan * CHANNEL_STEP
    lane = min(a.lane, b.lane)
    return lane * LANE_W + CHANNEL + chan * CHANNEL_STEP


def _via_channel(draw, a, b, label, side, chan, total_w):
    """Route a -> b around the outside of the lane via a vertical channel.

    The label is placed on the segment entering the *target*, not leaving the
    source: several branches often share one source, so source-side labels
    would stack on top of each other at the same height.
    """
    chx = _channel_x(a, b, side, chan)
    if side == "right":
        pts = [(a.right, a.cy), (chx, a.cy), (chx, b.cy), (b.right, b.cy)]
        polyline(draw, pts, "left")
    else:
        pts = [(a.left, a.cy), (chx, a.cy), (chx, b.cy), (b.left, b.cy)]
        polyline(draw, pts, "right")
    # Label sits on the vertical channel run, which is outside every node, so
    # it cannot be painted over when the boxes are drawn on top afterwards.
    label_at(draw, label, chx, (a.cy + b.cy) / 2, total_w)


def route(draw, a, b, label, hint, chan, total_w):
    """Orthogonal routing between two nodes."""
    # ---- same lane, adjacent row, straight down ------------------------
    if a.lane == b.lane and a.col == b.col and b.row == a.row + 1:
        pts = [(a.cx, a.bottom), (a.cx, b.top)]
        polyline(draw, pts, "down")
        label_at(draw, label, a.cx + 20, (a.bottom + b.top) / 2, total_w)
        return

    # ---- skips rows: route around via a side channel -------------------
    # Applies across lanes too: a naive dogleg would drive its vertical leg
    # straight through whatever sits in the intervening rows.
    if b.row > a.row + 1:
        side = hint if hint in ("left", "right") else "right"
        _via_channel(draw, a, b, label, side, chan, total_w)
        return

    # ---- loop back upward: route through a side channel ---------------
    if b.row <= a.row and hint != "cross":
        side = hint if hint in ("left", "right") else "left"
        _via_channel(draw, a, b, label, side, chan, total_w)
        return

    # ---- same lane but different column, going down -------------------
    if a.lane == b.lane:
        mid = (a.bottom + b.top) / 2
        pts = [(a.cx, a.bottom), (a.cx, mid), (b.cx, mid), (b.cx, b.top)]
        polyline(draw, pts, "down")
        label_at(draw, label, (a.cx + b.cx) / 2, mid - 11, total_w)
        return

    # ---- cross-lane ---------------------------------------------------
    if b.row == a.row:
        if b.lane > a.lane:
            pts = [(a.right, a.cy), (b.left, b.cy)]
            polyline(draw, pts, "right")
        else:
            pts = [(a.left, a.cy), (b.right, b.cy)]
            polyline(draw, pts, "left")
        label_at(draw, label, (a.cx + b.cx) / 2, a.cy - 12, total_w)
        return

    # cross-lane, downward: keep the horizontal run inside the inter-row gap
    # immediately below the source so it cannot cut through other boxes.
    mid = a.bottom + (ROW_H - NODE_H) / 2
    pts = [(a.cx, a.bottom), (a.cx, mid), (b.cx, mid), (b.cx, b.top)]
    polyline(draw, pts, "down")
    label_at(draw, label, (a.cx + b.cx) / 2, mid - 11, total_w)


def render(spec, path):
    nodes = {n.id: n for n in spec["nodes"]}
    rows = max(n.row for n in spec["nodes"]) + 1
    lanes = spec["lanes"]
    W = LANE_W * len(lanes)
    H = PAD_TOP + HEADER_H + rows * ROW_H + PAD_BOTTOM

    img = Image.new("RGB", (s(W), s(H)), WHITE)
    d = ImageDraw.Draw(img)

    # swimlane frames
    for i, name in enumerate(lanes):
        x0 = i * LANE_W
        d.rectangle([s(x0), s(PAD_TOP), s(x0 + LANE_W), s(H - PAD_BOTTOM + 20)],
                    outline=BLACK, width=2, fill=WHITE)
        d.rectangle([s(x0), s(PAD_TOP), s(x0 + LANE_W), s(PAD_TOP + HEADER_H)],
                    outline=BLACK, width=2, fill=WHITE)
        tw = d.textlength(name, font=F_LANE)
        d.text((s(x0 + LANE_W / 2) - tw / 2, s(PAD_TOP + HEADER_H / 2) - F_LANE.size / 2),
               name, font=F_LANE, fill=BLACK)

    # edges first so boxes sit on top
    for e in spec["edges"]:
        a, b = nodes[e[0]], nodes[e[1]]
        label = e[2] if len(e) > 2 else ""
        hint = e[3] if len(e) > 3 else ""
        chan = e[4] if len(e) > 4 else 0
        route(d, a, b, label, hint, chan, W)

    for n in spec["nodes"]:
        draw_node(d, n)

    img = img.resize((W, H), Image.LANCZOS)
    img.save(path)


def N(nid, kind, lane, row, label="", col=0):
    return Node(nid, kind, lane, row, label, col)
