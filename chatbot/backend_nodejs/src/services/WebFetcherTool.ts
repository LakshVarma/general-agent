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
        error: `Invalid task type for WebFetcherTool: ${task.type}. Expected 'web_fetch'.`,
        details: { taskId: task.id }
      };
    }

    const { url, method = 'GET', headers, body } = task.params;

    if (typeof url !== 'string') {
        return {
            success: false,
            error: "Invalid URL parameter: URL must be a string.",
            details: { taskId: task.id, providedUrl: url }
        };
    }

    try {
      // Basic URL validation (does it look like a URL?)
      new URL(url); 
    } catch (e) {
      return {
        success: false,
        error: `Invalid URL format: ${(e as Error).message}`,
        details: { taskId: task.id, url: url }
      };
    }
    
    if (method !== 'GET') {
        // For now, as per prompt, only GET is implemented.
        // Can be expanded to support POST etc. later.
        return {
            success: false,
            error: `HTTP method ${method} is not supported by this version of WebFetcherTool. Only GET is allowed.`,
            details: { taskId: task.id, url: url }
        };
    }

    console.log(`WebFetcherTool (Task ID: ${task.id}): Fetching URL - ${url} using ${method}`);

    try {
      const response: AxiosResponse = await axios.request({
          url,
          method: method, // Ensure this is 'GET' as per current constraint
          headers: headers,
          data: body // For GET, body is typically ignored but axios allows it
      });
      
      return {
        success: true,
        output: response.data,
        details: { url: url, status: response.status, taskId: task.id }
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error(`WebFetcherTool (Task ID: ${task.id}): Error fetching URL ${url}. Error: ${axiosError.message}`);
      return {
        success: false,
        error: axiosError.message,
        details: { 
          url: url, 
          status: axiosError.response?.status, 
          responseData: axiosError.response?.data,
          taskId: task.id 
        }
      };
    }
  }
}
