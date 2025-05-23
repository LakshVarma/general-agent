import { ITool, ITask, IExecutionResult, ICodeExecutionTask, IWebFetchTask, IZapierMCPTask } from '../interfaces';
import { CodeExecutorService } from './CodeExecutorService';
import { WebFetcherTool } from './WebFetcherTool';
import { ZapierMCPTool } from './ZapierMCPTool'; // Import ZapierMCPTool

export class AgentService {
  private tools: ITool[];

  constructor() {
    // Initialize available tools
    this.tools = [
      new CodeExecutorService(),
      new WebFetcherTool(),
      new ZapierMCPTool() // Add ZapierMCPTool instance
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

    // Updated tool selection logic
    if (task.type === 'code_execution') {
      selectedTool = this.tools.find(tool => tool.name === 'CodeExecutor');
    } else if (task.type === 'web_fetch') {
      selectedTool = this.tools.find(tool => tool.name === 'WebFetcher');
    } else if (task.type === 'zapier_mcp_action') {
      selectedTool = this.tools.find(tool => tool.name === 'ZapierMCPTool');
    }

    if (!selectedTool) {
      const errorMessage = `No tool available to handle task type: ${task.type}`;
      console.warn(`AgentService (Task ID: ${task.id}): ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
        details: { taskId: task.id }
      };
    }

    console.log(`AgentService (Task ID: ${task.id}): Selected tool '${selectedTool.name}' for task type '${task.type}'.`);

    try {
      // Type assertion/validation before execution
      if (selectedTool.name === 'CodeExecutor' && task.type === 'code_execution') {
        const codeTask = task as ICodeExecutionTask;
        if (codeTask.params && typeof codeTask.params.code === 'string') {
          return await selectedTool.execute(codeTask);
        } else {
          const errorMsg = "Task parameters are not valid for CodeExecutor: Missing or invalid 'code' in params.";
          console.error(`AgentService (Task ID: ${task.id}): ${errorMsg}`);
          return { success: false, error: errorMsg, details: { taskId: task.id } };
        }
      } else if (selectedTool.name === 'WebFetcher' && task.type === 'web_fetch') {
        const webFetchTask = task as IWebFetchTask;
        if (webFetchTask.params && typeof webFetchTask.params.url === 'string') {
          return await selectedTool.execute(webFetchTask);
        } else {
          const errorMsg = "Task parameters are not valid for WebFetcher: Missing or invalid 'url' in params.";
          console.error(`AgentService (Task ID: ${task.id}): ${errorMsg}`);
          return { success: false, error: errorMsg, details: { taskId: task.id } };
        }
      } else if (selectedTool.name === 'ZapierMCPTool' && task.type === 'zapier_mcp_action') {
        const zapierTask = task as IZapierMCPTask;
        if (
          zapierTask.params &&
          typeof zapierTask.params.action === 'string' && zapierTask.params.action.trim() !== "" &&
          typeof zapierTask.params.zapier_mcp_url === 'string' && zapierTask.params.zapier_mcp_url.trim() !== "" &&
          typeof zapierTask.params.action_params === 'object' && zapierTask.params.action_params !== null
        ) {
          return await selectedTool.execute(zapierTask);
        } else {
          const errorMsg = "Task parameters are not valid for ZapierMCPTool: Missing or invalid 'action', 'zapier_mcp_url', or 'action_params'.";
          console.error(`AgentService (Task ID: ${task.id}): ${errorMsg}`);
          return { success: false, error: errorMsg, details: { taskId: task.id } };
        }
      }
      
      console.warn(`AgentService (Task ID: ${task.id}): Executing task with tool '${selectedTool.name}' without specific parameter validation for this combination. This might indicate a gap in task routing.`);
      return await selectedTool.execute(task);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during task execution.';
      console.error(`AgentService (Task ID: ${task.id}): Error executing task with tool '${selectedTool.name}'. Error: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
        details: { taskId: task.id, tool: selectedTool.name }
      };
    }
  }
}
