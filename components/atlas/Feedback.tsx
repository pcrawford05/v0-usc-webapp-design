"use client"

import { Check, Loader2 } from "lucide-react"
import { useState } from "react"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

/** Inline link that opens a feedback form and emails it via /api/feedback, without leaving the app. Pass program for corrections. */
export function FeedbackLink({ label, program, className, ariaLabel }: { label: React.ReactNode; program?: { id: string; name: string }; className?: string; ariaLabel?: string }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [email, setEmail] = useState("")
  const [website, setWebsite] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle")
  const [error, setError] = useState("")

  const onOpenChange = (o: boolean) => {
    setOpen(o)
    if (!o && state === "sent") {
      setMessage("")
      setState("idle")
    }
  }

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    setState("sending")
    setError("")
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, email, website, page: window.location.href, program: program ? `${program.name} (${program.id})` : undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Couldn't send right now. Please try again.")
      setState("sent")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send right now. Please try again.")
      setState("idle")
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={ariaLabel} className={cn("font-semibold text-primary hover:underline", className)}>
        {label}
      </button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{program ? `Correct ${program.name}` : "Send feedback"}</DialogTitle>
            <DialogDescription>{program ? "Tell us what's wrong or out of date: dates, eligibility, links or the key contact. A source link helps." : "Ideas, bugs or a missing program. It goes straight to the maintainer."}</DialogDescription>
          </DialogHeader>
          {state === "sent" ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <Check className="h-8 w-8 text-primary" />
              <p className="text-sm">Thanks, it's sent.</p>
              <button onClick={() => onOpenChange(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={send} className="flex flex-col gap-3">
              <textarea
                required
                autoFocus
                value={message}
                onChange={e => setMessage(e.target.value)}
                maxLength={5000}
                rows={5}
                placeholder={program ? "What should change?" : "Your feedback"}
                className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Your email (optional, for a reply)"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
              <input type="text" tabIndex={-1} autoComplete="off" aria-hidden value={website} onChange={e => setWebsite(e.target.value)} className="hidden" />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={state === "sending" || message.trim().length < 3}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {state === "sending" && <Loader2 className="h-4 w-4 animate-spin" />}
                Send
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
