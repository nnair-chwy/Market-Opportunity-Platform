import type { EvidenceStatus, QualityStatus } from "@/lib/data";
import styles from "./evidence.module.css";

export function EvidenceStatusBadge({
  status,
}: {
  status: EvidenceStatus;
}) {
  return (
    <span
      className={`${styles.badge} ${styles[`evidence${status}`]}`}
      aria-label={`Evidence status: ${status}`}
    >
      {status}
    </span>
  );
}

export function QualityStatusBadge({ status }: { status: QualityStatus }) {
  return (
    <span
      className={`${styles.badge} ${styles[`quality${status}`]}`}
      aria-label={`Quality status: ${status}`}
    >
      Quality: {status}
    </span>
  );
}
