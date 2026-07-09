import { createHash } from "crypto";
import { readFile, readdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import OpenAI from "openai";

const POSTS_DIR = path.join(process.cwd(), "brand-assets", "linkedin_posts");
const CACHE_PATH = path.join(process.cwd(), "brand-assets", ".embeddings-cache.json");
const EMBEDDING_MODEL = "text-embedding-3-small";

let openai: OpenAI | null = null;
function getClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set in .env");
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

export interface ReferencePost {
  id: string;
  text: string;
  embedding: number[];
}

interface Cache {
  [id: string]: { hash: string; embedding: number[] };
}

function hashContent(text: string): string {
  return createHash("sha256").update(text).digest("hex");
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

export async function embed(text: string): Promise<number[]> {
  const client = getClient();
  const res = await client.embeddings.create({ model: EMBEDDING_MODEL, input: text });
  return res.data[0].embedding;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function loadReferencePosts(): Promise<ReferencePost[]> {
  if (!existsSync(POSTS_DIR)) return [];

  const files = (await readdir(POSTS_DIR)).filter(
    (f) => (f.endsWith(".md") || f.endsWith(".txt")) && !f.toLowerCase().startsWith("readme"),
  );

  const cache = await loadCache();
  let cacheDirty = false;
  const posts: ReferencePost[] = [];

  for (const file of files) {
    const text = (await readFile(path.join(POSTS_DIR, file), "utf-8")).trim();
    if (!text) continue;

    const hash = hashContent(text);
    const cached = cache[file];

    let embedding: number[];
    if (cached && cached.hash === hash) {
      embedding = cached.embedding;
    } else {
      embedding = await embed(text);
      cache[file] = { hash, embedding };
      cacheDirty = true;
    }

    posts.push({ id: file, text, embedding });
  }

  if (cacheDirty) await saveCache(cache);
  return posts;
}
