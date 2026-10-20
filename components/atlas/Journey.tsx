"use client"

import { Loader2, Map as MapIcon, Sparkles } from "lucide-react"
import { useMemo, useState } from "react"

import type { RoutePlan } from "@/lib/ai"
import { COLUMN, LINES, ZONES, kindOf, nextMonth } from "@/lib/network"
import { describeProfile, fitScore, SCHOOLS, STAGES, type Profile } from "@/lib/profile"
import { programs, type Stage } from "@/lib/programs"
import { cn } from "@/lib/utils"

import { ShareButton } from "./extras"
import { Itinerary, SubwayMap, routeUrl } from "./Subway"

const ORDER: Stage[] = ["idea", "prototype", "launched", "scaling"]

/**
 * A default Now / Next / Later roadmap with no AI involved: stations in the zone of the
 * founder's stage first, then the following zones, best fit first, soonest deadline breaking ties.
 */
function defaultRoute(stage: Stage, lineKey: string, profile: Profile | null): RoutePlan {
  const line = LINES.find(l => l.key === lineKey) ?? LINES[0]
  const i = ORDER.indexOf(stage)
  const used = new Set<string>()
  const month = new Date().getMonth() + 1
  const soon = (id: string) => {
    const m = nextMonth(programs.find(p => p.id === id)!)
    return m ? (m - month + 12) % 12 : 12
  }
  const pick = (s: Stage | undefined, n: number) => {
    if (!s) return []
    const z = ZONES.find(z => z.stage === s)!
    const fit = (id: string) => (profile ? fitScore(programs.find(p => p.id === id)!, profile) : 0)
    // Stay on the chosen goal line so the roadmap is one coherent ride.
    const ids = line.stops.filter(id => COLUMN[id] >= z.from && COLUMN[id] <= z.to && !used.has(id))
      .sort((a, b) => fit(b) - fit(a) || soon(a) - soon(b))
      .slice(0, n)
      .sort((a, b) => COLUMN[a] - COLUMN[b])
    ids.forEach(id => used.add(id))
    return ids
  }
  const group = profile ? SCHOOLS.find(s => s.key === profile.school)?.group : undefined
  const support = programs
    .filter(p => kindOf(p) === "service" && p.group !== "external" && (!group || p.group === group || p.group === "across"))
    .slice(0, 3)
    .map(p => p.id)
  return { now: pick(ORDER[i], 2), next: pick(ORDER[i + 1] ?? ORDER[i], 2), later: pick(ORDER[i + 2] ?? ORDER[3], 2), support }
}

export function JourneyView({ onOpen, profile }: { onOpen: (id: string) => void; profile: Profile | null }) {
  const [stage, setStage] = useState<Stage>(profile?.stage ?? "idea")
  const [lineKey, setLineKey] = useState(profile?.role === "phd" || profile?.role === "faculty" ? "research" : "funding")
  const [goal, setGoal] = useState("")
  const [ai, setAi] = useState<{ answer: string; plan: RoutePlan } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [showMap, setShowMap] = useState(false)
  const base = useMemo(() => defaultRoute(stage, lineKey, profile), [stage, lineKey, profile])
  const route = ai?.plan ?? base
  const stageCounts = useMemo(() => Object.fromEntries(ORDER.map(st => [st, programs.filter(p => p.stage.includes(st)).length])) as Record<Stage, number>, [])

  const personalize = async () => {
    setBusy(true)
    setErr(null)
    const stageLabel = STAGES.find(s => s.key === stage)?.label.toLowerCase()
    const query = `Plan my founder journey. My venture stage: ${stageLabel}. Main focus: ${LINES.find(l => l.key === lineKey)?.name.toLowerCase()}. ${goal.trim() ? `My goal: ${goal.trim()}.` : ""} Give me what to do now, next, and later.`
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, history: [], profile: profile ? describeProfile(profile) : undefined }) })
      const data = await res.json()
      if (!res.ok || !data.plan) throw new Error(data.error ?? "No plan came back. Try adding a goal.")
      setAi({ answer: data.answer, plan: data.plan })
      setShowMap(true)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not plan that")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="glass rounded-3xl p-4">
        <div className="text-lg font-bold text-foreground">My journey</div>
        <p className="text-sm text-muted-foreground">What to do now, what comes next, and what to aim for later. Pick your stage, or let the AI tailor it to your goal.</p>
        <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Your stage">
          {STAGES.map(s => (
            <button
              key={s.key}
              role="radio"
              aria-checked={stage === s.key}
              onClick={() => (setStage(s.key), setAi(null))}
              className={cn("rounded-full px-3.5 py-1.5 text-sm font-semibold transition", stage === s.key ? "bg-primary text-primary-foreground" : "bg-white/60 text-foreground/80 hover:bg-white")}
            >
              {s.label}
              <span className={cn("ml-1.5 text-xs font-normal", stage === s.key ? "text-primary-foreground/75" : "text-muted-foreground")}>{stageCounts[s.key]}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Your goal">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">I want to</span>
          {LINES.map(l => (
            <button
              key={l.key}
              role="radio"
              aria-checked={lineKey === l.key}
              onClick={() => (setLineKey(l.key), setAi(null))}
              className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition", lineKey === l.key ? "text-white" : "bg-white/60 text-foreground/80 hover:bg-white")}
              style={lineKey === l.key ? { backgroundColor: l.color } : undefined}
            >
              {lineKey !== l.key && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />}
              {l.name.toLowerCase()}
              <span className={cn("text-xs", lineKey === l.key ? "text-white/75" : "text-muted-foreground")}>{l.stops.length}</span>
            </button>
          ))}
        </div>
        <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={e => (e.preventDefault(), personalize())}>
          <input
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder="Optional goal, e.g. raise a pre-seed round by summer"
            className="min-w-0 flex-1 rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-base sm:py-2.5 sm:text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Tailor with AI
          </button>
        </form>
        {ai && <p className="mt-3 text-sm leading-relaxed text-foreground/90">{ai.answer}</p>}
        {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
        {!ai && <p className="mt-2 text-xs text-muted-foreground">{profile ? "Ordered for your profile." : "Tip: add your profile (Personalize) for picks that fit your school and role."}</p>}
      </div>

      <div className="flex justify-end">
        <ShareButton url={routeUrl(route)} title="My Founder Compass journey" label="Share my journey" />
      </div>
      <Itinerary route={route} onOpen={onOpen} />

      <button onClick={() => setShowMap(v => !v)} className="inline-flex items-center gap-2 rounded-2xl glass px-3.5 py-2 text-sm font-semibold hover:bg-white/70">
        <MapIcon className="h-4 w-4" /> {showMap ? "Hide" : "See this route on"} the subway map
      </button>
      {showMap && <SubwayMap route={route} onOpen={onOpen} />}
    </div>
  )
}
