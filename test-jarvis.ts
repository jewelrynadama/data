import { askJarvis } from './src/utils/aiEngine';
askJarvis('Halo JARVIS, siapa namamu?', []).then(console.log).catch(console.error);
