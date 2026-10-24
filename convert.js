import fs from 'fs';
const image = fs.readFileSync('public/assets/aistudio/image_81c6e9a4.png');
fs.writeFileSync('base64.txt', image.toString('base64'));
