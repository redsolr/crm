// Test helper utilities and mock data
export const mockAuthUser = {
  user_id: "user-123",
  account_id: "account-456",
  email: "test@example.com",
  full_name: "Test User",
  roles: ["member"],
  permissions: ["chat.create", "folder.read", "folder.create"],
};

export const mockApiResponses = {
  subscription: {
    id: "sub-123",
    account_id: "account-456",
    plan_type: "free" as const,
    status: "active" as const,
    current_period_start: "2024-08-01T00:00:00Z",
    current_period_end: "2024-09-01T00:00:00Z",
    price_cents: 0,
    currency: "THB", // THB-first pricing — the catalog bills in baht

  },

  usage: {
    account_id: "account-456",
    period_start: "2024-08-01T00:00:00Z",
    period_end: "2024-08-31T00:00:00Z",
    total_chats: 15,
    total_tokens: 8500,
    total_cost: "0.48",
    by_model: [
      {
        model_name: "gpt-5.4-nano",
        input_tokens: 4200,
        output_tokens: 2800,
        total_tokens: 7000,
        cost: "0.32",
        call_count: 10,
        percentage_of_total: 82,
      },
    ],
    limits: {
      monthly_tokens: 10000,
      monthly_chats: 10,
      tokens_remaining: 1500,
      chats_remaining: -5,
    },
  },
};

// Helper to mock fetch responses
export function mockFetch(responses: Record<string, unknown>) {
  const mockFetch = jest.fn();

  Object.entries(responses).forEach(([url, response]) => {
    mockFetch.mockImplementation((requestUrl: string) => {
      if (requestUrl.includes(url)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(response),
        });
      }
      return Promise.reject(new Error(`Unmocked URL: ${requestUrl}`));
    });
  });

  global.fetch = mockFetch;
  return mockFetch;
}

// Basic test to satisfy Jest
describe("Test Helpers", () => {
  it("should export helper functions", () => {
    expect(mockAuthUser).toBeDefined();
    expect(mockApiResponses).toBeDefined();
    expect(mockFetch).toBeDefined();
  });
});
