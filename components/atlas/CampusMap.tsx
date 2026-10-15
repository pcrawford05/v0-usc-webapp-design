"use client"

import "leaflet/dist/leaflet.css"

import { ArrowLeft, Globe2, MapPin } from "lucide-react"
import type { Map as LMap, Marker } from "leaflet"
import { useEffect, useMemo, useRef, useState } from "react"

import { CAMPUSES, PLACES, placeOf, type CampusKey } from "@/lib/places"
import { CATEGORY_COLORS, type Category, type Program } from "@/lib/programs"
import { cn } from "@/lib/utils"

import { whenLabel } from "./shared"

const OFF = "off"

/** Frame every pin on a campus, leaving room for the labels under them. */
function fit(L: typeof import("leaflet"), m: LMap, c: CampusKey, animate = false) {
  const pts = PLACES.filter(p => p.campus === c).map(p => [p.lat, p.lng] as [number, number])
  const opts = { padding: [70, 70] as [number, number], maxZoom: 18 }
  if (animate) m.flyToBounds(L.latLngBounds(pts), { ...opts, duration: 0.8 })
  else m.fitBounds(L.latLngBounds(pts), opts)
}

export function CampusMap({ programs, highlight, onOpen }: { programs: Program[]; highlight: Set<string> | null; onOpen: (id: string) => void }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<LMap | null>(null)
  const markers = useRef(new Map<string, Marker>())
  const [ready, setReady] = useState(false)
  const [campus, setCampus] = useState<CampusKey>("upc")
  const [selected, setSelected] = useState<string | null>(null)
  const [cat, setCat] = useState<Category | null>(null)

  const visible = useMemo(() => (highlight ? programs.filter(p => highlight.has(p.id)) : programs), [programs, highlight])
  const byPlace = useMemo(() => {
    const m = new Map<string, Program[]>()
    for (const p of visible) {
      const k = placeOf(p) ?? OFF
      m.set(k, [...(m.get(k) ?? []), p])
    }
    return m
  }, [visible])

  // Create the map once. Leaflet touches window, so it loads only in the browser.
  useEffect(() => {
    let cancelled = false
    import("leaflet").then(L => {
      if (cancelled || !el.current || map.current) return
      const m = L.map(el.current, { zoomControl: false, scrollWheelZoom: false, attributionControl: true }).setView(CAMPUSES.upc.center, CAMPUSES.upc.zoom)
      L.control.zoom({ position: "bottomright" }).addTo(m)
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        className: "atlas-tiles",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m)
      m.on("click", () => setSelected(null))
      fit(L, m, "upc")
      map.current = m
      setReady(true)
    })
    return () => {
      cancelled = true
      map.current?.remove()
      map.current = null
      markers.current.clear()
    }
  }, [])

  // Redraw pins whenever counts, selection or search change.
  useEffect(() => {
    if (!ready || !map.current) return
    import("leaflet").then(L => {
      const m = map.current!
      for (const place of PLACES) {
        const n = byPlace.get(place.key)?.length ?? 0
        const size = Math.round(30 + Math.sqrt(n) * 7)
        const html = `<div class="atlas-pin${n ? "" : " is-empty"}${selected === place.key ? " is-selected" : ""}" style="--c:${place.color};--s:${size}px">
            <span class="atlas-pin-dot">${n}</span><span class="atlas-pin-label">${place.name}</span></div>`
        const icon = L.divIcon({ html, className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
        let mk = markers.current.get(place.key)
        if (!mk) {
          mk = L.marker([place.lat, place.lng], { icon, keyboard: true, title: place.name, riseOnHover: true }).addTo(m)
          mk.on("click", e => {
            L.DomEvent.stopPropagation(e)
            setSelected(place.key)
            setCat(null)
          })
          markers.current.set(place.key, mk)
        } else mk.setIcon(icon)
        mk.setZIndexOffset(selected === place.key ? 1000 : n)
      }
    })
  }, [ready, byPlace, selected])

  const goCampus = (c: CampusKey) => {
    setCampus(c)
    setSelected(null)
    import("leaflet").then(L => map.current && fit(L, map.current, c, true))
  }

  const place = PLACES.find(p => p.key === selected)
  const here = selected ? byPlace.get(selected) ?? [] : []
  const cats = [...new Set(here.map(p => p.category))].sort()
  const list = cat ? here.filter(p => p.category === cat) : here

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="relative h-[460px] overflow-hidden rounded-3xl glass sm:h-[620px]">
        <div ref={el} className="absolute inset-0 z-0" aria-label="Map of USC campuses" />
        <div className="absolute left-3 top-3 z-[500] flex gap-1 rounded-2xl glass-strong p-1">
          {(Object.keys(CAMPUSES) as CampusKey[]).map(c => (
            <button
              key={c}
              onClick={() => goCampus(c)}
              aria-pressed={campus === c}
              className={cn("rounded-xl px-3 py-1.5 text-sm font-semibold transition", campus === c ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground/70 hover:text-foreground")}
            >
              {CAMPUSES[c].label}
            </button>
          ))}
        </div>
        <p className="pointer-events-none absolute bottom-3 left-3 z-[500] hidden rounded-xl glass-strong px-3 py-1.5 text-xs text-muted-foreground sm:block">
          Pins sit at each program's home building. Tap one to see what runs there.
        </p>
      </div>

      <aside className="flex max-h-[620px] flex-col overflow-hidden rounded-3xl glass">
        {selected ? (
          <>
            <div className="border-b border-white/60 p-4">
              <button onClick={() => setSelected(null)} className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3.5 w-3.5" /> All places
              </button>
              <h3 className="text-lg font-bold leading-tight">{place?.name ?? "Off campus & online"}</h3>
              <p className="text-xs text-muted-foreground">
                {place ? `${place.building} · ` : ""}
                {here.length} program{here.length === 1 ? "" : "s"}
              </p>
              {cats.length > 1 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {cats.map(c => (
                    <button
                      key={c}
                      onClick={() => setCat(cat === c ? null : c)}
                      aria-pressed={cat === c}
                      className={cn("rounded-full px-2.5 py-1 text-xs font-medium transition", cat === c ? "text-white" : "bg-white/60 text-foreground/80 hover:bg-white")}
                      style={cat === c ? { backgroundColor: CATEGORY_COLORS[c] } : undefined}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <ul className="flex-1 space-y-1 overflow-y-auto p-2">
              {list.map(p => (
                <li key={p.id}>
                  <button onClick={() => onOpen(p.id)} className="w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/70">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[p.category] }} />
                      <span className="text-sm font-semibold leading-snug">{p.name}</span>
                    </div>
                    <div className="ml-4 line-clamp-1 text-xs text-muted-foreground">{p.category} · {whenLabel(p)}</div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <div className="border-b border-white/60 p-4">
              <h3 className="text-lg font-bold">Places</h3>
              <p className="text-xs text-muted-foreground">{highlight ? `${visible.length} matching programs` : "Where entrepreneurship happens at USC"}</p>
            </div>
            <ul className="flex-1 space-y-1 overflow-y-auto p-2">
              {[...PLACES.map(p => ({ key: p.key, name: p.name, sub: `${p.building} · ${CAMPUSES[p.campus].label}`, color: p.color, campus: p.campus as CampusKey | null })),
                { key: OFF, name: "Off campus & online", sub: "Partners and outside founder resources", color: "#3E4A52", campus: null }]
                .map(row => ({ ...row, n: byPlace.get(row.key)?.length ?? 0 }))
                .sort((a, b) => b.n - a.n)
                .map(row => (
                  <li key={row.key}>
                    <button
                      disabled={!row.n}
                      onClick={() => {
                        if (row.campus && row.campus !== campus) goCampus(row.campus)
                        const pl = PLACES.find(p => p.key === row.key)
                        if (pl) map.current?.flyTo([pl.lat, pl.lng], 18, { duration: 0.8 })
                        setSelected(row.key)
                        setCat(null)
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-white/70 disabled:opacity-40"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: row.color }}>
                        {row.key === OFF ? <Globe2 className="h-4 w-4" /> : row.n}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold leading-tight">{row.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {row.key === OFF ? `${row.n} · ` : <MapPin className="mr-0.5 inline h-3 w-3" />}
                          {row.sub}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </>
        )}
      </aside>
    </div>
  )
}
