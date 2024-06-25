import { ControlPlaneClient } from "../control-plane/client.js";
import { TeamAnalytics } from "../control-plane/TeamAnalytics.js";
import {
  BrowserSerializedContinueConfig,
  ContinueConfig,
  ContinueRcJson,
  IContextProvider,
  IDE,
  IdeSettings,
  ILLM,
} from "../index.js";
import { Telemetry } from "../util/posthog.js";
import { finalToBrowserConfig, loadFullConfigNode } from "./load.js";

export class ConfigHandler {
  private savedConfig: ContinueConfig | undefined;
  private savedBrowserConfig?: BrowserSerializedContinueConfig;
  private additionalContextProviders: IContextProvider[] = [];

  constructor(
    private readonly ide: IDE,
    private ideSettingsPromise: Promise<IdeSettings>,
    private readonly writeLog: (text: string) => Promise<void>,
    private readonly controlPlaneClient: ControlPlaneClient,
  ) {
    this.ide = ide;
    this.ideSettingsPromise = ideSettingsPromise;
    this.writeLog = writeLog;
    try {
      this.loadConfig();
    } catch (e) {
      console.error("Failed to load config: ", e);
    }
  }

  updateIdeSettings(ideSettings: IdeSettings) {
    this.ideSettingsPromise = Promise.resolve(ideSettings);
    this.reloadConfig();
  }

  private updateListeners: (() => void)[] = [];
  onConfigUpdate(listener: () => void) {
    this.updateListeners.push(listener);
  }

  async reloadConfig() {
    this.savedConfig = undefined;
    this.savedBrowserConfig = undefined;
    this._pendingConfigPromise = undefined;

    await this.loadConfig();

    for (const listener of this.updateListeners) {
      listener();
    }
  }

  async getSerializedConfig(): Promise<BrowserSerializedContinueConfig> {
    if (!this.savedBrowserConfig) {
      this.savedConfig = await this.loadConfig();
      this.savedBrowserConfig = finalToBrowserConfig(this.savedConfig);
    }
    return this.savedBrowserConfig;
  }

  private _pendingConfigPromise?: Promise<ContinueConfig>;
  async loadConfig(): Promise<ContinueConfig> {
    if (this.savedConfig) {
      return this.savedConfig;
    } else if (this._pendingConfigPromise) {
      return this._pendingConfigPromise;
    }

    this._pendingConfigPromise = new Promise(async (resolve, reject) => {
      let workspaceConfigs: ContinueRcJson[] = [];
      try {
        workspaceConfigs = await this.ide.getWorkspaceConfigs();
      } catch (e) {
        console.warn("Failed to load workspace configs");
      }

      const ideInfo = await this.ide.getIdeInfo();
      const uniqueId = await this.ide.getUniqueId();
      const ideSettings = await this.ideSettingsPromise;

      const newConfig = await loadFullConfigNode(
        this.ide,
        workspaceConfigs,
        ideSettings,
        ideInfo.ideType,
        uniqueId,
        this.writeLog,
        this.controlPlaneClient,
      );
      newConfig.allowAnonymousTelemetry =
        newConfig.allowAnonymousTelemetry &&
        (await this.ide.isTelemetryEnabled());

      // Setup telemetry only after (and if) we know it is enabled
      await Telemetry.setup(
        newConfig.allowAnonymousTelemetry ?? true,
        await this.ide.getUniqueId(),
        ideInfo.extensionVersion,
      );
      const controlPlaneSettings = await this.controlPlaneClient.getSettings();
      await TeamAnalytics.setup(
        controlPlaneSettings.analytics,
        await this.ide.getUniqueId(),
        ideInfo.extensionVersion,
      );

      (newConfig.contextProviders ?? []).push(
        ...this.additionalContextProviders,
      );

      this.savedConfig = newConfig;
      resolve(newConfig);
    });

    this.savedConfig = await this._pendingConfigPromise;
    this._pendingConfigPromise = undefined;
    return this.savedConfig;
  }

  async llmFromTitle(title?: string): Promise<ILLM> {
    const config = await this.loadConfig();
    const model =
      config.models.find((m) => m.title === title) || config.models[0];
    if (!model) {
      throw new Error("No model found");
    }

    return model;
  }

  registerCustomContextProvider(contextProvider: IContextProvider) {
    this.additionalContextProviders.push(contextProvider);
    this.reloadConfig();
  }
}
