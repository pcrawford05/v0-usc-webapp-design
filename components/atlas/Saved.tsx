"use client"

import { programById, type Program } from "@/lib/programs"

import { ComingUp } from "./ComingUp"
import { ProgramCard } from "./shared"

type CardProps = { onOpen: (id: string) => void; isSaved: (id: string) => boolean; onToggleSave: (id: string) => void }

/** Saved is "your dates": one list of what is coming up at USC, then your saved programs. */
export function SavedView({ saved, ...card }: CardProps & { saved: string[] }) {
  const mine = saved.map(id => programById.get(id)).filter(Boolean) as Program[]

  return (
    <div className="space-y-8">
      <ComingUp saved={saved} onOpen={card.onOpen} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Your saved programs</h2>
        </div>
        {mine.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {mine.map((p, i) => <ProgramCard key={p.id} index={i} program={p} onOpen={card.onOpen} saved onToggleSave={card.onToggleSave} />)}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Tap the bookmark on any program to keep it here, with its deadlines.
          </p>
        )}
      </section>
    </div>
  )
}
