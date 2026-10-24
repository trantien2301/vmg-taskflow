# TaskFlow Pro - Project Guidelines & UI Theme Compliance Rules

## Overview
Dự án **TaskFlow Pro** là web app quản lý luồng công việc thời gian thực với hệ sinh thái thương hiệu Gradient Cyan-to-Emerald, hỗ trợ song song hai chế độ Dark Mode & Light Mode, trợ lý thông minh Work Smart AI và hệ thống phân quyền đa tầng.

---

## 🎨 UI Theme Compliance (Bắt Buộc Cho Mọi Tính Năng Mới)

Mọi tính năng, màn hình giao diện (View), thành phần (Component), Modal, Card, Button hay Form khi được thêm mới **BẮT BUỘC** phải tuân thủ nghiêm ngặt các quy tắc sau:

### 1. Token Màu & Dual Themes (Dark & Light)
* **Tuyệt đối không** hardcode màu nền hex/rgb trực tiếp (`#ffffff`, `#000000`, `#0f172a`).
* **Bắt buộc dùng Design Tokens trong `public/css/style.css`**:
  * Nền: `var(--bg-main)` (nền trang), `var(--bg-card)` (nền thẻ/modal), `var(--bg-sidebar)` (nền sidebar).
  * Chữ: `var(--text-primary)` (tiêu đề, nội dung chính), `var(--text-secondary)` (chữ phụ), `var(--text-muted)` (chú thích).
  * Viền: `var(--border-color)`
  * Dải màu thương hiệu: `var(--brand-gradient)` (`linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)`).
  * Phát sáng Cyan: `var(--brand-glow-cyan)` hoặc `box-shadow: 0 0 16px rgba(14, 165, 233, 0.45)`.

### 2. Hình Học & Bo Góc Chuẩn
* Nút bấm, Inputs: `var(--radius-sm)` (10px) hoặc 12px.
* Thẻ Card, Filters: `var(--radius-md)` (16px).
* Cửa sổ Modal: `var(--radius-lg)` (18px) hoặc 20px.
* Menu đang active: Viền `1.5px solid var(--primary)` và phát sáng Cyan glow `0 0 16px rgba(14, 165, 233, 0.4)`.
* Hiệu ứng kính mờ: `backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);`.

### 3. Icon Vector Chuẩn Logo Mới
* Sử dụng hệ thống icon vector SVG trong `public/js/icons.js` (`TFIcons.*`).
* Khi vẽ SVG mới: `stroke-width="1.85"` đến `2.0`, `stroke-linecap="round" stroke-linejoin="round"`.

### 4. Cấu Trúc Modal Chuẩn
* Modal Overlay: `<div class="modal-overlay" id="..."><div class="modal-content">...</div></div>`.
* Nút đóng modal: `<button type="button" class="modal-close-btn" onclick="...">×</button>`.

### 5. Phân Quyền (RBAC) & Chống Làm Phiền
* Các tính năng quản trị quy tắc hệ thống chỉ hiển thị khi `App.state.user.role === 'admin'`.
* Backend API luôn có middleware xác thực `authenticate` và kiểm tra `if (req.user.role !== 'admin') return res.status(403).json(...)`.
* Không đặt element đè lên floating button của Work Smart AI (`bottom: 24px; right: 24px;`). Thông báo Toast đặt tại `bottom: 96px; right: 24px;`.

### 6. Bắt Buộc Đồng Bộ Hướng Dẫn & Chatbot Work Smart AI (Documentation & Knowledge Sync)
* **Nguyên tắc "No Feature Without Guidance":** Bất kỳ khi nào một tính năng hoặc nâng cấp mới được thêm vào web app, **BẮT BUỘC** phải:
  1. **Cập nhật Chatbot Work Smart AI (`public/js/workSmartAI.js`)**: Bổ sung `WorkSmartAI.knowledge[newFeatureKey]` với đầy đủ từ khóa (keywords có dấu và không dấu), hướng dẫn súc tích (HTML formatted) và các nút bấm hành động chuyển view tức thì (actions deep link).
  2. **Cập nhật Cẩm Nang Hướng Dẫn Sử Dụng (`#view-guide` trong `public/index.html`)**: Thêm thẻ hướng dẫn (Guide card) chi tiết, phân quyền ai được dùng và các bước thao tác thực tế.
  3. **Cập nhật Tài liệu toàn diện offline (`HUONG_DAN_SU_DUNG_TOAN_DIEN_TASKFLOW_PRO.md`)**: Bổ sung chương/mục vào tài liệu markdown nội bộ.
  4. **Cập nhật Changelog (`server.js`)**: Thêm tóm tắt vào API `/api/system/version`.

