import axios from 'axios';

async function getAllImages() {
  const images = new Set();
  const pages = [
    'https://arivumani.net/',
    'https://arivumani.net/categories/sun-tv/',
    'https://arivumani.net/categories/sun-tv/page/2/',
    'https://arivumani.net/categories/sun-tv/page/3/',
    'https://arivumani.net/categories/vijay-tv/',
    'https://arivumani.net/categories/vijay-tv/page/2/',
    'https://arivumani.net/categories/vijay-tv/page/3/',
    'https://arivumani.net/categories/zee-tamil/',
    'https://arivumani.net/categories/zee-tamil/page/2/',
    'https://arivumani.net/categories/zee-tamil/page/3/',
    'https://arivumani.net/categories/vijay-tv-shows/',
    'https://arivumani.net/categories/vijay-tv-shows/page/2/'
  ];
  for (const p of pages) {
    try {
      const res = await axios.get(p, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 6000 });
      const imgRegex = /src=["'](https?:\/\/[^"']*arivumani\.net\/wp-content\/uploads\/[^"']+\.(?:webp|jpg|png|avif))["']/gi;
      let m;
      while ((m = imgRegex.exec(res.data)) !== null) {
        if (!m[1].includes('Arivumani2') && !m[1].includes('360x240')) {
          images.add(m[1]);
        }
      }
    } catch(e) {}
  }
  console.log(`Total unique uploads collected: ${images.size}`);
  Array.from(images).forEach(img => console.log(img));
}
getAllImages();
