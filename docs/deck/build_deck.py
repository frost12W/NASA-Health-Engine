# -*- coding: utf-8 -*-
"""Build the 7-slide Health Engine pitch deck (NASA Space Apps 2026).

The deck carries the *content* the official template asks for on each of its
seven slides (title+summary, problem, solution, how it works, demo, impact and
next steps, team and references). The visual language is our own product style:
dark technical surface, thin rules, one accent per idea, large numbers.

Slide 5 carries a real capture of the running app, cropped to the frame.
"""

import os
import sys
import tempfile

from PIL import Image

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt

# ---------------------------------------------------------------- design tokens
BG     = RGBColor(0x0A, 0x14, 0x20)
PANEL  = RGBColor(0x10, 0x1D, 0x2E)
PANEL2 = RGBColor(0x0D, 0x18, 0x28)
LINE   = RGBColor(0x1E, 0x33, 0x50)
TEXT   = RGBColor(0xE8, 0xEE, 0xF7)
MUTED  = RGBColor(0x8F, 0xA3, 0xBF)
GREEN  = RGBColor(0x6F, 0xD3, 0xA6)
BLUE   = RGBColor(0x5A, 0xA6, 0xE0)
AMBER  = RGBColor(0xE9, 0xB9, 0x49)

FONT = "Segoe UI"
FONT_SB = "Segoe UI Semibold"

W, H = 13.333, 7.5
ML, MR = 0.75, 12.58
CW = MR - ML                     # 11.83 in


# ------------------------------------------------------------------- primitives
def rect(slide, x, y, w, h, fill=None, line=None, lw=0.75, dash=None,
         shape=MSO_SHAPE.RECTANGLE, radius=None):
    s = slide.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    if radius is not None:
        s.adjustments[0] = radius
    if fill is None:
        s.fill.background()
    else:
        s.fill.solid()
        s.fill.fore_color.rgb = fill
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line
        s.line.width = Pt(lw)
        if dash is not None:
            s.line.dash_style = dash
    s.shadow.inherit = False
    return s


def text(slide, x, y, w, h, paras, anchor=MSO_ANCHOR.TOP, align=PP_ALIGN.LEFT):
    """paras: list of dicts with either 'text' or 'runs'; plus optional size,
    color, bold, font, space_before, space_after, line_spacing, align, spacing."""
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    for i, p in enumerate(paras):
        par = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        par.alignment = p.get("align", align)
        if p.get("space_before") is not None:
            par.space_before = Pt(p["space_before"])
        if p.get("space_after") is not None:
            par.space_after = Pt(p["space_after"])
        if p.get("line_spacing"):
            par.line_spacing = p["line_spacing"]
        runs = p.get("runs") or [(p.get("text", ""), p.get("color", TEXT),
                                  p.get("size", 12), p.get("bold", False),
                                  p.get("font", FONT),
                                  p.get("spacing"))]
        for txt, color, size, bold, font, spc in runs:
            r = par.add_run()
            r.text = txt
            r.font.name = font
            r.font.size = Pt(size)
            r.font.bold = bold
            r.font.color.rgb = color
            if spc:
                r.font._rPr.set("spc", str(int(spc * 100)))
    return tb


def label(slide, x, y, w, t, color=MUTED, size=8.5, spacing=1.4):
    text(slide, x, y, w, 0.20, [{"text": t.upper(), "size": size, "color": color,
                                 "bold": True, "spacing": spacing}])


def text_link(slide, x, y, w, h, txt, size, color, url, bold=False):
    """Text in our own colour; the whole text box is the click target.

    The hyperlink sits on the shape, not on the run: PowerPoint applies the
    theme link colour to hyperlinked runs, which would break the dark palette.
    """
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    run = tf.paragraphs[0].add_run()
    run.text = txt
    run.font.name = FONT
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    tb.click_action.hyperlink.address = url
    return tb


def hairline(slide, x, y, w, color=LINE, h=0.008):
    rect(slide, x, y, w, h, fill=color)


def page(slide, n):
    """Background plus the two navigation marks used on every slide."""
    rect(slide, 0, 0, W, H, fill=BG)
    text(slide, ML, 0.50, 3.0, 0.20,
         [{"text": f"{n:02d} / 07", "size": 9, "color": MUTED, "bold": True,
           "spacing": 1.6}])
    text(slide, MR - 3.0, 0.50, 3.0, 0.20,
         [{"text": "HEALTH ENGINE", "size": 9, "color": MUTED, "bold": True,
           "align": PP_ALIGN.RIGHT, "spacing": 1.6}])


def header(slide, section, title, size=38, width=11.4):
    label(slide, ML, 0.95, 6.0, section, color=GREEN)
    text(slide, ML, 1.24, width, 0.86,
         [{"text": title, "size": size, "color": TEXT, "bold": True,
           "font": FONT_SB, "line_spacing": 0.92}])
    hairline(slide, ML, 2.02, CW)


def footer(slide):
    hairline(slide, ML, 6.90, CW)
    text(slide, ML, 7.02, 6.4, 0.20,
         [{"text": "NASA Space Apps Challenge 2026  ·  Bishkek, Kyrgyzstan",
           "size": 8, "color": MUTED}])
    text(slide, MR - 4.6, 7.02, 4.6, 0.20,
         [{"text": "Screening-support tool. It does not diagnose.",
           "size": 8, "color": MUTED, "align": PP_ALIGN.RIGHT}])


def notes(slide, t):
    slide.notes_slide.notes_text_frame.text = t


def card(slide, x, y, w, h, fill=PANEL, line=LINE):
    rect(slide, x, y, w, h, fill=fill, line=line, lw=0.75)


SHOT_SRC = r"C:\Users\Tima\Documents\spaceapps-2026\_video\app-now.png"
SHOT_CROP = (30, 152, 1400, 900)   # drop the UTC/DOY/MET band, keep profile + SUMMARY


def app_screenshot(width_in, height_in):
    """Crop the capture to the frame's aspect ratio (no stretching) and return
    (path, pixel_size)."""
    im = Image.open(SHOT_SRC).convert("RGB").crop(SHOT_CROP)
    target = width_in / height_in
    w, h = im.size
    if w / h > target:                                    # too wide: trim sides
        new_w = int(round(h * target))
        left = (w - new_w) // 2
        im = im.crop((left, 0, left + new_w, h))
    else:                                                 # too tall: trim bottom
        im = im.crop((0, 0, w, int(round(w / target))))
    out = os.path.join(tempfile.gettempdir(), "he_app_shot.png")
    im.save(out, "PNG")
    return out, im.size


# ------------------------------------------------------------------------ deck
prs = Presentation()
prs.slide_width = Inches(W)
prs.slide_height = Inches(H)
blank = prs.slide_layouts[6]

# ============================================================ 1. title + summary
s = prs.slides.add_slide(blank)
page(s, 1)
label(s, ML, 0.95, 8.0, "NASA Space Apps Challenge 2026  ·  Bishkek, Kyrgyzstan", color=GREEN)
text(s, ML, 1.26, 7.6, 1.30,
     [{"text": "Health Engine", "size": 64, "color": TEXT, "bold": True,
       "font": FONT_SB, "line_spacing": 0.9}])
text(s, ML, 2.66, 7.30, 1.60,
     [{"text": "An offline desktop app that walks a crew member through a guided health check "
               "and either shows a pulse reading with its evidence or refuses and says why.",
       "size": 18, "color": TEXT, "line_spacing": 1.24}])

hairline(s, ML, 5.32, 7.30)

stats = [("65.9", " bpm", "one valid check, all gates passed"),
         ("0.16", " bpm", "spread between three methods"),
         ("2", "", "checks refused, each with its reason")]
sx = ML
for num, unit, cap in stats:
    text(s, sx, 5.52, 2.40, 0.55,
         [{"runs": [(num, GREEN if num == "65.9" else TEXT, 30, True, FONT_SB, None),
                    (unit, MUTED, 10.5, False, FONT, None)]}])
    text(s, sx, 6.10, 2.30, 0.24, [{"text": cap, "size": 8.5, "color": MUTED}])
    sx += 2.81

# required fields block
card(s, 8.62, 2.60, 3.96, 3.50)
label(s, 8.86, 2.82, 3.5, "Project", color=BLUE)
text(s, 8.86, 3.06, 3.50, 0.30, [{"text": "Health Engine", "size": 13, "color": TEXT, "bold": True}])
hairline(s, 8.86, 3.52, 3.48)
label(s, 8.86, 3.70, 3.5, "Team", color=BLUE)
text(s, 8.86, 3.94, 3.50, 0.30, [{"text": "Health Engine, Bishkek", "size": 13, "color": TEXT, "bold": True}])
hairline(s, 8.86, 4.40, 3.48)
label(s, 8.86, 4.58, 3.5, "Challenge", color=BLUE)
text(s, 8.86, 4.82, 3.44, 1.10,
     [{"text": "Create Health Monitoring Software for Astronauts on Space Missions",
       "size": 12.5, "color": TEXT, "line_spacing": 1.18}])
footer(s)
notes(s, "Health Engine is an offline desktop tool for crews who have no clinician on call. It runs a "
         "guided check on the laptop already on board, and it either gives a pulse reading with its "
         "evidence or refuses to give one. The number on this slide comes from one real session on our "
         "own hardware, and the deck claims nothing beyond that record.")

# ================================================================ 2. problem
s = prs.slides.add_slide(blank)
page(s, 2)
header(s, "Problem", "The crew is the first responder", size=36)

blocks = [
    (2.24, "The problem in one sentence",
     "On a station or a lunar base there is no clinician on call: a crew member has to notice a "
     "change, measure it, and decide whether it is worth reporting."),
    (3.62, "Who is affected",
     "Small crews months away from resupply, working from the same laptop for a whole rotation — "
     "with no ground link to ask and no account to log in to."),
    (5.00, "Why it matters now",
     "NASA HRP names the risks behind the metrics: behavioural health, cardiovascular, immune "
     "response, bone loss. A trend needs records, and records have to survive a mission with no "
     "ground link."),
]
for y, lab, body in blocks:
    label(s, ML, y, 5.4, lab, color=BLUE, size=8)
    text(s, ML, y + 0.26, 6.35, 1.20,
         [{"text": body, "size": 13.5, "color": TEXT, "line_spacing": 1.22}])

rect(s, 7.34, 2.24, 0.008, 4.20, fill=LINE)

rows = [("5", "hazards in NASA HRP", "every stored metric points to one"),
        ("30 s", "for one camera check", "no hardware beyond the laptop"),
        ("0", "network calls", "no account, no cloud, no upload")]
ry = 2.26
for num, cap, sub in rows:
    text(s, 7.62, ry, 2.0, 0.62, [{"text": num, "size": 32, "color": GREEN, "bold": True,
                                   "font": FONT_SB}])
    text(s, 7.62, ry + 0.66, 4.60, 0.28, [{"text": cap, "size": 10.5, "color": TEXT, "bold": True}])
    text(s, 7.62, ry + 0.90, 4.60, 0.24, [{"text": sub, "size": 8.5, "color": MUTED}])
    ry += 1.40
    if num != "0":
        hairline(s, 7.62, ry - 0.14, 4.90)

footer(s)
notes(s, "The gap is not data collection: crews already log how they feel. The gap is a check that can "
         "be run alone, offline, and that is honest about its own quality. NASA HRP supplies the frame — "
         "every metric we store points back to a named hazard and risk.")

# ================================================================ 3. solution
s = prs.slides.add_slide(blank)
page(s, 3)
header(s, "Solution", "A check that can refuse", size=36)

rows3 = [
    ("01", "The idea in one sentence",
     "Four guided steps — how you feel, pulse from the camera, blood pressure and temperature, "
     "summary — stored on that computer and nowhere else."),
    ("02", "What is new compared to existing solutions",
     "Refusal is a feature. Three estimators must agree and six quality gates must pass before a "
     "number is shown; otherwise the app names the gate that failed."),
    ("03", "Why this approach works",
     "Deterministic signal processing from two published methods, not a trained model: every step "
     "can be explained and no training data is needed."),
]
ry = 2.22
for idx, lab, body in rows3:
    text(s, ML, ry + 0.02, 0.55, 0.24, [{"text": idx, "size": 10.5, "color": GREEN, "bold": True}])
    label(s, ML + 0.62, ry + 0.03, 8.0, lab, color=BLUE, size=8)
    text(s, ML + 0.62, ry + 0.30, 8.95, 0.90,
         [{"text": body, "size": 14, "color": TEXT, "line_spacing": 1.22}])
    ry += 1.34
    if idx != "03":
        hairline(s, ML, ry - 0.14, CW)

rect(s, ML, 6.22, 0.05, 0.32, fill=AMBER)
text(s, ML + 0.22, 6.22, 10.0, 0.32,
     [{"text": "A weak signal produces no number, a stated reason, and a stored record of the attempt.",
       "size": 12, "color": AMBER}])
footer(s)
notes(s, "Most health apps are built to always produce a number; we built one designed to withhold it. "
         "The gates and the agreement between three estimators are what make the remaining number worth "
         "reading. That refusal path is the part that took the most engineering.")

# ============================================================= 4. how it works
s = prs.slides.add_slide(blank)
page(s, 4)
header(s, "How it works", "NASA HRP as the frame, classical signal path", size=34)

cw2 = (CW - 0.33) / 2
ch2 = 2.02
nasa_lines = [("5 Hazards of Human Spaceflight", "nasa.gov/hrp/hazards"),
              ("Risks of Human Spaceflight", "nasa.gov/hrp/risks"),
              ("Ongoing HRP Research in Space", "nasa.gov/hrp/ongoing-hrp-research")]
nasa_paras = [{"runs": [(n, TEXT, 9.5, False, FONT, None),
                        ("   " + u, MUTED, 8, False, FONT, None)],
               "space_before": 0 if i == 0 else 5, "line_spacing": 1.05}
              for i, (n, u) in enumerate(nasa_lines)]
cells = [
    ("NASA data and resources", nasa_paras,
     "Used as the assessment frame, not as a dataset: every metric points to a hazard and a risk."),
    ("Method",
     [{"text": "MediaPipe Face Landmarker, 478 landmarks, forehead and cheek regions", "size": 9.5,
       "color": TEXT, "line_spacing": 1.05},
      {"text": "POS (Wang 2017) + CHROM (de Haan 2013) + GREEN, 30 s window", "size": 9.5,
       "color": TEXT, "space_before": 3, "line_spacing": 1.05},
      {"text": "Gates: fps, face, motion, light, SNR, method agreement", "size": 9.5,
       "color": AMBER, "space_before": 3, "line_spacing": 1.05}],
     "A number is stored only when every gate passes."),
    ("AI tools used",
     [{"text": "OpenAI Codex — drafted and edited the application code", "size": 9.5, "color": TEXT,
       "line_spacing": 1.05},
      {"text": "DeepSeek Harness assistant — analysis, tests, documentation", "size": 9.5,
       "color": TEXT, "space_before": 3, "line_spacing": 1.05},
      {"text": "No AI tool produced a measurement; the team checked each number", "size": 8.5,
       "color": MUTED, "space_before": 3, "line_spacing": 1.05}],
     "Disclosed in docs/AI-DISCLOSURE.md."),
    ("Tech stack",
     [{"text": "Tauri 2 shell · React interface · Rust storage", "size": 9.5, "color": TEXT,
       "line_spacing": 1.05},
      {"text": "Python worker: OpenCV, MediaPipe · SQLite", "size": 9.5, "color": TEXT,
       "space_before": 3, "line_spacing": 1.05},
      {"text": "Fully offline: no server, no account, no upload", "size": 9.5, "color": AMBER,
       "space_before": 3, "line_spacing": 1.05}],
     "Installs on the crew computer that already exists."),
]
for i, (title, paras, foot) in enumerate(cells):
    x = ML + (i % 2) * (cw2 + 0.33)
    y = 2.18 + (i // 2) * (ch2 + 0.26)
    card(s, x, y, cw2, ch2)
    label(s, x + 0.24, y + 0.18, 4.6, title, color=BLUE, size=8)
    text(s, x + 0.24, y + 0.46, cw2 - 0.48, 1.05, paras)
    text(s, x + 0.24, y + ch2 - 0.40, cw2 - 0.48, 0.32,
         [{"text": foot, "size": 8, "color": MUTED, "line_spacing": 1.05}])

footer(s)
notes(s, "Two things to be precise about. Our NASA input is Human Research Program material — hazards, "
         "risks, ongoing research — used as the frame for what we record, and no NASA dataset is used "
         "for the signal itself. The pulse comes from published deterministic methods, while machine "
         "learning is used only to find the face. Codex and a DeepSeek assistant helped build the "
         "project; the team verified every number.")

# =================================================================== 5. demo
s = prs.slides.add_slide(blank)
page(s, 5)
header(s, "Demo and evidence", "One valid check: 65.9 bpm", size=36)

# --- app capture (left half of the slide)
ph_x, ph_y, ph_w, ph_h = ML, 2.20, 6.30, 3.42
shot_path, shot_px = app_screenshot(ph_w, ph_h)
pic = s.shapes.add_picture(shot_path, Inches(ph_x), Inches(ph_y), width=Inches(ph_w))
shot_h = pic.height / 914400
rect(s, ph_x, ph_y, ph_w, shot_h, fill=None, line=LINE, lw=0.75)

# --- method agreement (right column)
mx = 7.32
label(s, mx, 2.24, 5.0, "Three estimators, one session", color=BLUE, size=8)
ry = 2.52
for name, val, snr in [("POS", "65.9", "4.76 dB"), ("CHROM", "65.8", "1.60 dB"),
                       ("GREEN", "65.7", "0.21 dB")]:
    text(s, mx, ry + 0.06, 2.0, 0.28, [{"text": name, "size": 10, "color": MUTED, "bold": True}])
    text(s, mx + 2.10, ry + 0.06, 0.90, 0.24,
         [{"text": snr, "size": 8, "color": MUTED, "align": PP_ALIGN.RIGHT}])
    text(s, mx + 3.05, ry - 0.06, 1.20, 0.44,
         [{"text": val, "size": 21, "color": TEXT, "bold": True, "font": FONT_SB,
           "align": PP_ALIGN.RIGHT}])
    hairline(s, mx, ry + 0.50, 4.26)
    ry += 0.62

text(s, mx, ry + 0.06, 4.26, 0.34,
     [{"text": "spread 0.16 bpm between POS and CHROM", "size": 11.5, "color": GREEN, "bold": True}])
text(s, mx, ry + 0.42, 4.26, 0.60,
     [{"text": "COMPLETED_VALID · 30 s of usable video · 15.6 fps · YUY2 640×480 · quality 1.0",
       "size": 8, "color": MUTED, "line_spacing": 1.15}])

# --- refusals and links
panel_y, panel_h = 5.70, 1.04
card(s, ML, panel_y, 5.95, panel_h, fill=PANEL2)
rect(s, ML, panel_y, 0.05, panel_h, fill=AMBER)
label(s, ML + 0.24, panel_y + 0.12, 5.3, "And when the signal is weak", color=AMBER, size=8)
text(s, ML + 0.24, panel_y + 0.36, 5.55, 0.56,
     [{"runs": [("Two attempts before it were refused: ", MUTED, 8.2, False, FONT, None),
                ("INCONCLUSIVE", TEXT, 8.2, True, FONT, None),
                (" — methods 35 bpm apart (POS 90.6 / CHROM 55.5), and record halves 10.4 bpm apart. "
                 "No number was published; the failed gate was stored with the attempt.",
                 MUTED, 8.2, False, FONT, None)],
       "line_spacing": 1.2}])

DEMO_URL = ("https://raw.githubusercontent.com/frost12W/NASA-Health-Engine/"
            "main/docs/media/health-engine-30s.mp4")
REPO_URL = "https://github.com/frost12W/NASA-Health-Engine"
card(s, 7.05, panel_y, 5.53, panel_h)
label(s, 7.29, panel_y + 0.11, 5.0, "Demo — 30 s video, English subtitles", color=BLUE, size=7.5)
text_link(s, 7.29, panel_y + 0.31, 5.03, 0.20, DEMO_URL, 7.2, BLUE, DEMO_URL)
text_link(s, 7.29, panel_y + 0.62, 5.03, 0.22, "Code · github.com/frost12W/NASA-Health-Engine",
          7.6, TEXT, REPO_URL)

footer(s)
notes(s, "This is the frame judges need: 65.9, 65.8 and 65.7 from three independent estimators on the "
         "same thirty seconds of camera video. The capture on the left is the running app: profile "
         "ARGEN, SUMMARY with the 65.9 bpm reading. Note that blood pressure, temperature, sleep and "
         "mood are typed in by hand — only the pulse is measured — and before that session two attempts "
         "were refused with the failing gate named. Open the demo and repository links in a private "
         "window before submitting.")

# ==================================================== 6. impact and next steps
s = prs.slides.add_slide(blank)
page(s, 6)
header(s, "Impact and next steps", "Any laptop, any orbit", size=36)

left = [
    (2.24, "Who benefits and how",
     "Crews on a station or a lunar base: an installed app, a laptop camera and a record that stays "
     "on board, so a change in one metric becomes visible as a trend.", BLUE, TEXT),
    (3.60, "Expected reach",
     "One install per computer, no server and no account: the whole crew uses it, and every later "
     "rotation inherits the records. The same build serves analogue sites that also work offline.",
     BLUE, TEXT),
    (5.06, "What we do not claim",
     "Accuracy against a reference device is not measured yet: one subject, one camera, one lighting "
     "condition. Reproducibility is shown; clinical validity is not claimed.", AMBER, AMBER),
]
for y, lab, body, lc, bc in left:
    label(s, ML, y, 5.6, lab, color=lc, size=8)
    text(s, ML, y + 0.26, 6.20, 1.20, [{"text": body, "size": 12.5, "color": bc, "line_spacing": 1.22}])

card(s, 7.35, 2.20, 5.23, 4.55)
label(s, 7.59, 2.42, 4.6, "Next steps after the hackathon", color=BLUE, size=8)
steps = [
    ("1", "Reference-device comparison", "5–7 paired measurements, then MAE and bias, per the protocol in docs/VALIDATION.md"),
    ("2", "Validation on PURE and UBFC-rPPG", "public rPPG datasets with a reference pulse, to report error across more faces and lights"),
    ("3", "Threshold library with rule IDs", "AHA and NHS thresholds are declared, not yet in the build; they ship with their sources"),
    ("4", "Ship it properly", "bundle the Python worker in the installer, English interface everywhere, signed build"),
]
sy = 2.76
for num, head, body in steps:
    text(s, 7.59, sy, 0.26, 0.24, [{"text": num, "size": 10, "color": GREEN, "bold": True}])
    text(s, 7.92, sy - 0.02, 4.40, 0.24, [{"text": head, "size": 10.5, "color": TEXT, "bold": True}])
    text(s, 7.92, sy + 0.24, 4.40, 0.52, [{"text": body, "size": 8, "color": MUTED, "line_spacing": 1.12}])
    sy += 1.00

footer(s)
notes(s, "The benefit is not a better sensor, it is a record a crew can act on without a network. The "
         "roadmap is deliberately plain: compare against a real pulse oximeter, then against the public "
         "datasets, then turn the declared AHA and NHS rules into shipped thresholds. Until that "
         "comparison exists we state that accuracy is not measured.")

# ===================================================== 7. team and references
s = prs.slides.add_slide(blank)
page(s, 7)
header(s, "Team and references", "Team Health Engine, Bishkek", size=36)

label(s, ML, 2.20, 4.6, "Team name", color=BLUE, size=8)
text(s, ML, 2.44, 4.80, 0.30,
     [{"text": "Health Engine — Bishkek, Kyrgyzstan", "size": 12.5, "color": TEXT, "bold": True}])

label(s, ML, 2.92, 4.6, "Team members and roles", color=BLUE, size=8)
members = [("Artem Maltsev", "Team lead", "product, Rust shell, decisions"),
           ("Argen Bagylov", "Signal", "POS / CHROM, quality gates"),
           ("Argen Bagylov, Artem Maltsev", "Interface", "React screens, records, export"),
           ("Argen Bagylov", "Docs", "measurements, sources, submission")]
my = 3.18
for name, role, what in members:
    text(s, ML, my, 2.66, 0.24, [{"text": name, "size": 10.5, "color": TEXT, "bold": True}])
    text(s, ML + 2.62, my + 0.03, 1.48, 0.20,
         [{"text": role.upper(), "size": 7, "color": BLUE, "bold": True, "spacing": 1.1,
           "align": PP_ALIGN.RIGHT}])
    text(s, ML, my + 0.22, 4.10, 0.20, [{"text": what, "size": 7.8, "color": MUTED}])
    hairline(s, ML, my + 0.48, 4.10)
    my += 0.60

label(s, ML, 5.66, 4.6, "How AI and NASA data were used", color=BLUE, size=8)
text(s, ML, 5.90, 4.30, 0.70,
     [{"runs": [("AI: ", TEXT, 8.5, True, FONT, None),
                ("code, analysis and text — docs/AI-DISCLOSURE.md", MUTED, 8.5, False, FONT, None)],
       "line_spacing": 1.25},
      {"runs": [("NASA: ", TEXT, 8.5, True, FONT, None),
                ("HRP hazards, risks and ongoing research as the frame", MUTED, 8.5, False, FONT, None)],
       "line_spacing": 1.25}])

card(s, 5.95, 2.16, 6.63, 4.24)
label(s, 6.19, 2.38, 6.0, "References — datasets, tools, open-source resources", color=BLUE, size=8)
refs = [
    ("NASA Human Research Program — 5 Hazards of Human Spaceflight, Risks of Human Spaceflight, "
     "Ongoing HRP Research in Space  ", "nasa.gov/hrp/hazards · /risks · /ongoing-hrp-research"),
    ("Wang, den Brinker, Stuijk, de Haan (2017), Algorithmic Principles of Remote PPG  ",
     "doi.org/10.1109/TBME.2016.2609282"),
    ("de Haan, Jeanne (2013), Robust Pulse Rate From Chrominance-Based rPPG  ",
     "doi.org/10.1109/TBME.2013.2266196"),
    ("Google MediaPipe Face Landmarker and face_landmarker.task  ", "Apache-2.0"),
    ("OpenCV, NumPy, SciPy  ", "Apache-2.0 · BSD-3-Clause"),
    ("Tauri 2, React, TypeScript, SQLite  ", "MIT · Apache-2.0 · public domain"),
    ("American Heart Association and NHS pages  ", "declared, thresholds not in this build"),
    ("Challenge page, Project Submission Guide, Judging & Awards Guide  ",
     "spaceappschallenge.org"),
    ("Datasets planned for validation only — PURE, UBFC-rPPG, MMPD  ",
     "requested, not used in this build"),
    ("Project code  ", "MIT"),
]
paras = []
for name, meta in refs:
    paras.append({"runs": [(name, TEXT, 7.9, False, FONT, None),
                           (meta, MUTED, 7.1, False, FONT, None)],
                  "line_spacing": 1.14, "space_before": 6})
text(s, 6.19, 2.64, 6.15, 3.60, paras)

text(s, 5.95, 6.48, 6.63, 0.40,
     [{"text": "Created for the NASA Space Apps Challenge 2026. NASA does not endorse this project; "
               "no NASA logos or mission identifiers are used.", "size": 7, "color": MUTED,
       "line_spacing": 1.1}])
footer(s)
notes(s, "Project name, team name and the chosen challenge are the three fields the template requires, "
         "and all three are on the deck. References list every NASA resource, both papers, the MediaPipe "
         "model and each open-source library with its license. Team names and roles are final; only the "
         "demo link and the code link need a private-window check before submitting.")

prs.core_properties.title = "Health Engine — NASA Space Apps Challenge 2026"
prs.core_properties.author = "Team Health Engine, Bishkek"
prs.core_properties.subject = "Seven-slide project demo deck"
prs.core_properties.comments = ("Content follows the fields required by the official NASA Space Apps "
                                "2026 Pitch Deck Template; visual design is the team's own.")

out = (sys.argv[1] if len(sys.argv) > 1 else
       os.path.join(os.path.dirname(os.path.abspath(__file__)), "health-engine-7-slides.pptx"))
prs.save(out)
print("saved", out, "slides:", len(prs.slides._sldIdLst))
