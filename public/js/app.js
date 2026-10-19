// TaskFlow Pro - Main Application Controller
const App = {
  ws: null,
  wsReconnectTimer: null,
  state: {
    user: null,
    users: [],
    departments: [],
    tasks: [],
    notifications: [],
    activities: [],
    activeView: 'kanban',
    currentDetailTask: null,
    draggedTaskId: null,
    onlineCount: 1,
    filters: {
      status: 'all',
      priority: 'all',
      department: 'all',
      assignedTo: 'all',
      search: ''
    }
  },

  // Audio effects using Web Audio API
  audioCtx: null,
  playSound(type = 'info') {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!this.audioCtx) this.audioCtx = new AudioContext();
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      const now = this.audioCtx.currentTime;
      if (type === 'alert' || type === 'danger') {
        // Double warning beep
        osc.frequency.setValueAtTime(880, now); // A5
        osc.frequency.setValueAtTime(659, now + 0.1); // E5
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'success') {
        // Bright pleasant chime
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      } else {
        // Soft pop
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      }
    } catch (e) {
      // Audio not permitted or supported
    }
  },

  async init() {
    this.initTheme();
    this.setupEventListeners();

    // Fetch initial departments for registration / app dropdowns
    try {
      const deptsRes = await API.getDepartments();
      this.state.departments = deptsRes.departments || [];
      this.populateDepartmentDropdowns();
    } catch (e) {
      console.warn('Could not load departments initially', e);
    }

    // Check if already authenticated
    const token = API.getToken();
    const storedUser = API.getCurrentUser();

    if (token && storedUser) {
      try {
        const meRes = await API.getMe();
        this.state.user = meRes.user;
        this.showAppView();
        this.initWebSocket();
        await this.loadInitialData();
        this.renderHeader();
        this.renderView();
        return;
      } catch (err) {
        console.warn('Session check failed, requiring login:', err);
        API.clearAuth();
      }
    }

    // Default: Show login screen
    this.showLoginView();
  },

  showLoginView() {
    const loginScreen = document.getElementById('loginScreen');
    const appContainer = document.getElementById('appContainer');
    if (loginScreen) loginScreen.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';

    // Reset login form fields
    const emailInput = document.getElementById('loginEmail');
    const pwdInput = document.getElementById('loginPassword');
    const alertBox = document.getElementById('loginAlert');
    if (emailInput) emailInput.value = '';
    if (pwdInput) pwdInput.value = '';
    if (alertBox) alertBox.style.display = 'none';
  },

  showAppView() {
    const loginScreen = document.getElementById('loginScreen');
    const appContainer = document.getElementById('appContainer');
    if (loginScreen) loginScreen.style.display = 'none';
    if (appContainer) appContainer.style.display = 'flex';
  },

  switchAuthTab(tab) {
    const tabLogin = document.getElementById('tabLoginBtn');
    const tabRegister = document.getElementById('tabRegisterBtn');
    const loginContainer = document.getElementById('loginFormContainer');
    const registerContainer = document.getElementById('registerFormContainer');
    const forgotContainer = document.getElementById('forgotPasswordContainer');
    const alertBox = document.getElementById('loginAlert');

    if (alertBox) alertBox.style.display = 'none';

    if (tab === 'register') {
      if (tabLogin) tabLogin.classList.remove('active');
      if (tabRegister) tabRegister.classList.add('active');
      if (loginContainer) loginContainer.style.display = 'none';
      if (registerContainer) registerContainer.style.display = 'block';
      if (forgotContainer) forgotContainer.style.display = 'none';
    } else if (tab === 'forgot') {
      if (tabLogin) tabLogin.classList.remove('active');
      if (tabRegister) tabRegister.classList.remove('active');
      if (loginContainer) loginContainer.style.display = 'none';
      if (registerContainer) registerContainer.style.display = 'none';
      if (forgotContainer) {
        forgotContainer.style.display = 'block';
        const fForm = document.getElementById('forgotPasswordForm');
        const rForm = document.getElementById('resetPasswordForm');
        if (fForm) fForm.style.display = 'block';
        if (rForm) rForm.style.display = 'none';
      }
    } else {
      if (tabLogin) tabLogin.classList.add('active');
      if (tabRegister) tabRegister.classList.remove('active');
      if (loginContainer) loginContainer.style.display = 'block';
      if (registerContainer) registerContainer.style.display = 'none';
      if (forgotContainer) forgotContainer.style.display = 'none';
    }
  },

  async performLogin(email, password) {
    const alertBox = document.getElementById('loginAlert');
    const alertMsg = document.getElementById('loginAlertMsg');
    const submitBtn = document.getElementById('loginSubmitBtn');

    if (alertBox) alertBox.style.display = 'none';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Đang xác thực...</span>';
    }

    try {
      const data = await API.login(email, password);
      this.state.user = data.user;
      this.showAppView();
      this.initWebSocket();
      await this.loadInitialData();
      this.renderHeader();
      this.renderView();
      this.showToast(`👋 Chào mừng ${data.user.name} (${data.user.role.toUpperCase()})!`, 'success');
      this.playSound('success');
    } catch (err) {
      if (alertBox && alertMsg) {
        alertMsg.innerText = err.message || 'Email hoặc mật khẩu không chính xác';
        alertBox.style.display = 'flex';
      }
      this.playSound('danger');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Đăng Nhập Vào Hệ Thống</span><span>➔</span>';
      }
    }
  },

  async performSsoLogin(email, name = '') {
    const alertBox = document.getElementById('loginAlert');
    const alertMsg = document.getElementById('loginAlertMsg');
    const ssoBtn = document.getElementById('btnSsoSubmit');

    if (alertBox) alertBox.style.display = 'none';
    if (ssoBtn) {
      ssoBtn.disabled = true;
      ssoBtn.innerHTML = '<span>Đang xác thực Google SSO...</span>';
    }

    try {
      const data = await API.ssoLogin({ email, name });
      this.closeModal('ssoModal');
      this.state.user = data.user;
      this.showAppView();
      this.initWebSocket();
      await this.loadInitialData();
      this.renderHeader();
      this.renderView();

      const welcomeMsg = data.isNewUser
        ? `🎉 Đăng ký SSO thành công! Tài khoản mới đã được kích hoạt: ${data.user.name}`
        : `👋 Chào mừng bạn quay trở lại, ${data.user.name}!`;

      this.showToast(welcomeMsg, 'success');
      this.playSound('success');
    } catch (err) {
      if (alertBox && alertMsg) {
        alertMsg.innerText = err.message || 'Xác thực SSO thất bại!';
        alertBox.style.display = 'flex';
      }
      this.showToast(`❌ Lỗi SSO: ${err.message}`, 'danger');
      this.playSound('danger');
    } finally {
      if (ssoBtn) {
        ssoBtn.disabled = false;
        ssoBtn.innerHTML = '<span>Xác Thực SSO & Đăng Nhập Ngay ➔</span>';
      }
    }
  },

  logout() {
    API.clearAuth();
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    clearTimeout(this.wsReconnectTimer);
    this.state.user = null;
    this.state.tasks = [];
    this.state.notifications = [];
    this.showLoginView();
    this.showToast('Đã đăng xuất khỏi hệ thống thành công.', 'info');
  },

  initTheme() {
    const saved = localStorage.getItem('taskflow_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    this.updateThemeButtonIcon(saved);
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('taskflow_theme', next);
    this.updateThemeButtonIcon(next);
    if (this.state.activeView === 'reports') {
      this.renderReportsView();
    }
  },

  updateThemeButtonIcon(theme) {
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
      btn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
      btn.title = theme === 'dark' ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối';
    }
  },

  // -------------------------------------------------------------
  // REALTIME WEBSOCKET CLIENT
  // -------------------------------------------------------------
  initWebSocket() {
    if (this.ws) {
      this.ws.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.updateRealtimeBadge(true);
        // Authenticate WS
        const token = API.getToken();
        if (token) {
          this.ws.send(JSON.stringify({ type: 'auth', token }));
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.handleRealtimeEvent(payload);
        } catch (e) {
          console.error('Invalid WS payload', e);
        }
      };

      this.ws.onclose = () => {
        this.updateRealtimeBadge(false);
        // Auto-reconnect after 3 seconds
        clearTimeout(this.wsReconnectTimer);
        this.wsReconnectTimer = setTimeout(() => this.initWebSocket(), 3000);
      };

      this.ws.onerror = (err) => {
        this.updateRealtimeBadge(false);
      };
    } catch (e) {
      this.updateRealtimeBadge(false);
    }
  },

  updateRealtimeBadge(isConnected) {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    if (dot && text) {
      if (isConnected) {
        dot.className = 'status-dot';
        text.innerHTML = `<span class="hide-mobile">Trực tuyến: </span>${this.state.onlineCount} <span class="hide-mobile">người</span><span class="show-mobile-only">online</span>`;
      } else {
        dot.className = 'status-dot disconnected';
        text.innerHTML = `<span class="hide-mobile">Mất kết nối</span><span class="show-mobile-only">Offline</span>`;
      }
    }
  },

  handleRealtimeEvent(msg) {
    const { event, data } = msg;

    switch (event) {
      case 'users:online':
        this.state.onlineCount = data.count || 1;
        this.updateRealtimeBadge(true);
        break;

      case 'task:created':
        this.state.tasks.unshift(data.task);
        this.showToast(`✨ ${data.creator} vừa tạo công việc mới: "${data.task.title}"`, 'info');
        this.playSound('info');
        this.renderView();
        break;

      case 'task:updated':
        const uIdx = this.state.tasks.findIndex(t => t.id === data.task.id);
        if (uIdx !== -1) {
          this.state.tasks[uIdx] = data.task;
        } else {
          this.state.tasks.unshift(data.task);
        }
        if (this.state.currentDetailTask && this.state.currentDetailTask.id === data.task.id) {
          this.state.currentDetailTask = data.task;
          this.renderTaskDetailModal();
        }
        this.showToast(`📝 ${data.updatedBy} đã cập nhật công việc #${data.task.id}`, 'info');
        this.renderView();
        break;

      case 'task:status_changed':
        const sIdx = this.state.tasks.findIndex(t => t.id === data.taskId);
        if (sIdx !== -1) {
          this.state.tasks[sIdx] = data.task;
        }
        if (this.state.currentDetailTask && this.state.currentDetailTask.id === data.taskId) {
          this.state.currentDetailTask = data.task;
          this.renderTaskDetailModal();
        }
        const statusMap = { todo: 'Cần làm', in_progress: 'Đang làm', review: 'Chờ duyệt', completed: 'Hoàn thành' };
        this.showToast(`🔄 #${data.taskId} chuyển sang "${statusMap[data.task.status] || data.task.status}"`, 'success');
        this.playSound('success');
        this.renderView();
        break;

      case 'task:deleted':
        this.state.tasks = this.state.tasks.filter(t => t.id !== data.taskId);
        if (this.state.currentDetailTask && this.state.currentDetailTask.id === data.taskId) {
          this.closeModal('taskDetailModal');
        }
        this.showToast(`🗑️ ${data.deletedBy} đã xóa công việc #${data.taskId}`, 'warning');
        this.renderView();
        break;

      case 'task:comment_added':
        if (this.state.currentDetailTask && this.state.currentDetailTask.id === data.taskId) {
          this.appendCommentToModal(data.comment);
        }
        this.showToast(`💬 ${data.comment.userName} đã bình luận vào #${data.taskId}`, 'info');
        this.playSound('info');
        break;

      case 'alert:new':
        this.state.notifications.unshift(data);
        this.updateNotificationBadge();
        this.showToast(`${data.title}: ${data.message}`, data.level || 'danger');
        this.playSound('alert');
        if (this.state.activeView === 'alerts') {
          this.renderAlertsView();
        }
        break;

      case 'user:created':
      case 'user:updated':
      case 'user:deleted':
        this.refreshUsersList();
        break;

      case 'department:created':
        this.showToast(`🏢 ${data.createdBy} vừa thêm phòng ban mới: "${data.department.name}"`, 'info');
        this.refreshDepartments();
        if (document.getElementById('departmentModal')?.classList.contains('show')) {
          this.renderDepartmentList();
        }
        break;

      case 'department:deleted':
        this.showToast(`🗑️ ${data.deletedBy} đã xóa phòng ban "${data.name}"`, 'info');
        this.refreshDepartments();
        if (document.getElementById('departmentModal')?.classList.contains('show')) {
          this.renderDepartmentList();
        }
        break;

      case 'system:reset':
        this.showToast(`♻️ ${data.message}`, 'warning');
        this.loadInitialData().then(() => this.renderView());
        break;
    }
  },

  async loadInitialData() {
    try {
      const [tasksRes, usersRes, notifsRes, deptsRes] = await Promise.all([
        API.getTasks(),
        API.getUsers(),
        API.getNotifications(),
        API.getDepartments()
      ]);
      this.state.tasks = tasksRes.tasks || [];
      this.state.users = usersRes.users || [];
      this.state.notifications = notifsRes.notifications || [];
      this.state.departments = (deptsRes && deptsRes.departments) ? deptsRes.departments : [];
      this.populateFilterDropdowns();
      this.populateDepartmentDropdowns();
      this.updateNotificationBadge();
    } catch (err) {
      console.error('Failed to load initial data', err);
    }
  },

  async refreshUsersList() {
    try {
      const usersRes = await API.getUsers();
      this.state.users = usersRes.users || [];
      this.populateFilterDropdowns();
      if (this.state.activeView === 'users') {
        this.renderUsersView();
      }
    } catch (e) {
      console.error(e);
    }
  },

  // -------------------------------------------------------------
  // UI EVENT LISTENERS
  // -------------------------------------------------------------
  setupEventListeners() {
    // Navigation
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.getAttribute('data-view');
        if (view) this.switchView(view);
      });
    });

    // Mobile menu toggle
    const mobileBtn = document.getElementById('mobileMenuToggle');
    if (mobileBtn) {
      mobileBtn.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
      });
    }

    // Theme toggle
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => this.toggleTheme());
    }

    // Scan Alerts Now button
    const scanBtn = document.getElementById('scanAlertsBtn');
    if (scanBtn) {
      scanBtn.addEventListener('click', async () => {
        try {
          scanBtn.disabled = true;
          scanBtn.innerHTML = '⏳<span class="hide-mobile"> Đang quét...</span>';
          const res = await API.scanAlertsNow();
          this.showToast(`✅ ${res.message}`, 'success');
          await this.loadInitialData();
          this.renderView();
        } catch (e) {
          this.showToast(`Lỗi: ${e.message}`, 'danger');
        } finally {
          scanBtn.disabled = false;
          scanBtn.innerHTML = '⚡<span class="hide-mobile"> Quét Cảnh Báo</span>';
        }
      });
    }

    // Mobile Kanban Tab Switcher listeners
    document.querySelectorAll('.kanban-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const col = btn.getAttribute('data-col');
        const colHeader = document.querySelector(`.kanban-col-header.${col}`);
        const colEl = colHeader ? colHeader.closest('.kanban-col') : null;
        if (colEl) {
          colEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
        }
        document.querySelectorAll('.kanban-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Filter controls
    const searchInput = document.getElementById('filterSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.state.filters.search = e.target.value;
        this.renderView();
      });
    }

    const priorityFilter = document.getElementById('filterPriority');
    if (priorityFilter) {
      priorityFilter.addEventListener('change', (e) => {
        this.state.filters.priority = e.target.value;
        this.renderView();
      });
    }

    const deptFilter = document.getElementById('filterDepartment');
    if (deptFilter) {
      deptFilter.addEventListener('change', (e) => {
        this.state.filters.department = e.target.value;
        this.renderView();
      });
    }

    const userFilter = document.getElementById('filterAssignee');
    if (userFilter) {
      userFilter.addEventListener('change', (e) => {
        this.state.filters.assignedTo = e.target.value;
        this.renderView();
      });
    }

    // Notification dropdown toggle
    const notifBtn = document.getElementById('notifBtn');
    const notifDropdown = document.getElementById('notifDropdown');
    if (notifBtn && notifDropdown) {
      notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notifDropdown.classList.toggle('show');
        this.renderNotificationDropdown();
      });

      document.addEventListener('click', (e) => {
        if (!notifDropdown.contains(e.target) && e.target !== notifBtn) {
          notifDropdown.classList.remove('show');
        }
      });
    }

    // Demo user quick switcher
    const demoSelect = document.getElementById('demoUserSelect');
    if (demoSelect) {
      demoSelect.addEventListener('change', async (e) => {
        const userId = e.target.value;
        if (!userId) return;
        try {
          await API.switchDemo(userId);
          this.state.user = API.getCurrentUser();
          this.initWebSocket();
          this.renderHeader();
          await this.loadInitialData();
          this.renderView();
          this.showToast(`Đã chuyển sang tài khoản: ${this.state.user.name} (${this.state.user.role.toUpperCase()})`, 'success');
        } catch (err) {
          this.showToast(`Lỗi chuyển tài khoản: ${err.message}`, 'danger');
        }
      });
    }

    // Modal Close buttons
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close-modal');
        this.closeModal(modalId);
      });
    });

    // Close modal on background click
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('show');
        }
      });
    });

    // Add Task Button
    const addTaskBtn = document.getElementById('btnOpenAddTaskModal');
    if (addTaskBtn) {
      addTaskBtn.addEventListener('click', () => this.openTaskModal());
    }

    // Task Form Submit
    const taskForm = document.getElementById('taskForm');
    if (taskForm) {
      taskForm.addEventListener('submit', (e) => this.handleTaskFormSubmit(e));
    }

    // Add Comment Form Submit
    const commentForm = document.getElementById('commentForm');
    if (commentForm) {
      commentForm.addEventListener('submit', (e) => this.handleCommentSubmit(e));
    }

    // Add User Form Submit
    const userForm = document.getElementById('userForm');
    if (userForm) {
      userForm.addEventListener('submit', (e) => this.handleUserFormSubmit(e));
    }

    // Add / Manage Department Form Submit
    const deptForm = document.getElementById('departmentForm');
    if (deptForm) {
      deptForm.addEventListener('submit', (e) => this.handleDepartmentFormSubmit(e));
    }

    // Setup Drag and Drop for Kanban Columns
    this.setupKanbanDragAndDrop();

    // ========================================================
    // AUTH & LOGIN SCREEN LISTENERS
    // ========================================================
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const pass = document.getElementById('loginPassword').value;
        if (email && pass) {
          this.performLogin(email, pass);
        }
      });
    }

    // Toggle password visibility
    const togglePwdBtn = document.getElementById('togglePasswordBtn');
    const pwdInput = document.getElementById('loginPassword');
    if (togglePwdBtn && pwdInput) {
      togglePwdBtn.addEventListener('click', () => {
        if (pwdInput.type === 'password') {
          pwdInput.type = 'text';
          togglePwdBtn.innerText = '🙈';
        } else {
          pwdInput.type = 'password';
          togglePwdBtn.innerText = '👁️';
        }
      });
    }

    // ========================================================
    // FORGOT & RESET PASSWORD LISTENERS
    // ========================================================
    const linkToForgot = document.getElementById('linkToForgot');
    if (linkToForgot) {
      linkToForgot.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchAuthTab('forgot');
      });
    }

    const linkBackFromForgot = document.getElementById('linkBackFromForgot');
    if (linkBackFromForgot) {
      linkBackFromForgot.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchAuthTab('login');
      });
    }

    const forgotForm = document.getElementById('forgotPasswordForm');
    if (forgotForm) {
      forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const alertBox = document.getElementById('loginAlert');
        const alertMsg = document.getElementById('loginAlertMsg');
        const submitBtn = document.getElementById('btnForgotSubmit');
        const email = document.getElementById('forgotEmail').value.trim();

        if (!email) return;

        if (alertBox) alertBox.style.display = 'none';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span>Đang xác nhận email...</span>';
        }

        try {
          const res = await API.forgotPassword(email);
          this.state.resetEmail = res.email;

          // Switch to Step 2
          document.getElementById('forgotPasswordForm').style.display = 'none';
          document.getElementById('resetPasswordForm').style.display = 'block';
          document.getElementById('displayOtpCode').innerText = res.otp;
          document.getElementById('resetOtp').value = res.otp;

          this.showToast(`🔑 Mã xác minh của bạn: ${res.otp}`, 'info');
          this.playSound('info');
        } catch (err) {
          if (alertBox && alertMsg) {
            alertMsg.innerText = err.message || 'Không tìm thấy tài khoản với email này!';
            alertBox.style.display = 'flex';
          }
          this.playSound('danger');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Tiếp Tục ➔</span>';
          }
        }
      });
    }

    const resetForm = document.getElementById('resetPasswordForm');
    if (resetForm) {
      resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const alertBox = document.getElementById('loginAlert');
        const alertMsg = document.getElementById('loginAlertMsg');
        const submitBtn = document.getElementById('btnResetSubmit');

        const email = this.state.resetEmail || document.getElementById('forgotEmail').value.trim();
        const otp = document.getElementById('resetOtp').value.trim();
        const newPass = document.getElementById('resetNewPass').value;
        const confirmPass = document.getElementById('resetConfirmPass').value;

        if (newPass.length < 6) {
          if (alertBox && alertMsg) {
            alertMsg.innerText = 'Mật khẩu mới phải có tối thiểu 6 ký tự!';
            alertBox.style.display = 'flex';
          }
          return;
        }

        if (newPass !== confirmPass) {
          if (alertBox && alertMsg) {
            alertMsg.innerText = 'Mật khẩu xác nhận không khớp!';
            alertBox.style.display = 'flex';
          }
          return;
        }

        if (alertBox) alertBox.style.display = 'none';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span>Đang lưu mật khẩu...</span>';
        }

        try {
          await API.resetPassword(email, otp, newPass);
          this.showToast('✅ Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay.', 'success');
          this.playSound('success');

          // Prefill login form
          const loginEmail = document.getElementById('loginEmail');
          const loginPass = document.getElementById('loginPassword');
          if (loginEmail) loginEmail.value = email;
          if (loginPass) loginPass.value = newPass;

          // Switch back to login
          this.switchAuthTab('login');
        } catch (err) {
          if (alertBox && alertMsg) {
            alertMsg.innerText = err.message || 'Không thể đặt lại mật khẩu!';
            alertBox.style.display = 'flex';
          }
          this.playSound('danger');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Cập Nhật Mật Khẩu Mới ➔</span>';
          }
        }
      });
    }

    // Logout buttons
    const btnLogoutSidebar = document.getElementById('btnLogoutSidebar');
    if (btnLogoutSidebar) {
      btnLogoutSidebar.addEventListener('click', () => this.logout());
    }

    const btnLogoutHeader = document.getElementById('btnLogoutHeader');
    if (btnLogoutHeader) {
      btnLogoutHeader.addEventListener('click', () => this.logout());
    }

    // ========================================================
    // REGISTRATION (@vmg.edu.vn ONLY) LISTENERS
    // ========================================================
    const tabLoginBtn = document.getElementById('tabLoginBtn');
    const tabRegisterBtn = document.getElementById('tabRegisterBtn');
    const linkToRegister = document.getElementById('linkToRegister');
    const linkToLogin = document.getElementById('linkToLogin');

    if (tabLoginBtn) tabLoginBtn.addEventListener('click', () => this.switchAuthTab('login'));
    if (tabRegisterBtn) tabRegisterBtn.addEventListener('click', () => this.switchAuthTab('register'));
    if (linkToRegister) {
      linkToRegister.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchAuthTab('register');
      });
    }
    if (linkToLogin) {
      linkToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchAuthTab('login');
      });
    }

    // Real-time email domain validator for @vmg.edu.vn
    const regEmailInput = document.getElementById('regEmail');
    const regEmailHint = document.getElementById('regEmailHint');
    if (regEmailInput && regEmailHint) {
      regEmailInput.addEventListener('input', () => {
        const val = regEmailInput.value.trim().toLowerCase();
        if (!val) {
          regEmailHint.innerHTML = '* Bắt buộc có đuôi <strong>@vmg.edu.vn</strong>';
          regEmailHint.className = 'email-domain-hint';
        } else if (val.endsWith('@vmg.edu.vn')) {
          regEmailHint.innerHTML = '✅ Email nội bộ VMG hợp lệ!';
          regEmailHint.className = 'email-domain-hint valid';
        } else if (val.includes('@')) {
          regEmailHint.innerHTML = '❌ Email không hợp lệ! Chỉ chấp nhận đuôi <strong>@vmg.edu.vn</strong>';
          regEmailHint.className = 'email-domain-hint invalid';
        } else {
          regEmailHint.innerHTML = 'Đang nhập... Cần kết thúc bằng <strong>@vmg.edu.vn</strong>';
          regEmailHint.className = 'email-domain-hint';
        }
      });
    }

    // Register Form Submit
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const alertBox = document.getElementById('loginAlert');
        const alertMsg = document.getElementById('loginAlertMsg');
        const submitBtn = document.getElementById('regSubmitBtn');

        const name = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim().toLowerCase();
        const department = document.getElementById('regDept').value;
        const position = document.getElementById('regPosition').value.trim();
        const password = document.getElementById('regPassword').value;
        const confirmPassword = document.getElementById('regConfirmPassword').value;

        // Validation checks
        if (!email.endsWith('@vmg.edu.vn')) {
          if (alertBox && alertMsg) {
            alertMsg.innerText = 'Chính sách bảo mật: Bạn chỉ có thể đăng ký bằng email nội bộ có đuôi @vmg.edu.vn!';
            alertBox.style.display = 'flex';
          }
          this.playSound('danger');
          return;
        }

        if (password.length < 6) {
          if (alertBox && alertMsg) {
            alertMsg.innerText = 'Mật khẩu phải có độ dài từ 6 ký tự trở lên!';
            alertBox.style.display = 'flex';
          }
          this.playSound('danger');
          return;
        }

        if (password !== confirmPassword) {
          if (alertBox && alertMsg) {
            alertMsg.innerText = 'Mật khẩu xác nhận không trùng khớp. Vui lòng kiểm tra lại!';
            alertBox.style.display = 'flex';
          }
          this.playSound('danger');
          return;
        }

        if (alertBox) alertBox.style.display = 'none';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span>Đang khởi tạo tài khoản...</span>';
        }

        try {
          const res = await API.register({
            name,
            email,
            password,
            department,
            position
          });

          this.state.user = res.user;
          this.showAppView();
          this.initWebSocket();
          await this.loadInitialData();
          this.renderHeader();
          this.renderView();
          this.showToast(`🎉 Chào mừng ${res.user.name} đã gia nhập hệ thống TaskFlow VMG!`, 'success');
          this.playSound('success');
        } catch (err) {
          if (alertBox && alertMsg) {
            alertMsg.innerText = err.message || 'Đăng ký không thành công. Vui lòng thử lại!';
            alertBox.style.display = 'flex';
          }
          this.playSound('danger');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Đăng Ký Tài Khoản Ngay</span><span>➔</span>';
          }
        }
      });
    }

    // ========================================================
    // SSO GOOGLE WORKSPACE LISTENERS (@vmg.edu.vn)
    // ========================================================
    const btnSsoLogin = document.getElementById('btnSsoLogin');
    if (btnSsoLogin) {
      btnSsoLogin.addEventListener('click', () => {
        const loginEmail = document.getElementById('loginEmail')?.value.trim();
        const ssoInput = document.getElementById('ssoEmailInput');
        if (ssoInput && loginEmail && loginEmail.endsWith('@vmg.edu.vn')) {
          ssoInput.value = loginEmail;
        }
        this.openModal('ssoModal');
      });
    }

    const btnSsoRegister = document.getElementById('btnSsoRegister');
    if (btnSsoRegister) {
      btnSsoRegister.addEventListener('click', () => {
        const regEmail = document.getElementById('regEmail')?.value.trim();
        const regName = document.getElementById('regName')?.value.trim();
        const ssoInput = document.getElementById('ssoEmailInput');
        const ssoName = document.getElementById('ssoNameInput');
        if (ssoInput && regEmail && regEmail.endsWith('@vmg.edu.vn')) {
          ssoInput.value = regEmail;
        }
        if (ssoName && regName) {
          ssoName.value = regName;
        }
        this.openModal('ssoModal');
      });
    }

    // Quick SSO account selection
    document.querySelectorAll('.sso-account-card').forEach(card => {
      card.addEventListener('click', () => {
        const email = card.getAttribute('data-sso-email');
        const name = card.getAttribute('data-sso-name') || '';
        if (email) {
          this.performSsoLogin(email, name);
        }
      });
    });

    // Realtime domain validator on ssoEmailInput
    const ssoEmailInput = document.getElementById('ssoEmailInput');
    const ssoEmailHint = document.getElementById('ssoEmailHint');
    if (ssoEmailInput && ssoEmailHint) {
      ssoEmailInput.addEventListener('input', () => {
        const val = ssoEmailInput.value.trim().toLowerCase();
        if (!val) {
          ssoEmailHint.innerHTML = '* Bắt buộc có đuôi <strong>@vmg.edu.vn</strong>';
          ssoEmailHint.className = 'email-domain-hint';
        } else if (val.endsWith('@vmg.edu.vn')) {
          ssoEmailHint.innerHTML = '✅ Email nội bộ VMG hợp lệ!';
          ssoEmailHint.className = 'email-domain-hint valid';
        } else if (val.includes('@')) {
          ssoEmailHint.innerHTML = '❌ Email không hợp lệ! Chỉ chấp nhận đuôi <strong>@vmg.edu.vn</strong>';
          ssoEmailHint.className = 'email-domain-hint invalid';
        } else {
          ssoEmailHint.innerHTML = 'Đang nhập... Cần kết thúc bằng <strong>@vmg.edu.vn</strong>';
          ssoEmailHint.className = 'email-domain-hint';
        }
      });
    }

    // SSO custom form submit
    const ssoCustomForm = document.getElementById('ssoCustomForm');
    if (ssoCustomForm) {
      ssoCustomForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('ssoEmailInput')?.value.trim().toLowerCase();
        const name = document.getElementById('ssoNameInput')?.value.trim();

        if (!email) return;

        if (!email.endsWith('@vmg.edu.vn')) {
          this.showToast('Chính sách SSO: Chỉ chấp nhận email có đuôi @vmg.edu.vn!', 'danger');
          this.playSound('danger');
          return;
        }

        this.performSsoLogin(email, name);
      });
    }
  },

  // -------------------------------------------------------------
  // VIEW SWITCHING
  // -------------------------------------------------------------
  switchView(viewName) {
    this.state.activeView = viewName;

    // Update active nav item
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-view') === viewName);
    });

    // Update view title in header
    const titleMap = {
      kanban: '📋 Bảng Công Việc',
      table: '📑 Danh Sách Việc',
      calendar: '📅 Lịch Biểu Hạn',
      reports: '📈 Báo Cáo Thống Kê',
      alerts: '🚨 Trung Tâm Cảnh Báo',
      users: '👥 Quản Trị Nhân Sự',
      activities: '📜 Nhật Ký Hoạt Động'
    };
    const titleEl = document.getElementById('currentViewTitle');
    if (titleEl) {
      titleEl.innerText = titleMap[viewName] || 'Quản Lý Công Việc';
    }

    // Show/hide view panels
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `view-${viewName}`);
    });

    // Close mobile menu if open
    document.getElementById('sidebar')?.classList.remove('open');

    // Render corresponding view
    this.renderView();
  },

  renderView() {
    switch (this.state.activeView) {
      case 'kanban':
        this.renderKanbanView();
        break;
      case 'table':
        this.renderTableView();
        break;
      case 'calendar':
        this.renderCalendarView();
        break;
      case 'reports':
        this.renderReportsView();
        break;
      case 'alerts':
        this.renderAlertsView();
        break;
      case 'users':
        this.renderUsersView();
        break;
      case 'activities':
        this.renderActivitiesView();
        break;
    }
    this.renderKPIs();
  },

  renderHeader() {
    const user = this.state.user;
    if (!user) return;

    // Sidebar User Profile
    const avatarEl = document.getElementById('sidebarUserAvatar');
    const nameEl = document.getElementById('sidebarUserName');
    const roleTagEl = document.getElementById('sidebarUserRole');

    if (avatarEl) avatarEl.innerText = user.avatar || (user.role === 'admin' ? '👑' : '👤');
    if (nameEl) nameEl.innerText = user.name;
    if (roleTagEl) {
      roleTagEl.className = `user-role-tag ${user.role}`;
      roleTagEl.innerText = user.role === 'admin' ? 'ADMIN' : 'USER';
    }

    // Demo Switcher select option
    const demoSelect = document.getElementById('demoUserSelect');
    if (demoSelect) {
      demoSelect.value = user.id;
    }

    // Admin-only Navigation item visibility
    const adminNav = document.querySelector('.nav-item[data-view="users"]');
    if (adminNav) {
      adminNav.style.display = user.role === 'admin' ? 'flex' : 'none';
    }
  },

  populateDepartmentDropdowns() {
    const depts = (this.state.departments && this.state.departments.length > 0)
      ? this.state.departments.map(d => typeof d === 'string' ? d : d.name)
      : ['Phòng Kỹ Thuật', 'Phòng Marketing', 'Phòng Kinh Doanh', 'Phòng Vận Hành', 'Ban Giám Đốc'];

    // 1. Filter Department dropdown
    const deptSelect = document.getElementById('filterDepartment');
    if (deptSelect) {
      const currentVal = deptSelect.value;
      deptSelect.innerHTML = '<option value="all">Tất cả phòng ban</option>' +
        depts.map(d => `<option value="${d}">${d}</option>`).join('');
      deptSelect.value = currentVal || 'all';
    }

    // 2. Task Form Department dropdown
    const taskDeptSelect = document.getElementById('taskFormDept');
    if (taskDeptSelect) {
      const currentVal = taskDeptSelect.value;
      taskDeptSelect.innerHTML = depts.map(d => `<option value="${d}">${d}</option>`).join('');
      if (currentVal && depts.includes(currentVal)) {
        taskDeptSelect.value = currentVal;
      }
    }

    // 3. User Form Department dropdown (in userModal)
    const userDeptSelect = document.getElementById('userFormDept');
    if (userDeptSelect) {
      const currentVal = userDeptSelect.value;
      userDeptSelect.innerHTML = depts.map(d => `<option value="${d}">${d}</option>`).join('');
      if (currentVal && depts.includes(currentVal)) {
        userDeptSelect.value = currentVal;
      }
    }

    // 4. Registration Department dropdown
    const regDeptSelect = document.getElementById('regDept');
    if (regDeptSelect) {
      const currentVal = regDeptSelect.value;
      regDeptSelect.innerHTML = depts.map(d => `<option value="${d}">${d}</option>`).join('');
      if (currentVal && depts.includes(currentVal)) {
        regDeptSelect.value = currentVal;
      }
    }
  },

  populateFilterDropdowns() {
    // Populate Assignee dropdown
    const assigneeSelect = document.getElementById('filterAssignee');
    const taskAssigneeSelect = document.getElementById('taskFormAssignee');
    if (assigneeSelect) {
      const currentVal = assigneeSelect.value;
      assigneeSelect.innerHTML = '<option value="all">Tất cả người phụ trách</option>' +
        this.state.users.map(u => `<option value="${u.id}">${u.name} (${u.role.toUpperCase()})</option>`).join('');
      assigneeSelect.value = currentVal || 'all';
    }
    if (taskAssigneeSelect) {
      taskAssigneeSelect.innerHTML = this.state.users.map(u => 
        `<option value="${u.id}">${u.name} - ${u.department}</option>`
      ).join('');
    }

    // Populate Department dropdowns dynamically
    this.populateDepartmentDropdowns();
  },

  // -------------------------------------------------------------
  // DEPARTMENT MANAGEMENT & QUICK ADD
  // -------------------------------------------------------------
  openDeptModal() {
    this.renderDepartmentList();
    this.openModal('departmentModal');
    const input = document.getElementById('newDeptInput');
    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 150);
    }
  },

  renderDepartmentList() {
    const container = document.getElementById('deptListContainer');
    const countBadge = document.getElementById('deptCountBadge');
    if (!container) return;

    const depts = this.state.departments || [];
    if (countBadge) {
      countBadge.innerText = `${depts.length} phòng ban`;
    }

    if (depts.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:13px;">Chưa có phòng ban nào trong hệ thống</div>';
      return;
    }

    // Count active members per department
    const users = this.state.users || [];
    const deptMemberCount = {};
    users.forEach(u => {
      deptMemberCount[u.department] = (deptMemberCount[u.department] || 0) + 1;
    });

    container.innerHTML = depts.map(d => {
      const name = typeof d === 'string' ? d : d.name;
      const id = typeof d === 'string' ? d : d.id;
      const count = deptMemberCount[name] || 0;

      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--bg-main); border:1px solid var(--border-color); border-radius:var(--radius-sm);">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:20px;">🏢</span>
            <div>
              <strong style="font-size:13.5px; color:var(--text-primary); display:block;">${this.escapeHtml(name)}</strong>
              <span style="font-size:11.5px; color:var(--text-secondary);">${count} thành viên</span>
            </div>
          </div>
          <div>
            <button type="button" class="btn btn-outline btn-sm" onclick="App.deleteDepartment('${id}', '${this.escapeHtml(name)}', ${count})" style="color:var(--danger); border-color:#fca5a5; padding:4px 8px; font-size:11.5px;" title="Xóa phòng ban này">
              🗑️ Xóa
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  async handleDepartmentFormSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('newDeptInput');
    const submitBtn = document.getElementById('btnAddDeptSubmit');
    if (!input) return;

    const name = input.value.trim();
    if (!name) return;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Đang thêm...';
    }

    try {
      const res = await API.createDepartment(name);
      this.showToast(`✅ Đã thêm phòng ban "${res.department.name}" thành công!`, 'success');
      this.playSound('success');
      input.value = '';
      await this.refreshDepartments();
      this.renderDepartmentList();
    } catch (err) {
      this.showToast(`Lỗi: ${err.message}`, 'danger');
      this.playSound('danger');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = '+ Thêm Mới';
      }
    }
  },

  async deleteDepartment(id, name, memberCount) {
    if (memberCount > 0) {
      const ok = confirm(`Cảnh báo: Hiện đang có ${memberCount} nhân sự thuộc "${name}". Bạn có chắc chắn muốn xóa phòng ban này không?`);
      if (!ok) return;
    } else {
      if (!confirm(`Bạn có chắc chắn muốn xóa phòng ban "${name}" khỏi hệ thống?`)) return;
    }

    try {
      await API.deleteDepartment(id);
      this.showToast(`🗑️ Đã xóa phòng ban "${name}"`, 'info');
      await this.refreshDepartments();
      this.renderDepartmentList();
    } catch (err) {
      this.showToast(`Lỗi xóa: ${err.message}`, 'danger');
      this.playSound('danger');
    }
  },

  async quickAddDepartment(targetSelectId) {
    const name = prompt('Nhập tên phòng ban mới bạn muốn tạo (Ví dụ: Phòng Kế Toán, Ban R&D...):');
    if (!name || !name.trim()) return;

    try {
      const res = await API.createDepartment(name.trim());
      this.showToast(`✅ Đã thêm phòng ban "${res.department.name}" thành công!`, 'success');
      this.playSound('success');

      // Refresh list
      await this.refreshDepartments();

      // Auto select newly created department in the current open form!
      if (targetSelectId) {
        const select = document.getElementById(targetSelectId);
        if (select) {
          select.value = res.department.name;
        }
      }
    } catch (err) {
      alert(err.message || 'Lỗi khi thêm phòng ban');
      this.playSound('danger');
    }
  },

  async refreshDepartments() {
    try {
      const res = await API.getDepartments();
      this.state.departments = res.departments || [];
      this.populateDepartmentDropdowns();
    } catch (e) {
      console.error('Failed to refresh departments', e);
    }
  },

  getFilteredTasks() {
    const { status, priority, department, assignedTo, search } = this.state.filters;
    let list = [...this.state.tasks];

    if (status !== 'all') list = list.filter(t => t.status === status);
    if (priority !== 'all') list = list.filter(t => t.priority === priority);
    if (department !== 'all') list = list.filter(t => t.department === department);
    if (assignedTo !== 'all') list = list.filter(t => t.assignedTo === assignedTo);

    if (search && search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t => 
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        t.id.toLowerCase().includes(q)
      );
    }

    return list;
  },

  // -------------------------------------------------------------
  // KPI METRICS
  // -------------------------------------------------------------
  renderKPIs() {
    const tasks = this.state.tasks;
    const now = new Date();

    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const overdue = tasks.filter(t => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < now).length;
    const urgent = tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed').length;

    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.innerText = val;
    };

    setVal('kpiTotalTasks', total);
    setVal('kpiCompletedRate', `${rate}%`);
    setVal('kpiInProgress', inProgress);
    setVal('kpiOverdue', overdue);
    setVal('kpiUrgent', urgent);

    // Sidebar badge for overdue
    const badge = document.getElementById('sidebarOverdueBadge');
    if (badge) {
      if (overdue > 0) {
        badge.innerText = overdue;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
  },

  // -------------------------------------------------------------
  // KANBAN BOARD VIEW & DRAG-AND-DROP
  // -------------------------------------------------------------
  renderKanbanView() {
    const tasks = this.getFilteredTasks();
    const columns = ['todo', 'in_progress', 'review', 'completed'];

    columns.forEach(col => {
      const colTasks = tasks.filter(t => t.status === col);
      const container = document.getElementById(`kanbanCards_${col}`);
      const countEl = document.getElementById(`kanbanCount_${col}`);

      if (countEl) countEl.innerText = colTasks.length;
      const tabCountEl = document.getElementById(`tabCount_${col}`);
      if (tabCountEl) tabCountEl.innerText = colTasks.length;
      if (!container) return;

      if (colTasks.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:30px 10px; color:var(--text-muted); font-size:12px;">Trống</div>';
        return;
      }

      container.innerHTML = colTasks.map(task => this.createTaskCardHtml(task)).join('');
    });

    // Re-attach card click listeners
    document.querySelectorAll('.task-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // Prevent opening detail if clicking drag handle or quick buttons
        if (e.target.closest('.card-action-btn')) return;
        const taskId = card.getAttribute('data-task-id');
        this.openTaskDetail(taskId);
      });
    });
  },

  createTaskCardHtml(task) {
    const now = new Date();
    const isCompleted = task.status === 'completed';
    const isOverdue = !isCompleted && task.dueDate && new Date(task.dueDate) < now;
    
    let hoursLeft = 999;
    if (task.dueDate) {
      hoursLeft = (new Date(task.dueDate).getTime() - now.getTime()) / (1000 * 3600);
    }
    const isDueSoon = !isCompleted && !isOverdue && hoursLeft >= 0 && hoursLeft <= 24;

    const assignee = this.state.users.find(u => u.id === task.assignedTo);
    const priorityLabels = { urgent: 'Khẩn cấp', high: 'Cao', medium: 'Trung bình', low: 'Thấp' };

    let deadlineClass = '';
    let deadlineText = task.dueDate ? new Date(task.dueDate).toLocaleDateString('vi-VN') : 'Không hạn';
    if (isOverdue) {
      deadlineClass = 'danger';
      const daysOver = Math.ceil(Math.abs(hoursLeft) / 24);
      deadlineText = `Trễ ${daysOver} ngày!`;
    } else if (isDueSoon) {
      deadlineClass = 'warning';
      deadlineText = `Còn ${Math.round(hoursLeft)} giờ`;
    }

    return `
      <div class="task-card ${isOverdue ? 'is-overdue' : ''} ${isDueSoon ? 'is-due-soon' : ''}" 
           draggable="true" 
           data-task-id="${task.id}">
        <div class="task-card-header">
          <span class="task-id">#${task.id}</span>
          <span class="badge-priority ${task.priority}">${priorityLabels[task.priority] || task.priority}</span>
        </div>
        <div class="task-title">${this.escapeHtml(task.title)}</div>
        ${task.description ? `<div class="task-desc-preview">${this.escapeHtml(task.description)}</div>` : ''}
        
        <div class="task-progress-bar">
          <div class="task-progress-fill" style="width: ${task.progress || 0}%"></div>
        </div>

        <div class="task-card-footer">
          <div class="task-assignee" title="${assignee ? assignee.name : 'Chưa gán'}">
            <span>${assignee ? assignee.avatar : '👤'}</span>
            <span>${assignee ? assignee.name.split(' ').slice(-1)[0] : 'N/A'}</span>
          </div>
          <div class="task-deadline ${deadlineClass}">
            <span>${isOverdue ? '🚨' : isDueSoon ? '⏰' : '📅'}</span>
            <span>${deadlineText}</span>
          </div>
        </div>
      </div>
    `;
  },

  setupKanbanDragAndDrop() {
    document.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.task-card');
      if (card) {
        this.state.draggedTaskId = card.getAttribute('data-task-id');
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', this.state.draggedTaskId);
      }
    });

    document.addEventListener('dragend', (e) => {
      const card = e.target.closest('.task-card');
      if (card) {
        card.classList.remove('dragging');
        this.state.draggedTaskId = null;
      }
    });

    const columns = document.querySelectorAll('.kanban-cards');
    columns.forEach(col => {
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        col.classList.add('drag-over');
      });

      col.addEventListener('dragleave', () => {
        col.classList.remove('drag-over');
      });

      col.addEventListener('drop', async (e) => {
        e.preventDefault();
        col.classList.remove('drag-over');
        const taskId = e.dataTransfer.getData('text/plain') || this.state.draggedTaskId;
        const newStatus = col.getAttribute('data-status');

        if (taskId && newStatus) {
          const task = this.state.tasks.find(t => t.id === taskId);
          if (task && task.status !== newStatus) {
            // Optimistic update
            task.status = newStatus;
            if (newStatus === 'completed') task.progress = 100;
            this.renderKanbanView();

            try {
              await API.updateTaskStatus(taskId, newStatus, task.progress);
            } catch (err) {
              this.showToast(`Lỗi chuyển trạng thái: ${err.message}`, 'danger');
              await this.loadInitialData();
              this.renderKanbanView();
            }
          }
        }
      });
    });
  },

  // -------------------------------------------------------------
  // TABLE VIEW
  // -------------------------------------------------------------
  renderTableView() {
    const tasks = this.getFilteredTasks();
    const tbody = document.getElementById('taskTableBody');
    if (!tbody) return;

    if (tasks.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 40px; color:var(--text-muted);">Không tìm thấy công việc phù hợp với bộ lọc</td></tr>';
      return;
    }

    const now = new Date();
    const statusLabels = { todo: 'Cần làm', in_progress: 'Đang làm', review: 'Chờ duyệt', completed: 'Hoàn thành' };
    const priorityLabels = { urgent: 'Khẩn cấp', high: 'Cao', medium: 'Trung bình', low: 'Thấp' };

    tbody.innerHTML = tasks.map(task => {
      const isCompleted = task.status === 'completed';
      const isOverdue = !isCompleted && task.dueDate && new Date(task.dueDate) < now;
      const assignee = this.state.users.find(u => u.id === task.assignedTo);

      return `
        <tr>
          <td><strong style="color:var(--text-muted)">#${task.id}</strong></td>
          <td>
            <div style="font-weight:600; cursor:pointer;" onclick="App.openTaskDetail('${task.id}')">
              ${this.escapeHtml(task.title)}
            </div>
            <div style="font-size:11px; color:var(--text-muted);">${task.department}</div>
          </td>
          <td>
            <div style="display:flex; align-items:center; gap:6px;">
              <span>${assignee ? assignee.avatar : '👤'}</span>
              <span>${assignee ? assignee.name : 'Chưa gán'}</span>
            </div>
          </td>
          <td><span class="badge-priority ${task.priority}">${priorityLabels[task.priority] || task.priority}</span></td>
          <td><span class="badge-status ${task.status}">${statusLabels[task.status] || task.status}</span></td>
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <div class="task-progress-bar" style="width:70px; margin:0;">
                <div class="task-progress-fill" style="width:${task.progress || 0}%;"></div>
              </div>
              <span style="font-size:11px; font-weight:600;">${task.progress || 0}%</span>
            </div>
          </td>
          <td>
            <div style="font-weight:600; color:${isOverdue ? 'var(--danger)' : 'inherit'};">
              ${isOverdue ? '🚨 ' : ''}${task.dueDate ? new Date(task.dueDate).toLocaleDateString('vi-VN') : 'Không hạn'}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  // -------------------------------------------------------------
  // CALENDAR / TIMELINE VIEW
  // -------------------------------------------------------------
  renderCalendarView() {
    const tasks = this.state.tasks;
    const container = document.getElementById('calendarTimelineList');
    if (!container) return;

    const now = new Date();
    now.setHours(0,0,0,0);

    const overdueList = [];
    const todayList = [];
    const weekList = [];
    const futureList = [];
    const completedList = [];

    tasks.forEach(t => {
      if (t.status === 'completed') {
        completedList.push(t);
        return;
      }
      if (!t.dueDate) {
        futureList.push(t);
        return;
      }
      const due = new Date(t.dueDate);
      due.setHours(0,0,0,0);
      const diffDays = Math.round((due.getTime() - now.getTime()) / (1000 * 3600 * 24));

      if (diffDays < 0) overdueList.push(t);
      else if (diffDays === 0) todayList.push(t);
      else if (diffDays <= 7) weekList.push(t);
      else futureList.push(t);
    });

    const renderSection = (title, items, badgeClass, icon) => {
      if (items.length === 0) return '';
      return `
        <div style="margin-bottom:24px;">
          <div style="font-size:15px; font-weight:700; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
            <span>${icon}</span>
            <span>${title}</span>
            <span class="col-count" style="background:${badgeClass}; color:#fff;">${items.length}</span>
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:12px;">
            ${items.map(t => this.createTaskCardHtml(t)).join('')}
          </div>
        </div>
      `;
    };

    container.innerHTML = 
      renderSection('Đã Quá Hạn - Cần Xử Lý Ngay', overdueList, 'var(--danger)', '🚨') +
      renderSection('Đến Hạn Hôm Nay', todayList, '#ea580c', '⏰') +
      renderSection('Đến Hạn Trong Tuần Này', weekList, '#2563eb', '📅') +
      renderSection('Công Việc Kế Hoạch Tương Lai', futureList, '#64748b', '📌') +
      renderSection('Đã Hoàn Thành', completedList, '#059669', '✅');

    // Attach card click listeners
    container.querySelectorAll('.task-card').forEach(card => {
      card.addEventListener('click', () => {
        this.openTaskDetail(card.getAttribute('data-task-id'));
      });
    });
  },

  // -------------------------------------------------------------
  // ALERTS CENTER VIEW
  // -------------------------------------------------------------
  renderAlertsView() {
    const tasks = this.state.tasks;
    const now = new Date();

    const overdueTasks = tasks.filter(t => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < now);
    const dueSoonTasks = tasks.filter(t => {
      if (t.status === 'completed' || !t.dueDate) return false;
      const due = new Date(t.dueDate);
      const hoursLeft = (due.getTime() - now.getTime()) / (1000 * 3600);
      return hoursLeft >= 0 && hoursLeft <= 24;
    });

    const bannerCountEl = document.getElementById('alertTotalCount');
    if (bannerCountEl) bannerCountEl.innerText = overdueTasks.length + dueSoonTasks.length;

    const overdueContainer = document.getElementById('alertsOverdueGrid');
    if (overdueContainer) {
      if (overdueTasks.length === 0) {
        overdueContainer.innerHTML = '<div style="color:var(--text-muted); font-size:13px;">🎉 Tuyệt vời! Không có công việc nào bị quá hạn.</div>';
      } else {
        overdueContainer.innerHTML = overdueTasks.map(t => {
          const assignee = this.state.users.find(u => u.id === t.assignedTo);
          const daysOver = Math.ceil(Math.abs((new Date(t.dueDate).getTime() - now.getTime()) / (1000 * 3600 * 24)));
          return `
            <div class="alert-card-item">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span class="badge-priority ${t.priority}">#${t.id} - ${t.priority.toUpperCase()}</span>
                <span style="color:var(--danger); font-size:12px; font-weight:700;">Trễ ${daysOver} ngày</span>
              </div>
              <div style="font-size:14px; font-weight:700; margin-bottom:6px;">${this.escapeHtml(t.title)}</div>
              <div style="font-size:12px; color:var(--text-secondary); margin-bottom:12px;">
                Phụ trách: <strong>${assignee ? assignee.name : 'N/A'}</strong> (${t.department})
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <button class="btn btn-outline btn-sm" onclick="App.openTaskDetail('${t.id}')">Xem chi tiết</button>
                <button class="btn btn-primary btn-sm" onclick="App.quickCompleteTask('${t.id}')">Đánh dấu xong</button>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    const dueSoonContainer = document.getElementById('alertsDueSoonGrid');
    if (dueSoonContainer) {
      if (dueSoonTasks.length === 0) {
        dueSoonContainer.innerHTML = '<div style="color:var(--text-muted); font-size:13px;">Không có công việc nào sắp hết hạn trong 24 giờ tới.</div>';
      } else {
        dueSoonContainer.innerHTML = dueSoonTasks.map(t => {
          const assignee = this.state.users.find(u => u.id === t.assignedTo);
          const hoursLeft = Math.round((new Date(t.dueDate).getTime() - now.getTime()) / (1000 * 3600));
          return `
            <div class="alert-card-item warning">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span class="badge-priority ${t.priority}">#${t.id}</span>
                <span style="color:#d97706; font-size:12px; font-weight:700;">Còn ${hoursLeft} giờ</span>
              </div>
              <div style="font-size:14px; font-weight:700; margin-bottom:6px;">${this.escapeHtml(t.title)}</div>
              <div style="font-size:12px; color:var(--text-secondary); margin-bottom:12px;">
                Phụ trách: <strong>${assignee ? assignee.name : 'N/A'}</strong>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <button class="btn btn-outline btn-sm" onclick="App.openTaskDetail('${t.id}')">Xem chi tiết</button>
                <button class="btn btn-success btn-sm" onclick="App.quickCompleteTask('${t.id}')">Hoàn tất ngay</button>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  },

  async quickCompleteTask(taskId) {
    try {
      await API.updateTaskStatus(taskId, 'completed', 100);
      this.showToast(`✅ Đã hoàn tất công việc #${taskId}`, 'success');
      this.renderView();
    } catch (e) {
      this.showToast(`Lỗi: ${e.message}`, 'danger');
    }
  },

  // -------------------------------------------------------------
  // REPORTS & ANALYTICS VIEW
  // -------------------------------------------------------------
  async renderReportsView() {
    try {
      const summary = await API.getReportsSummary();
      TaskCharts.renderReports(summary);

      // Render Member Performance Table
      const tbody = document.getElementById('reportMemberTableBody');
      if (tbody && summary.memberPerformance) {
        tbody.innerHTML = summary.memberPerformance.map(m => `
          <tr>
            <td>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:18px;">${m.avatar}</span>
                <div>
                  <div style="font-weight:600;">${m.name}</div>
                  <div style="font-size:11px; color:var(--text-muted);">${m.department}</div>
                </div>
              </div>
            </td>
            <td><strong>${m.total}</strong></td>
            <td style="color:var(--success); font-weight:600;">${m.completed}</td>
            <td style="color:var(--primary); font-weight:600;">${m.inProgress}</td>
            <td style="color:${m.overdue > 0 ? 'var(--danger)' : 'inherit'}; font-weight:700;">
              ${m.overdue > 0 ? `🚨 ${m.overdue}` : '0'}
            </td>
            <td>
              <div style="display:flex; align-items:center; gap:8px;">
                <div class="task-progress-bar" style="width:70px; margin:0;">
                  <div class="task-progress-fill" style="width:${m.completionRate}%;"></div>
                </div>
                <span style="font-weight:700;">${m.completionRate}%</span>
              </div>
            </td>
          </tr>
        `).join('');
      }
    } catch (err) {
      console.error('Failed to render reports', err);
    }
  },

  exportCsvReport() {
    window.location.href = '/api/reports/export-csv';
  },

  printReport() {
    window.print();
  },

  // -------------------------------------------------------------
  // USERS MANAGEMENT VIEW (Admin)
  // -------------------------------------------------------------
  renderUsersView() {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;

    tbody.innerHTML = this.state.users.map(u => {
      const isMe = this.state.user && this.state.user.id === u.id;
      const countTasks = this.state.tasks.filter(t => t.assignedTo === u.id).length;

      return `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-size:20px;">${u.avatar || '👤'}</span>
              <div>
                <div style="font-weight:600;">${u.name} ${isMe ? '<span style="font-size:10px; color:var(--primary); font-weight:700;">(BẠN)</span>' : ''}</div>
                <div style="font-size:11px; color:var(--text-secondary);">${u.position || 'Nhân viên'}</div>
              </div>
            </div>
          </td>
          <td>${u.email}</td>
          <td>${u.department}</td>
          <td>
            <span class="user-role-tag ${u.role}">
              ${u.role.toUpperCase()}
            </span>
          </td>
          <td><strong>${countTasks}</strong> việc</td>
          <td>
            <span style="font-size:12px; font-weight:600; color:${u.active ? 'var(--success)' : 'var(--danger)'};">
              ${u.active ? '● Hoạt động' : '● Đã khóa'}
            </span>
          </td>
          <td>
            ${this.state.user.role === 'admin' ? `
              <button class="btn btn-outline btn-sm" onclick="App.openEditUserModal('${u.id}')">Sửa</button>
              ${!isMe ? `<button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="App.deleteUser('${u.id}')">Xóa</button>` : ''}
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');
  },

  openAddUserModal() {
    this.populateDepartmentDropdowns();
    document.getElementById('userModalTitle').innerText = 'Thêm Thành Viên Mới';
    document.getElementById('userFormId').value = '';
    document.getElementById('userFormName').value = '';
    document.getElementById('userFormEmail').value = '';
    document.getElementById('userFormPassword').value = '123456';
    document.getElementById('userFormRole').value = 'user';
    const firstDept = (this.state.departments && this.state.departments[0])
      ? (typeof this.state.departments[0] === 'string' ? this.state.departments[0] : this.state.departments[0].name)
      : 'Phòng Kỹ Thuật';
    document.getElementById('userFormDept').value = firstDept;
    document.getElementById('userFormPosition').value = 'Chuyên viên';
    this.openModal('userModal');
  },

  openEditUserModal(userId) {
    this.populateDepartmentDropdowns();
    const user = this.state.users.find(u => u.id === userId);
    if (!user) return;

    document.getElementById('userModalTitle').innerText = 'Chỉnh Sửa Thông Tin Thành Viên';
    document.getElementById('userFormId').value = user.id;
    document.getElementById('userFormName').value = user.name;
    document.getElementById('userFormEmail').value = user.email;
    document.getElementById('userFormPassword').value = ''; // Leave blank to keep
    document.getElementById('userFormRole').value = user.role;
    document.getElementById('userFormDept').value = user.department;
    document.getElementById('userFormPosition').value = user.position || '';
    this.openModal('userModal');
  },

  async handleUserFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('userFormId').value;
    const name = document.getElementById('userFormName').value;
    const email = document.getElementById('userFormEmail').value;
    const password = document.getElementById('userFormPassword').value;
    const role = document.getElementById('userFormRole').value;
    const department = document.getElementById('userFormDept').value;
    const position = document.getElementById('userFormPosition').value;

    try {
      if (id) {
        const payload = { name, email, role, department, position };
        if (password) payload.password = password;
        await API.updateUser(id, payload);
        this.showToast('✅ Đã cập nhật thành viên thành công!', 'success');
      } else {
        await API.createUser({ name, email, password, role, department, position });
        this.showToast('✅ Đã tạo thành viên mới thành công!', 'success');
      }
      this.closeModal('userModal');
      await this.refreshUsersList();
    } catch (err) {
      this.showToast(`Lỗi: ${err.message}`, 'danger');
    }
  },

  async deleteUser(userId) {
    if (!confirm('Bạn có chắc chắn muốn xóa thành viên này khỏi hệ thống?')) return;
    try {
      await API.deleteUser(userId);
      this.showToast('Đã xóa thành viên!', 'warning');
      await this.refreshUsersList();
    } catch (err) {
      this.showToast(`Lỗi xóa: ${err.message}`, 'danger');
    }
  },

  // -------------------------------------------------------------
  // ACTIVITIES VIEW
  // -------------------------------------------------------------
  async renderActivitiesView() {
    const container = document.getElementById('activityLogContainer');
    if (!container) return;

    try {
      const res = await API.getActivities();
      const list = res.activities || [];

      if (list.length === 0) {
        container.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted);">Chưa có nhật ký hoạt động nào.</div>';
        return;
      }

      container.innerHTML = list.map(item => `
        <div style="padding:14px 18px; border-bottom:1px solid var(--border-color); display:flex; gap:12px; align-items:flex-start;">
          <div style="font-size:18px;">📌</div>
          <div style="flex:1;">
            <div style="font-size:13px; font-weight:600;">
              ${item.userName} <span style="font-weight:normal; color:var(--text-secondary);">${item.details}</span>
            </div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:3px;">
              ${new Date(item.timestamp).toLocaleString('vi-VN')}
            </div>
          </div>
        </div>
      `).join('');
    } catch (e) {
      console.error(e);
    }
  },

  // -------------------------------------------------------------
  // TASK CRUD & MODALS
  // -------------------------------------------------------------
  openTaskModal(taskToEdit = null) {
    this.populateDepartmentDropdowns();
    const titleEl = document.getElementById('taskModalTitle');
    const form = document.getElementById('taskForm');
    form.reset();

    if (taskToEdit) {
      titleEl.innerText = `Chỉnh sửa công việc #${taskToEdit.id}`;
      document.getElementById('taskFormId').value = taskToEdit.id;
      document.getElementById('taskFormTitle').value = taskToEdit.title;
      document.getElementById('taskFormDesc').value = taskToEdit.description || '';
      document.getElementById('taskFormPriority').value = taskToEdit.priority;
      document.getElementById('taskFormDept').value = taskToEdit.department;
      document.getElementById('taskFormAssignee').value = taskToEdit.assignedTo;
      if (taskToEdit.dueDate) {
        document.getElementById('taskFormDueDate').value = taskToEdit.dueDate.split('T')[0];
      }
    } else {
      titleEl.innerText = 'Thêm Công Việc Mới';
      document.getElementById('taskFormId').value = '';
      // Default due date to 3 days from now
      const d = new Date();
      d.setDate(d.getDate() + 3);
      document.getElementById('taskFormDueDate').value = d.toISOString().split('T')[0];
    }

    this.openModal('taskModal');
  },

  async handleTaskFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('taskFormId').value;
    const title = document.getElementById('taskFormTitle').value;
    const description = document.getElementById('taskFormDesc').value;
    const priority = document.getElementById('taskFormPriority').value;
    const department = document.getElementById('taskFormDept').value;
    const assignedTo = document.getElementById('taskFormAssignee').value;
    const dueDate = document.getElementById('taskFormDueDate').value;

    const payload = {
      title,
      description,
      priority,
      department,
      assignedTo,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null
    };

    try {
      if (id) {
        await API.updateTask(id, payload);
        this.showToast('✅ Đã cập nhật công việc!', 'success');
      } else {
        await API.createTask(payload);
        this.showToast('🎉 Đã tạo công việc mới thành công!', 'success');
      }
      this.closeModal('taskModal');
      this.renderView();
    } catch (err) {
      this.showToast(`Lỗi: ${err.message}`, 'danger');
    }
  },

  // -------------------------------------------------------------
  // TASK DETAIL & COMMENTS MODAL
  // -------------------------------------------------------------
  async openTaskDetail(taskId) {
    try {
      const res = await API.getTask(taskId);
      this.state.currentDetailTask = res.task;
      this.renderTaskDetailModal(res.comments);
      this.openModal('taskDetailModal');
    } catch (e) {
      this.showToast(`Lỗi mở chi tiết: ${e.message}`, 'danger');
    }
  },

  renderTaskDetailModal(comments = null) {
    const task = this.state.currentDetailTask;
    if (!task) return;

    const user = this.state.user;
    const assignee = this.state.users.find(u => u.id === task.assignedTo);
    const isCompleted = task.status === 'completed';
    const isOverdue = !isCompleted && task.dueDate && new Date(task.dueDate) < new Date();

    document.getElementById('detailTaskId').innerText = `#${task.id}`;
    document.getElementById('detailTaskTitle').innerText = task.title;
    document.getElementById('detailTaskDesc').innerText = task.description || 'Không có mô tả chi tiết.';
    document.getElementById('detailTaskDept').innerText = task.department;
    document.getElementById('detailTaskAssignee').innerText = assignee ? `${assignee.avatar} ${assignee.name}` : 'Chưa phân công';
    document.getElementById('detailTaskDueDate').innerText = task.dueDate ? new Date(task.dueDate).toLocaleDateString('vi-VN') : 'Không có';
    document.getElementById('detailTaskDueDate').style.color = isOverdue ? 'var(--danger)' : 'inherit';

    const priorityBadge = document.getElementById('detailTaskPriority');
    const priorityLabels = { urgent: 'Khẩn cấp', high: 'Cao', medium: 'Trung bình', low: 'Thấp' };
    priorityBadge.className = `badge-priority ${task.priority}`;
    priorityBadge.innerText = priorityLabels[task.priority] || task.priority;

    // Status Select
    const statusSelect = document.getElementById('detailStatusSelect');
    if (statusSelect) statusSelect.value = task.status;

    // Progress Range
    const progressRange = document.getElementById('detailProgressRange');
    const progressVal = document.getElementById('detailProgressVal');
    if (progressRange) {
      progressRange.value = task.progress || 0;
      progressVal.innerText = `${task.progress || 0}%`;

      progressRange.oninput = (e) => {
        progressVal.innerText = `${e.target.value}%`;
      };

      progressRange.onchange = async (e) => {
        try {
          await API.updateTaskStatus(task.id, statusSelect.value, parseInt(e.target.value, 10));
        } catch (err) {
          this.showToast(`Lỗi cập nhật: ${err.message}`, 'danger');
        }
      };
    }

    if (statusSelect) {
      statusSelect.onchange = async (e) => {
        const nextStatus = e.target.value;
        const nextProgress = nextStatus === 'completed' ? 100 : task.progress;
        try {
          await API.updateTaskStatus(task.id, nextStatus, nextProgress);
        } catch (err) {
          this.showToast(`Lỗi: ${err.message}`, 'danger');
        }
      };
    }

    // Edit button for Admin or assignee
    const canEdit = user.role === 'admin' || user.id === task.assignedTo || user.id === task.createdBy;
    const editBtn = document.getElementById('detailEditTaskBtn');
    if (editBtn) {
      editBtn.style.display = canEdit ? 'inline-flex' : 'none';
      editBtn.onclick = () => {
        this.closeModal('taskDetailModal');
        this.openTaskModal(task);
      };
    }

    // Delete button for Admin only
    const deleteBtn = document.getElementById('detailDeleteTaskBtn');
    if (deleteBtn) {
      deleteBtn.style.display = user.role === 'admin' ? 'inline-flex' : 'none';
      deleteBtn.onclick = async () => {
        if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn công việc #${task.id}?`)) return;
        try {
          await API.deleteTask(task.id);
          this.closeModal('taskDetailModal');
          this.showToast(`Đã xóa công việc #${task.id}`, 'warning');
          this.renderView();
        } catch (err) {
          this.showToast(`Lỗi xóa: ${err.message}`, 'danger');
        }
      };
    }

    // Render Comments
    if (comments) {
      const commentList = document.getElementById('detailCommentList');
      if (comments.length === 0) {
        commentList.innerHTML = '<div style="color:var(--text-muted); font-size:12px; text-align:center; padding:10px;">Chưa có bình luận nào. Hãy bắt đầu trao đổi!</div>';
      } else {
        commentList.innerHTML = comments.map(c => this.createCommentHtml(c)).join('');
      }
    }
  },

  createCommentHtml(comment) {
    return `
      <div class="comment-item">
        <div class="comment-avatar">${comment.userAvatar || '👤'}</div>
        <div class="comment-bubble">
          <div class="comment-author">${this.escapeHtml(comment.userName)}</div>
          <div>${this.escapeHtml(comment.content)}</div>
          <div style="font-size:10px; color:var(--text-muted); margin-top:3px;">
            ${new Date(comment.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${new Date(comment.createdAt).toLocaleDateString('vi-VN')}
          </div>
        </div>
      </div>
    `;
  },

  appendCommentToModal(comment) {
    const commentList = document.getElementById('detailCommentList');
    if (commentList) {
      const emptyEl = commentList.querySelector('div[style*="text-align:center"]');
      if (emptyEl) emptyEl.remove();
      commentList.insertAdjacentHTML('beforeend', this.createCommentHtml(comment));
      commentList.scrollTop = commentList.scrollHeight;
    }
  },

  async handleCommentSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('commentInput');
    const content = input.value.trim();
    if (!content || !this.state.currentDetailTask) return;

    try {
      input.value = '';
      await API.addComment(this.state.currentDetailTask.id, content);
    } catch (err) {
      this.showToast(`Lỗi gửi bình luận: ${err.message}`, 'danger');
    }
  },

  // -------------------------------------------------------------
  // NOTIFICATIONS
  // -------------------------------------------------------------
  updateNotificationBadge() {
    const unread = this.state.notifications.filter(n => !n.read).length;
    const bubble = document.getElementById('notifBubble');
    if (bubble) {
      if (unread > 0) {
        bubble.innerText = unread > 99 ? '99+' : unread;
        bubble.style.display = 'flex';
      } else {
        bubble.style.display = 'none';
      }
    }
  },

  renderNotificationDropdown() {
    const listEl = document.getElementById('notifList');
    if (!listEl) return;

    const notifs = this.state.notifications;
    if (notifs.length === 0) {
      listEl.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:13px;">Không có thông báo nào</div>';
      return;
    }

    listEl.innerHTML = notifs.slice(0, 15).map(n => {
      const icon = n.level === 'danger' ? '🚨' : n.level === 'warning' ? '⏰' : '🔔';
      return `
        <div class="notif-item ${!n.read ? 'unread' : ''}" onclick="App.handleNotificationClick('${n.id}', '${n.taskId || ''}')">
          <div class="notif-icon">${icon}</div>
          <div class="notif-body">
            <div class="notif-title">${this.escapeHtml(n.title)}</div>
            <div class="notif-msg">${this.escapeHtml(n.message)}</div>
            <div class="notif-time">${new Date(n.createdAt).toLocaleTimeString('vi-VN')} - ${new Date(n.createdAt).toLocaleDateString('vi-VN')}</div>
          </div>
        </div>
      `;
    }).join('');
  },

  async handleNotificationClick(notifId, taskId) {
    try {
      await API.markNotificationRead(notifId);
      const notif = this.state.notifications.find(n => n.id === notifId);
      if (notif) notif.read = true;
      this.updateNotificationBadge();
      document.getElementById('notifDropdown')?.classList.remove('show');

      if (taskId) {
        this.openTaskDetail(taskId);
      }
    } catch (e) {
      console.error(e);
    }
  },

  async markAllNotificationsRead() {
    try {
      await API.markAllNotificationsRead();
      this.state.notifications.forEach(n => n.read = true);
      this.updateNotificationBadge();
      this.renderNotificationDropdown();
      this.showToast('Đã đánh dấu đọc tất cả thông báo', 'info');
    } catch (e) {
      console.error(e);
    }
  },

  // -------------------------------------------------------------
  // MODALS & TOAST UTILITIES
  // -------------------------------------------------------------
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('show');
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('show');
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = {
      success: '✅',
      warning: '⚠️',
      danger: '🚨',
      info: '🔔'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || '🔔'}</div>
      <div class="toast-content">
        <div class="toast-title">${type === 'danger' ? 'Cảnh Báo Khẩn Cấp' : type === 'warning' ? 'Lưu Ý Hạn Chót' : 'Thông Báo'}</div>
        <div class="toast-message">${this.escapeHtml(message)}</div>
      </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  },

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
