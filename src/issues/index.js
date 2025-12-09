const performanceIssues = require('./performance');
const replicationIssues = require('./replication');
const storageIssues = require('./storage');
const operationsIssues = require('./operations');
const securityIssues = require('./security');

const categories = [
  { id: 'performance', title: 'Performance & Querying', issues: performanceIssues },
  { id: 'replication', title: 'Replication & Resilience', issues: replicationIssues },
  { id: 'storage', title: 'Storage & Capacity', issues: storageIssues },
  { id: 'operations', title: 'Operations & Runtime', issues: operationsIssues },
  { id: 'security', title: 'Security & Access Control', issues: securityIssues },
];

function flattenIssues() {
  return categories.flatMap((category) =>
    category.issues.map((issue) => ({
      ...issue,
      category: issue.category || category.id,
    })),
  );
}

function getIssueById(issueId) {
  return flattenIssues().find((issue) => issue.id === issueId);
}

function listIssues(filterCategory) {
  const normalized = filterCategory ? filterCategory.toLowerCase() : null;
  return flattenIssues().filter((issue) => {
    if (!normalized) return true;
    return issue.category.toLowerCase() === normalized || issue.id.startsWith(`${normalized}:`);
  });
}

module.exports = {
  categories,
  listIssues,
  getIssueById,
};
