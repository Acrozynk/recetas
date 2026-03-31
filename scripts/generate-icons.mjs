import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(__dirname, '../public/icons');

// Read SVG files and convert to PNG
async function generateIcons() {
  const sizes = [180, 192, 512];
  
  for (const size of sizes) {
    // Use the 512 SVG as source for best quality
    const svgPath = path.join(iconsDir, 'icon-512x512.svg');
    const svgContent = fs.readFileSync(svgPath, 'utf8');
    
    const pngPath = path.join(iconsDir, `icon-${size}x${size}.png`);
    
    await sharp(Buffer.from(svgContent))
      .resize(size, size)
      .png()
      .toFile(pngPath);
    
    console.log(`✓ Generated ${pngPath}`);
  }
  
  // Also create apple-touch-icon.png (180x180 is Apple's recommended size)
  const appleTouchIcon = path.join(__dirname, '../public/apple-touch-icon.png');
  const svgContent = fs.readFileSync(path.join(iconsDir, 'icon-512x512.svg'), 'utf8');
  
  await sharp(Buffer.from(svgContent))
    .resize(180, 180)
    .png()
    .toFile(appleTouchIcon);
  
  console.log(`✓ Generated ${appleTouchIcon}`);

  // Vercel project dashboard avatar: keep in sync with app/icon.svg (Next.js app icon)
  const appIconSvgPath = path.join(__dirname, '../app/icon.svg');
  const vercelLogoPng = path.join(__dirname, '../public/logo.png');
  const appIconSvg = fs.readFileSync(appIconSvgPath, 'utf8');
  await sharp(Buffer.from(appIconSvg))
    .resize(512, 512)
    .png()
    .toFile(vercelLogoPng);
  console.log(`✓ Generated ${vercelLogoPng} (from app/icon.svg)`);
}

generateIcons().catch(console.error);






























