"use client"

import { Check, Copy, ExternalLink, FileText } from "lucide-react"
import { useEffect, useState } from "react"

import { advisorPrompt } from "@/lib/advisor"

// ---------- Advisor ----------
// No chat here: the person takes a short prompt to their own ChatGPT or Claude, which already knows them.
// The prompt only points at /llms.txt, so the assistant reads our facts and nothing else we send.

export function AdvisorView({ question, about }: { question?: string; about?: string }) {
  const [origin, setOrigin] = useState("https://v0-usc-webapp-design.vercel.app")
  const [copied, setCopied] = useState(false)
  useEffect(() => setOrigin(window.location.origin), [])

  const extra = [about && `About me: ${about}.`, question && `My question: ${question}`].filter(Boolean).join(" ")
  const prompt = advisorPrompt(origin, extra)
  const q = encodeURIComponent(prompt)
  const copy = async () => {
    await navigator.clipboard.writeText(prompt).catch(() => undefined)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Ask your own AI</h1>
        <p className="text-sm text-muted-foreground">
          Your ChatGPT or Claude already knows you. This short prompt points it at our list of USC programs and events, and it comes back with your top 5 and one question.
        </p>
      </header>

      <div className="grid gap-2 sm:grid-cols-2">
        <a href={`https://chatgpt.com/?q=${q}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-foreground px-4 py-3.5 text-[15px] font-semibold text-background transition hover:opacity-90">
          Open in ChatGPT <ExternalLink className="h-4 w-4" />
        </a>
        <a href={`https://claude.ai/new?q=${q}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#c96442] px-4 py-3.5 text-[15px] font-semibold text-white transition hover:opacity-90">
          Open in Claude <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      <section className="rounded-2xl border border-black/5 bg-white/80 p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Or paste this anywhere</span>
          <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="select-all rounded-xl bg-black/[.04] p-3 font-mono text-[13px] leading-relaxed text-foreground">{prompt}</p>
      </section>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <FileText className="h-3.5 w-3.5" />
        <a href="/llms.txt" target="_blank" className="underline hover:text-foreground">See exactly what it reads</a>
        {about ? " · Includes what you told us in Personalize." : " · Personalize adds a line about you."}
      </p>
    </div>
  )
}
