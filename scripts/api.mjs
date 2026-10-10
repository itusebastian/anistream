import { parseFragment } from 'parse5';
import { ANILIST_API_URL } from './config.mjs';

const CACHE_TIMES = { LISTS: 15 * 60 * 1000, DETAILS: 60 * 60 * 1000 };
const pendingRequests = new Map();
let requestQueue = Promise.resolve();
let nextRequestTime = 0;
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

const MEDIA_FIELDS = `
    id idMal isAdult
    title { romaji english native }
    description(asHtml: true)
    coverImage { large extraLarge }
    bannerImage siteUrl
    format status episodes duration season seasonYear source
    averageScore popularity genres
    studios(isMain: true) { nodes { name } }
    trailer { id site }
    nextAiringEpisode { airingAt episode }
`;

const LIST_QUERY = `
    query Catalog($season: MediaSeason, $year: Int, $status: MediaStatus, $search: String, $sort: [MediaSort]) {
        Page(page: 1, perPage: 50) {
            media(type: ANIME, isAdult: false, season: $season, seasonYear: $year,
                status: $status, search: $search, sort: $sort) { ${MEDIA_FIELDS} }
        }
    }
`;

const DETAIL_QUERY = `
    query AnimeDetails($id: Int, $idMal: Int) {
        Media(id: $id, idMal: $idMal, type: ANIME, isAdult: false) { ${MEDIA_FIELDS} }
    }
`;

const SCHEDULE_QUERY = `
    query WeeklySchedule($page: Int!, $start: Int!, $end: Int!) {
        Page(page: $page, perPage: 50) {
            pageInfo { hasNextPage }
            airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
                airingAt episode media { ${MEDIA_FIELDS} }
            }
        }
    }
`;

function descriptionText(description) {
    function readNode(node) {
        if (node.nodeName === 'script' || node.nodeName === 'style') return '';
        if (node.nodeName === 'br') return ' ';
        if (node.nodeName === '#text') return node.value;
        return (node.childNodes || []).map(readNode).join(' ');
    }
    return readNode(parseFragment(description || '')).replace(/\s+/g, ' ').trim();
}

function broadcastFromTimestamp(timestamp) {
    if (!timestamp) return { day: null, time: null, string: null };
    const date = new Date(timestamp * 1000);
    const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', weekday: 'long' }).format(date);
    const time = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).format(date);
    return { day, time, string: `${day} ${time} JST` };
}

function normalizeAnime(media, airingAt = media?.nextAiringEpisode?.airingAt) {
    if (!media || !Number.isInteger(media.id) || media.id <= 0 || media.isAdult === true) {
        throw new Error('AniList returned an invalid or restricted anime');
    }
    const sourceNames = { LIGHT_NOVEL: 'Light Novel', VISUAL_NOVEL: 'Visual Novel', MANGA: 'Manga', ORIGINAL: 'Original' };
    const statuses = {
        RELEASING: 'Currently Airing', FINISHED: 'Finished Airing', NOT_YET_RELEASED: 'Not yet aired',
        CANCELLED: 'Cancelled', HIATUS: 'On hiatus'
    };
    const formats = { TV: 'TV', TV_SHORT: 'TV Short', MOVIE: 'Movie', SPECIAL: 'Special', OVA: 'OVA', ONA: 'ONA', MUSIC: 'Music' };
    const trailerId = media.trailer?.id;
    const embedUrl = media.trailer?.site === 'youtube' && /^[\w-]+$/.test(trailerId || '')
        ? `https://www.youtube.com/embed/${trailerId}?rel=0` : null;
    return {
        id: media.id,
        mal_id: media.idMal,
        title: media.title?.romaji,
        title_english: media.title?.english,
        title_japanese: media.title?.native,
        synopsis: descriptionText(media.description),
        images: { jpg: { image_url: media.coverImage?.extraLarge || media.coverImage?.large || '' } },
        banner_image: media.bannerImage,
        site_url: media.siteUrl,
        type: formats[media.format] || media.format || 'Unknown',
        status: statuses[media.status] || 'Unknown',
        episodes: media.episodes,
        duration: media.duration ? `${media.duration} min per ep` : null,
        season: media.season?.toLowerCase(),
        year: media.seasonYear,
        source: sourceNames[media.source] || media.source?.replaceAll('_', ' ') || 'Unknown',
        score: media.averageScore == null ? null : media.averageScore / 10,
        popularity: media.popularity ?? 0,
        genres: (media.genres || []).map(name => ({ name })),
        studios: media.studios?.nodes || [],
        broadcast: broadcastFromTimestamp(airingAt),
        trailer: { embed_url: embedUrl }
    };
}

function getCachedData(key) {
    try {
        const cached = localStorage.getItem(key);
        if (!cached) return null;
        const { data, timestamp } = JSON.parse(cached);
        const maxAge = key.includes('_detail_') ? CACHE_TIMES.DETAILS : CACHE_TIMES.LISTS;
        if (Date.now() - timestamp < maxAge) return data;
        localStorage.removeItem(key);
    } catch (error) {
        console.warn('Unable to read optional API cache:', error);
    }
    return null;
}

export function setCachedData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
    } catch (error) {
        console.warn('Unable to write optional API cache:', error);
    }
}

async function requestPayload(query, variables) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
        await wait(Math.max(0, nextRequestTime - Date.now()));
        nextRequestTime = Date.now() + 2100;
        let response;
        try {
            response = await fetch(ANILIST_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ query, variables }),
                signal: AbortSignal.timeout(15000)
            });
        } catch (error) {
            throw new Error('AniList API unreachable or request timed out. Check your connection.', { cause: error });
        }
        if (response.status === 429 || response.status >= 500) {
            const retrySeconds = Number(response.headers.get('Retry-After'));
            const resetSeconds = Number(response.headers.get('X-RateLimit-Reset'));
            nextRequestTime = Math.max(nextRequestTime,
                Date.now() + (retrySeconds > 0 ? retrySeconds * 1000 : 0),
                resetSeconds > 0 ? resetSeconds * 1000 : 0,
                Date.now() + (response.status === 429 && !retrySeconds && !resetSeconds ? 60000 : 2100 * (attempt + 1)));
            if (attempt < 2) continue;
        }
        if (!response.ok) throw new Error(`AniList request failed: HTTP ${response.status}`);
        const json = await response.json();
        if (json.errors?.length) throw new Error(`AniList: ${json.errors.map(error => error.message).join('; ')}`);
        if (!json.data || typeof json.data !== 'object') throw new Error('AniList returned an invalid API response');
        return json.data;
    }
}

function fetchCached(cacheKey, load) {
    const cached = getCachedData(cacheKey);
    if (cached) return Promise.resolve(cached);
    if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey);
    const request = requestQueue.then(load).then(data => {
        setCachedData(cacheKey, data);
        return data;
    }).finally(() => pendingRequests.delete(cacheKey));
    pendingRequests.set(cacheKey, request);
    requestQueue = request.catch(() => {});
    return request;
}

function fetchCatalog(cacheKey, variables) {
    return fetchCached(cacheKey, async () => {
        const data = await requestPayload(LIST_QUERY, variables);
        if (!Array.isArray(data.Page?.media)) throw new Error('AniList returned an invalid catalog');
        return data.Page.media.filter(media => media && media.isAdult !== true).map(media => normalizeAnime(media));
    });
}

export function fetchCurrentAnime() {
    const now = new Date();
    const season = ['WINTER', 'SPRING', 'SUMMER', 'FALL'][Math.floor(now.getMonth() / 3)];
    const year = now.getFullYear();
    return fetchCatalog(`anilist_current_${year}_${season}`, { season, year, sort: ['POPULARITY_DESC'] });
}

export function fetchUpcomingAnime() {
    return fetchCatalog('anilist_upcoming', { status: 'NOT_YET_RELEASED', sort: ['POPULARITY_DESC'] });
}

export function fetchAnimeById(id, provider = 'anilist') {
    const numericId = Number(id);
    if (!/^\d+$/.test(String(id)) || !Number.isSafeInteger(numericId) || numericId <= 0 || numericId > 2147483647) {
        return Promise.reject(new Error('Invalid anime ID'));
    }
    if (provider !== 'anilist' && provider !== 'mal') return Promise.reject(new Error('Invalid anime ID provider'));
    const variables = provider === 'mal' ? { idMal: numericId } : { id: numericId };
    const key = provider === 'mal' ? `anilist_mal_detail_${numericId}` : `anilist_detail_${numericId}`;
    return fetchCached(key, async () => normalizeAnime((await requestPayload(DETAIL_QUERY, variables)).Media));
}

export function searchAnimeCatalog(query) {
    const search = query.trim();
    if (!search) return Promise.resolve([]);
    return fetchCatalog(`anilist_search_${search.toLowerCase()}`, { search, sort: ['SEARCH_MATCH'] });
}

export function fetchAnimeSchedule() {
    const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const daysSinceMonday = (jst.getUTCDay() + 6) % 7;
    const start = Math.floor(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate() - daysSinceMonday) / 1000) - 9 * 60 * 60;
    const end = start + 7 * 24 * 60 * 60;
    return fetchCached(`anilist_schedule_${start}`, async () => {
        const anime = [];
        for (let page = 1; page <= 100; page += 1) {
            const data = await requestPayload(SCHEDULE_QUERY, { page, start: start - 1, end });
            if (!Array.isArray(data.Page?.airingSchedules) || !data.Page.pageInfo) throw new Error('AniList returned an invalid schedule');
            for (const airing of data.Page.airingSchedules) {
                if (airing.media && airing.media.isAdult !== true) anime.push(normalizeAnime(airing.media, airing.airingAt));
            }
            if (!data.Page.pageInfo.hasNextPage) return anime;
        }
        throw new Error('AniList schedule exceeded the pagination limit');
    });
}