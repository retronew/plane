/** Match human-readable names and common Chinese topic keywords without changing stored icon IDs. */
const topics: [string, string[]][] = [
  ["项目 工作 任务 计划", ["work", "task", "project", "kanban", "checklist", "clipboard", "target", "flag"]],
  ["开发 技术 代码 程序", ["code", "terminal", "bug", "git", "api", "webhook", "braces", "binary"]],
  ["数据 图表 分析", ["data", "chart", "insight", "stat", "table", "trending"]],
  ["团队 用户 成员", ["user", "people", "person", "group", "team", "handshake"]],
  ["设计 画笔 颜色", ["design", "palette", "brush", "paint", "pen", "ruler"]],
  ["时间 日期 日历", ["time", "clock", "calendar", "date", "event", "schedule", "hourglass"]],
  ["安全 锁 钥匙", ["shield", "security", "lock", "key", "fingerprint"]],
  ["自然 植物 花 天气", ["tree", "leaf", "flower", "nature", "cloud", "sun", "rain", "snow", "plant"]],
  ["动物 宠物", ["pet", "paw", "dog", "cat", "bird", "fish", "rabbit", "turtle"]],
  ["文件 文件夹 文档", ["file", "folder", "document", "book", "note"]],
  ["消息 通知 邮件", ["mail", "message", "chat", "forum", "bell", "notification", "send"]],
  ["火箭 发射", ["rocket"]],
  ["设置 调整", ["setting", "tune", "slider"]],
];
const normalize = (value: string) => value.toLowerCase().replace(/[\s_-]/g, "");
export function matchesIconSearch(name: string, query: string): boolean {
  const normalized = normalize(query.trim());
  if (!normalized) return true;
  const icon = normalize(name);
  return (
    icon.includes(normalized) ||
    topics.some(
      ([keywords, names]) =>
        keywords.split(" ").some((word) => word === normalized) && names.some((word) => icon.includes(word))
    )
  );
}
