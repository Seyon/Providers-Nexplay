import { TamilDhool } from './src/utils/TamilDhoolProvider.js';

async function extractShows(categoryUrl, name) {
  const html = await TamilDhool.defaultHttpGet(categoryUrl);
  const postRegex = /<article[^>]*>([\s\S]*?)<\/article>/gi;
  let m;
  const list = [];
  const seen = new Set();
  
  while ((m = postRegex.exec(html)) !== null) {
    const postBody = m[1];
    const linkMatch = postBody.match(/<a\s+[^>]*href=["'](https?:\/\/[^"']*tamildhool\.tech\/[^"']+)["'][^>]*>/i);
    const titleMatch = postBody.match(/<h[1-6][^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i) ||
                       postBody.match(/<a[^>]*title=["']([^"']+)["']/i);
    const imgMatch = postBody.match(/<img\s+[^>]*src=["'](https?:\/\/[^"']+)["'][^>]*>/i) ||
                     postBody.match(/data-src=["'](https?:\/\/[^"']+)["']/i);

    const link = linkMatch ? linkMatch[1] : '';
    let title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    let image = imgMatch ? imgMatch[1] : '';

    if (link && !seen.has(title)) {
      seen.add(title);
      list.push({ title, link, image, category: name });
    }
  }
  return list;
}

async function run() {
  console.log('Extracting Reality Shows & Programmes...');
  const sunShows = await extractShows('https://www.tamildhool.tech/sun-tv/sun-tv-show/', 'Sun TV Shows');
  console.log(`Sun TV Shows (${sunShows.length}):`);
  sunShows.slice(0, 5).forEach(p => console.log(` - ${p.title}\n   Img: ${p.image}`));

  const vijayShows = await extractShows('https://www.tamildhool.tech/vijay-tv/vijay-tv-show/', 'Vijay TV Shows');
  console.log(`Vijay TV Shows (${vijayShows.length}):`);
  vijayShows.slice(0, 5).forEach(p => console.log(` - ${p.title}\n   Img: ${p.image}`));

  const zeeShows = await extractShows('https://www.tamildhool.tech/zee-tamil/zee-tamil-show/', 'Zee Tamil Shows');
  console.log(`Zee Tamil Shows (${zeeShows.length}):`);
  zeeShows.slice(0, 5).forEach(p => console.log(` - ${p.title}\n   Img: ${p.image}`));
}

run().catch(console.error);
