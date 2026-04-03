import { ObjectId } from "mongodb";
import { parsePagination } from "../utils/pagination.js";
import { normalizeDoc } from "../utils/normalizers.js";
import { TtlCache } from "./cache.service.js";

function normalizeScore(rawScore, maxScore) {
  if (!maxScore || maxScore <= 0) return 0;
  return Number(rawScore || 0) / maxScore;
}

export class SearchService {
  constructor({ db, embeddingService, vectorIndexName = "scripts_embedding_idx" }) {
    this.db = db;
    this.embeddingService = embeddingService;
    this.vectorIndexName = vectorIndexName;
    this.cache = new TtlCache(2 * 60 * 1000);
  }

  async vectorSearchByEmbedding(queryVector, { page = 1, pageSize = 10, candidateLimit = 80 } = {}) {
    const scriptsCollection = this.db.collection("scripts");

    let docs;
    try {
      docs = await scriptsCollection
        .aggregate([
          {
            $vectorSearch: {
              index: this.vectorIndexName,
              path: "embedding",
              queryVector,
              numCandidates: Math.max(candidateLimit * 2, 120),
              limit: candidateLimit,
            },
          },
          {
            $match: {
              visibility: "public",
            },
          },
          {
            $project: {
              title: 1,
              logline: { $ifNull: ["$logline", "$description"] },
              genre: 1,
              tags: 1,
              authorId: { $ifNull: ["$userId", "$authorId"] },
              createdAt: { $ifNull: ["$createdAt", "$created_at"] },
              summary: 1,
              metrics: 1,
              visibility: 1,
              vectorScore: { $meta: "vectorSearchScore" },
            },
          },
        ])
        .toArray();
    } catch (error) {
      throw new Error(
        `Vector search failed. Ensure Atlas vector index '${this.vectorIndexName}' exists on scripts.embedding. ${error.message}`,
      );
    }

    const pagination = parsePagination({ page, pageSize }, { page: 1, pageSize: 10, maxPageSize: 50 });
    const pageItems = docs.slice(pagination.skip, pagination.skip + pagination.pageSize);

    return {
      items: normalizeDoc(pageItems),
      total: docs.length,
      page: pagination.page,
      pageSize: pagination.pageSize,
    };
  }

  async vectorSearch(query, options = {}) {
    const embedding = await this.embeddingService.embedText(query);
    return this.vectorSearchByEmbedding(embedding, options);
  }

  async hybridSearch(query, { page = 1, pageSize = 10 } = {}) {
    const cacheKey = `hybrid:${query}:${page}:${pageSize}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const embedding = await this.embeddingService.embedText(query);

    const vectorCandidatesPromise = this.db.collection("scripts")
      .aggregate([
        {
          $vectorSearch: {
            index: this.vectorIndexName,
            path: "embedding",
            queryVector: embedding,
            numCandidates: 160,
            limit: 80,
          },
        },
        {
          $match: {
            visibility: "public",
          },
        },
        {
          $project: {
            title: 1,
            logline: { $ifNull: ["$logline", "$description"] },
            genre: 1,
            tags: 1,
            authorId: { $ifNull: ["$userId", "$authorId"] },
            createdAt: { $ifNull: ["$createdAt", "$created_at"] },
            summary: 1,
            metrics: 1,
            visibility: 1,
            vectorScore: { $meta: "vectorSearchScore" },
          },
        },
      ])
      .toArray();

    const textCandidatesPromise = this.db.collection("scripts")
      .find(
        { $text: { $search: query }, visibility: "public" },
        {
          projection: {
            title: 1,
            logline: 1,
            description: 1,
            genre: 1,
            tags: 1,
            userId: 1,
            authorId: 1,
            createdAt: 1,
            created_at: 1,
            summary: 1,
            metrics: 1,
            visibility: 1,
            textScore: { $meta: "textScore" },
          },
        },
      )
      .sort({ score: { $meta: "textScore" } })
      .limit(80)
      .toArray();

    let vectorCandidates = [];
    let textCandidates = [];

    try {
      [vectorCandidates, textCandidates] = await Promise.all([vectorCandidatesPromise, textCandidatesPromise]);
    } catch (error) {
      throw new Error(`Hybrid search failed: ${error.message}`);
    }

    const maxVectorScore = Math.max(1, ...vectorCandidates.map((item) => Number(item.vectorScore || 0)));
    const maxTextScore = Math.max(1, ...textCandidates.map((item) => Number(item.textScore || 0)));

    const mergedById = new Map();

    for (const item of vectorCandidates) {
      const id = item._id.toString();
      mergedById.set(id, {
        ...item,
        _id: new ObjectId(id),
        vectorScore: Number(item.vectorScore || 0),
        textScore: 0,
      });
    }

    for (const item of textCandidates) {
      const id = item._id.toString();
      const existing = mergedById.get(id);
      if (existing) {
        existing.textScore = Number(item.textScore || 0);
      } else {
        mergedById.set(id, {
          ...item,
          _id: new ObjectId(id),
          vectorScore: 0,
          textScore: Number(item.textScore || 0),
        });
      }
    }

    const ranked = [...mergedById.values()]
      .map((item) => {
        const vectorSimilarity = normalizeScore(item.vectorScore, maxVectorScore);
        const textScore = normalizeScore(item.textScore, maxTextScore);
        const score = 0.7 * vectorSimilarity + 0.3 * textScore;

        return {
          ...item,
          vectorSimilarity,
          textRelevance: textScore,
          score,
        };
      })
      .sort((a, b) => b.score - a.score);

    const pagination = parsePagination({ page, pageSize }, { page: 1, pageSize: 10, maxPageSize: 50 });
    const pageItems = ranked.slice(pagination.skip, pagination.skip + pagination.pageSize);

    const response = {
      items: normalizeDoc(pageItems),
      total: ranked.length,
      page: pagination.page,
      pageSize: pagination.pageSize,
    };

    this.cache.set(cacheKey, response);
    return response;
  }

  async getTrendingScripts({ page = 1, pageSize = 10 } = {}) {
    const now = new Date();

    const trending = await this.db.collection("script_interactions")
      .aggregate([
        {
          $addFields: {
            ageHours: {
              $divide: [
                { $subtract: [now, "$updatedAt"] },
                1000 * 60 * 60,
              ],
            },
            interactionWeight: {
              $cond: [{ $eq: ["$type", "liked"] }, 3, 1],
            },
          },
        },
        {
          $addFields: {
            weightedScore: {
              $divide: ["$interactionWeight", { $add: [1, { $divide: ["$ageHours", 24] }] }],
            },
          },
        },
        {
          $group: {
            _id: "$scriptId",
            trendScore: { $sum: "$weightedScore" },
            interactions: { $sum: 1 },
          },
        },
        { $sort: { trendScore: -1 } },
        { $limit: 120 },
      ])
      .toArray();

    const scriptIds = trending.filter((item) => ObjectId.isValid(item._id)).map((item) => new ObjectId(item._id));
    const scripts = scriptIds.length
      ? await this.db.collection("scripts").find({ _id: { $in: scriptIds }, visibility: "public" }).toArray()
      : [];

    const byId = new Map(scripts.map((script) => [script._id.toString(), script]));
    const ranked = trending
      .map((item) => {
        const script = byId.get(item._id);
        if (!script) return null;
        return {
          _id: script._id,
          title: script.title,
          logline: script.logline || script.description || "",
          genre: script.genre || "",
          authorId: script.userId || script.authorId || script.writer_id || "",
          createdAt: script.createdAt || script.created_at || null,
          summary: script.summary || "",
          metrics: script.metrics || { likes: 0, views: 0 },
          visibility: "public",
          trendScore: item.trendScore,
          interactions: item.interactions,
        };
      })
      .filter(Boolean);

    const pagination = parsePagination({ page, pageSize }, { page: 1, pageSize: 10, maxPageSize: 50 });
    const pageItems = ranked.slice(pagination.skip, pagination.skip + pagination.pageSize);

    return {
      items: normalizeDoc(pageItems),
      total: ranked.length,
      page: pagination.page,
      pageSize: pagination.pageSize,
    };
  }
}
