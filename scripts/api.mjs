import { JIKAN_BASE_URL } from "./config.mjs";

const pendingRequests = new Map();
let requestQueue = Promise.resolve();
let nextRequestTime = 0;

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function requestPayload(endpoint, errorMessage) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
        await wait(Math.max(0, nextRequestTime - Date.now()));
        nextRequestTime = Date.now() + 1100;

        let response;
        try {
            response = await fetch(`${JIKAN_BASE_URL}${endpoint}`, {
                signal: AbortSignal.timeout(15000)
            });
        } catch (error) {
            throw new Error(`${errorMessage}: API unreachable or request timed out. Check your connection and Jikan status.`, { cause: error });
        }

        if ((response.status === 429 || response.status >= 500) && attempt < 2) {
            const retryAfter = Number(response.headers.get('Retry-After'));
            await wait(Math.min(30000, Math.max(1100 * (attempt + 1), retryAfter * 1000 || 0)));
            continue;
        }

        if (!response.ok) {
            throw new Error(`${errorMessage}: HTTP ${response.status}`);
        }

        const json = await response.json();
        if (!json || typeof json !== 'object' || !('data' in json) || json.data == null) {
            throw new Error(`${errorMessage}: invalid API response`);
        }
        return json.data;
    }
}

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
export function setCachedData(key, data) {
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
function fetchJikanData(endpoint, errorMessage, cacheKey) {
    // 1. Check if valid cache data exists before firing a network operation
    const localData = getCachedData(cacheKey);
    if (localData) {
        return Promise.resolve(localData);
    }
    if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey);

    const request = requestQueue.then(async () => {
        const cleanPayload = await requestPayload(endpoint, errorMessage);
        if (!Array.isArray(cleanPayload) || cleanPayload.length > 0) {
            setCachedData(cacheKey, cleanPayload);
        }
        return cleanPayload;
    }).finally(() => pendingRequests.delete(cacheKey));

    pendingRequests.set(cacheKey, request);
    requestQueue = request.catch(() => {});
    return request;
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