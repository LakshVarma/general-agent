/**
 * UI-related functionality for the chatbot.
 */

class ChatbotUI {
    constructor() {
        // DOM elements
        this.chatMessages = document.getElementById('chat-messages');
        this.chatForm = document.getElementById('chat-form');
        this.userInput = document.getElementById('user-input');
        this.newChatBtn = document.getElementById('new-chat-btn');
        this.clearBtn = document.getElementById('clear-btn');
        this.micBtn = document.getElementById('mic-btn');
        this.uploadBtn = document.getElementById('upload-btn');
        this.chatHistoryList = document.getElementById('chat-history-list');

        // State
        this.isTyping = false;
        this.chatHistory = [];
        this.isRecording = false;
        this.recognition = null;
        this.fileUploadInput = null;

        // Initialize
        this.setupEventListeners();
        this.initSpeechRecognition();
        this.initFileUpload();
    }

    /**
     * Initialize speech recognition if available in the browser
     */
    initSpeechRecognition() {
        // Check if the browser supports speech recognition
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            // Create a speech recognition instance
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();

            // Configure speech recognition
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';

            // Set up event handlers
            this.recognition.onstart = () => {
                this.isRecording = true;
                this.micBtn.classList.add('recording');
                this.micBtn.innerHTML = '<i class="fas fa-stop"></i>';

                // Show recording indicator in the input field
                this.userInput.placeholder = 'Listening...';
                this.userInput.classList.add('recording');
            };

            this.recognition.onresult = (event) => {
                const transcript = Array.from(event.results)
                    .map(result => result[0])
                    .map(result => result.transcript)
                    .join('');

                // Update the input field with the transcript
                this.userInput.value = transcript;
            };

            this.recognition.onend = () => {
                this.isRecording = false;
                this.micBtn.classList.remove('recording');
                this.micBtn.innerHTML = '<i class="fas fa-microphone"></i>';

                // Reset the input field
                this.userInput.placeholder = 'Ask anything...';
                this.userInput.classList.remove('recording');

                // Focus the input field
                this.userInput.focus();
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.isRecording = false;
                this.micBtn.classList.remove('recording');
                this.micBtn.innerHTML = '<i class="fas fa-microphone"></i>';

                // Reset the input field
                this.userInput.placeholder = 'Ask anything...';
                this.userInput.classList.remove('recording');
            };
        } else {
            console.warn('Speech recognition not supported in this browser');
            this.micBtn.title = 'Voice input not supported in this browser';
            this.micBtn.disabled = true;
            this.micBtn.classList.add('disabled');
        }
    }

    /**
     * Initialize file upload functionality
     */
    initFileUpload() {
        // Create a hidden file input element
        this.fileUploadInput = document.createElement('input');
        this.fileUploadInput.type = 'file';
        this.fileUploadInput.style.display = 'none';
        this.fileUploadInput.multiple = false;
        this.fileUploadInput.accept = '.txt,.pdf,.doc,.docx,.csv,.json,.jpg,.jpeg,.png';
        document.body.appendChild(this.fileUploadInput);

        // Set up event handler for file selection
        this.fileUploadInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                this.handleFileUpload(file);
            }
        });
    }

    /**
     * Set up event listeners for UI elements.
     */
    setupEventListeners() {
        // New chat button
        this.newChatBtn.addEventListener('click', () => {
            this.clearChat();
        });

        // Clear chat button
        this.clearBtn.addEventListener('click', () => {
            this.clearChat();
        });

        // Mic button - toggle speech recognition
        this.micBtn.addEventListener('click', () => {
            if (this.recognition) {
                if (this.isRecording) {
                    // Stop recording
                    this.recognition.stop();
                } else {
                    // Start recording
                    this.recognition.start();
                }
            } else {
                alert('Speech recognition is not supported in your browser.');
            }
        });

        // Upload button - trigger file selection
        this.uploadBtn.addEventListener('click', () => {
            if (this.fileUploadInput) {
                this.fileUploadInput.click();
            }
        });
    }

    /**
     * Handle file upload
     * @param {File} file - The file to upload
     */
    handleFileUpload(file) {
        // Create a FormData object to send the file
        const formData = new FormData();
        formData.append('file', file);

        // Show a message that we're uploading the file
        const fileName = file.name;
        const fileSize = this.formatFileSize(file.size);
        const fileType = file.type || 'Unknown type';

        // Add a user message showing the file upload
        const messageElement = document.createElement('div');
        messageElement.className = 'message user-message';
        messageElement.innerHTML = `
            <div class="message-content">
                <div class="file-upload">
                    <div class="file-icon">
                        <i class="fas ${this.getFileIcon(file.type)}"></i>
                    </div>
                    <div class="file-info">
                        <p class="file-name">${this.escapeHTML(fileName)}</p>
                        <p class="file-details">${this.escapeHTML(fileType)} · ${fileSize}</p>
                    </div>
                </div>
            </div>
        `;

        this.chatMessages.appendChild(messageElement);
        this.scrollToBottom();

        // Show typing indicator
        this.showTypingIndicator();

        // Send the file to the server
        fetch('/api/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Remove typing indicator
            this.removeTypingIndicator();

            // Add the assistant's response
            if (data.text) {
                this.addAssistantMessage(data.text, data.formatted_text);
            } else {
                this.addAssistantMessage('I received your file but couldn\'t process it. Please try a different file format.');
            }
        })
        .catch(error => {
            console.error('Error uploading file:', error);

            // Remove typing indicator
            this.removeTypingIndicator();

            // Show error message
            this.addAssistantMessage(`I'm sorry, I encountered an error while processing your file: ${error.message}`);
        });
    }

    /**
     * Format file size in a human-readable format
     * @param {number} bytes - The file size in bytes
     * @returns {string} - The formatted file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Get the appropriate Font Awesome icon for a file type
     * @param {string} mimeType - The MIME type of the file
     * @returns {string} - The Font Awesome icon class
     */
    getFileIcon(mimeType) {
        if (!mimeType) return 'fa-file';

        if (mimeType.startsWith('image/')) {
            return 'fa-file-image';
        } else if (mimeType.startsWith('text/')) {
            return 'fa-file-alt';
        } else if (mimeType.startsWith('application/pdf')) {
            return 'fa-file-pdf';
        } else if (mimeType.includes('spreadsheet') || mimeType.includes('csv')) {
            return 'fa-file-excel';
        } else if (mimeType.includes('word') || mimeType.includes('document')) {
            return 'fa-file-word';
        } else if (mimeType.includes('json')) {
            return 'fa-file-code';
        } else {
            return 'fa-file';
        }
    }

    /**
     * Add a user message to the chat.
     * @param {string} message - The user's message.
     */
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

    /**
     * Add an assistant message to the chat.
     * @param {string} message - The assistant's message.
     * @param {string} formattedMessage - The formatted message (with HTML).
     */
    addAssistantMessage(message, formattedMessage) {
        // Remove typing indicator if it exists
        this.removeTypingIndicator();

        const messageElement = document.createElement('div');
        messageElement.className = 'message assistant-message';

        // Use the formatted message if available, otherwise use the plain message
        const content = formattedMessage || this.escapeHTML(message);

        messageElement.innerHTML = `
            <div class="message-content">
                ${content}
            </div>
        `;

        this.chatMessages.appendChild(messageElement);
        this.scrollToBottom();

        // Apply syntax highlighting to code blocks
        messageElement.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });

        // Apply LaTeX rendering if available
        if (window.renderMathInElement) {
            try {
                const messageContent = messageElement.querySelector('.message-content');
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
    }

    /**
     * Show a typing indicator to indicate the assistant is generating a response.
     */
    showTypingIndicator() {
        if (this.isTyping) return;

        this.isTyping = true;

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

    /**
     * Remove the typing indicator.
     */
    removeTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
        this.isTyping = false;
    }

    /**
     * Clear the chat messages.
     */
    clearChat() {
        // Clear the chat messages
        this.chatMessages.innerHTML = '';

        // Add the welcome message
        this.addAssistantMessage(
            'Hello! I\'m your AI assistant powered by Gemini. How can I help you today?'
        );

        // Clear the input
        this.userInput.value = '';
        this.userInput.focus();
    }

    /**
     * Scroll the chat messages to the bottom.
     */
    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    /**
     * Escape HTML special characters to prevent XSS.
     * @param {string} html - The HTML string to escape.
     * @returns {string} The escaped HTML string.
     */
    escapeHTML(html) {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    }
}
