#!/bin/bash

# Script to start Ollama and ngrok tunnel for LLM service

echo "🚀 Starting LLM Service Setup..."

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "❌ Ollama is not installed. Install it with: brew install ollama"
    exit 1
fi

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok is not installed. Install it with: brew install ngrok"
    exit 1
fi

# Check if Ollama is running
if ! lsof -i :11434 &> /dev/null; then
    echo "📦 Starting Ollama server..."
    # Start Ollama in background
    ollama serve > /dev/null 2>&1 &
    OLLAMA_PID=$!
    echo "✅ Ollama started (PID: $OLLAMA_PID)"
    sleep 2
else
    echo "✅ Ollama is already running"
fi

# Check if ngrok is already running for port 11434
if pgrep -f "ngrok.*11434" > /dev/null; then
    echo "✅ ngrok tunnel for LLM is already running"
    echo "📋 Current LLM ngrok URL:"
    curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "import sys, json; tunnels = json.load(sys.stdin).get('tunnels', []); [print(f\"  {t['public_url']} -> {t['config']['addr']}\") for t in tunnels if '11434' in t['config']['addr']]" 2>/dev/null || echo "  (Check ngrok dashboard at http://localhost:4040)"
else
    echo "🌐 Starting ngrok tunnel for LLM (port 11434)..."
    echo "   This will run in the foreground. Press Ctrl+C to stop."
    echo ""
    echo "📋 After ngrok starts, copy the HTTPS URL and update your .env file:"
    echo "   LLM_API_URL=https://your-new-ngrok-url.ngrok-free.dev"
    echo ""
    
    # Start ngrok for LLM
    ngrok http 11434 --pooling-enabled
fi

