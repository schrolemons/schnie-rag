import {defineConfig} from 'vitest/config';
export default defineConfig({test:{environment:'node',include:['tests/**/*.test.js','server/**/*.test.js','scripts/**/*.test.js']}});
