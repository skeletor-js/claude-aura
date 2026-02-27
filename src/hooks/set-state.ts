#!/usr/bin/env node

/**
 * Generic hook script for claude-aura.
 * Called by Claude Code hooks to update light state.
 *
 * Usage: node set-state.js <state>
 * States: idle, thinking, needs_input
 *
 * Reads port from ~/.claude-aura/config.json, falls back to 7685.
 * Designed to be fast -- fire and forget HTTP POST.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const state = process.argv[2];
if (!state) process.exit(0);

let port = 7685;
const configPath = join(homedir(), ".claude-aura", "config.json");
if (existsSync(configPath)) {
  try {
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    if (config.port) port = config.port;
  } catch {}
}

const body = JSON.stringify({ state });
const req = await fetch(`http://127.0.0.1:${port}/state`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body,
  signal: AbortSignal.timeout(2000),
}).catch(() => {});

process.exit(0);
