"use client"

import { Bookmark, CalendarDays, Compass, MessageCircle, Search } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"

import { BubbleMap } from "@/components/atlas/BubbleMap"
import { CommandPalette } from "@/components/atlas/CommandPalette"
import { Tour } from "@/components/atlas/extras"
import { ProfileDialog, useProfile } from "@/components/atlas/ProfileDialog"
import { FeedbackLink } from "@/components/atlas/Feedback"
import { ProgramDrawer, useSaved } from "@/components/atlas/shared"
import { DiscoverView } from "@/components/atlas/Discover"
import { ComingUp } from "@/components/atlas/ComingUp"
import { TabBar } from "@/components/atlas/TabBar"
import { ProfileMenu, SavedView } from "@/components/atlas/Saved"
import { AdvisorView } from "@/components/atlas/views"
import { describeProfile, hasProfile, ROLES } from "@/lib/profile"
import { programById, programs } from "@/lib/programs"
import { filterParams, readFilters, type Filters } from "@/lib/filters"
import { rankPrograms } from "@/lib/search"
import { cn } from "@/lib/utils"

const TABS = [
  { key: "discover", label: "Discover", icon: Compass },
  { key: "ask", label: "Advisor", icon: MessageCircle },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
] as const
type TabKey = (typeof TABS)[number]["key"] | "saved"
type Mode = "list" | "subway" | "campus" | "bubbles"

// Old links: Explore and Browse are now Discover, the Subway tab is Discover's map. Saved lives in the profile menu.
const LEGACY_VIEW: Record<string, TabKey> = { explore: "discover", browse: "discover", path: "discover", saved: "saved" }

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
  // "map" was the subway's old name in shared links.
  const mode: Mode = rawMode === "subway" || rawMode === "map" ? "subway" : rawMode === "bubbles" || rawMode === "campus" ? rawMode : "list"
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

  // Questions typed anywhere (palette, program drawer) ride along to the Advisor's prompt.
  const ask = useCallback((q: string) => setParam({ view: "ask", ask: q.trim() || null, p: null }), [setParam])

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

  const tabButton = (t: (typeof TABS)[number]) => (
    <button
      key={t.key}
      data-key={t.key}
      data-tour={t.key === "ask" ? "ask" : undefined}
      onClick={() => setParam({ view: t.key, p: null })}
      aria-current={tab === t.key ? "page" : undefined}
      className={cn(
        "relative inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
        tab === t.key ? "text-primary" : "text-foreground/65 hover:text-foreground",
      )}
    >
      <t.icon className="h-4 w-4" />
      {t.label}
    </button>
  )

  return (
    <div className="app-bg min-h-screen pb-24 sm:pb-0">
      {/* Thin header: brand, search, profile. On phones the tabs move to a bottom bar. */}
      <header className="sticky top-0 z-40 px-3 pt-2 sm:px-6 sm:pt-3">
        <div className="glass mx-auto flex max-w-7xl items-center gap-2 rounded-2xl px-3 py-2 sm:gap-3 sm:rounded-3xl sm:px-4">
          <button onClick={() => setParam({ view: "discover", mode: null, p: null })} className="group/logo flex min-w-0 items-center gap-2.5" aria-label="Founder Compass home">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#b3001b] to-[#7a0000] text-[#FFCC00] shadow-[inset_0_1px_0_rgba(255,255,255,.35)]">
              <Compass className="h-[18px] w-[18px] transition-transform duration-700 group-hover/logo:rotate-[200deg]" />
            </span>
            <span className="truncate text-base font-bold tracking-tight text-foreground">Founder Compass</span>
          </button>
          <nav ref={tabsInd.ref} className="relative mx-auto hidden gap-1 rounded-2xl bg-black/[.04] p-1 sm:flex" aria-label="Views">
            {tabsInd.box && <span aria-hidden className="tab-indicator absolute left-0 top-0 rounded-xl bg-white/90 shadow-sm" style={{ transform: `translate(${tabsInd.box.x}px, ${tabsInd.box.y}px)`, width: tabsInd.box.w, height: tabsInd.box.h }} />}
            {TABS.map(t => tabButton(t))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5 sm:ml-0">
            <button onClick={() => setPaletteOpen(true)} data-tour="search" aria-label="Search" className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm text-muted-foreground hover:bg-white/70">
              <Search className="h-[18px] w-[18px]" />
              <kbd className="hidden rounded-md border border-black/10 bg-white/80 px-1.5 py-0.5 font-sans text-xs lg:inline">⌘K</kbd>
            </button>
            <ProfileMenu
              name={me ? (me.name?.split(" ")[0] ?? ROLES.find(r => r.key === me.role)?.label ?? "Profile") : null}
              savedCount={saved.length}
              onSaved={() => setParam({ view: "saved", p: null })}
              onEdit={() => setProfileOpen(true)}
            />
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto outline-none max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
        <div key={`${tab}-${mode}`} className="animate-view">
          {tab === "discover" && mode !== "bubbles" && (
            <DiscoverView filters={filters} setFilters={setFilters} profile={me} mode={mode} setMode={setMode} route={params.get("route")} highlight={highlight} {...card} />
          )}
          {tab === "discover" && mode === "bubbles" && (
            <div className="space-y-3">
              <button onClick={() => setMode("campus")} className="text-sm font-semibold text-primary hover:underline">← Back to the map</button>
              <BubbleMap programs={programs} highlight={highlight} onOpen={onOpen} />
            </div>
          )}
          {tab === "ask" && <AdvisorView question={params.get("ask") ?? undefined} about={me ? describeProfile(me) : undefined} />}
          {tab === "calendar" && <ComingUp saved={saved} onOpen={onOpen} />}
          {tab === "saved" && <SavedView saved={saved} {...card} />}
        </div>
      </main>

      {/* Phone tab bar */}
      <TabBar tabs={TABS} active={tab} onSelect={key => setParam({ view: key, p: null })} />

      <footer className="mx-auto max-w-7xl px-4 pb-10 text-xs text-muted-foreground sm:px-6">
        Program details are researched from public sources and change often. Always confirm dates and eligibility on the official page. Spot an error or have an idea? <FeedbackLink label="Send feedback" className="font-normal text-inherit underline hover:text-foreground" />. · <a href="/one-pager" className="underline hover:text-foreground">One-page PDF</a>
      </footer>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        views={[...TABS, { key: "saved", label: "Saved programs", icon: Bookmark }]}
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
