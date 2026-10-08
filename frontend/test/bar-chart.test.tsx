import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { BarChart } from "@/components/bar-chart";

it("keeps long labels/units readable and represents zero with no artificial bar", () => {
  const { container } = render(<BarChart chart={{ kind: "comparison", title: "Exemple", unit: "millions de francs CFA",
    points: [
      { indicatorId: "zero", label: "Région de Saint-Louis", value: 0, formattedValue: "0 millions de francs CFA" },
      { indicatorId: "negative", label: "Région de Dakar", value: -100, formattedValue: "−100 millions de francs CFA" },
    ],
  }} />);
  expect(screen.getByText("Saint-Louis")).toBeDefined();
  expect(screen.getByText("−100 millions de francs CFA")).toBeDefined();
  const bars = container.querySelectorAll<HTMLElement>('[style*="width"]');
  expect(bars[0].style.width).toBe("0%");
  expect(bars[1].style.width).toBe("100%");
});
