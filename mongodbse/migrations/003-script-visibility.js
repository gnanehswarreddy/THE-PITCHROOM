export const name = "003-script-visibility";

async function ensureCollection(db, name) {
  const existing = await db.listCollections({ name }, { nameOnly: true }).toArray();
  if (!existing.length) {
    await db.createCollection(name);
  }
}

export async function up(db) {
  await ensureCollection(db, "scripts");

  await db.command({
    collMod: "scripts",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["title", "logline", "visibility"],
        properties: {
          userId: {
            anyOf: [
              { bsonType: "objectId" },
              { bsonType: "string" },
            ],
          },
          writer_id: { bsonType: "string" },
          title: { bsonType: "string", minLength: 1 },
          logline: { bsonType: "string", minLength: 1, maxLength: 200 },
          scriptContent: { bsonType: "string" },
          full_script_text: { bsonType: "string" },
          visibility: { enum: ["private", "public"] },
          createdAt: { bsonType: ["date", "string"] },
        },
      },
    },
    validationLevel: "moderate",
  }).catch(() => null);

  await db.collection("scripts").updateMany(
    { userId: { $exists: false }, writer_id: { $exists: true } },
    [{ $set: { userId: "$writer_id" } }],
  );

  await db.collection("scripts").updateMany(
    { visibility: { $exists: false } },
    { $set: { visibility: "private" } },
  );

  await db.collection("scripts").createIndex(
    { visibility: 1, createdAt: -1 },
    { name: "scripts_visibility_createdAt" },
  );

  await db.collection("scripts").createIndex(
    { userId: 1, createdAt: -1 },
    { name: "scripts_user_createdAt" },
  );
}
