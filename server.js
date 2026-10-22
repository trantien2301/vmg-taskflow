const express = require('express');
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
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
  const settings = db.getSettings();
  const warningHours = settings.warningThresholdHours || 24;
  let newAlertCount = 0;

  tasks.forEach(task => {
    if (task.status === 'completed') return;
    if (!task.dueDate) return;

    const due = new Date(task.dueDate);
    const diffMs = due.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    const alertKeyOverdue = `${task.id}-overdue`;
    const alertKeyWarning = `${task.id}-warning`;

    // 1. Quá hạn (Overdue)
    if (diffHours < 0) {
      const lastSent = lastAlertSentTime.get(alertKeyOverdue) || 0;
      // Alert once every 6 hours if still overdue
      if (now.getTime() - lastSent > 6 * 3600 * 1000) {
        lastAlertSentTime.set(alertKeyOverdue, now.getTime());
        const overdueDays = Math.ceil(Math.abs(diffHours) / 24);
        const assignedUser = db.getUserById(task.assignedTo);

        const notif = db.addNotification({
          userId: task.assignedTo,
          type: 'alert',
          level: 'danger',
          title: '🚨 CÔNG VIỆC ĐÃ QUÁ HẠN!',
          message: `Công việc "${task.title}" đã quá hạn ${overdueDays} ngày (Hạn: ${new Date(task.dueDate).toLocaleDateString('vi-VN')})! Vui lòng hoàn tất ngay.`,
          taskId: task.id
        });

        // Also notify admins
        db.getUsers().filter(u => u.role === 'admin' && u.id !== task.assignedTo).forEach(admin => {
          db.addNotification({
            userId: admin.id,
            type: 'alert',
            level: 'danger',
            title: `🚨 Nhân viên trễ hạn: ${assignedUser?.name || 'Chưa gán'}`,
            message: `Công việc "${task.title}" phụ trách bởi ${assignedUser?.name || 'N/A'} đã trễ hạn!`,
            taskId: task.id
          });
        });

        broadcast('alert:new', notif);
        newAlertCount++;

        // Kích hoạt automation tự động gắn thẻ việc quá hạn
        executeAutomations('task_overdue_detected', { task });
      }
    }
    // 2. Sắp đến hạn (Due soon, e.g. within warningHours)
    else if (diffHours <= warningHours && diffHours >= 0) {
      const lastSent = lastAlertSentTime.get(alertKeyWarning) || 0;
      if (now.getTime() - lastSent > 6 * 3600 * 1000) {
        lastAlertSentTime.set(alertKeyWarning, now.getTime());
        const hoursLeft = Math.round(diffHours);

        const notif = db.addNotification({
          userId: task.assignedTo,
          type: 'alert',
          level: 'warning',
          title: '⏰ CẢNH BÁO SẮP ĐẾN HẠN',
          message: `Công việc "${task.title}" chỉ còn ${hoursLeft} giờ nữa là đến hạn chót!`,
          taskId: task.id
        });

        broadcast('alert:new', notif);
        newAlertCount++;
      }
    }
  });

  return newAlertCount;
}

// Run scanner every 60 seconds
setInterval(scanDeadlinesAndGenerateAlerts, 60 * 1000);

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
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Chỉ Quản trị viên (Admin) mới có quyền thực hiện thao tác này!' });
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

  if (!user) {
    // Auto provision new account for valid @vmg.edu.vn SSO user
    isNewUser = true;
    const defaultName = (name && name.trim()) ? name.trim() : cleanEmail.split('@')[0].replace(/\./g, ' ');
    const formattedName = defaultName.split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    const departments = db.getDepartments();
    const defaultDept = departments.length > 0 ? departments[0].name : 'Phòng Kỹ Thuật';

    user = db.createUser({
      name: formattedName,
      email: cleanEmail,
      password: `SSO-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      role: 'user',
      department: defaultDept,
      position: 'Cán bộ / Nhân viên',
      avatar: avatar || '🌐',
      phone: ''
    });

    db.logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      userAvatar: user.avatar,
      action: 'auth_sso_register',
      category: 'auth',
      details: `Nhân sự mới đã kích hoạt tài khoản qua SSO ${provider}: ${cleanEmail}`
    });

    broadcast('user:created', { user });
  } else {
    if (!user.active) {
      return res.status(403).json({ error: 'Tài khoản của bạn đã bị khóa bởi Quản trị viên' });
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
// TASKS ROUTES
// -------------------------------------------------------------
app.get('/api/tasks', authenticate, (req, res) => {
  const { status, priority, department, assignedTo, search } = req.query;
  let tasks = db.getTasks();

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
  const comments = db.getComments(task.id);
  res.json({ task, comments });
});

app.post('/api/tasks', authenticate, (req, res) => {
  const { title, description, priority, department, assignedTo, startDate, dueDate, tags } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Tiêu đề công việc là bắt buộc' });
  }

  const newTask = db.createTask({
    title,
    description,
    priority: priority || 'medium',
    department: department || req.user.department,
    assignedTo: assignedTo || req.user.id,
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
      message: `${req.user.name} đã giao cho bạn công việc: "${newTask.title}"`,
      taskId: newTask.id
    });
    broadcast('alert:new', notif, newTask.assignedTo);
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

  // Users can only edit tasks assigned to them, unless they are Admin
  if (req.user.role !== 'admin' && task.assignedTo !== req.user.id && task.createdBy !== req.user.id) {
    return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa công việc này' });
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
  res.json({ message: `Đã quét và tạo ${count} cảnh báo mới`, count });
});

// -------------------------------------------------------------
// REPORTS & ANALYTICS ROUTES
// -------------------------------------------------------------
app.get('/api/reports/summary', authenticate, (req, res) => {
  const tasks = db.getTasks();
  const users = db.getUsers();
  const now = new Date();

  const total = tasks.length;
  let completed = 0;
  let inProgress = 0;
  let todo = 0;
  let review = 0;
  let overdue = 0;
  let urgent = 0;

  // Status breakdown
  tasks.forEach(t => {
    if (t.status === 'completed') completed++;
    else if (t.status === 'in_progress') inProgress++;
    else if (t.status === 'review') review++;
    else if (t.status === 'todo') todo++;

    if (t.priority === 'urgent') urgent++;

    if (t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < now) {
      overdue++;
    }
  });

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Performance per department
  const departmentMap = {};
  tasks.forEach(t => {
    const dept = t.department || 'Khác';
    if (!departmentMap[dept]) {
      departmentMap[dept] = { total: 0, completed: 0, overdue: 0, inProgress: 0 };
    }
    departmentMap[dept].total++;
    if (t.status === 'completed') departmentMap[dept].completed++;
    else if (t.dueDate && new Date(t.dueDate) < now) departmentMap[dept].overdue++;
    else departmentMap[dept].inProgress++;
  });

  // Performance per member
  const memberPerformance = users.map(u => {
    const memberTasks = tasks.filter(t => t.assignedTo === u.id);
    const mTotal = memberTasks.length;
    const mCompleted = memberTasks.filter(t => t.status === 'completed').length;
    const mOverdue = memberTasks.filter(t => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < now).length;
    const mInProgress = memberTasks.filter(t => t.status === 'in_progress' || t.status === 'review').length;
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

  // Weekly completion trend (last 7 days)
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const displayStr = `${d.getDate()}/${d.getMonth() + 1}`;
    
    const countCompletedOnDay = tasks.filter(t => {
      return t.completedAt && t.completedAt.startsWith(dateStr);
    }).length;

    const countCreatedOnDay = tasks.filter(t => {
      return t.createdAt && t.createdAt.startsWith(dateStr);
    }).length;

    last7Days.push({
      date: displayStr,
      completed: countCompletedOnDay,
      created: countCreatedOnDay
    });
  }

  res.json({
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
    departmentMap,
    memberPerformance,
    trend: last7Days
  });
});

// CSV Export
app.get('/api/reports/export-csv', authenticate, (req, res) => {
  const tasks = db.getTasks();
  const users = db.getUsers();
  const userMap = new Map(users.map(u => [u.id, u.name]));

  let csv = '\uFEFFMã CV,Tiêu đề,Người phụ trách,Phòng ban,Độ ưu tiên,Trạng thái,Tiến độ (%),Ngày hết hạn\n';
  tasks.forEach(t => {
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
  res.setHeader('Content-Disposition', 'attachment; filename=Bao_cao_cong_viec.csv');
  res.send(csv);
});

// -------------------------------------------------------------
// USER MANAGEMENT ROUTES (Admin)
// -------------------------------------------------------------
app.get('/api/users', authenticate, (req, res) => {
  const users = db.getUsers();
  res.json({ users });
});

app.post('/api/users', authenticate, requireAdmin, (req, res) => {
  const { name, email, password, role, department, position, phone } = req.body;
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
    phone
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
const APP_VERSION = '3.1.0';
const APP_BUILD_DATE = '22/10/2026';
const APP_CHANGELOG = [
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

// SPA catch-all
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// -------------------------------------------------------------
// START SERVER
// -------------------------------------------------------------
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 TaskFlow Pro Webapp đang chạy tại: http://localhost:${PORT}`);
  console.log(`📡 WebSocket Realtime Server sẵn sàng phục vụ!`);
  console.log(`🔔 Tự động quét và phát hiện cảnh báo quá hạn kích hoạt.`);
  console.log(`=======================================================`);
});
