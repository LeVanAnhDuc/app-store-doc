import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { AdminLocaleRow } from "@/server/content/queries";
import { LocaleTable, type LocaleTableProps } from "./LocaleTable";

/**
 * `LocaleTable` gọi `router.refresh()` sau mỗi lần ghi thành công — bảng phải
 * hiện đúng thứ tự máy chủ vừa nhận, chứ không phải thứ tự chỉ có ở trình duyệt.
 * Test không mount App Router nào nên thay bằng bản giả.
 */
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

/**
 * Bảng này lấy nhãn qua `useTranslations` (cùng lối `AppsTable`), không qua prop
 * — nó là component của đúng một trang, không phải mảnh dùng lại. Ở test thì
 * không có `NextIntlClientProvider`, nên `t` được thay bằng bản trả về chính
 * khoá kèm tham số: `admin.locales.orderUp|en`. Nhờ vậy khẳng định nói rõ nút
 * nào của dòng nào, thay vì trùng tên giữa mười dòng.
 */
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}|${Object.values(values).join(",")}` : key,
}));

const rows: AdminLocaleRow[] = [
  { code: "vi", label: "Tiếng Việt", enabled: true, isDefault: true, order: 0, routed: true },
  { code: "en", label: "English", enabled: true, isDefault: false, order: 1, routed: true },
  { code: "ja", label: "日本語", enabled: false, isDefault: false, order: 2, routed: false },
];

function renderTable(overrides: Partial<LocaleTableProps> = {}) {
  const reorder = vi.fn().mockResolvedValue(undefined);
  const setEnabled = vi.fn().mockResolvedValue(undefined);
  const setDefault = vi.fn().mockResolvedValue(undefined);

  render(
    <LocaleTable
      rows={rows}
      setEnabled={setEnabled}
      setDefault={setDefault}
      reorder={reorder}
      {...overrides}
    />,
  );

  return { reorder, setEnabled, setDefault };
}

/** Mã ngôn ngữ theo đúng thứ tự đang hiện trên bảng. */
function codesOnScreen(): string[] {
  return screen
    .getAllByRole("row")
    .slice(1) // bỏ hàng tiêu đề
    .map((row) => row.querySelectorAll("td")[1].textContent ?? "");
}

describe("LocaleTable — thứ tự", () => {
  beforeEach(() => {
    refresh.mockClear();
  });

  it("gửi lên **cả** danh sách mã theo thứ tự mới, không gửi riêng mã vừa bấm", async () => {
    const { reorder } = renderTable();

    fireEvent.click(screen.getByLabelText("admin.locales.orderUp|ja"));

    await waitFor(() => expect(reorder).toHaveBeenCalledTimes(1));
    // Tầng ghi đòi danh sách đầy đủ: gửi thiếu một mã là hai ngôn ngữ cùng `order`.
    expect(reorder).toHaveBeenCalledWith({ codes: ["vi", "ja", "en"] });
  });

  it('"đưa lên đầu" đẩy cả khối ở giữa xuống một bậc, không hoán đổi hai ô', async () => {
    const { reorder } = renderTable();

    fireEvent.click(screen.getByLabelText("admin.locales.orderTop|ja"));

    await waitFor(() => expect(reorder).toHaveBeenCalledTimes(1));
    expect(reorder).toHaveBeenCalledWith({ codes: ["ja", "vi", "en"] });
  });

  it("bảng nhảy ngay khi bấm chứ không đợi máy chủ, rồi mới gọi refresh", async () => {
    renderTable();

    fireEvent.click(screen.getByLabelText("admin.locales.orderBottom|vi"));

    expect(codesOnScreen()).toEqual(["en", "ja", "vi"]);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("hai đầu danh sách không đi tiếp được — nút mờ là `disabled` thật", () => {
    renderTable();

    expect(screen.getByLabelText("admin.locales.orderUp|vi")).toBeDisabled();
    expect(screen.getByLabelText("admin.locales.orderTop|vi")).toBeDisabled();
    expect(screen.getByLabelText("admin.locales.orderDown|ja")).toBeDisabled();
    expect(screen.getByLabelText("admin.locales.orderBottom|ja")).toBeDisabled();
  });

  it("dòng mặc định và dòng đang tắt vẫn sắp lại được — thứ tự không phải bất biến §6.4", () => {
    renderTable();

    // `vi` là mặc định, `ja` đang tắt: cả hai vẫn còn đường đi trong danh sách.
    expect(screen.getByLabelText("admin.locales.orderDown|vi")).toBeEnabled();
    expect(screen.getByLabelText("admin.locales.orderUp|ja")).toBeEnabled();
  });

  it("ghi đổ thì thứ tự thật quay lại ở lượt dữ liệu kế tiếp, và lý do hiện ra nguyên văn", async () => {
    const reorder = vi.fn().mockRejectedValue(new Error("Cơ sở dữ liệu có 4 ngôn ngữ."));
    renderTable({ reorder });

    fireEvent.click(screen.getByLabelText("admin.locales.orderUp|en"));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "admin.locales.failed|Cơ sở dữ liệu có 4 ngôn ngữ.",
      ),
    );
    // Không `router.refresh()` khi ghi đổ: đó là đường trả lại thứ tự thật, và
    // gọi nó ở đây sẽ xoá mất câu lỗi trước khi người dùng kịp đọc.
    expect(refresh).not.toHaveBeenCalled();
  });
});
