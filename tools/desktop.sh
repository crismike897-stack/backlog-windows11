#!/bin/sh
# Run by the "Install Backlog" and "Uninstall Backlog" launchers in the download folder (double-click them in
# Desktop Mode). Does the same as tools/install.sh and sync.py --uninstall, then says how it went in a pop-up
# (kdialog on SteamOS and other KDE desktops; plain text in the terminal window elsewhere).
here=$(cd "$(dirname "$0")" && pwd)

have_dialog() { command -v kdialog >/dev/null 2>&1; }
pause() { printf '\nPress Enter to close this window. '; read _ || true; }
tell() { # tell <msgbox|error> <text>
  if have_dialog; then kdialog --title "Backlog" "--$1" "$2" >/dev/null 2>&1 || true; else printf '\n%s\n' "$2"; pause; fi
}

case "$1" in
  install)
    # Two questions first (pop-ups on SteamOS and other KDE desktops). Cancel either one and that setting is left
    # as it is: the defaults on a first install, your own choice on a later one.
    scenes=""; minutes=""
    if have_dialog; then
      picked=$(kdialog --title "Backlog" --separate-output --checklist "Which scenes should play? The highlighted ones will. Tap a scene to turn it off or back on." \
        mosaic "Mosaic: your covers gather into the art of one game" on \
        drift "Drift: a tilted wall of covers sliding past" on \
        flip "Flip: a board that turns over like a departures board" on \
        ripple "Ripple: a slow wave through a grid of covers" on 2>/dev/null) || picked=""
      scenes=$(printf '%s\n' "$picked" | tr -d '"' | tr -s ' \n' ',' | sed 's/^,//; s/,$//')
      minutes=$(kdialog --title "Backlog" --radiolist "How long should each scene stay before the next one?" \
        1 "1 minute" off 3 "3 minutes" off 5 "5 minutes" on 10 "10 minutes" off 15 "15 minutes" off 30 "30 minutes" off 2>/dev/null) || minutes=""
      minutes=$(printf '%s' "$minutes" | tr -d '" \n')
    fi
    set --
    if [ -n "$scenes" ]; then set -- "$@" --scenes "$scenes"; fi
    if [ -n "$minutes" ]; then set -- "$@" --minutes "$minutes"; fi
    if sh "$here/install.sh" "$@"; then
      tell msgbox "Backlog is installed.

Go back to Game Mode, then open Settings > Customization > Screensaver and pick backlog.

Your games, hours and achievements keep themselves up to date. You can delete this download folder now."
    else
      echo
      echo "The install did not finish. The lines above say what went wrong."
      if have_dialog; then kdialog --title "Backlog" --error "The install did not finish. The window behind this one says what went wrong." >/dev/null 2>&1 || true; fi
      pause
      exit 1
    fi
    ;;
  uninstall)
    if have_dialog; then
      kdialog --title "Backlog" --yesno "Remove Backlog from Steam and turn off its automatic refresh?" >/dev/null 2>&1 || exit 0
    else
      printf 'Remove Backlog from Steam and turn off its automatic refresh? [y/N] '; read answer || answer=n
      case "$answer" in y|Y|yes|YES) ;; *) exit 0 ;; esac
    fi
    if ! command -v python3 >/dev/null 2>&1; then tell error "python3 was not found, so nothing was removed."; exit 1; fi
    if python3 "$here/sync.py" --uninstall; then
      tell msgbox "Backlog is removed.

If it was your screensaver, pick another one in Settings > Customization > Screensaver."
    else
      echo
      echo "The uninstall did not finish. The lines above say what went wrong."
      if have_dialog; then kdialog --title "Backlog" --error "The uninstall did not finish. The window behind this one says what went wrong." >/dev/null 2>&1 || true; fi
      pause
      exit 1
    fi
    ;;
  *)
    echo "usage: sh tools/desktop.sh install|uninstall" >&2
    exit 2
    ;;
esac
