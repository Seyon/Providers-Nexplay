import { TamilDhool } from './src/utils/TamilDhoolProvider.js';

async function run() {
  console.log('Fetching Vijay TV Serials category page...');
  const htmlVijay = await TamilDhool.defaultHttpGet('https://www.tamildhool.tech/vijay-tv/vijay-tv-serial/');
  const linksVijay = [...htmlVijay.matchAll(/<a\s+[^>]*href=["'](https?:\/\/[^"']*tamildhool\.tech\/vijay-tv\/vijay-tv-serial\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const seenVijay = new Set();
  console.log('Vijay TV Serials found on Tamildhool:');
  for (const l of linksVijay) {
    const url = l[1];
    const text = l[2].replace(/<[^>]+>/g, '').trim();
    if (url !== 'https://www.tamildhool.tech/vijay-tv/vijay-tv-serial/' && !seenVijay.has(url) && !url.includes('/page/')) {
      seenVijay.add(url);
      console.log(` - [${text}] -> ${url}`);
    }
  }

  console.log('\nFetching Zee Tamil Serials category page...');
  const htmlZee = await TamilDhool.defaultHttpGet('https://www.tamildhool.tech/zee-tamil/zee-tamil-serial/');
  const linksZee = [...htmlZee.matchAll(/<a\s+[^>]*href=["'](https?:\/\/[^"']*tamildhool\.tech\/zee-tamil\/zee-tamil-serial\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const seenZee = new Set();
  console.log('Zee Tamil Serials found on Tamildhool:');
  for (const l of linksZee) {
    const url = l[1];
    const text = l[2].replace(/<[^>]+>/g, '').trim();
    if (url !== 'https://www.tamildhool.tech/zee-tamil/zee-tamil-serial/' && !seenZee.has(url) && !url.includes('/page/')) {
      seenZee.add(url);
      console.log(` - [${text}] -> ${url}`);
    }
  }
}

run().catch(console.error);
