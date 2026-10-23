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
        console.warn('Session expired or unauthorized');
      }

      const contentType = res.headers.get('content-type') || '';
      let data;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        if (!res.ok) {
          throw new Error(`Lỗi máy chủ (${res.status}): ${text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)}`);
        }
        try {
          data = JSON.parse(text);
        } catch (e) {
          data = { text };
        }
      }

      if (!res.ok) {
        throw new Error(data.error || data.message || `Lỗi máy chủ (${res.status})`);
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

  async ssoLogin(ssoData) {
    const data = await this.request('/api/auth/sso', {
      method: 'POST',
      body: JSON.stringify(ssoData)
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

  // Profile & Account Settings
  async getProfile() {
    return this.request('/api/auth/profile');
  },

  async updateProfile(profileData) {
    return this.request('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
  },

  async uploadAvatar(avatarDataUrl, avatarEmoji = null) {
    return this.request('/api/auth/upload-avatar', {
      method: 'POST',
      body: JSON.stringify({ avatarDataUrl, avatarEmoji })
    });
  },

  async changePassword(currentPassword, newPassword) {
    return this.request('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
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

  async logout() {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore network errors on logout
    }
    this.clearAuth();
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

  // Google Meet per Task
  async updateTaskMeet(id, meetUrl) {
    return this.request(`/api/tasks/${id}/meet`, {
      method: 'POST',
      body: JSON.stringify({ meetUrl })
    });
  },

  async deleteTaskMeet(id) {
    return this.request(`/api/tasks/${id}/meet`, {
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
  async getReportsSummary(dept = '') {
    const query = dept ? `?department=${encodeURIComponent(dept)}` : '';
    return this.request(`/api/reports/summary${query}`);
  },

  // Executive Desk (Bàn Làm Việc AI)
  async getExecutiveDeskAnalytics(dept = '') {
    const query = dept ? `?department=${encodeURIComponent(dept)}` : '';
    return this.request(`/api/executive-desk/analytics${query}`);
  },

  async askExecutiveDeskAi(question, dept = '') {
    return this.request('/api/executive-desk/ask-ai', {
      method: 'POST',
      body: JSON.stringify({ question, department: dept })
    });
  },

  async rebalanceExecutiveDeskTask(taskId, targetUserId) {
    return this.request('/api/executive-desk/rebalance', {
      method: 'POST',
      body: JSON.stringify({ taskId, targetUserId })
    });
  },

  async summonExecutiveWarRoom(warRoomData) {
    return this.request('/api/executive-desk/war-room/summon', {
      method: 'POST',
      body: JSON.stringify(warRoomData)
    });
  },

  // Announcement Poster (Thông Báo Đặc Biệt & Nhiệm Vụ Trước Đăng Nhập)
  async getAnnouncementPoster() {
    return this.request('/api/announcement-poster');
  },

  async updateAnnouncementPoster(posterData) {
    return this.request('/api/announcement-poster', {
      method: 'POST',
      body: JSON.stringify(posterData)
    });
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

  async resetUserPassword(id, newPassword) {
    return this.request(`/api/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword })
    });
  },

  async toggleUserStatus(id, active) {
    return this.request(`/api/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ active })
    });
  },

  // Departments
  async getDepartments() {
    return this.request('/api/departments');
  },

  async createDepartment(name) {
    return this.request('/api/departments', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  },

  async updateDepartment(id, name) {
    return this.request(`/api/departments/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ name })
    });
  },

  async deleteDepartment(id) {
    return this.request(`/api/departments/${id}`, {
      method: 'DELETE'
    });
  },

  // Automations (Workflow Rules)
  async getAutomations() {
    return this.request('/api/automations');
  },

  async createAutomation(ruleData) {
    return this.request('/api/automations', {
      method: 'POST',
      body: JSON.stringify(ruleData)
    });
  },

  async updateAutomation(id, updates) {
    return this.request(`/api/automations/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  },

  async deleteAutomation(id) {
    return this.request(`/api/automations/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  },

  async triggerAutomation(id) {
    return this.request(`/api/automations/${encodeURIComponent(id)}/trigger`, {
      method: 'POST'
    });
  },

  // System & Version Updates
  async getVersionInfo() {
    return this.request('/api/system/version');
  },

  async publishUpdate(customMessage = '') {
    return this.request('/api/system/publish-update', {
      method: 'POST',
      body: JSON.stringify({ customMessage })
    });
  },

  async getActivities() {
    return this.request('/api/activities');
  },

  async resetDemo() {
    return this.request('/api/system/reset-demo', { method: 'POST' });
  },

  // Google Calendar & Automated Reminders
  async getCalendarSettings(userId) {
    return this.request(`/api/users/${encodeURIComponent(userId)}/calendar-settings`);
  },

  async updateCalendarSettings(userId, settings) {
    return this.request(`/api/users/${encodeURIComponent(userId)}/calendar-settings`, {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  },

  async syncCalendarNow() {
    return this.request('/api/calendar/sync-now', { method: 'POST' });
  },

  async testCalendarReminder() {
    return this.request('/api/calendar/test-reminder', { method: 'POST' });
  }
};
