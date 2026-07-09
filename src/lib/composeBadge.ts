import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import sharp, { type OverlayOptions } from "sharp";

const PROFILE_PICTURE_PATH = path.join(process.cwd(), "brand-assets", "Profile picture.png");
const LOGO_PATH = path.join(process.cwd(), "brand-assets", "Brand logo.png");

// Logo occupies this fraction of the slide's width, bottom-right corner.
const LOGO_WIDTH_RATIO = 0.22;

const BADGE_NAME = "Shubham Rawat";
const BADGE_HANDLE = "@scalelinks";
const VERIFIED_COLOR = "#1D9BF0"; // Twitter/X verified blue

const PHOTO_SIZE = 64;
const PADDING = 10;
const PILL_HEIGHT = 84;
const PILL_WIDTH = 360;

// Badge occupies this fraction of the slide's width, so it scales with any slide size.
const BADGE_WIDTH_RATIO = 0.5;
// Margin from the slide's top-left corner, as a fraction of slide width.
const MARGIN_RATIO = 0.04;

const TEXT_X = PADDING + PHOTO_SIZE + 14;
const NAME_BASELINE_Y = PILL_HEIGHT / 2 - 6;
const HANDLE_BASELINE_Y = PILL_HEIGHT / 2 + 22;
const NAME_FONT_SIZE = 22;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// The source profile picture is already circle-cropped with dark corners baked
// in. Crop to a slightly smaller centered square before clipping, so the badge
// circle only samples pixels inside the original circle (no dark edge arcs).
const PHOTO_INNER_CROP = 0.88;

async function preparePhoto(): Promise<Buffer> {
  const source = sharp(await readFile(PROFILE_PICTURE_PATH));
  const { width, height } = await source.metadata();
  if (!width || !height) throw new Error("could not read profile picture dimensions");

  const side = Math.floor(Math.min(width, height) * PHOTO_INNER_CROP);
  return source
    .extract({
      left: Math.floor((width - side) / 2),
      top: Math.floor((height - side) / 2),
      width: side,
      height: side,
    })
    .resize(PHOTO_SIZE, PHOTO_SIZE, { fit: "cover" })
    .png()
    .toBuffer();
}

async function buildBadgeSvg(): Promise<Buffer> {
  const photoBuffer = await preparePhoto();
  const photoBase64 = photoBuffer.toString("base64");

  const photoCenterX = PADDING + PHOTO_SIZE / 2;
  const photoCenterY = PILL_HEIGHT / 2;

  // Rough width estimate for bold Arial at NAME_FONT_SIZE, used only to place the checkmark.
  const approxNameWidth = BADGE_NAME.length * (NAME_FONT_SIZE * 0.58);
  const checkCx = TEXT_X + approxNameWidth + 26;
  const checkCy = NAME_BASELINE_Y - 6;

  const svg = `
<svg width="${PILL_WIDTH}" height="${PILL_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="photoClip">
      <circle cx="${photoCenterX}" cy="${photoCenterY}" r="${PHOTO_SIZE / 2}"/>
    </clipPath>
  </defs>
  <rect x="0" y="0" width="${PILL_WIDTH}" height="${PILL_HEIGHT}" rx="${PILL_HEIGHT / 2}" fill="rgba(0,0,0,0.6)"/>
  <image href="data:image/png;base64,${photoBase64}" x="${PADDING}" y="${(PILL_HEIGHT - PHOTO_SIZE) / 2}" width="${PHOTO_SIZE}" height="${PHOTO_SIZE}" clip-path="url(#photoClip)"/>
  <text x="${TEXT_X}" y="${NAME_BASELINE_Y}" font-family="Arial, sans-serif" font-weight="700" font-size="${NAME_FONT_SIZE}" fill="#ffffff">${escapeXml(BADGE_NAME)}</text>
  <circle cx="${checkCx}" cy="${checkCy}" r="10" fill="${VERIFIED_COLOR}"/>
  <path d="M${checkCx - 5} ${checkCy} l4 4 l7 -7.5" stroke="white" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="${TEXT_X}" y="${HANDLE_BASELINE_Y}" font-family="Arial, sans-serif" font-size="17" fill="#d0d3d4">${escapeXml(BADGE_HANDLE)}</text>
</svg>`;

  return Buffer.from(svg);
}

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

  const badgeSvg = await buildBadgeSvg();
  const targetBadgeWidth = Math.round(slideWidth * BADGE_WIDTH_RATIO);
  const badgePng = await sharp(badgeSvg, { density: 300 })
    .resize({ width: targetBadgeWidth })
    .png()
    .toBuffer();

  const margin = Math.round(slideWidth * MARGIN_RATIO);

  const composites: OverlayOptions[] = [{ input: badgePng, left: margin, top: margin }];

  if (existsSync(LOGO_PATH)) {
    const targetLogoWidth = Math.round(slideWidth * LOGO_WIDTH_RATIO);
    const logoPng = await sharp(await prepareLogo())
      .resize({ width: targetLogoWidth })
      .png()
      .toBuffer();
    const { height: logoHeight } = await sharp(logoPng).metadata();

    composites.push({
      input: logoPng,
      left: slideWidth - targetLogoWidth - margin,
      top: slideHeight - (logoHeight ?? 0) - margin,
    });
  }

  return slide.composite(composites).png().toBuffer();
}
