import { reorderWithConflictRetry } from "../use-sales-mutations";
import { ApiError } from "@/lib/api-client";
import type { WorkItem } from "@/lib/workItemsApi";

function conflict(): ApiError {
  return new ApiError({
    status: 412,
    code: "version_conflict",
    message: "If-Match version is stale",
  });
}

const MOVED = { id: "wi_1", version: 8, position: 1536 } as unknown as WorkItem;

describe("reorderWithConflictRetry", () => {
  it("passes through on first success", async () => {
    const api = {
      updateWorkItem: jest.fn().mockResolvedValue({ workItem: MOVED }),
      getWorkItem: jest.fn(),
    };
    const out = await reorderWithConflictRetry(api, {
      id: "wi_1",
      version: 3,
      position: 1536,
    });
    expect(out).toBe(MOVED);
    expect(api.updateWorkItem).toHaveBeenCalledTimes(1);
    expect(api.updateWorkItem).toHaveBeenCalledWith(
      "wi_1",
      { position: 1536 },
      3,
    );
    expect(api.getWorkItem).not.toHaveBeenCalled();
  });

  it("on 412: re-reads the fresh version and retries the SAME rank once", async () => {
    const api = {
      updateWorkItem: jest
        .fn()
        .mockRejectedValueOnce(conflict())
        .mockResolvedValueOnce({ workItem: MOVED }),
      getWorkItem: jest
        .fn()
        .mockResolvedValue({ workItem: { id: "wi_1", version: 7 } }),
    };
    const out = await reorderWithConflictRetry(api, {
      id: "wi_1",
      version: 3,
      position: 1536,
    });
    expect(out).toBe(MOVED);
    expect(api.updateWorkItem).toHaveBeenNthCalledWith(
      1,
      "wi_1",
      { position: 1536 },
      3,
    );
    expect(api.updateWorkItem).toHaveBeenNthCalledWith(
      2,
      "wi_1",
      { position: 1536 },
      7,
    );
  });

  it("a second 412 propagates — no infinite retry", async () => {
    const api = {
      updateWorkItem: jest.fn().mockRejectedValue(conflict()),
      getWorkItem: jest
        .fn()
        .mockResolvedValue({ workItem: { id: "wi_1", version: 7 } }),
    };
    await expect(
      reorderWithConflictRetry(api, { id: "wi_1", version: 3, position: 1536 }),
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
      reorderWithConflictRetry(api, { id: "wi_1", version: 3, position: 1536 }),
    ).rejects.toBe(boom);
    expect(api.getWorkItem).not.toHaveBeenCalled();
  });
});
