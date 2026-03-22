import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const propose = mutation({
  args: {
    experienceId: v.id("experiences"),
    diffPreview: v.string(),
    filePaths: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("repoFixes", {
      ...args,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const approve = mutation({
  args: { id: v.id("repoFixes"), approvedBy: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "approved", approvedBy: args.approvedBy });
  },
});

export const reject = mutation({
  args: { id: v.id("repoFixes"), feedback: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "rejected", feedback: args.feedback });
  },
});

export const listPending = query({
  args: {},
  handler: async (ctx): Promise<any[]> => {
    return await ctx.db
      .query("repoFixes")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
  },
});
