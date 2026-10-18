/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane types
import { useTranslation } from "@plane/i18n";
import { getDateTimeFormatter } from "@plane/utils";
import type { IUser } from "@plane/types";
// plane ui
// hooks
import { useCurrentTime } from "@/hooks/use-current-time";

const greetingHourFormatter = new Intl.DateTimeFormat("en-US", { hour12: false, hour: "numeric" });

export interface IUserGreetingsView {
  user: IUser;
}

export function UserGreetingsView(props: IUserGreetingsView) {
  const { user } = props;
  // current time hook
  const { currentTime } = useCurrentTime();
  // store hooks
  const { t } = useTranslation();

  const hour = greetingHourFormatter.format(currentTime);

  // e.g. "Wednesday, Oct 14" (en) / "10月14日星期三" (zh-CN)
  const dateString = getDateTimeFormatter({
    timeZone: user?.user_timezone,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(currentTime);

  const timeString = getDateTimeFormatter({
    timeZone: user?.user_timezone,
    hourCycle: "h23", // Use 24-hour format
    hour: "2-digit",
    minute: "2-digit",
  }).format(currentTime);

  const greeting = parseInt(hour, 10) < 12 ? "morning" : parseInt(hour, 10) < 18 ? "afternoon" : "evening";

  return (
    <div className="my-6 flex flex-col items-center">
      <h2 className="text-center text-20 font-semibold">
        {t(`web.greeting_${greeting}`, { name: [user?.first_name, user?.last_name].filter(Boolean).join(" ") })}
      </h2>
      <h5 className="flex items-center gap-2 font-medium text-placeholder">
        <div>{greeting === "morning" ? "🌤️" : greeting === "afternoon" ? "🌥️" : "🌙️"}</div>
        <div>
          {dateString} {timeString}
        </div>
      </h5>
    </div>
  );
}
