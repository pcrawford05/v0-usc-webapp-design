# Usage: python3 ralph_one_pager.py OUT_DIR
# One-page USC programs list built from Ralph Lin's inventory, in three styles.
import os, sys
from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import Paragraph
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER

VITERBI = ("Viterbi / Wang TIE Hub", [
    "Origin Weekend", "SHIP Fund", "Maseeh Entrepreneurship Prize Competition", "Min Family Challenge",
    "Das / InnovateLA Competition", "Trojan Tank", "Genesis / ventureSPARK", "Fundraising Bootcamp",
    "Technology Innovation Fellowship", "Viterbi Venture Fund", "I-Corps: ZAP / BOOM / Nationals",
    "SBIR Grant Assistance", "Data Center Challenge", "Future of Social Media Challenge", "Ron Sugar Speaker Series",
    "Startup Stories", "Office Hours", "Coworking", "1:1 Mentorship", "YC Application Office Hours",
    "Intellectual Property Training", "FDA Approval / Biomedical Device Primer",
    "Starting a Company as an International Student", "Founder Happy Hours / Mixers", "Co-founder Speed Dating",
    "Venture Scout", "Venture Showcase", "Baum Makerspace", "Biomedical Engineering Makerspace",
    "VentureWell E-Team Grants", "USC Games Summer Bridge Program"])
JOINT_GV = ("Joint Greif / Viterbi", ["USC Ventures", "All-School Mixers"])
JOINT_VS = ("Joint Viterbi / Stevens", ["Intellectual Property Training", "From Lab to Startup", "DeepTech Founder Matching"])
MARSHALL = ("Marshall / Greif", [
    "New Venture Seed Competition", "Weekly Founder Salon", "ATHENA Summit", "Marshall Incubator",
    "Experts-in-Residence", "VCIC", "Microcatalyst Grant", "Marcia Israel Showcase", "VanEck Digital Assets Initiative",
    "Southern California Blockchain Conference", "Brittingham Social Entrepreneurship Lab", "Hult Prize",
    "Leverage Point Fellowship", "Jacobson Sustainability Lecture Series", "USC Venture Lab / USC VC"])
IYA = ("Iovine and Young Academy", [
    "Innovation Quest", "Venture Studio", "Founder Hub", "Founder Bootcamp", "Ignite Grants", "Venture Showcase",
    "Entrepreneur in Residence", "Makerspace", "Microsoft for Startups Partnership", "Generative AI Hackathon"])
CLUBS = ("Student Clubs", [
    "TroyLabs", "LavaLab", "SEP", "ShiftSC", "ProductSC", "HackSC", "EVMA", "HTA", "SparkSC", "FightOnFounders", "ExitSC"])
OORI = ("Office of Research & Innovation", [
    "Stevens Catalyst Grant", "SBIR / STTR Grant Assistance", "AMI Fund", "Startup Weekend", "Techstars Catalyst",
    "Techstars Accelerator", "Innovation Empowerment Award", "Early Career Innovator Award",
    "Stevens Center for Innovation (Tech Transfer)", "Office Hours"])
MESH = ("Keck MESH", [
    "Customized Entrepreneurship Support", "@Partnerships",
    "Rosalie and Harold Rae Brown Center for Cancer Drug Development", "Sanford Burnham Prebys", "Auransa Inc.",
    "ChemDiv", "Autobahn Labs", "Ryght", "AI in Medicine Collaboratory", "California Life Sciences", "LA BioStart"])
HEALTH = ("Health & Life Sciences", [
    "SC CTSI: Regulatory, Clinical Trials, Research & Funding Support", "USC SPARK: Biomedical Therapeutics Translation",
    "Mann Institute: Integrated Core Services", "Nucleate"])
OTHERS = ("Across USC", [
    "Rossier EdTech Accelerator", "Gould Law Clinic", "SBDC Small Business Programming", "USC Alumni Entrepreneurs Network"])

COLUMNS = [[VITERBI, JOINT_GV, JOINT_VS], [MARSHALL, IYA, CLUBS], [OORI, MESH, HEALTH, OTHERS]]

CARD, GOLD, INK, MUTED, CREAM, LINE = (HexColor(c) for c in
    ("#990000", "#FFCC00", "#1d1d1f", "#6b6b70", "#FBF7F0", "#E8DFD2"))
W, H = letter
esc = lambda s: s.replace("&", "&amp;")
FOOT = "University of Southern California  ·  Entrepreneurship & Innovation  ·  Fight On"


def items_markup(items, bullet, sub):
    out = []
    for i in items:
        if i.startswith("@"):
            out.append(("sub", i[1:]))
        else:
            out.append(("item", (bullet + esc(i)) if bullet else esc(i)))
    return out


def layout(c, top, bottom, M, G, s, cfg, draw):
    """Stack sections per column from `top`; return lowest y reached."""
    cw = (W - 2 * M - 2 * G) / 3
    it = ParagraphStyle("i", fontName=cfg["font"], fontSize=cfg["fs"] * s, leading=cfg["ld"] * s, textColor=INK,
                        leftIndent=cfg.get("indent", 0), firstLineIndent=-cfg.get("indent", 0), alignment=cfg.get("align", 0))
    sb = ParagraphStyle("s", parent=it, fontName=cfg["subfont"], textColor=CARD, leftIndent=0, firstLineIndent=0)
    low = top
    for k, col in enumerate(COLUMNS):
        x = M + k * (cw + G); y = top
        for title, items in col:
            y = cfg["header"](c, x, y, cw, title, s, draw)
            for kind, txt in items_markup(items, cfg["bullet"], True):
                p = Paragraph(txt, sb if kind == "sub" else it)
                _, h = p.wrap(cw - cfg.get("pad", 0) * 2, 1000)
                y -= h + (2 * s if kind == "sub" else 0)
                if draw: p.drawOn(c, x + cfg.get("pad", 0), y)
                y -= cfg["gap"] * s
            y = cfg.get("after", lambda *a: a[2])(c, x, y, cw, draw) - cfg["secgap"] * s
        low = min(low, y + cfg["secgap"] * s)
    return low


def fit(path, frame, cfg_fn, top, M, G):
    s = 0.8
    while True:
        c = Canvas(os.devnull, pagesize=letter)
        if layout(c, top, 0, M, G, s + 0.01, cfg_fn(), False) < 48: break
        s += 0.01
    c = Canvas(path, pagesize=letter); c.setTitle("USC Entrepreneurship Programs")
    frame(c); layout(c, top, 0, M, G, s, cfg_fn(), True); c.save()
    return round(s, 2)


def head_rule(c, x, y, cw, title, s, draw, size=11.5, font="Times-Bold"):
    fs = min(size * min(s, 1.15), size * cw / stringWidth(title, font, size))
    if draw:
        c.setFillColor(CARD); c.setFont(font, fs); c.drawString(x, y - fs, title)
        c.setFillColor(GOLD); c.rect(x, y - fs - 5, cw, 1.6, fill=1, stroke=0)
    return y - fs - 10


# ---------- A: Classic ----------
def classic_frame(c):
    c.setFillColor(CARD); c.rect(0, H - 92, W, 92, fill=1, stroke=0)
    c.setFillColor(GOLD); c.rect(0, H - 97, W, 5, fill=1, stroke=0)
    c.setFillColor(white); c.setFont("Times-Bold", 42); c.drawString(36, H - 62, "USC")
    c.setFont("Times-Bold", 21); c.drawString(140, H - 52, "Entrepreneurship & Innovation")
    c.setFont("Helvetica", 9); c.drawString(141, H - 68, "PROGRAMS AND RESOURCES FOR TROJAN FOUNDERS")
    c.setFillColor(MUTED); c.setFont("Helvetica", 7); c.drawString(36, 24, FOOT)

classic_cfg = lambda: dict(font="Helvetica", subfont="Helvetica-Bold", fs=8.2, ld=9.8, gap=1.2, secgap=9, indent=7,
                           bullet="<font color='#990000'>•</font> ", header=head_rule)


# ---------- B: Cards ----------
def cards_frame(c):
    c.setFillColor(CREAM); c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(CARD); c.setFont("Times-Bold", 26); c.drawCentredString(W / 2, H - 52, "USC Entrepreneurship & Innovation")
    c.setFillColor(GOLD); c.rect(W / 2 - 36, H - 64, 72, 3, fill=1, stroke=0)
    c.setFillColor(MUTED); c.setFont("Helvetica", 7); c.drawCentredString(W / 2, 24, FOOT)

_card_top = {}
def card_head(c, x, y, cw, title, s, draw):
    fs = min(10.5 * min(s, 1.1), 10.5 * (cw - 16) / stringWidth(title, "Times-Bold", 10.5))
    _card_top[x] = y
    if draw:
        c.setFillColor(CARD); c.rect(x, y - 20, cw, 20, fill=1, stroke=0)
        c.setFillColor(GOLD); c.rect(x, y - 22, cw, 2, fill=1, stroke=0)
        c.setFillColor(white); c.setFont("Times-Bold", fs); c.drawCentredString(x + cw / 2, y - 14, title)
    return y - 28

def card_after(c, x, y, cw, draw):
    y -= 5
    if draw:
        top = _card_top[x] - 22
        c.setStrokeColor(LINE); c.setLineWidth(0.8); c.setFillColor(white)
        c.rect(x, y, cw, top - y, fill=0, stroke=1)
    return y

def cards_frame_bg(c): cards_frame(c)

cards_cfg = lambda: dict(font="Helvetica", subfont="Helvetica-Bold", fs=8.0, ld=9.6, gap=1.2, secgap=8, pad=8,
                         bullet="", header=card_head, after=card_after)


# ---------- C: Editorial ----------
def editorial_frame(c):
    c.setFillColor(CARD); c.rect(0, H - 7, W, 7, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 8.5); c.drawCentredString(W / 2, H - 36, "U S C")
    c.setFillColor(INK); c.setFont("Times-Roman", 26); c.drawCentredString(W / 2, H - 64, "Entrepreneurship & Innovation")
    c.setFillColor(GOLD); c.rect(W / 2 - 20, H - 76, 40, 2.2, fill=1, stroke=0)
    c.setStrokeColor(LINE); c.setLineWidth(0.6)
    cw = (W - 2 * 40 - 2 * 22) / 3
    for k in (1, 2):
        x = 40 + k * (cw + 22) - 11; c.line(x, H - 96, x, 46)
    c.setFillColor(MUTED); c.setFont("Helvetica", 7); c.drawCentredString(W / 2, 24, FOOT)

def ed_head(c, x, y, cw, title, s, draw):
    t = title.upper(); fs = 7.6 * min(s, 1.1)
    while stringWidth(t, "Helvetica-Bold", fs) + 1.1 * len(t) > cw: fs -= 0.2
    if draw:
        c.setFillColor(CARD); c.setFont("Helvetica-Bold", fs)
        c.drawCentredString(x + cw / 2, y - fs, t, charSpace=1.1)
        c.setStrokeColor(CARD); c.setLineWidth(0.6); c.line(x + cw / 2 - 12, y - fs - 5, x + cw / 2 + 12, y - fs - 5)
    return y - fs - 11

editorial_cfg = lambda: dict(font="Times-Roman", subfont="Times-Bold", fs=9.2, ld=10.8, gap=1.4, secgap=10,
                             bullet="", header=ed_head, align=TA_CENTER)


out = sys.argv[1]
for name, frame, cfg, top, M, G in [
        ("A_Classic", classic_frame, classic_cfg, H - 114, 36, 18),
        ("B_Cards", cards_frame, cards_cfg, H - 82, 30, 12),
        ("C_Editorial", editorial_frame, editorial_cfg, H - 98, 40, 22)]:
    s = fit(os.path.join(out, f"USC_Programs_Ralph_{name}.pdf"), frame, cfg, top, M, G)
    print(name, s)
print(sum(len([i for i in its if not i.startswith("@")]) for col in COLUMNS for _, its in col), "items")
