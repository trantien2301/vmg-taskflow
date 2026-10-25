/**
 * TaskFlow Pro - Work Smart AI Assistant
 * Chatbot hỗ trợ hướng dẫn sử dụng nhanh, giải đáp thắc mắc và tiếp nhận đóng góp ý kiến.
 * Thiết kế chuẩn phong cách Logo Cyan-Emerald & Dual Theme.
 */

const WorkSmartAI = {
  isOpen: false,
  isTyping: false,
  feedbackMode: false,
  feedbackCategory: 'suggestion',
  messages: [],

  // ========================================================
  // KNOWLEDGE BASE - TASKFLOW PRO
  // ========================================================
  knowledge: {
    kanban: {
      title: 'Bảng Kanban & Quản Lý Luồng Công Việc',
      keywords: ['kanban', 'keo tha', 'cột', 'to do', 'in progress', 'review', 'done', 'tien do', 'bảng công việc'],
      answer: `
        <strong>📋 Hướng dẫn sử dụng Bảng Kanban:</strong><br>
        • <strong>4 Cột trạng thái chuẩn:</strong> <em>Cần Làm</em> (To Do) ➔ <em>Đang Làm</em> (In Progress) ➔ <em>Chờ Duyệt</em> (Review) ➔ <em>Hoàn Thành</em> (Done).<br>
        • <strong>Kéo & Thả (Drag & Drop):</strong> Bấm giữ thẻ công việc và kéo thả sang cột mong muốn để cập nhật trạng thái ngay lập tức.<br>
        • <strong>Xem chi tiết:</strong> Nhấp trực tiếp vào thẻ task để xem mô tả, tệp đính kèm, danh sách việc con (checklist) và bình luận trao đổi.<br>
        • <strong>Tiến độ (%):</strong> Khi kéo sang cột <em>Hoàn Thành</em>, hệ thống sẽ tự động chuyển tiến độ thành 100%.
      `,
      actions: [
        { label: '📋 Mở Bảng Kanban ngay', callback: () => App.switchView('kanban') },
        { label: '➕ Giao công việc mới', callback: () => App.openAddTaskModal() }
      ]
    },

    table: {
      title: 'Danh Sách Việc (Table View)',
      keywords: ['table', 'danh sach', 'bảng việc', 'danh sách việc', 'tra cứu', 'stt', 'mã cv', 'tim kiem task'],
      answer: `
        <strong>📑 Hướng dẫn xem Danh Sách Việc:</strong><br>
        • <strong>Dạng bảng trực quan:</strong> Hiển thị đầy đủ Mã CV (#TSK-xxx), Tiêu đề, Phòng ban, Người phụ trách, Độ ưu tiên, Trạng thái, Thanh tiến độ và Ngày hạn chót.<br>
        • <strong>Nhận diện quá hạn:</strong> Các đầu việc trễ hạn được bôi đỏ nổi bật kèm biểu tượng cảnh báo.<br>
        • <strong>Bộ lọc thông minh:</strong> Kết hợp tìm kiếm theo từ khóa cùng bộ lọc Độ ưu tiên, Phòng ban VMG, và Người thực hiện.
      `,
      actions: [
        { label: '📑 Mở Danh Sách Việc', callback: () => App.switchView('table') }
      ]
    },

    calendar: {
      title: 'Lịch & Thời Hạn (Calendar & Google Calendar)',
      keywords: ['lich', 'calendar', 'google calendar', 'dong bo', 'han chot', 'deadline', 'nhac lich'],
      answer: `
        <strong>📅 Hướng dẫn Lịch & Đồng bộ Google Calendar:</strong><br>
        • <strong>Chế độ xem lịch:</strong> Theo dõi các công việc theo từng ngày, tuần, tháng với mã màu phân biệt trạng thái.<br>
        • <strong>Đồng bộ Google Calendar:</strong> Bấm nút <em>"Đồng Bộ Google Calendar"</em> để tải file lịch (.ics) hoặc kích hoạt tự động lưu vào Google Calendar cá nhân.<br>
        • <strong>Nhắc lịch thông minh:</strong> Hệ thống tự động quét và gửi thông báo đẩy trước giờ đến hạn để đảm bảo không bị trễ deadline.
      `,
      actions: [
        { label: '📅 Mở Lịch & Thời Hạn', callback: () => App.switchView('calendar') }
      ]
    },

    executive: {
      title: 'Bàn Làm Việc AI & Điều Hành (Executive Desk)',
      keywords: ['ban lam viec', 'executive', 'dieu hanh', 'tro ly ai', 'cockpit', 'war room', 'giao ban', 'rebalance', 'can bang'],
      answer: `
        <strong>💼 Tính năng Bàn Làm Việc Điều Hành & Trợ Lý AI:</strong><br>
        • <strong>Radar Rủi Ro & Tải Việc:</strong> AI tự động phân tích khối lượng công việc, cảnh báo nhân sự bị quá tải hoặc việc có nguy cơ chậm tiến độ.<br>
        • <strong>Cân bằng nhân sự (1-Click Rebalance):</strong> Điều phối chuyển giao công việc từ người quá tải sang nhân sự còn trống thời gian.<br>
        • <strong>AI War-Room (Họp Khẩn Meet):</strong> Tự động tạo link phòng họp Google Meet và gửi thông báo triệu tập khẩn cấp cho các nhân sự liên quan.<br>
        • <strong>Bản tin giao ban AI:</strong> Trợ lý AI tóm tắt ngắn gọn các việc trọng tâm cần xử lý trong ngày.
      `,
      actions: [
        { label: '💼 Mở Bàn Làm Việc AI', callback: () => App.switchView('executive-desk') }
      ]
    },

    alerts: {
      title: 'Trung Tâm Cảnh Báo & Chống Làm Phiền (Anti-Fatigue)',
      keywords: ['canh bao', 'tre han', 'qua han', 'alerts', 'rui ro', 'khan cap', 'overdue', 'chuông', 'snooze', 'hoan', 'tam hoan', 'lam phien', 'quy tac canh bao', 'quiet hours'],
      answer: `
        <strong>🚨 Trung Tâm Cảnh Báo & Chế Độ Chống Làm Phiền (Anti-Alert Fatigue):</strong><br>
        • <strong>Tự động quét Realtime:</strong> Hệ thống kiểm tra thời hạn mọi công việc liên tục.<br>
        • <strong>💤 Tạm hoãn cảnh báo (Snooze 24h):</strong> Bạn có thể bấm nút <em>"Hoãn"</em> trên thẻ việc để tạm ngừng chuông và ngừng nhắc lại khi đang xử lý hoặc đã xin gia hạn.<br>
        • <strong>Phân loại thông minh:</strong> Bộ lọc 5 nhóm: <em>Tất cả</em>, <em>🔴 Quá hạn</em>, <em>🟠 Sắp đến hạn</em>, <em>💤 Đang tạm hoãn</em>, và <em>👤 Việc của tôi</em>.<br>
        • <strong>⚙️ Cấu hình quy tắc (Chỉ Admin):</strong> Quản trị viên có toàn quyền thiết lập ngưỡng giờ báo trước, tần suất nhắc lại, khung giờ yên tĩnh (Quiet Hours: 22h-07h30) và chống spam thông báo cho Admin.
      `,
      actions: [
        { label: '🚨 Xem Trung Tâm Cảnh Báo', callback: () => App.switchView('alerts') }
      ]
    },

    automation: {
      title: 'Quy Trình & Tự Động Hóa (Bot Automation)',
      keywords: ['tu dong hoa', 'automation', 'bot', 'quy trinh', 'rule', 'gan the', 'tu dong'],
      answer: `
        <strong>⚡ Hướng dẫn Tự Động Hóa (Bot):</strong><br>
        • Cho phép tạo các quy tắc thông minh tự động chạy ngầm, ví dụ:<br>
          - <em>Tự động gắn nhãn "Quá hạn"</em> khi công việc trễ deadline.<br>
          - <em>Tự động gửi email/thông báo nhắc việc</em> khi task được giao mới.<br>
          - <em>Tự động chuyển trạng thái</em> sang Done khi hoàn thành 100% checklist.<br>
        • Bạn có thể Bật/Tắt, Chỉnh sửa điều kiện hoặc Bấm <em>"Chạy thử ngay"</em> bất cứ lúc nào.
      `,
      actions: [
        { label: '⚡ Mở Quản Lý Bot Tự Động', callback: () => App.switchView('automation') }
      ]
    },

    users: {
      title: 'Quản Trị Nhân Sự & Phân Quyền',
      keywords: ['nhan su', 'nguoi dung', 'users', 'phan quyen', 'role', 'admin', 'user', 'viewer', 'phong ban'],
      answer: `
        <strong>👥 Quản Trị Nhân Sự & Phòng Ban:</strong><br>
        • <strong>3 Cấp phân quyền:</strong><br>
          - 👑 <em>Admin (Quản trị viên):</em> Toàn quyền hệ thống, quản lý tài khoản, phòng ban, cấu hình Bot và xóa công việc.<br>
          - 👔 <em>User (Nhân sự):</em> Tạo, nhận và cập nhật tiến độ công việc được phân công.<br>
          - 👁️ <em>Viewer (Kiểm soát viên):</em> Chỉ xem dữ liệu báo cáo, không chỉnh sửa.<br>
        • <strong>Phòng ban VMG:</strong> Phân chia danh mục phòng ban (Kỹ thuật, Marketing, Kinh doanh, Vận hành, Ban Giám Đốc).
      `,
      actions: [
        { label: '👥 Quản Lý Nhân Sự', callback: () => App.switchView('users') }
      ]
    },

    profile: {
      title: 'Hồ Sơ Cá Nhân & Đổi Mật Khẩu',
      keywords: ['doi mat khau', 'mat khau', 'avatar', 'ho so', 'profile', 'anh dai dien', 'tai khoan'],
      answer: `
        <strong>🔐 Hướng dẫn Quản lý Hồ Sơ & Mật Khẩu:</strong><br>
        • Bấm vào <strong>khung tên/avatar ở góc dưới Sidebar bên trái</strong>.<br>
        • <strong>Đổi Avatar:</strong> Chọn tải ảnh đại diện từ máy tính hoặc chọn biểu tượng Icon.<br>
        • <strong>Đổi Mật khẩu:</strong> Nhập mật khẩu mới (tối thiểu 6 ký tự) và bấm xác nhận.<br>
        • <em>Mẹo:</em> Nếu quên mật khẩu ở màn hình đăng nhập, hãy bấm vào <em>"Quên mật khẩu?"</em> để được cấp mã OTP khôi phục nhanh.
      `,
      actions: [
        { label: '🔐 Mở Cài Đặt Hồ Sơ', callback: () => App.openProfileModal() }
      ]
    },

    sso: {
      title: 'Đăng Nhập Google Workspace (@vmg.edu.vn)',
      keywords: ['sso', 'google', 'vmg.edu.vn', 'dang nhap', 'dang ky', 'email noi bo'],
      answer: `
        <strong>🛡️ Đăng Nhập & Đăng Ký Bằng Google Workspace:</strong><br>
        • Hệ thống TaskFlow Pro hỗ trợ xác thực an toàn bằng tài khoản Google nội bộ đuôi <code>@vmg.edu.vn</code>.<br>
        • Bấm nút <strong>"Đăng nhập Google Workspace"</strong> tại màn hình đăng nhập để xác thực 1-Click.<br>
        • Mọi tài khoản đăng ký mới phải dùng email có đuôi <code>@vmg.edu.vn</code> để đảm bảo an toàn thông tin nội bộ.
      `
    },

    theme: {
      title: 'Chuyển Đổi Giao Diện Sáng / Tối (Dark / Light Mode)',
      keywords: ['theme', 'dark mode', 'light mode', 'giao dien', 'sang toi', 'mau'],
      answer: `
        <strong>🌙 Chuyển Đổi Dark Mode / Light Mode:</strong><br>
        • Bấm vào biểu tượng <strong>Mặt Trăng / Mặt Trời</strong> ở góc trên bên phải thanh Header.<br>
        • Hệ thống sẽ tự động lưu tùy chọn của bạn vào trình duyệt cho những lần đăng nhập sau.<br>
        • Giao diện được tối ưu chuẩn tương phản cao, dịu mắt và tôn vinh phong cách thương hiệu Cyan-Emerald.
      `
    },

    mobileApp: {
      title: 'Giao Diện Di Động & Trải Nghiệm Trên Điện Thoại',
      keywords: ['dien thoai', 'mobile', 'smartphone', 'app', 'giao dien dien thoai', 'man hinh nho', 'tablet'],
      answer: `
        <strong>📱 Trải Nghiệm TaskFlow Pro Trên Điện Thoại:</strong><br>
        • <strong>Đồng bộ 4 cột Kanban:</strong> Thanh điều hướng 4 tab <em>Cần Làm</em>, <em>Đang Làm</em>, <em>Duyệt</em>, <em>Xong</em> co giãn thông minh 100% chiều rộng, chạm là chuyển tức thì.<br>
        • <strong>Vuốt mượt mà (Swipe Carousel):</strong> Bảng Kanban hỗ trợ thao tác vuốt ngang chuyển cột dạng trượt mượt mà theo chuẩn Native App.<br>
        • <strong>Vùng an toàn (Safe Area):</strong> Toàn bộ thẻ công việc có khoảng trống đệm đáy an toàn, không lo bị nút Trợ lý AI che khuất.<br>
        • <strong>Chỉ số KPI cân đối:</strong> Lưới thống kê 5 chỉ số tự động căn chỉnh đối xứng 2 cột hoàn hảo.
      `,
      actions: [
        { label: '📋 Xem Bảng Công Việc', callback: () => App.switchView('kanban') }
      ]
    },

    newsTicker: {
      title: 'Bản Tin Chạy Chữ Nội Bộ VMG Realtime (News Ticker Marquee)',
      keywords: ['tin noi bo', 'bang tin', 'chay chu', 'marquee', 'tin tuc', 'ticker', 'thong bao chay', 'trai sang phai', 'quan ly tin', 'dang tin', 'tin vmg', 'dien thoai', 'mobile', 'khong thay tin', 'tin tren dien thoai'],
      answer: `
        <strong>📢 Bản Tin Chạy Chữ Nội Bộ VMG Realtime:</strong><br>
        • <strong>Vị trí:</strong> Dải tin tức kính mờ ngay dưới thanh Header, trên điện thoại có huy hiệu <strong>[TIN VMG]</strong> chạy chữ mượt mà từ trái sang phải.<br>
        • <strong>Trên điện thoại di động:</strong> Bản tin tự động thu gọn huy hiệu thành <code>TIN VMG</code>, tối ưu vùng chạm và không bao giờ đứng hình khi lướt chạm.<br>
        • <strong>Xem chi tiết:</strong> Nhấp vào bất kỳ mẩu tin nào để mở cửa sổ xem toàn văn nội dung, phòng ban phát tin và mốc thời gian.<br>
        • <strong>Tạm dừng / Chạy tiếp:</strong> Bấm nút <code>⏸ / ▶</code> để dừng hoặc tiếp tục dòng chữ chạy.<br>
        • <strong>Quản trị dành cho Admin:</strong> Bấm vào biểu tượng cây bút <strong>✏️</strong> trên thanh Ticker hoặc thanh menu bên trái để Đăng tin mới, Đặt ngày hết hạn, Ghim đầu dòng và Bật/Tắt phát sóng Realtime qua WebSocket.<br>
        <em>💡 Mẹo: Nếu không thấy thanh tin tức trên điện thoại, hãy vuốt xuống để tải lại trang (F5) để nạp phiên bản mới nhất v3.5.0.</em>
      `,
      actions: [
        { label: '📢 Xem Bảng Công Việc & Khởi Động Lại Ticker', callback: () => { App.switchView('kanban'); App.renderNewsTicker(true); } },
        { label: '✏️ Mở Quản Trị Bản Tin (Admin)', callback: () => App.openAdminNewsModal() }
      ]
    }
  },

  // ========================================================
  // INITIALIZATION
  // ========================================================
  init() {
    this.renderWidget();
    this.loadHistory();
    this.updateVisibility();
    console.log('Work Smart AI initialized successfully.');
  },

  show() {
    const widget = document.getElementById('workSmartAiWidget');
    if (widget) {
      widget.style.display = '';
    }
  },

  hide() {
    const widget = document.getElementById('workSmartAiWidget');
    if (widget) {
      widget.style.display = 'none';
    }
    this.isOpen = false;
    const win = document.getElementById('aiChatWindow');
    const btn = document.getElementById('aiLauncherBtn');
    if (win) win.style.display = 'none';
    if (btn) btn.classList.remove('active');
  },

  updateVisibility() {
    const loginScreen = document.getElementById('loginScreen');
    const appContainer = document.getElementById('appContainer');
    const isLoginActive = loginScreen && loginScreen.style.display !== 'none';
    const isAppVisible = appContainer && appContainer.style.display !== 'none';

    if (isLoginActive || !isAppVisible) {
      this.hide();
    } else {
      this.show();
    }
  },

  renderWidget() {
    let container = document.getElementById('workSmartAiWidget');
    if (!container) {
      container = document.createElement('div');
      container.id = 'workSmartAiWidget';
      container.className = 'work-smart-ai-widget';
      const targetParent = document.getElementById('appContainer') || document.body;
      targetParent.appendChild(container);
    }

    container.innerHTML = `
      <!-- Launcher Button (FAB) -->
      <button type="button" class="ai-launcher-btn" id="aiLauncherBtn" onclick="WorkSmartAI.toggle()" title="Hỏi Work Smart AI - Hướng dẫn & Đóng góp ý kiến">
        <div class="ai-launcher-pulse"></div>
        <div class="ai-launcher-icon">
          <svg class="ai-icon-robot" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
            <rect x="4" y="8" width="16" height="12" rx="4"/>
            <circle cx="9" cy="13" r="1.5" fill="currentColor"/>
            <circle cx="15" cy="13" r="1.5" fill="currentColor"/>
            <path d="M9.5 17c.8.7 1.6 1 2.5 1s1.7-.3 2.5-1"/>
            <path d="M2 13h2"/>
            <path d="M20 13h2"/>
          </svg>
          <svg class="ai-icon-close" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </div>
        <span class="ai-launcher-badge">AI</span>
      </button>

      <!-- Chat Popover Window -->
      <div class="ai-chat-window" id="aiChatWindow" style="display: none;">
        <!-- Header -->
        <div class="ai-chat-header">
          <div class="ai-header-info">
            <div class="ai-avatar-ring">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
                <rect x="4" y="8" width="16" height="12" rx="4"/>
                <circle cx="9" cy="13" r="1.5" fill="#fff"/>
                <circle cx="15" cy="13" r="1.5" fill="#fff"/>
                <path d="M9.5 17c.8.7 1.6 1 2.5 1s1.7-.3 2.5-1"/>
              </svg>
              <span class="ai-online-dot"></span>
            </div>
            <div>
              <div class="ai-title">Work Smart AI</div>
              <div class="ai-subtitle">Trợ lý hướng dẫn & Giải đáp thắc mắc</div>
            </div>
          </div>
          <div class="ai-header-actions">
            <button type="button" class="ai-action-btn" onclick="WorkSmartAI.clearChat()" title="Xóa lịch sử chat">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
              </svg>
            </button>
            <button type="button" class="ai-action-btn" onclick="WorkSmartAI.toggle()" title="Đóng cửa sổ">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Suggestion Chips Bar -->
        <div class="ai-quick-chips" id="aiQuickChips">
          <button type="button" class="ai-chip" onclick="WorkSmartAI.askQuick('kanban')">📋 Cách dùng Kanban</button>
          <button type="button" class="ai-chip" onclick="WorkSmartAI.askQuick('calendar')">📅 Lịch & Google Cal</button>
          <button type="button" class="ai-chip" onclick="WorkSmartAI.askQuick('executive')">💼 Bàn Làm Việc AI</button>
          <button type="button" class="ai-chip" onclick="WorkSmartAI.askQuick('alerts')">🚨 Xử lý việc trễ hạn</button>
          <button type="button" class="ai-chip" onclick="WorkSmartAI.startFeedbackMode()">💡 Đóng góp ý kiến</button>
          <button type="button" class="ai-chip" onclick="WorkSmartAI.askQuick('profile')">🔐 Đổi mật khẩu</button>
        </div>

        <!-- Messages Area -->
        <div class="ai-chat-body" id="aiChatBody"></div>

        <!-- Input Area -->
        <form class="ai-chat-footer" id="aiChatForm" onsubmit="WorkSmartAI.handleSend(event)">
          <input type="text" id="aiChatInput" class="ai-chat-input" placeholder="Hỏi Work Smart AI hoặc nhập góp ý..." autocomplete="off">
          <button type="submit" class="ai-send-btn" id="aiSendBtn" title="Gửi câu hỏi">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </form>
      </div>
    `;

    // Render initial welcome if empty
    if (this.messages.length === 0) {
      this.addBotMessage(`
        👋 Xin chào! Tôi là <strong>Work Smart AI</strong> - trợ lý thông minh của TaskFlow Pro.<br><br>
        Tôi có thể giúp bạn:<br>
        • 🚀 <strong>Hướng dẫn nhanh</strong> cách dùng Kanban, Lịch, Bàn làm việc AI, Báo cáo...<br>
        • ❓ <strong>Giải đáp thắc mắc</strong> về tính năng, đồng bộ Google Calendar, phân quyền...<br>
        • 💡 <strong>Tiếp nhận ý kiến đóng góp</strong> hoặc báo lỗi để hoàn thiện hệ thống.<br><br>
        <em>Bạn muốn tìm hiểu tính năng nào trước? Hãy chọn gợi ý bên trên hoặc đặt câu hỏi trực tiếp nhé!</em>
      `);
    } else {
      this.renderMessages();
    }
  },

  toggle() {
    this.isOpen = !this.isOpen;
    const win = document.getElementById('aiChatWindow');
    const btn = document.getElementById('aiLauncherBtn');
    if (!win || !btn) return;

    if (this.isOpen) {
      win.style.display = 'flex';
      win.classList.remove('closing');
      win.classList.add('opening');
      btn.classList.add('active');
      setTimeout(() => {
        const input = document.getElementById('aiChatInput');
        if (input) input.focus();
        this.scrollToBottom();
      }, 100);
    } else {
      win.classList.remove('opening');
      win.classList.add('closing');
      btn.classList.remove('active');
      setTimeout(() => {
        if (!this.isOpen) win.style.display = 'none';
      }, 250);
    }
  },

  open() {
    if (!this.isOpen) this.toggle();
  },

  close() {
    if (this.isOpen) this.toggle();
  },

  clearChat() {
    this.messages = [];
    this.feedbackMode = false;
    this.renderWidget();
    this.saveHistory();
  },

  scrollToBottom() {
    const body = document.getElementById('aiChatBody');
    if (body) {
      body.scrollTop = body.scrollHeight;
    }
  },

  renderMessages() {
    const body = document.getElementById('aiChatBody');
    if (!body) return;

    body.innerHTML = this.messages.map(msg => {
      if (msg.sender === 'user') {
        return `
          <div class="ai-msg user">
            <div class="ai-bubble">${this.escapeHtml(msg.text)}</div>
          </div>
        `;
      } else {
        return `
          <div class="ai-msg bot">
            <div class="ai-bot-avatar">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="4" y="8" width="16" height="12" rx="3"/><circle cx="9" cy="13" r="1.5" fill="#fff"/><circle cx="15" cy="13" r="1.5" fill="#fff"/>
              </svg>
            </div>
            <div class="ai-bubble">
              ${msg.html || this.escapeHtml(msg.text)}
              ${msg.actions && msg.actions.length > 0 ? `
                <div class="ai-msg-actions">
                  ${msg.actions.map((act, idx) => `
                    <button type="button" class="ai-btn-action" onclick="WorkSmartAI.executeAction(${msg.id}, ${idx})">
                      ${act.label}
                    </button>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }
    }).join('');

    if (this.isTyping) {
      body.innerHTML += `
        <div class="ai-msg bot ai-typing">
          <div class="ai-bot-avatar">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="4" y="8" width="16" height="12" rx="3"/>
            </svg>
          </div>
          <div class="ai-bubble">
            <span class="ai-dot"></span>
            <span class="ai-dot"></span>
            <span class="ai-dot"></span>
          </div>
        </div>
      `;
    }

    this.scrollToBottom();
  },

  addBotMessage(html, actions = null) {
    const id = Date.now() + Math.random();
    this.messages.push({
      id,
      sender: 'bot',
      html,
      actions,
      timestamp: new Date().toISOString()
    });
    this.renderMessages();
    this.saveHistory();
  },

  addUserMessage(text) {
    this.messages.push({
      sender: 'user',
      text,
      timestamp: new Date().toISOString()
    });
    this.renderMessages();
    this.saveHistory();
  },

  executeAction(msgId, actionIdx) {
    const msg = this.messages.find(m => m.id === msgId);
    if (msg && msg.actions && msg.actions[actionIdx]) {
      const act = msg.actions[actionIdx];
      if (typeof act.callback === 'function') {
        act.callback();
      }
    }
  },

  // ========================================================
  // INTERACTION HANDLERS
  // ========================================================
  askQuick(key) {
    const item = this.knowledge[key];
    if (!item) return;

    this.addUserMessage(`Hướng dẫn ${item.title}`);
    this.showTypingAndReply(item.answer, item.actions);
  },

  startFeedbackMode() {
    this.feedbackMode = true;
    this.addUserMessage('Tôi muốn đóng góp ý kiến / Báo lỗi');
    this.showTypingAndReply(`
      💡 <strong>Cảm ơn bạn đã sẵn sàng đóng góp ý kiến!</strong><br><br>
      Ý kiến của bạn giúp TaskFlow Pro ngày càng thông minh và tiện dụng hơn.<br>
      Hãy <strong>nhập nội dung góp ý hoặc mô tả lỗi</strong> của bạn vào ô chat bên dưới và bấm <strong>Gửi</strong> nhé...<br><br>
      <em>(Bạn có thể góp ý về giao diện, tính năng mới, hoặc thông báo lỗi đang gặp phải)</em>
    `, [
      { label: '💡 Đề xuất tính năng mới', callback: () => this.setFeedbackCategory('feature') },
      { label: '🐛 Báo lỗi giao diện / tính năng', callback: () => this.setFeedbackCategory('bug') },
      { label: '💬 Góp ý trải nghiệm chung', callback: () => this.setFeedbackCategory('general') }
    ]);
  },

  setFeedbackCategory(cat) {
    this.feedbackCategory = cat;
    const catLabels = {
      feature: '💡 Đề xuất tính năng mới',
      bug: '🐛 Báo lỗi giao diện / tính năng',
      general: '💬 Góp ý trải nghiệm chung'
    };
    this.addBotMessage(`Đã chọn phân loại: <strong>${catLabels[cat] || cat}</strong>. Mời bạn nhập nội dung chi tiết phía dưới:`);
  },

  handleSend(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('aiChatInput');
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    this.addUserMessage(text);

    // If currently in feedback mode, submit feedback directly
    if (this.feedbackMode) {
      this.submitUserFeedback(text);
      return;
    }

    // Check if user is asking to give feedback
    const lower = text.toLowerCase();
    if (lower.includes('góp ý') || lower.includes('gop y') || lower.includes('ý kiến') || lower.includes('y kien') || lower.includes('báo lỗi') || lower.includes('bao loi') || lower.includes('feedback')) {
      this.startFeedbackMode();
      return;
    }

    // Process Q&A logic
    this.processQuery(text);
  },

  async submitUserFeedback(content) {
    this.isTyping = true;
    this.renderMessages();

    try {
      const user = App.state && App.state.user ? App.state.user : null;
      const res = await fetch('/api/feedbacks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(API && API.token ? { 'Authorization': `Bearer ${API.token}` } : {})
        },
        body: JSON.stringify({
          content,
          category: this.feedbackCategory,
          name: user ? user.name : 'Người dùng Work Smart AI',
          email: user ? user.email : '',
          role: user ? user.role : 'user',
          department: user ? user.department : ''
        })
      });

      const data = await res.json();
      this.isTyping = false;
      this.feedbackMode = false;

      this.addBotMessage(`
        ✅ <strong>Tiếp nhận ý kiến thành công!</strong><br><br>
        Mã tiếp nhận: <code>${data.feedback ? data.feedback.id : 'FDB-' + Date.now().toString().slice(-4)}</code><br>
        Nội dung: <em>"${this.escapeHtml(content)}"</em><br><br>
        🙏 Chân thành cảm ơn bạn đã đóng góp giúp hoàn thiện hệ thống TaskFlow Pro. Ban quản trị sẽ xem xét và phản hồi sớm nhất!
      `, [
        { label: '❓ Hỏi câu khác', callback: () => this.askQuick('kanban') },
        { label: '💡 Góp ý thêm', callback: () => this.startFeedbackMode() }
      ]);
    } catch (err) {
      this.isTyping = false;
      this.feedbackMode = false;
      this.addBotMessage(`❌ Rất tiếc, đã có lỗi khi gửi ý kiến: ${err.message}. Vui lòng thử lại sau!`);
    }
  },

  processQuery(rawText) {
    const text = this.normalize(rawText);

    // 1. Direct Knowledge Base Match
    let bestMatch = null;
    let maxScore = 0;

    for (const [key, item] of Object.entries(this.knowledge)) {
      let score = 0;
      for (const kw of item.keywords) {
        const normKw = this.normalize(kw);
        if (text.includes(normKw)) {
          score += normKw.length;
        }
      }
      if (score > maxScore) {
        maxScore = score;
        bestMatch = item;
      }
    }

    if (bestMatch && maxScore >= 4) {
      this.showTypingAndReply(bestMatch.answer, bestMatch.actions);
      return;
    }

    // 2. Greetings & Persona Match
    if (text.includes('chao') || text.includes('hello') || text.includes('hi') || text.includes('ban la ai') || text.includes('ai day')) {
      this.showTypingAndReply(`
        Chào bạn! Tôi là <strong>Work Smart AI</strong> - trợ lý thông minh của hệ thống TaskFlow Pro.<br><br>
        Tôi được thiết kế để giúp bạn thao tác nhanh chóng, giải đáp thắc mắc và tiếp nhận ý kiến cải tiến.<br>
        Bạn cần hỗ trợ về mục nào dưới đây?
      `, [
        { label: '📋 Hướng dẫn Kanban', callback: () => this.askQuick('kanban') },
        { label: '📅 Lịch & Google Cal', callback: () => this.askQuick('calendar') },
        { label: '💼 Bàn Làm Việc AI', callback: () => this.askQuick('executive') },
        { label: '💡 Đóng góp ý kiến', callback: () => this.startFeedbackMode() }
      ]);
      return;
    }

    // 3. Fallback Smart Response
    this.showTypingAndReply(`
      Cảm ơn bạn đã hỏi về: <em>"${this.escapeHtml(rawText)}"</em>.<br><br>
      Tôi đã ghi nhận câu hỏi. Để nắm rõ hơn, bạn có thể tham khảo các hướng dẫn nhanh dưới đây hoặc bấm <strong>"Gửi ý kiến đóng góp"</strong> để đội ngũ hỗ trợ giải đáp trực tiếp cho bạn:
    `, [
      { label: '📖 Mở Cẩm Nang Sử Dụng', callback: () => App.switchView('guide') },
      { label: '📋 Hướng dẫn Kanban', callback: () => this.askQuick('kanban') },
      { label: '💡 Đóng góp ý kiến này', callback: () => {
        this.feedbackMode = true;
        this.submitUserFeedback(rawText);
      }}
    ]);
  },

  showTypingAndReply(html, actions = null) {
    this.isTyping = true;
    this.renderMessages();

    setTimeout(() => {
      this.isTyping = false;
      this.addBotMessage(html, actions);
    }, 450);
  },

  // ========================================================
  // UTILITIES
  // ========================================================
  normalize(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .trim();
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

  saveHistory() {
    try {
      // Keep last 25 messages in sessionStorage
      const slice = this.messages.slice(-25);
      sessionStorage.setItem('work_smart_ai_history', JSON.stringify(slice));
    } catch (_) {}
  },

  loadHistory() {
    try {
      const data = sessionStorage.getItem('work_smart_ai_history');
      if (data) {
        this.messages = JSON.parse(data);
      }
    } catch (_) {}
  }
};

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => WorkSmartAI.init());
  } else {
    WorkSmartAI.init();
  }
}
