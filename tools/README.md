# Backlog tools

Backlog runs inside Steam with no network and no Steam API, so it can't look up your games itself. The sync tools read
your Steam files ahead of time (read only), copy your games' art and newest screenshots into the screensaver folder,
and write `backlog/library/library.js`. Until a sync runs, Backlog shows a made-up demo library.

| Tool | Where | Needs |
|---|---|---|
| `sync.ps1` | Windows | Windows PowerShell 5.1 (built in). Scales big art and screenshots down. |
| `sync.py` | Steam Deck / SteamOS, Linux, macOS (Windows too) | Python 3 (built into SteamOS). Copies art as is. |
| `install.sh` | Steam Deck / SteamOS | Runs `sync.py --install`. |

Run the sync again whenever you like; it only redoes what changed (a re-run takes a few seconds).

## Windows

```powershell
powershell -ExecutionPolicy Bypass -File tools\sync.ps1 -Install
```

Then open Big Picture mode (the setting is only there) and go to Settings > Customization > Screensaver > Backlog
(restart Steam if it isn't listed yet).

## Steam Deck

**Desktop Mode, no typing:** Steam button > Power > Switch to Desktop. Unzip the download (for example into
`~/Downloads/backlog`), open the folder and double-click **Install Backlog**. It asks which scenes you want, how
long each should stay and what the clock in the corner shows (cancel a question and that setting is left as it is), then a window shows the install and a
pop-up says it is done. Double-click it again any time to choose differently. To remove it later, double-click **Uninstall Backlog** (or run
`python3 ~/.local/share/backlog/sync.py --uninstall`).

**Desktop Mode, in Konsole:** the same install as one command:

```sh
sh ~/Downloads/backlog/tools/install.sh
```

Switch back to Game Mode, then Settings > Customization > Screensaver > Backlog.

**Over SSH:** on the Deck in Desktop Mode, once: `passwd` (if the `deck` user has no password yet), then
`sudo systemctl enable --now sshd`. From another computer:

```sh
scp -r backlog deck@steamdeck.local:~/
ssh deck@steamdeck.local 'sh ~/backlog/tools/install.sh'
```

**It stays up to date on its own.** The installer turns on a background refresh (a systemd user timer, no root or
password) that re-reads your games, hours and achievements every 15 minutes and two minutes after a restart. A
refresh with nothing new takes about a second. It runs its own copy of the sync tool from `~/.local/share/backlog`, so
the download folder can be deleted. Install with `--no-schedule` to skip it; turn it off later with
`python3 ~/.local/share/backlog/sync.py --unschedule`; check it with `systemctl --user list-timers backlog-sync.timer`.

## Flags

| `sync.ps1` | `sync.py` | What it does |
|---|---|---|
| `-Install` | `--install` | Copy this repo's `backlog` folder into Steam's screensaver folder first. Your `config.js` there is kept. |
| `-Scenes mosaic,drift` | `--scenes mosaic,drift` | Which scenes play, in order: `mosaic`, `drift`, `flip`, `ripple`, plus `ripple2`. Writes the `scenes` line of the installed `config.js`. Works with or without the install flag. |
| `-Minutes <n>` | `--minutes <n>` | How long each scene stays (default 5). Writes `minutesPerScene` in `config.js`. |
| `-Clock clock` | `--clock clock` | What the clock corner shows: `all`, `clock` (the time and date only) or `none`. Writes `clock.show` in `config.js`. |
| `-Target <dir>` | `--target <dir>` | Write into another `backlog` folder. Default: `<Steam>/config/uioverrides/screensavers/backlog`. |
| `-MaxScreenshots <n>` | `--max-screenshots <n>` | Newest screenshots to copy (default 60; 0 for none). |
| `-MaxGames <n>` | `--max-games <n>` | Keep only the n most recently played (default 0, all). |
| `-IncludeUnplayed` | `--include-unplayed` | Also add owned games you have never played. Default: played or installed games only. |
| `-NoShortcuts` | `--no-shortcuts` | Leave out non-Steam games. By default they're included when they have custom art or have been played. |
| `-Account <x>` | `--account <x>` | Which Steam account: persona name, account id or SteamID64. Default: the last one to log in. |
| `-ListAccounts` | `--list-accounts` | List the accounts on this computer and stop. |
| `-Steam <dir>` | `--steam <dir>` | Steam folder, if it isn't found automatically. |
| `-Reset` | `--reset` | Remove the synced library and put back the placeholder `library.js` (Backlog shows the demo again). |
| `-ApiKey <key>` | `--api-key <key>` | Optional online refresh, see below. |
| | `--no-schedule` | With `--install`: don't turn on the automatic refresh (on by default on SteamOS and other systemd Linux). |
| | `--unschedule` | Turn the automatic refresh off and remove its files. The screensaver stays. |
| `-ScheduleDaily` / `-Unschedule` | | Windows: add or remove a scheduled task that re-syncs at logon and daily at 4:00. |
| `-Verbose` | | Windows: show timings. |

`-ApiResponseFile` / `--api-response-file` and `-CdnBase` / `--cdn-base` are for testing the online refresh without a
key (a saved JSON response, and a stand-in for the art server). Leave them alone.

## Optional: up-to-date playtime with your own Steam Web API key

Each computer only knows what was played on it, so a PC's numbers go stale if you mostly play on a Steam Deck. With
your own Steam Web API key, the sync asks Steam for your owned games (`IPlayerService/GetOwnedGames`) and uses
Steam's playtime and last played for every device (the larger number wins, in case this computer played offline
since). Games you played only elsewhere are added, with art from Steam's public store images. Without a key,
everything works as before from local files.

1. Get a key at <https://steamcommunity.com/dev/apikey> (any domain name works, for example `localhost`).
2. Save it on your own computer, outside the screensaver folder:
   - Windows: `%APPDATA%\backlog\steam-api-key.txt`
     (`mkdir $env:APPDATA\backlog; Set-Content $env:APPDATA\backlog\steam-api-key.txt '<your key>'`)
   - Steam Deck / Linux / macOS: `~/.config/backlog/steam-api-key`
     (`mkdir -p ~/.config/backlog && echo '<your key>' > ~/.config/backlog/steam-api-key && chmod 600 ~/.config/backlog/steam-api-key`)

   Or set the `STEAM_API_KEY` environment variable, or pass `-ApiKey` / `--api-key` (other programs on the computer
   can see command lines, so the file is better). The scheduled task never stores the key; it reads the file.
3. Your profile's game details must be public (Steam > your profile > Edit Profile > Privacy Settings > Game details).
   If they're private, Steam returns an empty list and the sync says so, then uses local data.

The key only goes to `api.steampowered.com`. It is never printed, logged or written into the screensaver folder or
`library.js`.

## In this repo: keep your real library out of commits

`backlog/library/library.js` is committed as a placeholder (`window.BACKLOG_LIBRARY = null;`), and `.gitignore` ignores
everything else in `backlog/library/`. A sync with `-Target backlog` overwrites `library.js` with your real library
(your persona name and games). To keep that out of commits:

```sh
git update-index --skip-worktree backlog/library/library.js     # after the placeholder is committed
git update-index --no-skip-worktree backlog/library/library.js  # to change the placeholder on purpose
```

Before the very first commit, `sync.ps1 -Target backlog -Reset` (or `sync.py --target backlog --reset`) puts the placeholder
back; commit, set skip-worktree, then sync again. The tools print this reminder when the target is inside a git work
tree.

## What the sync reads

`steamapps/libraryfolders.vdf` and `appmanifest_*.acf` (installed games), `userdata/<id>/config/localconfig.vdf`
(playtime and last played, also for non-Steam shortcuts), `config/loginusers.vdf` (the last account and its persona
name), `appcache/appinfo.vdf` (names and types, so tools, DLC and soundtracks are left out), `appcache/librarycache/`
(art), `userdata/<id>/config/grid/` (your custom art, which wins), `userdata/<id>/config/shortcuts.vdf` (non-Steam
games) and `userdata/<id>/760/remote/<appid>/screenshots/`. Only the persona name and per-game numbers and art leave
Steam's folder; nothing else from its config is copied.
