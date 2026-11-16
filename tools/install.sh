#!/bin/sh
# Backlog installer for Steam Deck / SteamOS (also any Linux or macOS with python3).
#
# Copies the backlog folder into Steam's screensaver folder (keeping your config.js if you already have one), then syncs
# your library: game art, playtime and your newest screenshots. Nothing is downloaded; it only reads Steam's files.
# Any extra arguments go to sync.py, for example:  sh tools/install.sh --max-screenshots 30
#
# From Desktop Mode (Steam button > Power > Switch to Desktop):
#   1. Put this folder somewhere, for example ~/Downloads/backlog.
#   2. Open Konsole and run:   sh ~/Downloads/backlog/tools/install.sh
#   3. Go back to Game Mode, then Settings > Customization > Screensaver and pick Backlog.
#
# Over SSH from another computer (on the Deck, in Desktop Mode, once):
#   passwd                          set a password for the "deck" user if you never have
#   sudo systemctl enable --now sshd
# then from the other computer:
#   scp -r backlog deck@steamdeck.local:~/
#   ssh deck@steamdeck.local 'sh ~/backlog/tools/install.sh'
#
# Your library stays up to date on its own: the installer turns on a small background refresh (a systemd user timer,
# no root or password) that re-reads your games, hours and achievements every 15 minutes and after a restart. It keeps
# its own copy of the sync tool in ~/.local/share/backlog, so you can delete this download folder afterwards.
#   Skip it:        sh tools/install.sh --no-schedule
#   Turn it off:    python3 ~/.local/share/backlog/sync.py --unschedule
#   Check it:       systemctl --user list-timers backlog-sync.timer
set -e
here=$(cd "$(dirname "$0")" && pwd)
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 was not found. On SteamOS it is part of the system; elsewhere install Python 3." >&2
  exit 1
fi
exec python3 "$here/sync.py" --install "$@"
