import { ObjectId } from "mongodb";

function averageVectors(vectors) {
  if (!vectors.length) return [];
  const dimensions = vectors[0].length;
  const accumulator = new Array(dimensions).fill(0);

  for (const vector of vectors) {
    for (let i = 0; i < dimensions; i += 1) {
      accumulator[i] += Number(vector[i] || 0);
    }
  }

  return accumulator.map((value) => value / vectors.length);
}

function uniqueStrings(values) {
  return [...new Set(values.map((item) => String(item || "").trim()).filter(Boolean))];
}

export class RecommendationService {
  constructor({ db, searchService }) {
    this.db = db;
    this.searchService = searchService;
  }

  async getUserSeedScriptIds(userId, limit = 40) {
    const fromInteractions = await this.db.collection("script_interactions")
      .find({ userId }, { projection: { scriptId: 1 } })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray();

    const fromViews = await this.db.collection("script_views")
      .find({ viewer_id: userId }, { projection: { script_id: 1 } })
      .limit(limit)
      .toArray();

    const fromEngagement = await this.db.collection("script_engagement")
      .find({ user_id: userId }, { projection: { script_id: 1 } })
      .limit(limit)
      .toArray();

    return uniqueStrings([
      ...fromInteractions.map((row) => row.scriptId),
      ...fromViews.map((row) => row.script_id),
      ...fromEngagement.map((row) => row.script_id),
    ]);
  }

  async getRecommendations(userId, { page = 1, pageSize = 10 } = {}) {
    const seedScriptIds = await this.getUserSeedScriptIds(userId);

    if (!seedScriptIds.length) {
      return this.searchService.getTrendingScripts({ page, pageSize });
    }

    const seedObjectIds = seedScriptIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    const seedScripts = await this.db.collection("scripts")
      .find({ _id: { $in: seedObjectIds } }, { projection: { embedding: 1, genre: 1 } })
      .toArray();

    const vectors = seedScripts.map((script) => script.embedding).filter((embedding) => Array.isArray(embedding) && embedding.length);
    if (!vectors.length) {
      return this.searchService.getTrendingScripts({ page, pageSize });
    }

    const centroid = averageVectors(vectors);
    const vectorResults = await this.searchService.vectorSearchByEmbedding(centroid, {
      page: 1,
      pageSize: Math.max(pageSize * 4, 40),
      candidateLimit: 120,
    });

    const interactedIds = new Set(seedScriptIds);
    const filtered = vectorResults.items.filter((item) => !interactedIds.has(item._id));

    const skip = (page - 1) * pageSize;
    const items = filtered.slice(skip, skip + pageSize);

    return {
      items,
      total: filtered.length,
      page,
      pageSize,
    };
  }
}
