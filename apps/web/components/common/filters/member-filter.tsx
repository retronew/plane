/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { sortBy } from "lodash-es";
import { observer } from "mobx-react";
// ui
import { Avatar } from "@makeplane/propel/components/avatar";
// components
import { getFileURL } from "@plane/utils";
import { FilterHeader, FilterOption } from "@/components/issues/issue-layouts/filters";
// helpers
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useUser } from "@/hooks/store/user";
import { translate } from "@plane/i18n";

export type MemberFilterProps = {
  appliedFilters: string[] | null;
  handleUpdate: (val: string) => void;
  memberIds: string[] | undefined;
  searchQuery: string;
};

type Props = MemberFilterProps & {
  field: string;
  title: string;
  optionKeyPrefix: string;
};

export const MemberFilter = observer(function MemberFilter(props: Props) {
  const { appliedFilters, handleUpdate, memberIds, searchQuery, field, title, optionKeyPrefix } = props;
  // states
  const [itemsToRender, setItemsToRender] = useState(5);
  const [previewEnabled, setPreviewEnabled] = useState(true);
  // store hooks
  const { getUserDetails } = useMember();
  const { data: currentUser } = useUser();

  // Read observable arrays and member details during every observer render.
  const selectedIds = new Set(appliedFilters ?? []);
  const filteredOptions = (memberIds || []).filter((memberId) =>
    getUserDetails(memberId)?.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedOptions = sortBy(filteredOptions, [
    (memberId) => !selectedIds.has(memberId),
    (memberId) => memberId !== currentUser?.id,
    (memberId) => getUserDetails(memberId)?.display_name.toLowerCase(),
  ]);

  const handleViewToggle = () => {
    if (itemsToRender === sortedOptions.length) setItemsToRender(5);
    else setItemsToRender(sortedOptions.length);
  };

  return (
    <>
      <FilterHeader
        field={field}
        title={title}
        isPreviewEnabled={previewEnabled}
        handleIsPreviewEnabled={() => setPreviewEnabled(!previewEnabled)}
      />
      {previewEnabled && (
        <div>
          {sortedOptions.length > 0 ? (
            <>
              {sortedOptions.slice(0, itemsToRender).map((memberId) => {
                const member = getUserDetails(memberId);

                if (!member) return null;
                return (
                  <FilterOption
                    key={`${optionKeyPrefix}-${member.id}`}
                    isChecked={selectedIds.has(member.id)}
                    onClick={() => handleUpdate(member.id)}
                    icon={
                      <Avatar
                        alt={member.display_name}
                        fallback={member.display_name?.[0]?.toUpperCase()}
                        src={getFileURL(member.avatar_url)}
                        size="xs"
                      />
                    }
                    title={currentUser?.id === member.id ? translate("web.you") : member?.display_name}
                  />
                );
              })}
              {sortedOptions.length > 5 && (
                <button
                  type="button"
                  className="ml-8 text-11 font-medium text-accent-primary"
                  onClick={handleViewToggle}
                >
                  {itemsToRender === sortedOptions.length ? translate("web.view_less") : translate("web.view_all")}
                </button>
              )}
            </>
          ) : (
            <p className="text-11 text-placeholder italic">{translate("web.no_matches_found")}</p>
          )}
        </div>
      )}
    </>
  );
});
