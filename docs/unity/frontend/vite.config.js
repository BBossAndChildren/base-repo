import {fileURLToPath} from 'node:url';
const installed=name=>fileURLToPath(new URL('../../scene-browser/node_modules/'+name,import.meta.url));
export default {base:'./',resolve:{alias:[{find:/^react$/,replacement:installed('react/index.js')},{find:/^react\/jsx-runtime$/,replacement:installed('react/jsx-runtime.js')},{find:/^react-dom\/client$/,replacement:installed('react-dom/client.js')}]},build:{outDir:'dist',emptyOutDir:false,rollupOptions:{input:fileURLToPath(new URL('./integration-example.html',import.meta.url))}}};
