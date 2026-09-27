const { execSync } = require('child_process');
const fs = require('fs');

const devices = execSync('adb devices').toString().split('\n').filter(l => l.includes('\tdevice')).map(l => l.split('\t')[0].trim());
console.log('Devices:', devices);
if (devices.length > 0) {
  const dev = devices[0];
  const buf = execSync(`adb -s "${dev}" exec-out screencap -p`);
  fs.writeFileSync('C:/Users/Ajo/.gemini/antigravity-ide/brain/22cb0306-ce71-4a5d-9279-28987579db3c/device_screen_live.png', buf);
  console.log('Screenshot saved, size:', buf.length);
}
