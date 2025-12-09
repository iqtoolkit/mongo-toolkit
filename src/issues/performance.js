const { getServerStatus } = require('../services/dataSources');

const DEFAULT_SLOW_MS = 500;

const performanceIssues = [
  {
    id: 'performance:slow-queries',
    category: 'performance',
    title: 'Slow query hotspots',
    severity: 'high',
    tags: ['profiler', 'query', 'plan'],
    description: 'Surface operations recorded in system.profile that exceed a configurable latency.',
    options: {
      slowMs: DEFAULT_SLOW_MS,
    },
    async run({ db, options = {} }) {
      const slowMs = Number(options.slowMs || options.threshold || DEFAULT_SLOW_MS);
      let profileStatus;

      try {
        profileStatus = await db.command({ profile: -1 });
      } catch (error) {
        return {
          status: 'error',
          summary: 'Unable to inspect profiler configuration.',
          details: { message: error.message },
          recommendation: 'Use a user with sufficient privileges to run db.command({ profile: -1 }).',
        };
      }

      if (!profileStatus || profileStatus.was === 0) {
        return {
          status: 'warn',
          summary: 'The profiler is disabled, so slow query samples are unavailable.',
          details: profileStatus,
          recommendation: 'Enable profiling temporarily or use Performance Advisor to capture slow operations.',
        };
      }

      let slowOps = [];
      try {
        slowOps = await db
          .collection('system.profile')
          .aggregate([
            { $match: { millis: { $gte: slowMs } } },
            { $sort: { millis: -1 } },
            { $limit: 5 },
            {
              $project: {
                _id: 0,
                ns: 1,
                millis: 1,
                op: 1,
                command: {
                  $cond: {
                    if: { $gt: ['$command.query', null] },
                    then: '$command.query',
                    else: '$command.filter',
                  },
                },
              },
            },
          ])
          .toArray();
      } catch (error) {
        return {
          status: 'error',
          summary: 'Profiler collection is not accessible.',
          details: { message: error.message },
          recommendation: 'Ensure profiling is enabled and the user can read system.profile.',
        };
      }

      if (slowOps.length === 0) {
        return {
          status: 'ok',
          summary: `No operations slower than ${slowMs} ms were present in system.profile.`,
        };
      }

      return {
        status: 'warn',
        summary: `${slowOps.length} operation(s) slower than ${slowMs} ms detected.`,
        details: slowOps,
        recommendation: 'Review the listed namespaces and add or tune indexes where necessary.',
      };
    },
  },
  {
    id: 'performance:wiredtiger-cache',
    category: 'performance',
    title: 'WiredTiger cache pressure',
    severity: 'medium',
    tags: ['wiredtiger', 'memory'],
    description: 'Checks if the WiredTiger cache is consistently above safe utilization levels.',
    async run({ adminDb, state }) {
      const serverStatus = await getServerStatus(state, adminDb);
      const cache = serverStatus?.wiredTiger?.cache;

      if (!cache) {
        return {
          status: 'info',
          summary: 'WiredTiger cache statistics are unavailable on this deployment.',
          details: { storageEngine: serverStatus?.storageEngine },
        };
      }

      const used = cache['bytes currently in the cache'] || 0;
      const dirty = cache['tracked dirty bytes in the cache'] || 0;
      const max = cache['maximum bytes configured'] || 1;
      const utilization = used / max;
      const dirtyRatio = dirty / max;

      let status = 'ok';
      if (utilization >= 0.95 || dirtyRatio >= 0.4) {
        status = 'critical';
      } else if (utilization >= 0.85) {
        status = 'warn';
      }

      return {
        status,
        summary: `Cache utilization ${(utilization * 100).toFixed(1)}% (dirty ${(dirtyRatio * 100).toFixed(1)}%).`,
        details: {
          usedBytes: used,
          dirtyBytes: dirty,
          maxBytes: max,
        },
        recommendation:
          status === 'ok'
            ? 'No action required. Keep utilization under 85% for predictable performance.'
            : 'Review working set size and consider increasing cache memory or reducing page cache usage.',
      };
    },
  },
];

module.exports = performanceIssues;
