#!/usr/bin/env node
// Applies a research run to the catalog.
//   node scripts/apply-research.mjs <results.json> <YYYY-MM-DD>
// results.json is the research workflow's return value: one entry per chunk with
// { chunk, research: { programs, listing_pages }, verdicts }.
// Only verifier-confirmed or verifier-corrected values are written. Every program the
// run looked at gets lastVerified, and data/sources.json records where its facts live.

import fs from "node:fs"

const [resultsPath, date] = process.argv.slice(2)
if (!resultsPath || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) {
  console.error("usage: node scripts/apply-research.mjs <results.json> <YYYY-MM-DD>")
  process.exit(1)
}

const FIELDS = new Set(["description", "timing", "cadence", "months", "eligibility", "audience", "stage", "funding", "link"])
const CADENCES = new Set(["weekly", "monthly", "semester", "annual", "rolling", "ongoing", "one-time", "unknown"])
const AUDIENCES = new Set(["undergrad", "grad", "phd", "postdoc", "faculty", "staff", "alumni", "community"])
const STAGES = new Set(["idea", "prototype", "launched", "scaling"])

const programs = JSON.parse(fs.readFileSync("data/programs.json", "utf8"))
const byId = new Map(programs.map(p => [p.id, p]))
const registryPath = "data/sources.json"
const registry = fs.existsSync(registryPath) ? JSON.parse(fs.readFileSync(registryPath, "utf8")) : { programs: {}, listings: {} }
const results = JSON.parse(fs.readFileSync(resultsPath, "utf8"))

const list = v => (Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,;]\s*/) : [])
const noDash = s => s.replace(/\s*—\s*/g, ", ")

/** Coerces a verified value into the catalog's shape, or returns undefined if it does not fit. */
function clean(field, value) {
  if (value === undefined || value === null) return undefined
  if (field === "months") {
    const m = [...new Set(list(value).map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 12))].sort((a, b) => a - b)
    return m
  }
  if (field === "audience") return list(value).map(String).map(s => s.trim().toLowerCase()).filter(s => AUDIENCES.has(s))
  if (field === "stage") return list(value).map(String).map(s => s.trim().toLowerCase()).filter(s => STAGES.has(s))
  if (field === "cadence") return CADENCES.has(String(value)) ? String(value) : undefined
  if (field === "link") return /^https?:\/\//.test(String(value)) ? String(value) : undefined
  const s = noDash(String(value).trim())
  return s || undefined
}

const log = { applied: [], rejected: 0, skipped: [], flagged: [] }

for (const chunk of results) {
  if (!chunk?.research) continue
  for (const lp of chunk.research.listing_pages ?? []) registry.listings[lp.url] = { covers: lp.covers, chunk: chunk.chunk, lastSeen: date }

  for (const r of chunk.research.programs ?? []) {
    const p = byId.get(r.id)
    if (!p) { log.skipped.push(`unknown id ${r.id}`); continue }
    // Only a program whose sources were actually opened this run counts as verified.
    const opened = (r.sources ?? []).some(s => s.checked)
    if (opened) p.lastVerified = date
    if (r.status === "defunct" || r.status === "not_found") log.flagged.push(`${r.id}: ${r.status}${r.notes ? ` (${r.notes})` : ""}`)

    const prev = registry.programs[r.id] ?? { sources: [], searchQueries: [] }
    const seen = new Map(prev.sources.map(s => [s.url, s]))
    for (const s of r.sources ?? []) seen.set(s.url, { url: s.url, kind: s.kind, holds: s.holds, lastChecked: s.checked ? date : seen.get(s.url)?.lastChecked ?? null })
    registry.programs[r.id] = {
      name: p.name,
      chunk: chunk.chunk,
      status: opened || r.status === "not_found" || r.status === "defunct" ? r.status : "unchecked",
      lastResearched: date,
      sources: [...seen.values()],
      searchQueries: [...new Set([...(r.search_queries ?? []), ...prev.searchQueries])].slice(0, 8),
      notes: r.notes ? noDash(r.notes) : prev.notes ?? null,
    }
  }

  for (const v of chunk.verdicts ?? []) {
    if (v.verdict === "rejected") { log.rejected++; continue }
    const p = byId.get(v.id)
    if (!p || !FIELDS.has(v.field)) { log.skipped.push(`${v.id}.${v.field}`); continue }
    const value = clean(v.field, v.value ?? chunk.research.programs.find(x => x.id === v.id)?.changes.find(c => c.field === v.field)?.new_value)
    if (value === undefined) { log.skipped.push(`${v.id}.${v.field}: unusable value`); continue }
    if (JSON.stringify(p[v.field]) === JSON.stringify(value)) continue
    p[v.field] = value
    if (v.source_url && !p.sources.includes(v.source_url)) p.sources.push(v.source_url)
    log.applied.push(`${v.id}.${v.field}`)
  }
}

// A program whose key facts were just confirmed against its own sources is no longer low confidence.
for (const chunk of results)
  for (const r of chunk?.research?.programs ?? []) {
    const p = byId.get(r.id)
    if (p && p.confidence === "low" && r.status !== "not_found" && (r.sources ?? []).some(s => s.checked && s.kind === "official")) p.confidence = "medium"
  }

registry.lastRun = date
fs.writeFileSync("data/programs.json", JSON.stringify(programs, null, 2) + "\n")
fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + "\n")
console.log(JSON.stringify({ applied: log.applied.length, rejected: log.rejected, skipped: log.skipped, flagged: log.flagged }, null, 2))
fs.writeFileSync(`docs/research-runs/${date}.json`, JSON.stringify(log, null, 2) + "\n")
