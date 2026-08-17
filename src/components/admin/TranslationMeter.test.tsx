import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TranslationMeter } from "./TranslationMeter";

describe("TranslationMeter", () => {
  it("cho biết còn thiếu bao nhiêu mục — việc khó nhất khi song ngữ là biết mình thiếu gì", () => {
    render(<TranslationMeter locale="en" done={3} total={8} />);
    expect(screen.getByText(/EN thiếu 3\/8/i)).toBeInTheDocument();
  });
  it("đủ bản dịch thì không cảnh báo", () => {
    render(<TranslationMeter locale="en" done={8} total={8} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
