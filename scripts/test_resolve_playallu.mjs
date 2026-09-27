import { TamilGun } from '../src/providers/tamilgun/TamilGunProvider.js';

async function testPlayAllu() {
  const url = 'https://play.playallu.xyz/play/v1/6ab68c136e1a2e5c9d5ff78a';
  console.log('Testing PlayAllu resolver with URL:', url);
  try {
    const stream = await TamilGun.resolvePlayAllu(url, 'https://arivumani.net/');
    console.log('Stream resolved:', stream);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

testPlayAllu();
