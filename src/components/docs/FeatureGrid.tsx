import type { ResolvedFeature } from "@/server/content/queries";
import { FallbackNotice } from "./FallbackNotice";
import styles from "./FeatureGrid.module.css";

export type FeatureGridProps = {
  features: ResolvedFeature[];
  /** Tiêu đề khối, đã dịch. Ví dụ "Tính năng". */
  title: string;
  /** Ngôn ngữ người đọc đang yêu cầu. */
  locale: string;
  /** Câu báo đang đọc bản ngôn ngữ khác. */
  fallbackLabel: string;
};

/**
 * Lưới tính năng của trang ứng dụng (mockup màn 02, `.m-feats`).
 *
 * Cờ fallback đặt trên **từng ô**: bản dịch hoàn thiện không đều, một ứng dụng
 * hay có vài tính năng đã dịch và vài tính năng chưa. Báo gộp một lần ở đầu
 * khối sẽ nói sai về phần lớn số ô.
 *
 * Không tính năng nào thì không dựng tiêu đề "Tính năng" cho một khối trống.
 */
export function FeatureGrid({ features, title, locale, fallbackLabel }: FeatureGridProps) {
  if (features.length === 0) return null;

  return (
    <section className={styles.block}>
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.grid}>
        {features.map((feature) => (
          <article className={styles.card} key={feature.id}>
            <h3 className={styles.name}>{feature.title}</h3>
            <FallbackNotice
              shownLocale={feature.locale}
              wantedLocale={locale}
              label={fallbackLabel}
            />
            {feature.description ? <p className={styles.desc}>{feature.description}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
