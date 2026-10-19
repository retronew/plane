/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useMemo } from "react";
import { Avatar } from "@makeplane/propel/components/avatar";
import { AvatarGroup } from "@makeplane/propel/components/avatar-group";
import type { AvatarGroupSize } from "@makeplane/propel/components/avatar-group";
import { Badge } from "@makeplane/propel/components/badge";
import { AssigneeOutline, DeactivatedUserOutline, UserAltOutline } from "@makeplane/propel/icons";
import type { TPaginatedResponse } from "@plane/types";
import { Select } from "../select/select";
import type { SelectPaginationParams, SelectTooltip, SelectTriggerSize, SelectVariant } from "../select/types";
import { splitSelectVariant } from "../select/utils";
import { cn, getAvatarName } from "@plane/utils";
import { useTranslation } from "@plane/i18n";

/** Minimal member shape the dropdown needs — the client maps its richer record down to this. */
export type MemberOption = {
  id: string;
  display_name: string;
  /** The person's plain name for the avatar (accessible name and derived initials), when `display_name` carries
   *  a label such as " (you)". Defaults to `display_name`, with parenthetical tokens stripped. */
  name?: string;
  /** Final avatar URL (the client applies `getFileURL`); empty/undefined falls back to initials. */
  avatar_url?: string | null;
  /**
   * A suspended (deactivated) workspace member. The row stays in the list — greyed, with a
   * deactivated-user glyph and a trailing {@link MemberSelectCommonProps.suspendedLabel} badge — but
   * it cannot be picked; the keyboard walks past it. A suspended member who is already selected
   * keeps an enabled row so the selection can still be removed, and the trigger shows them as usual.
   */
  suspended?: boolean;
};

export type MemberSelectVariant = SelectVariant | `avatar-group-${SelectTriggerSize}`;

/** Narrows `MemberSelectVariant` to its avatar-group member — lets every avatar-group-only
 *  computation below read `props.variant`'s size off the narrowed type instead of asserting it. */
function isAvatarGroupVariant(variant: MemberSelectVariant): variant is `avatar-group-${SelectTriggerSize}` {
  return variant.startsWith("avatar-group-");
}

/** Avatar-only trigger: keep the matching `pill-*` footprint (`h-5|6|7`) so swapping empty pill ↔
 *  faces does not collapse the row, but drop border/fill/padding so faces are not boxed in menu
 *  chrome and fill the same height as sibling pills. `min-h-0` overrides flex `min-height: auto`
 *  so a default `md` (28px) Avatar cannot stretch the pill and reflow the form. */
const AVATAR_GROUP_TRIGGER_CLASSNAME =
  "max-w-none min-h-0 border-transparent bg-transparent px-0 py-0 hover:border-transparent hover:bg-transparent active:border-transparent active:bg-transparent disabled:border-transparent disabled:bg-transparent";

/** Face size matching the pill height — `xs` (20px) = `pill-sm` / `h-5`, same as sibling state
 *  and priority chips. Propel Avatar defaults to `md` (28px) when `size` is omitted; that
 *  overflows `h-5`/`h-6` and jumps the row. Always pass this through to each `Avatar`. */
const TRIGGER_AVATAR_SIZE: Record<SelectTriggerSize, AvatarGroupSize> = {
  sm: "xs",
  md: "xs",
  lg: "sm",
};

/** `avatar-group-*`'s resolved trigger footprint, keyed off the same `SelectTriggerSize` as
 *  `TRIGGER_AVATAR_SIZE` — an explicit map (not a `pill-${size}` template literal) so a new
 *  `SelectTriggerSize` fails to compile here until its `pill-*` variant is filled in. */
const TRIGGER_SIZE_VARIANT: Record<SelectTriggerSize, SelectVariant> = {
  sm: "pill-sm",
  md: "pill-md",
  lg: "pill-lg",
};

/** `splitSelectVariant` doesn't recognise `avatar-group` and its result covers both trigger-size and
 *  chrome-size variants — swap in the same-shaped `pill-*` string (always resolves to the trigger-size
 *  branch) so the return narrows to `SelectTriggerSize` on its own, without asserting it. */
function avatarGroupTriggerSize(variant: `avatar-group-${SelectTriggerSize}`): SelectTriggerSize {
  const split = splitSelectVariant(variant.replace("avatar-group", "pill"));
  return split.isSelectKind ? "md" : split.size;
}

/** Dropdown row is a fixed `h-7`; pin the option face in a reserved slot so a size flash cannot
 *  grow the panel. Matches the clear-option glyph box. */
const OPTION_ICON_SLOT_CLASSNAME = "grid size-5 shrink-0 place-items-center overflow-hidden";

/** Faces shown on the trigger before remaining members collapse into a "+N" chip.
 *  AvatarGroup also receives one extra resolved face (`MAX_TRIGGER_AVATARS + 1`) so a stack of
 *  exactly `max + 1` shows every face instead of a "+1" chip. */
export const MAX_TRIGGER_AVATARS = 3;

/** Id for the "No assignee" clear option — an empty string maps to `null` via `val || null`. */
const CLEAR_OPTION_ID = "";

/** Initials must not see labels like " (you)" — Propel uses first+last whitespace tokens. */
function memberAvatarAlt(member: MemberOption): string {
  return getAvatarName(member.name || member.display_name);
}

function renderMemberOptionIcon(member: MemberOption) {
  return (
    <span className={OPTION_ICON_SLOT_CLASSNAME}>
      {member.id === CLEAR_OPTION_ID ? (
        <UserAltOutline className="h-4 w-4 text-primary" />
      ) : member.suspended ? (
        <DeactivatedUserOutline className="h-3.5 w-3.5 text-placeholder" />
      ) : (
        <Avatar alt={memberAvatarAlt(member)} src={member.avatar_url ?? ""} size="xs" />
      )}
    </span>
  );
}

function renderMemberChip(member: MemberOption) {
  return (
    <>
      <Avatar alt={memberAvatarAlt(member)} src={member.avatar_url ?? ""} size="2xs" />
      <span className="min-w-0 truncate">{member.display_name}</span>
    </>
  );
}

type MemberSelectCommonProps = {
  /** Paginated fetcher, bound by the client to the members-lite service (cursor + optional server search). */
  getValues: (params: SelectPaginationParams) => Promise<TPaginatedResponse<MemberOption[]>>;
  /** Controls trigger chrome, button sizing, pill vs count display, and arrow/icon visibility. */
  variant: MemberSelectVariant;
  /**
   * Override the variant's default text-label visibility. Set `false` for avatars-only rows (e.g.
   * subscribers/authors) or `value <= 1` for "name when single, avatars-only when many" (assignees).
   */
  showLabel?: boolean;
  /** Hide the arrow when a sibling clear control occupies its slot. */
  hideChevron?: boolean;
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  onClose?: () => void;
  className?: string;
  tooltip?: SelectTooltip;
  /** Forwarded to the trigger as `data-testid` — value-agnostic e2e selector. */
  testId?: string;
  /** Tab order of the trigger, for forms that sequence focus explicitly (e.g. the work item create modal). */
  tabIndex?: number;
  /** Re-filters the rendered list every render — unlike `getValues`, also catches an already-fetched, still-open list. */
  filterOption?: (member: MemberOption) => boolean;
  /** Badge text on a {@link MemberOption.suspended} row. Defaults to "Suspended". */
  suspendedLabel?: string;
};

export type MemberSelectProps = MemberSelectCommonProps &
  (
    | { multiple: true; value: MemberOption[]; onChange: (ids: string[]) => void }
    | {
        multiple?: false;
        value: MemberOption | null;
        onChange: (id: string) => void;
        clearable?: boolean;
        clearLabel?: string;
      }
  );

function triggerLabel(
  selected: MemberOption[],
  showCountOnMultiple: boolean,
  placeholder: string | undefined,
  countLabel: string
): string {
  if (selected.length === 0) return placeholder ?? "";
  if (selected.length === 1) return selected[0]?.display_name ?? "";
  if (showCountOnMultiple) return countLabel;
  // Join-names variant: only the first few selected are resolved (the rest are count-only stubs), so list
  // those names and summarise the remainder rather than rendering blanks for the unresolved ids.
  const names = selected
    .slice(0, MAX_TRIGGER_AVATARS)
    .map((member) => member.display_name)
    .filter(Boolean)
    .join(", ");
  const remaining = selected.length - MAX_TRIGGER_AVATARS;
  return remaining > 0 ? `${names} +${remaining}` : names;
}

/** Resolves the member-specific display flags and the trigger's chrome variant from the caller's
 *  `variant`. `kind` (variant minus its size suffix) drives the member-specific logic; the
 *  `avatar-group` kind is member-only, hence the `pill` swap for size parsing. */
function resolveMemberSelectChrome(variant: MemberSelectVariant): {
  isAvatarGroup: boolean;
  isSearchInput: boolean;
  showCountOnMultiple: boolean;
  avatarSize: AvatarGroupSize;
  triggerVariant: SelectVariant;
} {
  if (isAvatarGroupVariant(variant)) {
    const triggerSize = avatarGroupTriggerSize(variant);
    return {
      isAvatarGroup: true,
      isSearchInput: false,
      showCountOnMultiple: false,
      avatarSize: TRIGGER_AVATAR_SIZE[triggerSize],
      triggerVariant: TRIGGER_SIZE_VARIANT[triggerSize],
    };
  }

  const { size } = splitSelectVariant(variant);
  const kind = variant.replace(`-${size}`, "");
  return {
    isAvatarGroup: false,
    isSearchInput: kind === "search-input",
    showCountOnMultiple: kind === "table-cell" || kind === "pill",
    avatarSize: "xs",
    triggerVariant: variant,
  };
}

function isMemberSelectClearable(props: MemberSelectProps): boolean {
  return !props.multiple && !!props.clearable;
}

function getSelectedMembers(props: MemberSelectProps): MemberOption[] {
  if (props.multiple) return props.value;
  return props.value ? [props.value] : [];
}

function resolveClearLabel(props: MemberSelectProps, noAssigneeLabel: string): string {
  if (props.multiple) return noAssigneeLabel;
  return props.clearLabel ?? (props.placeholder || noAssigneeLabel);
}

/** `search-input`'s box IS the trigger (no separate label), so `placeholder` doubles as its empty
 *  text unless the caller sets a distinct `searchPlaceholder`. */
function resolveSearchPlaceholder(
  searchPlaceholderProp: string | undefined,
  isSearchInput: boolean,
  placeholder: string,
  fallback: string
): string {
  return searchPlaceholderProp ?? (isSearchInput ? placeholder : undefined) ?? fallback;
}

/** Chips are the only way to deselect for `search-input` (no click-to-toggle row), so an already-picked
 *  member shouldn't also appear in the list. */
function createMemberFilterOption(selectedIds: Set<string>, filterOption?: (member: MemberOption) => boolean) {
  return (member: MemberOption) => !selectedIds.has(member.id) && (filterOption?.(member) ?? true);
}

/** Suspended members cannot be newly picked; an already-selected one stays toggleable so it can be removed. */
function isMemberOptionDisabled(member: MemberOption, selectedIds: Set<string>): boolean {
  return !!member.suspended && !selectedIds.has(member.id);
}

type MemberTriggerContentsProps = {
  members: MemberOption[];
  avatarSize: AvatarGroupSize;
  showLabel: boolean;
  showCountOnMultiple: boolean;
  placeholder: string;
  countLabel: string;
};

function MemberTriggerContents(props: MemberTriggerContentsProps) {
  const { members, avatarSize, showLabel, showCountOnMultiple, placeholder, countLabel } = props;
  const showLabelText = showLabel && (members.length > 0 || !!placeholder);

  return (
    <>
      {members.length > 0 && (
        <span
          className={cn(
            "flex items-center gap-1 group-hover/list-item:[&>div]:space-x-1 [&>div]:hover:space-x-1 [&>div>*]:transition-[margin] [&>div>*]:duration-200 motion-reduce:[&>div>*]:transition-none",
            !showLabelText && "grow"
          )}
        >
          {/* Resolve one more than `MAX_TRIGGER_AVATARS` so `AvatarGroup` can render the real extra face
              instead of a "+1" chip when `total` is exactly `max + 1`; `total` covers the rest. */}
          <AvatarGroup size={avatarSize} max={MAX_TRIGGER_AVATARS} total={members.length}>
            {members.slice(0, MAX_TRIGGER_AVATARS + 1).map((member) => (
              <Avatar key={member.id} alt={memberAvatarAlt(member)} src={member.avatar_url ?? ""} />
            ))}
          </AvatarGroup>
        </span>
      )}
      {showLabelText && (
        <span className="min-w-0 grow truncate text-left">
          {triggerLabel(members, showCountOnMultiple, placeholder, countLabel)}
        </span>
      )}
    </>
  );
}

type MemberSelectTriggerProps = {
  multiple: boolean;
  disabled: boolean;
  variant: SelectVariant;
  avatarSize: AvatarGroupSize;
  isAvatarGroup: boolean;
  showCountOnMultiple: boolean;
  showLabel: boolean;
  placeholder: string;
  hideChevron?: boolean;
  className?: string;
  tooltip?: SelectTooltip;
  testId?: string;
  tabIndex?: number;
};

function MemberSelectTrigger(props: MemberSelectTriggerProps) {
  const { t } = useTranslation();
  const {
    multiple,
    disabled,
    variant,
    avatarSize,
    isAvatarGroup,
    showCountOnMultiple,
    showLabel,
    placeholder,
    hideChevron,
    className,
    tooltip,
    testId,
    tabIndex,
  } = props;

  const prependMemberIcon = useCallback(
    (members: MemberOption[]) =>
      members.length === 0 ? multiple ? <AssigneeOutline /> : <UserAltOutline /> : undefined,
    [multiple]
  );

  return (
    <Select.Trigger<MemberOption>
      disabled={disabled}
      variant={variant}
      tabIndex={tabIndex}
      data-testid={testId}
      className={cn(isAvatarGroup && AVATAR_GROUP_TRIGGER_CLASSNAME, className)}
      appendIcon={hideChevron ? null : undefined}
      prependIcon={prependMemberIcon}
      label={(members) =>
        triggerLabel(members, showCountOnMultiple, placeholder, t("member", { count: members.length }))
      }
      tooltip={tooltip}
    >
      {(members) => (
        <MemberTriggerContents
          members={members}
          avatarSize={avatarSize}
          showLabel={showLabel}
          showCountOnMultiple={showCountOnMultiple}
          placeholder={placeholder}
          countLabel={t("member", { count: members.length })}
        />
      )}
    </Select.Trigger>
  );
}

/**
 * Presentational, data-source-agnostic member picker built on the generic infinite `Select` (single or
 * multi). The client supplies `getValues` (bound to the paginated members-lite service), the selected
 * `value` object(s) (resolved by the client in an observer context so they stay reactive), and an
 * `onChange` that persists the chosen id(s) — this block owns only the member-specific avatar/name markup.
 * Only the first few selected avatars are rendered (the rest become the "N members" count), so a large
 * selection never materialises hundreds of avatar nodes.
 */
export function MemberSelect(props: MemberSelectProps) {
  const { t } = useTranslation();
  const {
    getValues,
    disabled = false,
    placeholder = "",
    searchPlaceholder: searchPlaceholderProp,
    showLabel: showLabelProp,
    onClose,
    className,
    tooltip,
    filterOption,
    testId,
    tabIndex,
    suspendedLabel = t("web.suspended"),
  } = props;
  const clearable = isMemberSelectClearable(props);

  const chrome = resolveMemberSelectChrome(props.variant);
  // `search-input`'s box IS the trigger (no separate label), so `placeholder` doubles as its empty
  // text unless the caller sets a distinct `searchPlaceholder`.
  const searchPlaceholder = resolveSearchPlaceholder(
    searchPlaceholderProp,
    chrome.isSearchInput,
    placeholder,
    t("web.search_members")
  );

  // A call-site can override the variant's default label visibility (e.g. avatars-only subscriber rows).
  const showLabel = showLabelProp ?? !chrome.isAvatarGroup;

  const selectedList = getSelectedMembers(props);
  const selectedIds = new Set(selectedList.map((member) => member.id));

  const clearLabel = resolveClearLabel(props, t("web.no_assignee"));
  const clearOption = useMemo<MemberOption>(
    () => ({ id: CLEAR_OPTION_ID, display_name: clearLabel, avatar_url: null }),
    [clearLabel]
  );

  const combinedFilterOption = createMemberFilterOption(selectedIds, filterOption);
  const renderMemberTrailing = useCallback(
    (member: MemberOption) =>
      member.suspended ? <Badge variant="neutral" size="xs" label={suspendedLabel} /> : undefined,
    [suspendedLabel]
  );

  const sharedProps = {
    infinite: true as const,
    getValues,
    disabled,
    placeholder,
    searchPlaceholder,
    onClose,
    // `Combobox.Chips` can't survive the lazy-mount resting state.
    lazyMount: chrome.isSearchInput ? false : undefined,
    showSearch: chrome.isSearchInput ? false : undefined,
    filterOption: chrome.isSearchInput ? combinedFilterOption : filterOption,
    getOptionValue: (member: MemberOption) => member.id,
    getOptionLabel: (member: MemberOption) => member.display_name,
    getOptionIcon: renderMemberOptionIcon,
    getOptionDisabled: (member: MemberOption) => isMemberOptionDisabled(member, selectedIds),
    getOptionTrailing: renderMemberTrailing,
    renderChip: renderMemberChip,
    headerItems: clearable ? [clearOption] : undefined,
  };

  const trigger = (
    <MemberSelectTrigger
      multiple={!!props.multiple}
      disabled={disabled}
      variant={chrome.triggerVariant}
      avatarSize={chrome.avatarSize}
      isAvatarGroup={chrome.isAvatarGroup}
      showCountOnMultiple={chrome.showCountOnMultiple}
      showLabel={showLabel}
      placeholder={placeholder}
      hideChevron={props.hideChevron}
      className={className}
      tooltip={tooltip}
      testId={testId}
      tabIndex={tabIndex}
    />
  );

  // Branch on multiplicity so the generic `Select`'s discriminated value/onChange union narrows.
  if (props.multiple) {
    return (
      <Select<MemberOption> {...sharedProps} multiple value={props.value} onChange={props.onChange}>
        {trigger}
      </Select>
    );
  }

  return (
    <Select<MemberOption> {...sharedProps} value={props.value} onChange={props.onChange}>
      {trigger}
    </Select>
  );
}
