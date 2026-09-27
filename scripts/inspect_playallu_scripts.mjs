import axios from 'axios';

async function inspectPlayAlluScripts() {
  try {
    const res = await axios.get('https://play.playallu.xyz/play/v1/6ab68c136e1a2e5c9d5ff78a', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://arivumani.net/'
      },
      timeout: 10000
    });
    const html = res.data;
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    let idx = 1;
    while ((m = scriptRegex.exec(html)) !== null) {
      const code = m[1].trim();
      if (code.length > 20) {
        console.log(`\n=== SCRIPT ${idx++} ===`);
        console.log(code.slice(0, 1500));
      }
    }
  } catch (e) {
    console.error('PlayAllu error:', e.message);
  }
}

inspectPlayAlluScripts();
