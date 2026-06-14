# Anistream

A lightweight static anime catalog web app — browsable grid, search, schedule, and details pages.

## Features

- Browse anime catalog with a responsive grid
- Search and header search across titles
- Episode schedule view
- Individual anime detail pages

## Project Structure

- `index.html` — homepage / hero
- `browse.html` — catalog browsing
- `search.html` — search results
- `schedule.html` — schedule view
- `anime-details.html` — detail page template
- `scripts/` — ES module JavaScript files (e.g. `main.mjs`, `api.mjs`)
- `styles/` — CSS files
- `images/` — static assets

## Usage

Open `index.html` directly in a browser (for simple viewing), or serve the folder with a local static server for module support:

```bash
# Python 3
python3 -m http.server 8000

# Then open http://localhost:8000 in your browser
```

## Development

- JavaScript modules live under `scripts/` and are imported by the HTML pages.
- Edit files and refresh the browser; use a local server to avoid CORS/module issues.

## Contributing

Feel free to open issues or pull requests. Add a `LICENSE` file if you want to set a license.

## Notes

- No build step is required — this is a static site using native ES modules.
