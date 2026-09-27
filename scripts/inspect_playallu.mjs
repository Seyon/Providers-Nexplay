import axios from 'axios';

async function inspectPlayAllu() {
  try {
    const res = await axios.get('https://play.playallu.xyz/play/v1/6ab68c136e1a2e5c9d5ff78a', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://arivumani.net/'
      },
      timeout: 10000
    });
    console.log('PlayAllu Status:', res.status);
    console.log('PlayAllu HTML preview (first 1000 chars):');
    console.log(res.data.slice(0, 1000));
  } catch (e) {
    console.error('PlayAllu error:', e.message);
  }
}

inspectPlayAllu();
