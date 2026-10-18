const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Generate seeded hash for default password '123456'
const DEFAULT_PASSWORD_HASH = bcrypt.hashSync('123456', 10);

function getRelativeDate(daysOffset, hoursOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setHours(d.getHours() + hoursOffset);
  return d.toISOString();
}

function getDefaultData() {
  const now = new Date().toISOString();

  const users = [
    {
      id: 'usr-1',
      name: 'Trần Quản Trị',
      email: 'admin@company.com',
      password: DEFAULT_PASSWORD_HASH,
      role: 'admin',
      department: 'Ban Giám Đốc',
      position: 'Giám Đốc Dự Án',
      avatar: '👑',
      phone: '0901 234 567',
      active: true,
      createdAt: now
    },
    {
      id: 'usr-2',
      name: 'Nguyễn Thị Lan',
      email: 'lan.nguyen@company.com',
      password: DEFAULT_PASSWORD_HASH,
      role: 'user',
      department: 'Phòng Kỹ Thuật',
      position: 'Kỹ sư Fullstack',
      avatar: '👩‍💻',
      phone: '0912 345 678',
      active: true,
      createdAt: now
    },
    {
      id: 'usr-3',
      name: 'Trần Anh Tuấn',
      email: 'tuan.tran@company.com',
      password: DEFAULT_PASSWORD_HASH,
      role: 'user',
      department: 'Phòng Marketing',
      position: 'Trưởng nhóm Marketing',
      avatar: '👨‍🎨',
      phone: '0923 456 789',
      active: true,
      createdAt: now
    },
    {
      id: 'usr-4',
      name: 'Lê Tuyết Mai',
      email: 'mai.le@company.com',
      password: DEFAULT_PASSWORD_HASH,
      role: 'user',
      department: 'Phòng Kinh Doanh',
      position: 'Chuyên viên Tư Vấn',
      avatar: '👩‍💼',
      phone: '0934 567 890',
      active: true,
      createdAt: now
    },
    {
      id: 'usr-5',
      name: 'Phạm Minh Hoàng',
      email: 'hoang.pham@company.com',
      password: DEFAULT_PASSWORD_HASH,
      role: 'user',
      department: 'Phòng Vận Hành',
      position: 'Điều phối viên',
      avatar: '👨‍🔧',
      phone: '0945 678 901',
      active: true,
      createdAt: now
    }
  ];

  const tasks = [
    {
      id: 'TSK-101',
      title: 'Khắc phục sự cố sập cổng thanh toán VNPAY',
      description: 'Cổng thanh toán đang phản hồi mã lỗi 502 với đơn hàng lớn. Cần kiểm tra timeout webhook và cấu hình SSL cert.',
      status: 'in_progress',
      priority: 'urgent',
      department: 'Phòng Kỹ Thuật',
      assignedTo: 'usr-2',
      createdBy: 'usr-1',
      startDate: getRelativeDate(-2),
      dueDate: getRelativeDate(-1), // Quá hạn (Overdue) -> Cảnh báo ĐỎ
      progress: 65,
      tags: ['Khẩn cấp', 'Bug', 'Payment'],
      completedAt: null,
      createdAt: getRelativeDate(-2),
      updatedAt: getRelativeDate(-1)
    },
    {
      id: 'TSK-102',
      title: 'Hoàn thiện slide đề xuất chiến dịch Marketing Quý 4',
      description: 'Tổng hợp số liệu ROI các kênh Facebook, Google Ads, TikTok trong quý 3 và lập kế hoạch ngân sách 500 triệu cho quý 4.',
      status: 'in_progress',
      priority: 'high',
      department: 'Phòng Marketing',
      assignedTo: 'usr-3',
      createdBy: 'usr-1',
      startDate: getRelativeDate(-3),
      dueDate: getRelativeDate(0, 4), // Sắp hết hạn trong 4 tiếng! -> Cảnh báo CAM
      progress: 80,
      tags: ['Marketing', 'Báo cáo', 'Ngân sách'],
      completedAt: null,
      createdAt: getRelativeDate(-3),
      updatedAt: getRelativeDate(0, -1)
    },
    {
      id: 'TSK-103',
      title: 'Ký kết hợp đồng phân phối độc quyền với Đối tác VinaCorp',
      description: 'Rà soát các điều khoản thanh toán, bảo mật thông tin và chốt phụ lục bảo hành với đại diện phòng pháp chế VinaCorp.',
      status: 'review',
      priority: 'urgent',
      department: 'Phòng Kinh Doanh',
      assignedTo: 'usr-4',
      createdBy: 'usr-1',
      startDate: getRelativeDate(-4),
      dueDate: getRelativeDate(1, 0), // Đến hạn trong 24h! -> Cảnh báo VÀNG
      progress: 90,
      tags: ['Hợp đồng', 'Doanh thu', 'VIP'],
      completedAt: null,
      createdAt: getRelativeDate(-4),
      updatedAt: getRelativeDate(0)
    },
    {
      id: 'TSK-104',
      title: 'Bảo trì hệ thống máy chủ cơ sở dữ liệu định kỳ',
      description: 'Nâng cấp bảo mật hệ điều hành Ubuntu, dọn dẹp dung lượng log và kiểm tra quy trình sao lưu tự động vào AWS S3.',
      status: 'completed',
      priority: 'medium',
      department: 'Phòng Kỹ Thuật',
      assignedTo: 'usr-2',
      createdBy: 'usr-1',
      startDate: getRelativeDate(-5),
      dueDate: getRelativeDate(-1),
      progress: 100,
      tags: ['DevOps', 'Bảo trì', 'Database'],
      completedAt: getRelativeDate(-1, -2),
      createdAt: getRelativeDate(-5),
      updatedAt: getRelativeDate(-1, -2)
    },
    {
      id: 'TSK-105',
      title: 'Kiểm toán kho hàng chi nhánh Bình Dương',
      description: 'Đối soát số liệu tồn kho thực tế so với phần mềm quản lý kho, lập biên bản chênh lệch hao hụt vật tư tháng trước.',
      status: 'todo',
      priority: 'medium',
      department: 'Phòng Vận Hành',
      assignedTo: 'usr-5',
      createdBy: 'usr-1',
      startDate: getRelativeDate(0),
      dueDate: getRelativeDate(3),
      progress: 0,
      tags: ['Kho bãi', 'Kiểm toán'],
      completedAt: null,
      createdAt: getRelativeDate(0),
      updatedAt: getRelativeDate(0)
    },
    {
      id: 'TSK-106',
      title: 'Tối ưu hóa tốc độ tải trang ứng dụng Webapp',
      description: 'Nén tài nguyên hình ảnh, bật lazy loading và áp dụng caching Redis cho các API danh mục để thời gian tải dưới 1.2s.',
      status: 'in_progress',
      priority: 'high',
      department: 'Phòng Kỹ Thuật',
      assignedTo: 'usr-2',
      createdBy: 'usr-1',
      startDate: getRelativeDate(-1),
      dueDate: getRelativeDate(2),
      progress: 40,
      tags: ['Performance', 'Frontend'],
      completedAt: null,
      createdAt: getRelativeDate(-1),
      updatedAt: getRelativeDate(0)
    },
    {
      id: 'TSK-107',
      title: 'Triển khai chương trình khuyến mãi mừng Ngày Phụ Nữ',
      description: 'Cài đặt mã giảm giá WOMAN20 trên landing page, gửi email marketing đến tệp 50.000 khách hàng tiềm năng.',
      status: 'completed',
      priority: 'high',
      department: 'Phòng Marketing',
      assignedTo: 'usr-3',
      createdBy: 'usr-1',
      startDate: getRelativeDate(-6),
      dueDate: getRelativeDate(-2),
      progress: 100,
      tags: ['Campain', 'Email'],
      completedAt: getRelativeDate(-2),
      createdAt: getRelativeDate(-6),
      updatedAt: getRelativeDate(-2)
    },
    {
      id: 'TSK-108',
      title: 'Thu hồi công nợ quá hạn quý 2 các đại lý cấp 2',
      description: 'Liên hệ 12 đại lý chưa thanh toán đợt hàng tháng 6, chốt phương án trả góp hoặc gửi công văn đôn đốc pháp lý.',
      status: 'todo',
      priority: 'urgent',
      department: 'Phòng Kinh Doanh',
      assignedTo: 'usr-4',
      createdBy: 'usr-1',
      startDate: getRelativeDate(-2),
      dueDate: getRelativeDate(-1, 10), // Quá hạn trễ hạn 1 ngày!
      progress: 25,
      tags: ['Tài chính', 'Thu nợ', 'Gấp'],
      completedAt: null,
      createdAt: getRelativeDate(-2),
      updatedAt: getRelativeDate(-1)
    }
  ];

  const comments = [
    {
      id: 'cmt-1',
      taskId: 'TSK-101',
      userId: 'usr-1',
      userName: 'Trần Quản Trị',
      userAvatar: '👑',
      content: 'Lan chú ý đây là lỗi chặn giao dịch khách hàng, cần ưu tiên xử lý trong buổi sáng giúp anh nhé!',
      createdAt: getRelativeDate(-1, -4)
    },
    {
      id: 'cmt-2',
      taskId: 'TSK-101',
      userId: 'usr-2',
      userName: 'Nguyễn Thị Lan',
      userAvatar: '👩‍💻',
      content: 'Dạ em đã liên hệ kỹ thuật VNPAY và đang đẩy bản vá lỗi cert lên máy chủ test ạ.',
      createdAt: getRelativeDate(-1, -2)
    },
    {
      id: 'cmt-3',
      taskId: 'TSK-102',
      userId: 'usr-3',
      userName: 'Trần Anh Tuấn',
      userAvatar: '👨‍🎨',
      content: 'Báo cáo đã hoàn thành 80%, chỉ còn phần biểu đồ chi phí so sánh với cùng kỳ năm ngoái.',
      createdAt: getRelativeDate(0, -2)
    }
  ];

  const notifications = [
    {
      id: 'ntf-1',
      userId: 'usr-2',
      type: 'alert',
      level: 'danger',
      title: '🚨 Cảnh báo công việc QUÁ HẠN!',
      message: 'Công việc "Khắc phục sự cố sập cổng thanh toán VNPAY" đã quá hạn thực hiện!',
      taskId: 'TSK-101',
      read: false,
      createdAt: getRelativeDate(0, -3)
    },
    {
      id: 'ntf-2',
      userId: 'usr-3',
      type: 'alert',
      level: 'warning',
      title: '⏰ Cảnh báo SẮP ĐẾN HẠN',
      message: 'Công việc "Hoàn thiện slide đề xuất chiến dịch Marketing Quý 4" chỉ còn dưới 4 giờ để hoàn tất!',
      taskId: 'TSK-102',
      read: false,
      createdAt: getRelativeDate(0, -1)
    },
    {
      id: 'ntf-3',
      userId: 'usr-4',
      type: 'alert',
      level: 'danger',
      title: '🚨 Cảnh báo công việc QUÁ HẠN!',
      message: 'Công việc "Thu hồi công nợ quá hạn quý 2 các đại lý cấp 2" đã quá hạn!',
      taskId: 'TSK-108',
      read: false,
      createdAt: getRelativeDate(0, -5)
    }
  ];

  const activities = [
    {
      id: 'act-1',
      userId: 'usr-1',
      userName: 'Trần Quản Trị',
      action: 'create_task',
      taskId: 'TSK-101',
      taskTitle: 'Khắc phục sự cố sập cổng thanh toán VNPAY',
      details: 'Giao việc cho Nguyễn Thị Lan',
      timestamp: getRelativeDate(-2)
    },
    {
      id: 'act-2',
      userId: 'usr-2',
      userName: 'Nguyễn Thị Lan',
      action: 'update_progress',
      taskId: 'TSK-101',
      taskTitle: 'Khắc phục sự cố sập cổng thanh toán VNPAY',
      details: 'Cập nhật tiến độ lên 65%',
      timestamp: getRelativeDate(-1)
    },
    {
      id: 'act-3',
      userId: 'usr-2',
      userName: 'Nguyễn Thị Lan',
      action: 'complete_task',
      taskId: 'TSK-104',
      taskTitle: 'Bảo trì hệ thống máy chủ cơ sở dữ liệu định kỳ',
      details: 'Đã hoàn thành 100%',
      timestamp: getRelativeDate(-1, -2)
    }
  ];

  const settings = {
    warningThresholdHours: 24, // Cảnh báo vàng khi còn dưới 24h
    urgentThresholdHours: 6,   // Cảnh báo cam khi còn dưới 6h
    allowUserCreateTask: true,  // Cho phép user tạo task nếu muốn
    companyName: 'Công Ty CP Công Nghệ & Dịch Vụ TaskFlow'
  };

  return { users, tasks, comments, notifications, activities, settings };
}

class Database {
  constructor() {
    this.data = null;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, 'utf8');
        this.data = JSON.parse(raw);
      } else {
        this.data = getDefaultData();
        this.save();
      }
    } catch (err) {
      console.error('Error loading database, resetting to default:', err);
      this.data = getDefaultData();
      this.save();
    }
  }

  save() {
    try {
      const tempPath = `${DB_PATH}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tempPath, DB_PATH);
    } catch (err) {
      console.error('Error saving database:', err);
    }
  }

  // --- Users ---
  getUsers(includePasswords = false) {
    return this.data.users.map(u => {
      const clone = { ...u };
      if (!includePasswords) delete clone.password;
      return clone;
    });
  }

  getUserById(id, includePassword = false) {
    const user = this.data.users.find(u => u.id === id);
    if (!user) return null;
    const clone = { ...user };
    if (!includePassword) delete clone.password;
    return clone;
  }

  getUserByEmail(email) {
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  createUser(userData) {
    const id = `usr-${Date.now()}`;
    const newUser = {
      id,
      name: userData.name,
      email: userData.email.toLowerCase(),
      password: bcrypt.hashSync(userData.password || '123456', 10),
      role: userData.role || 'user',
      department: userData.department || 'Phòng Kỹ Thuật',
      position: userData.position || 'Nhân viên',
      avatar: userData.avatar || (userData.role === 'admin' ? '👑' : '👤'),
      phone: userData.phone || '',
      active: true,
      createdAt: new Date().toISOString()
    };
    this.data.users.push(newUser);
    this.save();
    const ret = { ...newUser };
    delete ret.password;
    return ret;
  }

  updateUser(id, updates) {
    const idx = this.data.users.findIndex(u => u.id === id);
    if (idx === -1) return null;

    if (updates.password) {
      updates.password = bcrypt.hashSync(updates.password, 10);
    }
    this.data.users[idx] = {
      ...this.data.users[idx],
      ...updates
    };
    this.save();
    const ret = { ...this.data.users[idx] };
    delete ret.password;
    return ret;
  }

  deleteUser(id) {
    const idx = this.data.users.findIndex(u => u.id === id);
    if (idx === -1) return false;
    this.data.users.splice(idx, 1);
    this.save();
    return true;
  }

  // --- Tasks ---
  getTasks(filter = {}) {
    let tasks = [...this.data.tasks];
    if (filter.status) tasks = tasks.filter(t => t.status === filter.status);
    if (filter.priority) tasks = tasks.filter(t => t.priority === filter.priority);
    if (filter.department) tasks = tasks.filter(t => t.department === filter.department);
    if (filter.assignedTo) tasks = tasks.filter(t => t.assignedTo === filter.assignedTo);
    return tasks;
  }

  getTaskById(id) {
    return this.data.tasks.find(t => t.id === id) || null;
  }

  createTask(taskData, creatorUser) {
    const count = this.data.tasks.length + 101;
    const id = `TSK-${count}`;
    const now = new Date().toISOString();

    const newTask = {
      id,
      title: taskData.title,
      description: taskData.description || '',
      status: taskData.status || 'todo',
      priority: taskData.priority || 'medium',
      department: taskData.department || creatorUser.department || 'Toàn công ty',
      assignedTo: taskData.assignedTo || creatorUser.id,
      createdBy: creatorUser.id,
      startDate: taskData.startDate || now,
      dueDate: taskData.dueDate,
      progress: parseInt(taskData.progress || 0, 10),
      tags: Array.isArray(taskData.tags) ? taskData.tags : (taskData.tags ? taskData.tags.split(',').map(s => s.trim()) : []),
      completedAt: taskData.status === 'completed' ? now : null,
      createdAt: now,
      updatedAt: now
    };

    this.data.tasks.unshift(newTask);

    this.logActivity({
      userId: creatorUser.id,
      userName: creatorUser.name,
      action: 'create_task',
      taskId: id,
      taskTitle: newTask.title,
      details: `Đã tạo công việc mới và phân công cho ${this.getUserById(newTask.assignedTo)?.name || 'người dùng'}`
    });

    this.save();
    return newTask;
  }

  updateTask(id, updates, updaterUser) {
    const idx = this.data.tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;

    const oldTask = this.data.tasks[idx];
    const now = new Date().toISOString();

    let completedAt = oldTask.completedAt;
    if (updates.status === 'completed' && oldTask.status !== 'completed') {
      completedAt = now;
      updates.progress = 100;
    } else if (updates.status && updates.status !== 'completed') {
      completedAt = null;
    }

    if (updates.progress !== undefined) {
      updates.progress = parseInt(updates.progress, 10);
      if (updates.progress === 100 && updates.status !== 'completed') {
        updates.status = 'completed';
        completedAt = now;
      }
    }

    this.data.tasks[idx] = {
      ...oldTask,
      ...updates,
      completedAt,
      updatedAt: now
    };

    // Log activity
    let actionDesc = 'Đã cập nhật công việc';
    if (updates.status && updates.status !== oldTask.status) {
      actionDesc = `Chuyển trạng thái sang "${updates.status}"`;
    } else if (updates.progress !== undefined && updates.progress !== oldTask.progress) {
      actionDesc = `Cập nhật tiến độ thành ${updates.progress}%`;
    }

    this.logActivity({
      userId: updaterUser.id,
      userName: updaterUser.name,
      action: 'update_task',
      taskId: id,
      taskTitle: this.data.tasks[idx].title,
      details: actionDesc
    });

    this.save();
    return this.data.tasks[idx];
  }

  deleteTask(id, deleterUser) {
    const idx = this.data.tasks.findIndex(t => t.id === id);
    if (idx === -1) return false;
    const task = this.data.tasks[idx];
    this.data.tasks.splice(idx, 1);

    this.logActivity({
      userId: deleterUser.id,
      userName: deleterUser.name,
      action: 'delete_task',
      taskId: id,
      taskTitle: task.title,
      details: `Đã xóa công việc #${id}`
    });

    this.save();
    return true;
  }

  // --- Comments ---
  getComments(taskId) {
    return this.data.comments.filter(c => c.taskId === taskId);
  }

  addComment(taskId, user, content) {
    const comment = {
      id: `cmt-${Date.now()}`,
      taskId,
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar || '👤',
      content,
      createdAt: new Date().toISOString()
    };
    this.data.comments.push(comment);

    this.logActivity({
      userId: user.id,
      userName: user.name,
      action: 'comment',
      taskId,
      taskTitle: this.getTaskById(taskId)?.title || '',
      details: `Đã bình luận: "${content.substring(0, 40)}..."`
    });

    this.save();
    return comment;
  }

  // --- Notifications & Alerts ---
  getNotifications(userId = null) {
    if (!userId) return this.data.notifications;
    return this.data.notifications.filter(n => n.userId === userId || n.userId === 'all');
  }

  addNotification(notification) {
    const newNotif = {
      id: `ntf-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: notification.userId,
      type: notification.type || 'alert',
      level: notification.level || 'warning', // danger, warning, info, success
      title: notification.title,
      message: notification.message,
      taskId: notification.taskId || null,
      read: false,
      createdAt: new Date().toISOString()
    };
    this.data.notifications.unshift(newNotif);
    // keep latest 200 notifications
    if (this.data.notifications.length > 200) {
      this.data.notifications.pop();
    }
    this.save();
    return newNotif;
  }

  markNotificationRead(id, userId) {
    const notif = this.data.notifications.find(n => n.id === id && (n.userId === userId || n.userId === 'all'));
    if (notif) {
      notif.read = true;
      this.save();
      return true;
    }
    return false;
  }

  markAllNotificationsRead(userId) {
    this.data.notifications.forEach(n => {
      if (n.userId === userId || n.userId === 'all') {
        n.read = true;
      }
    });
    this.save();
    return true;
  }

  // --- Activity Log ---
  logActivity(entry) {
    const act = {
      id: `act-${Date.now()}`,
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString()
    };
    this.data.activities.unshift(act);
    if (this.data.activities.length > 300) {
      this.data.activities.pop();
    }
  }

  getActivities(limit = 50) {
    return this.data.activities.slice(0, limit);
  }

  // --- Settings ---
  getSettings() {
    return this.data.settings || {};
  }

  updateSettings(newSettings) {
    this.data.settings = { ...this.data.settings, ...newSettings };
    this.save();
    return this.data.settings;
  }

  // Reset database to initial seed data
  reset() {
    this.data = getDefaultData();
    this.save();
    return true;
  }
}

module.exports = new Database();
