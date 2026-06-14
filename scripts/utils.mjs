/**
 * Truncates string values exceeding length limitations to keep text displays clean.
 * @param {string} value - The input phrase string.
 * @param {number} maxLength - Character threshold boundary.
 */
export function truncateString(value, maxLength) {
    if (!value || value.length <= maxLength) return value || '';
    return `${value.slice(0, maxLength)}...`; // Slice and stitch trailing ellipsis
}

/**
 * Resolves localized English title variants or basic fallback properties.
 */
export function getAnimeTitle(anime) {
    return anime?.title_english || anime?.title || 'Untitled Anime';
}

/**
 * Safely digs deep into structural nested Jikan API imagery arrays to extract target paths.
 */
export function getAnimeImageUrl(anime) {
    return anime?.images?.jpg?.image_url || '';
}

/**
 * Generates badge item labels for categories. Maxes out configuration displays at 2 badges.
 * @param {Array} genres - Raw list arrays of category genres.
 */
export function createGenreTagsHTML(genres = []) {
    // If the data has no assigned genres, append a default placeholder badge
    if (!genres.length) {
        return '<span class="genre-tag">Anime</span>';
    }

    // Limit display tags up to 2 items, escape values to prevent injection, and combine into a template string
    return genres
        .slice(0, 2)
        .map(genre => `<span class="genre-tag">${escapeHTML(genre.name)}</span>`)
        .join('');
}

/**
 * String sanitization logic processing engine to combat and defuse malicious XSS injection scripts.
 * Replaces critical code characters with their corresponding encoded HTML entities.
 */
export function escapeHTML(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Automatically calculates the current anime season and year based on the system date.
 * @returns {string} E.g., "Summer 2026 Season"
 */
export function getCurrentSeasonTitle() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0 = January, 11 = December

    let season = '';
    
    if (month >= 0 && month <= 2) {
        season = 'Winter';
    } else if (month >= 3 && month <= 5) {
        season = 'Spring';
    } else if (month >= 6 && month <= 8) {
        season = 'Summer';
    } else {
        season = 'Fall';
    }

    return `${season} ${year} Season`;
}

/**
 * Filters an array to return only unique elements based on a selector function.
 * @param {Array} array - The source array.
 * @param {Function} keySelector - A function that returns the unique identifier for an item.
 * @returns {Array} A new array containing only unique elements.
 */
export function removeDuplicates(array, keySelector) {
    if (!Array.isArray(array)) return [];
    
    const seen = new Set();
    return array.filter(item => {
        const key = keySelector(item);
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}
// Shorthand version:
// export const removeDuplicates = (arr, keySelector) => 
//     [...new Map(arr.map(item => [keySelector(item), item])).values()];