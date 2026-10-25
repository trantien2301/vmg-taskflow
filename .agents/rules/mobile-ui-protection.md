# TaskFlow Pro - Mobile UI Protection Rule (Bảo Vệ Giao Diện Di Động)

Mọi tính năng mới, giao diện mới (Views), bảng (Tables/Kanban), lưới thẻ (Grids), thanh điều hướng (Navigation), biểu mẫu (Forms) hay cửa sổ thông báo (Modals/Toasts) khi được thêm mới hoặc chỉnh sửa trong TaskFlow Pro **BẮT BUỘC** phải tuân thủ nghiêm ngặt các quy tắc bảo vệ giao diện di động (Mobile-First Protection) sau:

---

## 1. NGUYÊN TẮC "ZERO TEXT CLIPPING" (TUYỆT ĐỐI KHÔNG KHUẤT CHỮ)
* **Tiêu đề thanh Header (`.current-view-title`):**
  * Luôn nằm trong container có `min-width: 0; flex: 1; overflow: hidden;`.
  * Thẻ chữ tiêu đề `span` bên trong phải có `overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;`.
  * Trên màn hình di động ($\le 600\text{px}$), ẩn icon vector thừa bên cạnh tiêu đề (`.current-view-title svg { display: none !important; }`) để dành 100% diện tích cho văn bản tiêu đề.
  * Tuyệt đối không dùng `max-width` cố định nhỏ (như `max-width: 105px`) trên container tiêu đề di động.
* **Huy hiệu trực tuyến (`.realtime-status-pill`):**
  * Trên màn hình $\le 480\text{px}$, chỉ hiển thị chấm xanh và số lượng trực tuyến (ví dụ: `● 1`), ẩn chữ `"online"` để tránh lấn chiếm diện tích của tiêu đề Header.

---

## 2. NGUYÊN TẮC LƯỚI ĐỐI XỨNG CÂN BẰNG (BALANCED GRIDS)
* **Lưới chỉ số KPI (`.kpi-grid`):**
  * Trên màn hình di động ($\le 768\text{px}$), lưới được chia theo 2 cột: `grid-template-columns: repeat(2, 1fr);`.
  * Khi số lượng thẻ lẻ (ví dụ 5 thẻ), thẻ cuối cùng bắt buộc phải trải rộng cả 2 cột:
    ```css
    .kpi-card:last-child,
    .kpi-card:nth-child(5) {
      grid-column: 1 / -1 !important;
    }
    ```
  * Tuyệt đối không để xảy ra tình trạng thẻ thứ 5 nằm ở cột 1 và để trống hoàn toàn cột 2.

---

## 3. THANH ĐIỀU HƯỚNG TAB ĐỐI XỨNG (PROPORTIONAL EQUAL TABS)
* **Tab Kanban (`.mobile-kanban-nav`):**
  * 4 Tab giai đoạn (`Cần Làm`, `Đang Làm`, `Duyệt`, `Xong`) phải chia đều 25% chiều rộng (`flex: 1 1 0; min-width: 0;`).
  * Tuyệt đối không để tab thứ 4 tràn ra ngoài cạnh phải màn hình hoặc bị cắt cụt chữ.
  * Văn bản tab phải có `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` kèm padding gọn gàng (`padding: 7px 2px; font-size: 11px;`).

---

## 4. VÙNG AN TOÀN ĐÁY & CHỐNG CHE NÚT TRỢ LÝ AI (SAFE AREA SCROLL PADDING)
* Nút Trợ lý Work Smart AI (`.ai-launcher-btn`) là nút nổi (FAB) cố định tại góc dưới phải màn hình.
* Mọi thành phần cuộn trang trên di động **BẮT BUỘC** phải có khoảng đệm cuộn đáy (Safe Area Scroll Padding) an toàn:
  * `.content-area`: `padding: 10px 10px 84px !important;`
  * `.kanban-cards`: `padding-bottom: 72px !important;`
* **Tuyệt đối không** để nội dung thẻ công việc cuối cùng bị nút Trợ lý AI che lấp khi người dùng cuộn đến đáy trang.
* **Thông báo Toast (`.toast-container`):** Đặt tại `bottom: 76px !important;` trên di động để hiển thị gọn gàng phía trên nút AI, không va chạm hoặc che mất nút mở chatbot.

---

## 5. ERGONOMICS & VÙNG CHẠM NGÓN TAY (TOUCH TARGETS)
* Mọi nút bấm, icon bấm, menu toggle trên điện thoại di động phải đạt kích thước vùng chạm tối thiểu $\ge 44\text{px} \times 44\text{px}$ (theo chuẩn Apple Human Interface & Google Material Guidelines).
* Nút nổi Trợ lý AI trên di động ($\le 480\text{px}$) chuẩn hóa ở kích thước `48px x 48px` và đặt cách mép đáy/phải `14px`.

---

## 6. QUY TRÌNH KIỂM THỬ BẮT BUỘC TRƯỚC KHI COMMIT (PRE-COMMIT VERIFICATION)
Mọi thay đổi CSS hoặc tính năng mới có ảnh hưởng đến giao diện phải được kiểm tra trực quan trên trình duyệt mô phỏng Viewport di động `360x780` qua script:
```bash
node scratch/verify_mobile_ui.js
```
Chỉ được commit và phát hành khi 100% các tiêu chí sau đạt:
1. `isClipped === false` (Tiêu đề không bị cắt cụt).
2. `card5GridColumn === "1 / -1"` (Thẻ KPI 5 trải rộng cân bằng).
3. Các tab Kanban vừa vặn trong màn hình (`scrollWidth <= width`).
4. Vùng an toàn cuộn đáy $\ge 84\text{px}$.
