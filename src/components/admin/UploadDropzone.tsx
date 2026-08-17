"use client";

import { useRef, useState, useTransition, type DragEvent } from "react";
import { useTranslations } from "next-intl";

import { formatBytes } from "./media";
import styles from "./UploadDropzone.module.css";

/**
 * Vùng kéo-thả để tải ảnh lên — `.m-drop` của mockup màn 05.
 *
 * Hai đường vào cùng một chỗ: kéo tệp vào vùng này, hoặc bấm để mở hộp chọn tệp.
 * Chỉ có kéo-thả là loại hẳn người dùng bàn phím, nên `<input type="file">` là
 * phần tử thật, có nhãn thật, chứ không phải mẹo CSS.
 *
 * Trần dung lượng **không** gõ lại thành số ở đây: `maxBytes` do trang truyền
 * xuống từ `MAX_IMAGE_BYTES` của tầng lưu ảnh. Gõ lại một con số thứ hai nghĩa là
 * đến ngày ai đó đổi trần thật, giao diện vẫn nói con số cũ và người dùng bị từ
 * chối bởi một giới hạn mà màn hình vừa bảo là hợp lệ.
 */
export type UploadDropzoneProps = {
  /** Server action nhận `FormData` có khoá `file`. */
  upload: (formData: FormData) => Promise<unknown>;
  /** Trần dung lượng thật của tầng lưu ảnh. */
  maxBytes: number;
  /** Kiểu MIME được nhận, cho `accept` và cho câu hướng dẫn. */
  accept: readonly string[];
  /** Gọi sau khi tải lên xong, để trang đọc lại danh sách. */
  onUploaded?: () => void;
};

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function UploadDropzone({ upload, maxBytes, accept, onUploaded }: UploadDropzoneProps) {
  const t = useTranslations();
  const input = useRef<HTMLInputElement | null>(null);

  const [over, setOver] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function send(files: FileList | null) {
    if (!files || files.length === 0) return;

    setNotice(null);

    // Kiểm dung lượng ngay ở trình duyệt: tệp 40 MB bị chặn ở đây thì không phải
    // đi hết đường truyền chỉ để nhận về đúng câu trả lời đó.
    const tooBig = [...files].filter((file) => file.size > maxBytes);
    if (tooBig.length > 0) {
      setNotice({
        tone: "error",
        text: t("admin.media.tooBig", {
          name: tooBig[0].name,
          size: formatBytes(tooBig[0].size),
          max: formatBytes(maxBytes),
        }),
      });
      return;
    }

    startTransition(async () => {
      try {
        // Tải lần lượt, không song song: mỗi lời gọi là một server action và
        // Next xếp hàng chúng theo thứ tự; song song chỉ làm lỗi khó lần hơn.
        for (const file of files) {
          const data = new FormData();
          data.set("file", file);
          await upload(data);
        }

        setNotice({
          tone: "ok",
          text: t("admin.media.uploaded", { count: files.length }),
        });
        // Ô nhập giữ tệp cũ thì chọn lại đúng tệp đó không bắn `change`.
        if (input.current) input.current.value = "";
        onUploaded?.();
      } catch (error) {
        setNotice({ tone: "error", text: t("admin.media.uploadFailed", { reason: reasonOf(error) }) });
      }
    });
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setOver(false);
    send(event.dataTransfer.files);
  }

  return (
    <div
      className={styles.drop}
      data-over={over ? "true" : undefined}
      data-pending={pending ? "true" : undefined}
      onDragOver={(event) => {
        // Không `preventDefault` thì trình duyệt mở tệp thay vì để ta nhận.
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <strong className={styles.title}>{t("admin.media.dropTitle")}</strong>
      <span className={styles.hint}>
        {t("admin.media.dropHint", { max: formatBytes(maxBytes) })}
      </span>

      <label className={styles.pick}>
        <span>{pending ? t("admin.media.uploading") : t("admin.media.choose")}</span>
        <input
          className={styles.input}
          ref={input}
          type="file"
          accept={accept.join(",")}
          multiple
          disabled={pending}
          onChange={(event) => send(event.target.files)}
        />
      </label>

      {/* `aria-live` để người dùng bàn phím biết kết quả mà không phải đi tìm. */}
      <p className={styles.notice} data-tone={notice?.tone} role="status" aria-live="polite">
        {notice?.text ?? ""}
      </p>
    </div>
  );
}
