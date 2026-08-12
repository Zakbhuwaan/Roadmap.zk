# ZK// Access Roadmap

A personal career-transition dashboard tracking progress across DSA, System Design, IAM/Security depth, AI/GenAI differentiators, Behavioral prep, Mock Interviews, Portfolio Projects, and Certifications — plus a live Company Tracker and an automated Workday job-watcher.

## Structure

- `index.html` — the full dashboard (static HTML/CSS/JS, no build step)
- `api/sync.js` — cross-device sync endpoint (Redis-backed via Upstash/Vercel KV)
- `api/job-watch.js` — Workday CXS API watcher microservice; polls Barclays, Deutsche Bank, Citi, Morgan Stanley, and Baker Hughes for role-matching openings
- `vercel.json` — Vercel Cron config (runs the job-watcher twice daily, 9 AM & 9 PM IST)
- `package.json` — dependency manifest (`@upstash/redis`)

## Deployment

Deployed on Vercel. Requires a connected Upstash Redis (Vercel KV) instance with `KV_REST_API_URL` and `KV_REST_API_TOKEN` environment variables.

## Live app

https://zk-access-roadmap-zakbhuwaanlol-4799s-projects.vercel.app
