"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, Loader2, Play } from "lucide-react";

interface IExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  details?: any;
}

type TaskType = "code_execution" | "web_fetch" | "zapier_mcp_action";

interface TaskParams {
  code?: string;
  context?: string;
  url?: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: any;
  action?: string;
  zapier_mcp_url?: string;
  action_params?: Record<string, any>;
}

export default function AgentPreview() {
  const [taskType, setTaskType] = useState<TaskType>("code_execution");
  const [taskParams, setTaskParams] = useState<TaskParams>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<IExecutionResult | null>(null);
  const [headersText, setHeadersText] = useState("");
  const [actionParamsText, setActionParamsText] = useState("");

  const handleExecute = async () => {
    setIsExecuting(true);
    setResult(null);

    try {
      // Parse headers and action_params from text
      let headers: Record<string, string> | undefined;
      let actionParams: Record<string, any> | undefined;

      if (headersText.trim()) {
        try {
          headers = JSON.parse(headersText);
        } catch (e) {
          throw new Error("Invalid JSON format for headers");
        }
      }

      if (actionParamsText.trim()) {
        try {
          actionParams = JSON.parse(actionParamsText);
        } catch (e) {
          throw new Error("Invalid JSON format for action parameters");
        }
      }

      const finalParams = {
        ...taskParams,
        ...(headers && { headers }),
        ...(actionParams && { action_params: actionParams }),
      };

      const response = await fetch("/api/agent/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: taskType,
          params: finalParams,
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const renderTaskInputs = () => {
    switch (taskType) {
      case "code_execution":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="code">Python Code *</Label>
              <Textarea
                id="code"
                placeholder="print('Hello, World!')"
                value={taskParams.code || ""}
                onChange={(e) =>
                  setTaskParams({ ...taskParams, code: e.target.value })
                }
                className="min-h-[120px] font-mono"
              />
            </div>
            <div>
              <Label htmlFor="context">Context (Optional)</Label>
              <Input
                id="context"
                placeholder="Execution context or environment details"
                value={taskParams.context || ""}
                onChange={(e) =>
                  setTaskParams({ ...taskParams, context: e.target.value })
                }
              />
            </div>
          </div>
        );

      case "web_fetch":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="url">URL *</Label>
              <Input
                id="url"
                placeholder="https://api.example.com/data"
                value={taskParams.url || ""}
                onChange={(e) =>
                  setTaskParams({ ...taskParams, url: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="method">HTTP Method</Label>
              <Select
                value={taskParams.method || "GET"}
                onValueChange={(value: "GET" | "POST") =>
                  setTaskParams({ ...taskParams, method: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="headers">Headers (JSON format, optional)</Label>
              <Textarea
                id="headers"
                placeholder='{"Authorization": "Bearer token", "Content-Type": "application/json"}'
                value={headersText}
                onChange={(e) => setHeadersText(e.target.value)}
                className="font-mono"
              />
            </div>
            <div>
              <Label htmlFor="body">Request Body (optional)</Label>
              <Textarea
                id="body"
                placeholder="Request body content"
                value={taskParams.body || ""}
                onChange={(e) =>
                  setTaskParams({ ...taskParams, body: e.target.value })
                }
              />
            </div>
          </div>
        );

      case "zapier_mcp_action":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="action">Action *</Label>
              <Input
                id="action"
                placeholder="send_email, create_task, etc."
                value={taskParams.action || ""}
                onChange={(e) =>
                  setTaskParams({ ...taskParams, action: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="zapier_mcp_url">Zapier MCP URL *</Label>
              <Input
                id="zapier_mcp_url"
                placeholder="https://hooks.zapier.com/hooks/catch/123/abc"
                value={taskParams.zapier_mcp_url || ""}
                onChange={(e) =>
                  setTaskParams({
                    ...taskParams,
                    zapier_mcp_url: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="action_params">
                Action Parameters (JSON format) *
              </Label>
              <Textarea
                id="action_params"
                placeholder='{"to": "user@example.com", "subject": "Hello", "body": "Test message"}'
                value={actionParamsText}
                onChange={(e) => setActionParamsText(e.target.value)}
                className="min-h-[120px] font-mono"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderResult = () => {
    if (!result) return null;

    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {result.success ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            Execution Result
            <Badge variant={result.success ? "default" : "destructive"}>
              {result.success ? "Success" : "Failed"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {result.error && (
            <Alert variant="destructive">
              <AlertDescription>
                <strong>Error:</strong> {result.error}
              </AlertDescription>
            </Alert>
          )}

          {result.output && (
            <div>
              <Label className="text-sm font-medium">Output:</Label>
              <pre className="mt-2 p-3 bg-gray-50 rounded-md text-sm overflow-auto max-h-64">
                {typeof result.output === "string"
                  ? result.output
                  : JSON.stringify(result.output, null, 2)}
              </pre>
            </div>
          )}

          {result.details && (
            <div>
              <Label className="text-sm font-medium">Details:</Label>
              <pre className="mt-2 p-3 bg-gray-50 rounded-md text-sm overflow-auto max-h-64">
                {JSON.stringify(result.details, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Agent Task Executor</CardTitle>
            <CardDescription>
              Test different agent tasks including code execution, web fetching,
              and Zapier MCP actions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="task-type">Task Type</Label>
              <Select
                value={taskType}
                onValueChange={(value: TaskType) => {
                  setTaskType(value);
                  setTaskParams({});
                  setHeadersText("");
                  setActionParamsText("");
                  setResult(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="code_execution">Code Execution</SelectItem>
                  <SelectItem value="web_fetch">Web Fetch</SelectItem>
                  <SelectItem value="zapier_mcp_action">
                    Zapier MCP Action
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {renderTaskInputs()}

            <Button
              onClick={handleExecute}
              disabled={isExecuting}
              className="w-full"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Execute Task
                </>
              )}
            </Button>

            {renderResult()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
