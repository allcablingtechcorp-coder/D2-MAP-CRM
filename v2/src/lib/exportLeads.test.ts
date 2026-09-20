import { describe, expect, it } from "vitest";
import { csvCell } from "./exportLeads";
describe("spreadsheet export safety", () => {
  it("quotes delimiters and blocks formulas including leading whitespace", () => {
    expect(csvCell('Company, "Inc"')).toBe('"Company, ""Inc"""');
    for (const value of ["=1+1", " +SUM(A1)", "@value", "-1+2", "\tformula"]) expect(csvCell(value)).toBe(`"'${value}"`);
  });
});
