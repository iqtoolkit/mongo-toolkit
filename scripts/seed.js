#!/usr/bin/env node
/* eslint-disable no-console */
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const { seedDummyData } = require('../src/services/seedDummyData');

async function main() {
  const argv = yargs(hideBin(process.argv))
    .scriptName('seed')
    .usage('$0 [options]')
    .option('db', {
      describe: 'Database name to create/seed',
      type: 'string',
      default: 'app',
    })
    .option('collection', {
      describe: 'Collection name to seed',
      type: 'string',
      default: 'dummy_records',
    })
    .option('count', {
      describe: 'Number of documents to insert',
      type: 'number',
      default: 1_000_000,
    })
    .option('batch', {
      describe: 'Documents per insertMany batch',
      type: 'number',
      default: 5000,
    })
    .option('drop', {
      describe: 'Drop the collection before inserting',
      type: 'boolean',
      default: false,
    })
    .option('quiet', {
      describe: 'Reduce progress output',
      type: 'boolean',
      default: false,
    })
    .strict()
    .help().argv;

  const result = await seedDummyData({
    dbName: argv.db,
    collectionName: argv.collection,
    count: argv.count,
    batchSize: argv.batch,
    drop: argv.drop,
    quiet: argv.quiet,
  });

  console.log(
    `Done. Inserted ${result.inserted.toLocaleString()} docs into ${result.db}.${result.collection} in ${result.seconds.toFixed(1)}s.`,
  );
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
