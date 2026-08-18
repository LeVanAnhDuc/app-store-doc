-- Cây điều hướng: NavNode + NavNodeTranslation, và xoá DocPage.group.
--
-- THỨ TỰ TRONG FILE NÀY LÀ BẮT BUỘC (spec §11):
--   1. Tạo bảng mới
--   2. Chuyển dữ liệu: mỗi "group" cũ thành một nút chứa, mỗi App/DocPage thành một nút lá
--   3. CHỈ SAU ĐÓ mới xoá cột nhóm cũ của DocPage
-- Đảo thứ tự là mất sạch thông tin nhóm — cột bị xoá thì không đọc lại được nữa.

-- ---------------------------------------------------------------------------
-- 1. Bảng mới (phần này do `prisma migrate diff` sinh)
-- ---------------------------------------------------------------------------

-- CreateEnum
CREATE TYPE "NavKind" AS ENUM ('CONTAINER', 'APP', 'DOC');

-- CreateTable
CREATE TABLE "NavNode" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" "Status" NOT NULL DEFAULT 'DRAFT',
    "kind" "NavKind" NOT NULL,
    "appId" TEXT,
    "docPageId" TEXT,

    CONSTRAINT "NavNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NavNodeTranslation" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "NavNodeTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NavNode_appId_key" ON "NavNode"("appId");

-- CreateIndex
CREATE UNIQUE INDEX "NavNode_docPageId_key" ON "NavNode"("docPageId");

-- CreateIndex
CREATE INDEX "NavNode_parentId_order_idx" ON "NavNode"("parentId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "NavNodeTranslation_nodeId_locale_key" ON "NavNodeTranslation"("nodeId", "locale");

-- AddForeignKey
ALTER TABLE "NavNode" ADD CONSTRAINT "NavNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "NavNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NavNode" ADD CONSTRAINT "NavNode_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NavNode" ADD CONSTRAINT "NavNode_docPageId_fkey" FOREIGN KEY ("docPageId") REFERENCES "DocPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NavNodeTranslation" ADD CONSTRAINT "NavNodeTranslation_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "NavNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Chuyển dữ liệu — chạy TRƯỚC khi xoá cột "group"
-- ---------------------------------------------------------------------------

-- Bảng tạm chỉ sống trong phiên chạy migration: nối mỗi chuỗi group cũ với id
-- của nút chứa mới, để bước sau còn biết gắn lá vào đâu.
CREATE TEMP TABLE "_nav_group_map" (
    "group"  TEXT PRIMARY KEY,
    "nodeId" TEXT NOT NULL,
    "order"  INTEGER NOT NULL
);

INSERT INTO "_nav_group_map" ("group", "nodeId", "order")
SELECT g."group",
       gen_random_uuid()::text,
       (row_number() OVER (ORDER BY g."group"))::int - 1
FROM (SELECT DISTINCT "group" FROM "DocPage" WHERE "group" IS NOT NULL) g;

-- Mỗi giá trị group cũ thành một nút chứa ở gốc.
INSERT INTO "NavNode" ("id", "parentId", "order", "status", "kind")
SELECT m."nodeId", NULL, m."order", 'PUBLISHED', 'CONTAINER'
FROM "_nav_group_map" m;

-- Nhãn nút chứa = chính chuỗi group, đặt ở locale mặc định (I5).
INSERT INTO "NavNodeTranslation" ("id", "nodeId", "locale", "label")
SELECT gen_random_uuid()::text,
       m."nodeId",
       COALESCE((SELECT l."code" FROM "Locale" l WHERE l."isDefault" ORDER BY l."order" LIMIT 1), 'vi'),
       m."group"
FROM "_nav_group_map" m;

-- Ứng dụng không có "group": gom theo App.kind, mỗi loại thật sự có ứng dụng
-- mới sinh ra một nút chứa (nút chứa rỗng thì I2 cấm publish).
CREATE TEMP TABLE "_nav_kind_map" (
    "kind"   "AppKind" PRIMARY KEY,
    "nodeId" TEXT NOT NULL,
    "label"  TEXT NOT NULL,
    "order"  INTEGER NOT NULL
);

INSERT INTO "_nav_kind_map" ("kind", "nodeId", "label", "order")
SELECT k."kind",
       gen_random_uuid()::text,
       CASE k."kind" WHEN 'CORE' THEN 'Lõi' ELSE 'Vệ tinh' END,
       ((CASE k."kind" WHEN 'CORE' THEN 0 ELSE 1 END) + (SELECT count(*) FROM "_nav_group_map"))::int
FROM (SELECT DISTINCT "kind" FROM "App") k;

INSERT INTO "NavNode" ("id", "parentId", "order", "status", "kind")
SELECT m."nodeId", NULL, m."order", 'PUBLISHED', 'CONTAINER'
FROM "_nav_kind_map" m;

INSERT INTO "NavNodeTranslation" ("id", "nodeId", "locale", "label")
SELECT gen_random_uuid()::text,
       m."nodeId",
       COALESCE((SELECT l."code" FROM "Locale" l WHERE l."isDefault" ORDER BY l."order" LIMIT 1), 'vi'),
       m."label"
FROM "_nav_kind_map" m;

-- Mỗi ứng dụng thành một nút lá dưới nút chứa dựng từ kind.
INSERT INTO "NavNode" ("id", "parentId", "order", "status", "kind", "appId")
SELECT gen_random_uuid()::text, m."nodeId", a."order", a."status", 'APP', a."id"
FROM "App" a
JOIN "_nav_kind_map" m ON m."kind" = a."kind";

-- Mỗi trang tài liệu thành một nút lá: có group thì nằm dưới nút chứa tương ứng,
-- không có group thì nằm thẳng ở gốc (LEFT JOIN cho parentId = NULL).
INSERT INTO "NavNode" ("id", "parentId", "order", "status", "kind", "docPageId")
SELECT gen_random_uuid()::text, m."nodeId", d."order", d."status", 'DOC', d."id"
FROM "DocPage" d
LEFT JOIN "_nav_group_map" m ON m."group" = d."group";

DROP TABLE "_nav_group_map";
DROP TABLE "_nav_kind_map";

-- ---------------------------------------------------------------------------
-- 3. Chỉ sau khi chuyển xong dữ liệu mới được xoá cột
-- ---------------------------------------------------------------------------

-- AlterTable
ALTER TABLE "DocPage" DROP COLUMN "group";

-- `kind` phải khớp với cột trỏ: APP ⟺ appId, DOC ⟺ docPageId, CONTAINER ⟺ cả hai null.
-- Prisma không diễn đạt được ràng buộc này nên phải viết tay, cùng lối
-- `section_single_owner` đã có trong 0001_init.
ALTER TABLE "NavNode" ADD CONSTRAINT nav_node_kind_matches_target CHECK (
  ("kind" = 'CONTAINER' AND "appId" IS NULL AND "docPageId" IS NULL) OR
  ("kind" = 'APP'       AND "appId" IS NOT NULL AND "docPageId" IS NULL) OR
  ("kind" = 'DOC'       AND "appId" IS NULL AND "docPageId" IS NOT NULL)
);
