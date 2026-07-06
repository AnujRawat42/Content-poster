import { cosineSimilarity, embed, loadReferencePosts } from "./embeddings";

const TOP_K = 4;

export async function retrieveReferences(topic: string): Promise<string[]> {
  const posts = await loadReferencePosts();
  if (posts.length === 0) return [];

  const queryEmbedding = await embed(topic);

  const scored = posts
    .map((post) => ({ post, score: cosineSimilarity(queryEmbedding, post.embedding) }))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, TOP_K).map((s) => s.post.text);
}
