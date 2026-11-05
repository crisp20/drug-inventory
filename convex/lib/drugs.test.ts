import { describe, expect, it } from "vitest";
import { matchesAllWords, searchWords } from "./drugs";

describe("searchWords", () => {
  it("splits on spaces and punctuation, lowercased", () => {
    expect(searchWords("Abilify 10mg/Tab (Otsuka)")).toEqual(["abilify", "10mg", "tab", "otsuka"]);
  });
});

describe("matchesAllWords", () => {
  const text = "68 Aripiprazole 10mg Tab Abilify 10mg Tab";

  it("matches when every word is a prefix of some drug word", () => {
    expect(matchesAllWords(text, "Abilify 10mg")).toBe(true);
    expect(matchesAllWords(text, "abil 10")).toBe(true);
  });

  it("rejects when any word is missing", () => {
    expect(matchesAllWords(text, "Abilify 5mg")).toBe(false);
    expect(matchesAllWords("70 Solifenacin 10mg Tab Vesicare", "Abilify 10mg")).toBe(false);
  });

  it("does not match a word in the middle of another word", () => {
    expect(matchesAllWords(text, "ify")).toBe(false);
  });
});
