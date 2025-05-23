import { ITool, ITask, IExecutionResult, ICodeExecutionTask } from '../interfaces';
import { CodeExecutorService } from './CodeExecutorService';

export class AgentService {
  private tools: ITool[];

  constructor() {
    // Initialize available tools
    this.tools = [
      new CodeExecutorService()
      // Future tools can be added here, e.g., new WebFetcherService()
    ];
  }

  /**
   * Executes a given task by finding an appropriate tool.
   * @param task The task to execute, conforming to ITask.
   * @returns A Promise that resolves with the execution result.
   */
  public async executeTask(task: ITask): Promise<IExecutionResult> {
    console.log(`AgentService (Task ID: ${task.id}): Received task - Type: ${task.type}`);

    let selectedTool: ITool | undefined;

    // Simple tool selection logic
    // This can be expanded with a more sophisticated mapping or strategy
    if (task.type === 'code_execution') {
      selectedTool = this.tools.find(tool => tool.name === 'CodeExecutor');
    }
    // Example for a future tool:
    // else if (task.type === 'web_fetch') {
    //   selectedTool = this.tools.find(tool => tool.name === 'WebFetcher');
    // }

    if (!selectedTool) {
      const errorMessage = `No tool available to handle task type: ${task.type}`;
      console.warn(`AgentService (Task ID: ${task.id}): ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
        details: `Task ID: ${task.id}`
      };
    }

    console.log(`AgentService (Task ID: ${task.id}): Selected tool '${selectedTool.name}' for task type '${task.type}'.`);

    try {
      // Type assertion/validation before execution
      // This is crucial if tools expect more specific task types
      if (selectedTool.name === 'CodeExecutor' && task.type === 'code_execution') {
        // Validate if the task conforms to ICodeExecutionTask for CodeExecutorService
        // This is a runtime check; TypeScript helps at compile time but data from external sources (like API) needs validation.
        const codeTask = task as ICodeExecutionTask;
        if (codeTask.params && typeof codeTask.params.code === 'string') {
          return await selectedTool.execute(codeTask);
        } else {
          const errorMsg = "Task parameters are not valid for CodeExecutor.";
          console.error(`AgentService (Task ID: ${task.id}): ${errorMsg} - Missing 'code' in params.`);
          return { success: false, error: errorMsg, details: `Task ID: ${task.id}` };
        }
      }
      // Add similar blocks for other tools and their specific task types

      // Fallback if specific checks aren't met or for generic tools
      // This part might need refinement based on how tools are designed
      // For now, we assume the task type matches the tool's general capability
      return await selectedTool.execute(task);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during task execution.';
      console.error(`AgentService (Task ID: ${task.id}): Error executing task with tool '${selectedTool.name}'. Error: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
        details: `Task ID: ${task.id}, Tool: ${selectedTool.name}`
      };
    }
  }
}
