export interface ITask {
  id: string; // Unique identifier for the task
  type: string; // Type of task (e.g., 'code_execution', 'web_fetch')
  params: any; // Parameters specific to the task type
}

export interface IExecutionResult {
  success: boolean;
  output?: any; // Output from successful execution
  error?: string; // Error message from failed execution
  details?: any; // Additional details, logs, etc.
}

export interface ITool {
  name: string; // Name of the tool (e.g., 'CodeExecutor', 'WebFetcher')
  description: string; // Description of what the tool does
  execute(task: ITask): Promise<IExecutionResult>; // Method to execute a task
}

// Since ITask is in the same file, no import is needed for it here.
// The self-reference in the original prompt for ICodeExecutionTask's import is not necessary.
export interface ICodeExecutionTask extends ITask {
  type: 'code_execution'; // Specific type for code execution
  params: {
    code: string; // Python code to execute
    context?: string; // Optional execution context or environment details
  };
}

export interface IWebFetchTask extends ITask {
  type: 'web_fetch';
  params: {
    url: string;
    method?: 'GET' | 'POST'; // Optional, default to GET
    headers?: Record<string, string>;
    body?: any;
  };
}

export interface IZapierMCPTask extends ITask {
  type: 'zapier_mcp_action';
  params: {
    action: string; // Specific Zapier action to perform
    zapier_mcp_url: string; // URL for the Zapier MCP endpoint
    action_params: Record<string, any>; // Parameters for the Zapier action
  };
}
