/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { cn } from "@plane/utils";

type Props = {
  title?: string;
  children: React.ReactNode;
  className?: string;
  subtitle?: string | null;
  actions?: React.ReactNode;
  headerClassName?: string;
};

function AnalyticsSectionWrapper(props: Props) {
  const { title, children, className, actions, headerClassName } = props;
  return (
    <div className={className}>
      <div className={cn("mb-4 flex items-center gap-2 text-nowrap", headerClassName)}>
        {title && (
          <div className="flex items-center gap-2">
            <h2 className="text-13 font-medium">{title}</h2>
            {/* {subtitle && <p className="text-16 text-tertiary"> • {subtitle}</p>} */}
          </div>
        )}
        {actions}
      </div>
      {children}
    </div>
  );
}

export default AnalyticsSectionWrapper;
