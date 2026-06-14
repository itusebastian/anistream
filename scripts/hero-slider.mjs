import { fetchUpcomingAnime } from './api.mjs';
import { escapeHTML, getAnimeImageUrl, getAnimeTitle, truncateString } from './utils.mjs';

// Module state management variables
let currentSliderIndex = 0; // Tracks which slide is currently active
let sliderAnimeData = [];   // Stores array slice of raw anime entries used in the slideshow
let sliderInterval = null;  // Reference pointer to the setInterval timer for cleaning cycles

/**
 * Component Entrypoint: Begins the asynchronous workflow to load the slider
 * and initializes the parallax effect if the element exists on the current page.
 */
export function initHeroSlider() {
    initHeroParallax(); // Run the parallax setup cleanly inside its home component
    loadUpcomingSliderData();
}

/**
 * Drives subtle background parallax translation dynamics during user scroll operations.
 * Optimized to cleanly exit if elements don't exist or on low-spec mobile viewports.
 */
function initHeroParallax() {
    const heroImg = document.querySelector('.hero-image-wrapper');

    // If this element isn't found cleanly exit immediately and do not attach the global scroll event.
    if (!heroImg) {
        return;
    }

    // Exit tracking if execution occurs on mobile form factors under 768px wide
    if (window.innerWidth < 768) {
        return;
    }

    // Track frame adjustments on window scrolling
    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;

        // Cap calculations to standard page ranges (0px to 900px vertical) to optimize computing performance
        if (scrollY < 900) {
            // Apply scale and minor translation shifts
            heroImg.style.transform = `translateY(${scrollY * 0.3}px) scale(1.05)`;
        }
    }, { passive: true }); // '{ passive: true }' optimizes rendering thread performance
}

/**
 * Asynchronously pulls data from the endpoint and caches the first 5 records
 */
async function loadUpcomingSliderData() {
    try {
        // This function call handles checking 'anime_upcoming_list' in localStorage automatically!
        const upcomingList = await fetchUpcomingAnime();

        if (upcomingList.length > 0) {
            // Restrict size to a clean, lightweight top-5 pool
            sliderAnimeData = upcomingList.slice(0, 5);

            // Pre-cache these top 5 detailed entries so clicking the Hero button opens the detailed page instantly!
            sliderAnimeData.forEach(anime => {
                localStorage.setItem(`anime_detail_${anime.mal_id}`, JSON.stringify({
                    data: anime,
                    timestamp: Date.now()
                }));
            });

            // Initialize rotation loop
            startSliderCycle();
        }
    } catch (error) {
        console.error('Error fetching upcoming slider data:', error);
    }
}

/**
 * Controls timing orchestration for shifting slide states every 6 seconds
 */
function startSliderCycle() {
    // Guard clause: Cannot rotate through a completely empty list
    if (sliderAnimeData.length === 0) return;

    // Render the initial active index card immediately
    renderSlideContent(sliderAnimeData[currentSliderIndex]);

    // Reset previous interval if this function is triggered multiple times to prevent race loops
    if (sliderInterval) {
        clearInterval(sliderInterval);
    }

    // Set auto-rotation interval
    sliderInterval = setInterval(() => {
        // Advance index by 1; wrap back around to index 0 using remainder operator (%)
        currentSliderIndex = (currentSliderIndex + 1) % sliderAnimeData.length;
        renderSlideContent(sliderAnimeData[currentSliderIndex]);
    }, 6000); // 6000ms = 6 Seconds
}

/**
 * Updates DOM tree components for the Hero Banner with a slight crossfade transition
 * @param {Object} anime - The specialized anime object block to display
 */
function renderSlideContent(anime) {
    // Fetch relevant UI handles
    const heroSection = document.querySelector('.hero-section');
    const heroImage = document.querySelector('.hero-image-wrapper img');
    const heroPosterImage = document.querySelector('.hero-poster-box img');
    const heroTitle = document.querySelector('.hero-title');
    const heroMetaRow = document.querySelector('.hero-meta-row');
    const heroDescription = document.querySelector('.hero-description');
    const heroPrimaryBtn = document.querySelector('.hero-section .cta-btn');

    // Abort out of rendering actions if essential nodes are missing
    if (!heroSection || !anime) return;

    const cleanHeroTitle = getAnimeTitle(anime);

    // Step 1: Temporarily lower opacity to initiate fade-out phase of transition
    heroSection.style.opacity = '0.85';

    // Step 2: Swap the background details mid-fade using a brief timeout delay
    setTimeout(() => {
        const imageUrl = getAnimeImageUrl(anime);

        // Update blurred background
        if (heroImage) {
            heroImage.src = imageUrl;
            heroImage.alt = `${cleanHeroTitle} Backdrop`;
        }

        // Update sharp un-blurred foreground poster display card
        if (heroPosterImage) {
            heroPosterImage.src = imageUrl;
            heroPosterImage.alt = `${cleanHeroTitle} Poster`;
        }

        if (heroTitle) {
            // Apply XSS mitigation encoding safety checks before innerHTML injection
            heroTitle.innerHTML = escapeHTML(cleanHeroTitle);
        }

        // Dynamically build out metadata items safely
        if (heroMetaRow) {
            const score = anime.score ? anime.score.toFixed(1) : 'N/A';
            const type = anime.type ? anime.type : 'TV';
            const genres = anime.genres && anime.genres.length > 0 
                ? anime.genres.map(g => g.name).join(', ') 
                : 'Unknown Genre';

            heroMetaRow.innerHTML = `
                <span class="hero-meta-item">${escapeHTML(type)}</span>
                <span class="hero-meta-item">${escapeHTML(genres)}</span>
            `;
        }

        if (heroDescription) {
            // Truncate summary lengths to protect text from breaking layouts
            heroDescription.textContent = anime.synopsis
                ? truncateString(anime.synopsis, 220)
                : 'No preview summary description available for this upcoming release.';
        }

        // Clone and replace the primary button to strip any old event listeners
        if (heroPrimaryBtn) {
            const newPrimaryBtn = heroPrimaryBtn.cloneNode(true);
            heroPrimaryBtn.parentNode.replaceChild(newPrimaryBtn, heroPrimaryBtn);
            
            newPrimaryBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = `anime-details.html?id=${anime.mal_id}`;
            });
        }

        // Step 3: Restore full opacity to complete the visual transition sequence
        heroSection.style.opacity = '1';
    }, 200); // 200ms matches the quick fade timing window
}