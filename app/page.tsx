"use client"

import { Bookmark, Compass, MessageCircle, Search, UserRound } from "lucide-react"
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
import { DiscoverView } from "@/components/atlas/Discover"
import { SavedView } from "@/components/atlas/Saved"
import { AskView, type Turn } from "@/components/atlas/views"
import { NEEDS, type NeedKey } from "@/lib/catalog"
import { describeProfile, hasProfile, ROLES } from "@/lib/profile"
import { programById, programs } from "@/lib/programs"
import { filterParams, readFilters, type Filters } from "@/lib/filters"
import { rankPrograms } from "@/lib/search"
import { cn } from "@/lib/utils"

const TABS = [
  { key: "discover", label: "Discover", icon: Compass },
  { key: "ask", label: "Advisor", icon: MessageCircle },
  { key: "saved", label: "Saved", icon: Bookmark },
] as const
type TabKey = (typeof TABS)[number]["key"]
type Mode = "list" | "map" | "bubbles" | "campus"

// Old links: Explore and Browse are now Discover, Calendar lives in Saved, the Subway tab is Discover's map.
const LEGACY_VIEW: Record<string, TabKey> = { explore: "discover", browse: "discover", calendar: "saved", path: "discover" }

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
  const rawView = params.get("view") ?? ""
  const tab = (TABS.find(t => t.key === rawView)?.key ?? LEGACY_VIEW[rawView] ?? "discover") as TabKey
  const rawMode = params.get("mode")
  const mode: Mode = rawMode === "subway" || rawMode === "map" ? "map" : rawMode === "bubbles" || rawMode === "campus" ? rawMode : "list"
  const need = (NEEDS.find(n => n.key === params.get("need"))?.key ?? null) as NeedKey | null
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
  const matches = useMemo(() => (filters.q.trim() ? rankPrograms(filters.q, 200).map(r => r.program) : null), [filters.q])
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
  const tabsInd = useIndicator(tab)
  const setMode = (m: Mode) => setParam({ view: "discover", mode: m === "list" ? null : m, route: null })

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

  const tabButton = (t: (typeof TABS)[number], compact: boolean) => (
    <button
      key={t.key}
      data-key={t.key}
      data-tour={t.key === "ask" ? "ask" : undefined}
      onClick={() => setParam({ view: t.key, p: null })}
      aria-current={tab === t.key ? "page" : undefined}
      className={cn(
        "relative inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-colors",
        compact ? "flex-col gap-0.5 py-1.5 text-[11px]" : "px-4 py-2 text-sm",
        tab === t.key ? "text-primary" : "text-foreground/65 hover:text-foreground",
      )}
    >
      <t.icon className={compact ? "h-5 w-5" : "h-4 w-4"} />
      {t.label}
      {t.key === "saved" && saved.length > 0 && <span className={cn("rounded-full bg-secondary px-1.5 text-[10px] text-secondary-foreground", compact && "absolute right-[22%] top-0.5")}>{saved.length}</span>}
    </button>
  )

  return (
    <div className="app-bg min-h-screen pb-24 sm:pb-0">
      {/* Thin header: brand, search, profile. On phones the tabs move to a bottom bar. */}
      <header className="sticky top-0 z-40 px-3 pt-2 sm:px-6 sm:pt-3">
        <div className="glass mx-auto flex max-w-7xl items-center gap-2 rounded-2xl px-3 py-2 sm:gap-3 sm:rounded-3xl sm:px-4">
          <button onClick={() => setParam({ view: "discover", mode: null, need: null, p: null })} className="group/logo flex min-w-0 items-center gap-2.5" aria-label="Founder Compass home">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#b3001b] to-[#7a0000] text-[#FFCC00] shadow-[inset_0_1px_0_rgba(255,255,255,.35)]">
              <Compass className="h-[18px] w-[18px] transition-transform duration-700 group-hover/logo:rotate-[200deg]" />
            </span>
            <span className="truncate text-[15px] font-bold tracking-tight text-foreground">Founder Compass</span>
          </button>
          <nav ref={tabsInd.ref} className="relative mx-auto hidden gap-1 rounded-2xl bg-black/[.04] p-1 sm:flex" aria-label="Views">
            {tabsInd.box && <span aria-hidden className="tab-indicator absolute left-0 top-0 rounded-xl bg-white/90 shadow-sm" style={{ transform: `translate(${tabsInd.box.x}px, ${tabsInd.box.y}px)`, width: tabsInd.box.w, height: tabsInd.box.h }} />}
            {TABS.map(t => tabButton(t, false))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5 sm:ml-0">
            <button onClick={() => setPaletteOpen(true)} data-tour="search" aria-label="Search" className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm text-muted-foreground hover:bg-white/70">
              <Search className="h-[18px] w-[18px]" />
              <kbd className="hidden rounded-md border border-black/10 bg-white/80 px-1.5 py-0.5 font-sans text-[11px] lg:inline">⌘K</kbd>
            </button>
            <button
              onClick={() => setProfileOpen(true)}
              aria-label="Your profile"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#b3001b] to-[#8a0000] px-2.5 py-2 text-sm font-semibold text-white hover:brightness-110 sm:px-3"
            >
              <UserRound className="h-4 w-4" />
              <span className="hidden md:inline">{me ? (me.name?.split(" ")[0] ?? ROLES.find(r => r.key === me.role)?.label ?? "Profile") : "Personalize"}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
        <div key={`${tab}-${mode}`} className="animate-view">
          {tab === "discover" && (mode === "list" || mode === "map") && (
            <DiscoverView filters={filters} setFilters={setFilters} need={need} setNeed={n => setParam({ need: n })} profile={me} mode={mode} setMode={setMode} {...card} />
          )}
          {tab === "discover" && (mode === "bubbles" || mode === "campus") && (
            <div className="space-y-3">
              <button onClick={() => setMode("map")} className="text-sm font-semibold text-primary hover:underline">← Back to Discover</button>
              {mode === "bubbles" ? <BubbleMap programs={programs} highlight={highlight} onOpen={onOpen} /> : <CampusMap programs={programs} highlight={highlight} onOpen={onOpen} />}
            </div>
          )}
          {tab === "discover" && params.get("route") && mode === "map" && (
            <div className="mt-6"><SubwayView onOpen={onOpen} initial={params.get("route") ?? undefined} /></div>
          )}
          {tab === "ask" && <AskView turns={turns} busy={busy} onSend={ask} {...card} />}
          {tab === "saved" && <SavedView saved={saved} {...card} />}
        </div>
      </main>

      {/* Phone tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/90 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-1 backdrop-blur-xl sm:hidden" aria-label="Views">
        <div className="flex">{TABS.map(t => tabButton(t, true))}</div>
      </nav>

      <footer className="mx-auto max-w-7xl px-4 pb-10 text-xs text-muted-foreground sm:px-6">
        Program details are researched from public sources and change often. Always confirm dates and eligibility on the official page. Spot an error or have an idea? <FeedbackLink label="Send feedback" className="font-normal text-inherit underline hover:text-foreground" />. · <a href="/one-pager" className="underline hover:text-foreground">One-page PDF</a>
      </footer>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        views={TABS}
        onOpen={onOpen}
        onAsk={ask}
        onFilter={q => setParam({ ...filterParams({ q }), view: "discover", mode: null, p: null })}
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
