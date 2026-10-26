"use client"

import { BellPlus, Check, Link2, Share2, Sparkles, X } from "lucide-react"
import { useEffect, useLayoutEffect, useState } from "react"

import { loadEngageEvents, type LiveEvent } from "@/lib/engage-client"
import { canRemind, downloadReminders } from "@/lib/reminders"
import { MONTHS, type Program } from "@/lib/programs"
import { shareLink } from "@/lib/share"
import { cn } from "@/lib/utils"

// ---------- Share ----------

/** Copies (or natively shares) a link to exactly what is on screen. */
export function ShareButton({ url, title, label = "Copy link", className, compactLabel }: { url?: string; title: string; label?: string; className?: string; compactLabel?: boolean }) {
  const [state, setState] = useState<"idle" | "done">("idle")
  const go = async () => {
    const r = await shareLink(url ?? window.location.href, title)
    if (r !== "failed") {
      setState("done")
      setTimeout(() => setState("idle"), 1800)
    }
  }
  return (
    <button
      onClick={go}
      className={cn(
        "relative inline-flex items-center gap-1.5 overflow-hidden rounded-full px-3 py-1.5 text-[13px] font-semibold transition-all duration-300",
        state === "done" ? "bg-emerald-600 text-white" : "bg-foreground text-background hover:-translate-y-px hover:shadow-lg",
        className,
      )}
    >
      <span key={state} className="inline-flex items-center gap-1.5 animate-pop-in">
        {state === "done" ? <Check className="h-3.5 w-3.5" /> : typeof navigator !== "undefined" && "share" in navigator ? <Share2 className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
        <span className={cn(state !== "done" && compactLabel && "sr-only sm:not-sr-only")}>{state === "done" ? "Link ready to send" : label}</span>
      </span>
    </button>
  )
}

// ---------- Reminders ----------

export function RemindButton({ program, compact }: { program: Program; compact?: boolean }) {
  const [done, setDone] = useState(false)
  if (!canRemind(program)) return null
  const go = (e: React.MouseEvent) => {
    e.stopPropagation()
    downloadReminders([program], `${program.id}-reminder.ics`)
    setDone(true)
    setTimeout(() => setDone(false), 2200)
  }
  const when = program.months.map(m => MONTHS[m - 1]).join(", ")
  return compact ? (
    <button type="button" onClick={go} aria-label={`Remind me before ${when}`} title={`Add a calendar reminder 2 weeks before ${when}`} className="rounded-md p-2 text-muted-foreground transition hover:bg-muted hover:text-primary sm:p-1">
      {done ? <Check className="h-4 w-4 text-emerald-600" /> : <BellPlus className="h-4 w-4" />}
    </button>
  ) : (
    <button onClick={go} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold transition hover:bg-muted sm:px-4">
      {done ? <Check className="h-4 w-4 text-emerald-600" /> : <BellPlus className="h-4 w-4" />}
      <span className={cn(!done && "sr-only sm:not-sr-only")}>{done ? "Open the file to add it" : "Remind me"}</span>
    </button>
  )
}

// ---------- Live events from EngageSC ----------

/** Dated events posted on EngageSC by catalog groups, refreshed daily by /api/events. */
export function EngageEvents({ onOpen }: { onOpen: (id: string) => void }) {
  const [events, setEvents] = useState<LiveEvent[] | null>(null)
  useEffect(() => {
    loadEngageEvents().then(setEvents)
  }, [])
  if (!events?.length) return null
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" })
  return (
    <section className="rounded-2xl glass p-4">
      <header className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">Live on EngageSC</h3>
        <span className="text-xs text-muted-foreground">Next 60 days, updated daily</span>
      </header>
      <ul className="divide-y divide-border">
        {events.map(e => (
          <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
            <span className="w-40 shrink-0 text-muted-foreground">{fmt(e.start)}</span>
            <span className="min-w-0 flex-1 font-medium">{e.title}</span>
            {e.programIds[0] ? (
              <button onClick={() => onOpen(e.programIds[0])} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
                {e.host}
              </button>
            ) : (
              <span className="text-xs text-muted-foreground">{e.host}</span>
            )}
            <a href={e.url} target="_blank" rel="noreferrer" className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
              RSVP on Engage
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---------- First-visit tour ----------

const STEPS = [
  { target: "search", title: "Search everything", body: "Type anything: grants, biotech, pitch, co-founder. Press ⌘K from anywhere." },
  { target: "filters", title: "Narrow it down", body: "Filter by who you are, your stage, your school, or what is open now. Every view has its own shareable link." },
  { target: "ask", title: "Talk to the Advisor", body: "Tell it about yourself and get advice like you would from a mentor, drawn only from real USC programs." },
]
const TOUR_KEY = "compass:toured"

export function Tour() {
  const [step, setStep] = useState(-1)
  const [box, setBox] = useState<DOMRect | null>(null)
  useEffect(() => {
    try {
      if (!localStorage.getItem(TOUR_KEY) && window.innerWidth >= 640) setTimeout(() => setStep(0), 900)
    } catch { /* ignore */ }
  }, [])
  useLayoutEffect(() => {
    if (step < 0) return
    const place = () => setBox(document.querySelector(`[data-tour="${STEPS[step].target}"]`)?.getBoundingClientRect() ?? null)
    place()
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => (window.removeEventListener("resize", place), window.removeEventListener("scroll", place, true))
  }, [step])
  const end = () => {
    setStep(-1)
    try { localStorage.setItem(TOUR_KEY, "1") } catch { /* ignore */ }
  }
  if (step < 0 || !box) return null
  const s = STEPS[step]
  const left = Math.min(Math.max(12, box.left), window.innerWidth - 332)
  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      <div className="absolute rounded-2xl border-[3px] border-primary/70 transition-all duration-500 ease-out animate-tour-ring" style={{ left: box.left - 6, top: box.top - 6, width: box.width + 12, height: box.height + 12 }} />
      <div key={step} className="pointer-events-auto absolute w-80 rounded-2xl glass-strong p-4 shadow-2xl animate-pop-in" style={{ left, top: box.bottom + 14 }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground"><Sparkles className="h-4 w-4 text-primary" /> {s.title}</div>
          <button onClick={end} aria-label="Close tour" className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1">{STEPS.map((_, i) => <span key={i} className={cn("h-1.5 rounded-full transition-all duration-300", i === step ? "w-5 bg-primary" : "w-1.5 bg-foreground/20")} />)}</div>
          <button onClick={() => (step < STEPS.length - 1 ? setStep(step + 1) : end())} className="rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110">
            {step < STEPS.length - 1 ? "Next" : "Got it"}
          </button>
        </div>
      </div>
    </div>
  )
}
