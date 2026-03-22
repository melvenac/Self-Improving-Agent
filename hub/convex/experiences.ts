import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const search = query({
  args: { text: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("experiences")
      .withSearchIndex("search_trigger", (q) => q.search("trigger", args.text))
      .take(args.limit ?? 5);
    return results;
  },
});

export const store = mutation({
  args: {
    trigger: v.string(),
    action: v.string(),
    context: v.string(),
    outcome: v.string(),
    confidence: v.number(),
    sourceAgent: v.string(),
    category: v.union(
      v.literal("repo-docs"),
      v.literal("repo-script"),
      v.literal("repo-config"),
      v.literal("user-env"),
      v.literal("user-error")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("experiences", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("experiences")
      .order("desc")
      .take(args.limit ?? 20);
  },
});
