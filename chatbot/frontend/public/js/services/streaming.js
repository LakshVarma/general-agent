/**
 * Streaming service for the chatbot.
 */

class StreamingService {
    constructor() {
        // Use a relative URL to avoid CORS issues
        this.apiUrl = '/api/stream';
        this.messageQueue = [];
        this.isProcessing = false;

        console.log('StreamingService initialized with API URL:', this.apiUrl);
    }

    /**
     * Stream a chat response.
     * @param {string} message - The user's message.
     * @param {string} model - The model to use.
     * @param {Function} onChunk - Callback for each chunk.
     * @param {Function} onStatus - Callback for status messages.
     * @param {Function} onMCPAction - Callback for MCP actions.
     * @param {Function} onMCPResult - Callback for MCP results.
     * @param {Function} onError - Callback for errors.
     * @param {Function} onDone - Callback when streaming is done.
     */
    async streamResponse(message, model, onChunk, onStatus, onMCPAction, onMCPResult, onError, onDone) {
        try {
            console.log('Sending request to:', this.apiUrl);
            console.log('Request payload:', { message, model });

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream'
                },
                body: JSON.stringify({
                    message,
                    model
                }),
                mode: 'cors',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();

                if (done) {
                    break;
                }

                buffer += decoder.decode(value, { stream: true });

                // Process complete lines
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep the last incomplete line in the buffer

                for (const line of lines) {
                    if (line.trim() === '') continue;

                    try {
                        const data = JSON.parse(line);

                        // Handle different types of data
                        if (data.type === 'content') {
                            if (onChunk) onChunk(data.text, data.model_used);
                        } else if (data.type === 'status') {
                            if (onStatus) onStatus(data.text);
                        } else if (data.type === 'mcp_action') {
                            if (onMCPAction) onMCPAction(data.service, data.action);
                        } else if (data.type === 'mcp_result') {
                            if (onMCPResult) onMCPResult(data.service, data.action, data.result);
                        } else if (data.type === 'error') {
                            if (onError) onError(data.text);
                        } else if (data.type === 'done') {
                            if (onDone) onDone();
                        }
                    } catch (e) {
                        console.error('Error parsing stream data:', e, line);
                    }
                }
            }

            // Process any remaining data in the buffer
            if (buffer.trim() !== '') {
                try {
                    const data = JSON.parse(buffer);

                    // Handle different types of data
                    if (data.type === 'content') {
                        if (onChunk) onChunk(data.text, data.model_used);
                    } else if (data.type === 'status') {
                        if (onStatus) onStatus(data.text);
                    } else if (data.type === 'mcp_action') {
                        if (onMCPAction) onMCPAction(data.service, data.action);
                    } else if (data.type === 'mcp_result') {
                        if (onMCPResult) onMCPResult(data.service, data.action, data.result);
                    } else if (data.type === 'error') {
                        if (onError) onError(data.text);
                    } else if (data.type === 'done') {
                        if (onDone) onDone();
                    }
                } catch (e) {
                    console.error('Error parsing stream data:', e, buffer);
                }
            }

            // Call onDone if it hasn't been called yet
            if (onDone) onDone();
        } catch (error) {
            console.error('Error streaming response:', error);
            if (onError) onError(error.message);
            if (onDone) onDone();
        }
    }

    /**
     * Queue a message for streaming.
     * @param {string} message - The user's message.
     * @param {string} model - The model to use.
     * @param {Function} onChunk - Callback for each chunk.
     * @param {Function} onStatus - Callback for status messages.
     * @param {Function} onMCPAction - Callback for MCP actions.
     * @param {Function} onMCPResult - Callback for MCP results.
     * @param {Function} onError - Callback for errors.
     * @param {Function} onDone - Callback when streaming is done.
     */
    queueMessage(message, model, onChunk, onStatus, onMCPAction, onMCPResult, onError, onDone) {
        this.messageQueue.push({
            message,
            model,
            onChunk,
            onStatus,
            onMCPAction,
            onMCPResult,
            onError,
            onDone
        });

        this.processQueue();
    }

    /**
     * Process the message queue.
     */
    async processQueue() {
        if (this.isProcessing || this.messageQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        const {
            message,
            model,
            onChunk,
            onStatus,
            onMCPAction,
            onMCPResult,
            onError,
            onDone
        } = this.messageQueue.shift();

        await this.streamResponse(
            message,
            model,
            onChunk,
            onStatus,
            onMCPAction,
            onMCPResult,
            onError,
            () => {
                this.isProcessing = false;
                if (onDone) onDone();
                this.processQueue();
            }
        );
    }
}

// Export the service
window.streamingService = new StreamingService();
