const sensitiveRoles = new Set([
  'root',
  'readWriteAnyDatabase',
  'dbAdminAnyDatabase',
  'userAdminAnyDatabase',
  'clusterAdmin',
]);

const securityIssues = [
  {
    id: 'security:authorization-mode',
    category: 'security',
    title: 'Authorization enforcement',
    severity: 'high',
    tags: ['auth', 'compliance'],
    description: 'Verifies whether authorization is enabled in the server configuration.',
    async run({ adminDb }) {
      try {
        const cmdLine = await adminDb.command({ getCmdLineOpts: 1 });
        const parsed = cmdLine.parsed || {};
        const mode = parsed.security?.authorization || 'disabled';
        const status = mode === 'enabled' ? 'ok' : 'critical';

        return {
          status,
          summary: `Authorization is ${mode}.`,
          details: parsed.security,
          recommendation:
            status === 'ok'
              ? 'Authorization is enforced. No action required.'
              : 'Enable authorization to prevent unauthenticated access (set security.authorization to enabled).',
        };
      } catch (error) {
        return {
          status: 'error',
          summary: 'Unable to inspect server command-line options.',
          details: { message: error.message },
          recommendation: 'Connect with a cluster-admin role or enable getCmdLineOpts on the server.',
        };
      }
    },
  },
  {
    id: 'security:overprivileged-users',
    category: 'security',
    title: 'Over-privileged database users',
    severity: 'medium',
    tags: ['roles', 'privileges'],
    description: 'Flags users that hold cluster-wide roles such as root or readWriteAnyDatabase.',
    async run({ adminDb }) {
      let usersInfo;
      try {
        usersInfo = await adminDb.command({ usersInfo: 1, showPrivileges: false });
      } catch (error) {
        return {
          status: 'error',
          summary: 'Unable to enumerate users.',
          details: { message: error.message },
          recommendation: 'Connect to the admin database with userAdminAnyDatabase or root.',
        };
      }

      const flagged = (usersInfo?.users || [])
        .map((user) => ({
          user: `${user.user}@${user.db}`,
          roles: user.roles || [],
        }))
        .map((entry) => ({
          ...entry,
          elevatedRoles: entry.roles.filter((role) => sensitiveRoles.has(role.role)),
        }))
        .filter((entry) => entry.elevatedRoles.length > 0);

      if (flagged.length === 0) {
        return {
          status: 'ok',
          summary: 'No users with cluster-wide privileges were found.',
        };
      }

      return {
        status: 'warn',
        summary: `${flagged.length} user(s) with cluster-wide roles detected.`,
        details: flagged,
        recommendation: 'Limit root/readWriteAnyDatabase usage to automation users and rotate credentials regularly.',
      };
    },
  },
];

module.exports = securityIssues;
