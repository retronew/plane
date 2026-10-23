import { useSyncExternalStore } from "react";
import { useTranslation } from "@plane/i18n";
import { ApiTokenCopyButton } from "./copy-feedback";
import { McpCodePreview } from "./mcp-code-preview";
import { buildPortableInstallPrompt } from "./portable-skill-prompt";

const subscribe = () => () => {};
const getOrigin = () => window.location.origin;
const getServerOrigin = () => "";
const skillInstallCommand =
  "npx skills add https://github.com/retronew/plane-plugins/tree/main/plugins/plane-workflow/skills";

type SkillClient = "claude" | "desktop" | "chatgpt" | "codex" | "copilot" | "generic";

export function buildSkillAgentPrompt(_client: SkillClient, origin: string) {
  return `请为当前客户端安装 Plane Workflow 的全部 8 个 skills。\n\n${buildPortableInstallPrompt(origin)}\n\n保留已有技能和配置，遇到覆盖先比较并征求确认。分别报告安装和实际加载结果，不读取、搜集或回显凭据。`;
}

export function ApiTokenSkillSetup() {
  const { t } = useTranslation();
  const origin = useSyncExternalStore(subscribe, getOrigin, getServerOrigin);
  return (
    <div className="mt-5 space-y-4">
      <p className="text-13 text-secondary">{t("account_settings.skills.connection_hint")}</p>
      <div className="space-y-3 rounded-lg border border-subtle bg-surface-1 p-3">
        <h2 className="text-13 font-medium">{t("account_settings.skills.agent_title")}</h2>
        <p className="text-12 text-secondary">{t("account_settings.skills.agent_description")}</p>
        <ApiTokenCopyButton
          value={buildSkillAgentPrompt("generic", origin)}
          label={t("account_settings.skills.agent_title")}
        />
      </div>
      <div className="space-y-3 rounded-lg border border-subtle bg-surface-1 p-3">
        <h2 className="text-13 font-medium">{t("account_settings.skills.manual_title")}</h2>
        <p className="text-12 text-secondary">{t("account_settings.skills.generic_step_1")}</p>
        <McpCodePreview value={skillInstallCommand} label={t("account_settings.skills.manual_title")} />
        <p className="text-12 text-secondary">{t("account_settings.skills.generic_step_2")}</p>
        <a className="text-12 text-primary underline" href="/skills/plane-workflow.zip" download="plane-workflow.zip">
          {t("account_settings.skills.download")}
        </a>
      </div>
    </div>
  );
}
