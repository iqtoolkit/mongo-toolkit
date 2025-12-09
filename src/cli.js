const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const chalk = require('chalk');
const { withMongoClient } = require('./services/mongoClient');
const { categories, listIssues, getIssueById } = require('./issues');

const STATUS_COLORS = {
  ok: chalk.green,
  warn: chalk.keyword('orange'),
  critical: chalk.red,
  error: chalk.redBright,
  info: chalk.cyan,
};

function colorizeStatus(status) {
  const color = STATUS_COLORS[status] || ((text) => text);
  return color(status.toUpperCase());
}

function printIssueRow(issue) {
  const severity = issue.severity ? chalk.bold(issue.severity.toUpperCase()) : 'n/a';
  console.log(`${chalk.gray(issue.id)}\n  ${chalk.white(issue.title)} [${severity}]\n  Category: ${issue.category}\n  Tags: ${issue.tags?.join(', ') || '—'}\n`);
}

function printResult(issue, result, asJson) {
  if (asJson) {
    console.log(
      JSON.stringify(
        {
          issue: issue.id,
          title: issue.title,
          ...result,
        },
        null,
        2,
      ),
    );
    return;
  }

  const statusLabel = result.status ? colorizeStatus(result.status) : 'STATUS?';
  console.log(`${chalk.bold(issue.title)} — ${statusLabel}`);
  console.log(result.summary || 'No summary.');

  if (result.details) {
    console.log('\nDetails:');
    console.dir(result.details, { depth: 4 });
  }

  if (result.recommendation) {
    console.log(`\nRecommendation: ${result.recommendation}`);
  }
}

function listCategories() {
  categories.forEach((category) => {
    console.log(`${chalk.bold(category.title)} (${category.id}) — ${category.issues.length} issue(s)`);
  });
}

async function runIssue(issue, argv) {
  const state = {};
  return withMongoClient(argv.uri, argv.database, ({ client, db, adminDb }) =>
    issue.run({ client, db, adminDb, options: argv, state }),
  );
}

yargs(hideBin(process.argv))
  .scriptName('mongo-toolkit')
  .usage('$0 <command> [options]')
  .command(
    'categories',
    'List available issue categories',
    () => undefined,
    () => listCategories(),
  )
  .command(
    'list [category]',
    'List issues (optionally filtered by category)',
    (cmd) =>
      cmd
        .positional('category', {
          describe: 'Category id to filter by',
          type: 'string',
        })
        .option('json', {
          describe: 'Return JSON payload',
          type: 'boolean',
          default: false,
        }),
    (argv) => {
      const issues = listIssues(argv.category);
      if (argv.json) {
        console.log(JSON.stringify(issues, null, 2));
        return;
      }

      issues.forEach((issue) => printIssueRow(issue));
    },
  )
  .command(
    'describe <issueId>',
    'Show metadata for a specific issue',
    (cmd) =>
      cmd.positional('issueId', {
        describe: 'Issue identifier (e.g. performance:slow-queries)',
        type: 'string',
      }),
    (argv) => {
      const issue = getIssueById(argv.issueId);
      if (!issue) {
        console.error(chalk.red(`Unknown issue id: ${argv.issueId}`));
        process.exitCode = 1;
        return;
      }

      printIssueRow(issue);
      console.log(issue.description || 'No description provided.');
      if (issue.options) {
        console.log('Options:', issue.options);
      }
    },
  )
  .command(
    'run <issueId>',
    'Execute a diagnostic issue against a MongoDB deployment',
    (cmd) =>
      cmd
        .positional('issueId', {
          describe: 'Issue identifier',
          type: 'string',
        })
        .option('uri', {
          describe: 'MongoDB connection string',
          demandOption: true,
          type: 'string',
        })
        .option('database', {
          describe: 'Database name to target when applicable',
          default: 'admin',
          type: 'string',
        })
        .option('json', {
          describe: 'Output machine-readable JSON',
          default: false,
          type: 'boolean',
        })
        .option('slowMs', {
          describe: 'Override slow query threshold (ms)',
          type: 'number',
        })
        .option('threshold', {
          describe: 'Generic threshold (seconds or ms depending on issue)',
          type: 'number',
        }),
    async (argv) => {
      const issue = getIssueById(argv.issueId);
      if (!issue) {
        console.error(chalk.red(`Unknown issue id: ${argv.issueId}`));
        process.exitCode = 1;
        return;
      }

      try {
        const result = await runIssue(issue, argv);
        printResult(issue, result || {}, argv.json);
      } catch (error) {
        printResult(issue, { status: 'error', summary: error.message }, argv.json);
        process.exitCode = 1;
      }
    },
  )
  .demandCommand(1, 'Select a command to run. Use --help for usage information.')
  .help().argv;
