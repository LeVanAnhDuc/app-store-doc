"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { fuzzyMatch } from "@/lib/fuzzy";
import type { SearchDoc } from "@/lib/search-index";
import styles from "./SearchDialog.module.css";

/** Đủ dài cho một danh sách gợi ý đọc hết trong một màn hình. */
const MAX_RESULTS = 8;

/**
 * Trạng thái chỉ mục. Khởi điểm là `loading`: trước khi mở hộp thoại thì không
 * ai nhìn thấy trạng thái này, nên không cần thêm một nhánh `idle` chỉ để mô tả
 * "chưa gọi mạng" — việc đã gọi hay chưa do `loadedFor` giữ.
 */
type IndexState =
  | { phase: "loading" }
  | { phase: "ready"; docs: SearchDoc[] }
  | { phase: "error" };

export type SearchDialogProps = {
  /** Chỉ mục tách theo ngôn ngữ; cũng là tiền tố của mọi `href` trong kết quả. */
  locale: string;
};

/**
 * Hộp tìm kiếm của thanh trên cùng.
 *
 * Chỉ mục tải **lười**: `GET /api/search-index/<locale>` chỉ chạy khi người dùng
 * mở hộp thoại lần đầu. Tải sẵn lúc dựng trang sẽ bắt mọi người đọc trả giá
 * băng thông cho một tính năng phần lớn không dùng tới.
 *
 * Lọc bằng `fuzzyMatch` phía trình duyệt nên gõ không gọi mạng, và tìm không dấu
 * ("tap luyen" ra "tập luyện") hoạt động đúng như người Việt gõ nhanh.
 */
export function SearchDialog({ locale }: SearchDialogProps) {
  const t = useTranslations("search");

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<IndexState>({ phase: "loading" });

  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  /** Ngôn ngữ đã tải xong chỉ mục — cũng là chốt chặn để không gọi mạng lần hai. */
  const loadedFor = useRef<string | null>(null);
  const resultsId = useId();

  /** Lần mở sau một lần hỏng phải xoá thông báo lỗi cũ, nếu không nó nằm lại chình ình. */
  const clearStaleError = useCallback(() => {
    setIndex((current) => (current.phase === "error" ? { phase: "loading" } : current));
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    // Trả tiêu điểm về nút đã mở hộp thoại: đóng bằng Esc mà tiêu điểm rơi về
    // <body> thì người dùng bàn phím mất chỗ đứng.
    triggerRef.current?.focus();
  }, []);

  // Phím tắt ⌘K / Ctrl+K, đúng như nhãn ghi trên nút.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((previous) => !previous);
        clearStaleError();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearStaleError]);

  // Tải chỉ mục đúng một lần, và chỉ khi hộp thoại đã mở.
  useEffect(() => {
    if (!open || loadedFor.current === locale) return;
    loadedFor.current = locale;

    let cancelled = false;

    fetch(`/api/search-index/${locale}`)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<SearchDoc[]>;
      })
      .then((docs) => {
        if (!cancelled) setIndex({ phase: "ready", docs });
      })
      .catch(() => {
        // Hỏng thì nói rõ và chỉ cách thử lại, không nuốt lỗi để ô tìm kiếm
        // đứng im không hiểu vì sao. Mở chốt để lần mở sau gọi lại thật.
        loadedFor.current = null;
        if (!cancelled) setIndex({ phase: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [open, locale]);

  // Mở tới đâu, tiêu điểm tới đó.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const results =
    index.phase === "ready" ? fuzzyMatch(query, index.docs, MAX_RESULTS) : [];

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen(true);
          clearStaleError();
        }}
      >
        <span>{t("open")}</span>
        <kbd className={styles.kbd}>{t("shortcut")}</kbd>
      </button>

      {open ? (
        <div
          className={styles.overlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-label={t("label")}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                close();
              }
            }}
          >
            <div className={styles.field}>
              <input
                ref={inputRef}
                className={styles.input}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("placeholder")}
                aria-label={t("label")}
                aria-controls={resultsId}
                autoComplete="off"
                spellCheck={false}
              />
              <button type="button" className={styles.close} onClick={close}>
                {t("close")}
              </button>
            </div>

            <div className={styles.body} id={resultsId} aria-live="polite">
              {index.phase === "loading" ? <p className={styles.note}>{t("loading")}</p> : null}
              {index.phase === "error" ? <p className={styles.note}>{t("error")}</p> : null}

              {index.phase === "ready" && query.trim() === "" ? (
                <p className={styles.note}>{t("hint")}</p>
              ) : null}

              {index.phase === "ready" && query.trim() !== "" && results.length === 0 ? (
                <p className={styles.note}>{t("empty")}</p>
              ) : null}

              {results.length > 0 ? (
                <ul className={styles.results}>
                  {results.map((doc) => (
                    <li key={doc.href}>
                      <a className={styles.result} href={doc.href} onClick={() => setOpen(false)}>
                        <span className={styles.resultTitle}>{doc.title}</span>
                        <span className={styles.resultHref}>{doc.href}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
