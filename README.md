# Ketamine Addiction Research Daily Report

Automated daily literature monitoring for ketamine addiction research, powered by PubMed + NVIDIA Nemotron.

## Features

- **Daily automated PubMed search** for the latest ketamine addiction literature
- **AI-powered analysis** using NVIDIA Nemotron 3 Super 120B (with fallback to Nemotron 3 Nano 30B)
- **Traditional Chinese summaries** with PICO analysis and clinical utility ratings
- **Beautiful HTML reports** deployed to GitHub Pages
- **Smart deduplication** - only summarizes papers not yet covered in previous reports

## Live Site

👉 [https://u8901006.github.io/ketamine-addiction/](https://u8901006.github.io/ketamine-addiction/)

## Architecture

```
.github/workflows/daily-report.yml   # GitHub Actions workflow (GMT+8 06:55 daily)
scripts/
  fetch_papers.mjs                   # PubMed E-utilities API scraper
  filter_summarized.mjs              # Deduplicate against previous reports
  generate_report.mjs                # AI analysis + HTML generation
  update_tracker.mjs                 # Update PMID tracker
  generate_index.mjs                 # Index page generator
docs/
  index.html                         # Auto-generated index
  ketamine-YYYY-MM-DD.html           # Daily reports
  summarized_pmids.json              # Deduplication tracker
```

## Related

- [Psychiatry Brain](https://github.com/u8901006/Psychiatry-brain) - General psychiatry literature daily report
- [李政洋身心診所](https://www.leepsyclinic.com/)

## License

MIT
