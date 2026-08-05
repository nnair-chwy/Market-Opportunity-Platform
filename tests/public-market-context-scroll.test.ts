import assert from "node:assert/strict";
import test from "node:test";
import { scrollMarketRowIntoList } from "../lib/data/market-list-scroll.ts";

function listFixture(scrollTop: number, clientHeight = 200) {
  const calls: ScrollToOptions[] = [];
  return {
    calls,
    list: {
      scrollTop,
      clientHeight,
      getBoundingClientRect: () => ({ top: 100 }),
      scrollTo: (options: ScrollToOptions) => calls.push(options),
    },
  };
}

test("scrolls a market row down inside the list without page scrolling", () => {
  const fixture = listFixture(100);
  scrollMarketRowIntoList(
    fixture.list as never,
    { getBoundingClientRect: () => ({ top: 330, bottom: 370 }) } as never,
    "smooth",
  );
  assert.deepEqual(fixture.calls, [{ top: 170, behavior: "smooth" }]);
});

test("scrolls a market row up inside the list", () => {
  const fixture = listFixture(300);
  scrollMarketRowIntoList(
    fixture.list as never,
    { getBoundingClientRect: () => ({ top: 70, bottom: 110 }) } as never,
    "auto",
  );
  assert.deepEqual(fixture.calls, [{ top: 270, behavior: "auto" }]);
});

test("does not scroll when the selected row is already visible", () => {
  const fixture = listFixture(100);
  scrollMarketRowIntoList(
    fixture.list as never,
    { getBoundingClientRect: () => ({ top: 150, bottom: 190 }) } as never,
    "smooth",
  );
  assert.deepEqual(fixture.calls, []);
});
