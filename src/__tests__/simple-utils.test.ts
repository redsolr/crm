// Simple test for utilities
describe("Test Utils", () => {
  it("should pass basic test", () => {
    expect(true).toBe(true);
  });

  it("should work with mock data", () => {
    const mockUser = {
      user_id: "user-123",
      account_id: "account-456",
      email: "test@example.com",
    };

    expect(mockUser.user_id).toBe("user-123");
    expect(mockUser.account_id).toBe("account-456");
  });
});
