const { getServerStatus, getCurrentOps } = require('../services/dataSources');

const operationsIssues = [
  {
    id: 'operations:connection-pressure',
    category: 'operations',
    title: 'Connection pressure',
    severity: 'medium',
    tags: ['connections', 'infrastructure'],
    description: 'Detects when the deployment is close to its connection limit.',
    async run({ adminDb, state }) {
      const status = await getServerStatus(state, adminDb);
      const connections = status.connections || {};
      const current = connections.current || 0;
      const available = connections.available || 1;
      const utilization = current / (current + available);

      let stateLabel = 'ok';
      if (utilization >= 0.9) {
        stateLabel = 'critical';
      } else if (utilization >= 0.75) {
        stateLabel = 'warn';
      }

      return {
        status: stateLabel,
        summary: `${current} of ${current + available} connections in use (${(utilization * 100).toFixed(1)}%).`,
        details: connections,
        recommendation:
          stateLabel === 'ok'
            ? 'No action required.'
            : 'Add connection pooling, increase maxIncomingConnections, or scale out application nodes.',
      };
    },
  },
  {
    id: 'operations:long-running-ops',
    category: 'operations',
    title: 'Long-running operations',
    severity: 'medium',
    tags: ['currentOp'],
    description: 'Surfaces operations that have been executing longer than a threshold.',
    options: {
      thresholdSeconds: 60,
    },
    async run({ adminDb, state, options = {} }) {
      const threshold = Number(options.thresholdSeconds || options.threshold || 60);
      const ops = await getCurrentOps(state, adminDb);
      const offenders = ops
        .filter((op) => op.secs_running >= threshold && op.active && !op.killed)
        .map((op) => ({
          opid: op.opid,
          type: op.op,
          ns: op.ns,
          secsRunning: op.secs_running,
          client: op.client,
          waitingForLock: op.waitingForLock,
        }));

      if (offenders.length === 0) {
        return {
          status: 'ok',
          summary: `No active operations running longer than ${threshold}s.`,
        };
      }

      return {
        status: 'warn',
        summary: `${offenders.length} long-running operation(s) detected (>${threshold}s).`,
        details: offenders.slice(0, 10),
        recommendation: 'Inspect offending operations, examine explain plans, or terminate blockers with db.killOp(opid).',
      };
    },
  },
];

module.exports = operationsIssues;
