import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/stores/use-auth";
import { useAuthStore } from "@/stores/auth.store";

// Mock WorkOS auth (not used in unit tests, but imported transitively via the
// auth sync hook). The package's `./components` subpath is an ESM-only export
// that Jest's CJS resolver can't locate, so we mark this as a `virtual` mock —
// Jest never tries to resolve the real module on disk.
jest.mock(
  "@workos-inc/authkit-nextjs/components",
  () => ({
    useAuth: () => ({ user: null, loading: false }),
  }),
  { virtual: true },
);

describe("useAuth hook (Zustand)", () => {
  beforeEach(() => {
    // Reset store between tests
    useAuthStore.setState({
      user: null,
      loading: false,
      needsOnboarding: false,
      backendToken: null,
    });
  });

  it("should initialize with no user when not authenticated", () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("should reflect user set in store", () => {
    const mockUser = {
      user_id: "user-123",
      email: "test@example.com",
      full_name: "Test User",
      account_id: "account-456",
      roles: ["member"],
      permissions: ["chat.create", "folder.read"],
    };

    useAuthStore.setState({ user: mockUser, backendToken: "token-123" });

    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("should check permissions correctly", () => {
    const mockUser = {
      user_id: "user-123",
      account_id: "account-456",
      roles: ["member"],
      permissions: ["chat.create", "folder.read"],
    };

    useAuthStore.setState({ user: mockUser });

    const { result } = renderHook(() => useAuth());

    expect(result.current.hasPermission("chat.create")).toBe(true);
    expect(result.current.hasPermission("admin.delete")).toBe(false);
  });

  it("should check roles correctly", () => {
    const mockUser = {
      user_id: "user-123",
      roles: ["member", "admin"],
      permissions: [],
    };

    useAuthStore.setState({ user: mockUser });

    const { result } = renderHook(() => useAuth());

    expect(result.current.hasRole("member")).toBe(true);
    expect(result.current.hasRole("owner")).toBe(false);
  });

  it("should clear user on store reset", () => {
    const mockUser = {
      user_id: "user-123",
      email: "test@example.com",
    };

    useAuthStore.setState({ user: mockUser, backendToken: "token-123" });

    const { result } = renderHook(() => useAuth());
    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      useAuthStore.getState().reset();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});
