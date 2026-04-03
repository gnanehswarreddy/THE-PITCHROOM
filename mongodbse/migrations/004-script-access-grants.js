export const name = "004-script-access-grants";

export async function up(db) {
  const existingCollections = new Set(
    await db.listCollections({}, { nameOnly: true }).toArray().then((items) => items.map((item) => item.name)),
  );

  if (!existingCollections.has("script_access_grants")) {
    await db.createCollection("script_access_grants");
  }

  await db.collection("script_access_grants").createIndex(
    { script_id: 1, producer_id: 1 },
    { unique: true, name: "script_access_grants_script_producer_unique" },
  );

  await db.collection("script_access_grants").createIndex(
    { writer_id: 1, status: 1, updated_at: -1 },
    { name: "script_access_grants_writer_status_updated_at" },
  );

  await db.collection("script_access_grants").createIndex(
    { producer_id: 1, status: 1, updated_at: -1 },
    { name: "script_access_grants_producer_status_updated_at" },
  );
}
