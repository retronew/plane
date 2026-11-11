// Ancestor slots have a stable identity at each depth.
/* oxlint-disable react/no-array-index-key */
export function IssueTreeLines({
  branches,
  hasChildren,
  variant = "solid",
}: {
  branches: boolean[];
  hasChildren: boolean;
  variant?: "solid" | "dashed";
}) {
  const isDashed = variant === "dashed";
  const lineClassName = isDashed ? "border-l border-dashed border-current" : "bg-current";
  const anchorOffset = isDashed ? 10 : 7.5;
  return (
    <>
      {branches.length > 0 && (
        <span className="-mr-2 shrink-0" style={{ width: branches.length * 24 }} aria-hidden="true" />
      )}
      <span
        className={`pointer-events-none absolute left-0 text-[var(--border-subtle)] ${isDashed ? "inset-y-0" : "-inset-y-1"}`}
        aria-hidden="true"
        data-issue-tree-lines=""
      >
        {branches.map((continues, index) => {
          const last = index === branches.length - 1;
          return (
            <span key={index} className="absolute inset-y-0 w-6" style={{ left: index * 24 + anchorOffset }}>
              {(continues || last) && (
                <span
                  className={`absolute top-0 left-0 w-px ${lineClassName}`}
                  style={{ height: last && !continues ? (isDashed ? "calc(50% - 8px)" : 15) : "100%" }}
                />
              )}
              {last && (
                <svg
                  className="absolute top-3.5 left-0 fill-current"
                  style={isDashed ? { top: "calc(50% - 9px)" } : undefined}
                  width="10"
                  height="9"
                  viewBox="0 0 10 9"
                >
                  <path d="M0 0h1v1c0 2.5 2.212 3.546 2.212 3.546L9.737 8.06c.568.306.094 1.186-.474.88l-6.48-3.488S0 4 0 1V0Z" />
                </svg>
              )}
            </span>
          );
        })}
        {hasChildren && (
          <span
            className={`absolute bottom-0 w-px ${lineClassName}`}
            style={{
              top: isDashed ? "calc(50% + 10px)" : 39,
              left: branches.length * 24 + anchorOffset,
            }}
          />
        )}
      </span>
    </>
  );
}
