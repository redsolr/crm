import { computeCenterShift } from "../use-screen-centered";

describe("computeCenterShift", () => {
  it("shifts toward the target when there is slack", () => {
    // Natural center 800, screen center 660 → shift -140, well within
    // ±300 of slack.
    expect(computeCenterShift(800, 660, -300, 300)).toBe(-140);
  });

  it("clamps to the left slack (narrow window — old sub-1440 behavior)", () => {
    // Wants -140 but only 20px of room: the clamp, not a breakpoint,
    // degrades to near-flex-centering.
    expect(computeCenterShift(800, 660, -20, 20)).toBe(-20);
  });

  it("clamps to the right slack", () => {
    expect(computeCenterShift(500, 700, -50, 60)).toBe(60);
  });

  it("no-ops when already centered", () => {
    expect(computeCenterShift(660, 660, -300, 300)).toBe(0);
  });
});
