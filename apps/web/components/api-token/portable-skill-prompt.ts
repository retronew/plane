const skillInstallCommand =
  "npx skills add https://github.com/retronew/plane-plugins/tree/main/plugins/plane-workflow/skills";

export function buildPortableInstallPrompt(origin: string) {
  return `先检查 shell、Node.js/npx 和客户端技能加载能力。运行 ${skillInstallCommand} --list，确认分发仓库可发现全部 8 个 skills；--list 只发现技能，不会安装。确认后运行 ${skillInstallCommand}，安装全部 8 个 skills，让用户选择目标客户端和项目级或全局安装范围；没有明确授权，不默认添加 --global、--agent 或 --yes。运行 npx skills list（全局安装使用 npx skills list --global），再检查当前客户端是否实际加载全部 8 个 skills，按需重新加载。缺少安装能力时，提供 ${origin}/skills/plane-workflow.zip，解压后按客户端支持的方式逐个上传或安装其中 8 个技能目录；普通聊天附件不算安装。不支持技能时明确说明限制，不声称已安装。`;
}
