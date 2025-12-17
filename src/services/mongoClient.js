const { MongoClient } = require('mongodb');

function redactMongoTarget(uri) {
  if (!uri || typeof uri !== 'string') return 'MongoDB';

  const schemeIndex = uri.indexOf('://');
  if (schemeIndex === -1) return 'MongoDB';

  const scheme = uri.slice(0, schemeIndex);
  const rest = uri.slice(schemeIndex + 3);

  // Strip credentials if present (user:pass@)
  const withoutCreds = rest.replace(/^([^@/]+)@/, '');

  // Keep only the host list (handles mongodb://host1,host2 and mongodb+srv://host)
  const hostList = withoutCreds.split('?')[0].split('/')[0];
  if (!hostList) return `${scheme}://<host>`;

  return `${scheme}://${hostList}`;
}

/**
 * Provides a short-lived MongoDB client for a single diagnostic run.
 */
async function withMongoClient(uri, dbName, task, hooks = {}) {
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

    if (typeof hooks.onConnected === 'function') {
      await hooks.onConnected({
        client,
        db,
        adminDb,
        dbName,
        target: redactMongoTarget(uri),
      });
    }

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
