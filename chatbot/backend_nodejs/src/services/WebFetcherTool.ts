import axios, { AxiosResponse, AxiosError } from 'axios';
import { ITool, IWebFetchTask, IExecutionResult } from '../interfaces';

export class WebFetcherTool implements ITool {
  public name: string = "WebFetcher";
  public description: string = "Fetches content from a given URL.";

  /**
   * Executes a web fetch task.
   * @param task The web fetch task, conforming to IWebFetchTask.
   * @returns A Promise that resolves with the execution result.
   */
  public async execute(task: IWebFetchTask): Promise<IExecutionResult> {
    if (task.type !== 'web_fetch') {
      return {
        success: false,
        error: `Invalid task type for WebFetcherTool: '${task.type}'. Expected 'web_fetch'.`,
        details: { 
          taskId: task.id,
          receivedType: task.type,
          expectedType: 'web_fetch',
          reason: "Invalid task type for tool."
        }
      };
    }

    const { url, method = 'GET', headers, body } = task.params;

    if (typeof url !== 'string') {
        return {
            success: false,
            error: "Invalid URL parameter: URL must be a string.",
            details: { 
              taskId: task.id, 
              providedUrl: url, // Shows what was provided
              reason: "URL parameter must be a string." 
            }
        };
    }

    try {
      new URL(url); 
    } catch (e) {
      const errorMessage = (e instanceof Error) ? e.message : String(e);
      return {
        success: false,
        error: `Invalid URL format: ${errorMessage}`,
        details: { 
          taskId: task.id, 
          url: url,
          reason: `Invalid URL format provided. Error: ${errorMessage}`
        }
      };
    }
    
    if (method !== 'GET') {
        return {
            success: false,
            error: `HTTP method '${method}' is not supported by this version of WebFetcherTool. Only GET is allowed.`,
            details: { 
              taskId: task.id, 
              url: url,
              receivedMethod: method,
              expectedMethod: 'GET',
              reason: "Unsupported HTTP method."
            }
        };
    }

    console.log(`WebFetcherTool (Task ID: ${task.id}): Fetching URL - ${url} using ${method}`);

    try {
      const response: AxiosResponse = await axios.request({
          url,
          method: method,
          headers: headers,
          data: body,
          // It's good practice to set a timeout for external requests
          timeout: 10000 // 10 seconds, for example
      });
      
      return {
        success: true,
        output: response.data, // Consider truncating if response can be very large
        details: { 
          taskId: task.id,
          url: url, 
          status: response.status, 
          method: method
        }
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error(`WebFetcherTool (Task ID: ${task.id}): Error fetching URL ${url}. Error: ${axiosError.message}`);
      
      // Sanitize or truncate responseData if it's too large or sensitive
      let responseDataSummary: any = axiosError.response?.data;
      if (typeof responseDataSummary === 'string' && responseDataSummary.length > 200) {
        responseDataSummary = responseDataSummary.substring(0, 200) + "... (truncated)";
      } else if (typeof responseDataSummary === 'object') {
        // Could stringify and truncate, or just summarize keys
        responseDataSummary = "Object data received, not fully displayed for brevity.";
      }

      return {
        success: false,
        error: axiosError.message, // This message usually includes the status code for HTTP errors
        details: { 
          taskId: task.id,
          url: url, 
          method: method,
          status: axiosError.response?.status, 
          responseDataSummary: responseDataSummary, // Use the summarized version
          reason: `Axios request failed. ${axiosError.isAxiosError ? 'Axios specific error.' : 'Unknown error during HTTP request.'}`
        }
      };
    }
  }
}
