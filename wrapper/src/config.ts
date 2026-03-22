import { Command } from "commander";

export interface WrapperConfig {
  hubUrl: string;
  apiKey: string;
  agentName: string;
  pollInterval: number;
}

export function parseConfig(): WrapperConfig {
  const program = new Command();
  program
    .requiredOption("--hub <url>", "Hub URL (e.g., https://sandbox.tarrantcountymakerspace.com)")
    .requiredOption("--key <apiKey>", "API key for authenticating with the Hub")
    .requiredOption("--name <agentName>", "Agent name (e.g., clark, alice)")
    .option("--poll-interval <ms>", "Polling interval in milliseconds", "5000")
    .parse();

  const opts = program.opts();
  return {
    hubUrl: opts.hub,
    apiKey: opts.key,
    agentName: opts.name,
    pollInterval: parseInt(opts.pollInterval),
  };
}
