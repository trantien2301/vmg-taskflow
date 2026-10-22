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

  const departments = [
    { id: 'dept-1', name: 'Phòng Kỹ Thuật' },
    { id: 'dept-2', name: 'Phòng Marketing' },
    { id: 'dept-3', name: 'Phòng Kinh Doanh' },
    { id: 'dept-4', name: 'Phòng Vận Hành' },
    { id: 'dept-5', name: 'Ban Giám Đốc' }
  ];

  const automations = [
    {
      id: 'auto-1',
      name: 'Đồng bộ tiến độ 100% khi Hoàn thành',
      description: 'Khi công việc chuyển sang trạng thái "Hoàn thành", tự động chốt tiến độ đạt 100% và ghi nhận thời gian hoàn tất.',
      icon: '✅',
      color: '#10b981',
      enabled: true,
      trigger: 'task_status_completed',
      triggerLabel: 'Trạng thái chuyển sang "Hoàn thành"',
      action: 'set_progress_100',
      actionLabel: 'Tự động cập nhật tiến độ 100% & ghi giờ hoàn tất',
      runCount: 24,
      lastRunAt: getRelativeDate(0, -1)
    },
    {
      id: 'auto-2',
      name: 'Tự động gửi Duyệt khi đạt 100%',
      description: 'Khi nhân sự cập nhật tiến độ công việc đạt 100%, tự động chuyển trạng thái từ Đang làm sang "Chờ duyệt".',
      icon: '⏳',
      color: '#d97706',
      enabled: true,
      trigger: 'task_progress_100',
      triggerLabel: 'Tiến độ kéo lên mức 100%',
      action: 'set_status_review',
      actionLabel: 'Tự động chuyển trạng thái sang "Chờ duyệt"',
      runCount: 18,
      lastRunAt: getRelativeDate(0, -3)
    },
    {
      id: 'auto-3',
      name: 'Báo động đỏ & Gắn cờ việc Khẩn cấp',
      description: 'Khi một công việc có mức độ ưu tiên "Khẩn cấp" được tạo hoặc cập nhật, tự động gắn tag "Ưu Tiên Số 1" và gửi cảnh báo đỏ cho Admin.',
      icon: '🚨',
      color: '#ef4444',
      enabled: true,
      trigger: 'task_urgent_created',
      triggerLabel: 'Công việc mới hoặc sửa đổi có ưu tiên "Khẩn cấp"',
      action: 'tag_and_alert_admin',
      actionLabel: 'Gắn thẻ "Ưu Tiên Số 1" & phát cảnh báo âm thanh tới Admin',
      runCount: 9,
      lastRunAt: getRelativeDate(-1, -2)
    },
    {
      id: 'auto-4',
      name: 'Gắn nhãn cảnh báo việc Trễ hạn',
      description: 'Khi hệ thống phát hiện công việc đã quá hạn chót mà chưa hoàn thành, tự động gắn nhãn "Quá hạn" và thông báo tới người phụ trách.',
      icon: '⏰',
      color: '#f97316',
      enabled: true,
      trigger: 'task_overdue_detected',
      triggerLabel: 'Phát hiện công việc quá hạn chót',
      action: 'tag_overdue_and_notify',
      actionLabel: 'Gắn nhãn "Quá hạn" & gửi chuông cảnh báo tới nhân sự',
      runCount: 15,
      lastRunAt: getRelativeDate(0, -2)
    },
    {
      id: 'auto-5',
      name: 'Hỗ trợ Phân công việc mới chưa có người nhận',
      description: 'Khi công việc được tạo nhưng chưa chọn người phụ trách, tự động gắn thẻ "Chờ nhận việc" và thông báo tới toàn bộ phòng ban.',
      icon: '🎯',
      color: '#8b5cf6',
      enabled: true,
      trigger: 'task_unassigned_created',
      triggerLabel: 'Công việc mới tạo chưa được phân công',
      action: 'tag_unassigned_and_notify_dept',
      actionLabel: 'Gắn nhãn "Chờ nhận việc" & thông báo nội bộ phòng ban',
      runCount: 12,
      lastRunAt: getRelativeDate(-2, -4)
    }
  ];

  return { users, tasks, comments, notifications, activities, settings, departments, automations };
}

const DEFAULT_PERMISSIONS = {
  admin: {
    canCreateTask: true,
    canEditTask: true,
    canDeleteTask: true,
    canReviewTask: true,
    canManageDept: true,
    canManageUsers: true,
    canManageAutomation: true,
    canViewReports: true
  },
  manager: {
    canCreateTask: true,
    canEditTask: true,
    canDeleteTask: false,
    canReviewTask: true,
    canManageDept: false,
    canManageUsers: false,
    canManageAutomation: true,
    canViewReports: false // Manager không xem báo cáo hệ thống
  },
  user: {
    canCreateTask: true,
    canEditTask: true,
    canDeleteTask: false,
    canReviewTask: false,
    canManageDept: false,
    canManageUsers: false,
    canManageAutomation: false,
    canViewReports: false // Member không xem báo cáo hệ thống
  },
  viewer: {
    canCreateTask: false,
    canEditTask: false,
    canDeleteTask: false,
    canReviewTask: false,
    canManageDept: false,
    canManageUsers: false,
    canManageAutomation: false,
    canViewReports: true
  }
};

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
        if (!this.data.departments || !Array.isArray(this.data.departments)) {
          this.data.departments = [
            { id: 'dept-1', name: 'Phòng Kỹ Thuật' },
            { id: 'dept-2', name: 'Phòng Marketing' },
            { id: 'dept-3', name: 'Phòng Kinh Doanh' },
            { id: 'dept-4', name: 'Phòng Vận Hành' },
            { id: 'dept-5', name: 'Ban Giám Đốc' }
          ];
          this.save();
        }
        if (!this.data.automations || !Array.isArray(this.data.automations)) {
          this.data.automations = getDefaultData().automations || [];
          this.save();
        }

        // Ensure user permissions and active status
        if (this.data.users && Array.isArray(this.data.users)) {
          let modified = false;
          this.data.users.forEach(u => {
            if (typeof u.active === 'undefined') {
              u.active = true;
              modified = true;
            }
            if (!u.permissions) {
              const role = u.role || 'user';
              u.permissions = { ...(DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.user) };
              modified = true;
            } else if ((u.role === 'user' || u.role === 'manager') && u.permissions.canViewReports !== false) {
              // Member và manager không được xem báo cáo hệ thống
              u.permissions.canViewReports = false;
              modified = true;
            }

            // Đảm bảo cấu hình Google Calendar & Nhắc lịch cho từng account
            if (!u.googleCalendar) {
              u.googleCalendar = {
                enabled: true,
                email: u.email || '',
                autoSync: true,
                syncToken: `gcal_${u.id}_${Math.random().toString(36).substring(2, 10)}`,
                reminderTimes: [1440, 120, 30], // Nhắc trước 1 ngày (1440p), 2 giờ (120p), 30 phút (30p)
                notifyBrowser: true,
                notifySound: true,
                lastSync: null
              };
              modified = true;
            }
          });

          // Ensure a sample viewer account exists for testing Viewer role
          const hasViewer = this.data.users.some(u => u.role === 'viewer');
          if (!hasViewer) {
            this.data.users.push({
              id: 'usr-viewer-1',
              name: 'Hoàng Giám Sát',
              email: 'viewer@vmg.edu.vn',
              password: DEFAULT_PASSWORD_HASH,
              role: 'viewer',
              department: 'Ban Kiểm Soát',
              position: 'Chuyên viên Giám Sát',
              avatar: '👁️',
              phone: '0988 999 111',
              active: true,
              permissions: { ...DEFAULT_PERMISSIONS.viewer },
              createdAt: new Date().toISOString()
            });
            modified = true;
          }

          if (modified) {
            this.save();
          }
        }
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
    const role = userData.role || 'user';
    const permissions = userData.permissions
      ? { ...(DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.user), ...userData.permissions }
      : { ...(DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.user) };

    const newUser = {
      id,
      name: userData.name,
      email: userData.email.toLowerCase(),
      password: bcrypt.hashSync(userData.password || '123456', 10),
      role: role,
      permissions: permissions,
      department: userData.department || 'Phòng Kỹ Thuật',
      position: userData.position || 'Nhân viên',
      avatar: userData.avatar || (role === 'admin' ? '👑' : (role === 'manager' ? '👔' : '👤')),
      phone: userData.phone || '',
      active: typeof userData.active === 'boolean' ? userData.active : true,
      googleCalendar: {
        enabled: true,
        email: userData.email.toLowerCase(),
        autoSync: true,
        syncToken: `gcal_${id}_${Math.random().toString(36).substring(2, 10)}`,
        reminderTimes: [1440, 120, 30],
        notifyBrowser: true,
        notifySound: true,
        lastSync: null
      },
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

    const current = this.data.users[idx];
    const newRole = updates.role || current.role || 'user';

    // If role changed and no explicit permissions provided, update permissions to default of new role
    let newPermissions = current.permissions || { ...(DEFAULT_PERMISSIONS[current.role] || DEFAULT_PERMISSIONS.user) };
    if (updates.role && updates.role !== current.role && !updates.permissions) {
      newPermissions = { ...(DEFAULT_PERMISSIONS[updates.role] || DEFAULT_PERMISSIONS.user) };
    } else if (updates.permissions) {
      newPermissions = { ...newPermissions, ...updates.permissions };
    }

    let newAvatar = current.avatar;
    if (updates.role && updates.role !== current.role) {
      if (updates.role === 'admin') newAvatar = '👑';
      else if (updates.role === 'manager') newAvatar = '👔';
      else if (updates.role === 'viewer') newAvatar = '👁️';
      else newAvatar = '👤';
    }

    this.data.users[idx] = {
      ...current,
      ...updates,
      avatar: updates.avatar || newAvatar,
      permissions: newPermissions
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

    const assignedUser = this.getUserById(newTask.assignedTo);
    this.logActivity({
      userId: creatorUser.id,
      userName: creatorUser.name,
      userRole: creatorUser.role || 'user',
      userAvatar: creatorUser.avatar || (creatorUser.role === 'admin' ? '👑' : '👤'),
      action: 'create_task',
      category: 'task',
      taskId: id,
      taskTitle: newTask.title,
      details: `Đã tạo công việc mới: "${newTask.title}" (${newTask.priority.toUpperCase()} - Phân công: ${assignedUser ? assignedUser.name : 'Chưa giao'})`
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
    let actionType = 'update_task';
    let actionDesc = `Đã cập nhật công việc: "${this.data.tasks[idx].title}"`;
    if (updates.status && updates.status !== oldTask.status) {
      actionType = 'change_status';
      const statusMap = { todo: 'Cần làm', in_progress: 'Đang làm', review: 'Chờ duyệt', completed: 'Hoàn thành' };
      actionDesc = `Chuyển trạng thái "${this.data.tasks[idx].title}" sang "${statusMap[updates.status] || updates.status}"`;
    } else if (updates.progress !== undefined && updates.progress !== oldTask.progress) {
      actionType = 'update_progress';
      actionDesc = `Cập nhật tiến độ "${this.data.tasks[idx].title}" thành ${updates.progress}%`;
    }

    this.logActivity({
      userId: updaterUser.id,
      userName: updaterUser.name,
      userRole: updaterUser.role || 'user',
      userAvatar: updaterUser.avatar || (updaterUser.role === 'admin' ? '👑' : '👤'),
      action: actionType,
      category: 'task',
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
      userRole: deleterUser.role || 'user',
      userAvatar: deleterUser.avatar || (deleterUser.role === 'admin' ? '👑' : '👤'),
      action: 'delete_task',
      category: 'task',
      taskId: id,
      taskTitle: task.title,
      details: `Đã xóa công việc: "${task.title}"`
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

    const task = this.getTaskById(taskId);
    this.logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role || 'user',
      userAvatar: user.avatar || (user.role === 'admin' ? '👑' : '👤'),
      action: 'add_comment',
      category: 'task',
      taskId,
      taskTitle: task ? task.title : taskId,
      details: `Đã bình luận vào "${task ? task.title : taskId}": "${content.slice(0, 60)}${content.length > 60 ? '...' : ''}"`
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

  // --- Activity Log & Realtime Stream ---
  setActivityCallback(callback) {
    this.onActivityLogged = callback;
  }

  logActivity(entry) {
    const act = {
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      userId: entry.userId || 'system',
      userName: entry.userName || 'Hệ thống',
      userRole: entry.userRole || 'user',
      userAvatar: entry.userAvatar || (entry.userRole === 'admin' ? '👑' : '👤'),
      action: entry.action || 'general',
      category: entry.category || 'general',
      details: entry.details || '',
      taskId: entry.taskId || null,
      taskTitle: entry.taskTitle || null,
      timestamp: entry.timestamp || new Date().toISOString()
    };

    this.data.activities.unshift(act);
    if (this.data.activities.length > 500) {
      this.data.activities.pop();
    }
    this.save();

    if (typeof this.onActivityLogged === 'function') {
      try {
        this.onActivityLogged(act);
      } catch (err) {
        console.error('Error in onActivityLogged callback:', err);
      }
    }
    return act;
  }

  getActivities(limit = 100) {
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

  // --- Google Calendar & Live ICS Feed Integration ---
  getUserByCalendarToken(userId, token) {
    if (!userId || !token) return null;
    return this.data.users.find(u => u.id === userId && u.googleCalendar && u.googleCalendar.syncToken === token);
  }

  updateUserCalendarSettings(userId, settings) {
    const user = this.data.users.find(u => u.id === userId);
    if (!user) return null;
    if (!user.googleCalendar) {
      user.googleCalendar = {
        enabled: true,
        email: user.email || '',
        autoSync: true,
        syncToken: `gcal_${user.id}_${Math.random().toString(36).substring(2, 10)}`,
        reminderTimes: [1440, 120, 30],
        notifyBrowser: true,
        notifySound: true,
        lastSync: null
      };
    }
    user.googleCalendar = { ...user.googleCalendar, ...settings };
    this.save();
    return user.googleCalendar;
  }

  generateIcsFeed(user, baseUrl = 'https://taskflow.vmg.edu.vn') {
    let tasks = this.getTasks();
    if (user.role === 'user') {
      tasks = tasks.filter(t => t.assignedTo === user.id || t.createdBy === user.id);
    } else if (user.role === 'manager') {
      tasks = tasks.filter(t => t.department === user.department);
    }

    const nowMs = Date.now();
    const thirtyDaysAgo = nowMs - 30 * 86400 * 1000;

    // Filter to active tasks and completed tasks in the last 30 days for optimal calendar performance
    tasks = tasks.filter(t => {
      if (t.status !== 'completed') return true;
      if (!t.completedAt) return true;
      return new Date(t.completedAt).getTime() >= thirtyDaysAgo;
    });

    const pad = n => String(n).padStart(2, '0');
    const formatIcsDate = (d) => {
      return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' +
             pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';
    };

    const cleanText = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/\r/g, '')
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
    };

    // RFC 5545 line folding at 75 octets
    const foldLine = (line) => {
      if (line.length <= 75) return line;
      let result = '';
      let remaining = line;
      let first = true;
      while (remaining.length > 0) {
        if (first) {
          result += remaining.substring(0, 75);
          remaining = remaining.substring(75);
          first = false;
        } else {
          result += '\r\n ' + remaining.substring(0, 74);
          remaining = remaining.substring(74);
        }
      }
      return result;
    };

    const nowIcs = formatIcsDate(new Date(nowMs));
    const calName = cleanText(`TaskFlow - ${user.name} (${user.department})`);
    const reminderTimes = user.googleCalendar?.reminderTimes || [1440, 120, 30];

    let rawLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//VMG TaskFlow Pro//Google Calendar Sync//VI',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${calName}`,
      'X-WR-TIMEZONE:Asia/Ho_Chi_Minh',
      'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
      'X-PUBLISHED-TTL:PT15M'
    ];

    tasks.forEach(task => {
      let startTime, endTime;
      const rawStart = task.startDate ? new Date(task.startDate).getTime() : null;
      const rawDue = task.dueDate ? new Date(task.dueDate).getTime() : null;

      if (rawStart && rawDue && !isNaN(rawStart) && !isNaN(rawDue)) {
        if (rawDue > rawStart) {
          startTime = new Date(rawStart);
          endTime = new Date(rawDue);
        } else {
          // If due date is earlier or same as start date, set start to 2 hours before due
          endTime = new Date(rawDue);
          startTime = new Date(rawDue - 2 * 3600 * 1000);
        }
      } else if (rawDue && !isNaN(rawDue)) {
        endTime = new Date(rawDue);
        startTime = new Date(rawDue - 2 * 3600 * 1000);
      } else if (rawStart && !isNaN(rawStart)) {
        startTime = new Date(rawStart);
        endTime = new Date(rawStart + 2 * 3600 * 1000);
      } else {
        startTime = new Date(nowMs);
        endTime = new Date(nowMs + 2 * 3600 * 1000);
      }

      // Strictly guarantee endTime is after startTime (RFC 5545 requirement)
      if (endTime.getTime() <= startTime.getTime()) {
        endTime = new Date(startTime.getTime() + 3600 * 1000);
      }

      const startIcs = formatIcsDate(startTime);
      const dueIcs = formatIcsDate(endTime);
      const uid = `task-${task.id}@vmg.edu.vn`;
      const priorityMap = { urgent: '1', high: '3', medium: '5', low: '9' };
      const statusMap = { todo: 'Chưa làm', in_progress: 'Đang làm', review: 'Chờ duyệt', completed: 'Hoàn thành' };

      const summary = cleanText(`[${(task.priority || 'vừa').toUpperCase()}] ${task.title}`);
      const desc = cleanText(
        `Mã công việc: #${task.id}\n` +
        `Tiến độ: ${task.progress || 0}%\n` +
        `Trạng thái: ${statusMap[task.status] || task.status}\n` +
        `Phòng ban: ${task.department || ''}\n` +
        `Hạn chót: ${task.dueDate ? new Date(task.dueDate).toLocaleString('vi-VN') : 'Không có'}\n\n` +
        `Mô tả chi tiết:\n${task.description || 'Không có mô tả chi tiết'}\n\n` +
        `Xem trên Web App: ${baseUrl}/#task=${task.id}`
      );

      rawLines.push('BEGIN:VEVENT');
      rawLines.push(`UID:${uid}`);
      rawLines.push(`DTSTAMP:${nowIcs}`);
      rawLines.push(`DTSTART:${startIcs}`);
      rawLines.push(`DTEND:${dueIcs}`);
      rawLines.push(`SUMMARY:${summary}`);
      rawLines.push(`DESCRIPTION:${desc}`);
      rawLines.push(`PRIORITY:${priorityMap[task.priority] || '5'}`);
      rawLines.push(`STATUS:${task.status === 'completed' ? 'COMPLETED' : 'CONFIRMED'}`);

      // Add VALARM triggers based on user's reminder preferences (for active tasks)
      if (task.status !== 'completed' && Array.isArray(reminderTimes) && endTime.getTime() > nowMs) {
        reminderTimes.forEach(m => {
          let trigger = `-PT${m}M`;
          let descLabel = `Hạn chót trong ${m} phút`;
          if (m >= 1440 && m % 1440 === 0) {
            trigger = `-P${m / 1440}D`;
            descLabel = `Nhắc trước ${m / 1440} ngày`;
          } else if (m >= 60 && m % 60 === 0) {
            trigger = `-PT${m / 60}H`;
            descLabel = `Hạn chót trong ${m / 60} giờ`;
          }

          rawLines.push('BEGIN:VALARM');
          rawLines.push('ACTION:DISPLAY');
          rawLines.push(`DESCRIPTION:${cleanText(`[Nhắc Lịch] ${task.title} - ${descLabel}`)}`);
          rawLines.push(`TRIGGER:${trigger}`);
          rawLines.push('END:VALARM');
        });
      }

      rawLines.push('END:VEVENT');
    });

    rawLines.push('END:VCALENDAR');

    // Apply RFC 5545 line folding
    return rawLines.map(foldLine).join('\r\n');
  }

  // --- Departments ---
  getDepartments() {
    if (!this.data.departments || !Array.isArray(this.data.departments)) {
      this.data.departments = [
        { id: 'dept-1', name: 'Phòng Kỹ Thuật' },
        { id: 'dept-2', name: 'Phòng Marketing' },
        { id: 'dept-3', name: 'Phòng Kinh Doanh' },
        { id: 'dept-4', name: 'Phòng Vận Hành' },
        { id: 'dept-5', name: 'Ban Giám Đốc' }
      ];
      this.save();
    }
    return this.data.departments;
  }

  createDepartment(name) {
    this.getDepartments();
    const cleanName = (name || '').trim();
    if (!cleanName) {
      throw new Error('Tên phòng ban không được để trống!');
    }
    const exists = this.data.departments.some(d => d.name.toLowerCase() === cleanName.toLowerCase());
    if (exists) {
      throw new Error(`Phòng ban "${cleanName}" đã tồn tại trên hệ thống!`);
    }

    const newDept = {
      id: `dept-${Date.now()}`,
      name: cleanName,
      createdAt: new Date().toISOString()
    };
    this.data.departments.push(newDept);
    this.save();
    return newDept;
  }

  deleteDepartment(idOrName) {
    this.getDepartments();
    const idx = this.data.departments.findIndex(d => d.id === idOrName || d.name.toLowerCase() === idOrName.toLowerCase());
    if (idx === -1) return false;
    this.data.departments.splice(idx, 1);
    this.save();
    return true;
  }

  updateDepartment(idOrName, newName) {
    this.getDepartments();
    const cleanName = (newName || '').trim();
    if (!cleanName) {
      throw new Error('Tên phòng ban mới không được để trống!');
    }

    const dept = this.data.departments.find(d => d.id === idOrName || d.name.toLowerCase() === idOrName.toLowerCase());
    if (!dept) {
      throw new Error('Không tìm thấy phòng ban cần điều chỉnh!');
    }

    const oldName = dept.name;

    // Check if new name is already used by another department
    const duplicate = this.data.departments.find(d => d.id !== dept.id && d.name.toLowerCase() === cleanName.toLowerCase());
    if (duplicate) {
      throw new Error(`Phòng ban "${cleanName}" đã tồn tại trên hệ thống!`);
    }

    dept.name = cleanName;
    dept.updatedAt = new Date().toISOString();

    // Cascade update to users
    let updatedUsersCount = 0;
    if (this.data.users && Array.isArray(this.data.users)) {
      this.data.users.forEach(u => {
        if (u.department === oldName) {
          u.department = cleanName;
          updatedUsersCount++;
        }
      });
    }

    // Cascade update to tasks
    let updatedTasksCount = 0;
    if (this.data.tasks && Array.isArray(this.data.tasks)) {
      this.data.tasks.forEach(t => {
        if (t.department === oldName) {
          t.department = cleanName;
          updatedTasksCount++;
        }
      });
    }

    this.save();
    return {
      department: dept,
      oldName,
      newName: cleanName,
      updatedUsersCount,
      updatedTasksCount
    };
  }

  // --- Automations (Workflow Rules Engine) ---
  getAutomations() {
    if (!this.data.automations || !Array.isArray(this.data.automations)) {
      this.data.automations = getDefaultData().automations || [];
      this.save();
    }
    return this.data.automations;
  }

  getAutomationById(id) {
    const list = this.getAutomations();
    return list.find(a => a.id === id) || null;
  }

  createAutomation(ruleData) {
    const list = this.getAutomations();
    const newRule = {
      id: `auto-${Date.now()}`,
      name: ruleData.name || 'Quy tắc tự động mới',
      description: ruleData.description || 'Tự động hóa quy trình công việc',
      icon: ruleData.icon || '⚡',
      color: ruleData.color || '#3b82f6',
      enabled: ruleData.enabled !== undefined ? ruleData.enabled : true,
      trigger: ruleData.trigger || 'task_status_completed',
      triggerLabel: ruleData.triggerLabel || 'Khi sự kiện xảy ra',
      action: ruleData.action || 'notify',
      actionLabel: ruleData.actionLabel || 'Tự động thực thi hành động',
      runCount: 0,
      lastRunAt: null,
      createdAt: new Date().toISOString()
    };
    list.unshift(newRule);
    this.save();
    return newRule;
  }

  updateAutomation(id, updates) {
    const list = this.getAutomations();
    const idx = list.findIndex(a => a.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
    this.save();
    return list[idx];
  }

  deleteAutomation(id) {
    const list = this.getAutomations();
    const idx = list.findIndex(a => a.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1);
    this.save();
    return true;
  }

  recordAutomationExecution(id) {
    const rule = this.getAutomationById(id);
    if (!rule) return null;
    rule.runCount = (rule.runCount || 0) + 1;
    rule.lastRunAt = new Date().toISOString();
    this.save();
    return rule;
  }

  // Reset database to initial seed data
  reset() {
    this.data = getDefaultData();
    this.save();
    return true;
  }
}

module.exports = new Database();
