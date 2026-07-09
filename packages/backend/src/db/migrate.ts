import { db, createTables } from "./index.js";

createTables();
console.log("Database tables created successfully");
process.exit(0);
