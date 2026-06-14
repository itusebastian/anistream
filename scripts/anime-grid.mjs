import { fetchCurrentAnime } from "./api.mjs";
import { createGenreTagsHTML, escapeHTML, getAnimeImageUrl, getAnimeTitle, removeDuplicates, truncateString } from "./utils.mjs";

/**
 * Initializes the anime grid UI component by fetching current anime data
 * and dynamically rendering responsive cards into the DOM.
 */
export async function initAnimeGrid() {
    // Target the main container element for the grid
    const grid = document.getElementById('animeGrid');

    // Guard clause: Exit early if the grid element doesn't exist on the current page
    if (!grid) return;

    try {
        // Fetch the list of currently streaming anime from the API
        const animeList = await fetchCurrentAnime();

        // Throw an error to trigger the catch block if the API returns an empty array
        if (!animeList.length) {
            throw new Error('No streaming data found');
        }

        // Remove duplicate anime items from the API response before rendering
        const uniqueAnimeList = removeDuplicates(animeList, anime => anime.mal_id);

        // Limit the display to just the top 12 UNIQUE anime items for the grid
        const topStreamingAnime = uniqueAnimeList.slice(0, 12);

        // Clear out any placeholder content or spinners currently inside the grid
        grid.innerHTML = '';

        // Iterate through each anime object to construct and append its card
        topStreamingAnime.forEach(anime => {
            // Extract and format normalized data from the raw API object
            const cleanDisplayTitle = getAnimeTitle(anime);
            const currentStatusBadge = anime.episodes ? `EP ${anime.episodes}` : 'AIRING';
            const genreTagsHTML = createGenreTagsHTML(anime.genres);
            const imageUrl = getAnimeImageUrl(anime);

            // Create the wrapper element for the individual anime card
            const card = document.createElement('div');
            card.className = 'anime-card';
            card.setAttribute('data-mal-id', anime.mal_id); // Store MyAnimeList ID for potential click events

            // Inject the internal HTML structure, ensuring all dynamic user/API text is escaped for XSS protection
            card.innerHTML = `
            <div class="anime-card-image-wrapper">
                <img 
                    src="${escapeHTML(imageUrl)}" 
                    alt="${escapeHTML(cleanDisplayTitle)}" 
                    class="card-image"
                    loading="lazy"
                    onerror="this.onerror=null; this.src='https://placehold.co/400x600/16161f/ffffff?text=AniStream';"
                >
                
                <div class="ep-badge">
                    ${escapeHTML(currentStatusBadge)}
                </div>

                <div class="card-overlay">
                    <div class="genre-tags">
                        ${genreTagsHTML}
                    </div>
                    <p class="card-description">
                        ${escapeHTML(anime.synopsis ? truncateString(anime.synopsis, 120) : 'No plot synopsis description provided for this stream.')}
                    </p>
                </div>
            </div>
            <h3 class="card-title">${escapeHTML(cleanDisplayTitle)}</h3>
            `;

            // Redirect to detail template when the card is clicked
            card.addEventListener('click', () => {
                window.location.href = `anime-details.html?id=${anime.mal_id}`;
            })

            // Pre-cache individual profile tokens to localStorage so the detailed layout works instantly
            localStorage.setItem(`anime_detail_${anime.mal_id}`, JSON.stringify({ data: anime, timestamp: Date.now() }));

            // Append the fully constructed card to the grid container
            grid.appendChild(card);
        });
    } catch (error) {
        // Log the exact error to the console for debugging
        console.error('Error loading top streaming grid components:', error);
        
        // Display a user-friendly fallback error message centered inside the grid layout
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: rgba(255,255,255,0.4); padding: 40px 0;">Unable to display streaming anime right now. Please try again later.</p>';
    }
}