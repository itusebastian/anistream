// ============================================================================
// Application Bootstrapper & Core Entry Point
// Orchestrates and bundles distinct sub-component initializations across the app.
// ============================================================================

import { initMobileMenu } from './mobile-menu.mjs';
import { initHeroSlider } from './hero-slider.mjs';
import { initAnimeGrid } from './anime-grid.mjs';
import { initAnimeDetails } from './anime-details.mjs';
import { initBrowseCatalog } from './browse-catalog.mjs';
import { initAnimeSchedule } from './schedule.mjs';
import { initHeaderSearch } from './header-search.mjs';
import { initAnimeSearch } from './search.mjs';

/**
 * Fires automatically when the initial HTML document has been completely parsed,
 * without waiting for stylesheets, images, and subframes to finish loading.
 */
document.addEventListener('DOMContentLoaded', () => {
    
    // --- Global Shared Elements ---
    // These run on every single page layout across the application site
    initMobileMenu();     // Binds click handlers for responsive mobile nav toggle drawbars
    initHeaderSearch();   // Initializes the dynamic search button expanding transition logic

    // --- Page-Specific Component Engines ---
    // Note: Internal guard clauses inside these functions will automatically stop execution
    // if their required specific DOM target containers/grids aren't present on the page.
    initHeroSlider();     // Drives the homepage showcase carousel animation controls
    initAnimeGrid();      // Compiles and renders the 12 primary featured seasonal layout cards
    initBrowseCatalog();  // Binds filtration engines and dynamic query states on the browse route
    initAnimeDetails();   // Captures active URL query parameters to construct data profile sheets
    initAnimeSchedule();  // Structures weekly programming broadcast release schedule tables
    initAnimeSearch();
});