import test from 'node:test';
import assert from 'node:assert/strict';

const storage = new Map();
globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key)
};

const api = await import('../scripts/api.mjs');
const media = {
    id: 100, idMal: 200, isAdult: false,
    title: { romaji: 'Romaji Title', english: 'English Title', native: 'Native Title' },
    description: '<p>A &amp; B<br>story.</p><script>untrusted()</script>',
    averageScore: 85, popularity: 1234, source: 'LIGHT_NOVEL', format: 'TV', status: 'RELEASING',
    genres: ['Action'], studios: { nodes: [{ name: 'Studio' }] },
    coverImage: { extraLarge: 'https://example.com/cover.jpg' },
    trailer: { site: 'youtube', id: 'abc-123' },
    nextAiringEpisode: { airingAt: Date.parse('2026-10-11T16:30:00Z') / 1000 }
};

test('AniList requests use GraphQL, deduplicate, normalize, and isolate old caches', async () => {
    storage.set('anime_current_list', JSON.stringify({ data: [{ mal_id: 999 }], timestamp: Date.now() }));
    let calls = 0;
    globalThis.fetch = async (url, options) => {
        calls += 1;
        assert.equal(url, 'https://graphql.anilist.co');
        assert.equal(options.method, 'POST');
        const payload = JSON.parse(options.body);
        assert.match(payload.query, /isAdult: false/);
        assert.ok(payload.variables.year);
        return Response.json({ data: { Page: { media: [media, { ...media, isAdult: true }] } } });
    };
    const [first, second] = await Promise.all([api.fetchCurrentAnime(), api.fetchCurrentAnime()]);
    assert.equal(calls, 1);
    assert.deepEqual(first, second);
    assert.equal(first.length, 1);
    assert.equal(first[0].id, 100);
    assert.equal(first[0].mal_id, 200);
    assert.equal(first[0].score, 8.5);
    assert.equal(first[0].popularity, 1234);
    assert.equal(first[0].synopsis, 'A & B story.');
    assert.equal(first[0].source, 'Light Novel');
    assert.deepEqual(first[0].genres, [{ name: 'Action' }]);
    assert.equal(first[0].broadcast.day, 'Monday');
    assert.equal(first[0].broadcast.time, '01:30');
    assert.equal(first[0].trailer.embed_url, 'https://www.youtube.com/embed/abc-123?rel=0');
    await api.fetchCurrentAnime();
    assert.equal(calls, 1);
});

test('native and legacy IDs are distinct and search stays in variables', async () => {
    const variables = [];
    globalThis.fetch = async (url, options) => {
        const payload = JSON.parse(options.body);
        variables.push(payload.variables);
        return Response.json({ data: payload.variables.search ? { Page: { media: [media] } } : { Media: media } });
    };
    await api.fetchAnimeById(100);
    await api.fetchAnimeById(100, 'mal');
    await api.searchAnimeCatalog('  "Naruto" { test }  ');
    assert.deepEqual(variables, [{ id: 100 }, { idMal: 100 }, { search: '"Naruto" { test }', sort: ['SEARCH_MATCH'] }]);
    await assert.rejects(api.fetchAnimeById('bad'), /Invalid anime ID/);
    await assert.rejects(api.fetchAnimeById(0), /Invalid anime ID/);
});

test('HTTP, GraphQL, invalid payload, and network failures are reported', async () => {
    globalThis.fetch = async () => new Response(null, { status: 404 });
    await assert.rejects(api.fetchAnimeById(999), /HTTP 404/);
    globalThis.fetch = async () => Response.json({ errors: [{ message: 'Not found' }] });
    await assert.rejects(api.fetchAnimeById(998), /Not found/);
    globalThis.fetch = async () => Response.json({ unexpected: true });
    await assert.rejects(api.fetchAnimeById(997), /invalid API response/);
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    await assert.rejects(api.fetchAnimeById(996), /API unreachable/);
});

test('weekly schedules paginate and use airing timestamps in JST', async () => {
    const pages = [];
    globalThis.fetch = async (url, options) => {
        const { variables } = JSON.parse(options.body);
        pages.push(variables.page);
        assert.equal(variables.end - variables.start, 7 * 24 * 60 * 60 + 1);
        return Response.json({ data: { Page: {
            pageInfo: { hasNextPage: variables.page === 1 },
            airingSchedules: [{ media, airingAt: Date.parse('2026-10-11T16:30:00Z') / 1000 }]
        } } });
    };
    const results = await api.fetchAnimeSchedule();
    assert.deepEqual(pages, [1, 2]);
    assert.equal(results[0].broadcast.day, 'Monday');
    assert.equal(results[0].broadcast.time, '01:30');
});

test('rate limits and server errors are retried without bursting', async () => {
    const requestTimes = [];
    globalThis.fetch = async () => {
        requestTimes.push(Date.now());
        if (requestTimes.length < 3) {
            return new Response(null, {
                status: requestTimes.length === 1 ? 429 : 503,
                headers: { 'Retry-After': '1' }
            });
        }
        return Response.json({ data: { Media: media } });
    };
    assert.equal((await api.fetchAnimeById(994)).id, 100);
    assert.equal(requestTimes.length, 3);
    assert.ok(requestTimes[1] - requestTimes[0] >= 2000);
    assert.ok(requestTimes[2] - requestTimes[1] >= 4000);
});

test('disabled browser storage does not prevent data from loading', async () => {
    globalThis.localStorage = {
        getItem: () => { throw new Error('Storage disabled'); },
        setItem: () => { throw new Error('Quota exceeded'); }
    };
    globalThis.fetch = async () => Response.json({ data: { Media: media } });
    assert.doesNotThrow(() => api.setCachedData('anilist_detail_995', media));
    assert.equal((await api.fetchAnimeById(995)).id, 100);
});

test('homepage loaders do not fetch or render on browse and search pages', async () => {
    const { initAnimeGrid } = await import('../scripts/anime-grid.mjs');
    const { initHeroSlider } = await import('../scripts/hero-slider.mjs');
    globalThis.document = {
        getElementById: () => ({ innerHTML: 'existing results' }),
        querySelector: () => null
    };
    globalThis.fetch = () => { assert.fail('Unexpected homepage API request'); };
    await initAnimeGrid();
    assert.doesNotThrow(() => initHeroSlider());
});