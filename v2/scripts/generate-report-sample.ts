import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { demoActivities, demoLeads, demoOpportunities } from "../src/data/demo.ts";
import { createExecutiveReportDocument } from "../src/lib/exportExecutiveReport.ts";
import { businesses } from "../src/domain/businesses.ts";
import { combineCompanyReports } from "../src/domain/companyReports.ts";

const appRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(appRoot, "..");
const logo = `data:image/png;base64,${readFileSync(resolve(appRoot, "public", "logo.png")).toString("base64")}`;
const outputDirectory = resolve(repositoryRoot, "output", "pdf");
const outputPath = resolve(outputDirectory, "D2_CRM_Relatorio_Executivo_DEMO.pdf");

mkdirSync(outputDirectory, { recursive: true });
const companies = businesses.map(business => ({business,data:{leads:demoLeads,opportunities:demoOpportunities,activities:demoActivities,companies:[],contacts:[]}}));
const document = createExecutiveReportDocument(
  {
    ...combineCompanyReports(companies),
    companies,
    companyLogos:Object.fromEntries(businesses.map(b=>[b.id,`data:image/png;base64,${readFileSync(resolve(appRoot,"public",b.logo)).toString("base64")}`])),
    generatedBy: "All Cabling Tech",
  },
  logo,
);
writeFileSync(outputPath, Buffer.from(document.output("arraybuffer")));
process.stdout.write(outputPath);
