# Usage: python3 one_pager_styles.py OUT_DIR
# Builds three single-page styles of the curated USC programs list.
import os, sys
from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import Paragraph
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER

SECTIONS = [
    ("Viterbi TIE Hub", [
        "William W. Wang Technology Innovation & Entrepreneurship Hub", "Viterbi Startup Garage",
        "Technology Innovation Fellowship", "Summer Smasher", "I-Corps Hub West", "Viterbi Venture Fund",
        "Maseeh Entrepreneurial Prize Competition", "Min Family Challenge", "Trojan Tank", "Origin Weekend",
        "Viterbi Startup Showcase", "Technology Entrepreneurship Minor"]),
    ("Marshall Greif Center", [
        "Lloyd Greif Center for Entrepreneurial Studies", "Greif Incubator", "USC Marshall Venture Fund",
        "New Venture Seed Competition", "ATHENA Initiative & Summit", "Founder Central Initiative",
        "Brittingham Social Enterprise Lab", "Marshall Experts-in-Residence", "Catalyst Microgrant",
        "M.S. Entrepreneurship & Innovation", "M.S. Social Entrepreneurship", "Entrepreneurship Minor"]),
    ("Iovine and Young Academy", [
        "IYA Innovation Quest", "IYA Venture Studio", "IYA Founder Hub", "IYA Founders Bootcamp",
        "IYA Ignite Grants", "IYA Venture Showcase", "IYA Entrepreneur in Residence",
        "ACAD 406: Purpose-Driven Innovation Incubator", "B.S. Arts, Technology & the Business of Innovation",
        "M.S. Integrated Design, Business & Technology", "Health Innovation Minor", "IYA Makerspace"]),
    ("Research & Launch", [
        "USC Stevens Center for Innovation", "Stevens Legal Office Hours", "Innovation Catalyst Program",
        "Startup Launch Award", "Techstars USC Digital Economy Program", "USC + Techstars Startup Weekend",
        "Alfred E. Mann Institute", "IP & Technology Law Clinic"]),
    ("Across USC", [
        "Blackstone LaunchPad", "Founder Clubs", "Alumni Entrepreneurs Network", "VentureWell E-Team Grants",
        "USC Games Summer Bridge Program", "Rossier EdTech Accelerator", "Gould Small Business Clinic",
        "Keck MESH Innovation Cafes"]),
    ("Student Organizations", [
        "LavaLab", "SparkSC", "TroyLabs", "Sigma Eta Pi", "FightOnFounders", "HackSC", "USC Entrepreneur Club",
        "Entrepreneur & Venture Management Association"]),
]
# Grid: row 1 holds the three flagship units, row 2 the rest, so columns line up.
ROWS = [SECTIONS[:3], SECTIONS[3:]]

CARD, GOLD, INK, MUTED, CREAM, LINE = (HexColor(c) for c in
    ("#990000", "#FFCC00", "#1d1d1f", "#6b6b70", "#FBF7F0", "#E8DFD2"))
W, H = letter
esc = lambda s: s.replace("&", "&amp;")


def para(text, style, width):
    p = Paragraph(esc(text), style)
    _, h = p.wrap(width, 1000)
    return p, h


def stack(items, style, width, gap):
    out = [para(t, style, width) for t in items]
    return out, sum(h for _, h in out) + gap * (len(out) - 1)


def draw_stack(c, stacked, x, y, gap):
    for p, h in stacked:
        y -= h
        p.drawOn(c, x, y)
        y -= gap
    return y


def footer(c, color=MUTED, center=False):
    c.setFillColor(color); c.setFont("Helvetica", 7.5)
    t = "University of Southern California  ·  Entrepreneurship & Innovation  ·  Fight On"
    (c.drawCentredString(W / 2, 26, t) if center else c.drawString(40, 26, t))


# ---------- Style A: Cardinal Classic ----------
def classic(path, s=1.0):
    c = Canvas(path, pagesize=letter); c.setTitle("USC Entrepreneurship Programs")
    c.setFillColor(CARD); c.rect(0, H - 104, W, 104, fill=1, stroke=0)
    c.setFillColor(GOLD); c.rect(0, H - 110, W, 6, fill=1, stroke=0)
    c.setFillColor(white); c.setFont("Times-Bold", 46); c.drawString(40, H - 70, "USC")
    c.setFont("Times-Bold", 22); c.drawString(150, H - 58, "Entrepreneurship & Innovation")
    c.setFont("Helvetica", 9.5); c.drawString(151, H - 76, "PROGRAMS AND RESOURCES FOR TROJAN FOUNDERS")
    M, G = 40, 22; cw = (W - 2 * M - 2 * G) / 3
    hs = ParagraphStyle("h", fontName="Times-Bold", fontSize=13.5, leading=16, textColor=CARD)
    it = ParagraphStyle("i", fontName="Helvetica", fontSize=9.6*s, leading=12*s, textColor=INK, leftIndent=9, firstLineIndent=-9)
    y = H - 140
    for row in ROWS:
        blocks = []
        for title, items in row:
            body, bh = stack(["<font color='#990000'>\u2022</font>\u00a0 " + i for i in items], it, cw, 3.2*s)
            blocks.append((title, body, bh))
        rh = max(b[2] for b in blocks)
        for k, (title, body, bh) in enumerate(blocks):
            x = M + k * (cw + G)
            fs = min(13.5 * min(s, 1.1), 13.5 * cw / stringWidth(title, "Times-Bold", 13.5))
            c.setFillColor(CARD); c.setFont("Times-Bold", fs); c.drawString(x, y, title)
            c.setFillColor(GOLD); c.rect(x, y - 7, cw, 2, fill=1, stroke=0)
            yy = y - 20*s
            for p, h in body:
                yy -= h; p.drawOn(c, x, yy); yy -= 3.2*s
        y -= rh + 58*s
    footer(c); c.save(); return y + 58*s - 20*s


# ---------- Style B: Card Grid ----------
def cards(path, s=1.0):
    c = Canvas(path, pagesize=letter); c.setTitle("USC Entrepreneurship Programs")
    c.setFillColor(CREAM); c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(CARD); c.setFont("Times-Bold", 30); c.drawCentredString(W / 2, H - 62, "USC Entrepreneurship & Innovation")
    c.setFillColor(GOLD); c.rect(W / 2 - 40, H - 78, 80, 3.5, fill=1, stroke=0)
    c.setFillColor(MUTED); c.setFont("Helvetica", 9); c.drawCentredString(W / 2, H - 96, "KEY PROGRAMS AND RESOURCES")
    M, G = 36, 14; cw = (W - 2 * M - 2 * G) / 3; pad = 11
    it = ParagraphStyle("i", fontName="Helvetica", fontSize=9.4*s, leading=11.6*s, textColor=INK)
    y = H - 122
    for row in ROWS:
        blocks = [stack(items, it, cw - 2 * pad, 5*s) for _, items in row]
        bh = max(h for _, h in blocks) + 2 * pad + 4
        for k, ((title, _), (body, _)) in enumerate(zip(row, blocks)):
            x = M + k * (cw + G)
            c.setFillColor(white); c.setStrokeColor(LINE); c.setLineWidth(0.8)
            c.rect(x, y - 28 - bh, cw, bh + 28, fill=1, stroke=1)
            c.setFillColor(CARD); c.rect(x, y - 28, cw, 28, fill=1, stroke=0)
            c.setFillColor(GOLD); c.rect(x, y - 31, cw, 3, fill=1, stroke=0)
            c.setFillColor(white); c.setFont("Times-Bold", 12.5); c.drawCentredString(x + cw / 2, y - 19, title)
            yy = y - 31 - pad
            for p, h in body:
                yy -= h; p.drawOn(c, x + pad, yy)
                yy -= 2.5*s; c.setStrokeColor(LINE); c.setLineWidth(0.4); c.line(x + pad, yy, x + cw - pad, yy); yy -= 2.5*s
        y -= bh + 28 + G + 4
    footer(c, center=True); c.save(); return y + G + 4


# ---------- Style C: Editorial Minimal ----------
def editorial(path, s=1.0):
    c = Canvas(path, pagesize=letter); c.setTitle("USC Entrepreneurship Programs")
    c.setFillColor(CARD); c.rect(0, H - 8, W, 8, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 9); c.drawCentredString(W / 2, H - 46, "U S C")
    c.setFillColor(INK); c.setFont("Times-Roman", 30); c.drawCentredString(W / 2, H - 82, "Entrepreneurship & Innovation")
    c.setFillColor(GOLD); c.rect(W / 2 - 22, H - 98, 44, 2.5, fill=1, stroke=0)
    M, G = 44, 26; cw = (W - 2 * M - 2 * G) / 3
    it = ParagraphStyle("i", fontName="Times-Roman", fontSize=10.6*s, leading=13*s, textColor=INK, alignment=TA_CENTER)
    y = H - 140
    for r, row in enumerate(ROWS):
        blocks = [stack(items, it, cw, 4.6*s) for _, items in row]
        rh = max(h for _, h in blocks)
        for k, ((title, _), (body, _)) in enumerate(zip(row, blocks)):
            x = M + k * (cw + G)
            c.setFillColor(CARD); c.setFont("Helvetica-Bold", 8.6)
            c.drawCentredString(x + cw / 2, y, title.upper(), charSpace=1.3)
            c.setStrokeColor(CARD); c.setLineWidth(0.6); c.line(x + cw / 2 - 14, y - 8, x + cw / 2 + 14, y - 8)
            draw_stack(c, body, x, y - 18*s, 4.6*s)
            if k:
                c.setStrokeColor(LINE); c.setLineWidth(0.6); c.line(x - G / 2, y + 6, x - G / 2, y - 18*s - rh)
        y -= rh + 62*s
    footer(c, center=True); c.save(); return y + 62*s - 18*s


out = sys.argv[1]
for name, fn in [("A_Classic", classic), ("B_Cards", cards), ("C_Editorial", editorial)]:
    path = os.path.join(out, f"USC_Programs_OnePager_{name}.pdf")
    s = 1.0
    while fn(path, s + 0.02) > 64:  # grow type until content reaches the footer zone
        s += 0.02
    fn(path, s)
    print(name, round(s, 2))
print(sum(len(i) for _, i in SECTIONS), "programs")
