import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { demoActivities, demoLeads, demoOpportunities } from "../src/data/demo.ts";
import { createExecutiveReportDocument } from "../src/lib/exportExecutiveReport.ts";

const appRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(appRoot, "..");
const logo = `data:image/png;base64,${readFileSync(resolve(appRoot, "public", "logo.png")).toString("base64")}`;
const outputDirectory = resolve(repositoryRoot, "output", "pdf");
const outputPath = resolve(outputDirectory, "D2_CRM_Relatorio_Executivo_DEMO.pdf");

mkdirSync(outputDirectory, { recursive: true });
const document = createExecutiveReportDocument(
  {
    activities: demoActivities,
    generatedBy: "All Cabling Tech",
    leads: demoLeads,
    opportunities: demoOpportunities,
  },
  logo,
);
writeFileSync(outputPath, Buffer.from(document.output("arraybuffer")));
process.stdout.write(outputPath);
