import { TamilDhool } from './src/utils/TamilDhoolProvider.js';

async function extractSerialsWithImages(categoryUrl, channelName) {
  const html = await TamilDhool.defaultHttpGet(categoryUrl);
  // Matches article with thumbnail and title
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
      list.push({ title, link, image, channel: channelName });
    }
  }
  return list;
}

async function run() {
  console.log('Extracting Server 1 (TamilDhool) Serial Posters & Thumbnails...');
  const sun = await extractSerialsWithImages('https://www.tamildhool.tech/sun-tv/sun-tv-serial/', 'Sun TV');
  console.log(`Sun TV (${sun.length} posts):`);
  sun.slice(0, 10).forEach(p => console.log(` - ${p.title}\n   Img: ${p.image}`));

  const vijay = await extractSerialsWithImages('https://www.tamildhool.tech/vijay-tv/vijay-tv-serial/', 'Vijay TV');
  console.log(`Vijay TV (${vijay.length} posts):`);
  vijay.slice(0, 10).forEach(p => console.log(` - ${p.title}\n   Img: ${p.image}`));

  const zee = await extractSerialsWithImages('https://www.tamildhool.tech/zee-tamil/zee-tamil-serial/', 'Zee Tamil');
  console.log(`Zee Tamil (${zee.length} posts):`);
  zee.slice(0, 10).forEach(p => console.log(` - ${p.title}\n   Img: ${p.image}`));
}

run().catch(console.error);
