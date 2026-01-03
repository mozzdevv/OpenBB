#!/bin/bash

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$DIR")"

echo "🚀 Starting OpenBB Local Dashboard..."

# Activate virtual environment
source "$PROJECT_ROOT/openbb_env/bin/activate"

# Start the dashboard backend in the background
# We use & to run it in background
python "$DIR/app.py" &
BACKEND_PID=$!

# Function to kill background process on exit
cleanup() {
    echo "Stopping OpenBB Dashboard..."
    kill $BACKEND_PID
    exit
}

trap cleanup SIGINT SIGTERM

echo "Wait for server to start..."
sleep 5

# Open browser
open "http://localhost:8000"

echo "Dashboard is running at http://localhost:8000"
echo "Press Ctrl+C to stop the server."

# Keep script running to maintain the background process
wait $BACKEND_PID
