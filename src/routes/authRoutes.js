// src/routes/authRoutes.js

const express = require('express');
const router = express.Router();
const googleAuthService = require('../services/googleAuthService');
const oauthConfig = require('../config/googleOAuth');
const { authenticate } = require('../middleware/auth');

/**
 * GET /api/auth/google
 * Initiate Google OAuth flow
 */
router.get('/google', (req, res) => {
  // Check if request is from mobile app
  const isMobileApp = req.headers['x-mobile-app'] === 'true' || 
                     req.query.mobile === 'true';
  
  // Add mobile parameter to callback URL so we know to redirect to deep link
  let state = isMobileApp ? 'mobile=true' : '';
  
  // Add ngrok skip browser warning to state if using ngrok
  const redirectUri = oauthConfig.redirectUri || '';
  if (redirectUri.includes('ngrok-free.dev') || redirectUri.includes('ngrok-free.app')) {
    state = state ? `${state}&ngrok-skip=true` : 'ngrok-skip=true';
  }
  
  const authUrl = googleAuthService.getAuthUrl(state);
  res.redirect(authUrl);
});

/**
 * GET /api/auth/google/callback
 * Handle OAuth callback and create session
 */
router.get('/google/callback', async (req, res) => {
  try {
    const { code, error } = req.query;

    if (error) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://192.168.29.220:3001'}/login?error=${error}`);
    }

    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://192.168.29.220:3001'}/login?error=no_code`);
    }

    // Exchange code for tokens
    const tokens = await googleAuthService.getTokensFromCode(code);

    // Get or create user
    const user = await googleAuthService.getOrCreateUser(tokens);

    // Generate JWT for session
    const jwtToken = googleAuthService.generateJWT(user);

    // Check if request is from mobile app
    // If state parameter contains 'mobile=true', it's from mobile
    // Or if redirect URI is ngrok (which we use for mobile), assume mobile
    const state = req.query.state || '';
    const redirectUri = oauthConfig.redirectUri || '';
    const isMobileApp = state.includes('mobile=true') || 
                       redirectUri.includes('ngrok-free.dev') ||
                       redirectUri.includes('ngrok-free.app');

    if (isMobileApp) {
      // Redirect to Flutter deep link
      res.redirect(`goorderlyai://auth/callback?token=${jwtToken}`);
    } else {
      // Redirect to web frontend
      const frontendUrl = process.env.FRONTEND_URL || 'http://192.168.29.220:3001';
      res.redirect(`${frontendUrl}/auth/callback?token=${jwtToken}`);
    }
  } catch (error) {
    console.error('OAuth callback error:', error);
    // Check if mobile app based on redirect URI
    const redirectUri = oauthConfig.redirectUri || '';
    const isMobileApp = redirectUri.includes('ngrok-free.dev') || 
                       redirectUri.includes('ngrok-free.app');
    
    if (isMobileApp) {
      res.redirect(`goorderlyai://auth/callback?error=oauth_failed`);
    } else {
      const frontendUrl = process.env.FRONTEND_URL || 'http://192.168.29.220:3001';
      res.redirect(`${frontendUrl}/login?error=oauth_failed`);
    }
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = req.user; // Set by auth middleware
    
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      pictureUrl: user.pictureUrl,
      googleId: user.googleId
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * POST /api/auth/logout
 * Revoke tokens and logout
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    const user = req.user; // Set by auth middleware
    
    await googleAuthService.revokeTokens(user);
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

module.exports = router;

