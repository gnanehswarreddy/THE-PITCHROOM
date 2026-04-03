export const name = "002-script-search-and-recommendations";

async function ensureCollection(db, collectionName) {
  const exists = await db.listCollections({ name: collectionName }).hasNext();
  if (!exists) {
    await db.createCollection(collectionName);
  }
}

export async function up(db) {
  await ensureCollection(db, "scripts");
  await ensureCollection(db, "embedding_cache");
  await ensureCollection(db, "script_interactions");

  await db.command({
    collMod: "scripts",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["title", "description", "genre", "tags", "authorId", "createdAt", "embedding"],
        properties: {
          title: { bsonType: "string" },
          description: { bsonType: "string" },
          genre: { bsonType: "string" },
          tags: { bsonType: "array", items: { bsonType: "string" } },
          authorId: { bsonType: "string" },
          createdAt: { bsonType: "date" },
          embedding: { bsonType: "array", items: { bsonType: "double" } },
        },
      },
    },
    validationLevel: "moderate",
  });

  await db.collection("scripts").createIndex(
    { title: "text", description: "text" },
    {
      name: "scripts_text_title_description",
      weights: { title: 5, description: 2 },
      default_language: "english",
    },
  );

  await db.collection("scripts").createIndex(
    { authorId: 1, createdAt: -1 },
    { name: "scripts_author_createdAt" },
  );

  await db.collection("scripts").createIndex(
    { genre: 1, createdAt: -1 },
    { name: "scripts_genre_createdAt" },
  );

  await db.collection("scripts").createIndex(
    { tags: 1 },
    { name: "scripts_tags" },
  );

  await db.collection("embedding_cache").createIndex(
    { hash: 1, model: 1 },
    { unique: true, name: "embedding_cache_hash_model_unique" },
  );

  await db.collection("embedding_cache").createIndex(
    { updatedAt: -1 },
    { name: "embedding_cache_updatedAt" },
  );

  await db.collection("script_interactions").createIndex(
    { userId: 1, updatedAt: -1 },
    { name: "script_interactions_user_updatedAt" },
  );

  await db.collection("script_interactions").createIndex(
    { scriptId: 1, type: 1, updatedAt: -1 },
    { name: "script_interactions_script_type_updatedAt" },
  );

  await db.collection("script_interactions").createIndex(
    { userId: 1, scriptId: 1, type: 1 },
    { unique: true, name: "script_interactions_user_script_type_unique" },
  );

  try {
    await db.command({
      createSearchIndexes: "scripts",
      indexes: [
        {
          name: process.env.MONGODB_VECTOR_INDEX || "scripts_embedding_idx",
          type: "vectorSearch",
          definition: {
            fields: [
              {
                type: "vector",
                path: "embedding",
                numDimensions: Number(process.env.EMBEDDING_DIMENSIONS || 1536),
                similarity: "cosine",
              },
            ],
          },
        },
      ],
    });
  } catch (error) {
    const message = String(error?.message || "");
    if (
      message.includes("already exists") ||
      message.includes("Index already exists") ||
      message.includes("command not found")
    ) {
      return;
    }

    throw error;
  }
}
