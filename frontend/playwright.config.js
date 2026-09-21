import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'../tests/e2e',testMatch:'*.spec.js',timeout:120000,workers:1,use:{baseURL:process.env.APP_URL||'http://localhost:8080',trace:'retain-on-failure'},reporter:'list'});
