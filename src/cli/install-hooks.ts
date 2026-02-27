import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, resolve } from "path";
import { homedir } from "os";

const CLAUDE_SETTINGS_DIR = join(homedir(), ".claude");
const CLAUDE_SETTINGS_PATH = join(CLAUDE_SETTINGS_DIR, "settings.json");

function getHookCommand(state: string): string {
  const hookScript = resolve(
    import.meta.dirname,
    "..",
    "hooks",
    "set-state.js"
  );
  return `node "${hookScript.replace(/\\/g, "/")}" ${state}`;
}

interface ClaudeSettings {
  hooks?: Record<
    string,
    Array<{
      matcher?: string;
      hooks: Array<{
        type: string;
        command: string;
        timeout?: number;
      }>;
    }>
  >;
  [key: string]: unknown;
}

function isAuraHook(entry: { hooks: Array<{ command: string }> }): boolean {
  return entry.hooks.some((h) => h.command.includes("claude-aura"));
}

export function installHooks(): void {
  if (!existsSync(CLAUDE_SETTINGS_DIR)) {
    mkdirSync(CLAUDE_SETTINGS_DIR, { recursive: true });
  }

  let settings: ClaudeSettings = {};
  if (existsSync(CLAUDE_SETTINGS_PATH)) {
    settings = JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, "utf-8"));
  }

  if (!settings.hooks) settings.hooks = {};

  // Remove any existing aura hooks first
  for (const event of Object.keys(settings.hooks)) {
    settings.hooks[event] = settings.hooks[event].filter(
      (entry) => !isAuraHook(entry)
    );
    if (settings.hooks[event].length === 0) delete settings.hooks[event];
  }

  const hookDefs: Array<{
    event: string;
    state: string;
    matcher?: string;
    timeout: number;
  }> = [
    // User sends a prompt -> Claude starts thinking
    { event: "UserPromptSubmit", state: "thinking", timeout: 3 },
    // Claude needs permission -> needs input
    {
      event: "Notification",
      state: "needs_input",
      matcher: "permission_prompt",
      timeout: 3,
    },
    // Claude is idle waiting -> needs input
    {
      event: "Notification",
      state: "needs_input",
      matcher: "idle_prompt",
      timeout: 3,
    },
    // Claude finished responding -> needs input (your turn)
    { event: "Stop", state: "needs_input", timeout: 3 },
  ];

  for (const def of hookDefs) {
    if (!settings.hooks[def.event]) settings.hooks[def.event] = [];

    const entry: {
      matcher?: string;
      hooks: Array<{ type: string; command: string; timeout: number }>;
    } = {
      hooks: [
        {
          type: "command",
          command: getHookCommand(def.state),
          timeout: def.timeout,
        },
      ],
    };

    if (def.matcher) entry.matcher = def.matcher;

    settings.hooks[def.event].push(entry);
  }

  writeFileSync(
    CLAUDE_SETTINGS_PATH,
    JSON.stringify(settings, null, 2) + "\n"
  );

  console.log("Claude Code hooks installed:");
  console.log("  UserPromptSubmit -> thinking");
  console.log("  Notification (permission_prompt) -> needs_input");
  console.log("  Notification (idle_prompt) -> needs_input");
  console.log("  Stop -> needs_input");
  console.log(`\n  Settings: ${CLAUDE_SETTINGS_PATH}`);
}

export function uninstallHooks(): void {
  if (!existsSync(CLAUDE_SETTINGS_PATH)) {
    console.log("No Claude settings file found.");
    return;
  }

  const settings: ClaudeSettings = JSON.parse(
    readFileSync(CLAUDE_SETTINGS_PATH, "utf-8")
  );

  if (!settings.hooks) {
    console.log("No hooks found.");
    return;
  }

  let removed = 0;
  for (const event of Object.keys(settings.hooks)) {
    const before = settings.hooks[event].length;
    settings.hooks[event] = settings.hooks[event].filter(
      (entry) => !isAuraHook(entry)
    );
    removed += before - settings.hooks[event].length;
    if (settings.hooks[event].length === 0) delete settings.hooks[event];
  }

  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;

  writeFileSync(
    CLAUDE_SETTINGS_PATH,
    JSON.stringify(settings, null, 2) + "\n"
  );

  console.log(`Removed ${removed} claude-aura hook(s).`);
}
