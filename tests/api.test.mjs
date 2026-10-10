import test from 'node:test';
import assert from 'node:assert/strict';

const storage = new Map();
globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key)
};

const { fetchCurrentAnime, fetchUpcomingAnime, fetchAnimeById, setCachedData } = await import('../scripts/api.mjs');

test('API requests are deduplicated, cached, retried, and report failures', async () => {
    let calls = 0;
    globalThis.fetch = async () => {
        calls += 1;
        return Response.json({ data: [{ mal_id: 1 }] });
    };
    const results = await Promise.all([fetchCurrentAnime(), fetchCurrentAnime()]);
    assert.deepEqual(results[0], [{ mal_id: 1 }]);
    assert.equal(calls, 1);
    await fetchCurrentAnime();
    assert.equal(calls, 1);

    globalThis.fetch = async () => {
        calls += 1;
        return calls === 2 ? new Response(null, { status: 429 }) : Response.json({ data: [{ mal_id: 2 }] });
    };
    assert.deepEqual(await fetchUpcomingAnime(), [{ mal_id: 2 }]);
    assert.equal(calls, 3);

    globalThis.fetch = async () => new Response(null, { status: 404 });
    await assert.rejects(fetchAnimeById(999), /HTTP 404/);
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    await assert.rejects(fetchAnimeById(998), /API unreachable/);
    globalThis.fetch = async () => Response.json({ error: 'missing data' });
    await assert.rejects(fetchAnimeById(997), /invalid API response/);
});

test('disabled browser storage does not prevent data from loading', async () => {
    globalThis.localStorage = {
        getItem: () => { throw new Error('Storage disabled'); },
        setItem: () => { throw new Error('Quota exceeded'); }
    };
    globalThis.fetch = async () => Response.json({ data: { mal_id: 996 } });
    assert.doesNotThrow(() => setCachedData('anime_detail_996', { mal_id: 996 }));
    assert.deepEqual(await fetchAnimeById(996), { mal_id: 996 });
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