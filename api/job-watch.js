import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// Confirmed Workday-hosted tenants for your target list.
// site/locale slugs are best-effort from public URL patterns — first live
// run will reveal if any need correcting (see "error" entries in output).
const COMPANIES = [
  { id: "barclays",    label: "Barclays",        host: "barclays.wd3.myworkdayjobs.com",    tenant: "barclays",    site: "External_Career_Site_Barclays", locale: "en-US" },
  { id: "db",          label: "Deutsche Bank",    host: "db.wd3.myworkdayjobs.com",          tenant: "db",          site: "DBWebsite",                     locale: "" },
  { id: "citi",        label: "Citi",             host: "citi.wd5.myworkdayjobs.com",        tenant: "citi",        site: "2",                             locale: "en-US" },
  { id: "ms",          label: "Morgan Stanley",   host: "ms.wd5.myworkdayjobs.com",          tenant: "ms",          site: "External",                      locale: "" },
  { id: "bakerhughes", label: "Baker Hughes",     host: "bakerhughes.wd5.myworkdayjobs.com", tenant: "bakerhughes", site: "BakerHughes",                   locale: "en-US" },
];

// Keywords matched (case-insensitive) against job titles to flag role fit.
const KEYWORDS = [
  "identity", "access management", "iam", "entitlement",
  "full stack", "fullstack", "software engineer", "software developer",
  ".net", "node", "react", "security engineer"
];

const CACHE_KEY = "job-watch:matches:v1";
const LASTRUN_KEY = "job-watch:lastrun:v1";
const MIN_INTERVAL_MS = 10 * 60 * 60 * 1000; // ~10h self-throttle (cron runs every 12h)

function matchesKeywords(title) {
  const t = (title || "").toLowerCase();
  return KEYWORDS.some(k => t.includes(k));
}

async function fetchCompanyJobs(company) {
  const url = `https://${company.host}/wday/cxs/${company.tenant}/${company.site}/jobs`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: "" }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const postings = Array.isArray(json.jobPostings) ? json.jobPostings : [];
  return postings
    .filter(p => matchesKeywords(p.title))
    .map(p => ({
      company: company.label,
      title: p.title,
      locationsText: p.locationsText || "",
      postedOn: p.postedOn || "",
      url: `https://${company.host}${company.locale ? "/" + company.locale : ""}/${company.site}${p.externalPath || ""}`,
    }));
}

async function runScan() {
  const results = { updatedAt: new Date().toISOString(), companies: {}, matches: [] };
  for (const company of COMPANIES) {
    try {
      const matches = await fetchCompanyJobs(company);
      results.companies[company.id] = { status: "ok", count: matches.length };
      results.matches.push(...matches);
    } catch (err) {
      results.companies[company.id] = { status: "error", message: String(err.message || err) };
    }
  }
  await redis.set(CACHE_KEY, results, { ex: 60 * 60 * 24 * 7 });
  await redis.set(LASTRUN_KEY, Date.now());
  return results;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const force = req.query && req.query.force === "1";
    const lastRun = await redis.get(LASTRUN_KEY);
    const stale = !lastRun || (Date.now() - Number(lastRun)) > MIN_INTERVAL_MS;

    if (stale || force) {
      const fresh = await runScan();
      return res.status(200).json({ ...fresh, fromCache: false });
    }

    const cached = await redis.get(CACHE_KEY);
    if (cached) return res.status(200).json({ ...cached, fromCache: true });

    const fresh = await runScan();
    return res.status(200).json({ ...fresh, fromCache: false });
  } catch (err) {
    return res.status(500).json({ error: "job-watch failed", message: String(err.message || err) });
  }
}
