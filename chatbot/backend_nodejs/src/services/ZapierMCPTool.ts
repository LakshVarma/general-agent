import { ITool, IZapierMCPTask, IExecutionResult } from "../interfaces";
import {
  McpContext,
  McpRequest,
  McpResponse,
  McpException,
} from "@modelcontextprotocol/sdk";

export class ZapierMCPTool implements ITool {
  public name: string = "ZapierMCPTool";
  public description: string =
    "Interacts with Zapier via Model Context Protocol.";
  private mcpContext: McpContext | null = null;

  constructor() {
    this.initializeMcpContext();
  }

  private async initializeMcpContext(): Promise<void> {
    try {
      const endpointUrl = process.env.ZAPIER_MCP_ENDPOINT_URL;
      if (!endpointUrl) {
        console.warn(
          "ZapierMCPTool: ZAPIER_MCP_ENDPOINT_URL not configured in environment variables.",
        );
        return;
      }

      this.mcpContext = new McpContext({
        endpoint: endpointUrl,
        timeout: 30000, // 30 seconds timeout
        retries: 3,
      });

      console.log("ZapierMCPTool: MCP Context initialized successfully.");
    } catch (error) {
      console.error("ZapierMCPTool: Failed to initialize MCP Context:", error);
      this.mcpContext = null;
    }
  }

  public async execute(task: IZapierMCPTask): Promise<IExecutionResult> {
    if (task.type !== "zapier_mcp_action") {
      return {
        success: false,
        error: `Invalid task type for ZapierMCPTool: '${task.type}'. Expected 'zapier_mcp_action'.`,
        details: {
          taskId: task.id,
          receivedType: task.type,
          expectedType: "zapier_mcp_action",
          reason: "Invalid task type for tool.",
        },
      };
    }

    const { action, zapier_mcp_url, action_params } = task.params;

    // Parameter validation
    if (typeof action !== "string" || action.trim() === "") {
      return {
        success: false,
        error: "Invalid 'action' parameter: Must be a non-empty string.",
        details: {
          taskId: task.id,
          problematicParam: "action",
          reason: "Parameter 'action' must be a non-empty string.",
        },
      };
    }
    if (typeof zapier_mcp_url !== "string" || zapier_mcp_url.trim() === "") {
      return {
        success: false,
        error:
          "Invalid 'zapier_mcp_url' parameter: Must be a non-empty string.",
        details: {
          taskId: task.id,
          problematicParam: "zapier_mcp_url",
          action: action,
          reason: "Parameter 'zapier_mcp_url' must be a non-empty string.",
        },
      };
    }
    if (typeof action_params !== "object" || action_params === null) {
      return {
        success: false,
        error: "Invalid 'action_params' parameter: Must be an object.",
        details: {
          taskId: task.id,
          problematicParam: "action_params",
          action: action,
          mcp_url: zapier_mcp_url,
          reason: "Parameter 'action_params' must be an object.",
        },
      };
    }

    try {
      new URL(zapier_mcp_url);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      return {
        success: false,
        error: `Invalid zapier_mcp_url format: ${errorMessage}`,
        details: {
          taskId: task.id,
          action: action,
          mcp_url: zapier_mcp_url,
          reason: `Invalid zapier_mcp_url format. Error: ${errorMessage}`,
        },
      };
    }

    console.log(
      `ZapierMCPTool (Task ID: ${task.id}): Executing action '${action}' via MCP URL: ${zapier_mcp_url}`,
    );
    console.log(
      `ZapierMCPTool (Task ID: ${task.id}): Action parameters:`,
      action_params,
    );

    // Check if MCP Context is available
    if (!this.mcpContext) {
      console.warn(
        "ZapierMCPTool: MCP Context not available, attempting to reinitialize...",
      );
      await this.initializeMcpContext();

      if (!this.mcpContext) {
        return {
          success: false,
          error:
            "MCP Context not available. Please check ZAPIER_MCP_ENDPOINT_URL configuration.",
          details: {
            taskId: task.id,
            action: action,
            mcp_url: zapier_mcp_url,
            reason: "MCP Context initialization failed",
          },
        };
      }
    }

    try {
      // Create MCP Request
      const mcpRequest = new McpRequest({
        action: action,
        endpoint: zapier_mcp_url,
        parameters: action_params,
        metadata: {
          taskId: task.id,
          timestamp: new Date().toISOString(),
        },
      });

      console.log(
        `ZapierMCPTool (Task ID: ${task.id}): Sending MCP request...`,
      );

      // Execute the MCP request
      const mcpResponse: McpResponse =
        await this.mcpContext.execute(mcpRequest);

      console.log(
        `ZapierMCPTool (Task ID: ${task.id}): MCP request completed successfully.`,
      );

      // Process the response
      if (mcpResponse.success) {
        return {
          success: true,
          output: mcpResponse.data,
          details: {
            taskId: task.id,
            action: action,
            mcp_url: zapier_mcp_url,
            responseId: mcpResponse.id,
            executionTime: mcpResponse.executionTime,
            status: "MCP request executed successfully",
          },
        };
      } else {
        return {
          success: false,
          error:
            mcpResponse.error ||
            "MCP request failed without specific error message",
          details: {
            taskId: task.id,
            action: action,
            mcp_url: zapier_mcp_url,
            responseId: mcpResponse.id,
            mcpErrorCode: mcpResponse.errorCode,
            reason: "MCP reported execution failure",
          },
        };
      }
    } catch (error) {
      console.error(
        `ZapierMCPTool (Task ID: ${task.id}): Error executing MCP request:`,
        error,
      );

      if (error instanceof McpException) {
        return {
          success: false,
          error: `MCP Exception: ${error.message}`,
          details: {
            taskId: task.id,
            action: action,
            mcp_url: zapier_mcp_url,
            mcpErrorType: error.type,
            mcpErrorCode: error.code,
            reason: "MCP SDK exception occurred",
          },
        };
      } else {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Unknown error during MCP execution";
        return {
          success: false,
          error: errorMessage,
          details: {
            taskId: task.id,
            action: action,
            mcp_url: zapier_mcp_url,
            reason: "Unexpected error during MCP execution",
          },
        };
      }
    }
  }
}
