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
    clientVersion: '3.2.0',
    serverVersionInfo: null,
    hasNewUpdate: false,
    automations: [],
    automationHistory: [],
    calendarState: {
      currentDate: new Date(),
      mode: 'month' // 'day' | 'week' | 'month'
    },
    filters: {
      status: 'all',
      priority: 'all',
      department: 'all',
      assignedTo: 'all',
      search: ''
    },
    executiveDeskData: null,
    executiveRiskFilter: 'all',
    executiveSubTab: 'personnel',
    executiveTargetDept: 'all',
    executiveDeptChartInstance: null
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
      } else if (type === 'reminder' || type === 'calendar') {
        // Melodic calendar reminder chime: C5 -> G5 -> C6
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(783.99, now + 0.12);
        osc.frequency.setValueAtTime(1046.50, now + 0.24);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
        osc.start(now);
        osc.stop(now + 0.55);
      } else if (type === 'automation' || type === 'magic') {
        // High sparkling arpeggio chime
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.08); // A5
        osc.frequency.setValueAtTime(1174.66, now + 0.16); // D6
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.38);
        osc.start(now);
        osc.stop(now + 0.38);
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

    // Check version and updates from server
    this.checkAppUpdates(false);

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
        this.startCalendarReminderMonitor();
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
    // Check and display active pre-login VMG announcement poster if any
    this.checkAndShowPreLoginPoster();

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

  async logout() {
    try {
      await API.logout();
    } catch (e) {
      // Ignore network error on logout
    }
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

      case 'department:updated':
        this.showToast(`🏢 ${data.updatedBy} đã đổi tên phòng ban "${data.oldName}" thành "${data.department.name}"`, 'info');
        this.refreshDepartments();
        this.loadInitialData().then(() => this.renderView());
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

      case 'system:new_version_available':
        this.handleNewVersionEvent(data);
        break;

      case 'activity:new':
        if (data && data.activity) {
          this.handleNewActivityEvent(data.activity);
        }
        break;

      case 'calendar:reminder':
        this.handleCalendarReminderEvent(data);
        break;

      case 'automation:executed':
        this.handleAutomationExecutedEvent(data);
        break;

      case 'executive:rebalance_applied':
        if (this.state.activeView === 'executive-desk') {
          this.renderExecutiveDeskView();
        }
        break;

      case 'task:meet_updated':
        if (data && data.taskId) {
          const t = this.state.tasks.find(x => x.id === data.taskId);
          if (t) t.meetUrl = data.meetUrl;
          if (this.state.currentDetailTask && this.state.currentDetailTask.id === data.taskId) {
            this.state.currentDetailTask.meetUrl = data.meetUrl;
            this.renderTaskMeetSection(this.state.currentDetailTask);
          }
          if (this.state.activeView === 'kanban') {
            this.renderKanbanView();
          } else if (this.state.activeView === 'tasks') {
            this.renderTasksView();
          }
        }
        break;

      case 'executive:war_room_summon':
        this.handleExecutiveWarRoomSummon(data);
        break;

      case 'announcement:updated':
        if (data && data.poster) {
          this.state.currentPoster = data.poster;
          if (this.state.activeView === 'executive-desk' && this.state.executiveSubTab === 'poster') {
            this.initPosterCanvasGenerator();
          }
        }
        break;

      case 'automation:updated':
        this.loadAutomations().then(() => {
          if (this.state.activeView === 'automation') {
            this.renderAutomationView();
          }
        });
        break;
    }
  },

  async loadInitialData() {
    try {
      const [tasksRes, usersRes, notifsRes, deptsRes, autoRes] = await Promise.all([
        API.getTasks(),
        API.getUsers(),
        API.getNotifications(),
        API.getDepartments(),
        API.getAutomations().catch(() => ({ automations: [] }))
      ]);
      this.state.tasks = tasksRes.tasks || [];
      this.state.users = usersRes.users || [];
      this.state.notifications = notifsRes.notifications || [];
      this.state.departments = (deptsRes && deptsRes.departments) ? deptsRes.departments : [];
      this.state.automations = (autoRes && autoRes.automations) ? autoRes.automations : [];
      this.populateFilterDropdowns();
      this.populateDepartmentDropdowns();
      this.populateDemoUserDropdown();
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

    // Version & Updates Listeners
    const sidebarVersionBtn = document.getElementById('sidebarVersionBtn');
    if (sidebarVersionBtn) {
      sidebarVersionBtn.addEventListener('click', () => this.openVersionModal());
    }

    const btnHeaderVersion = document.getElementById('btnHeaderVersion');
    if (btnHeaderVersion) {
      btnHeaderVersion.addEventListener('click', () => this.openVersionModal());
    }

    const btnApplyUpdateNow = document.getElementById('btnApplyUpdateNow');
    if (btnApplyUpdateNow) {
      btnApplyUpdateNow.addEventListener('click', () => this.applyAppUpdate());
    }

    const btnDismissUpdateBanner = document.getElementById('btnDismissUpdateBanner');
    if (btnDismissUpdateBanner) {
      btnDismissUpdateBanner.addEventListener('click', () => this.dismissUpdateBanner());
    }

    const btnCheckUpdateManual = document.getElementById('btnCheckUpdateManual');
    if (btnCheckUpdateManual) {
      btnCheckUpdateManual.addEventListener('click', () => this.checkAppUpdates(true));
    }

    const btnForceReloadCache = document.getElementById('btnForceReloadCache');
    if (btnForceReloadCache) {
      btnForceReloadCache.addEventListener('click', () => this.applyAppUpdate());
    }

    const btnAdminBroadcastUpdate = document.getElementById('btnAdminBroadcastUpdate');
    if (btnAdminBroadcastUpdate) {
      btnAdminBroadcastUpdate.addEventListener('click', () => this.broadcastVersionUpdate());
    }

    // Activity Stream Listeners
    const actFilterRole = document.getElementById('actFilterRole');
    if (actFilterRole) {
      actFilterRole.addEventListener('change', () => this.renderActivitiesList());
    }

    const actFilterCat = document.getElementById('actFilterCat');
    if (actFilterCat) {
      actFilterCat.addEventListener('change', () => this.renderActivitiesList());
    }

    const actSearchInput = document.getElementById('actSearchInput');
    if (actSearchInput) {
      actSearchInput.addEventListener('input', () => this.renderActivitiesList());
    }

    const btnRefreshActivities = document.getElementById('btnRefreshActivities');
    if (btnRefreshActivities) {
      btnRefreshActivities.addEventListener('click', () => {
        this.renderActivitiesView();
        this.showToast('Đã làm mới nhật ký hoạt động!', 'info');
      });
    }

    // ========================================================
    // USER MANAGEMENT & DIRECT PERMISSIONS LISTENERS
    // ========================================================
    const userSearchInput = document.getElementById('userSearchInput');
    if (userSearchInput) {
      userSearchInput.addEventListener('input', () => this.renderUsersView());
    }

    const userFilterDept = document.getElementById('userFilterDept');
    if (userFilterDept) {
      userFilterDept.addEventListener('change', () => this.renderUsersView());
    }

    const userFilterRole = document.getElementById('userFilterRole');
    if (userFilterRole) {
      userFilterRole.addEventListener('change', () => this.renderUsersView());
    }

    const userFilterStatus = document.getElementById('userFilterStatus');
    if (userFilterStatus) {
      userFilterStatus.addEventListener('change', () => this.renderUsersView());
    }

    const btnRefreshUsers = document.getElementById('btnRefreshUsers');
    if (btnRefreshUsers) {
      btnRefreshUsers.addEventListener('click', () => {
        this.refreshUsersList();
        this.showToast('Đã làm mới danh sách nhân sự!', 'info');
      });
    }

    const quickPasswordForm = document.getElementById('quickPasswordForm');
    if (quickPasswordForm) {
      quickPasswordForm.addEventListener('submit', (e) => this.handleQuickResetPassSubmit(e));
    }

    const userFormRole = document.getElementById('userFormRole');
    if (userFormRole) {
      userFormRole.addEventListener('change', (e) => this.onRoleChangeInModal(e.target.value));
    }

    const btnResetDefaultPerms = document.getElementById('btnResetDefaultPerms');
    if (btnResetDefaultPerms) {
      btnResetDefaultPerms.addEventListener('click', () => this.resetModalPermissionsToDefault());
    }

    const userTableBody = document.getElementById('userTableBody');
    if (userTableBody) {
      userTableBody.addEventListener('change', (e) => {
        const roleSel = e.target.closest('[data-user-inline-role]');
        if (roleSel) {
          const userId = roleSel.getAttribute('data-user-inline-role');
          this.quickUpdateUserRole(userId, roleSel.value);
          return;
        }

        const deptSel = e.target.closest('[data-user-inline-dept]');
        if (deptSel) {
          const userId = deptSel.getAttribute('data-user-inline-dept');
          this.quickUpdateUserDept(userId, deptSel.value);
          return;
        }
      });

      userTableBody.addEventListener('click', (e) => {
        const toggleBtn = e.target.closest('[data-toggle-user-status]');
        if (toggleBtn) {
          const userId = toggleBtn.getAttribute('data-toggle-user-status');
          this.quickToggleUserStatus(userId);
          return;
        }

        const permBtn = e.target.closest('[data-open-perm]');
        if (permBtn) {
          const userId = permBtn.getAttribute('data-open-perm');
          this.openEditUserModal(userId);
          return;
        }

        const passBtn = e.target.closest('[data-quick-reset-pass]');
        if (passBtn) {
          const userId = passBtn.getAttribute('data-quick-reset-pass');
          this.openQuickResetPassModal(userId);
          return;
        }
      });
    }

    // Calendar Navigation & Modes Listeners
    const calBtnPrev = document.getElementById('calBtnPrev');
    if (calBtnPrev) {
      calBtnPrev.addEventListener('click', () => this.navigateCalendar(-1));
    }

    const calBtnToday = document.getElementById('calBtnToday');
    if (calBtnToday) {
      calBtnToday.addEventListener('click', () => this.navigateCalendarToday());
    }

    const calBtnNext = document.getElementById('calBtnNext');
    if (calBtnNext) {
      calBtnNext.addEventListener('click', () => this.navigateCalendar(1));
    }

    document.querySelectorAll('.cal-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-cal-mode');
        if (mode) this.switchCalendarMode(mode);
      });
    });

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
      btnSsoLogin.addEventListener('click', (e) => {
        e.preventDefault();
        this.openSsoModal();
      });
    }

    const btnSsoRegister = document.getElementById('btnSsoRegister');
    if (btnSsoRegister) {
      btnSsoRegister.addEventListener('click', (e) => {
        e.preventDefault();
        this.openSsoModal();
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

    // ========================================================
    // AUTOMATION CENTER LISTENERS
    // ========================================================
    const btnOpenCreateAutoModal = document.getElementById('btnOpenCreateAutoModal');
    if (btnOpenCreateAutoModal) {
      btnOpenCreateAutoModal.addEventListener('click', () => this.openAutomationModal());
    }

    const btnRunAllAutomations = document.getElementById('btnRunAllAutomations');
    if (btnRunAllAutomations) {
      btnRunAllAutomations.addEventListener('click', () => this.runAllAutomations());
    }

    const automationForm = document.getElementById('automationForm');
    if (automationForm) {
      automationForm.addEventListener('submit', (e) => this.handleAutomationFormSubmit(e));
    }

    const autoGrid = document.getElementById('automationRulesGrid');
    if (autoGrid) {
      // Toggle switches
      autoGrid.addEventListener('change', (e) => {
        const toggle = e.target.closest('[data-rule-toggle]');
        if (toggle) {
          const ruleId = toggle.getAttribute('data-rule-toggle');
          this.toggleAutomationRule(ruleId, toggle.checked);
        }
      });

      // Action buttons
      autoGrid.addEventListener('click', (e) => {
        const triggerBtn = e.target.closest('[data-trigger-rule]');
        if (triggerBtn) {
          const ruleId = triggerBtn.getAttribute('data-trigger-rule');
          this.triggerAutomationRule(ruleId);
          return;
        }

        const editBtn = e.target.closest('[data-edit-rule]');
        if (editBtn) {
          const ruleId = editBtn.getAttribute('data-edit-rule');
          const rule = (this.state.automations || []).find(r => r.id === ruleId);
          if (rule) this.openAutomationModal(rule);
          return;
        }

        const delBtn = e.target.closest('[data-delete-rule]');
        if (delBtn) {
          const ruleId = delBtn.getAttribute('data-delete-rule');
          this.deleteAutomationRule(ruleId);
          return;
        }
      });
    }
  },

  // -------------------------------------------------------------
  // VIEW SWITCHING
  // -------------------------------------------------------------
  switchView(viewName) {
    const user = this.state.user;
    if (user) {
      // 1. Quản Trị Hệ Thống guard: users, activities
      const isAdminOrHr = user.role === 'admin' || user.permissions?.canManageUsers;
      if ((viewName === 'users' || viewName === 'activities') && !isAdminOrHr) {
        this.showToast('Bạn không có quyền truy cập mục Quản Trị Hệ Thống!', 'danger');
        return;
      }

      // 2. Báo cáo hệ thống guard: reports
      const canView = user.role === 'admin' || (user.permissions && user.permissions.canViewReports === true);
      if (viewName === 'reports' && !canView) {
        this.showToast('Tài khoản Vai trò Member và Manager không được xem Báo cáo của hệ thống!', 'danger');
        return;
      }

      // 3. Bàn Làm Việc (Executive Desk) guard
      const canAccessExecutive = user.role === 'admin' || (user.permissions && user.permissions.canAccessExecutiveDesk === true);
      if (viewName === 'executive-desk' && !canAccessExecutive) {
        this.showToast('Bạn không có quyền truy cập Bàn Làm Việc (Chỉ dành cho Lãnh đạo cấp cao được phân quyền)!', 'danger');
        return;
      }
    }

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
      activities: '📜 Nhật Ký Hoạt Động',
      automation: '⚡ Tự Động Hóa (Automation)',
      'executive-desk': '💼 Bàn Làm Việc Điều Hành & Trợ Lý AI'
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
      case 'automation':
        this.renderAutomationView();
        break;
      case 'executive-desk':
        this.renderExecutiveDeskView();
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

    if (avatarEl) avatarEl.innerText = user.avatar || (user.role === 'admin' ? '👑' : (user.role === 'manager' ? '👔' : (user.role === 'viewer' ? '👁️' : '👤')));
    if (nameEl) nameEl.innerText = user.name;
    if (roleTagEl) {
      roleTagEl.className = `user-role-tag ${user.role}`;
      const roleLabels = {
        admin: 'QUẢN TRỊ VIÊN',
        manager: 'TRƯỞNG PHÒNG',
        user: 'NHÂN VIÊN',
        viewer: 'CHỈ XEM'
      };
      roleTagEl.innerText = roleLabels[user.role] || user.role.toUpperCase();
    }

    // Demo Switcher select option & dropdown population
    this.populateDemoUserDropdown();

    // Admin & Management Navigation section & items visibility (Quản Trị Hệ Thống)
    const isAdminOrHr = user.role === 'admin' || user.permissions?.canManageUsers;
    const adminTitleEl = document.getElementById('navSectionAdminTitle');
    const adminUsersNav = document.getElementById('adminUsersNavItem');
    const adminActivitiesNav = document.getElementById('adminActivitiesNavItem');

    if (adminTitleEl) adminTitleEl.style.display = isAdminOrHr ? 'block' : 'none';
    if (adminUsersNav) adminUsersNav.style.display = isAdminOrHr ? 'flex' : 'none';
    if (adminActivitiesNav) adminActivitiesNav.style.display = isAdminOrHr ? 'flex' : 'none';

    // Automation Navigation visibility
    const autoNav = document.getElementById('navItemAutomation');
    const autoTitle = document.getElementById('navSectionAutomationTitle');
    if (autoNav) {
      const canAuto = user.role === 'admin' || (user.permissions && user.permissions.canManageAutomation);
      autoNav.style.display = canAuto ? 'flex' : 'none';
      if (autoTitle) autoTitle.style.display = canAuto ? 'block' : 'none';
    }

    // Executive Desk Navigation visibility (Phân quyền cao cấp: canAccessExecutiveDesk)
    const execNav = document.getElementById('navItemExecutiveDesk');
    const execTitle = document.getElementById('navSectionExecutiveTitle');
    if (execNav) {
      const canAccessExecutive = user.role === 'admin' || (user.permissions && user.permissions.canAccessExecutiveDesk === true);
      execNav.style.display = canAccessExecutive ? 'flex' : 'none';
      if (execTitle) execTitle.style.display = canAccessExecutive ? 'block' : 'none';
    }

    // Reports Navigation visibility (Member & Manager không xem báo cáo hệ thống)
    const reportsNav = document.getElementById('sidebarNavReports') || document.querySelector('.nav-item[data-view="reports"]');
    if (reportsNav) {
      const canView = user.role === 'admin' || (user.permissions && user.permissions.canViewReports === true);
      reportsNav.style.display = canView ? 'flex' : 'none';
    }
  },

  populateDemoUserDropdown() {
    const demoSelect = document.getElementById('demoUserSelect');
    if (!demoSelect) return;

    const users = this.state.users || [];
    if (users.length === 0) return;

    const currentUser = this.state.user;
    const roleIcons = {
      admin: '👑',
      manager: '👔',
      user: '👤',
      viewer: '👁️'
    };
    const roleLabels = {
      admin: 'Admin',
      manager: 'Trưởng phòng',
      user: 'Nhân viên',
      viewer: 'Chỉ xem'
    };

    demoSelect.innerHTML = users.map(u => {
      const icon = roleIcons[u.role] || '👤';
      const rLabel = roleLabels[u.role] || u.role;
      const dept = u.department || 'N/A';
      return `<option value="${u.id}">${icon} ${u.name} (${rLabel} - ${dept})</option>`;
    }).join('');

    if (currentUser) {
      demoSelect.value = currentUser.id;
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

    // 5. User Management Filter Department dropdown
    const userFilterDept = document.getElementById('userFilterDept');
    if (userFilterDept) {
      const currentVal = userFilterDept.value;
      userFilterDept.innerHTML = '<option value="all">🏢 Tất cả phòng ban</option>' +
        depts.map(d => `<option value="${d}">${d}</option>`).join('');
      userFilterDept.value = currentVal || 'all';
    }
  },

  populateFilterDropdowns() {
    const user = this.state.user;
    const deptWrapper = document.getElementById('filterDeptWrapper');
    const assigneeWrapper = document.getElementById('filterAssigneeWrapper');
    const assigneeSelect = document.getElementById('filterAssignee');
    const taskAssigneeSelect = document.getElementById('taskFormAssignee');

    if (user && user.role === 'user') {
      // Nhân viên chỉ làm việc cá nhân -> ẩn thanh lọc phòng ban và người phụ trách
      if (deptWrapper) deptWrapper.style.display = 'none';
      if (assigneeWrapper) assigneeWrapper.style.display = 'none';
    } else if (user && user.role === 'manager') {
      // Trưởng phòng -> ẩn lọc phòng ban (cố định phòng mình), lọc nhân sự trực thuộc phòng
      if (deptWrapper) deptWrapper.style.display = 'none';
      if (assigneeWrapper) {
        assigneeWrapper.style.display = 'flex';
        if (assigneeSelect) {
          const deptUsers = (this.state.users || []).filter(u => u.department === user.department);
          const currentVal = assigneeSelect.value;
          assigneeSelect.innerHTML = '<option value="all">Tất cả nhân sự trong phòng</option>' +
            deptUsers.map(u => `<option value="${u.id}">${u.name} (${u.position || 'Thành viên'})</option>`).join('');
          assigneeSelect.value = currentVal || 'all';
        }
      }
    } else {
      // Admin hoặc Viewer: hiển thị đầy đủ
      if (deptWrapper) deptWrapper.style.display = 'flex';
      if (assigneeWrapper) {
        assigneeWrapper.style.display = 'flex';
        if (assigneeSelect) {
          const currentVal = assigneeSelect.value;
          assigneeSelect.innerHTML = '<option value="all">Tất cả người phụ trách</option>' +
            (this.state.users || []).map(u => `<option value="${u.id}">${u.name} (${u.role.toUpperCase()})</option>`).join('');
          assigneeSelect.value = currentVal || 'all';
        }
      }
    }

    if (taskAssigneeSelect) {
      taskAssigneeSelect.innerHTML = (this.state.users || []).map(u => 
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

    const isAdmin = !this.state.user || this.state.user.role === 'admin';

    container.innerHTML = depts.map(d => {
      const name = typeof d === 'string' ? d : d.name;
      const id = typeof d === 'string' ? d : d.id;
      const count = deptMemberCount[name] || 0;
      const isEditing = this.state.editingDeptId === id;

      if (isEditing) {
        return `
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:8px 12px; background:var(--bg-main); border:2px solid var(--primary); border-radius:var(--radius-sm); box-shadow:0 0 0 3px rgba(79, 70, 229, 0.15);">
            <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
              <span style="font-size:18px;">🏢</span>
              <input type="text" id="editDeptInput_${id}" class="form-control" value="${this.escapeHtml(name)}" style="font-size:13px; padding:6px 10px; height:auto; width:100%;" placeholder="Nhập tên phòng ban mới..." onkeydown="if(event.key==='Enter'){event.preventDefault(); App.saveEditDepartment('${id}', '${this.escapeHtml(name)}');} if(event.key==='Escape'){event.preventDefault(); App.cancelEditDepartment();}">
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
              <button type="button" class="btn btn-primary btn-sm" onclick="App.saveEditDepartment('${id}', '${this.escapeHtml(name)}')" style="padding:6px 11px; font-size:11.5px; white-space:nowrap;">
                💾 Lưu
              </button>
              <button type="button" class="btn btn-outline btn-sm" onclick="App.cancelEditDepartment()" style="padding:6px 9px; font-size:11.5px; white-space:nowrap;">
                ✕ Hủy
              </button>
            </div>
          </div>
        `;
      }

      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--bg-main); border:1px solid var(--border-color); border-radius:var(--radius-sm); transition:all 0.2s;">
          <div style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">
            <span style="font-size:20px; flex-shrink:0;">🏢</span>
            <div style="min-width:0;">
              <strong style="font-size:13.5px; color:var(--text-primary); display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${this.escapeHtml(name)}</strong>
              <span style="font-size:11.5px; color:var(--text-secondary);">${count} thành viên</span>
            </div>
          </div>
          <div style="display:flex; gap:6px; flex-shrink:0;">
            ${isAdmin ? `
              <button type="button" class="btn btn-outline btn-sm" onclick="App.startEditDepartment('${id}')" style="color:var(--primary); border-color:#c7d2fe; padding:4px 8px; font-size:11.5px;" title="Chỉnh sửa tên phòng ban">
                ✏️ Sửa
              </button>
              <button type="button" class="btn btn-outline btn-sm" onclick="App.deleteDepartment('${id}', '${this.escapeHtml(name)}', ${count})" style="color:var(--danger); border-color:#fca5a5; padding:4px 8px; font-size:11.5px;" title="Xóa phòng ban này">
                🗑️ Xóa
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  },

  startEditDepartment(id) {
    this.state.editingDeptId = id;
    this.renderDepartmentList();
    setTimeout(() => {
      const inp = document.getElementById(`editDeptInput_${id}`);
      if (inp) {
        inp.focus();
        inp.select();
      }
    }, 50);
  },

  cancelEditDepartment() {
    this.state.editingDeptId = null;
    this.renderDepartmentList();
  },

  async saveEditDepartment(id, oldName) {
    const inp = document.getElementById(`editDeptInput_${id}`);
    if (!inp) return;
    const newName = inp.value.trim();
    if (!newName) {
      this.showToast('Tên phòng ban không được để trống!', 'warning');
      return;
    }
    if (newName === oldName) {
      this.cancelEditDepartment();
      return;
    }

    try {
      const res = await API.updateDepartment(id, newName);
      this.state.editingDeptId = null;
      this.showToast(`✅ Đã đổi tên phòng ban thành "${res.department.name}" thành công!`, 'success');
      this.playSound('success');
      await this.refreshDepartments();
      await this.loadInitialData();
      this.renderDepartmentList();
      this.renderView();
    } catch (err) {
      this.showToast(`Lỗi điều chỉnh: ${err.message}`, 'danger');
      this.playSound('danger');
    }
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

  getRoleScopedTasks() {
    const user = this.state.user;
    const all = this.state.tasks || [];
    if (!user) return all;

    if (user.role === 'user') {
      // Nhân viên: CHỈ hiển thị và đo lường công việc cá nhân của mình
      return all.filter(t => t.assignedTo === user.id || t.createdBy === user.id);
    } else if (user.role === 'manager') {
      // Trưởng phòng: CHỈ hiển thị và đo lường công việc thuộc phòng ban mình phụ trách
      return all.filter(t => t.department === user.department);
    }
    // Admin và Viewer: toàn bộ công việc hệ thống
    return all;
  },

  getFilteredTasks() {
    const { status, priority, department, assignedTo, search } = this.state.filters;
    let list = this.getRoleScopedTasks();

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
  // KPI METRICS (ROLE-BASED SCOPED)
  // -------------------------------------------------------------
  renderKPIs() {
    const user = this.state.user;
    const tasks = this.getRoleScopedTasks();
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

    // Update label dynamically based on role
    const totalLabelEl = document.getElementById('kpiTotalTasksLabel');
    if (totalLabelEl) {
      if (user && user.role === 'user') {
        totalLabelEl.innerHTML = '<span class="hide-mobile">Việc </span>của tôi';
      } else if (user && user.role === 'manager') {
        totalLabelEl.innerHTML = `<span class="hide-mobile">Việc </span>phòng ${user.department || ''}`;
      } else {
        totalLabelEl.innerHTML = '<span class="hide-mobile">Tổng số </span>công việc';
      }
    }

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
          <div style="display:flex; align-items:center; gap:6px;">
            ${task.meetUrl ? `
              <a href="${this.escapeHtml(task.meetUrl)}" target="_blank" onclick="event.stopPropagation();" class="task-card-meet-btn" title="Vào họp Google Meet ngay: ${this.escapeHtml(task.meetUrl)}">
                <span class="meet-pulse-dot"></span> 📹 Meet
              </a>
            ` : ''}
            <span class="badge-priority ${task.priority}">${priorityLabels[task.priority] || task.priority}</span>
          </div>
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
  // CALENDAR / TIMELINE VIEW (DAY, WEEK, MONTH MODES)
  // -------------------------------------------------------------
  renderCalendarView() {
    this.renderActiveCalendarMode();
  },

  renderActiveCalendarMode() {
    const container = document.getElementById('calendarViewBody');
    const titleEl = document.getElementById('calDateDisplay');
    if (!container) return;

    if (!this.state.calendarState) {
      this.state.calendarState = { currentDate: new Date(), mode: 'month' };
    }

    const { currentDate, mode } = this.state.calendarState;

    // Update active button state
    document.querySelectorAll('.cal-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-cal-mode') === mode);
    });

    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

    // Update navigation title based on active mode
    if (titleEl) {
      if (mode === 'month') {
        titleEl.innerText = `Tháng ${currentDate.getMonth() + 1}, ${currentDate.getFullYear()}`;
      } else if (mode === 'week') {
        const weekDays = this.getWeekDays(currentDate);
        const start = weekDays[0];
        const end = weekDays[6];
        const startStr = `${start.getDate()}/${start.getMonth() + 1}`;
        const endStr = `${end.getDate()}/${end.getMonth() + 1}/${end.getFullYear()}`;
        titleEl.innerText = `Tuần: ${startStr} - ${endStr}`;
      } else if (mode === 'day') {
        const dayName = dayNames[currentDate.getDay()];
        const dateStr = `${currentDate.getDate()} Tháng ${currentDate.getMonth() + 1}, ${currentDate.getFullYear()}`;
        titleEl.innerText = `${dayName}, ${dateStr}`;
      }
    }

    if (mode === 'month') {
      this.renderMonthCalendar(container, currentDate);
    } else if (mode === 'week') {
      this.renderWeekCalendar(container, currentDate);
    } else if (mode === 'day') {
      this.renderDayCalendar(container, currentDate);
    }
  },

  navigateCalendar(direction) {
    if (!this.state.calendarState) {
      this.state.calendarState = { currentDate: new Date(), mode: 'month' };
    }
    const { currentDate, mode } = this.state.calendarState;

    if (mode === 'month') {
      currentDate.setMonth(currentDate.getMonth() + direction);
    } else if (mode === 'week') {
      currentDate.setDate(currentDate.getDate() + (direction * 7));
    } else if (mode === 'day') {
      currentDate.setDate(currentDate.getDate() + direction);
    }

    this.renderActiveCalendarMode();
  },

  navigateCalendarToday() {
    if (!this.state.calendarState) {
      this.state.calendarState = { currentDate: new Date(), mode: 'month' };
    }
    this.state.calendarState.currentDate = new Date();
    this.renderActiveCalendarMode();
  },

  switchCalendarMode(mode) {
    if (!this.state.calendarState) {
      this.state.calendarState = { currentDate: new Date(), mode: 'month' };
    }
    this.state.calendarState.mode = mode;
    this.renderActiveCalendarMode();
  },

  switchCalendarToDate(date) {
    if (!this.state.calendarState) {
      this.state.calendarState = { currentDate: new Date(), mode: 'month' };
    }
    this.state.calendarState.currentDate = new Date(date);
    this.state.calendarState.mode = 'day';
    this.renderActiveCalendarMode();
  },

  toLocalDateKey(dateObjOrString) {
    if (!dateObjOrString) return '';
    const d = new Date(dateObjOrString);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  getWeekDays(baseDate) {
    const d = new Date(baseDate);
    const dayOfWeek = (d.getDay() + 6) % 7; // Monday as 0, Sunday as 6
    const monday = new Date(d);
    monday.setDate(d.getDate() - dayOfWeek);
    monday.setHours(0, 0, 0, 0);

    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const nextDay = new Date(monday);
      nextDay.setDate(monday.getDate() + i);
      weekDays.push(nextDay);
    }
    return weekDays;
  },

  // --- MONTH VIEW ---
  renderMonthCalendar(container, currentDate) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const firstDayIndex = (firstDay.getDay() + 6) % 7; // Mon = 0
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const todayKey = this.toLocalDateKey(new Date());

    // Map tasks by local date key
    const tasksByDate = {};
    (this.state.tasks || []).forEach(t => {
      if (!t.dueDate) return;
      const key = this.toLocalDateKey(t.dueDate);
      if (!tasksByDate[key]) tasksByDate[key] = [];
      tasksByDate[key].push(t);
    });

    const weekdayHeaders = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
    let gridHtml = '<div class="cal-month-grid">';

    // 1. Weekday headers
    weekdayHeaders.forEach((name, idx) => {
      const isWeekend = idx >= 5;
      gridHtml += `<div class="cal-month-weekday-header ${isWeekend ? 'weekend' : ''}">${name}</div>`;
    });

    // 2. Previous month trailing days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const cellDate = new Date(year, month - 1, dayNum);
      const cellKey = this.toLocalDateKey(cellDate);
      const cellTasks = tasksByDate[cellKey] || [];
      gridHtml += this.buildMonthCellHtml(dayNum, cellDate, cellTasks, true, cellKey === todayKey);
    }

    // 3. Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const cellDate = new Date(year, month, d);
      const cellKey = this.toLocalDateKey(cellDate);
      const cellTasks = tasksByDate[cellKey] || [];
      gridHtml += this.buildMonthCellHtml(d, cellDate, cellTasks, false, cellKey === todayKey);
    }

    // 4. Next month leading days (to complete 35 or 42 cells)
    const totalRendered = firstDayIndex + totalDaysInMonth;
    const nextDaysNeeded = (totalRendered % 7 === 0) ? 0 : 7 - (totalRendered % 7);
    for (let n = 1; n <= nextDaysNeeded; n++) {
      const cellDate = new Date(year, month + 1, n);
      const cellKey = this.toLocalDateKey(cellDate);
      const cellTasks = tasksByDate[cellKey] || [];
      gridHtml += this.buildMonthCellHtml(n, cellDate, cellTasks, true, cellKey === todayKey);
    }

    gridHtml += '</div>';
    container.innerHTML = gridHtml;

    // Attach listeners
    container.querySelectorAll('.cal-month-cell').forEach(cell => {
      cell.addEventListener('click', (e) => {
        // If clicking a task chip, detail is already handled
        if (e.target.closest('.cal-task-chip')) return;
        const dateStr = cell.getAttribute('data-cell-date');
        if (dateStr) {
          this.switchCalendarToDate(dateStr);
        }
      });
    });

    container.querySelectorAll('.cal-task-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskId = chip.getAttribute('data-task-id');
        if (taskId) this.openTaskDetail(taskId);
      });
    });
  },

  buildMonthCellHtml(dayNum, cellDate, tasks, isOtherMonth, isToday) {
    const dateKey = this.toLocalDateKey(cellDate);
    const maxVisible = 2;
    const visibleTasks = tasks.slice(0, maxVisible);
    const extraCount = tasks.length - maxVisible;

    let tasksHtml = '';
    visibleTasks.forEach(t => {
      tasksHtml += `
        <div class="cal-task-chip status-${this.escapeHtml(t.status)}" data-task-id="${this.escapeHtml(t.id)}" title="${this.escapeHtml(t.id)}: ${this.escapeHtml(t.title)} (${t.progress}%)">
          <span class="cal-chip-dot ${this.escapeHtml(t.priority)}"></span>
          <span class="cal-chip-text">#${this.escapeHtml(t.id)} ${this.escapeHtml(t.title)}</span>
        </div>
      `;
    });

    if (extraCount > 0) {
      tasksHtml += `
        <div class="cal-more-link" title="Xem thêm ${extraCount} công việc">
          +${extraCount} việc khác
        </div>
      `;
    }

    return `
      <div class="cal-month-cell ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'is-today' : ''}" data-cell-date="${dateKey}">
        <div class="cal-cell-header">
          <span class="cal-day-num">${dayNum}</span>
          ${tasks.length > 0 ? `<span class="cal-cell-badge">${tasks.length}</span>` : ''}
        </div>
        <div class="cal-cell-tasks-wrap">
          ${tasksHtml}
        </div>
      </div>
    `;
  },

  // --- WEEK VIEW ---
  renderWeekCalendar(container, currentDate) {
    const weekDays = this.getWeekDays(currentDate);
    const todayKey = this.toLocalDateKey(new Date());

    const weekdayNames = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];

    const tasksByDate = {};
    (this.state.tasks || []).forEach(t => {
      if (!t.dueDate) return;
      const key = this.toLocalDateKey(t.dueDate);
      if (!tasksByDate[key]) tasksByDate[key] = [];
      tasksByDate[key].push(t);
    });

    let weekHtml = '<div class="cal-week-grid">';

    weekDays.forEach((day, idx) => {
      const dayKey = this.toLocalDateKey(day);
      const isToday = dayKey === todayKey;
      const dayTasks = tasksByDate[dayKey] || [];
      const dateDisplay = `${day.getDate()}/${day.getMonth() + 1}`;

      weekHtml += `
        <div class="cal-week-col ${isToday ? 'is-today' : ''}">
          <div class="cal-week-header">
            <div class="cal-week-day-title">
              <span class="cal-week-dayname">${weekdayNames[idx]} ${isToday ? '⭐' : ''}</span>
              <span class="cal-week-date">${dateDisplay}</span>
            </div>
            <span class="cal-week-badge">${dayTasks.length} việc</span>
          </div>
          <div class="cal-week-tasks-list">
            ${dayTasks.length === 0 ? `
              <div class="cal-week-empty">
                <div>✨ Không có hạn chót</div>
              </div>
            ` : dayTasks.map(t => this.buildWeekTaskCardHtml(t)).join('')}
          </div>
        </div>
      `;
    });

    weekHtml += '</div>';
    container.innerHTML = weekHtml;

    // Attach listeners
    container.querySelectorAll('.cal-week-task-card').forEach(card => {
      card.addEventListener('click', () => {
        const taskId = card.getAttribute('data-task-id');
        if (taskId) this.openTaskDetail(taskId);
      });
    });
  },

  buildWeekTaskCardHtml(task) {
    const statusMap = { todo: 'Cần làm', in_progress: 'Đang làm', review: 'Chờ duyệt', completed: 'Hoàn thành' };
    const priorityLabels = { urgent: 'Khẩn cấp', high: 'Cao', medium: 'Trung bình', low: 'Thấp' };
    const isCompleted = task.status === 'completed';
    const now = new Date();
    const isOverdue = !isCompleted && task.dueDate && new Date(task.dueDate) < now;

    return `
      <div class="cal-week-task-card" data-task-id="${this.escapeHtml(task.id)}">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span style="font-size:11px; font-weight:800; color:var(--primary);">#${this.escapeHtml(task.id)}</span>
          <span class="priority-tag ${this.escapeHtml(task.priority)}" style="font-size:10px; padding:1px 6px;">
            ${priorityLabels[task.priority] || task.priority}
          </span>
        </div>
        <div style="font-size:12px; font-weight:700; color:var(--text-primary); margin-bottom:6px; line-height:1.4;">
          ${this.escapeHtml(task.title)}
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:var(--text-secondary);">
          <span style="display:inline-flex; align-items:center; gap:4px;">
            <span class="status-dot status-${this.escapeHtml(task.status)}" style="width:6px; height:6px;"></span>
            ${statusMap[task.status] || task.status}
          </span>
          <span style="font-weight:700; color:${isOverdue ? 'var(--danger)' : 'var(--text-muted)'};">
            ${isOverdue ? '🚨 Quá hạn' : `${task.progress}%`}
          </span>
        </div>
      </div>
    `;
  },

  // --- DAY VIEW ---
  renderDayCalendar(container, currentDate) {
    const dateKey = this.toLocalDateKey(currentDate);
    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = dayNames[currentDate.getDay()];
    const fullDateStr = `${currentDate.getDate()} Tháng ${currentDate.getMonth() + 1}, ${currentDate.getFullYear()}`;

    const tasks = this.state.tasks || [];
    const now = new Date();

    // Tasks due on this day
    const dueTodayTasks = tasks.filter(t => t.dueDate && this.toLocalDateKey(t.dueDate) === dateKey);

    // Overdue tasks (active and due before today)
    const overdueTasks = tasks.filter(t => {
      if (t.status === 'completed' || !t.dueDate) return false;
      const tKey = this.toLocalDateKey(t.dueDate);
      return tKey < dateKey;
    });

    // In progress tasks
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress' && (!t.dueDate || this.toLocalDateKey(t.dueDate) !== dateKey));

    // Stats
    const totalDue = dueTodayTasks.length;
    const completedCount = dueTodayTasks.filter(t => t.status === 'completed').length;
    const inProgCount = dueTodayTasks.filter(t => t.status === 'in_progress').length;
    const reviewCount = dueTodayTasks.filter(t => t.status === 'review').length;

    let dayHtml = `
      <div class="cal-day-container">
        <!-- Hero Header Card -->
        <div class="cal-day-hero">
          <div class="cal-day-hero-info">
            <h3>☀️ ${dayName}, ${fullDateStr}</h3>
            <p>Tổng quan tiến độ và danh sách hạn chót công việc cần xử lý trong ngày</p>
          </div>
          <div class="cal-day-stats-chips">
            <div class="cal-day-chip" title="Tổng việc đến hạn ngày này">
              <span>📋 Đến hạn:</span> <strong>${totalDue}</strong>
            </div>
            <div class="cal-day-chip" title="Đang làm" style="color:#2563eb;">
              <span>⚡ Đang làm:</span> <strong>${inProgCount}</strong>
            </div>
            <div class="cal-day-chip" title="Chờ duyệt" style="color:#d97706;">
              <span>⏳ Chờ duyệt:</span> <strong>${reviewCount}</strong>
            </div>
            <div class="cal-day-chip" title="Đã hoàn thành" style="color:#059669;">
              <span>✅ Đã xong:</span> <strong>${completedCount}</strong>
            </div>
          </div>
        </div>
    `;

    // Section 1: Due Today
    dayHtml += `
      <div class="cal-day-section">
        <div class="cal-day-section-title">
          <span>⏰ Hạn Chót Trong Ngày (${dueTodayTasks.length})</span>
        </div>
        ${dueTodayTasks.length === 0 ? `
          <div style="background:var(--bg-card); border:1px dashed var(--border-color); border-radius:8px; padding:24px; text-align:center; color:var(--text-secondary);">
            <div style="font-size:28px; margin-bottom:6px;">🌴</div>
            <div style="font-weight:700; margin-bottom:2px;">Không có hạn chót nào trong ngày này</div>
            <div style="font-size:12px; color:var(--text-muted); margin-bottom:12px;">Mọi tiến độ công việc đang được kiểm soát tốt.</div>
            <button class="btn btn-outline btn-sm" onclick="App.openTaskModalWithDate('${dateKey}')">
              + Thêm Việc Cho Ngày Này
            </button>
          </div>
        ` : `
          <div class="cal-day-tasks-grid">
            ${dueTodayTasks.map(t => this.createTaskCardHtml(t)).join('')}
          </div>
        `}
      </div>
    `;

    // Section 2: Overdue (if any)
    if (overdueTasks.length > 0) {
      dayHtml += `
        <div class="cal-day-section" style="margin-top:12px;">
          <div class="cal-day-section-title" style="color:var(--danger);">
            <span>🚨 Danh Sách Việc Đã Quá Hạn Cần Ưu Tiên (${overdueTasks.length})</span>
          </div>
          <div class="cal-day-tasks-grid">
            ${overdueTasks.map(t => this.createTaskCardHtml(t)).join('')}
          </div>
        </div>
      `;
    }

    // Section 3: Other Active Tasks
    if (inProgressTasks.length > 0) {
      dayHtml += `
        <div class="cal-day-section" style="margin-top:12px;">
          <div class="cal-day-section-title" style="color:#2563eb;">
            <span>🔄 Công Việc Đang Triển Khai Song Song (${inProgressTasks.length})</span>
          </div>
          <div class="cal-day-tasks-grid">
            ${inProgressTasks.slice(0, 6).map(t => this.createTaskCardHtml(t)).join('')}
          </div>
        </div>
      `;
    }

    dayHtml += '</div>';
    container.innerHTML = dayHtml;

    // Attach card click listeners
    container.querySelectorAll('.task-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.card-action-btn')) return;
        const taskId = card.getAttribute('data-task-id');
        if (taskId) this.openTaskDetail(taskId);
      });
    });
  },

  openTaskModalWithDate(dateStr) {
    this.openTaskModal();
    const dateInput = document.getElementById('taskFormDueDate');
    if (dateInput && dateStr) {
      dateInput.value = dateStr;
    }
  },

  // -------------------------------------------------------------
  // ALERTS CENTER VIEW (ROLE-SCOPED)
  // -------------------------------------------------------------
  renderAlertsView() {
    const tasks = this.getRoleScopedTasks();
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
  // REPORTS & ANALYTICS VIEW (ROLE-BASED INTELLIGENCE)
  // -------------------------------------------------------------
  async renderReportsView(dept = null) {
    const accessDeniedEl = document.getElementById('reportAccessDenied');
    const mainContentEl = document.getElementById('reportMainContent');

    // 1. Guard check on user permission (Member & Manager không xem báo cáo hệ thống)
    const currentUser = this.state.user;
    const canView = currentUser && (currentUser.role === 'admin' || (currentUser.permissions && currentUser.permissions.canViewReports === true));
    if (!canView) {
      if (accessDeniedEl) accessDeniedEl.style.display = 'block';
      if (mainContentEl) mainContentEl.style.display = 'none';
      return;
    }

    if (accessDeniedEl) accessDeniedEl.style.display = 'none';
    if (mainContentEl) mainContentEl.style.display = 'block';

    try {
      // Determine department query if admin selected one
      const deptFilter = document.getElementById('reportDeptFilter');
      const selectedDept = dept !== null ? dept : (deptFilter ? deptFilter.value : '');

      const summary = await API.getReportsSummary(selectedDept !== 'all' ? selectedDept : '');

      // 2. Populate Scope Header
      const roleBadge = document.getElementById('reportRoleBadge');
      const scopeDeptText = document.getElementById('reportScopeDeptText');
      const scopeTitle = document.getElementById('reportScopeTitle');
      const scopeDesc = document.getElementById('reportScopeDesc');
      const deptFilterWrap = document.getElementById('reportDeptFilterWrap');
      const btnExportCsv = document.getElementById('btnExportReportCsv');

      if (roleBadge) {
        roleBadge.className = `report-scope-badge ${summary.userRole || 'user'}`;
        const roleNames = {
          admin: '👑 QUẢN TRỊ VIÊN',
          manager: '👔 TRƯỞNG PHÒNG',
          user: '👤 NHÂN VIÊN',
          viewer: '👁️ CHỈ XEM'
        };
        roleBadge.innerText = roleNames[summary.userRole] || summary.userRole.toUpperCase();
      }

      if (scopeDeptText) {
        scopeDeptText.innerText = summary.scope === 'admin' 
          ? (summary.targetDept ? summary.targetDept : 'Toàn Doanh Nghiệp (16 Phòng Ban)')
          : (summary.userDepartment || 'Bộ Phận');
      }

      if (scopeTitle) scopeTitle.innerText = summary.scopeTitle || 'Biểu Đồ Phân Tích & Báo Cáo';
      if (scopeDesc) scopeDesc.innerText = summary.scopeDesc || 'Hệ thống báo cáo chỉ số KPI & tiến độ';

      // Show department filter only for Admin
      if (deptFilterWrap) {
        deptFilterWrap.style.display = summary.scope === 'admin' ? 'flex' : 'none';
        if (summary.scope === 'admin' && deptFilter && deptFilter.options.length <= 1) {
          const depts = (this.state.departments && this.state.departments.length > 0)
            ? this.state.departments.map(d => typeof d === 'string' ? d : d.name)
            : [];
          deptFilter.innerHTML = '<option value="all">🏢 Tất cả 16 phòng ban</option>' + 
            depts.map(d => `<option value="${d}">${d}</option>`).join('');
          if (selectedDept) deptFilter.value = selectedDept;

          deptFilter.onchange = (e) => this.renderReportsView(e.target.value);
        }
      }

      // Handle Export CSV button visibility & state
      if (btnExportCsv) {
        if (summary.canExportCsv === false || summary.userRole === 'viewer') {
          btnExportCsv.style.display = 'none';
        } else {
          btnExportCsv.style.display = 'inline-flex';
        }
      }

      // 3. Populate 6 KPI Cards
      const kpis = summary.kpis || {};
      const elTotal = document.getElementById('rptKpiTotal');
      const elCompleted = document.getElementById('rptKpiCompleted');
      const elInProgress = document.getElementById('rptKpiInProgress');
      const elReview = document.getElementById('rptKpiReview');
      const elOverdue = document.getElementById('rptKpiOverdue');
      const elScore = document.getElementById('rptKpiScore');
      const elRate = document.getElementById('rptKpiRate');
      const elFill = document.getElementById('rptKpiProgressFill');

      if (elTotal) elTotal.innerText = kpis.total || 0;
      if (elCompleted) elCompleted.innerText = kpis.completed || 0;
      if (elInProgress) elInProgress.innerText = kpis.inProgress || 0;
      if (elReview) elReview.innerText = (kpis.review || 0) + (kpis.todo || 0);
      if (elOverdue) elOverdue.innerText = kpis.overdue || 0;
      if (elScore) elScore.innerText = `${kpis.completionRate || 0}%`;
      if (elRate) elRate.innerText = `${kpis.completionRate || 0}%`;
      if (elFill) elFill.style.width = `${kpis.completionRate || 0}%`;

      // Update Subtitles based on scope
      const subTotal = document.getElementById('rptKpiTotalSub');
      const subProgress = document.getElementById('rptKpiInProgressSub');
      const subReview = document.getElementById('rptKpiReviewSub');
      const subOverdue = document.getElementById('rptKpiOverdueSub');

      if (summary.scope === 'personal') {
        if (subTotal) subTotal.innerText = 'Nhiệm vụ cá nhân được giao';
        if (subProgress) subProgress.innerText = 'Đang trực tiếp xử lý';
        if (subReview) subReview.innerText = 'Chờ quản lý duyệt hoặc cần làm';
        if (subOverdue) subOverdue.innerText = (kpis.overdue > 0 ? `🚨 Bạn có ${kpis.overdue} việc trễ hạn!` : '✅ Không có việc trễ hạn');
      } else if (summary.scope === 'manager') {
        if (subTotal) subTotal.innerText = `Nhiệm vụ của phòng ${summary.userDepartment}`;
        if (subProgress) subProgress.innerText = 'Nhân sự phòng đang xử lý';
        if (subReview) subReview.innerText = 'Cần bạn kiểm tra & nghiệm thu';
        if (subOverdue) subOverdue.innerText = (kpis.overdue > 0 ? `Cảnh báo ${kpis.overdue} việc trễ của phòng` : 'Tiến độ phòng đạt chuẩn');
      } else {
        if (subTotal) subTotal.innerText = 'Phạm vi toàn doanh nghiệp';
        if (subProgress) subProgress.innerText = 'Khối lượng đang thực hiện';
        if (subReview) subReview.innerText = 'Chờ nghiệm thu & bàn giao';
        if (subOverdue) subOverdue.innerText = (kpis.overdue > 0 ? `Tổng cộng ${kpis.overdue} việc trễ hạn` : 'Tiến độ toàn hệ thống tốt');
      }

      // 4. Update Chart Titles Dynamically
      const titleStatus = document.getElementById('chartStatusTitle');
      const titleDept = document.getElementById('chartDeptTitle');
      const titleTrend = document.getElementById('chartTrendTitle');
      const titleMember = document.getElementById('chartMemberTitle');

      if (summary.scope === 'personal') {
        if (titleStatus) titleStatus.innerText = '🥧 Trạng Thái Nhiệm Vụ Của Bạn';
        if (titleDept) titleDept.innerText = '🎯 Mức Độ Ưu Tiên Công Việc Của Bạn';
        if (titleTrend) titleTrend.innerText = '📈 Xu Hướng Hoàn Thành 7 Ngày Của Bạn';
        if (titleMember) titleMember.innerText = '📊 Phân Bổ Tiến Độ Nhiệm Vụ Cá Nhân';
      } else if (summary.scope === 'manager') {
        if (titleStatus) titleStatus.innerText = `🥧 Trạng Thái Việc Phòng ${summary.userDepartment}`;
        if (titleDept) titleDept.innerText = `🎯 Mức Độ Ưu Tiên Trong Phòng Ban`;
        if (titleTrend) titleTrend.innerText = `📈 Xu Hướng Tiến Độ 7 Ngày (${summary.userDepartment})`;
        if (titleMember) titleMember.innerText = `👥 So Sánh Hiệu Suất Nhân Sự Phòng ${summary.userDepartment}`;
      } else if (summary.scope === 'viewer') {
        if (titleStatus) titleStatus.innerText = '🥧 Cơ Cấu Trạng Thái Toàn Hệ Thống';
        if (titleDept) titleDept.innerText = '🏢 Khối Lượng Theo Phòng Ban';
        if (titleTrend) titleTrend.innerText = '📈 Xu Hướng Hoàn Thành 7 Ngày';
        if (titleMember) titleMember.innerText = '📊 Tỷ Lệ Hoàn Thành Theo Phòng Ban';
      } else {
        // Admin
        if (titleStatus) titleStatus.innerText = '🥧 Cơ Cấu Trạng Thái Toàn Doanh Nghiệp';
        if (titleDept) titleDept.innerText = '🏢 Khối Lượng Theo 16 Phòng Ban';
        if (titleTrend) titleTrend.innerText = '📈 Xu Hướng Giao Việc & Hoàn Thành 7 Ngày';
        if (titleMember) titleMember.innerText = '👥 Hiệu Suất & Tải Việc Nhân Sự';
      }

      // 5. Render Charts
      TaskCharts.renderReports(summary);

      // 6. Render Adaptive Table
      this.renderAdaptiveReportTable(summary);

    } catch (err) {
      console.error('Failed to render reports', err);
      if (err.message && (err.message.includes('403') || err.message.includes('quyền'))) {
        if (accessDeniedEl) accessDeniedEl.style.display = 'block';
        if (mainContentEl) mainContentEl.style.display = 'none';
      } else {
        this.showToast(`Lỗi tải báo cáo: ${err.message}`, 'danger');
      }
    }
  },

  renderAdaptiveReportTable(summary) {
    const tableTitleEl = document.getElementById('reportTableCardTitle');
    const thead = document.getElementById('reportTableHead');
    const tbody = document.getElementById('reportTableBody');

    if (!thead || !tbody) return;

    if (summary.scope === 'personal') {
      // PERSONAL TASKS TABLE
      const tasks = summary.personalTasks || [];
      if (tableTitleEl) {
        tableTitleEl.innerHTML = `📋 Danh Sách Nhiệm Vụ Trọng Tâm Của Bạn <span style="font-size:12px; font-weight:normal; color:var(--text-muted);">(${tasks.length} công việc được giao)</span>`;
      }

      thead.innerHTML = `
        <tr>
          <th style="width:36%;">Nhiệm Vụ Cần Xử Lý</th>
          <th style="width:16%;">Hạn Chót</th>
          <th style="width:14%;">Mức Độ Ưu Tiên</th>
          <th style="width:14%;">Trạng Thái</th>
          <th style="width:12%;">Tiến Độ</th>
          <th style="width:8%; text-align:right;">Thao Tác</th>
        </tr>
      `;

      if (tasks.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align:center; padding:36px; color:var(--text-muted);">
              🎉 Tuyệt vời! Bạn hiện không có công việc nào tồn đọng hoặc cần xử lý.
            </td>
          </tr>
        `;
        return;
      }

      const priorityMap = {
        urgent: '<span class="task-priority urgent" style="display:inline-flex;">🚨 Khẩn cấp</span>',
        high: '<span class="task-priority high" style="display:inline-flex;">⚡ Cao</span>',
        medium: '<span class="task-priority medium" style="display:inline-flex;">🔷 Trung bình</span>',
        low: '<span class="task-priority low" style="display:inline-flex;">⚪ Thấp</span>'
      };

      const statusMap = {
        todo: '<span class="badge" style="background:#64748b; color:#fff;">Cần làm</span>',
        in_progress: '<span class="badge" style="background:#3b82f6; color:#fff;">Đang làm</span>',
        review: '<span class="badge" style="background:#f59e0b; color:#fff;">Chờ duyệt</span>',
        completed: '<span class="badge" style="background:#10b981; color:#fff;">Hoàn thành</span>'
      };

      tbody.innerHTML = tasks.map(t => {
        const dateStr = t.dueDate ? new Date(t.dueDate).toLocaleDateString('vi-VN') : 'Không có hạn';
        const isOverdue = t.isOverdue;
        return `
          <tr>
            <td>
              <div style="font-weight:600; cursor:pointer;" onclick="App.openTaskDetail('${t.id}')">
                <span style="font-family:monospace; color:var(--primary); font-size:11px; margin-right:4px;">${t.id}</span>
                ${t.title}
              </div>
              <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                ${t.department || ''}
              </div>
            </td>
            <td>
              ${isOverdue 
                ? `<span style="color:var(--danger); font-weight:700;">${dateStr} <span class="overdue-tag-pill">🚨 Quá hạn</span></span>`
                : `<span>${dateStr}</span>`
              }
            </td>
            <td>${priorityMap[t.priority] || t.priority}</td>
            <td>${statusMap[t.status] || t.status}</td>
            <td>
              <div style="display:flex; align-items:center; gap:8px;">
                <div class="task-progress-bar" style="width:60px; margin:0;">
                  <div class="task-progress-fill" style="width:${t.progress || 0}%;"></div>
                </div>
                <span style="font-weight:700; font-size:11px;">${t.progress || 0}%</span>
              </div>
            </td>
            <td style="text-align:right;">
              <button class="btn btn-outline btn-sm" onclick="App.openTaskDetail('${t.id}')" style="padding:3px 8px; font-size:11px;">
                👁️ Xem
              </button>
            </td>
          </tr>
        `;
      }).join('');

    } else if (summary.scope === 'viewer') {
      // VIEWER: DEPARTMENT OVERVIEW
      const depts = Object.keys(summary.departmentMap || {});
      if (tableTitleEl) {
        tableTitleEl.innerHTML = `🏢 Bảng Tổng Hợp Tiến Độ Các Phòng Ban Doanh Nghiệp <span style="font-size:12px; font-weight:normal; color:var(--text-muted);">(${depts.length} phòng ban)</span>`;
      }

      thead.innerHTML = `
        <tr>
          <th style="width:28%;">Phòng Ban</th>
          <th style="width:14%;">Tổng Công Việc</th>
          <th style="width:14%;">Đã Hoàn Thành</th>
          <th style="width:14%;">Đang Thực Hiện</th>
          <th style="width:14%;">Bị Quá Hạn</th>
          <th style="width:16%;">Tỷ Lệ Hoàn Thành</th>
        </tr>
      `;

      if (depts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-muted);">Chưa có dữ liệu phòng ban</td></tr>`;
        return;
      }

      tbody.innerHTML = depts.map(d => {
        const item = summary.departmentMap[d];
        const rate = item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0;
        return `
          <tr>
            <td><strong>🏢 ${d}</strong></td>
            <td><strong>${item.total}</strong></td>
            <td style="color:var(--success); font-weight:600;">${item.completed}</td>
            <td style="color:var(--primary); font-weight:600;">${item.inProgress}</td>
            <td style="color:${item.overdue > 0 ? 'var(--danger)' : 'inherit'}; font-weight:700;">
              ${item.overdue > 0 ? `🚨 ${item.overdue}` : '0'}
            </td>
            <td>
              <div style="display:flex; align-items:center; gap:8px;">
                <div class="task-progress-bar" style="width:70px; margin:0;">
                  <div class="task-progress-fill" style="width:${rate}%;"></div>
                </div>
                <span style="font-weight:700;">${rate}%</span>
              </div>
            </td>
          </tr>
        `;
      }).join('');

    } else {
      // ADMIN & MANAGER: MEMBER PERFORMANCE TABLE
      const members = summary.memberPerformance || [];
      if (tableTitleEl) {
        if (summary.scope === 'manager') {
          tableTitleEl.innerHTML = `👥 Bảng Đánh Giá KPI Nhân Sự Phòng ${summary.userDepartment} <span style="font-size:12px; font-weight:normal; color:var(--text-muted);">(${members.length} nhân sự trực thuộc)</span>`;
        } else {
          tableTitleEl.innerHTML = `👥 Bảng Tổng Hợp Chỉ Số KPI Nhân Sự Toàn Doanh Nghiệp <span style="font-size:12px; font-weight:normal; color:var(--text-muted);">(${members.length} nhân sự)</span>`;
        }
      }

      thead.innerHTML = `
        <tr>
          <th style="width:24%;">Nhân Viên</th>
          <th style="width:18%;">Phòng Ban</th>
          <th style="width:11%;">Tổng Việc</th>
          <th style="width:11%;">Đã Xong</th>
          <th style="width:11%;">Đang Làm</th>
          <th style="width:11%;">Quá Hạn</th>
          <th style="width:14%;">Tỷ Lệ Đạt KPI</th>
        </tr>
      `;

      if (members.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">Không có nhân viên nào trong phạm vi này</td></tr>`;
        return;
      }

      tbody.innerHTML = members.map(m => `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:18px;">${m.avatar || '👤'}</span>
              <div>
                <div style="font-weight:600;">${m.name}</div>
                <div style="font-size:11px; color:var(--text-muted);">${m.role === 'admin' ? 'Quản trị viên' : (m.role === 'manager' ? 'Trưởng phòng' : 'Nhân viên')}</div>
              </div>
            </div>
          </td>
          <td><span style="font-size:12px; color:var(--text-secondary);">${m.department || 'N/A'}</span></td>
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
  },

  exportCsvReport() {
    const deptFilter = document.getElementById('reportDeptFilter');
    const dept = (deptFilter && deptFilter.value && deptFilter.value !== 'all') ? `?department=${encodeURIComponent(deptFilter.value)}` : '';
    window.location.href = `/api/reports/export-csv${dept}`;
  },

  printReport() {
    window.print();
  },

  // -------------------------------------------------------------
  // USERS MANAGEMENT VIEW & GRANULAR PERMISSIONS (Admin)
  // -------------------------------------------------------------
  DEFAULT_PERMISSIONS: {
    admin: {
      canCreateTask: true,
      canEditTask: true,
      canDeleteTask: true,
      canReviewTask: true,
      canManageDept: true,
      canManageUsers: true,
      canManageAutomation: true,
      canViewReports: true,
      canAccessExecutiveDesk: true
    },
    manager: {
      canCreateTask: true,
      canEditTask: true,
      canDeleteTask: false,
      canReviewTask: true,
      canManageDept: false,
      canManageUsers: false,
      canManageAutomation: true,
      canViewReports: false, // Manager không xem báo cáo hệ thống
      canAccessExecutiveDesk: false // Phân quyền cao cấp - Có thể được Admin bật
    },
    user: {
      canCreateTask: true,
      canEditTask: true,
      canDeleteTask: false,
      canReviewTask: false,
      canManageDept: false,
      canManageUsers: false,
      canManageAutomation: false,
      canViewReports: false, // Member không xem báo cáo hệ thống
      canAccessExecutiveDesk: false
    },
    viewer: {
      canCreateTask: false,
      canEditTask: false,
      canDeleteTask: false,
      canReviewTask: false,
      canManageDept: false,
      canManageUsers: false,
      canManageAutomation: false,
      canViewReports: true,
      canAccessExecutiveDesk: false
    }
  },

  renderUsersView() {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;

    this.populateDepartmentDropdowns();

    const users = this.state.users || [];
    const tasks = this.state.tasks || [];
    const currentUser = this.state.user || {};
    const isAdmin = currentUser.role === 'admin' || currentUser.permissions?.canManageUsers;

    // 1. Calculate Metrics
    const totalUsers = users.length;
    const adminCount = users.filter(u => u.role === 'admin').length;
    const managerCount = users.filter(u => u.role === 'manager').length;
    const staffCount = users.filter(u => u.role === 'user').length;
    const activeCount = users.filter(u => u.active !== false).length;

    const elTotal = document.getElementById('userStatTotal');
    const elAdmin = document.getElementById('userStatAdmin');
    const elManager = document.getElementById('userStatManager');
    const elStaff = document.getElementById('userStatStaff');
    const elActive = document.getElementById('userStatActive');
    const elBadge = document.getElementById('userCountBadge');

    if (elTotal) elTotal.innerText = totalUsers;
    if (elAdmin) elAdmin.innerText = adminCount;
    if (elManager) elManager.innerText = managerCount;
    if (elStaff) elStaff.innerText = staffCount;
    if (elActive) elActive.innerText = activeCount;

    // 2. Filters
    const searchVal = (document.getElementById('userSearchInput')?.value || '').trim().toLowerCase();
    const deptFilter = document.getElementById('userFilterDept')?.value || 'all';
    const roleFilter = document.getElementById('userFilterRole')?.value || 'all';
    const statusFilter = document.getElementById('userFilterStatus')?.value || 'all';

    let filtered = users.filter(u => {
      if (searchVal) {
        const text = `${u.name || ''} ${u.email || ''} ${u.position || ''} ${u.department || ''}`.toLowerCase();
        if (!text.includes(searchVal)) return false;
      }
      if (deptFilter !== 'all' && u.department !== deptFilter) return false;
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter === 'active' && u.active === false) return false;
      if (statusFilter === 'inactive' && u.active !== false) return false;
      return true;
    });

    if (elBadge) elBadge.innerText = `${filtered.length} nhân sự`;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding:48px 20px; color:var(--text-secondary);">
            <div style="font-size:36px; margin-bottom:8px;">🔍</div>
            <div style="font-weight:700; font-size:14px; margin-bottom:4px;">Không tìm thấy nhân sự phù hợp</div>
            <div style="font-size:12px; color:var(--text-muted);">Hãy thử thay đổi từ khóa tìm kiếm hoặc bỏ bớt các bộ lọc phòng ban, vai trò.</div>
          </td>
        </tr>
      `;
      return;
    }

    const deptsList = (this.state.departments || []).map(d => typeof d === 'string' ? d : d.name);

    tbody.innerHTML = filtered.map(u => {
      const isMe = currentUser && currentUser.id === u.id;
      const countTasks = tasks.filter(t => t.assignedTo === u.id).length;
      const isActive = u.active !== false;
      const isSso = (u.email || '').toLowerCase().endsWith('@vmg.edu.vn');
      const avatar = u.avatar || (u.role === 'admin' ? '👑' : (u.role === 'manager' ? '👔' : '👤'));

      // Count permissions granted
      const perms = u.permissions || this.DEFAULT_PERMISSIONS[u.role] || this.DEFAULT_PERMISSIONS.user;
      const permGrantedCount = Object.values(perms).filter(Boolean).length;

      // Inline Dept Select
      const deptOptions = deptsList.map(d => `
        <option value="${this.escapeHtml(d)}" ${d === u.department ? 'selected' : ''}>${this.escapeHtml(d)}</option>
      `).join('');

      const deptCell = isAdmin ? `
        <select class="inline-dept-select" data-user-inline-dept="${u.id}" title="Nhấp để chuyển phòng ban trực tiếp">
          ${deptOptions}
        </select>
      ` : `<span>${this.escapeHtml(u.department || 'Chưa phân bổ')}</span>`;

      // Inline Role Select
      const roleCell = isAdmin ? `
        <select class="inline-role-select ${u.role}" data-user-inline-role="${u.id}" title="Nhấp để đổi vai trò trực tiếp">
          <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>👑 ADMIN</option>
          <option value="manager" ${u.role === 'manager' ? 'selected' : ''}>👔 MANAGER</option>
          <option value="user" ${u.role === 'user' ? 'selected' : ''}>👤 MEMBER</option>
          <option value="viewer" ${u.role === 'viewer' ? 'selected' : ''}>👁️ VIEWER</option>
        </select>
      ` : `
        <span class="user-role-tag ${u.role}">${(u.role || 'user').toUpperCase()}</span>
      `;

      // Status 1-Click Toggle
      const statusPill = isAdmin && !isMe ? `
        <span class="status-pill-toggle ${isActive ? 'active' : 'inactive'}" data-toggle-user-status="${u.id}" title="Nhấp 1-chạm để ${isActive ? 'tạm khóa' : 'mở khóa'} tài khoản này">
          ${isActive ? '🟢 Hoạt động' : '🔴 Đã khóa'}
        </span>
      ` : `
        <span class="status-pill-toggle ${isActive ? 'active' : 'inactive'}" style="cursor:default;">
          ${isActive ? '🟢 Hoạt động' : '🔴 Đã khóa'}
        </span>
      `;

      return `
        <tr data-user-row="${u.id}">
          <td>
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-size:22px; flex-shrink:0;">${avatar}</span>
              <div>
                <div style="font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:6px;">
                  <span>${this.escapeHtml(u.name)}</span>
                  ${isMe ? '<span style="font-size:10px; background:var(--primary); color:white; padding:1px 5px; border-radius:4px; font-weight:800;">BẠN</span>' : ''}
                </div>
                <div style="font-size:11.5px; color:var(--text-secondary); margin-top:1px;">
                  ${this.escapeHtml(u.position || 'Chuyên viên')}
                </div>
              </div>
            </div>
          </td>
          <td>
            <div style="font-size:12.5px; font-weight:600; color:var(--text-primary);">
              ${this.escapeHtml(u.email)}
            </div>
            <div style="display:flex; align-items:center; gap:6px; margin-top:2px;">
              ${isSso ? '<span style="font-size:9.5px; font-weight:800; background:rgba(59,130,246,0.15); color:#2563eb; padding:1px 4px; border-radius:3px;">GOOGLE SSO</span>' : ''}
              ${u.phone ? `<span style="font-size:11px; color:var(--text-muted);">📞 ${this.escapeHtml(u.phone)}</span>` : ''}
            </div>
          </td>
          <td>
            ${deptCell}
          </td>
          <td>
            <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-start;">
              ${roleCell}
              <span style="font-size:10.5px; color:var(--text-muted); cursor:pointer; text-decoration:underline;" data-open-perm="${u.id}" title="Xem & điều chỉnh ma trận quyền">
                ⚡ ${permGrantedCount}/8 quyền
              </span>
            </div>
          </td>
          <td>
            <span style="font-weight:700; font-size:13px; color:var(--text-primary);">${countTasks}</span>
            <span style="font-size:11.5px; color:var(--text-muted);"> việc</span>
          </td>
          <td>
            ${statusPill}
          </td>
          <td style="text-align:right;">
            <div class="user-action-btn-group">
              ${isAdmin ? `
                <button type="button" class="btn btn-outline btn-xs btn-perm-action" data-open-perm="${u.id}" title="Phân quyền chi tiết & Sửa">
                  <span>⚡</span><span>Sửa & Phân quyền</span>
                </button>
                <button type="button" class="btn btn-outline btn-xs" data-quick-reset-pass="${u.id}" title="Đặt lại mật khẩu">
                  🔑
                </button>
                ${!isMe ? `
                  <button type="button" class="btn btn-outline btn-xs" style="color:var(--danger);" onclick="App.deleteUser('${u.id}')" title="Xóa tài khoản nhân sự">
                    🗑️
                  </button>
                ` : ''}
              ` : `
                <span style="font-size:11px; color:var(--text-muted);">Chỉ xem</span>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  openAddUserModal() {
    this.populateDepartmentDropdowns();
    document.getElementById('userModalTitle').innerText = 'Thêm Thành Viên Mới';
    document.getElementById('userModalHeaderAvatar').innerText = '👤';
    document.getElementById('userFormId').value = '';
    document.getElementById('userFormName').value = '';
    document.getElementById('userFormEmail').value = '';
    document.getElementById('userFormPassword').value = '123456';
    document.getElementById('userFormPhone').value = '';
    document.getElementById('userFormRole').value = 'user';
    document.getElementById('userFormActive').value = 'true';

    const firstDept = (this.state.departments && this.state.departments[0])
      ? (typeof this.state.departments[0] === 'string' ? this.state.departments[0] : this.state.departments[0].name)
      : 'Phòng Kỹ Thuật';
    document.getElementById('userFormDept').value = firstDept;
    document.getElementById('userFormPosition').value = 'Chuyên viên';

    // Set default permissions for 'user'
    this.setModalPermissionCheckboxes(this.DEFAULT_PERMISSIONS.user);

    this.openModal('userModal');
  },

  openEditUserModal(userId) {
    this.populateDepartmentDropdowns();
    const user = this.state.users.find(u => u.id === userId);
    if (!user) return;

    document.getElementById('userModalTitle').innerText = `Phân Quyền & Chỉnh Sửa: ${user.name}`;
    document.getElementById('userModalHeaderAvatar').innerText = user.avatar || (user.role === 'admin' ? '👑' : (user.role === 'manager' ? '👔' : '👤'));
    document.getElementById('userFormId').value = user.id;
    document.getElementById('userFormName').value = user.name;
    document.getElementById('userFormEmail').value = user.email;
    document.getElementById('userFormPassword').value = ''; // Leave blank to keep
    document.getElementById('userFormPhone').value = user.phone || '';
    document.getElementById('userFormRole').value = user.role || 'user';
    document.getElementById('userFormDept').value = user.department;
    document.getElementById('userFormPosition').value = user.position || '';
    document.getElementById('userFormActive').value = String(user.active !== false);

    // Populate permission checkboxes
    const perms = user.permissions || this.DEFAULT_PERMISSIONS[user.role] || this.DEFAULT_PERMISSIONS.user;
    this.setModalPermissionCheckboxes(perms);

    this.openModal('userModal');
  },

  setModalPermissionCheckboxes(perms = {}) {
    const keys = [
      'canCreateTask', 'canEditTask', 'canDeleteTask', 'canReviewTask',
      'canManageDept', 'canManageUsers', 'canManageAutomation', 'canViewReports', 'canAccessExecutiveDesk'
    ];
    keys.forEach(k => {
      const el = document.getElementById(`perm_${k}`);
      if (el) {
        el.checked = Boolean(perms[k]);
      }
    });
  },

  getModalPermissionCheckboxes() {
    const keys = [
      'canCreateTask', 'canEditTask', 'canDeleteTask', 'canReviewTask',
      'canManageDept', 'canManageUsers', 'canManageAutomation', 'canViewReports', 'canAccessExecutiveDesk'
    ];
    const perms = {};
    keys.forEach(k => {
      const el = document.getElementById(`perm_${k}`);
      perms[k] = el ? el.checked : false;
    });
    return perms;
  },

  onRoleChangeInModal(newRole) {
    const defaultPerms = this.DEFAULT_PERMISSIONS[newRole] || this.DEFAULT_PERMISSIONS.user;
    this.setModalPermissionCheckboxes(defaultPerms);
  },

  resetModalPermissionsToDefault() {
    const role = document.getElementById('userFormRole')?.value || 'user';
    const defaultPerms = this.DEFAULT_PERMISSIONS[role] || this.DEFAULT_PERMISSIONS.user;
    this.setModalPermissionCheckboxes(defaultPerms);
    this.showToast(`↺ Đã khôi phục quyền mặc định cho vai trò "${role.toUpperCase()}"`, 'info');
  },

  async handleUserFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('userFormId').value;
    const name = document.getElementById('userFormName').value.trim();
    const email = document.getElementById('userFormEmail').value.trim().toLowerCase();
    const password = document.getElementById('userFormPassword').value;
    const role = document.getElementById('userFormRole').value;
    const department = document.getElementById('userFormDept').value;
    const position = document.getElementById('userFormPosition').value.trim();
    const phone = document.getElementById('userFormPhone').value.trim();
    const active = document.getElementById('userFormActive').value === 'true';

    const permissions = this.getModalPermissionCheckboxes();

    try {
      if (id) {
        const payload = { name, email, role, department, position, phone, active, permissions };
        if (password) payload.password = password;
        await API.updateUser(id, payload);
        this.showToast(`✅ Đã cập nhật phân quyền và tài khoản "${name}" thành công!`, 'success');
        this.playSound('success');
      } else {
        await API.createUser({ name, email, password: password || '123456', role, department, position, phone, active, permissions });
        this.showToast(`✅ Đã tạo thành viên mới "${name}" thành công!`, 'success');
        this.playSound('success');
      }
      this.closeModal('userModal');
      await this.refreshUsersList();
    } catch (err) {
      this.showToast(`Lỗi: ${err.message}`, 'danger');
      this.playSound('danger');
    }
  },

  openQuickResetPassModal(userId) {
    const user = (this.state.users || []).find(u => u.id === userId);
    if (!user) return;

    document.getElementById('quickPassUserId').value = user.id;
    document.getElementById('quickPassUserName').innerText = user.name;
    document.getElementById('quickPassUserEmail').innerText = `${user.email} (${user.department})`;
    document.getElementById('quickNewPassword').value = '123456';

    this.openModal('quickPasswordModal');
  },

  async handleQuickResetPassSubmit(e) {
    e.preventDefault();
    const userId = document.getElementById('quickPassUserId').value;
    const newPassword = document.getElementById('quickNewPassword').value.trim();

    if (!newPassword || newPassword.length < 6) {
      this.showToast('Mật khẩu mới phải có ít nhất 6 ký tự!', 'warning');
      return;
    }

    try {
      const res = await API.resetUserPassword(userId, newPassword);
      this.showToast(res.message || '✅ Đã đặt lại mật khẩu thành công!', 'success');
      this.playSound('success');
      this.closeModal('quickPasswordModal');
    } catch (err) {
      this.showToast(`Lỗi đặt lại mật khẩu: ${err.message}`, 'danger');
      this.playSound('danger');
    }
  },

  async quickToggleUserStatus(userId) {
    const user = (this.state.users || []).find(u => u.id === userId);
    if (!user) return;

    const newActive = user.active === false;
    const actionText = newActive ? 'kích hoạt mở khóa' : 'tạm khóa';

    if (!confirm(`Bạn có chắc chắn muốn ${actionText} tài khoản của "${user.name}"?`)) return;

    try {
      await API.toggleUserStatus(userId, newActive);
      user.active = newActive;
      this.showToast(`✅ Đã ${actionText} tài khoản "${user.name}"!`, 'info');
      this.playSound('info');
      this.renderUsersView();
    } catch (err) {
      this.showToast(`Lỗi: ${err.message}`, 'danger');
    }
  },

  async quickUpdateUserRole(userId, newRole) {
    const user = (this.state.users || []).find(u => u.id === userId);
    if (!user) return;

    try {
      const res = await API.updateUser(userId, { role: newRole });
      if (res && res.user) {
        user.role = res.user.role;
        user.avatar = res.user.avatar;
        user.permissions = res.user.permissions;
      }
      this.showToast(`👑 Đã cập nhật vai trò "${user.name}" thành [${newRole.toUpperCase()}]!`, 'success');
      this.playSound('success');
      this.renderUsersView();
    } catch (err) {
      this.showToast(`Lỗi cập nhật vai trò: ${err.message}`, 'danger');
      this.renderUsersView();
    }
  },

  async quickUpdateUserDept(userId, newDept) {
    const user = (this.state.users || []).find(u => u.id === userId);
    if (!user) return;

    try {
      await API.updateUser(userId, { department: newDept });
      user.department = newDept;
      this.showToast(`🏢 Đã chuyển phòng ban của "${user.name}" sang "${newDept}"!`, 'success');
      this.playSound('success');
      this.renderUsersView();
    } catch (err) {
      this.showToast(`Lỗi chuyển phòng ban: ${err.message}`, 'danger');
      this.renderUsersView();
    }
  },

  async deleteUser(userId) {
    const user = (this.state.users || []).find(u => u.id === userId);
    const userName = user ? user.name : `#${userId}`;
    if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản nhân sự "${userName}" khỏi hệ thống?`)) return;

    try {
      await API.deleteUser(userId);
      this.showToast(`🗑️ Đã xóa thành viên "${userName}"!`, 'warning');
      this.playSound('info');
      await this.refreshUsersList();
    } catch (err) {
      this.showToast(`Lỗi xóa: ${err.message}`, 'danger');
    }
  },

  // -------------------------------------------------------------
  // REALTIME ACTIVITIES AUDIT STREAM
  // -------------------------------------------------------------
  async renderActivitiesView() {
    const container = document.getElementById('activityLogContainer');
    if (!container) return;

    try {
      container.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-secondary);"><span style="display:inline-block; animation:spin 1s infinite linear;">🔄</span> Đang tải nhật ký hoạt động realtime...</div>';
      const res = await API.getActivities();
      this.state.activities = res.activities || [];
      this.renderActivitiesList();
    } catch (e) {
      console.error('Lỗi khi tải nhật ký hoạt động:', e);
      container.innerHTML = '<div style="padding:40px; text-align:center; color:var(--danger);">Không thể tải nhật ký hoạt động. Vui lòng thử lại.</div>';
    }
  },

  renderActivitiesList() {
    const container = document.getElementById('activityLogContainer');
    if (!container) return;

    const list = this.state.activities || [];

    // Calculate metrics
    const totalCount = list.length;
    const adminCount = list.filter(a => a.userRole === 'admin').length;
    const userCount = list.filter(a => a.userRole !== 'admin').length;

    const totalEl = document.getElementById('actStatTotal');
    const adminEl = document.getElementById('actStatAdmin');
    const userEl = document.getElementById('actStatUser');
    if (totalEl) totalEl.innerText = totalCount;
    if (adminEl) adminEl.innerText = adminCount;
    if (userEl) userEl.innerText = userCount;

    // Filters
    const roleFilter = document.getElementById('actFilterRole')?.value || 'all';
    const catFilter = document.getElementById('actFilterCat')?.value || 'all';
    const searchVal = (document.getElementById('actSearchInput')?.value || '').trim().toLowerCase();

    let filtered = list.filter(item => {
      // Role filter
      if (roleFilter === 'admin' && item.userRole !== 'admin') return false;
      if (roleFilter === 'user' && item.userRole === 'admin') return false;

      // Category filter
      if (catFilter !== 'all' && item.category !== catFilter) return false;

      // Search filter
      if (searchVal) {
        const text = `${item.userName || ''} ${item.details || ''} ${item.action || ''} ${item.taskTitle || ''}`.toLowerCase();
        if (!text.includes(searchVal)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="padding:48px 20px; text-align:center; color:var(--text-secondary);">
          <div style="font-size:36px; margin-bottom:8px;">🔍</div>
          <div style="font-weight:600; font-size:14px; margin-bottom:4px;">Không tìm thấy hoạt động nào phù hợp</div>
          <div style="font-size:12px; color:var(--text-muted);">Hãy thử chọn bộ lọc khác hoặc thực hiện một thao tác mới trên ứng dụng.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(item => this.buildActivityItemHtml(item)).join('');
  },

  buildActivityItemHtml(item, isNew = false) {
    const category = item.category || 'general';
    const userRole = item.userRole || 'user';
    const avatar = item.userAvatar || (userRole === 'admin' ? '👑' : '👤');
    const relativeTime = this.formatRelativeTime(item.timestamp);
    const fullTime = new Date(item.timestamp).toLocaleString('vi-VN');

    // Action tag badge
    const tagInfo = this.getActionTagInfo(item.action, item.category);

    return `
      <div class="activity-item cat-${this.escapeHtml(category)} ${isNew ? 'highlight-new' : ''}" data-act-id="${item.id}">
        <div class="activity-avatar-col">
          <div class="activity-avatar">${avatar}</div>
          <span class="activity-role-mini ${userRole}">${userRole === 'admin' ? 'ADMIN' : 'USER'}</span>
        </div>
        <div class="activity-content-col">
          <div class="activity-top-row">
            <div class="activity-user-badge-wrap">
              <span class="activity-user-name">${this.escapeHtml(item.userName || 'Người dùng')}</span>
              <span class="activity-action-tag ${tagInfo.tagClass}">
                ${tagInfo.icon} ${tagInfo.label}
              </span>
            </div>
            <span class="activity-time-tag" title="${fullTime}">
              ⏱️ ${relativeTime}
            </span>
          </div>
          <div class="activity-details-text">
            ${this.escapeHtml(item.details || '')}
          </div>
        </div>
      </div>
    `;
  },

  getActionTagInfo(action, category) {
    const map = {
      // Task
      create_task: { icon: '📋', label: 'Tạo Việc', tagClass: '' },
      update_task: { icon: '✏️', label: 'Sửa Việc', tagClass: '' },
      change_status: { icon: '🔄', label: 'Đổi Trạng Thái', tagClass: '' },
      update_progress: { icon: '📊', label: 'Tiến Độ', tagClass: '' },
      delete_task: { icon: '🗑️', label: 'Xóa Việc', tagClass: '' },
      add_comment: { icon: '💬', label: 'Bình Luận', tagClass: '' },

      // Department
      create_department: { icon: '🏢', label: 'Thêm Phòng Ban', tagClass: 'tag-dept' },
      update_department: { icon: '✏️', label: 'Sửa Phòng Ban', tagClass: 'tag-dept' },
      delete_department: { icon: '🗑️', label: 'Xóa Phòng Ban', tagClass: 'tag-dept' },

      // User
      create_user: { icon: '👤', label: 'Thêm Nhân Sự', tagClass: 'tag-user' },
      update_user: { icon: '✏️', label: 'Sửa Nhân Sự', tagClass: 'tag-user' },
      delete_user: { icon: '🗑️', label: 'Xóa Nhân Sự', tagClass: 'tag-user' },

      // Auth
      auth_login: { icon: '🔑', label: 'Đăng Nhập', tagClass: 'tag-auth' },
      auth_logout: { icon: '🚪', label: 'Đăng Xuất', tagClass: 'tag-auth' },
      auth_register: { icon: '📝', label: 'Đăng Ký', tagClass: 'tag-auth' },
      auth_sso_login: { icon: '🌐', label: 'SSO Đăng Nhập', tagClass: 'tag-auth' },
      auth_sso_register: { icon: '🌐', label: 'SSO Đăng Ký', tagClass: 'tag-auth' },
      auth_reset_pwd: { icon: '🔄', label: 'Đổi Mật Khẩu', tagClass: 'tag-auth' },
      switch_demo: { icon: '🎭', label: 'Đổi Tài Khoản', tagClass: 'tag-auth' },

      // System
      publish_update: { icon: '🚀', label: 'Phiên Bản Mới', tagClass: 'tag-system' },
      system_reset: { icon: '♻️', label: 'Khôi Phục Mẫu', tagClass: 'tag-system' }
    };

    if (map[action]) return map[action];

    if (category === 'task') return { icon: '📋', label: 'Công Việc', tagClass: '' };
    if (category === 'department') return { icon: '🏢', label: 'Phòng Ban', tagClass: 'tag-dept' };
    if (category === 'user') return { icon: '👤', label: 'Nhân Sự', tagClass: 'tag-user' };
    if (category === 'auth') return { icon: '🔑', label: 'Xác Thực', tagClass: 'tag-auth' };
    if (category === 'system') return { icon: '⚙️', label: 'Hệ Thống', tagClass: 'tag-system' };

    return { icon: '📌', label: 'Hoạt Động', tagClass: '' };
  },

  formatRelativeTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 10) return 'Vừa xong';
    if (diffSec < 60) return `${diffSec} giây trước`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} giờ trước`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay === 1) return `Hôm qua ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    if (diffDay < 7) return `${diffDay} ngày trước`;

    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  handleNewActivityEvent(activity) {
    if (!activity) return;

    if (!Array.isArray(this.state.activities)) {
      this.state.activities = [];
    }

    // Prepend to state
    this.state.activities.unshift(activity);
    if (this.state.activities.length > 300) {
      this.state.activities.pop();
    }

    // Update counters in header if available
    const totalEl = document.getElementById('actStatTotal');
    const adminEl = document.getElementById('actStatAdmin');
    const userEl = document.getElementById('actStatUser');
    if (totalEl) totalEl.innerText = this.state.activities.length;
    if (adminEl) adminEl.innerText = this.state.activities.filter(a => a.userRole === 'admin').length;
    if (userEl) userEl.innerText = this.state.activities.filter(a => a.userRole !== 'admin').length;

    // If currently viewing activities panel, insert new item with highlight
    if (this.state.activeView === 'activities') {
      const container = document.getElementById('activityLogContainer');
      if (container) {
        // Check current filter
        const roleFilter = document.getElementById('actFilterRole')?.value || 'all';
        const catFilter = document.getElementById('actFilterCat')?.value || 'all';
        const searchVal = (document.getElementById('actSearchInput')?.value || '').trim().toLowerCase();

        let passesFilter = true;
        if (roleFilter === 'admin' && activity.userRole !== 'admin') passesFilter = false;
        if (roleFilter === 'user' && activity.userRole === 'admin') passesFilter = false;
        if (catFilter !== 'all' && activity.category !== catFilter) passesFilter = false;
        if (searchVal) {
          const text = `${activity.userName || ''} ${activity.details || ''} ${activity.action || ''}`.toLowerCase();
          if (!text.includes(searchVal)) passesFilter = false;
        }

        if (passesFilter) {
          // If empty placeholder is shown, clear it
          if (container.children.length === 1 && container.children[0].textContent.includes('Không tìm thấy')) {
            container.innerHTML = '';
          }
          const temp = document.createElement('div');
          temp.innerHTML = this.buildActivityItemHtml(activity, true);
          const newEl = temp.firstElementChild;
          if (newEl) {
            container.insertBefore(newEl, container.firstChild);
          }
        }
      }
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
      const assignedUser = this.state.users.find(u => u.id === assignedTo);
      const assignedName = assignedUser ? assignedUser.name : 'nhân sự';

      if (id) {
        await API.updateTask(id, payload);
        this.showToast(`✅ Đã cập nhật công việc & tự động đồng bộ vào Google Calendar của ${assignedName}!`, 'success');
      } else {
        await API.createTask(payload);
        this.showToast(`🎉 Đã giao việc thành công & Tự động lưu vào Google Calendar của ${assignedName}!`, 'success');
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

    // Render Google Meet Video Call Section
    this.renderTaskMeetSection(task);

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

  renderTaskMeetSection(task) {
    const container = document.getElementById('detailTaskMeetCard');
    const meetBtn = document.getElementById('detailMeetBtn');
    if (!container) return;

    if (task.meetUrl) {
      container.className = 'task-meet-card active-meet';
      container.innerHTML = `
        <div class="task-meet-header-row">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:18px;">📹</span>
            <strong style="color:#065f46; font-size:13px;">Phòng Họp Trực Tuyến Google Meet</strong>
            <span class="badge" style="background:#10b981; color:#fff; font-size:10.5px; padding:2px 7px; border-radius:10px; display:inline-flex; align-items:center; gap:4px;">
              <span class="meet-pulse-dot" style="background:#fff; width:5px; height:5px;"></span> Đang Sẵn Sàng
            </span>
          </div>
          <button type="button" class="btn btn-sm btn-outline" onclick="App.removeTaskMeet('${task.id}')" style="color:#dc2626; border-color:#fca5a5; font-size:11px; padding:2px 8px;" title="Gỡ bỏ phòng họp này khỏi task">
            🗑️ Gỡ phòng
          </button>
        </div>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:8px;">
          <a href="${this.escapeHtml(task.meetUrl)}" target="_blank" class="task-meet-link-badge" style="flex:1; text-decoration:none;" title="Mở phòng họp Google Meet">
            <span>🔗</span>
            <span style="font-weight:700; color:#059669;">${this.escapeHtml(task.meetUrl)}</span>
          </a>
          <button type="button" class="btn btn-sm" onclick="App.openTaskMeetLink('${this.escapeHtml(task.meetUrl)}')" style="background:#059669; color:#fff; font-weight:700; padding:6px 14px; border:none; border-radius:6px; cursor:pointer;">
            🚀 Vào Họp Ngay
          </button>
          <button type="button" class="btn btn-sm btn-outline" onclick="App.copyText('${this.escapeHtml(task.meetUrl)}', 'Đã sao chép liên kết Google Meet!')" title="Sao chép link">
            📋 Copy
          </button>
        </div>
        <div style="font-size:11.5px; color:#047857; margin-top:6px;">
          💡 Mọi thành viên tham gia hoặc phụ trách task đều có thể nhấp để kết nối trao đổi trực tiếp tức thì.
        </div>
      `;

      if (meetBtn) {
        meetBtn.innerHTML = '🚀 Vào Họp Meet';
        meetBtn.className = 'btn btn-primary';
        meetBtn.style.background = '#059669';
        meetBtn.style.borderColor = '#059669';
        meetBtn.style.color = '#fff';
      }
    } else {
      container.className = 'task-meet-card no-meet';
      container.innerHTML = `
        <div class="task-meet-header-row">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:18px;">📹</span>
            <strong style="color:var(--text-main); font-size:13px;">Google Meet Trực Tuyến</strong>
            <span style="font-size:11.5px; color:var(--text-muted);">(Chưa kết nối phòng họp)</span>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:6px;">
          <button type="button" class="btn btn-sm btn-primary" onclick="App.createInstantTaskMeet('${task.id}')" style="background:#059669; border-color:#059669; font-weight:700; display:inline-flex; align-items:center; gap:6px;">
            ⚡ Tạo Phòng Meet Mới
          </button>
          <div style="display:flex; align-items:center; gap:6px; flex:1; min-width:220px;">
            <input type="text" class="form-control form-control-sm" id="customMeetUrlInput" placeholder="Hoặc dán link Google Meet (https://meet.google.com/...)" style="font-size:11.5px;">
            <button type="button" class="btn btn-sm btn-outline" onclick="App.saveCustomTaskMeet('${task.id}')" style="white-space:nowrap; font-weight:600;">
              Lưu Link
            </button>
          </div>
        </div>
      `;

      if (meetBtn) {
        meetBtn.innerHTML = '📹 Tạo Họp Meet';
        meetBtn.className = 'btn btn-outline';
        meetBtn.style.background = '';
        meetBtn.style.borderColor = '#6ee7b7';
        meetBtn.style.color = '#059669';
      }
    }
  },

  openTaskMeetLink(url) {
    if (url) window.open(url, '_blank');
  },

  async createInstantTaskMeet(taskId) {
    try {
      const randomCode = `${Math.random().toString(36).substring(2, 5)}-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}`;
      const generatedUrl = `https://meet.google.com/${randomCode}`;
      
      const res = await API.updateTaskMeet(taskId, generatedUrl);
      this.showToast('Đã tạo phòng họp Google Meet thành công cho task!', 'success');
      
      // Update local state
      const t = this.state.tasks.find(x => x.id === taskId);
      if (t) t.meetUrl = generatedUrl;
      if (this.state.currentDetailTask && this.state.currentDetailTask.id === taskId) {
        this.state.currentDetailTask.meetUrl = generatedUrl;
        this.renderTaskMeetSection(this.state.currentDetailTask);
      }
      
      // Open Google Meet room
      window.open(generatedUrl, '_blank');
    } catch (err) {
      this.showToast('Lỗi tạo phòng họp: ' + err.message, 'danger');
    }
  },

  async saveCustomTaskMeet(taskId) {
    const input = document.getElementById('customMeetUrlInput');
    if (!input || !input.value.trim()) {
      this.showToast('Vui lòng nhập liên kết Google Meet hợp lệ', 'warning');
      return;
    }
    let url = input.value.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    try {
      await API.updateTaskMeet(taskId, url);
      this.showToast('Đã lưu liên kết Google Meet cho task!', 'success');
      const t = this.state.tasks.find(x => x.id === taskId);
      if (t) t.meetUrl = url;
      if (this.state.currentDetailTask && this.state.currentDetailTask.id === taskId) {
        this.state.currentDetailTask.meetUrl = url;
        this.renderTaskMeetSection(this.state.currentDetailTask);
      }
    } catch (err) {
      this.showToast('Lỗi lưu liên kết: ' + err.message, 'danger');
    }
  },

  async removeTaskMeet(taskId) {
    if (!confirm('Bạn có chắc chắn muốn gỡ bỏ phòng họp Google Meet khỏi task này?')) return;
    try {
      await API.deleteTaskMeet(taskId);
      this.showToast('Đã gỡ bỏ phòng họp Google Meet', 'info');
      const t = this.state.tasks.find(x => x.id === taskId);
      if (t) t.meetUrl = null;
      if (this.state.currentDetailTask && this.state.currentDetailTask.id === taskId) {
        this.state.currentDetailTask.meetUrl = null;
        this.renderTaskMeetSection(this.state.currentDetailTask);
      }
    } catch (err) {
      this.showToast('Lỗi gỡ phòng họp: ' + err.message, 'danger');
    }
  },

  triggerTaskMeetAction() {
    const task = this.state.currentDetailTask;
    if (!task) return;
    if (task.meetUrl) {
      this.openTaskMeetLink(task.meetUrl);
    } else {
      this.createInstantTaskMeet(task.id);
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
  openSsoModal() {
    const loginEmail = document.getElementById('loginEmail')?.value.trim();
    const regEmail = document.getElementById('regEmail')?.value.trim();
    const ssoInput = document.getElementById('ssoEmailInput');

    const emailToUse = (loginEmail && loginEmail.endsWith('@vmg.edu.vn')) ? loginEmail : (regEmail && regEmail.endsWith('@vmg.edu.vn') ? regEmail : '');
    if (ssoInput && emailToUse) {
      ssoInput.value = emailToUse;
    }

    this.openModal('ssoModal');
  },

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('show');
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('show');
  },

  // -------------------------------------------------------------
  // APP VERSION & UPDATE MANAGEMENT
  // -------------------------------------------------------------
  async checkAppUpdates(isManual = false) {
    try {
      const data = await API.getVersionInfo();
      this.state.serverVersionInfo = data;

      // Update version text in sidebar & modal
      const sidebarVersionText = document.getElementById('sidebarVersionText');
      if (sidebarVersionText) sidebarVersionText.innerText = `v${this.state.clientVersion}`;

      const modalCurrentVersion = document.getElementById('modalCurrentVersion');
      if (modalCurrentVersion) modalCurrentVersion.innerText = `TaskFlow Pro v${this.state.clientVersion}`;

      const modalBuildDate = document.getElementById('modalBuildDate');
      if (modalBuildDate && data.buildDate) {
        modalBuildDate.innerText = `Bản dựng: ${data.buildDate}`;
      }

      // Check if server version is different or higher than current client version
      const serverVer = data.version;
      const clientVer = this.state.clientVersion;
      const hasUpdate = Boolean(serverVer && serverVer !== clientVer);

      this.state.hasNewUpdate = hasUpdate;

      const sidebarBadge = document.getElementById('sidebarVersionNewBadge');
      const headerDot = document.getElementById('headerVersionDot');
      const banner = document.getElementById('appUpdateBanner');
      const statusDesc = document.getElementById('versionStatusDesc');
      const statusPulse = document.getElementById('versionStatusPulse');
      const statusCard = document.getElementById('versionStatusCard');

      if (hasUpdate) {
        if (sidebarBadge) sidebarBadge.style.display = 'inline-block';
        if (headerDot) headerDot.style.display = 'block';
        if (banner) {
          const bannerTitle = document.getElementById('updateBannerTitle');
          const bannerDesc = document.getElementById('updateBannerDesc');
          if (bannerTitle) bannerTitle.innerText = `Đã có bản cập nhật mới v${serverVer}!`;
          if (bannerDesc) bannerDesc.innerText = `Phiên bản hiện tại: v${clientVer}. Vui lòng làm mới trang để nhận tính năng mới.`;
          banner.style.display = 'flex';
        }
        if (statusDesc) {
          statusDesc.innerHTML = `⚠️ <strong>Có phiên bản mới: v${serverVer}</strong> (Hiện tại: v${clientVer}). Vui lòng nhấn "Làm Mới & Xóa Cache" để đồng bộ ngay.`;
        }
        if (statusPulse) {
          statusPulse.classList.add('outdated');
        }
        if (statusCard) {
          statusCard.classList.add('has-update');
        }

        if (isManual) {
          this.showToast(`🚀 Đã có phiên bản mới v${serverVer}! Nhấn 'Làm Mới & Xóa Cache' để cập nhật.`, 'warning');
          this.playSound('alert');
        }
      } else {
        if (sidebarBadge) sidebarBadge.style.display = 'none';
        if (headerDot) headerDot.style.display = 'none';
        if (statusDesc) {
          statusDesc.innerHTML = `✅ Hệ thống đang đồng bộ với phiên bản mới nhất từ máy chủ (v${clientVer}). Tất cả tài nguyên đã được tối ưu hóa.`;
        }
        if (statusPulse) {
          statusPulse.classList.remove('outdated');
        }
        if (statusCard) {
          statusCard.classList.remove('has-update');
        }

        if (isManual) {
          this.showToast(`✅ Bạn đang sử dụng phiên bản mới nhất (v${clientVer})!`, 'success');
          this.playSound('success');
        }
      }

      this.renderChangelog(data.changelog || []);
      return data;
    } catch (e) {
      console.warn('Lỗi khi kiểm tra phiên bản:', e);
      if (isManual) {
        this.showToast('Không thể kết nối máy chủ để kiểm tra phiên bản!', 'danger');
      }
    }
  },

  handleNewVersionEvent(data) {
    this.state.hasNewUpdate = true;
    const banner = document.getElementById('appUpdateBanner');
    const sidebarBadge = document.getElementById('sidebarVersionNewBadge');
    const headerDot = document.getElementById('headerVersionDot');
    const updateTitle = document.getElementById('updateBannerTitle');
    const updateDesc = document.getElementById('updateBannerDesc');

    if (sidebarBadge) sidebarBadge.style.display = 'inline-block';
    if (headerDot) headerDot.style.display = 'block';

    if (updateTitle && data.version) {
      updateTitle.innerText = `Đã có bản phát hành mới v${data.version}!`;
    }
    if (updateDesc && data.message) {
      updateDesc.innerText = data.message;
    }
    if (banner) {
      banner.style.display = 'flex';
    }

    this.showToast(`📢 Cập Nhật Hệ Thống: ${data.message || `Đã có bản cập nhật v${data.version || ''}`}`, 'info');
    this.playSound('info');

    // Update modal elements if open
    const statusDesc = document.getElementById('versionStatusDesc');
    const statusPulse = document.getElementById('versionStatusPulse');
    const statusCard = document.getElementById('versionStatusCard');
    if (statusDesc && data.version) {
      statusDesc.innerHTML = `⚠️ <strong>Có phiên bản mới từ máy chủ: v${data.version}</strong>. ${data.message || ''}`;
    }
    if (statusPulse) statusPulse.classList.add('outdated');
    if (statusCard) statusCard.classList.add('has-update');
  },

  dismissUpdateBanner() {
    const banner = document.getElementById('appUpdateBanner');
    if (banner) banner.style.display = 'none';
  },

  async openVersionModal() {
    // Show admin broadcast zone if user is admin
    const adminSection = document.getElementById('adminBroadcastSection');
    if (adminSection) {
      adminSection.style.display = (this.state.user && this.state.user.role === 'admin') ? 'block' : 'none';
    }

    // Refresh version info silently
    await this.checkAppUpdates(false);
    this.openModal('versionModal');
  },

  renderChangelog(changelog) {
    const container = document.getElementById('modalChangelogList');
    const countEl = document.getElementById('changelogCount');
    if (!container) return;

    if (!changelog || changelog.length === 0) {
      container.innerHTML = '<div style="font-size:12px; color:var(--text-secondary); text-align:center; padding:16px;">Không có thông tin lịch sử phiên bản.</div>';
      return;
    }

    if (countEl) countEl.innerText = `${changelog.length} bản phát hành`;

    container.innerHTML = changelog.map((item, idx) => {
      const isLatest = idx === 0;
      const bulletsHtml = (item.highlights || [])
        .map(h => `<li>${this.escapeHtml(h)}</li>`)
        .join('');

      return `
        <div class="changelog-item">
          <div class="changelog-item-header">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="changelog-version-tag ${isLatest ? 'current' : ''}">${this.escapeHtml(item.version)}</span>
              ${isLatest ? '<span style="font-size:10.5px; font-weight:700; color:#10b981; background:rgba(16,185,129,0.12); padding:1px 6px; border-radius:4px;">MỚI NHẤT</span>' : ''}
            </div>
            <span class="changelog-date">📅 ${this.escapeHtml(item.date)}</span>
          </div>
          <div class="changelog-title">${this.escapeHtml(item.title)}</div>
          <ul class="changelog-bullets">
            ${bulletsHtml}
          </ul>
        </div>
      `;
    }).join('');
  },

  async applyAppUpdate() {
    this.showToast('⚡ Đang làm sạch bộ nhớ đệm (Cache) và tải phiên bản mới nhất...', 'info');

    // 1. Delete all browser CacheStorage
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      } catch (err) {
        console.warn('Lỗi khi xóa CacheStorage:', err);
      }
    }

    // 2. Unregister any Service Workers
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
          await registration.unregister();
        }
      } catch (err) {
        console.warn('Lỗi khi unregister serviceWorker:', err);
      }
    }

    // 3. Save latest version locally
    if (this.state.serverVersionInfo && this.state.serverVersionInfo.version) {
      localStorage.setItem('taskflow_app_version', this.state.serverVersionInfo.version);
    }

    // 4. Force hard reload with timestamp cache-buster
    setTimeout(() => {
      const targetUrl = window.location.origin + window.location.pathname + '?reload=' + Date.now();
      window.location.replace(targetUrl);
    }, 400);
  },

  async broadcastVersionUpdate() {
    const input = document.getElementById('adminUpdateMessage');
    const customMessage = input ? input.value.trim() : '';

    const btn = document.getElementById('btnAdminBroadcastUpdate');
    if (btn) {
      btn.disabled = true;
      btn.innerText = 'Đang phát thông báo...';
    }

    try {
      const res = await API.publishUpdate(customMessage);
      this.showToast(res.message || 'Đã phát thông báo cập nhật Realtime thành công!', 'success');
      this.playSound('success');
      if (input) input.value = '';
    } catch (err) {
      this.showToast(`Lỗi khi phát thông báo: ${err.message}`, 'danger');
      this.playSound('danger');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = '📢 Phát Thông Báo Cập Nhật Realtime Tới Toàn Hệ Thống';
      }
    }
  },

  // -------------------------------------------------------------
  // WORKFLOW AUTOMATION ENGINE & CENTER
  // -------------------------------------------------------------
  async renderAutomationView() {
    const grid = document.getElementById('automationRulesGrid');
    if (!grid) return;

    if (!this.state.automations || this.state.automations.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-secondary);"><span style="display:inline-block; animation:spin 1s infinite linear;">⚡</span> Đang tải các quy tắc tự động hóa...</div>';
      await this.loadAutomations();
    }

    this.renderAutomationRulesList();
    this.updateAutomationMetrics();
    this.initAutomationLiveFeed();
  },

  async loadAutomations() {
    try {
      const res = await API.getAutomations();
      this.state.automations = (res && res.automations) ? res.automations : [];
      return this.state.automations;
    } catch (e) {
      console.error('Lỗi khi tải danh sách automations:', e);
      return [];
    }
  },

  renderAutomationRulesList() {
    const grid = document.getElementById('automationRulesGrid');
    if (!grid) return;

    const list = this.state.automations || [];
    if (list.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; padding: 48px 20px; text-align: center; color: var(--text-secondary); background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
          <div style="font-size: 40px; margin-bottom: 10px;">🤖</div>
          <div style="font-weight: 700; font-size: 15px; margin-bottom: 6px;">Chưa có quy tắc tự động hóa nào</div>
          <div style="font-size: 12.5px; color: var(--text-muted); margin-bottom: 16px;">Tạo quy tắc đầu tiên để hệ thống tự động xử lý công việc thay bạn!</div>
          <button class="btn btn-primary btn-sm" onclick="App.openAutomationModal()">+ Tạo Quy Tắc Đầu Tiên</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = list.map(rule => this.buildRecipeCardHtml(rule)).join('');
  },

  buildRecipeCardHtml(rule) {
    const triggerMap = {
      task_status_completed: { label: 'Khi công việc chuyển sang "Hoàn thành"', icon: '✅' },
      task_progress_100: { label: 'Khi tiến độ công việc đạt 100%', icon: '💯' },
      task_urgent_created: { label: 'Khi tạo việc mới mức "Khẩn cấp"', icon: '🚨' },
      task_overdue_detected: { label: 'Khi quét phát hiện việc trễ hạn', icon: '⏰' },
      task_unassigned_created: { label: 'Khi việc mới chưa có người phụ trách', icon: '❓' }
    };

    const actionMap = {
      set_progress_100: { label: 'Tự động đặt tiến độ 100% & ghi giờ hoàn tất', icon: '🎯' },
      set_status_review: { label: 'Tự động chuyển việc sang "Chờ duyệt"', icon: '👀' },
      tag_and_alert_admin: { label: 'Gắn thẻ "Ưu Tiên Số 1" & báo động đỏ Admin', icon: '📢' },
      tag_overdue_and_notify: { label: 'Gắn thẻ "Quá hạn" & gửi chuông cảnh báo', icon: '🔔' },
      tag_unassigned_and_notify_dept: { label: 'Gắn thẻ "Chờ nhận việc" & báo phòng ban', icon: '🏢' }
    };

    const triggerInfo = triggerMap[rule.trigger] || { label: rule.trigger, icon: '⚡' };
    const actionInfo = actionMap[rule.action] || { label: rule.action, icon: '⚡' };

    const lastRunStr = rule.lastRunAt 
      ? `• Cuối: ${this.formatRelativeTime(rule.lastRunAt)}` 
      : '• Chưa chạy';

    const color = rule.color || '#3b82f6';
    const icon = rule.icon || '⚡';

    return `
      <div class="automation-recipe-card ${rule.enabled ? '' : 'disabled'}" data-rule-id="${rule.id}">
        <div class="recipe-header">
          <div class="recipe-bot-info">
            <div class="recipe-bot-avatar" style="background: ${color}20; color: ${color}; border: 1px solid ${color}40;">
              ${icon}
            </div>
            <div>
              <h4 class="recipe-bot-title" title="${this.escapeHtml(rule.name)}">${this.escapeHtml(rule.name)}</h4>
              <div class="recipe-bot-meta">Mã bot: <code>${rule.id}</code></div>
            </div>
          </div>
          <label class="toggle-switch-wrap" title="${rule.enabled ? 'Đang bật - Nhấp để tắt' : 'Đang tắt - Nhấp để bật'}">
            <input type="checkbox" data-rule-toggle="${rule.id}" ${rule.enabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>

        <p class="recipe-desc-text">${this.escapeHtml(rule.desc || 'Quy tắc tự động hóa theo thời gian thực.')}</p>

        <div class="recipe-flow-box">
          <div class="flow-step-row">
            <span class="flow-badge when">KHI</span>
            <span class="flow-desc">${triggerInfo.icon} ${this.escapeHtml(triggerInfo.label)}</span>
          </div>
          <div class="flow-divider-arrow">
            <span>⚡ TỰ ĐỘNG THỰC THI ➔</span>
          </div>
          <div class="flow-step-row">
            <span class="flow-badge then">THÌ</span>
            <span class="flow-desc">${actionInfo.icon} ${this.escapeHtml(actionInfo.label)}</span>
          </div>
        </div>

        <div class="recipe-footer-bar">
          <div class="recipe-run-counter">
            <span>⚡ Đã chạy: <strong>${rule.runCount || 0}</strong> lần</span>
            <span>${lastRunStr}</span>
          </div>
          <div class="recipe-actions">
            <button type="button" class="btn-trigger-test" data-trigger-rule="${rule.id}" title="Chạy thử nghiệm ngay lập tức">
              <span>⚡</span><span>Chạy Thử</span>
            </button>
            <button type="button" class="btn btn-outline btn-xs" data-edit-rule="${rule.id}" title="Chỉnh sửa quy tắc" style="padding: 4px 8px; font-size: 11px;">
              ✏️
            </button>
            <button type="button" class="btn btn-outline btn-xs" data-delete-rule="${rule.id}" title="Xóa quy tắc" style="padding: 4px 8px; font-size: 11px; color: var(--danger);">
              🗑️
            </button>
          </div>
        </div>
      </div>
    `;
  },

  updateAutomationMetrics() {
    const list = this.state.automations || [];
    const activeCount = list.filter(r => r.enabled).length;
    const totalRuns = list.reduce((sum, r) => sum + (r.runCount || 0), 0);
    const hoursSaved = Math.round(totalRuns * 0.25 * 10) / 10;

    const statActive = document.getElementById('autoStatActive');
    const statRuns = document.getElementById('autoStatTotalRuns');
    const statHours = document.getElementById('autoStatHoursSaved');
    const badgeCount = document.getElementById('automationCountBadge');

    if (statActive) statActive.innerText = activeCount;
    if (statRuns) statRuns.innerText = totalRuns;
    if (statHours) statHours.innerText = `~${hoursSaved}h`;
    if (badgeCount) badgeCount.innerText = `${list.length} quy tắc`;
  },

  initAutomationLiveFeed() {
    const feed = document.getElementById('automationLiveFeed');
    if (!feed) return;

    if (feed.children.length > 0) return; // already populated

    const sampleFeeds = [
      {
        ruleIcon: '⚡',
        ruleName: 'Tự động hoàn tất 100% khi xong việc',
        taskTitle: 'Thiết kế giao diện Dark Mode',
        details: 'Cập nhật tiến độ 100% & ghi nhận hoàn tất',
        timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString()
      },
      {
        ruleIcon: '🎯',
        ruleName: 'Gắn cờ kiểm duyệt khi tiến độ chạm 100%',
        taskTitle: 'Tích hợp API SSO Google Workspace',
        details: 'Chuyển trạng thái sang "Chờ duyệt"',
        timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString()
      },
      {
        ruleIcon: '⏰',
        ruleName: 'Tự động cảnh báo & gắn tag việc quá hạn',
        taskTitle: 'Báo cáo doanh thu Quý 3',
        details: 'Phát hiện quá hạn chót, kích hoạt cảnh báo tới nhân sự',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
      }
    ];

    feed.innerHTML = sampleFeeds.map(item => {
      const timeStr = new Date(item.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="auto-feed-item">
          <div class="auto-feed-left">
            <span style="font-size:16px;">${item.ruleIcon}</span>
            <div>
              <div><strong>${this.escapeHtml(item.ruleName)}</strong> đã thực thi trên <em>"${this.escapeHtml(item.taskTitle)}"</em></div>
              <div style="font-size:11px; color:var(--text-secondary); margin-top:1px;">${this.escapeHtml(item.details)}</div>
            </div>
          </div>
          <div class="auto-feed-time">${timeStr}</div>
        </div>
      `;
    }).join('');
  },

  appendAutomationLogFeed(item) {
    const feed = document.getElementById('automationLiveFeed');
    if (!feed) return;

    if (feed.querySelector('.feed-empty-state')) {
      feed.innerHTML = '';
    }

    const timeStr = new Date(item.timestamp || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const el = document.createElement('div');
    el.className = 'auto-feed-item';
    el.innerHTML = `
      <div class="auto-feed-left">
        <span style="font-size:16px;">${item.ruleIcon || '⚡'}</span>
        <div>
          <div><strong>${this.escapeHtml(item.ruleName || 'Bot Tự Động')}</strong> đã thực thi trên <em>"${this.escapeHtml(item.taskTitle || 'Công việc')}"</em></div>
          <div style="font-size:11px; color:var(--text-secondary); margin-top:1px;">${this.escapeHtml(item.details || 'Áp dụng quy tắc tự động hóa')}</div>
        </div>
      </div>
      <div class="auto-feed-time">${timeStr}</div>
    `;

    feed.prepend(el);

    while (feed.children.length > 25) {
      feed.removeChild(feed.lastChild);
    }
  },

  handleAutomationExecutedEvent(data) {
    if (!data) return;
    const { ruleId, ruleName, ruleIcon, taskTitle, result, timestamp } = data;

    // Update rule in state
    if (this.state.automations) {
      const rule = this.state.automations.find(r => r.id === ruleId);
      if (rule) {
        rule.runCount = (rule.runCount || 0) + 1;
        rule.lastRunAt = timestamp || new Date().toISOString();
      }
    }

    // Play sparkle audio
    this.playSound('automation');

    // Show toast
    this.showToast(`⚡ Bot "${ruleName || 'Automation'}" vừa tự động chạy trên: ${taskTitle ? '"' + taskTitle + '"' : 'Công việc'}`, 'success');

    // Animate rule card if in DOM
    const cardEl = document.querySelector(`.automation-recipe-card[data-rule-id="${ruleId}"]`);
    if (cardEl) {
      cardEl.classList.remove('anim-executing');
      void cardEl.offsetWidth; // trigger reflow
      cardEl.classList.add('anim-executing');
      setTimeout(() => cardEl.classList.remove('anim-executing'), 1300);

      // update card's run counter in DOM
      const countEl = cardEl.querySelector('.recipe-run-counter strong');
      if (countEl) {
        countEl.innerText = (parseInt(countEl.innerText || '0', 10) + 1);
      }
    }

    // Add to live feed
    this.appendAutomationLogFeed({
      ruleId,
      ruleName: ruleName || 'Bot Tự Động',
      ruleIcon: ruleIcon || '⚡',
      taskTitle: taskTitle || 'Công việc hệ thống',
      details: result ? (result.actionTaken || result.message || 'Thực thi quy tắc') : 'Thực thi quy tắc',
      timestamp: timestamp || new Date().toISOString()
    });

    // Update metrics widgets
    this.updateAutomationMetrics();
  },

  async toggleAutomationRule(id, enabled) {
    try {
      await API.updateAutomation(id, { enabled });
      const rule = (this.state.automations || []).find(r => r.id === id);
      if (rule) rule.enabled = enabled;
      const card = document.querySelector(`.automation-recipe-card[data-rule-id="${id}"]`);
      if (card) {
        card.classList.toggle('disabled', !enabled);
      }
      this.updateAutomationMetrics();
      this.showToast(enabled ? `⚡ Đã kích hoạt quy tắc tự động` : `⏸️ Đã tạm dừng quy tắc tự động`, 'info');
    } catch (err) {
      this.showToast(`Lỗi khi cập nhật quy tắc: ${err.message}`, 'danger');
      this.renderAutomationView();
    }
  },

  async triggerAutomationRule(id) {
    const btn = document.querySelector(`[data-trigger-rule="${id}"]`);
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span style="display:inline-block; animation:spin 1s infinite linear;">⚡</span> Đang chạy...';
    }

    try {
      const res = await API.triggerAutomation(id);
      this.playSound('automation');
      this.showToast(`⚡ ${res.message || 'Đã kích hoạt tự động hóa thành công!'}`, 'success');
      if (res.affectedTask) {
        const idx = this.state.tasks.findIndex(t => t.id === res.affectedTask.id);
        if (idx !== -1) {
          this.state.tasks[idx] = res.affectedTask;
        }
      }
    } catch (err) {
      this.showToast(`Lỗi khi chạy tự động hóa: ${err.message}`, 'danger');
      this.playSound('danger');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  },

  async runAllAutomations() {
    const btn = document.getElementById('btnRunAllAutomations');
    const list = (this.state.automations || []).filter(r => r.enabled);
    if (list.length === 0) {
      this.showToast('Không có quy tắc tự động nào đang được bật!', 'warning');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⚡</span><span>Đang chạy quét quy tắc...</span>';
    }

    try {
      let runCount = 0;
      for (const rule of list) {
        await API.triggerAutomation(rule.id);
        runCount++;
        await new Promise(r => setTimeout(r, 250));
      }
      this.showToast(`🚀 Đã kiểm tra và kích hoạt thành công ${runCount} quy tắc tự động!`, 'success');
      this.playSound('success');
    } catch (err) {
      this.showToast(`Lỗi khi chạy toàn bộ quy tắc: ${err.message}`, 'danger');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>⚡</span><span>Chạy Thử Toàn Bộ</span>';
      }
    }
  },

  openAutomationModal(rule = null) {
    const modalTitle = document.getElementById('autoModalTitle');
    const formId = document.getElementById('autoRuleId');
    const formName = document.getElementById('autoRuleName');
    const formIcon = document.getElementById('autoRuleIcon');
    const formColor = document.getElementById('autoRuleColor');
    const formTrigger = document.getElementById('autoRuleTrigger');
    const formAction = document.getElementById('autoRuleAction');
    const formDesc = document.getElementById('autoRuleDesc');
    const submitBtn = document.getElementById('btnSubmitAutoRule');

    if (rule) {
      if (modalTitle) modalTitle.innerText = 'Chỉnh Sửa Quy Tắc Tự Động Hóa';
      if (formId) formId.value = rule.id;
      if (formName) formName.value = rule.name;
      if (formIcon) formIcon.value = rule.icon || '⚡';
      if (formColor) formColor.value = rule.color || '#3b82f6';
      if (formTrigger) formTrigger.value = rule.trigger;
      if (formAction) formAction.value = rule.action;
      if (formDesc) formDesc.value = rule.desc || '';
      if (submitBtn) submitBtn.innerText = '💾 Lưu Thay Đổi Quy Tắc';
    } else {
      if (modalTitle) modalTitle.innerText = 'Tạo Quy Tắc Tự Động Hóa Mới';
      if (formId) formId.value = '';
      if (formName) formName.value = '';
      if (formIcon) formIcon.value = '⚡';
      if (formColor) formColor.value = '#3b82f6';
      if (formTrigger) formTrigger.value = 'task_status_completed';
      if (formAction) formAction.value = 'set_progress_100';
      if (formDesc) formDesc.value = '';
      if (submitBtn) submitBtn.innerText = '⚡ Tạo & Kích Hoạt Quy Tắc';
    }

    this.openModal('automationModal');
  },

  async handleAutomationFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('autoRuleId')?.value;
    const name = document.getElementById('autoRuleName')?.value.trim();
    const icon = document.getElementById('autoRuleIcon')?.value || '⚡';
    const color = document.getElementById('autoRuleColor')?.value || '#3b82f6';
    const trigger = document.getElementById('autoRuleTrigger')?.value;
    const action = document.getElementById('autoRuleAction')?.value;
    const desc = document.getElementById('autoRuleDesc')?.value.trim();

    if (!name) {
      this.showToast('Vui lòng nhập tên quy tắc / bot!', 'warning');
      return;
    }

    const payload = {
      name,
      icon,
      color,
      trigger,
      action,
      desc
    };

    try {
      if (id) {
        await API.updateAutomation(id, payload);
        this.showToast('✅ Đã cập nhật quy tắc tự động hóa!', 'success');
      } else {
        await API.createAutomation(payload);
        this.showToast('⚡ Đã tạo quy tắc tự động hóa mới thành công!', 'success');
      }
      this.closeModal('automationModal');
      await this.loadAutomations();
      this.renderAutomationView();
    } catch (err) {
      this.showToast(`Lỗi lưu quy tắc: ${err.message}`, 'danger');
    }
  },

  async deleteAutomationRule(id) {
    const rule = (this.state.automations || []).find(r => r.id === id);
    const ruleName = rule ? rule.name : `#${id}`;
    if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn quy tắc "${ruleName}"?`)) return;

    try {
      await API.deleteAutomation(id);
      this.showToast(`🗑️ Đã xóa quy tắc "${ruleName}"`, 'warning');
      await this.loadAutomations();
      this.renderAutomationView();
    } catch (err) {
      this.showToast(`Lỗi khi xóa quy tắc: ${err.message}`, 'danger');
    }
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
  },

  // =============================================================
  // GOOGLE CALENDAR SYNC & AUTOMATED REMINDERS MODULE
  // =============================================================
  activeGcalTab: 'sync',
  calendarSettings: null,
  localRemindersSent: new Set(),
  reminderMonitorInterval: null,

  async openGoogleCalendarModal() {
    const user = this.state.user;
    if (!user) {
      this.showToast('Vui lòng đăng nhập để sử dụng tính năng đồng bộ lịch', 'warning');
      return;
    }

    // Populate user profile info in modal
    const avatarEl = document.getElementById('gcalUserAvatar');
    const nameEl = document.getElementById('gcalUserName');
    const roleDeptEl = document.getElementById('gcalUserRoleDept');
    if (avatarEl) avatarEl.innerText = user.avatar || '👤';
    if (nameEl) nameEl.innerText = user.name;
    if (roleDeptEl) roleDeptEl.innerText = `${user.role === 'admin' ? 'Quản Trị Viên' : (user.role === 'manager' ? 'Trưởng Phòng' : 'Nhân Viên')} • ${user.department || 'Nội bộ'}`;

    try {
      const res = await API.getCalendarSettings(user.id);
      this.calendarSettings = res.settings || {};

      const emailInput = document.getElementById('gcalEmailInput');
      if (emailInput) {
        emailInput.value = this.calendarSettings.email || user.email || '';
      }

      const feedInput = document.getElementById('gcalFeedUrlInput');
      if (feedInput) {
        feedInput.value = res.feedUrl || '';
      }

      const subscribeBtn = document.getElementById('gcalSubscribeLinkBtn');
      if (subscribeBtn) {
        subscribeBtn.href = res.googleCalendarSubscribeUrl || '#';
      }

      // Reminders configuration
      const toggle = document.getElementById('gcalRemindersToggle');
      if (toggle) {
        toggle.checked = this.calendarSettings.enabled !== false;
      }

      const reminderTimes = this.calendarSettings.reminderTimes || [1440, 120, 30];
      [1440, 120, 60, 30, 15, 2880].forEach(t => {
        const cb = document.getElementById(`remindTime${t}`);
        if (cb) cb.checked = reminderTimes.includes(t);
      });

      const notifyBrowserCb = document.getElementById('gcalNotifyBrowser');
      if (notifyBrowserCb) notifyBrowserCb.checked = this.calendarSettings.notifyBrowser !== false;

      const notifySoundCb = document.getElementById('gcalNotifySound');
      if (notifySoundCb) notifySoundCb.checked = this.calendarSettings.notifySound !== false;

      this.switchGcalTab('sync');
      this.openModal('googleCalendarModal');
    } catch (err) {
      console.error('Error loading calendar settings:', err);
      this.showToast(`Lỗi tải cài đặt lịch: ${err.message}`, 'danger');
    }
  },

  switchGcalTab(tab) {
    this.activeGcalTab = tab;
    const tabSync = document.getElementById('tabContentGcalSync');
    const tabReminders = document.getElementById('tabContentGcalReminders');
    const btnSync = document.getElementById('tabBtnGcalSync');
    const btnReminders = document.getElementById('tabBtnGcalReminders');

    if (tab === 'sync') {
      if (tabSync) tabSync.style.display = 'block';
      if (tabReminders) tabReminders.style.display = 'none';
      if (btnSync) { btnSync.classList.add('active'); btnSync.style.borderColor = 'var(--primary)'; btnSync.style.color = 'var(--primary)'; }
      if (btnReminders) { btnReminders.classList.remove('active'); btnReminders.style.borderColor = 'var(--border-color)'; btnReminders.style.color = 'inherit'; }
    } else {
      if (tabSync) tabSync.style.display = 'none';
      if (tabReminders) tabReminders.style.display = 'block';
      if (btnSync) { btnSync.classList.remove('active'); btnSync.style.borderColor = 'var(--border-color)'; btnSync.style.color = 'inherit'; }
      if (btnReminders) { btnReminders.classList.add('active'); btnReminders.style.borderColor = 'var(--primary)'; btnReminders.style.color = 'var(--primary)'; }
    }
  },

  copyGcalFeedUrl() {
    const input = document.getElementById('gcalFeedUrlInput');
    if (!input || !input.value) return;
    navigator.clipboard.writeText(input.value).then(() => {
      this.showToast('📋 Đã sao chép link đăng ký Google Calendar vào bộ nhớ tạm!', 'success');
      this.playSound('success');
    }).catch(() => {
      input.select();
      document.execCommand('copy');
      this.showToast('📋 Đã sao chép link vào bộ nhớ tạm!', 'success');
    });
  },

  downloadIcsFile() {
    const token = API.getToken();
    const url = '/api/calendar/download-ics';
    fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => {
        if (!res.ok) throw new Error('Không thể tải file lịch');
        return res.blob();
      })
      .then(blob => {
        const objUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objUrl;
        link.download = `TaskFlow-${(this.state.user?.name || 'calendar').replace(/\s+/g, '_')}.ics`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objUrl);
        this.showToast('📥 Đã tải file lịch .ICS thành công!', 'success');
        this.playSound('success');
      })
      .catch(err => {
        this.showToast(`Lỗi tải file ICS: ${err.message}`, 'danger');
      });
  },

  openGoogleCalendarSubscribe() {
    const feedInput = document.getElementById('gcalFeedUrlInput');
    const feedUrl = feedInput ? feedInput.value : '';

    if (feedUrl) {
      navigator.clipboard.writeText(feedUrl).catch(() => {
        if (feedInput) {
          feedInput.select();
          document.execCommand('copy');
        }
      });
    }

    const linkBtn = document.getElementById('gcalSubscribeLinkBtn');
    const targetUrl = (linkBtn && linkBtn.href && linkBtn.href !== '#')
      ? linkBtn.href
      : 'https://calendar.google.com/calendar/u/0/r/settings/addbyurl';

    window.open(targetUrl, '_blank');
    this.showToast('📋 Đã tự động sao chép Link Lịch! Google Calendar đang mở, chỉ cần dán (Ctrl+V) vào ô URL rồi bấm "Thêm lịch" là hoàn tất.', 'info');
    API.syncCalendarNow().catch(() => {});
  },

  async saveGoogleCalendarSettings() {
    const user = this.state.user;
    if (!user) return;

    const email = document.getElementById('gcalEmailInput')?.value?.trim() || user.email;
    const enabled = document.getElementById('gcalRemindersToggle')?.checked ?? true;
    const notifyBrowser = document.getElementById('gcalNotifyBrowser')?.checked ?? true;
    const notifySound = document.getElementById('gcalNotifySound')?.checked ?? true;

    const reminderTimes = [];
    [1440, 120, 60, 30, 15, 2880].forEach(t => {
      const cb = document.getElementById(`remindTime${t}`);
      if (cb && cb.checked) reminderTimes.push(t);
    });

    try {
      if (notifyBrowser && 'Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      await API.updateCalendarSettings(user.id, {
        email,
        enabled,
        reminderTimes,
        notifyBrowser,
        notifySound
      });

      this.showToast('💾 Đã lưu cấu hình đồng bộ Google Calendar & nhắc lịch tự động thành công!', 'success');
      this.playSound('success');
      this.closeModal('googleCalendarModal');
    } catch (err) {
      this.showToast(`Lỗi lưu cấu hình: ${err.message}`, 'danger');
    }
  },

  async testCalendarReminder() {
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      await API.testCalendarReminder();
      this.playSound('reminder');

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('⏰ [THỬ NGHIỆM] NHẮC LỊCH GOOGLE CALENDAR', {
          body: 'Tính năng nhắc lịch tự động cho công việc của bạn đã sẵn sàng hoạt động!',
          icon: 'favicon.ico'
        });
      }

      this.showToast('🔔 Đã kích hoạt thử nghiệm chuông & nhắc lịch tự động thành công!', 'warning');
    } catch (err) {
      this.showToast(`Lỗi thử nghiệm: ${err.message}`, 'danger');
    }
  },

  openCurrentTaskGoogleCalendar() {
    const task = this.state.currentDetailTask;
    if (!task) return;
    this.openTaskGoogleCalendar(task);
  },

  openTaskGoogleCalendar(task) {
    if (!task) return;
    const pad = n => String(n).padStart(2, '0');
    const formatIcsUtc = (dStr) => {
      const d = new Date(dStr || Date.now());
      if (isNaN(d.getTime())) return null;
      return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' +
             pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';
    };

    const startUtc = formatIcsUtc(task.startDate) || formatIcsUtc(new Date());
    const dueUtc = formatIcsUtc(task.dueDate) || formatIcsUtc(new Date(Date.now() + 86400000));
    const title = encodeURIComponent(`[TaskFlow] ${task.title}`);

    // Look up assigned user to pre-fill as Guest in Google Calendar so it automatically saves to their calendar
    const assignedUser = this.state.users.find(u => u.id === task.assignedTo);
    const guestParam = assignedUser && assignedUser.email ? `&add=${encodeURIComponent(assignedUser.email)}` : '';

    const details = encodeURIComponent(
      `Mã công việc: #${task.id}\n` +
      `Người phụ trách: ${assignedUser ? assignedUser.name + ' (' + assignedUser.email + ')' : 'Chưa giao'}\n` +
      `Mức độ ưu tiên: ${(task.priority || 'medium').toUpperCase()}\n` +
      `Phòng ban: ${task.department || ''}\n` +
      `Tiến độ: ${task.progress || 0}%\n` +
      `Trạng thái: ${task.status || 'todo'}\n\n` +
      `Mô tả:\n${task.description || 'Không có mô tả chi tiết'}\n\n` +
      `---\nĐược tạo tự động từ TaskFlow Pro Webapp`
    );

    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startUtc}/${dueUtc}&details=${details}${guestParam}`;
    window.open(url, '_blank');
    this.showToast(`💡 Việc này đã được tự động đồng bộ trên Google Calendar của ${assignedUser?.name || 'nhân sự'}. Đang mở trang tùy chọn...`, 'info');
  },

  downloadTaskIcs(taskId = null) {
    const id = taskId || this.state.currentDetailTask?.id;
    if (!id) return;
    const token = API.getToken();
    const url = `/api/tasks/${id}/ics`;
    fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => {
        if (!res.ok) throw new Error('Không thể tải file lịch');
        return res.blob();
      })
      .then(blob => {
        const objUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objUrl;
        link.download = `Task-${id}.ics`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objUrl);
        this.showToast(`📥 Đã tải file lịch công việc #${id}! Mở file để lưu ngay vào Lịch của bạn.`, 'success');
        this.playSound('success');
      })
      .catch(err => {
        this.showToast(`Lỗi tải lịch: ${err.message}`, 'danger');
      });
  },

  handleCalendarReminderEvent(data) {
    if (!data) return;
    const task = data.task || {};
    const timeLabel = data.timeLabel || 'Sắp đến hạn';

    // Play pleasant reminder chime
    this.playSound('reminder');

    // Show native browser notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`⏰ NHẮC LỊCH: ${task.title || 'Công việc sắp đến hạn'}`, {
          body: `Chỉ còn ${timeLabel} nữa là đến hạn chót! Bấm để xem trên Web App.`,
          icon: 'favicon.ico',
          tag: `task-${task.id}`
        });
      } catch (e) {}
    }

    // High visibility toast
    this.showToast(`⏰ [NHẮC LỊCH] "${task.title || 'Công việc'}" chỉ còn ${timeLabel} nữa là đến hạn!`, 'warning');

    // Update notifications list
    if (data.notification) {
      this.state.notifications.unshift(data.notification);
      this.updateNotificationBadge();
    }
  },

  startCalendarReminderMonitor() {
    if (this.reminderMonitorInterval) return;

    // Check every 30 seconds
    this.reminderMonitorInterval = setInterval(() => {
      if (!this.state.user || !this.state.tasks || this.state.tasks.length === 0) return;

      const now = Date.now();
      const userTasks = this.state.tasks.filter(t => 
        t.status !== 'completed' && t.dueDate && 
        (t.assignedTo === this.state.user.id || t.createdBy === this.state.user.id)
      );

      const reminderTimes = this.calendarSettings?.reminderTimes || [1440, 120, 30];

      userTasks.forEach(task => {
        const due = new Date(task.dueDate).getTime();
        if (isNaN(due)) return;
        const diffMinutes = Math.round((due - now) / 60000);
        if (diffMinutes <= 0) return;

        reminderTimes.forEach(threshold => {
          if (Math.abs(diffMinutes - threshold) <= 2) {
            const key = `local-remind-${task.id}-${threshold}`;
            if (!this.localRemindersSent.has(key)) {
              this.localRemindersSent.add(key);

              let timeLabel = `${threshold} phút`;
              if (threshold >= 1440 && threshold % 1440 === 0) {
                timeLabel = `${threshold / 1440} ngày`;
              } else if (threshold >= 60 && threshold % 60 === 0) {
                timeLabel = `${threshold / 60} giờ`;
              }

              this.playSound('reminder');
              this.showToast(`⏰ [NHẮC LỊCH] "${task.title}" chỉ còn ${timeLabel} nữa là đến hạn chót!`, 'warning');

              if ('Notification' in window && Notification.permission === 'granted') {
                try {
                  new Notification(`⏰ NHẮC LỊCH: ${task.title}`, {
                    body: `Chỉ còn ${timeLabel} nữa là đến hạn chót (Hạn: ${new Date(task.dueDate).toLocaleDateString('vi-VN')})`,
                    icon: 'favicon.ico',
                    tag: `task-${task.id}`
                  });
                } catch (e) {}
              }
            }
          }
        });
      });
    }, 30 * 1000);
  },

  // -------------------------------------------------------------
  // EXECUTIVE DESK (BÀN LÀM VIỆC ĐIỀU HÀNH & TRỢ LÝ AI)
  // -------------------------------------------------------------
  async renderExecutiveDeskView() {
    const user = this.state.user;
    const canAccess = user && (user.role === 'admin' || (user.permissions && user.permissions.canAccessExecutiveDesk === true));
    
    const accessDeniedEl = document.getElementById('executiveDeskAccessDenied');
    const mainContentEl = document.getElementById('executiveDeskMainContent');

    if (!canAccess) {
      if (accessDeniedEl) accessDeniedEl.style.display = 'block';
      if (mainContentEl) mainContentEl.style.display = 'none';
      return;
    }

    if (accessDeniedEl) accessDeniedEl.style.display = 'none';
    if (mainContentEl) mainContentEl.style.display = 'block';

    // Populate department filter dropdown
    this.populateExecutiveDeptDropdown();

    try {
      const targetDept = this.state.executiveTargetDept || 'all';
      const data = await API.getExecutiveDeskAnalytics(targetDept);
      this.state.executiveDeskData = data;

      // Scope Text
      const scopeText = document.getElementById('executiveScopeDeptText');
      if (scopeText) {
        scopeText.innerText = data.scope?.deptName || 'Toàn Doanh Nghiệp (16 Phòng Ban)';
      }

      // Update KPIs
      const kpis = data.kpis || {};
      const elHealth = document.getElementById('exeKpiHealthScore');
      const elHealthSub = document.getElementById('exeKpiHealthSub');
      if (elHealth) {
        elHealth.innerText = `${kpis.enterpriseHealthScore || 0}/100`;
        elHealth.style.color = (kpis.enterpriseHealthScore >= 75) ? '#10b981' : (kpis.enterpriseHealthScore >= 55 ? '#f59e0b' : '#ef4444');
      }
      if (elHealthSub) {
        elHealthSub.innerText = `Tỷ lệ đúng hạn toàn hệ thống: ${kpis.onTimeRateOverall || 0}%`;
      }

      const elStaff = document.getElementById('exeKpiDelayedStaff');
      const elStaffSub = document.getElementById('exeKpiDelayedStaffSub');
      if (elStaff) elStaff.innerText = kpis.highRiskPersonnelCount || 0;
      if (elStaffSub) elStaffSub.innerText = `${kpis.warningPersonnelCount || 0} nhân sự ở mức Cảnh báo`;

      const elForecast = document.getElementById('exeKpiForecastOverdue');
      const elForecastSub = document.getElementById('exeKpiForecastOverdueSub');
      if (elForecast) elForecast.innerText = kpis.totalOverdueCount || 0;
      if (elForecastSub) elForecastSub.innerText = `Việc đang quá hạn trên ${kpis.activeTasksCount || 0} việc đang chạy`;

      const elDepts = document.getElementById('exeKpiCriticalDepts');
      const elDeptsSub = document.getElementById('exeKpiCriticalDeptsSub');
      if (elDepts) elDepts.innerText = kpis.criticalDeptsCount || 0;
      if (elDeptsSub) elDeptsSub.innerText = `Trên tổng số ${data.departmentForecasts?.length || 16} phòng ban`;

      // Top Urgent Matters Banner
      this.renderExecutiveUrgentBanner(data.topUrgentMatters || []);

      // Badges on sub-tabs
      const pBadge = document.getElementById('exePersonnelTabBadge');
      if (pBadge) pBadge.innerText = kpis.highRiskPersonnelCount || 0;

      const rBadge = document.getElementById('exeRebalanceBadge');
      if (rBadge) rBadge.innerText = (data.rebalanceSuggestions || []).length;

      // Render Active Sub-tab
      this.renderActiveExecutiveSubTab();

    } catch (err) {
      console.error('Error loading executive desk analytics:', err);
      this.showToast(`Lỗi tải dữ liệu Bàn Làm Việc: ${err.message}`, 'danger');
    }
  },

  populateExecutiveDeptDropdown() {
    const select = document.getElementById('executiveDeptFilter');
    if (!select || select.dataset.populated === 'true') return;

    const depts = this.state.departments || [];
    let html = `<option value="all">🏢 Tất cả 16 phòng ban</option>`;
    depts.forEach(d => {
      html += `<option value="${this.escapeHtml(d.name)}">${this.escapeHtml(d.name)}</option>`;
    });
    select.innerHTML = html;
    select.value = this.state.executiveTargetDept || 'all';
    select.dataset.populated = 'true';
  },

  onExecutiveDeptFilterChange(dept) {
    this.state.executiveTargetDept = dept;
    this.renderExecutiveDeskView();
  },

  renderExecutiveUrgentBanner(urgentMatters = []) {
    const banner = document.getElementById('executiveUrgentBanner');
    const container = document.getElementById('exeUrgentListContainer');
    const countBadge = document.getElementById('exeUrgentCountBadge');
    if (!banner || !container) return;

    if (!urgentMatters || urgentMatters.length === 0) {
      banner.style.display = 'none';
      return;
    }

    banner.style.display = 'block';
    if (countBadge) countBadge.innerText = `${urgentMatters.length} việc khẩn cấp`;

    container.innerHTML = urgentMatters.map(m => `
      <div class="executive-urgent-item">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:16px;">🔴</span>
          <div>
            <div style="font-weight:700; font-size:13px; color:var(--text-main);">${this.escapeHtml(m.title)} <span style="font-size:11px; color:var(--text-muted);">(#${m.id})</span></div>
            <div style="font-size:11.5px; color:var(--text-secondary); margin-top:2px;">
              Phụ trách: <strong>${this.escapeHtml(m.assigneeName)}</strong> | Phòng ban: <strong>${this.escapeHtml(m.department)}</strong> | Hạn: <span style="color:#dc2626; font-weight:700;">${m.dueDate ? new Date(m.dueDate).toLocaleDateString('vi-VN') : 'N/A'}</span>
            </div>
          </div>
        </div>
        <div style="display:flex; gap:6px;">
          <button type="button" class="btn btn-outline btn-xs" onclick="App.openTaskDetail('${m.id}')" style="font-weight:600;">
            🔍 Xem Chi Tiết
          </button>
        </div>
      </div>
    `).join('');
  },

  switchExecutiveSubTab(tabName) {
    this.state.executiveSubTab = tabName;
    ['personnel', 'forecast', 'rebalance', 'assistant', 'poster'].forEach(t => {
      const btn = document.getElementById(`exeTabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
      const content = document.getElementById(`exeSubContent${t.charAt(0).toUpperCase() + t.slice(1)}`);
      if (btn) btn.classList.toggle('active', t === tabName);
      if (content) content.style.display = (t === tabName) ? 'block' : 'none';
    });
    this.renderActiveExecutiveSubTab();
  },

  renderActiveExecutiveSubTab() {
    const data = this.state.executiveDeskData;
    if (!data) return;

    switch (this.state.executiveSubTab) {
      case 'personnel':
        this.renderExecutivePersonnelGrid(data.personnelList || []);
        break;
      case 'forecast':
        this.renderExecutiveDeptForecasts(data.departmentForecasts || []);
        this.renderExecutiveDeptChart(data.departmentForecasts || []);
        break;
      case 'rebalance':
        this.renderExecutiveRebalanceTable(data.rebalanceSuggestions || []);
        break;
      case 'assistant':
        break;
      case 'poster':
        this.initPosterCanvasGenerator();
        break;
    }
  },

  filterExecutivePersonnel(filter) {
    this.state.executiveRiskFilter = filter;
    ['all', 'critical', 'warning', 'healthy'].forEach(f => {
      const btn = document.getElementById(`exeRiskFilter${f.charAt(0).toUpperCase() + f.slice(1)}`);
      if (btn) btn.classList.toggle('active', f === filter);
    });
    if (this.state.executiveDeskData) {
      this.renderExecutivePersonnelGrid(this.state.executiveDeskData.personnelList || []);
    }
  },

  renderExecutivePersonnelGrid(personnelList = []) {
    const grid = document.getElementById('executivePersonnelGrid');
    if (!grid) return;

    const filter = this.state.executiveRiskFilter || 'all';
    const filtered = filter === 'all' 
      ? personnelList 
      : personnelList.filter(p => p.riskLevel === filter);

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="text-align:center; padding:40px; color:var(--text-muted); grid-column:1/-1; background:var(--card-bg); border:1px solid var(--border-color); border-radius:var(--radius-sm);">
          🎉 Không có nhân sự nào trong nhóm lọc này!
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(p => {
      const u = p.user;
      const s = p.stats;
      const riskClass = p.riskLevel;
      const riskLabel = riskClass === 'critical' ? '🔴 RỦI RO CAO' : (riskClass === 'warning' ? '🟡 CẢNH BÁO' : '🟢 AN TOÀN');

      const overdueListHtml = (p.overdueTasks || []).slice(0, 3).map(t => `
        <div class="personnel-task-item" onclick="App.openTaskDetail('${t.id}')" style="cursor:pointer;" title="Bấm để xem chi tiết task">
          <div class="title">#${t.id}: ${this.escapeHtml(t.title)}</div>
          <div class="days">Trễ ${t.daysOverdue} ngày</div>
        </div>
      `).join('');

      const remainingOverdue = (p.overdueTasks || []).length - 3;
      const moreOverdueHtml = remainingOverdue > 0 
        ? `<div style="font-size:11px; text-align:center; color:var(--text-muted); padding:2px;">+ và ${remainingOverdue} việc quá hạn khác...</div>` 
        : '';

      return `
        <div class="executive-personnel-card ${riskClass}">
          <div class="personnel-card-header">
            <div class="personnel-profile">
              <div class="personnel-avatar">${u.avatar}</div>
              <div>
                <div class="personnel-name">${this.escapeHtml(u.name)}</div>
                <div class="personnel-role-dept">${this.escapeHtml(u.position)} • <strong>${this.escapeHtml(u.department)}</strong></div>
              </div>
            </div>
            <span class="risk-badge ${riskClass}">${riskLabel}</span>
          </div>

          <div class="personnel-stats-row">
            <div class="personnel-stat-box">
              <div class="num" style="color:#ef4444;">${s.overdueCount}</div>
              <div class="lbl">Việc trễ hạn</div>
            </div>
            <div class="personnel-stat-box">
              <div class="num">${s.activeTasks}</div>
              <div class="lbl">Đang chạy</div>
            </div>
            <div class="personnel-stat-box">
              <div class="num" style="color:#10b981;">${s.onTimeRate}%</div>
              <div class="lbl">Tỷ lệ đúng hạn</div>
            </div>
            <div class="personnel-stat-box">
              <div class="num" style="color:#8b5cf6;">${p.riskScore}</div>
              <div class="lbl">Điểm rủi ro AI</div>
            </div>
          </div>

          <!-- AI Root Cause Diagnostics -->
          <div class="ai-diagnostics-box">
            <div class="ai-box-title">
              <span>🧠 Chẩn đoán AI nguyên nhân:</span>
            </div>
            <div class="ai-box-desc">
              ${(p.rootCauses || []).map(r => `<div>${r}</div>`).join('') || 'Tiến độ đồng đều, không ghi nhận bất thường.'}
            </div>
          </div>

          <!-- AI Smart Action Recommendation -->
          <div class="ai-action-box">
            <div class="ai-box-title">
              <span>⚡ Hành động AI đề xuất cho Lãnh đạo:</span>
            </div>
            <div class="ai-box-desc" style="font-weight:600;">
              ${p.recommendedAction}
            </div>
          </div>

          <!-- Task Mini List if overdue -->
          ${s.overdueCount > 0 ? `
            <div style="font-size:11.5px; font-weight:700; color:var(--text-secondary); margin-bottom:6px;">
              Danh sách việc quá hạn cần xử lý:
            </div>
            <div class="personnel-task-list">
              ${overdueListHtml}
              ${moreOverdueHtml}
            </div>
          ` : ''}

          <div style="margin-top:auto; padding-top:12px; border-top:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <span style="font-size:11px; color:var(--text-muted);">${u.email}</span>
            <div style="display:flex; gap:6px;">
              ${s.overdueCount > 0 || riskClass === 'critical' ? `
                <button type="button" class="btn btn-xs" onclick="App.openExecutiveWarRoomModal(null, '${u.id}')" style="background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; font-weight:700;" title="Kích hoạt phòng họp Google Meet 1-1 với nhân sự này">
                  📹 Họp 1-1
                </button>
              ` : ''}
              <button type="button" class="btn btn-outline btn-xs" onclick="App.switchExecutiveSubTab('rebalance')" title="Chuyển sang công cụ Cân bằng tải">
                ⚖️ San việc
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  renderExecutiveDeptForecasts(departmentForecasts = []) {
    const grid = document.getElementById('executiveDeptGrid');
    if (!grid) return;

    grid.innerHTML = departmentForecasts.map(d => {
      const statusClass = d.healthStatus;
      const statusLabel = statusClass === 'critical' ? '🔴 NGUY CƠ CAO' : (statusClass === 'warning' ? '🟡 CẦN CHÚ Ý' : (statusClass === 'excellent' ? '🟢 XUẤT SẮC' : '🔵 ỔN ĐỊNH'));

      return `
        <div class="executive-dept-card">
          <div class="dept-card-header">
            <div>
              <div class="dept-name">${this.escapeHtml(d.name)}</div>
              <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">
                Nhân sự: <strong>${d.memberCount}</strong> người | Tải: <strong>${d.stats.workloadRatio}</strong> việc/người (${d.capacityStatus})
              </div>
            </div>
            <span class="dept-score-badge risk-badge ${statusClass}">
              ${d.healthScore}/100 • ${statusLabel}
            </span>
          </div>

          <div class="personnel-stats-row">
            <div class="personnel-stat-box">
              <div class="num">${d.stats.totalTasks}</div>
              <div class="lbl">Tổng việc</div>
            </div>
            <div class="personnel-stat-box">
              <div class="num" style="color:#ef4444;">${d.stats.overdueTasks}</div>
              <div class="lbl">Trễ hạn (${d.stats.overdueRate}%)</div>
            </div>
            <div class="personnel-stat-box">
              <div class="num" style="color:#f59e0b;">${d.stats.reviewTasks}</div>
              <div class="lbl">Chờ duyệt</div>
            </div>
            <div class="personnel-stat-box">
              <div class="num" style="color:#10b981;">${d.stats.completedTasks}</div>
              <div class="lbl">Hoàn thành</div>
            </div>
          </div>

          <!-- Bottlenecks -->
          <div class="ai-diagnostics-box" style="margin-bottom:8px;">
            <div class="ai-box-title" style="color:#dc2626;">
              <span>🚨 Nút thắt quy trình phát hiện được:</span>
            </div>
            <div class="ai-box-desc">
              ${(d.bottlenecks || []).map(b => `<div>${b}</div>`).join('')}
            </div>
          </div>

          <!-- AI Forecast 7 - 30 days -->
          <div style="background:rgba(59,130,246,0.06); border:1px solid rgba(59,130,246,0.25); border-radius:var(--radius-sm); padding:10px 12px; margin-bottom:8px;">
            <div class="ai-box-title" style="color:#2563eb;">
              <span>🔮 Dự báo AI 7 ngày tới:</span>
            </div>
            <div class="ai-box-desc">
              ${d.forecast7Days.summary}
            </div>
            <div style="font-size:11.5px; color:var(--text-secondary); margin-top:4px;">
              Triển vọng tháng (30 ngày): <em>${d.forecast30Days.riskAlert}</em>
            </div>
          </div>

          <!-- Strategic Advisory -->
          <div class="ai-action-box" style="margin-top:auto; margin-bottom:8px;">
            <div class="ai-box-title">
              <span>💡 Khuyến nghị chiến lược cho Ban Lãnh Đạo:</span>
            </div>
            <div class="ai-box-desc">
              ${d.aiAdvisory}
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end;">
            <button type="button" class="btn btn-outline btn-xs" onclick="App.openExecutiveWarRoomModal('${this.escapeHtml(d.name)}')" style="color:#059669; border-color:#6ee7b7; font-weight:700;">
              📹 Họp Ban ${this.escapeHtml(d.name)}
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  renderExecutiveDeptChart(departmentForecasts = []) {
    const canvas = document.getElementById('executiveDeptChart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (this.state.executiveDeptChartInstance) {
      this.state.executiveDeptChartInstance.destroy();
      this.state.executiveDeptChartInstance = null;
    }

    const topDepts = departmentForecasts.slice(0, 10);
    const labels = topDepts.map(d => d.name.replace('Phòng ', '').replace('Ban Giám Đốc ', 'BGĐ '));
    const healthScores = topDepts.map(d => d.healthScore);
    const overdueRates = topDepts.map(d => d.stats.overdueRate);

    const ctx = canvas.getContext('2d');
    this.state.executiveDeptChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Điểm Sức Khỏe (Health Score / 100)',
            data: healthScores,
            backgroundColor: healthScores.map(s => s >= 75 ? 'rgba(16, 185, 129, 0.7)' : (s >= 55 ? 'rgba(245, 158, 11, 0.7)' : 'rgba(239, 68, 68, 0.7)')),
            borderColor: healthScores.map(s => s >= 75 ? '#10b981' : (s >= 55 ? '#f59e0b' : '#ef4444')),
            borderWidth: 1.5,
            borderRadius: 4
          },
          {
            label: 'Tỷ Lệ Quá Hạn (%)',
            data: overdueRates,
            type: 'line',
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            borderWidth: 2,
            tension: 0.3,
            fill: false,
            pointRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: val => `${val}`
            }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 12,
              font: { size: 12 }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => `${context.dataset.label}: ${context.raw}`
            }
          }
        }
      }
    });
  },

  renderExecutiveRebalanceTable(suggestions = []) {
    const tbody = document.getElementById('executiveRebalanceTableBody');
    if (!tbody) return;

    if (!suggestions || suggestions.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; padding:35px; color:var(--text-muted);">
            🎉 Khối lượng công việc toàn doanh nghiệp đang ở trạng thái tương đối cân bằng! Chưa phát hiện điểm lệch tải cần can thiệp.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = suggestions.map((s, idx) => `
      <tr>
        <td>
          <strong>${this.escapeHtml(s.department)}</strong>
        </td>
        <td>
          <div style="font-weight:700; color:var(--text-main);">#${s.taskId}: ${this.escapeHtml(s.taskTitle)}</div>
          <span class="badge-priority ${s.priority || 'medium'}" style="font-size:10.5px; padding:2px 6px;">${(s.priority || 'medium').toUpperCase()}</span>
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="color:#ef4444; font-weight:700;">${s.fromUser.avatar} ${this.escapeHtml(s.fromUser.name)}</span>
            <span>➔</span>
            <span style="color:#10b981; font-weight:700;">${s.toUser.avatar} ${this.escapeHtml(s.toUser.name)}</span>
          </div>
        </td>
        <td>
          <div style="font-size:12px; color:var(--text-secondary); line-height:1.4;">${s.reason}</div>
        </td>
        <td style="text-align:center;">
          <button type="button" class="btn btn-sm btn-primary" onclick="App.confirmAndExecuteRebalance('${s.taskId}', '${s.toUser.id}', '${this.escapeHtml(s.taskTitle)}', '${this.escapeHtml(s.toUser.name)}')" style="white-space:nowrap; font-weight:700; background:linear-gradient(135deg, #8b5cf6, #3b82f6); border:none;">
            ⚡ Chuyển Việc
          </button>
        </td>
      </tr>
    `).join('');
  },

  async confirmAndExecuteRebalance(taskId, targetUserId, taskTitle, targetUserName) {
    if (!confirm(`Xác nhận thực hiện điều phối công việc:\n\nChuyển việc #${taskId}: "${taskTitle}" sang cho nhân sự [${targetUserName}]?`)) {
      return;
    }

    try {
      const res = await API.rebalanceExecutiveDeskTask(taskId, targetUserId);
      this.showToast(`🎉 ${res.message || 'Đã tái phân bổ công việc thành công!'}`, 'success');
      // Reload current analytics
      this.renderExecutiveDeskView();
    } catch (err) {
      this.showToast(`Lỗi khi chuyển việc: ${err.message}`, 'danger');
    }
  },

  askExecutiveAiPrompt(promptText) {
    const input = document.getElementById('executiveAiInput');
    if (input) {
      input.value = promptText;
      this.handleExecutiveAiSubmit(new Event('submit'));
    }
  },

  async handleExecutiveAiSubmit(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('executiveAiInput');
    const box = document.getElementById('executiveAiResponseBox');
    const btn = document.getElementById('btnExecutiveAiSend');
    if (!input || !box) return;

    const question = input.value.trim();
    if (!question) return;

    box.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px; color:#7c3aed; font-weight:600;">
        <span class="spinner" style="width:18px; height:18px; border-width:2px;"></span>
        <span>Trợ Lý AI đang phân tích toàn bộ dữ liệu thời gian thực...</span>
      </div>
    `;
    if (btn) btn.disabled = true;

    try {
      const targetDept = this.state.executiveTargetDept || 'all';
      const res = await API.askExecutiveDeskAi(question, targetDept);
      
      // Render simple markdown conversion
      let answerHtml = res.answer || 'Không có phản hồi từ AI.';
      answerHtml = answerHtml
        .replace(/^### (.*$)/gim, '<h3 style="margin:10px 0 6px 0; font-size:15px; font-weight:800; color:#7c3aed;">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 style="margin:12px 0 8px 0; font-size:16px; font-weight:800;">$1</h2>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n\n/g, '<div style="margin-bottom:8px;"></div>')
        .replace(/\n/g, '<br>');

      box.innerHTML = answerHtml;
    } catch (err) {
      box.innerHTML = `<div style="color:#ef4444; font-weight:600;">❌ Lỗi: ${err.message}</div>`;
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  openExecutiveBriefingModal() {
    const data = this.state.executiveDeskData;
    const modal = document.getElementById('executiveBriefingModal');
    const body = document.getElementById('briefingModalBody');
    const timeEl = document.getElementById('briefingModalTime');
    if (!modal || !body) return;

    const summary = data?.executiveSummary;
    if (!summary) {
      this.showToast('Chưa có dữ liệu bản tin AI. Vui lòng làm mới dữ liệu trước.', 'warning');
      return;
    }

    if (timeEl) {
      timeEl.innerText = `Cập nhật: ${new Date(summary.generatedAt).toLocaleString('vi-VN')} | Phạm vi: ${data.scope?.deptName || 'Toàn công ty'}`;
    }

    body.innerHTML = `
      <div style="background:var(--bg-main); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:16px; margin-bottom:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <span style="font-weight:800; font-size:13.5px; color:var(--text-main);">🎯 ĐIỂM SỨC KHỎE DOANH NGHIỆP:</span>
          <span class="badge" style="background:#7c3aed; color:#fff; font-weight:800; font-size:13px; padding:4px 10px; border-radius:12px;">
            ${summary.healthScore}/100 • ${summary.healthLabel}
          </span>
        </div>
        <div style="font-size:13px; color:var(--text-main); line-height:1.6;">
          ${summary.narrative}
        </div>
      </div>

      <div style="margin-bottom:18px;">
        <h4 style="margin:0 0 10px 0; font-size:14px; font-weight:800; color:#7c3aed;">
          📋 3 HÀNH ĐỘNG CHỈ ĐẠO TRỌNG TÂM CHO LÃNH ĐẠO HÔM NAY:
        </h4>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${(summary.topDecisions || []).map((d, i) => `
            <div style="background:var(--card-bg); border:1px solid var(--border-color); border-left:4px solid #7c3aed; border-radius:var(--radius-sm); padding:10px 14px; font-size:12.5px; font-weight:600; line-height:1.5;">
              <strong>${i + 1}.</strong> ${d}
            </div>
          `).join('')}
        </div>
      </div>

      <div style="background:rgba(239, 68, 68, 0.05); border:1px solid rgba(239, 68, 68, 0.25); border-radius:var(--radius-sm); padding:12px 14px; font-size:12px; color:var(--text-secondary);">
        💡 <em>Bản tin này được tạo tự động bởi Trí Tuệ Nhân Tạo (Executive AI Engine) dựa trên tiến độ và nhật ký thực thi thực tế của 16 phòng ban.</em>
      </div>
    `;

    this.openModal('executiveBriefingModal');
  },

  copyBriefingContent() {
    const data = this.state.executiveDeskData?.executiveSummary;
    if (!data) return;

    const text = `=== BẢN TIN GIAO BAN ĐIỀU HÀNH AI (TASKFLOW PRO) ===\n` +
      `Điểm sức khỏe: ${data.healthScore}/100 (${data.healthLabel})\n\n` +
      `Tình hình chung:\n${data.narrative}\n\n` +
      `3 Hành động chỉ đạo trọng tâm:\n` +
      (data.topDecisions || []).map((d, i) => `${i + 1}. ${d}`).join('\n');

    navigator.clipboard.writeText(text).then(() => {
      this.showToast('📋 Đã sao chép nội dung Bản tin Điều hành vào Clipboard!', 'success');
    }).catch(() => {
      this.showToast('Không thể tự động sao chép. Vui lòng bôi đen và copy thủ công.', 'warning');
    });
  },

  // -----------------------------------------------------------
  // EXECUTIVE AI WAR-ROOM (HỌP KHẨN CẤP GOOGLE MEET)
  // -----------------------------------------------------------
  openExecutiveWarRoomModal(targetDept = null, targetUserId = null) {
    const data = this.state.executiveDeskData;
    if (!data) {
      this.showToast('Đang tải dữ liệu Bàn làm việc AI, vui lòng thử lại sau giây lát...', 'warning');
      return;
    }

    // Default Meet URL with clean structured identifier
    const randomCode = `vmg-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}`;
    const meetInput = document.getElementById('warroomMeetUrlInput');
    if (meetInput) {
      meetInput.value = `https://meet.google.com/${randomCode}`;
    }

    // AI Agenda generation
    const agendaEl = document.getElementById('warroomAgendaContent');
    const urgentMatters = data.urgentMatters || [];
    const highRiskStaff = (data.personnelList || []).filter(p => p.riskClass === 'critical');
    const scopeDept = targetDept || (this.state.executiveTargetDept && this.state.executiveTargetDept !== 'all' ? this.state.executiveTargetDept : 'Toàn Doanh Nghiệp (16 Phòng Ban)');

    let agendaHtml = `
      <div style="font-weight:700; color:#1e1b4b; margin-bottom:6px;">📋 NỘI DUNG HỌP ĐIỀU HÀNH & GIẢI CỨU TIẾN ĐỘ [${this.escapeHtml(scopeDept)}]:</div>
      <ul style="margin:0 0 10px 18px; padding:0;">
        <li><strong>Tình hình chung:</strong> Điểm sức khỏe vận hành ${data.kpis?.enterpriseHealthScore || 0}/100. Hiện có ${urgentMatters.length} điểm nóng khẩn cấp và ${highRiskStaff.length} nhân sự thuộc diện rủi ro trễ hạn cao.</li>
        ${urgentMatters.length > 0 ? `<li><strong>Các đầu việc nghẽn ưu tiên số 1:</strong> ${urgentMatters.map(m => `<b>#${m.id}</b> (${this.escapeHtml(m.title)}) - Phụ trách: <i>${this.escapeHtml(m.assigneeName)}</i>`).join('; ')}</li>` : '<li>Không có đầu việc khẩn cấp bị nghẽn nghiêm trọng.</li>'}
        <li><strong>Mục tiêu buổi họp:</strong> Tháo gỡ ngay các nút thắt nghiệm thu, phê duyệt tái phân bổ công việc và chốt hạn hoàn thành dứt điểm trong 24h-48h.</li>
      </ul>
    `;
    if (agendaEl) agendaEl.innerHTML = agendaHtml;

    // Personnel Attendees List
    const attendeeContainer = document.getElementById('warroomAttendeeList');
    const attendeeCountEl = document.getElementById('warroomAttendeeCount');
    const allUsers = this.state.users || [];
    
    // Determine pre-selected users
    const preselectedUserIds = new Set();
    if (targetUserId) {
      preselectedUserIds.add(targetUserId);
    } else if (targetDept && targetDept !== 'all') {
      allUsers.filter(u => u.department === targetDept).forEach(u => preselectedUserIds.add(u.id));
    } else {
      highRiskStaff.forEach(p => preselectedUserIds.add(p.id));
      urgentMatters.forEach(m => {
        const u = allUsers.find(x => x.name === m.assigneeName);
        if (u) preselectedUserIds.add(u.id);
      });
      // Include admins
      allUsers.filter(u => u.role === 'admin').forEach(u => preselectedUserIds.add(u.id));
    }

    if (attendeeContainer) {
      attendeeContainer.innerHTML = allUsers.map(u => {
        const isChecked = preselectedUserIds.has(u.id);
        const isHighRisk = highRiskStaff.some(p => p.id === u.id);
        return `
          <label class="warroom-attendee-item ${isChecked ? 'is-selected' : ''}">
            <input type="checkbox" class="warroom-user-chk" value="${u.id}" ${isChecked ? 'checked' : ''} onchange="App.onWarRoomAttendeeToggle(this)">
            <span>${u.avatar || '👤'}</span>
            <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              <strong>${this.escapeHtml(u.name)}</strong>
              <div style="font-size:10.5px; color:var(--text-muted);">${this.escapeHtml(u.department || 'N/A')}</div>
            </div>
            ${isHighRisk ? '<span class="badge" style="background:#fee2e2; color:#ef4444; font-size:10px; padding:1px 5px;">🚨 Trễ hạn</span>' : ''}
          </label>
        `;
      }).join('');
    }

    if (attendeeCountEl) {
      attendeeCountEl.innerText = preselectedUserIds.size;
    }

    this.openModal('executiveWarRoomModal');
  },

  onWarRoomAttendeeToggle(input) {
    const parent = input.closest('.warroom-attendee-item');
    if (parent) {
      parent.classList.toggle('is-selected', input.checked);
    }
    const checked = document.querySelectorAll('.warroom-user-chk:checked');
    const attendeeCountEl = document.getElementById('warroomAttendeeCount');
    if (attendeeCountEl) attendeeCountEl.innerText = checked.length;
  },

  toggleAllWarRoomAttendees() {
    const checkboxes = document.querySelectorAll('.warroom-user-chk');
    const anyUnchecked = Array.from(checkboxes).some(c => !c.checked);
    checkboxes.forEach(c => {
      c.checked = anyUnchecked;
      const parent = c.closest('.warroom-attendee-item');
      if (parent) parent.classList.toggle('is-selected', anyUnchecked);
    });
    const attendeeCountEl = document.getElementById('warroomAttendeeCount');
    if (attendeeCountEl) attendeeCountEl.innerText = anyUnchecked ? checkboxes.length : 0;
  },

  generateNewWarRoomMeetLink() {
    const randomCode = `vmg-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}`;
    const url = `https://meet.google.com/${randomCode}`;
    const input = document.getElementById('warroomMeetUrlInput');
    if (input) input.value = url;
    this.showToast('Đã sinh mã phòng Google Meet mới!', 'info');
  },

  joinWarRoomMeet() {
    const input = document.getElementById('warroomMeetUrlInput');
    const url = input && input.value.trim() ? input.value.trim() : 'https://meet.google.com/new';
    window.open(url, '_blank');
  },

  copyWarRoomMeetLink() {
    const input = document.getElementById('warroomMeetUrlInput');
    if (input && input.value.trim()) {
      this.copyText(input.value.trim(), 'Đã sao chép liên kết phòng họp Google Meet!');
    }
  },

  async submitSummonWarRoom() {
    const input = document.getElementById('warroomMeetUrlInput');
    const meetUrl = input ? input.value.trim() : '';
    if (!meetUrl) {
      this.showToast('Vui lòng nhập liên kết Google Meet trước khi phát lệnh!', 'warning');
      return;
    }

    const checkedInputs = document.querySelectorAll('.warroom-user-chk:checked');
    const targetUserIds = Array.from(checkedInputs).map(c => c.value);
    if (targetUserIds.length === 0) {
      this.showToast('Vui lòng chọn ít nhất một nhân sự nhận lệnh triệu tập!', 'warning');
      return;
    }

    const btn = document.getElementById('btnSummonWarRoom');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ Đang phát lệnh...';
    }

    try {
      const res = await API.summonExecutiveWarRoom({
        meetUrl,
        title: '🚨 TRIỆU TẬP HỌP KHẨN CẤP GOOGLE MEET (BÀN LÀM VIỆC ĐIỀU HÀNH)',
        agenda: 'Rà soát và giải tỏa các điểm nghẽn công việc quá hạn khẩn cấp.',
        targetUserIds,
        department: this.state.executiveTargetDept || 'all'
      });

      this.showToast(`📢 ${res.message || 'Đã phát lệnh triệu tập thành công!'}`, 'success');
      this.playSound('alert');

      // Tự động mở Google Meet cho người triệu tập
      window.open(meetUrl, '_blank');
      this.closeModal('executiveWarRoomModal');
    } catch (err) {
      this.showToast('Lỗi phát lệnh: ' + err.message, 'danger');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '📢 PHÁT LỆNH TRIỆU TẬP KHẨN CẤP';
      }
    }
  },

  copyWarRoomBriefingForChat() {
    const input = document.getElementById('warroomMeetUrlInput');
    const meetUrl = input ? input.value.trim() : '';
    const data = this.state.executiveDeskData;
    const health = data?.kpis?.enterpriseHealthScore || 0;
    const urgentCount = data?.urgentMatters?.length || 0;
    
    const text = `🚨 [THÔNG BÁO TRIỆU TẬP HỌP KHẨN CẤP - VMG EXECUTIVE AI]\n` +
      `-------------------------------------------\n` +
      `📌 Chủ đề: Họp tháo gỡ điểm nghẽn & xử lý việc quá hạn\n` +
      `🎯 Tình trạng: ${urgentCount} việc khẩn cấp cần giải cứu | Điểm SK: ${health}/100\n` +
      `📹 Link tham gia Google Meet: ${meetUrl}\n` +
      `⏰ Thời gian: Vào phòng họp ngay lập tức\n` +
      `-------------------------------------------\n` +
      `Đề nghị các nhân sự nhận thông báo có mặt đầy đủ!`;

    this.copyText(text, 'Đã sao chép nội dung triệu tập họp! Hãy dán vào Zalo hoặc Telegram.');
  },

  handleExecutiveWarRoomSummon(data) {
    if (!data || !this.state.user) return;
    const myId = this.state.user.id;
    const isTarget = data.targetUserIds && data.targetUserIds.includes(myId);
    const isAdmin = this.state.user.role === 'admin';
    
    if (isTarget || isAdmin) {
      this.playSound('alert');
      this.renderWarRoomEmergencyBanner(data);
    }
  },

  renderWarRoomEmergencyBanner(data) {
    const existing = document.getElementById('liveWarRoomEmergencyBanner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'liveWarRoomEmergencyBanner';
    banner.className = 'war-room-broadcast-banner';
    banner.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px;">
        <span style="font-size:26px;">🚨</span>
        <div>
          <div style="font-weight:800; font-size:14px; text-transform:uppercase; letter-spacing:0.5px;">${this.escapeHtml(data.title)}</div>
          <div style="font-size:12px; opacity:0.9; margin-top:2px;">
            ${this.escapeHtml(data.sender ? data.sender.name : 'Ban Giám Đốc')} yêu cầu bạn tham gia họp Google Meet khẩn cấp ngay bây giờ!
          </div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <a href="${this.escapeHtml(data.meetUrl)}" target="_blank" onclick="document.getElementById('liveWarRoomEmergencyBanner').remove();" class="btn btn-sm" style="background:#10b981; color:#fff; font-weight:800; padding:8px 16px; border:none; border-radius:8px; text-decoration:none; white-space:nowrap; box-shadow:0 2px 8px rgba(16,185,129,0.4);">
          🚀 VÀO HỌP NGAY
        </a>
        <button type="button" onclick="document.getElementById('liveWarRoomEmergencyBanner').remove();" style="background:transparent; border:none; color:#fff; font-size:20px; cursor:pointer; padding:0 6px;">
          &times;
        </button>
      </div>
    `;
    document.body.appendChild(banner);
  },

  printExecutiveDeskReport() {
    window.print();
  },

  // -------------------------------------------------------------
  // VMG PRE-LOGIN ANNOUNCEMENT POSTER & CANVAS GENERATOR
  // -------------------------------------------------------------
  async checkAndShowPreLoginPoster() {
    try {
      const res = await API.getAnnouncementPoster();
      if (!res || !res.poster) return;
      this.state.currentPoster = res.poster;

      if (res.poster.active) {
        const dismissKey = 'vmg_poster_dismissed_' + (res.poster.updatedAt || 'latest');
        const isDismissed = localStorage.getItem(dismissKey) === 'true';

        if (!isDismissed) {
          const overlay = document.getElementById('preLoginPosterOverlay');
          const img = document.getElementById('preLoginPosterImg');
          const badge = document.getElementById('preLoginBadgeText');
          const title = document.getElementById('preLoginHeaderTitle');

          if (badge) badge.innerText = res.poster.badgeText || 'NHIỆM VỤ ĐẶC BIỆT';
          if (title) title.innerText = res.poster.title || 'Thông Báo Từ Ban Giám Đốc';

          const posterSrc = res.poster.imageUrl || res.poster.imageDataUrl;
          if (posterSrc) {
            if (img) {
              img.onerror = () => {
                this.drawPosterToCanvas(res.poster, (url) => {
                  if (img) img.src = url;
                });
              };
              img.src = posterSrc;
            }
            if (overlay) overlay.style.display = 'flex';
          } else {
            // Draw immediately on the fly
            this.drawPosterToCanvas(res.poster, (url) => {
              if (img) img.src = url;
              if (overlay) overlay.style.display = 'flex';
            });
          }
        }
      }
    } catch (e) {
      console.warn('Could not check announcement poster:', e);
    }
  },

  dismissPreLoginPoster() {
    const overlay = document.getElementById('preLoginPosterOverlay');
    const chk = document.getElementById('chkDismissPosterToday');
    if (overlay) overlay.style.display = 'none';

    if (chk && chk.checked && this.state.currentPoster?.updatedAt) {
      localStorage.setItem('vmg_poster_dismissed_' + this.state.currentPoster.updatedAt, 'true');
    }

    const emailInput = document.getElementById('loginEmail');
    if (emailInput) emailInput.focus();
  },

  downloadActivePoster() {
    const dataUrl = this.state.generatedPosterDataUrl || this.state.currentPoster?.imageUrl || this.state.currentPoster?.imageDataUrl;
    if (!dataUrl) {
      this.showToast('Chưa có ảnh poster để tải về.', 'warning');
      return;
    }

    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `VMG-Thong-Bao-Nhiem-Vu-Dac-Biet-${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    this.showToast('📥 Đang tải poster ảnh VMG về máy...', 'success');
  },

  openFullPosterModal() {
    const dataUrl = this.state.generatedPosterDataUrl || this.state.currentPoster?.imageUrl || this.state.currentPoster?.imageDataUrl;
    const fullImg = document.getElementById('fullPosterModalImg');
    if (fullImg && dataUrl) {
      fullImg.src = dataUrl;
      this.openModal('fullPosterModal');
    }
  },

  previewPreLoginPosterModal() {
    const dataUrl = this.state.generatedPosterDataUrl || this.state.currentPoster?.imageUrl || this.state.currentPoster?.imageDataUrl;
    if (!dataUrl) {
      this.showToast('Vui lòng đợi ảnh poster vẽ xong trước khi xem thử.', 'warning');
      return;
    }
    const overlay = document.getElementById('preLoginPosterOverlay');
    const img = document.getElementById('preLoginPosterImg');
    const badge = document.getElementById('preLoginBadgeText');
    const title = document.getElementById('preLoginHeaderTitle');

    if (img) img.src = dataUrl;
    if (badge) badge.innerText = document.getElementById('posterTypeSelect')?.selectedOptions[0]?.text || 'NHIỆM VỤ ĐẶC BIỆT';
    if (title) title.innerText = document.getElementById('posterTitleInput')?.value || 'Thông Báo Từ Ban Giám Đốc';

    if (overlay) overlay.style.display = 'flex';
  },

  async initPosterCanvasGenerator() {
    try {
      if (!this.state.currentPoster) {
        const res = await API.getAnnouncementPoster();
        this.state.currentPoster = res?.poster || null;
      }
    } catch (e) {
      console.warn('Error loading poster data:', e);
    }

    const p = this.state.currentPoster || {
      active: true,
      type: 'special_mission',
      title: 'CHIẾN DỊCH CAO ĐIỂM QUÝ IV / 2026',
      subtitle: 'TĂNG TỐC HOÀN THÀNH 100% MỤC TIÊU TUYỂN SINH & ĐÀO TẠO',
      message: 'Toàn thể Cán bộ - Nhân viên VMG English tập trung cao độ, chủ động tháo gỡ điểm nghẽn, đẩy nhanh tiến độ các dự án trọng điểm theo chỉ đạo trực tiếp từ Ban Giám Đốc.',
      details: [
        'Tập trung xử lý dứt điểm 100% công việc quá hạn trong 48 giờ tới',
        'Phối hợp liên phòng ban chặt chẽ giữa Khối Tuyển Sinh, Marketing và Đào Tạo',
        'Cập nhật tiến độ hàng ngày và tuân thủ báo cáo nghiêm ngặt trên TaskFlow'
      ],
      deadline: '2026-11-15',
      issuedBy: 'BAN GIÁM ĐỐC VMG',
      theme: 'vmg_classic'
    };

    const toggle = document.getElementById('posterActiveToggle');
    const typeSelect = document.getElementById('posterTypeSelect');
    const themeSelect = document.getElementById('posterThemeSelect');
    const titleInput = document.getElementById('posterTitleInput');
    const subInput = document.getElementById('posterSubtitleInput');
    const msgInput = document.getElementById('posterMessageInput');
    const d1 = document.getElementById('posterDetail1');
    const d2 = document.getElementById('posterDetail2');
    const d3 = document.getElementById('posterDetail3');
    const deadInput = document.getElementById('posterDeadlineInput');
    const issueInput = document.getElementById('posterIssuedByInput');

    if (toggle) toggle.checked = Boolean(p.active);
    this.onPosterActiveToggle(Boolean(p.active));

    if (typeSelect) typeSelect.value = p.type || 'special_mission';
    if (themeSelect) themeSelect.value = p.theme || 'vmg_classic';
    if (titleInput) titleInput.value = p.title || '';
    if (subInput) subInput.value = p.subtitle || '';
    if (msgInput) msgInput.value = p.message || '';
    if (d1) d1.value = p.details?.[0] || '';
    if (d2) d2.value = p.details?.[1] || '';
    if (d3) d3.value = p.details?.[2] || '';
    if (deadInput) deadInput.value = p.deadline || '';
    if (issueInput) issueInput.value = p.issuedBy || 'BAN GIÁM ĐỐC VMG';

    this.renderPosterCanvas();
  },

  onPosterActiveToggle(checked) {
    const textEl = document.getElementById('posterActiveStatusText');
    const badgeEl = document.getElementById('exePosterStatusBadge');
    if (textEl) {
      textEl.innerText = checked ? '🟢 Đang Kích Hoạt Trước Đăng Nhập' : '⚪ Đang Tạm Ẩn';
      textEl.style.color = checked ? '#10b981' : 'var(--text-muted)';
    }
    if (badgeEl) {
      badgeEl.innerText = checked ? 'BẬT' : 'TẮT';
      badgeEl.style.background = checked ? '#10b981' : '#64748b';
    }
  },

  posterDebounceTimer: null,
  onPosterFormChange() {
    clearTimeout(this.posterDebounceTimer);
    this.posterDebounceTimer = setTimeout(() => {
      this.renderPosterCanvas();
    }, 120);
  },

  renderPosterCanvas() {
    return this.drawPosterToCanvas();
  },

  drawPosterToCanvas(posterObj = null, callback = null) {
    return new Promise((resolve) => {
      const canvas = document.getElementById('posterCanvas');
      const previewImg = document.getElementById('posterLivePreviewImg');
      if (!canvas) {
        if (typeof callback === 'function') callback('');
        return resolve('');
      }

      const ctx = canvas.getContext('2d');
      const W = canvas.width;
      const H = canvas.height;

      const p = posterObj || {};
      const theme = document.getElementById('posterThemeSelect')?.value || p.theme || 'vmg_classic';
      const typeLabel = document.getElementById('posterTypeSelect')?.selectedOptions[0]?.text || p.badgeText || '⚡ NHIỆM VỤ ĐẶC BIỆT';
      const title = (document.getElementById('posterTitleInput')?.value || p.title || 'CHIẾN DỊCH CAO ĐIỂM QUÝ IV / 2026').toUpperCase();
      const subtitle = (document.getElementById('posterSubtitleInput')?.value || p.subtitle || '').toUpperCase();
      const message = document.getElementById('posterMessageInput')?.value || p.message || '';
      const d1 = document.getElementById('posterDetail1')?.value || p.details?.[0] || '';
      const d2 = document.getElementById('posterDetail2')?.value || p.details?.[1] || '';
      const d3 = document.getElementById('posterDetail3')?.value || p.details?.[2] || '';
      const deadline = document.getElementById('posterDeadlineInput')?.value || p.deadline || '';
      const issuedBy = (document.getElementById('posterIssuedByInput')?.value || p.issuedBy || 'BAN GIÁM ĐỐC VMG').toUpperCase();

      // 1. Background & Border
      if (theme === 'vmg_royal_dark') {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#0f172a');
        grad.addColorStop(1, '#1e1b4b');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(16, 16, W - 32, H - 32);

        ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(22, 22, W - 44, H - 44);
      } else if (theme === 'vmg_minimal_white') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        ctx.strokeStyle = '#a61d24';
        ctx.lineWidth = 3;
        ctx.strokeRect(16, 16, W - 32, H - 32);
      } else {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(1, '#fbf8f2');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        ctx.strokeStyle = '#a61d24';
        ctx.lineWidth = 3.5;
        ctx.strokeRect(16, 16, W - 32, H - 32);

        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(23, 23, W - 46, H - 46);

        const drawDiamond = (cx, cy) => {
          ctx.fillStyle = '#d4af37';
          ctx.beginPath();
          ctx.moveTo(cx, cy - 5);
          ctx.lineTo(cx + 5, cy);
          ctx.lineTo(cx, cy + 5);
          ctx.lineTo(cx - 5, cy);
          ctx.closePath();
          ctx.fill();
        };
        drawDiamond(23, 23);
        drawDiamond(W - 23, 23);
        drawDiamond(23, H - 23);
        drawDiamond(W - 23, H - 23);
      }

      const wrapText = (text, x, y, maxWidth, lineHeight, font, color, align = 'center') => {
        ctx.font = font;
        ctx.fillStyle = color;
        ctx.textAlign = align;
        const words = (text || '').split(' ');
        let line = '';
        let curY = y;
        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line.trim(), x, curY);
            line = words[n] + ' ';
            curY += lineHeight;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line.trim(), x, curY);
        return curY;
      };

      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      logoImg.src = (theme === 'vmg_royal_dark') ? 'images/vmg-logo-white.png' : 'images/vmg-logo-red.png';

      const drawPosterContent = () => {
        // Draw Logo
        const logoW = 180;
        const logoH = 101;
        const logoX = (W - logoW) / 2;
        const logoY = 38;
        try {
          if (logoImg.naturalWidth) {
            ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);
          }
        } catch (e) {}

        // Divider line under logo
        ctx.strokeStyle = (theme === 'vmg_royal_dark') ? '#d4af37' : '#c5a059';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(140, 155);
        ctx.lineTo(W - 140, 155);
        ctx.stroke();

        // Center ornament
        ctx.fillStyle = (theme === 'vmg_royal_dark') ? '#fbbf24' : '#a61d24';
        ctx.font = 'bold 12px serif';
        ctx.textAlign = 'center';
        ctx.fillText('◆  VMG ENGLISH  ◆', W / 2, 172);

        // Badge Pill
        const badgeY = 195;
        const badgeW = 280;
        const badgeH = 32;
        const badgeX = (W - badgeW) / 2;

        ctx.fillStyle = (theme === 'vmg_royal_dark') ? '#d4af37' : '#a61d24';
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 16);
        ctx.fill();

        ctx.fillStyle = (theme === 'vmg_royal_dark') ? '#0f172a' : '#ffffff';
        ctx.font = 'bold 13px "Inter", "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(typeLabel, W / 2, badgeY + 21);

        // Title
        const titleColor = (theme === 'vmg_royal_dark') ? '#ffffff' : '#a61d24';
        let titleEndY = wrapText(title, W / 2, 268, 680, 36, 'bold 27px "Inter", "Segoe UI", Arial, sans-serif', titleColor, 'center');

        // Subtitle
        let subEndY = titleEndY;
        if (subtitle) {
          const subColor = (theme === 'vmg_royal_dark') ? '#fbbf24' : '#475569';
          subEndY = wrapText(subtitle, W / 2, titleEndY + 32, 680, 24, 'bold 15px "Inter", "Segoe UI", Arial, sans-serif', subColor, 'center');
        }

        // Separator line
        const sepY = subEndY + 22;
        ctx.strokeStyle = (theme === 'vmg_royal_dark') ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(180, sepY);
        ctx.lineTo(W - 180, sepY);
        ctx.stroke();

        // Message Paragraph
        const msgColor = (theme === 'vmg_royal_dark') ? '#e2e8f0' : '#334155';
        let msgEndY = wrapText(`"${message}"`, W / 2, sepY + 28, 660, 25, 'italic 15.5px "Inter", "Segoe UI", Arial, sans-serif', msgColor, 'center');

        // Directive Points Box
        const boxY = Math.max(msgEndY + 24, 490);
        const boxW = 680;
        const boxH = 200;
        const boxX = (W - boxW) / 2;

        ctx.fillStyle = (theme === 'vmg_royal_dark') ? 'rgba(255,255,255,0.05)' : '#faf7f0';
        ctx.strokeStyle = (theme === 'vmg_royal_dark') ? 'rgba(212,175,55,0.4)' : '#e5d7be';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = (theme === 'vmg_royal_dark') ? '#fbbf24' : '#a61d24';
        ctx.font = 'bold 13px "Inter", "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('🎯 CÁC MỤC TIÊU & NHIỆM VỤ TRỌNG TÂM:', boxX + 24, boxY + 34);

        ctx.strokeStyle = (theme === 'vmg_royal_dark') ? 'rgba(255,255,255,0.1)' : '#e8decb';
        ctx.beginPath();
        ctx.moveTo(boxX + 24, boxY + 44);
        ctx.lineTo(boxX + boxW - 24, boxY + 44);
        ctx.stroke();

        const items = [d1, d2, d3].filter(Boolean);
        const itemTextColor = (theme === 'vmg_royal_dark') ? '#f1f5f9' : '#1e293b';
        const bulletColor = (theme === 'vmg_royal_dark') ? '#fbbf24' : '#a61d24';

        items.forEach((item, idx) => {
          const itemY = boxY + 76 + (idx * 40);
          ctx.fillStyle = bulletColor;
          ctx.beginPath();
          ctx.arc(boxX + 32, itemY - 4, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = '600 14px "Inter", "Segoe UI", Arial, sans-serif';
          ctx.fillStyle = itemTextColor;
          ctx.fillText(item, boxX + 48, itemY);
        });

        // Footer Section
        const footY = 825;
        ctx.strokeStyle = (theme === 'vmg_royal_dark') ? 'rgba(212,175,55,0.4)' : '#d4af37';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(60, footY);
        ctx.lineTo(W - 60, footY);
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.fillStyle = (theme === 'vmg_royal_dark') ? '#94a3b8' : '#64748b';
        ctx.font = 'bold 11.5px "Inter", "Segoe UI", Arial, sans-serif';
        ctx.fillText('ĐỐI TƯỢNG THỰC HIỆN:', 60, footY + 30);

        ctx.fillStyle = (theme === 'vmg_royal_dark') ? '#f8fafc' : '#1e293b';
        ctx.font = 'bold 13px "Inter", "Segoe UI", Arial, sans-serif';
        ctx.fillText('Toàn thể Cán bộ - Nhân viên VMG English', 60, footY + 48);

        if (deadline) {
          ctx.fillStyle = (theme === 'vmg_royal_dark') ? '#94a3b8' : '#64748b';
          ctx.font = 'bold 11.5px "Inter", "Segoe UI", Arial, sans-serif';
          ctx.fillText('HẠN CHÓT HOÀN THÀNH:', 60, footY + 76);

          ctx.fillStyle = '#dc2626';
          ctx.font = 'bold 14px "Inter", "Segoe UI", Arial, sans-serif';
          ctx.fillText(`📅 ${new Date(deadline).toLocaleDateString('vi-VN')}`, 60, footY + 96);
        }

        ctx.textAlign = 'right';
        ctx.fillStyle = (theme === 'vmg_royal_dark') ? '#94a3b8' : '#64748b';
        ctx.font = 'bold 11.5px "Inter", "Segoe UI", Arial, sans-serif';
        ctx.fillText('CHỈ ĐẠO BAN HÀNH:', W - 60, footY + 30);

        ctx.fillStyle = (theme === 'vmg_royal_dark') ? '#fbbf24' : '#a61d24';
        ctx.font = 'bold 15px "Inter", "Segoe UI", Arial, sans-serif';
        ctx.fillText(issuedBy, W - 60, footY + 50);

        // Stamp
        ctx.save();
        ctx.translate(W - 170, footY + 85);
        ctx.rotate(-4 * Math.PI / 180);
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-80, -18, 160, 36);

        ctx.fillStyle = '#dc2626';
        ctx.font = 'bold 11px "Inter", "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★ ĐÃ BAN HÀNH ★', 0, -2);
        ctx.font = '9px "Inter", "Segoe UI", Arial, sans-serif';
        ctx.fillText(new Date().toLocaleDateString('vi-VN'), 0, 10);
        ctx.restore();

        let dataUrl = '';
        try {
          dataUrl = canvas.toDataURL('image/png');
          this.state.generatedPosterDataUrl = dataUrl;
          if (previewImg) previewImg.src = dataUrl;
        } catch (err) {
          console.warn('Canvas export warning:', err);
        }
        if (typeof callback === 'function') callback(dataUrl);
        resolve(dataUrl);
      };

      if (logoImg.complete) {
        drawPosterContent();
      } else {
        logoImg.onload = drawPosterContent;
        logoImg.onerror = drawPosterContent;
      }
    });
  },

  async savePosterAnnouncement(e) {
    if (e) e.preventDefault();
    const btn = document.getElementById('btnSavePoster');
    if (btn) btn.disabled = true;

    try {
      const generatedUrl = await this.renderPosterCanvas();

      const posterData = {
        active: Boolean(document.getElementById('posterActiveToggle')?.checked),
        type: document.getElementById('posterTypeSelect')?.value || 'special_mission',
        badgeText: document.getElementById('posterTypeSelect')?.selectedOptions[0]?.text || '⚡ NHIỆM VỤ ĐẶC BIỆT',
        theme: document.getElementById('posterThemeSelect')?.value || 'vmg_classic',
        title: document.getElementById('posterTitleInput')?.value || '',
        subtitle: document.getElementById('posterSubtitleInput')?.value || '',
        message: document.getElementById('posterMessageInput')?.value || '',
        details: [
          document.getElementById('posterDetail1')?.value || '',
          document.getElementById('posterDetail2')?.value || '',
          document.getElementById('posterDetail3')?.value || ''
        ].filter(Boolean),
        deadline: document.getElementById('posterDeadlineInput')?.value || '',
        issuedBy: document.getElementById('posterIssuedByInput')?.value || 'BAN GIÁM ĐỐC VMG',
        imageDataUrl: generatedUrl || this.state.generatedPosterDataUrl || ''
      };

      const res = await API.updateAnnouncementPoster(posterData);
      this.state.currentPoster = res.poster;

      this.showToast('🎉 Đã lưu và xuất bản Poster Thông Báo lên trang đăng nhập thành công!', 'success');
      this.onPosterActiveToggle(Boolean(res.poster?.active));
    } catch (err) {
      this.showToast(`Lỗi khi lưu poster: ${err.message}`, 'danger');
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  fillAiSamplePosterContent() {
    const samples = [
      {
        type: 'special_mission',
        theme: 'vmg_classic',
        title: 'CHIẾN DỊCH CAO ĐIỂM QUÝ IV / 2026',
        subtitle: 'TĂNG TỐC HOÀN THÀNH 100% CHỈ TIÊU & MỤC TIÊU NĂM',
        message: 'Toàn thể Cán bộ - Nhân viên VMG English tập trung cao độ, chủ động tháo gỡ điểm nghẽn, tăng tốc hoàn thành các chỉ tiêu trọng điểm theo chỉ đạo trực tiếp từ Ban Giám Đốc.',
        d1: 'Tập trung xử lý dứt điểm 100% công việc quá hạn trong 48 giờ tới',
        d2: 'Phối hợp liên phòng ban chặt chẽ giữa Tuyển Sinh, Marketing và Đào Tạo',
        d3: 'Cập nhật tiến độ hàng ngày và thực hiện báo cáo nghiêm túc trên TaskFlow',
        deadline: '2026-11-15'
      },
      {
        type: 'urgent_alert',
        theme: 'vmg_royal_dark',
        title: 'THÔNG BÁO KHẨN CẤP: NÂNG CẤP HỆ THỐNG',
        subtitle: 'CHUYỂN ĐỔI SỐ TOÀN DIỆN HỆ THỐNG VMG ENGLISH',
        message: 'Ban Lãnh Đạo yêu cầu các Khối/Phòng ban hoàn tất đồng bộ dữ liệu và chuẩn hóa quy trình báo cáo trên hệ thống mới đúng hạn định.',
        d1: 'Rà soát và nghiệm thu các đầu việc đang ở trạng thái Chờ Duyệt',
        d2: 'Kiểm tra tài khoản và xác nhận kết nối Lịch Google Calendar cá nhân',
        d3: 'Trực kỹ thuật 24/7 hỗ trợ toàn bộ các trung tâm khu vực',
        deadline: '2026-10-31'
      }
    ];

    const pick = samples[Math.floor(Math.random() * samples.length)];
    const typeSelect = document.getElementById('posterTypeSelect');
    const themeSelect = document.getElementById('posterThemeSelect');
    const titleInput = document.getElementById('posterTitleInput');
    const subInput = document.getElementById('posterSubtitleInput');
    const msgInput = document.getElementById('posterMessageInput');
    const d1 = document.getElementById('posterDetail1');
    const d2 = document.getElementById('posterDetail2');
    const d3 = document.getElementById('posterDetail3');
    const deadInput = document.getElementById('posterDeadlineInput');

    if (typeSelect) typeSelect.value = pick.type;
    if (themeSelect) themeSelect.value = pick.theme;
    if (titleInput) titleInput.value = pick.title;
    if (subInput) subInput.value = pick.subtitle;
    if (msgInput) msgInput.value = pick.message;
    if (d1) d1.value = pick.d1;
    if (d2) d2.value = pick.d2;
    if (d3) d3.value = pick.d3;
    if (deadInput) deadInput.value = pick.deadline;

    this.renderPosterCanvas();
    this.showToast('✨ Đã điền nội dung thông báo mẫu từ AI!', 'info');
  },

};


// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
