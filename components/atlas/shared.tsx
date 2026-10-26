"use client"

import { Bookmark, BookmarkCheck, CalendarDays, ChevronDown, ExternalLink, GraduationCap, ShieldCheck, Users, Wallet } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { advisorOnly } from "@/lib/catalog"
import { AUDIENCE_LABELS, GROUPS, MONTHS, STAGE_LABELS, type Program } from "@/lib/programs"
import { calEntry, nextDeadline } from "@/lib/calendar"
import { programLink } from "@/lib/links"
import { cn } from "@/lib/utils"

import { AddToCalendar, ShareButton } from "./extras"
import { FeedbackLink } from "./Feedback"

// ---------- Saved programs (per browser) ----------

const SAVED_KEY = "atlas:saved"

export function useSaved() {
  const [saved, setSaved] = useState<string[]>([])
  useEffect(() => {
    try {
      setSaved(JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]"))
    } catch {
      /* storage unavailable: start empty */
    }
  }, [])
  const toggle = useCallback((id: string) => {
    setSaved(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      try {
        localStorage.setItem(SAVED_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])
  return { saved, isSaved: (id: string) => saved.includes(id), toggle }
}

// ---------- Small pieces ----------

export function GroupPill({ program, className }: { program: Program; className?: string }) {
  const g = GROUPS[program.group]
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold", className)}
      style={{ backgroundColor: `${g.color}14`, color: g.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: g.color }} />
      {g.short}
    </span>
  )
}

export function whenLabel(p: Program): string {
  if (p.timing && !/^(unknown|not (published|found|specified))/i.test(p.timing)) return p.timing
  if (p.months.length) return p.months.map(m => MONTHS[m - 1]).join(", ")
  return p.cadence === "unknown" ? "Timing not published" : p.cadence[0].toUpperCase() + p.cadence.slice(1)
}

/** The one fact that matters most on a card: when it next opens, else the money, else that it is always on. */
export function keyFact(p: Program): string {
  const now = new Date().getMonth() + 1
  if (p.months.length) {
    const next = [...p.months].sort((a, b) => ((a - now + 12) % 12) - ((b - now + 12) % 12))[0]
    return next === now ? "Open this month" : `Next: ${MONTHS[next - 1]}`
  }
  if (p.funding && p.funding.length <= 48) return p.funding
  return ["rolling", "ongoing", "weekly", "monthly"].includes(p.cadence) ? "Year-round" : "Dates vary"
}

export function ProgramCard({
  program,
  index = 0,
  reason,
  onOpen,
  saved,
  onToggleSave,
}: {
  program: Program
  index?: number
  reason?: string
  onOpen: (id: string) => void
  saved: boolean
  onToggleSave: (id: string) => void
}) {
  const line = reason || (program.description ?? "").split(/(?<=\.)\s/)[0]
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(program.id)}
      onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen(program.id))}
      style={{ "--i": index } as React.CSSProperties}
      className="spotlight animate-rise group relative flex h-full flex-col glass glass-hover rounded-2xl p-4 text-left hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 font-semibold leading-snug text-foreground">{program.name}</h3>
        <button
          type="button"
          aria-label={saved ? "Remove from saved" : "Save program"}
          onClick={e => (e.stopPropagation(), onToggleSave(program.id))}
          className="-mr-1 -mt-1 rounded-md p-2 text-muted-foreground transition hover:bg-muted hover:text-primary sm:p-1"
        >
          {saved ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
        </button>
      </div>
      {line && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{line}</p>}
      <div className="mt-auto flex items-center gap-2 pt-3 text-xs">
        <GroupPill program={program} />
        <span className="truncate font-medium text-foreground/80">{keyFact(program)}</span>
      </div>
    </div>
  )
}

// ---------- Detail drawer ----------

function Section({ icon: Icon, title, open, children }: { icon: typeof CalendarDays; title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="group px-4 py-3">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 shrink-0 text-primary" />
        {title}
        <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
      </summary>
      <div className="mt-2 pl-[26px] text-sm leading-relaxed text-foreground/90">{children}</div>
    </details>
  )
}

export function ProgramDrawer({
  program,
  onClose,
  saved,
  onToggleSave,
  onAsk,
}: {
  program: Program | null
  onClose: () => void
  saved: boolean
  onToggleSave: (id: string) => void
  onAsk: (question: string) => void
}) {
  const g = program ? GROUPS[program.group] : null
  const link = program ? programLink(program) : null
  const support = program ? advisorOnly.filter(x => x.group === program.group && x.id !== program.id).slice(0, 5) : []
  return (
    <Sheet open={!!program} onOpenChange={open => !open && onClose()}>
      <SheetContent side="right" className="glass-strong w-full overflow-y-auto border-0 p-0 sm:max-w-md">
        {program && g && (
          <>
            <div className="px-6 pb-5 pt-8 text-white" style={{ backgroundColor: g.color }}>
              <div className="text-xs font-semibold uppercase tracking-wider opacity-80">{g.label}</div>
              <SheetHeader className="mt-1 space-y-1 text-left">
                <SheetTitle className="text-2xl font-bold leading-tight text-white">{program.name}</SheetTitle>
                <SheetDescription className="text-sm text-white/85">{program.category}</SheetDescription>
              </SheetHeader>
            </div>
            <div className="space-y-4 px-6 py-5">
              {program.description && <p className="text-[15px] leading-relaxed text-foreground">{program.description}</p>}
              <div className="flex flex-wrap gap-1.5 text-xs">
                <span className="rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary">{keyFact(program)}</span>
                <span className="rounded-full bg-black/[.05] px-2.5 py-1">
                  {program.audience.length ? program.audience.map(a => AUDIENCE_LABELS[a]).join(", ") : "Eligibility: check with the program"}
                </span>
              </div>
              <div className="sticky bottom-0 -mx-6 flex flex-nowrap gap-2 border-t border-black/5 bg-white px-6 py-3 sm:static sm:mx-0 sm:flex-wrap sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
                {link && (
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    title={link.specific ? undefined : `This program has no page of its own; this opens the ${link.label.replace(/ page$/, "")} site`}
                    className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 sm:flex-none"
                  >
                    {link.label} <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                <button
                  onClick={() => onToggleSave(program.id)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold transition hover:bg-muted sm:px-4"
                >
                  {saved ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
                  <span className="sr-only sm:not-sr-only">{saved ? "Saved" : "Save"}</span>
                </button>
                {program.months.length > 0 && (
                  <AddToCalendar entry={() => calEntry(nextDeadline(program), window.location.origin)} />
                )}
                <ShareButton url={`${typeof window !== "undefined" ? window.location.origin : ""}/?p=${program.id}`} title={program.name} label="Share" className="py-2" compactLabel />
              </div>

              <div className="divide-y divide-border rounded-2xl border border-border bg-white/60">
                <Section icon={CalendarDays} title="When" open>
                  {whenLabel(program)}
                  {program.months.length > 0 && (
                    <div className="mt-2 flex gap-0.5" aria-label={`Usually ${program.months.map(m => MONTHS[m - 1]).join(", ")}`}>
                      {MONTHS.map((m, i) => (
                        <span key={m} title={m} className={cn("h-1.5 flex-1 rounded-full", program.months.includes(i + 1) ? "bg-primary" : "bg-muted")} />
                      ))}
                    </div>
                  )}
                </Section>
                {(program.eligibility || program.stage.length > 0) && (
                  <Section icon={Users} title="Who can join">
                    {program.eligibility}
                    {program.stage.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {program.stage.map(st => <span key={st} className="rounded-full border border-border px-2 py-0.5 text-xs">{STAGE_LABELS[st]} stage</span>)}
                      </div>
                    )}
                  </Section>
                )}
                {program.funding && <Section icon={Wallet} title="Funding">{program.funding}</Section>}
                {support.length > 0 && (
                  <Section icon={GraduationCap} title={`Support from ${g.short}`}>
                    <p className="text-xs text-muted-foreground">Always-on help you can use alongside this program.</p>
                    <ul className="mt-1.5 space-y-1">
                      {support.map(x => (
                        <li key={x.id}>
                          {x.link ? <a href={x.link} target="_blank" rel="noreferrer" className="hover:text-primary hover:underline">{x.name}</a> : x.name}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
                <Section icon={ShieldCheck} title="Is this right?">
                  {program.confidence === "low" ? "Some details could not be fully verified. " : ""}
                  {program.lastVerified ? `Checked against the official source on ${new Date(program.lastVerified + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}. ` : ""}
                  Confirm dates on the official page before you apply. <FeedbackLink label="Send a correction" program={program} />.
                </Section>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
