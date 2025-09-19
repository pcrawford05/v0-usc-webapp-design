import { NextResponse } from "next/server";
import { cosineSimilarity } from "@/lib/similarity";
import embeddings from "../../../data/embeddings.json";
import { InferenceClient } from "@huggingface/inference";

const hf = new InferenceClient(process.env.HF_API_KEY!);

export async function POST(req: Request) {
  const { query } = await req.json();

  // Get embedding for the user query
  const embeddingResult = await hf.featureExtraction({
    model: "sentence-transformers/all-MiniLM-L6-v2",
    inputs: query,
  });

  const queryEmbedding = embeddingResult as number[];

  // Compare against stored embeddings
  const scored = (embeddings as any[]).map((item) => ({
    ...item,
    score: cosineSimilarity(queryEmbedding, item.embedding),
  }));

  // Sort by score
  scored.sort((a, b) => b.score - a.score);

  return NextResponse.json(scored.slice(0, 5)); // top 5
}
