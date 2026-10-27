"use client"

import { CalendarDays, CalendarPlus, Check, Link2, Share2, Sparkles, X } from "lucide-react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"

import { googleCalendarUrl, openInAppleCalendar, type CalEntry } from "@/lib/calendar"
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
        "relative inline-flex items-center gap-1.5 overflow-hidden rounded-full px-3 py-1.5 text-xs font-semibold transition duration-300",
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

// ---------- Add to calendar ----------

/** One button that offers Google Calendar or Apple Calendar for an event or a deadline. */
export function AddToCalendar({ entry, compact, className }: { entry: () => CalEntry; compact?: boolean; className?: string }) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("pointerdown", close)
    document.addEventListener("keydown", esc)
    return () => (document.removeEventListener("pointerdown", close), document.removeEventListener("keydown", esc))
  }, [open])
  const finish = () => {
    setOpen(false)
    setDone(true)
    setTimeout(() => setDone(false), 2000)
  }
  return (
    <div ref={ref} className={cn("relative", className)} onClick={e => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Add to calendar"
        className={cn(
          "inline-flex items-center gap-2 font-semibold transition",
          compact ? "rounded-lg p-2.5 text-muted-foreground hover:bg-black/[.05] hover:text-primary" : "rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted sm:px-4",
        )}
      >
        {done ? <Check className="h-4 w-4 text-emerald-600" /> : <CalendarPlus className="h-4 w-4" />}
        {!compact && <span className="sr-only sm:not-sr-only">Add to calendar</span>}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-xl border border-black/[.08] bg-white p-1 text-sm shadow-[0_12px_32px_-12px_rgba(0,0,0,.35)] animate-pop-in">
          <a
            role="menuitem"
            href={googleCalendarUrl(entry())}
            target="_blank"
            rel="noreferrer"
            onClick={finish}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 font-medium hover:bg-black/[.04]"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded bg-[#4285F4] text-xs font-bold text-white">G</span>
            Google Calendar
          </a>
          <button
            role="menuitem"
            onClick={() => (openInAppleCalendar(entry()), finish())}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left font-medium hover:bg-black/[.04]"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded bg-[#FF3B30] text-white"><CalendarDays className="h-3 w-3" /></span>
            Apple Calendar
          </button>
        </div>
      )}
    </div>
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
      <div className="absolute rounded-2xl border-[3px] border-primary/70 transition duration-500 ease-out animate-tour-ring" style={{ left: box.left - 6, top: box.top - 6, width: box.width + 12, height: box.height + 12 }} />
      <div key={step} className="pointer-events-auto absolute w-80 rounded-2xl glass-strong p-4 shadow-2xl animate-pop-in" style={{ left, top: box.bottom + 14 }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground"><Sparkles className="h-4 w-4 text-primary" /> {s.title}</div>
          <button onClick={end} aria-label="Close tour" className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1">{STEPS.map((_, i) => <span key={i} className={cn("h-1.5 rounded-full transition duration-300", i === step ? "w-5 bg-primary" : "w-1.5 bg-foreground/20")} />)}</div>
          <button onClick={() => (step < STEPS.length - 1 ? setStep(step + 1) : end())} className="rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110">
            {step < STEPS.length - 1 ? "Next" : "Got it"}
          </button>
        </div>
      </div>
    </div>
  )
}
