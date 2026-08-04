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

  it("on 412: re-reads the fresh version and retries the SAME target", async () => {
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

  it("recovers from TWO conflicts — the interleaved-retries CI race", async () => {
    // The 2026-08-04 shape: the re-read lands between a concurrent
    // write's read and commit, so the second PATCH 412s too; the third
    // re-read finally sees the settled version.
    const api = {
      updateWorkItem: jest
        .fn()
        .mockRejectedValueOnce(conflict())
        .mockRejectedValueOnce(conflict())
        .mockResolvedValueOnce({ workItem: WON }),
      getWorkItem: jest
        .fn()
        .mockResolvedValueOnce({ workItem: { id: "wi_1", version: 4 } })
        .mockResolvedValueOnce({ workItem: { id: "wi_1", version: 5 } }),
    };
    const out = await transitionWithConflictRetry(api, {
      id: "wi_1",
      version: 3,
      state_key: "won",
    });
    expect(out).toBe(WON);
    expect(api.updateWorkItem).toHaveBeenNthCalledWith(
      3,
      "wi_1",
      { state_key: "won" },
      5,
    );
  });

  it("exhausts after MAX_CONFLICT_ATTEMPTS PATCHes — no infinite retry", async () => {
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
    expect(api.updateWorkItem).toHaveBeenCalledTimes(3);
    expect(api.getWorkItem).toHaveBeenCalledTimes(2);
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
