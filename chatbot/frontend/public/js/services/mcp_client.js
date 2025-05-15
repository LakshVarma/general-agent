/**
 * MCP client service for interacting with the MCP API.
 */

class MCPClientService {
    constructor() {
        this.apiUrl = '/api/mcp';
        this.services = {};
    }

    /**
     * List available MCP services and their tools.
     * @returns {Promise} A promise that resolves with the list of services.
     */
    async listServices() {
        try {
            const response = await fetch(`${this.apiUrl}/services`);

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const result = await response.json();
            if (result.success && result.services) {
                this.services = result.services;
            }

            return result;
        } catch (error) {
            console.error('Error listing MCP services:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * List all available MCP tools.
     * @returns {Promise} A promise that resolves with the list of tools.
     */
    async listTools() {
        try {
            const response = await fetch(`${this.apiUrl}/tools`);

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error listing MCP tools:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Call a specific MCP tool with parameters.
     * @param {string} toolName - The name of the tool to call.
     * @param {Object} params - The parameters to pass to the tool.
     * @returns {Promise} A promise that resolves with the result.
     */
    async callTool(toolName, params) {
        try {
            // Use the streaming endpoint for tool calls to get the "Connecting to tool..." animation
            const response = await fetch(`${this.apiUrl}/call`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tool_name: toolName,
                    params: params
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            // Process the streaming response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            let buffer = '';
            let result = null;
            
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
                        
                        // If this is the final result, store it
                        if (data.success !== undefined) {
                            result = data;
                        }
                        
                        // If this is a status message, we could display it somewhere
                        if (data.type === 'status') {
                            console.log('Tool status:', data.text);
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
                    if (data.success !== undefined) {
                        result = data;
                    }
                } catch (e) {
                    console.error('Error parsing stream data:', e, buffer);
                }
            }
            
            return result || { success: false, error: 'No result received' };
        } catch (error) {
            console.error(`Error calling tool ${toolName}:`, error);
            return { success: false, error: error.message };
        }
    }

    // Gmail specific methods
    async gmailSearchEmails(query) {
        return await this.callTool('gmail_find_email', { query });
    }

    async gmailSendEmail(emailData) {
        return await this.callTool('gmail_send_email', emailData);
    }

    // Zoom specific methods
    async zoomCreateMeeting(meetingData) {
        return await this.callTool('zoom_create_meeting', meetingData);
    }

    // Google Drive specific methods
    async driveFindFile(title) {
        return await this.callTool('google_drive_find_a_file', { title });
    }
}

// Export the service
window.mcpClientService = new MCPClientService();
