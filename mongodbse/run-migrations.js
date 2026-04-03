import { loadEnvFile } from "../backend/load-env.js";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { MongoClient } from "mongodb";

loadEnvFile();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, "migrations");

const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const dbName = process.env.MONGODB_DB || "pitchroom";

const client = new MongoClient(mongoUri);

async function run() {
  await client.connect();
  const db = client.db(dbName);
  const migrationState = db.collection("_migrations");

  await migrationState.createIndex({ name: 1 }, { unique: true, name: "migration_name_unique" });

  const applied = new Set(
    await migrationState.find({}, { projection: { name: 1 } }).toArray().then((docs) => docs.map((doc) => doc.name)),
  );

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".js"))
    .sort();

  for (const file of files) {
    const modulePath = pathToFileURL(path.join(migrationsDir, file)).href;
    const migration = await import(modulePath);
    const migrationName = migration.name || file.replace(/\.js$/, "");

    if (applied.has(migrationName)) {
      console.log(`Skipping ${migrationName}`);
      continue;
    }

    if (typeof migration.up !== "function") {
      throw new Error(`Migration ${file} does not export an up() function`);
    }

    console.log(`Applying ${migrationName}`);
    await migration.up(db);
    await migrationState.insertOne({ name: migrationName, applied_at: new Date().toISOString() });
  }

  console.log("Migrations complete");
}

run()
  .catch((error) => {
    console.error("Migration failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await client.close();
  });
