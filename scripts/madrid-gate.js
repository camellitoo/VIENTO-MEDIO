import { appendFileSync } from "node:fs";
import { shouldFetch } from "../lib/forecast-logic.js";

const force = process.env.EVENT_NAME === "workflow_dispatch";
const decision = shouldFetch(new Date(), { force });
const line = `run=${decision.run}\nreason=${decision.reason}\n`;
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, line);
console.log(JSON.stringify(decision));
