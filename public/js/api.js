// TaskFlow API Client
const API = {
  TOKEN_KEY: 'taskflow_token',
  USER_KEY: 'taskflow_user',

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  setAuth(token, user) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  },

  clearAuth() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  },

  getCurrentUser() {
    const raw = localStorage.getItem(this.USER_KEY);
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers
    };

    const config = {
      ...options,
      headers
    };

    try {
      const res = await fetch(endpoint, config);
      if (res.status === 401) {
        // Token expired or invalid
        console.warn('Session expired or unauthorized');
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Đã có lỗi xảy ra');
      }
      return data;
    } catch (err) {
      console.error(`API Error on [${options.method || 'GET'}] ${endpoint}:`, err);
      throw err;
    }
  },

  // Auth
  async login(email, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.setAuth(data.token, data.user);
    return data;
  },

  async register(userData) {
    const data = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    this.setAuth(data.token, data.user);
    return data;
  },

  async forgotPassword(email) {
    return this.request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  async resetPassword(email, otp, newPassword) {
    return this.request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, otp, newPassword })
    });
  },

  async switchDemo(userId) {
    const data = await this.request('/api/auth/switch-demo', {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
    this.setAuth(data.token, data.user);
    return data;
  },

  async getMe() {
    return this.request('/api/auth/me');
  },

  // Tasks
  async getTasks(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/api/tasks${q ? `?${q}` : ''}`);
  },

  async getTask(id) {
    return this.request(`/api/tasks/${id}`);
  },

  async createTask(taskData) {
    return this.request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData)
    });
  },

  async updateTask(id, taskData) {
    return this.request(`/api/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(taskData)
    });
  },

  async updateTaskStatus(id, status, progress) {
    return this.request(`/api/tasks/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, progress })
    });
  },

  async deleteTask(id) {
    return this.request(`/api/tasks/${id}`, {
      method: 'DELETE'
    });
  },

  // Comments
  async getComments(taskId) {
    return this.request(`/api/tasks/${taskId}/comments`);
  },

  async addComment(taskId, content) {
    return this.request(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
  },

  // Notifications
  async getNotifications() {
    return this.request('/api/notifications');
  },

  async markNotificationRead(id) {
    return this.request(`/api/notifications/${id}/read`, { method: 'POST' });
  },

  async markAllNotificationsRead() {
    return this.request('/api/notifications/read-all', { method: 'POST' });
  },

  async scanAlertsNow() {
    return this.request('/api/alerts/scan-now', { method: 'POST' });
  },

  // Reports
  async getReportsSummary() {
    return this.request('/api/reports/summary');
  },

  // Users
  async getUsers() {
    return this.request('/api/users');
  },

  async createUser(userData) {
    return this.request('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },

  async updateUser(id, userData) {
    return this.request(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    });
  },

  async deleteUser(id) {
    return this.request(`/api/users/${id}`, {
      method: 'DELETE'
    });
  },

  // System
  async getActivities() {
    return this.request('/api/activities');
  },

  async resetDemo() {
    return this.request('/api/system/reset-demo', { method: 'POST' });
  }
};
