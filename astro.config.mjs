import { defineConfig } from 'astro/config';

export default defineConfig({
    site: process.env.SITE_URL || 'https://anistream.itusebastian.com',
    base: process.env.BASE_PATH || '/',
    output: 'static',
    build: { format: 'file' }
});