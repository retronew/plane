import { Tooltip } from "@makeplane/propel/components/tooltip";

/** Keep titles aligned across projects and different sequence-number lengths. */
export function ListIssueIdentifier({ identifier }: { identifier: string }) {
  return (
    <Tooltip label={identifier} align="start">
      <span
        data-list-identifier
        className="block w-20 shrink-0 truncate text-left text-caption-sm-regular text-tertiary tabular-nums sm:w-22"
      >
        {identifier}
      </span>
    </Tooltip>
  );
}
