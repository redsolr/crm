/**
 * CrmViewSkeleton — instant first paint for a CRM view: the real
 * header chrome (title/meta, when the caller knows them) renders
 * immediately, with shimmer rows where the data will land. Same
 * doctrine as CrmTableSkeleton (shown only on first load, never on
 * cached revisits) but view-shaped instead of table-shaped — used by
 * the route-level loading.tsx boundaries and by views whose body is a
 * list rather than a record table.
 */

const ROW_WIDTHS = [68, 44, 76, 52, 62, 38, 70, 48] as const;

interface Props {
  /** Real view title when the caller knows it; omit for a shimmer bar. */
  title?: string;
  meta?: string;
  rowCount?: number;
  testId: string;
}

export function CrmViewSkeleton({ title, meta, rowCount = 7, testId }: Props) {
  return (
    <div
      className="crm-view-skeleton flex-1 min-w-0 overflow-y-auto"
      data-testid={testId}
      aria-busy="true"
      aria-label="Loading view"
    >
      <div className="crm-view-header">
        {title ? (
          <h1 className="crm-view-title">{title}</h1>
        ) : (
          <span className="crm-skeleton-bar crm-view-skeleton-title" />
        )}
        {meta ? <span className="crm-view-meta">{meta}</span> : null}
        <div className="flex-1" />
      </div>
      <div className="crm-view-skeleton-body">
        {Array.from({ length: rowCount }, (_, r) => (
          <div key={r} className="crm-view-skeleton-row">
            <span
              className="crm-skeleton-bar"
              style={{ width: `${ROW_WIDTHS[r % ROW_WIDTHS.length]}%` }}
            />
            <span
              className="crm-skeleton-bar"
              style={{ width: `${ROW_WIDTHS[(r + 3) % ROW_WIDTHS.length] / 2}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
