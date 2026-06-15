import { describe, expect, test } from "bun:test";
import { deepMerge } from "../../src/resolve.ts";

describe("deepMerge - Characterization Tests", () => {
  describe("object merging (base + override)", () => {
    test("simple merge - override replaces base value", () => {
      const base = { key: "base_value" };
      const override = { key: "override_value" };
      const result = deepMerge(base, override);
      expect(result).toEqual({ key: "override_value" });
    });

    test("merge - base keeps unchanged values", () => {
      const base = { a: 1 };
      const override = { b: 2 };
      const result = deepMerge(
        base as Record<string, unknown>,
        override as Record<string, unknown>,
      );
      expect(result as Record<string, unknown>).toEqual({ a: 1, b: 2 });
    });

    test("merge - override adds new keys", () => {
      const base = { a: 1 };
      const override = { b: 2 };
      const result = deepMerge(base as Record<string, unknown>, override);
      expect(result).toEqual({ a: 1, b: 2 } as Record<string, unknown>);
    });
  });

  describe("scalar replacement (not merging)", () => {
    test("override string scalar", () => {
      const base = { key: "base_value" };
      const override = { key: "override_value" };
      const result = deepMerge(base, override);
      expect(result).toEqual({ key: "override_value" });
    });

    test("override number scalar", () => {
      const base = { key: 123 };
      const override = { key: 456 };
      const result = deepMerge(base, override);
      expect(result).toEqual({ key: 456 });
    });

    test("override boolean scalar", () => {
      const base = { key: true };
      const override = { key: false };
      const result = deepMerge(base, override);
      expect(result).toEqual({ key: false });
    });

    test("override null with value", () => {
      const base = { key: null };
      const override = { key: "value" };
      const result = deepMerge(base as Record<string, unknown>, override);
      expect(result).toEqual({ key: "value" });
    });

    test("override value with null", () => {
      const base = { key: "value" };
      const override = { key: null };
      const result = deepMerge(base as Record<string, unknown>, override);
      expect(result).toEqual({ key: null });
    });
  });

  describe("array replacement (not merging)", () => {
    test("override replaces entire array", () => {
      const base = { items: ["a", "b", "c"] };
      const override = { items: ["x", "y"] };
      const result = deepMerge(base, override);
      expect(result).toEqual({ items: ["x", "y"] });
    });

    test("override empty array with values", () => {
      const base = { items: [] as unknown[] };
      const override = { items: ["a", "b"] };
      const result = deepMerge(base, override);
      expect(result).toEqual({ items: ["a", "b"] });
    });

    test("override array with empty array", () => {
      const base = { items: ["a", "b"] };
      const override = { items: [] as unknown[] };
      const result = deepMerge(base as Record<string, unknown>, override);
      expect(result).toEqual({ items: [] });
    });

    test("override number array", () => {
      const base = { items: [1, 2, 3] };
      const override = { items: [4, 5, 6] };
      const result = deepMerge(base, override);
      expect(result).toEqual({ items: [4, 5, 6] });
    });

    test("override nested array", () => {
      const base = {
        items: [
          [1, 2],
          [3, 4],
        ],
      };
      const override = { items: [[5, 6]] };
      const result = deepMerge(base, override);
      expect(result).toEqual({ items: [[5, 6]] });
    });

    test("override array of objects", () => {
      const base = { items: [{ a: 1 }, { b: 2 }] };
      const override = { items: [{ c: 3 }] };
      const result = deepMerge(
        base as Record<string, unknown>,
        override as Record<string, unknown>,
      );
      expect(result as Record<string, unknown>).toEqual({ items: [{ c: 3 }] });
    });
  });

  describe("nested objects", () => {
    test("merge nested objects", () => {
      const base = { config: { a: 1 } };
      const override = { config: { b: 2 } };
      const result = deepMerge(
        base as Record<string, unknown>,
        override as Record<string, unknown>,
      );
      expect(result as Record<string, unknown>).toEqual({ config: { a: 1, b: 2 } });
    });

    test("merge deeply nested objects", () => {
      const base = { config: { a: 1, nested: { x: 10 } } };
      const override = {
        config: {
          b: 2,
          nested: { y: 20 },
        },
      };
      const result = deepMerge(
        base as Record<string, unknown>,
        override as Record<string, unknown>,
      );
      expect(result as Record<string, unknown>).toEqual({
        config: { a: 1, b: 2, nested: { x: 10, y: 20 } },
      });
    });

    test("merge with multiple levels of nesting", () => {
      const base = {
        level1: {
          level2: {
            level3: {
              a: 1,
            },
          },
        },
      };
      const override = {
        level1: {
          level2: {
            level3: {
              b: 2,
            },
          },
        },
      };
      const result = deepMerge(
        base as Record<string, unknown>,
        override as Record<string, unknown>,
      );
      expect(result as Record<string, unknown>).toEqual({
        level1: {
          level2: {
            level3: {
              a: 1,
              b: 2,
            },
          },
        },
      });
    });

    test("override object replaces nested object in base", () => {
      const base = { key: { nested: "value" } };
      const override = { key: "string" };
      const result = deepMerge(base as Record<string, unknown>, override);
      expect(result).toEqual({ key: "string" });
    });

    test("override scalar with object", () => {
      const base = { key: "string" };
      const override = { key: { a: 1, b: 2 } };
      const result = deepMerge(base as Record<string, unknown>, override);
      expect(result).toEqual({ key: { a: 1, b: 2 } });
    });

    test("override array with object", () => {
      const base = { key: [1, 2, 3] };
      const override = { key: { a: 1 } };
      const result = deepMerge(base as Record<string, unknown>, override);
      expect(result).toEqual({ key: { a: 1 } });
    });

    test("override object with array", () => {
      const base = { key: { a: 1, b: 2 } };
      const override = { key: ["x", "y"] };
      const result = deepMerge(base as Record<string, unknown>, override);
      expect(result).toEqual({ key: ["x", "y"] });
    });
  });

  describe("edge cases and quirks", () => {
    test("empty base and override", () => {
      const base = {};
      const override = {};
      const result = deepMerge(base, override);
      expect(result).toEqual({});
    });

    test("QUirk: base object is not mutated", () => {
      const base = { a: 1 };
      const override = { b: 2 };
      const originalBase = { ...base };
      deepMerge(base, override);
      expect(base).toEqual(originalBase);
    });

    test("override object is not mutated", () => {
      const base = { a: 1 };
      const override = { b: 2 };
      const originalOverride = { ...override };
      deepMerge(base, override);
      expect(override).toEqual(originalOverride);
    });

    test("QUirk: merging object with null values", () => {
      const base = { a: null, b: 2 };
      const override = { a: 1, c: null };
      const result = deepMerge(
        base as Record<string, unknown>,
        override as Record<string, unknown>,
      );
      expect(result as Record<string, unknown>).toEqual({ a: 1, b: 2, c: null });
    });

    test("QUirk: merging object with undefined values", () => {
      const base = { a: undefined, b: 2 };
      const override = { a: 1, c: undefined };
      const result = deepMerge(
        base as Record<string, unknown>,
        override as Record<string, unknown>,
      );
      expect(result as Record<string, unknown>).toEqual({ a: 1, b: 2, c: undefined });
    });

    test("null in base - overridden as scalar", () => {
      const base = { key: null };
      const override = { key: "value" };
      const result = deepMerge(base as Record<string, unknown>, override);
      expect(result).toEqual({ key: "value" });
    });

    test("null in override - replaces with null", () => {
      const base = { key: { nested: "value" } as Record<string, unknown> };
      const override = { key: null };
      const result = deepMerge(
        base as Record<string, unknown>,
        override as Record<string, unknown>,
      );
      expect(result).toEqual({ key: null });
    });

    test("QUirk: undefined not treated as object", () => {
      const base = { key: undefined };
      const override = { key: { nested: "value" } };
      const result = deepMerge(
        base as Record<string, unknown>,
        override as Record<string, unknown>,
      );
      // Undefined is not an object, so it gets replaced
      expect(result).toEqual({ key: { nested: "value" } });
    });
  });

  describe("complex structures", () => {
    test("merge complex nested structure", () => {
      const base = {
        scalar: "base",
        array: [1, 2],
        object: { a: 1, b: 2 },
      };
      const override = {
        scalar: "override",
        array: [3, 4],
        object: { b: 3, c: 4 },
      };
      const result = deepMerge(
        base as Record<string, unknown>,
        override as Record<string, unknown>,
      );
      expect(result as Record<string, unknown>).toEqual({
        scalar: "override",
        array: [3, 4],
        object: { a: 1, b: 3, c: 4 },
      });
    });
  });
});
