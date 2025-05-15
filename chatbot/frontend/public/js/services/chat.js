/**
 * Chat service for the chatbot.
 */

class ChatService {
    constructor(streamingService, mcpClientService) {
        this.streamingService = streamingService;
        this.mcpClientService = mcpClientService;
        this.messageContainer = document.getElementById('chat-messages');
        this.messageInput = document.getElementById('user-input');
        this.sendButton = document.querySelector('#chat-form button[type="submit"]');
        this.resetButton = document.getElementById('clear-btn');
        this.modelSelect = document.getElementById('model-select');
        this.uploadButton = document.getElementById('upload-btn');
        this.micButton = document.getElementById('mic-btn');
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isWaitingForResponse = false;

        this.init();
    }

    /**
     * Initialize the chat service.
     */
    init() {
        // Add event listeners
        const chatForm = document.getElementById('chat-form');
        if (chatForm) {
            chatForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.sendMessage();
            });
        }

        this.resetButton.addEventListener('click', () => this.resetChat());
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Initialize file upload
        if (this.uploadButton) {
            this.uploadButton.addEventListener('click', () => this.handleFileUpload());
        }

        // Initialize microphone
        if (this.micButton) {
            this.micButton.addEventListener('click', () => this.toggleRecording());
        }

        console.log('Chat service initialized with elements:', {
            messageContainer: this.messageContainer,
            messageInput: this.messageInput,
            sendButton: this.sendButton,
            resetButton: this.resetButton,
            uploadButton: this.uploadButton,
            micButton: this.micButton
        });
    }

    /**
     * Send a message to the chatbot.
     */
    sendMessage() {
        const message = this.messageInput.value.trim();

        if (message === '' || this.isWaitingForResponse) {
            return;
        }

        // Clear the input
        this.messageInput.value = '';

        // Add the user message to the UI
        this.addUserMessage(message);

        // Set waiting state
        this.isWaitingForResponse = true;
        this.sendButton.disabled = true;

        // Get the selected model
        const model = this.modelSelect ? this.modelSelect.value : 'gemini';

        // Create a message element for the assistant's response
        const assistantMessageElement = this.createAssistantMessageElement();
        this.messageContainer.appendChild(assistantMessageElement);

        // Scroll to the bottom
        this.scrollToBottom();

        // Stream the response
        this.streamingService.queueMessage(
            message,
            model,
            (text, modelUsed) => this.handleResponseChunk(assistantMessageElement, text, modelUsed),
            (text) => this.handleStatusMessage(assistantMessageElement, text),
            (service, action) => this.handleMCPAction(assistantMessageElement, service, action),
            (service, action, result) => this.handleMCPResult(assistantMessageElement, service, action, result),
            (error) => this.handleError(assistantMessageElement, error),
            () => this.handleStreamingDone()
        );
    }

    /**
     * Add a user message to the UI.
     * @param {string} message - The user's message.
     */
    addUserMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message user-message';

        const avatarElement = document.createElement('div');
        avatarElement.className = 'avatar user-avatar';
        avatarElement.innerHTML = '<i class="fas fa-user"></i>';
        messageElement.appendChild(avatarElement);

        const contentElement = document.createElement('div');
        contentElement.className = 'message-content';
        contentElement.innerHTML = this.formatMessage(message);
        messageElement.appendChild(contentElement);

        this.messageContainer.appendChild(messageElement);
        this.scrollToBottom();
    }

    /**
     * Create an assistant message element.
     * @returns {HTMLElement} The assistant message element.
     */
    createAssistantMessageElement() {
        const messageElement = document.createElement('div');
        messageElement.className = 'message assistant-message';

        const avatarElement = document.createElement('div');
        avatarElement.className = 'avatar assistant-avatar';
        avatarElement.innerHTML = '<i class="fas fa-robot"></i>';
        messageElement.appendChild(avatarElement);

        const contentElement = document.createElement('div');
        contentElement.className = 'message-content';
        messageElement.appendChild(contentElement);

        return messageElement;
    }

    /**
     * Handle a response chunk from the streaming service.
     * @param {HTMLElement} messageElement - The message element.
     * @param {string} text - The response text.
     * @param {string} modelUsed - The model used.
     */
    handleResponseChunk(messageElement, text, modelUsed) {
        const contentElement = messageElement.querySelector('.message-content');
        contentElement.innerHTML = this.formatMessage(text);

        // Add model badge if not already added
        if (modelUsed && !messageElement.querySelector('.model-badge')) {
            const badgeElement = document.createElement('div');
            badgeElement.className = `model-badge ${modelUsed}-badge`;
            badgeElement.textContent = modelUsed.charAt(0).toUpperCase() + modelUsed.slice(1);
            messageElement.appendChild(badgeElement);
        }

        this.scrollToBottom();
    }

    /**
     * Handle a status message from the streaming service.
     * @param {HTMLElement} messageElement - The message element.
     * @param {string} text - The status message text.
     */
    handleStatusMessage(messageElement, text) {
        const contentElement = messageElement.querySelector('.message-content');

        // Check if this is a tool connection message
        if (text.includes('Connecting to')) {
            // Extract the service name from the message
            let service = 'tool';
            let action = '';

            if (text.includes('Gmail')) {
                service = 'gmail';
                if (text.includes('send_email')) {
                    action = 'send_email';
                } else if (text.includes('find_email')) {
                    action = 'find_email';
                }
            } else if (text.includes('Zoom')) {
                service = 'zoom';
                if (text.includes('create_meeting')) {
                    action = 'create_meeting';
                }
            } else if (text.includes('Google Drive')) {
                service = 'google_drive';
                if (text.includes('find_a_file')) {
                    action = 'find_a_file';
                }
            }

            // Create the tool connection status message
            const statusElement = window.toolConnectionComponent.createStatusMessage(text, service, action);
            contentElement.appendChild(statusElement);
        } else {
            // Regular status message
            const statusElement = document.createElement('div');
            statusElement.className = 'status-message';
            statusElement.textContent = text;
            contentElement.appendChild(statusElement);
        }

        this.scrollToBottom();
    }

    /**
     * Handle an MCP action from the streaming service.
     * @param {HTMLElement} messageElement - The message element.
     * @param {string} service - The service name.
     * @param {string} action - The action name.
     */
    handleMCPAction(messageElement, service, action) {
        const contentElement = messageElement.querySelector('.message-content');

        // Create the appropriate form based on the service and action
        if (service === 'gmail' && action === 'compose_email') {
            const formElement = window.mcpUI.createEmailForm();
            contentElement.appendChild(formElement);
        } else if (service === 'zoom' && action === 'create_meeting') {
            const formElement = window.mcpUI.createMeetingForm();
            contentElement.appendChild(formElement);
        }

        this.scrollToBottom();
    }

    /**
     * Handle an MCP result from the streaming service.
     * @param {HTMLElement} messageElement - The message element.
     * @param {string} service - The service name.
     * @param {string} action - The action name.
     * @param {Object} result - The result object.
     */
    handleMCPResult(messageElement, service, action, result) {
        const contentElement = messageElement.querySelector('.message-content');

        // Remove any existing tool connection status messages
        const statusElements = contentElement.querySelectorAll('.status-message.tool-connecting');
        statusElements.forEach(element => element.remove());

        // Create a success or error message based on the result
        if (result.success) {
            const successElement = window.toolConnectionComponent.createSuccessMessage(`${service} ${action} completed successfully.`);
            contentElement.appendChild(successElement);

            // Create result-specific UI
            if (service === 'gmail' && action === 'find_email') {
                const emailsElement = window.toolConnectionComponent.createEmailResults(result.result.emails);
                contentElement.appendChild(emailsElement);
            } else if (service === 'google_drive' && action === 'find_a_file') {
                const filesElement = window.toolConnectionComponent.createFileResults(result.result.files);
                contentElement.appendChild(filesElement);
            }
        } else {
            const errorElement = window.toolConnectionComponent.createErrorMessage(`Error: ${result.error}`);
            contentElement.appendChild(errorElement);
        }

        this.scrollToBottom();
    }

    /**
     * Handle an error from the streaming service.
     * @param {HTMLElement} messageElement - The message element.
     * @param {string} error - The error message.
     */
    handleError(messageElement, error) {
        const contentElement = messageElement.querySelector('.message-content');

        // Create an error message
        const errorElement = window.toolConnectionComponent.createErrorMessage(`Error: ${error}`);
        contentElement.appendChild(errorElement);

        this.scrollToBottom();
    }

    /**
     * Handle the completion of streaming.
     */
    handleStreamingDone() {
        // Reset waiting state
        this.isWaitingForResponse = false;
        this.sendButton.disabled = false;

        // Focus the input
        this.messageInput.focus();
    }

    /**
     * Format a message for display.
     * @param {string} message - The message to format.
     * @returns {string} The formatted message.
     */
    formatMessage(message) {
        // Replace newlines with <br>
        let formatted = message.replace(/\n/g, '<br>');

        // Format code blocks
        formatted = formatted.replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>');

        // Format inline code
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

        return formatted;
    }

    /**
     * Reset the chat.
     */
    async resetChat() {
        if (confirm('Are you sure you want to reset the chat? This will clear all messages.')) {
            // Clear the UI
            this.messageContainer.innerHTML = '';

            // Reset the chat on the server
            try {
                const response = await fetch('/api/reset', {
                    method: 'POST'
                });

                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }
            } catch (error) {
                console.error('Error resetting chat:', error);
            }
        }
    }

    /**
     * Scroll to the bottom of the message container.
     */
    scrollToBottom() {
        this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
    }

    /**
     * Handle file upload.
     */
    handleFileUpload() {
        // Create a file input element
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '*/*';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);

        // Add event listener for file selection
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];

            if (file) {
                // Create a FormData object
                const formData = new FormData();
                formData.append('file', file);

                // Show loading state
                this.uploadButton.disabled = true;
                this.uploadButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

                try {
                    // Upload the file
                    const response = await fetch('/api/upload', {
                        method: 'POST',
                        body: formData
                    });

                    if (!response.ok) {
                        throw new Error(`API error: ${response.status}`);
                    }

                    const result = await response.json();

                    // Add a message about the uploaded file
                    this.messageInput.value += `\n\nI've uploaded a file: ${file.name}`;
                } catch (error) {
                    console.error('Error uploading file:', error);
                    alert(`Error uploading file: ${error.message}`);
                } finally {
                    // Reset button state
                    this.uploadButton.disabled = false;
                    this.uploadButton.innerHTML = '<i class="fas fa-paperclip"></i>';

                    // Remove the file input
                    document.body.removeChild(fileInput);
                }
            }
        });

        // Trigger the file input
        fileInput.click();
    }

    /**
     * Toggle recording.
     */
    async toggleRecording() {
        if (this.isRecording) {
            // Stop recording
            this.stopRecording();
        } else {
            // Start recording
            await this.startRecording();
        }
    }

    /**
     * Start recording.
     */
    async startRecording() {
        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Create a media recorder
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            // Add event listeners
            this.mediaRecorder.addEventListener('dataavailable', (e) => {
                this.audioChunks.push(e.data);
            });

            this.mediaRecorder.addEventListener('stop', () => {
                // Create a blob from the audio chunks
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });

                // Create a FormData object
                const formData = new FormData();
                formData.append('file', audioBlob, 'recording.wav');

                // Upload the audio file
                fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`API error: ${response.status}`);
                    }
                    return response.json();
                })
                .then(result => {
                    // Add a message about the uploaded audio
                    this.messageInput.value += `\n\nI've recorded an audio message. Please transcribe and respond to it.`;
                })
                .catch(error => {
                    console.error('Error uploading audio:', error);
                    alert(`Error uploading audio: ${error.message}`);
                })
                .finally(() => {
                    // Reset button state
                    this.isRecording = false;
                    this.micButton.innerHTML = '<i class="fas fa-microphone"></i>';
                    this.micButton.classList.remove('recording');
                });
            });

            // Start recording
            this.mediaRecorder.start();
            this.isRecording = true;
            this.micButton.innerHTML = '<i class="fas fa-stop"></i>';
            this.micButton.classList.add('recording');
        } catch (error) {
            console.error('Error starting recording:', error);
            alert(`Error starting recording: ${error.message}`);
        }
    }

    /**
     * Stop recording.
     */
    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();

            // Stop all tracks
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
    }
}

// Initialize the chat service when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chatService = new ChatService(window.streamingService, window.mcpClientService);
});
