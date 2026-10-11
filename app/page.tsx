"use client"

import { Bookmark, CalendarDays, Compass, LayoutGrid, Search, Sparkles, Target, UserRound, X } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useCallback, useMemo, useState } from "react"

import { BubbleMap } from "@/components/atlas/BubbleMap"
import { ProfileDialog, useProfile } from "@/components/atlas/ProfileDialog"
import { ProgramDrawer, useSaved } from "@/components/atlas/shared"
import { AskView, BrowseView, CalendarView, FindPathView, SavedView, type Turn } from "@/components/atlas/views"
import { describeProfile, hasProfile, ROLES } from "@/lib/profile"
import { programById, programs } from "@/lib/programs"
import { rankPrograms } from "@/lib/search"
import { cn } from "@/lib/utils"

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
    <div className="min-h-screen bg-[#faf7f2]">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 pb-0 pt-6 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">USC Startup Atlas</div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Every way to build a company at USC</h1>
              <p className="mt-1 text-sm text-primary-foreground/80">
                {usc} USC programs and {programs.length - usc} outside resources, mapped in one place.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <button
              onClick={() => setProfileOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-semibold ring-1 ring-white/25 transition hover:bg-white/20"
            >
              <UserRound className="h-4 w-4" />
              {me ? (me.name?.split(" ")[0] ?? ROLES.find(r => r.key === me.role)?.label ?? "Your profile") : "Personalize"}
            </button>
            <label className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={e => {
                  setQuery(e.target.value)
                  if (e.target.value && tab !== "explore" && tab !== "browse") setParam({ view: "browse" })
                }}
                placeholder="Search: grants, biotech, pitch..."
                aria-label="Search programs"
                className="w-full rounded-xl border-0 bg-white py-2.5 pl-9 pr-9 text-sm text-foreground shadow-sm outline-none ring-secondary focus:ring-2"
              />
              {query && (
                <button aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
            </div>
          </div>
          <nav className="-mb-px mt-5 flex gap-1 overflow-x-auto" aria-label="Views">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setParam({ view: t.key })}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-t-xl px-4 py-2.5 text-sm font-semibold transition",
                  tab === t.key ? "bg-[#faf7f2] text-primary" : "text-primary-foreground/85 hover:bg-white/10",
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
        <div className="h-1 bg-secondary" />
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {tab === "explore" && (
          <>
            {matches && (
              <p className="mb-3 text-sm text-muted-foreground">
                Highlighting {matches.length} program{matches.length === 1 ? "" : "s"} for "{query}".
              </p>
            )}
            <BubbleMap programs={programs} highlight={highlight} onOpen={onOpen} />
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
