import { describe, expect, it } from "vitest";
import { ApiCallError, describeApiError } from "./apiClient";

describe("describeApiError", () => {
  it("includes Reve's structured params in the visible message", () => {
    const error = new ApiCallError(400, {
      error: "One of the request parameters has an invalid value.",
      errorCode: "INVALID_PARAMETER_VALUE",
      params: { invalid: ["references.0.layout.regions.3.bbox"] },
    });

    expect(describeApiError(error)).toBe(
      'INVALID_PARAMETER_VALUE: One of the request parameters has an invalid value. · {"invalid":["references.0.layout.regions.3.bbox"]}',
    );
  });

  it("preserves the concise message when no params are present", () => {
    const error = new ApiCallError(400, {
      error: "One of the request parameters has an invalid value.",
      errorCode: "INVALID_PARAMETER_VALUE",
    });

    expect(describeApiError(error)).toBe(
      "INVALID_PARAMETER_VALUE: One of the request parameters has an invalid value.",
    );
  });

  it("bounds unusually large params before displaying them", () => {
    const error = new ApiCallError(400, {
      error: "Invalid.",
      params: { value: "x".repeat(1000) },
    });

    const message = describeApiError(error);
    expect(message).toMatch(/^Invalid\. · /);
    expect(message.endsWith("…")).toBe(true);
    expect(message.length).toBeLessThan(630);
  });
});
