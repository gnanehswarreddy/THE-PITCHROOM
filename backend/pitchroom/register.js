import { createPitchRoomController } from "./controllers/pitchroom.controller.js";
import { createPitchRoomRouter } from "./routes/pitchroom.routes.js";
import { RecommendationService } from "./services/recommendation.service.js";
import { createGetRelevantScripts } from "./services/rag.service.js";
import { SearchService } from "./services/search.service.js";
import { ScriptService } from "./services/script.service.js";

export function registerPitchRoomRoutes({ app, db }) {
  const scriptService = ScriptService.create({
    db,
    openAiApiKey: process.env.OPENAI_API_KEY,
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
  });

  const searchService = new SearchService({
    db,
    embeddingService: scriptService.embeddingService,
    vectorIndexName: process.env.MONGODB_VECTOR_INDEX || "scripts_embedding_idx",
  });

  const recommendationService = new RecommendationService({
    db,
    searchService,
  });

  const getRelevantScripts = createGetRelevantScripts(searchService);

  const controller = createPitchRoomController({
    scriptService,
    searchService,
    recommendationService,
    getRelevantScripts,
  });

  app.use("/api", createPitchRoomRouter(controller));
}
