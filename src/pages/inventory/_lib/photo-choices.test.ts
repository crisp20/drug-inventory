import { describe, expect, it } from "vitest";
import type { PhotoMatch } from "../_hooks/use-photo-import.ts";
import { applyKeepChoice, photosToUpload, splitMatches } from "./photo-choices.ts";

function match(drugId: string, hasPhoto: boolean): PhotoMatch {
  return {
    drugId,
    fileName: `${drugId}.jpg`,
    file: new File([], `${drugId}.jpg`),
    name: `Drug ${drugId}`,
    hasPhoto,
    photoUrl: hasPhoto ? `https://x/${drugId}` : null,
  };
}

const matched = [match("1", false), match("2", true), match("3", true)];
const { replacing } = splitMatches(matched);

describe("photo upload choices", () => {
  it("replaces every current picture by default", () => {
    expect(photosToUpload(matched, new Set()).map((m) => m.drugId)).toEqual(["1", "2", "3"]);
  });

  it("leaves out replacements kept current, but always adds new pictures", () => {
    expect(photosToUpload(matched, new Set(["1", "2"])).map((m) => m.drugId)).toEqual(["1", "3"]);
  });

  it("applies a bulk choice to the ticked ones only", () => {
    const keep = applyKeepChoice(new Set(), replacing, new Set(["3"]), "keep");
    expect([...keep]).toEqual(["3"]);
    expect([...applyKeepChoice(keep, replacing, new Set(["3"]), "file")]).toEqual([]);
  });

  it("applies a bulk choice to every replacement when nothing is ticked", () => {
    expect([...applyKeepChoice(new Set(), replacing, new Set(), "keep")].sort()).toEqual(["2", "3"]);
  });
});
