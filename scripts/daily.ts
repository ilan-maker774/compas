import { createDb } from "../src/db";
import { today } from "../src/lib/dates";
import { runDailyUpdate } from "../src/lib/jobs/daily";
import { getFxProvider, getPriceProvider } from "../src/lib/market-data";

/** À planifier une fois par jour ouvré, après 18 h (cron : 30 18 * * 1-5). */
async function main() {
  const { db, pool } = createDb();
  const report = await runDailyUpdate(db, {
    priceProvider: getPriceProvider(),
    fxProvider: getFxProvider(),
    today: today(),
  });
  console.log(JSON.stringify(report, null, 2));
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
