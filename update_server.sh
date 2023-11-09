#!/bin/bash
set -e

# Update the repository and get the latest commit hash
git pull
latest_commit=$(git log --no-walk -n 1 --pretty=format:"%H")

# Set the VERSION environment variable
export VERSION=$latest_commit

# Navigate to the 'web' directory and perform npm tasks
cd web
bun install
bun run build
build_exit_code=$?

# If the build failed, exit the script with an error code
if [ $build_exit_code -ne 0 ]; then
  echo "bun run build exited with $build_exit_code"
  exit $build_exit_code
fi

cd ..
cargo build --release
build_exit_code=$?

# If the build failed, exit the script with an error code
if [ $build_exit_code -ne 0 ]; then
  echo "Cargo build failed with exit code $build_exit_code"
  exit $build_exit_code
fi

pkill catgpt
./run_server.sh
