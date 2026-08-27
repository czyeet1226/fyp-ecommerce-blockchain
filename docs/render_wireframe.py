"""
Renders low-fidelity UI wireframes to PNG using Pillow.

Why Pillow instead of Mermaid/draw.io export: the draw.io MCP only opens an
editor (no image export), and Mermaid has no wireframe primitives. Drawing at
explicit coordinates gives a clean, print-friendly greyscale wireframe that can
be embedded straight into the Word document.

Every screen is a flat list of element tuples, so layout is deterministic.

Usage (via make_wireframe_docx.py):
    py make_wireframe_docx.py
"""

import os
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "wireframes")

SCALE = 2  # supersample factor for crisp text

BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
GREY_LINE = (110, 110, 110)
GREY_SOFT = (170, 170, 170)
GREY_FILL = (238, 238, 238)
GREY_MID = (218, 218, 218)
GREY_DARK = (90, 90, 90)
GREY_TEXT = (105, 105, 105)


def _font(size, bold=False):
    names = ["arialbd.ttf", "calibrib.ttf"] if bold else ["arial.ttf", "calibri.ttf"]
    for n in names:
        try:
            return ImageFont.truetype(n, size)
        except OSError:
            continue
    return ImageFont.load_default()


FONTS = {}


def font(size, bold=False):
    key = (size, bold)
    if key not in FONTS:
        FONTS[key] = _font(int(size * SCALE), bold)
    return FONTS[key]


def s(v):
    return int(round(v * SCALE))


# Arial/Calibri have no glyphs for the emoji and dingbats the real UI uses, so
# they would render as empty tofu boxes. Substitute plain-text equivalents.
SAFE_CHARS = {
    "\u2726": "ELX",       # Elixir token mark
    "\u27e0": "ETH",       # ETH diamond
    "\u2713": "v",         # check
    "\u2715": "X",         # close
    "\u21bb": "",          # refresh arrow
    "\u21c4": "<>",        # swap arrows
    "\u26a0": "!",         # warning
    "\u25b8": ">",         # small right triangle
    "\u25be": "v",         # chevron down
    "\u25b4": "^",         # chevron up
    "\u25cf": "*",         # status dot
    "\u2205": "[ ]",       # empty set
    "\uff0b": "+",         # fullwidth plus
    "\u270e": "",          # pencil / edit
    "\u2212": "-",         # minus sign
    "\u2699": "",          # gear
    "\u2302": "",          # house
    "\u23f3": "",          # hourglass
    "\U0001f98a": "",      # fox
    "\U0001f6e1": "",      # shield
    "\U0001f381": "",      # gift
    "\U0001f512": "",      # lock
    "\U0001f4c8": "",      # chart
}


def safe(text):
    out = str(text)
    for k, v in SAFE_CHARS.items():
        if k in out:
            out = out.replace(k, v)
    return out


# --------------------------------------------------------------- primitives ---

def _truncate(d, text, f, max_w):
    if d.textlength(text, font=f) <= s(max_w):
        return text
    ell = "\u2026"
    out = text
    while out and d.textlength(out + ell, font=f) > s(max_w):
        out = out[:-1]
    return out + ell


def _wrap(d, text, f, max_w):
    lines = []
    for para in safe(text).split("\n"):
        words, cur = para.split(), ""
        if not words:
            lines.append("")
            continue
        for w in words:
            trial = (cur + " " + w).strip()
            if d.textlength(trial, font=f) <= s(max_w) or not cur:
                cur = trial
            else:
                lines.append(cur)
                cur = w
        lines.append(cur)
    return lines


def draw_rect(d, x, y, w, h, fill=WHITE, outline=GREY_LINE, radius=0, width=1,
              dash=False):
    box = [s(x), s(y), s(x + w), s(y + h)]
    if radius:
        d.rounded_rectangle(box, radius=s(radius), fill=fill,
                            outline=None if dash else outline, width=s(width))
    else:
        d.rectangle(box, fill=fill, outline=None if dash else outline,
                    width=s(width))
    if dash and outline:
        _dashed_box(d, x, y, w, h, outline)


def _dashed_box(d, x, y, w, h, color, dash=6, gap=4):
    def run(x0, y0, x1, y1):
        if y0 == y1:
            cx = x0
            while cx < x1:
                d.line([s(cx), s(y0), s(min(cx + dash, x1)), s(y1)],
                       fill=color, width=s(1))
                cx += dash + gap
        else:
            cy = y0
            while cy < y1:
                d.line([s(x0), s(cy), s(x1), s(min(cy + dash, y1))],
                       fill=color, width=s(1))
                cy += dash + gap
    run(x, y, x + w, y)
    run(x, y + h, x + w, y + h)
    run(x, y, x, y + h)
    run(x + w, y, x + w, y + h)


def draw_text(d, x, y, text, size=11, bold=False, color=BLACK, align="left",
              max_w=None, box_w=None):
    f = font(size, bold)
    text = safe(text)
    if max_w:
        text = _truncate(d, text, f, max_w)
    tw = d.textlength(text, font=f)
    px = s(x)
    if align == "center" and box_w:
        px = s(x) + (s(box_w) - tw) / 2
    elif align == "right" and box_w:
        px = s(x) + s(box_w) - tw
    d.text((px, s(y)), text, font=f, fill=color)
    return f.size / SCALE


def draw_para(d, x, y, w, text, size=10, color=GREY_TEXT, bold=False,
              line_gap=3):
    f = font(size, bold)
    lines = _wrap(d, text, f, w)
    cy = y
    for ln in lines:
        d.text((s(x), s(cy)), ln, font=f, fill=color)
        cy += size + line_gap
    return cy - y


# ----------------------------------------------------------------- elements ---

def el_rect(d, e):
    _, x, y, w, h = e[:5]
    o = e[5] if len(e) > 5 else {}
    draw_rect(d, x, y, w, h,
              fill=o.get("fill", WHITE),
              outline=o.get("outline", GREY_LINE),
              radius=o.get("radius", 0),
              width=o.get("width", 1),
              dash=o.get("dash", False))


def el_text(d, e):
    _, x, y, text = e[:4]
    o = e[4] if len(e) > 4 else {}
    draw_text(d, x, y, text,
              size=o.get("size", 11),
              bold=o.get("bold", False),
              color=o.get("color", BLACK),
              align=o.get("align", "left"),
              box_w=o.get("box_w"),
              max_w=o.get("max_w"))


def el_para(d, e):
    _, x, y, w, text = e[:5]
    o = e[5] if len(e) > 5 else {}
    draw_para(d, x, y, w, text,
              size=o.get("size", 10),
              color=o.get("color", GREY_TEXT),
              bold=o.get("bold", False))


def el_box(d, e):
    """Bordered box with a wrapped, vertically centred caption."""
    _, x, y, w, h, text = e[:6]
    o = e[6] if len(e) > 6 else {}
    draw_rect(d, x, y, w, h,
              fill=o.get("fill", WHITE),
              outline=o.get("outline", GREY_LINE),
              radius=o.get("radius", 4),
              width=o.get("width", 1),
              dash=o.get("dash", False))
    size = o.get("size", 10)
    bold = o.get("bold", False)
    f = font(size, bold)
    lines = _wrap(d, text, f, w - 12)
    lh = size + 3
    cy = y + (h - lh * len(lines)) / 2
    for ln in lines:
        tw = d.textlength(ln, font=f)
        align = o.get("align", "center")
        if align == "left":
            px = s(x + 8)
        else:
            px = s(x) + (s(w) - tw) / 2
        d.text((px, s(cy)), ln, font=f, fill=o.get("color", BLACK))
        cy += lh


def el_btn(d, e):
    _, x, y, w, h, text = e[:6]
    o = e[6] if len(e) > 6 else {}
    variant = o.get("variant", "primary")
    if variant == "primary":
        fill, outline, color, bold = GREY_DARK, GREY_DARK, WHITE, True
    elif variant == "ghost":
        fill, outline, color, bold = WHITE, GREY_LINE, BLACK, False
    elif variant == "disabled":
        fill, outline, color, bold = GREY_FILL, GREY_SOFT, GREY_SOFT, False
    elif variant == "active":
        fill, outline, color, bold = GREY_MID, BLACK, BLACK, True
    else:  # tag
        fill, outline, color, bold = WHITE, GREY_SOFT, GREY_TEXT, False
    draw_rect(d, x, y, w, h, fill=fill, outline=outline,
              radius=o.get("radius", h / 2 if o.get("round") else 4),
              dash=o.get("dash", False))
    f = font(o.get("size", 10), bold)
    text = _truncate(d, safe(text).strip(), f, w - 10)
    tw = d.textlength(text, font=f)
    d.text((s(x) + (s(w) - tw) / 2, s(y + (h - o.get("size", 10)) / 2 - 1)),
           text, font=f, fill=color)


def el_field(d, e):
    """Form field: uppercase label above an empty input box."""
    _, x, y, w, label = e[:5]
    o = e[5] if len(e) > 5 else {}
    placeholder = o.get("ph", "")
    draw_text(d, x, y, label.upper(), size=8, bold=True, color=GREY_TEXT)
    h = o.get("h", 26)
    top = y + 12
    draw_rect(d, x, top, w, h, fill=WHITE,
              outline=GREY_SOFT if not o.get("disabled") else GREY_MID,
              radius=4)
    if placeholder:
        draw_text(d, x + 8, top + (h - 9) / 2, placeholder, size=9,
                  color=GREY_SOFT, max_w=w - 16)
    if o.get("select"):
        d.polygon([(s(x + w - 16), s(top + h / 2 - 2)),
                   (s(x + w - 8), s(top + h / 2 - 2)),
                   (s(x + w - 12), s(top + h / 2 + 3))], fill=GREY_TEXT)


def el_nav(d, e):
    """Sidebar nav list. items = list of labels, active = index."""
    _, x, y, w, items = e[:5]
    o = e[5] if len(e) > 5 else {}
    active = o.get("active", -1)
    ih = o.get("ih", 28)
    gap = o.get("gap", 5)
    for i, label in enumerate(items):
        top = y + i * (ih + gap)
        is_a = i == active
        draw_rect(d, x, top, w, ih,
                  fill=GREY_MID if is_a else WHITE,
                  outline=BLACK if is_a else GREY_SOFT, radius=4)
        draw_text(d, x + 9, top + (ih - 10) / 2, label, size=10,
                  bold=is_a, max_w=w - 18)


def el_table(d, e):
    _, x, y, w, cols, rows = e[:6]
    o = e[6] if len(e) > 6 else {}
    colw = o.get("colw")
    if not colw:
        colw = [w / len(cols)] * len(cols)
    else:
        total = sum(colw)
        colw = [c / total * w for c in colw]
    rh = o.get("rh", 22)
    hh = o.get("hh", 24)

    draw_rect(d, x, y, w, hh, fill=GREY_FILL, outline=GREY_LINE)
    cx = x
    for i, c in enumerate(cols):
        if i:
            d.line([s(cx), s(y), s(cx), s(y + hh + rh * len(rows))],
                   fill=GREY_SOFT, width=s(1))
        draw_text(d, cx + 6, y + (hh - 9) / 2, c, size=9, bold=True,
                  max_w=colw[i] - 12)
        cx += colw[i]

    for r, row in enumerate(rows):
        top = y + hh + r * rh
        draw_rect(d, x, top, w, rh, fill=WHITE, outline=GREY_SOFT)
        cx = x
        for i, cell in enumerate(row):
            if i:
                d.line([s(cx), s(top), s(cx), s(top + rh)], fill=GREY_SOFT,
                       width=s(1))
            draw_text(d, cx + 6, top + (rh - 9) / 2, str(cell), size=9,
                      color=GREY_TEXT, max_w=colw[i] - 12)
            cx += colw[i]
    d.rectangle([s(x), s(y), s(x + w), s(y + hh + rh * len(rows))],
                outline=GREY_LINE, width=s(1))


def el_steps(d, e):
    """Horizontal N-step progress timeline. done = index of last done step."""
    _, x, y, w, labels = e[:5]
    o = e[5] if len(e) > 5 else {}
    done = o.get("done", 0)
    n = len(labels)
    r = 10
    pitch = (w - 2 * r) / (n - 1)
    cy = y + r
    for i in range(n - 1):
        x0 = x + r + i * pitch + r + 2
        x1 = x + r + (i + 1) * pitch - r - 2
        d.line([s(x0), s(cy), s(x1), s(cy)],
               fill=GREY_DARK if i < done else GREY_SOFT, width=s(2))
    for i, label in enumerate(labels):
        cx = x + r + i * pitch
        is_done = i <= done
        d.ellipse([s(cx - r), s(cy - r), s(cx + r), s(cy + r)],
                  fill=GREY_DARK if is_done else WHITE,
                  outline=GREY_DARK if is_done else GREY_SOFT, width=s(1))
        if is_done:
            # inner dot rather than a check glyph, which Arial lacks
            d.ellipse([s(cx - 3.5), s(cy - 3.5), s(cx + 3.5), s(cy + 3.5)],
                      fill=WHITE, outline=WHITE)
        else:
            mark = str(i + 1)
            f = font(9, True)
            tw = d.textlength(mark, font=f)
            d.text((s(cx) - tw / 2, s(cy - 5)), mark, font=f, fill=GREY_TEXT)
        f2 = font(8, i <= done)
        lbl = _truncate(d, safe(label), f2, pitch - 4)
        tw2 = d.textlength(lbl, font=f2)
        d.text((s(cx) - tw2 / 2, s(cy + r + 4)), lbl, font=f2,
               fill=BLACK if is_done else GREY_TEXT)


def el_progress(d, e):
    _, x, y, w, pct = e[:5]
    o = e[5] if len(e) > 5 else {}
    h = o.get("h", 8)
    draw_rect(d, x, y, w, h, fill=GREY_FILL, outline=GREY_SOFT, radius=h / 2)
    fw = max(2, w * min(100, max(0, pct)) / 100)
    draw_rect(d, x, y, fw, h, fill=GREY_DARK, outline=GREY_DARK, radius=h / 2)


def el_note(d, e):
    """Dashed annotation callout explaining behaviour."""
    _, x, y, w, h, text = e[:6]
    draw_rect(d, x, y, w, h, fill=(250, 250, 250), outline=GREY_DARK, dash=True)
    draw_para(d, x + 8, y + 6, w - 16, text, size=9, color=GREY_DARK)


def el_hline(d, e):
    _, x, y, w = e[:4]
    o = e[4] if len(e) > 4 else {}
    d.line([s(x), s(y), s(x + w), s(y)], fill=o.get("color", GREY_SOFT),
           width=s(o.get("width", 1)))


def el_circle(d, e):
    _, cx, cy, r = e[:4]
    o = e[4] if len(e) > 4 else {}
    d.ellipse([s(cx - r), s(cy - r), s(cx + r), s(cy + r)],
              fill=o.get("fill", WHITE), outline=o.get("outline", GREY_LINE),
              width=s(1))
    if o.get("text"):
        f = font(o.get("size", 10), True)
        txt = safe(o["text"])
        tw = d.textlength(txt, font=f)
        d.text((s(cx) - tw / 2, s(cy) - f.size / 2), txt, font=f,
               fill=o.get("color", BLACK))


RENDERERS = {
    "rect": el_rect,
    "text": el_text,
    "para": el_para,
    "box": el_box,
    "btn": el_btn,
    "field": el_field,
    "nav": el_nav,
    "table": el_table,
    "steps": el_steps,
    "progress": el_progress,
    "note": el_note,
    "hline": el_hline,
    "circle": el_circle,
}


def render(spec, path):
    w, h = spec["w"], spec["h"]
    img = Image.new("RGB", (s(w), s(h)), WHITE)
    d = ImageDraw.Draw(img)

    # outer browser-style frame
    draw_rect(d, 0, 0, w - 1, h - 1, fill=WHITE, outline=BLACK, width=2)

    for e in spec["elements"]:
        RENDERERS[e[0]](d, e)

    img = img.resize((w, h), Image.LANCZOS)
    img.save(path)
