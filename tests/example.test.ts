import { expect, test } from "bun:test";

test("Bun Test framework is working", () => {
  expect(1 + 1).toBe(2);
});

test("TypeScript imports work", () => {
  const value: string = "hello";
  expect(value.length).toBe(5);
});
