import { describe, it, expect } from "vitest";
import { requestAccessSchema, loginSchema } from "./auth";

describe("requestAccessSchema", () => {
  it("validates a correct request", () => {
    const result = requestAccessSchema.safeParse({
      email: "john@example.com",
      fullName: "John Smith",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty email", () => {
    const result = requestAccessSchema.safeParse({
      email: "",
      fullName: "John Smith",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = requestAccessSchema.safeParse({
      email: "not-an-email",
      fullName: "John Smith",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = requestAccessSchema.safeParse({
      email: "john@example.com",
      fullName: "",
    });
    expect(result.success).toBe(false);
  });

  it("trims whitespace from name", () => {
    const result = requestAccessSchema.safeParse({
      email: "john@example.com",
      fullName: "  John Smith  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe("John Smith");
    }
  });

  it("rejects whitespace-only name", () => {
    const result = requestAccessSchema.safeParse({
      email: "john@example.com",
      fullName: "   ",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("validates a correct login", () => {
    const result = loginSchema.safeParse({
      email: "john@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({
      email: "bad",
    });
    expect(result.success).toBe(false);
  });
});
