/**
 * SPEC-E Task E-7 (FR-11.5). Thin re-export so `features/export/ExportDialog`
 * doesn't import `adapters/storage` directly (CLAUDE.md's layering rule —
 * `features` may not import `adapters`).
 */
export { clearAllLocalData } from "../adapters/storage/autosave";
