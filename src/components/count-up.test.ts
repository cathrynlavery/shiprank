import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CountUp } from "./count-up";

describe("CountUp", () => {
  it("server-renders the target value instead of zero", () => {
    expect(renderToString(createElement(CountUp, { value: 10516123 }))).toContain(
      "+10,516,123",
    );
  });

  it("server-renders PR suffix values", () => {
    expect(
      renderToString(
        createElement(CountUp, { value: 761, signed: false, suffix: "prs" }),
      ),
    ).toContain("761 prs");
  });
});
