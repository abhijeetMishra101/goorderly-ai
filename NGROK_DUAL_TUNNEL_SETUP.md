# Running Multiple ngrok Tunnels (LLM + Backend)

You already have ngrok running for LLM. Here's how to run both:

## Option 1: Use ngrok Pooling (Recommended)

Run both tunnels with the `--pooling-enabled` flag:

### Terminal 1: LLM Tunnel (if not already running)
```bash
ngrok http 11434 --pooling-enabled
```

### Terminal 2: Backend Tunnel
```bash
ngrok http 3000 --pooling-enabled
```

This will give you:
- **LLM URL**: `https://sciatic-deegan-nonobligatorily.ngrok-free.dev` (or new one)
- **Backend URL**: A new ngrok URL (e.g., `https://xyz123.ngrok-free.app`)

## Option 2: Use Existing ngrok with Reverse Proxy

Keep your existing LLM ngrok, and set up a reverse proxy to route:
- `/api/*` → Backend (port 3000)
- `/llm/*` → LLM (port 11434)

But this is more complex and requires additional setup.

## Option 3: Use Different Service for Backend

Use a different tunneling service for the backend:
- **localtunnel**: `npx localtunnel --port 3000`
- **serveo**: `ssh -R 80:localhost:3000 serveo.net`

## Recommended: Option 1 (Pooling)

This is the simplest. You'll get two ngrok URLs:
1. One for LLM (already configured)
2. One for Backend (use this for OAuth)

### Steps:

1. **Stop current LLM ngrok** (if running):
   ```bash
   # Find and kill the ngrok process
   pkill -f "ngrok.*11434"
   ```

2. **Start LLM ngrok with pooling**:
   ```bash
   ngrok http 11434 --pooling-enabled
   ```
   Note the URL (should be same or similar)

3. **Start Backend ngrok with pooling** (new terminal):
   ```bash
   ngrok http 3000 --pooling-enabled
   ```
   Copy the new URL (e.g., `https://abc123.ngrok-free.app`)

4. **Update `.env`**:
   ```env
   GOOGLE_REDIRECT_URI=https://abc123.ngrok-free.app/api/auth/google/callback
   FRONTEND_URL=https://abc123.ngrok-free.app
   LLM_API_URL=https://sciatic-deegan-nonobligatorily.ngrok-free.dev
   ```

5. **Update Google Console** with the new backend ngrok URL

6. **Update Flutter app** with the new backend ngrok URL

