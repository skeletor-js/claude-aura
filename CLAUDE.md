# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

claude-aura is a Node.js CLI that bridges Claude Code with Philips Hue smart lights. It provides real-time visual feedback by changing a light's color based on Claude Code's state (idle, thinking, needs input). It uses a daemon + hook architecture: Claude Code lifecycle hooks POST state changes to a local HTTP daemon, which then sends color commands to a Hue bridge.

## Build & Development Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript (tsc → dist/)
npm run dev          # Watch mode (tsc --watch)
npm link             # Create global `claude-aura` CLI symlink
```

There are no tests or linter configured.

## CLI Commands (after `npm link`)

```bash
claude-aura setup              # Full setup wizard (bridge, light, colors, hooks)
claude-aura start              # Start the daemon (port 7685)
claude-aura stop               # Stop the daemon
claude-aura status             # Show daemon state and config
claude-aura demo               # Cycle through states to test light
claude-aura colors             # Update colors without full setup
claude-aura hooks install      # Install Claude Code hooks
claude-aura hooks uninstall    # Remove Claude Code hooks
```

## Architecture

```
Claude Code hook event → set-state.js (HTTP POST) → daemon (port 7685) → Hue bridge API → light
```

- **CLI entry** (`src/index.ts`): Commander.js routes to subcommands
- **Daemon** (`src/daemon/daemon.ts`): HTTP server on 127.0.0.1:7685, receives state changes, applies colors to lights
- **Hook script** (`src/hooks/set-state.ts`): Minimal script invoked by Claude Code hooks, fire-and-forget POST to daemon
- **Hue integration** (`src/hue/`): Bridge discovery, light control, hex→CIE XY color conversion, HTTPS with self-signed cert handling
- **Setup wizard** (`src/cli/setup.ts`): Interactive bridge pairing, light selection, color config
- **Hook installer** (`src/cli/install-hooks.ts`): Reads/writes `~/.claude/settings.json` to register Claude Code hooks
- **Config** (`src/config/`): Manages `~/.claude-aura/config.json`
- **Types** (`src/types.ts`): All shared interfaces (`AuraConfig`, `AuraState`, `CieXY`, etc.)

## Key Technical Details

- **ESM modules**: `"type": "module"` in package.json; all imports use `.js` extensions (TypeScript Node16 module resolution)
- **CIE XY color space**: Hue bridge requires CIE 1931 xy coordinates, not RGB. The `hue/color.ts` module handles sRGB→linear→XYZ→xy conversion
- **Self-signed TLS**: Hue bridges use self-signed certs; `hue/fetch.ts` uses undici Agent to bypass cert validation for local bridge communication
- **Three states**: `AuraState = "idle" | "thinking" | "needs_input"` — maps to Claude Code events `UserPromptSubmit`, `Notification` (permission/idle prompts), and `Stop`
- **Config path**: `~/.claude-aura/config.json`; PID file at `~/.claude-aura/daemon.pid`

## Dependencies

Only 3 runtime deps: `commander` (CLI), `@inquirer/prompts` (interactive setup), `undici` (HTTPS to Hue bridge). TypeScript strict mode enabled.
