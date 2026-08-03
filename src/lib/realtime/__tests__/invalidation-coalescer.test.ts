import { createInvalidationCoalescer } from "../invalidation-coalescer";

describe("createInvalidationCoalescer", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("fires immediately on the leading edge", () => {
    const fire = jest.fn();
    const c = createInvalidationCoalescer(fire, 400);
    c.schedule();
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it("collapses a burst into leading + one trailing fire", () => {
    const fire = jest.fn();
    const c = createInvalidationCoalescer(fire, 400);
    for (let i = 0; i < 25; i++) c.schedule();
    expect(fire).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(400);
    expect(fire).toHaveBeenCalledTimes(2);
    // Quiet afterwards — nothing else fires.
    jest.advanceTimersByTime(2_000);
    expect(fire).toHaveBeenCalledTimes(2);
  });

  it("a sustained stream fires at most once per window", () => {
    const fire = jest.fn();
    const c = createInvalidationCoalescer(fire, 400);
    // 4 seconds of frames every 50ms = 80 frames.
    for (let t = 0; t < 4_000; t += 50) {
      c.schedule();
      jest.advanceTimersByTime(50);
    }
    jest.advanceTimersByTime(400);
    // ≤ 1 leading + one per 400ms window ≈ 11; the point is bounded,
    // not 80.
    expect(fire.mock.calls.length).toBeLessThanOrEqual(12);
    expect(fire.mock.calls.length).toBeGreaterThanOrEqual(10);
  });

  it("dispose drops the pending trailing fire", () => {
    const fire = jest.fn();
    const c = createInvalidationCoalescer(fire, 400);
    c.schedule();
    c.schedule();
    c.dispose();
    jest.advanceTimersByTime(1_000);
    expect(fire).toHaveBeenCalledTimes(1);
  });
});
