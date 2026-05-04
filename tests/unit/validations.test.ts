import { describe, it, expect } from "vitest";
import { CheckoutInputSchema } from "@/lib/validations/checkout";
import { CourseInputSchema } from "@/lib/validations/course";

describe("CheckoutInputSchema", () => {
  it("accepts valid checkout input", () => {
    const result = CheckoutInputSchema.safeParse({
      courseId: "123e4567-e89b-12d3-a456-426614174000",
      email: "test@example.com",
      name: "Aisha Khan",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = CheckoutInputSchema.safeParse({
      courseId: "123e4567-e89b-12d3-a456-426614174000",
      email: "not-an-email",
      name: "Aisha Khan",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID courseId", () => {
    const result = CheckoutInputSchema.safeParse({
      courseId: "not-a-uuid",
      email: "test@example.com",
      name: "Aisha Khan",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = CheckoutInputSchema.safeParse({
      courseId: "123e4567-e89b-12d3-a456-426614174000",
      email: "test@example.com",
      name: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("CourseInputSchema", () => {
  it("accepts valid course input", () => {
    const result = CourseInputSchema.safeParse({
      slug: "north-indian-classics",
      title: "North Indian Classics",
      description: "Learn North Indian cooking",
      price_cents: 25000,
      difficulty: "Beginner",
      recipe_count: 25,
    });
    expect(result.success).toBe(true);
  });

  it("rejects slug with spaces", () => {
    const result = CourseInputSchema.safeParse({
      slug: "north indian",
      title: "North Indian",
      description: "desc",
      price_cents: 25000,
      difficulty: "Beginner",
      recipe_count: 25,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative price_cents", () => {
    const result = CourseInputSchema.safeParse({
      slug: "north-indian",
      title: "North Indian",
      description: "desc",
      price_cents: -100,
      difficulty: "Beginner",
      recipe_count: 25,
    });
    expect(result.success).toBe(false);
  });
});
