import { useEffect, useRef, useState } from "react";
import { Button } from "@makeplane/propel/components/button";
import { Checkbox } from "@makeplane/propel/components/checkbox";
import { Select, SelectContent, SelectItem, SelectList, SelectTrigger } from "@makeplane/propel/components/select";
import { Switch } from "@makeplane/propel/components/switch";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxSearch,
  ComboboxTrigger,
} from "@makeplane/propel/components/combobox";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { useTranslation } from "@plane/i18n";
import { FeishuService } from "@/services/feishu.service";
import type {
  TFeishuDirectoryMode,
  TFeishuDirectoryPreview,
  TFeishuDirectoryRow,
  TFeishuDirectoryUser,
} from "@/types/feishu";
import {
  canBindDirectory,
  directorySelections,
  directoryRowStatus,
  directorySummary,
  validDirectoryBatch,
} from "./directory-helper";

const service = new FeishuService();

function UserPicker({
  id,
  value,
  onChange,
  disabled,
  users,
}: {
  users: TFeishuDirectoryUser[];
  id: string;
  value?: TFeishuDirectoryUser;
  onChange: (user: TFeishuDirectoryUser) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  return (
    <Combobox<string>
      items={users.map((user) => user.id)}
      value={value?.id || null}
      disabled={disabled}
      inputValue={query}
      onInputValueChange={setQuery}
      filter={(memberId, search) => {
        const member = users.find((item) => item.id === memberId);
        return !!member && `${member.display_name} ${member.email}`.toLowerCase().includes(search.toLowerCase());
      }}
      onValueChange={(next) => {
        const user = users.find((item) => item.id === next);
        if (user) onChange(user);
      }}
    >
      <ComboboxTrigger id={id} size="md" placeholder={t("admin.feishu.directory.search")}>
        {value ? `${value.display_name} (${value.email})` : undefined}
      </ComboboxTrigger>
      <ComboboxContent
        aria-label={t("admin.feishu.directory.search")}
        search={<ComboboxSearch placeholder={t("admin.feishu.directory.search")} />}
      >
        <ComboboxEmpty>{t("admin.feishu.directory.no_users")}</ComboboxEmpty>
        <ComboboxList aria-label={t("admin.feishu.directory.search")}>
          {(userId: string) => {
            const user = users.find((item) => item.id === userId)!;
            return <ComboboxItem key={userId} value={userId} label={`${user.display_name} (${user.email})`} />;
          }}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

function useDirectoryBinding(disabled: boolean) {
  const [preview, setPreview] = useState<TFeishuDirectoryPreview | null>(null);
  const [mode, setMode] = useState<TFeishuDirectoryMode>("unbound");
  const [skipped, setSkipped] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [manual, setManual] = useState<Record<string, TFeishuDirectoryUser>>({});
  const [notifications, setNotifications] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [failure, setFailure] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!preview) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, Date.parse(preview.expires_at) - Date.now()) + 10);
    return () => clearTimeout(timer);
  }, [preview]);
  const selectedRows = new Set(selected);
  const manualIds = Object.fromEntries(Object.entries(manual).map(([id, user]) => [id, user.id]));
  const selections = preview ? directorySelections(preview, selected, manualIds, now) : [];
  const editable = !!preview && canBindDirectory(preview, now) && !busy && !disabled;
  const run = async (bind = false) => {
    if (inFlight.current || disabled) return;
    if (bind && (!preview || !canBindDirectory(preview) || !validDirectoryBatch(selections))) return;
    inFlight.current = true;
    setBusy(true);
    setFailure(false);
    try {
      const result =
        bind && preview
          ? await service.bindDirectory(preview.id, selections, notifications)
          : await service.createDirectoryPreview(mode);
      setPreview(result);
      setNow(Date.now());
      setSelected(
        bind
          ? []
          : result.rows
              .filter((row) => row.member_id && !row.result && row.match_basis !== "identity_conflict")
              .map((row) => row.id)
      );
      if (!bind) {
        setManual({});
        setSkipped([]);
      }
      setConfirm(true);
    } catch {
      setFailure(true);
      if (bind && preview) {
        try {
          setPreview(await service.directoryPreview(preview.id));
        } catch {
          /* Preserve selection for a safe retry after network failure. */
        }
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return {
    preview,
    mode,
    setMode,
    skipped,
    setSkipped,
    selected,
    setSelected,
    manual,
    setManual,
    notifications,
    setNotifications,
    confirm,
    setConfirm,
    busy,
    failure,
    now,
    selectedRows,
    selections,
    editable,
    run,
  };
}

function useDirectoryUnbind(preview: TFeishuDirectoryPreview | null, run: () => Promise<void>) {
  const [unbindRow, setUnbindRow] = useState<TFeishuDirectoryRow | null>(null);
  const [unbinding, setUnbinding] = useState(false);
  const [unbindError, setUnbindError] = useState(false);
  const unbind = async () => {
    if (!preview || !unbindRow || unbinding) return;
    setUnbinding(true);
    setUnbindError(false);
    try {
      await service.unbindDirectory(preview.id, unbindRow.id);
      setUnbindRow(null);
      await run();
    } catch {
      setUnbindError(true);
    } finally {
      setUnbinding(false);
    }
  };
  return { unbindRow, setUnbindRow, unbinding, unbindError, setUnbindError, unbind };
}

export function FeishuDirectory({ disabled }: { disabled: boolean }) {
  const { t } = useTranslation();
  const binding = useDirectoryBinding(disabled);
  const { preview, mode, setMode, confirm, setConfirm, busy, failure, run } = binding;
  const unbindingState = useDirectoryUnbind(preview, run);
  return (
    <section className="flex max-w-4xl flex-col gap-4 pt-6">
      <h2 className="text-16 font-medium">{t("admin.feishu.directory.title")}</h2>
      <p className="text-13 text-tertiary">{t("admin.feishu.directory.description")}</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <label htmlFor="directory-mode" className="text-13 font-medium">
            {t("admin.feishu.directory.mode")}
          </label>
          <Select
            items={{ unbound: t("admin.feishu.directory.mode_unbound"), all: t("admin.feishu.directory.mode_all") }}
            value={mode}
            disabled={disabled || busy}
            onValueChange={(value) => {
              if (value === "unbound" || value === "all") setMode(value);
            }}
          >
            <SelectTrigger id="directory-mode" size="lg" width="fit" />
            <SelectContent>
              <SelectList>
                <SelectItem value="unbound" label={t("admin.feishu.directory.mode_unbound")} />
                <SelectItem value="all" label={t("admin.feishu.directory.mode_all")} />
              </SelectList>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          stretch="auto"
          disabled={disabled || busy}
          loading={busy && !confirm}
          onClick={() => void run()}
          label={t("admin.feishu.directory.sync")}
        />
      </div>
      <p className="text-13 text-tertiary">{t(`admin.feishu.directory.mode_${mode}_help`)}</p>
      {failure && (
        <p role="alert" className="text-13 text-danger-primary">
          {t("admin.feishu.directory.failed")}
        </p>
      )}
      {preview && (
        <>
          <output className="text-13 text-secondary">
            {t("admin.feishu.directory.result_summary", {
              bound: preview.rows.filter((row) => row.result === "bound" || row.result === "already_bound").length,
              total: preview.rows.length,
            })}
          </output>
          <Button
            type="button"
            variant="secondary"
            size="md"
            stretch="auto"
            disabled={busy}
            onClick={() => setConfirm(true)}
            label={t("admin.feishu.directory.reopen")}
          />
        </>
      )}
      <DirectoryDialogs binding={binding} unbindingState={unbindingState} />
    </section>
  );
}

function DirectoryDialogs({
  binding,
  unbindingState,
}: {
  binding: ReturnType<typeof useDirectoryBinding>;
  unbindingState: ReturnType<typeof useDirectoryUnbind>;
}) {
  const { t } = useTranslation();
  const {
    preview,
    skipped,
    setSkipped,
    selected,
    setSelected,
    manual,
    setManual,
    notifications,
    setNotifications,
    confirm,
    setConfirm,
    busy,
    failure,
    now,
    selectedRows,
    selections,
    editable,
    run,
  } = binding;
  const skippedRows = new Set(skipped);
  const { setUnbindRow, setUnbindError } = unbindingState;
  return (
    <>
      <Dialog
        open={confirm}
        onOpenChange={(open) => {
          if (!busy) setConfirm(open);
        }}
      >
        <DialogContent size="xl">
          <DialogMain>
            <DialogHeader>
              <DialogHeading>
                <DialogTitle>{t("admin.feishu.directory.review_title")}</DialogTitle>
              </DialogHeading>
            </DialogHeader>
            <DialogBody>
              <div className="flex min-w-0 flex-col gap-5">
                {preview && (
                  <>
                    <div className="space-y-2">
                      <p className="text-13 text-secondary">{t("admin.feishu.directory.table_help")}</p>
                      <p className="text-12 text-tertiary">{t(`admin.feishu.directory.mode_${preview.mode}_help`)}</p>
                      <DirectoryPreviewStatus preview={preview} now={now} />
                    </div>
                    <div className="min-w-0 overflow-x-auto rounded-lg border border-subtle bg-surface-1">
                      <table className="w-full min-w-[800px] table-fixed text-start">
                        <caption className="sr-only">{t("admin.feishu.directory.review_title")}</caption>
                        <colgroup>
                          <col className="w-16" />
                          <col className="w-56" />
                          <col />
                          <col className="w-44" />
                        </colgroup>
                        <thead className="border-b border-subtle bg-layer-1 text-12 text-tertiary">
                          <tr>
                            {["selection", "plane_account", "feishu_member", "match_status"].map((key) => (
                              <th key={key} scope="col" className="px-4 py-3 text-start font-medium">
                                {t(`admin.feishu.directory.${key}`)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-subtle">
                          {preview.rows.map((row) => (
                            <DirectoryRow
                              key={row.id}
                              row={row}
                              members={preview.members
                                .filter((member) => member.match_basis !== "oidc" || member.user_id === row.user_id)
                                .map((member) => ({ id: member.id, email: member.email, display_name: member.name }))}
                              onUnbind={() => {
                                setUnbindError(false);
                                setUnbindRow(row);
                              }}
                              selected={selectedRows.has(row.id)}
                              skipped={skippedRows.has(row.id)}
                              onSkip={() => {
                                setSkipped((items) =>
                                  new Set(items).has(row.id) ? items.filter((id) => id !== row.id) : [...items, row.id]
                                );
                                setSelected((items) => items.filter((id) => id !== row.id));
                              }}
                              editable={editable}
                              manualUser={manual[row.id]}
                              onSelect={(checked) => {
                                setSkipped((items) =>
                                  checked
                                    ? items.filter((id) => id !== row.id)
                                    : [...items.filter((id) => id !== row.id), row.id]
                                );
                                setSelected((items) =>
                                  checked
                                    ? [...items.filter((id) => id !== row.id), row.id]
                                    : items.filter((id) => id !== row.id)
                                );
                              }}
                              onUserChange={(user) => {
                                setSkipped((items) => items.filter((id) => id !== row.id));
                                setManual((items) => ({ ...items, [row.id]: user }));
                                setSelected((items) => [...items.filter((id) => id !== row.id), row.id]);
                              }}
                            />
                          ))}
                          {preview.rows.length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-4 py-8 text-center text-13 text-tertiary">
                                {t("admin.feishu.directory.empty")}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <DirectorySummary preview={preview} selected={selected} skipped={skipped} manual={manual} />
                    <div className="flex items-center justify-between gap-6 rounded-lg border border-subtle px-4 py-3 text-13">
                      <label htmlFor="directory-notifications">{t("admin.feishu.directory.notifications")}</label>
                      <Switch
                        id="directory-notifications"
                        checked={notifications}
                        onCheckedChange={setNotifications}
                        disabled={!editable}
                        size="sm"
                      />
                    </div>
                    {selected.length > 20 && <p role="alert">{t("admin.feishu.directory.limit")}</p>}
                    {selected.length !== selections.length && editable && (
                      <p role="alert">{t("admin.feishu.directory.duplicates")}</p>
                    )}
                    {failure && <p role="alert">{t("admin.feishu.directory.failed")}</p>}
                  </>
                )}
              </div>
            </DialogBody>
          </DialogMain>
          <DialogActions>
            <Button
              type="button"
              variant="secondary"
              size="md"
              stretch="auto"
              disabled={busy}
              onClick={() => setConfirm(false)}
              label={t("admin.common.close")}
            />
            <Button
              type="button"
              variant="primary"
              size="md"
              stretch="auto"
              loading={busy}
              disabled={!editable || !validDirectoryBatch(selections) || selected.length !== selections.length}
              onClick={() => void run(true)}
              label={t("admin.feishu.directory.bind_count", { count: selections.length })}
            />
          </DialogActions>
        </DialogContent>
      </Dialog>
      <DirectoryUnbindDialog state={unbindingState} />
    </>
  );
}

function DirectoryUnbindDialog({ state }: { state: ReturnType<typeof useDirectoryUnbind> }) {
  const { t } = useTranslation();
  const { unbindRow, setUnbindRow, unbinding, unbindError, unbind } = state;
  return (
    <Dialog
      open={!!unbindRow}
      onOpenChange={(open) => {
        if (!open && !unbinding) setUnbindRow(null);
      }}
    >
      <DialogContent size="md">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>{t("admin.feishu.directory.unbind_title")}</DialogTitle>
            </DialogHeading>
          </DialogHeader>
          <DialogBody>
            <p>
              {t("admin.feishu.directory.unbind_help", {
                user: unbindRow?.email || "",
                member: unbindRow?.binding_name || "",
              })}
            </p>
            {unbindError && <p role="alert">{t("admin.feishu.directory.failed")}</p>}
          </DialogBody>
        </DialogMain>
        <DialogActions>
          <Button
            stretch="auto"
            variant="secondary"
            size="md"
            disabled={unbinding}
            onClick={() => setUnbindRow(null)}
            label={t("admin.common.close")}
          />
          <Button
            stretch="auto"
            variant="primary"
            size="md"
            loading={unbinding}
            disabled={unbinding}
            onClick={() => void unbind()}
            label={t("admin.feishu.directory.unbind")}
          />
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}

function DirectoryRow({
  row,
  members,
  onUnbind,
  selected,
  skipped,
  onSkip,
  editable,
  manualUser,
  onSelect,
  onUserChange,
}: {
  row: TFeishuDirectoryRow;
  members: TFeishuDirectoryUser[];
  onUnbind: () => void;
  selected: boolean;
  skipped: boolean;
  onSkip: () => void;
  editable: boolean;
  manualUser?: TFeishuDirectoryUser;
  onSelect: (checked: boolean) => void;
  onUserChange: (user: TFeishuDirectoryUser) => void;
}) {
  const { t } = useTranslation();
  return (
    <tr>
      <td className="px-4 py-4 align-top">
        <Checkbox
          checked={selected}
          disabled={
            !editable || !!row.result || row.match_basis === "identity_conflict" || !(row.member_id || manualUser)
          }
          onCheckedChange={onSelect}
          aria-label={t("admin.feishu.directory.select_person", { name: row.name || row.email })}
        />
      </td>
      <td className="px-4 py-4 align-top">
        <p className="text-13 font-medium break-all">{row.name || t("admin.feishu.directory.unnamed")}</p>
        <p className="text-12 break-all text-tertiary">{row.email || t("admin.feishu.directory.no_email")}</p>
      </td>
      <td className="space-y-2 px-4 py-4 align-top">
        <DirectoryTarget
          row={row}
          members={members}
          manualUser={manualUser}
          editable={editable}
          onUserChange={onUserChange}
        />
      </td>
      <td className="px-4 py-4 align-top text-12 text-secondary">
        <div className="flex flex-col items-start gap-2">
          <span>{t(`admin.feishu.directory.${directoryRowStatus(row, selected, skipped, manualUser?.id)}`)}</span>
          {row.binding_id && (
            <Button
              stretch="auto"
              variant="secondary"
              size="sm"
              disabled={!editable}
              onClick={onUnbind}
              label={t("admin.feishu.directory.unbind")}
            />
          )}
          {!row.result && row.match_basis !== "identity_conflict" && !selected && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              stretch="auto"
              disabled={!editable}
              onClick={onSkip}
              label={t(skipped ? "admin.feishu.directory.restore" : "admin.feishu.directory.skip")}
            />
          )}
        </div>
      </td>
    </tr>
  );
}

function DirectoryPreviewStatus({ preview, now }: { preview: TFeishuDirectoryPreview; now: number }) {
  const { t } = useTranslation();
  const key = canBindDirectory(preview, now) ? "expires" : preview.status === "partial" ? "partial" : "expired";
  return (
    <>
      <p className="text-13 text-secondary">
        {t(`admin.feishu.directory.${key}`, { date: new Date(preview.expires_at) })}
      </p>
      <DirectoryPermissionError code={preview.error} />
    </>
  );
}
function DirectorySummary({
  preview,
  selected,
  skipped,
  manual,
}: {
  preview: TFeishuDirectoryPreview;
  selected: string[];
  skipped: string[];
  manual: Record<string, TFeishuDirectoryUser>;
}) {
  const { t } = useTranslation();
  const counts = directorySummary(
    preview,
    selected,
    skipped,
    Object.fromEntries(Object.entries(manual).map(([id, user]) => [id, user.id]))
  );
  return (
    <output className="block text-13 leading-6 text-secondary">
      {t("admin.feishu.directory.review_summary", counts)}
    </output>
  );
}

function DirectoryPermissionError({ code }: { code: string }) {
  const { t } = useTranslation();
  if (code !== "provider_error_99991672") return null;
  return (
    <p role="alert" className="text-13 text-danger-primary">
      {t("admin.feishu.directory.permission_required")}
    </p>
  );
}

function DirectoryTarget({
  row,
  members,
  manualUser,
  editable,
  onUserChange,
}: {
  row: TFeishuDirectoryRow;
  members: TFeishuDirectoryUser[];
  manualUser?: TFeishuDirectoryUser;
  editable: boolean;
  onUserChange: (user: TFeishuDirectoryUser) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      {" "}
      {row.result === "already_bound" || row.result === "bound" || row.match_basis === "oidc" ? (
        <p className="text-12 break-all text-tertiary">
          {row.binding_name || members.find((member) => member.id === row.member_id)?.display_name || "—"}
        </p>
      ) : row.match_basis !== "identity_conflict" ? (
        <UserPicker
          id={`directory-user-${row.id}`}
          users={members}
          value={manualUser || members.find((member) => member.id === row.member_id)}
          disabled={!editable || !!row.result}
          onChange={onUserChange}
        />
      ) : null}
      {!row.result && row.match_basis === "oidc" && (
        <p className="text-12 text-tertiary">{t("admin.feishu.directory.oidc_locked")}</p>
      )}
    </>
  );
}
