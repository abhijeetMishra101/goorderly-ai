// src/services/googleAuthService.js

const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const oauthConfig = require('../config/googleOAuth');
const User = require('../models/user');

class GoogleAuthService {
  constructor() {
    this.oAuth2Client = new google.auth.OAuth2(
      oauthConfig.clientId,
      oauthConfig.clientSecret,
      oauthConfig.redirectUri
    );
  }

  /**
   * Get OAuth2 authorization URL
   * @param {string} state - Optional state parameter (e.g., 'mobile=true')
   * @returns {string} Authorization URL
   */
  getAuthUrl(state = '') {
    const authUrlOptions = {
      access_type: 'offline',
      scope: oauthConfig.scopes,
      prompt: 'consent' // Force consent screen to get refresh token
    };
    
    if (state) {
      authUrlOptions.state = state;
    }
    
    return this.oAuth2Client.generateAuthUrl(authUrlOptions);
  }

  /**
   * Exchange authorization code for tokens
   * @param {string} code - Authorization code from OAuth callback
   * @returns {Promise<Object>} Tokens object
   */
  async getTokensFromCode(code) {
    try {
      const { tokens } = await this.oAuth2Client.getToken(code);
      return tokens;
    } catch (error) {
      throw new Error(`Failed to exchange code for tokens: ${error.message}`);
    }
  }

  /**
   * Get or create user from Google tokens
   * @param {Object} tokens - OAuth tokens
   * @returns {Promise<Object>} User object
   */
  async getOrCreateUser(tokens) {
    try {
      // Set credentials to get user info
      this.oAuth2Client.setCredentials(tokens);
      
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oAuth2Client });
      const { data } = await oauth2.userinfo.get();

      // Find or create user
      const [user, created] = await User.findOrCreate({
        where: { googleId: data.id },
        defaults: {
          email: data.email,
          googleId: data.id,
          name: data.name,
          pictureUrl: data.picture,
          refreshToken: tokens.refresh_token || tokens.access_token // Fallback if no refresh token
        }
      });

      // Update refresh token if it changed
      if (!created && tokens.refresh_token) {
        user.refreshToken = tokens.refresh_token;
        await user.save();
      }

      return user;
    } catch (error) {
      throw new Error(`Failed to get or create user: ${error.message}`);
    }
  }

  /**
   * Get access token for user (refresh if needed)
   * @param {Object} user - User object with refresh token
   * @returns {Promise<string>} Access token
   */
  async getAccessTokenForUser(user) {
    try {
      this.oAuth2Client.setCredentials({
        refresh_token: user.refreshToken
      });

      const { credentials } = await this.oAuth2Client.refreshAccessToken();
      
      // Update refresh token if it changed
      if (credentials.refresh_token && credentials.refresh_token !== user.refreshToken) {
        user.refreshToken = credentials.refresh_token;
        await user.save();
      }

      return credentials.access_token;
    } catch (error) {
      throw new Error(`Failed to refresh access token: ${error.message}`);
    }
  }

  /**
   * Get OAuth2 client configured for a specific user
   * @param {Object} user - User object
   * @returns {Promise<Object>} Configured OAuth2 client
   */
  async getOAuth2ClientForUser(user) {
    const accessToken = await this.getAccessTokenForUser(user);
    this.oAuth2Client.setCredentials({
      refresh_token: user.refreshToken,
      access_token: accessToken
    });
    return this.oAuth2Client;
  }

  /**
   * Generate JWT token for user session
   * @param {Object} user - User object
   * @returns {string} JWT token
   */
  generateJWT(user) {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        googleId: user.googleId
      },
      oauthConfig.jwtSecret,
      { expiresIn: '7d' }
    );
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token
   * @returns {Object} Decoded token payload
   */
  verifyJWT(token) {
    try {
      return jwt.verify(token, oauthConfig.jwtSecret);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Revoke user tokens
   * @param {Object} user - User object
   * @returns {Promise<void>}
   */
  async revokeTokens(user) {
    try {
      this.oAuth2Client.setCredentials({
        refresh_token: user.refreshToken
      });
      await this.oAuth2Client.revokeCredentials();
      
      // Clear refresh token in database
      user.refreshToken = null;
      await user.save();
    } catch (error) {
      throw new Error(`Failed to revoke tokens: ${error.message}`);
    }
  }
}

module.exports = new GoogleAuthService();

