import { Badge } from "@/components/ui/Badge";
import { Chip } from "@/components/ui/Chip";
import type { AppDetail } from "@/server/content/queries";
import { FallbackNotice } from "./FallbackNotice";
import styles from "./AppHero.module.css";

export type AppHeroLabels = {
  /** Huy hiệu trạng thái tích hợp, đã dịch. */
  status: string;
  privateRepo: string;
  repo: string;
  apiRepo: string;
  demo: string;
  /** Câu báo đang đọc bản ngôn ngữ khác. */
  fallback: string;
};

export type AppHeroProps = {
  app: AppDetail;
  /** Ngôn ngữ người đọc đang yêu cầu, để so với ngôn ngữ thật của nội dung. */
  locale: string;
  /** Đường dẫn phân cấp, ví dụ "Ứng dụng / Lõi". */
  crumb: string;
  labels: AppHeroLabels;
};

/**
 * Đầu trang ứng dụng (mockup màn 02).
 *
 * Bất biến của design-rules §1: **tên hiển thị là `h1`, slug repo chỉ là chữ
 * mono ở vai phụ trong hàng metadata**. Slug không bao giờ leo lên `h1`.
 *
 * Repo riêng tư thì không dựng liên kết — bấm vào chỉ ra trang 404 của GitHub —
 * mà thay bằng huy hiệu nói thẳng repo đang riêng tư. Liên kết bản chạy thử vẫn
 * giữ: nó là trang web công khai, không phải kho mã.
 */
export function AppHero({ app, locale, crumb, labels }: AppHeroProps) {
  const showRepoLinks = !app.isRepoPrivate;
  // Trạng thái tích hợp đã là "Repo riêng tư" thì thôi, không dựng hai huy hiệu
  // nói cùng một chuyện.
  const showPrivateBadge = app.isRepoPrivate && app.integration !== "private";

  return (
    <header className={styles.hero}>
      <p className={styles.crumb}>{crumb}</p>
      <h1 className={styles.title}>{app.name}</h1>

      <FallbackNotice shownLocale={app.locale} wantedLocale={locale} label={labels.fallback} />

      {app.tagline ? <p className={styles.tagline}>{app.tagline}</p> : null}

      <div className={styles.meta}>
        <span className={styles.slug}>{app.slug}</span>
        <Badge kind={app.integration}>{labels.status}</Badge>
        {showPrivateBadge ? <Badge kind="private">{labels.privateRepo}</Badge> : null}

        {app.techStack.map((tech) => (
          <Chip key={tech}>{tech}</Chip>
        ))}

        <span className={styles.spacer} />

        {showRepoLinks && app.repoUrl ? (
          <a className={styles.link} href={app.repoUrl} rel="noreferrer" target="_blank">
            {labels.repo}
          </a>
        ) : null}
        {showRepoLinks && app.apiRepoUrl ? (
          <a className={styles.link} href={app.apiRepoUrl} rel="noreferrer" target="_blank">
            {labels.apiRepo}
          </a>
        ) : null}
        {app.demoUrl ? (
          <a className={styles.link} href={app.demoUrl} rel="noreferrer" target="_blank">
            {labels.demo}
          </a>
        ) : null}
      </div>

      {app.summary ? <p className={styles.summary}>{app.summary}</p> : null}
    </header>
  );
}
