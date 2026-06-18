import sharp from 'sharp'

// MatchTime icon — teal calendar with white clock
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <!-- Background -->
  <rect width="512" height="512" rx="112" fill="#003B5C"/>

  <!-- Calendar body -->
  <rect x="88" y="140" width="336" height="304" rx="32" fill="#00D4C8"/>

  <!-- Calendar top bar -->
  <rect x="88" y="140" width="336" height="88" rx="32" fill="#00bab0"/>
  <rect x="88" y="196" width="336" height="32" fill="#00bab0"/>

  <!-- Calendar rings -->
  <rect x="168" y="100" width="24" height="80" rx="12" fill="white"/>
  <rect x="320" y="100" width="24" height="80" rx="12" fill="white"/>

  <!-- Grid dots -->
  <rect x="136" y="280" width="36" height="36" rx="8" fill="white" opacity="0.9"/>
  <rect x="238" y="280" width="36" height="36" rx="8" fill="white" opacity="0.9"/>
  <rect x="340" y="280" width="36" height="36" rx="8" fill="white" opacity="0.9"/>

  <rect x="136" y="336" width="36" height="36" rx="8" fill="white" opacity="0.9"/>
  <rect x="238" y="336" width="36" height="36" rx="8" fill="white" opacity="0.9"/>
  <rect x="340" y="336" width="36" height="36" rx="8" fill="white" opacity="0.5"/>

  <rect x="136" y="392" width="36" height="36" rx="8" fill="white" opacity="0.9"/>
  <rect x="238" y="392" width="36" height="36" rx="8" fill="white" opacity="0.9"/>
</svg>`

const buf = Buffer.from(svg)

for (const size of [192, 512]) {
  await sharp(buf)
    .resize(size, size)
    .png()
    .toFile(`public/icon-${size}.png`)
  console.log(`✅ icon-${size}.png created`)
}

// Apple touch icon (180x180)
await sharp(buf).resize(180, 180).png().toFile('public/apple-touch-icon.png')
console.log('✅ apple-touch-icon.png created')
