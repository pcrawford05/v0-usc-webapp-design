"use client"

import { ArrowUp, Bookmark, Loader2, RotateCcw, Sparkles } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import {
  AUDIENCE_LABELS,
  CATEGORIES,
  GROUPS,
  GROUP_KEYS,
  MONTHS,
  isAlwaysOn,
  programById,
  type Audience,
  type Category,
  type GroupKey,
  type Program,
  type Stage,
} from "@/lib/programs"
import { fitScore, type Profile } from "@/lib/profile"
import { cn } from "@/lib/utils"

import { GroupPill, ProgramCard } from "./shared"

type CardProps = { onOpen: (id: string) => void; isSaved: (id: string) => boolean; onToggleSave: (id: string) => void }

function Chip({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition",
        active ? "border-transparent text-white shadow-sm" : "glass text-foreground hover:bg-muted",
      )}
      style={active ? { backgroundColor: color ?? "hsl(var(--primary))" } : undefined}
    >
      {children}
    </button>
  )
}

function Grid({ items, reasons, ...card }: CardProps & { items: Program[]; reasons?: Map<string, string> }) {
  if (!items.length) return <p className="py-10 text-center text-muted-foreground">No programs match yet. Try loosening a filter.</p>
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(p => (
        <ProgramCard
          key={p.id}
          program={p}
          reason={reasons?.get(p.id)}
          onOpen={card.onOpen}
          saved={card.isSaved(p.id)}
          onToggleSave={card.onToggleSave}
        />
      ))}
    </div>
  )
}

// ---------- Find my path ----------

const WHO: { key: string; label: string; audience: Audience[] }[] = [
  { key: "undergrad", label: "Undergrad", audience: ["undergrad"] },
  { key: "grad", label: "Master's / MBA", audience: ["grad"] },
  { key: "phd", label: "PhD / Postdoc", audience: ["phd", "postdoc"] },
  { key: "faculty", label: "Faculty / Staff", audience: ["faculty", "staff"] },
  { key: "alumni", label: "Alumni", audience: ["alumni"] },
]
const STAGES: { key: Stage; label: string; hint: string }[] = [
  { key: "idea", label: "Just an idea", hint: "Exploring problems" },
  { key: "prototype", label: "Building", hint: "Prototype or MVP" },
  { key: "launched", label: "Launched", hint: "Users or revenue" },
  { key: "scaling", label: "Scaling", hint: "Raising and hiring" },
]
const NEEDS: { key: string; label: string; categories: Category[]; words: RegExp }[] = [
  { key: "money", label: "Funding", categories: ["Funding & Grants", "Competitions & Pitch"], words: /fund|grant|prize|\$/i },
  { key: "mentor", label: "Mentors & advice", categories: ["Mentorship & Office Hours", "Accelerators & Incubators"], words: /mentor|office hours|advis|residence/i },
  { key: "team", label: "A co-founder or team", categories: ["Student Organizations", "Events & Speakers"], words: /co-?founder|matching|mixer|team/i },
  { key: "pitch", label: "Pitch & compete", categories: ["Competitions & Pitch"], words: /pitch|competition|showcase|challenge|demo/i },
  { key: "build", label: "Space & tools to build", categories: ["Makerspaces & Coworking", "Accelerators & Incubators"], words: /maker|lab|cowork|prototype|hackathon/i },
  { key: "learn", label: "Learn the skills", categories: ["Courses & Degrees", "Founder Toolkits", "Events & Speakers"], words: /course|bootcamp|training|workshop|minor/i },
  { key: "legal", label: "Legal, IP, or licensing", categories: ["Legal & IP", "Research Commercialization"], words: /legal|patent|ip\b|licens|law/i },
  { key: "network", label: "Investors & network", categories: ["Partners & Ecosystem", "Events & Speakers"], words: /investor|venture|angel|network|vc/i },
]

export function FindPathView({ all, profile, ...card }: CardProps & { all: Program[]; profile: Profile | null }) {
  const [who, setWho] = useState<string | null>(profile?.role ?? null)
  const [stage, setStage] = useState<Stage | null>(profile?.stage ?? null)
  const [needs, setNeeds] = useState<string[]>(profile?.interests ?? [])
  const nowMonth = new Date().getMonth() + 1

  const results = useMemo(() => {
    if (!who && !stage && !needs.length) return []
    const aud = WHO.find(w => w.key === who)?.audience ?? []
    const picked = NEEDS.filter(n => needs.includes(n.key))
    return all
      .map(p => {
        let s = 0
        if (aud.length) s += p.audience.some(a => aud.includes(a)) ? 2 : p.audience.length ? -3 : 0.3
        if (stage) s += p.stage.includes(stage) ? 2 : p.stage.length ? -1 : 0.3
        for (const n of picked) {
          if (n.categories.includes(p.category)) s += 3
          if (n.words.test(`${p.name} ${p.description ?? ""} ${p.funding ?? ""}`)) s += 1.5
        }
        if (p.months.some(m => ((m - nowMonth + 12) % 12) <= 2)) s += 0.6
        if (p.group === "external") s -= 0.8
        if (p.confidence === "low") s -= 0.5
        return { p, s }
      })
      .filter(x => x.s > 2)
      .sort((a, b) => b.s - a.s)
      .slice(0, 12)
      .map(x => x.p)
  }, [all, who, stage, needs, nowMonth])

  const step = (n: number, title: string, children: React.ReactNode) => (
    <div className="rounded-2xl glass p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{n}</span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-3">
        {step(1, "I am a...", WHO.map(w => (
          <Chip key={w.key} active={who === w.key} onClick={() => setWho(who === w.key ? null : w.key)}>{w.label}</Chip>
        )))}
        {step(2, "My venture is...", STAGES.map(s => (
          <Chip key={s.key} active={stage === s.key} onClick={() => setStage(stage === s.key ? null : s.key)}>
            <span title={s.hint}>{s.label}</span>
          </Chip>
        )))}
        {step(3, "I need...", NEEDS.map(n => (
          <Chip
            key={n.key}
            active={needs.includes(n.key)}
            onClick={() => setNeeds(needs.includes(n.key) ? needs.filter(x => x !== n.key) : [...needs, n.key])}
          >
            {n.label}
          </Chip>
        )))}
      </div>
      {results.length > 0 ? (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Your shortlist</h3>
            <button onClick={() => (setWho(null), setStage(null), setNeeds([]))} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <RotateCcw className="h-3.5 w-3.5" /> Start over
            </button>
          </div>
          <Grid items={results} {...card} />
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
          Pick an option in any of the three steps and your shortlist appears here.
        </p>
      )}
    </div>
  )
}

// ---------- Browse ----------

export function BrowseView({ all, matches, query, profile, ...card }: CardProps & { all: Program[]; matches: Program[] | null; query: string; profile: Profile | null }) {
  const [groups, setGroups] = useState<GroupKey[]>([])
  const [cat, setCat] = useState<Category | "">("")
  const [aud, setAud] = useState<Audience | "">("")
  const [verifiedOnly, setVerifiedOnly] = useState(false)

  const filtered = (matches ?? all).filter(
    p =>
      (!groups.length || groups.includes(p.group)) &&
      (!cat || p.category === cat) &&
      (!aud || p.audience.includes(aud)) &&
      (!verifiedOnly || p.confidence !== "low"),
  )
  // With a profile and no search query, best fits come first (stable, so ties keep catalog order).
  const forYou = !!profile && !matches
  const items = forYou ? [...filtered].sort((a, b) => fitScore(b, profile!) - fitScore(a, profile!)) : filtered
  const toggle = (g: GroupKey) => setGroups(groups.includes(g) ? groups.filter(x => x !== g) : [...groups, g])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {GROUP_KEYS.map(g => (
          <Chip key={g} active={groups.includes(g)} onClick={() => toggle(g)} color={GROUPS[g].color}>
            {GROUPS[g].short}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select value={cat} onChange={e => setCat(e.target.value as Category)} className="rounded-lg glass px-3 py-2">
          <option value="">All types</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={aud} onChange={e => setAud(e.target.value as Audience)} className="rounded-lg glass px-3 py-2">
          <option value="">Anyone</option>
          {(Object.keys(AUDIENCE_LABELS) as Audience[]).map(a => <option key={a} value={a}>{AUDIENCE_LABELS[a]}</option>)}
        </select>
        <label className="inline-flex items-center gap-2 rounded-lg glass px-3 py-2">
          <input type="checkbox" checked={verifiedOnly} onChange={e => setVerifiedOnly(e.target.checked)} className="accent-[hsl(var(--primary))]" />
          Verified details only
        </label>
        <span className="ml-auto text-muted-foreground">
          {items.length} program{items.length === 1 ? "" : "s"}
          {query && ` matching "${query}"`}
          {forYou && ", best fits for you first"}
        </span>
      </div>
      <Grid items={items} {...card} />
    </div>
  )
}

// ---------- Calendar ----------

export function CalendarView({ all, onOpen, profile }: { all: Program[]; onOpen: (id: string) => void; profile: Profile | null }) {
  const now = new Date()
  const start = now.getMonth()
  const months = Array.from({ length: 12 }, (_, i) => ({ m: ((start + i) % 12) + 1, year: now.getFullYear() + Math.floor((start + i) / 12) }))
  const [showCourses, setShowCourses] = useState(false)
  const pool = showCourses ? all : all.filter(p => p.category !== "Courses & Degrees" && p.category !== "Student Organizations")
  const alwaysOn = pool.filter(isAlwaysOn)
  const [showAlways, setShowAlways] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Deadlines and events for the next 12 months, based on each program's usual cycle. Dates shift year to year, so confirm on the official page.
        </p>
        <label className="inline-flex items-center gap-2 rounded-lg glass px-3 py-1.5 text-sm">
          <input type="checkbox" checked={showCourses} onChange={e => setShowCourses(e.target.checked)} className="accent-[hsl(var(--primary))]" />
          Include courses and clubs
        </label>
      </div>
      <div className="flex snap-x gap-3 overflow-x-auto pb-3">
        {months.map(({ m, year }, i) => {
          const inMonth = pool.filter(p => p.months.includes(m))
          const items = profile ? [...inMonth].sort((a, b) => fitScore(b, profile) - fitScore(a, profile)) : inMonth
          return (
            <section
              key={`${year}-${m}`}
              className={cn(
                "w-64 shrink-0 snap-start rounded-2xl border glass p-3",
                i === 0 ? "border-primary shadow-md ring-1 ring-primary/30" : "border-border",
              )}
            >
              <header className="mb-2 flex items-baseline justify-between">
                <h3 className="text-lg font-bold">
                  {MONTHS[m - 1]} <span className="text-sm font-normal text-muted-foreground">{year}</span>
                </h3>
                {i === 0 ? <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">Now</span> : <span className="text-xs text-muted-foreground">{items.length}</span>}
              </header>
              <ul className="space-y-1.5">
                {items.map(p => (
                  <li key={p.id}>
                    <button onClick={() => onOpen(p.id)} className="w-full rounded-lg border-l-4 bg-muted/40 px-2.5 py-1.5 text-left text-sm transition hover:bg-muted" style={{ borderLeftColor: GROUPS[p.group].color }}>
                      <div className="font-medium leading-snug">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground">{GROUPS[p.group].short} · {p.category}</div>
                    </button>
                  </li>
                ))}
                {!items.length && <li className="py-4 text-center text-sm text-muted-foreground">Nothing dated this month</li>}
              </ul>
            </section>
          )
        })}
      </div>
      <div className="rounded-2xl glass p-4">
        <button onClick={() => setShowAlways(!showAlways)} className="flex w-full items-center justify-between text-left">
          <span className="font-semibold">Year-round and rolling ({alwaysOn.length})</span>
          <span className="text-sm text-primary">{showAlways ? "Hide" : "Show"}</span>
        </button>
        {showAlways && (
          <div className="mt-3 flex flex-wrap gap-2">
            {alwaysOn.map(p => (
              <button key={p.id} onClick={() => onOpen(p.id)} className="rounded-full border border-border px-3 py-1 text-sm transition hover:bg-muted">
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: GROUPS[p.group].color }} />
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- Ask AI ----------

export interface Turn {
  role: "user" | "assistant"
  content: string
  picks?: { id: string; reason: string }[]
  provider?: string
}

const SUGGESTIONS = [
  "I'm a PhD student with a medical device idea. Where do I start?",
  "What funding can an undergrad get this semester?",
  "How do I find a technical co-founder?",
  "Which pitch competitions are coming up soon?",
  "I'm an international student. What should I know before starting a company?",
]

export function AskView({
  turns,
  busy,
  onSend,
  ...card
}: CardProps & { turns: Turn[]; busy: boolean; onSend: (q: string) => void }) {
  const [input, setInput] = useState("")
  const endRef = useRef<HTMLDivElement>(null)
  const send = (q: string) => {
    if (!q.trim() || busy) return
    onSend(q)
    setInput("")
  }
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [turns.length, busy])

  return (
    <div className="mx-auto max-w-4xl">
      {turns.length === 0 && (
        <div className="py-6 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-2 text-2xl font-bold">Ask the Atlas</h2>
          <p className="mt-1 text-muted-foreground">Describe where you are and what you need. Answers come only from the program catalog.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => send(s)} className="rounded-full glass px-3 py-1.5 text-sm transition hover:border-primary/50 hover:bg-muted">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-5">
        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-primary-foreground">{t.content}</div>
            </div>
          ) : (
            <div key={i} className="space-y-3">
              <div className="max-w-[90%] rounded-2xl rounded-bl-sm glass px-4 py-3 leading-relaxed">{t.content}</div>
              {t.picks && t.picks.length > 0 && (
                <Grid
                  items={t.picks.map(p => programById.get(p.id)!).filter(Boolean)}
                  reasons={new Map(t.picks.map(p => [p.id, p.reason]))}
                  {...card}
                />
              )}
              {t.provider === "local" && <p className="text-xs text-muted-foreground">AI is offline right now, so these are keyword matches.</p>}
            </div>
          ),
        )}
        {busy && (
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Searching the catalog...
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={e => (e.preventDefault(), send(input))} className="sticky bottom-4 mt-6 flex items-center gap-2 rounded-2xl glass p-2 shadow-lg">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="e.g. I have a climate hardware prototype and need $10K"
          className="flex-1 bg-transparent px-3 py-2 outline-none"
          aria-label="Ask a question"
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="rounded-xl bg-primary p-2.5 text-primary-foreground transition hover:opacity-90 disabled:opacity-40">
          <ArrowUp className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
}

// ---------- Saved ----------

export function SavedView({ saved, onAskPlan, ...card }: CardProps & { saved: string[]; onAskPlan: (q: string) => void }) {
  const items = saved.map(id => programById.get(id)).filter(Boolean) as Program[]
  if (!items.length)
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
        <Bookmark className="mx-auto mb-2 h-6 w-6" />
        Save programs with the bookmark icon and they collect here, in this browser.
      </div>
    )
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">{items.slice(0, 8).map(p => <GroupPill key={p.id} program={p} />)}</div>
        <button
          onClick={() => onAskPlan(`I saved these programs: ${items.map(p => p.name).join("; ")}. Put them in a sensible order for the next 6 months and flag any deadlines.`)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <Sparkles className="h-4 w-4" /> Plan my next 6 months
        </button>
      </div>
      <Grid items={items} {...card} />
    </div>
  )
}
