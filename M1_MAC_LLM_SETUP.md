# M1 Mac LLM Setup Guide

This guide will help you set up Ollama on your M1 Mac and expose it via ngrok for use with GoOrderly.ai.

## Prerequisites

- macOS with M1 chip (or M2/M3)
- Homebrew installed
- ngrok account (free tier works)

## Step 1: Install Ollama

```bash
# Using Homebrew (recommended)
brew install ollama

# OR download from https://ollama.com
```

## Step 2: Start Ollama Server

```bash
# Start Ollama (runs on localhost:11434)
ollama serve
```

Keep this terminal window open. Ollama will run in the background.

## Step 3: Pull Llama Model

In a new terminal:

```bash
# For 8GB RAM Macs (recommended)
ollama pull llama3.2:3b-instruct-q4_K_M

# For 16GB+ RAM Macs (better quality)
ollama pull llama3.2:8b-instruct-q4_K_M
```

**Note**: The `q4_K_M` suffix means 4-bit quantization, which reduces memory usage while maintaining good quality.

## Step 4: Test Ollama Locally

```bash
# Test the API
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.2:3b-instruct-q4_K_M",
  "prompt": "Extract time slot from: I am going to grocery store",
  "stream": false
}'
```

You should get a JSON response.

## Step 5: Install ngrok

```bash
# Install ngrok
brew install ngrok

# Or download from https://ngrok.com/download
```

## Step 6: Setup ngrok Account

1. Sign up at https://dashboard.ngrok.com/signup (free)
2. Get your authtoken from https://dashboard.ngrok.com/get-started/your-authtoken
3. Configure ngrok:

```bash
ngrok config add-authtoken YOUR_AUTHTOKEN_HERE
```

## Step 7: Expose Ollama via ngrok

```bash
# Expose Ollama on port 11434
ngrok http 11434
```

You'll see output like:
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:11434
```

**Copy the HTTPS URL** (e.g., `https://abc123.ngrok-free.app`)

## Step 8: Configure Environment Variables

Add to your `.env` file:

```env
LLM_API_URL=https://your-ngrok-url.ngrok.io
LLM_MODEL=llama3.2:3b-instruct-q4_K_M
LLM_ENABLED=true
```

Replace `your-ngrok-url.ngrok.io` with your actual ngrok URL.

## Step 9: Keep Services Running

### Option A: Manual (Development)

Terminal 1 - Ollama:
```bash
ollama serve
```

Terminal 2 - ngrok:
```bash
ngrok http 11434
```

Terminal 3 - Your Node.js API:
```bash
npm run dev
```

### Option B: Background Services (Production)

**Keep Ollama running:**

Create `~/Library/LaunchAgents/com.goorderly.ollama.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.goorderly.ollama</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/ollama</string>
        <string>serve</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/ollama.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/ollama.error.log</string>
</dict>
</plist>
```

Load the service:
```bash
launchctl load ~/Library/LaunchAgents/com.goorderly.ollama.plist
```

**Keep ngrok running:**

For persistent ngrok tunnel (requires paid plan), or use a process manager like PM2:

```bash
npm install -g pm2
pm2 start "ngrok http 11434" --name ngrok
pm2 save
pm2 startup
```

## Step 10: Test Integration

Test the LLM service from your Node.js API:

```bash
# Test endpoint (if you create one)
curl http://localhost:3000/api/test/llm \
  -H "Content-Type: application/json" \
  -d '{"text": "I am going to grocery store"}'
```

## Troubleshooting

### Ollama not starting
```bash
# Check if Ollama is running
ps aux | grep ollama

# Restart Ollama
pkill ollama
ollama serve
```

### ngrok connection issues
- Verify ngrok is running: Check the ngrok dashboard
- Check ngrok URL is accessible: `curl https://your-url.ngrok.io/api/generate`
- Restart ngrok: `pkill ngrok && ngrok http 11434`

### Model not found
```bash
# List installed models
ollama list

# Pull model again
ollama pull llama3.2:3b-instruct-q4_K_M
```

### Performance Issues
- Use smaller model: `llama3.2:3b` instead of `llama3.2:8b`
- Close other applications to free up RAM
- Use quantization: `q4_K_M` or `q8_0`

## Performance Expectations

With M1 Mac:
- **Llama 3.2 3B Q4**: ~40-50 tokens/sec, ~1.5 seconds per request
- **Llama 3.2 8B Q4**: ~20-30 tokens/sec, ~2-3 seconds per request
- **Memory Usage**: 3B uses ~4GB, 8B uses ~8GB

## Security Considerations

1. **ngrok Auth**: Always use authtoken to prevent unauthorized access
2. **Firewall**: Consider restricting ngrok access to specific IPs (paid plan)
3. **API Key**: Add API key authentication to your LLM endpoint (optional)

## Future: Move to Raspberry Pi

When ready to move to Raspberry Pi:
1. Install Ollama on Pi
2. Pull smaller model (Phi-3 Mini or TinyLlama)
3. Update `LLM_API_URL` in `.env`
4. Update ngrok tunnel to point to Pi

## Verification Checklist

- [ ] Ollama installed and running
- [ ] Model pulled successfully
- [ ] Local API test works
- [ ] ngrok installed and configured
- [ ] ngrok tunnel active
- [ ] Environment variables set
- [ ] Node.js API can reach LLM
- [ ] Voice entry processing works

## Next Steps

1. Test voice entry with LLM
2. Monitor LLM usage and performance
3. Set up usage tracking
4. Configure plan tiers if needed

