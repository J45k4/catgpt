#!/bin/bash

# Update the repository and get the latest commit hash
git pull
latest_commit=$(git log --no-walk -n 1 --pretty=format:"%H")

# Set the VERSION environment variable
export VERSION=$latest_commit

# Navigate to the 'web' directory and perform npm tasks
cd web
bun install
bun run build
cd ..

pkill catgpt
./run_server.sh
