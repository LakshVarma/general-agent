import { AgentService } from '../AgentService';
import { CodeExecutorService } from '../CodeExecutorService';
import { ITask, IExecutionResult, ICodeExecutionTask } from '../../interfaces';
import { v4 as uuidv4 } from 'uuid';

// Mock CodeExecutorService
jest.mock('../CodeExecutorService');

describe('AgentService', () => {
  let agentService: AgentService;
  let mockCodeExecutorServiceInstance: jest.Mocked<CodeExecutorService>;

  beforeEach(() => {
    // Reset mocks for each test
    jest.clearAllMocks();

    // Create a new instance of AgentService for each test.
    // This will use the mocked CodeExecutorService due to jest.mock() above.
    agentService = new AgentService();
    
    // Access the mocked instance of CodeExecutorService created by AgentService's constructor
    // This assumes AgentService internally creates an instance of CodeExecutorService
    // and that CodeExecutorService is the first (or only) tool.
    // If AgentService takes tools as constructor params, this would be different.
    // Based on current AgentService, it instantiates tools internally.
    // We need to get the instance that AgentService is using.
    // The `mock.instances` array gives access to all instances of a mocked class.
    if (CodeExecutorService.mock.instances.length > 0) {
        mockCodeExecutorServiceInstance = CodeExecutorService.mock.instances[0] as jest.Mocked<CodeExecutorService>;
    } else {
        // This case should ideally not happen if AgentService constructor works as expected
        // and jest.mock is set up correctly.
        // For safety, we can create a new mock instance if needed, though it might not be the one
        // AgentService is using if AgentService creates its own.
        // However, AgentService's constructor *does* create a new CodeExecutorService(),
        // so an instance *should* be available via mock.instances.
        // Let's re-ensure our mock setup is robust.
        // The issue might be that AgentService is instantiated *before* we can grab the specific mock instance.
        // A common pattern is to have tools injected, making mocking easier.
        // Given the current structure of AgentService (new CodeExecutorService() in constructor):
        // The mock should apply to any `new CodeExecutorService()` call.
        // Let's ensure the mock is correctly providing mocked methods.
        // If CodeExecutorService.mock.instances[0] is undefined, it means AgentService constructor
        // didn't create an instance via the mock, which is problematic.
        // This might happen if the `jest.mock` call is not correctly hoisting or applying.

        // Let's assume CodeExecutorService constructor is called and its instance is the first one.
        // This is a bit fragile. A better way would be to inject tools into AgentService.
        // For now, we rely on this structure.
        mockCodeExecutorServiceInstance = new CodeExecutorService() as jest.Mocked<CodeExecutorService>;
         // Ensure its methods are mocks if we have to create it manually (though ideally not needed)
        if (!mockCodeExecutorServiceInstance.execute) {
            mockCodeExecutorServiceInstance.execute = jest.fn();
        }
    }
  });

  it('should correctly delegate a code_execution task to CodeExecutorService', async () => {
    const taskId = uuidv4();
    const task: ICodeExecutionTask = {
      id: taskId,
      type: 'code_execution',
      params: { code: 'print("hello from agent test")' }
    };

    const mockExecutionResult: IExecutionResult = {
      success: true,
      output: 'Mocked execution output',
      details: `Task ID: ${taskId}`
    };

    // Ensure the instance used by AgentService is the one we're setting the mock on.
    // Accessing CodeExecutorService.mock.instances[0] if available is key.
    const actualMockInstance = CodeExecutorService.mock.instances[0] as jest.Mocked<CodeExecutorService>;
    actualMockInstance.execute.mockResolvedValue(mockExecutionResult);


    const result = await agentService.executeTask(task);

    expect(actualMockInstance.execute).toHaveBeenCalledTimes(1);
    expect(actualMockInstance.execute).toHaveBeenCalledWith(task);
    expect(result).toEqual(mockExecutionResult);
  });

  it('should return an error if no tool can handle the task type', async () => {
    const taskId = uuidv4();
    const task: ITask = {
      id: taskId,
      type: 'unknown_task_type',
      params: { data: 'some data' }
    };

    const result = await agentService.executeTask(task);

    expect(result.success).toBe(false);
    expect(result.error).toBe(`No tool available to handle task type: ${task.type}`);
    expect(result.details).toContain(`Task ID: ${taskId}`);
    
    // Ensure no tool's execute method was called
    const actualMockInstance = CodeExecutorService.mock.instances[0] as jest.Mocked<CodeExecutorService>;
    expect(actualMockInstance.execute).not.toHaveBeenCalled();
  });

  it('should return an error if code_execution task params are invalid for CodeExecutor', async () => {
    const taskId = uuidv4();
    const task = { // Intentionally malformed for this test
      id: taskId,
      type: 'code_execution',
      params: { script: 'this is not a code param' } // Missing 'code'
    } as ITask; // Cast as ITask, AgentService should internally verify for ICodeExecutionTask

    // The mock for CodeExecutorService's execute shouldn't even be called if params are wrong.
    // The AgentService itself should catch this before delegation.
    const result = await agentService.executeTask(task);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Task parameters are not valid for CodeExecutor.");
    expect(result.details).toContain(`Task ID: ${taskId}`);

    const actualMockInstance = CodeExecutorService.mock.instances[0] as jest.Mocked<CodeExecutorService>;
    expect(actualMockInstance.execute).not.toHaveBeenCalled();
  });
  
  it('should propagate errors from the tool execution', async () => {
    const taskId = uuidv4();
    const task: ICodeExecutionTask = {
      id: taskId,
      type: 'code_execution',
      params: { code: 'print("error test")' }
    };

    const mockErrorResult: IExecutionResult = {
      success: false,
      error: 'Tool execution failed',
      details: `Task ID: ${taskId}, Tool: CodeExecutor`
    };
    
    // Mock CodeExecutorService's execute method to return an error
    const actualMockInstance = CodeExecutorService.mock.instances[0] as jest.Mocked<CodeExecutorService>;
    actualMockInstance.execute.mockResolvedValue(mockErrorResult); // Simulating a "successful" call that returns a failure IResult
    // Or actualMockInstance.execute.mockRejectedValue(new Error("Tool exploded")); for exception

    const result = await agentService.executeTask(task);

    expect(actualMockInstance.execute).toHaveBeenCalledTimes(1);
    expect(actualMockInstance.execute).toHaveBeenCalledWith(task);
    expect(result).toEqual(mockErrorResult);
  });

   it('should handle exceptions from the tool execution', async () => {
    const taskId = uuidv4();
    const task: ICodeExecutionTask = {
      id: taskId,
      type: 'code_execution',
      params: { code: 'print("exception test")' }
    };

    const toolError = new Error("Tool exploded unexpectedly");
    
    const actualMockInstance = CodeExecutorService.mock.instances[0] as jest.Moc<ctrl61>import { Router, Request, Response } from 'express';
import { AgentService } from '../services/AgentService';

const router = Router();
const agentService = new AgentService();

interface TaskRequestBody {
  type: string;
  params: any;
}

router.post('/execute', async (req: Request, res: Response) => {
  const task = req.body as TaskRequestBody;

  if (!task || typeof task.type !== 'string' || task.params === undefined) {
    return res.status(400).json({ success: false, error: 'Malformed task object in request body.' });
  }

  try {
    console.log(`Agent route /execute received task:`, task);
    const result = await agentService.executeTask(task);
    if (result.success) {
      return res.status(200).json(result);
    } else {
      // Consider different status codes for different types of errors from the service
      return res.status(400).json(result); 
    }
  } catch (error) {
    console.error('Error in /agent/execute route:', error);
    // Check if error is an instance of Error to safely access message property
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return res.status(500).json({ success: false, error: errorMessage });
  }
});

export default router;
