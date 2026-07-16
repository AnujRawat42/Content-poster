import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import sharp from "sharp";

const LOGO_PATH = path.join(process.cwd(), "brand-assets", "Brand logo.png");

// Logo occupies this fraction of the slide's width, centered at the bottom.
const LOGO_WIDTH_RATIO = 0.22;
// Margin from the slide's bottom edge, as a fraction of slide width.
const MARGIN_RATIO = 0.04;

// The logo file ships with a solid light background and padding baked in.
// Knock the background out to transparent (chroma-key against the corner
// pixel) and trim the empty border so it composites cleanly on any slide.
const LOGO_BG_TOLERANCE = 40;

async function prepareLogo(): Promise<Buffer> {
  const { data, info } = await sharp(await readFile(LOGO_PATH))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bgR = data[0];
  const bgG = data[1];
  const bgB = data[2];
  const tolSq = LOGO_BG_TOLERANCE * LOGO_BG_TOLERANCE;

  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i] - bgR;
    const dg = data[i + 1] - bgG;
    const db = data[i + 2] - bgB;
    if (dr * dr + dg * dg + db * db < tolSq) data[i + 3] = 0;
  }

  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim()
    .png()
    .toBuffer();
}

// Standalone infographics carry no profile badge, only the brand logo. It gets
// its own sizing/margin and a frosted backing chip so it stays legible and
// consistently placed regardless of the generated background behind it.
const LOGO_ONLY_WIDTH_RATIO = 0.24;
const LOGO_ONLY_MARGIN_RATIO = 0.05;
const LOGO_CHIP_PADDING_RATIO = 0.45; // relative to logo height

export async function overlayLogoOnly(imageBuffer: Buffer): Promise<Buffer> {
  const image = sharp(imageBuffer);
  const { width, height } = await image.metadata();
  if (!width || !height) throw new Error("could not read image dimensions");

  if (!existsSync(LOGO_PATH)) return image.png().toBuffer();

  const targetLogoWidth = Math.round(width * LOGO_ONLY_WIDTH_RATIO);
  const logoPng = await sharp(await prepareLogo())
    .resize({ width: targetLogoWidth })
    .png()
    .toBuffer();
  const { width: logoWidth, height: logoHeight } = await sharp(logoPng).metadata();
  if (!logoWidth || !logoHeight) throw new Error("could not read logo dimensions");

  const pad = Math.round(logoHeight * LOGO_CHIP_PADDING_RATIO);
  const chipWidth = logoWidth + pad * 2;
  const chipHeight = logoHeight + pad * 2;
  const stroke = Math.max(1, Math.round(chipHeight * 0.02));
  // White frosted pill with a hairline border and soft drop shadow so it reads
  // as a clean framed badge on both dark and light generated backgrounds.
  const shadowBlur = Math.round(chipHeight * 0.12);
  const svgW = chipWidth + shadowBlur * 4;
  const svgH = chipHeight + shadowBlur * 4;
  const chipSvg = Buffer.from(
    `<svg width="${svgW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="s" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="${shadowBlur * 0.4}" stdDeviation="${shadowBlur}" flood-color="rgba(0,0,0,0.28)"/>
        </filter>
      </defs>
      <rect x="${shadowBlur * 2}" y="${shadowBlur * 2}" width="${chipWidth}" height="${chipHeight}" rx="${chipHeight / 2}" fill="#ffffff" stroke="rgba(17,24,39,0.12)" stroke-width="${stroke}" filter="url(#s)"/>
    </svg>`,
  );
  const chipPng = await sharp(chipSvg).png().toBuffer();

  const margin = Math.round(width * LOGO_ONLY_MARGIN_RATIO);
  // Position the pill (ignoring its shadow padding) in the bottom-right margin.
  const chipLeft = width - chipWidth - shadowBlur * 2 - margin;
  const chipTop = height - chipHeight - shadowBlur * 2 - margin;

  return image
    .composite([
      { input: chipPng, left: chipLeft, top: chipTop },
      { input: logoPng, left: chipLeft + shadowBlur * 2 + pad, top: chipTop + shadowBlur * 2 + pad },
    ])
    .png()
    .toBuffer();
}

export async function overlayBadge(slideImageBuffer: Buffer): Promise<Buffer> {
  const slide = sharp(slideImageBuffer);
  const { width: slideWidth, height: slideHeight } = await slide.metadata();
  if (!slideWidth || !slideHeight) throw new Error("could not read slide image dimensions");

  if (!existsSync(LOGO_PATH)) return slide.png().toBuffer();

  const targetLogoWidth = Math.round(slideWidth * LOGO_WIDTH_RATIO);
  const logoPng = await sharp(await prepareLogo())
    .resize({ width: targetLogoWidth })
    .png()
    .toBuffer();
  const { width: logoWidth, height: logoHeight } = await sharp(logoPng).metadata();
  if (!logoWidth || !logoHeight) throw new Error("could not read logo dimensions");

  const margin = Math.round(slideWidth * MARGIN_RATIO);

  return slide
    .composite([
      {
        input: logoPng,
        left: Math.round((slideWidth - logoWidth) / 2),
        top: slideHeight - logoHeight - margin,
      },
    ])
    .png()
    .toBuffer();
}
