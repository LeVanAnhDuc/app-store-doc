import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminBar, AdminBody, AdminScope, AdminTitle } from "@/components/admin/AdminShell";
import {
  NavEditor,
  type NavEditorLabels,
  type NavEditorNode,
} from "@/components/admin/NavEditor";
import {
  getNavRows,
  getUnlinkedContent,
  listLocalesForAdmin,
  loadDefaultLocale,
} from "@/server/content/queries";
import {
  createNavNode,
  deleteNavNode,
  moveNavNode,
  reorderNavSiblings,
  updateNavNode,
} from "../../actions";

/**
 * `/[locale]/admin/navigation` — trình soạn cây điều hướng (mockup v3 mục 03).
 *
 * Trang chỉ làm ba việc: đọc cây, dịch chuỗi giao diện, và nối năm server action
 * vào `NavEditor`. Mọi quy tắc của cây nằm ở tầng ghi, mọi tương tác nằm ở
 * component — trang này không được biết gì thêm.
 *
 * `NavEditor` nhận nhãn qua prop chứ không tự gọi `useTranslations`, nên chỗ dịch
 * là đây. Những chuỗi có chỗ trống (`{name}`, `{count}`, `{locale}`, `{reason}`)
 * phải lấy bằng `t.raw`: `t()` sẽ cố định dạng ICU ngay lúc này, mà giá trị thật
 * chỉ có ở trình duyệt.
 */

type PageParams = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return {
    title: `${t("admin.navigation.title")} — ${t("brand.name")}`,
    robots: { index: false, follow: false },
  };
}

export default async function AdminNavigationPage({ params }: PageParams) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "admin.navigation" });
  const template = (key: string): string => String(t.raw(key));

  const [rows, unlinked, localeRows, defaultLocale] = await Promise.all([
    getNavRows(),
    getUnlinkedContent(),
    listLocalesForAdmin(),
    loadDefaultLocale(),
  ]);

  /**
   * `NavRow.labels` là danh sách ứng viên theo ngôn ngữ; trình soạn cần tra theo
   * mã nên đổi sang bản đồ. `label` là nhãn hiện trong cây: ngôn ngữ mặc định
   * trước, rồi bất kỳ ngôn ngữ nào có — **không** lấy id làm nhãn dự phòng
   * (design-rules §1). Không có nhãn nào thì hàng hiện "Chưa có tên".
   */
  const nodes: NavEditorNode[] = rows.map((row) => {
    const labels = Object.fromEntries(row.labels.map((entry) => [entry.locale, entry.value]));

    return {
      id: row.id,
      parentId: row.parentId,
      kind: row.kind,
      status: row.status,
      label: labels[defaultLocale] ?? row.labels[0]?.value ?? "",
      labels,
      href: row.href,
    };
  });

  // Chỉ ngôn ngữ đang bật: một ô tên cho ngôn ngữ đã tắt là mời người dùng dịch
  // vào chỗ không ai đọc.
  const locales = localeRows
    .filter((row) => row.enabled)
    .map((row) => ({ code: row.code, label: row.label, isDefault: row.isDefault }));

  const labels: NavEditorLabels = {
    rootBandTitle: t("rootBandTitle"),
    rootBandHint: t("rootBandHint"),
    addRoot: t("addRoot"),
    addChild: template("addChild"),
    dropToRoot: t("dropToRoot"),
    drag: t("drag"),
    select: template("select"),
    edit: t("edit"),
    remove: t("remove"),
    removeHint: t("removeHint"),
    order: {
      top: t("orderTop"),
      up: t("orderUp"),
      down: t("orderDown"),
      bottom: t("orderBottom"),
    },
    kindContainer: t("kindContainer"),
    kindApp: t("kindApp"),
    kindDoc: t("kindDoc"),
    childCountOne: t("childCountOne"),
    childCountOther: template("childCountOther"),
    emptyContainer: t("emptyContainer"),
    noLabel: t("noLabel"),
    panelEmpty: t("panelEmpty"),
    fieldKind: t("fieldKind"),
    fieldName: template("fieldName"),
    fieldNameReadOnly: t("fieldNameReadOnly"),
    fieldNameHint: t("fieldNameHint"),
    fieldContent: t("fieldContent"),
    fieldStatus: t("fieldStatus"),
    fieldParent: t("fieldParent"),
    parentRoot: t("parentRoot"),
    fieldOrder: t("fieldOrder"),
    statusDraft: t("statusDraft"),
    statusPublished: t("statusPublished"),
    statusArchived: t("statusArchived"),
    lockTitle: t("lockTitle"),
    lockBody: t("lockBody"),
    save: t("save"),
    saved: t("saved"),
    failed: template("failed"),
    created: t("created"),
    removed: t("removed"),
    moved: t("moved"),
    reordered: t("reordered"),
    newTitle: t("newTitle"),
    newKind: t("newKind"),
    newName: t("newName"),
    newContent: t("newContent"),
    newContentEmpty: t("newContentEmpty"),
    create: t("create"),
    cancel: t("cancel"),
    unlinkedTitle: t("unlinkedTitle"),
    unlinkedHint: t("unlinkedHint"),
    unlinkedEmpty: t("unlinkedEmpty"),
    unlinkedApps: t("unlinkedApps"),
    unlinkedDocs: t("unlinkedDocs"),
  };

  return (
    <>
      <AdminBar>
        <AdminTitle>{t("title")}</AdminTitle>
        <AdminScope>{t("scope", { count: nodes.length })}</AdminScope>
      </AdminBar>

      <AdminBody>
        <NavEditor
          nodes={nodes}
          locales={locales}
          unlinked={{
            apps: unlinked.apps.map((app) => ({ slug: app.slug, name: app.name })),
            docs: unlinked.docs,
          }}
          labels={labels}
          createNode={createNavNode}
          updateNode={updateNavNode}
          deleteNode={deleteNavNode}
          moveNode={moveNavNode}
          reorderNodes={reorderNavSiblings}
        />
      </AdminBody>
    </>
  );
}
