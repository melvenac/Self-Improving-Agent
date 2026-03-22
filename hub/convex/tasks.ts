import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    taskId: v.string(),
    messages: v.array(
      v.object({ role: v.string(), content: v.string(), timestamp: v.number() })
    ),
    assignedAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("tasks", {
      ...args,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const updateStatus = mutation({
  args: {
    taskId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("in-progress"),
      v.literal("escalated"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    assignedAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("taskId"), args.taskId))
      .first();
    if (task) {
      await ctx.db.patch(task._id, {
        status: args.status,
        assignedAgent: args.assignedAgent,
        ...(args.status === "completed" ? { resolvedAt: Date.now() } : {}),
      });
    }
  },
});

export const getByTaskId = query({
  args: { taskId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("taskId"), args.taskId))
      .first();
  },
});
