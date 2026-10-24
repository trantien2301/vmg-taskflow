---
name: taskflow-ui-theme
description: >-
  Use this skill whenever designing, building, modifying, or refactoring UI components,
  views, cards, modals, buttons, forms, or adding new features in TaskFlow Pro to ensure
  100% compliance with the TaskFlow Pro Design System, Dual Themes (Dark/Light),
  Cyan-to-Emerald brand gradient, glassmorphism, responsive cards, and TFIcons SVG system.
---

# TaskFlow Pro - UI Theme & Design System Implementation Skill

Tài liệu hướng dẫn quy trình và cẩm nang code mẫu (Runbook & Cheatsheet) giúp xây dựng tính năng mới chuẩn phong cách TaskFlow Pro, tương thích hoàn hảo cả hai chế độ **Dark Mode** và **Light Mode**.

---

## 🛠️ Quy Trình 5 Bước Khi Thêm Tính Năng Mới (Step-by-Step Runbook)

Khi phát triển một tính năng mới trong TaskFlow Pro, hãy thực hiện theo 5 bước chuẩn hóa sau:

```
[1. Phân Tích Scope & Quyền (RBAC)]
                │
                ▼
[2. Thiết Kế Cấu Trúc HTML Chuẩn Token]
                │
                ▼
[3. Viết CSS Hỗ Trợ Dual Theme (Dark/Light)]
                │
                ▼
[4. Tích Hợp Icon Vector SVG (TFIcons)]
                │
                ▼
[5. Kiểm Thử Trực Quan (Dark & Light Mode)]
```

---

### BƯỚC 1: XÁC ĐỊNH PHẠM VI & PHÂN QUYỀN (RBAC)

Trước khi viết UI, xác định đối tượng người dùng:
* **Admin (Quản trị viên):** Thấy toàn bộ nút cấu hình, quản trị, xóa và chỉnh sửa quy tắc.
* **Manager / Member / Viewer:** Giới hạn quyền theo chức năng, ẩn các nút can thiệp hệ thống.
* **Quy chuẩn mã nguồn:**
  ```javascript
  const currentUser = this.state.user;
  const isAdmin = currentUser && currentUser.role === 'admin';
  const adminBtn = document.getElementById('myAdminActionButton');
  if (adminBtn) adminBtn.style.display = isAdmin ? 'inline-flex' : 'none';
  ```

---

### BƯỚC 2: MẪU CẤU TRÚC HTML CHUẨN DESIGN SYSTEM

#### 1. Mẫu Thẻ Công Việc / Dashboard Card (Card Pattern)
```html
<div class="task-card-theme-ready">
  <div class="card-header-row">
    <span class="badge-priority high">#TSK-xxx - CAO</span>
    <span class="card-status-badge">🟢 Đang triển khai</span>
  </div>
  <div class="card-title">Tiêu Đề Công Việc Mới</div>
  <div class="card-meta">
    <span>Phụ trách: <strong>Trần Tiến</strong> (Kỹ Thuật)</span>
  </div>
  <div class="card-actions-row">
    <button class="btn btn-outline btn-sm">Xem chi tiết</button>
    <button class="btn btn-primary btn-sm">Hoàn tất</button>
  </div>
</div>
```

#### 2. Mẫu Cửa Sổ Bật Lên Chuẩn (Modal Pattern)
```html
<div class="modal-overlay" id="newFeatureModal">
  <div class="modal-content" style="max-width: 560px;">
    <div class="modal-header">
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-size:20px;">✨</span>
        <h3 class="modal-title">Tiêu Đề Tính Năng Mới</h3>
      </div>
      <button type="button" class="modal-close-btn" onclick="App.closeNewFeatureModal()">×</button>
    </div>
    <form id="newFeatureForm" onsubmit="App.handleNewFeatureSubmit(event)">
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Tên cấu hình <span style="color:var(--danger)">*</span></label>
          <input type="text" class="form-control" placeholder="Nhập tên..." required>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline" onclick="App.closeNewFeatureModal()">Hủy</button>
        <button type="submit" class="btn btn-primary">💾 Lưu Dữ Liệu</button>
      </div>
    </form>
  </div>
</div>
```

---

### BƯỚC 3: MẪU CSS DUAL THEME TOKENS (CSS Cheatsheet)

Bắt buộc viết CSS sử dụng biến Design Tokens trong `public/css/style.css`:

```css
/* Card mẫu tương thích Dark / Light */
.task-card-theme-ready {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md); /* 16px */
  padding: 16px;
  box-shadow: var(--card-shadow);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease;
}

.task-card-theme-ready:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  border-color: rgba(14, 165, 233, 0.4);
}

.card-title {
  color: var(--text-primary);
  font-weight: 700;
  font-size: 14.5px;
  margin: 8px 0;
  line-height: 1.4;
}

.card-meta {
  color: var(--text-secondary);
  font-size: 12px;
  margin-bottom: 14px;
}

/* Nút bấm thương hiệu */
.btn-primary {
  background: var(--brand-gradient);
  border: none;
  color: #ffffff;
  border-radius: var(--radius-sm);
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.35);
  transition: all 0.2s ease;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(14, 165, 233, 0.5);
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  font-weight: 600;
  transition: all 0.2s ease;
}

.btn-outline:hover {
  background: var(--primary-light);
  border-color: var(--primary);
  color: var(--primary);
}
```

---

### BƯỚC 4: SỬ DỤNG HỆ THỐNG BIỂU TƯỢNG (TFIcons)

* Nhúng icon vector bằng JavaScript:
  ```javascript
  // Ví dụ render icon lịch hoặc icon chuông
  const iconHtml = typeof TFIcons !== 'undefined' ? TFIcons.calendar : '📅';
  const alertIcon = typeof TFIcons !== 'undefined' ? TFIcons.alert : '🚨';
  ```
* Nếu tạo icon SVG mới, khai báo trong `public/js/icons.js`:
  ```javascript
  myNewIcon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">...</svg>`
  ```

---

### BƯỚC 5: CHECKLIST KIỂM THỬ GIAO DIỆN (UI Verification Checklist)

Trước khi hoàn tất tính năng mới, hãy tự kiểm tra qua bảng checklist này:

| Hạng mục | Tiêu chí kiểm tra | Đạt? |
| :--- | :--- | :---: |
| **Dual Theme** | Chuyển sang Light Theme: Chữ hiển thị rõ ràng, nền trắng/xám dịu, không bị chữ trắng trên nền trắng. | [ ] |
| **Dark Theme** | Chuyển sang Dark Theme: Nền xanh đen sâu thẳm `#0f172a`, card `#1e293b`, viền `#334155`, chữ sáng rõ. | [ ] |
| **Brand Colors** | Nút chính, Header nổi bật sử dụng đúng gradient Cyan `#0ea5e9` ➔ Emerald `#10b981`. | [ ] |
| **Bo góc (Radius)**| Bo góc mềm mại đúng chuẩn: Inputs 10px, Card 16px, Modal 18-20px, Pills 20px. | [ ] |
| **Không đè Widget**| Không đặt phần tử cố định che khuất nút FAB của Work Smart AI ở góc dưới phải (`bottom: 24px; right: 24px`). | [ ] |
| **Phân quyền** | Tài khoản Member/Viewer không thấy và không thao tác được các nút quản trị của Admin. | [ ] |
