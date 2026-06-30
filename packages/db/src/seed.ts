/**
 * DB seed entrypoint. Seed strategy (single login gate + seed accounts)
 * is decided in solar-8wv.11; this is a placeholder that wires the runner.
 */
async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('[seed] no seeders defined yet (see solar-8wv.11).');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
