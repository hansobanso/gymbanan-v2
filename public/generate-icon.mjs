import sharp from 'sharp';

// App-ikon: nya banan-loggan centrerad pa svart, med gul ring runt.
const sizes = [
  { size: 512, file: 'public/icon-512.png' },
  { size: 192, file: 'public/icon-192.png' },
  { size: 180, file: 'public/apple-touch-icon.png' },
];

// Banan behaller sin storlek (hojd ~560 i en 1000-ruta)
const targetH = 560;
const scale = targetH / 448;
const bw = 368 * scale;
const bh = 448 * scale;
const tx = (1000 - bw) / 2;
const ty = (1000 - bh) / 2;

// Gul ring: radie sa den omsluter bananen med lite luft.
// Bananens diagonal-radie ~ halva hojden + marginal.
const ringR = 305;          // radie i 1000-rutan
const ringW = 28;           // ringtjocklek

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
  <rect width="1000" height="1000" fill="#000000"/>
  <circle cx="500" cy="500" r="${ringR}" fill="none" stroke="#F5D020" stroke-width="${ringW}"/>
  <g transform="translate(${tx},${ty}) scale(${scale})">
    <g transform="matrix(0.636301,0,0,0.636301,-179.27,-188.032)" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M525.743,833.601C566.369,915.815 693.476,991.271 724.91,954.91C761.681,912.377 680.659,849.072 634.187,743.13C600.613,666.589 592.627,632.492 608.18,630.444C648.867,625.086 703.359,695.016 723.545,703.71C765.184,721.642 726.672,572.647 637.694,553.745" stroke="#F5D020" stroke-width="33.91"/>
      <path d="M414.853,593.167C358.586,695.278 475.158,894.161 470.34,787.871C465.935,690.684 496.752,640.851 539.852,615.322" stroke="#F5D020" stroke-width="33.91"/>
      <path d="M450.065,526.833C480.4,361.306 652.342,282.173 688.014,326.87C715.159,360.882 648.301,387.739 608.609,449.278C578.899,495.34 574.54,535.463 581.649,566.785" stroke="#FFFFFF" stroke-width="33.91"/>
    </g>
  </g>
</svg>`;

const buf = Buffer.from(svg);
for (const { size, file } of sizes) {
  await sharp(buf).resize(size, size).png().toFile(file);
  console.log('Generated', file);
}
console.log('Done');
