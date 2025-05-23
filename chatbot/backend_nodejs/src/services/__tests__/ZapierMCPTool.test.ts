import { ZapierMCPTool } from "../ZapierMCPTool";
import { IZapierMCPTask } from "../../interfaces";
import {
  McpContext,
  McpRequest,
  McpResponse,
  McpException,
} from "@modelcontextprotocol/sdk";

// Mock the @modelcontextprotocol/sdk
jest.mock("@modelcontextprotocol/sdk", () => {
  const mockMcpResponse = {
    success: true,
    data: { result: "Mock successful response" },
    id: "mock-response-id",
    executionTime: 1500,
  };

  const mockMcpContext = {
    execute: jest.fn().mockResolvedValue(mockMcpResponse),
  };

  return {
    McpContext: jest.fn().mockImplementation(() => mockMcpContext),
    McpRequest: jest.fn().mockImplementation((params) => params),
    McpResponse: jest.fn(),
    McpException: class MockMcpException extends Error {
      public type: string;
      public code: string;

      constructor(
        message: string,
        type: string = "UNKNOWN",
        code: string = "500",
      ) {
        super(message);
        this.name = "McpException";
        this.type = type;
        this.code = code;
      }
    },
  };
});

// Mock environment variables
const originalEnv = process.env;
beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
  process.env.ZAPIER_MCP_ENDPOINT_URL = "https://test-zapier-mcp.com";
});

afterEach(() => {
  process.env = originalEnv;
  jest.clearAllMocks();
});

describe("ZapierMCPTool", () => {
  let zapierMCPTool: ZapierMCPTool;
  let mockTask: IZapierMCPTask;

  beforeEach(() => {
    zapierMCPTool = new ZapierMCPTool();
    mockTask = {
      id: "test-task-id",
      type: "zapier_mcp_action",
      params: {
        action: "send_email",
        zapier_mcp_url: "https://hooks.zapier.com/hooks/catch/123/abc",
        action_params: {
          to: "test@example.com",
          subject: "Test Email",
          body: "This is a test email",
        },
      },
    };
  });

  describe("Parameter Validation", () => {
    it("should reject invalid task type", async () => {
      const invalidTask = { ...mockTask, type: "invalid_type" } as any;
      const result = await zapierMCPTool.execute(invalidTask);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid task type");
      expect(result.details?.receivedType).toBe("invalid_type");
      expect(result.details?.expectedType).toBe("zapier_mcp_action");
    });

    it("should reject empty action parameter", async () => {
      const invalidTask = { ...mockTask };
      invalidTask.params.action = "";

      const result = await zapierMCPTool.execute(invalidTask);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid 'action' parameter");
      expect(result.details?.problematicParam).toBe("action");
    });

    it("should reject non-string action parameter", async () => {
      const invalidTask = { ...mockTask };
      invalidTask.params.action = 123 as any;

      const result = await zapierMCPTool.execute(invalidTask);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid 'action' parameter");
    });

    it("should reject empty zapier_mcp_url parameter", async () => {
      const invalidTask = { ...mockTask };
      invalidTask.params.zapier_mcp_url = "";

      const result = await zapierMCPTool.execute(invalidTask);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid 'zapier_mcp_url' parameter");
      expect(result.details?.problematicParam).toBe("zapier_mcp_url");
    });

    it("should reject invalid URL format", async () => {
      const invalidTask = { ...mockTask };
      invalidTask.params.zapier_mcp_url = "not-a-valid-url";

      const result = await zapierMCPTool.execute(invalidTask);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid zapier_mcp_url format");
    });

    it("should reject null action_params", async () => {
      const invalidTask = { ...mockTask };
      invalidTask.params.action_params = null as any;

      const result = await zapierMCPTool.execute(invalidTask);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid 'action_params' parameter");
      expect(result.details?.problematicParam).toBe("action_params");
    });

    it("should reject non-object action_params", async () => {
      const invalidTask = { ...mockTask };
      invalidTask.params.action_params = "not an object" as any;

      const result = await zapierMCPTool.execute(invalidTask);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid 'action_params' parameter");
    });
  });

  describe("MCP Context Handling", () => {
    it("should handle missing ZAPIER_MCP_ENDPOINT_URL environment variable", async () => {
      delete process.env.ZAPIER_MCP_ENDPOINT_URL;

      // Create a new instance after removing the env var
      const toolWithoutEnv = new ZapierMCPTool();

      // Wait a bit for the async initialization
      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = await toolWithoutEnv.execute(mockTask);

      expect(result.success).toBe(false);
      expect(result.error).toContain("MCP Context not available");
    });
  });

  describe("Successful Execution", () => {
    it("should execute MCP request successfully", async () => {
      // Wait for initialization
      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = await zapierMCPTool.execute(mockTask);

      expect(result.success).toBe(true);
      expect(result.output).toEqual({ result: "Mock successful response" });
      expect(result.details?.taskId).toBe("test-task-id");
      expect(result.details?.action).toBe("send_email");
      expect(result.details?.responseId).toBe("mock-response-id");
      expect(result.details?.executionTime).toBe(1500);
    });

    it("should create correct McpRequest", async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      await zapierMCPTool.execute(mockTask);

      expect(McpRequest).toHaveBeenCalledWith({
        action: "send_email",
        endpoint: "https://hooks.zapier.com/hooks/catch/123/abc",
        parameters: {
          to: "test@example.com",
          subject: "Test Email",
          body: "This is a test email",
        },
        metadata: {
          taskId: "test-task-id",
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe("MCP Error Handling", () => {
    it("should handle MCP response with success=false", async () => {
      const mockMcpContext = (McpContext as jest.Mock).mock.results[0].value;
      mockMcpContext.execute.mockResolvedValueOnce({
        success: false,
        error: "Zapier webhook failed",
        id: "error-response-id",
        errorCode: "WEBHOOK_ERROR",
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = await zapierMCPTool.execute(mockTask);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Zapier webhook failed");
      expect(result.details?.responseId).toBe("error-response-id");
      expect(result.details?.mcpErrorCode).toBe("WEBHOOK_ERROR");
    });

    it("should handle McpException", async () => {
      const mockMcpContext = (McpContext as jest.Mock).mock.results[0].value;
      const { McpException } = require("@modelcontextprotocol/sdk");

      mockMcpContext.execute.mockRejectedValueOnce(
        new McpException("Connection timeout", "TIMEOUT", "408"),
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = await zapierMCPTool.execute(mockTask);

      expect(result.success).toBe(false);
      expect(result.error).toBe("MCP Exception: Connection timeout");
      expect(result.details?.mcpErrorType).toBe("TIMEOUT");
      expect(result.details?.mcpErrorCode).toBe("408");
    });

    it("should handle generic errors", async () => {
      const mockMcpContext = (McpContext as jest.Mock).mock.results[0].value;
      mockMcpContext.execute.mockRejectedValueOnce(new Error("Network error"));

      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = await zapierMCPTool.execute(mockTask);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
      expect(result.details?.reason).toBe(
        "Unexpected error during MCP execution",
      );
    });

    it("should handle unknown error types", async () => {
      const mockMcpContext = (McpContext as jest.Mock).mock.results[0].value;
      mockMcpContext.execute.mockRejectedValueOnce("String error");

      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = await zapierMCPTool.execute(mockTask);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error during MCP execution");
    });
  });

  describe("Tool Properties", () => {
    it("should have correct name and description", () => {
      expect(zapierMCPTool.name).toBe("ZapierMCPTool");
      expect(zapierMCPTool.description).toBe(
        "Interacts with Zapier via Model Context Protocol.",
      );
    });
  });
});
