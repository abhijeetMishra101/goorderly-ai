# Google OAuth Setup Guide

## Step-by-Step Instructions

### 1. Go to Google Cloud Console
Visit: https://console.cloud.google.com/

### 2. Create or Select a Project
- Click on project dropdown at the top
- Click "New Project" or select existing one
- Name it (e.g., "GoOrderly AI")

### 3. Enable Required APIs
Go to "APIs & Services" > "Library" and enable:
- ✅ Google Drive API
- ✅ Google Docs API
- ✅ Google Calendar API
- ✅ Google Apps Script API
- ✅ Gmail API (optional, for email notifications)

### 4. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure OAuth consent screen:
   - User Type: External (unless you have Google Workspace)
   - App name: GoOrderly AI (or your app name)
   - User support email: Your email
   - Developer contact: Your email
   - Click "Save and Continue"
   - Scopes: Add scopes manually:
     - `https://www.googleapis.com/auth/userinfo.email`
     - `https://www.googleapis.com/auth/userinfo.profile`
     - `https://www.googleapis.com/auth/drive`
     - `https://www.googleapis.com/auth/documents`
     - `https://www.googleapis.com/auth/calendar`
     - `https://www.googleapis.com/auth/script.projects`
     - `https://www.googleapis.com/auth/script.deployments`
   - Click "Save and Continue"
   - Test users: Add your email (for testing)
   - Click "Save and Continue"

4. Create OAuth Client ID:
   - Application type: **Web application**
   - Name: GoOrderly AI Client
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`
   - Click "Create"

5. Copy the credentials:
   - **Client ID**: Copy this (ends with `.apps.googleusercontent.com`)
   - **Client Secret**: Copy this (click "Show" if hidden)

### 5. Update Your .env File

```env
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
```

### 6. Test It!

```bash
# Start your backend
npm run dev

# Visit
http://localhost:3000/api/auth/google
```

You should be redirected to Google for authentication!

## Troubleshooting

**Error: "redirect_uri_mismatch"**
- Make sure redirect URI in `.env` matches exactly what's in Google Cloud Console
- Check for trailing slashes

**Error: "access_denied"**
- Make sure your email is added as a test user (if app is in testing mode)
- Check OAuth consent screen is configured

**Error: "invalid_client"**
- Double-check Client ID and Secret are correct
- Make sure there are no extra spaces

## Next Steps

After OAuth is working:
1. Test login flow
2. Create template Google Doc (will be created automatically when user selects template)
3. Test template selection
4. Test Apps Script creation

