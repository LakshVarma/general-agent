/**
 * Chat functionality for the chatbot.
 */

class ChatService {
    constructor(ui) {
        this.ui = ui;
        this.apiUrl = '/api/chat';
        this.resetUrl = '/api/reset';
        this.streamUrl = '/api/stream';
        this.useStreaming = true; // Enable streaming by default
    }

    /**
     * Send a message to the chatbot API.
     * @param {string} message - The message to send.
     * @returns {Promise} A promise that resolves with the response.
     */
    async sendMessage(message) {
        try {
            // Show typing indicator
            this.ui.showTypingIndicator();

            // Check if we should use streaming
            if (this.useStreaming && window.streamingService) {
                // Remove typing indicator since we'll use streaming
                this.ui.removeTypingIndicator();

                // Initialize the streaming service with the chat messages container
                window.streamingService.init(this.ui.chatMessages);

                // Set the current model if available
                if (window.modelSelector) {
                    const modelValue = window.modelSelector.value;
                    window.streamingService.setModel(modelValue);
                }

                // Stream the response
                await window.streamingService.streamResponse(
                    message,
                    // onStart callback
                    (messageElement, messageContent) => {
                        // The streaming service will add the message element to the chat
                    },
                    // onComplete callback
                    (finalText, messageElement, messageContent, data) => {
                        // Apply syntax highlighting to code blocks
                        messageElement.querySelectorAll('pre code').forEach((block) => {
                            if (window.hljs) {
                                window.hljs.highlightElement(block);
                            }
                        });

                        // Apply LaTeX rendering if available
                        if (window.renderMathInElement) {
                            try {
                                window.renderMathInElement(messageContent, {
                                    delimiters: [
                                        {left: '$$', right: '$$', display: true},
                                        {left: '$', right: '$', display: false},
                                        {left: '\\(', right: '\\)', display: false},
                                        {left: '\\[', right: '\\]', display: true}
                                    ],
                                    throwOnError: false
                                });
                            } catch (e) {
                                console.error('Error rendering LaTeX:', e);
                            }
                        }
                    },
                    // onError callback
                    (error) => {
                        console.error('Error streaming response:', error);

                        // Show error message
                        this.ui.addAssistantMessage(
                            `I'm sorry, I encountered an error: ${error.message}. Please try again.`
                        );
                    }
                );

                return { success: true };
            } else {
                // Use the regular API if streaming is not available
                const response = await fetch(this.apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ message })
                });

                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }

                const data = await response.json();
                return data;
            }
        } catch (error) {
            console.error('Error sending message:', error);

            // Remove typing indicator
            this.ui.removeTypingIndicator();

            // Show error message
            this.ui.addAssistantMessage(
                `I'm sorry, I encountered an error: ${error.message}. Please try again.`
            );

            return null;
        }
    }

    /**
     * Reset the chat history.
     * @returns {Promise} A promise that resolves when the chat is reset.
     */
    async resetChat() {
        try {
            const response = await fetch(this.resetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error resetting chat:', error);
            return null;
        }
    }
}
