import { autorun } from "mobx";
import type { RootStore } from "@/store/root.store";
import { BaseTimeLineStore } from "./base-timeline.store";

/** Projects use the same date/position calculation and reactive data binding as modules. */
export class ProjectsTimeLineStore extends BaseTimeLineStore {
  constructor(rootStore: RootStore) {
    super(rootStore);
    autorun(() => this.updateBlocks(this.rootStore.projectRoot.project.getProjectById));
  }
}
