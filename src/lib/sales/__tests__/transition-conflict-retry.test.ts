import { transitionWithConflictRetry } from "../use-sales-mutations";
import { ApiError } from "@/lib/api-client";
import type { WorkItem } from "@/lib/workItemsApi";

function conflict(): ApiError {
  return new ApiError({
    status: 412,
    code: "version_conflict",
    message: "If-Match version is stale",
  });
}

const WON = { id: "wi_1", version: 7 } as unknown as WorkItem;

describe("transitionWithConflictRetry", () => {
  it("passes through on first success", async () => {
    const api = {
      updateWorkItem: jest.fn().mockResolvedValue({ workItem: WON }),
      getWorkItem: jest.fn(),
    };
    const out = await transitionWithConflictRetry(api, {
      id: "wi_1",
      version: 3,
      state_key: "won",
    });
    expect(out).toBe(WON);
    expect(api.updateWorkItem).toHaveBeenCalledTimes(1);
    expect(api.getWorkItem).not.toHaveBeenCalled();
  });

  it("on 412: re-reads the fresh version and retries the SAME target once", async () => {
    const api = {
      updateWorkItem: jest
        .fn()
        .mockRejectedValueOnce(conflict())
        .mockResolvedValueOnce({ workItem: WON }),
      getWorkItem: jest
        .fn()
        .mockResolvedValue({ workItem: { id: "wi_1", version: 6 } }),
    };
    const out = await transitionWithConflictRetry(api, {
      id: "wi_1",
      version: 3,
      state_key: "won",
    });
    expect(out).toBe(WON);
    expect(api.updateWorkItem).toHaveBeenNthCalledWith(
      1,
      "wi_1",
      { state_key: "won" },
      3,
    );
    expect(api.updateWorkItem).toHaveBeenNthCalledWith(
      2,
      "wi_1",
      { state_key: "won" },
      6,
    );
  });

  it("a second 412 propagates — no infinite retry", async () => {
    const api = {
      updateWorkItem: jest.fn().mockRejectedValue(conflict()),
      getWorkItem: jest
        .fn()
        .mockResolvedValue({ workItem: { id: "wi_1", version: 6 } }),
    };
    await expect(
      transitionWithConflictRetry(api, {
        id: "wi_1",
        version: 3,
        state_key: "won",
      }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(api.updateWorkItem).toHaveBeenCalledTimes(2);
  });

  it("non-412 errors propagate untouched", async () => {
    const boom = new Error("network down");
    const api = {
      updateWorkItem: jest.fn().mockRejectedValue(boom),
      getWorkItem: jest.fn(),
    };
    await expect(
      transitionWithConflictRetry(api, {
        id: "wi_1",
        version: 3,
        state_key: "won",
      }),
    ).rejects.toBe(boom);
    expect(api.getWorkItem).not.toHaveBeenCalled();
  });
});
