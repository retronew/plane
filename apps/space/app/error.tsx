/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// ui
import { Button } from "@makeplane/propel/components/button";
import { translate } from "@plane/i18n";

const handleRetry = () => {
  window.location.reload();
};

function ErrorPage() {
  return (
    <div className="grid h-screen place-items-center bg-surface-1 p-4">
      <div className="space-y-8 text-center">
        <div className="space-y-2">
          <h3 className="text-16 font-semibold">{translate("web.space_error_title")}</h3>
          <p className="mx-auto text-13 text-secondary md:w-1/2">
            {translate("web.space_error_description")}{" "}
            <a href="mailto:support@plane.so" className="text-accent-primary">
              support@plane.so
            </a>{" "}
            {translate("web.space_error_or_on_our")}{" "}
            <a href="https://forum.plane.so" target="_blank" className="text-accent-primary" rel="noopener noreferrer">
              {translate("web.forum")}
            </a>
            .
          </p>
        </div>
        <div className="flex items-center justify-center gap-2">
          <Button variant="primary" size="md" stretch="auto" label={translate("web.refresh")} onClick={handleRetry} />
          {/* <Button variant="secondary" size="lg" onClick={() => {}}>
            Sign out
          </Button> */}
        </div>
      </div>
    </div>
  );
}

export default ErrorPage;
