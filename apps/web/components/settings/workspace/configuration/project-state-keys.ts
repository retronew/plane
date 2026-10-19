export const PROJECT_PHASES = ["draft", "planning", "execution", "monitoring", "completed", "cancelled"] as const;
export const stateSettingsKey = (slug: string) => `project-state-settings:${slug}`;
