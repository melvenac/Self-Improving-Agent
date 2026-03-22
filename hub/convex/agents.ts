import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const register = mutation({
  args: {
    name: v.string(),
    apiKeyHash: v.string(),
    agentCard: v.any(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("agents", {
      ...args,
      lastSeen: Date.now(),
      status: "online",
    });
  },
});

export const heartbeat = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (agent) {
      await ctx.db.patch(agent._id, { lastSeen: Date.now(), status: "online" });
    }
  },
});

export const listOnline = query({
  args: {},
  handler: async (ctx): Promise<any[]> => {
    return await ctx.db
      .query("agents")
      .filter((q) => q.eq(q.field("status"), "online"))
      .collect();
  },
});
