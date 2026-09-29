import { SUMMARY_BEGIN, SUMMARY_END } from "../pipelines/state-views/index.js";

export function extractSummaryRegion(content: string): { start: number; end: number } | null {
  const begin = content.indexOf(SUMMARY_BEGIN);
  const end = content.indexOf(SUMMARY_END);
  if (begin === -1 || end === -1 || end < begin) return null;
  return { start: begin, end: end + SUMMARY_END.length };
}

/** True when replacing entire file content would change bytes inside the marked region. */
export function writeTouchesSummaryRegion(existing: string | null, newContent: string): boolean {
  if (existing === null) return newContent.includes(SUMMARY_BEGIN);
  const region = extractSummaryRegion(existing);
  if (!region) return newContent.includes(SUMMARY_BEGIN);
  const oldRegion = existing.slice(region.start, region.end);
  const applied = newContent;
  const newRegion = extractSummaryRegion(applied);
  if (!newRegion) return true;
  return applied.slice(newRegion.start, newRegion.end) !== oldRegion;
}

/**
 * True when an Edit's old/new strings overlap the marked region in the file.
 * Indices are computed on the existing file content.
 */
export function editTouchesSummaryRegion(
  existing: string,
  oldString: string,
  newString: string,
): boolean {
  const region = extractSummaryRegion(existing);
  if (!region) return false;
  const idx = existing.indexOf(oldString);
  if (idx === -1) return true;
  const editStart = idx;
  const editEnd = idx + oldString.length;
  const overlaps = editStart < region.end && editEnd > region.start;
  if (!overlaps) return false;
  const next = existing.slice(0, editStart) + newString + existing.slice(editEnd);
  const nextRegion = extractSummaryRegion(next);
  if (!nextRegion) return true;
  return next.slice(nextRegion.start, nextRegion.end) !== existing.slice(region.start, region.end);
}
