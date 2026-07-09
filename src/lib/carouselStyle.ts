import { createHash } from "crypto";
import { readFile, readdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import OpenAI from "openai";

const REFERENCES_DIR = path.join(process.cwd(), "brand-assets", "carousel_references");
const CACHE_PATH = path.join(process.cwd(), "brand-assets", ".carousel-style-cache.json");
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

let openai: OpenAI | null = null;
function getClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set in .env");
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

interface Cache {
  [filename: string]: { hash: string; description: string };
}

function hashContent(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function loadCache(): Promise<Cache> {
  if (!existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(await readFile(CACHE_PATH, "utf-8"));
  } catch {
    return {};
  }
}

async function saveCache(cache: Cache): Promise<void> {
  await writeFile(CACHE_PATH, JSON.stringify(cache), "utf-8");
}

function mimeTypeFor(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

async function describeImage(buffer: Buffer, filename: string): Promise<string> {
  const client = getClient();
  const base64 = buffer.toString("base64");

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Describe this LinkedIn carousel slide's visual style for another AI to replicate: layout/grid, color palette, font style, text placement, icon/graphic motifs, and overall mood. Be specific and concise (4-6 sentences). Do not describe the literal text content, only the style.",
          },
          {
            type: "image_url",
            image_url: { url: `data:${mimeTypeFor(filename)};base64,${base64}` },
          },
        ],
      },
    ],
  });

  return completion.choices[0]?.message?.content?.trim() ?? "";
}

export async function loadCarouselStyleReferences(): Promise<string[]> {
  if (!existsSync(REFERENCES_DIR)) return [];

  const files = (await readdir(REFERENCES_DIR)).filter((f) =>
    IMAGE_EXTENSIONS.includes(path.extname(f).toLowerCase()),
  );
  if (files.length === 0) return [];

  const cache = await loadCache();
  let cacheDirty = false;
  const descriptions: string[] = [];

  for (const file of files) {
    const buffer = await readFile(path.join(REFERENCES_DIR, file));
    const hash = hashContent(buffer);
    const cached = cache[file];

    let description: string;
    if (cached && cached.hash === hash) {
      description = cached.description;
    } else {
      description = await describeImage(buffer, file);
      cache[file] = { hash, description };
      cacheDirty = true;
    }

    descriptions.push(description);
  }

  if (cacheDirty) await saveCache(cache);
  return descriptions;
}
