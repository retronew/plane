/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useTranslation } from "@plane/i18n";
import { Translation } from "@plane/i18n";
import { observer } from "mobx-react";
// types
// plane imports
import { Button } from "@makeplane/propel/components/button";
import type { EProductSubscriptionEnum, IPaymentProduct, TSubscriptionPrice } from "@plane/types";
import { Loader } from "@plane/blocks/skeleton";
// local imports
import { BasePaidPlanCard } from "./base-paid-plan-card";
import { translate } from "@plane/i18n";

export type TalkToSalesCardProps = {
  planVariant: EProductSubscriptionEnum;
  href: string;
  isLoading?: boolean;
  features: string[];
  product: IPaymentProduct | undefined;
  prices: TSubscriptionPrice[];
  upgradeLoaderType: Omit<EProductSubscriptionEnum, "FREE"> | undefined;
  verticalFeatureList?: boolean;
  extraFeatures?: string | React.ReactNode;
  isSelfHosted: boolean;
  isTrialAllowed: boolean;
  renderTrialButton?: (props: { productId: string | undefined; priceId: string | undefined }) => React.ReactNode;
};

const renderPriceContent = (price: TSubscriptionPrice) => (
  <>
    {price.recurring === "month" && translate("web.ui.monthly")}
    {price.recurring === "year" && translate("web.ui.yearly")}
  </>
);

export const TalkToSalesCard = observer(function TalkToSalesCard(props: TalkToSalesCardProps) {
  useTranslation();
  const {
    planVariant,
    href,
    features,
    product,
    prices,
    isLoading,
    verticalFeatureList = false,
    extraFeatures,
    upgradeLoaderType,
    isSelfHosted,
    isTrialAllowed,
    renderTrialButton,
  } = props;

  const renderActionButton = (price: TSubscriptionPrice) => (
    <>
      <div className="pb-4 text-center">
        <div className="flex h-9 items-center justify-center text-20 font-semibold">
          {isLoading ? (
            <Loader className="flex flex-col items-center justify-center">
              <Loader.Item height="36px" width="4rem" />
            </Loader>
          ) : (
            <>{translate("web.quote_on_request")}</>
          )}
        </div>
        <div className="text-caption-md-medium text-tertiary">
          <Translation translationKey="web.ui.per_user_month" />
        </div>
      </div>
      {isLoading ? (
        <Loader className="flex flex-col items-center justify-center">
          <Loader.Item height="38px" width="14rem" />
        </Loader>
      ) : (
        <div className="flex w-full flex-col items-center justify-center">
          <div className="w-56">
            <Button
              variant="primary"
              size="md"
              stretch="full"
              nativeButton={false}
              render={
                <a href={href} target="_blank" rel="noreferrer">
                  {translate("web.talk_to_sales")}
                </a>
              }
              label={translate("web.talk_to_sales")}
            />
          </div>
          {isTrialAllowed && !isSelfHosted && (
            <div className="mt-4 h-4">
              {renderTrialButton &&
                renderTrialButton({
                  productId: product?.id,
                  priceId: price.id,
                })}
            </div>
          )}
        </div>
      )}
    </>
  );

  return (
    <BasePaidPlanCard
      planVariant={planVariant}
      features={features}
      prices={prices}
      upgradeLoaderType={upgradeLoaderType}
      verticalFeatureList={verticalFeatureList}
      extraFeatures={extraFeatures}
      renderPriceContent={renderPriceContent}
      renderActionButton={renderActionButton}
    />
  );
});
