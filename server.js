const express = require('express');
const fs = require('fs');
const http = require('http');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { WebSocketServer, WebSocket } = require('ws');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'taskflow-super-secret-key-2026';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Payload and JSON error handler
app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({ error: 'Dung lượng ảnh poster hoặc dữ liệu quá lớn (vượt quá 50MB).' });
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Định dạng dữ liệu JSON không hợp lệ.' });
  }
  next(err);
});

// Health check endpoint for keep-alive monitoring & uptime pings
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// -------------------------------------------------------------
// REALTIME WEBSOCKET SYSTEM
// -------------------------------------------------------------
// Map to track connected client WebSockets: ws -> { userId, role, name }
const connectedClients = new Map();

wss.on('connection', (ws) => {
  let clientInfo = { userId: null, role: null, name: 'Khách' };
  connectedClients.set(ws, clientInfo);

  // Send greeting and current stats
  ws.send(JSON.stringify({
    event: 'system:connected',
    data: {
      message: 'Kết nối Realtime thành công!',
      timestamp: new Date().toISOString()
    }
  }));

  broadcastOnlineUsers();

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      // Client authenticates WebSocket connection
      if (parsed.type === 'auth') {
        const token = parsed.token;
        if (token) {
          try {
            const decoded = jwt.verify(token, JWT_SECRET);
            clientInfo.userId = decoded.id;
            clientInfo.role = decoded.role;
            clientInfo.name = decoded.name;
            connectedClients.set(ws, clientInfo);
            broadcastOnlineUsers();
          } catch (e) {
            // Invalid token, ignore
          }
        }
      }
    } catch (err) {
      console.error('WS message error:', err);
    }
  });

  ws.on('close', () => {
    connectedClients.delete(ws);
    broadcastOnlineUsers();
  });

  ws.on('error', (err) => {
    console.error('WS client error:', err);
    connectedClients.delete(ws);
    broadcastOnlineUsers();
  });
});

function broadcast(event, data, targetUserId = null) {
  const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
  for (const [clientWs, info] of connectedClients.entries()) {
    if (clientWs.readyState === WebSocket.OPEN) {
      if (!targetUserId || info.userId === targetUserId || targetUserId === 'all' || info.role === 'admin') {
        clientWs.send(payload);
      }
    }
  }
}

// Tự động phát sóng tức thì mọi thao tác được ghi lại từ User đến Admin
db.setActivityCallback((activity) => {
  broadcast('activity:new', { activity });
});

function broadcastOnlineUsers() {
  const onlineList = [];
  const seenIds = new Set();
  for (const info of connectedClients.values()) {
    if (info.userId && !seenIds.has(info.userId)) {
      seenIds.add(info.userId);
      onlineList.push({ id: info.userId, name: info.name, role: info.role });
    }
  }
  const payload = JSON.stringify({
    event: 'users:online',
    data: {
      count: seenIds.size || connectedClients.size,
      users: onlineList
    }
  });
  for (const clientWs of connectedClients.keys()) {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(payload);
    }
  }
}

// -------------------------------------------------------------
// AUTOMATED ALERT SCANNER (CẢNH BÁO THÔNG MINH ĐỊNH KỲ)
// -------------------------------------------------------------
const lastAlertSentTime = new Map(); // taskId -> timestamp

function scanDeadlinesAndGenerateAlerts() {
  const tasks = db.getTasks();
  const now = new Date();
  const alertSettings = db.getAlertSettings ? db.getAlertSettings() : {};
  const warningHours = alertSettings.warningThresholdHours || 24;
  const repeatIntervalMs = alertSettings.repeatIntervalHours === 0
    ? Infinity
    : (alertSettings.repeatIntervalHours || 12) * 3600 * 1000;

  // Check Quiet Hours (Khung giờ yên tĩnh)
  let isQuietTime = false;
  if (alertSettings.quietHoursEnabled) {
    const dayOfWeek = now.getDay(); // 0: CN, 6: T7
    if (alertSettings.weekendQuietEnabled && (dayOfWeek === 0 || dayOfWeek === 6)) {
      isQuietTime = true;
    } else {
      const [sH, sM] = (alertSettings.quietHoursStart || '22:00').split(':').map(Number);
      const [eH, eM] = (alertSettings.quietHoursEnd || '07:30').split(':').map(Number);
      const currentMin = now.getHours() * 60 + now.getMinutes();
      const startMin = sH * 60 + sM;
      const endMin = eH * 60 + eM;
      if (startMin > endMin) {
        if (currentMin >= startMin || currentMin < endMin) isQuietTime = true;
      } else {
        if (currentMin >= startMin && currentMin < endMin) isQuietTime = true;
      }
    }
  }

  let newAlertCount = 0;

  tasks.forEach(task => {
    if (task.status === 'completed') return;
    if (!task.dueDate) return;

    // Nếu công việc đang được TẠM HOÃN CẢNH BÁO (Snoozed) thì bỏ qua
    if (task.alertSnoozedUntil && new Date(task.alertSnoozedUntil) > now) {
      return;
    }

    const due = new Date(task.dueDate);
    const diffMs = due.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    const alertKeyOverdue = `${task.id}-overdue`;
    const alertKeyWarning = `${task.id}-warning`;

    // 1. Quá hạn (Overdue)
    if (diffHours < 0) {
      const lastSent = lastAlertSentTime.get(alertKeyOverdue) || 0;
      const canSend = (repeatIntervalMs === Infinity)
        ? (lastSent === 0)
        : (now.getTime() - lastSent > repeatIntervalMs);

      if (canSend) {
        lastAlertSentTime.set(alertKeyOverdue, now.getTime());
        const overdueDays = Math.ceil(Math.abs(diffHours) / 24);
        const assignedUser = db.getUserById(task.assignedTo);

        const notif = db.addNotification({
          userId: task.assignedTo,
          type: 'alert',
          level: 'danger',
          title: '🚨 CÔNG VIỆC ĐÃ QUÁ HẠN!',
          message: `Công việc "${task.title}" đã quá hạn ${overdueDays} ngày (Hạn: ${new Date(task.dueDate).toLocaleDateString('vi-VN')})! Vui lòng hoàn tất ngay.`,
          taskId: task.id,
          silent: isQuietTime
        }, true);

        // Chỉ thông báo cho Admin nếu bật notifyAdminOnAllOverdue hoặc task là Khẩn cấp / Cao
        const shouldNotifyAdmin = alertSettings.notifyAdminOnAllOverdue || (task.priority === 'urgent' || task.priority === 'high');
        if (shouldNotifyAdmin) {
          db.getUsers().filter(u => u.role === 'admin' && u.id !== task.assignedTo).forEach(admin => {
            db.addNotification({
              userId: admin.id,
              type: 'alert',
              level: 'danger',
              title: `🚨 Nhân viên trễ hạn: ${assignedUser?.name || 'Chưa gán'}`,
              message: `Công việc "${task.title}" phụ trách bởi ${assignedUser?.name || 'N/A'} đã trễ hạn!`,
              taskId: task.id,
              silent: isQuietTime
            }, true);
          });
        }

        broadcast('alert:new', notif);
        newAlertCount++;

        // Kích hoạt automation tự động gắn thẻ việc quá hạn
        executeAutomations('task_overdue_detected', { task });
      }
    }
    // 2. Sắp đến hạn (Due soon, e.g. within warningHours)
    else if (diffHours <= warningHours && diffHours >= 0) {
      const lastSent = lastAlertSentTime.get(alertKeyWarning) || 0;
      const canSend = (repeatIntervalMs === Infinity)
        ? (lastSent === 0)
        : (now.getTime() - lastSent > repeatIntervalMs);

      if (canSend) {
        lastAlertSentTime.set(alertKeyWarning, now.getTime());
        const hoursLeft = Math.round(diffHours);

        const notif = db.addNotification({
          userId: task.assignedTo,
          type: 'alert',
          level: 'warning',
          title: '⏰ CẢNH BÁO SẮP ĐẾN HẠN',
          message: `Công việc "${task.title}" chỉ còn ${hoursLeft} giờ nữa là đến hạn chót!`,
          taskId: task.id,
          silent: isQuietTime
        }, true);

        broadcast('alert:new', notif);
        newAlertCount++;
      }
    }
  });

  if (newAlertCount > 0) {
    db.save();
  }

  return newAlertCount;
}

// Run scanner every 60 seconds
setInterval(scanDeadlinesAndGenerateAlerts, 60 * 1000);

// -------------------------------------------------------------
// AUTOMATED CALENDAR REMINDER ENGINE (Nhắc Lịch Tự Động)
// -------------------------------------------------------------
const lastCalendarReminderSent = new Map(); // key -> timestamp

function scanCalendarReminders() {
  const tasks = db.getTasks();
  const users = db.getUsers();
  const userMap = new Map(users.map(u => [u.id, u]));
  const now = Date.now();
  let reminderCount = 0;

  tasks.forEach(task => {
    if (task.status === 'completed' || !task.dueDate || !task.assignedTo) return;
    const user = userMap.get(task.assignedTo);
    if (!user || !user.googleCalendar || !user.googleCalendar.enabled) return;

    const dueTime = new Date(task.dueDate).getTime();
    if (isNaN(dueTime)) return;
    const diffMinutes = Math.round((dueTime - now) / 60000);
    if (diffMinutes <= 0) return; // Overdue is handled by deadline scanner

    const reminderTimes = user.googleCalendar.reminderTimes || [1440, 120, 30];

    reminderTimes.forEach(threshold => {
      // Check if current time is within +/- 15 min window of the threshold
      if (Math.abs(diffMinutes - threshold) <= 15) {
        const key = `remind-${task.id}-${threshold}`;
        const lastSent = lastCalendarReminderSent.get(key) || 0;
        // Don't resend within 12 hours for the exact same threshold
        if (now - lastSent > 12 * 3600 * 1000) {
          lastCalendarReminderSent.set(key, now);

          let timeLabel = `${threshold} phút`;
          if (threshold >= 1440 && threshold % 1440 === 0) {
            timeLabel = `${threshold / 1440} ngày`;
          } else if (threshold >= 60 && threshold % 60 === 0) {
            timeLabel = `${threshold / 60} giờ`;
          }

          const notif = db.addNotification({
            userId: user.id,
            type: 'calendar_reminder',
            level: threshold <= 30 ? 'danger' : (threshold <= 120 ? 'warning' : 'info'),
            title: `⏰ NHẮC LỊCH: ${task.title}`,
            message: `Chỉ còn ${timeLabel} nữa là đến hạn hoàn tất công việc (Hạn chót: ${new Date(task.dueDate).toLocaleString('vi-VN')})`,
            taskId: task.id
          });

          broadcast('alert:new', notif, user.id);
          broadcast('calendar:reminder', {
            notification: notif,
            task,
            timeLabel,
            threshold,
            userId: user.id
          }, user.id);

          db.logActivity({
            userId: 'bot-auto',
            userName: '⏰ Bot Nhắc Lịch',
            userRole: 'admin',
            userAvatar: '📅',
            action: 'calendar_reminder',
            category: 'system',
            taskId: task.id,
            taskTitle: task.title,
            details: `Đã tự động gửi thông báo nhắc lịch đến ${user.name} cho việc #${task.id} (Trước ${timeLabel})`
          });

          reminderCount++;
        }
      }
    });
  });

  return reminderCount;
}

// Run calendar reminder scanner every 60 seconds
setInterval(scanCalendarReminders, 60 * 1000);

// -------------------------------------------------------------
// WORKFLOW AUTOMATION ENGINE
// -------------------------------------------------------------
function executeAutomations(triggerName, payload = {}) {
  const automations = (db.getAutomations() || []).filter(a => a.enabled);
  const matchedRules = automations.filter(a => a.trigger === triggerName);

  matchedRules.forEach(rule => {
    let triggered = false;
    let actionDesc = '';

    // Bot 1: Auto 100% on Complete
    if (rule.trigger === 'task_status_completed' && payload.task && payload.task.status === 'completed') {
      if (payload.task.progress !== 100) {
        db.updateTask(payload.task.id, { progress: 100 }, { id: 'bot-auto', name: '⚡ Bot Tự Động', role: 'admin' });
        triggered = true;
        actionDesc = `Tự động cập nhật tiến độ công việc #${payload.task.id} lên 100%`;
      }
    }
    // Bot 2: Auto Review on 100% progress
    else if (rule.trigger === 'task_progress_100' && payload.task && payload.task.progress === 100 && payload.task.status === 'in_progress') {
      db.updateTask(payload.task.id, { status: 'review' }, { id: 'bot-auto', name: '⚡ Bot Tự Động', role: 'admin' });
      triggered = true;
      actionDesc = `Tự động chuyển công việc #${payload.task.id} sang "Chờ duyệt" khi tiến độ đạt 100%`;
    }
    // Bot 3: Urgent escalation
    else if (rule.trigger === 'task_urgent_created' && payload.task && payload.task.priority === 'urgent') {
      const currentTags = payload.task.tags || [];
      if (!currentTags.includes('Ưu Tiên Số 1')) {
        db.updateTask(payload.task.id, { tags: [...currentTags, 'Ưu Tiên Số 1'] }, { id: 'bot-auto', name: '⚡ Bot Tự Động', role: 'admin' });
        triggered = true;
        actionDesc = `Gắn thẻ "Ưu Tiên Số 1" và gửi cảnh báo đỏ cho công việc khẩn cấp #${payload.task.id}`;
      }
    }
    // Bot 4: Overdue auto tag
    else if (rule.trigger === 'task_overdue_detected' && payload.task) {
      const currentTags = payload.task.tags || [];
      if (!currentTags.includes('Quá hạn')) {
        db.updateTask(payload.task.id, { tags: [...currentTags, 'Quá hạn'] }, { id: 'bot-auto', name: '⚡ Bot Tự Động', role: 'admin' });
        triggered = true;
        actionDesc = `Tự động gắn thẻ "Quá hạn" cho công việc trễ hạn #${payload.task.id}`;
      }
    }
    // Bot 5: Unassigned auto tag
    else if (rule.trigger === 'task_unassigned_created' && payload.task && !payload.task.assignedTo) {
      const currentTags = payload.task.tags || [];
      if (!currentTags.includes('Chờ nhận việc')) {
        db.updateTask(payload.task.id, { tags: [...currentTags, 'Chờ nhận việc'] }, { id: 'bot-auto', name: '⚡ Bot Tự Động', role: 'admin' });
        triggered = true;
        actionDesc = `Tự động gắn thẻ "Chờ nhận việc" cho công việc #${payload.task.id}`;
      }
    }

    if (triggered) {
      db.recordAutomationExecution(rule.id);
      db.logActivity({
        userId: 'bot-auto',
        userName: `🤖 ${rule.name}`,
        userRole: 'admin',
        userAvatar: rule.icon || '⚡',
        action: 'automation_executed',
        category: 'system',
        details: actionDesc
      });
      broadcast('automation:executed', {
        ruleId: rule.id,
        ruleName: rule.name,
        icon: rule.icon,
        actionDesc,
        timestamp: new Date().toISOString()
      });
    }
  });
}

// -------------------------------------------------------------
// AUTH MIDDLEWARE
// -------------------------------------------------------------
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Thiếu mã xác thực (Token)' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.getUserById(decoded.id);
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Tài khoản không tồn tại hoặc đã bị khóa' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Phiên đăng nhập hết hạn hoặc không hợp lệ' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin' && !req.user.permissions?.canManageUsers) {
    return res.status(403).json({ error: 'Chỉ Quản trị viên (Admin) hoặc người có quyền quản lý nhân sự mới có quyền thực hiện thao tác này!' });
  }
  next();
}

// -------------------------------------------------------------
// AUTH ROUTES
// -------------------------------------------------------------
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu' });
  }

  const user = db.getUserByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
  }

  if (!user.active) {
    return res.status(403).json({ error: 'Tài khoản đã bị vô hiệu hóa bởi Admin' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const safeUser = { ...user };
  delete safeUser.password;

  db.logActivity({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    userAvatar: user.avatar,
    action: 'auth_login',
    category: 'auth',
    details: `${user.role === 'admin' ? 'Quản trị viên (Admin)' : 'Nhân sự'} đã đăng nhập vào hệ thống (${user.email})`
  });

  res.json({ token, user: safeUser });
});

app.post('/api/auth/logout', authenticate, (req, res) => {
  db.logActivity({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    userAvatar: req.user.avatar,
    action: 'auth_logout',
    category: 'auth',
    details: `${req.user.role === 'admin' ? 'Quản trị viên (Admin)' : 'Nhân sự'} đã đăng xuất khỏi phiên làm việc`
  });

  res.json({ success: true, message: 'Đã đăng xuất thành công' });
});

// Registration endpoint restricted to @vmg.edu.vn internal company emails
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, department, position, phone } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Vui lòng nhập họ và tên của bạn' });
  }

  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Vui lòng nhập địa chỉ email đăng ký' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const REQUIRED_DOMAIN = '@vmg.edu.vn';

  // YÊU CẦU: Chỉ được đăng ký với email nội bộ có đuôi @vmg.edu.vn
  if (!cleanEmail.endsWith(REQUIRED_DOMAIN)) {
    return res.status(400).json({
      error: `Chính sách bảo mật: Hệ thống chỉ chấp nhận đăng ký với email nội bộ trường/công ty có đuôi "${REQUIRED_DOMAIN}"`
    });
  }

  // Kiểm tra tiền tố trước @vmg.edu.vn
  const localPart = cleanEmail.substring(0, cleanEmail.length - REQUIRED_DOMAIN.length);
  if (!localPart || localPart.length < 2) {
    return res.status(400).json({
      error: 'Địa chỉ email không hợp lệ (ví dụ: nguyen.van.a@vmg.edu.vn)'
    });
  }

  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu phải có độ dài tối thiểu 6 ký tự' });
  }

  const existingUser = db.getUserByEmail(cleanEmail);
  if (existingUser) {
    return res.status(400).json({ error: 'Email này đã tồn tại trong hệ thống. Vui lòng đăng nhập hoặc dùng email khác.' });
  }

  // Tạo tài khoản mới với vai trò User
  const newUser = db.createUser({
    name: name.trim(),
    email: cleanEmail,
    password: password,
    role: 'user',
    department: department || 'Phòng Kỹ Thuật',
    position: position || 'Thành viên mới',
    phone: phone || '',
    avatar: '👨‍🎓'
  });

  db.logActivity({
    userId: newUser.id,
    userName: newUser.name,
    userRole: 'user',
    userAvatar: newUser.avatar,
    action: 'auth_register',
    category: 'auth',
    details: `Thành viên mới tự đăng ký tài khoản thành công: ${cleanEmail} (${newUser.department})`
  });

  broadcast('user:created', { user: newUser });

  const token = jwt.sign(
    { id: newUser.id, email: newUser.email, role: newUser.role, name: newUser.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.status(201).json({
    message: 'Đăng ký tài khoản nội bộ @vmg.edu.vn thành công!',
    token,
    user: newUser
  });
});

// -------------------------------------------------------------
// SINGLE SIGN-ON (SSO) ENDPOINT (@vmg.edu.vn Google Workspace)
// -------------------------------------------------------------
app.post('/api/auth/sso', (req, res) => {
  const { email, name, avatar, provider = 'Google Workspace' } = req.body;

  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Địa chỉ email SSO là bắt buộc' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const REQUIRED_DOMAIN = '@vmg.edu.vn';

  // Strict domain enforcement: Only @vmg.edu.vn accounts can SSO
  if (!cleanEmail.endsWith(REQUIRED_DOMAIN)) {
    return res.status(400).json({
      error: `Chính sách SSO nội bộ: Hệ thống chỉ chấp nhận đăng nhập SSO bằng tài khoản có đuôi "${REQUIRED_DOMAIN}"!`
    });
  }

  let user = db.getUserByEmail(cleanEmail);
  let isNewUser = false;

  // Designated Super Admin Emails via SSO
  const SUPER_ADMIN_EMAILS = [
    'trantien.dni@vmg.edu.vn',
    'admin@company.com'
  ];
  const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(cleanEmail);

  if (!user) {
    // Auto provision new account for valid @vmg.edu.vn SSO user
    isNewUser = true;
    const defaultName = (name && name.trim()) ? name.trim() : cleanEmail.split('@')[0].replace(/\./g, ' ');
    const formattedName = defaultName.split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    const departments = db.getDepartments();
    const defaultDept = isSuperAdmin
      ? 'Ban Giám Đốc'
      : (departments.length > 0 ? departments[0].name : 'Phòng Hành Chính');

    user = db.createUser({
      name: formattedName,
      email: cleanEmail,
      password: `SSO-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      role: isSuperAdmin ? 'admin' : 'user',
      department: defaultDept,
      position: isSuperAdmin ? 'Tổng Quản Trị Hệ Thống' : 'Cán bộ / Nhân viên',
      avatar: avatar || (isSuperAdmin ? '👑' : '🌐'),
      phone: ''
    });

    // Grant all master permissions for super admin
    if (isSuperAdmin) {
      db.updateUser(user.id, {
        role: 'admin',
        permissions: {
          canCreateTask: true,
          canEditTask: true,
          canDeleteTask: true,
          canReviewTask: true,
          canManageDept: true,
          canManageUsers: true,
          canManageAutomation: true,
          canViewReports: true,
          canAccessExecutiveDesk: true
        }
      });
      user = db.getUserById(user.id);
    }

    db.logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      userAvatar: user.avatar,
      action: 'auth_sso_register',
      category: 'auth',
      details: `Nhân sự mới đã kích hoạt tài khoản qua SSO ${provider}: ${cleanEmail}${isSuperAdmin ? ' (Quyền Quản Trị Viên Tối Cao)' : ''}`
    });

    broadcast('user:created', { user });
  } else {
    if (!user.active) {
      return res.status(403).json({ error: 'Tài khoản của bạn đã bị khóa bởi Quản trị viên' });
    }

    // Auto-promote designated super admin email if not already admin
    if (isSuperAdmin && user.role !== 'admin') {
      db.updateUser(user.id, {
        role: 'admin',
        department: 'Ban Giám Đốc',
        position: 'Tổng Quản Trị Hệ Thống',
        avatar: '👑',
        permissions: {
          canCreateTask: true,
          canEditTask: true,
          canDeleteTask: true,
          canReviewTask: true,
          canManageDept: true,
          canManageUsers: true,
          canManageAutomation: true,
          canViewReports: true,
          canAccessExecutiveDesk: true
        }
      });
      user = db.getUserById(user.id);
    }

    db.logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      userAvatar: user.avatar,
      action: 'auth_sso_login',
      category: 'auth',
      details: `Đã xác thực và đăng nhập 1-click qua SSO ${provider}: ${cleanEmail}`
    });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const safeUser = { ...user };
  delete safeUser.password;

  res.json({
    success: true,
    message: isNewUser
      ? `Chào mừng ${safeUser.name}! Tài khoản của bạn đã được khởi tạo qua SSO ${provider}.`
      : `Đăng nhập SSO thành công! Chào mừng ${safeUser.name}.`,
    token,
    user: safeUser,
    isNewUser
  });
});

// -------------------------------------------------------------
// FORGOT & RESET PASSWORD ENDPOINTS
// -------------------------------------------------------------
const passwordResetOTPs = new Map(); // email -> { otp, expiresAt }

app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Vui lòng nhập email của bạn' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const user = db.getUserByEmail(cleanEmail);
  if (!user) {
    return res.status(404).json({ error: 'Không tìm thấy tài khoản nào khớp với email này trong hệ thống!' });
  }

  // Generate 6-digit verification code
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  passwordResetOTPs.set(cleanEmail, {
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
  });

  db.logActivity({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    userAvatar: user.avatar,
    action: 'auth_forgot_pwd',
    category: 'auth',
    details: `Đã yêu cầu mã OTP xác thực khôi phục mật khẩu cho email: ${cleanEmail}`
  });

  res.json({
    success: true,
    message: 'Mã xác minh khôi phục mật khẩu đã được tạo!',
    email: cleanEmail,
    otp
  });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ email, mã xác minh và mật khẩu mới' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const record = passwordResetOTPs.get(cleanEmail);

  if (!record || record.otp !== otp.trim()) {
    return res.status(400).json({ error: 'Mã xác minh không chính xác hoặc đã hết hiệu lực!' });
  }

  if (Date.now() > record.expiresAt) {
    passwordResetOTPs.delete(cleanEmail);
    return res.status(400).json({ error: 'Mã xác minh đã hết hạn. Vui lòng gửi lại yêu cầu!' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
  }

  const user = db.getUserByEmail(cleanEmail);
  if (!user) {
    return res.status(404).json({ error: 'Tài khoản không tồn tại!' });
  }

  // Update user password in database
  db.updateUser(user.id, { password: newPassword });
  passwordResetOTPs.delete(cleanEmail);

  db.logActivity({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    userAvatar: user.avatar,
    action: 'auth_reset_pwd',
    category: 'auth',
    details: `Đã xác thực OTP và đặt lại mật khẩu mới cho tài khoản: ${user.email}`
  });

  res.json({
    success: true,
    message: 'Đặt lại mật khẩu thành công! Bạn có thể sử dụng mật khẩu mới để đăng nhập ngay.'
  });
});

// Quick switch demo user for testing convenience
app.post('/api/auth/switch-demo', (req, res) => {
  const { userId } = req.body;
  const user = db.getUserById(userId);
  if (!user) {
    return res.status(404).json({ error: 'Người dùng không tồn tại' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const safeUser = { ...user };
  delete safeUser.password;

  db.logActivity({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    userAvatar: user.avatar,
    action: 'switch_demo',
    category: 'auth',
    details: `Đã chuyển đổi sang tài khoản trải nghiệm: "${user.name}" (${user.role.toUpperCase()})`
  });

  res.json({ token, user: safeUser });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// -------------------------------------------------------------
// USER PROFILE & ACCOUNT SETTINGS (MỌI TÀI KHOẢN ĐỀU ĐỔI MK & ẢNH ĐẠI DIỆN ĐƯỢC)
// -------------------------------------------------------------
const AVATAR_DIR = path.join(__dirname, 'public', 'uploads', 'avatars');
if (!fs.existsSync(AVATAR_DIR)) {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

// 1. Lấy thông tin hồ sơ tài khoản
app.get('/api/auth/profile', authenticate, (req, res) => {
  const user = db.getUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy thông tin tài khoản' });
  res.json({ user });
});

// 2. Cập nhật thông tin hồ sơ (Tên, số điện thoại, chức vụ)
app.put('/api/auth/profile', authenticate, (req, res) => {
  const { name, phone, position } = req.body;
  const updates = {};
  if (name && name.trim()) updates.name = name.trim();
  if (typeof phone === 'string') updates.phone = phone.trim();
  if (typeof position === 'string') updates.position = position.trim();

  const updatedUser = db.updateUser(req.user.id, updates);
  if (!updatedUser) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

  db.logActivity({
    userId: req.user.id,
    userName: updatedUser.name,
    userRole: updatedUser.role,
    userAvatar: updatedUser.avatar,
    action: 'update_profile',
    category: 'user',
    details: `${updatedUser.name} đã cập nhật thông tin hồ sơ cá nhân`
  });

  broadcast('user:updated', { user: updatedUser });
  res.json({ success: true, message: 'Đã cập nhật thông tin hồ sơ thành công!', user: updatedUser });
});

// 3. Tải lên và lưu ảnh đại diện (Custom Photo Avatar / Emoji)
app.post('/api/auth/upload-avatar', authenticate, (req, res) => {
  try {
    const avatarDataUrl = req.body.avatarDataUrl || req.body.avatarData;
    const avatarEmoji = req.body.avatarEmoji;

    let finalAvatar = avatarEmoji;
    if (avatarDataUrl) {
      // Validate data URL
      const matches = avatarDataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).json({ error: 'Định dạng dữ liệu ảnh không hợp lệ' });
      }

      const buffer = Buffer.from(matches[2], 'base64');
      if (buffer.length > 8 * 1024 * 1024) {
        return res.status(400).json({ error: 'Dung lượng ảnh vượt quá giới hạn cho phép (Tối đa 8MB)' });
      }

      // Safe filename
      const filename = `avatar-${req.user.id}-${Date.now()}.png`;
      const filePath = path.join(AVATAR_DIR, filename);

      // Clean old avatar file if existing on disk
      const oldUser = db.getUserById(req.user.id);
      if (oldUser && oldUser.avatar && oldUser.avatar.startsWith('/uploads/avatars/')) {
        const oldFile = path.join(__dirname, 'public', oldUser.avatar.split('?')[0]);
        try { if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile); } catch (_) {}
      }

      fs.writeFileSync(filePath, buffer);
      finalAvatar = `/uploads/avatars/${filename}?t=${Date.now()}`;
    }

    if (!finalAvatar) {
      return res.status(400).json({ error: 'Vui lòng cung cấp ảnh đại diện hoặc biểu tượng avatar' });
    }

    const updatedUser = db.updateUser(req.user.id, { avatar: finalAvatar });

    db.logActivity({
      userId: req.user.id,
      userName: updatedUser.name,
      userRole: updatedUser.role,
      userAvatar: updatedUser.avatar,
      action: 'update_avatar',
      category: 'user',
      details: `${updatedUser.name} đã cập nhật ảnh đại diện mới`
    });

    broadcast('user:updated', { user: updatedUser });
    res.json({ success: true, message: 'Đã cập nhật ảnh đại diện thành công!', avatar: finalAvatar, user: updatedUser });
  } catch (err) {
    console.error('Error uploading avatar:', err);
    res.status(500).json({ error: 'Lỗi tải lên ảnh đại diện: ' + err.message });
  }
});

// 4. Đổi mật khẩu tài khoản cá nhân
app.post('/api/auth/change-password', authenticate, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu mới phải có tối thiểu 6 ký tự' });
    }

    const fullUser = db.getUserById(req.user.id, true);
    if (!fullUser) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

    // Kiểm tra mật khẩu hiện tại
    const isMatch = bcrypt.compareSync(currentPassword, fullUser.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Mật khẩu hiện tại không chính xác' });
    }

    // Cập nhật mật khẩu mới (updateUser sẽ tự động mã hóa bcrypt)
    db.updateUser(req.user.id, { password: newPassword });

    db.logActivity({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      userAvatar: req.user.avatar,
      action: 'change_password',
      category: 'auth',
      details: `${req.user.name} đã đổi mật khẩu tài khoản thành công`
    });

    res.json({ success: true, message: 'Đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu mới của bạn.' });
  } catch (err) {
    console.error('Error changing password:', err);
    res.status(500).json({ error: 'Lỗi khi đổi mật khẩu: ' + err.message });
  }
});

// -------------------------------------------------------------
// TASKS ROUTES
// -------------------------------------------------------------
app.get('/api/tasks', authenticate, (req, res) => {
  const { status, priority, department, assignedTo, search } = req.query;
  let tasks = db.getTasks();

  // Role-based task scoping
  if (req.user.role === 'user') {
    // Nhân viên: chỉ xem công việc cá nhân của mình (được giao hoặc do mình tạo)
    tasks = tasks.filter(t => t.assignedTo === req.user.id || t.createdBy === req.user.id);
  } else if (req.user.role === 'manager') {
    // Trưởng phòng: chỉ xem công việc thuộc phòng ban mình phụ trách
    tasks = tasks.filter(t => t.department === req.user.department);
  }

  if (status && status !== 'all') tasks = tasks.filter(t => t.status === status);
  if (priority && priority !== 'all') tasks = tasks.filter(t => t.priority === priority);
  if (department && department !== 'all') tasks = tasks.filter(t => t.department === department);
  if (assignedTo && assignedTo !== 'all') tasks = tasks.filter(t => t.assignedTo === assignedTo);

  if (search) {
    const q = search.toLowerCase();
    tasks = tasks.filter(t => 
      t.title.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.id && t.id.toLowerCase().includes(q))
    );
  }

  res.json({ tasks });
});

app.get('/api/tasks/:id', authenticate, (req, res) => {
  const task = db.getTaskById(req.params.id);
  if (!task) return res.status(404).json({ error: 'Không tìm thấy công việc' });

  // Security check for role access
  if (req.user.role === 'user') {
    if (task.assignedTo !== req.user.id && task.createdBy !== req.user.id) {
      return res.status(403).json({ error: 'Bạn không có quyền truy cập công việc của nhân sự khác.' });
    }
  } else if (req.user.role === 'manager') {
    if (task.department !== req.user.department) {
      return res.status(403).json({ error: 'Bạn không có quyền truy cập công việc ngoài phòng ban phụ trách.' });
    }
  }

  const comments = db.getComments(task.id);
  res.json({ task, comments });
});

app.post('/api/tasks', authenticate, (req, res) => {
  const { title, description, priority, department, assignedTo, startDate, dueDate, tags } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Tiêu đề công việc là bắt buộc' });
  }

  // -----------------------------------------------------------
  // KIỂM SOÁT PHÂN QUYỀN GIAO VIỆC (MANAGER & NHÂN VIÊN)
  // -----------------------------------------------------------
  let targetAssignee = assignedTo || req.user.id;
  let targetDept = department || req.user.department;

  if (req.user.role === 'user') {
    // Nhân viên cấp dưới chỉ được nhận việc và tự tạo việc cho chính mình, KHÔNG được giao việc cho Manager hoặc người khác
    if (targetAssignee !== req.user.id) {
      return res.status(403).json({
        error: 'Phân quyền Nhân viên: Bạn chỉ được tạo việc cho chính mình, không có quyền giao việc cho Manager hoặc nhân sự khác.'
      });
    }
    targetDept = req.user.department;
  } else if (req.user.role === 'manager') {
    // Manager chỉ được giao việc cho nhân viên cấp dưới trong cùng phòng ban, hoặc tự giao việc cho mình
    const assigneeObj = db.getUserById(targetAssignee);
    if (!assigneeObj) {
      return res.status(400).json({ error: 'Không tìm thấy nhân sự được phân công' });
    }

    if (assigneeObj.id !== req.user.id) {
      if (assigneeObj.department !== req.user.department) {
        return res.status(403).json({
          error: `Phân quyền Manager: Bạn chỉ được giao việc cho nhân sự trực thuộc phòng ban của mình (${req.user.department}).`
        });
      }
      if (assigneeObj.role !== 'user') {
        return res.status(403).json({
          error: 'Phân quyền Manager: Bạn chỉ được giao việc cho nhân viên cấp dưới trong phòng, không được giao việc cho Manager khác hoặc Ban Giám Đốc.'
        });
      }
    }
    targetDept = req.user.department;
  }

  const newTask = db.createTask({
    title,
    description,
    priority: priority || 'medium',
    department: targetDept,
    assignedTo: targetAssignee,
    startDate: startDate || new Date().toISOString(),
    dueDate: dueDate || new Date(Date.now() + 3 * 86400000).toISOString(),
    progress: 0,
    status: 'todo',
    tags
  }, req.user);

  // Send notification to assigned user if someone else assigned it
  if (newTask.assignedTo && newTask.assignedTo !== req.user.id) {
    const notif = db.addNotification({
      userId: newTask.assignedTo,
      type: 'task_assigned',
      level: 'info',
      title: '📋 Công việc mới được giao',
      message: `${req.user.name} đã giao cho bạn công việc: "${newTask.title}" (Đã tự động lưu vào Google Calendar)`,
      taskId: newTask.id
    });
    broadcast('alert:new', notif, newTask.assignedTo);
  }

  // Tự động lưu công việc vào lịch Google Calendar của người nhận việc
  if (newTask.assignedTo) {
    const assignedUser = db.getUserById(newTask.assignedTo);
    if (assignedUser) {
      db.updateUserCalendarSettings(assignedUser.id, { lastSync: new Date().toISOString() });
      db.logActivity({
        userId: req.user.id,
        userName: req.user.name,
        userRole: req.user.role,
        userAvatar: req.user.avatar || '👤',
        action: 'auto_sync_gcal',
        category: 'calendar',
        taskId: newTask.id,
        taskTitle: newTask.title,
        details: `Đã tự động lưu việc #${newTask.id} ("${newTask.title}") vào Google Calendar của ${assignedUser.name}`
      });
      broadcast('calendar:task_synced', {
        taskId: newTask.id,
        taskTitle: newTask.title,
        assignedUser: assignedUser.name,
        assignedEmail: assignedUser.email,
        assignedTo: newTask.assignedTo
      });
    }
  }

  // Realtime WS broadcast
  broadcast('task:created', { task: newTask, creator: req.user.name });

  // Workflow Automations Trigger
  if (newTask.priority === 'urgent') {
    executeAutomations('task_urgent_created', { task: newTask });
  }
  if (!newTask.assignedTo) {
    executeAutomations('task_unassigned_created', { task: newTask });
  }

  res.status(201).json({ task: newTask });
});

app.put('/api/tasks/:id', authenticate, (req, res) => {
  const task = db.getTaskById(req.params.id);
  if (!task) return res.status(404).json({ error: 'Không tìm thấy công việc' });

  // Users can only edit tasks assigned to them, unless they are Admin or Manager in their department
  const isManagerInDept = req.user.role === 'manager' && task.department === req.user.department;
  if (req.user.role !== 'admin' && !isManagerInDept && task.assignedTo !== req.user.id && task.createdBy !== req.user.id) {
    return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa công việc này' });
  }

  // Phân quyền chuyển giao việc khi sửa task
  if (req.body.assignedTo && req.body.assignedTo !== task.assignedTo) {
    const newAssigneeId = req.body.assignedTo;
    if (req.user.role === 'user') {
      if (newAssigneeId !== req.user.id) {
        return res.status(403).json({
          error: 'Phân quyền Nhân viên: Bạn không có quyền chuyển giao việc cho Manager hoặc người khác.'
        });
      }
    } else if (req.user.role === 'manager') {
      const targetUser = db.getUserById(newAssigneeId);
      if (!targetUser) return res.status(400).json({ error: 'Không tìm thấy nhân sự được phân công.' });
      if (targetUser.id !== req.user.id) {
        if (targetUser.department !== req.user.department) {
          return res.status(403).json({
            error: `Phân quyền Manager: Bạn chỉ được giao việc cho nhân sự trực thuộc phòng ban của mình (${req.user.department}).`
          });
        }
        if (targetUser.role !== 'user') {
          return res.status(403).json({
            error: 'Phân quyền Manager: Bạn chỉ được giao việc cho nhân viên cấp dưới trong phòng ban, không được giao việc cho Manager khác hoặc Ban Giám Đốc.'
          });
        }
      }
    }
  }

  const updatedTask = db.updateTask(req.params.id, req.body, req.user);
  
  // Realtime WS broadcast
  broadcast('task:updated', { task: updatedTask, updatedBy: req.user.name });

  // Workflow Automations Trigger
  if (updatedTask.status === 'completed') {
    executeAutomations('task_status_completed', { task: updatedTask });
  }
  if (updatedTask.progress === 100 && updatedTask.status === 'in_progress') {
    executeAutomations('task_progress_100', { task: updatedTask });
  }
  if (updatedTask.priority === 'urgent') {
    executeAutomations('task_urgent_created', { task: updatedTask });
  }

  res.json({ task: updatedTask });
});

// Fast Status / Progress Patch (for Kanban drag & drop or quick clicks)
app.patch('/api/tasks/:id/status', authenticate, (req, res) => {
  const { status, progress } = req.body;
  const task = db.getTaskById(req.params.id);
  if (!task) return res.status(404).json({ error: 'Không tìm thấy công việc' });

  const updates = {};
  if (status) updates.status = status;
  if (progress !== undefined) updates.progress = progress;

  const updatedTask = db.updateTask(req.params.id, updates, req.user);

  // Realtime WS broadcast
  broadcast('task:status_changed', {
    taskId: updatedTask.id,
    task: updatedTask,
    updatedBy: req.user.name
  });

  // Workflow Automations Trigger
  if (updatedTask.status === 'completed') {
    executeAutomations('task_status_completed', { task: updatedTask });
  }
  if (updatedTask.progress === 100 && updatedTask.status === 'in_progress') {
    executeAutomations('task_progress_100', { task: updatedTask });
  }

  res.json({ task: updatedTask });
});

app.delete('/api/tasks/:id', authenticate, (req, res) => {
  const task = db.getTaskById(req.params.id);
  if (!task) return res.status(404).json({ error: 'Không tìm thấy công việc' });

  // Admin or Creator can delete
  if (req.user.role !== 'admin' && task.createdBy !== req.user.id) {
    return res.status(403).json({ error: 'Chỉ Quản trị viên hoặc người tạo mới có quyền xóa công việc' });
  }

  db.deleteTask(req.params.id, req.user);

  // Realtime WS broadcast
  broadcast('task:deleted', { taskId: req.params.id, deletedBy: req.user.name });

  res.json({ success: true, message: 'Đã xóa công việc thành công' });
});

// -------------------------------------------------------------
// COMMENTS ROUTES
// -------------------------------------------------------------
app.get('/api/tasks/:id/comments', authenticate, (req, res) => {
  const comments = db.getComments(req.params.id);
  res.json({ comments });
});

app.post('/api/tasks/:id/comments', authenticate, (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Nội dung bình luận không được để trống' });
  }

  const task = db.getTaskById(req.params.id);
  if (!task) return res.status(404).json({ error: 'Không tìm thấy công việc' });

  const comment = db.addComment(req.params.id, req.user, content.trim());

  // Notify assignee if someone else comments
  if (task.assignedTo && task.assignedTo !== req.user.id) {
    const notif = db.addNotification({
      userId: task.assignedTo,
      type: 'info',
      level: 'info',
      title: '💬 Bình luận mới',
      message: `${req.user.name} đã bình luận vào "${task.title}": "${content.slice(0, 50)}..."`,
      taskId: task.id
    });
    broadcast('alert:new', notif, task.assignedTo);
  }

  // Realtime WS broadcast
  broadcast('task:comment_added', { taskId: req.params.id, comment });

  res.status(201).json({ comment });
});

// -------------------------------------------------------------
// GOOGLE MEET INTEGRATION FOR TASKS
// -------------------------------------------------------------
app.post('/api/tasks/:id/meet', authenticate, (req, res) => {
  const { meetUrl } = req.body;
  const task = db.getTaskById(req.params.id);
  if (!task) return res.status(404).json({ error: 'Không tìm thấy công việc' });

  const cleanUrl = meetUrl ? meetUrl.trim() : null;
  const updatedTask = db.updateTask(req.params.id, { 
    meetUrl: cleanUrl,
    meetUpdatedAt: new Date().toISOString()
  }, req.user);

  // Ghi nhật ký tự động vào trao đổi realtime của task
  if (cleanUrl) {
    db.addComment(req.params.id, req.user, `📹 [Google Meet] Đã tạo/gắn phòng họp trực tuyến cho công việc này: ${cleanUrl}`);
    
    // Gửi thông báo tới người phụ trách nếu người tạo không phải là người nhận việc
    if (task.assignedTo && task.assignedTo !== req.user.id) {
      const notif = db.addNotification({
        userId: task.assignedTo,
        type: 'info',
        level: 'info',
        title: '📹 Phòng Họp Google Meet Mới',
        message: `${req.user.name} đã gắn link họp Google Meet vào "${task.title}": ${cleanUrl}`,
        taskId: task.id
      });
      broadcast('alert:new', notif, task.assignedTo);
    }
  }

  broadcast('task:updated', { task: updatedTask, updatedBy: req.user.name });
  broadcast('task:meet_updated', { taskId: req.params.id, meetUrl: updatedTask.meetUrl, updatedBy: req.user.name });

  res.json({ success: true, task: updatedTask, meetUrl: updatedTask.meetUrl });
});

app.delete('/api/tasks/:id/meet', authenticate, (req, res) => {
  const task = db.getTaskById(req.params.id);
  if (!task) return res.status(404).json({ error: 'Không tìm thấy công việc' });

  const updatedTask = db.updateTask(req.params.id, { meetUrl: null }, req.user);
  db.addComment(req.params.id, req.user, `📹 [Google Meet] Đã gỡ bỏ phòng họp trực tuyến khỏi công việc.`);

  broadcast('task:updated', { task: updatedTask, updatedBy: req.user.name });
  broadcast('task:meet_updated', { taskId: req.params.id, meetUrl: null, updatedBy: req.user.name });

  res.json({ success: true, task: updatedTask });
});

// -------------------------------------------------------------
// NOTIFICATIONS & ALERTS ROUTES
// -------------------------------------------------------------
app.get('/api/notifications', authenticate, (req, res) => {
  const notifications = db.getNotifications(req.user.id);
  res.json({ notifications });
});

app.post('/api/notifications/:id/read', authenticate, (req, res) => {
  const success = db.markNotificationRead(req.params.id, req.user.id);
  res.json({ success });
});

app.post('/api/notifications/read-all', authenticate, (req, res) => {
  db.markAllNotificationsRead(req.user.id);
  res.json({ success: true });
});

app.post('/api/alerts/scan-now', authenticate, (req, res) => {
  const count = scanDeadlinesAndGenerateAlerts();
  const reminderCount = scanCalendarReminders();
  db.logActivity({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role || 'user',
    userAvatar: req.user.avatar || '⏰',
    action: 'scan_deadlines',
    category: 'system',
    details: `Đã kích hoạt quét thời hạn & nhắc lịch tự động (Phát hiện ${count} cảnh báo, ${reminderCount} nhắc việc mới)`
  });
  res.json({ message: `Đã quét và tạo ${count} cảnh báo, ${reminderCount} nhắc việc mới`, count, reminderCount });
});

// -------------------------------------------------------------
// GOOGLE CALENDAR & SYNC ENDPOINTS (Mỗi Account Cá Nhân)
// -------------------------------------------------------------
function getPublicCalendarBaseUrl(req) {
  const forwardedHost = req.headers['x-forwarded-host'] || req.get('host');
  const forwardedProto = req.headers['x-forwarded-proto'] || req.protocol;
  if (forwardedHost && !forwardedHost.includes('localhost') && !forwardedHost.includes('127.0.0.1')) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  // Public Cloudflare Tunnel URL so Google Calendar servers on the web can reach the live feed
  return 'https://acceptance-consisting-immigration-donate.trycloudflare.com';
}

// Live RFC 5545 iCalendar (.ics) subscription feed for Google Calendar / Apple / Outlook
app.get('/api/calendar/feed/:userId/:token.ics', (req, res) => {
  const { userId, token } = req.params;
  const user = db.getUserByCalendarToken(userId, token);
  if (!user) {
    return res.status(404).send('Lịch không tồn tại hoặc mã liên kết bảo mật không chính xác.');
  }

  const hostUrl = getPublicCalendarBaseUrl(req);
  const icsContent = db.generateIcsFeed(user, hostUrl);

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="taskflow-${user.id}.ics"`);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(icsContent);
});

// Download single task .ics event
app.get('/api/tasks/:id/ics', authenticate, (req, res) => {
  const task = db.getTaskById(req.params.id);
  if (!task) return res.status(404).send('Không tìm thấy công việc');

  const pad = n => String(n).padStart(2, '0');
  const formatIcsDate = (dStr) => {
    const d = new Date(dStr || Date.now());
    if (isNaN(d.getTime())) return null;
    return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' +
           pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';
  };

  const cleanText = (str) => String(str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

  const nowIcs = formatIcsDate(new Date());
  const startIcs = formatIcsDate(task.startDate) || nowIcs;
  const dueIcs = formatIcsDate(task.dueDate) || formatIcsDate(new Date(Date.now() + 86400000));
  const priorityMap = { urgent: '1', high: '3', medium: '5', low: '9' };

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VMG TaskFlow Pro//Task Event//VI',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:task-${task.id}@vmg.edu.vn`,
    `DTSTAMP:${nowIcs}`,
    `DTSTART:${startIcs}`,
    `DTEND:${dueIcs}`,
    `SUMMARY:${cleanText(`[TaskFlow] ${task.title}`)}`,
    `DESCRIPTION:${cleanText(`Mã việc: #${task.id}\nƯu tiên: ${(task.priority||'').toUpperCase()}\nPhòng ban: ${task.department||''}\nTiến độ: ${task.progress||0}%\n\nMô tả:\n${task.description||''}`)}`,
    `PRIORITY:${priorityMap[task.priority] || '5'}`,
    `STATUS:${task.status === 'completed' ? 'COMPLETED' : 'CONFIRMED'}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${cleanText(`[Nhắc việc] ${task.title}`)}`,
    'TRIGGER:-PT1H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ];

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="task-${task.id}.ics"`);
  res.send(icsLines.join('\r\n'));
});

// Download offline .ics file
app.get('/api/calendar/download-ics', authenticate, (req, res) => {
  const hostUrl = getPublicCalendarBaseUrl(req);
  const icsContent = db.generateIcsFeed(req.user, hostUrl);

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="taskflow-${req.user.name.replace(/\\s+/g, '_')}.ics"`);
  res.send(icsContent);
});

// Get user's Google Calendar settings & feed URLs
app.get('/api/users/:id/calendar-settings', authenticate, (req, res) => {
  if (req.user.id !== req.params.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Không có quyền truy cập cài đặt lịch của người khác' });
  }

  const user = db.getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Người dùng không tồn tại' });

  const publicBaseUrl = getPublicCalendarBaseUrl(req);
  const token = user.googleCalendar?.syncToken || `gcal_${user.id}_token`;
  const feedUrl = `${publicBaseUrl}/api/calendar/feed/${user.id}/${token}.ics`;
  const webcalUrl = `webcal://${publicBaseUrl.replace(/^https?:\/\//, '')}/api/calendar/feed/${user.id}/${token}.ics`;
  const googleCalendarSubscribeUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`;
  const googleCalendarAddByUrl = `https://calendar.google.com/calendar/u/0/r/settings/addbyurl`;

  res.json({
    settings: user.googleCalendar || {},
    feedUrl,
    webcalUrl,
    googleCalendarSubscribeUrl,
    googleCalendarAddByUrl
  });
});

// Update Google Calendar & Reminder settings
app.put('/api/users/:id/calendar-settings', authenticate, (req, res) => {
  if (req.user.id !== req.params.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Không có quyền cập nhật cài đặt lịch của người khác' });
  }

  const updatedSettings = db.updateUserCalendarSettings(req.params.id, req.body);
  if (!updatedSettings) return res.status(404).json({ error: 'Người dùng không tồn tại' });

  db.logActivity({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    userAvatar: req.user.avatar || '👤',
    action: 'update_calendar_settings',
    category: 'user',
    details: `Đã cập nhật cấu hình đồng bộ Google Calendar & tùy chọn nhắc lịch tự động`
  });

  res.json({ success: true, settings: updatedSettings });
});

// 1-Click Sync Now / Record Sync
app.post('/api/calendar/sync-now', authenticate, (req, res) => {
  const now = new Date().toISOString();
  db.updateUserCalendarSettings(req.user.id, { lastSync: now });

  db.logActivity({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    userAvatar: req.user.avatar || '📅',
    action: 'sync_google_calendar',
    category: 'calendar',
    details: `Đã thực hiện đồng bộ lịch công việc với Google Calendar`
  });

  res.json({ success: true, lastSync: now });
});

// Direct push task event into Google Calendar via Google Calendar REST API
app.post('/api/calendar/google/push-event', authenticate, async (req, res) => {
  const { taskId, accessToken } = req.body || {};
  const task = db.getTaskById(taskId);
  if (!task) return res.status(404).json({ error: 'Không tìm thấy công việc' });

  const token = accessToken || req.user.googleCalendar?.accessToken;
  if (!token) {
    return res.status(400).json({ error: 'Tài khoản chưa kết nối Google Access Token. Vui lòng kết nối Google Calendar API trước.' });
  }

  const assignedUser = db.getUserById(task.assignedTo);
  const pad = n => String(n).padStart(2, '0');
  const formatIsoUtc = (dStr) => {
    const d = new Date(dStr || Date.now());
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  };

  const startIso = formatIsoUtc(task.startDate) || new Date().toISOString();
  const dueIso = formatIsoUtc(task.dueDate) || new Date(Date.now() + 86400000).toISOString();

  try {
    const gRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        summary: `[TaskFlow] ${task.title}`,
        description: `Mã việc: #${task.id}\nƯu tiên: ${(task.priority || 'medium').toUpperCase()}\nPhòng ban: ${task.department || ''}\nTiến độ: ${task.progress || 0}%\nTrạng thái: ${task.status}\n\nMô tả:\n${task.description || 'Không có mô tả'}\n\n---\nĐược tự động lưu từ TaskFlow Pro Webapp`,
        start: { dateTime: startIso },
        end: { dateTime: dueIso },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 1440 },
            { method: 'popup', minutes: 120 },
            { method: 'popup', minutes: 30 }
          ]
        }
      })
    });

    const gData = await gRes.json();
    if (!gRes.ok) {
      return res.status(gRes.status).json({ error: gData.error?.message || 'Lỗi từ Google Calendar API' });
    }

    db.logActivity({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      userAvatar: '📅',
      action: 'gcal_direct_push',
      category: 'calendar',
      taskId: task.id,
      taskTitle: task.title,
      details: `Đã tự động lưu công việc #${task.id} trực tiếp vào Google Calendar cá nhân qua API (Event ID: ${gData.id})`
    });

    res.json({ success: true, event: gData, message: 'Đã tự động lưu công việc vào Google Calendar cá nhân thành công!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test immediate reminder notification
app.post('/api/calendar/test-reminder', authenticate, (req, res) => {
  const notif = db.addNotification({
    userId: req.user.id,
    type: 'calendar_reminder',
    level: 'warning',
    title: '⏰ [THỬ NGHIỆM] NHẮC LỊCH TỰ ĐỘNG THÀNH CÔNG',
    message: `Hệ thống nhắc lịch tự động cho tài khoản ${req.user.name} đang hoạt động bình thường! (Âm thanh & thông báo đẩy sẵn sàng)`,
    taskId: null
  });

  broadcast('alert:new', notif, req.user.id);
  broadcast('calendar:reminder', {
    notification: notif,
    task: { title: 'Thử nghiệm nhắc lịch Google Calendar & TaskFlow' },
    timeLabel: 'Ngay bây giờ',
    threshold: 0,
    userId: req.user.id
  }, req.user.id);

  db.logActivity({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    userAvatar: '⏰',
    action: 'test_calendar_reminder',
    category: 'system',
    details: `Đã thử nghiệm tính năng phát chuông và cảnh báo nhắc lịch tự động`
  });

  res.json({ success: true, message: 'Đã phát cảnh báo thử nghiệm thành công!' });
});

// -------------------------------------------------------------
// REPORTS & ANALYTICS ROUTES (Role-Based Reporting Intelligence)
// -------------------------------------------------------------
app.get('/api/reports/summary', authenticate, (req, res) => {
  const user = req.user;
  const canView = user.role === 'admin' || (user.permissions && user.permissions.canViewReports === true);
  if (!canView) {
    return res.status(403).json({
      error: 'Tài khoản của bạn không được phép xem Báo cáo của hệ thống. Vui lòng liên hệ Quản trị viên để được cấp quyền.'
    });
  }

  const allTasks = db.getTasks();
  const allUsers = db.getUsers();
  const now = new Date();

  const userRole = user.role || 'user';
  const userDept = user.department || 'Phòng Kỹ Thuật';

  let filteredTasks = [];
  let scope = 'personal';
  let scopeTitle = '';
  let scopeDesc = '';
  let targetDept = null;

  if (userRole === 'admin') {
    scope = 'admin';
    const deptQuery = req.query.department;
    if (deptQuery && deptQuery !== 'all' && deptQuery !== 'Tất cả phòng ban') {
      filteredTasks = allTasks.filter(t => t.department === deptQuery);
      targetDept = deptQuery;
      scopeTitle = `Báo Cáo Phân Tích Phòng Ban: ${deptQuery}`;
      scopeDesc = `Chế độ Quản trị viên - Giám sát toàn diện dữ liệu của ${deptQuery}`;
    } else {
      filteredTasks = allTasks;
      scopeTitle = 'Báo Cáo Toàn Doanh Nghiệp (Tất Cả Phòng Ban)';
      scopeDesc = 'Chế độ Quản trị viên - Giám sát bức tranh toàn cảnh 16 phòng ban và toàn bộ nhân sự';
    }
  } else if (userRole === 'manager') {
    scope = 'manager';
    targetDept = userDept;
    filteredTasks = allTasks.filter(t => t.department === userDept);
    scopeTitle = `Báo Cáo Quản Trị Phòng Ban: ${userDept}`;
    scopeDesc = `Chế độ Trưởng phòng - Quản trị tiến độ và đánh giá chỉ số KPI nhân sự trực thuộc ${userDept}`;
  } else if (userRole === 'viewer') {
    scope = 'viewer';
    filteredTasks = allTasks;
    scopeTitle = 'Báo Cáo Giám Sát Tiến Độ Chung';
    scopeDesc = 'Chế độ Chỉ Xem (Read-only) - Theo dõi tiến độ cấp cao toàn hệ thống (Không có quyền trích xuất dữ liệu)';
  } else {
    // Role: 'user'
    scope = 'personal';
    filteredTasks = allTasks.filter(t => t.assignedTo === user.id || t.createdBy === user.id);
    scopeTitle = `Báo Cáo Hiệu Suất Cá Nhân: ${user.name}`;
    scopeDesc = `Chế độ Nhân viên - Theo dõi nhiệm vụ được giao và chỉ số KPI cá nhân (${userDept})`;
  }

  // Calculate KPIs on filteredTasks
  const total = filteredTasks.length;
  let completed = 0;
  let inProgress = 0;
  let todo = 0;
  let review = 0;
  let overdue = 0;
  let urgent = 0;
  let high = 0;
  let medium = 0;
  let low = 0;

  // Task progress distribution (for personal view)
  let p0_25 = 0;
  let p26_50 = 0;
  let p51_75 = 0;
  let p76_100 = 0;

  filteredTasks.forEach(t => {
    if (t.status === 'completed') completed++;
    else if (t.status === 'in_progress') inProgress++;
    else if (t.status === 'review') review++;
    else if (t.status === 'todo') todo++;

    if (t.priority === 'urgent') urgent++;
    else if (t.priority === 'high') high++;
    else if (t.priority === 'medium') medium++;
    else if (t.priority === 'low') low++;

    const pr = Number(t.progress) || 0;
    if (pr <= 25) p0_25++;
    else if (pr <= 50) p26_50++;
    else if (pr <= 75) p51_75++;
    else p76_100++;

    if (t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < now) {
      overdue++;
    }
  });

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Department breakdown (for admin & viewer)
  const departmentMap = {};
  if (scope === 'admin' || scope === 'viewer') {
    allTasks.forEach(t => {
      const dept = t.department || 'Khác';
      if (!departmentMap[dept]) {
        departmentMap[dept] = { total: 0, completed: 0, overdue: 0, inProgress: 0 };
      }
      departmentMap[dept].total++;
      if (t.status === 'completed') departmentMap[dept].completed++;
      else if (t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < now) departmentMap[dept].overdue++;
      else departmentMap[dept].inProgress++;
    });
  }

  // Member performance list tailored to role
  let memberPerformance = [];
  if (scope === 'admin') {
    const targetUsers = targetDept ? allUsers.filter(u => u.department === targetDept) : allUsers;
    memberPerformance = targetUsers.map(u => {
      const mTasks = allTasks.filter(t => t.assignedTo === u.id);
      const mTotal = mTasks.length;
      const mCompleted = mTasks.filter(t => t.status === 'completed').length;
      const mOverdue = mTasks.filter(t => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < now).length;
      const mInProgress = mTasks.filter(t => t.status === 'in_progress' || t.status === 'review').length;
      const mRate = mTotal > 0 ? Math.round((mCompleted / mTotal) * 100) : 0;
      return {
        userId: u.id,
        name: u.name,
        avatar: u.avatar,
        department: u.department,
        role: u.role,
        total: mTotal,
        completed: mCompleted,
        overdue: mOverdue,
        inProgress: mInProgress,
        completionRate: mRate
      };
    });
  } else if (scope === 'manager') {
    // Only users in manager's department
    const deptUsers = allUsers.filter(u => u.department === userDept);
    memberPerformance = deptUsers.map(u => {
      const mTasks = filteredTasks.filter(t => t.assignedTo === u.id);
      const mTotal = mTasks.length;
      const mCompleted = mTasks.filter(t => t.status === 'completed').length;
      const mOverdue = mTasks.filter(t => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < now).length;
      const mInProgress = mTasks.filter(t => t.status === 'in_progress' || t.status === 'review').length;
      const mRate = mTotal > 0 ? Math.round((mCompleted / mTotal) * 100) : 0;
      return {
        userId: u.id,
        name: u.name,
        avatar: u.avatar,
        department: u.department,
        role: u.role,
        total: mTotal,
        completed: mCompleted,
        overdue: mOverdue,
        inProgress: mInProgress,
        completionRate: mRate
      };
    });
  } else if (scope === 'personal') {
    // Only self performance
    memberPerformance = [{
      userId: user.id,
      name: user.name,
      avatar: user.avatar,
      department: user.department,
      role: user.role,
      total,
      completed,
      overdue,
      inProgress,
      completionRate
    }];
  }

  // Personal tasks list (for user view)
  let personalTasks = [];
  if (scope === 'personal') {
    personalTasks = filteredTasks.map(t => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      status: t.status,
      progress: t.progress || 0,
      dueDate: t.dueDate,
      department: t.department,
      isOverdue: t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < now
    })).sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
      return 0;
    });
  }

  // 7-day trend calculated on filteredTasks
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const displayStr = `${d.getDate()}/${d.getMonth() + 1}`;
    
    const countCompletedOnDay = filteredTasks.filter(t => {
      return t.completedAt && t.completedAt.startsWith(dateStr);
    }).length;

    const countCreatedOnDay = filteredTasks.filter(t => {
      return t.createdAt && t.createdAt.startsWith(dateStr);
    }).length;

    last7Days.push({
      date: displayStr,
      completed: countCompletedOnDay,
      created: countCreatedOnDay
    });
  }

  res.json({
    scope,
    scopeTitle,
    scopeDesc,
    userRole,
    userDepartment: userDept,
    targetDept,
    canExportCsv: userRole !== 'viewer',
    kpis: {
      total,
      completed,
      inProgress,
      todo,
      review,
      overdue,
      urgent,
      completionRate
    },
    priorityMap: {
      urgent,
      high,
      medium,
      low
    },
    progressDistribution: {
      p0_25,
      p26_50,
      p51_75,
      p76_100
    },
    departmentMap,
    memberPerformance,
    personalTasks,
    trend: last7Days
  });
});

// CSV Export (Role-Enforced)
app.get('/api/reports/export-csv', authenticate, (req, res) => {
  const user = req.user;
  const canView = user.role === 'admin' || (user.permissions && user.permissions.canViewReports === true);
  if (!canView) {
    return res.status(403).json({ error: 'Bạn không có quyền trích xuất dữ liệu báo cáo của hệ thống.' });
  }

  if (user.role === 'viewer') {
    return res.status(403).json({ error: 'Tài khoản vai trò Chỉ Xem không có quyền trích xuất dữ liệu Excel/CSV.' });
  }

  const allTasks = db.getTasks();
  const users = db.getUsers();
  const userMap = new Map(users.map(u => [u.id, u.name]));

  let tasksToExport = [];
  let filePrefix = 'Bao_cao_cong_viec';

  if (user.role === 'admin') {
    const deptQuery = req.query.department;
    if (deptQuery && deptQuery !== 'all' && deptQuery !== 'Tất cả phòng ban') {
      tasksToExport = allTasks.filter(t => t.department === deptQuery);
      filePrefix = `Bao_cao_${encodeURIComponent(deptQuery)}`;
    } else {
      tasksToExport = allTasks;
      filePrefix = 'Bao_cao_toan_cong_ty';
    }
  } else if (user.role === 'manager') {
    tasksToExport = allTasks.filter(t => t.department === user.department);
    filePrefix = `Bao_cao_${encodeURIComponent(user.department || 'phong_ban')}`;
  } else {
    // Role: 'user'
    tasksToExport = allTasks.filter(t => t.assignedTo === user.id || t.createdBy === user.id);
    filePrefix = `Bao_cao_ca_nhan_${encodeURIComponent(user.name)}`;
  }

  let csv = '\uFEFFMã CV,Tiêu đề,Người phụ trách,Phòng ban,Độ ưu tiên,Trạng thái,Tiến độ (%),Ngày hết hạn\n';
  tasksToExport.forEach(t => {
    const assignee = userMap.get(t.assignedTo) || 'Chưa gán';
    const statusMap = {
      todo: 'Cần làm',
      in_progress: 'Đang làm',
      review: 'Chờ duyệt',
      completed: 'Hoàn thành'
    };
    const priorityMap = {
      urgent: 'Khẩn cấp',
      high: 'Cao',
      medium: 'Trung bình',
      low: 'Thấp'
    };
    const row = [
      `"${t.id}"`,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${assignee}"`,
      `"${t.department || ''}"`,
      `"${priorityMap[t.priority] || t.priority}"`,
      `"${statusMap[t.status] || t.status}"`,
      `${t.progress || 0}`,
      `"${t.dueDate ? new Date(t.dueDate).toLocaleDateString('vi-VN') : ''}"`
    ].join(',');
    csv += row + '\n';
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filePrefix}.csv"`);
  res.send(csv);
});

// -------------------------------------------------------------
// EXECUTIVE DESK (BÀN LÀM VIỆC AI - Phân Tích & Dự Báo Điều Hành Cao Cấp)
// -------------------------------------------------------------
function requireExecutiveDeskAccess(req, res, next) {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Chưa xác thực' });
  const hasAccess = user.role === 'admin' || (user.permissions && user.permissions.canAccessExecutiveDesk === true);
  if (!hasAccess) {
    return res.status(403).json({
      error: 'Quyền truy cập Bàn Làm Việc (Executive AI Cockpit) bị từ chối. Chức năng này yêu cầu phân quyền cấp cao (canAccessExecutiveDesk: true).'
    });
  }
  next();
}

// 1. Lấy toàn bộ phân tích AI nhân sự trễ hẹn & dự báo sức khỏe phòng ban
app.get('/api/executive-desk/analytics', authenticate, requireExecutiveDeskAccess, (req, res) => {
  try {
    const data = db.getExecutiveDeskAnalytics(req.query);
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('Error generating executive desk analytics:', err);
    res.status(500).json({ error: 'Lỗi khi tạo phân tích điều hành AI: ' + err.message });
  }
});

// 2. Trợ Lý AI Điều Hành Trực Tuyến (Interactive Executive AI Assistant)
app.post('/api/executive-desk/ask-ai', authenticate, requireExecutiveDeskAccess, (req, res) => {
  try {
    const { question, department } = req.body || {};
    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Vui lòng cung cấp câu hỏi cho Trợ lý AI.' });
    }
    const result = db.askExecutiveDeskAi(question, { department });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Error in askExecutiveDeskAi:', err);
    res.status(500).json({ error: 'Lỗi xử lý câu hỏi AI: ' + err.message });
  }
});

// 3. Thực hiện tái phân bổ cân bằng tải công việc (AI Workload Rebalance)
app.post('/api/executive-desk/rebalance', authenticate, requireExecutiveDeskAccess, (req, res) => {
  try {
    const { taskId, targetUserId } = req.body || {};
    if (!taskId || !targetUserId) {
      return res.status(400).json({ error: 'Thiếu mã công việc hoặc nhân sự nhận việc.' });
    }
    const result = db.executeExecutiveRebalance(taskId, targetUserId, req.user);

    // Realtime WS broadcast
    broadcast('task:updated', { task: result.task, updatedBy: `[Bàn Làm Việc AI] ${req.user.name}` });
    broadcast('executive:rebalance_applied', { taskId, targetUserId, triggeredBy: req.user.name });

    res.json({ success: true, message: 'Đã tái phân bổ và cân bằng tải công việc thành công!', task: result.task });
  } catch (err) {
    console.error('Error executing executive rebalance:', err);
    res.status(500).json({ error: 'Lỗi khi cân bằng tải công việc: ' + err.message });
  }
});

// -------------------------------------------------------------
// 3.1. KÍCH HOẠT HỌP KHẨN CẤP GOOGLE MEET (AI WAR-ROOM SUMMON)
// -------------------------------------------------------------
app.post('/api/executive-desk/war-room/summon', authenticate, requireExecutiveDeskAccess, (req, res) => {
  try {
    const { meetUrl, title, agenda, targetUserIds, department } = req.body || {};
    if (!meetUrl) {
      return res.status(400).json({ error: 'Vui lòng cung cấp hoặc khởi tạo liên kết Google Meet.' });
    }

    const meetingTitle = title || '🚨 HỌP KHẨN CẤP ĐIỀU HÀNH XỬ LÝ TRỄ HẠN (AI WAR-ROOM)';
    const cleanMeetUrl = meetUrl.trim();

    // Xác định danh sách nhân sự nhận lệnh triệu tập
    const allUsers = db.getUsers();
    let targetUsers = [];
    if (Array.isArray(targetUserIds) && targetUserIds.length > 0) {
      targetUsers = allUsers.filter(u => targetUserIds.includes(u.id));
    } else if (department && department !== 'all') {
      targetUsers = allUsers.filter(u => u.department === department);
    } else {
      // Mặc định: những người đang có việc quá hạn + toàn bộ admin/trưởng phòng
      const tasks = db.getTasks();
      const overdueAssignees = new Set(
        tasks.filter(t => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < new Date()).map(t => t.assignedTo)
      );
      targetUsers = allUsers.filter(u => u.role === 'admin' || overdueAssignees.has(u.id));
    }

    const notifiedUserIds = [];
    targetUsers.forEach(u => {
      if (u.id !== req.user.id) {
        const notif = db.addNotification({
          userId: u.id,
          type: 'alert',
          level: 'danger',
          title: meetingTitle,
          message: `${req.user.name} triệu tập họp khẩn: "${meetingTitle}". Nhấp để vào phòng họp Google Meet ngay lập tức!`,
          meetUrl: cleanMeetUrl
        });
        broadcast('alert:new', notif, u.id);
        notifiedUserIds.push(u.id);
      }
    });

    // Realtime War-room broadcast to all or target clients
    broadcast('executive:war_room_summon', {
      sender: { id: req.user.id, name: req.user.name, avatar: req.user.avatar },
      title: meetingTitle,
      meetUrl: cleanMeetUrl,
      agenda: agenda || 'Họp rà soát và xử lý các điểm nghẽn công việc quá hạn khẩn cấp.',
      department: department || 'Toàn Doanh Nghiệp',
      timestamp: new Date().toISOString(),
      targetUserIds: notifiedUserIds
    });

    res.json({
      success: true,
      message: `Đã phát lệnh triệu tập họp khẩn cấp thành công tới ${notifiedUserIds.length} nhân sự liên quan!`,
      notifiedCount: notifiedUserIds.length,
      meetUrl: cleanMeetUrl
    });
  } catch (err) {
    console.error('Error summoning executive war room:', err);
    res.status(500).json({ error: 'Lỗi phát lệnh họp khẩn cấp: ' + err.message });
  }
});

// 4. Lấy Poster thông báo nhiệm vụ đặc biệt (Công khai trước màn hình đăng nhập)
app.get('/api/announcement-poster', (req, res) => {
  try {
    const poster = db.getAnnouncementPoster();
    res.json({ success: true, poster });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi lấy poster thông báo: ' + err.message });
  }
});

// 5. Cập nhật / Xuất bản Poster thông báo nhiệm vụ đặc biệt (Admin / Executive Desk)
app.post('/api/announcement-poster', authenticate, requireExecutiveDeskAccess, (req, res) => {
  try {
    let posterData = { ...req.body };
    if (posterData.imageDataUrl && posterData.imageDataUrl.startsWith('data:image/')) {
      try {
        const base64Data = posterData.imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const imgPath = path.join(__dirname, 'public', 'images', 'active-announcement-poster.png');
        fs.writeFileSync(imgPath, buffer);
        posterData.imageUrl = `/images/active-announcement-poster.png?v=${Date.now()}`;
        delete posterData.imageDataUrl;
      } catch (imgErr) {
        console.warn('Could not save poster image to disk:', imgErr);
      }
    }

    const poster = db.updateAnnouncementPoster(posterData, req.user);
    // Realtime broadcast
    broadcast('announcement:updated', { poster, updatedBy: req.user.name });
    res.json({ success: true, poster, message: 'Đã cập nhật và xuất bản poster thông báo thành công!' });
  } catch (err) {
    console.error('Error updating announcement poster:', err);
    res.status(500).json({ error: 'Lỗi cập nhật poster thông báo: ' + err.message });
  }
});

// -------------------------------------------------------------
// USER MANAGEMENT ROUTES (Admin)
// -------------------------------------------------------------
app.get('/api/users', authenticate, (req, res) => {
  const users = db.getUsers();
  res.json({ users });
});

app.post('/api/users', authenticate, requireAdmin, (req, res) => {
  const { name, email, password, role, department, position, phone, active, permissions } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Tên và email là bắt buộc' });
  }

  const existing = db.getUserByEmail(email);
  if (existing) {
    return res.status(400).json({ error: 'Email này đã tồn tại trong hệ thống' });
  }

  const user = db.createUser({
    name,
    email,
    password: password || '123456',
    role: role || 'user',
    department,
    position,
    phone,
    active: typeof active === 'boolean' ? active : true,
    permissions
  });

  db.logActivity({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    userAvatar: req.user.avatar || '👑',
    action: 'create_user',
    category: 'user',
    details: `Admin đã thêm nhân sự mới: "${user.name}" (${user.email} - ${user.department})`
  });

  broadcast('user:created', { user });

  res.status(201).json({ user });
});

app.put('/api/users/:id', authenticate, (req, res) => {
  const isManagerOrAdmin = req.user.role === 'admin' || req.user.permissions?.canManageUsers;
  if (!isManagerOrAdmin && req.user.id !== req.params.id) {
    return res.status(403).json({ error: 'Không có quyền sửa thông tin người dùng này' });
  }

  const updates = { ...req.body };
  if (!isManagerOrAdmin) {
    delete updates.role;
    delete updates.active;
    delete updates.permissions;
  }

  const targetOld = db.getUserById(req.params.id);
  if (!targetOld) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

  const updatedUser = db.updateUser(req.params.id, updates);
  if (!updatedUser) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

  let detailMsg = `Đã cập nhật thông tin hồ sơ cá nhân`;
  if (req.user.id !== updatedUser.id) {
    const roleChanged = updates.role && updates.role !== targetOld.role;
    const statusChanged = typeof updates.active === 'boolean' && updates.active !== targetOld.active;
    if (roleChanged || updates.permissions) {
      detailMsg = `Admin đã phân quyền cho nhân sự: "${updatedUser.name}" [Vai trò: ${updatedUser.role.toUpperCase()}]`;
    } else if (statusChanged) {
      detailMsg = `Admin đã ${updatedUser.active ? 'kích hoạt' : 'tạm khóa'} tài khoản nhân sự: "${updatedUser.name}"`;
    } else {
      detailMsg = `Admin đã chỉnh sửa thông tin nhân sự: "${updatedUser.name}" (${updatedUser.email})`;
    }
  }

  db.logActivity({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    userAvatar: req.user.avatar || '👤',
    action: 'update_user',
    category: 'user',
    details: detailMsg
  });

  broadcast('user:updated', { user: updatedUser });

  res.json({ user: updatedUser });
});

app.post('/api/users/:id/reset-password', authenticate, requireAdmin, (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.trim().length < 6) {
    return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
  }

  const user = db.getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

  db.updateUser(req.params.id, { password: newPassword.trim() });

  db.logActivity({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    userAvatar: req.user.avatar || '👑',
    action: 'reset_password',
    category: 'user',
    details: `Admin đã đặt lại mật khẩu mới cho tài khoản "${user.name}" (${user.email})`
  });

  res.json({ success: true, message: `Đã đặt lại mật khẩu cho tài khoản "${user.name}" thành công!` });
});

app.patch('/api/users/:id/status', authenticate, requireAdmin, (req, res) => {
  const { active } = req.body;
  if (typeof active !== 'boolean') {
    return res.status(400).json({ error: 'Trạng thái active không hợp lệ' });
  }

  if (req.params.id === req.user.id && !active) {
    return res.status(400).json({ error: 'Không thể tự khóa tài khoản quản trị của chính bạn' });
  }

  const user = db.getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

  const updatedUser = db.updateUser(req.params.id, { active });

  db.logActivity({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    userAvatar: req.user.avatar || '👑',
    action: 'toggle_user_status',
    category: 'user',
    details: `Admin đã ${active ? 'kích hoạt mở khóa' : 'tạm khóa'} tài khoản "${user.name}" (${user.email})`
  });

  broadcast('user:updated', { user: updatedUser });

  res.json({ success: true, user: updatedUser });
});

app.delete('/api/users/:id', authenticate, requireAdmin, (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Không thể tự xóa tài khoản quản trị hiện tại của chính bạn' });
  }
  const userToDelete = db.getUserById(req.params.id);
  const ok = db.deleteUser(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

  db.logActivity({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    userAvatar: req.user.avatar || '👑',
    action: 'delete_user',
    category: 'user',
    details: `Admin đã xóa tài khoản nhân sự: "${userToDelete ? userToDelete.name : req.params.id}" (${userToDelete ? userToDelete.email : ''})`
  });

  broadcast('user:deleted', { userId: req.params.id });

  res.json({ success: true, message: 'Đã xóa người dùng thành công' });
});

// -------------------------------------------------------------
// SYSTEM / ACTIVITY / VERSION ROUTES
// -------------------------------------------------------------
const APP_VERSION = '3.5.0';
const APP_BUILD_DATE = '26/10/2026';
const APP_CHANGELOG = [
  {
    version: 'v3.5.0',
    date: '26/10/2026',
    title: 'Tối Ưu Bản Tin VMG Realtime Trên Điện Thoại Di Động (Mobile News Ticker Polish)',
    highlights: [
      'Hiển thị huy hiệu nhận diện "TIN VMG" sắc nét trên di động, đảm bảo nhận diện thương hiệu rõ ràng ngay đầu thanh tin tức',
      'Khắc phục triệt để lỗi đứng hình (sticky hover pause) trên màn hình cảm ứng điện thoại, cho phép chạm vuốt mượt mà mà không làm gián đoạn dòng chữ chạy',
      'Loại bỏ lỗi mất nét / trong suốt do bộ giải mã GPU WebKit trên thiết bị di động, bổ sung đầy đủ vendor prefix -webkit-animation',
      'Bố trí thanh điều hướng siêu gọn gàng: Nút quản trị ✏️ dành cho Admin, nút tạm dừng ⏸/▶ và nút đóng ✕ cân đối với thanh cuộn',
      'Cập nhật Cache Busters v3.5.0 tự động đồng bộ mã nguồn và style mới nhất tới toàn bộ trình duyệt điện thoại di động'
    ]
  },
  {
    version: 'v3.4.0',
    date: '25/10/2026',
    title: 'Bản Tin Chạy Chữ Nội Bộ Realtime & Quản Trị Phát Sóng (News Ticker Pro)',
    highlights: [
      'Bản tin nội bộ kính mờ (Glassmorphism) chạy chữ từ trái sang phải mượt mà ngay dưới thanh Header',
      'Bảng Quản trị Đăng tin dành riêng cho Admin: Tạo tin mới, Đặt ngày hết hạn, Ghim ưu tiên đầu dòng, Bật/Tắt phát sóng tức thì',
      'Đồng bộ phát sóng Realtime qua WebSocket: Mọi nhân sự nhận ngay tin mới mà không cần tải lại trang',
      'Modal xem toàn văn chi tiết từng mẩu tin với phân loại mức độ phong phú (Khẩn cấp, Vinh danh, Tin vui, Lịch họp, AI)',
      'Lưu trữ dữ liệu tin tức vĩnh viễn trên cơ sở dữ liệu hệ thống, tự động ẩn khi đến hạn'
    ]
  },
  {
    version: 'v3.3.0',
    date: '25/10/2026',
    title: 'Tối Ưu Giao Diện Di Động Toàn Diện (Mobile-First Polish & Safe Area)',
    highlights: [
      'Khắc phục triệt để lỗi khuất chữ tiêu đề trên điện thoại di động (Title truncation fixed): giải phóng 100% không gian hiển thị, ẩn vector thừa trên màn hình nhỏ, bảo đảm hiển thị trọn vẹn tên bảng công việc',
      'Cân đối thẻ chỉ số KPI di động: Thẻ thứ 5 (Ưu tiên khẩn cấp) tự động trải rộng cân bằng 100% 2 cột (span 2), loại bỏ khoảng trống bất đối xứng',
      'Đồng bộ 4 tab điều hướng Kanban: Phân bổ đối xứng 25% vừa vặn mọi màn hình điện thoại (320px - 480px), không còn bị tràn chữ hay che khuất tab Đã hoàn thành',
      'Vùng an toàn (Safe Area Scroll Padding): Tăng khoảng cách cuộn đáy 84px - 72px và tinh chỉnh nút Trợ lý Work Smart AI 48px, đảm bảo không bao giờ che khuất nội dung thẻ công việc',
      'Bộ kỹ năng (Skill) & Quy tắc (Rule) chuẩn hóa giao diện di động: Tự động bảo vệ giao diện di động khi phát triển tính năng mới'
    ]
  },
  {
    version: 'v3.2.0',
    date: '22/10/2026',
    title: 'Phân Quyền Báo Cáo Thông Minh Theo Từng Vai Trò Chức Năng',
    highlights: [
      'Quản Trị Viên (Admin): Báo cáo toàn doanh nghiệp 16 phòng ban, bộ lọc linh hoạt từng phòng ban, bảng xếp hạng KPI toàn bộ nhân viên, xuất dữ liệu toàn cảnh',
      'Trưởng Phòng / Quản Lý (Manager): Giới hạn bảo mật xem báo cáo phòng ban mình phụ trách, đánh giá chỉ số KPI và biểu đồ hiệu suất nhân sự trực thuộc bộ phận',
      'Nhân Viên (Member): Báo cáo hiệu suất cá nhân (My KPI Report), phân bổ mức độ ưu tiên, danh sách nhiệm vụ trọng tâm cần hoàn thành, bảo mật không lộ dữ liệu người khác',
      'Chỉ Xem (Viewer): Chế độ theo dõi tiến độ cấp cao (Read-only), tự động khóa và chặn quyền trích xuất dữ liệu Excel/CSV để bảo vệ dữ liệu',
      'Kiểm soát quyền canViewReports nghiêm ngặt: Chặn 403 Forbidden tại API máy chủ và hiển thị cảnh báo truy cập bị từ chối nếu không được cấp phép'
    ]
  },
  {
    version: 'v3.1.0',
    date: '22/10/2026',
    title: 'Hệ Thống Phân Quyền Nâng Cao & Quản Trị Trực Tiếp Từng Tài Khoản Nhân Sự',
    highlights: [
      'Bổ sung cấp bậc vai trò đa tầng: Quản Trị Viên (Admin), Trưởng Phòng / Quản Lý (Manager), Nhân Viên (Member), Khách Chỉ Xem (Viewer)',
      'Ma trận 8 quyền hạn chi tiết cho từng account: Tạo việc, Sửa việc, Xóa việc, Nghiệm thu/Duyệt việc, Quản lý phòng ban, Phân quyền nhân sự, Cấu hình Automation, Xem báo cáo KPI',
      'Thao tác nhanh trực tiếp trên từng dòng: Đổi vai trò trực tiếp (Inline Role), chuyển phòng ban trực tiếp (Inline Dept), khóa/mở khóa tài khoản tức thì',
      'Tính năng đặt lại mật khẩu nhanh 1-Click cho nhân sự dành riêng cho Quản trị viên',
      'Bảng điều khiển đo lường nhân sự thời gian thực và bộ lọc tìm kiếm đa tiêu chí'
    ]
  },
  {
    version: 'v3.0.0',
    date: '22/10/2026',
    title: 'Động Cơ Tự Động Hóa Quy Trình Realtime (Workflow Automation Pro)',
    highlights: [
      'Trung tâm Tự Động Hóa Workflow Automation với thẻ quy tắc trực quan theo cú pháp KHI (Trigger) -> THÌ (Action)',
      'Công tắc bật/tắt (Toggle Switch) mượt mà chuẩn iOS trên cả điện thoại và máy tính',
      'Động cơ tự động hóa nền tảng kích hoạt tức thì khi người dùng hoàn thành việc, đạt 100% tiến độ, gắn cờ khẩn cấp hoặc trễ hạn',
      'Nút "Chạy Thử Ngay" kèm hiệu ứng tia chớp, âm thanh arpeggio và đồng bộ WebSocket toàn hệ thống',
      'Khung nhật ký thực thi thời gian thực (Live Execution Feed) và thống kê số giờ lao động tiết kiệm được'
    ]
  },
  {
    version: 'v2.9.0',
    date: '22/10/2026',
    title: 'Lịch & Thời Hạn Đa Chế Độ: Ngày, Tuần, Tháng',
    highlights: [
      'Bổ sung thanh điều hướng chuyển đổi 3 chế độ linh hoạt: Ngày (Day), Tuần (Week), Tháng (Month)',
      'Chế độ Tháng hiển thị toàn cảnh ngày trong tháng kèm chip việc theo trạng thái và độ ưu tiên',
      'Chế độ Tuần hiển thị cột 7 ngày chi tiết tiến độ công việc và trạng thái hạn chót',
      'Chế độ Ngày tập trung bảng điều khiển công việc hôm nay, phân loại việc cần làm, đang làm và cảnh báo quá hạn',
      'Hỗ trợ nút "Hôm Nay", chuyển tiếp thời gian Trước/Sau và 1-click chuyển nhanh từ ô Tháng sang Ngày'
    ]
  },
  {
    version: 'v2.8.5',
    date: '22/10/2026',
    title: 'Hệ Thống Nhật Ký & Theo Dõi Mọi Thao Tác Realtime (Audit Stream)',
    highlights: [
      'Ghi nhận tức thì 100% mọi thao tác từ User đến Admin: Đăng nhập/Đăng xuất, SSO, Thêm/Sửa/Xóa việc, Cập nhật trạng thái/tiến độ, Phòng ban, Quản trị nhân sự',
      'Đồng bộ phát sóng Realtime qua WebSocket tới toàn bộ người dùng mà không cần tải lại trang',
      'Bộ lọc chuyên sâu theo Vai trò (Admin/Nhân sự), theo Hạng mục (Công việc, Phòng ban, Nhân sự, Hệ thống) và tìm kiếm thông minh',
      'Giao diện dòng sự kiện (Live Feed) hiện đại kèm thẻ màu nhận diện vai trò và hiệu ứng phát sáng thao tác mới'
    ]
  },
  {
    version: 'v2.8.0',
    date: '22/10/2026',
    title: 'Hệ thống Quản lý & Cập nhật Phiên bản Tự động',
    highlights: [
      'Tự động kiểm tra và cảnh báo khi có phiên bản mới từ máy chủ',
      'Nút "Làm mới & Xóa Cache" 1-click cập nhật ngay lập tức giao diện và mã nguồn mới',
      'Hiển thị Changelog lịch sử nâng cấp tính năng trực quan, minh bạch',
      'Admin có thể phát thông báo cập nhật Realtime qua WebSocket tới toàn bộ nhân sự'
    ]
  },
  {
    version: 'v2.7.0',
    date: '19/10/2026',
    title: 'Bảng màu 4 Cột Kanban Nhận Diện Giai Đoạn',
    highlights: [
      'Gán bảng màu trực quan cho 4 giai đoạn: Cần Làm (Xám/Slate), Đang Làm (Xanh Lam), Chờ Duyệt (Vàng Cam), Hoàn Thành (Xanh Mint)',
      'Tương phản cao với thẻ việc nền trắng, giúp theo dõi trạng thái dự án dễ dàng',
      'Đồng bộ giao diện Dark Mode và Mobile Navigation Tabs'
    ]
  },
  {
    version: 'v2.6.0',
    date: '19/10/2026',
    title: 'Chỉnh Sửa & Điều Chỉnh Phòng Ban Cho Admin',
    highlights: [
      'Tính năng sửa tên phòng ban trực tiếp (Inline Editing) với phím Enter/Escape',
      'Cập nhật đồng bộ liên hoàn (Cascading update) cho toàn bộ nhân sự và công việc liên quan'
    ]
  },
  {
    version: 'v2.5.0',
    date: '19/10/2026',
    title: 'Đăng Nhập & Đăng Ký SSO Google Workspace',
    highlights: [
      'Tích hợp SSO 1-click dành riêng cho tên miền nội bộ @vmg.edu.vn',
      'Tự động cấp tài khoản an toàn (Auto-provisioning) và hỗ trợ khôi phục mật khẩu OTP'
    ]
  },
  {
    version: 'v2.0.0',
    date: '18/10/2026',
    title: 'Nâng Cấp Toàn Diện WebSocket Realtime & Báo Cáo KPI',
    highlights: [
      'Đồng bộ tức thì mọi thao tác tạo, sửa, đổi trạng thái qua WebSocket',
      'Bảng điều khiển KPI tự động quét cảnh báo trễ hạn',
      'Biểu đồ tiến độ dự án, phân tích hiệu suất nhân sự và xuất báo cáo CSV'
    ]
  }
];

app.get('/api/system/version', (req, res) => {
  res.json({
    version: APP_VERSION,
    buildDate: APP_BUILD_DATE,
    changelog: APP_CHANGELOG,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/system/publish-update', authenticate, requireAdmin, (req, res) => {
  const { customMessage } = req.body || {};
  const updatePayload = {
    version: APP_VERSION,
    buildDate: APP_BUILD_DATE,
    message: customMessage || `Đã có bản cập nhật mới TaskFlow Pro v${APP_VERSION}! Vui lòng làm mới trang để áp dụng.`,
    publishedBy: req.user.name,
    timestamp: new Date().toISOString()
  };

  db.logActivity({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    userAvatar: req.user.avatar || '👑',
    action: 'publish_update',
    category: 'system',
    details: `Admin đã phát thông báo cập nhật phiên bản mới v${APP_VERSION} tới toàn bộ hệ thống`
  });

  broadcast('system:new_version_available', updatePayload);
  res.json({ success: true, message: `Đã phát thông báo phiên bản v${APP_VERSION} thành công!`, payload: updatePayload });
});

app.get('/api/activities', authenticate, (req, res) => {
  const isAdminOrHr = req.user.role === 'admin' || (req.user.permissions && req.user.permissions.canManageUsers);
  if (!isAdminOrHr) {
    return res.status(403).json({ error: 'Bạn không có quyền truy cập nhật ký hoạt động của hệ thống.' });
  }
  const activities = db.getActivities(100);
  res.json({ activities });
});

app.post('/api/system/reset-demo', authenticate, requireAdmin, (req, res) => {
  db.reset();
  db.logActivity({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    userAvatar: req.user.avatar || '👑',
    action: 'system_reset',
    category: 'system',
    details: 'Admin đã thực hiện khôi phục dữ liệu mẫu hệ thống về mặc định'
  });
  broadcast('system:reset', { message: 'Dữ liệu đã được đặt lại về mặc định!' });
  res.json({ success: true, message: 'Đã hoàn tất đặt lại dữ liệu mẫu' });
});

// -------------------------------------------------------------
// INTERNAL NEWS TICKER SYSTEM (Phương Án 2)
// -------------------------------------------------------------
// 1. Get active news for news ticker
app.get('/api/news', (req, res) => {
  const activeNews = db.getActiveNews();
  res.json({ news: activeNews });
});

// 2. Get all news for Admin management
app.get('/api/admin/news', authenticate, requireAdmin, (req, res) => {
  const allNews = db.getNews();
  res.json({ news: allNews });
});

// 3. Create news item (Admin only)
app.post('/api/admin/news', authenticate, requireAdmin, (req, res) => {
  const { title, content, tag, tagText, department, expireAt, pinned } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Tiêu đề bản tin không được để trống' });
  }

  const news = db.createNews({
    title,
    content,
    tag,
    tagText,
    department,
    expireAt,
    pinned
  }, req.user.name);

  db.logActivity({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    userAvatar: req.user.avatar || '👑',
    action: 'create_news',
    category: 'system',
    details: `Admin đã đăng bản tin nội bộ mới: "${news.title}" [${news.tagText}]`
  });

  // Broadcast realtime via WebSocket to all clients
  const activeNews = db.getActiveNews();
  broadcast('news:created', { news, activeNews });

  res.status(201).json({
    success: true,
    news,
    message: 'Đã đăng bản tin nội bộ thành công!'
  });
});

// 4. Update news item (Admin only)
app.put('/api/admin/news/:id', authenticate, requireAdmin, (req, res) => {
  const news = db.updateNews(req.params.id, req.body);
  if (!news) {
    return res.status(404).json({ error: 'Không tìm thấy bản tin cần cập nhật' });
  }

  db.logActivity({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    userAvatar: req.user.avatar || '👑',
    action: 'update_news',
    category: 'system',
    details: `Admin đã chỉnh sửa bản tin nội bộ: "${news.title}"`
  });

  const activeNews = db.getActiveNews();
  broadcast('news:updated', { news, activeNews });

  res.json({
    success: true,
    news,
    message: 'Cập nhật bản tin thành công!'
  });
});

// 5. Delete news item (Admin only)
app.delete('/api/admin/news/:id', authenticate, requireAdmin, (req, res) => {
  const item = db.getNewsById(req.params.id);
  const success = db.deleteNews(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Không tìm thấy bản tin cần xóa' });
  }

  db.logActivity({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    userAvatar: req.user.avatar || '👑',
    action: 'delete_news',
    category: 'system',
    details: `Admin đã xóa bản tin nội bộ: "${item ? item.title : req.params.id}"`
  });

  const activeNews = db.getActiveNews();
  broadcast('news:deleted', { id: req.params.id, activeNews });

  res.json({
    success: true,
    message: 'Đã xóa bản tin nội bộ thành công!'
  });
});

// -------------------------------------------------------------
// DEPARTMENTS ROUTES
// -------------------------------------------------------------
app.get('/api/departments', (req, res) => {
  const departments = db.getDepartments();
  res.json({ departments });
});

app.post('/api/departments', authenticate, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Tên phòng ban không được để trống' });
  }

  try {
    const department = db.createDepartment(name);
    
    db.logActivity({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      userAvatar: req.user.avatar || '🏢',
      action: 'create_department',
      category: 'department',
      details: `${req.user.role === 'admin' ? 'Admin' : 'Người dùng'} đã thêm phòng ban mới: "${department.name}"`
    });

    // Realtime WS broadcast
    broadcast('department:created', { department, createdBy: req.user.name });

    res.status(201).json({ success: true, department });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/departments/:id', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Tên phòng ban mới không được để trống' });
  }

  try {
    const result = db.updateDepartment(id, name);

    db.logActivity({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      userAvatar: req.user.avatar || '👑',
      action: 'update_department',
      category: 'department',
      details: `Admin đã đổi tên phòng ban từ "${result.oldName}" thành "${result.newName}" (${result.updatedUsersCount} nhân sự, ${result.updatedTasksCount} công việc được cập nhật)`
    });

    broadcast('department:updated', {
      department: result.department,
      oldName: result.oldName,
      newName: result.newName,
      updatedBy: req.user.name
    });

    res.json({
      success: true,
      department: result.department,
      oldName: result.oldName,
      newName: result.newName,
      message: `Đã cập nhật phòng ban thành "${result.newName}"`
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/departments/:id', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const depts = db.getDepartments();
  const dept = depts.find(d => d.id === id || d.name === id);
  if (!dept) {
    return res.status(404).json({ error: 'Không tìm thấy phòng ban cần xóa' });
  }

  const success = db.deleteDepartment(dept.id);
  if (success) {
    db.logActivity({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      userAvatar: req.user.avatar || '👑',
      action: 'delete_department',
      category: 'department',
      details: `Admin đã xóa phòng ban: "${dept.name}"`
    });

    broadcast('department:deleted', { departmentId: dept.id, name: dept.name, deletedBy: req.user.name });
    res.json({ success: true, message: `Đã xóa phòng ban "${dept.name}"` });
  } else {
    res.status(400).json({ error: 'Không thể xóa phòng ban' });
  }
});

// -------------------------------------------------------------
// WORKFLOW AUTOMATION ROUTES
// -------------------------------------------------------------
app.get('/api/automations', authenticate, (req, res) => {
  const automations = db.getAutomations();
  res.json({ automations });
});

app.post('/api/automations', authenticate, (req, res) => {
  const rule = db.createAutomation(req.body);
  db.logActivity({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    userAvatar: req.user.avatar || '⚡',
    action: 'create_automation',
    category: 'system',
    details: `Đã tạo quy tắc tự động hóa mới: "${rule.name}" (${rule.triggerLabel})`
  });
  broadcast('automation:updated', { rule, action: 'created' });
  res.status(201).json({ rule });
});

app.put('/api/automations/:id', authenticate, (req, res) => {
  const updated = db.updateAutomation(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Không tìm thấy quy tắc tự động' });
  db.logActivity({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    userAvatar: req.user.avatar || '⚡',
    action: 'update_automation',
    category: 'system',
    details: `Đã cập nhật quy tắc tự động "${updated.name}" (Trạng thái: ${updated.enabled ? 'Đang bật' : 'Tạm dừng'})`
  });
  broadcast('automation:updated', { rule: updated, action: 'updated' });
  res.json({ rule: updated });
});

app.delete('/api/automations/:id', authenticate, requireAdmin, (req, res) => {
  const rule = db.getAutomationById(req.params.id);
  const ok = db.deleteAutomation(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Không tìm thấy quy tắc' });
  db.logActivity({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    userAvatar: req.user.avatar || '👑',
    action: 'delete_automation',
    category: 'system',
    details: `Admin đã xóa quy tắc tự động: "${rule ? rule.name : req.params.id}"`
  });
  broadcast('automation:updated', { ruleId: req.params.id, action: 'deleted' });
  res.json({ success: true, message: 'Đã xóa quy tắc thành công' });
});

app.post('/api/automations/:id/trigger', authenticate, (req, res) => {
  const rule = db.getAutomationById(req.params.id);
  if (!rule) return res.status(404).json({ error: 'Không tìm thấy quy tắc' });

  // Record manual test run
  db.recordAutomationExecution(rule.id);
  const message = `Bot "${rule.name}" đã kích hoạt thực thi thành công! ${rule.actionLabel}`;

  db.logActivity({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    userAvatar: req.user.avatar || '⚡',
    action: 'trigger_automation',
    category: 'system',
    details: `Người dùng đã kích hoạt chạy thử thủ công Bot "${rule.name}"`
  });

  broadcast('automation:executed', {
    ruleId: rule.id,
    ruleName: rule.name,
    icon: rule.icon,
    actionDesc: message,
    timestamp: new Date().toISOString()
  });

  res.json({
    success: true,
    message,
    rule: db.getAutomationById(rule.id)
  });
});

// -------------------------------------------------------------
// WORK SMART AI FEEDBACK & SUGGESTIONS
// -------------------------------------------------------------
app.get('/api/feedbacks', authenticate, (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const list = db.getFeedbacks();
  if (isAdmin) {
    return res.json({ feedbacks: list });
  }
  const userList = list.filter(f => f.userId === req.user.id);
  res.json({ feedbacks: userList });
});

app.post('/api/feedbacks', (req, res) => {
  let user = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    } catch (_) {}
  }

  const { content, category, rating, email, name } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Vui lòng nhập nội dung ý kiến đóng góp' });
  }

  const feedback = db.createFeedback({
    userId: user ? user.id : 'guest',
    userName: user ? user.name : (name || 'Người dùng Work Smart AI'),
    userEmail: user ? user.email : (email || ''),
    userRole: user ? user.role : 'guest',
    userDepartment: user ? (user.department || '') : '',
    category: category || 'suggestion',
    content: content.trim(),
    rating: Number(rating) || 5
  });

  db.logActivity({
    userId: user ? user.id : 'system',
    userName: user ? user.name : 'Work Smart AI',
    userRole: user ? user.role : 'system',
    userAvatar: '💡',
    action: 'submit_feedback',
    category: 'system',
    details: `Work Smart AI: Tiếp nhận ý kiến đóng góp [${category || 'Góp ý'}]: "${content.substring(0, 80)}${content.length > 80 ? '...' : ''}"`
  });

  broadcast('feedback:new', { feedback });

  res.status(201).json({
    success: true,
    message: 'Cảm ơn bạn! Ý kiến đóng góp đã được gửi thành công tới Ban quản trị TaskFlow Pro.',
    feedback
  });
});

// -------------------------------------------------------------
// ALERT RULES & ANTI-FATIGUE CONFIGURATION (ADMIN ONLY)
// -------------------------------------------------------------
app.get('/api/settings/alerts', authenticate, (req, res) => {
  res.json({
    settings: db.getAlertSettings(),
    isAdmin: req.user.role === 'admin'
  });
});

app.put('/api/settings/alerts', authenticate, (req, res) => {
  // STRICT ADMIN PERMISSION GUARD
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Bảo mật: Chỉ Quản Trị Viên (Admin) mới có quyền chỉnh sửa cấu hình quy tắc cảnh báo!'
    });
  }

  const {
    warningThresholdHours,
    repeatIntervalHours,
    quietHoursEnabled,
    quietHoursStart,
    quietHoursEnd,
    weekendQuietEnabled,
    notifyAdminOnAllOverdue,
    soundAlertEnabled
  } = req.body;

  const current = db.getAlertSettings();
  const updated = db.updateAlertSettings({
    warningThresholdHours: warningThresholdHours !== undefined ? Number(warningThresholdHours) : current.warningThresholdHours,
    repeatIntervalHours: repeatIntervalHours !== undefined ? Number(repeatIntervalHours) : current.repeatIntervalHours,
    quietHoursEnabled: quietHoursEnabled !== undefined ? Boolean(quietHoursEnabled) : current.quietHoursEnabled,
    quietHoursStart: quietHoursStart || current.quietHoursStart,
    quietHoursEnd: quietHoursEnd || current.quietHoursEnd,
    weekendQuietEnabled: weekendQuietEnabled !== undefined ? Boolean(weekendQuietEnabled) : current.weekendQuietEnabled,
    notifyAdminOnAllOverdue: notifyAdminOnAllOverdue !== undefined ? Boolean(notifyAdminOnAllOverdue) : current.notifyAdminOnAllOverdue,
    soundAlertEnabled: soundAlertEnabled !== undefined ? Boolean(soundAlertEnabled) : current.soundAlertEnabled
  });

  db.logActivity({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    userAvatar: req.user.avatar || '⚙️',
    action: 'update_alert_rules',
    category: 'system',
    details: `Admin cập nhật quy tắc cảnh báo: Ngưỡng sắp trễ ${updated.warningThresholdHours}h, Nhắc lại mỗi ${updated.repeatIntervalHours}h, Giờ yên tĩnh: ${updated.quietHoursEnabled ? updated.quietHoursStart + '-' + updated.quietHoursEnd : 'Tắt'}`
  });

  broadcast('settings:alerts:updated', { settings: updated });

  res.json({
    success: true,
    message: 'Đã lưu cấu hình quy tắc cảnh báo thành công!',
    settings: updated
  });
});

// -------------------------------------------------------------
// SNOOZE / TEMPORARY PAUSE ALERT ON TASK (Anti-Fatigue)
// -------------------------------------------------------------
app.post('/api/tasks/:id/snooze-alert', authenticate, (req, res) => {
  const task = db.getTaskById(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Không tìm thấy công việc' });
  }

  const isOwner = task.assignedTo === req.user.id;
  const isPrivileged = req.user.role === 'admin' || req.user.role === 'manager';
  if (!isOwner && !isPrivileged) {
    return res.status(403).json({
      error: 'Bạn chỉ có quyền tạm hoãn cảnh báo cho các công việc được phân công cho mình!'
    });
  }

  const hours = Number(req.body.hours) || 24;
  const reason = (req.body.reason || 'Đang xử lý / Đã xin gia hạn').trim();
  const updatedTask = db.snoozeTaskAlert(req.params.id, hours, reason, req.user.id);

  db.logActivity({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    userAvatar: req.user.avatar || '💤',
    action: 'snooze_alert',
    category: 'task',
    details: `Tạm hoãn cảnh báo #${task.id} (${task.title}) trong ${hours}h. Lý do: "${reason}"`
  });

  broadcast('task:alert:snoozed', { task: updatedTask, user: req.user, hours, reason });

  res.json({
    success: true,
    message: `Đã tạm hoãn cảnh báo cho công việc #${task.id} trong ${hours} giờ`,
    task: updatedTask
  });
});

app.post('/api/tasks/:id/unsnooze-alert', authenticate, (req, res) => {
  const task = db.getTaskById(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Không tìm thấy công việc' });
  }

  const isOwner = task.assignedTo === req.user.id;
  const isPrivileged = req.user.role === 'admin' || req.user.role === 'manager';
  if (!isOwner && !isPrivileged) {
    return res.status(403).json({ error: 'Không có quyền thao tác' });
  }

  const updatedTask = db.unsnoozeTaskAlert(req.params.id);
  broadcast('task:alert:unsnoozed', { task: updatedTask, user: req.user });

  res.json({
    success: true,
    message: `Đã khôi phục cảnh báo thời hạn cho công việc #${task.id}`,
    task: updatedTask
  });
});

// SPA catch-all
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// -------------------------------------------------------------
// START SERVER
// -------------------------------------------------------------
server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🚀 TaskFlow Pro Webapp đang chạy tại: http://localhost:${PORT}`);
  console.log(`📡 WebSocket Realtime Server sẵn sàng phục vụ!`);
  console.log(`🔔 Tự động quét và phát hiện cảnh báo quá hạn kích hoạt.`);
  console.log(`=======================================================`);
});
