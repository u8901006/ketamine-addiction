#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from "node:fs";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { input: "new_papers.json", tracker: "docs/summarized_pmids.json" };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--input": opts.input = args[++i]; break;
      case "--tracker": opts.tracker = args[++i]; break;
    }
  }
  return opts;
}

function loadJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function main() {
  const opts = parseArgs();

  const papersData = loadJson(opts.input);
  const tracker = loadJson(opts.tracker) ?? { pmids: [], lastUpdated: "" };

  const existingSet = new Set(tracker.pmids);
  const newPmids = (papersData?.papers ?? [])
    .map((p) => p.pmid)
    .filter((id) => id && !existingSet.has(id));

  const allPmids = [...existingSet, ...newPmids];
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const updated = {
    pmids: allPmids,
    lastUpdated: new Date().toISOString(),
  };

  writeFileSync(opts.tracker, JSON.stringify(updated, null, 2), "utf-8");
  console.error(`[INFO] Tracker updated: ${allPmids.length} total PMIDs (${newPmids.length} new)`);
}

main();
