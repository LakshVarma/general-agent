import { ITool, ICodeExecutionTask, IExecutionResult } from '../interfaces';

export class CodeExecutorService implements ITool {
  public name: string = "CodeExecutor";
  public description: string = "Executes Python code.";

  /**
   * Simulates the execution of Python code based on an ICodeExecutionTask.
   * @param task The code execution task.
   * @returns A Promise that resolves with the execution result.
   */
  public async execute(task: ICodeExecutionTask): Promise<IExecutionResult> {
    if (task.type !== 'code_execution') {
      return {
        success: false,
        error: `Invalid task type for CodeExecutor: ${task.type}. Expected 'code_execution'.`,
        details: `Task ID: ${task.id}`
      };
    }

    // Type guard to ensure params is correctly shaped, though TypeScript should enforce this at compile time
    // if AgentService routes correctly. This is more for runtime robustness if used directly.
    if (!task.params || typeof task.params.code !== 'string') {
        return {
            success: false,
            error: "Invalid or missing 'code' parameter in task params.",
            details: `Task ID: ${task.id}`
        };
    }

    const pythonCode = task.params.code;
    console.log(`CodeExecutorService (Task ID: ${task.id}): Executing Python code:\n`, pythonCode);

    if (pythonCode.trim() === "") {
      return {
        success: false,
        error: "Input code cannot be empty.",
        details: `Task ID: ${task.id}`
      };
    }

    // Simulate a successful execution with mock output
    // In a real scenario, this would involve a Python bridge or a child process.
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          output: "Mock output from Python execution.",
          details: `Task ID: ${task.id}, Executed code snippet: ${pythonCode.substring(0, 50)}...`
        });
      }, 500); // Simulate some delay
    });
  }
}
