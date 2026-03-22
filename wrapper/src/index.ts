#!/usr/bin/env node
import { parseConfig } from "./config.js";
import { Poller } from "./poller.js";

const config = parseConfig();
const poller = new Poller(config);

process.on("SIGINT", () => {
  console.log("\nShutting down wrapper...");
  poller.stop();
  process.exit(0);
});

poller.start();
