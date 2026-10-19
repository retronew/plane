import { ClockOutline, CloseCircleOutline, TickCircleOutline, WarningTriangleOutline } from "@makeplane/propel/icons";
import { Copy } from "lucide-react";
import { EInboxIssueStatus } from "@plane/types";

export const ICON_PROPERTIES = {
  [EInboxIssueStatus.PENDING]: {
    icon: WarningTriangleOutline,
    textColor: (snoozeDatePassed: boolean = false) => (snoozeDatePassed ? "" : "text-warning-primary"),
    bgColor: (snoozeDatePassed: boolean = false) => (snoozeDatePassed ? "" : "bg-warning-subtle"),
  },
  [EInboxIssueStatus.DECLINED]: {
    icon: CloseCircleOutline,
    textColor: (snoozeDatePassed: boolean = false) => (snoozeDatePassed ? "" : "text-danger-primary"),
    bgColor: (snoozeDatePassed: boolean = false) => (snoozeDatePassed ? "" : "bg-danger-subtle"),
  },
  [EInboxIssueStatus.SNOOZED]: {
    icon: ClockOutline,
    textColor: (snoozeDatePassed: boolean = false) => (snoozeDatePassed ? "text-danger-primary" : "text-placeholder"),
    bgColor: (snoozeDatePassed: boolean = false) => (snoozeDatePassed ? "bg-danger-subtle" : "bg-layer-3"),
  },
  [EInboxIssueStatus.ACCEPTED]: {
    icon: TickCircleOutline,
    textColor: (snoozeDatePassed: boolean = false) => (snoozeDatePassed ? "" : "text-success-primary"),
    bgColor: (snoozeDatePassed: boolean = false) => (snoozeDatePassed ? "" : "bg-success-subtle"),
  },
  [EInboxIssueStatus.DUPLICATE]: {
    icon: Copy,
    textColor: (snoozeDatePassed: boolean = false) => (snoozeDatePassed ? "" : "text-secondary"),
    bgColor: (snoozeDatePassed: boolean = false) => (snoozeDatePassed ? "" : "bg-layer-3"),
  },
};
