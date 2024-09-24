import { ConfigJson } from "@continuedev/config-types";
import { ContinueConfig, IDE, IdeSettings, SerializedContinueConfig } from "../../index.js";
import { IProfileLoader } from "./IProfileLoader.js";
import doLoadConfig from "./doLoadConfig.js";
import { ControlPlaneProvider, ControlPlaneProviderFactory } from "../../control-plane/provider";

export default class ControlPlaneProfileLoader implements IProfileLoader {
  private static RELOAD_INTERVAL = 1000 * 60 * 15; // every 15 minutes

  readonly profileId: string;
  profileTitle: string;

  workspaceSettings: ConfigJson | undefined;

  constructor(
    private readonly workspaceId: string,
    private workspaceTitle: string,
    private readonly controlPlaneProvider: ControlPlaneProvider,
    private readonly ide: IDE,
    private ideSettingsPromise: Promise<IdeSettings>,
    private writeLog: (message: string) => Promise<void>,
    private readonly onReload: () => void,
  ) {
    this.profileId = workspaceId;
    this.profileTitle = workspaceTitle;

    setInterval(async () => {
      this.workspaceSettings =
        await this.controlPlaneProvider.client.getSettingsForWorkspace(this.profileId);
      this.onReload();
    }, ControlPlaneProfileLoader.RELOAD_INTERVAL);
  }

  async doLoadConfig(): Promise<ContinueConfig> {
    const serializedConfig: SerializedContinueConfig = this.workspaceSettings ??
      ((await this.controlPlaneProvider.client!.getSettingsForWorkspace(
        this.profileId,
      )) as any);

    return doLoadConfig(
      this.ide,
      this.ideSettingsPromise,
      ControlPlaneProviderFactory.createProvider(this.ideSettingsPromise, this.controlPlaneProvider.client.sessionInfoPromise),
      this.writeLog,
      serializedConfig,
      this.workspaceId,
    );
  }

  setIsActive(isActive: boolean): void {}
}
