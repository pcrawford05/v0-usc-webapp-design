"use client"

import { useEffect, useState } from "react"

import { loadEngageEvents } from "@/lib/engage-client"

// Plays on every cold open (a full page load). It is rendered on the server so it covers the first paint,
// and it lives in the root layout, so tab switches and client navigation never replay it.
// Timing: the animation needs ~1.4s; we lift once the app is ready but never earlier than that, and never
// later than 3s. Under reduced motion the mark appears without spinning and lifts after 0.6s.
const MIN_MS = 1400
const MIN_REDUCED_MS = 600
const MAX_MS = 3000
const FADE_MS = 320

export function LaunchScreen() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show")

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
    // Warm what the first screens need while the mark plays: fonts and the live Engage events.
    const ready = Promise.all([document.fonts?.ready, loadEngageEvents()]).catch(() => undefined)
    let done = false
    const lift = () => {
      if (done) return
      done = true
      setPhase("fade")
      setTimeout(() => setPhase("gone"), FADE_MS)
    }
    Promise.all([wait(reduced ? MIN_REDUCED_MS : MIN_MS), ready]).then(lift)
    const cap = setTimeout(lift, MAX_MS)
    return () => clearTimeout(cap)
  }, [])

  if (phase === "gone") return null
  return (
    <div
      aria-hidden
      className="launch fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5"
      style={{ opacity: phase === "fade" ? 0 : 1, transition: `opacity ${FADE_MS}ms ease` }}
    >
      <svg viewBox="0 0 512 512" className="launch-tile h-28 w-28 rounded-[26px] shadow-xl">
        <rect width="512" height="512" fill="#990000" />
        <circle className="launch-ring" cx="256" cy="256" r="160" fill="none" stroke="#FFCC00" strokeWidth="22" pathLength={1} />
        <g className="launch-ticks" fill="#FFCC00">
          <rect x="246" y="70" width="20" height="40" rx="5" />
          <rect x="246" y="402" width="20" height="40" rx="5" />
          <rect x="70" y="246" width="40" height="20" rx="5" />
          <rect x="402" y="246" width="40" height="20" rx="5" />
        </g>
        <g className="launch-needle">
          <polygon points="229,239 335,143 284,274" fill="#FFCC00" />
          <polygon points="229,239 284,274 177,369" fill="#FFFFFF" />
          <circle cx="256" cy="256" r="19" fill="#FFCC00" />
          <circle cx="256" cy="256" r="10" fill="#990000" />
        </g>
      </svg>
      <div className="launch-word text-center">
        <div className="text-xl font-bold tracking-tight">Founder Compass</div>
        <div className="mt-1 text-sm opacity-60">Every USC startup program</div>
      </div>
    </div>
  )
}
