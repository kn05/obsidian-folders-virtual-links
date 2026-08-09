import { App, PluginSettingTab, Setting, SuggestModal } from "obsidian";
import type FolderVirtualLinksPlugin from "../main";
import type { FolderDepth, TopologyDegree } from "./types";

class FolderSuggestModal extends SuggestModal<string> {
  constructor(
    app: App,
    private readonly folderPaths: readonly string[],
    private readonly onChoose: (folderPath: string) => Promise<void>,
  ) {
    super(app);
    this.setPlaceholder("Search folders");
    this.emptyStateText = "No folders available";
  }

  override getSuggestions(query: string): string[] {
    const normalizedQuery = query.toLocaleLowerCase();
    return this.folderPaths.filter((path) =>
      path.toLocaleLowerCase().includes(normalizedQuery),
    );
  }

  override renderSuggestion(folderPath: string, element: HTMLElement): void {
    element.setText(folderPath);
  }

  override onChooseSuggestion(folderPath: string): void {
    void this.onChoose(folderPath);
  }
}

function folderDepthOptions(
  folderPaths: readonly string[],
  currentDepth: FolderDepth,
): Map<string, string> {
  const maxVaultDepth = Math.max(
    1,
    ...folderPaths.map((path) => path.split("/").length),
  );
  const maxDepth =
    typeof currentDepth === "number"
      ? Math.max(currentDepth, maxVaultDepth)
      : maxVaultDepth;
  const options = new Map([["direct", "Direct parent (default)"]]);
  for (let depth = 1; depth <= maxDepth; depth += 1) {
    options.set(String(depth), depth === 1 ? "1 (top level)" : String(depth));
  }
  return options;
}

function isCoveredByExclusion(
  folderPath: string,
  excludedFolders: readonly string[],
): boolean {
  return excludedFolders.some(
    (excluded) =>
      folderPath === excluded || folderPath.startsWith(`${excluded}/`),
  );
}

export class FolderVirtualLinksSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: FolderVirtualLinksPlugin,
  ) {
    super(app, plugin);
  }

  override display(): void {
    this.renderSettings();
  }

  private renderSettings(): void {
    this.containerEl.empty();

    const folderPaths = this.app.vault
      .getAllFolders()
      .map((folder) => folder.path)
      .sort((left, right) => left.localeCompare(right));

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

    new Setting(this.containerEl)
      .setName("Folder grouping depth")
      .setDesc(
        "Choose which ancestor folder groups nested notes. Direct parent keeps each folder separate.",
      )
      .addDropdown((dropdown) => {
        for (const [value, label] of folderDepthOptions(
          folderPaths,
          this.plugin.settings.folderDepth,
        )) {
          dropdown.addOption(value, label);
        }
        dropdown
          .setValue(String(this.plugin.settings.folderDepth))
          .onChange(async (value) => {
            const numericDepth = Number(value);
            const folderDepth: FolderDepth =
              value === "direct" || !Number.isSafeInteger(numericDepth)
                ? "direct"
                : numericDepth;
            await this.plugin.updateFolderDepth(folderDepth);
          });
      });

    new Setting(this.containerEl)
      .setName("Show folder contours")
      .setDesc(
        "Draw a labeled, translucent area around each visible folder group.",
      )
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.showFolderContours)
          .onChange(async (value) => {
            await this.plugin.updateShowFolderContours(value);
          });
      });

    new Setting(this.containerEl)
      .setName("Excluded folders")
      .setDesc("Ignore selected folders and all their subfolders.")
      .addButton((button) => {
        button.setButtonText("Add folder").onClick(() => {
          const availableFolders = folderPaths.filter(
            (path) =>
              !isCoveredByExclusion(path, this.plugin.settings.excludedFolders),
          );
          new FolderSuggestModal(
            this.app,
            availableFolders,
            async (folderPath) => {
              await this.plugin.addExcludedFolder(folderPath);
              this.renderSettings();
            },
          ).open();
        });
      });

    for (const folderPath of this.plugin.settings.excludedFolders) {
      new Setting(this.containerEl)
        .setName(folderPath)
        .addExtraButton((button) => {
          button
            .setIcon("x")
            .setTooltip(`Remove ${folderPath}`)
            .onClick(async () => {
              await this.plugin.removeExcludedFolder(folderPath);
              this.renderSettings();
            });
        });
    }
  }
}
