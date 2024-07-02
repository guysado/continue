import fetch, { RequestInit, Response } from "node-fetch";
import { ModelDescription } from "..";
import { ControlPlaneSettings } from "./schema";

export interface ControlPlaneSessionInfo {
  accessToken: string;
  account: {
    label: string;
    id: string;
  };
}

export interface ControlPlaneWorkspace {
  id: string;
  name: string;
  settings: ControlPlaneSettings;
}

export interface ControlPlaneModelDescription extends ModelDescription {}

export class ControlPlaneClient {
  private static URL = "http://localhost:3001";
  private static ACCESS_TOKEN_VALID_FOR_MS = 1000 * 60 * 5; // 5 minutes

  private lastAccessTokenRefresh = 0;

  constructor(
    private readonly sessionInfoPromise: Promise<
      ControlPlaneSessionInfo | undefined
    >,
  ) {}

  get userId(): Promise<string | undefined> {
    return this.sessionInfoPromise.then(
      (sessionInfo) => sessionInfo?.account.id,
    );
  }

  private async refreshAccessToken(refreshToken: string): Promise<string> {
    const url = "https://api.workos.com/user_management/authenticate";
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: "client_01J0FW6XCPMJMQ3CG51RB4HBZQ",
        client_secret: "sk_test_123",
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    return "";
  }

  private async getAccessToken(): Promise<string | undefined> {
    const tokens = (await this.sessionInfoPromise)?.accessToken;
    const { access_token, refresh_token } = JSON.parse(tokens || "{}");

    if (
      this.lastAccessTokenRefresh +
        ControlPlaneClient.ACCESS_TOKEN_VALID_FOR_MS -
        10_000 <
      Date.now()
    ) {
      return await this.refreshAccessToken(refresh_token);
    }
    return access_token;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error("No access token");
    }
    const resp = await fetch(new URL(path, ControlPlaneClient.URL).toString(), {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!resp.ok) {
      throw new Error(
        `Control plane request failed: ${resp.status} ${await resp.text()}`,
      );
    }

    return resp;
  }

  public async listWorkspaces(): Promise<ControlPlaneWorkspace[]> {
    return [
      {
        id: "7",
        name: "Personal Workspace",
        settings: {} as any,
      },
      {
        id: "8",
        name: "Continue Team",
        settings: {} as any,
      },
    ];
    const userId = await this.userId;
    if (!userId) {
      return [];
    }

    const resp = await this.request(`/users/${userId}/workspaces`, {
      method: "GET",
    });
    return (await resp.json()) as any;
  }

  async getSettingsForWorkspace(
    workspaceId: string,
  ): Promise<ControlPlaneSettings> {
    const userId = await this.userId;
    if (!userId) {
      throw new Error("No user id");
    }

    const resp = await this.request(`/workspaces/${workspaceId}`, {
      method: "GET",
    });
    return ((await resp.json()) as any).settings;
  }
}
