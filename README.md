# CartWise

CartWise is a grocery shopping planner with reusable lists, live product search, store comparisons, cheaper alternatives, cart estimates, and household spending tracking.

## Development

This app is deployed as a Cloudflare Worker with static assets. Product search uses SerpAPI's Google Shopping engine.

## Cloudflare setup

1. Create a Worker named `cartwise` connected to this repository.
2. Set the build/deploy command to `npx wrangler deploy` and the root directory to `/`.
3. Add the Worker secret `SERPAPI_API_KEY` with your SerpAPI key.
4. Deploy. The app works for list management and spending tracking without the search secret; live product comparisons require it.

Shopping lists and spending records are stored in this browser on this device.
