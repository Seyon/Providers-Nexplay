import { TamilDhool } from './src/utils/TamilDhoolProvider.js';

async function run() {
  const html = await TamilDhool.defaultHttpGet('https://www.tamildhool.tech/sun-tv/sun-tv-serial/singappenne/');
  const links = [...html.matchAll(/<a\s+[^>]*href=["'](https?:\/\/[^"']*tamildhool\.tech\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const eps = links.filter(l => l[1].includes('singappenne-') || l[1].includes('singapenne-'));
  console.log('Singappenne direct category episodes:', eps.length);
  eps.slice(0, 5).forEach(e => console.log(' ->', e[1]));
}

run().catch(console.error);
