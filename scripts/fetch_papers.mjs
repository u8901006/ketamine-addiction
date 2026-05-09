#!/usr/bin/env node

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PUBMED_SEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const PUBMED_FETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";

const SEARCH_QUERIES = [
  `("Ketamine"[MeSH Terms] OR ketamine[Title/Abstract] OR esketamine[Title/Abstract] OR "Spravato"[Title/Abstract]) AND ("Substance-Related Disorders"[MeSH Terms] OR "ketamine use disorder"[Title/Abstract] OR "ketamine addiction"[Title/Abstract] OR "ketamine dependence"[Title/Abstract] OR "ketamine abuse"[Title/Abstract] OR "ketamine misuse"[Title/Abstract] OR "problematic ketamine use"[Title/Abstract] OR "recreational ketamine"[Title/Abstract] OR "nonmedical ketamine"[Title/Abstract] OR "illicit ketamine"[Title/Abstract])`,
  `(ketamine[Title/Abstract] OR esketamine[Title/Abstract]) AND (cystitis[Title/Abstract] OR "ketamine bladder"[Title/Abstract] OR "lower urinary tract symptoms"[Title/Abstract] OR LUTS[Title/Abstract] OR hydronephrosis[Title/Abstract]) AND (addiction[Title/Abstract] OR dependence[Title/Abstract] OR abuse[Title/Abstract] OR misuse[Title/Abstract] OR "chronic use"[Title/Abstract] OR recreational[Title/Abstract])`,
  `(ketamine[Title/Abstract]) AND (dependence[Title/Abstract] OR addiction[Title/Abstract] OR misuse[Title/Abstract] OR "chronic use"[Title/Abstract] OR recreational[Title/Abstract]) AND (cognition[Title/Abstract] OR "cognitive impairment"[Title/Abstract] OR memory[Title/Abstract] OR "executive function"[Title/Abstract] OR fMRI[Title/Abstract] OR neuroimaging[Title/Abstract])`,
  `(ketamine[Title/Abstract]) AND (addiction[Title/Abstract] OR dependence[Title/Abstract] OR misuse[Title/Abstract] OR "use disorder"[Title/Abstract]) AND (depression[Title/Abstract] OR anxiety[Title/Abstract] OR psychosis[Title/Abstract] OR suicidality[Title/Abstract] OR "dual diagnosis"[Title/Abstract])`,
  `(ketamine[Title/Abstract]) AND (recreational[Title/Abstract] OR illicit[Title/Abstract] OR nonmedical[Title/Abstract] OR addiction[Title/Abstract] OR dependence[Title/Abstract] OR misuse[Title/Abstract]) AND ("harm reduction"[Title/Abstract] OR stigma[Title/Abstract] OR "help seeking"[Title/Abstract] OR nightlife[Title/Abstract] OR "club drug"[Title/Abstract] OR "young adults"[Title/Abstract] OR policy[Title/Abstract])`,
  `(ketamine[Title/Abstract] OR esketamine[Title/Abstract]) AND ("treatment-resistant depression"[Title/Abstract] OR "chronic pain"[Title/Abstract] OR therapeutic[Title/Abstract] OR prescribing[Title/Abstract]) AND ("abuse liability"[Title/Abstract] OR misuse[Title/Abstract] OR dependence[Title/Abstract] OR addiction[Title/Abstract] OR diversion[Title/Abstract] OR "substance use disorder"[Title/Abstract])`,
];

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { days: 7, maxPapers: 50, output: "papers.json" };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--days": opts.days = parseInt(args[++i], 10); break;
      case "--max-papers": opts.maxPapers = parseInt(args[++i], 10); break;
      case "--output": opts.output = args[++i]; break;
    }
  }
  return opts;
}

function buildDateFilter(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const from = d.toISOString().slice(0, 10).replace(/-/g, "/");
  return `"${from}"[Date - Publication] : "3000"[Date - Publication]`;
}

async function searchPapers(query, retmax = 50) {
  const url = new URL(PUBMED_SEARCH);
  url.searchParams.set("db", "pubmed");
  url.searchParams.set("term", query);
  url.searchParams.set("retmax", String(retmax));
  url.searchParams.set("sort", "date");
  url.searchParams.set("retmode", "json");

  try {
    const resp = await fetch(url.toString(), {
      headers: { "User-Agent": "KetamineAddictionBot/1.0 (research aggregator)" },
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return data?.esearchresult?.idlist ?? [];
  } catch (err) {
    console.error(`[ERROR] PubMed search failed: ${err.message}`);
    return [];
  }
}

async function fetchDetails(pmids) {
  if (!pmids.length) return [];
  const url = new URL(PUBMED_FETCH);
  url.searchParams.set("db", "pubmed");
  url.searchParams.set("id", pmids.join(","));
  url.searchParams.set("retmode", "xml");

  try {
    const resp = await fetch(url.toString(), {
      headers: { "User-Agent": "KetamineAddictionBot/1.0 (research aggregator)" },
      signal: AbortSignal.timeout(60000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const xml = await resp.text();
    return parseXml(xml);
  } catch (err) {
    console.error(`[ERROR] PubMed fetch failed: ${err.message}`);
    return [];
  }
}

function parseXml(xml) {
  const papers = [];
  const articleRegex = /<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g;
  let match;
  while ((match = articleRegex.exec(xml)) !== null) {
    const block = match[1];

    const pmidMatch = block.match(/<PMID[^>]*>(\d+)<\/PMID>/);
    const pmid = pmidMatch?.[1] ?? "";

    const titleMatch = block.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/);
    let title = titleMatch?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";

    const abstractParts = [];
    const absRegex = /<AbstractText[^>]*Label="([^"]*)"[^>]*>([\s\S]*?)<\/AbstractText>/g;
    let absMatch;
    while ((absMatch = absRegex.exec(block)) !== null) {
      const label = absMatch[1];
      const text = absMatch[2].replace(/<[^>]+>/g, "").trim();
      if (text) abstractParts.push(label ? `${label}: ${text}` : text);
    }
    if (!abstractParts.length) {
      const plainAbs = block.match(/<AbstractText>([\s\S]*?)<\/AbstractText>/);
      if (plainAbs) abstractParts.push(plainAbs[1].replace(/<[^>]+>/g, "").trim());
    }
    const abstract = abstractParts.join(" ").slice(0, 2000);

    const journalMatch = block.match(/<Title>([\s\S]*?)<\/Title>/);
    const journal = journalMatch?.[1]?.trim() ?? "";

    const yearMatch = block.match(/<Year>(\d{4})<\/Year>/);
    const monthMatch = block.match(/<Month>([^<]+)<\/Month>/);
    const dayMatch = block.match(/<Day>(\d+)<\/Day>/);
    const dateParts = [yearMatch?.[1], monthMatch?.[1], dayMatch?.[1]].filter(Boolean);
    const dateStr = dateParts.join(" ");

    const keywords = [];
    const kwRegex = /<Keyword>([\s\S]*?)<\/Keyword>/g;
    let kwMatch;
    while ((kwMatch = kwRegex.exec(block)) !== null) {
      const kw = kwMatch[1].trim();
      if (kw) keywords.push(kw);
    }

    const url = pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : "";

    if (title) {
      papers.push({ pmid, title, journal, date: dateStr, abstract, url, keywords });
    }
  }
  return papers;
}

async function main() {
  const opts = parseArgs();
  const dateFilter = buildDateFilter(opts.days);
  const allPmids = new Set();
  const perQuery = Math.ceil(opts.maxPapers / SEARCH_QUERIES.length);

  console.error(`[INFO] Searching PubMed for ketamine addiction papers (last ${opts.days} days)...`);

  for (let i = 0; i < SEARCH_QUERIES.length; i++) {
    const query = `(${SEARCH_QUERIES[i]}) AND ${dateFilter}`;
    console.error(`[INFO] Running query ${i + 1}/${SEARCH_QUERIES.length}...`);
    const pmids = await searchPapers(query, perQuery);
    for (const id of pmids) allPmids.add(id);
    if (allPmids.size >= opts.maxPapers) break;
  }

  const pmidList = [...allPmids].slice(0, opts.maxPapers);
  console.error(`[INFO] Found ${pmidList.length} unique papers`);

  if (!pmidList.length) {
    const d = new Date();
    d.setHours(d.getHours() + 8);
    const empty = { date: d.toISOString().slice(0, 10), count: 0, papers: [] };
    writeFileSync(opts.output, JSON.stringify(empty, null, 2), "utf-8");
    console.error("[INFO] No papers found");
    return;
  }

  const papers = await fetchDetails(pmidList);
  console.error(`[INFO] Fetched details for ${papers.length} papers`);

  const d = new Date();
  d.setHours(d.getHours() + 8);
  const output = {
    date: d.toISOString().slice(0, 10),
    count: papers.length,
    papers,
  };

  writeFileSync(opts.output, JSON.stringify(output, null, 2), "utf-8");
  console.error(`[INFO] Saved to ${opts.output}`);
}

main().catch((err) => {
  console.error(`[FATAL] ${err.message}`);
  process.exit(1);
});
