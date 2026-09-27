import fs from 'fs';

const content = fs.readFileSync('src/utils/TvSerialsLiveScraper.js', 'utf8');
const lines = content.split('\n');

const imgMap = new Map();
lines.forEach((l, idx) => {
  const m = l.match(/image:\s*['"]([^'"]+)['"]/);
  if (m) {
    const url = m[1];
    if (imgMap.has(url)) {
      console.log('Dupe:', url);
      console.log('  Original at line', imgMap.get(url));
      console.log('  Repeat at line', idx + 1);
    } else {
      imgMap.set(url, idx + 1);
    }
  }
});
