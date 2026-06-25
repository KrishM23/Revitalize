# Revitalize

A UC-wide carbon tracking tool that uses predictive modeling to show which University of California campuses are on track to meet their commitment of a 90% reduction in greenhouse gas emissions from 2019 levels by 2045.

Revitalize turns UC's official emissions data into something a student, faculty member, or sustainability office can actually read: clear metrics, plain-language explanations, per-campus action plans, and forecasts of where each campus is heading.

## What's here

| Page | Description |
|------|-------------|
| **`index.html`** | Systemwide dashboard with campus selector, emissions charts, scope breakdown, climate tier, and a progress leaderboard |
| **`plans.html`** | Campus-specific action plans with phased recommendations, a scope legend, and Print / PDF and CSV export |
| **`compare.html`** | Side-by-side campus comparison with bar charts and a data table |
| **`methodology.html`** | Data sources, calculations, limitations, and citations |
| **`contact.html`** | Contact and collaboration page |
| **`data/uc_emissions.csv`** | Annual Scopes 1+2+3 totals by campus and year |
| **`data/campuses.json`** | Campus metadata, colors, enrollment, STARS ratings |
| **`data/policy.json`** | UC climate policy parameters |
| **`notebooks/ucla_carbon_tracker.Rmd`** | R notebook to reproduce the UCLA analysis |

## Features

- **Climate tiers**: a 12-rank ladder from Sprout to Legend, earned by progress toward the 2045 goal.
- **Forecasting**: an ensemble of regression and smoothing models picks the best fit for each campus and projects emissions to 2030 and 2045 with prediction intervals.
- **Campus action plans**: tailored, phased recommendations based on each campus's emissions profile and real UC sustainability initiatives. Each plan can be exported as a CSV or printed to PDF.
- **Plain-language accessibility**: "what does this mean?" popovers explain carbon terms (t CO₂e, the 2019 baseline, scopes, projections, and more) across the dashboard, plans, and comparison pages.
- **Friendly metrics**: large carbon figures are paired with everyday equivalents, such as the number of gas cars driven for a year.

## Run locally

ES modules and CSV fetching require a local server (opening the HTML files directly with `file://` will not work). Use the included script (it frees the port automatically if a previous server is still running):

```bash
cd "Carbon Trackers"
./serve.sh          # defaults to port 8080
./serve.sh 8090     # or pick another port
```

Then open **http://localhost:8080**

Or press **F5** in Cursor/VS Code and choose **"Serve & Open Dashboard"**.

> **Address already in use?** A previous server is still running. `serve.sh` clears it for you, or run `lsof -ti :8080 | xargs kill`.

## Data sources

- [UC Annual Report on Sustainable Practices](https://sustainabilityreport.ucop.edu/)
- [UC Policy on Sustainable Practices](https://policy.ucop.edu/doc/3100155/SustainablePractices)

**Current inventory:** calendar year **2024** (UC 2025 Annual Report). Figures are pulled from UC's official Google Sheets behind each campus report.

**Refresh data** when a new annual report is published:

```bash
python3 scripts/update_emissions.py
```

**Policy:** 90% reduction from 2019 levels by 2045, with residual emissions neutralized through carbon removal.

## Architecture

```
data/               → CSV + JSON (source of truth)
assets/js/
  analytics.js      → Policy math and formatting
  forecast.js       → OLS, weighted OLS, polynomial, log-linear, Holt, damped Holt, ridge + LOOCV ensemble
  data.js           → Data loading and queries
  charts.js         → Chart.js with forecast bands
  app.js            → Dashboard controller
  compare.js        → Comparison page
  plans.js          → Action plans page controller
  campus-plans.js   → Action plan generation and campus initiatives
  plan-export.js    → CSV export for campus plans
  glossary.js       → Shared "what does this mean?" popovers
  tiers.js          → Climate tier ladder and shield badges
assets/styles.css
```

Forecasts use **leave-one-out cross-validation** to select the best model, with a weighted ensemble and 95% prediction intervals. See [Methodology](methodology.html) for details.

## Campuses tracked

Berkeley · Davis · Irvine · UCLA · Merced · Riverside · San Diego · UCSF · Santa Barbara · Santa Cruz

## Deploy

Configured for [Netlify](https://netlify.com). `netlify.toml` publishes the project root.

```bash
# Or deploy manually
netlify deploy --prod
```

## Disclaimer

Revitalize is built on publicly available UC sustainability report data and is not an official University of California product. For official UC climate policy, see the [UC Annual Report on Sustainable Practices](https://sustainabilityreport.ucop.edu/).
