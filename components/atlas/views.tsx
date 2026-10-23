"use client"

import { ArrowUp, Compass } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import type { RoutePlan } from "@/lib/ai"
import { encodeRoute } from "@/lib/network"
import { GROUPS, programById } from "@/lib/programs"

import { Itinerary, SubwayMap } from "./Subway"

type CardProps = { onOpen: (id: string) => void; isSaved: (id: string) => boolean; onToggleSave: (id: string) => void; onAsk?: (q: string) => void }

// ---------- Ask AI ----------

export interface Turn {
  role: "user" | "assistant"
  content: string
  picks?: { id: string; reason: string }[]
  plan?: RoutePlan
  provider?: string
}

const SUGGESTIONS = [
  "I'm a sophomore with an app idea but no team. Where should I start?",
  "I'm a PhD student and my lab research might be a company",
  "We have a prototype and need our first $10K",
  "What's happening this week for founders?",
  "Plan my next 6 months",
]

export function AskView({
  turns,
  busy,
  onSend,
  ...card
}: CardProps & { turns: Turn[]; busy: boolean; onSend: (q: string) => void }) {
  const [input, setInput] = useState("")
  const [mapFor, setMapFor] = useState<number | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const send = (q: string) => {
    if (!q.trim() || busy) return
    onSend(q)
    setInput("")
  }
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [turns.length, busy])

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <div className="space-y-4">
        {/* The advisor opens the conversation, so the page reads as a chat, not a search box. */}
        <Bubble>
          Hi, I'm the Founder Compass advisor. I know every USC entrepreneurship program, club and resource. Tell me a bit about you: your year or role, what you're building, and where you're stuck.
        </Bubble>
        {turns.length === 0 && (
          <div className="flex flex-wrap gap-2 pl-10">
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => send(s)} className="rounded-full border border-black/10 bg-white/70 px-3.5 py-2 text-left text-sm transition hover:border-primary/40 hover:bg-white">
                {s}
              </button>
            ))}
          </div>
        )}
        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="flex justify-end animate-pop-in">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground">{t.content}</div>
            </div>
          ) : (
            <div key={i} className="space-y-2">
              <Bubble>{t.content}</Bubble>
              {t.picks && t.picks.length > 0 && (
                <div className="space-y-1.5 pl-10">
                  {t.picks.map(p => {
                    const prog = programById.get(p.id)
                    if (!prog) return null
                    return (
                      <button key={p.id} onClick={() => card.onOpen(p.id)} className="flex w-full items-start gap-3 rounded-xl border border-black/5 bg-white/70 px-3 py-2.5 text-left transition hover:bg-white">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: GROUPS[prog.group].color }} />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-foreground">{prog.name}</span>
                          {p.reason && <span className="block text-xs text-muted-foreground">{p.reason}</span>}
                        </span>
                      </button>
                    )
                  })}
                  {t.plan && (
                    <button onClick={() => setMapFor(mapFor === i ? null : i)} className="text-xs font-semibold text-primary hover:underline">
                      {mapFor === i ? "Hide the map" : "See this as a route on the subway map"}
                    </button>
                  )}
                </div>
              )}
              {t.plan && mapFor === i && (
                <div className="space-y-3 pl-10 animate-pop-in">
                  <Itinerary route={t.plan} onOpen={card.onOpen} />
                  <SubwayMap route={t.plan} onOpen={card.onOpen} compact />
                  <a href={`?view=explore&mode=subway&route=${encodeRoute(t.plan)}`} className="inline-block text-xs font-semibold text-primary hover:underline">
                    Open on the full map
                  </a>
                </div>
              )}
              {t.provider === "local" && <p className="pl-10 text-xs text-muted-foreground">The advisor is offline right now, so these are keyword matches.</p>}
            </div>
          ),
        )}
        {busy && (
          <div className="flex items-center gap-2 pl-10 text-sm text-muted-foreground">
            <span className="inline-flex gap-1">
              {[0, 1, 2].map(k => <span key={k} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: `${k * 120}ms` }} />)}
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={e => (e.preventDefault(), send(input))} className="sticky bottom-3 mt-6 flex items-center gap-2 rounded-2xl border border-black/5 bg-white p-2 shadow-xl sm:bg-white/80 sm:backdrop-blur-xl">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={turns.length ? "Reply..." : "Tell the advisor about you..."}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-base outline-none sm:text-sm"
          aria-label="Message the advisor"
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="shrink-0 rounded-xl bg-primary p-3 text-primary-foreground transition hover:opacity-90 disabled:opacity-40 sm:p-2.5">
          <ArrowUp className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
}

function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 animate-pop-in">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#b3001b] to-[#7a0000] text-[#FFCC00]">
        <Compass className="h-3.5 w-3.5" />
      </span>
      <div className="max-w-[88%] whitespace-pre-line rounded-2xl rounded-tl-md glass px-4 py-3 leading-relaxed text-foreground">{children}</div>
    </div>
  )
}
