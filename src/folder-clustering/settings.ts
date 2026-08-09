import { App, PluginSettingTab, Setting } from "obsidian";
import type FolderVirtualLinksPlugin from "../main";
import type { TopologyDegree } from "./types";

export class FolderVirtualLinksSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: FolderVirtualLinksPlugin,
  ) {
    super(app, plugin);
  }

  override display(): void {
    this.containerEl.empty();

    new Setting(this.containerEl)
      .setName("Folder topology degree")
      .setDesc("Higher values pull notes in the same folder closer.")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("3", "3 (default)")
          .addOption("4", "4 (strong)")
          .setValue(String(this.plugin.settings.topologyDegree))
          .onChange(async (value) => {
            const topologyDegree: TopologyDegree = value === "4" ? 4 : 3;
            await this.plugin.updateTopologyDegree(topologyDegree);
          });
      });
  }
}
