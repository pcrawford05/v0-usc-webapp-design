"use client"

import { Bookmark, BookmarkCheck, CalendarDays, ExternalLink, GraduationCap, Sparkles, Users, Wallet } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { AUDIENCE_LABELS, GROUPS, MONTHS, STAGE_LABELS, type Program } from "@/lib/programs"
import { cn } from "@/lib/utils"

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

export function ProgramCard({
  program,
  reason,
  onOpen,
  saved,
  onToggleSave,
}: {
  program: Program
  reason?: string
  onOpen: (id: string) => void
  saved: boolean
  onToggleSave: (id: string) => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(program.id)}
      onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen(program.id))}
      className="group relative flex h-full flex-col rounded-xl border border-border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex items-start justify-between gap-2">
        <GroupPill program={program} />
        <button
          type="button"
          aria-label={saved ? "Remove from saved" : "Save program"}
          onClick={e => (e.stopPropagation(), onToggleSave(program.id))}
          className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-primary"
        >
          {saved ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
        </button>
      </div>
      <h3 className="mt-2 font-semibold leading-snug text-foreground">{program.name}</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">{program.category}</p>
      <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{reason || program.description}</p>
      <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5" />
          <span className="line-clamp-1">{whenLabel(program)}</span>
        </span>
        {program.funding && (
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <Wallet className="h-3.5 w-3.5" />
            <span className="line-clamp-1">{program.funding}</span>
          </span>
        )}
      </div>
    </div>
  )
}

// ---------- Detail drawer ----------

function Field({ icon: Icon, label, children }: { icon: typeof CalendarDays; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-0.5 text-sm text-foreground">{children}</div>
      </div>
    </div>
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
  return (
    <Sheet open={!!program} onOpenChange={open => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-md">
        {program && g && (
          <>
            <div className="px-6 pb-5 pt-8 text-white" style={{ backgroundColor: g.color }}>
              <div className="text-xs font-semibold uppercase tracking-wider opacity-80">{g.label}</div>
              <SheetHeader className="mt-1 space-y-1 text-left">
                <SheetTitle className="text-2xl font-bold leading-tight text-white">{program.name}</SheetTitle>
                <SheetDescription className="text-sm text-white/85">{program.category}</SheetDescription>
              </SheetHeader>
            </div>
            <div className="space-y-5 px-6 py-6">
              {program.description && <p className="text-[15px] leading-relaxed text-foreground">{program.description}</p>}
              <div className="space-y-4">
                <Field icon={CalendarDays} label="When">
                  {whenLabel(program)}
                  {program.months.length > 0 && (
                    <div className="mt-2 flex gap-0.5">
                      {MONTHS.map((m, i) => (
                        <span
                          key={m}
                          title={m}
                          className={cn(
                            "h-1.5 flex-1 rounded-full",
                            program.months.includes(i + 1) ? "bg-primary" : "bg-muted",
                          )}
                        />
                      ))}
                    </div>
                  )}
                </Field>
                {program.eligibility && (
                  <Field icon={Users} label="Who can join">
                    {program.eligibility}
                  </Field>
                )}
                {program.funding && (
                  <Field icon={Wallet} label="Funding">
                    {program.funding}
                  </Field>
                )}
                {(program.audience.length > 0 || program.stage.length > 0) && (
                  <Field icon={GraduationCap} label="Best for">
                    <div className="flex flex-wrap gap-1.5">
                      {program.audience.map(a => (
                        <span key={a} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                          {AUDIENCE_LABELS[a]}
                        </span>
                      ))}
                      {program.stage.map(s => (
                        <span key={s} className="rounded-full border border-border px-2 py-0.5 text-xs">
                          {STAGE_LABELS[s]} stage
                        </span>
                      ))}
                    </div>
                  </Field>
                )}
              </div>
              {program.confidence === "low" && (
                <p className="rounded-lg bg-secondary/25 px-3 py-2 text-xs text-foreground">
                  Some details could not be fully verified. Confirm on the official page before you apply.
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {program.link && (
                  <a
                    href={program.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                  >
                    Official page <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                <button
                  onClick={() => onToggleSave(program.id)}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold transition hover:bg-muted"
                >
                  {saved ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
                  {saved ? "Saved" : "Save"}
                </button>
                <button
                  onClick={() => onAsk(`Tell me more about ${program.name}. Is it a good fit for me and what is similar?`)}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold transition hover:bg-muted"
                >
                  <Sparkles className="h-4 w-4 text-primary" /> Ask AI
                </button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
