import axios from 'axios';

async function inspectVideoPost() {
  try {
    const res = await axios.get('https://arivumani.net/video/kayal-25-09-2026-vijay-tv/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    console.log('Page status:', res.status);
    const html = res.data;

    // Check iframes
    const iframeRegex = /<iframe[^>]*src=["']([^"']+)["'][^>]*>/gi;
    let m;
    console.log('IFRAMES:');
    while ((m = iframeRegex.exec(html)) !== null) {
      console.log(' - ', m[1]);
    }

    // Check video tags
    const videoRegex = /<source[^>]*src=["']([^"']+)["'][^>]*>/gi;
    console.log('SOURCES:');
    while ((m = videoRegex.exec(html)) !== null) {
      console.log(' - ', m[1]);
    }

    // Check any embed links or scripts
    const scriptRegex = /(?:file|source|src):\s*["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/gi;
    console.log('STREAM MATCHES:');
    while ((m = scriptRegex.exec(html)) !== null) {
      console.log(' - ', m[1]);
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

inspectVideoPost();
