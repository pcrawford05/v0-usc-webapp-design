#!/usr/bin/env node
// Rebuilds each program's `socials` (LinkedIn and Instagram pages) from data/sources.json.
//   node scripts/build-socials.mjs
// A page run by the program itself is labeled with the platform; a host unit's page
// (Greif Center, TIE Hub...) is labeled with the host so people know whose page it is.
import fs from "node:fs"

const HOSTS = {
  "linkedin.com/company/lloydgreifcenter": "Greif Center",
  "linkedin.com/company/usc-viterbi-tie": "TIE Hub",
  "linkedin.com/school/usciovineyoung": "IYA",
  "linkedin.com/company/usc-stevens-center-for-innovation": "Stevens Center",
  "linkedin.com/company/usc-mesh-strategic-partnerships": "Keck MESH",
  "linkedin.com/company/usc-brittingham-social-enterprise-lab": "Brittingham Lab",
}
const programs = JSON.parse(fs.readFileSync("data/programs.json", "utf8"))
const registry = JSON.parse(fs.readFileSync("data/sources.json", "utf8"))

const pageUrl = url => {
  const li = url.match(/^https?:\/\/(?:[a-z]+\.)?linkedin\.com\/(company|school|showcase)\/([^/?#]+)/i)
  if (li) return { platform: "linkedin", url: `https://www.linkedin.com/${li[1]}/${li[2]}/`, key: `linkedin.com/${li[1]}/${li[2]}`.toLowerCase() }
  const ig = url.match(/^https?:\/\/(?:www\.)?instagram\.com\/([^/?#]+)/i)
  if (ig && !["p", "reel", "reels", "explore", "stories"].includes(ig[1].toLowerCase())) return { platform: "instagram", url: `https://www.instagram.com/${ig[1]}/`, key: `instagram.com/${ig[1]}`.toLowerCase(), handle: ig[1] }
  return null
}

let count = 0
for (const p of programs) {
  // Registry sources can say whose page it is with `host`; otherwise known host pages are labeled from HOSTS.
  const entries = [...(registry.programs[p.id]?.sources ?? []), ...[p.link, ...(p.sources ?? [])].filter(Boolean).map(url => ({ url }))]
  const seen = new Map()
  for (const e of entries) {
    const s = pageUrl(e.url)
    if (s && !seen.has(s.key)) seen.set(s.key, { ...s, host: e.host ?? HOSTS[s.key] })
  }
  const socials = [...seen.values()]
    .map(s => ({ platform: s.platform, url: s.url, ...(s.host ? { host: s.host } : {}), ...(s.handle ? { handle: s.handle } : {}) }))
    // The program's own pages first, Instagram before LinkedIn, then host pages.
    .sort((a, b) => Number(!!a.host) - Number(!!b.host) || (a.platform === "instagram" ? -1 : 1) - (b.platform === "instagram" ? -1 : 1))
  if (socials.length) {
    p.socials = socials
    count++
  } else delete p.socials
}
fs.writeFileSync("data/programs.json", JSON.stringify(programs, null, 2) + "\n")
console.log(`socials on ${count} programs`)
