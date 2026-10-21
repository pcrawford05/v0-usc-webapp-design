import { NextRequest, NextResponse } from "next/server"

// Emails in-app feedback and program corrections to the maintainer through Resend, so users never leave the app.

const TO = process.env.FEEDBACK_TO || "pcrawfor@usc.edu"
const FROM = process.env.FEEDBACK_FROM || "Founder Compass <onboarding@resend.dev>"
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

export async function POST(req: NextRequest) {
  const key = process.env.RESEND_API_KEY
  if (!key) return NextResponse.json({ error: "Feedback isn't set up yet. Please try again later." }, { status: 503 })

  const body = await req.json().catch(() => null)
  // Bots fill every field; people never see this one.
  if (clean(body?.website, 200)) return NextResponse.json({ ok: true })

  const message = clean(body?.message, 5000)
  const email = clean(body?.email, 200)
  const program = clean(body?.program, 200)
  const page = clean(body?.page, 500)
  if (message.length < 3) return NextResponse.json({ error: "Please write a little more." }, { status: 400 })
  if (email && !isEmail(email)) return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 })

  const subject = program ? `Founder Compass correction: ${program}` : "Founder Compass feedback"
  const text = [message, "", program && `Program: ${program}`, email && `From: ${email}`, page && `Page: ${page}`]
    .filter(line => line !== "")
    .join("\n")

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ from: FROM, to: [TO], subject, text, ...(email ? { reply_to: email } : {}) }),
    })
    if (!res.ok) {
      console.error("feedback send failed", res.status, await res.text())
      return NextResponse.json({ error: "Couldn't send right now. Please try again." }, { status: 502 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("feedback send failed", e)
    return NextResponse.json({ error: "Couldn't send right now. Please try again." }, { status: 502 })
  }
}
