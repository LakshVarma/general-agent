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
    
    // Access mocked instances created by AgentService constructor
    // Order of instantiation in AgentService constructor: CodeExecutor, WebFetcher, ZapierMCP
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
    // Tests for CodeExecutorService remain the same...
    it('should correctly delegate a code_execution task to CodeExecutorService', async () => {
      const taskId = uuidv4();
      const task: ICodeExecutionTask = {
        id: taskId, type: 'code_execution', params: { code: 'print("hello")' }
      };
      const mockResult: IExecutionResult = { success: true, output: 'Mocked code output', details: { taskId } };
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
      expect(mockCodeExecutorServiceInstance.execute).not.toHaveBeenCalled();
    });
  });

  describe('WebFetcherTool Integration', () => {
    // Tests for WebFetcherTool remain the same...
    it('should correctly delegate a web_fetch task to WebFetcherTool', async () => {
      const taskId = uuidv4();
      const task: IWebFetchTask = {
        id: taskId, type: 'web_fetch', params: { url: 'https://example.com' }
      };
      const mockResult: IExecutionResult = { success: true, output: 'Mocked web content', details: { taskId, url: 'https://example.com' } };
      mockWebFetcherToolInstance.execute.mockResolvedValue(mockResult);

      const result = await agentService.executeTask(task);
      expect(mockWebFetcherToolInstance.execute).toHaveBeenCalledWith(task);
      expect(result).toEqual(mockResult);
    });

    it('should return error for web_fetch with invalid params (missing url)', async () => {
      const taskId = uuidv4();
      const task = { id: taskId, type: 'web_fetch', params: {} } as ITask; // Missing url
      const result = await agentService.executeTask(task);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Task parameters are not valid for WebFetcher");
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
      const mockResult: IExecutionResult = { success: true, output: 'Mocked Zapier output', details: { taskId } };
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
      } as ITask; // Missing 'action'
      const result = await agentService.executeTask(task);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Task parameters are not valid for ZapierMCPTool");
      expect(mockZapierMCPToolInstance.execute).not.toHaveBeenCalled();
    });

    it('should return error for zapier_mcp_action with invalid params (missing zapier_mcp_url)', async () => {
      const taskId = uuidv4();
      const task = { 
        id: taskId, 
        type: 'zapier_mcp_action', 
        params: { action: 'test_action', action_params: { key: 'value' } } 
      } as ITask; // Missing 'zapier_mcp_url'
      const result = await agentService.executeTask(task);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Task parameters are not valid for ZapierMCPTool");
      expect(mockZapierMCPToolInstance.execute).not.toHaveBeenCalled();
    });
    
    it('should return error for zapier_mcp_action with invalid params (missing action_params)', async () => {
      const taskId = uuidv4();
      const task = { 
        id: taskId, 
        type: 'zapier_mcp_action', 
        params: { action: 'test_action', zapier_mcp_url: 'https://zapier.com/mcp' } 
      } as ITask; // Missing 'action_params'
      const result = await agentService.executeTask(task);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Task parameters are not valid for ZapierMCPTool");
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
    
    it('should handle exceptions from ZapierMCPTool', async () => {
        const taskId = uuidv4();
        const task: IZapierMCPTask = { 
            id: taskId, 
            type: 'zapier_mcp_action', 
            params: { action: 'test_action', zapier_mcp_url: 'https://zapier.com/mcp', action_params: { key: 'value' } }
        };
        const exception = new Error("ZapierMCPTool exploded");
        mockZapierMCPToolInstance.execute.mockRejectedValue(exception);

        const result = await agentService.executeTask(task);
        expect(result.success).toBe(false);
        expect(result.error).toBe(exception.message);
        expect(result.details).toEqual({ taskId, tool: 'ZapierMCPTool' });
    });
  });
});
