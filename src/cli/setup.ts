import { select, input } from "@inquirer/prompts";
import { discoverBridges, createUser, getLights } from "../hue/bridge.js";
import { flashLight } from "../hue/light.js";
import { saveConfig, ensureConfigDir } from "../config/config.js";
import { hexToCieXY } from "../hue/color.js";
import {
  DEFAULT_COLORS,
  DEFAULT_BRIGHTNESS,
  DEFAULT_TRANSITION_MS,
  DEFAULT_PORT,
} from "../config/defaults.js";
import type { AuraConfig } from "../types.js";
import { installHooks } from "./install-hooks.js";

export async function runSetup(): Promise<void> {
  console.log("\nclaude-aura setup\n");

  // Step 1: Find bridge
  console.log("Searching for Hue bridges on your network...");
  let bridgeIp: string;
  try {
    const bridges = await discoverBridges();
    if (bridges.length === 0) {
      bridgeIp = await input({
        message: "No bridges found. Enter your bridge IP:",
      });
    } else if (bridges.length === 1) {
      console.log(`Found bridge at ${bridges[0].internalipaddress}`);
      bridgeIp = bridges[0].internalipaddress;
    } else {
      bridgeIp = await select({
        message: "Multiple bridges found. Select one:",
        choices: bridges.map((b) => ({
          name: `${b.internalipaddress} (${b.id})`,
          value: b.internalipaddress,
        })),
      });
    }
  } catch {
    bridgeIp = await input({
      message: "Bridge discovery failed. Enter your bridge IP:",
    });
  }

  // Step 2: Pair
  console.log("\nPress the link button on your Hue bridge, then press Enter.");
  await input({ message: "Press Enter when ready..." });

  let username: string;
  let attempts = 0;
  while (true) {
    try {
      const result = await createUser(bridgeIp);
      username = result.username;
      console.log("Paired successfully!");
      break;
    } catch {
      attempts++;
      if (attempts >= 3) {
        console.error("Failed to pair after 3 attempts.");
        process.exit(1);
      }
      console.log("Link button not pressed. Try again...");
      await input({ message: "Press Enter after pressing the link button..." });
    }
  }

  // Step 3: Select light
  console.log("\nFetching lights...");
  const lights = await getLights(bridgeIp, username);
  if (lights.length === 0) {
    console.error("No lights found on this bridge.");
    process.exit(1);
  }

  const lightId = await select({
    message: "Select the light to use:",
    choices: lights.map((l) => ({
      name: `${l.name} (${l.type}${l.state.reachable ? "" : ", unreachable"})`,
      value: parseInt(l.id, 10),
    })),
  });

  const selectedLight = lights.find((l) => parseInt(l.id, 10) === lightId)!;
  console.log(`Flashing "${selectedLight.name}" to confirm...`);
  await flashLight(bridgeIp, username, lightId);

  // Step 4: Colors (offer defaults or custom)
  const useDefaults = await select({
    message: "Use default Claude-inspired colors?",
    choices: [
      {
        name: `Yes (idle=${DEFAULT_COLORS.idle}, thinking=${DEFAULT_COLORS.thinking}, needs_input=${DEFAULT_COLORS.needs_input})`,
        value: true,
      },
      { name: "No, I'll enter custom hex codes", value: false },
    ],
  });

  let colors = { ...DEFAULT_COLORS };

  if (!useDefaults) {
    const validateHex = (v: string) =>
      hexToCieXY(v.trim()) ? true : "Invalid hex (use e.g. #DA7756)";

    colors.idle = await input({
      message: "Idle color (ambient, low-key):",
      default: DEFAULT_COLORS.idle,
      validate: validateHex,
    });
    colors.thinking = await input({
      message: "Thinking color (Claude is working):",
      default: DEFAULT_COLORS.thinking,
      validate: validateHex,
    });
    colors.needs_input = await input({
      message: "Needs input color (your turn):",
      default: DEFAULT_COLORS.needs_input,
      validate: validateHex,
    });
  }

  // Step 5: Save
  const config: AuraConfig = {
    bridge: { ip: bridgeIp, username },
    light: { id: lightId, name: selectedLight.name },
    colors,
    brightness: DEFAULT_BRIGHTNESS,
    transitionMs: DEFAULT_TRANSITION_MS,
    port: DEFAULT_PORT,
  };

  ensureConfigDir();
  saveConfig(config);
  console.log("\nConfiguration saved!");

  // Step 6: Install hooks
  console.log("");
  installHooks();

  console.log('\nSetup complete! Run "claude-aura start" to begin.');
}
