import { sha256 } from "../utils/hash.js";

const OPENAI_EMBEDDING_URL = "https://api.openai.com/v1/embeddings";

export class EmbeddingService {
  constructor({ db, apiKey, model = "text-embedding-3-small" }) {
    this.db = db;
    this.apiKey = apiKey;
    this.model = model;
  }

  static buildScriptEmbeddingInput({ title, description, tags }) {
    const tagText = Array.isArray(tags) ? tags.join(", ") : "";
    return [title, description, tagText].filter(Boolean).join("\n");
  }

  async embedText(inputText) {
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is required for embedding generation");
    }

    const normalizedInput = String(inputText || "").trim();
    if (!normalizedInput) {
      throw new Error("Cannot generate embedding for empty text");
    }

    const textHash = sha256(`${this.model}:${normalizedInput}`);
    const cacheCollection = this.db.collection("embedding_cache");
    const existing = await cacheCollection.findOne({ hash: textHash, model: this.model });
    if (existing?.embedding?.length) {
      return existing.embedding;
    }

    const response = await fetch(OPENAI_EMBEDDING_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: normalizedInput,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Embedding request failed (${response.status}): ${errorText}`);
    }

    const payload = await response.json();
    const embedding = payload?.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || !embedding.length) {
      throw new Error("Embedding response did not include a valid vector");
    }

    await cacheCollection.updateOne(
      { hash: textHash, model: this.model },
      {
        $set: {
          hash: textHash,
          model: this.model,
          embedding,
          textPreview: normalizedInput.slice(0, 200),
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );

    return embedding;
  }
}
