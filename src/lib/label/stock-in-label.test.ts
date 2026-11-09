import { describe, expect, it } from "vitest";
import {
  defaultLabelCopies,
  hasReprintableLabel,
  MAX_LABEL_COPIES,
  stockInLabelFromMovement,
  stockInQrText,
  stockInTags,
} from "./stock-in-label.ts";
import { buildCpclJob } from "./bitmap.ts";
import { userInitials } from "@/convex/lib/initials.ts";

describe("Stock In label", () => {
  it("writes the QR text exactly like the ACP samples", () => {
    expect(
      stockInQrText({
        drugId: "13103",
        packageForm: "100/Box x1",
        dangerousDrug: true,
        initials: "HS",
        eight: false,
      }),
    ).toBe("13103;100/Box x1;DDA_HS");
    expect(
      stockInQrText({
        drugId: "5467",
        packageForm: "28/Box x1",
        dangerousDrug: false,
        initials: "HS",
        eight: true,
      }),
    ).toBe("5467;28/Box x1;_HS*");
    expect(
      stockInQrText({
        drugId: "1",
        packageForm: "60/Box x1",
        dangerousDrug: true,
        initials: "HS",
        eight: true,
      }),
    ).toBe("1;60/Box x1;DDA_HS*");
  });

  it("stacks DDA above 8", () => {
    expect(stockInTags({ dangerousDrug: true, eight: true })).toEqual([
      "DDA",
      "8",
    ]);
    expect(stockInTags({ dangerousDrug: false, eight: true })).toEqual(["8"]);
    expect(stockInTags({ dangerousDrug: false, eight: false })).toEqual([]);
  });

  it("prints one label per package received, capped", () => {
    expect(defaultLabelCopies(3)).toBe(3);
    expect(defaultLabelCopies(5000)).toBe(MAX_LABEL_COPIES);
  });

  it("asks the printer for the number of copies", () => {
    const text = new TextDecoder().decode(
      buildCpclJob(new Uint8Array(16), 8, 2, 5),
    );
    expect(text.startsWith("! 0 200 200 2 5\r\n")).toBe(true);
  });

  it("uses admin-set initials before the name", () => {
    expect(userInitials({ name: "Hubert Suen" })).toBe("HS");
    expect(userInitials({ name: "Hubert Suen", initials: "HBS" })).toBe("HBS");
    expect(userInitials(null)).toBe("");
  });

  it("rebuilds a reprint with the saved initials and 8 mark", () => {
    const label = stockInLabelFromMovement(
      {
        drugCode: "13103",
        brandName: "Lexotan 3mg Tab",
        drugName: "Bromazepam 3mg Tab",
        qtyPerUnit: 100,
        baseUnit: "Box",
        unitCount: 1,
        userName: "Hubert Suen",
        userInitials: "HBS",
        eight: true,
      },
      null,
      true,
    );
    expect(label).toMatchObject({
      packageForm: "100/Box x1",
      baseUnit: "Box",
      initials: "HBS",
      eight: true,
      dangerousDrug: true,
    });
    expect(
      stockInLabelFromMovement(
        {
          drugCode: "1",
          brandName: "",
          drugName: "X",
          qtyPerUnit: 1,
          baseUnit: "Box",
          unitCount: 1,
          userName: "Mary Lee",
        },
        null,
        false,
      ).initials,
    ).toBe("ML");
  });

  it("offers reprints for canister fills and Stock Ins that got labels", () => {
    expect(hasReprintableLabel({ kind: "in", barcode: "" })).toBe(true);
    expect(
      hasReprintableLabel({
        kind: "in",
        barcode: "9312345678907",
        labels: true,
      }),
    ).toBe(true);
    expect(hasReprintableLabel({ kind: "in", barcode: "9312345678907" })).toBe(
      false,
    );
    expect(hasReprintableLabel({ kind: "out", barcode: "" })).toBe(false);
    expect(
      hasReprintableLabel({ kind: "out", barcode: "1", canister: {} }),
    ).toBe(true);
    expect(hasReprintableLabel({ kind: "in", barcode: "", undo: {} })).toBe(
      false,
    );
  });
});
