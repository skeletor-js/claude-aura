#!/usr/bin/env node

import { Command } from "commander";
import { runSetup } from "./cli/setup.js";
import { installHooks, uninstallHooks } from "./cli/install-hooks.js";
import {
  startDaemon,
  stopDaemon,
  isDaemonRunning,
  readPid,
} from "./daemon/daemon.js";
import {
  loadConfig,
  saveConfig,
  configExists,
} from "./config/config.js";
import { hexToCieXY } from "./hue/color.js";
import { setLightColor } from "./hue/light.js";

const program = new Command();

program
  .name("claude-aura")
  .description(
    "Your office light mirrors Claude Code's state. Thinking, waiting, done."
  )
  .version("0.1.0");

program
  .command("setup")
  .description("Pair your Hue bridge, pick a light, choose colors, install hooks")
  .action(async () => {
    await runSetup();
  });

program
  .command("start")
  .description("Start the daemon")
  .action(async () => {
    if (!configExists()) {
      console.error('Run "claude-aura setup" first.');
      process.exit(1);
    }
    await startDaemon();
  });

program
  .command("stop")
  .description("Stop the daemon")
  .action(() => {
    stopDaemon();
  });

program
  .command("status")
  .description("Show current state and config")
  .action(async () => {
    if (!configExists()) {
      console.error('Run "claude-aura setup" first.');
      process.exit(1);
    }
    const config = loadConfig();
    const running = isDaemonRunning();
    const pid = readPid();

    console.log("claude-aura status\n");
    console.log(`  Daemon:  ${running ? `running (PID ${pid})` : "stopped"}`);
    console.log(`  Bridge:  ${config.bridge.ip}`);
    console.log(`  Light:   ${config.light.name} (ID: ${config.light.id})`);
    console.log(`  Port:    ${config.port}`);
    console.log(`  Colors:`);
    console.log(`    idle:        ${config.colors.idle}`);
    console.log(`    thinking:    ${config.colors.thinking}`);
    console.log(`    needs_input: ${config.colors.needs_input}`);

    if (running) {
      try {
        const res = await fetch(
          `http://127.0.0.1:${config.port}/status`
        );
        const data = (await res.json()) as { state: string };
        console.log(`\n  Current state: ${data.state}`);
      } catch {
        console.log("\n  Could not reach daemon.");
      }
    }
  });

program
  .command("demo")
  .description("Cycle through all three states to verify your light")
  .action(async () => {
    if (!configExists()) {
      console.error('Run "claude-aura setup" first.');
      process.exit(1);
    }
    const config = loadConfig();
    const states = ["idle", "thinking", "needs_input"] as const;
    const labels = [
      `idle (${config.colors.idle})`,
      `thinking (${config.colors.thinking})`,
      `needs_input (${config.colors.needs_input})`,
    ];

    console.log(
      "\nDemo: cycling through states. Press Ctrl+C to stop.\n"
    );

    for (let i = 0; ; i = (i + 1) % 3) {
      const state = states[i];
      const xy = hexToCieXY(config.colors[state]);
      if (!xy) {
        console.error(`Invalid color for ${state}: ${config.colors[state]}`);
        process.exit(1);
      }
      try {
        await setLightColor(
          config.bridge.ip,
          config.bridge.username,
          config.light.id,
          xy,
          config.brightness,
          2000
        );
        console.log(`  ${labels[i]}`);
      } catch (err) {
        console.error("Failed:", err);
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, 4000));
    }
  });

program
  .command("colors")
  .description("Update colors without re-running full setup")
  .option("--idle <hex>", "Idle state color")
  .option("--thinking <hex>", "Thinking state color")
  .option("--needs-input <hex>", "Needs input state color")
  .action((opts: { idle?: string; thinking?: string; needsInput?: string }) => {
    if (!configExists()) {
      console.error('Run "claude-aura setup" first.');
      process.exit(1);
    }
    const config = loadConfig();
    let changed = false;

    for (const [key, val] of [
      ["idle", opts.idle],
      ["thinking", opts.thinking],
      ["needs_input", opts.needsInput],
    ] as const) {
      if (val) {
        if (!hexToCieXY(val)) {
          console.error(`Invalid hex for ${key}: ${val}`);
          process.exit(1);
        }
        config.colors[key as keyof typeof config.colors] = val;
        changed = true;
        console.log(`  ${key}: ${val}`);
      }
    }

    if (changed) {
      saveConfig(config);
      console.log("\nColors updated. Restart the daemon to apply.");
    } else {
      console.log("No colors specified. Usage:");
      console.log(
        '  claude-aura colors --idle "#E8DCC8" --thinking "#DA7756" --needs-input "#E3A869"'
      );
    }
  });

const hookCmd = program.command("hooks").description("Manage Claude Code hooks");

hookCmd
  .command("install")
  .description("Install Claude Code hooks")
  .action(() => {
    installHooks();
  });

hookCmd
  .command("uninstall")
  .description("Remove Claude Code hooks")
  .action(() => {
    uninstallHooks();
  });

program.parse();
