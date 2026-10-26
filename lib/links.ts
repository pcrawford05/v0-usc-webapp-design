import type { Program } from "@/lib/programs"

// The catalog link is sometimes the program's own page and sometimes only its host's homepage,
// a news story or a class listing. Name the button for what it actually opens, and drop links
// that would not help someone act (news stories and newsletters).

const HOSTS: [RegExp, string][] = [
  [/viterbiinnovation\.usc\.edu/, "TIE Hub"],
  [/viterbiundergrad\.usc\.edu/, "Viterbi Undergrad"],
  [/viterbischool\.usc\.edu/, "Viterbi"],
  [/iovine-young\.usc\.edu/, "IYA"],
  [/students\.marshall\.usc\.edu\/lloyd-greif/, "Greif Center"],
  [/marshall\.usc\.edu/, "Marshall"],
  [/keck\.usc\.edu\/mesh/, "Keck MESH"],
  [/keck\.usc\.edu/, "Keck"],
  [/stevens\.usc\.edu/, "Stevens Center"],
  [/ami\.usc\.edu/, "AMI"],
  [/gould\.usc\.edu/, "USC Gould"],
  [/engage\.usc\.edu/, "EngageSC"],
  [/sc-ctsi\.org/, "SC CTSI"],
]

const STOP = new Set("usc the and for of in a to at program programs center student students".split(" "))
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w))

export interface ProgramLink {
  href: string
  label: string
  /** True when the page is about this program, not just its host. */
  specific: boolean
}

export function programLink(p: Program): ProgramLink | null {
  if (!p.link) return null
  let url: URL
  try {
    url = new URL(p.link)
  } catch {
    return null
  }
  const path = url.pathname.toLowerCase()
  if (/\/(news|newsletter|the-pulse|blog|stories)\b/.test(path) || /dailytrojan\.com/.test(url.hostname)) return null
  const social = socialLabel(url)
  if (social) return { href: p.link, label: social, specific: true }
  if (url.hostname === "classes.usc.edu") return { href: p.link, label: "Class schedule", specific: true }
  if (url.hostname === "catalogue.usc.edu") return { href: p.link, label: "USC Catalogue", specific: true }
  if (url.pathname.endsWith(".pdf")) return { href: p.link, label: "Course list (PDF)", specific: true }

  const host = HOSTS.find(([re]) => re.test(url.hostname + url.pathname))?.[1]
  const nameWords = new Set([...words(p.name), ...p.aliases.flatMap(words)])
  const specific = words(path + " " + url.search).some(w => nameWords.has(w))
  if (specific) return { href: p.link, label: "Official page", specific }
  if (host === "EngageSC") return { href: p.link, label: "EngageSC page", specific: true }
  if (host) return { href: p.link, label: `${host} page`, specific: false }
  if (/(^|\.)lu\.?ma(\.com)?$/.test(url.hostname)) return { href: p.link, label: "Event page (Luma)", specific: true }
  if (url.searchParams.has("p")) return { href: p.link, label: "Announcement", specific: false }
  // Its own domain (a club site, a nonprofit) is the program's site even without its name in the path.
  return { href: p.link, label: "Website", specific: true }
}

/** Posts and profiles on social media are fine as the main link when that is where a program announces itself. */
function socialLabel(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "")
  const path = url.pathname
  if (host.endsWith("linkedin.com")) return /^\/(feed\/update|posts|events)\//.test(path) ? "LinkedIn post" : "LinkedIn page"
  if (host === "instagram.com") return /^\/(p|reel)\//.test(path) ? "Instagram post" : "Instagram"
  if (host === "x.com" || host === "twitter.com") return /\/status\//.test(path) ? "Post on X" : "X profile"
  if (host === "linktr.ee") return "Linktree"
  if (host === "youtube.com" || host === "youtu.be") return "Video"
  return null
}
