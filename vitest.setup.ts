// Nạp matcher DOM cho mọi test component.
import "@testing-library/jest-dom/vitest";

import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// `globals: false` nên Testing Library không tự đăng ký được dọn dẹp:
// nó chỉ móc vào `afterEach` khi biến này có sẵn ở phạm vi toàn cục.
// Thiếu dòng dưới, mỗi `render()` cộng dồn vào `document.body` và mọi truy vấn
// qua `screen` ở test thứ hai trở đi sẽ thấy cả DOM của test trước.
afterEach(cleanup);
