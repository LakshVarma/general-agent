import { AgentService } from '../AgentService';
import { CodeExecutorService } from '../CodeExecutorService';
import { WebFetcherTool } from '../WebFetcherTool';
import { ZapierMCPTool } from '../ZapierMCPTool'; // Import ZapierMCPTool
import { ITask, IExecutionResult, ICodeExecutionTask, IWebFetchTask, IZapierMCPTask } from '../../interfaces';
import { v4 as uuidv4 } from 'uuid';

// Mock all services
jest.mock('../CodeExecutorService');
jest.mock('../WebFetcherTool');
jest.mock('../ZapierMCPTool'); // Mock ZapierMCPTool

describe('AgentService', () => {
  let agentService: AgentService;
  let mockCodeExecutorServiceInstance: jest.Mocked<CodeExecutorService>;
  let mockWebFetcherToolInstance: jest.Mocked<WebFetcherTool>;
  let mockZapierMCPToolInstance: jest.Mocked<ZapierMCPTool>;

  beforeEach(() => {
    jest.clearAllMocks();
    agentService = new AgentService();
    
    if (CodeExecutorService.mock.instances.length > 0) {
      mockCodeExecutorServiceInstance = CodeExecutorService.mock.instances[0] as jest.Mocked<CodeExecutorService>;
    } else {
      mockCodeExecutorServiceInstance = new CodeExecutorService() as jest.Mocked<CodeExecutorService>;
      if (!mockCodeExecutorServiceInstance.execute) mockCodeExecutorServiceInstance.execute = jest.fn();
    }

    if (WebFetcherTool.mock.instances.length > 0) {
      mockWebFetcherToolInstance = WebFetcherTool.mock.instances[0] as jest.Mocked<WebFetcherTool>;
    } else {
      mockWebFetcherToolInstance = new WebFetcherTool() as jest.Mocked<WebFetcherTool>;
      if (!mockWebFetcherToolInstance.execute) mockWebFetcherToolInstance.execute = jest.fn();
    }

    if (ZapierMCPTool.mock.instances.length > 0) {
      mockZapierMCPToolInstance = ZapierMCPTool.mock.instances[0] as jest.Mocked<ZapierMCPTool>;
    } else {
      mockZapierMCPToolInstance = new ZapierMCPTool() as jest.Mocked<ZapierMCPTool>;
      if (!mockZapierMCPToolInstance.execute) mockZapierMCPToolInstance.execute = jest.fn();
    }
  });

  describe('CodeExecutorService Integration', () => {
    it('should correctly delegate a code_execution task to CodeExecutorService', async () => {
      const taskId = uuidv4();
      const task: ICodeExecutionTask = {
        id: taskId, type: 'code_execution', params: { code: 'print("hello")' }
      };
      const mockResult: IExecutionResult = { 
        success: true, 
        output: 'Mocked code output', 
        details: { taskId, executedCodeSnippet: 'print("hello")'.substring(0,50) } 
      };
      mockCodeExecutorServiceInstance.execute.mockResolvedValue(mockResult);
      const result = await agentService.executeTask(task);
      expect(mockCodeExecutorServiceInstance.execute).toHaveBeenCalledWith(task);
      expect(result).toEqual(mockResult);
    });

    it('should return error for code_execution with invalid params (missing code)', async () => {
      const taskId = uuidv4();
      const task = { id: taskId, type: 'code_execution', params: {} } as ITask;
      const result = await agentService.executeTask(task);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Task parameters are not valid for CodeExecutor");
      expect(result.details).toEqual({ taskId }); 
      expect(mockCodeExecutorServiceInstance.execute).not.toHaveBeenCalled();
    });
  });

  describe('WebFetcherTool Integration', () => {
    it('should correctly delegate a web_fetch task to WebFetcherTool', async () => {
      const taskId = uuidv4();
      const task: IWebFetchTask = {
        id: taskId, type: 'web_fetch', params: { url: 'https://example.com' }
      };
      const mockResult: IExecutionResult = { 
        success: true, 
        output: 'Mocked web content', 
        details: { taskId, url: 'https://example.com', status: 200, method: 'GET' } 
      };
      mockWebFetcherToolInstance.execute.mockResolvedValue(mockResult);
      const result = await agentService.executeTask(task);
      expect(mockWebFetcherToolInstance.execute).toHaveBeenCalledWith(task);
      expect(result).toEqual(mockResult);
    });

    it('should return error for web_fetch with invalid params (missing url)', async () => {
      const taskId = uuidv4();
      const task = { id: taskId, type: 'web_fetch', params: {} } as ITask; 
      const result = await agentService.executeTask(task);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Task parameters are not valid for WebFetcher");
      expect(result.details).toEqual({ taskId });
      expect(mockWebFetcherToolInstance.execute).not.toHaveBeenCalled();
    });
  });

  describe('ZapierMCPTool Integration', () => {
    it('should correctly delegate a zapier_mcp_action task to ZapierMCPTool', async () => {
      const taskId = uuidv4();
      const task: IZapierMCPTask = {
        id: taskId,
        type: 'zapier_mcp_action',
        params: { action: 'test_action', zapier_mcp_url: 'https://zapier.com/mcp', action_params: { key: 'value' } }
      };
      // Updated details to match ZapierMCPTool's success response
      const mockResult: IExecutionResult = { 
        success: true, 
        output: 'Mocked Zapier output', 
        details: { 
          taskId, 
          action: 'test_action', 
          mcp_url: 'https://zapier.com/mcp',
          status: "Placeholder success (not a real MCP call)" 
        } 
      };
      mockZapierMCPToolInstance.execute.mockResolvedValue(mockResult);
      const result = await agentService.executeTask(task);
      expect(mockZapierMCPToolInstance.execute).toHaveBeenCalledWith(task);
      expect(result).toEqual(mockResult);
    });

    it('should return error for zapier_mcp_action with invalid params (missing action)', async () => {
      const taskId = uuidv4();
      const task = { 
        id: taskId, 
        type: 'zapier_mcp_action', 
        params: { zapier_mcp_url: 'https://zapier.com/mcp', action_params: { key: 'value' } } 
      } as ITask; 
      const result = await agentService.executeTask(task);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Task parameters are not valid for ZapierMCPTool");
      expect(result.details).toEqual({ taskId });
      expect(mockZapierMCPToolInstance.execute).not.toHaveBeenCalled();
    });
  });

  describe('General AgentService Logic', () => {
    it('should return an error if no tool can handle the task type', async () => {
      const taskId = uuidv4();
      const task: ITask = { id: taskId, type: 'unknown_task_type', params: {} };
      const result = await agentService.executeTask(task);
      expect(result.success).toBe(false);
      expect(result.error).toBe(`No tool available to handle task type: ${task.type}`);
      expect(result.details).toEqual({ taskId });
      expect(mockCodeExecutorServiceInstance.execute).not.toHaveBeenCalled();
      expect(mockWebFetcherToolInstance.execute).not.toHaveBeenCalled();
      expect(mockZapierMCPToolInstance.execute).not.toHaveBeenCalled();
    });

    it('should propagate errors from CodeExecutorService with enhanced details', async () => {
        const taskId = uuidv4();
        const task: ICodeExecutionTask = { id: taskId, type: 'code_execution', params: { code: 'error code' } };
        const mockToolError: IExecutionResult = { 
            success: false, 
            error: 'Code execution failed by tool', 
            details: { 
                taskId, 
                reason: "Tool specific error reason for code execution", // Matches CodeExecutorService's enhanced details
                problematicParam: "code" 
            } 
        };
        mockCodeExecutorServiceInstance.execute.mockResolvedValue(mockToolError);
        const result = await agentService.executeTask(task);
        expect(result).toEqual(mockToolError);
        expect(result.details).toHaveProperty('reason', "Tool specific error reason for code execution");
    });

    it('should propagate errors from WebFetcherTool with enhanced details', async () => {
        const taskId = uuidv4();
        const task: IWebFetchTask = { id: taskId, type: 'web_fetch', params: { url: 'https://error.com' } };
        const mockToolError: IExecutionResult = { 
            success: false, 
            error: 'Web fetch failed by tool', 
            details: { 
                taskId, 
                url: 'https://error.com', 
                status: 404, 
                reason: "Resource not found (simulated)", // Matches WebFetcherTool's enhanced details
                method: 'GET'
            } 
        };
        mockWebFetcherToolInstance.execute.mockResolvedValue(mockToolError);
        const result = await agentService.executeTask(task);
        expect(result).toEqual(mockToolError);
        expect(result.details).toHaveProperty('status', 404);
        expect(result.details).toHaveProperty('reason', "Resource not found (simulated)");
    });
    
    it('should propagate errors from ZapierMCPTool with enhanced details', async () => {
        const taskId = uuidv4();
        const task: IZapierMCPTask = { 
            id: taskId, 
            type: 'zapier_mcp_action', 
            params: { action: 'failing_action', zapier_mcp_url: 'https://zapier.com/mcp', action_params: { key: 'value' } }
        };
        // Updated to match a specific error from ZapierMCPTool (e.g., invalid 'action' parameter)
        const mockToolError: IExecutionResult = { 
            success: false, 
            error: "Invalid 'action' parameter: Must be a non-empty string.", 
            details: { 
                taskId, 
                problematicParam: 'action', // Matches ZapierMCPTool's enhanced details for this error
                reason: "Parameter 'action' must be a non-empty string."
            } 
        };
        mockZapierMCPToolInstance.execute.mockResolvedValue(mockToolError);
        const result = await agentService.executeTask(task);
        expect(result).toEqual(mockToolError);
        expect(result.details).toHaveProperty('problematicParam', 'action');
        expect(result.details).toHaveProperty('reason', "Parameter 'action' must be a non-empty string.");
    });

    it('should handle exceptions from CodeExecutorService', async () => {
        const taskId = uuidv4();
        const task: ICodeExecutionTask = { id: taskId, type: 'code_execution', params: { code: 'exception code' } };
        const exception = new Error("CodeExecutor tool exploded");
        mockCodeExecutorServiceInstance.execute.mockRejectedValue(exception);
        const result = await agentService.executeTask(task);
        expect(result.success).toBe(false);
        expect(result.error).toBe(exception.message);
        expect(result.details).toEqual({ taskId, tool: 'CodeExecutor' }); 
    });

    it('should handle exceptions from WebFetcherTool', async () => {
        const taskId = uuidv4();
        const task: IWebFetchTask = { id: taskId, type: 'web_fetch', params: { url: 'https://exception.com' } };
        const exception = new Error("WebFetcher tool exploded");
        mockWebFetcherToolInstance.execute.mockRejectedValue(exception);
        const result = await agentService.executeTask(task);
        expect(result.success).toBe(false);
        expect(result.error).toBe(exception.message);
        expect(result.details).toEqual({ taskId, tool: 'WebFetcher' });
    });
    
    it('should handle exceptions from ZapierMCPTool', async () => {
        const taskId = uuidv4();
        const task: IZapierMCPTask = { 
            id: taskId, 
            type: 'zapier_mcp_action', 
            params: { action: 'exploding_action', zapier_mcp_url: 'https://zapier.com/mcp', action_params: {} }
        };
        const exception = new Error("ZapierMCPTool tool exploded");
        mockZapierMCPToolInstance.execute.mockRejectedValue(exception);
        const result = await agentService.executeTask(task);
        expect(result.success).toBe(false);
        expect(result.error).toBe(exception.message);
        expect(result.details).toEqual({ taskId, tool: 'ZapierMCPTool' });
    });
  });
});
