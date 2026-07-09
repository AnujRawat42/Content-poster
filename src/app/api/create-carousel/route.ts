import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { researchTopic } from "@/lib/exa";
import { generateCarouselPrompt } from "@/lib/generateCarouselPrompts";
import { generateCarouselSlides } from "@/lib/kieAi";
import { generatePost } from "@/lib/generatePost";
import { overlayBadge } from "@/lib/composeBadge";
import type { CarouselResponse, CreateCarouselRequest } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<CreateCarouselRequest>;

  if (!body.topic || typeof body.topic !== "string") {
    return NextResponse.json({ error: "topic (string) is required" }, { status: 400 });
  }
  const topic = body.topic;

  try {
    const research = await researchTopic(topic);
    const prompt = await generateCarouselPrompt(topic, research, body.carouselInstructions);

    const sessionId = `${Date.now()}-${randomBytes(4).toString("hex")}`;
    const outputDir = path.join(process.cwd(), "public", "generated", sessionId);
    await mkdir(outputDir, { recursive: true });

    // Generate the slide images and the accompanying LinkedIn caption in
    // parallel — the caption only needs the research, not the images.
    const [{ wideImage, slides: rawSlides }, { draft: caption }] = await Promise.all([
      generateCarouselSlides(prompt),
      generatePost({ topic, research }),
    ]);
    await writeFile(path.join(outputDir, "wide-original.png"), wideImage);

    const slides = await Promise.all(
      rawSlides.map(async (rawSlide, i) => {
        const finalImage = await overlayBadge(rawSlide);
        const filename = `slide-${i + 1}.png`;
        await writeFile(path.join(outputDir, filename), finalImage);
        return `/generated/${sessionId}/${filename}`;
      }),
    );

    const response: CarouselResponse = { sessionId, slides, research, caption };
    return NextResponse.json(response);
  } catch (err) {
    console.error("create-carousel route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "carousel creation failed" },
      { status: 500 },
    );
  }
}
