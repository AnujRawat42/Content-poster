import { NextRequest, NextResponse } from "next/server";
import { researchTopic } from "@/lib/exa";

export async function POST(req: NextRequest) {
  const { topic } = await req.json();

  if (!topic || typeof topic !== "string") {
    return NextResponse.json({ error: "topic (string) is required" }, { status: 400 });
  }

  try {
    const research = await researchTopic(topic);
    return NextResponse.json(research);
  } catch (err) {
    console.error("research route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "research failed" },
      { status: 500 },
    );
  }
}
