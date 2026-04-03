export const name = "001-init";

export async function up(db) {
  const collections = [
    "users",
    "user_data",
    "profiles",
    "user_roles",
    "scripts",
    "stories",
    "script_versions",
    "character_profiles",
    "conversations",
    "messages",
    "notifications",
    "collections",
    "collection_shares",
    "script_views",
    "script_engagement",
    "posts",
    "post_comments",
    "post_likes",
    "course_enrollments",
    "file_uploads",
  ];

  const existing = new Set(await db.listCollections({}, { nameOnly: true }).toArray().then((items) => items.map((item) => item.name)));

  for (const collectionName of collections) {
    if (!existing.has(collectionName)) {
      await db.createCollection(collectionName);
    }
  }

  await db.collection("users").createIndex({ email: 1 }, { unique: true, name: "users_email_unique" });
  await db.collection("user_data").createIndex({ user_id: 1 }, { unique: true, name: "user_data_user_id_unique" });
  await db.collection("profiles").createIndex({ id: 1 }, { unique: true, name: "profiles_id_unique" });
  await db.collection("user_roles").createIndex({ user_id: 1 }, { unique: true, name: "user_roles_user_id_unique" });
  await db.collection("scripts").createIndex({ writer_id: 1, created_at: -1 }, { name: "scripts_writer_created_at" });
  await db.collection("stories").createIndex({ user_id: 1, updated_at: -1 }, { name: "stories_user_updated_at" });
  await db.collection("messages").createIndex({ conversation_id: 1, created_at: 1 }, { name: "messages_conversation_created_at" });
  await db.collection("notifications").createIndex({ user_id: 1, created_at: -1 }, { name: "notifications_user_created_at" });
  await db.collection("collections").createIndex({ producer_id: 1, script_id: 1 }, { name: "collections_producer_script" });
  await db.collection("script_views").createIndex({ script_id: 1, viewer_id: 1 }, { name: "script_views_script_viewer" });
  await db.collection("script_engagement").createIndex({ script_id: 1, user_id: 1 }, { name: "script_engagement_script_user" });
  await db.collection("course_enrollments").createIndex({ user_id: 1, course_id: 1 }, { unique: true, name: "course_enrollments_user_course_unique" });
  await db.collection("file_uploads").createIndex({ bucket: 1, file_id: 1 }, { unique: true, name: "file_uploads_bucket_file_unique" });
  await db.collection("file_uploads").createIndex({ owner_id: 1, created_at: -1 }, { name: "file_uploads_owner_created_at" });
  await db.collection("file_uploads").createIndex({ storage_path: 1 }, { unique: true, name: "file_uploads_storage_path_unique" });
}
