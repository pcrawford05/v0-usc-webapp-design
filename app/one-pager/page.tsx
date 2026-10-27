"use client"

import { ArrowLeft, Check, Download, Link2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

const PDF = "/usc-startup-programs.pdf"

export default function OnePager() {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(new URL(PDF, window.location.href).href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="app-bg min-h-screen px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="glass flex flex-wrap items-center gap-3 rounded-3xl px-4 py-3">
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Founder Compass
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold tracking-tight text-foreground">USC Entrepreneurship One-Pager</h1>
            <p className="text-xs text-muted-foreground">Every major program on a single page, ready to share or print.</p>
          </div>
          <button onClick={copy} className="inline-flex items-center gap-2 rounded-2xl glass px-3.5 py-2 text-sm font-semibold hover:bg-white/70">
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Link2 className="h-4 w-4" />}
            {copied ? "Copied" : "Copy link"}
          </button>
          <a
            href={PDF}
            download="USC-Startup-Programs.pdf"
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-br from-[#b3001b] to-[#8a0000] px-3.5 py-2 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3)] hover:brightness-110"
          >
            <Download className="h-4 w-4" /> Download PDF
          </a>
        </div>
        <a href={PDF} target="_blank" rel="noreferrer" className="glass block overflow-hidden rounded-3xl p-2 sm:p-3" aria-label="Open the PDF">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/usc-startup-programs.png" alt="USC Entrepreneurship and Innovation one-page program list" className="block h-auto w-full rounded-2xl" />
        </a>
        <p className="text-xs text-muted-foreground">
          For full details, deadlines and eligibility, use <Link href="/" className="underline">Founder Compass</Link>. Spot an error? Email{" "}
          <a href="mailto:pcrawfor@usc.edu" className="underline">pcrawfor@usc.edu</a>.
        </p>
      </div>
    </div>
  )
}
