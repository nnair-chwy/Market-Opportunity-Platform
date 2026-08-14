export const INVESTIGATION_LEAD_COLORS = [
  "#2f6bdb",
  "#d85b3f",
  "#7a4db3",
  "#118a72",
  "#c48a12",
  "#c7477a",
] as const;

export function investigationLeadColor(index: number) {
  return INVESTIGATION_LEAD_COLORS[index % INVESTIGATION_LEAD_COLORS.length];
}
