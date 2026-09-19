import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import { mkdirSync, writeFileSync } from 'node:fs';

// Lighthouse gate for CI. Built on the `lighthouse` package that is already a dependency rather than
// @lhci/cli, which drags in a large and currently vulnerable puppeteer tree for no extra value here.

const origin = (process.env.SITE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const threshold = Number(process.env.LIGHTHOUSE_MIN_SCORE || 90);
// A single pass on a busy machine swings by more than ten points: three runs of one unchanged
// build measured 76, 90 and 86 for the same route. Score the median so the gate reflects the
// build rather than whatever else the CPU happened to be doing.
const runs = Math.max(1, Number(process.env.LIGHTHOUSE_RUNS || 3));
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const outDir = 'artifacts/lighthouse';
const categories = ['performance', 'accessibility', 'best-practices', 'seo'];

const routes = [
  { name: 'home-zh', url: `${origin}/zh` },
  { name: 'project-en', url: `${origin}/en/projects/document-search` },
  { name: 'contact-zh', url: `${origin}/zh/contact` },
];

// The demo build marks every page noindex on purpose, which is exactly what `is-crawlable` exists to
// catch. Scoring it would mean gating CI on a deliberate choice, so in demo mode it is excluded from
// the SEO category (Lighthouse re-weights the remaining audits) and reported separately below. A run
// against real content — DEMO_MODE unset — scores it normally.
const demo = process.env.DEMO_MODE === 'true';
const skipAudits = demo ? ['is-crawlable'] : [];

mkdirSync(outDir, { recursive: true });
const debugPort = 9400 + Math.floor(Math.random() * 100);
const browser = await chromium.launch({
  channel: process.env.CI ? undefined : 'chrome',
  headless: true,
  timeout: 30000,
  args: [`--remote-debugging-port=${debugPort}`],
});

const failures = [];
const summary = [];
try {
  for (const route of routes) {
    const attempts = [];
    for (let run = 0; run < runs; run++) {
      const result = await lighthouse(route.url, {
        port: debugPort,
        output: ['html', 'json'],
        logLevel: 'error',
        onlyCategories: categories,
        skipAudits,
      });
      if (!result) throw new Error(`Lighthouse returned nothing for ${route.url}`);
      attempts.push(result);
    }
    // Keep the report from the median-performance run, so the saved artifact matches the number
    // the gate acted on.
    const perf = attempts.map(a => Math.round((a.lhr.categories.performance?.score ?? 0) * 100));
    const keep = attempts[perf.indexOf(median(perf))] ?? attempts[0];
    writeFileSync(`${outDir}/${route.name}.html`, keep.report[0]);
    writeFileSync(`${outDir}/${route.name}.json`, keep.report[1]);

    const scores = {};
    for (const key of categories) {
      const values = attempts
        .map(a => a.lhr.categories[key]?.score)
        .filter(score => typeof score === 'number')
        .map(score => Math.round(score * 100));
      scores[key] = values.length ? median(values) : null;
      if (scores[key] === null || scores[key] < threshold) {
        failures.push(`${route.name} ${key}: ${scores[key] ?? 'n/a'} (needs >= ${threshold}, runs: ${values.join('/')})`);
      }
    }
    summary.push({ route: route.name, ...scores });

    const worst = Object.values(keep.lhr.audits)
      .filter(audit => audit.score !== null && audit.score < 0.9)
      .map(audit => `    - ${audit.id}${audit.displayValue ? ` (${audit.displayValue})` : ''}`);
    const spread = runs > 1 ? `  (median of ${runs}; performance ${perf.join('/')})` : '';
    console.log(`\n${route.name}  ${JSON.stringify(scores)}${spread}`);
    if (worst.length) console.log(worst.slice(0, 12).join('\n'));
  }
} finally {
  await browser.close();
}

console.log('\n' + JSON.stringify(summary, null, 2));
if (demo) console.log(`\nDemo build: the SEO category excludes ${skipAudits.join(', ')}, because demo content is noindex by design.`);
console.log(`Reports written to ${outDir}/`);

if (failures.length) {
  console.error('\nLighthouse below threshold:\n' + failures.map(line => `  - ${line}`).join('\n'));
  process.exit(1);
}
console.log(`\nAll categories at or above ${threshold}.`);
