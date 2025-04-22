#!/bin/bash

#first manually run : chmod +x ./initialize_project.sh
#then run : ./initialize_project.sh


# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Make all .sh and .bash files in the directory executable
find "$SCRIPT_DIR" -type f \( -name "*.sh" -o -name "*.bash" \) -exec chmod +x {} \;

echo "All scripts in $SCRIPT_DIR have been made executable."


