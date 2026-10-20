"use client"

import { FileUp, Linkedin, Loader2, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { EMPTY_PROFILE, INTERESTS, ROLES, SCHOOLS, STAGES, type Profile } from "@/lib/profile"
import { cn } from "@/lib/utils"

const KEY = "atlas:profile"

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setProfile({ ...EMPTY_PROFILE, ...JSON.parse(raw) })
    } catch {
      /* storage unavailable */
    }
  }, [])
  const save = useCallback((p: Profile | null) => {
    setProfile(p)
    try {
      if (p) localStorage.setItem(KEY, JSON.stringify(p))
      else localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
  }, [])
  return { profile, save }
}

function Choice<T extends string>({ value, options, onChange, multi }: {
  value: T | T[] | undefined
  options: readonly { key: T; label: string }[]
  onChange: (v: T) => void
  multi?: boolean
}) {
  const on = (k: T) => (multi ? (value as T[] | undefined)?.includes(k) : value === k)
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button
          key={o.key}
          type="button"
          aria-pressed={!!on(o.key)}
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm transition",
            on(o.key) ? "border-transparent bg-primary text-primary-foreground" : "glass hover:bg-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function ProfileDialog({ open, onOpenChange, profile, onSave }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: Profile | null
  onSave: (p: Profile | null) => void
}) {
  const [draft, setDraft] = useState<Profile>(profile ?? EMPTY_PROFILE)
  const [paste, setPaste] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const fieldsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setDraft(profile ?? EMPTY_PROFILE)
      setMsg(null)
      setPaste("")
    }
  }, [open, profile])

  const runImport = async (payload: { text?: string; pdf?: string }) => {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Import failed")
      const p: Profile = data.profile
      setDraft(d => ({
        ...d,
        ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== null && !(Array.isArray(v) && !v.length))),
      }))
      setMsg({ kind: "ok", text: "Imported. Review the details below, then save." })
      setTimeout(() => fieldsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100)
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Import failed" })
    } finally {
      setBusy(false)
    }
  }

  const onFile = (file?: File) => {
    if (!file) return
    if (file.type !== "application/pdf") return setMsg({ kind: "err", text: "Please choose the PDF from LinkedIn's Save to PDF." })
    const reader = new FileReader()
    reader.onload = () => runImport({ pdf: String(reader.result).split(",")[1] })
    reader.readAsDataURL(file)
  }

  const toggleInterest = (k: Profile["interests"][number]) =>
    setDraft(d => ({ ...d, interests: d.interests.includes(k) ? d.interests.filter(x => x !== k) : [...d.interests, k] }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-xl overflow-y-auto rounded-3xl border-0 p-0 glass-strong">
        <div className="space-y-5 p-5 sm:p-6">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-xl">Your founder profile</DialogTitle>
            <DialogDescription>
              Tailors Ask AI, Find my path, Browse and Calendar to you. Saved only in this browser.
            </DialogDescription>
          </DialogHeader>

          <section className="rounded-2xl border border-white/70 bg-white/40 p-4">
            <div className="flex items-center gap-2 font-semibold">
              <Linkedin className="h-4 w-4 text-[#0A66C2]" /> Import from LinkedIn
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              On your LinkedIn profile, open <b>More</b> then <b>Save to PDF</b>, and upload it here. Or paste your About and Experience text.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
              <button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0A66C2] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                Upload LinkedIn PDF
              </button>
            </div>
            <textarea
              value={paste}
              onChange={e => setPaste(e.target.value)}
              placeholder="...or paste your LinkedIn About and Experience here"
              rows={3}
              className="mt-2 w-full resize-y rounded-lg glass px-3 py-2 text-base sm:text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            {paste.trim() && (
              <button
                type="button"
                disabled={busy}
                onClick={() => runImport({ text: paste })}
                className="mt-2 rounded-lg glass px-3 py-1.5 text-sm font-semibold transition hover:bg-muted disabled:opacity-50"
              >
                Read pasted text
              </button>
            )}
            {msg && <p className={cn("mt-2 text-sm", msg.kind === "ok" ? "text-emerald-700" : "text-destructive")}>{msg.text}</p>}
            <p className="mt-2 text-xs text-muted-foreground">Your document is read once by Google Gemini to fill in the fields and is not stored.</p>
          </section>

          <div ref={fieldsRef} className="scroll-mt-4 space-y-4">
            <Field label="I am a">
              <Choice value={draft.role} options={ROLES} onChange={k => setDraft(d => ({ ...d, role: d.role === k ? undefined : k }))} />
            </Field>
            <Field label="My school">
              <Choice value={draft.school} options={SCHOOLS} onChange={k => setDraft(d => ({ ...d, school: d.school === k ? undefined : k }))} />
            </Field>
            <Field label="My venture is">
              <Choice value={draft.stage} options={STAGES} onChange={k => setDraft(d => ({ ...d, stage: d.stage === k ? undefined : k }))} />
            </Field>
            <Field label="I'm looking for">
              <Choice value={draft.interests} options={INTERESTS} onChange={toggleInterest} multi />
            </Field>
            <Field label="What I'm building (optional)">
              <input
                value={draft.venture ?? ""}
                onChange={e => setDraft(d => ({ ...d, venture: e.target.value || undefined }))}
                placeholder="e.g. A wearable that detects early signs of heat stroke"
                maxLength={240}
                className="w-full rounded-lg glass px-3 py-2 text-base sm:text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </Field>
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-white/60 bg-white/70 backdrop-blur-xl px-5 py-3 sm:px-6">
          {profile ? (
            <button type="button" onClick={() => (onSave(null), onOpenChange(false))} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-destructive">
              <X className="h-3.5 w-3.5" /> Clear profile
            </button>
          ) : <span />}
          <button
            type="button"
            onClick={() => (onSave(draft), onOpenChange(false))}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Save profile
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      {children}
    </div>
  )
}
