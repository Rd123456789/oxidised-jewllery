import mongoose from 'mongoose';
import { env } from '../config/env.js';

const serverSelectionTimeoutMS = 12_000;

/** Never log the password back out. */
function maskedUri(uri: string): string {
  return uri.replace(/\/\/([^:]+):[^@]+@/, '//$1:****@');
}

async function main(): Promise<void> {
  console.log(`Checking MongoDB: ${maskedUri(env.MONGODB_URI)}`);

  await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB_NAME,
    serverSelectionTimeoutMS,
    autoIndex: false,
  });

  const { host, name } = mongoose.connection;
  console.log(`OK       connected to ${host ?? 'unknown'}/${name ?? 'unknown'}`);

  const database = mongoose.connection.db;
  const collections = (await database?.listCollections().toArray()) ?? [];

  if (collections.length === 0) {
    console.log('         (empty - run `npm run seed` to load the demo store)');

    await mongoose.disconnect();
    return;
  }

  console.log(`         ${collections.length} collection(s):`);

  const rows: { collection: string; documents: number }[] = [];

  for (const collection of collections) {
    rows.push({
      collection: collection.name,
      documents: (await database?.collection(collection.name).countDocuments({})) ?? 0,
    });
  }

  const width = Math.max(...rows.map((row) => row.collection.length), 10);

  for (const row of rows.sort((a, b) => a.collection.localeCompare(b.collection))) {
    console.log(`           ${row.collection.padEnd(width)}  ${row.documents}`);
  }

  await mongoose.disconnect();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`FAILED   ${message}`);
  console.error('');
  console.error('Checklist:');
  console.error('  - Is MONGODB_URI in server/.env correct, with the password URL-encoded?');
  console.error('  - Did you create a database user under Security > Database Access?');
  console.error('  - Did you allow this machine IP under Security > Network Access?');
  console.error('  - Is the cluster fully created (not still "Provisioning")?');

  process.exit(1);
});
