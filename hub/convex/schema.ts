import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  experiences: defineTable({
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
    createdAt: v.number(),
  }).searchIndex("search_trigger", {
    searchField: "trigger",
    filterFields: ["category"],
  }),

  tasks: defineTable({
    taskId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("in-progress"),
      v.literal("escalated"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    messages: v.array(
      v.object({
        role: v.string(),
        content: v.string(),
        timestamp: v.number(),
      })
    ),
    assignedAgent: v.optional(v.string()),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
  }).index("by_status", ["status"]),

  agents: defineTable({
    name: v.string(),
    apiKeyHash: v.string(),
    agentCard: v.any(),
    lastSeen: v.number(),
    status: v.union(v.literal("online"), v.literal("offline")),
  }).index("by_name", ["name"]),

  conversations: defineTable({
    taskId: v.string(),
    messages: v.array(
      v.object({
        role: v.string(),
        content: v.string(),
        timestamp: v.number(),
      })
    ),
    participants: v.array(v.string()),
    summary: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_taskId", ["taskId"]),

  repoFixes: defineTable({
    experienceId: v.id("experiences"),
    diffPreview: v.string(),
    filePaths: v.array(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("pushed")
    ),
    approvedBy: v.optional(v.string()),
    feedback: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_status", ["status"]),
});
