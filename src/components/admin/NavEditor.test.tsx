import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  NavEditor,
  type NavEditorLabels,
  type NavEditorNode,
  type NavEditorProps,
} from "./NavEditor";

/**
 * `NavEditor` gọi `router.refresh()` sau mỗi lần ghi thành công — trình soạn phải
 * thấy đúng cây nó vừa ghi, và cây tới từ máy chủ chứ không từ state phía trình
 * duyệt. Ở test thì không có App Router nào được mount, nên thay bằng bản giả.
 */
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

/**
 * Nhãn truyền qua prop, **không** `useTranslations`: component phải render được
 * trần, không cần `NextIntlClientProvider`. Cùng lối `AppCard`, `AppHero`,
 * `OrderControls`. Giá trị dưới đây chép từ `vi.json` để test đọc được như
 * người dùng thấy.
 */
const labels: NavEditorLabels = {
  rootBandTitle: "Dải tab trên cùng · nút gốc",
  rootBandHint: "Thứ tự ở đây là thứ tự tab trái sang phải.",
  addRoot: "Thêm mục gốc",
  addChild: 'Thêm con vào "{name}"',
  dropToRoot: "Thả vào đây để mục thành tab trên cùng",
  drag: "Kéo để chuyển chỗ",
  select: "Chọn {name}",
  edit: "Sửa",
  remove: "Xoá",
  removeHint: "Chỉ gỡ mục khỏi điều hướng; nội dung vẫn còn.",
  order: {
    top: "Đưa lên đầu",
    up: "Lên một bậc",
    down: "Xuống một bậc",
    bottom: "Đưa xuống cuối",
  },
  kindContainer: "Chứa",
  kindApp: "Ứng dụng",
  kindDoc: "Tài liệu",
  childCountOne: "1 con",
  childCountOther: "{count} con",
  emptyContainer: "0 con · chưa publish được",
  noLabel: "Chưa có tên",
  panelEmpty: "Chọn một mục trong cây để xem và sửa thuộc tính của nó.",
  fieldKind: "Loại nút",
  fieldName: "Tên hiển thị · {locale}",
  fieldNameReadOnly: "Tên hiển thị",
  fieldNameHint: "Tên của lá lấy từ chính bản ghi nội dung, sửa ở mục Ứng dụng hoặc Trang hướng dẫn.",
  fieldContent: "Nội dung",
  fieldStatus: "Trạng thái",
  fieldParent: "Nút cha",
  parentRoot: "— nút gốc (dải tab) —",
  fieldOrder: "Thứ tự trong cùng cấp",
  statusDraft: "Nháp",
  statusPublished: "Công khai",
  statusArchived: "Lưu trữ",
  lockTitle: "Vì sao không có ô nội dung",
  lockBody:
    "Nút chứa chỉ làm nhiệm vụ mở đóng nên nó không mang nội dung. Muốn nhánh này có trang giới thiệu thì thêm một nút Tài liệu tên “Tổng quan” làm con đầu tiên.",
  save: "Lưu",
  saved: "Đã lưu",
  failed: "Chưa lưu được. {reason}",
  created: "Đã thêm mục",
  removed: "Đã gỡ mục khỏi điều hướng",
  moved: "Đã chuyển chỗ",
  reordered: "Đã đổi thứ tự",
  newTitle: "Mục mới",
  newKind: "Loại nút",
  newName: "Tên hiển thị",
  newContent: "Nội dung",
  newContentEmpty: "Không còn nội dung nào chưa gắn vào cây.",
  create: "Thêm",
  cancel: "Huỷ",
  unlinkedTitle: "Chưa có trong điều hướng",
  unlinkedHint:
    "Những mục dưới đây không nằm trong cây nên không có đường vào từ dải tab hay sidebar.",
  unlinkedEmpty: "Mọi ứng dụng và trang hướng dẫn đều đã có chỗ trong cây.",
  unlinkedApps: "Ứng dụng",
  unlinkedDocs: "Trang hướng dẫn",
};

const locales = [
  { code: "vi", label: "Tiếng Việt", isDefault: true },
  { code: "en", label: "English", isDefault: false },
];

/**
 * Cây mẫu: hai tab gốc, một nhánh sâu ba tầng, và một nút chứa rỗng — đúng ba
 * tình huống mà trình soạn phải nói ra được.
 */
const nodes: NavEditorNode[] = [
  {
    id: "r-eco",
    parentId: null,
    kind: "CONTAINER",
    status: "PUBLISHED",
    label: "Hệ sinh thái",
    labels: { vi: "Hệ sinh thái", en: "Ecosystem" },
    href: null,
  },
  {
    id: "d-overview",
    parentId: "r-eco",
    kind: "DOC",
    status: "PUBLISHED",
    label: "Tổng quan",
    labels: { vi: "Tổng quan" },
    href: "/vi/docs/tong-quan",
  },
  {
    id: "r-apps",
    parentId: null,
    kind: "CONTAINER",
    status: "PUBLISHED",
    label: "Ứng dụng",
    labels: { vi: "Ứng dụng", en: "Apps" },
    href: null,
  },
  {
    id: "c-core",
    parentId: "r-apps",
    kind: "CONTAINER",
    status: "PUBLISHED",
    label: "Lõi",
    labels: { vi: "Lõi" },
    href: null,
  },
  {
    id: "a-store",
    parentId: "c-core",
    kind: "APP",
    status: "PUBLISHED",
    label: "Web Store Apps",
    labels: { vi: "Web Store Apps" },
    href: "/vi/apps/web-store-apps",
  },
  {
    id: "c-retired",
    parentId: "r-apps",
    kind: "CONTAINER",
    status: "DRAFT",
    label: "Đã ngừng",
    labels: { vi: "Đã ngừng" },
    href: null,
  },
];

const unlinked = {
  apps: [{ slug: "app-manage-gym", name: "Manage Gym" }],
  docs: [{ slug: "tich-hop-oauth", title: "Tích hợp OAuth" }],
};

function setup(overrides: Partial<NavEditorProps> = {}) {
  const actions = {
    createNode: vi.fn().mockResolvedValue({ id: "moi" }),
    updateNode: vi.fn().mockResolvedValue({ id: "r-apps" }),
    deleteNode: vi.fn().mockResolvedValue(undefined),
    moveNode: vi.fn().mockResolvedValue(undefined),
    reorderNodes: vi.fn().mockResolvedValue(undefined),
  };

  const view = render(
    <NavEditor
      nodes={nodes}
      locales={locales}
      unlinked={unlinked}
      labels={labels}
      {...actions}
      {...overrides}
    />,
  );

  return { ...view, ...actions };
}

/** Hàng của một nút — mỗi hàng đánh dấu bằng `data-nav-row` để không bắt cả nhánh con. */
function row(id: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(`[data-nav-row="${id}"]`);
  if (!found) throw new Error(`Không thấy hàng của nút "${id}"`);
  return found;
}

/** Chọn một nút bằng cách bấm tên nó, đúng như người dùng làm. */
function selectNode(id: string, name: string) {
  fireEvent.click(within(row(id)).getByRole("button", { name: `Chọn ${name}` }));
}

beforeEach(() => {
  refresh.mockClear();
});

describe("NavEditor", () => {
  it("nút gốc hiển thị dưới nhãn dải tab", () => {
    setup();

    expect(screen.getByText(/dải tab/i)).toBeInTheDocument();

    // Hai nút gốc nằm trong danh sách gốc, con cháu thì không.
    const band = document.querySelector<HTMLElement>("[data-nav-root-list]");
    expect(band).not.toBeNull();
    const roots = band!.querySelectorAll(":scope > li > [data-nav-row]");
    expect([...roots].map((node) => node.getAttribute("data-nav-row"))).toEqual([
      "r-eco",
      "r-apps",
    ]);
  });

  it("chọn nút chứa thì bảng thuộc tính KHÔNG có ô nội dung", () => {
    setup();
    selectNode("r-apps", "Ứng dụng");

    expect(screen.queryByLabelText(/nội dung/i)).toBeNull();
    // Nhưng vẫn có ô tên cho từng ngôn ngữ — nút chứa chỉ thiếu đúng ô nội dung.
    expect(screen.getByLabelText("Tên hiển thị · Tiếng Việt")).toHaveValue("Ứng dụng");
    expect(screen.getByLabelText("Tên hiển thị · English")).toHaveValue("Apps");
  });

  it("bảng thuộc tính giải thích tại chỗ vì sao không có ô nội dung", () => {
    setup();
    selectNode("r-apps", "Ứng dụng");

    expect(screen.getByText(/vì sao không có ô nội dung/i)).toBeInTheDocument();
    expect(screen.getByText(/chỉ làm nhiệm vụ mở đóng/i)).toBeInTheDocument();
    // Và nói luôn cách xử lý, không chỉ nói "không được".
    expect(screen.getByText(/tổng quan/i)).toBeInTheDocument();
  });

  it("chọn nút lá thì bảng thuộc tính CÓ ô nội dung — nếu không, phép kiểm trên vô nghĩa", () => {
    setup();
    selectNode("a-store", "Web Store Apps");

    expect(screen.getByLabelText("Nội dung")).toHaveValue("/vi/apps/web-store-apps");
    expect(screen.queryByText(/vì sao không có ô nội dung/i)).toBeNull();
  });

  it("mỗi hàng có bộ bốn nút thứ tự", () => {
    setup();

    for (const id of ["r-eco", "r-apps", "c-core", "a-store", "c-retired", "d-overview"]) {
      const scope = within(row(id));
      for (const name of Object.values(labels.order)) {
        expect(scope.getByRole("button", { name }), `${id} · ${name}`).toBeInTheDocument();
      }
    }
  });

  it("bộ nút thứ tự mờ ở hai đầu, và bấm gọi reorderNodes với danh sách anh em mới", async () => {
    const { reorderNodes } = setup();

    // "Lõi" là con đầu của r-apps: không lên được nữa.
    expect(within(row("c-core")).getByRole("button", { name: labels.order.up })).toBeDisabled();

    fireEvent.click(within(row("c-core")).getByRole("button", { name: labels.order.bottom }));

    await waitFor(() =>
      expect(reorderNodes).toHaveBeenCalledWith({
        parentId: "r-apps",
        ids: ["c-retired", "c-core"],
      }),
    );
  });

  it("lồng sâu tuỳ ý: lá ở tầng ba nằm trong danh sách con của tầng hai", () => {
    setup();

    const nested = row("c-core").parentElement!.querySelector<HTMLElement>(
      '[data-nav-row="a-store"]',
    );
    expect(nested).not.toBeNull();
  });

  it("nút chứa rỗng có dấu hiệu nhìn thấy được", () => {
    setup();

    expect(within(row("c-retired")).getByText(labels.emptyContainer)).toBeInTheDocument();
    // Nút chứa còn con thì hiện số con, không hiện cảnh báo.
    expect(within(row("c-core")).getByText("1 con")).toBeInTheDocument();
    expect(within(row("c-core")).queryByText(labels.emptyContainer)).toBeNull();
  });

  it("nút chưa publish có huy hiệu trạng thái, nút đã publish thì không", () => {
    setup();

    // "Đã ngừng" là nút duy nhất đang DRAFT trong cây mẫu. Không có huy hiệu thì
    // nó trông y hệt nút đã publish, và người vận hành không hiểu vì sao nó
    // không xuất hiện trên trang công khai.
    expect(within(row("c-retired")).getByText(labels.statusDraft)).toBeInTheDocument();

    // Đã publish là trường hợp thường: gắn nhãn cho nó chỉ làm hàng dài thêm.
    for (const id of ["r-eco", "r-apps", "c-core", "a-store", "d-overview"]) {
      const scope = within(row(id));
      expect(scope.queryByText(labels.statusDraft), id).toBeNull();
      expect(scope.queryByText(labels.statusPublished), id).toBeNull();
      expect(scope.queryByText(labels.statusArchived), id).toBeNull();
    }
  });

  it("lỗi từ tầng ghi nổi lên tận giao diện, không bị bắt im", async () => {
    const updateNode = vi
      .fn()
      .mockRejectedValue(new Error("Nút chứa rỗng thì không publish được."));
    setup({ updateNode });

    selectNode("c-retired", "Đã ngừng");
    fireEvent.change(screen.getByLabelText(labels.fieldStatus), {
      target: { value: "PUBLISHED" },
    });
    fireEvent.click(screen.getByRole("button", { name: labels.save }));

    await waitFor(() =>
      expect(screen.getByText(/Nút chứa rỗng thì không publish được\./)).toBeInTheDocument(),
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("lưu nút chứa gửi trạng thái và nhãn từng ngôn ngữ", async () => {
    const { updateNode } = setup();

    selectNode("r-apps", "Ứng dụng");
    fireEvent.change(screen.getByLabelText("Tên hiển thị · English"), {
      target: { value: "Applications" },
    });
    fireEvent.click(screen.getByRole("button", { name: labels.save }));

    await waitFor(() =>
      expect(updateNode).toHaveBeenCalledWith({
        id: "r-apps",
        status: "PUBLISHED",
        labels: [
          { locale: "vi", label: "Ứng dụng" },
          { locale: "en", label: "Applications" },
        ],
      }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("đổi nút cha trong bảng thuộc tính gọi moveNode — đường bàn phím của việc kéo thả", async () => {
    const { moveNode } = setup();

    selectNode("c-core", "Lõi");
    fireEvent.change(screen.getByLabelText(labels.fieldParent), { target: { value: "r-eco" } });

    await waitFor(() =>
      expect(moveNode).toHaveBeenCalledWith({ id: "c-core", parentId: "r-eco", index: 1 }),
    );
  });

  it("không đưa được một nút vào chính hậu duệ của nó — hậu duệ không có trong danh sách cha", () => {
    setup();
    selectNode("r-apps", "Ứng dụng");

    const options = [...within(screen.getByLabelText(labels.fieldParent)).getAllByRole("option")].map(
      (option) => (option as HTMLOptionElement).value,
    );
    expect(options).toContain("");
    expect(options).toContain("r-eco");
    expect(options).not.toContain("r-apps");
    expect(options).not.toContain("c-core");
  });

  it("kéo một mục từ dưới lên khối gốc thì nó thành tab", async () => {
    const { moveNode } = setup();

    fireEvent.dragStart(row("a-store").querySelector("[data-nav-grip]")!);
    fireEvent.drop(document.querySelector("[data-nav-root-zone]")!);

    await waitFor(() =>
      expect(moveNode).toHaveBeenCalledWith({ id: "a-store", parentId: null, index: 2 }),
    );
  });

  it("thêm con vào một nút chứa gửi đúng nút cha", async () => {
    const { createNode } = setup();

    fireEvent.click(screen.getByRole("button", { name: 'Thêm con vào "Lõi"' }));
    fireEvent.change(screen.getByLabelText(labels.newName), { target: { value: "Tổng quan" } });
    fireEvent.click(screen.getByRole("button", { name: labels.create }));

    await waitFor(() =>
      expect(createNode).toHaveBeenCalledWith({
        parentId: "c-core",
        kind: "CONTAINER",
        labels: [{ locale: "vi", label: "Tổng quan" }],
      }),
    );
  });

  it("thêm một lá thì chọn nội dung từ danh sách chưa gắn vào cây", async () => {
    const { createNode } = setup();

    fireEvent.click(screen.getByRole("button", { name: labels.addRoot }));
    fireEvent.change(screen.getByLabelText(labels.newKind), { target: { value: "APP" } });
    fireEvent.change(screen.getByLabelText(labels.newContent), {
      target: { value: "app-manage-gym" },
    });
    fireEvent.click(screen.getByRole("button", { name: labels.create }));

    await waitFor(() =>
      expect(createNode).toHaveBeenCalledWith({
        parentId: null,
        kind: "APP",
        appSlug: "app-manage-gym",
      }),
    );
  });

  it("cảnh báo nội dung chưa gắn vào cây, kèm tên hiển thị chứ không phải slug", () => {
    setup();

    expect(screen.getByText(labels.unlinkedTitle)).toBeInTheDocument();
    expect(screen.getByText("Manage Gym")).toBeInTheDocument();
    expect(screen.getByText("Tích hợp OAuth")).toBeInTheDocument();
  });

  it("không còn nội dung lạc thì nói đúng như vậy, không hiện khối trống", () => {
    setup({ unlinked: { apps: [], docs: [] } });

    expect(screen.getByText(labels.unlinkedEmpty)).toBeInTheDocument();
  });

  it("xoá một hàng gọi deleteNode", async () => {
    const { deleteNode } = setup();

    fireEvent.click(within(row("d-overview")).getByRole("button", { name: labels.remove }));

    await waitFor(() => expect(deleteNode).toHaveBeenCalledWith({ id: "d-overview" }));
  });

  it("không viết mã màu trực tiếp — mọi màu qua biến CSS", () => {
    const { container } = setup();
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{6}/i);
  });

  it("không dùng emoji làm ký hiệu hành động — design-rules §5", () => {
    const { container } = setup();
    expect(container.textContent ?? "").not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u);
  });
});
