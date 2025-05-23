import { CodeExecutorService } from '../CodeExecutorService';
import { ICodeExecutionTask, IExecutionResult, ITask } from '../../interfaces'; // ITask for invalid type test
import { v4 as uuidv4 } from 'uuid';

describe('CodeExecutorService', () => {
  let service: CodeExecutorService;

  beforeEach(() => {
    service = new CodeExecutorService();
  });

  it('should have correct name and description', () => {
    expect(service.name).toBe('CodeExecutor');
    expect(service.description).toBe('Executes Python code.');
  });

  it('should execute a valid code_execution task successfully', async () => {
    const task: ICodeExecutionTask = {
      id: uuidv4(),
      type: 'code_execution',
      params: { code: 'print("hello world")' }
    };
    const result: IExecutionResult = await service.execute(task);
    expect(result.success).toBe(true);
    expect(result.output).toBe('Mock output from Python execution.');
    expect(result.details).toContain(`Task ID: ${task.id}`);
    expect(result.details).toContain(`Executed code snippet: ${task.params.code.substring(0, 50)}`);
    expect(result.error).toBeUndefined();
  });

  it('should return an error for an empty code string', async () => {
    const task: ICodeExecutionTask = {
      id: uuidv4(),
      type: 'code_execution',
      params: { code: '   ' } // Empty/whitespace code
    };
    const result: IExecutionResult = await service.execute(task);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Input code cannot be empty.');
    expect(result.details).toContain(`Task ID: ${task.id}`);
    expect(result.output).toBeUndefined();
  });
  
  it('should return an error if params.code is not a string', async () => {
    const task: ICodeExecutionTask = {
        id: uuidv4(),
        type: 'code_execution',
        // @ts-expect-error Testing invalid params type
        params: { code: 123 } 
    };
    const result: IExecutionResult = await service.execute(task);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid or missing 'code' parameter in task params.");
    expect(result.details).toContain(`Task ID: ${task.id}`);
    expect(result.output).toBeUndefined();
  });

  it('should return an error for an invalid task type', async () => {
    const invalidTask = { // Explicitly not ICodeExecutionTask to test type checking
      id: uuidv4(),
      type: 'wrong_type',
      params: { code: 'print("this should not run")' }
    } as unknown as ICodeExecutionTask; // Cast to bypass compile-time check for testing runtime check

    const result: IExecutionResult = await service.execute(invalidTask);
    expect(result.success).toBe(false);
    expect(result.error).toBe(`Invalid task type for CodeExecutor: ${invalidTask.type}. Expected 'code_execution'.`);
    expect(result.details).toContain(`Task ID: ${invalidTask.id}`);
    expect(result.output).toBeUndefined();
  });
});
