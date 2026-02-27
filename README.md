# claude-aura

Your office light mirrors Claude Code's state. Thinking, waiting, done.

A Philips Hue light changes color based on what Claude Code is doing -- so you can glance at your desk and know whether Claude is still working, needs your attention, or is finished.

## States

| State | Default Color | When |
|---|---|---|
| **Idle** | Warm cream `#E8DCC8` | Daemon running, no active session |
| **Thinking** | Terracotta `#DA7756` | You submitted a prompt, Claude is processing |
| **Needs input** | Amber `#E3A869` | Claude finished or needs permission approval |

Colors are fully configurable.

## Requirements

- **Node.js** 18+
- **Philips Hue bridge** on your local network
- **One color-capable Hue light** (any color bulb)
- **Claude Code** installed locally

## Quick start

### 1. Install

```bash
git clone https://github.com/YOUR_USERNAME/claude-aura.git
cd claude-aura
npm install
npm run build
npm link
```

### 2. Setup

```bash
claude-aura setup
```

This walks you through:
- Finding your Hue bridge on the network
- Pressing the link button to pair
- Choosing which light to use
- Picking colors (defaults or custom hex)
- Installing Claude Code hooks automatically

### 3. Start

```bash
claude-aura start
```

Keep this running in a terminal (or background it). The light will change as you use Claude Code.

## Commands

| Command | Description |
|---|---|
| `claude-aura setup` | Full setup: bridge, light, colors, hooks |
| `claude-aura start` | Start the daemon |
| `claude-aura stop` | Stop the daemon |
| `claude-aura status` | Show current state and config |
| `claude-aura demo` | Cycle through all states to test your light |
| `claude-aura colors` | Update colors without re-running setup |
| `claude-aura hooks install` | Install Claude Code hooks |
| `claude-aura hooks uninstall` | Remove Claude Code hooks |

## Change colors

```bash
claude-aura colors --idle "#E8DCC8" --thinking "#DA7756" --needs-input "#E3A869"
```

Then restart the daemon:

```bash
claude-aura stop && claude-aura start
```

## How it works

```
Claude Code hooks  -->  HTTP POST to daemon  -->  Hue bridge API  -->  Light
```

1. Claude Code fires lifecycle hooks at key moments (prompt submitted, finished, needs permission)
2. Each hook runs a tiny script that POSTs a state change to the local daemon
3. The daemon converts the state to a color and sends it to your Hue bridge
4. Your light changes color

### Hook mapping

| Claude Code Event | Aura State |
|---|---|
| `UserPromptSubmit` | `thinking` |
| `Notification` (permission_prompt) | `needs_input` |
| `Notification` (idle_prompt) | `needs_input` |
| `Stop` | `needs_input` |

### Architecture

- **Daemon** listens on `http://127.0.0.1:7685` (configurable)
- **Hook scripts** are installed in `~/.claude/settings.json`
- **Config** lives at `~/.claude-aura/config.json`
- **Hue API** uses CIE xy color space over HTTPS (self-signed TLS for local bridge)

## Config file

All config is in `~/.claude-aura/config.json`:

```json
{
  "bridge": {
    "ip": "192.168.1.x",
    "username": "your-hue-api-key"
  },
  "light": {
    "id": 1,
    "name": "Office Light"
  },
  "colors": {
    "idle": "#E8DCC8",
    "thinking": "#DA7756",
    "needs_input": "#E3A869"
  },
  "brightness": 80,
  "transitionMs": 1500,
  "port": 7685
}
```

You can edit this file directly and restart the daemon.

## Troubleshooting

**Light doesn't change**
- Run `claude-aura demo` to verify the light responds
- Run `claude-aura status` to check if the daemon is running
- Make sure your Hue bridge and computer are on the same network

**Setup can't find bridge**
- Enter the bridge IP manually when prompted
- Find your bridge IP in the Hue app under Settings > Bridge

**Hooks not firing**
- Run `claude-aura hooks install` to re-install
- Check `~/.claude/settings.json` for the hook entries
- Make sure the daemon is running before using Claude Code

## License

MIT

## Credits

Hue bridge communication adapted from [claude-hue](https://github.com/vocino/claude-hue) by @Vocino.
