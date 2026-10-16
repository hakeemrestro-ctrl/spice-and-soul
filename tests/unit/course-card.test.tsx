import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CourseCard } from "@/components/course-card";
import type { Course } from "@/types";

const mockCourse: Course = {
  id: "abc-123",
  slug: "north-indian-classics",
  title: "North Indian Classics",
  tagline: "From dal to korma",
  description: "Learn North Indian cooking",
  price_cents: 25000,
  difficulty: "Beginner",
  recipe_count: 25,
  image_url: null,
  published: true,
  is_bundle: false,
  bundle_course_ids: null,
  stripe_price_id: null,
  region: null,
  preview_video_url: null,
  created_at: "2026-04-25T00:00:00Z",
};

describe("CourseCard", () => {
  it("renders course title and price", () => {
    render(<CourseCard course={mockCourse} />);
    expect(screen.getByText("North Indian Classics")).toBeInTheDocument();
    expect(screen.getByText("₹250")).toBeInTheDocument();
  });

  it("renders recipe count", () => {
    render(<CourseCard course={mockCourse} />);
    expect(screen.getByText(/25 recipes/i)).toBeInTheDocument();
  });

  it("links to course detail page", () => {
    render(<CourseCard course={mockCourse} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/courses/north-indian-classics");
  });
});
