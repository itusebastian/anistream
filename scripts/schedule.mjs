import { fetchCurrentAnime } from "./api.mjs";
import { createGenreTagsHTML, escapeHTML, getAnimeImageUrl, getAnimeTitle, removeDuplicates, truncateString } from "./utils.mjs";

let weeklyCachedData = null;
let currentActiveDay = 'monday'; // Jikan uses full lowercase strings ('monday', 'tuesday', etc.)

/**
 * Initializes the weekly schedule page component.
 */
export async function initAnimeSchedule() {
    const grid = document.getElementById('scheduleGrid');
    const tabsContainer = document.getElementById('tabsContainer');

    // Guard clause: Only run if we are on the schedule template page
    if (!grid || !tabsContainer) return;

    try {
        // Fetch raw weekly data array
        const rawScheduleData = await fetchCurrentAnime();
        
        // Group the API elements by day
        weeklyCachedData = groupScheduleByDay(rawScheduleData);

        // Bind click listeners dynamically to the pre-existing HTML tabs
        setupTabEventListeners();

        // Initial default render (Monday)
        renderScheduleDay(currentActiveDay);

    } catch (error) {
        console.error('Error loading the anime schedule matrix:', error);
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: rgba(255,255,255,0.4); padding: 40px 0;">Unable to load the weekly schedule right now. Please try again later.</p>';
    }
}

/**
 * Groups raw data from Jikan into explicit day buckets based on broadcast properties.
 */
function groupScheduleByDay(dataArray) {
    const buckets = {
        monday: [], tuesday: [], wednesday: [], thursday: [], 
        friday: [], saturday: [], sunday: []
    };

    // Remove duplicate anime items from the API response before bucket processing
    const uniqueAnimeList = removeDuplicates(dataArray, anime => anime.mal_id);

    uniqueAnimeList.forEach(anime => {
        // Extract the day identifier provided by the API (e.g., "Mondays")
        const broadcastDay = anime.broadcast?.day?.toLowerCase();
        
        if (broadcastDay) {
            // Clean plural endings ("mondays" -> "monday")
            const normalizedDay = broadcastDay.endsWith('s') ? broadcastDay.slice(0, -1) : broadcastDay;
            if (buckets[normalizedDay]) {
                buckets[normalizedDay].push(anime);
            }
        }
    });

    return buckets;
}

/**
 * Attaches event listeners to the static buttons and overrides the embedded inline onclick attributes.
 */
function setupTabEventListeners() {
    const tabs = document.querySelectorAll('.day-tab');
    
    tabs.forEach(tab => {
        // Extract 3-letter shorthand code and expand it to match our internal buckets
        const onclickAttr = tab.getAttribute('onclick') || '';
        const dayMatch = onclickAttr.match(/selectDay\('([^']+)'/);
        
        if (dayMatch && dayMatch[1]) {
            const shortDay = dayMatch[1];
            const fullDayMap = {
                mon: 'monday', tue: 'tuesday', wed: 'wednesday', 
                thu: 'thursday', fri: 'friday', sat: 'saturday', sun: 'sunday'
            };
            const mappedDay = fullDayMap[shortDay];

            // Strip the bad inline attribute to let modern JS handle operations cleanly
            tab.removeAttribute('onclick');

            tab.addEventListener('click', () => {
                // Update active styles
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Render current day collection
                currentActiveDay = mappedDay;
                renderScheduleDay(mappedDay);

                // Scroll element smoothly on mobile displays
                tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            });
        }
    });
}

/**
 * Renders the chosen day array into the DOM grid layout container.
 */
function renderScheduleDay(dayKey) {
    const grid = document.getElementById('scheduleGrid');
    if (!grid || !weeklyCachedData) return;

    grid.innerHTML = '';
    const dayItems = weeklyCachedData[dayKey] || [];

    if (dayItems.length === 0) {
        grid.innerHTML = `
          <div class="schedule-empty-state" style="grid-column: 1/-1; text-align: center; padding: 60px 0; color: rgba(255,255,255,0.4);">
            <p>No live streaming releases scheduled for this day.</p>
          </div>
        `;
        return;
    }

    // Sort chronologically by broadcast time if data is available
    dayItems.sort((a, b) => (a.broadcast?.time || '23:59').localeCompare(b.broadcast?.time || '23:59'));

    dayItems.forEach(anime => {
        const cleanDisplayTitle = getAnimeTitle(anime);
        const genreTagsHTML = createGenreTagsHTML(anime.genres);
        const imageUrl = getAnimeImageUrl(anime);
        const broadcastTime = anime.broadcast?.time ? `${anime.broadcast.time} JST` : 'TBA';

        const card = document.createElement('div');
        card.className = 'anime-card';
        card.setAttribute('data-mal-id', anime.mal_id);

        card.innerHTML = `
          <div class="anime-card-image-wrapper">
            <img
              src="${escapeHTML(imageUrl)}"
              alt="${escapeHTML(cleanDisplayTitle)}"
              class="card-image"
              loading="lazy"
              onerror="this.onerror=null; this.src='https://placehold.co/400x600/16161f/ffffff?text=AniStream';"
            >
            <div class="schedule-time-badge">
              ${escapeHTML(broadcastTime)}
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
          <h3 class="schedule-card-title">${escapeHTML(cleanDisplayTitle)}</h3>
        `;

        // Redirect interaction to detail page mirroring the dashboard grid configuration
        card.addEventListener('click', () => {
            window.location.href = `anime-details.html?id=${anime.mal_id}`;
        });

        grid.appendChild(card);
    });

    // Re-trigger modular CSS entry transitions fluidly
    grid.classList.remove('results-grid-animation');
    void grid.offsetWidth; // Force reflow
    grid.classList.add('results-grid-animation');
}