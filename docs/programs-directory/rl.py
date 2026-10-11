import os, sys, runpy
# Usage: python3 rl.py data/notion-data.json out.pdf style.css
# Reuses the program data from build.py by running it with a throwaway HTML output.
sys.argv = ["build.py", sys.argv[1], "/dev/null", sys.argv[3]] + [sys.argv[2]]
out_pdf = sys.argv[4]
g = runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), "build.py"))
usc, ext, NEW = g["usc"], g["ext"], g["NEW"]
n_usc, n_new, n_ext = g["n_usc"], g["n_new"], g["n_ext"]

from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Table, TableStyle,
                                Spacer, KeepTogether, PageBreak, NextPageTemplate)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch

CARD, GOLD, INK, MUTED, LINE = HexColor("#990000"), HexColor("#FFCC00"), HexColor("#1d1d1f"), HexColor("#5f5f63"), HexColor("#ece5da")
W, H = letter; M = 0.65*inch

def cover(c, d):
    c.saveState()
    c.setFillColor(CARD); c.rect(0, H-2.3*inch, W, 2.3*inch, fill=1, stroke=0)
    c.setFillColor(GOLD); c.rect(0, H-2.3*inch-8, W, 8, fill=1, stroke=0)
    c.setFillColor(white); c.setFont("Times-Bold", 60); c.drawString(0.8*inch, H-1.45*inch, "USC")
    c.setFont("Helvetica", 9.5); c.drawString(0.8*inch, H-1.8*inch, "U N I V E R S I T Y   O F   S O U T H E R N   C A L I F O R N I A")
    x = 0.8*inch; y = H-3.2*inch
    c.setFillColor(CARD); c.setFont("Helvetica-Bold", 9.5); c.drawString(x, y, "E N T R E P R E N E U R S H I P   &   I N N O V A T I O N")
    c.setFillColor(INK); c.setFont("Times-Bold", 36)
    c.drawString(x, y-48, "Programs and Resources"); c.drawString(x, y-90, "Directory")
    c.setFillColor(GOLD); c.rect(x, y-118, 80, 5, fill=1, stroke=0)
    t = c.beginText(x, y-150); t.setFont("Helvetica", 11.5); t.setFillColor(MUTED); t.setLeading(17)
    for ln in ["A consolidated index of entrepreneurship programs, funding, curricula, mentorship",
               "and community resources available to the Trojan Family, with emphasis on",
               "USC Viterbi, the Iovine and Young Academy, and USC Marshall."]: t.textLine(ln)
    c.drawText(t)
    sy = y-270; cw = (W-1.6*inch-36)/3
    for i, (n, lab) in enumerate([(n_usc, "USC resources in the current directory"), (n_new, "Newly identified programs"), (n_ext, "External founder resources")]):
        sx = x + i*(cw+18)
        c.setFillColor(CARD); c.rect(sx, sy, cw, 3, fill=1, stroke=0)
        c.setFont("Times-Bold", 30); c.drawString(sx, sy-36, str(n))
        c.setFillColor(MUTED); c.setFont("Helvetica", 9); c.drawString(sx, sy-52, lab)
    ty = sy-100
    c.setStrokeColor(LINE)
    for r, lab in [("I", "Current Directory: USC Programs"), ("II", "Newly Identified Programs by School"), ("III", "External Founder Resources")]:
        c.line(x, ty+16, W-0.8*inch, ty+16)
        c.setFillColor(CARD); c.setFont("Times-Bold", 12); c.drawString(x, ty, r)
        c.setFillColor(INK); c.setFont("Helvetica", 11); c.drawString(x+38, ty, lab); ty -= 30
    c.line(x, ty+16, W-0.8*inch, ty+16)
    c.setFillColor(CARD); c.setFont("Helvetica-Bold", 9); c.drawString(x, 0.8*inch, "O C T O B E R   2 0 2 6   ·   F I G H T   O N")
    c.restoreState()

def footer(c, d):
    c.saveState()
    c.setFillColor(CARD); c.rect(0, H-10, W, 10, fill=1, stroke=0)
    c.setFillColor(GOLD); c.rect(0, H-13, W, 3, fill=1, stroke=0)
    c.setFillColor(CARD); c.setFont("Helvetica-Bold", 7.5); c.drawString(M, 0.45*inch, "USC Entrepreneurship & Innovation Directory")
    c.setFillColor(MUTED); c.setFont("Helvetica", 7.5); c.drawRightString(W-M, 0.45*inch, str(d.page))
    c.restoreState()

doc = BaseDocTemplate(out_pdf, pagesize=letter, leftMargin=M, rightMargin=M, topMargin=0.7*inch, bottomMargin=0.75*inch,
                      title="USC Entrepreneurship Programs Directory", author="USC Entrepreneurship Resources")
fr = Frame(M, 0.75*inch, W-2*M, H-1.45*inch, id="f")
doc.addPageTemplates([PageTemplate("cover", [fr], onPage=cover), PageTemplate("body", [fr], onPage=footer)])

pn = ParagraphStyle("pn", fontName="Helvetica-Bold", fontSize=8.5, textColor=CARD, leading=11)
ph = ParagraphStyle("ph", fontName="Times-Bold", fontSize=21, textColor=INK, leading=25)
pp = ParagraphStyle("pp", fontName="Helvetica", fontSize=9.5, textColor=MUTED, leading=13)
ch = ParagraphStyle("ch", fontName="Times-Bold", fontSize=11.5, textColor=CARD, leading=14)
it = ParagraphStyle("it", fontName="Helvetica", fontSize=9, textColor=INK, leading=11.5)
sh = ParagraphStyle("sh", fontName="Times-Bold", fontSize=14, textColor=white, leading=17)
sc = ParagraphStyle("sc", fontName="Helvetica-Bold", fontSize=8, textColor=white, leading=17, alignment=2)
FW = W-2*M
esc = lambda s: s.replace("&", "&amp;").replace("<", "&lt;")

def part(num, title, sub):
    t = Table([[ "", [Paragraph("PART " + num, pn), Paragraph(esc(title), ph), Paragraph(esc(sub), pp)] ]], colWidths=[6, FW-6])
    t.setStyle(TableStyle([("BACKGROUND", (0,0), (0,0), CARD), ("LEFTPADDING", (1,0), (1,0), 14), ("VALIGN", (0,0), (-1,-1), "TOP")]))
    return [t, Spacer(1, 14)]

def cat(title, items, new=False):
    head = Table([[Paragraph(esc(title), ch), Paragraph(f'<font color="#5f5f63">{len(items)}</font>', ParagraphStyle("r", parent=it, alignment=2, fontName="Helvetica-Bold"))]],
                 colWidths=[FW-40, 40])
    head.setStyle(TableStyle([("LINEBELOW", (0,0), (-1,0), 2, GOLD), ("LEFTPADDING", (0,0), (-1,-1), 0), ("RIGHTPADDING", (0,0), (-1,-1), 0), ("BOTTOMPADDING", (0,0), (-1,-1), 4)]))
    half = (len(items)+1)//2
    bullet = '<font color="#c79c00">■</font>' if new else '<font color="#990000">■</font>'
    cells = [Paragraph(f'{bullet}&nbsp;&nbsp;{esc(s)}', it) for s in items]
    left, right = cells[:half], cells[half:] + [""]*(half-len(cells[half:]))
    body = Table(list(zip(left, right)), colWidths=[FW/2, FW/2])
    body.setStyle(TableStyle([("LINEBELOW", (0,0), (-1,-1), 0.5, LINE), ("LEFTPADDING", (0,0), (-1,-1), 2), ("TOPPADDING", (0,0), (-1,-1), 3), ("BOTTOMPADDING", (0,0), (-1,-1), 3), ("VALIGN", (0,0), (-1,-1), "TOP")]))
    return [head, Spacer(1, 3), body, Spacer(1, 12)]

def school(name, total):
    t = Table([[Paragraph(esc(name), sh), Paragraph(f"{total} PROGRAMS", sc)]], colWidths=[FW-110, 110])
    t.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,-1), CARD), ("LINEBELOW", (0,0), (-1,-1), 3, GOLD), ("TOPPADDING", (0,0), (-1,-1), 6), ("BOTTOMPADDING", (0,0), (-1,-1), 7), ("LEFTPADDING", (0,0), (-1,-1), 10), ("RIGHTPADDING", (0,0), (-1,-1), 10)]))
    return t

story = [NextPageTemplate("body"), PageBreak()]
story += part("I", "Current Directory: USC Programs", "Programs and resources currently catalogued in the USC Entrepreneurship Resources database.")
story += [KeepTogether(cat(k, v)) for k, v in usc.items() if v]
story += [PageBreak()] + part("II", "Newly Identified Programs by School", "Programs surfaced through research of official USC sources that are not yet in the directory.")
for s, cats in NEW.items():
    first = list(cats.items())
    story += [KeepTogether([school(s, sum(len(v) for v in cats.values())), Spacer(1, 10)] + cat(*first[0], new=True))]
    story += [KeepTogether(cat(k, v, True)) for k, v in first[1:]] + [Spacer(1, 6)]
story += [PageBreak()] + part("III", "External Founder Resources", "Non-USC resources curated in the directory for incorporation, legal, fundraising and acceleration.")
story += [KeepTogether(cat(k, v)) for k, v in ext.items() if v]
doc.build(story)
