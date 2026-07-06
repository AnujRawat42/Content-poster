import type { PostCategory } from "./types";

export const CATEGORY_GUIDANCE: Record<PostCategory, string> = {
  "Personal stories":
    "Structure as a narrative: set a scene, describe a specific moment or turning point in the career journey, then land on the lesson learned. First-person, concrete details over abstractions.",
  "Listicles":
    "Use a numbered list (e.g. \"5 ways to...\" or \"3 things I learned...\"). Open with one line framing why the list matters, then each item gets 1-2 punchy sentences. Close with a takeaway line.",
  "Contrarian takes":
    "Open by stating the common belief, then directly challenge it with a clear counter-position. Back it with reasoning or a specific example. Confident tone, not combative.",
  "How-to guides":
    "Teach one practical, actionable thing. Open with the problem/outcome, then walk through clear steps (numbered or short paragraphs). End with a concrete next action the reader can take.",
  "Industry commentary":
    "React to a specific trend or piece of news. State what happened, give a sharp point of view on why it matters, and connect it back to the reader's own work or industry.",
  "Behind-the-scenes":
    "Show, don't tell: describe what's actually being built/learned right now, including a specific detail or struggle. Feels like a work-in-progress update, not a polished announcement.",
  "Thought experiments":
    "Pose an open question or hypothetical scenario early. Explore 2-3 angles briefly, then leave it open-ended or invite discussion rather than delivering a firm conclusion.",
};
