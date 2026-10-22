# EngageSC research (Oct 22, 2026)

EngageSC (engage.usc.edu) runs on CampusGroups. It is USC's official directory of student groups and their events.

## What is public, with no login

| Source | URL | What it holds |
|---|---|---|
| All public events (calendar feed) | `https://engage.usc.edu/ical/usc/ical_usc.ics` | ~1,470 events (upcoming plus recent past): title, organizer, start/end, description, event type, RSVP link. Refreshes hourly (`X-PUBLISHED-TTL:PT1H`). Locations are hidden until sign-in. |
| All public events (RSS) | `https://engage.usc.edu/rss_events` | Same events as RSS. |
| One group's events | `https://engage.usc.edu/ical/usc/ical_club_<clubId>.ics` | Per-group calendar; `clubId` comes from the events JSON. |
| Events as JSON | `https://engage.usc.edu/mobile_ws/v17/mobile_events_list?range=0&limit=N` | eventId, name, dates, category, clubId, clubName, attendee count, picture, tags, URL. 481 upcoming. |
| Group directory | `https://engage.usc.edu/club_signup` | 908 groups with categories (Marshall Student Organization, Viterbi Student Organization, Design Team, Pre-Professional...). |
| Many group pages | `https://engage.usc.edu/<slug>/` | Description, officer names, member and event counts, contact email (e.g. Greif Center, HackSC, MEDesign, Shift SC, USG Startup Fund). |

## What needs a USC NetID login

Some group pages (EISA, VC Academy) and all event locations. Reading these needs Claude in Chrome from a session on Peyton's computer, signed in with his NetID; this cloud session cannot.

## Entrepreneurship signal found today

Public events this semester that map to catalog programs: SHIP Fund launch and info session (TIE Hub), Origin Weekend x Replit, USC Startup Mixer (Viterbi x Marshall), Greif Center open house, Hult Prize info sessions (Brittingham), Bridge Hall Entrepreneurship Open House. Keyword matching alone is noisy, so events must be filtered by organizer.

Entrepreneurship groups on Engage that are not in the catalog yet: Entrepreneurship & Innovation Student Association (EISA), VC Academy, Marshall Outreach Volunteer Entrepreneurs (MOVE), Translational Biotechnology Association, Viterbi Vision Venture, MS Social Entrepreneurship Student Association, USG Social, Recreation/Startup Fund.

24 catalog programs already link to an Engage page.

## How it can update the web app

1. **Live events.** A server route reads the public calendar feed hourly, keeps events whose organizer is a catalog program (or an allowlisted department such as the Greif Center, TIE Hub, Brittingham, IYA), and shows them in Calendar and Browse with RSVP links. The Advisor can then answer "what's happening this week". No data commits needed; the feed is the source of truth.
2. **Freshness.** A club's most recent Engage event date is a reliable "active" signal and catches dead clubs without Instagram.
3. **Discovery.** The weekly research run scans the group directory for entrepreneurship groups not yet in the catalog and proposes them for review.
4. **Source registry.** Add each program's Engage page and per-group feed to `data/sources.json` so weekly runs read them first.
5. **Logged-in details (optional).** Officer contacts and private group pages via Claude in Chrome locally, for the verification emails.

Be a good citizen: read the feeds no more than hourly (their own TTL), link to Engage for RSVP rather than copying it, and do not republish locations or member lists.
