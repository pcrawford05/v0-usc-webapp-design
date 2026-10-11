"use client"

import { Bookmark, ChevronDown, ChevronRight, ChevronsUpDown, ExternalLink } from "lucide-react"
import { useMemo, useState } from "react"

import { AUDIENCE_LABELS, GROUPS, GROUP_KEYS, type Program } from "@/lib/programs"
import { cn } from "@/lib/utils"

import { GroupPill, whenLabel } from "./shared"

type GroupBy = "group" | "category" | "none"
type SortKey = "name" | "group" | "category" | "when" | "audience" | "funding"

const COLS: { key: SortKey; label: string; className?: string; get: (p: Program) => string }[] = [
  { key: "name", label: "Program", className: "min-w-[220px]", get: p => p.name },
  { key: "group", label: "Unit", get: p => GROUPS[p.group].short },
  { key: "category", label: "Type", className: "min-w-[150px]", get: p => p.category },
  { key: "when", label: "When", className: "min-w-[170px]", get: p => whenLabel(p) },
  { key: "audience", label: "Who", className: "min-w-[140px]", get: p => p.audience.map(a => AUDIENCE_LABELS[a]).join(", ") },
  { key: "funding", label: "Funding", className: "min-w-[140px]", get: p => p.funding ?? "" },
]

export function ProgramTable({ items, onOpen, isSaved, onToggleSave }: {
  items: Program[]
  onOpen: (id: string) => void
  isSaved: (id: string) => boolean
  onToggleSave: (id: string) => void
}) {
  const [groupBy, setGroupBy] = useState<GroupBy>("group")
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null)
  const [closed, setClosed] = useState<Set<string>>(new Set())

  const sections = useMemo(() => {
    const col = sort && COLS.find(c => c.key === sort.key)!
    const rows = col ? [...items].sort((a, b) => col.get(a).localeCompare(col.get(b)) * sort!.dir) : items
    if (groupBy === "none") return [{ key: "all", label: "All programs", color: undefined as string | undefined, rows }]
    const keys = groupBy === "group" ? GROUP_KEYS : [...new Set(items.map(p => p.category))].sort()
    return keys
      .map(k => ({
        key: k,
        label: groupBy === "group" ? GROUPS[k as keyof typeof GROUPS].label : k,
        color: groupBy === "group" ? GROUPS[k as keyof typeof GROUPS].color : undefined,
        rows: rows.filter(p => (groupBy === "group" ? p.group : p.category) === k),
      }))
      .filter(s => s.rows.length)
  }, [items, groupBy, sort])

  const flip = (k: string) => setClosed(c => { const n = new Set(c); n.has(k) ? n.delete(k) : n.add(k); return n })
  const allClosed = sections.every(s => closed.has(s.key))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Group by</span>
        <select value={groupBy} onChange={e => setGroupBy(e.target.value as GroupBy)} className="rounded-lg glass px-3 py-1.5">
          <option value="group">Unit</option>
          <option value="category">Type</option>
          <option value="none">None</option>
        </select>
        {groupBy !== "none" && (
          <button onClick={() => setClosed(allClosed ? new Set() : new Set(sections.map(s => s.key)))} className="rounded-lg glass px-3 py-1.5 hover:bg-white/70">
            {allClosed ? "Expand all" : "Collapse all"}
          </button>
        )}
      </div>
      <div className="glass overflow-x-auto rounded-2xl">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted-foreground">
            <tr className="border-b border-black/5">
              <th className="w-10" />
              {COLS.map(c => (
                <th key={c.key} className={cn("px-3 py-2.5 font-semibold", c.className)}>
                  <button
                    onClick={() => setSort(s => (s?.key !== c.key ? { key: c.key, dir: 1 } : s.dir === 1 ? { key: c.key, dir: -1 } : null))}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    {c.label}
                    {sort?.key === c.key ? (sort.dir === 1 ? " ↑" : " ↓") : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
                  </button>
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          {sections.map(s => {
            const open = !closed.has(s.key)
            return (
              <tbody key={s.key}>
                {groupBy !== "none" && (
                  <tr className="cursor-pointer border-b border-black/5 bg-white/40 hover:bg-white/60" onClick={() => flip(s.key)}>
                    <td colSpan={COLS.length + 2} className="px-3 py-2 font-semibold">
                      <span className="inline-flex items-center gap-2">
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        {s.color && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />}
                        {s.label}
                        <span className="font-normal text-muted-foreground">{s.rows.length}</span>
                      </span>
                    </td>
                  </tr>
                )}
                {open && s.rows.map(p => (
                  <tr key={p.id} className="cursor-pointer border-b border-black/5 align-top transition hover:bg-white/50" onClick={() => onOpen(p.id)}>
                    <td className="px-2 py-2.5">
                      <button
                        aria-label={isSaved(p.id) ? "Unsave" : "Save"}
                        onClick={e => (e.stopPropagation(), onToggleSave(p.id))}
                        className={cn("rounded p-1 hover:bg-white/70", isSaved(p.id) ? "text-primary" : "text-muted-foreground/50")}
                      >
                        <Bookmark className={cn("h-4 w-4", isSaved(p.id) && "fill-current")} />
                      </button>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-foreground">
                      {p.name}
                      {p.confidence === "low" && <span className="ml-2 rounded bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800">verify</span>}
                    </td>
                    <td className="px-3 py-2.5"><GroupPill program={p} /></td>
                    <td className="px-3 py-2.5 text-muted-foreground">{p.category}</td>
                    <td className="px-3 py-2.5 text-muted-foreground"><span className="line-clamp-2">{whenLabel(p)}</span></td>
                    <td className="px-3 py-2.5 text-muted-foreground"><span className="line-clamp-2">{COLS[4].get(p) || "-"}</span></td>
                    <td className="px-3 py-2.5 text-muted-foreground"><span className="line-clamp-2">{p.funding ?? "-"}</span></td>
                    <td className="px-2 py-2.5">
                      {p.link && (
                        <a href={p.link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} aria-label="Official page" className="text-muted-foreground hover:text-primary">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            )
          })}
        </table>
      </div>
    </div>
  )
}
