const { getDbStats } = require('../services/dataSources');

const storageIssues = [
  {
    id: 'storage:fragmentation',
    category: 'storage',
    title: 'Collection fragmentation',
    severity: 'medium',
    tags: ['storage', 'compression'],
    description: 'Compares logical data size with on-disk storage to highlight fragmentation.',
    async run({ db, state }) {
      const stats = await getDbStats(state, db);
      const dataSize = stats.dataSize || 0;
      const storageSize = stats.storageSize || 1;
      const fragmentation = storageSize === 0 ? 0 : 1 - dataSize / storageSize;

      let status = 'ok';
      if (fragmentation > 0.4) {
        status = 'critical';
      } else if (fragmentation > 0.25) {
        status = 'warn';
      }

      return {
        status,
        summary: `Logical data ${(dataSize / (1024 * 1024)).toFixed(1)} MiB vs storage ${(storageSize / (1024 * 1024)).toFixed(1)} MiB (fragmentation ${(fragmentation * 100).toFixed(1)}%).`,
        details: stats,
        recommendation:
          status === 'ok'
            ? 'No action required.'
            : 'Run compact on the most bloated collections or re-sync via mongodump/mongorestore during maintenance.',
      };
    },
  },
  {
    id: 'storage:largest-collections',
    category: 'storage',
    title: 'Largest collections',
    severity: 'info',
    tags: ['storage', 'capacity'],
    description: 'Lists the heaviest collections by storage size inside the target database.',
    async run({ db }) {
      const collections = await db.listCollections({}, { nameOnly: true }).toArray();
      const sample = collections.slice(0, 25);

      const stats = [];
      for (const coll of sample) {
        try {
          const collStats = await db.command({ collStats: coll.name, scale: 1 });
          stats.push({
            collection: coll.name,
            storageBytes: collStats.storageSize,
            count: collStats.count,
            avgObjSize: collStats.avgObjSize,
          });
        } catch (error) {
          stats.push({ collection: coll.name, error: error.message });
        }
      }

      const largest = stats
        .filter((row) => row.storageBytes)
        .sort((a, b) => b.storageBytes - a.storageBytes)
        .slice(0, 5);

      return {
        status: 'info',
        summary: `Analyzed ${sample.length} collections (showing top ${largest.length}).`,
        details: largest.map((row) => ({
          collection: row.collection,
          storageMB: (row.storageBytes / (1024 * 1024)).toFixed(1),
          docs: row.count,
          avgObjSize: row.avgObjSize,
        })),
        recommendation: 'Keep an eye on fast-growing collections. Consider sharding or archiving cold data.',
      };
    },
  },
];

module.exports = storageIssues;
