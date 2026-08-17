import { Badge } from "@/components/ui/Badge";
import { Chip } from "@/components/ui/Chip";
import type { AppCard as AppCardRow } from "@/server/content/queries";
import styles from "./AppCard.module.css";

/**
 * Dữ liệu một thẻ ứng dụng.
 *
 * Cố ý **không** dùng thẳng `AppCard` của `queries.ts`: `status` là chuyện của
 * CMS (nháp / đã đăng / lưu trữ), thẻ công khai chỉ hiện app đã đăng nên nó
 * không có gì để nói. Bỏ trường ra khỏi kiểu để nơi gọi không tưởng rằng thẻ
 * biết vẽ trạng thái biên tập.
 *
 * `repoUrl` là tuỳ chọn vì danh sách thẻ (`listApps`) không tải trường này; khi
 * có thì thẻ mới dựng liên kết GitHub.
 */
export type AppCardData = Omit<AppCardRow, "status"> & {
  repoUrl?: string | null;
};

export type AppCardProps = {
  app: AppCardData;
  /** Tiền tố ngôn ngữ của mọi liên kết trong thẻ. */
  locale: string;
  /**
   * Nhãn huy hiệu trạng thái, **đã dịch**. Không có nhãn thì không dựng huy
   * hiệu: thà thiếu huy hiệu còn hơn hiện tên khoá kỹ thuật cho người đọc.
   */
  statusLabel?: string;
  /** Nhãn liên kết repo, đã dịch. Ví dụ "Xem trên GitHub". */
  repoLabel?: string;
};

/**
 * Thẻ ứng dụng trong lưới trang chủ. Hình khối chép từ `.m-card` của mockup.
 *
 * Bất biến quan trọng nhất (design-rules §1): **tên hiển thị là tiêu đề, slug
 * repo chỉ là chữ mono phụ**. Slug không bao giờ được leo vào thẻ tiêu đề.
 */
export function AppCard({ app, locale, statusLabel, repoLabel }: AppCardProps) {
  // Repo riêng tư thì không dựng liên kết: bấm vào chỉ ra trang 404 của GitHub.
  const repoHref = !app.isRepoPrivate && app.repoUrl ? app.repoUrl : null;

  return (
    <article className={styles.card}>
      <div className={styles.top}>
        <h3 className={styles.name}>
          <a className={styles.nameLink} href={`/${locale}/apps/${app.slug}`}>
            {app.name}
          </a>
        </h3>
        {statusLabel ? <Badge kind={app.integration}>{statusLabel}</Badge> : null}
      </div>

      <p className={styles.slug}>
        {repoHref && repoLabel ? (
          <a
            className={styles.slugLink}
            href={repoHref}
            aria-label={`${repoLabel}: ${app.slug}`}
            rel="noreferrer"
            target="_blank"
          >
            {app.slug}
          </a>
        ) : (
          app.slug
        )}
      </p>

      {app.tagline ? <p className={styles.tagline}>{app.tagline}</p> : null}

      {app.techStack.length > 0 ? (
        <div className={styles.chips}>
          {app.techStack.map((tech) => (
            <Chip key={tech}>{tech}</Chip>
          ))}
        </div>
      ) : null}
    </article>
  );
}
