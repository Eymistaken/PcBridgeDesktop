# Pcbridge Desktop

**English** · [Türkçe](README.tr.md)

A desktop client for the [pcbridge](https://github.com/Eymistaken/Pcbridge) MCP
server. Named agent presets, live job output streamed straight off the disk, and
a grid of real tmux panes — in one window.

Linux, x86-64. Built with Tauri 2, React and Rust.

> **Status: early.** Version 0.1.0. The interface is expected to change
> significantly; treat the UI as unsettled.

## Why

pcbridge is an MCP server, so driving it meant keeping a chat window open. Three
concrete annoyances:

- **Agent jobs were blind.** `agent_run` hands back a `job_id` and you poll
  `job_status` by hand to see progress — while the output is already streaming
  to a file on disk.
- **Terminals were far away.** `tmux_capture` is a read-only mirror that scrapes
  screen text once a second.
- **There was no notion of a bot.** Agent, model, effort and directory were
  retyped on every call.

## What it does

**Bots.** Bind an agent, model, effort, working directory and a standing
instruction to a name. The model and effort lists are read from the server's
`list_agents` output rather than hardcoded. A `session_id` is kept per bot, so
the second message continues the same conversation.

**Live output.** Job output is read from
`~/.local/state/pcbridge/jobs/<id>/out.log` at a byte offset — MCP is not
polled for it. Three parsers are supported: `claude_stream_json`, `agy_json` and
`plain`. Tool calls, thinking blocks and the closing summary each render
differently.

**Terminal grid.** Every pane is **a real tmux session**. Closing a pane does
not kill the session, and neither does quitting the app; you can `tmux attach`
to the same session from anywhere else. One, two, three and four-pane layouts.

**Desktop permission.** pcbridge's `desktop_unlock` window is managed by a
visible switch with a countdown. Two numbers are shown, not one: the sliding
lease (pushed forward by each desktop action, decaying otherwise) and the hard
ceiling. Alongside it: `system_status`, a screen preview, and a tail of
`audit.log`.

## Install

Packages are attached to each
[release](https://github.com/Eymistaken/PcBridgeDesktop/releases) — a `.deb` and
an `.AppImage`, built by CI on Ubuntu 22.04.

```bash
sudo apt install ./Pcbridge-Desktop_0.1.0_amd64.deb
```

Full instructions, including the AppImage and what to do about `libgtk-3-0` on
Ubuntu 24.04 derivatives: **[KURULUM.md](KURULUM.md)**.

## What it needs

- A running [pcbridge](https://github.com/Eymistaken/Pcbridge) server, reachable
  at `http://127.0.0.1:8765/mcp`. Override with `PCBRIDGE_MCP_ENDPOINT`.
- Its static token. The app asks on first launch.
- `tmux`, for the terminal panes.
- A Secret Service provider — for example `gnome-keyring-daemon` running with
  its `secrets` component.

## Build from source

```bash
sudo apt install libwebkit2gtk-4.1-dev libsoup-3.0-dev librsvg2-dev \
  libayatana-appindicator3-dev libxdo-dev libssl-dev build-essential curl wget file
npm ci
npm run tauri dev      # development
npm run tauri build    # packages into src-tauri/target/release/bundle/
```

Tests:

```bash
cd src-tauri && cargo test
```

## How it works

```
src/                React interface. No component library, no CSS framework.
  lib/i18n.ts       Two dictionaries and a t(). Default English.
src-tauri/src/
  mcp.rs            rmcp client, list_agents parser, error classification
  jobs.rs           tails out.log from a byte offset; job lifecycle
  parse.rs          claude_stream_json · agy_json · plain
  bots.rs           bots.json — atomic write (tmp + fsync + rename), 0600
  pty.rs            portable-pty + tmux
  desktop.rs        desktop_unlock.json, system_status, audit.log
  secrets.rs        OS keyring; the token does not leave this module
design/             Design artboards (*.dc.html) — the contract the code follows
```

Two decisions worth knowing about:

**Jobs are finalized by asking.** pcbridge only reaps a finished child process
when `job_status` is called; until then the process stays a zombie and no
`status` or `exit_code` is ever written to `meta.json`. A client that only
watches files would never see a job end. So `job_status` is called **once**,
when the output reports `Finished` or after five seconds of silence. The output
itself still comes from the file.

**Panes attach, they don't own.** A pane runs `tmux new-session -d` followed by
`tmux attach-session` inside a PTY, and detaches with `tmux detach-client` on
close. A single `new-session -A` binds the session to the client that created
it, which kills the session when the PTY goes away.

## Security

- The static token lives **only** in the OS keyring. It is never written to a
  file, never logged, never printed, and never crosses into the frontend — every
  MCP call is made from Rust.
- pcbridge's `config.toml` is never read or written. The ability to write
  `[agents.*]` blocks is deliberately absent.
- Bots live in the app's own file, `~/.config/pcbridge-desktop/bots.json`, mode
  0600.
- Desktop control starts locked and closes itself when the lease runs out.

## Design

The interface rules are written down and binding: a colorless shell, where color
comes only from identity (a bot's avatar) and state (running / done / failed).
No system accent color, no gradients, no colored primary button. Contrast ratios
are computed, not guessed. See [CLAUDE.md](CLAUDE.md).

## Project documents

[CLAUDE.md](CLAUDE.md) holds the design law and the measured facts.
[ASAMALAR.md](ASAMALAR.md) is the roadmap and how each stage was verified.
Both are in Turkish, as are the code comments.

## License

[GPL-3.0-or-later](LICENSE) — the same license as the pcbridge server.
