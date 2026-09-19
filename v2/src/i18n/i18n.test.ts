import { describe, expect, it } from "vitest";
import { catalogs, translate, type Locale } from "./translations";

describe("internationalization catalogs", () => {
  const locales: Locale[] = ["pt", "en", "es"];

  it("keeps the same translation keys in all three languages", () => {
    const referenceKeys = Object.keys(catalogs.pt).sort();
    locales.forEach((locale) => expect(Object.keys(catalogs[locale]).sort()).toEqual(referenceKeys));
  });

  it("translates navigation and interpolates values", () => {
    expect(translate("pt", "nav.reports")).toBe("Relatórios");
    expect(translate("en", "nav.reports")).toBe("Reports");
    expect(translate("es", "nav.reports")).toBe("Informes");
    expect(translate("es", "dashboard.activeOpportunities", { count: 4 })).toBe("4 oportunidades activas");
  });
});
