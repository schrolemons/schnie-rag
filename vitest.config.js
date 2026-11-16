import {defineConfig} from 'vitest/config';
export default defineConfig({oxc:{jsx:{runtime:'automatic'}},test:{environment:'jsdom',globals:true,setupFiles:['./src/launcher/test/setup.ts'],include:['tests/**/*.test.js','server/**/*.test.js','scripts/**/*.test.js','src/**/*.test.ts','src/**/*.test.tsx']}});
