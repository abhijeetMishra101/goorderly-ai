// frontend/src/services/api.js

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

class ApiClient {
  constructor() {
    this.baseURL = API_URL;
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken() {
    return this.token || localStorage.getItem('auth_token');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const token = this.getToken();

    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.error || `HTTP error! status: ${response.status}`);
        error.status = response.status;
        error.details = data.details;
        throw error;
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      // If it's already our error, re-throw it
      if (error.message) {
        throw error;
      }
      // Otherwise, wrap it
      throw new Error(error.message || 'Network error');
    }
  }

  // Auth endpoints
  async getAuthUrl() {
    return `${this.baseURL}/api/auth/google`;
  }

  async getMe() {
    return this.request('/api/auth/me');
  }

  async logout() {
    const result = await this.request('/api/auth/logout', { method: 'POST' });
    this.setToken(null);
    return result;
  }

  // Template endpoints
  async getTemplates() {
    return this.request('/api/templates');
  }

  async getTemplate(id) {
    return this.request(`/api/templates/${id}`);
  }

  // Onboarding endpoints
  async getOnboardingStatus() {
    return this.request('/api/onboarding/status');
  }

  async selectTemplate(templateId) {
    return this.request('/api/onboarding/select-template', {
      method: 'POST',
      body: JSON.stringify({ templateId }),
    });
  }

  async confirmOnboarding(templateId, preferences) {
    return this.request('/api/onboarding/confirm', {
      method: 'POST',
      body: JSON.stringify({ templateId, preferences }),
    });
  }

  // Journal endpoints
  async getJournal(date) {
    return this.request(`/api/journal/${date}`);
  }

  async createJournal(date = null) {
    return this.request('/api/journal/create', {
      method: 'POST',
      body: JSON.stringify(date ? { date } : {}),
    });
  }

  async logVoiceEntry(entry) {
    return this.request('/api/journal/voice-entry', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  }

  async getJournalContent(journalId) {
    const url = `${this.baseURL}/api/journal/${journalId}/content`;
    const token = this.getToken();

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
      throw new Error(error.error || `Failed to fetch journal content: ${response.status}`);
    }

    return response.text();
  }
}

const api = new ApiClient();

export default api;

