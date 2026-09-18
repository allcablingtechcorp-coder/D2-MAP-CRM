import { describe, expect, it } from "vitest";
import { demoActivities, demoLeads, demoOpportunities } from "../data/demo";
import { createExecutiveReportDocument } from "./exportExecutiveReport";
import type { Locale } from "../i18n/translations";

const twoPixelPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGO8ssLtPwMDAwMTiABhACrWAsU3F82OAAAAAElFTkSuQmCC";

describe("createExecutiveReportDocument", () => {
  it("creates a valid single-page executive PDF in all supported languages", () => {
    (["pt", "en", "es"] as Locale[]).forEach((locale) => {
      const document = createExecutiveReportDocument(
        {
          activities: demoActivities,
          generatedBy: "All Cabling Tech",
          leads: demoLeads,
          opportunities: demoOpportunities,
          locale,
        },
        twoPixelPng,
      );

      const bytes = new Uint8Array(document.output("arraybuffer"));
      const signature = String.fromCharCode(...bytes.slice(0, 4));
      expect(signature).toBe("%PDF");
      expect(document.getNumberOfPages()).toBe(1);
    });
  });
});
