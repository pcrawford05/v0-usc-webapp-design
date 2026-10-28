"use client"

import type { LucideIcon } from "lucide-react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

type Tab = { key: string; label: string; icon: LucideIcon }

/**
 * Phone tab bar in the iOS liquid glass style: a floating glass pill with a highlight that slides to the
 * active tab. Press and drag across it and a lens follows the finger; let go to switch. It shrinks while
 * scrolling down and comes back on scroll up.
 */
export function TabBar({ tabs, active, onSelect }: { tabs: readonly Tab[]; active: string; onSelect: (key: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ left: number; width: number } | null>(null)
  const [drag, setDrag] = useState<number | null>(null) // tab under the finger
  const [dragX, setDragX] = useState<number | null>(null) // finger x within the bar
  const [mini, setMini] = useState(false)

  const buttons = () => [...(ref.current?.querySelectorAll<HTMLElement>("[data-tab]") ?? [])]
  const measure = () => {
    const el = buttons().find(b => b.dataset.tab === active)
    setBox(el ? { left: el.offsetLeft, width: el.offsetWidth } : null)
  }
  useLayoutEffect(measure, [active]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps
  // Labels fold away when the bar shrinks, so re-measure once it settles.
  useEffect(() => {
    const t = setTimeout(measure, 320)
    return () => clearTimeout(t)
  }, [mini]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setMini(false), [active])

  useEffect(() => {
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      if (Math.abs(y - last) > 6) {
        setMini(y > last && y > 80)
        last = y
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const relX = (clientX: number) => clientX - (ref.current?.getBoundingClientRect().left ?? 0)
  const tabAt = (clientX: number) => {
    let best = 0
    let dist = Infinity
    buttons().forEach((el, i) => {
      const r = el.getBoundingClientRect()
      const d = Math.abs(clientX - (r.left + r.width / 2))
      if (d < dist) {
        dist = d
        best = i
      }
    })
    return best
  }
  const lens = (() => {
    if (drag == null || dragX == null || !ref.current) return null
    const el = buttons()[drag]
    if (!el) return null
    const w = el.offsetWidth
    return { left: Math.max(4, Math.min(ref.current.clientWidth - w - 4, dragX - w / 2)), width: w }
  })()
  const pill = lens ?? box
  const end = () => {
    setDrag(null)
    setDragX(null)
  }

  return (
    <nav aria-label="Views" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(10px,env(safe-area-inset-bottom))] sm:hidden">
      <div
        ref={ref}
        data-mini={mini && drag == null}
        className="tabbar glass-bar pointer-events-auto relative flex touch-none select-none rounded-full p-1"
        style={{ transform: drag != null ? "scale(1.04)" : undefined }}
        onPointerDown={e => {
          setMini(false)
          setDrag(tabAt(e.clientX))
          setDragX(relX(e.clientX))
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={e => {
          if (drag == null) return
          setDragX(relX(e.clientX))
          const i = tabAt(e.clientX)
          if (i !== drag) {
            setDrag(i)
            navigator.vibrate?.(5)
          }
        }}
        onPointerUp={() => {
          if (drag == null) return
          const key = tabs[drag].key
          end()
          if (key !== active) onSelect(key)
        }}
        onPointerCancel={end}
      >
        {pill && <span aria-hidden className={cn("absolute inset-y-1 rounded-full", drag != null ? "tab-lens" : "tab-slide bg-black/[.07]")} style={{ left: pill.left, width: pill.width }} />}
        {tabs.map((t, i) => {
          const on = drag != null ? drag === i : active === t.key
          return (
            <button
              key={t.key}
              data-tab={t.key}
              data-tour={t.key === "ask" ? "ask" : undefined}
              aria-current={active === t.key ? "page" : undefined}
              // Pointer users switch on release above; this keeps keyboards and screen readers working.
              onClick={e => e.detail === 0 && onSelect(t.key)}
              className={cn("relative flex w-[76px] flex-col items-center justify-center gap-0.5 rounded-full py-1.5 text-xs font-semibold transition-colors", on ? "text-primary" : "text-foreground/70")}
            >
              <t.icon className="h-[22px] w-[22px]" />
              <span className="tab-label overflow-hidden">{t.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
