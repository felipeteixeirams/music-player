# Robust Error Handling & Fallback for Invalid IDs (Podcasts, Catalog & Radio)

Implement defensive error handling, fallback lookup strategies for podcast IDs, and graceful filtering so that unresolvable or dead podcast IDs, tracks, or radio stations are automatically bypassed or recovered without compromising user experience or app credibility.

---

## 1. Overview & Objectives
- **Problem**: When a podcast ID (or catalog track/radio station) is invalid or fails lookup in a specific region store (e.g. `country=BR`), the server previously threw a hard 404/502 error which could disrupt lists.
- **Solution**:
  1. **Fallback Lookup in `showWithEpisodes`**: If regional iTunes lookup (`country=BR`) fails or returns no results, automatically retry a fallback lookup without country or perform a title search to resolve the correct live feed URL.
  2. **Defensive Filtering in Client (`fetchFeaturedEpisodes`)**: Already uses `Promise.allSettled`, ensuring any unresolvable podcast seed is safely omitted without breaking the UI.
  3. **Graceful UI Fallback**: Empty or failed lists show polite retry states or filter out dead entries cleanly.

---

## 2. Technical Strategy
- **Backend Fallback (`api/_podcasts.ts`)**:
  - In `showWithEpisodes`, if `lookup` yields no results for `id`, perform a secondary fallback query (`ITUNES_SEARCH` with `term`) or search without `country=BR`.
  - If no valid feed can be resolved after fallback, throw a clean handled error or return an empty status rather than an unhandled crash.
- **Client Resilience (`src/utils/podcastClient.ts` & `src/components/PodcastsHome.tsx`)**:
  - Ensure all batch fetches use `Promise.allSettled` and filter out failed promises.
  - Display user-friendly error boundaries and retry actions.

---

## 3. Validation
- Run unit tests (`npm test`), TypeScript type checking (`npm run lint`), and build compilation (`compile_applet`).
