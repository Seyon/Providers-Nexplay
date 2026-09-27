import { TamilDhool } from './src/utils/TamilDhoolProvider.js';

const serials = [
  { title: 'Kayal', channel: 'Sun TV' },
  { title: 'Singapenne', channel: 'Sun TV' },
  { title: 'Sundari', channel: 'Sun TV' },
  { title: 'Marumagal', channel: 'Sun TV' },
  { title: 'Siragadikka Aasai', channel: 'Vijay TV' },
  { title: 'Baakiyalakshmi', channel: 'Vijay TV' },
  { title: 'Pandian Stores', channel: 'Vijay TV' },
  { title: 'Mahanadhi', channel: 'Vijay TV' },
  { title: 'Karthigai Deepam', channel: 'Zee Tamil' },
  { title: 'Sandhya Raagam', channel: 'Zee Tamil' },
  { title: 'Anna', channel: 'Zee Tamil' }
];

async function run() {
  console.log('Testing Serials on Server 1 (TamilDhool)...');
  for (const s of serials) {
    try {
      const res = await TamilDhool.findEpisodeByDate(s.title, '26-09-2026', s.channel);
      if (res && res.streamUrl) {
        console.log(`[PASS] [${s.channel}] ${s.title}: ${res.streamUrl.slice(0, 60)}...`);
        console.log(`       Page: ${res.matchedPageUrl}`);
        console.log(`       Server: ${res.server}`);
        console.log(`       Headers:`, JSON.stringify(res.headers));
      } else {
        console.log(`[FAIL] [${s.channel}] ${s.title}: No stream found!`);
      }
    } catch (e) {
      console.log(`[ERROR] [${s.channel}] ${s.title}:`, e.message);
    }
  }
}

run().catch(console.error);
