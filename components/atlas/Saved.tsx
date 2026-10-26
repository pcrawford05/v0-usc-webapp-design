"use client"

import { Bookmark, ChevronDown, UserRound } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { programById, type Program } from "@/lib/programs"
import { cn } from "@/lib/utils"

import { ProgramCard } from "./shared"

type CardProps = { onOpen: (id: string) => void; isSaved: (id: string) => boolean; onToggleSave: (id: string) => void }

/** The profile button opens a small menu: your saved programs, and your profile. */
export function ProfileMenu({ name, savedCount, onSaved, onEdit }: { name: string | null; savedCount: number; onSaved: () => void; onEdit: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("pointerdown", close)
    document.addEventListener("keydown", esc)
    return () => (document.removeEventListener("pointerdown", close), document.removeEventListener("keydown", esc))
  }, [open])
  const pick = (fn: () => void) => () => (setOpen(false), fn())
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Your profile and saved programs"
        className="relative inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#b3001b] to-[#8a0000] px-2.5 py-2 text-sm font-semibold text-white hover:brightness-110 sm:px-3"
      >
        <UserRound className="h-4 w-4" />
        <span className="hidden md:inline">{name ?? "You"}</span>
        <ChevronDown className={cn("hidden h-3.5 w-3.5 transition md:block", open && "rotate-180")} />
        {savedCount > 0 && <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-secondary px-1 text-center text-[10px] leading-[18px] text-secondary-foreground ring-2 ring-white">{savedCount}</span>}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-black/[.08] bg-white p-1 text-sm shadow-[0_16px_40px_-14px_rgba(0,0,0,.4)] animate-pop-in">
          <button role="menuitem" onClick={pick(onSaved)} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left font-medium hover:bg-black/[.04]">
            <Bookmark className="h-4 w-4 text-primary" /> Saved programs
            <span className="ml-auto text-xs text-muted-foreground">{savedCount}</span>
          </button>
          <button role="menuitem" onClick={pick(onEdit)} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left font-medium hover:bg-black/[.04]">
            <UserRound className="h-4 w-4 text-primary" /> {name ? "Edit your profile" : "Personalize"}
          </button>
        </div>
      )}
    </div>
  )
}

/** Your saved programs, kept in this browser. Their dates show up on the Calendar tab. */
export function SavedView({ saved, ...card }: CardProps & { saved: string[] }) {
  const mine = saved.map(id => programById.get(id)).filter(Boolean) as Program[]
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Saved programs</h1>
        <p className="text-sm text-muted-foreground">Kept in this browser. Their deadlines are pinned to the top of the Calendar.</p>
      </div>
      {mine.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {mine.map((p, i) => <ProgramCard key={p.id} index={i} program={p} onOpen={card.onOpen} saved onToggleSave={card.onToggleSave} />)}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Tap the bookmark on any program to keep it here.
        </p>
      )}
    </section>
  )
}
