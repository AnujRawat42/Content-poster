import { readFile, appendFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const FEEDBACK_PATH = path.join(process.cwd(), "brand-assets", "carousel_feedback.md");

export async function loadCarouselFeedback(): Promise<string> {
  if (!existsSync(FEEDBACK_PATH)) return "";
  return (await readFile(FEEDBACK_PATH, "utf-8")).trim();
}

export async function appendCarouselFeedback(feedback: string): Promise<void> {
  const entry = `\n## ${new Date().toISOString()}\n${feedback.trim()}\n`;
  await appendFile(FEEDBACK_PATH, entry, "utf-8");
}
