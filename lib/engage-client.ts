// One shared request for /api/events per page load, so the launch screen can warm it
// and the Calendar reads the same result instead of fetching again.

export type LiveEvent = { id: string; title: string; start: string; url: string; host: string; programIds: string[] }

let pending: Promise<LiveEvent[]> | null = null

export function loadEngageEvents(): Promise<LiveEvent[]> {
  pending ??= fetch("/api/events")
    .then(r => (r.ok ? r.json() : { events: [] }))
    .then(d => (d.events ?? []) as LiveEvent[])
    .catch(() => [])
  return pending
}
