# Anistream

A static anime catalog built with Astro: seasonal browsing, search, weekly broadcast schedules, and anime details. Data is fetched from the public Jikan API in the browser; no backend or API key is required.

## Development

Requires Node.js 22.12 or newer.

```bash
npm ci
npm run dev
```

Open the local URL printed by Astro. Do not open templates directly with `file://`.

```bash
npm test
npm run build
npm run preview
```

The build generates deployable static files in `dist/`, preserving the existing `index.html`, `browse.html`, `search.html`, `schedule.html`, and `anime-details.html?id=...` URLs.

## Project Structure

- `src/pages/`: Astro page templates
- `scripts/`: bundled browser modules and the shared API client
- `styles/`: shared styles bundled by Astro
- `public/`: images and the GitHub Pages custom-domain `CNAME`
- `tests/`: API regression tests using Node's built-in test runner
- `.github/workflows/deploy.yml`: test, build, and deploy workflow

## GitHub Pages

1. In the repository's **Settings > Pages**, select **GitHub Actions** as the build and deployment source.
2. Keep `anistream.itusebastian.com` configured as the custom domain, with its DNS pointing to GitHub Pages.
3. Push these changes to `main`, or run **Deploy to GitHub Pages** from the Actions tab.

The workflow reads the site's origin and base path from GitHub Pages settings. It uploads only `dist/`. No server adapter or SPA fallback is needed.

To use the default `https://itusebastian.github.io/anistream/` address instead, remove `public/CNAME` and clear the custom domain in Pages settings. To check that configuration locally:

```bash
SITE_URL=https://itusebastian.github.io BASE_PATH=/anistream npm run build
BASE_PATH=/anistream npm run preview
```

## API Troubleshooting

The API client caches lists for two hours and details for 24 hours, deduplicates concurrent requests, spaces network requests, retries HTTP 429 and server errors, and times out individual requests after 15 seconds. Browser storage is optional and cannot block rendering.

If data does not load, inspect the browser's Network and Console panels for requests to `https://api.jikan.moe/v4`. Errors now distinguish HTTP failures from an unreachable API or timeout. Check Jikan's service status and browser extensions, DNS, VPN, or firewall restrictions. A static GitHub Pages site cannot bypass an upstream outage or browser network restrictions.

Browse and schedule currently use the first page of the seasonal endpoint, not the complete catalog. Broadcast times are shown in JST.
