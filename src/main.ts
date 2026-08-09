import { Plugin } from "obsidian";
import { NativeGraphBridge } from "./folder-clustering/bridge";
import { DEFAULT_SETTINGS } from "./folder-clustering/constants";
import { FolderVirtualLinksSettingTab } from "./folder-clustering/settings";
import type {
  FolderVirtualLinksSettings,
  TopologyDegree,
} from "./folder-clustering/types";

export default class FolderVirtualLinksPlugin extends Plugin {
  override settings: FolderVirtualLinksSettings = { ...DEFAULT_SETTINGS };
  private bridge: NativeGraphBridge | undefined;
  private isActive = false;

  override async onload(): Promise<void> {
    this.isActive = true;
    await this.loadSettings();
    this.bridge = new NativeGraphBridge(
      this.app,
      () => this.settings.topologyDegree,
    );
    this.addSettingTab(new FolderVirtualLinksSettingTab(this.app, this));

    this.addCommand({
      id: "rebuild-folder-virtual-links",
      name: "Rebuild folder virtual links",
      callback: () => this.bridge?.refreshAll(),
    });

    this.registerEvent(
      this.app.workspace.on("layout-change", () =>
        this.bridge?.patchOpenGraphs(),
      ),
    );
    this.app.workspace.onLayoutReady(() => {
      if (this.isActive) this.bridge?.patchOpenGraphs();
    });
  }

  override onunload(): void {
    this.isActive = false;
    this.bridge?.dispose();
    this.bridge = undefined;
  }

  async updateTopologyDegree(topologyDegree: TopologyDegree): Promise<void> {
    this.settings.topologyDegree = topologyDegree;
    await this.saveData(this.settings);
    this.bridge?.refreshAll();
  }

  private async loadSettings(): Promise<void> {
    const stored =
      (await this.loadData()) as Partial<FolderVirtualLinksSettings> | null;
    this.settings = {
      topologyDegree:
        stored?.topologyDegree === 4 ? 4 : DEFAULT_SETTINGS.topologyDegree,
    };
  }
}
