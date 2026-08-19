import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { NavDrawer } from "./NavDrawer";

const nodes = [
  {
    id: "sat",
    kind: "CONTAINER" as const,
    label: "Vệ tinh",
    href: null,
    isFallback: false,
    children: [
      {
        id: "a",
        kind: "APP" as const,
        label: "Match CV",
        href: "/vi/apps/match-cv",
        isFallback: false,
        children: [],
      },
    ],
  },
];

/** Nhãn mặc định tiếng Việt, đúng như component tự đặt khi nơi gọi không truyền. */
const OPEN_LABEL = "Điều hướng tài liệu";

function renderDrawer() {
  return render(<NavDrawer nodes={nodes} activeHref="/vi/apps/match-cv" />);
}

/** Nút `☰` — lấy theo nhãn chứ không theo lớp CSS. */
function trigger() {
  return screen.getByRole("button", { name: new RegExp(OPEN_LABEL) });
}

describe("NavDrawer", () => {
  it("khi đóng thì chỉ có nút mở, không có hộp thoại nào che nội dung", () => {
    renderDrawer();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).toBeNull();
    // Cây chưa dựng: đóng mà vẫn có liên kết nghĩa là nó đang nằm đâu đó trong trang.
    expect(screen.queryByRole("link", { name: "Match CV" })).toBeNull();
  });

  it("bấm nút mở thì ngăn kéo hiện ra, và cây bên trong là NavTree thật", () => {
    renderDrawer();
    fireEvent.click(trigger());

    const dialog = screen.getByRole("dialog", { name: OPEN_LABEL });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(trigger()).toHaveAttribute("aria-expanded", "true");

    // Nút chứa là <button> toggle và nút lá là <a> — đúng hợp đồng của NavTree,
    // nên đây là cây thật chứ không phải một danh sách chép tay.
    expect(screen.getByRole("button", { name: /Vệ tinh/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("link", { name: "Match CV" })).toHaveAttribute(
      "href",
      "/vi/apps/match-cv",
    );
  });

  it("Esc đóng ngăn kéo", () => {
    renderDrawer();
    fireEvent.click(trigger());
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("bấm ra ngoài đóng ngăn kéo", () => {
    const { container } = renderDrawer();
    fireEvent.click(trigger());

    // Lớp phủ là cha của panel; bấm đúng vào nó mới đóng.
    const overlay = screen.getByRole("dialog").parentElement!;
    fireEvent.mouseDown(overlay);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(container.querySelector("[role=dialog]")).toBeNull();
  });

  it("bấm TRONG panel thì KHÔNG đóng — nếu không thì mở nhánh nào cũng sập ngăn kéo", () => {
    renderDrawer();
    fireEvent.click(trigger());
    fireEvent.mouseDown(screen.getByRole("dialog"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("đóng bằng Esc thì tiêu điểm trở về nút mở", () => {
    renderDrawer();
    const button = trigger();
    fireEvent.click(button);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(document.activeElement).toBe(button);
  });

  it("đóng bằng nút Đóng thì tiêu điểm cũng trở về nút mở", () => {
    renderDrawer();
    const button = trigger();
    fireEvent.click(button);
    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
    expect(document.activeElement).toBe(button);
  });

  it("mở tới đâu tiêu điểm tới đó — nút Đóng nhận tiêu điểm ngay", () => {
    renderDrawer();
    fireEvent.click(trigger());
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Đóng" }));
  });

  it("bẫy tiêu điểm: Tab ở phần tử cuối vòng về phần tử đầu", () => {
    renderDrawer();
    fireEvent.click(trigger());

    const dialog = screen.getByRole("dialog");
    const focusables = [...dialog.querySelectorAll<HTMLElement>("a[href], button")];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    expect(first).not.toBe(last);

    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(first);
  });

  it("bẫy tiêu điểm: Shift+Tab ở phần tử đầu vòng về phần tử cuối", () => {
    renderDrawer();
    fireEvent.click(trigger());

    const dialog = screen.getByRole("dialog");
    const focusables = [...dialog.querySelectorAll<HTMLElement>("a[href], button")];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    first.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("Tab ở giữa vòng thì để trình duyệt tự đi, không cướp tiêu điểm", () => {
    renderDrawer();
    fireEvent.click(trigger());

    const dialog = screen.getByRole("dialog");
    const focusables = [...dialog.querySelectorAll<HTMLElement>("a[href], button")];
    const middle = focusables[1];
    middle.focus();

    const handled = fireEvent.keyDown(dialog, { key: "Tab" });
    // `fireEvent` trả false khi preventDefault đã được gọi.
    expect(handled).toBe(true);
    expect(document.activeElement).toBe(middle);
  });

  it("ký hiệu là ☰ chứ không phải emoji (design-rules §5)", () => {
    renderDrawer();
    expect(trigger().textContent).toContain("☰");
    // Dải emoji cơ bản: không ký tự nào của nút được rơi vào đó.
    expect(trigger().textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it("nhận nhãn qua prop, không tự dịch bên trong", () => {
    render(
      <NavDrawer
        nodes={nodes}
        activeHref="/vi/apps/match-cv"
        labels={{ open: "Documentation navigation", close: "Close" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Documentation navigation/ }));
    expect(screen.getByRole("dialog", { name: "Documentation navigation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("không nút nào thì không dựng cả nút mở", () => {
    const { container } = render(<NavDrawer nodes={[]} activeHref="/vi" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("không viết mã màu trực tiếp", () => {
    const { container } = renderDrawer();
    fireEvent.click(trigger());
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{6}/i);
  });
});
