import dotenv from "dotenv";
dotenv.config({ path: "../.env.local" });

const { sendToThesys } = await import("./src/services/thesysService.ts");

const response = await sendToThesys("Explain Plan2Field in one short sentence.");

console.log(JSON.stringify(response, null, 2));
