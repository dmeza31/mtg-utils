"use client";

/**
 * SPEC-B Task B-8 — mana curve, colour pip distribution, and type
 * breakdown (FR-3.8). Every chart ships with a visually hidden data table
 * carrying the same numbers (NFR-2.4): a histogram that only exists as
 * coloured bars is unusable to a screen-reader user, and colour buckets
 * always carry their letter so it isn't colour-only encoding either.
 */
import { useState } from "react";
import { computeStatistics } from "@/domain/deck/statistics";
import type { Deck } from "@/domain/model/types";
import type { CardRepository } from "@/domain/ports/CardRepository";

export interface StatisticsPanelProps {
  readonly deck: Deck;
  readonly repo: CardRepository;
}

export function StatisticsPanel({ deck, repo }: StatisticsPanelProps) {
  const [open, setOpen] = useState(true);
  const stats = computeStatistics(deck, repo);
  const maxCurveCount = Math.max(1, ...stats.manaCurve.map((bucket) => bucket.count));
  const maxPipCount = Math.max(1, ...stats.colorPips.map((pip) => pip.count));

  return (
    <section
      className="border-border rounded-lg border p-4"
      data-testid="statistics-panel"
      aria-labelledby="stats-heading"
    >
      <div className="flex items-center justify-between">
        <h2 id="stats-heading" className="text-foreground text-base font-semibold">
          Deck Statistics
        </h2>
        <button
          type="button"
          data-testid="statistics-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="text-muted-foreground text-sm underline underline-offset-2 md:hidden"
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>

      <div
        className={`mt-4 space-y-6 md:block ${open ? "" : "hidden"}`}
        data-testid="statistics-content"
      >
        {stats.unresolvedCount > 0 ? (
          <p className="text-muted-foreground text-xs">
            {stats.unresolvedCount} unresolved card{stats.unresolvedCount === 1 ? "" : "s"} excluded
            from statistics.
          </p>
        ) : null}

        <div>
          <h3 className="text-foreground mb-2 text-sm font-semibold">Mana Curve</h3>
          <div className="flex h-24 items-end gap-2" aria-hidden="true">
            {stats.manaCurve.map((bucket) => (
              <div key={bucket.manaValue} className="flex flex-col items-center gap-1">
                <div
                  data-testid="stat-curve-bar"
                  data-mana-value={bucket.manaValue}
                  data-count={bucket.count}
                  className="bg-accent w-6 rounded-t"
                  style={{ height: `${Math.max(2, (bucket.count / maxCurveCount) * 80)}px` }}
                />
                <span className="text-muted-foreground text-xs">{bucket.manaValue}</span>
              </div>
            ))}
          </div>
          {/* `sr-only` goes on this wrapper, not the table: a table's auto-layout
              algorithm expands its real layout box to fit cell content regardless
              of a declared 1px width, and that box still counts toward the page's
              scroll width even though the content is visually clipped (NFR-3.2). */}
          <div className="sr-only">
            <table>
              <caption>Mana curve — non-land maindeck cards by mana value</caption>
              <thead>
                <tr>
                  <th scope="col">Mana value</th>
                  <th scope="col">Count</th>
                </tr>
              </thead>
              <tbody>
                {stats.manaCurve.map((bucket) => (
                  <tr key={bucket.manaValue}>
                    <td>{bucket.manaValue}</td>
                    <td>{bucket.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="text-foreground mb-2 text-sm font-semibold">Colour Pips</h3>
          <div className="flex h-24 items-end gap-2" aria-hidden="true">
            {stats.colorPips.map((pip) => (
              <div key={pip.color} className="flex flex-col items-center gap-1">
                <div
                  data-testid="stat-pip-bar"
                  data-color={pip.color}
                  data-count={pip.count}
                  className="bg-accent w-6 rounded-t"
                  style={{ height: `${Math.max(2, (pip.count / maxPipCount) * 80)}px` }}
                />
                <span className="text-muted-foreground text-xs font-semibold">{pip.color}</span>
              </div>
            ))}
          </div>
          <div className="sr-only">
            <table>
              <caption>Colour pip distribution, counted per copy</caption>
              <thead>
                <tr>
                  <th scope="col">Colour</th>
                  <th scope="col">Pips</th>
                </tr>
              </thead>
              <tbody>
                {stats.colorPips.map((pip) => (
                  <tr key={pip.color}>
                    <td>{pip.color}</td>
                    <td>{pip.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="text-foreground mb-2 text-sm font-semibold">Card Types</h3>
          <ul className="space-y-1 text-sm">
            {stats.typeBreakdown.map((row) => (
              <li
                key={row.type}
                data-testid="stat-type-row"
                data-type={row.type}
                data-count={row.count}
                className="flex justify-between"
              >
                <span>{row.type}</span>
                <span className="text-muted-foreground">{row.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
