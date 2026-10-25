---
name: taskflow-mobile-ui
description: >-
  Use this skill whenever designing, modifying, or refactoring UI components, views,
  headers, navigation, cards, grids, modals, or layouts for mobile devices (smartphones
  and tablets) in TaskFlow Pro. Enforces balanced responsive layout, zero text clipping/truncation,
  safe area scroll padding against floating action buttons (FAB), and mobile-first touch ergonomics.
---

# TaskFlow Pro - Mobile Web App UI & Responsive Protection Skill

Cẩm nang và quy chuẩn kiến trúc giao diện di động (Mobile Web App UI/UX) chuẩn Native App dành riêng cho hệ thống **TaskFlow Pro**. Đảm bảo mọi tính năng mới khi được đưa lên môi trường web app trên điện thoại thông minh đều cân bằng hoàn hảo, tuyệt đối không bị khuất chữ, không vỡ layout và tối ưu thao tác một tay (Thumb-Zone Friendly).

---

## 🎯 6 Nguyên Tắc Vàng Của Giao Diện Di Động (Mobile-First Core Rules)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Zero Text Truncation (Không Khuất Chữ, Không Tràn Tiêu Đề)│
├─────────────────────────────────────────────────────────────┤
│ 2. Balanced Grid System (Lưới Cân Bằng, Không Để Khuyết Cột)│
├─────────────────────────────────────────────────────────────┤
│ 3. Proportional Navigation (Thanh Tab Đối Xứng 100% Width)  │
├─────────────────────────────────────────────────────────────┤
│ 4. Floating Safe Area (Khoảng Đệm Đáy Tránh Che Nút AI FAB) │
├─────────────────────────────────────────────────────────────┤
│ 5. Touch Target Ergonomics (Vùng Chạm Chuẩn Tối Thiểu 44px) │
├─────────────────────────────────────────────────────────────┤
│ 6. Dual Theme Support (Sáng/Tối Tương Phản Chuẩn Token)     │
└─────────────────────────────────────────────────────────────┘
```

---

## 📱 Chi Tiết Triển Khai Kỹ Thuật

### 1. Header & View Title: Chống Cắt Cụt Chữ (Anti-Truncation)
* **Vấn đề thường gặp:** Header chứa nhiều icon/badge ở góc phải (`[● 1 online] [🔔] [☀️/🌙]`), làm co hẹp không gian tiêu đề ở góc trái khiến tên trang bị cắt mất chữ (ví dụ: *"Bảng Công \"* thay vì *"Bảng Công Việc"*).
* **Quy tắc CSS bắt buộc:**
  ```css
  /* 1. Header Left & Title Container */
  .header-left {
    min-width: 0;
    flex: 1;
    overflow: hidden;
  }
  .current-view-title {
    font-size: 14.5px;
    font-weight: 700;
    line-height: 1.2;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex: 1;
    overflow: hidden;
  }
  /* 2. Tiêu đề con dạng span co giãn mượt mà */
  .current-view-title span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    flex: 1;
  }
  /* 3. Ẩn vector SVG thừa trong tiêu đề trên màn hình nhỏ */
  @media (max-width: 600px) {
    .current-view-title svg {
      display: none !important;
    }
  }
  /* 4. Tối ưu gọn Status Pill bên phải */
  @media (max-width: 480px) {
    .realtime-status-pill {
      padding: 3px 6px;
      font-size: 11px;
    }
    .realtime-status-pill .show-mobile-only {
      display: none !important; /* Chỉ hiện chấm xanh và số online: ● 1 */
    }
  }
  ```

---

### 2. Lưới Thống Kê KPI (Balanced 2-Column Grid)
* **Vấn đề thường gặp:** Khi có số lượng thẻ lẻ (ví dụ 5 thẻ KPI), sắp xếp 2 cột sẽ làm thẻ thứ 5 nằm cô độc ở cột 1, để lại cột 2 trống rỗng gây mất thẩm mỹ.
* **Quy tắc CSS bắt buộc:**
  ```css
  @media (max-width: 768px) {
    .kpi-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 7px;
      margin-bottom: 12px;
    }
    /* Thẻ cuối cùng (hoặc thẻ lẻ thứ 5) tự động trải rộng cả 2 cột */
    .kpi-card:last-child,
    .kpi-card:nth-child(5) {
      grid-column: 1 / -1 !important;
      display: flex;
      align-items: center;
    }
  }
  ```

---

### 3. Điều Hướng Tab Kanban (Proportional Equal Tabs)
* **Vấn đề thường gặp:** Dùng `overflow-x: auto` với tab fix cứng độ rộng sẽ làm tab thứ 4 (ví dụ *"Xong"*) bị tràn ra ngoài màn hình và bị cắt cụt thành *"Xon..."*.
* **Quy tắc CSS bắt buộc:**
  ```css
  @media (max-width: 768px) {
    .mobile-kanban-nav {
      display: flex;
      gap: 4px;
      width: 100%;
      margin-bottom: 10px;
      padding-bottom: 0;
      overflow-x: hidden; /* Không scroll ngang, chia đều 4 cột */
    }
    .kanban-tab-btn {
      flex: 1 1 0;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      padding: 7px 2px;
      font-size: 11px;
      font-weight: 600;
      text-align: center;
      border-radius: 8px;
    }
  }
  ```

---

### 4. Vùng An Toàn Đáy & Nút Nổi Trợ Lý AI (Safe Area Protection)
* **Vấn đề thường gặp:** Nút nổi Chatbot AI (`.ai-launcher-btn`) đè trực tiếp lên chân các thẻ công việc (Task Cards) ở cuối trang làm người dùng không đọc được nội dung và không ấn được nút xem chi tiết.
* **Quy tắc CSS bắt buộc:**
  ```css
  @media (max-width: 768px) {
    /* Khoảng đệm đáy màn hình để thẻ việc cuộn vượt qua nút AI */
    .content-area {
      padding: 10px 10px 84px !important;
    }
    /* Khoảng đệm đáy bên trong từng cột Kanban */
    .kanban-cards {
      padding-bottom: 72px !important;
    }
    /* Toast thông báo đẩy lên cao phía trên nút AI */
    .toast-container {
      left: 8px;
      right: 8px;
      bottom: 76px !important;
    }
  }
  @media (max-width: 480px) {
    /* Thu nhỏ nút AI trên màn hình nhỏ vừa vặn ngón cái */
    .work-smart-ai-widget {
      bottom: 14px;
      right: 14px;
    }
    .ai-launcher-btn {
      width: 48px;
      height: 48px;
    }
    .ai-launcher-btn svg.ai-icon-robot {
      width: 22px;
      height: 22px;
    }
  }
  ```

---

### 5. Cửa Sổ Modal Trên Di Động (Bottom Sheet Pattern)
* Mọi modal trên điện thoại chuyển đổi thành Bottom Sheet trượt từ dưới lên:
  ```css
  @media (max-width: 768px) {
    .modal-overlay {
      padding: 8px;
      align-items: flex-end;
    }
    .modal-content {
      max-height: 92vh;
      max-height: 92dvh;
      border-radius: var(--radius-md) var(--radius-md) 0 0;
      width: 100%;
    }
  }
  ```

---

## 🧪 Quy Trình Kiểm Thử Giao Diện Di Động (Mobile QA Checklist)

Mỗi khi phát triển xong tính năng mới, bắt buộc kiểm tra theo ma trận thiết bị sau:

| Thiết bị mô phỏng | Độ phân giải Viewport | Mục tiêu kiểm tra |
| :--- | :--- | :--- |
| **Small Phone (iPhone SE, Galaxy A01)** | `360 x 780` | Tiêu đề Header hiển thị trọn vẹn, 4 tab vừa vặn, không tràn lề. |
| **Standard Phone (iPhone 13/14, Pixel 7)** | `390 x 844` | Khoảng cách chạm nút $\ge 44\text{px}$, thẻ KPI span 2 cân đối. |
| **Large Phone (Galaxy S23+, iPhone Pro Max)** | `412 x 915` | Thẻ Kanban hiển thị thông thoáng, cuộn đáy vượt qua nút AI. |
| **Portrait Tablet (iPad Mini, Galaxy Tab)** | `768 x 1024` | Sidebar drawer mở đóng trơn tru, không che lấp nội dung chính. |

### Lệnh chạy kiểm thử tự động Headless Browser:
```bash
node scratch/verify_mobile_ui.js
```
*Điều kiện PASS:*
- `inspection.title.isClipped === false`
- `inspection.kpiGrid.card5GridColumn === "1 / -1"`
- `inspection.kanbanTabs.every(tab => tab.scrollWidth <= tab.width)`
- `inspection.contentArea.paddingBottom >= "84px"`
