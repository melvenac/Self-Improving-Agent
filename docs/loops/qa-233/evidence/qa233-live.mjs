// QA 233: ONE real read of PR 219's files through fetchPrChangedPaths (real token path, real fetch).
// Records field names and counts only, never values or the token.
const BUILD = "C:/qa-scratch/qa233-cand/open-brain/build";
const { fetchPrChangedPaths } = await import(`file:///${BUILD}/planner-hook/prfiles.js`);
const seen = [];
const spyFetch = async (url, init) => {
  const res = await fetch(url, init);
  const body = await res.clone().json().catch(() => null);
  const shape = Array.isArray(body)
    ? { list: true, length: body.length, entryKeys: body[0] ? Object.keys(body[0]).sort() : [] }
    : { list: false, keys: body ? Object.keys(body).sort() : [], changed_files_type: typeof body?.changed_files };
  seen.push({ path: new URL(url).pathname + new URL(url).search, status: res.status, authScheme: init.headers.Authorization.split(" ")[0], shape });
  return res;
};
const r = await fetchPrChangedPaths("https://github.com/melvenac/Self-Improving-Agent/pull/219", "C:/qa-scratch/qa233-wt", { fetchImpl: spyFetch });
console.log(JSON.stringify({ ok: r.ok, pathCount: r.ok ? r.paths.length : undefined, cause: r.ok ? undefined : r.cause, requests: seen }, null, 1));
