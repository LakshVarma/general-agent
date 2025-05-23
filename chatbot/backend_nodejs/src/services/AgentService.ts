import { CodeExecutorService } from './CodeExecutorService';

interface Task {
  type: string;
  params: any;
}

interface ExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
}

export class AgentService {
  private codeExecutorService: CodeExecutorService;

  constructor() {
    this.codeExecutorService = new CodeExecutorService();
  }

  /**
   * Executes a given task.
   * @param task The task to execute.
   * @returns A Promise that resolves with the execution result.
   */
  public async executeTask(task: Task): Promise<ExecutionResult> {
    console.log("AgentService executing task:", task);

    switch (task.type) {
      case 'code_execution':
        if (task.params && typeof task.params.code === 'string') {
          return this.codeExecutorService.execute(task.params.code);
        } else {
          return { success: false, error: "Missing or invalid code parameter for code_execution task." };
        }
      default:
        console.warn(`Unknown task type: ${task.type}`);
        return { success: false, error: `Unknown task type: ${task.type}` };
    }
  }
}
