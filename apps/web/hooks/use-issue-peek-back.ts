import { useLocation, useNavigate } from "react-router";
import { readIssuePeekBack } from "@/helpers/issue-peek-url";
import type { TPeekIssue } from "@/store/issue/issue-details/root.store";

export function useIssuePeekBack(current: TPeekIssue) {
  const location = useLocation();
  const navigate = useNavigate();
  const previous = readIssuePeekBack(location.state, current);
  return {
    canGoBack: !!previous,
    goBack: () => {
      if (previous) void navigate(-1);
    },
  };
}
