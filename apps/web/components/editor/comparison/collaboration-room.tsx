import useSWR from "swr";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Input } from "@makeplane/propel/components/input";
import { Button } from "@makeplane/propel/components/button";
import { getFileURL } from "@plane/utils";
import { useTranslation } from "@plane/i18n";
import { useUser } from "@/hooks/store/user";
import { comparisonRoomName, type ComparisonRoom } from "./collaboration";

export function useComparisonRoom() {
  const { data: user, fetchCurrentUser } = useUser();
  const { isLoading } = useSWR("USER_INFORMATION", () => fetchCurrentUser(), { shouldRetryOnError: false });
  const [search, setSearch] = useSearchParams();
  const [fields, setFields] = useState(() => ({
    workspaceSlug: search.get("workspaceSlug") ?? "",
    projectId: search.get("projectId") ?? "",
    room: search.get("room") ?? "",
  }));
  const [roomError, setRoomError] = useState(false);
  const userId = user?.id;
  const userName = user?.display_name || user?.first_name || userId;
  const avatar = user?.avatar_url;
  const collaboration = useMemo<ComparisonRoom | undefined>(() => {
    if (!userId || !search.get("room")) return undefined;
    const value = {
      livePort: search.get("livePort") ?? undefined,
      workspaceSlug: search.get("workspaceSlug") ?? "",
      projectId: search.get("projectId") ?? "",
      room: search.get("room") ?? "",
      user: {
        id: userId,
        name: userName ?? userId,
        avatar: getFileURL(avatar ?? "") ?? "",
      },
    };
    try {
      comparisonRoomName(value);
      return value;
    } catch {
      return undefined;
    }
  }, [search, userId, userName, avatar]);
  const joinRoom = () => {
    try {
      if (!user) throw new Error("Sign in required");
      comparisonRoomName(fields);
      setSearch({ ...fields, ...(search.get("livePort") ? { livePort: search.get("livePort")! } : {}) });
      setRoomError(false);
    } catch {
      setRoomError(true);
    }
  };
  return { isLoading, collaboration, fields, setFields, roomError, joinRoom, leaveRoom: () => setSearch({}) };
}

export function ComparisonRoomControls({ controls }: { controls: ReturnType<typeof useComparisonRoom> }) {
  const { t } = useTranslation();
  const { isLoading, collaboration, fields, setFields, roomError, joinRoom, leaveRoom } = controls;
  return (
    <section className="space-y-3 rounded-lg border border-subtle p-4">
      <h2 className="text-16 font-semibold">{t("editor_comparison.collaboration")}</h2>
      <p className="text-13 text-secondary">{t("editor_comparison.collaboration_note")}</p>
      <div className="flex flex-wrap items-end gap-3">
        {(["workspaceSlug", "projectId", "room"] as const).map((key) => (
          <label key={key} className="flex flex-col gap-1 text-13">
            {t(`editor_comparison.${key}`)}
            <Input
              size="md"
              value={fields[key]}
              onChange={(event) => setFields((value) => ({ ...value, [key]: event.target.value.trim() }))}
            />
          </label>
        ))}
        <Button
          size="sm"
          stretch="auto"
          variant="secondary"
          label={t("editor_comparison.newRoom")}
          onClick={() => setFields((value) => ({ ...value, room: crypto.randomUUID() }))}
        />
        <Button
          disabled={isLoading}
          size="sm"
          stretch="auto"
          variant="primary"
          label={t("editor_comparison.joinRoom")}
          onClick={joinRoom}
        />
        {collaboration && (
          <Button
            size="sm"
            stretch="auto"
            variant="secondary"
            label={t("editor_comparison.leaveRoom")}
            onClick={leaveRoom}
          />
        )}
      </div>
      {roomError && (
        <p role="alert" className="text-danger-primary">
          {t("editor_comparison.roomError")}
        </p>
      )}
      {collaboration && <p className="text-13 text-secondary">{t("editor_comparison.roomShare")}</p>}
      <p className="text-13 text-secondary">{t("editor_comparison.assetLimit")}</p>
    </section>
  );
}
