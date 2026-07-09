import { NextRequest, NextResponse } from "next/server";
import { repurposeTwitter } from "@/lib/repurposeTwitter";
import type { RepurposeTwitterRequest, RepurposeTwitterResponse } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<RepurposeTwitterRequest>;

  if (!body.draft || typeof body.draft !== "string") {
    return NextResponse.json({ error: "draft (string) is required" }, { status: 400 });
  }

  try {
    const { thread } = await repurposeTwitter(body.draft);
    const response: RepurposeTwitterResponse = { thread };
    return NextResponse.json(response);
  } catch (err) {
    console.error("repurpose-twitter route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "twitter repurpose failed" },
      { status: 500 },
    );
  }
}
