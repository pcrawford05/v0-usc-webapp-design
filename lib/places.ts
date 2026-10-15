import { GROUPS, type GroupKey, type Program } from "@/lib/programs"

// Where each program "lives" on campus. Coordinates are building centroids from OpenStreetMap;
// programs are placed by their home unit, with a few overrides where a program has its own home.

export type CampusKey = "upc" | "hsc"

export interface Place {
  key: string
  name: string
  building: string
  campus: CampusKey
  lat: number
  lng: number
  color: string
}

export const CAMPUSES: Record<CampusKey, { label: string; center: [number, number]; zoom: number }> = {
  upc: { label: "University Park", center: [34.0201, -118.2857], zoom: 17 },
  hsc: { label: "Health Sciences", center: [34.0617, -118.2035], zoom: 17 },
}

export const PLACES: Place[] = [
  { key: "viterbi", name: "Viterbi School of Engineering", building: "Tutor Hall & Olin Hall", campus: "upc", lat: 34.02035, lng: -118.28967, color: GROUPS.viterbi.color },
  { key: "iya", name: "Iovine and Young Academy", building: "Iovine and Young Hall", campus: "upc", lat: 34.01864, lng: -118.28835, color: GROUPS.iya.color },
  { key: "clubs", name: "Student clubs", building: "Ronald Tutor Campus Center", campus: "upc", lat: 34.0204, lng: -118.28635, color: GROUPS.clubs.color },
  { key: "oori", name: "Research & Innovation (OORI)", building: "Bovard Administration", campus: "upc", lat: 34.02103, lng: -118.28558, color: GROUPS.oori.color },
  { key: "across", name: "Across USC", building: "Doheny Library", campus: "upc", lat: 34.02016, lng: -118.28374, color: GROUPS.across.color },
  { key: "law", name: "Gould School of Law clinics", building: "Musick Law Building", campus: "upc", lat: 34.01884, lng: -118.28449, color: "#475569" },
  { key: "joint", name: "Joint programs", building: "Hoffman Hall area", campus: "upc", lat: 34.01879, lng: -118.28521, color: GROUPS.joint.color },
  { key: "marshall", name: "Marshall / Greif Center", building: "Fertitta Hall", campus: "upc", lat: 34.01867, lng: -118.28246, color: GROUPS.marshall.color },
  { key: "keck", name: "Keck MESH & partners", building: "Norris Medical Library", campus: "hsc", lat: 34.06092, lng: -118.20489, color: GROUPS.keck.color },
  { key: "health", name: "Health & life sciences", building: "Keck Hospital area", campus: "hsc", lat: 34.06273, lng: -118.20189, color: GROUPS.health.color },
]

const PLACE_BY_GROUP: Partial<Record<GroupKey, string>> = {
  viterbi: "viterbi", marshall: "marshall", iya: "iya", joint: "joint", oori: "oori",
  keck: "keck", health: "health", clubs: "clubs", across: "across",
}
const OVERRIDES: Record<string, string> = {
  "intellectual-property-and-technology-law-clinic-iptlc": "law",
  "small-business-clinic": "law",
}

/** The campus place for a program, or null for off-campus partners and outside resources. */
export function placeOf(p: Program): string | null {
  return OVERRIDES[p.id] ?? PLACE_BY_GROUP[p.group] ?? null
}
