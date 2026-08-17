import { Badge, type StatusKind } from "./Badge";
import styles from "./WireDiagram.module.css";

export type WireItem = {
  /** Tên hiển thị, viết hoa đầu từ. Không bao giờ là slug repo. */
  name: string;
  desc?: string;
  integration: StatusKind;
};

export type WireDiagramProps = {
  items: WireItem[];
  /** Nhãn của trục dọc, ví dụ "IDMS". */
  coreLabel: string;
  /** Nhãn huy hiệu theo trạng thái — chỉ là chữ, để dịch được. */
  labels?: Partial<Record<StatusKind, string>>;
  /** Chú thích từng kiểu nét trong chú giải. */
  legendLabels?: Partial<Record<StatusKind, string>>;
  /** Tên gọi của danh sách chú giải, dùng làm accessible name. */
  legendTitle?: string;
  /** Tên gọi của danh sách nhánh, dùng làm accessible name. */
  itemsTitle?: string;
};

const defaultLabels: Record<StatusKind, string> = {
  core: "Lõi",
  connected: "Đã nối",
  planned: "Dự kiến nối",
  standalone: "Độc lập",
  private: "Repo riêng tư",
};

const defaultLegendLabels: Record<StatusKind, string> = {
  core: "Thuộc lõi IDMS",
  connected: "Đã nối OAuth",
  planned: "Dự kiến nối",
  standalone: "Chạy độc lập",
  private: "Repo riêng tư",
};

/** Bốn kiểu nét cần giải thích; "core" dùng chung nét với "connected". */
const legendOrder: StatusKind[] = ["connected", "planned", "private", "standalone"];

/**
 * Sơ đồ đấu nối: IDMS là trục dọc, mỗi ứng dụng là một nhánh.
 * Kiểu nét mang thông tin thật (liền = đã nối, đứt = dự kiến hoặc repo riêng tư,
 * không nét = độc lập) nên sơ đồ **luôn** kèm chú giải.
 */
export function WireDiagram({
  items,
  coreLabel,
  labels,
  legendLabels,
  legendTitle = "Chú giải",
  itemsTitle = "Ứng dụng trong hệ sinh thái",
}: WireDiagramProps) {
  const badgeText = { ...defaultLabels, ...labels };
  const legendText = { ...defaultLegendLabels, ...legendLabels };

  return (
    <div>
      <div className={styles.wire} data-empty={items.length === 0 ? "true" : undefined}>
        <div className={styles.spine}>
          <span className={styles.core}>{coreLabel}</span>
        </div>

        <ul className={styles.rows} aria-label={itemsTitle}>
          {items.map((item, index) => (
            <li className={styles.row} key={`${item.name}-${index}`}>
              <i className={styles.lead} data-integration={item.integration} aria-hidden="true" />
              <div className={styles.text}>
                <span className={styles.name}>{item.name}</span>
                {item.desc ? <span className={styles.desc}>{item.desc}</span> : null}
              </div>
              <Badge kind={item.integration}>{badgeText[item.integration]}</Badge>
            </li>
          ))}
        </ul>
      </div>

      <ul className={styles.legend} aria-label={legendTitle}>
        {legendOrder.map((kind) => (
          <li className={styles.legendItem} key={kind}>
            <i className={styles.swatch} data-kind={kind} aria-hidden="true" />
            {legendText[kind]}
          </li>
        ))}
      </ul>
    </div>
  );
}
