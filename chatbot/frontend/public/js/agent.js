/**
 * Agent JavaScript for handling streaming responses and code execution.
 */

class AgentService {
    constructor() {
        // DOM elements
        this.chatMessages = document.getElementById('chat-messages');
        this.chatForm = document.getElementById('chat-form');
        this.userInput = document.getElementById('user-input');
        this.modelSelector = document.getElementById('model-selector');

        // API endpoints
        this.streamUrl = 'http://localhost:5000/api/stream';
        this.executeUrl = 'http://localhost:5000/api/execute';

        // State
        this.currentMessageId = null;
        this.currentModel = this.modelSelector ? this.modelSelector.value : 'nvidia';
        this.isStreaming = false;

        // Initialize event listeners
        this.initEventListeners();
    }

    initEventListeners() {
        // We don't need to handle form submission here anymore
        // as it's handled by enhanced.js

        // Handle model selection
        if (this.modelSelector) {
            this.modelSelector.addEventListener('change', () => {
                this.currentModel = this.modelSelector.value;
            });
        }

        // Add global handler for code execution buttons
        document.addEventListener('click', (event) => {
            if (event.target.classList.contains('execute-code-btn')) {
                const codeBlock = event.target.closest('.code-block');
                if (codeBlock) {
                    const codeElement = codeBlock.querySelector('code');
                    if (codeElement) {
                        this.executeCode(codeElement.textContent);
                    }
                }
            } else if (event.target.classList.contains('toggle-code-btn')) {
                const codeBlock = event.target.closest('.code-block');
                if (codeBlock) {
                    const codeElement = codeBlock.querySelector('pre');
                    if (codeElement) {
                        codeElement.classList.toggle('hidden');
                        event.target.textContent = codeElement.classList.contains('hidden') ? 'Show Code' : 'Hide Code';
                    }
                }
            }
        });
    }

    /**
     * Handle a user message submission
     * This method is called from enhanced.js
     * @param {string} message - The user's message
     */
    async handleSubmit(message) {
        // If the message is empty, do nothing
        if (!message) return;

        // No need to add user message or clear input as that's handled by enhanced.js

        // Show typing indicator
        this.showTypingIndicator();

        // Stream the response
        await this.streamResponse(message);

        // Return true to indicate success
        return true;
    }

    async streamResponse(message) {
        if (this.isStreaming) {
            console.warn('Already streaming a response');
            return;
        }

        this.isStreaming = true;

        try {
            // Remove typing indicator
            this.removeTypingIndicator();

            // Use the global streaming service if available
            if (window.streamingService) {
                // Initialize the streaming service with the chat messages container
                window.streamingService.init(this.chatMessages);

                // Set the current model
                window.streamingService.setModel(this.currentModel);

                // Stream the response
                await window.streamingService.streamResponse(
                    message,
                    // onStart callback
                    (messageElement, messageContent) => {
                        // Nothing to do here, the streaming service will add the message element to the chat
                    },
                    // onComplete callback
                    (finalText, messageElement, messageContent, data) => {
                        // Format the content with code blocks
                        if (finalText) {
                            const formattedContent = this.formatMessageWithCodeBlocks(finalText);
                            messageContent.innerHTML = formattedContent;

                            // If the model used is different from the selected model, show a note
                            if (data && data.model_used && data.model_used !== this.currentModel) {
                                const modelNoteElement = document.createElement('div');
                                modelNoteElement.className = 'model-fallback-note';
                                modelNoteElement.innerHTML = `<i>Note: Response generated using ${data.model_used === 'gemini' ? 'Google Gemini' : 'NVIDIA AI'} due to connection issues.</i>`;
                                messageContent.appendChild(modelNoteElement);
                            }
                        }

                        // Apply syntax highlighting to code blocks
                        messageElement.querySelectorAll('pre code').forEach((block) => {
                            hljs.highlightElement(block);
                        });

                        // Scroll to bottom
                        this.scrollToBottom();
                    },
                    // onError callback
                    (error) => {
                        console.error('Error streaming response:', error);

                        // Show error message
                        this.addAssistantMessage(
                            `I'm sorry, I encountered an error: ${error.message}. Please try again.`
                        );
                    }
                );
            } else {
                // Fall back to the old implementation if the streaming service is not available
                const response = await fetch(this.streamUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: message,
                        model: this.currentModel
                    })
                });

                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                // Create a message container for the assistant's response
                const messageElement = document.createElement('div');
                messageElement.className = 'message assistant-message';
                messageElement.innerHTML = '<div class="message-content"></div>';

                const messageContent = messageElement.querySelector('.message-content');

                // Add the message element to the chat
                this.chatMessages.appendChild(messageElement);

                // Process the stream
                let buffer = '';
                let done = false;

                while (!done) {
                    const { value, done: readerDone } = await reader.read();
                    if (readerDone) {
                        done = true;
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
                            await this.processStreamData(data, messageContent);
                        } catch (e) {
                            console.error('Error parsing stream data:', e, line);
                        }
                    }

                    // Scroll to bottom
                    this.scrollToBottom();
                }

                // Process any remaining data in the buffer
                if (buffer.trim() !== '') {
                    try {
                        const data = JSON.parse(buffer);
                        await this.processStreamData(data, messageContent);
                    } catch (e) {
                        console.error('Error parsing stream data:', e, buffer);
                    }
                }

                // Apply syntax highlighting to code blocks
                messageElement.querySelectorAll('pre code').forEach((block) => {
                    hljs.highlightElement(block);
                });

                // Scroll to bottom
                this.scrollToBottom();
            }
        } catch (error) {
            console.error('Error streaming response:', error);

            // Show error message
            this.addAssistantMessage(
                `I'm sorry, I encountered an error: ${error.message}. Please try again.`
            );
        } finally {
            this.isStreaming = false;
        }
    }

    async processStreamData(data, messageContent) {
        switch (data.type) {
            case 'metadata':
                this.currentMessageId = data.message_id;
                break;

            case 'content':
                // Format the content with code blocks
                const formattedContent = this.formatMessageWithCodeBlocks(data.text);
                messageContent.innerHTML = formattedContent;

                // If the model used is different from the selected model, show a note
                if (data.model_used && data.model_used !== this.currentModel) {
                    const modelNoteElement = document.createElement('div');
                    modelNoteElement.className = 'model-fallback-note';
                    modelNoteElement.innerHTML = `<i>Note: Response generated using ${data.model_used === 'gemini' ? 'Google Gemini' : 'NVIDIA AI'} due to connection issues.</i>`;
                    messageContent.appendChild(modelNoteElement);
                }
                break;

            case 'status':
                // Add a status message
                const statusElement = document.createElement('div');
                statusElement.className = 'status-message';
                statusElement.textContent = data.text;
                messageContent.appendChild(statusElement);
                break;

            case 'execution_result':
                // Add execution results
                await this.displayExecutionResults(data.result, messageContent);
                break;

            case 'done':
                // Nothing to do here
                break;

            default:
                console.warn('Unknown stream data type:', data.type);
        }
    }

    formatMessageWithCodeBlocks(text) {
        // Replace code blocks with formatted HTML
        let formattedText = text.replace(/```python\s*([\s\S]*?)\s*```/g, (match, code) => {
            return `
                <div class="code-block">
                    <div class="code-header">
                        <span class="code-language">Python</span>
                        <div class="code-actions">
                            <button class="toggle-code-btn">Hide Code</button>
                            <button class="execute-code-btn">▶ Run</button>
                        </div>
                    </div>
                    <pre><code class="language-python">${this.escapeHTML(code)}</code></pre>
                </div>
            `;
        });

        // Replace other code blocks
        formattedText = formattedText.replace(/```(\w*)\s*([\s\S]*?)\s*```/g, (match, language, code) => {
            language = language || 'plaintext';
            return `
                <div class="code-block">
                    <div class="code-header">
                        <span class="code-language">${language}</span>
                        <div class="code-actions">
                            <button class="toggle-code-btn">Hide Code</button>
                        </div>
                    </div>
                    <pre><code class="language-${language}">${this.escapeHTML(code)}</code></pre>
                </div>
            `;
        });

        // Convert line breaks to <br> tags
        formattedText = formattedText.replace(/\n/g, '<br>');

        return formattedText;
    }

    async executeCode(code) {
        try {
            const response = await fetch(this.executeUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ code })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const result = await response.json();

            // Find the closest message content
            const messageElement = document.querySelector('.message.assistant-message:last-child .message-content');
            if (messageElement) {
                await this.displayExecutionResults(result, messageElement);
            }

        } catch (error) {
            console.error('Error executing code:', error);
            alert(`Error executing code: ${error.message}`);
        }
    }

    async displayExecutionResults(result, container) {
        const resultElement = document.createElement('div');
        resultElement.className = 'execution-result';

        if (result.success) {
            resultElement.innerHTML = `
                <div class="result-header success">
                    <span>Code executed successfully</span>
                </div>
                <div class="result-content">
                    ${result.stdout ? `<div class="result-stdout"><h4>Output:</h4><pre>${this.escapeHTML(result.stdout)}</pre></div>` : ''}
                    ${result.stderr ? `<div class="result-stderr"><h4>Errors/Warnings:</h4><pre>${this.escapeHTML(result.stderr)}</pre></div>` : ''}
                </div>
            `;

            // Add plots if any
            if (result.plots && result.plots.length > 0) {
                const plotsContainer = document.createElement('div');
                plotsContainer.className = 'result-plots';
                plotsContainer.innerHTML = '<h4>Plots:</h4>';

                result.plots.forEach(plot => {
                    const plotElement = document.createElement('div');
                    plotElement.className = 'plot';
                    plotElement.innerHTML = `<img src="data:image/png;base64,${plot.data}" alt="${plot.filename}">`;
                    plotsContainer.appendChild(plotElement);
                });

                resultElement.querySelector('.result-content').appendChild(plotsContainer);
            }

            // Add generated files if any
            if (result.files && result.files.length > 0) {
                const filesContainer = document.createElement('div');
                filesContainer.className = 'result-files';
                filesContainer.innerHTML = '<h4>Generated Files:</h4>';

                result.files.forEach(file => {
                    const fileElement = document.createElement('div');
                    fileElement.className = 'file';
                    fileElement.innerHTML = `<p>${file.filename}</p>`;

                    if (file.preview) {
                        fileElement.innerHTML += `<div class="file-preview">${file.preview}</div>`;
                    }

                    filesContainer.appendChild(fileElement);
                });

                resultElement.querySelector('.result-content').appendChild(filesContainer);
            }
        } else {
            resultElement.innerHTML = `
                <div class="result-header error">
                    <span>Code execution failed</span>
                </div>
                <div class="result-content">
                    <div class="result-error"><h4>Error:</h4><pre>${this.escapeHTML(result.error || 'Unknown error')}</pre></div>
                    ${result.stdout ? `<div class="result-stdout"><h4>Output:</h4><pre>${this.escapeHTML(result.stdout)}</pre></div>` : ''}
                    ${result.stderr ? `<div class="result-stderr"><h4>Errors/Warnings:</h4><pre>${this.escapeHTML(result.stderr)}</pre></div>` : ''}
                </div>
            `;
        }

        container.appendChild(resultElement);
    }

    addUserMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message user-message';
        messageElement.innerHTML = `
            <div class="message-content">
                <p>${this.escapeHTML(message)}</p>
            </div>
        `;

        this.chatMessages.appendChild(messageElement);
        this.scrollToBottom();
    }

    addAssistantMessage(message) {
        // Remove typing indicator if it exists
        this.removeTypingIndicator();

        const messageElement = document.createElement('div');
        messageElement.className = 'message assistant-message';
        messageElement.innerHTML = `
            <div class="message-content">
                ${message}
            </div>
        `;

        this.chatMessages.appendChild(messageElement);
        this.scrollToBottom();
    }

    showTypingIndicator() {
        const typingElement = document.createElement('div');
        typingElement.className = 'typing-indicator';
        typingElement.id = 'typing-indicator';
        typingElement.innerHTML = `
            <span></span>
            <span></span>
            <span></span>
        `;

        this.chatMessages.appendChild(typingElement);
        this.scrollToBottom();
    }

    removeTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    escapeHTML(html) {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    }
}

// Initialize the agent service when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Agent service initialized - v1.0');
    window.agentService = new AgentService();
});
