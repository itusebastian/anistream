import { searchAnimeCatalog } from "./api.mjs";
import { createGenreTagsHTML, escapeHTML, getAnimeImageUrl, getAnimeTitle, truncateString } from "./utils.mjs";

/**
 * Initializes the dynamic search page logic and binds listeners to DOM components.
 */
export function initAnimeSearch() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearBtn');
    const zeroState = document.getElementById('zeroState');
    const noResults = document.getElementById('noResults');
    const resultsBar = document.getElementById('resultsBar');
    const animeGrid = document.getElementById('animeGrid');
    const resultsCount = document.getElementById('resultsCount');
    const noResultsQuery = document.getElementById('noResultsQuery');

    // Guard Clause: Exit cleanly if search components are absent on the current screen
    if (!searchInput || !animeGrid) return;

    /**
     * Executes queries via live fetch operations and resolves loading states.
     */
    async function performSearch() {
        const query = searchInput.value.trim();

        if (query.length > 0) {
            clearBtn.classList.add('flex');
            clearBtn.classList.remove('hidden');
        } else {
            clearBtn.classList.add('hidden');
            clearBtn.classList.remove('flex');
        }

        if (query.length === 0) {
            zeroState.classList.replace('hidden', 'flex');
            noResults.classList.replace('flex', 'hidden');
            animeGrid.classList.add('hidden');
            resultsBar.classList.replace('flex', 'hidden');
            return;
        }

        try {
            const results = await searchAnimeCatalog(query);

            zeroState.classList.replace('flex', 'hidden');

            if (!results || results.length === 0) {
                noResults.classList.replace('hidden', 'flex');
                animeGrid.classList.add('hidden');
                resultsBar.classList.replace('flex', 'hidden');
                noResultsQuery.textContent = query;
            } else {
                noResults.classList.replace('flex', 'hidden');
                animeGrid.classList.remove('hidden');
                resultsBar.classList.replace('hidden', 'flex');
                resultsCount.textContent = results.length;
                renderCards(results);
            }
        } catch (error) {
            console.error("Search tracking failure:", error);
            zeroState.classList.replace('hidden', 'flex');
            animeGrid.classList.add('hidden');
        }
    }

    /**
     * Builds standard application cards using structural utility formatters.
     */
    function renderCards(data) {
        animeGrid.innerHTML = '';
        animeGrid.classList.remove('search-results-grid-animation');
        void animeGrid.offsetWidth; // Force DOM browser reflow
        animeGrid.classList.add('search-results-grid-animation');

        data.forEach(anime => {
            const displayTitle = getAnimeTitle(anime);
            const score = anime.score ? anime.score.toFixed(2) : 'N/A';
            const studio = anime.studios && anime.studios.length > 0 ? anime.studios[0].name : 'Unknown Studio';
            const description = anime.synopsis ? truncateString(anime.synopsis, 120) : 'No plot synopsis provided.';
            const imageUrl = getAnimeImageUrl(anime);
            const genresHTML = createGenreTagsHTML(anime.genres);

            const card = document.createElement('div');
            card.className = 'anime-card';
            card.style.cursor = 'pointer';
            card.innerHTML = `
              <div class="anime-card-image-wrapper">
                <img
                  src="${imageUrl}"
                  alt="${escapeHTML(displayTitle)}"
                  class="card-image"
                  loading="lazy"
                >
                <div class="rating-badge-search">
                  <svg class="star-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  <span>${score}</span>
                </div>
                <div class="card-overlay">
                  <div class="genre-tags">
                    ${genresHTML}
                  </div>
                  <p class="card-description">${escapeHTML(description)}</p>
                </div>
              </div>
              <h3 class="card-title">${escapeHTML(displayTitle)}</h3>
              <p class="card-studio-text">${escapeHTML(studio)}</p>
            `;

            // Redirects to page details and caches tokens locally for performance gains
            card.addEventListener('click', () => {
                localStorage.setItem(`anime_detail_${anime.mal_id}`, JSON.stringify({ data: anime, timestamp: Date.now() }));
                window.location.href = `anime-details.html?id=${anime.mal_id}`;
            });

            animeGrid.appendChild(card);
        });
    }

    function clearSearch() {
        searchInput.value = '';
        performSearch();
        searchInput.focus();
    }

    // Connect functional click listeners safely avoiding inline markup bindings
    clearBtn.addEventListener('click', clearSearch);
    
    const resultsClearAction = document.querySelector('.result-clear-action');
    resultsClearAction?.addEventListener('click', clearSearch);

    // Apply input keystroke debouncer tracking intervals to honor API limits
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(performSearch, 450);
    });

    // Parse URL query parameters and trigger initial search ---
    const urlParams = new URLSearchParams(window.location.search);
    const urlQuery = urlParams.get('q');

    if (urlQuery) {
        searchInput.value = urlQuery.trim();
        performSearch(); // Fire immediately for deep links to avoid layout flicker
    } else {
        searchInput.focus();
    }
}