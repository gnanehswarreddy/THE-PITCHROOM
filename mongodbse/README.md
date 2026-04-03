This folder contains MongoDB-native backend assets that replace the old Supabase layout.

Structure:

- `functions/`: server-side handlers invoked by `/api/functions/:name`
- `migrations/`: database setup scripts such as collection creation and indexes
- `run-migrations.js`: executes migration files in order and records applied migrations

Run migrations with:

```bash
npm run migrate
```
