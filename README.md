# ⚡ TaskFlow Pro - Hệ Thống Quản Lý Công Việc Realtime Đa Nền Tảng

Ứng dụng web quản lý công việc chuyên nghiệp, đồng bộ dữ liệu trực tiếp theo thời gian thực (Realtime), phân quyền chặt chẽ giữa **Admin** và **User**, tích hợp hệ thống **Cảnh báo thông minh** (Quá hạn, Sắp hết hạn, Khẩn cấp) và **Báo cáo thống kê** trực quan với biểu đồ tương tác.

---

## 🌟 Tính Năng Nổi Bật

### 1. 👥 Phân Quyền Vai Trò (Role-Based Access Control - RBAC)
* **Quản trị viên (Admin):**
  * Toàn quyền tạo, giao việc, phân bổ nhân sự, chỉnh sửa và xóa mọi công việc.
  * Quản lý thành viên: Thêm nhân viên mới, phân bổ phòng ban, đổi vai trò (Admin / User), khóa hoặc kích hoạt tài khoản.
  * Xem toàn bộ báo cáo tổng quan của tổ chức, tiến độ từng phòng ban và bảng xếp hạng KPI của từng cá nhân.
  * Tùy chỉnh và kích hoạt quét cảnh báo tự động trên toàn hệ thống.
* **Người dùng / Nhân viên (User):**
  * Theo dõi danh sách công việc được giao và các việc chung của phòng ban.
  * Kéo thả Kanban hoặc click cập nhật trạng thái (`Cần làm` ➔ `Đang làm` ➔ `Chờ duyệt` ➔ `Hoàn thành`).
  * Điều chỉnh thanh tiến độ hoàn thành (0% - 100%).
  * Trao đổi, thảo luận trực tuyến qua khung bình luận Realtime.
  * Xem thông báo và cảnh báo deadline của riêng mình.

### 2. 🛡️ Đăng Ký Tài Khoản Mới (Chính Sách Email Nội Bộ @vmg.edu.vn)
* **Xác thực miền độc quyền:** Hệ thống chỉ chấp nhận đăng ký tài khoản thành viên mới đối với địa chỉ email có đuôi chính thức của trường/công ty là **`@vmg.edu.vn`** (Ví dụ: `hoang.nam@vmg.edu.vn`).
* **Kiểm tra theo thời gian thực:** Ô nhập email có bộ kiểm tra tự động, cảnh báo tức thì khi người dùng nhập sai miền email (ví dụ: gmail, yahoo...) và xác nhận hợp lệ khi kết thúc bằng `@vmg.edu.vn`.
* **Kích hoạt tài khoản tức thì:** Sau khi đăng ký thành công, hệ thống tự động đăng nhập và đưa người dùng vào ngay giao diện không gian làm việc.

### 3. 📡 Đồng Bộ Realtime 100% (WebSocket)
* **Không cần tải lại trang (No Refresh Needed):** Mọi thao tác như tạo mới việc, kéo thả Kanban, cập nhật % tiến độ, gửi bình luận hay thay đổi trạng thái đều được phát sóng tức thì đến tất cả mọi người đang mở web.
* **Chỉ báo trạng thái kết nối trực tiếp:** Hiển thị số lượng thành viên đang online trực tiếp trên thanh Header (🟢 *Trực tuyến: X người*).
* **Âm thanh & Toast thông báo:** Hệ thống tự phát âm thanh thông báo và hiện thẻ thông báo góc màn hình khi có task mới được giao hoặc có cảnh báo.

### 3. 🚨 Hệ Thống Cảnh Báo Thông Minh (Smart Alerts & Scanner)
* **Cảnh báo Quá Hạn (Overdue - Đỏ 🔴):** Tự động phát hiện khi quá hạn chót, đếm số ngày trễ hạn, gắn cờ báo động trên Kanban, Bảng danh sách và Trung tâm cảnh báo.
* **Cảnh báo Sắp Đến Hạn (Due Soon - Cam 🟠):** Đếm ngược số giờ còn lại khi công việc sắp đến hạn trong vòng 24 giờ tới.
* **Bộ quét tự động nền:** Server tự động quét mỗi 60 giây và tạo thông báo khẩn gửi đến người phụ trách và Admin.

### 4. 📊 Báo Cáo & Thống Kê Chuyên Sâu (Analytics & KPI)
* **Biểu đồ tròn (Doughnut):** Tỷ lệ phân bổ trạng thái công việc (Cần làm, Đang làm, Chờ duyệt, Hoàn thành, Quá hạn).
* **Biểu đồ cột (Bar):** Khối lượng công việc và tỷ lệ hoàn thành theo từng phòng ban.
* **Biểu đồ đường (Line):** Xu hướng hoàn thành và khối lượng việc giao mới trong 7 ngày qua.
* **Biểu đồ xếp hạng (Horizontal Bar):** So sánh hiệu suất giữa các nhân viên.
* **Xuất báo cáo:** Hỗ trợ xuất dữ liệu ra file **Excel (CSV UTF-8)** và in ấn định dạng **PDF**.

### 5. 🎨 Đa Dạng Chế Độ Xem (Multiple Views)
* 📋 **Bảng Kanban:** Kéo thả trực quan (HTML5 Drag & Drop).
* 📑 **Bảng Danh Sách (Data Table):** Tìm kiếm tức thì, lọc theo phòng ban, độ ưu tiên, người phụ trách.
* 📅 **Lịch & Dòng Thời Gian (Timeline):** Phân loại theo Hạn hôm nay, Hạn tuần này, Quá hạn và Tương lai.
* 🚨 **Trung Tâm Cảnh Báo Tập Trung:** Lọc riêng các công việc cần xử lý gấp kèm nút "Đánh dấu xong ngay".
* 👥 **Quản Lý Nhân Sự (Admin Only).**
* 📜 **Nhật Ký Hoạt Động (Audit Log).**
* 🌙 **Hỗ trợ Giao diện Tối / Sáng (Dark / Light Mode).**

---

## 🔑 Tài Khoản Demo Mẫu Sẵn Trong Hệ Thống

Bạn có thể chuyển đổi tức thì giữa các tài khoản ngay trên thanh Header qua menu **"👤 Đổi vai trò"** hoặc đăng nhập bằng thông tin dưới đây (mật khẩu chung: `123456`):

| Họ Tên | Email | Mật Khẩu | Vai Trò | Phòng Ban |
|---|---|---|---|---|
| **Trần Quản Trị** | `admin@company.com` | `123456` | 👑 **Admin** | Ban Giám Đốc |
| **Nguyễn Thị Lan** | `lan.nguyen@company.com` | `123456` | 👩‍💻 User | Phòng Kỹ Thuật |
| **Trần Anh Tuấn** | `tuan.tran@company.com` | `123456` | 👨‍🎨 User | Phòng Marketing |
| **Lê Tuyết Mai** | `mai.le@company.com` | `123456` | 👩‍💼 User | Phòng Kinh Doanh |
| **Phạm Minh Hoàng** | `hoang.pham@company.com` | `123456` | 👨‍🔧 User | Phòng Vận Hành |

---

## 🚀 Hướng Dẫn Khởi Động & Truy Cập

### Cách 1: Chạy bằng file `start.bat` (Nhanh nhất)
* Nhấp đúp chuột vào file `start.bat` trong thư mục `d:\Antigravity\Quanlycongviec`.
* Trình duyệt sẽ tự động mở trang web tại địa chỉ: **`http://localhost:3000`**

### Cách 2: Chạy bằng dòng lệnh (Terminal / PowerShell)
```powershell
cd d:\Antigravity\Quanlycongviec
npm start
```
Truy cập trình duyệt: **`http://localhost:3000`**

---

## 📁 Cấu Trúc Dự Án

```
d:\Antigravity\Quanlycongviec/
├── data/
│   └── db.json               # Cơ sở dữ liệu JSON tự động lưu trữ và phục hồi
├── public/
│   ├── css/
│   │   └── style.css         # Hệ thống giao diện hiện đại, Dark/Light Mode, Kanban
│   ├── js/
│   │   ├── api.js            # Module giao tiếp REST API & xác thực JWT
│   │   ├── charts.js         # Khởi tạo và vẽ 4 loại biểu đồ Chart.js
│   │   └── app.js            # Bộ điều khiển trung tâm, WebSocket client, Drag & Drop
│   └── index.html            # Giao diện Single Page Application (SPA)
├── server.js                 # Máy chủ Express, WebSocket Server, Alert Engine
├── database.js               # Quản trị dữ liệu, RBAC, CRUD, ghi file an toàn
├── package.json              # Khai báo thư viện & cấu hình khởi chạy
├── start.bat                 # Phím tắt mở ứng dụng 1-click
└── README.md                 # Tài liệu hướng dẫn chi tiết
```
