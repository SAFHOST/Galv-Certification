import fs from 'fs';
const logoPng = fs.readFileSync('public/assets/aistudio/image_81c6e9a4.png');
const base64Logo = logoPng.toString('base64');
let templateAssets = fs.readFileSync('src/services/templateAssets.ts', 'utf8');

// Replace the logo string
templateAssets = templateAssets.replace(/logoJpgBase64: '.*?',/, `logoBase64: '${base64Logo}',`);

fs.writeFileSync('src/services/templateAssets.ts', templateAssets);
console.log('Updated templateAssets.ts');
