import { getContinueGlobalPath } from "core/util/paths";
import { ExtensionContext } from "vscode";
import fs from "fs";
import { useEffect } from "react";
/**
 * Clear all Continue-related artifacts to simulate a brand new user
 */
export function cleanSlate(context: ExtensionContext) {
  // Commented just to be safe
  // // Remove ~/.continue
  // const continuePath = getContinueGlobalPath();
  // if (fs.existsSync(continuePath)) {
  //   fs.rmSync(continuePath, { recursive: true, force: true });
  // }
  // // Clear extension's globalState
  // context.globalState.keys().forEach((key) => {
  //   context.globalState.update(key, undefined);
  // });
}
