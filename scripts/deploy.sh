#!/usr/bin/env bash
# Build the web app and rsync it to the web host.
#
#   yarn deploy              # build, then upload
#   yarn deploy --dry-run    # build, then show what WOULD change, upload nothing
#   yarn deploy --no-build   # upload the existing dist/ as-is
#
# Configured entirely from .env (see .env.sample) so no host details live in
# the repo. Requires DEPLOY_HOST and DEPLOY_PATH; everything else has a
# sensible default.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ]; then
  # shellcheck disable=SC1091
  set -a; . ./.env; set +a
fi

DRY_RUN=0
BUILD=1
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --no-build) BUILD=0 ;;
    -h|--help) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

# --- configuration ---------------------------------------------------------
: "${DEPLOY_HOST:?Set DEPLOY_HOST in .env (see .env.sample)}"
: "${DEPLOY_PATH:?Set DEPLOY_PATH in .env (see .env.sample)}"
DEPLOY_USER="${DEPLOY_USER:-}"
# Deliberately no default: passing -p forces the port and overrides whatever
# ~/.ssh/config has for this host, so an unset value must mean "don't pass it"
# rather than "22".
DEPLOY_PORT="${DEPLOY_PORT:-}"
DEPLOY_SSH_KEY="${DEPLOY_SSH_KEY:-}"
DEPLOY_URL="${DEPLOY_URL:-}"

# user@host when a user is configured, bare host otherwise (so ~/.ssh/config
# can supply it instead).
target="$DEPLOY_HOST"
[ -n "$DEPLOY_USER" ] && target="$DEPLOY_USER@$DEPLOY_HOST"

# --- build -----------------------------------------------------------------
if [ "$BUILD" -eq 1 ]; then
  # The static privacy pages are generated, not committed, so a clean clone
  # would otherwise rsync a dist/ without them and break the Play policy URL.
  yarn privacy
  yarn build
fi

if [ ! -f dist/index.html ]; then
  echo "dist/index.html is missing — run without --no-build." >&2
  exit 1
fi
if [ ! -f dist/privacy/index.html ]; then
  echo "dist/privacy/index.html is missing — run 'yarn privacy' and rebuild." >&2
  exit 1
fi

# --- upload ----------------------------------------------------------------
ssh_cmd="ssh"
[ -n "$DEPLOY_PORT" ] && ssh_cmd="$ssh_cmd -p $DEPLOY_PORT"
[ -n "$DEPLOY_SSH_KEY" ] && ssh_cmd="$ssh_cmd -i $DEPLOY_SSH_KEY"

# --delete keeps the host free of files dropped from the build (renamed
# hashed assets pile up otherwise), so DEPLOY_PATH must point at a directory
# the app owns exclusively.
rsync_args=(
  --archive
  --compress
  --human-readable
  --delete
  --itemize-changes
  --exclude '.well-known'
  -e "$ssh_cmd"
)
[ "$DRY_RUN" -eq 1 ] && rsync_args+=(--dry-run)

echo "==> rsync dist/ -> $target:$DEPLOY_PATH${DRY_RUN:+ (dry run)}"
# Trailing slash on dist/ copies the CONTENTS, not the directory itself.
rsync "${rsync_args[@]}" dist/ "$target:$DEPLOY_PATH"

if [ "$DRY_RUN" -eq 1 ]; then
  echo "==> dry run: nothing was uploaded."
else
  echo "==> deployed${DEPLOY_URL:+: $DEPLOY_URL}"
fi
