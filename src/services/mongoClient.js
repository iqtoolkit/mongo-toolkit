const { MongoClient } = require('mongodb');

/**
 * Provides a short-lived MongoDB client for a single diagnostic run.
 */
async function withMongoClient(uri, dbName, task) {
  if (!uri) {
    throw new Error('A MongoDB connection string is required. Pass it with --uri.');
  }

  const client = new MongoClient(uri, {
    appName: 'mongo-toolkit',
    serverSelectionTimeoutMS: 5000,
  });

  await client.connect();

  try {
    const db = client.db(dbName);
    const adminDb = client.db('admin');
    return await task({ client, db, adminDb });
  } catch (error) {
    if (error.name === 'MongoServerSelectionError') {
      error.message = `Unable to reach MongoDB cluster. ${error.message}`;
    }

    throw error;
  } finally {
    await client.close().catch(() => undefined);
  }
}

module.exports = { withMongoClient };
