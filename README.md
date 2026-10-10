# Anistream

A static anime discovery site built with Astro: seasonal browsing, search, weekly broadcast schedules, and anime details. Data is fetched from the public AniList GraphQL API in the browser; no backend, API key, or login is required.

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

The build generates deployable static files in `dist/`, preserving the existing HTML page routes. New detail links use `anime-details.html?anilistId=...`. Old `anime-details.html?id=...` links are treated as MyAnimeList IDs and resolved through AniList's `idMal` field.

## Project Structure

- `src/pages/`: page content, layout props, and page-specific browser scripts
- `src/layouts/BaseLayout.astro`: shared document shell, global styles, and content slots
- `src/components/`: shared metadata, navigation, and footer
- `scripts/`: bundled browser modules and the shared API client
- `styles/`: shared styles bundled by Astro
- `public/`: images and the GitHub Pages custom-domain `CNAME`
- `tests/`: API regression tests using Node's built-in test runner
- `.github/workflows/deploy.yml`: test, build, and deploy workflow

## Learning the Astro Structure

Start with `src/pages/browse.astro`. Its frontmatter imports `BaseLayout`, and the template passes a title, description, active navigation item, and main wrapper class as props. The children inside `<BaseLayout>` appear where the layout renders `<slot />`. This is the equivalent of a Jekyll layout's content placeholder.

`BaseLayout` owns the HTML document and composes `PageHead`, `SiteHeader`, and `SiteFooter`. These are ordinary Astro components, equivalent to reusable includes. Their `Props` interfaces provide editor validation and autocomplete. To change metadata defaults, edit `PageHead`; to change navigation labels or destinations, edit the links array in `SiteHeader`. Canonical and social image URLs use the configured site and base path instead of a hard-coded deployment address.

The named `<slot name="head" />` supports page-specific head additions. For example, a page can put `<meta name="theme-color" content="#16161f" slot="head" />` inside its layout. Avoid duplicating a tag already supplied by `PageHead`.

Code between `---` markers runs during the static build, not in the visitor's browser. The footer year and navigation markup are generated then. Browser behavior belongs in `<script>` blocks: the header initializes its own menu/search modules, and each page initializes only its own data renderer. Astro bundles these imports automatically; a separate all-pages bootstrap is no longer needed. The site intentionally uses ordinary page navigation, not client-side routing.

The shared design remains in the global stylesheets. When adding a self-contained component, its own `<style>` block is scoped by Astro by default. Prefer global styles for shared design rules and scoped styles for component-specific presentation.

AniList is fetched in the browser. An Astro template does not rerender when browser data arrives, so live search and result cards remain browser-rendered. React or another framework is optional, not required for these interactions. Avoid bulk data collection or using AniList as a backup/storage service; consult its terms before designing offline snapshots.

## AniList Integration

All API operations send a JSON `POST` to `https://graphql.anilist.co` with a GraphQL `query` and `variables`. `scripts/api.mjs` selects only the fields needed by the pages and normalizes media into the existing renderer contract: scores become 0-10 values, genres become named objects, HTML descriptions become plain text using parse5, and supported YouTube trailers become embed URLs.

Native AniList IDs and MyAnimeList IDs are not interchangeable. Cards, deduplication, and new links use the native `id`. The normalized `mal_id` is retained only as external identity information. Cache keys use an `anilist_` namespace, so old Jikan payloads cannot be mistaken for AniList records.

Seasonal, upcoming, and search views request at most 50 titles per query. The schedule paginates airing entries for the current Monday-Sunday week in Japan and excludes adult titles. All broadcast dates and times use `Asia/Tokyo` (JST), rather than the visitor's local timezone. Multiple releases of the same anime on different days remain visible.

The client spaces network requests by at least 2.1 seconds to respect the documented degraded limit of 30 requests per minute. It honors `Retry-After` and `X-RateLimit-Reset`, retries HTTP 429/server errors up to two times, and reports GraphQL errors even when HTTP succeeds. Limits are shared with other clients using the same public IP, so throttling can still occur.

Lists and schedules are cached for 15 minutes and details for one hour. These are optional short-lived response caches, not an offline database. No account tracking, authentication, or mutations are implemented.

See the [API guide](https://docs.anilist.co/guide/introduction), [rate limits](https://docs.anilist.co/guide/rate-limiting), and [terms of use](https://docs.anilist.co/guide/terms-of-use). AniList prohibits competing non-complementary anime list/tracker services, hoarding, and backup/storage uses. Commercial use above $150/month requires a license. Review those restrictions before adding tracking features or monetizing the site.

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

Individual requests time out after 15 seconds. Browser storage is optional and cannot block rendering. Identical in-flight requests are deduplicated.

If data does not load, inspect the browser's Network and Console panels for `POST` requests to `https://graphql.anilist.co`. Check the JSON response's `errors` array as well as its HTTP status. HTTP 429 means rate limiting; wait for the indicated reset before reloading. Also check browser extensions, DNS, VPN, and firewall restrictions. GitHub Pages cannot bypass an upstream outage or browser network restrictions.

The previous Jikan public endpoint has been replaced following its announced October 1, 2026 shutdown.
