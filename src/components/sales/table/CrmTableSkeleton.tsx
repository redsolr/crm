"use client";

/**
 * CrmTableSkeleton — first-load placeholder for the CRM record tables
 * (the Jira/Attio pattern): the real table chrome (shell, sticky
 * header, row rhythm) paints immediately with shimmer bars where data
 * will land, so nothing jumps when rows arrive. Shown ONLY when a
 * surface has no cached data (`isLoading`, never `isFetching`) —
 * revisits paint cached rows and refresh silently instead
 * (stale-while-revalidate; CrmRefreshIndicator is that signal).
 *
 * When the owner already knows its columns (workspace bundle cached,
 * rows still loading) the real header labels render; otherwise the
 * header cells shimmer too. Bar widths follow a fixed cycle —
 * deterministic so SSR and client render identical markup.
 *
 * Reuses the live table's structural classes (`crm-table-shell`,
 * `crm-record-table-scroll`, `crm-card-list`) so both breakpoints —
 * desktop table, <768px card list — come from the existing CSS.
 */

interface SkeletonColumn {
  id: string;
  label: string;
  align?: "left" | "right";
}

interface Props {
  /** Real column defs when known — renders true header labels. */
  columns?: ReadonlyArray<SkeletonColumn>;
  /** Column count while columns are not yet known (bundle loading). */
  columnCount?: number;
  rowCount?: number;
  testIdPrefix: string;
}

/** Deterministic width cycle (% of the cell) — varied enough to read
 *  as content, stable across renders. */
const BAR_WIDTHS = [72, 48, 60, 36, 80, 54, 42, 66] as const;

const barWidth = (row: number, col: number) =>
  BAR_WIDTHS[(row * 3 + col * 5) % BAR_WIDTHS.length];

export function CrmTableSkeleton({
  columns,
  columnCount = 6,
  rowCount = 8,
  testIdPrefix,
}: Props) {
  const cols: ReadonlyArray<SkeletonColumn | null> =
    columns ?? Array.from({ length: columnCount }, () => null);
  return (
    <div
      className="crm-record-table crm-table-skeleton flex-1 min-h-0 flex flex-col"
      data-testid={`${testIdPrefix}-skeleton`}
      aria-busy="true"
      aria-label="Loading records"
    >
      <div className="crm-table-shell">
        <div className="crm-record-table-scroll flex-1 min-h-0 overflow-auto">
          <table className="crm-table">
            <thead>
              <tr>
                {cols.map((col, c) => (
                  <th
                    key={col?.id ?? c}
                    className={
                      col?.align === "right" ? "text-right" : "text-left"
                    }
                  >
                    {col ? (
                      col.label
                    ) : (
                      <span
                        className="crm-skeleton-bar"
                        style={{ width: 56 }}
                      />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rowCount }, (_, r) => (
                <tr key={r} className="crm-skeleton-row">
                  {cols.map((col, c) => (
                    <td key={col?.id ?? c}>
                      <span
                        className="crm-skeleton-bar"
                        style={{ width: `${barWidth(r, c)}%` }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile (<768px): the table hides; shimmer cards take over. */}
        <div className="crm-card-list">
          {Array.from({ length: 5 }, (_, r) => (
            <div key={r} className="crm-skeleton-card">
              <span
                className="crm-skeleton-bar"
                style={{ width: `${barWidth(r, 0)}%` }}
              />
              <span
                className="crm-skeleton-bar"
                style={{ width: `${barWidth(r, 1)}%` }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
