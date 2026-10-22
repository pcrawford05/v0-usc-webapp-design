"use client"

import { Bookmark, CalendarDays, Compass, LayoutGrid, MessageCircle, MessageSquare, Search, UserRound, X } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"

import { BubbleMap } from "@/components/atlas/BubbleMap"
import { CampusMap } from "@/components/atlas/CampusMap"
import { CommandPalette } from "@/components/atlas/CommandPalette"
import { Tour } from "@/components/atlas/extras"
import { SubwayView } from "@/components/atlas/Subway"
import { ProfileDialog, useProfile } from "@/components/atlas/ProfileDialog"
import { FeedbackLink } from "@/components/atlas/Feedback"
import { ProgramDrawer, useSaved } from "@/components/atlas/shared"
import { AskView, BrowseView, CalendarView, SavedView, type Turn } from "@/components/atlas/views"
import { describeProfile, hasProfile, ROLES } from "@/lib/profile"
import { programById, programs } from "@/lib/programs"
import { filterParams, readFilters, type Filters } from "@/lib/filters"
import { rankPrograms } from "@/lib/search"
import { cn } from "@/lib/utils"

const MODES = [
  { key: "bubbles", label: "Bubbles" },
  { key: "subway", label: "Subway map" },
  { key: "campus", label: "Campus map" },
] as const

const TABS = [
  { key: "explore", label: "Explore", icon: Compass },
  { key: "browse", label: "Browse", icon: LayoutGrid },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "ask", label: "Advisor", icon: MessageCircle },
  { key: "saved", label: "Saved", icon: Bookmark },
] as const
type TabKey = (typeof TABS)[number]["key"]

/** A pill that slides under whichever button in a group is active. */
function useIndicator(active: string) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current?.querySelector<HTMLElement>(`[data-key="${active}"]`)
      if (el) setBox({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight })
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [active])
  return { ref, box }
}

function Atlas() {
  const params = useSearchParams()
  const router = useRouter()
  // Older links to retired views (Find my path, My journey, Orbit, Constellation) land on Explore.
  const rawView = params.get("view")
  const rawMode = params.get("mode")
  const tab = (TABS.find(t => t.key === rawView)?.key ?? "explore") as TabKey
  const mode = MODES.find(m => m.key === rawMode)?.key ?? "bubbles"
  const openId = params.get("p")
  const open = openId ? programById.get(openId) ?? null : null

  const setParam = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString())
      Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
      const go = () => router.replace(`?${next.toString()}`, { scroll: false })
      // Cross-fade views natively where supported (Chrome, Edge, Safari 18).
      const doc = document as Document & { startViewTransition?: (cb: () => void) => void }
      const switching = "view" in changes || "mode" in changes
      if (switching && doc.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) doc.startViewTransition(go)
      else go()
    },
    [params, router],
  )

  const { saved, isSaved, toggle } = useSaved()
  const { profile, save: saveProfile } = useProfile()
  const [profileOpen, setProfileOpen] = useState(false)
  const me = hasProfile(profile) ? profile : null
  const filters = useMemo(() => readFilters(params), [params])
  const setFilters = useCallback((f: Partial<Filters>) => setParam(filterParams(f)), [setParam])
  const [paletteOpen, setPaletteOpen] = useState(false)
  const query = filters.q
  const setQuery = (q: string) => setFilters({ q })
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
            ? { role: "assistant", content: data.answer, picks: data.picks, plan: data.plan, provider: data.provider }
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
  const card = { onOpen, isSaved, onToggleSave: toggle, onAsk: (q: string) => ask(q) }
  const usc = programs.filter(p => p.group !== "external").length
  const tabsInd = useIndicator(tab)
  const modesInd = useIndicator(mode)

  // Feeds the cursor position to every .spotlight card for the hover light.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.(".spotlight") as HTMLElement | null
      if (!el) return
      const r = el.getBoundingClientRect()
      el.style.setProperty("--mx", `${e.clientX - r.left}px`)
      el.style.setProperty("--my", `${e.clientY - r.top}px`)
    }
    window.addEventListener("pointermove", move, { passive: true })
    return () => window.removeEventListener("pointermove", move)
  }, [])

  return (
    <div className="app-bg min-h-screen">
      <header className="z-40 px-3 pt-3 sm:sticky sm:top-0 sm:px-6">
        <div className="glass mx-auto max-w-7xl rounded-3xl px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="group/logo flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#b3001b] to-[#7a0000] text-[#FFCC00] shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_6px_16px_-6px_rgba(153,0,0,.6)]">
                <Compass className="h-5 w-5 transition-transform duration-700 group-hover/logo:rotate-[200deg]" />
              </div>
              <div className="min-w-0 leading-tight">
                <div className="text-[15px] font-bold tracking-tight text-foreground">Founder Compass</div>
                <div className="hidden text-xs text-muted-foreground lg:block">{usc} USC programs · {programs.length - usc} outside resources</div>
              </div>
            </div>
            <button
              onClick={() => setPaletteOpen(true)}
              data-tour="search"
              className="order-last flex w-full items-center gap-2 rounded-2xl border border-white/70 bg-white/60 py-2.5 pl-3 pr-2 text-left text-sm text-muted-foreground shadow-[inset_0_1px_2px_rgba(0,0,0,.06)] transition hover:bg-white/85 sm:order-none sm:w-80"
            >
              <Search className="h-4 w-4" />
              <span className="flex-1">Search or ask anything...</span>
              <kbd className="hidden rounded-md border border-black/10 bg-white/80 px-1.5 py-0.5 font-sans text-[11px] sm:inline">⌘K</kbd>
            </button>
            <FeedbackLink
              ariaLabel="Send feedback"
              label={<><MessageSquare className="h-4 w-4" /><span className="hidden sm:inline">Feedback</span></>}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/70 bg-white/60 px-3.5 py-2.5 text-sm text-foreground shadow-[inset_0_1px_2px_rgba(0,0,0,.06)] transition hover:bg-white/85 hover:no-underline"
            />
            <button
              onClick={() => setProfileOpen(true)}
              aria-label="Your profile"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-br from-[#b3001b] to-[#8a0000] px-3.5 py-2.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_8px_20px_-8px_rgba(153,0,0,.7)] transition hover:brightness-110"
            >
              <UserRound className="h-4 w-4" />
              <span className="hidden sm:inline">{me ? (me.name?.split(" ")[0] ?? ROLES.find(r => r.key === me.role)?.label ?? "Your profile") : "Personalize"}</span>
            </button>
          </div>
          <nav ref={tabsInd.ref} className="relative mt-3 flex gap-1 overflow-x-auto rounded-2xl bg-black/[.04] p-1 [scrollbar-width:none]" aria-label="Views">
            {tabsInd.box && (
              <span aria-hidden className="tab-indicator absolute left-0 top-0 rounded-xl bg-white/90 shadow-[0_1px_0_#fff_inset,0_4px_14px_-6px_rgba(0,0,0,.25)]" style={{ transform: `translate(${tabsInd.box.x}px, ${tabsInd.box.y}px)`, width: tabsInd.box.w, height: tabsInd.box.h }} />
            )}
            {TABS.map(t => (
              <button
                key={t.key}
                data-key={t.key}
                data-tour={t.key === "ask" ? "ask" : undefined}
                aria-label={t.label}
                onClick={() => setParam({ view: t.key })}
                aria-current={tab === t.key ? "page" : undefined}
                className={cn(
                  "relative inline-flex shrink-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                  tab === t.key ? "text-primary" : "text-foreground/70 hover:text-foreground",
                )}
              >
                <t.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{t.label}</span>
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
          <div key={mode} className="animate-view">
            <div ref={modesInd.ref} data-tour="explore-modes" className="relative mb-4 grid grid-cols-2 gap-1 rounded-2xl glass p-1 sm:inline-flex" role="tablist" aria-label="Explore views">
              {modesInd.box && <span aria-hidden className="tab-indicator absolute left-0 top-0 rounded-xl bg-white/90 shadow-sm" style={{ transform: `translate(${modesInd.box.x}px, ${modesInd.box.y}px)`, width: modesInd.box.w, height: modesInd.box.h }} />}
              {MODES.map(m => (
                <button
                  key={m.key}
                  data-key={m.key}
                  role="tab"
                  aria-selected={mode === m.key}
                  onClick={() => setParam({ mode: m.key === "bubbles" ? null : m.key, route: null })}
                  className={cn("relative inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors sm:py-1.5", mode === m.key ? "text-primary" : "text-foreground/70 hover:text-foreground")}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {matches && (
              <p className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
                Showing {matches.length} program{matches.length === 1 ? "" : "s"} for "{query}"
                <button onClick={() => setQuery("")} aria-label="Clear search" className="rounded-full bg-foreground/[.07] p-0.5 hover:bg-foreground/[.12]"><X className="h-3.5 w-3.5" /></button>
              </p>
            )}
            {mode === "bubbles" && <BubbleMap programs={programs} highlight={highlight} onOpen={onOpen} />}
            {mode === "campus" && <CampusMap programs={programs} highlight={highlight} onOpen={onOpen} />}
            {mode === "subway" && <SubwayView onOpen={onOpen} profile={me ? describeProfile(me) : undefined} initial={params.get("route") ?? undefined} />}
          </div>
        )}
        {tab !== "explore" && <div key={tab} className="animate-view">
        {tab === "browse" && <BrowseView all={programs} filters={filters} setFilters={setFilters} profile={me} saved={saved} {...card} />}
        {tab === "calendar" && <CalendarView all={programs} onOpen={onOpen} profile={me} saved={saved} />}
        {tab === "ask" && <AskView turns={turns} busy={busy} onSend={ask} {...card} />}
        {tab === "saved" && <SavedView saved={saved} onAskPlan={ask} {...card} />}
        </div>}
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-10 text-xs text-muted-foreground sm:px-6">
        Program details are researched from public sources and change often. Always confirm dates and eligibility on the official page. Spot an error or have an idea? <FeedbackLink label="Send feedback" className="font-normal text-inherit underline hover:text-foreground" />. · <a href="/one-pager" className="underline hover:text-foreground">One-page PDF</a>
      </footer>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        views={TABS}
        onOpen={onOpen}
        onAsk={ask}
        onFilter={q => setParam({ ...filterParams({ q }), view: "browse", p: null })}
        onView={v => setParam({ view: v })}
      />

      <Tour />

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
