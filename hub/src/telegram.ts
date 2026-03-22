import TelegramBot from "node-telegram-bot-api";

export class TelegramMirror {
  private bot: TelegramBot;
  private groupId: string;

  constructor(token: string, groupId: string) {
    this.bot = new TelegramBot(token, { polling: true });
    this.groupId = groupId;
    this.setupCallbacks();
  }

  private setupCallbacks() {
    this.bot.on("callback_query", async (query) => {
      const data = query.data;
      if (!data) return;

      if (data.startsWith("approve:")) {
        const fixId = data.replace("approve:", "");
        this.onApprove?.(fixId, query.from.username || "unknown");
        await this.bot.answerCallbackQuery(query.id, { text: "Approved!" });
      } else if (data.startsWith("reject:")) {
        const fixId = data.replace("reject:", "");
        this.onReject?.(fixId);
        await this.bot.answerCallbackQuery(query.id, { text: "Rejected" });
      }
    });
  }

  onApprove?: (fixId: string, approvedBy: string) => void;
  onReject?: (fixId: string) => void;

  async broadcast(message: string) {
    await this.bot.sendMessage(this.groupId, message, { parse_mode: "Markdown" });
  }

  async broadcastWithApproval(message: string, fixId: string) {
    await this.bot.sendMessage(this.groupId, message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Approve", callback_data: `approve:${fixId}` },
            { text: "❌ Reject", callback_data: `reject:${fixId}` },
          ],
        ],
      },
    });
  }

  async incomingQuestion(source: string, question: string) {
    await this.broadcast(`📩 *${source}*:\n${question}`);
  }

  async hubDecision(decision: string) {
    await this.broadcast(`🤖 Hub: ${decision}`);
  }

  async response(source: string, answer: string) {
    await this.broadcast(`💡 *${source}*:\n${answer}`);
  }

  async agentOnline(agentName: string) {
    await this.broadcast(`🟢 Agent \`${agentName}\` is now online`);
  }

  async lessonStored(trigger: string, category: string) {
    await this.broadcast(`📚 Lesson stored: _${trigger}_ → category: \`${category}\``);
  }

  async proposeRepoFix(fixId: string, diffPreview: string, filePaths: string[]) {
    const message = `🔧 *Proposed repo fix*\nFiles: ${filePaths.join(", ")}\n\n\`\`\`\n${diffPreview.slice(0, 500)}\n\`\`\``;
    await this.broadcastWithApproval(message, fixId);
  }
}
