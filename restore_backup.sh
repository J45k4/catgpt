#!/bin/bash
if [ "$#" -ne 2 ]; then echo "Usage: $0 <backup_archive> <destination_folder>"; exit 1; fi

SOURCE_ARCHIVE="$1"
DEST_DIR="$2"

if [ ! -f "$SOURCE_ARCHIVE" ]; then echo "Error: Archive does not exist."; exit 1; fi
mkdir -p "$DEST_DIR"
tar -xzf "$SOURCE_ARCHIVE" -C "$DEST_DIR"

if [ $? -eq 0 ]; then echo "Restore successful! Data extracted to $DEST_DIR"; else echo "Error during restoration."; exit 1; fi
