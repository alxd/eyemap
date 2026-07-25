#!/usr/bin/env bash
# One-shot: clear dirty Windows NTFS + mount permanently at boot.
# Run: sudo bash clinica/scripts/mount-windows-ntfs.sh
set -euo pipefail

UUID="EE3A1C003A1BC48D"
DEV="/dev/disk/by-uuid/${UUID}"
MNT="/media/alex/${UUID}"
FSTAB_LINE="UUID=${UUID}  ${MNT}  ntfs-3g  uid=1000,gid=1000,umask=022,windows_names,locale=en_US.UTF-8,nofail,remove_hiberfile  0  0"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

if [[ ! -e "$DEV" ]]; then
  echo "Device not found: $DEV" >&2
  exit 1
fi

mkdir -p "$MNT"

# Unmount if something partial is mounted
umount "$MNT" 2>/dev/null || true
umount "$DEV" 2>/dev/null || true

# clear hibernation / dirty flag, then remount read-write
# remove_hiberfile discards Windows hibernate resume (safe if you fully shut down / reboot into Linux)
mount -t ntfs-3g -o "uid=1000,gid=1000,umask=022,windows_names,locale=en_US.UTF-8,remove_hiberfile" \
  "$DEV" "$MNT"

echo "Mounted OK:"
df -h "$MNT"
ls "$MNT/Users/Alex/My Documents/GitHub/eyemap_models" 2>/dev/null || ls "$MNT" | head

# Permanent fstab entry (idempotent)
if grep -q "$UUID" /etc/fstab; then
  echo "fstab already has $UUID — leaving existing line"
else
  cp -a /etc/fstab "/etc/fstab.bak.$(date +%Y%m%d%H%M%S)"
  printf '\n# Windows NTFS (auto-clear hibernation from Fast Startup)\n%s\n' "$FSTAB_LINE" >> /etc/fstab
  echo "Added fstab entry"
fi

# Sanity-check fstab without remounting everything
findmnt --verify --verbose 2>&1 | grep -E "$UUID|Error|Warning" || true

echo
echo "Done. Mount point: $MNT"
echo "Note: remove_hiberfile means Windows Fast Startup / hibernate resume is cleared on each Linux mount."
echo "For a cleaner dual-boot long-term: disable Fast Startup in Windows Power Options."
