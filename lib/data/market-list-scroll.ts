type ScrollContainer = Pick<
  HTMLElement,
  "clientHeight" | "getBoundingClientRect" | "scrollTo" | "scrollTop"
>;
type ScrollRow = Pick<HTMLElement, "getBoundingClientRect">;

export function scrollMarketRowIntoList(
  list: ScrollContainer,
  row: ScrollRow,
  behavior: ScrollBehavior,
) {
  const listRect = list.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  const rowTop = rowRect.top - listRect.top + list.scrollTop;
  const rowBottom = rowRect.bottom - listRect.top + list.scrollTop;
  const visibleBottom = list.scrollTop + list.clientHeight;
  let nextTop = list.scrollTop;

  if (rowTop < list.scrollTop) nextTop = rowTop;
  else if (rowBottom > visibleBottom) nextTop = rowBottom - list.clientHeight;
  else return;

  list.scrollTo({ top: Math.max(0, nextTop), behavior });
}
