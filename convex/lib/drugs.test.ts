import { describe, expect, it } from "vitest";
import { matchesAllWords, packagesFirst, searchWords } from "./drugs";

describe("packagesFirst", () => {
  it("moves drugs with package forms up, keeping order within each group", () => {
    const drugs = [
      { id: "a", packages: [] },
      { id: "b", packages: [1] },
      { id: "c", packages: [] },
      { id: "d", packages: [1, 2] },
    ];
    expect(packagesFirst(drugs).map((d) => d.id)).toEqual(["b", "d", "a", "c"]);
  });
});

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
