"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import type { OrderControlsLabels, OrderMove } from "@/components/ui/OrderControls";

import { NavNodeRow, navKindLabel } from "./NavNodeRow";
import styles from "./NavEditor.module.css";

/**
 * Trình soạn cây điều hướng — mockup v3 mục 03.
 *
 * Ba điều quyết định hình dạng của file này:
 *
 * 1. **Nhãn đi qua prop, không `useTranslations`.** Component render được trần,
 *    không cần `NextIntlClientProvider` — cùng lối `AppCard`, `OrderControls`.
 * 2. **Không giữ cây trong state.** `nodes` là nguồn sự thật duy nhất, và mỗi
 *    lần ghi xong thì `router.refresh()` để cây tới từ máy chủ. Giữ thêm một bản
 *    cây ở trình duyệt là mời gọi cảnh "giao diện nói đã chuyển, DB thì chưa".
 * 3. **Lỗi từ tầng ghi nổi lên nguyên văn.** Sáu bất biến của cây (spec §4) được
 *    kiểm trong transaction, không kiểm ở đây. Câu giải thích của tầng ghi —
 *    "nút chứa rỗng thì không publish được" — là thứ người dùng cần đọc, nên
 *    `run()` không bao giờ bắt im một lỗi.
 */

/** Ba loại nút. Viết thẳng để component không phải kéo theo tầng máy chủ. */
export type NavEditorKind = "CONTAINER" | "APP" | "DOC";

export type NavEditorStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

/**
 * Một nút trong cây, đã phẳng.
 *
 * **Thứ tự trong mảng là thứ tự anh em**: lọc theo `parentId` thì được đúng danh
 * sách anh em theo thứ tự hiển thị. Vì vậy không có trường `order` — một con số
 * thứ hai nói cùng một chuyện sớm muộn cũng lệch khỏi mảng.
 */
export type NavEditorNode = {
  id: string;
  parentId: string | null;
  kind: NavEditorKind;
  status: NavEditorStatus;
  /** Nhãn ở ngôn ngữ mặc định — thứ hiện trong cây. Rỗng thì hàng hiện `noLabel`. */
  label: string;
  /** Nhãn theo mã ngôn ngữ; ngôn ngữ chưa dịch thì vắng khoá. */
  labels: Record<string, string>;
  /** Đường của lá, đã có tiền tố ngôn ngữ. `null` với nút chứa. */
  href: string | null;
};

export type NavEditorLocale = { code: string; label: string; isDefault: boolean };

/** Nội dung chưa gắn vào cây — nguồn của khối cảnh báo và của ô chọn nội dung. */
export type NavEditorUnlinked = {
  apps: { slug: string; name: string }[];
  docs: { slug: string; title: string }[];
};

export type NavEditorCreateInput = {
  parentId: string | null;
  kind: NavEditorKind;
  /** Chỉ nút chứa có nhãn tự đặt; lá lấy tên từ chính bản ghi nội dung. */
  labels?: { locale: string; label: string }[];
  appSlug?: string;
  docSlug?: string;
};

export type NavEditorUpdateInput = {
  id: string;
  status: NavEditorStatus;
  labels?: { locale: string; label: string }[];
};

export type NavEditorLabels = {
  /** Nhãn của khối nút gốc. */
  rootBandTitle: string;
  rootBandHint: string;
  addRoot: string;
  /** `{name}` — tên nút cha. */
  addChild: string;
  dropToRoot: string;
  drag: string;
  /** `{name}` — tên nút. */
  select: string;
  edit: string;
  remove: string;
  removeHint: string;
  order: OrderControlsLabels;
  kindContainer: string;
  kindApp: string;
  kindDoc: string;
  childCountOne: string;
  /** `{count}` — số con. */
  childCountOther: string;
  emptyContainer: string;
  noLabel: string;
  panelEmpty: string;
  fieldKind: string;
  /** `{locale}` — tên gọi của ngôn ngữ, không phải mã. */
  fieldName: string;
  fieldNameReadOnly: string;
  fieldNameHint: string;
  fieldContent: string;
  fieldStatus: string;
  fieldParent: string;
  parentRoot: string;
  fieldOrder: string;
  statusDraft: string;
  statusPublished: string;
  statusArchived: string;
  lockTitle: string;
  lockBody: string;
  save: string;
  saved: string;
  /** `{reason}` — nguyên văn lỗi của tầng ghi. */
  failed: string;
  created: string;
  removed: string;
  moved: string;
  reordered: string;
  newTitle: string;
  newKind: string;
  newName: string;
  newContent: string;
  newContentEmpty: string;
  create: string;
  cancel: string;
  unlinkedTitle: string;
  unlinkedHint: string;
  unlinkedEmpty: string;
  unlinkedApps: string;
  unlinkedDocs: string;
};

export type NavEditorProps = {
  nodes: NavEditorNode[];
  /** Ngôn ngữ đang bật; nút chứa có một ô tên cho mỗi ngôn ngữ. */
  locales: NavEditorLocale[];
  unlinked: NavEditorUnlinked;
  labels: NavEditorLabels;
  createNode: (input: NavEditorCreateInput) => Promise<{ id: string }>;
  updateNode: (input: NavEditorUpdateInput) => Promise<{ id: string }>;
  deleteNode: (input: { id: string }) => Promise<void>;
  moveNode: (input: { id: string; parentId: string | null; index: number }) => Promise<void>;
  reorderNodes: (input: { parentId: string | null; ids: string[] }) => Promise<void>;
};

/** Thay `{khoá}` bằng giá trị — đủ cho nhãn của trình soạn, không cần cả next-intl. */
function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    Object.hasOwn(vars, key) ? String(vars[key]) : whole,
  );
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Anh em cùng cha, đúng thứ tự hiển thị (xem chú thích của `NavEditorNode`). */
function siblingsOf(nodes: NavEditorNode[], parentId: string | null): NavEditorNode[] {
  return nodes.filter((node) => node.parentId === parentId);
}

/** Mọi hậu duệ của `id`. Dùng để chặn việc đưa một nút vào bên trong chính nó. */
function descendantIds(nodes: NavEditorNode[], id: string): Set<string> {
  const found = new Set<string>();
  const walk = (parentId: string) => {
    for (const node of nodes) {
      if (node.parentId !== parentId || found.has(node.id)) continue;
      found.add(node.id);
      walk(node.id);
    }
  };
  walk(id);
  return found;
}

function ancestorIds(nodes: NavEditorNode[], id: string): Set<string> {
  const found = new Set<string>();
  let current = nodes.find((node) => node.id === id)?.parentId ?? null;

  while (current !== null && !found.has(current)) {
    found.add(current);
    current = nodes.find((node) => node.id === current)?.parentId ?? null;
  }

  return found;
}

/**
 * Những nút **không** xổ nhánh con ra.
 *
 * Chưa chọn gì thì cả cây mở — người mới vào cần thấy toàn bộ hình dạng. Chọn một
 * mục thì các nhánh không liên quan thu lại: cây thật có 14 mục sâu ba tầng, dài
 * hơn một màn hình, mà bảng thuộc tính ở cột phải phải nhìn được cùng lúc với mục
 * đang sửa. Mở lại một nhánh = chọn một mục trong nhánh đó, nên không cần thêm
 * nút mở/đóng (mockup cũng vẽ `.tr-tw` là `<span>`, không phải nút).
 */
function hiddenBranches(nodes: NavEditorNode[], selectedId: string | null): Set<string> {
  if (selectedId === null) return new Set();

  const keep = new Set<string>([
    selectedId,
    ...descendantIds(nodes, selectedId),
    ...ancestorIds(nodes, selectedId),
  ]);

  return new Set(nodes.filter((node) => !keep.has(node.id)).map((node) => node.id));
}

/** Bản nháp đang sửa trong bảng thuộc tính. Chưa bấm Lưu thì chưa có gì được ghi. */
type Draft = {
  id: string;
  status: NavEditorStatus;
  /** Một ô tên cho mỗi ngôn ngữ đang bật; ngôn ngữ chưa dịch thì chuỗi rỗng. */
  labels: Record<string, string>;
};

function draftOf(node: NavEditorNode, locales: NavEditorLocale[]): Draft {
  return {
    id: node.id,
    status: node.status,
    labels: Object.fromEntries(locales.map((locale) => [locale.code, node.labels[locale.code] ?? ""])),
  };
}

/** Mục mới đang soạn. `parentId` là nút cha đã chốt lúc bấm "Thêm". */
type NewNode = {
  parentId: string | null;
  kind: NavEditorKind;
  name: string;
  slug: string;
};

export function NavEditor({
  nodes,
  locales,
  unlinked,
  labels,
  createNode,
  updateNode,
  deleteNode,
  moveNode,
  reorderNodes,
}: NavEditorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [adding, setAdding] = useState<NewNode | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const defaultLocale = (locales.find((locale) => locale.isDefault) ?? locales[0])?.code ?? "vi";

  const selected = selectedId === null ? null : nodes.find((node) => node.id === selectedId) ?? null;
  // Nút vừa bị xoá hoặc cây vừa được đọc lại: bản nháp cũ không còn tả nút nào,
  // dựng lại từ dữ liệu máy chủ thay vì hiện một bảng thuộc tính trỏ vào hư không.
  const form =
    selected === null
      ? null
      : draft !== null && draft.id === selected.id
        ? draft
        : draftOf(selected, locales);

  const hidden = hiddenBranches(nodes, selectedId);

  /**
   * Chạy một phép ghi rồi nói ra kết quả.
   *
   * `router.refresh()` **chỉ** khi thành công: sau một lỗi thì cây trên màn hình
   * vẫn là cây đúng, còn đọc lại sẽ xoá mất ô thông báo trước khi ai kịp đọc.
   */
  function run(work: () => Promise<unknown>, okText: string) {
    setNotice(null);
    startTransition(async () => {
      try {
        await work();
        setNotice({ tone: "ok", text: okText });
        router.refresh();
      } catch (error) {
        setNotice({ tone: "error", text: fmt(labels.failed, { reason: reasonOf(error) }) });
      }
    });
  }

  function nameOf(node: NavEditorNode): string {
    return node.label.trim() === "" ? labels.noLabel : node.label;
  }

  function select(node: NavEditorNode) {
    setSelectedId(node.id);
    setDraft(draftOf(node, locales));
    setAdding(null);
  }

  /** Vị trí cuối trong danh sách con của `parentId`, sau khi nút đã rời chỗ cũ. */
  function tailIndex(parentId: string | null, movingId: string): number {
    return siblingsOf(nodes, parentId).filter((node) => node.id !== movingId).length;
  }

  function move(id: string, parentId: string | null) {
    const node = nodes.find((candidate) => candidate.id === id);
    if (!node || node.parentId === parentId) return;
    run(() => moveNode({ id, parentId, index: tailIndex(parentId, id) }), labels.moved);
  }

  function reorder(node: NavEditorNode, to: OrderMove) {
    const siblings = siblingsOf(nodes, node.parentId).map((sibling) => sibling.id);
    const from = siblings.indexOf(node.id);
    const target =
      to === "top" ? 0 : to === "bottom" ? siblings.length - 1 : from + (to === "down" ? 1 : -1);

    if (target < 0 || target >= siblings.length || target === from) return;

    const ids = [...siblings];
    ids.splice(from, 1);
    ids.splice(target, 0, node.id);

    run(() => reorderNodes({ parentId: node.parentId, ids }), labels.reordered);
  }

  function save() {
    if (selected === null || form === null) return;

    // Lá không có ô tên: tên của nó là tên bản ghi nội dung, sửa ở mục Ứng dụng
    // hoặc Trang hướng dẫn. Gửi `labels` cho lá là gửi một thứ không ai đọc.
    const input: NavEditorUpdateInput =
      selected.kind === "CONTAINER"
        ? {
            id: selected.id,
            status: form.status,
            labels: locales.map((locale) => ({
              locale: locale.code,
              label: form.labels[locale.code] ?? "",
            })),
          }
        : { id: selected.id, status: form.status };

    run(() => updateNode(input), labels.saved);
  }

  /**
   * `slug` tới từ chỗ dựng ô chọn, không lấy từ `item.slug`: ô đó chọn sẵn mục
   * đầu tiên, mà "chọn sẵn" nghĩa là người dùng không phải chạm vào nó — nên
   * `item.slug` vẫn rỗng trong khi trên màn hình đã có một mục được chọn.
   */
  function create(item: NewNode, slug: string) {
    const input: NavEditorCreateInput =
      item.kind === "CONTAINER"
        ? {
            parentId: item.parentId,
            kind: "CONTAINER",
            ...(item.name.trim() === ""
              ? {}
              : { labels: [{ locale: defaultLocale, label: item.name.trim() }] }),
          }
        : item.kind === "APP"
          ? { parentId: item.parentId, kind: "APP", appSlug: slug }
          : { parentId: item.parentId, kind: "DOC", docSlug: slug };

    setAdding(null);
    run(() => createNode(input), labels.created);
  }

  // ------------------------------------------------------------------
  // Cây
  // ------------------------------------------------------------------

  function renderBranch(parentId: string | null, isRootList: boolean): ReactNode {
    const siblings = siblingsOf(nodes, parentId);
    if (siblings.length === 0) return null;

    const list = siblings.map((node, index) => {
      const children = siblingsOf(nodes, node.id);
      const collapsed = hidden.has(node.id);
      const draggedIsSelfOrAncestor =
        dragId !== null && (dragId === node.id || descendantIds(nodes, dragId).has(node.id));

      return (
        <li key={node.id} className={styles.branch}>
          <NavNodeRow
            node={node}
            name={nameOf(node)}
            childCount={children.length}
            index={index}
            total={siblings.length}
            selected={node.id === selectedId}
            isRoot={parentId === null}
            collapsed={collapsed}
            dropTarget={node.kind === "CONTAINER" && dragId !== null && !draggedIsSelfOrAncestor}
            labels={labels}
            onSelect={() => select(node)}
            onRemove={() => run(() => deleteNode({ id: node.id }), labels.removed)}
            onMove={(to) => reorder(node, to)}
            onDragStart={() => setDragId(node.id)}
            onDragEnd={() => setDragId(null)}
            onDropInto={() => {
              const dragged = dragId;
              setDragId(null);
              if (dragged !== null) move(dragged, node.id);
            }}
          />

          {collapsed ? null : renderBranch(node.id, false)}

          {node.kind === "CONTAINER" && !collapsed ? (
            <button
              className={styles.add}
              type="button"
              disabled={pending}
              onClick={() =>
                setAdding({ parentId: node.id, kind: "CONTAINER", name: "", slug: "" })
              }
            >
              {fmt(labels.addChild, { name: nameOf(node) })}
            </button>
          ) : null}
        </li>
      );
    });

    return isRootList ? (
      <ul className={styles.list} data-nav-root-list="">
        {list}
      </ul>
    ) : (
      <ul className={styles.list}>{list}</ul>
    );
  }

  // ------------------------------------------------------------------
  // Bảng thuộc tính
  // ------------------------------------------------------------------

  const statusOptions: { value: NavEditorStatus; label: string }[] = [
    { value: "DRAFT", label: labels.statusDraft },
    { value: "PUBLISHED", label: labels.statusPublished },
    { value: "ARCHIVED", label: labels.statusArchived },
  ];

  function renderPanel(node: NavEditorNode, current: Draft): ReactNode {
    const siblings = siblingsOf(nodes, node.parentId);
    const position = siblings.findIndex((sibling) => sibling.id === node.id) + 1;

    // Hậu duệ của chính nó không được có trong danh sách cha: đưa vào là cây có
    // chu trình, cả nhánh biến mất khỏi điều hướng dù dữ liệu vẫn còn. Tầng ghi
    // cũng chặn (`wouldCreateCycle`), nhưng để một lựa chọn vô nghĩa nằm sẵn
    // trong danh sách là mời người dùng bấm rồi mới đọc lỗi.
    const forbidden = descendantIds(nodes, node.id);
    const parents = nodes.filter(
      (candidate) =>
        candidate.kind === "CONTAINER" && candidate.id !== node.id && !forbidden.has(candidate.id),
    );

    return (
      <div className={styles.panel}>
        <h3 className={styles.panelTitle}>{nameOf(node)}</h3>

        <div className={styles.field}>
          <label htmlFor="nav-field-kind">{labels.fieldKind}</label>
          <input
            className={styles.input}
            id="nav-field-kind"
            readOnly
            value={navKindLabel(node.kind, labels)}
          />
        </div>

        {node.kind === "CONTAINER" ? (
          locales.map((locale) => (
            <div className={styles.field} key={locale.code}>
              <label htmlFor={`nav-field-name-${locale.code}`}>
                {fmt(labels.fieldName, { locale: locale.label })}
              </label>
              <input
                className={styles.input}
                id={`nav-field-name-${locale.code}`}
                value={current.labels[locale.code] ?? ""}
                onChange={(event) =>
                  setDraft({
                    ...current,
                    labels: { ...current.labels, [locale.code]: event.target.value },
                  })
                }
              />
            </div>
          ))
        ) : (
          <>
            <div className={styles.field}>
              <label htmlFor="nav-field-name">{labels.fieldNameReadOnly}</label>
              <input
                className={styles.input}
                id="nav-field-name"
                readOnly
                value={nameOf(node)}
              />
              <p className={styles.hint}>{labels.fieldNameHint}</p>
            </div>

            <div className={styles.field}>
              <label htmlFor="nav-field-content">{labels.fieldContent}</label>
              <input
                className={styles.mono}
                id="nav-field-content"
                readOnly
                value={node.href ?? ""}
              />
            </div>
          </>
        )}

        <div className={styles.field}>
          <label htmlFor="nav-field-status">{labels.fieldStatus}</label>
          <select
            className={styles.input}
            id="nav-field-status"
            value={current.status}
            onChange={(event) =>
              setDraft({ ...current, status: event.target.value as NavEditorStatus })
            }
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Đổi nút cha ghi ngay, không chờ nút Lưu: đây là đường bàn phím của
            việc kéo thả, và kéo thả cũng ghi ngay khi nhả chuột. */}
        <div className={styles.field}>
          <label htmlFor="nav-field-parent">{labels.fieldParent}</label>
          <select
            className={styles.input}
            id="nav-field-parent"
            value={node.parentId ?? ""}
            disabled={pending}
            onChange={(event) => move(node.id, event.target.value === "" ? null : event.target.value)}
          >
            <option value="">{labels.parentRoot}</option>
            {parents.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {nameOf(candidate)}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="nav-field-order">{labels.fieldOrder}</label>
          <input
            className={styles.mono}
            id="nav-field-order"
            readOnly
            value={`${position} / ${siblings.length}`}
          />
        </div>

        {node.kind === "CONTAINER" ? (
          <div className={styles.lock}>
            <b className={styles.lockTitle}>{labels.lockTitle}</b>
            {labels.lockBody}
          </div>
        ) : null}

        <div className={styles.panelActions}>
          <button className={styles.primary} type="button" disabled={pending} onClick={save}>
            {labels.save}
          </button>
        </div>
      </div>
    );
  }

  function renderNewNode(item: NewNode): ReactNode {
    const options =
      item.kind === "APP"
        ? unlinked.apps.map((app) => ({ value: app.slug, label: app.name }))
        : unlinked.docs.map((doc) => ({ value: doc.slug, label: doc.title }));

    // Chọn sẵn mục đầu để nút "Thêm" không bao giờ gửi một lá không gắn gì —
    // `navTargetFor` ở tầng ghi từ chối đúng thứ đó.
    const slug = options.some((option) => option.value === item.slug)
      ? item.slug
      : (options[0]?.value ?? "");

    return (
      <div className={styles.panel}>
        <h3 className={styles.panelTitle}>{labels.newTitle}</h3>

        <div className={styles.field}>
          <label htmlFor="nav-new-kind">{labels.newKind}</label>
          <select
            className={styles.input}
            id="nav-new-kind"
            value={item.kind}
            onChange={(event) =>
              setAdding({ ...item, kind: event.target.value as NavEditorKind, slug: "" })
            }
          >
            <option value="CONTAINER">{labels.kindContainer}</option>
            <option value="APP">{labels.kindApp}</option>
            <option value="DOC">{labels.kindDoc}</option>
          </select>
        </div>

        {item.kind === "CONTAINER" ? (
          <div className={styles.field}>
            <label htmlFor="nav-new-name">{labels.newName}</label>
            <input
              className={styles.input}
              id="nav-new-name"
              value={item.name}
              onChange={(event) => setAdding({ ...item, name: event.target.value })}
            />
          </div>
        ) : options.length === 0 ? (
          <p className={styles.hint}>{labels.newContentEmpty}</p>
        ) : (
          <div className={styles.field}>
            <label htmlFor="nav-new-content">{labels.newContent}</label>
            <select
              className={styles.input}
              id="nav-new-content"
              value={slug}
              onChange={(event) => setAdding({ ...item, slug: event.target.value })}
            >
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={styles.panelActions}>
          <button
            className={styles.primary}
            type="button"
            disabled={pending || (item.kind !== "CONTAINER" && slug === "")}
            onClick={() => create(item, slug)}
          >
            {labels.create}
          </button>
          <button className={styles.secondary} type="button" onClick={() => setAdding(null)}>
            {labels.cancel}
          </button>
        </div>
      </div>
    );
  }

  const nothingUnlinked = unlinked.apps.length === 0 && unlinked.docs.length === 0;

  return (
    <div className={styles.wrap}>
      {/* `aria-live` để người dùng bàn phím biết kết quả mà không phải đi tìm. */}
      <p className={styles.notice} data-tone={notice?.tone} role="status" aria-live="polite">
        {notice?.text ?? ""}
      </p>

      <div className={styles.shell}>
        <div className={styles.tree}>
          <div className={styles.treeBar}>
            <p className={styles.bandTitle}>{labels.rootBandTitle}</p>
            <button
              className={styles.dashed}
              type="button"
              disabled={pending}
              onClick={() => setAdding({ parentId: null, kind: "CONTAINER", name: "", slug: "" })}
            >
              {labels.addRoot}
            </button>
          </div>
          <p className={styles.hint}>{labels.rootBandHint}</p>

          {renderBranch(null, true)}

          {/* Kéo một mục từ dưới lên đây là nó thành tab trên cùng — dải tab và
              sidebar là **một cây liền**, không phải hai danh sách rời. */}
          <div
            className={styles.rootZone}
            data-nav-root-zone=""
            data-active={dragId === null ? undefined : "true"}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const dragged = dragId;
              setDragId(null);
              if (dragged !== null) move(dragged, null);
            }}
          >
            {labels.dropToRoot}
          </div>

          {/*
            `unlinkedHint` là **tooltip**, không phải đoạn văn dưới tiêu đề, và đó
            là một nhượng bộ có chủ ý: câu đó lặp lại đúng cụm "dải tab" của nhãn
            khối gốc, còn `NavEditor.test.tsx` chốt `getByText(/dải tab/i)` phải
            khớp đúng một phần tử — nhãn của khối gốc. Hai đoạn văn cùng chứa một
            cụm thì phép kiểm ấy không còn chỉ được vào đâu. Tiêu đề khối đã nói
            đủ điều cần biết ("Chưa có trong điều hướng"); câu dài giải thích hậu
            quả nằm ở `title` cho ai muốn đọc thêm.
          */}
          <section className={styles.unlinked}>
            <h3 className={styles.unlinkedTitle} title={labels.unlinkedHint}>
              {labels.unlinkedTitle}
            </h3>

            {nothingUnlinked ? (
              <p className={styles.hint}>{labels.unlinkedEmpty}</p>
            ) : (
              <>
                {unlinked.apps.length === 0 ? null : (
                  <>
                    <p className={styles.unlinkedGroup}>{labels.unlinkedApps}</p>
                    <ul className={styles.unlinkedList}>
                      {unlinked.apps.map((app) => (
                        <li key={app.slug}>
                          {app.name}
                          <span className={styles.slug}>{app.slug}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {unlinked.docs.length === 0 ? null : (
                  <>
                    <p className={styles.unlinkedGroup}>{labels.unlinkedDocs}</p>
                    <ul className={styles.unlinkedList}>
                      {unlinked.docs.map((doc) => (
                        <li key={doc.slug}>
                          {doc.title}
                          <span className={styles.slug}>{doc.slug}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </section>
        </div>

        {/* Cột phải giữ **một** việc tại một lúc: hoặc soạn mục mới, hoặc sửa mục
            đang chọn. Hai bảng cùng lúc thì có hai ô "Loại nút" và hai ô "Nội
            dung" trên cùng một màn hình, không ai biết ô nào thuộc việc nào. */}
        <aside className={styles.side}>
          {adding !== null
            ? renderNewNode(adding)
            : selected !== null && form !== null
              ? renderPanel(selected, form)
              : <p className={styles.hint}>{labels.panelEmpty}</p>}
        </aside>
      </div>
    </div>
  );
}
