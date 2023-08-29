#!/bin/bash

# Update the repository and get the latest commit hash
git pull
latest_commit=$(git log --no-walk -n 1 --pretty=format:"%H")

# Set the VERSION environment variable
export VERSION=$latest_commit

# Navigate to the 'web' directory and perform npm tasks
cd web
npm install
npm run build
cd ..

# Kill the 'aki' process if it's running
pkill aki

# Run the server script
./run_server.sh
