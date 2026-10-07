import json, sys, html, collections

notion = json.load(open(sys.argv[1]))
out = sys.argv[2]

FIX = {
    "Brittingham Social Entrerprise Lab Newsletter": "Brittingham Social Enterprise Lab Newsletter",
    "Brittingham Social Entrepreneurship Lab": "Brittingham Social Enterprise Lab",
    "Marshall Experts-In-Residents": "Marshall Experts-in-Residence",
    "Founder’s Institute": "Founder Institute",
}

USC_MAP = [
    ("Accelerators", "Accelerators & Incubators"),
    ("Sources of Funding/Competitions", "Funding & Competitions"),
    ("Curricular", "Curricular Programs"),
    ("Mentorship", "Mentorship & Office Hours"),
    ("Clubs", "Clubs & Student Organizations"),
    ("Newsletters", "Events & Newsletters"),
    ("Networking", "Networking & Resource Library"),
    ("Resource Library", "Networking & Resource Library"),
    ("USC-Affiliated External Resources", "Ecosystem Partners (USC-Affiliated)"),
]
EXT_ORDER = ["Accelerators", "Angel Syndicates", "Putting together your first round", "Fundraising",
             "Pitch Events", "Incorporation", "Legal", "International Founder", "General Startup"]
EXT_LABEL = {"Putting together your first round": "First Round Financing", "International Founder": "International Founders",
             "General Startup": "General Startup Knowledge"}

def clean(n):
    n = n.strip()
    return FIX.get(n, n)

usc = collections.OrderedDict()
for key, label in USC_MAP:
    usc.setdefault(label, [])
    usc[label] += [clean(r["name"]) for r in notion if r["uscExternal"] == "USC" and r["resourceType"] == key]
ext = collections.OrderedDict()
for key in EXT_ORDER:
    ext[EXT_LABEL.get(key, key)] = [clean(r["name"]) for r in notion if r["uscExternal"] == "External" and r["resourceType"] == key]

NEW = collections.OrderedDict()
NEW["USC Viterbi School of Engineering"] = {
    "Centers & Labs": ["William W. Wang Technology Innovation and Entrepreneurship Hub (TIE Hub)",
                       "Viterbi Student Institute for Innovation (VSi2)", "Baum Family Maker Space"],
    "Accelerators & Incubators": ["Technology Innovation Fellowship (TIF)", "Viterbi Startup Garage Residency Program",
                                  "Summer Smasher (Entrepreneur-in-Training Internship)"],
    "Funding & Competitions": ["Origin Weekend", "Origin Weekend Impact (with Google X)", "Trojan Tank Pitch Competition",
                               "Das Family Innovate x LA Student Competition", "Global Student Startup Competition (GSSC)"],
    "Curricular Programs": ["Technology Entrepreneurship Minor (successor to Digital Entrepreneurship)",
                            "ENGR 499: Technology Development and Commercialization", "ISE 585: Strategic Management of Technology",
                            "CE 499: Innovation in Engineering Design for Global Challenges", "ENGR 100: Engineering Honors Colloquium",
                            "Engineering Ventures, Innovation & Launch (Executive Education)"],
    "Events & Networking": ["USC Viterbi Startup Showcase", "USC Startup Mixer (Viterbi x Marshall)"],
}
NEW["USC Iovine and Young Academy"] = {
    "Accelerators & Incubators": ["IYA Innovation Quest", "IYA Venture Studio", "IYA Founder Hub (Student Founder Resources)"],
    "Funding & Competitions": ["IYA Ignite Grants", "IYA Venture Showcase", "Innovation Quest Spring Hackathon"],
    "Curricular Programs": ["B.S. Arts, Technology and the Business of Innovation",
                            "B.S. Business of Innovation (joint with USC Marshall)",
                            "M.S. Integrated Design, Business and Technology (MS IDBT)",
                            "M.S. Integrated Design, Business and Technology (Online)",
                            "Progressive M.S. Integrated Design, Business and Technology",
                            "Venture Development Focus Area", "Health Innovation Minor",
                            "Extended Reality Design and Development Minor", "Disruptive Innovation Minor",
                            "Designing Products Minor"],
    "Centers, Events & Networking": ["IYA Makerspace and Creator Studio", "IYA Founders Bootcamp",
                                     "Microsoft for Startups Partnership (Innovation Quest)", "The Pulse (Academy News)"],
}
NEW["USC Marshall School of Business"] = {
    "Centers & Initiatives": ["ATHENA Initiative", "Founder Central Initiative"],
    "Funding & Competitions": ["USC Marshall Venture Fund", "Catalyst Microgrant", "eCouncil Fund",
                               "ATHENA Female Founders Pitch Competition", "Hult Prize at USC"],
    "Curricular Programs": ["Entrepreneurship and Innovation Emphasis (Undergraduate)",
                            "Entrepreneurship Minor (Non-Business Majors)",
                            "MBA Entrepreneurship and Venture Management Concentration"],
    "Mentorship": ["Brittingham Social Entrepreneur-in-Residence", "BSEL Undergraduate Scholars Mentorship Program"],
    "Events": ["ATHENA Women's Entrepreneurship Summit", "ATHENA Launch & Learn Series",
               "Marcia Israel Celebration and Founder Showcase", "Jacobson Family Sustainable Impact Lecture Series"],
    "Student Organizations": ["eCouncil (Entrepreneurship Student Organization Council)", "USC Entrepreneur Club",
                              "Trojan Venture Partners"],
}
NEW["USC-Wide and Other Schools"] = {
    "Office of Research and Innovation (OORI)": ["Innovation Catalyst Program (ICP)", "Startup Launch Award",
        "Innovation Empowerment Awards", "Stevens Translation Catalyst", "Early Career Innovator Award",
        "ICP Early Career Innovator: Techstars", "SBIR/STTR Planning Award", "USC + Techstars University Catalyst",
        "USC and Techstars Startup Weekend", "USC Innovation Ecosystem Portal", "OORI Monthly Newsletter"],
    "Stevens Center, Mann Institute & Keck": ["USC Stevens Innovation Interns and Licensing Assistants",
        "Alfred E. Mann Institute for Biomedical Engineering (AMI)",
        "Translation and Entrepreneurship in Biomedical Sciences Certificate (Keck)"],
    "Legal & IP (Gould School of Law)": ["Intellectual Property and Technology Law Clinic",
                                          "Small Business Clinic"],
    "Price, Annenberg, Cinematic Arts & Dornsife": ["Graduate Certificate in Social Innovation (Price)",
        "Nonprofit and Social Innovation Track (Price)", "Media, Economics & Entrepreneurship Program (Annenberg)",
        "Annenberg Creator Research Network", "Ganek Immersive Studio (Cinematic Arts)", "Dornsife Toolkit Entrepreneurship Courses"],
    "Libraries": ["USC Libraries Entrepreneurship Research Guide"],
}

n_usc = sum(len(v) for v in usc.values())
n_ext = sum(len(v) for v in ext.values())
n_new = sum(len(i) for s in NEW.values() for i in s.values())

e = html.escape

def block(title, items, new=False):
    lis = "".join(f'<li>{e(i)}</li>' for i in items)
    return f'<section class="cat"><h3>{e(title)}<span class="ct">{len(items)}</span></h3><ul class="{"new" if new else ""}">{lis}</ul></section>'

def part_header(num, title, sub):
    return f'<header class="part"><div class="pnum">Part {num}</div><h2>{e(title)}</h2><p>{e(sub)}</p></header>'

body = []
body.append(f'''
<div class="cover">
  <div class="band">
    <div class="wordmark">USC</div>
    <div class="wm-sub">University of Southern California</div>
  </div>
  <div class="cover-body">
    <div class="eyebrow">Entrepreneurship &amp; Innovation</div>
    <h1>Programs and Resources Directory</h1>
    <div class="rule"></div>
    <p class="lede">A consolidated index of entrepreneurship programs, funding, curricula, mentorship and community resources available to the Trojan Family, with emphasis on USC Viterbi, the Iovine and Young Academy, and USC Marshall.</p>
    <div class="stats">
      <div><b>{n_usc}</b><span>USC resources in the current directory</span></div>
      <div><b>{n_new}</b><span>Newly identified programs</span></div>
      <div><b>{n_ext}</b><span>External founder resources</span></div>
    </div>
    <div class="contents">
      <div><span>I</span>Current Directory: USC Programs</div>
      <div><span>II</span>Newly Identified Programs by School</div>
      <div><span>III</span>External Founder Resources</div>
    </div>
  </div>
  <div class="cover-foot">October 2026 &nbsp;&middot;&nbsp; Fight On</div>
</div>''')

body.append('<div class="page">' + part_header("I", "Current Directory: USC Programs",
            "Programs and resources currently catalogued in the USC Entrepreneurship Resources database.")
            + '<div class="grid">' + "".join(block(k, v) for k, v in usc.items() if v) + '</div></div>')

for school, cats in NEW.items():
    pass
new_html = part_header("II", "Newly Identified Programs by School",
                       "Programs surfaced through research of official USC sources that are not yet in the directory.")
for school, cats in NEW.items():
    total = sum(len(v) for v in cats.values())
    new_html += f'<div class="school"><h2 class="sch">{e(school)}<span>{total} programs</span></h2><div class="grid">'
    new_html += "".join(block(k, v, True) for k, v in cats.items()) + '</div></div>'
body.append('<div class="page">' + new_html + '</div>')

body.append('<div class="page">' + part_header("III", "External Founder Resources",
            "Non-USC resources curated in the directory for incorporation, legal, fundraising and acceleration.")
            + '<div class="grid">' + "".join(block(k, v) for k, v in ext.items() if v) + '</div></div>')

css = open(sys.argv[3]).read()
doc = f'''<!doctype html><html><head><meta charset="utf-8"><title>USC Entrepreneurship Programs Directory</title>
<link href="https://fonts.googleapis.com/css2?family=Libre+Caslon+Text:wght@700&family=Lato:wght@400;700&display=swap" rel="stylesheet">
<style>{css}</style></head><body>{"".join(body)}</body></html>'''
open(out, "w").write(doc)
print(n_usc, n_new, n_ext)
