# Live silver price chart

A chart of silver prices in rupees per kg (5D / 1M / 1Y / Max, hover tooltip).
A GitHub Action fetches prices from MetalpriceAPI every 2 hours and saves them to
`docs/data.json`. The page in `docs/` reads that file. Your API key lives in a
GitHub secret, so it is never in the page or the repository.

Prices are the international spot price converted to INR. Indian market rates also
include import duty, GST and dealer premiums, so they will differ.

## Setup (about 20 minutes)

1. **Get an API key.** Sign up at metalpriceapi.com/register and copy your key.
   Keep it private.
2. **Create a GitHub repository.** Make it public (free GitHub Pages needs that).
   Upload everything in this folder, including the hidden `.github` folder.
3. **Add the key as a secret.** In the repository: Settings, Secrets and variables,
   Actions, New repository secret. Name it `METALPRICE_API_KEY` and paste the key.
4. **Turn on GitHub Pages.** Settings, Pages, "Deploy from a branch", branch `main`,
   folder `/docs`, Save. Your site address will appear on that page.
5. **Run the first update.** Actions tab, "Update silver prices", Run workflow.
   When it finishes (about a minute), `docs/data.json` appears and the chart works.
6. **Add it to Google Sites.** Open your site in edit mode, Insert, Embed, "By URL",
   paste your GitHub Pages address, Insert, then resize the box.

## Request budget

| Task | When | Requests |
|---|---|---|
| Live price | every run (every 2 hours) | 1 |
| 5-day hourly history | every 6 hours | 1 |
| Daily history | once a day | 1 |
| First run only | backfills up to 5 years | up to 5 |

That is about 510 requests a month, which fits the Essential plan (1,000). The free
plan (100 requests) will run out quickly, so use it only for testing. For hourly
live prices on a bigger plan, change the cron line in
`.github/workflows/update.yml` to `"7 * * * *"`.

## Things to know

- Free-plan keys are for non-commercial use and need a credit link. The page already
  links to MetalpriceAPI.com. Check their terms for your use.
- If a request fails, the script keeps the last saved data and the Action shows a
  red cross in the Actions tab.
- GitHub can pause scheduled runs on repositories with no activity for a long time.
  If the chart stops updating, press "Run workflow" again.
- To test on your computer without touching the real API, set `METALPRICE_BASE` to a
  mock server address.
