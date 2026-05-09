#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { input: "papers.json", summarizedDoc: "docs/summarized_pmids.json", output: "new_papers.json" };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--input": opts.input = args[++i]; break;
      case "--summarized-doc": opts.summarizedDoc = args[++i]; break;
      case "--output": opts.output = args[++i]; break;
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
  if (!papersData || !papersData.papers) {
    console.error("[WARN] No papers data, writing empty output");
    const empty = { date: papersData?.date ?? new Date().toISOString().slice(0, 10), count: 0, papers: [] };
    writeFileSync(opts.output, JSON.stringify(empty, null, 2), "utf-8");
    return;
  }

  const tracker = loadJson(opts.summarizedDoc);
  const summarizedSet = new Set(tracker?.pmids ?? []);

  const newPapers = papersData.papers.filter((p) => p.pmid && !summarizedSet.has(p.pmid));

  console.error(`[INFO] Total papers: ${papersData.papers.length}, Already summarized: ${papersData.papers.length - newPapers.length}, New: ${newPapers.length}`);

  const output = {
    date: papersData.date,
    count: newPapers.length,
    papers: newPapers,
  };

  writeFileSync(opts.output, JSON.stringify(output, null, 2), "utf-8");
  console.error(`[INFO] Filtered papers saved to ${opts.output}`);
}

main();
