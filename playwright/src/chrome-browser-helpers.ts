import type { ChildProcess } from "child_process";
import { spawn } from "child_process";
import path from "path";
import os from "os";
import fs from "fs";

export interface ChromeBrowserInstance {
  process: ChildProcess;
  cdpUrl: string;
  userDataDir: string;
  port: number;
}

/**
 * Creates Chrome preferences files to disable password saving prompts and allow NXM protocol
 *
 * @param userDataDir - Path to Chrome user data directory
 */
export function createChromePreferences(userDataDir: string): void {
  // Create the user data directory if it doesn't exist
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  // Create a Default profile directory
  const defaultProfileDir = path.join(userDataDir, "Default");
  if (!fs.existsSync(defaultProfileDir)) {
    fs.mkdirSync(defaultProfileDir, { recursive: true });
  }

  // Write Chrome Preferences (profile-specific settings)
  const preferencesPath = path.join(defaultProfileDir, "Preferences");
  const preferences = {
    credentials_enable_service: false,
    profile: {
      password_manager_enabled: false,
    },
    protocol_handler: {
      excluded_schemes: {
        nxm: false, // false means NOT excluded (allowed)
      },
      // This is the EXACT format Chrome writes when you click "Always allow"
      // Format: origin as key, then protocol as key inside with value true
      allowed_origin_protocol_pairs: {
        "https://www.nexusmods.com": {
          nxm: true,
        },
      },
    },
  };
  fs.writeFileSync(preferencesPath, JSON.stringify(preferences, null, 2));
  console.log(
    "Created Chrome Preferences with NXM protocol handler pre-allowed",
  );

  // Write Local State (global Chrome settings)
  // Use AutoLaunchProtocolsFromOrigins policy to auto-allow NXM protocol from any origin
  const localStatePath = path.join(userDataDir, "Local State");
  const localState = {
    protocol_handler: {
      excluded_schemes: {
        nxm: false, // false means NOT excluded (allowed)
      },
    },
    browser: {
      enabled_labs_experiments: [
        "protocol-handling-policy@1", // Enable protocol handling policy
      ],
    },
    // AutoLaunchProtocolsFromOrigins - allows protocols to launch without prompt
    policy: {
      AutoLaunchProtocolsFromOrigins: [
        {
          protocol: "nxm",
          allowed_origins: ["*"], // Allow from all origins (including nexusmods.com)
        },
      ],
    },
  };
  fs.writeFileSync(localStatePath, JSON.stringify(localState, null, 2));
  console.log(
    "Created Chrome Local State with NXM protocol auto-launch policy",
  );
}

/**
 * Launches Chrome with remote debugging enabled
 * Uses a temporary profile directory (homemade incognito mode)
 *
 * @param port - Remote debugging port (default: 9222)
 * @returns ChromeBrowserInstance with process handle and connection info
 */
export async function launchRealChrome(
  port: number = 9222,
): Promise<ChromeBrowserInstance> {
  const chromePath =
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  // Use a temp directory that gets wiped at the end (homemade incognito mode)
  const userDataDir = path.join(os.tmpdir(), "chrome-test-profile");

  // Create Chrome preferences to disable password prompts
  createChromePreferences(userDataDir);

  // Launch Chrome with remote debugging
  const chromeProcess = spawn(
    chromePath,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-sync",
      "--disable-session-crashed-bubble",
      "--disable-infobars",
      "--restore-last-session=false",
    ],
    {
      detached: false,
      stdio: "ignore",
    },
  );

  // Wait for Chrome to start and remote debugging to be ready
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return {
    process: chromeProcess,
    cdpUrl: `http://127.0.0.1:${port}`,
    userDataDir,
    port,
  };
}

/**
 * Closes Chrome and cleans up the temporary profile directory
 *
 * @param instance - ChromeBrowserInstance returned from launchRealChrome
 */
export async function closeRealChrome(
  instance: ChromeBrowserInstance,
): Promise<void> {
  // Kill Chrome process
  if (instance.process) {
    instance.process.kill();
    // Wait for Chrome to fully close
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Wipe the temporary profile
  if (fs.existsSync(instance.userDataDir)) {
    try {
      fs.rmSync(instance.userDataDir, { recursive: true, force: true });
      console.log("Temporary Chrome profile cleaned up");
    } catch (e) {
      console.error("Failed to clean up Chrome profile:", e);
    }
  }
}
