import { createContext, useContext } from "react";
export const DisabledPlateFeatures = createContext<readonly string[]>([]);
const aliases: Record<string, string[]> = {
  image: ["image", "imageComponent"],
  table: ["table"],
  codeBlock: ["codeBlock"],
  horizontalRule: ["horizontalRule"],
  todoList: ["taskList", "taskItem"],
  callout: ["callout-component"],
  mention: ["mention", "mentions"],
  attachment: ["attachment"],
  bold: ["bold"],
  italic: ["italic"],
  underline: ["underline"],
  strikethrough: ["strike", "strikethrough"],
  code: ["code"],
  link: ["link"],
  color: ["color", "text-color"],
  backgroundColor: ["backgroundColor", "background-color"],
  alignment: ["textAlign"],
  heading: ["heading"],
  emoji: ["emoji"],
  ai: ["ai"],
};
export function isPlateFeatureDisabled(disabled: readonly string[], feature: string) {
  return (aliases[feature] ?? [feature]).some((key) => disabled.includes(key));
}
export function useDisabledPlateFeatures() {
  const disabled = useContext(DisabledPlateFeatures);
  return (feature: string) => isPlateFeatureDisabled(disabled, feature);
}
