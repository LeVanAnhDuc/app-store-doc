import styles from "./CodeBlock.module.css";

export type CodeBlockProps = {
  /** HTML đã tô màu và đã sanitize, do `renderMarkdown` sinh ra. */
  html: string;
  /** Tên gọi của hộp cuộn, dùng làm accessible name. */
  label?: string;
  className?: string;
};

/**
 * Bọc khối mã đã tô màu trong một hộp cuộn ngang riêng.
 * `html` phải đi qua sanitize ở tầng markdown trước khi tới đây.
 */
export function CodeBlock({ html, label = "Khối mã", className }: CodeBlockProps) {
  return (
    <div
      className={className ? `${styles.scroll} ${className}` : styles.scroll}
      role="region"
      aria-label={label}
      tabIndex={0}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
