import { TamilDhool } from '../src/providers/tamildhool/TamilDhoolProvider.js';
import { TamilGun } from '../src/providers/tamilgun/TamilGunProvider.js';

async function testScraper(metadataQuery) {
  console.log(`\n=== Testing Metadata Scraper with: "${metadataQuery}" ===`);
  const parts = metadataQuery.split('|').map(s => s.trim());
  const title = parts[0];
  const dateStr = parts[1] || '26-09-2026';
  const channel = (parts[2] || 'Sun Tv Serial').replace(/Serial|Show|Programme/gi, '').trim();

  console.log(`Parsed: Title="${title}", Date="${dateStr}", Channel="${channel}"`);

  // Test Server 2 (Tamilgun / Arivumani)
  console.log('\n--- Querying Server 2 (Tamilgun / Arivumani) ---');
  try {
    const resGun = await TamilGun.findEpisodeByDate(title, dateStr, channel);
    if (resGun) {
      console.log('Server 2 Matched Title:', resGun.matchedTitle);
      console.log('Server 2 Stream URL:', resGun.url);
      console.log('Server 2 Headers:', resGun.headers);
    } else {
      console.log('Server 2: No exact match, attempting search with metadata tokens...');
      const searchRes = await TamilGun.search(`${title} ${dateStr}`);
      console.log(`Server 2 search returned ${searchRes.length} items`);
      if (searchRes.length > 0) {
        console.log('First result:', searchRes[0].title, searchRes[0].link);
      }
    }
  } catch (e) {
    console.error('Server 2 error:', e.message);
  }

  // Test Server 1 (Tamildhool)
  console.log('\n--- Querying Server 1 (Tamildhool) ---');
  try {
    const resDhool = await TamilDhool.findEpisodeByDate(title, dateStr, channel);
    if (resDhool) {
      console.log('Server 1 Matched Title:', resDhool.post?.title);
      console.log('Server 1 Stream:', resDhool.bestStream?.url);
    } else {
      console.log('Server 1: Fallback search...');
    }
  } catch (e) {
    console.error('Server 1 error:', e.message);
  }
}

async function run() {
  await testScraper('Kayal | 26-09-2026 | Sun Tv Serial');
  await testScraper('Siragadikka Aasai | 26-09-2026 | Vijay Tv Serial');
}

run();
