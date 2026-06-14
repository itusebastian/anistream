import { fetchCurrentAnime } from "./api.mjs";
import { escapeHTML, getAnimeImageUrl, getAnimeTitle, createGenreTagsHTML, getCurrentSeasonTitle, removeDuplicates } from "./utils.mjs";

/**
 * Initializes the browse catalog page.
 * Fetches seasonal anime data, sets up filter and sort listeners, 
 * handles data deduplication, caching, and dynamically renders results.
 */
export async function initBrowseCatalog() {
  // --- DOM Element Selection ---
  const grid = document.getElementById('animeGrid');
  const filterSource = document.getElementById('filterSource'); // Dropdown for source material (Manga, Original, etc.)
  const filterGenre = document.getElementById('filterGenre');   // Dropdown for genres (Action, Romance, etc.)
  const filterSort = document.getElementById('filterSort');     // Dropdown for sorting order
  const mainTitle = document.getElementById('browseTitle');

  // Guard clause: Exit if the required layout elements are missing on the current page
  if (!grid || !filterSource || !filterGenre || !filterSort) return;

  // Dynamically update the page heading to the current season (e.g., "Spring 2026")
  if (mainTitle) {
    mainTitle.textContent = getCurrentSeasonTitle();
  }

  // Holds the master list of clean, unique anime data returned from the API
  let liveAnimeData = [];

  try {
    // 1. Fetch data from the Jikan/MAL API wrapper
    const rawAnimeData = await fetchCurrentAnime();

    if (!rawAnimeData || !rawAnimeData.length) {
        throw new Error("No live seasonal catalog data was retrieved.");
    }

    // 2. Remove duplicate anime items from the API response before rendering
    liveAnimeData = removeDuplicates(rawAnimeData, anime => anime.mal_id);

    // 3. Event Binding: Trigger the filtering pipeline whenever a dropdown changes
    filterSource.addEventListener('change', applyFilters);
    filterGenre.addEventListener('change', applyFilters);
    filterSort.addEventListener('change', applyFilters);

    // 4. Initial Render: Display all unique cards on page load
    renderCards(liveAnimeData);

  } catch (error) {
     // Error handling: Log error and show a user-friendly error state in the UI grid
     console.error("Failed to load browse catalog components from API:", error);
     grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: rgba(255,255,255,0.4); padding: 40px 0;">Unable to render current season. Please reload the page.</p>';
  }

  /**
   * Generates HTML cards for a given array of anime objects and appends them to the grid.
   * @param {Array} data - The array of filtered/sorted anime items to render.
   */
  function renderCards(data) {
    // Clear out any existing HTML content in the grid
    grid.innerHTML = '';
    
    data.forEach((anime) => {
      // Extract properties safely using utility helper functions
      const title = getAnimeTitle(anime);
      const imageUrl = getAnimeImageUrl(anime);
      const rating = anime.score ? anime.score.toFixed(2) : "N/A";
      
      // Extract and fallback values for UI badges
      const sourceMaterial = anime.source || "Original";
      const studio = anime.studios && anime.studios.length > 0 ? anime.studios[0].name : "Unknown Studio";
      const genreBadgesHTML = createGenreTagsHTML(anime.genres);

      // Create a container wrapper for the individual card
      const card = document.createElement('div');
      card.className = 'anime-card';
      
      // Construct the internal card layout
      card.innerHTML = `
        <a href="anime-details.html?id=${anime.mal_id}" class="anime-card-link-wrapper">
          <div class="anime-card-image-wrapper">
            <img
              src="${imageUrl}"
              alt="${escapeHTML(title)}"
              class="card-image"
              loading="lazy"
            >
            <span class="browse-format-badge">${escapeHTML(sourceMaterial)}</span>
            <div class="card-overlay">
              <div class="genre-tags">
                ${genreBadgesHTML}
              </div>
              <div class="browse-overlay-meta">
                <span class="browse-studio-text">${escapeHTML(studio)}</span>
                <div class="browse-rating-row">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="star-icon"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>
                  <span>${rating}</span>
                </div>
              </div>
            </div>
          </div>
        </a>
        <h3 class="browse-card-title">${escapeHTML(title)}</h3>
      `;

      // Optimization: Cache full data payloads to LocalStorage.
      // This prevents needing another network request when navigating to the details page.
      localStorage.setItem(`anime_detail_${anime.mal_id}`, JSON.stringify({ data: anime, timestamp: Date.now() }));
      
      grid.appendChild(card);
    });
  }

  /**
   * Processes the master `liveAnimeData` array through source filtering, 
   * genre filtering, and sorting rules, then triggers a re-render.
   */
  function applyFilters() {
    // Create a shallow copy of the master array to preserve original API data
    let filtered = [...liveAnimeData];

    // --- 1. Source Material Filter Logic ---
    const sourceValue = filterSource.value;
    if (sourceValue !== 'all') {
      if (sourceValue === 'other') {
        // Group niche properties (Web Manga, Card Games, Visual Novels, etc.) into one umbrella filter
        const standardSources = ['manga', 'light novel', 'original'];
        filtered = filtered.filter(a => !standardSources.includes((a.source || '').toLowerCase()));
      } else {
        // Match explicit choices directly (e.g., 'manga', 'original')
        filtered = filtered.filter(a => (a.source || '').toLowerCase() === sourceValue);
      }
    }

    // --- 2. Genre Filter Logic ---
    const genre = filterGenre.value;
    if (genre !== 'all') {
      filtered = filtered.filter(a => {
        if (!a.genres) return false;
        // Verify if at least one genre name in the anime matches the selected dropdown string
        return a.genres.some(g => g.name.toLowerCase() === genre.toLowerCase());
      });
    }

    // --- 3. Sort Order Logic ---
    const sort = filterSort.value;
    if (sort === 'az') {
      // Alphabetical sort utilizing locale-aware string comparison
      filtered.sort((a, b) => getAnimeTitle(a).localeCompare(getAnimeTitle(b)));
    } else if (sort === 'rated') {
      // Numerical sort: highest rating/score first
      filtered.sort((a, b) => (b.score || 0) - (a.score || 0));
    } else if (sort === 'popular') {
      // Numerical sort: lowest popularity ranking number first (Rank #1 is most popular)
      filtered.sort((a, b) => (a.popularity || 9999) - (b.popularity || 9999));
    }

    // Pass the fully manipulated dataset over to be rendered visually
    renderCards(filtered);
  }
}