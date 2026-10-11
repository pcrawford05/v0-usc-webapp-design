"use client"

import { Bookmark, CalendarDays, Compass, LayoutGrid, Search, Sparkles, Target, UserRound, X } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useCallback, useMemo, useState } from "react"

import { BubbleMap } from "@/components/atlas/BubbleMap"
import { ConstellationView, JourneyView, OrbitView, SubwayView } from "@/components/atlas/ExploreViews"
import { ProfileDialog, useProfile } from "@/components/atlas/ProfileDialog"
import { ProgramDrawer, useSaved } from "@/components/atlas/shared"
import { AskView, BrowseView, CalendarView, FindPathView, SavedView, type Turn } from "@/components/atlas/views"
import { describeProfile, hasProfile, ROLES } from "@/lib/profile"
import { programById, programs } from "@/lib/programs"
import { rankPrograms } from "@/lib/search"
import { cn } from "@/lib/utils"

const MODES = [
  { key: "bubbles", label: "Bubbles" },
  { key: "journey", label: "Journey" },
  { key: "constellation", label: "Constellation" },
  { key: "orbit", label: "Orbit" },
  { key: "subway", label: "Subway" },
] as const

const TABS = [
  { key: "explore", label: "Explore", icon: Compass },
  { key: "path", label: "Find my path", icon: Target },
  { key: "browse", label: "Browse", icon: LayoutGrid },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "ask", label: "Ask AI", icon: Sparkles },
  { key: "saved", label: "Saved", icon: Bookmark },
] as const
type TabKey = (typeof TABS)[number]["key"]

function Atlas() {
  const params = useSearchParams()
  const router = useRouter()
  const tab = (TABS.find(t => t.key === params.get("view"))?.key ?? "explore") as TabKey
  const mode = MODES.find(m => m.key === params.get("mode"))?.key ?? "bubbles"
  const openId = params.get("p")
  const open = openId ? programById.get(openId) ?? null : null

  const setParam = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString())
      Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
      router.replace(`?${next.toString()}`, { scroll: false })
    },
    [params, router],
  )

  const { saved, isSaved, toggle } = useSaved()
  const { profile, save: saveProfile } = useProfile()
  const [profileOpen, setProfileOpen] = useState(false)
  const me = hasProfile(profile) ? profile : null
  const [query, setQuery] = useState("")
  const matches = useMemo(() => (query.trim() ? rankPrograms(query, 200).map(r => r.program) : null), [query])
  const highlight = useMemo(() => (matches ? new Set(matches.map(p => p.id)) : null), [matches])

  const [turns, setTurns] = useState<Turn[]>([])
  const [busy, setBusy] = useState(false)
  const ask = useCallback(
    async (q: string) => {
      const query = q.trim()
      if (!query) return
      const history = turns.map(t => ({ role: t.role, content: t.content }))
      setTurns(prev => [...prev, { role: "user", content: query }])
      setBusy(true)
      setParam({ view: "ask", p: null })
      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, history, profile: me ? describeProfile(me) : undefined }),
        })
        const data = await res.json()
        setTurns(prev => [
          ...prev,
          res.ok
            ? { role: "assistant", content: data.answer, picks: data.picks, provider: data.provider }
            : { role: "assistant", content: data.error ?? "Something went wrong." },
        ])
      } catch {
        setTurns(prev => [...prev, { role: "assistant", content: "I could not reach the server. Try again in a moment." }])
      } finally {
        setBusy(false)
      }
    },
    [turns, setParam, me],
  )

  const onOpen = useCallback((id: string) => setParam({ p: id }), [setParam])
  const card = { onOpen, isSaved, onToggleSave: toggle }
  const usc = programs.filter(p => p.group !== "external").length

  return (
    <div className="app-bg min-h-screen">
      <header className="z-40 px-3 pt-3 sm:sticky sm:top-0 sm:px-6">
        <div className="glass mx-auto max-w-7xl rounded-3xl px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#b3001b] to-[#7a0000] text-sm font-black tracking-tight text-[#FFCC00] shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_6px_16px_-6px_rgba(153,0,0,.6)]">SC</div>
              <div className="min-w-0 leading-tight">
                <div className="text-[15px] font-bold tracking-tight text-foreground">USC Startup Atlas</div>
                <div className="text-xs text-muted-foreground">{usc} USC programs · {programs.length - usc} outside resources</div>
              </div>
            </div>
            <label className="relative order-last w-full sm:order-none sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={e => {
                  setQuery(e.target.value)
                  if (e.target.value && tab !== "explore" && tab !== "browse") setParam({ view: "browse" })
                }}
                placeholder="Search grants, biotech, pitch..."
                aria-label="Search programs"
                className="w-full rounded-2xl border border-white/70 bg-white/60 py-2.5 pl-9 pr-9 text-sm text-foreground shadow-[inset_0_1px_2px_rgba(0,0,0,.06)] outline-none transition focus:bg-white/85 focus:ring-2 focus:ring-primary/30"
              />
              {query && (
                <button aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
            <button
              onClick={() => setProfileOpen(true)}
              aria-label="Your profile"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-br from-[#b3001b] to-[#8a0000] px-3.5 py-2.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_8px_20px_-8px_rgba(153,0,0,.7)] transition hover:brightness-110"
            >
              <UserRound className="h-4 w-4" />
              <span className="hidden sm:inline">{me ? (me.name?.split(" ")[0] ?? ROLES.find(r => r.key === me.role)?.label ?? "Your profile") : "Personalize"}</span>
            </button>
          </div>
          <nav className="mt-3 flex gap-1 overflow-x-auto rounded-2xl bg-black/[.04] p-1 [scrollbar-width:none]" aria-label="Views">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setParam({ view: t.key })}
                aria-current={tab === t.key ? "page" : undefined}
                className={cn(
                  "inline-flex shrink-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition",
                  tab === t.key ? "bg-white/90 text-primary shadow-[0_1px_0_#fff_inset,0_4px_14px_-6px_rgba(0,0,0,.25)]" : "text-foreground/70 hover:bg-white/50 hover:text-foreground",
                )}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
                {t.key === "saved" && saved.length > 0 && (
                  <span className="rounded-full bg-secondary px-1.5 text-[11px] text-secondary-foreground">{saved.length}</span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {tab === "explore" && (
          <>
            <div className="mb-4 flex gap-1 overflow-x-auto rounded-2xl glass p-1 [scrollbar-width:none] sm:inline-flex" role="tablist" aria-label="Explore views">
              {MODES.map(m => (
                <button
                  key={m.key}
                  role="tab"
                  aria-selected={mode === m.key}
                  onClick={() => setParam({ mode: m.key === "bubbles" ? null : m.key })}
                  className={cn("shrink-0 rounded-xl px-3.5 py-1.5 text-sm font-semibold transition", mode === m.key ? "bg-white/90 text-primary shadow-sm" : "text-foreground/70 hover:text-foreground")}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {matches && (
              <p className="mb-3 text-sm text-muted-foreground">
                Highlighting {matches.length} program{matches.length === 1 ? "" : "s"} for "{query}".
              </p>
            )}
            {mode === "bubbles" && <BubbleMap programs={programs} highlight={highlight} onOpen={onOpen} />}
            {mode === "journey" && <JourneyView programs={matches ?? programs} onOpen={onOpen} stage={me?.stage} />}
            {mode === "constellation" && <ConstellationView programs={matches ?? programs} onOpen={onOpen} />}
            {mode === "orbit" && <OrbitView programs={matches ?? programs} onOpen={onOpen} />}
            {mode === "subway" && <SubwayView programs={matches ?? programs} onOpen={onOpen} />}
          </>
        )}
        {tab === "path" && <FindPathView key={me ? JSON.stringify(me) : "none"} all={programs} profile={me} {...card} />}
        {tab === "browse" && <BrowseView all={programs} matches={matches} query={query} profile={me} {...card} />}
        {tab === "calendar" && <CalendarView all={programs} onOpen={onOpen} profile={me} />}
        {tab === "ask" && <AskView turns={turns} busy={busy} onSend={ask} {...card} />}
        {tab === "saved" && <SavedView saved={saved} onAskPlan={ask} {...card} />}
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-10 text-xs text-muted-foreground sm:px-6">
        Program details are researched from public sources and change often. Always confirm dates and eligibility on the official page.
      </footer>

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} profile={profile} onSave={saveProfile} />

      <ProgramDrawer
        program={open}
        onClose={() => setParam({ p: null })}
        saved={open ? isSaved(open.id) : false}
        onToggleSave={toggle}
        onAsk={ask}
      />
    </div>
  )
}

export default function Page() {
  return (
    <Suspense>
      <Atlas />
    </Suspense>
  )
}
