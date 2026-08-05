/**
 * SPEC-001 Task 8 — story traceability check.
 *
 * Parses the user story IDs out of docs/requirements/requirements.md §6 and
 * asserts every one has a matching `tests/e2e/<STORY>-*.spec.ts` file. This
 * is what makes "an automated test suite for each of the stories" a
 * mechanically enforced property rather than an intention.
 *
 * Expected to fail loudly until milestone M3 (SPEC-E) — that is correct and
 * intended; the output below is the burn-down list, not a broken check.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const REQUIREMENTS_FILE = path.join(process.cwd(), "docs/requirements/requirements.md");
const E2E_DIR = path.join(process.cwd(), "tests/e2e");

function extractStoryIds(requirementsMarkdown: string): string[] {
  const section = requirementsMarkdown.split(/^## 6\. User Stories$/m)[1]?.split(/^## 7\./m)[0];
  if (!section) {
    throw new Error('Could not find "## 6. User Stories" section in requirements.md');
  }
  const ids = [...section.matchAll(/\*\*([A-Z]\d+)\*\*/g)].map((m) => m[1]!);
  if (ids.length === 0) {
    throw new Error("Found the User Stories section but no story IDs in it");
  }
  return ids;
}

function storyIdsWithSpecs(): Set<string> {
  const files = readdirSync(E2E_DIR).filter((f) => f.endsWith(".spec.ts"));
  const ids = new Set<string>();
  for (const file of files) {
    const match = /^([A-Z]\d+)-/.exec(file);
    if (match) ids.add(match[1]!);
  }
  return ids;
}

function main(): void {
  const requirementsMarkdown = readFileSync(REQUIREMENTS_FILE, "utf8");
  const stories = extractStoryIds(requirementsMarkdown);
  const covered = storyIdsWithSpecs();
  const missing = stories.filter((id) => !covered.has(id));

  console.log(
    `${stories.length} user stories declared, ${stories.length - missing.length} have an E2E spec.`,
  );

  if (missing.length > 0) {
    console.log("\nMissing E2E spec for:");
    for (const id of missing) console.log(`  - ${id}`);
    process.exitCode = 1;
    return;
  }

  console.log("Every user story has an E2E spec.");
}

main();
