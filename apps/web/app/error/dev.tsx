/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { isRouteErrorResponse } from "react-router";
import { Banner } from "@makeplane/propel/components/banner";
import { InfoFilled } from "@makeplane/propel/icons";
import { Button } from "@makeplane/propel/components/button";
import { Card } from "@plane/blocks/card";
import { translate } from "@plane/i18n";

interface ErrorActionsProps {
  onGoHome: () => void;
  onReload?: () => void;
}

function ErrorActions({ onGoHome, onReload }: ErrorActionsProps) {
  return (
    <div className="flex gap-3 pt-2">
      <Button variant="primary" size="md" stretch="auto" label={translate("web.go_to_home_8419")} onClick={onGoHome} />
      {onReload && (
        <Button variant="secondary" size="md" stretch="auto" label={translate("web.reload_page")} onClick={onReload} />
      )}
    </div>
  );
}

interface DevErrorComponentProps {
  error: unknown;
  onGoHome: () => void;
  onReload: () => void;
}

export function DevErrorComponent({ error, onGoHome, onReload }: DevErrorComponentProps) {
  if (isRouteErrorResponse(error)) {
    return (
      <div className="flex min-h-screen items-start justify-center bg-surface-2 p-6 transition-none">
        <div className="mt-12 w-full max-w-4xl space-y-4 transition-none">
          <Banner placement="page" variant="danger" icon={<InfoFilled />} title="Route Error Response" />

          <Card variant="with-shadow" className="!p-6 transition-none">
            <div className="space-y-4">
              <div>
                <h2 className="mb-2 text-20 font-semibold text-danger-primary">
                  {error.status} {error.statusText}
                </h2>
                <div className="bg-subtle-1 h-px w-full" />
              </div>

              <div className="space-y-2">
                <h3 className="text-13 font-medium tracking-wide text-tertiary uppercase">
                  {translate("web.error_data")}
                </h3>
                <div className="rounded-md bg-layer-1 p-4">
                  <p className="font-code text-13 text-secondary">{error.data}</p>
                </div>
              </div>

              <ErrorActions onGoHome={onGoHome} onReload={onReload} />
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (error instanceof Error) {
    return (
      <div className="flex min-h-screen items-start justify-center bg-surface-2 p-6 transition-none">
        <div className="mt-12 w-full max-w-4xl space-y-4 transition-none">
          <Banner placement="page" variant="danger" icon={<InfoFilled />} title={translate("web.runtime_error")} />
          <Card variant="with-shadow" className="!p-6 transition-none">
            <div className="space-y-4">
              <div>
                <h2 className="mb-2 text-20 font-semibold text-danger-primary">{translate("web.error")}</h2>
                <div className="bg-subtle-1 h-px w-full" />
              </div>

              <div className="space-y-2">
                <h3 className="text-13 font-medium tracking-wide text-tertiary uppercase">
                  {translate("web.message")}
                </h3>
                <div className="rounded-md bg-layer-1 p-4">
                  <p className="text-13 font-medium text-primary">{error.message}</p>
                </div>
              </div>

              {error.stack && (
                <div className="space-y-2">
                  <h3 className="text-13 font-medium tracking-wide text-tertiary uppercase">
                    {translate("web.stack_trace")}
                  </h3>
                  <div className="max-h-96 overflow-auto rounded-md border border-subtle bg-layer-1">
                    <pre className="p-4 font-code text-11 break-words whitespace-pre-wrap text-secondary">
                      {error.stack}
                    </pre>
                  </div>
                </div>
              )}

              <ErrorActions onGoHome={onGoHome} onReload={onReload} />
            </div>
          </Card>

          <Card variant="without-shadow" className="bg-layer-1 !p-4 transition-none">
            <div className="flex items-start gap-3">
              <InfoFilled className="mt-0.5 size-5 flex-shrink-0 text-tertiary" />
              <div className="space-y-1">
                <p className="text-13 font-medium text-secondary">{translate("web.development_mode")}</p>
                <p className="text-11 text-tertiary">{translate("web.dev_error_notice")}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-surface-2 p-6 transition-none">
      <div className="mt-12 w-full max-w-4xl space-y-4 transition-none">
        <Banner placement="page" variant="danger" icon={<InfoFilled />} title={translate("web.unknown_error")} />

        <Card variant="with-shadow" className="!p-6">
          <div className="space-y-4">
            <div>
              <h2 className="mb-2 text-20 font-semibold text-primary">{translate("web.unknown_error")}</h2>
              <div className="bg-subtle-1 h-px w-full" />
            </div>

            <div className="rounded-md bg-layer-1 p-4">
              <p className="text-13 text-secondary">{translate("web.unknown_error_description")}</p>
            </div>

            <ErrorActions onGoHome={onGoHome} onReload={onReload} />
          </div>
        </Card>
      </div>
    </div>
  );
}
