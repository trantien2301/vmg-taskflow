# TaskFlow Pro - UI Theme & Design System Compliance Rule

Mọi tính năng mới, giao diện mới (Views), thành phần UI (Components), thẻ (Cards), cửa sổ bật lên (Modals), nút bấm (Buttons), thanh lọc (Filters) hay biểu mẫu (Forms) khi được thêm vào hoặc chỉnh sửa trong dự án TaskFlow Pro **BẮT BUỘC** phải tuân thủ nghiêm ngặt các quy chuẩn thiết kế sau:

---

## 1. BẢNG MÀU THƯƠNG HIỆU & DUAL THEMES (DARK & LIGHT)

* **TUYỆT ĐỐI KHÔNG** hardcode mã màu cố định như `#ffffff`, `#000000`, `#0f172a`, `#1e293b` trực tiếp vào style component.
* **BẮT BUỘC** sử dụng hệ thống CSS Variables / Design Tokens đã được định nghĩa trong `public/css/style.css`:
  * Nền chính: `var(--bg-main)` (Light: `#f1f5f9`, Dark: `#0f172a`)
  * Nền Card / Modal: `var(--bg-card)` (Light: `#ffffff`, Dark: `#1e293b`)
  * Nền Sidebar: `var(--bg-sidebar)` (Light: `#ffffff`, Dark: `#0b1329`)
  * Màu chữ tiêu đề: `var(--text-primary)` (Light: `#0f172a`, Dark: `#f8fafc`)
  * Màu chữ phụ: `var(--text-secondary)` (Light: `#64748b`, Dark: `#94a3b8`)
  * Màu chữ mờ / placeholder: `var(--text-muted)`
  * Viền phân cách: `var(--border-color)` (Light: `#e2e8f0`, Dark: `#334155`)
  * Trạng thái chức năng: `var(--success)`, `var(--warning)`, `var(--danger)`, `var(--info)`.

* **Dải màu thương hiệu đặc trưng (Brand Flow Gradient):**
  * `var(--brand-gradient)`: `linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)` (Cyan `#0ea5e9` ➔ Emerald `#10b981`).
  * Sử dụng cho: Nút bấm chính (`.btn-primary`), Header modal chính, Banner nổi bật, Huy hiệu active, Floating buttons.
  * Hiệu ứng viền sáng cyan (Cyan Glow): `var(--brand-glow-cyan)` hoặc `box-shadow: 0 0 16px rgba(14, 165, 233, 0.45)`.

---

## 2. HÌNH HỌC, ĐỘ BO GÓC & HIỆU ỨNG (GEOMETRY & GLASSMORPHISM)

* **Hệ thống Bo Góc Chuẩn:**
  * Tag nhỏ / Pill badge: `var(--radius-xs)` (6px) hoặc `border-radius: 20px;` (Pills tròn)
  * Nút bấm, Ô nhập liệu (Inputs): `var(--radius-sm)` (10px) hoặc 12px
  * Thẻ công việc (Cards), Khung lọc: `var(--radius-md)` (16px)
  * Cửa sổ Modal, Bảng điều khiển lớn: `var(--radius-lg)` (18px) hoặc 20px
  * Widget nổi (Floating Popover): `border-radius: 20px;`
* **Hiệu ứng Kính Mờ (Glassmorphism):**
  * Thẻ Card và Popover kết hợp: `backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);` và viền mảnh `1px solid var(--border-color)`.
* **Trạng thái Menu Active:**
  * Thẻ menu đang chọn phải có viền phát sáng Cyan glow: `border: 1.5px solid var(--primary); box-shadow: 0 0 16px rgba(14, 165, 233, 0.4);`.

---

## 3. HỆ THỐNG BIỂU TƯỢNG (ICONS)

* Sử dụng bộ icon vector SVG đồng bộ phong cách Logo mới trong `public/js/icons.js` (`TFIcons.*`).
* Khi thêm icon mới, phải vẽ vector SVG chuẩn `stroke-width="1.85"` đến `2.0`, bo góc đầu tròn `stroke-linecap="round" stroke-linejoin="round"`, kích thước chuẩn 16x16, 18x18, 20x20 hoặc 24x24.

---

## 4. QUY CHUẨN CẤU TRÚC MODAL & COMPONENT

* **Cấu trúc Modal đúng chuẩn TaskFlow Pro:**
  ```html
  <div class="modal-overlay" id="myFeatureModal">
    <div class="modal-content" style="max-width: 580px;">
      <div class="modal-header">
        <h3 class="modal-title">Tiêu Đề Tính Năng</h3>
        <button type="button" class="modal-close-btn" onclick="...">×</button>
      </div>
      <div class="modal-body">...</div>
      <div class="modal-footer">...</div>
    </div>
  </div>
  ```
  *(Lưu ý: Không dùng `.modal` + `.modal-dialog` kiểu Bootstrap cũ)*.

* **Ô nhập liệu Form Inputs:**
  * Sử dụng `.form-control` (nền `var(--bg-main)`, chữ `var(--text-primary)`, viền `var(--border-color)`).
  * Trạng thái focus: `border-color: var(--primary); box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.18);`.

---

## 5. PHÂN QUYỀN (RBAC) & TRÁNH LÀM PHIỀN (ANTI-FATIGUE)

* Khi thêm tính năng quản trị hệ thống, cài đặt quy tắc, hay xóa dữ liệu nhạy cảm:
  * **Client-side:** Kiểm tra `App.state.user.role === 'admin'` để ẩn/hiện nút bấm và modal.
  * **Server-side:** Bắt buộc chặn `if (req.user.role !== 'admin') return res.status(403).json(...)`.
* Khi sinh thông báo (Notifications / Alerts):
  * Tôn trọng khung giờ yên tĩnh `Quiet Hours` và mức độ khẩn cấp (P1/P2/P3), tránh spam notification.
  * Cụm thông báo Toast nằm ở `bottom: 96px; right: 24px;` để không đè lên trợ lý Work Smart AI (`bottom: 24px`).

## 6. ĐỒNG BỘ HƯỚNG DẪN & CHATBOT WORK SMART AI (DOCUMENTATION & KNOWLEDGE SYNC)

* **Nguyên tắc "No Feature Without Guidance":** Bất kỳ tính năng mới nào khi hoàn thành **BẮT BUỘC** phải:
  1. Thêm kiến thức và từ khóa vào Chatbot Work Smart AI (`public/js/workSmartAI.js` -> `WorkSmartAI.knowledge`).
  2. Bổ sung thẻ hướng dẫn chi tiết trong Tab Cẩm Nang (`#view-guide` trong `public/index.html`).
  3. Cập nhật tài liệu offline `HUONG_DAN_SU_DUNG_TOAN_DIEN_TASKFLOW_PRO.md`.
  4. Cập nhật lịch sử nâng cấp Changelog trong `server.js`.
