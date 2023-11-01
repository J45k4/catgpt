#!/bin/bash
if [ "$#" -ne 1 ]; then echo "Usage: $0 <destination_folder>"; exit 1; fi

SOURCE_DIR="$HOME/.aki/db"
if [ ! -d "$SOURCE_DIR" ]; then echo "Error: Source directory does not exist."; exit 1; fi

DEST_DIR="$1"
mkdir -p "$DEST_DIR"
CURRENT_DATE=$(date +"%Y_%m_%d_%H_%M")
DEST_PATH="${DEST_DIR}/backup_${CURRENT_DATE}.tar.gz"
tar -czf "$DEST_PATH" -C "$HOME/.aki" db

if [ $? -eq 0 ]; then echo "Backup successful! Archive saved to $DEST_PATH"; else echo "Error during backup."; exit 1; fi
