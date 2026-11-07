import { appendFileSync, readFileSync } from "node:fs";
import { forecastGeneratedAt, shouldFetch } from "../lib/forecast-logic.js";

const force = process.env.EVENT_NAME === "workflow_dispatch";
let generatedAt = null;
try {
  generatedAt = forecastGeneratedAt(readFileSync(new URL("../data/forecast.json", import.meta.url), "utf8"));
} catch {
  generatedAt = null;
}
const decision = shouldFetch(new Date(), { force, generatedAt });
const line = `run=${decision.run}\nreason=${decision.reason}\n`;
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, line);
console.log(JSON.stringify(decision));
