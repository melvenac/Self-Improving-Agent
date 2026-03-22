interface QueueDeps {
  getPendingTasks: (agentName: string) => Promise<Array<{
    taskId: string;
    messages: Array<{ role: string; content: string; timestamp: number }>;
  }>>;
}

export class AgentQueue {
  private deps: QueueDeps;

  constructor(deps: QueueDeps) {
    this.deps = deps;
  }

  async getTasksFor(agentName: string) {
    return await this.deps.getPendingTasks(agentName);
  }
}
