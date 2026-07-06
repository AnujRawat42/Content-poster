import { NextRequest, NextResponse } from "next/server";
import { researchTopic } from "@/lib/exa";
import { generatePost } from "@/lib/generatePost";
import { POST_CATEGORIES } from "@/lib/types";
import type { CreatePostRequest, CreatePostResponse } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<CreatePostRequest>;

  if (!body.topic || typeof body.topic !== "string") {
    return NextResponse.json({ error: "topic (string) is required" }, { status: 400 });
  }
  if (!body.category || !POST_CATEGORIES.includes(body.category)) {
    return NextResponse.json(
      { error: `category must be one of: ${POST_CATEGORIES.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const research = await researchTopic(body.topic);
    const { draft, referencesUsed } = await generatePost({
      topic: body.topic,
      category: body.category,
      research,
    });

    const response: CreatePostResponse = { draft, research, referencesUsed };
    return NextResponse.json(response);
  } catch (err) {
    console.error("create-post route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "post creation failed" },
      { status: 500 },
    );
  }
}
