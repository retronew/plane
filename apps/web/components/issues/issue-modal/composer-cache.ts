import type { TIssue } from "@plane/types";
export type ComposerDraft = { values: Partial<TIssue>; assetIds: string[]; hasChanges?: boolean };
const drafts = new Map<string, ComposerDraft>();
export const composerDraftContext = (projectId?: string, parentId?: string | null, isDraft = false) =>
  parentId || isDraft ? JSON.stringify([projectId, parentId, isDraft]) : "new";
export const composerCacheKey = (user: string, workspace: string, context: string) =>
  `issue-composer:${user}:${workspace}:${context}`;
export function readComposerDraft(key: string): ComposerDraft | undefined {
  try {
    const value = sessionStorage.getItem(key);
    if (!value) return drafts.get(key);
    const parsed = JSON.parse(value) as ComposerDraft;
    return parsed?.values && Array.isArray(parsed.assetIds) ? parsed : undefined;
  } catch {
    return drafts.get(key);
  }
}
export function saveComposerDraft(key: string, draft?: ComposerDraft) {
  if (draft) drafts.set(key, draft);
  else drafts.delete(key);
  try {
    if (draft) sessionStorage.setItem(key, JSON.stringify(draft));
    else sessionStorage.removeItem(key);
  } catch {
    /* Retain in memory when session storage is unavailable. */
  }
  listeners.forEach((listener) => listener());
}

const listeners = new Set<() => void>();
export function subscribeComposerDrafts(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function hasComposerContent(draft: ComposerDraft) {
  const values = draft.values;
  return !!(
    draft.hasChanges ||
    values.name?.trim() ||
    (values.description_html && !/^\s*(<p>(<br\s*\/?>)?<\/p>)?\s*$/.test(values.description_html)) ||
    draft.assetIds.length ||
    values.assignee_ids?.length ||
    values.label_ids?.length ||
    (values.priority && values.priority !== "none") ||
    values.start_date ||
    values.target_date ||
    values.parent_id ||
    values.cycle_id ||
    values.module_ids?.length
  );
}
