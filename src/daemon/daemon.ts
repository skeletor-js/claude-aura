import { createServer, type Server } from "http";
import { writeFileSync, readFileSync, existsSync, unlinkSync } from "fs";
import { loadConfig, PID_PATH, ensureConfigDir } from "../config/config.js";
import { hexToCieXY } from "../hue/color.js";
import { setLightColor, turnOffLight } from "../hue/light.js";
import type { AuraConfig, AuraState, CieXY } from "../types.js";

let running = false;
let httpServer: Server | null = null;
let currentState: AuraState = "idle";

function writePid(): void {
  writeFileSync(PID_PATH, process.pid.toString());
}

function removePid(): void {
  try {
    if (existsSync(PID_PATH)) unlinkSync(PID_PATH);
  } catch {}
}

export function readPid(): number | null {
  try {
    if (!existsSync(PID_PATH)) return null;
    const pid = parseInt(readFileSync(PID_PATH, "utf-8").trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

export function isDaemonRunning(): boolean {
  const pid = readPid();
  if (pid === null) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    removePid();
    return false;
  }
}

function resolveColor(config: AuraConfig, state: AuraState): CieXY {
  const hex = config.colors[state];
  const xy = hexToCieXY(hex);
  if (!xy) throw new Error(`Invalid color hex for state "${state}": ${hex}`);
  return xy;
}

async function applyState(config: AuraConfig, state: AuraState): Promise<void> {
  const xy = resolveColor(config, state);
  try {
    await setLightColor(
      config.bridge.ip,
      config.bridge.username,
      config.light.id,
      xy,
      config.brightness,
      config.transitionMs
    );
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${state} -> ${config.colors[state]}`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Failed to update light:`, err);
  }
}

function isValidState(s: string): s is AuraState {
  return s === "idle" || s === "thinking" || s === "needs_input";
}

function startHttpServer(config: AuraConfig): void {
  httpServer = createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // POST /state -- set the light state
    if (req.method === "POST" && req.url === "/state") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const data = JSON.parse(body);
          const state = data.state as string;
          if (!isValidState(state)) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error: `Invalid state. Use: idle, thinking, needs_input`,
              })
            );
            return;
          }
          if (state !== currentState) {
            currentState = state;
            await applyState(config, state);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, state: currentState }));
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    // GET /status -- current state
    if (req.method === "GET" && req.url === "/status") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          running: true,
          state: currentState,
          light: config.light.name,
          bridge: config.bridge.ip,
        })
      );
      return;
    }

    res.writeHead(404);
    res.end();
  });

  httpServer.listen(config.port, "127.0.0.1", () => {
    console.log(`  Listening: http://127.0.0.1:${config.port}`);
    console.log(`  POST /state  {"state": "idle|thinking|needs_input"}`);
    console.log(`  GET  /status`);
  });

  httpServer.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `Port ${config.port} in use. Is another instance running? Try "claude-aura stop" first.`
      );
      process.exit(1);
    } else {
      console.error("Server error:", err.message);
      process.exit(1);
    }
  });
}

export async function startDaemon(): Promise<void> {
  if (isDaemonRunning()) {
    console.error(
      'Daemon is already running. Use "claude-aura stop" first.'
    );
    process.exit(1);
  }

  const config = loadConfig();
  ensureConfigDir();
  writePid();
  running = true;

  console.log("claude-aura daemon started");
  console.log(`  Bridge: ${config.bridge.ip}`);
  console.log(`  Light: ${config.light.name} (ID: ${config.light.id})`);
  console.log(`  Colors: idle=${config.colors.idle} thinking=${config.colors.thinking} needs_input=${config.colors.needs_input}`);

  startHttpServer(config);

  currentState = "idle";
  await applyState(config, "idle");

  const shutdown = async () => {
    if (!running) return;
    running = false;
    console.log("\nclaude-aura stopping...");
    try {
      await turnOffLight(
        config.bridge.ip,
        config.bridge.username,
        config.light.id,
        config.transitionMs
      );
    } catch {}
    if (httpServer) httpServer.close();
    removePid();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

export function stopDaemon(): void {
  const pid = readPid();
  if (pid === null) {
    console.log("No daemon is running.");
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
    console.log(`Daemon (PID ${pid}) stopped.`);
    removePid();
  } catch {
    console.log("Daemon process not found. Cleaning up stale PID file.");
    removePid();
  }
}
