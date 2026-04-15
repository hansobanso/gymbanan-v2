import sharp from 'sharp';

const sizes = [
  { size: 512, file: 'public/icon-512.png' },
  { size: 192, file: 'public/icon-192.png' },
  { size: 180, file: 'public/apple-touch-icon.png' }
];

const svg = `<svg xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 100 100" width="512" height="512">
  <rect width="100" height="100" rx="22" fill="#0a0a0a"/>
  <text x="50" y="72" font-size="60"
    text-anchor="middle" font-family="Apple Color Emoji,
    Noto Color Emoji,serif">🍌</text>
</svg>`;

const buf = Buffer.from(svg);
for (const { size, file } of sizes) {
  await sharp(buf).resize(size, size).png().toFile(file);
  console.log('Generated', file);
}
