"use client"

import { Command } from "cmdk"
import { ArrowRight, CornerDownLeft, Filter, Search, Sparkles } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { CATEGORY_COLORS, GROUPS, programs } from "@/lib/programs"
import { rankPrograms } from "@/lib/search"

/** Opens with Cmd/Ctrl+K or "/". One box for jumping to a program, filtering Browse, or asking the AI. */
export function CommandPalette({
  open,
  onOpenChange,
  views,
  onOpen,
  onAsk,
  onFilter,
  onView,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  views: readonly { key: string; label: string; icon: typeof Search }[]
  onOpen: (id: string) => void
  onAsk: (q: string) => void
  onFilter: (q: string) => void
  onView: (key: string) => void
}) {
  const [q, setQ] = useState("")
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName))
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [open, onOpenChange])
  useEffect(() => { if (!open) setQ("") }, [open])

  const hits = useMemo(() => (q.trim() ? rankPrograms(q, 7).map(r => r.program) : programs.filter(p => p.confidence === "high" && p.group !== "external").slice(0, 5)), [q])
  const run = (fn: () => void) => { fn(); onOpenChange(false) }
  const looksLikeQuestion = q.trim().split(/\s+/).length >= 4 || /\?$|^(how|what|where|which|who|can|should|i )/i.test(q.trim())

  const askItem = q.trim() && (
    <Command.Item value="__ask" onSelect={() => run(() => onAsk(q))} className="palette-item">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#b3001b] to-[#7a0000] text-[#FFCC00]"><Sparkles className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Ask the Advisor</span>
        <span className="block truncate text-xs text-muted-foreground">"{q}"</span>
      </span>
      <CornerDownLeft className="h-4 w-4 text-muted-foreground" />
    </Command.Item>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong top-[18%] max-w-xl translate-y-0 gap-0 overflow-hidden rounded-3xl border-0 p-0 [&>button]:hidden">
        <DialogTitle className="sr-only">Search Founder Compass</DialogTitle>
        <Command shouldFilter={false} loop className="flex flex-col">
          <div className="flex items-center gap-3 border-b border-black/5 px-4">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Command.Input value={q} onValueChange={setQ} placeholder="Search programs or ask anything..." className="h-14 flex-1 bg-transparent text-base sm:text-[15px] outline-none placeholder:text-muted-foreground" />
            <kbd className="rounded-md border border-black/10 bg-white/70 px-1.5 py-0.5 text-[11px] text-muted-foreground">esc</kbd>
          </div>
          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            {looksLikeQuestion && askItem}
            <Command.Group heading={q.trim() ? "Programs" : "Popular"} className="palette-group">
              {hits.map(p => (
                <Command.Item key={p.id} value={p.id} onSelect={() => run(() => onOpen(p.id))} className="palette-item">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[p.category] }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{GROUPS[p.group].short} · {p.category}</span>
                  </span>
                  <ArrowRight className="palette-arrow h-4 w-4 text-muted-foreground" />
                </Command.Item>
              ))}
              {q.trim() && !hits.length && <div className="px-3 py-4 text-sm text-muted-foreground">No keyword matches. Try asking the AI instead.</div>}
            </Command.Group>
            {q.trim() ? (
              <Command.Group heading="Actions" className="palette-group">
                {!looksLikeQuestion && askItem}
                <Command.Item value="__filter" onSelect={() => run(() => onFilter(q))} className="palette-item">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-black/5"><Filter className="h-4 w-4" /></span>
                  <span className="flex-1">See all results for "{q}" in Browse</span>
                </Command.Item>
              </Command.Group>
            ) : (
              <>
                <Command.Group heading="Go to" className="palette-group">
                  {views.map(v => (
                    <Command.Item key={v.key} value={`view-${v.key}`} onSelect={() => run(() => onView(v.key))} className="palette-item">
                      <v.icon className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1">{v.label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              </>
            )}
          </Command.List>
          <div className="flex items-center gap-4 border-t border-black/5 px-4 py-2 text-[11px] text-muted-foreground">
            <span><kbd className="font-sans">↑↓</kbd> move</span>
            <span><kbd className="font-sans">↵</kbd> open</span>
            <span className="ml-auto">Answers come only from the USC program catalog</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
