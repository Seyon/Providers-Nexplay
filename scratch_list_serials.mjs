import { COMPREHENSIVE_ALL_SERIALS, COMPREHENSIVE_ALL_REALITY, COMPREHENSIVE_ALL_PROGRAMMES } from './src/utils/TvSerialsLiveScraper.js';

console.log('--- Serials (' + COMPREHENSIVE_ALL_SERIALS.length + ') ---');
COMPREHENSIVE_ALL_SERIALS.forEach((s, i) => {
  console.log((i + 1) + '. [' + s.channelCode + '] ' + s.title + ' -> ' + s.image);
});

console.log('\n--- Reality (' + COMPREHENSIVE_ALL_REALITY.length + ') ---');
COMPREHENSIVE_ALL_REALITY.forEach((r, i) => {
  console.log((i + 1) + '. [' + r.channelCode + '] ' + r.title + ' -> ' + r.image);
});

console.log('\n--- Programmes (' + COMPREHENSIVE_ALL_PROGRAMMES.length + ') ---');
COMPREHENSIVE_ALL_PROGRAMMES.forEach((p, i) => {
  console.log((i + 1) + '. [' + p.channelCode + '] ' + p.title + ' -> ' + p.image);
});
