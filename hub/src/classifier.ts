import Anthropic from "@anthropic-ai/sdk";

const VALID_CATEGORIES = ["repo-docs", "repo-script", "repo-config", "user-env", "user-error"] as const;
type Category = (typeof VALID_CATEGORIES)[number];

export class Classifier {
  private client: Anthropic;

  constructor(client: Anthropic) {
    this.client = client;
  }

  async classify(trigger: string, action: string): Promise<Category> {
    const response = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 50,
      system: `You are a root cause classifier. Given an installation error (trigger) and its fix (action), classify the root cause into exactly one category. Respond with ONLY the category string, nothing else.

Categories:
- repo-docs: Missing or unclear documentation in the repo
- repo-script: Missing automation or wrong command in the repo
- repo-config: Missing config file or entry in the repo
- user-env: User's local environment issue (wrong Node version, OS quirk)
- user-error: User mistake, not a repo problem`,
      messages: [
        {
          role: "user",
          content: `Trigger: ${trigger}\nAction: ${action}`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const category = text as Category;

    if (VALID_CATEGORIES.includes(category)) {
      return category;
    }
    return "user-error"; // safe default
  }
}
