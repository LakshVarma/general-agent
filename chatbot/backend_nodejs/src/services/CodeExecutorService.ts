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
        error: `Invalid task type for CodeExecutor: '${task.type}'. Expected 'code_execution'.`,
        details: { 
          taskId: task.id,
          receivedType: task.type,
          expectedType: 'code_execution'
        }
      };
    }

    if (!task.params || typeof task.params.code !== 'string') {
        return {
            success: false,
            error: "Invalid or missing 'code' parameter in task params.",
            details: { 
              taskId: task.id,
              reason: "Parameter 'code' must be a non-empty string.",
              // It's good practice not to return the whole task.params if it could be large or sensitive.
              // Instead, indicate which parameter was problematic if possible.
              problematicParam: 'code' 
            }
        };
    }

    const pythonCode = task.params.code;
    console.log(`CodeExecutorService (Task ID: ${task.id}): Executing Python code:\n`, pythonCode);

    if (pythonCode.trim() === "") {
      return {
        success: false,
        error: "Input code cannot be empty.",
        details: { 
          taskId: task.id,
          reason: "Input code was empty or consisted only of whitespace."
        }
      };
    }

    // Simulate a successful execution with mock output
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          output: "Mock output from Python execution.",
          details: { // Details for success can also be an object
            taskId: task.id, 
            executedCodeSnippet: pythonCode.substring(0, 50) + (pythonCode.length > 50 ? "..." : "")
          }
        });
      }, 500); // Simulate some delay
    });
  }
}
