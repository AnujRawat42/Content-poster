import { NextRequest, NextResponse } from "next/server";
import { generatePost } from "@/lib/generatePost";
import { POST_CATEGORIES } from "@/lib/types";
import type { GenerateRequest } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<GenerateRequest>;

  if (!body.topic || typeof body.topic !== "string") {
    return NextResponse.json({ error: "topic (string) is required" }, { status: 400 });
  }
  if (!body.category || !POST_CATEGORIES.includes(body.category)) {
    return NextResponse.json(
      { error: `category must be one of: ${POST_CATEGORIES.join(", ")}` },
      { status: 400 },
    );
  }
  if (!body.research) {
    return NextResponse.json({ error: "research object is required" }, { status: 400 });
  }

  try {
    const result = await generatePost(body as GenerateRequest);
    return NextResponse.json(result);
  } catch (err) {
    console.error("generate route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "generation failed" },
      { status: 500 },
    );
  }
}
