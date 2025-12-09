const { getReplStatus } = require('../services/dataSources');

function tsToDate(ts) {
  if (!ts) return null;
  if (typeof ts.getHighBits === 'function') {
    return new Date(ts.getHighBits() * 1000);
  }

  return ts instanceof Date ? ts : null;
}

const replicationIssues = [
  {
    id: 'replication:lag',
    category: 'replication',
    title: 'Replica set lag',
    severity: 'high',
    tags: ['replication', 'ha'],
    description: 'Calculates the largest lag between the primary and secondaries.',
    async run({ adminDb, state }) {
      const repl = await getReplStatus(state, adminDb);

      if (!repl) {
        return state.replStatusError
          ? {
              status: 'error',
              summary: 'Unable to retrieve replSetGetStatus.',
              details: { message: state.replStatusError.message },
              recommendation: 'Ensure the cluster is a replica set and the user has replSetGetStatus privileges.',
            }
          : {
              status: 'info',
              summary: 'This deployment is not part of a replica set.',
            };
      }

      const primary = repl.members?.find((member) => member.stateStr === 'PRIMARY');
      const secondaries = repl.members?.filter((member) => member.stateStr === 'SECONDARY') || [];

      if (!primary || secondaries.length === 0) {
        return {
          status: 'info',
          summary: 'Replica set does not expose secondary members or is still initializing.',
        };
      }

      const lagRows = secondaries.map((member) => {
        const primaryTime = new Date(primary.optimeDate).getTime();
        const memberTime = new Date(member.optimeDate).getTime();
        const lagSeconds = Math.max(0, (primaryTime - memberTime) / 1000);

        return {
          member: member.name,
          state: member.stateStr,
          lagSeconds,
        };
      });

      const worstLag = lagRows.reduce((max, row) => Math.max(max, row.lagSeconds), 0);
      let status = 'ok';
      if (worstLag >= 60) {
        status = 'critical';
      } else if (worstLag >= 15) {
        status = 'warn';
      }

      return {
        status,
        summary: `Worst replication lag ${worstLag.toFixed(1)}s among ${lagRows.length} secondary member(s).`,
        details: lagRows,
        recommendation:
          status === 'ok'
            ? 'Replication is healthy.'
            : 'Check network latency, disk throughput, and long-running operations on lagging members.',
      };
    },
  },
  {
    id: 'replication:oplog-window',
    category: 'replication',
    title: 'Oplog window coverage',
    severity: 'medium',
    tags: ['replication', 'oplog'],
    description: 'Measures how many hours of history are retained in the oplog.',
    async run({ client }) {
      let oldest;
      let newest;
      try {
        const localDb = client.db('local');
        const oplog = localDb.collection('oplog.rs');
        oldest = await oplog.find({}, { projection: { ts: 1, wallTime: 1 } }).sort({ ts: 1 }).limit(1).next();
        newest = await oplog.find({}, { projection: { ts: 1, wallTime: 1 } }).sort({ ts: -1 }).limit(1).next();
      } catch (error) {
        return {
          status: 'error',
          summary: 'Unable to read from local.oplog.rs. Connect to a primary or provide permissions.',
          details: { message: error.message },
        };
      }

      if (!oldest || !newest) {
        return {
          status: 'warn',
          summary: 'oplog.rs collection is empty.',
          recommendation: 'Ensure this node is a replica set member and retains oplog entries.',
        };
      }

      const start = oldest.wallTime || tsToDate(oldest.ts);
      const end = newest.wallTime || tsToDate(newest.ts);

      if (!start || !end) {
        return {
          status: 'error',
          summary: 'Unable to convert oplog timestamps to dates.',
        };
      }

      const windowHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

      let status = 'ok';
      if (windowHours < 24) {
        status = 'critical';
      } else if (windowHours < 48) {
        status = 'warn';
      }

      return {
        status,
        summary: `Oplog window is ${windowHours.toFixed(1)} hours.`,
        details: {
          oldest: start,
          newest: end,
        },
        recommendation:
          status === 'ok'
            ? 'Oplog provides adequate history for resyncs.'
            : 'Increase the oplog size or reduce write volume to avoid forced initial syncs.',
      };
    },
  },
];

module.exports = replicationIssues;
