import { describe, expect, test } from "bun:test";
import { parseJsonc } from "../../src/jsonc.ts";

describe("parseJsonc - Characterization Tests", () => {
  describe("basic JSONC (with comments)", () => {
    test("single-line comments after values", () => {
      const result = parseJsonc(`{
        "key": "value" // this is a comment
      }`);
      expect(result).toEqual({ key: "value" });
    });

    test("single-line comments on their own line", () => {
      const result = parseJsonc(`{
        // comment
        "key": "value"
      }`);
      expect(result).toEqual({ key: "value" });
    });

    test("multi-line block comments", () => {
      const result = parseJsonc(`{
        /* block comment */
        "key": "value"
      }`);
      expect(result).toEqual({ key: "value" });
    });

    test("block comment at end of file", () => {
      const result = parseJsonc(`{
        "key": "value"
      } /* end comment */`);
      expect(result).toEqual({ key: "value" });
    });

    test("multiple block comments", () => {
      const result = parseJsonc(`{
        /* comment 1 */
        "key1": "value1",
        /* comment 2 */
        "key2": "value2"
      }`);
      expect(result).toEqual({ key1: "value1", key2: "value2" });
    });

    test("inline block comments", () => {
      const result = parseJsonc(`{
        "key": "value" /* inline comment */
      }`);
      expect(result).toEqual({ key: "value" });
    });
  });

  describe("trailing commas", () => {
    test("trailing comma in object", () => {
      const result = parseJsonc(`{
        "key": "value",
      }`);
      expect(result).toEqual({ key: "value" });
    });

    test("trailing comma in array", () => {
      const result = parseJsonc(`{
        "items": [1, 2, 3,]
      }`);
      expect(result).toEqual({ items: [1, 2, 3] });
    });

    test("multiple trailing commas", () => {
      const result = parseJsonc(`{
        "key1": "value1",
        "key2": "value2",
      }`);
      expect(result).toEqual({ key1: "value1", key2: "value2" });
    });

    test("trailing comma in nested array", () => {
      const result = parseJsonc(`{
        "items": [[1, 2,], [3, 4,],]
      }`);
      expect(result).toEqual({
        items: [
          [1, 2],
          [3, 4],
        ],
      });
    });
  });

  describe("comments + trailing commas combined", () => {
    test("comments with trailing commas", () => {
      const result = parseJsonc(`{
        // comment 1
        "key1": "value1", // inline comment
        "key2": "value2", // inline comment
      }`);
      expect(result).toEqual({ key1: "value1", key2: "value2" });
    });

    test("block comments with trailing commas", () => {
      const result = parseJsonc(`{
        /* comment */
        "key": "value",
      }`);
      expect(result).toEqual({ key: "value" });
    });
  });

  describe("edge cases and quirks", () => {
    test("QUirk: // inside string removes closing quote and rest of line", () => {
      // The regex removes // comment?" including the closing quote!
      // This leaves an unterminated string -> error
      expect(() =>
        parseJsonc(`{
        "url": "https://example.com // comment?"
      }`),
      ).toThrow();
    });

    test("QUirk: preserves http:// with colon", () => {
      const result = parseJsonc(`{
        "url": "http://example.com"
      }`);
      expect(result).toEqual({ url: "http://example.com" });
    });

    test("QUirk: removes // after colon in non-URL context", () => {
      const result = parseJsonc(`{
        "key": "value" // comment after
      }`);
      expect(result).toEqual({ key: "value" });
    });

    test("empty JSONC", () => {
      const result = parseJsonc("{}");
      expect(result).toEqual({});
    });

    test("QUirk: JSONC with only whitespace and comments throws error", () => {
      // After removing comments, there's nothing left to parse
      expect(() => {
        parseJsonc(`
        // comment
        /* block comment */
      `);
      }).toThrow();
    });

    test("valid JSON without comments or trailing commas", () => {
      const result = parseJsonc(`{"key": "value", "arr": [1, 2, 3]}`);
      expect(result).toEqual({ key: "value", arr: [1, 2, 3] });
    });

    test("nested objects with comments", () => {
      const result = parseJsonc(`{
        "outer": {
          // inner comment
          "inner": "value",
        },
      }`);
      expect(result).toEqual({ outer: { inner: "value" } });
    });

    test("arrays with comments", () => {
      const result = parseJsonc(`{
        "items": [
          1, // first
          2, // second
          3, // third
        ],
      }`);
      expect(result).toEqual({ items: [1, 2, 3] });
    });

    test("QUirk: malformed block comment - missing closing */", () => {
      // This should throw an error as it's invalid JSON
      expect(() => {
        parseJsonc(`{
          "key": "value"
          /* missing closing
        }`);
      }).toThrow();
    });

    test("QUirk: // inside string removes rest of line including closing quote", () => {
      // The regex removes // and everything after, even inside strings
      expect(() => {
        parseJsonc(`{
          "text": "this is // a comment inside string"
        }`);
      }).toThrow();
    });

    test("QUirk: block comment inside string is NOT preserved - gets removed", () => {
      const result = parseJsonc(`{
        "text": "this is /* a comment */ inside string"
      }`);
      // The block comment regex removes /* comment */ even inside strings
      expect(result).toEqual({ text: "this is  inside string" });
    });

    test("QUirk: http:// works (colon before //), but second // in string fails", () => {
      // http:// is preserved because : is before //
      // But // after path/ is not preceded by :, so it's removed
      expect(() => {
        parseJsonc(`{
          "text": "http://example.com/path // comment"
        }`);
      }).toThrow();
    });
  });

  describe("complex structures", () => {
    test("full stack-like structure with comments and trailing commas", () => {
      const result = parseJsonc(`{
        "name": "test-stack",
        "description": "A test stack", // description
        "opencode": {
          "model": "openai:gpt-4o",
          "small_model": "openai:gpt-4o-mini",
        },
        "omo": {
          "default_model": "openai:gpt-4o-mini",
          /* agent models */
          "agents": {
            "oracle": "openai:gpt-4o",
          },
        },
      }`);
      expect(result).toEqual({
        name: "test-stack",
        description: "A test stack",
        opencode: {
          model: "openai:gpt-4o",
          small_model: "openai:gpt-4o-mini",
        },
        omo: {
          default_model: "openai:gpt-4o-mini",
          agents: {
            oracle: "openai:gpt-4o",
          },
        },
      });
    });
  });
});
