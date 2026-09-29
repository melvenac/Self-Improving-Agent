import { isProtectedArtifactPath, isRenderedViewPath } from "./paths.js";

export const BASH_WRITE_LIMIT =
  "Static Bash write detection only: redirects, sed -i, tee, cp and mv targets. " +
  "It stops mistakes by the planner's tools; it is not a sandbox.";

const REDIRECT_RE = /(?:^|[\s|;&])(?:\d*>>?)\s*([^\s|;&]+)/g;
const SED_I_RE = /\bsed\s+-i(?:\S*)\s+[^\s|;&]+\s+([^\s|;&]+)/;
const TEE_RE = /\btee\s+(?:-[a-zA-Z]+\s+)*([^\s|;&]+)/;
const CP_MV_RE = /\b(?:cp|mv)\s+(?:-[a-zA-Z]+\s+)*[^\s|;&]+\s+([^\s|;&]+)/;

function stripQuotes(token: string): string {
  const t = token.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function isProtectedWriteTarget(raw: string): boolean {
  const p = stripQuotes(raw);
  if (!p || p === "/dev/null" || p.startsWith("&")) return false;
  return isProtectedArtifactPath(p) || isRenderedViewPath(p);
}

/** PH-6: statically detected write targets that hit PH-1/PH-2 paths. */
export function detectBashWriteTargets(command: string): string[] {
  const hits: string[] = [];

  for (const m of command.matchAll(REDIRECT_RE)) {
    const target = m[1];
    if (isProtectedWriteTarget(target)) hits.push(stripQuotes(target));
  }

  const sed = command.match(SED_I_RE);
  if (sed && isProtectedWriteTarget(sed[1])) hits.push(stripQuotes(sed[1]));

  const tee = command.match(TEE_RE);
  if (tee && isProtectedWriteTarget(tee[1])) hits.push(stripQuotes(tee[1]));

  const cpMv = command.match(CP_MV_RE);
  if (cpMv && isProtectedWriteTarget(cpMv[1])) hits.push(stripQuotes(cpMv[1]));

  return [];
}
