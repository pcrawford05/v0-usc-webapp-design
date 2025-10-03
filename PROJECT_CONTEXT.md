# USC Entrepreneurship Resources Webapp – Checklist

## 1. Front-End / UI
- [x] Main page with **AI Search** and **Basic Search** tabs
- [x] Basic search UI:
  - [x] Keyword search
  - [x] Filters for Resource Type
  - [x] Internal/External toggle
  - [x] Favorites saved in localStorage
  - [x] Graceful handling of missing links
  - [ ] All cards have details appropriate to them
- [x] AI Search UI fully integrated with backend
- [x] Page navigation works correctly
- [ ] UI tested and functioning on Vercel deployment
- [x] Summary then card layout for AI search

---

## 2. Data Integration
- [x] Notion API integration (`scripts/sync-content.ts`)
  - [x] Pulls `Name`, `Resource Type`, `Description?`, `Eligibility?`, `Link?`, `Important Dates?`, `USC/External`
  - [x] Saves data to `data/notion-data.json`
- [ ] Automated update from Notion (daily or real-time)
- [x] Front-end pages reference `notion-data.json` for all searches

---

## 3. Embeddings / AI Backend
- [x] Hugging Face embeddings script (`lib/embeddings.ts`)
  - [x] Fetches embeddings for resources
  - [x] Saves `{ resource, embedding, lastUpdated }` to `data/embeddings.json`
  - [x] Skips resources that already have embeddings
- [x] Fix remaining errors for Hugging Face API requests (404 endpoint fixed)
- [x] Wire AI Search API route to return semantic search results
- [x] Implement caching/reuse of embeddings in memory
- [x] Connect AI Search UI to semantic search API
- [x] Connect AI search to a LLM to output a natural language summary of the resources

---

## 4. Deployment / Automation
- [x] Webapp published on **Vercel**
- [ ] GitHub Actions or other automation to:
  - [ ] Pull latest Notion data daily or on change
  - [ ] Compute new embeddings automatically
  - [ ] Redeploy Vercel if needed

## 5. Key Features to Maintain
All cards have favorite button and description and they don't highlight if they don't have a link
Sub pages in basic search all redirect to basic search

Notes to self:
  Need to test Github action
  After renaming the sync script run `pnpm run content:sync`
  Ensure GitHub Action secrets are configured
  I want the embeddings to only be changed as needed
  There are many UI changes that need to be made.
  Need to watch out for the conversational AI outputting questions at the end
  