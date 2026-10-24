---
name: taskflow-feature-knowledge-sync
description: >-
  Use this skill whenever creating, updating, extending, or refactoring any feature in
  TaskFlow Pro. Enforces the "No Feature Without Guidance" standard: automatically
  synchronizes end-user documentation in the in-app User Guide (view-guide), the offline
  enterprise manual (HUONG_DAN_SU_DUNG_TOAN_DIEN_TASKFLOW_PRO.md), and the Work Smart AI
  chatbot knowledge base (workSmartAI.js) with interactive deep links.
---

# TaskFlow Pro - Feature Documentation & AI Knowledge Sync Skill

Một tính năng chỉ được xem là **Hoàn Thành (Definition of Done)** khi người dùng có thể:
1. Đọc hướng dẫn chi tiết trong Tab **Cẩm Nang Hướng Dẫn Sử Dụng** (`#view-guide`).
2. Hỏi trực tiếp trợ lý **Work Smart AI** và nhận được câu trả lời kèm nút hành động 1-Click (Deep Link).
3. Đọc tóm tắt nâng cấp trong **Lịch Sử Phiên Bản (Changelog)**.

---

## 🔄 Quy Trình Đồng Bộ Tri Thức 4 Bước (Knowledge Sync Runbook)

Khi hoàn thành phần mã nguồn logic & giao diện của một tính năng mới, hãy thực hiện lần lượt 4 bước đồng bộ tri thức sau:

```
[Mã Nguồn Tính Năng Mới Xong]
             │
             ├──► [1. Nạp Tri Thức Cho Work Smart AI (workSmartAI.js)]
             │
             ├──► [2. Bổ Sung Thẻ Cẩm Nang Trong App (view-guide trong index.html)]
             │
             ├──► [3. Cập Nhật Tài Liệu Doanh Nghiệp (HUONG_DAN_SU_DUNG_TOAN_DIEN_*.md)]
             │
             └──► [4. Ghi Nhận Lịch Sử Nâng Cấp Changelog (server.js)]
```

---

### BƯỚC 1: NẠP TRI THỨC CHO CHATBOT WORK SMART AI (`public/js/workSmartAI.js`)

Mở tệp `public/js/workSmartAI.js` và thêm một entry vào đối tượng `WorkSmartAI.knowledge`:

```javascript
// Mẫu entry tri thức chuẩn cho tính năng mới
newFeatureKey: {
  title: 'Tên Tính Năng Mới Chuẩn Hóa',
  keywords: [
    // Bắt buộc có cả từ khóa có dấu và không dấu
    'ten tinh nang', 'tên tính năng', 'tu khoa 1', 'từ khóa 1',
    'viet tat', 'làm sao', 'hướng dẫn', 'cách dùng'
  ],
  answer: `
    <strong>✨ Hướng dẫn sử dụng [Tên Tính Năng]:</strong><br>
    • <strong>Mục đích:</strong> Tóm tắt 1 câu giá trị mang lại cho người dùng.<br>
    • <strong>Cách thao tác:</strong><br>
      1. Bước 1: Điều hướng đến mục...<br>
      2. Bước 2: Bấm nút [Tên Nút]...<br>
      3. Bước 3: Xác nhận...<br>
    • <strong>Lưu ý / Phân quyền:</strong> Chỉ Quản trị viên (Admin) mới có quyền...
  `,
  actions: [
    // Các nút deep link tương tác giúp người dùng mở ngay màn hình đó
    { label: '🚀 Mở tính năng ngay', callback: () => App.switchView('my-view') },
    { label: '⚙️ Mở cửa sổ cấu hình', callback: () => App.openMyModal() }
  ]
}
```

* **Nếu là tính năng quan trọng:** Bổ sung thêm nút Chip gợi ý nhanh trong `renderWidget()`:
  ```html
  <button type="button" class="ai-chip" onclick="WorkSmartAI.askQuick('newFeatureKey')">
    ✨ [Tên Tính Năng Rút Gọn]
  </button>
  ```

---

### BƯỚC 2: CẬP NHẬT TAB CẨM NANG HƯỚNG DẪN TRONG WEB APP (`public/index.html`)

Mở tệp `public/index.html` tại khu vực `<section class="view-panel" id="view-guide">`:

1. **Cập nhật Mục lục Sidebar (`.guide-toc-sidebar`):**
   ```html
   <a href="#guide-new-feature" class="guide-toc-link">
     <span class="guide-toc-icon">✨</span>
     <span>[Tên Tính Năng]</span>
   </a>
   ```

2. **Thêm Thẻ Hướng Dẫn Mới (`.guide-card`):**
   ```html
   <div class="guide-card" id="guide-new-feature" data-role="all" data-category="features">
     <div class="guide-card-header">
       <div class="guide-card-icon-wrap cyan">
         <span class="guide-card-icon">✨</span>
       </div>
       <div class="guide-card-header-text">
         <div class="guide-card-badge-row">
           <span class="badge-role-pill admin">👑 Quản Trị Viên</span>
           <span class="badge-role-pill member">👤 Nhân Viên</span>
         </div>
         <h3 class="guide-card-title">Hướng Dẫn [Tên Tính Năng]</h3>
       </div>
     </div>

     <div class="guide-card-body">
       <p class="guide-card-desc">
         Mô tả chi tiết mục đích, ý nghĩa và cách vận hành của tính năng trong luồng công việc doanh nghiệp.
       </p>

       <div class="guide-steps-list">
         <div class="guide-step-item">
           <div class="guide-step-num">1</div>
           <div class="guide-step-content">
             <strong>Bước 1:</strong> Truy cập vào màn hình...
           </div>
         </div>
         <div class="guide-step-item">
           <div class="guide-step-num">2</div>
           <div class="guide-step-content">
             <strong>Bước 2:</strong> Thiết lập các trường thông tin...
           </div>
         </div>
       </div>

       <!-- Mẹo / Lưu ý -->
       <div class="guide-callout tip">
         💡 <strong>Mẹo chuyên gia:</strong> Chia sẻ mẹo sử dụng nhanh hoặc phím tắt hữu ích.
       </div>
     </div>
   </div>
   ```

---

### BƯỚC 3: CẬP NHẬT TÀI LIỆU TOÀN DIỆN OFFLINE (`HUONG_DAN_SU_DUNG_TOAN_DIEN_TASKFLOW_PRO.md`)

Mở tệp tài liệu Markdown gốc tại thư mục dự án:
* Thêm chương hoặc mục đánh số mới (ví dụ: `### 8.x. Tính Năng ...`).
* Trình bày rõ ràng:
  * **Tổng quan tính năng**
  * **Đối tượng & Phân quyền áp dụng (RBAC Matrix)**
  * **Kịch bản sử dụng thực tế (Use Case Scenario)**
  * **Các bước thao tác từng bước (Step-by-step)**

---

### BƯỚC 4: GHI NHẬN CHANGELOG NÂNG CẤP (`server.js`)

Mở tệp `server.js` tại API `/api/system/version`:
* Bổ sung mục tóm tắt tính năng vào mảng `changelog`:
  ```javascript
  {
    version: "v3.x.x",
    date: "DD/MM/YYYY",
    title: "Tên Bản Cập Nhật Chứa Tính Năng Mới",
    highlights: [
      "Tính năng mới A: Cho phép người dùng làm gì...",
      "Bảo mật RBAC: Phân quyền chặt chẽ cho vai trò...",
      "Tích hợp Work Smart AI: Trợ lý AI đã được cập nhật tri thức hướng dẫn tức thì"
    ]
  }
  ```

---

### BƯỚC 5: CHECKLIST KIỂM THỬ ĐỒNG BỘ TRI THỨC (Verification Checklist)

| Tiêu chí kiểm thử | Cách kiểm tra | Kết quả đạt |
| :--- | :--- | :---: |
| **Bot Work Smart AI trả lời đúng** | Mở chat bot, gõ từ khóa không dấu hoặc có dấu về tính năng mới. | [ ] |
| **Nút Deep Link trong Bot hoạt động** | Nhấp vào nút `[ Mở tính năng ngay ]` trong câu trả lời của bot, hệ thống chuyển view hoặc mở modal chính xác. | [ ] |
| **Thẻ Cẩm Nang hiển thị đẹp** | Mở tab "Hướng Dẫn Sử Dụng", kiểm tra thẻ mới ở cả Dark Theme và Light Theme. | [ ] |
| **Tìm kiếm trong Cẩm Nang** | Gõ từ khóa vào ô tìm kiếm của tab Guide, thẻ mới được highlight và lọc chính xác. | [ ] |
| **Changelog hiển thị minh bạch** | Bấm vào nút phiên bản ở góc dưới sidebar, modal hiển thị đầy đủ tóm tắt tính năng vừa thêm. | [ ] |
