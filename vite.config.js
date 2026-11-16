import {defineConfig} from 'vite';
export default defineConfig({envPrefix:['VITE_','PUBLIC_'],oxc:{jsx:{runtime:'automatic'}},server:{proxy:{'/api':'http://127.0.0.1:8787'}},build:{outDir:'dist'}});
