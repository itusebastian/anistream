import { JIKAN_BASE_URL } from "./config.mjs";

// Cache Duration configuration (in milliseconds)
const CACHE_TIMES = {
    LISTS: 2 * 60 * 60 * 1000,    // 2 Hours for home page lists (airing / upcoming)
    DETAILS: 24 * 60 * 60 * 1000 // 24 Hours for individual anime metadata profile screens
};

/**
 * Reads from localStorage and checks if the cached payload is still valid.
 */
function getCachedData(key) {
    try {
        const cached = localStorage.getItem(key);
        if (!cached) return null;

        const { data, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;

        // Determine expiration limits based on data type keys
        const maxAge = key.startsWith('anime_detail_') ? CACHE_TIMES.DETAILS : CACHE_TIMES.LISTS;

        if (age < maxAge) {
            return data; // Cache hit and still fresh
        }
        
        // Cache expired, wipe item cleanly from browser storage
        localStorage.removeItem(key);
        return null;
    } catch (e) {
        console.error("Error reading storage cache framework:", e);
        return null;
    }
}

/**
 * Commits a fresh data payload wrapper to localStorage with a timestamp marker.
 */
function setCachedData(key, data) {
    try {
        const cachePayload = {
            data: data,
            timestamp: Date.now()
        };
        localStorage.setItem(key, JSON.stringify(cachePayload));
    } catch (e) {
        console.warn("Storage write limit threshold reached or disabled:", e);
    }
}

/**
 * Helper function to handle boilerplate fetch operations and error responses.
 */
async function fetchJikanData(endpoint, errorMessage, cacheKey) {
    // 1. Check if valid cache data exists before firing a network operation
    const localData = getCachedData(cacheKey);
    if (localData) {
        return localData;
    }

    // 2. Perform fallback asynchronous HTTP fetch request if cache misses
    const response = await fetch(`${JIKAN_BASE_URL}${endpoint}`);
    
    if (!response.ok) {
        throw new Error(errorMessage);
    }

    const json = await response.json();
    const cleanPayload = json.data || [];

    // 3. Update the localized storage track records with the fresh payload
    if (cleanPayload && (!Array.isArray(cleanPayload) || cleanPayload.length > 0)) {
        setCachedData(cacheKey, cleanPayload);
    }
    
    return cleanPayload;
}

/**
 * Fetches upcoming anime data for the home page hero carousel slider.
 */
export function fetchUpcomingAnime() {
    return fetchJikanData('/seasons/upcoming?sfw=true', 'Failed to fetch upcoming slider data', 'anime_upcoming_list');
}

/**
 * Fetches currently airing/streaming anime data to populate the display grid.
 */
export function fetchCurrentAnime() {
    return fetchJikanData('/seasons/now?sfw=true', 'Failed to fetch streaming grid elements', 'anime_current_list');
}

/**
 * Fetches comprehensive metadata for a specific anime by its ID.
 * @param {number|string} id - The MyAnimeList ID of the anime.
 */
export function fetchAnimeById(id) {
    return fetchJikanData(`/anime/${id}`, `Failed to fetch details for anime ID: ${id}`, `anime_detail_${id}`);
}

/**
 * Searches the live anime catalog database by text queries.
 * @param {string} query - The search query term.
 */
export function searchAnimeCatalog(query) {
    const encodedQuery = encodeURIComponent(query.trim().toLowerCase());
    return fetchJikanData(
        `/anime?q=${encodedQuery}&sfw=true`, 
        `Failed to execute catalog search for: ${query}`, 
        `anime_search_${encodedQuery}`
    );
}