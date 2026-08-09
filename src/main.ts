import { Plugin, type WorkspaceLeaf } from "obsidian";
import { NativeGraphBridge } from "./folder-clustering/bridge";
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
} from "./folder-clustering/constants";
import { FolderVirtualLinksSettingTab } from "./folder-clustering/settings";
import type {
  FolderDepth,
  FolderVirtualLinksSettings,
  TopologyDegree,
} from "./folder-clustering/types";

export default class FolderVirtualLinksPlugin extends Plugin {
  override settings: FolderVirtualLinksSettings = {
    ...DEFAULT_SETTINGS,
    excludedFolders: [],
  };
  private bridge: NativeGraphBridge | undefined;
  private isActive = false;

  override async onload(): Promise<void> {
    this.isActive = true;
    await this.loadSettings();
    this.bridge = new NativeGraphBridge(this.app, () => this.settings);
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
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        this.patchAfterLeafLoad(leaf);
      }),
    );
    this.app.workspace.onLayoutReady(() => {
      if (this.isActive) {
        this.patchAfterLeafLoad(this.app.workspace.getMostRecentLeaf());
      }
    });
  }

  override onunload(): void {
    this.isActive = false;
    this.bridge?.dispose();
    this.bridge = undefined;
  }

  async updateTopologyDegree(topologyDegree: TopologyDegree): Promise<void> {
    await this.updateSettings({ topologyDegree });
  }

  async updateFolderDepth(folderDepth: FolderDepth): Promise<void> {
    await this.updateSettings({ folderDepth });
  }

  async updateShowFolderContours(showFolderContours: boolean): Promise<void> {
    await this.updateSettings({ showFolderContours });
  }

  async addExcludedFolder(folderPath: string): Promise<void> {
    await this.updateSettings({
      excludedFolders: [...this.settings.excludedFolders, folderPath],
    });
  }

  async removeExcludedFolder(folderPath: string): Promise<void> {
    await this.updateSettings({
      excludedFolders: this.settings.excludedFolders.filter(
        (path) => path !== folderPath,
      ),
    });
  }

  private async loadSettings(): Promise<void> {
    this.settings = normalizeSettings(await this.loadData());
  }

  private patchAfterLeafLoad(leaf: WorkspaceLeaf | null): void {
    void this.bridge?.patchAfterLeafLoad(leaf);
  }

  private async updateSettings(
    updates: Partial<FolderVirtualLinksSettings>,
  ): Promise<void> {
    this.settings = normalizeSettings({ ...this.settings, ...updates });
    await this.saveData(this.settings);
    this.bridge?.refreshAll();
  }
}
