# Usage: python3 one_pager.py out.pdf
# Single-page USC entrepreneurship programs list, grouped by affiliation.
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, KeepTogether
from reportlab.lib.styles import ParagraphStyle

GROUPS = [
    ("USC Viterbi School of Engineering", [
        "Viterbi Startup Garage", "VSG Residency Program", "Summer Smasher", "Technology Innovation Fellowship",
        "William W. Wang TIE Hub", "Viterbi Student Institute for Innovation", "Baum Family Maker Space",
        "I-Corps Hub West", "I-Corps West Team Grant", "Viterbi Venture Fund", "Maseeh Entrepreneurial Prize Competition",
        "Min Family Challenge", "Das Family Innovate x LA Competition", "Trojan Tank", "Origin Weekend",
        "Origin Weekend Impact", "Global Student Startup Competition", "Viterbi Startup Showcase", "USC Startup Mixer",
        "Start-Up Stories", "Sugar Speaker Series", "Summer Start Fellows", "Deep Tech Office Hours",
        "Innovation Office Hours (TIE)", "VSEE", "Engineering Honors Program", "ENGR 100: Honors Colloquium",
        "ENG 493: Dean's Seminar in Entrepreneurship", "ENGR 499: Tech Development & Commercialization",
        "CSCI 532: Hacking for Defense", "CE 486: Humanitarian Startups", "CE 499: Innovation for Global Challenges",
        "ISE 585: Strategic Management of Technology", "Engineering Innovation for Global Challenges Minor",
        "Technology Entrepreneurship Minor", "Technology Commercialization Certificate",
        "Engineering Ventures, Innovation & Launch", "Viterbi TIE Newsletter", "Viterbi Startup Garage Newsletter"]),
    ("USC Marshall School of Business", [
        "Lloyd Greif Center for Entrepreneurial Studies", "Greif Incubator", "USC Marshall Venture Fund",
        "New Venture Seed Competition", "Innovation Challenge", "ATHENA Initiative", "ATHENA Women's Entrepreneurship Summit",
        "ATHENA Female Founders Pitch Competition", "ATHENA Launch & Learn Series", "Founder Central Initiative",
        "Marcia Israel Founder Showcase", "Catalyst Microgrant", "eCouncil Fund", "Hult Prize at USC",
        "Venture Capital Investment Competition", "Marshall Experts-in-Residence", "Brittingham Social Enterprise Lab",
        "Brittingham Social Entrepreneur-in-Residence", "BSEL Undergraduate Scholars Mentorship",
        "Jacobson Family Sustainable Impact Lectures", "M.S. Entrepreneurship & Innovation",
        "M.S. Social Entrepreneurship", "BAEP Entrepreneurship Courses", "Entrepreneurship & Innovation Emphasis",
        "Entrepreneurship Minor", "MBA Entrepreneurship & Venture Management", "Greif Center Newsletter",
        "Greif Center Event Updates", "Brittingham Lab Newsletter"]),
    ("USC Iovine and Young Academy", [
        "IYA Innovation Quest", "Innovation Quest Spring Hackathon", "IYA Venture Studio", "IYA Founder Hub",
        "IYA Founders Bootcamp", "IYA Ignite Grants", "IYA Venture Showcase", "IYA Entrepreneur in Residence",
        "Venture Scoring & Resource Unlock System", "IYA Makerspace & Creator Studio",
        "ACAD 406: Purpose-Driven Innovation Incubator", "B.S. Arts, Technology & Business of Innovation",
        "B.S. Business of Innovation", "M.S. Integrated Design, Business & Technology", "M.S. IDBT Online",
        "Progressive M.S. IDBT", "Venture Development Focus Area", "Health Innovation Minor",
        "Extended Reality Design & Development Minor", "Disruptive Innovation Minor", "Designing Products Minor",
        "IYA Connect Weekly", "IYA Newsletter", "The Pulse"]),
    ("USC Stevens Center & Office of Research and Innovation", [
        "USC Stevens Center for Innovation", "Weekly Innovation Office Hours", "Stevens Legal Office Hours",
        "Stevens Translation Catalyst", "Stevens Innovation Interns", "Discovery to Commercialization Webinars",
        "Stevens Center Newsletter", "Innovation Catalyst Program", "Startup Launch Award", "Innovation Empowerment Awards",
        "Early Career Innovator Award", "ICP Early Career Innovator: Techstars", "SBIR/STTR Planning Award",
        "Techstars USC Digital Economy Program", "USC + Techstars University Catalyst", "USC + Techstars Startup Weekend",
        "USC Innovation Ecosystem Portal", "OORI Monthly Newsletter", "Competitive Grants for USC Researchers"]),
    ("USC-Wide Programs", [
        "Blackstone LaunchPad", "Founder Clubs", "Founder/VC Fireside Chats", "VentureWell E-Team Grants",
        "Alumni Entrepreneurs Network"]),
    ("Other USC Schools", [
        "Alfred E. Mann Institute (Keck)", "SC Clinical & Translational Science Institute (Keck)",
        "MESH Innovation Cafes (Keck)", "Translation & Entrepreneurship in Biomedical Sciences (Keck)",
        "IP & Technology Law Clinic (Gould)", "Small Business Clinic (Gould)", "Graduate Certificate in Social Innovation (Price)",
        "Nonprofit & Social Innovation Track (Price)", "Media, Economics & Entrepreneurship (Annenberg)",
        "Creator Research Network (Annenberg)", "USC Games Summer Bridge Program (SCA)", "Ganek Immersive Studio (SCA)",
        "Education Technology Accelerator (Rossier)", "Toolkit Entrepreneurship Courses (Dornsife)",
        "Entrepreneurship Research Guide (Libraries)"]),
    ("Student Organizations", [
        "eCouncil", "USC Entrepreneur Club", "Trojan Venture Partners", "EVMA", "Sigma Eta Pi", "SparkSC", "LavaLab",
        "TroyLabs", "FightOnFounders", "SoGal", "HackSC", "Makers at USC", "MEDesign", "ProductSC", "Techie",
        "Kappa Theta Pi", "Nucleate"]),
    ("Ecosystem Partners", [
        "Alliance for SoCal Innovation", "LAVA", "BioscienceLA", "Biocom", "SoCalBio", "California Life Sciences",
        "CLS Fast Startup Program", "LA BioStart Bootcamp", "Larta Heal.LA Accelerator", "Biotech-Connection LA",
        "BIO", "UIDP", "Wavemaker 360 Health", "Westlake Village BioPartners", "Apple Tree Partners", "Autobahn Labs",
        "Emerson Collective", "Microsoft for Startups Founders Hub"]),
    ("External Founder Resources", [
        "Y Combinator", "Techstars", "PearX", "Sequoia Arc", "StartX", "SkyDeck", "HAX/SOSV", "CTIP",
        "Tech Coast Angels", "Pasadena Angels", "Band of Angels", "Stanford Angels", "NFX", "NFX Signal", "AngelList",
        "Republic (RUV)", "WeFunder", "FAST Agreement", "Venture Deals", "Do More Faster", "Fundraising: Ryan Breslow",
        "FYSK", "Inception Studios", "Stripe Atlas", "Clerky", "Carta", "Cooley GO", "Piper Accelerate",
        "Founder Institute", "LegalPad", "Project Law", "Sophie Alcorn", "AMA Roberts", "CMU Founder Resources",
        "YC Startup Library", "First Round Review"]),
]

CARD, GOLD, INK = HexColor("#990000"), HexColor("#FFCC00"), HexColor("#1d1d1f")
W, H = letter
M, TOP, GUT = 26, 58, 12
COLS = 4
cw = (W - 2*M - (COLS-1)*GUT) / COLS

def page(c, d):
    c.saveState()
    c.setFillColor(CARD); c.rect(0, H-TOP+8, W, TOP-8, fill=1, stroke=0)
    c.setFillColor(GOLD); c.rect(0, H-TOP+5, W, 3, fill=1, stroke=0)
    c.setFillColor(white); c.setFont("Times-Bold", 26); c.drawString(M, H-36, "USC")
    c.setFont("Times-Bold", 15); c.drawString(M+66, H-30, "Entrepreneurship & Innovation Programs")
    c.setFont("Helvetica", 7); c.drawString(M+66, H-41, "UNIVERSITY OF SOUTHERN CALIFORNIA")
    c.setFont("Helvetica-Bold", 7); c.drawRightString(W-M, H-36, "FIGHT ON")
    c.restoreState()

doc = BaseDocTemplate(sys.argv[1], pagesize=letter, leftMargin=M, rightMargin=M, topMargin=TOP, bottomMargin=M,
                      title="USC Entrepreneurship & Innovation Programs")
frames = [Frame(M + i*(cw+GUT), M, cw, H-TOP-M-6, id=f"c{i}", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
          for i in range(COLS)]
doc.addPageTemplates([PageTemplate("p", frames, onPage=page)])

hs = ParagraphStyle("h", fontName="Times-Bold", fontSize=9, leading=10.5, textColor=CARD,
                    borderPadding=(0, 0, 1.5, 0), spaceAfter=2.5)
it = ParagraphStyle("i", fontName="Helvetica", fontSize=8.0, leading=9.8, textColor=INK, leftIndent=6, firstLineIndent=-6)

class Rule(Spacer):
    def draw(self):
        self.canv.setFillColor(GOLD); self.canv.rect(0, 0, cw, 1.2, fill=1, stroke=0)

story = []
for name, items in GROUPS:
    head = [Paragraph(name.replace("&", "&amp;"), hs), Rule(cw, 1.2), Spacer(1, 2)]
    body = [Paragraph('<font color="#990000">&#8226;</font> ' + s.replace("&", "&amp;"), it) for s in items]
    story += [KeepTogether(head + body[:3])] + body[3:] + [Spacer(1, 7)]
doc.build(story)
print(sum(len(i) for _, i in GROUPS), "items")
