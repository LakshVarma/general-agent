/**
 * Streaming utilities for the chatbot
 * This file contains functions for handling streaming responses
 */

class StreamingService {
    constructor() {
        // API endpoints
        this.streamUrl = 'http://localhost:5000/api/stream';
        this.chatUrl = 'http://localhost:5000/api/chat';

        // DOM elements - will be set when needed
        this.chatMessages = null;

        // State
        this.isStreaming = false;
        this.currentModel = 'gemini'; // Default model
    }

    /**
     * Initialize the streaming service with DOM elements
     * @param {HTMLElement} chatMessages - The chat messages container
     */
    init(chatMessages) {
        this.chatMessages = chatMessages;
    }

    /**
     * Set the current model
     * @param {string} model - The model to use (gemini or nvidia)
     */
    setModel(model) {
        this.currentModel = model;
    }

    /**
     * Format message with code blocks
     * @param {string} text - The text to format
     * @returns {string} - The formatted text with code blocks
     */
    formatMessageWithCodeBlocks(text) {
        // Use marked.js to parse markdown if available
        if (window.marked) {
            // Configure marked to use highlight.js for code highlighting
            marked.setOptions({
                highlight: function(code, lang) {
                    if (window.hljs && lang) {
                        try {
                            return hljs.highlight(code, { language: lang }).value;
                        } catch (e) {
                            return hljs.highlightAuto(code).value;
                        }
                    }
                    return code;
                }
            });

            return marked.parse(text);
        }

        // Simple fallback if marked.js is not available
        return text.replace(/\n/g, '<br>');
    }

    /**
     * Stream a response from the API
     * @param {string} message - The user's message
     * @param {Function} onStart - Callback when streaming starts
     * @param {Function} onComplete - Callback when streaming completes
     * @param {Function} onError - Callback when an error occurs
     * @returns {Promise<void>}
     */
    async streamResponse(message, onStart, onComplete, onError) {
        if (this.isStreaming) {
            console.warn('Already streaming a response');
            return;
        }

        this.isStreaming = true;

        try {
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
            messageElement.innerHTML = `
                <div class="message-avatar">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="message-bubble">
                    <div class="message-content streaming-content"></div>
                </div>
            `;

            const messageContent = messageElement.querySelector('.message-content');

            // Call the onStart callback with the message element
            if (onStart && typeof onStart === 'function') {
                onStart(messageElement, messageContent);
            }

            // Add the message element to the chat if chatMessages is available
            if (this.chatMessages) {
                this.chatMessages.appendChild(messageElement);
            }

            // Process the stream
            let buffer = '';
            let done = false;
            let currentText = '';
            let currentData = null;

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

                        // Handle different types of stream data
                        if (data.type === 'content') {
                            // For content, we want to stream it character by character
                            currentData = data;

                            // Get the new text that was added
                            const newText = data.text;

                            // If this is the first content, initialize the streaming container
                            if (currentText === '') {
                                messageContent.innerHTML = '';
                                currentText = '';

                                // Create a paragraph for streaming text
                                const streamingParagraph = document.createElement('p');
                                streamingParagraph.className = 'streaming-text';
                                messageContent.appendChild(streamingParagraph);
                            }

                            // Stream the text character by character with a slight delay
                            await this.streamTextCharByChar(newText, messageContent.querySelector('.streaming-text'), currentText);
                            currentText = newText;
                        } else if (data.type === 'thinking') {
                            // Display thinking content in a special container
                            const thinkingElement = document.createElement('div');
                            thinkingElement.className = 'thinking-container';

                            // Create the header
                            const thinkingHeader = document.createElement('div');
                            thinkingHeader.className = 'thinking-header';
                            thinkingHeader.innerHTML = '<i class="fas fa-brain"></i> AI is thinking...';
                            thinkingElement.appendChild(thinkingHeader);

                            // Format the thinking text
                            let formattedThinking = data.text;

                            // Check if the thinking text contains steps or reasoning
                            if (formattedThinking.includes('Step') ||
                                formattedThinking.includes('Reasoning') ||
                                formattedThinking.includes('Let me think') ||
                                formattedThinking.includes('First,')) {

                                // Add some formatting to make it more readable
                                formattedThinking = formattedThinking
                                    .replace(/Step (\d+):/g, '<strong>Step $1:</strong>')
                                    .replace(/Reasoning:/g, '<strong>Reasoning:</strong>')
                                    .replace(/Let me think/g, '<strong>Let me think</strong>')
                                    .replace(/First,/g, '<strong>First,</strong>')
                                    .replace(/Next,/g, '<strong>Next,</strong>')
                                    .replace(/Finally,/g, '<strong>Finally,</strong>');
                            }

                            // Create the content
                            const thinkingContent = document.createElement('div');
                            thinkingContent.className = 'thinking-content';
                            thinkingContent.innerHTML = formattedThinking;
                            thinkingElement.appendChild(thinkingContent);

                            // Add a toggle button
                            const toggleButton = document.createElement('button');
                            toggleButton.className = 'thinking-toggle';
                            toggleButton.innerHTML = '<i class="fas fa-eye"></i> Show thinking process';
                            toggleButton.onclick = function() {
                                const content = this.parentElement.querySelector('.thinking-content');
                                if (content.style.display === 'none') {
                                    content.style.display = 'block';
                                    this.innerHTML = '<i class="fas fa-eye-slash"></i> Hide thinking process';
                                    // Scroll to make the thinking content visible
                                    content.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                } else {
                                    content.style.display = 'none';
                                    this.innerHTML = '<i class="fas fa-eye"></i> Show thinking process';
                                }
                            };

                            // Hide the thinking content by default
                            thinkingContent.style.display = 'none';
                            thinkingElement.appendChild(toggleButton);

                            // Add to the message
                            messageContent.appendChild(thinkingElement);
                        } else if (data.type === 'status') {
                            // Add a status message
                            const statusElement = document.createElement('div');

                            // Check if this is a tool connection message
                            if (data.text.includes('Connecting to')) {
                                // Extract the service name from the message
                                let serviceName = 'tool';
                                if (data.text.includes('Gmail')) {
                                    serviceName = 'gmail';
                                } else if (data.text.includes('Zoom')) {
                                    serviceName = 'zoom';
                                } else if (data.text.includes('Google Drive')) {
                                    serviceName = 'google-drive';
                                } else if (data.text.includes('Google Docs')) {
                                    serviceName = 'google-docs';
                                } else if (data.text.includes('Notion')) {
                                    serviceName = 'notion';
                                }

                                // Add the tool connection classes
                                statusElement.className = `status-message tool-connecting ${serviceName}-tool`;

                                // Create the spinner
                                const spinnerElement = document.createElement('span');
                                spinnerElement.className = 'tool-connection-spinner';
                                statusElement.appendChild(spinnerElement);

                                // Add the text
                                statusElement.appendChild(document.createTextNode(data.text));
                            } else {
                                // Regular status message
                                statusElement.className = 'status-message';
                                statusElement.textContent = data.text;
                            }

                            messageContent.appendChild(statusElement);
                        } else if (data.type === 'mcp_action') {
                            // Handle MCP actions
                            const service = data.service;
                            const action = data.action;

                            if (service === 'gmail') {
                                if (action === 'compose_email') {
                                    // Create and add an email composition form
                                    const emailForm = window.mcpUI.createEmailForm();
                                    messageContent.appendChild(emailForm);
                                }
                            } else if (service === 'zoom') {
                                if (action === 'create_meeting') {
                                    // Create and add a meeting form
                                    const meetingForm = window.mcpUI.createMeetingForm();
                                    messageContent.appendChild(meetingForm);
                                }
                            }
                        } else if (data.type === 'mcp_result') {
                            // Handle MCP results
                            const service = data.service;
                            const action = data.action;

                            if (service === 'gmail') {
                                if (action === 'find_email' || action === 'search') {
                                    // Display email search results
                                    const resultsElement = document.createElement('div');
                                    resultsElement.className = 'email-results';

                                    // Create the header
                                    const headerElement = document.createElement('h4');
                                    headerElement.innerHTML = '<i class="fas fa-search"></i> Email Search Results';
                                    resultsElement.appendChild(headerElement);

                                    // Create the results list
                                    const listElement = document.createElement('ul');
                                    listElement.className = 'email-list';

                                    // Check if we have results
                                    if (data.result && data.result.messages && data.result.messages.length > 0) {
                                        // Add each email to the list
                                        data.result.messages.forEach(email => {
                                            const emailElement = document.createElement('li');
                                            emailElement.className = 'email-item';
                                            emailElement.innerHTML = `
                                                <div class="email-header">
                                                    <span class="email-sender">${email.from || 'Unknown Sender'}</span>
                                                    <span class="email-date">${email.date || ''}</span>
                                                </div>
                                                <div class="email-subject">${email.subject || 'No Subject'}</div>
                                                <div class="email-snippet">${email.snippet || ''}</div>
                                            `;
                                            listElement.appendChild(emailElement);
                                        });
                                    } else {
                                        // No results
                                        const noResultsElement = document.createElement('p');
                                        noResultsElement.textContent = 'No emails found matching your search criteria.';
                                        listElement.appendChild(noResultsElement);
                                    }

                                    resultsElement.appendChild(listElement);
                                    messageContent.appendChild(resultsElement);
                                }
                            } else if (service === 'google_drive') {
                                if (action === 'find_a_file' || action === 'find_file') {
                                    // Display file search results
                                    const resultsElement = document.createElement('div');
                                    resultsElement.className = 'file-results';

                                    // Create the header
                                    const headerElement = document.createElement('h4');
                                    headerElement.innerHTML = '<i class="fas fa-file"></i> File Search Results';
                                    resultsElement.appendChild(headerElement);

                                    // Create the results list
                                    const listElement = document.createElement('ul');
                                    listElement.className = 'file-list';

                                    // Check if we have results
                                    if (data.result && data.result.files && data.result.files.length > 0) {
                                        // Add each file to the list
                                        data.result.files.forEach(file => {
                                            const fileElement = document.createElement('li');
                                            fileElement.className = 'file-item';
                                            fileElement.innerHTML = `
                                                <div class="file-name">${file.name || 'Unnamed File'}</div>
                                                <div class="file-type">${file.mimeType || ''}</div>
                                                ${file.webViewLink ? `<div class="file-link"><a href="${file.webViewLink}" target="_blank">Open</a></div>` : ''}
                                            `;
                                            listElement.appendChild(fileElement);
                                        });
                                    } else {
                                        // No results
                                        const noResultsElement = document.createElement('p');
                                        noResultsElement.textContent = 'No files found matching your search criteria.';
                                        listElement.appendChild(noResultsElement);
                                    }

                                    resultsElement.appendChild(listElement);
                                    messageContent.appendChild(resultsElement);
                                }
                            }
                        } else if (data.type === 'error') {
                            // Display error message
                            const errorElement = document.createElement('div');
                            errorElement.className = 'status-message error';
                            errorElement.textContent = data.text;
                            messageContent.appendChild(errorElement);
                        }
                    } catch (e) {
                        console.error('Error parsing stream data:', e, line);
                    }
                }

                // Scroll to bottom if chatMessages is available
                if (this.chatMessages) {
                    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
                }
            }

            // Process any remaining data in the buffer
            if (buffer.trim() !== '') {
                try {
                    const data = JSON.parse(buffer);

                    if (data.type === 'content') {
                        // For content, we want to stream it character by character
                        const newText = data.text;

                        // If this is the first content, initialize the streaming container
                        if (currentText === '') {
                            messageContent.innerHTML = '';
                            currentText = '';

                            // Create a paragraph for streaming text
                            const streamingParagraph = document.createElement('p');
                            streamingParagraph.className = 'streaming-text';
                            messageContent.appendChild(streamingParagraph);
                        }

                        // Stream the text character by character with a slight delay
                        await this.streamTextCharByChar(newText, messageContent.querySelector('.streaming-text'), currentText);
                    } else if (data.type === 'mcp_action' || data.type === 'mcp_result' || data.type === 'error') {
                        // Handle these types the same way as in the main loop
                        if (data.type === 'mcp_action') {
                            const service = data.service;
                            const action = data.action;

                            if (service === 'gmail') {
                                if (action === 'compose_email') {
                                    const emailForm = window.mcpUI.createEmailForm();
                                    messageContent.appendChild(emailForm);
                                }
                            } else if (service === 'zoom') {
                                if (action === 'create_meeting') {
                                    const meetingForm = window.mcpUI.createMeetingForm();
                                    messageContent.appendChild(meetingForm);
                                }
                            }
                        } else if (data.type === 'mcp_result') {
                            const service = data.service;
                            const action = data.action;

                            if (service === 'gmail') {
                                if (action === 'find_email' || action === 'search') {
                                    const resultsElement = document.createElement('div');
                                    resultsElement.className = 'email-results';

                                    const headerElement = document.createElement('h4');
                                    headerElement.innerHTML = '<i class="fas fa-search"></i> Email Search Results';
                                    resultsElement.appendChild(headerElement);

                                    const listElement = document.createElement('ul');
                                    listElement.className = 'email-list';

                                    if (data.result && data.result.messages && data.result.messages.length > 0) {
                                        data.result.messages.forEach(email => {
                                            const emailElement = document.createElement('li');
                                            emailElement.className = 'email-item';
                                            emailElement.innerHTML = `
                                                <div class="email-header">
                                                    <span class="email-sender">${email.from || 'Unknown Sender'}</span>
                                                    <span class="email-date">${email.date || ''}</span>
                                                </div>
                                                <div class="email-subject">${email.subject || 'No Subject'}</div>
                                                <div class="email-snippet">${email.snippet || ''}</div>
                                            `;
                                            listElement.appendChild(emailElement);
                                        });
                                    } else {
                                        const noResultsElement = document.createElement('p');
                                        noResultsElement.textContent = 'No emails found matching your search criteria.';
                                        listElement.appendChild(noResultsElement);
                                    }

                                    resultsElement.appendChild(listElement);
                                    messageContent.appendChild(resultsElement);
                                }
                            } else if (service === 'google_drive') {
                                if (action === 'find_a_file' || action === 'find_file') {
                                    const resultsElement = document.createElement('div');
                                    resultsElement.className = 'file-results';

                                    const headerElement = document.createElement('h4');
                                    headerElement.innerHTML = '<i class="fas fa-file"></i> File Search Results';
                                    resultsElement.appendChild(headerElement);

                                    const listElement = document.createElement('ul');
                                    listElement.className = 'file-list';

                                    if (data.result && data.result.files && data.result.files.length > 0) {
                                        data.result.files.forEach(file => {
                                            const fileElement = document.createElement('li');
                                            fileElement.className = 'file-item';
                                            fileElement.innerHTML = `
                                                <div class="file-name">${file.name || 'Unnamed File'}</div>
                                                <div class="file-type">${file.mimeType || ''}</div>
                                                ${file.webViewLink ? `<div class="file-link"><a href="${file.webViewLink}" target="_blank">Open</a></div>` : ''}
                                            `;
                                            listElement.appendChild(fileElement);
                                        });
                                    } else {
                                        const noResultsElement = document.createElement('p');
                                        noResultsElement.textContent = 'No files found matching your search criteria.';
                                        listElement.appendChild(noResultsElement);
                                    }

                                    resultsElement.appendChild(listElement);
                                    messageContent.appendChild(resultsElement);
                                }
                            }
                        } else if (data.type === 'error') {
                            const errorElement = document.createElement('div');
                            errorElement.className = 'status-message error';
                            errorElement.textContent = data.text;
                            messageContent.appendChild(errorElement);
                        }
                    }
                } catch (e) {
                    console.error('Error parsing stream data:', e, buffer);
                }
            }

            // Remove streaming class
            messageContent.classList.remove('streaming-content');

            // Format the final content with code blocks and LaTeX
            if (currentText) {
                // Format the content with code blocks
                const formattedContent = this.formatMessageWithCodeBlocks(currentText);
                messageContent.innerHTML = formattedContent;

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

                // If the model used is different from the selected model, show a note
                if (currentData && currentData.model_used && currentData.model_used !== this.currentModel) {
                    const modelNoteElement = document.createElement('div');
                    modelNoteElement.className = 'model-fallback-note';
                    modelNoteElement.innerHTML = `<i>Note: Response generated using ${currentData.model_used === 'gemini' ? 'Google Gemini' : 'NVIDIA AI'} due to connection issues.</i>`;
                    messageContent.appendChild(modelNoteElement);
                }
            }

            // Call the onComplete callback with the final text and message element
            if (onComplete && typeof onComplete === 'function') {
                onComplete(currentText, messageElement, messageContent, currentData);
            }

        } catch (error) {
            console.error('Error streaming response:', error);

            // Call the onError callback with the error
            if (onError && typeof onError === 'function') {
                onError(error);
            }
        } finally {
            this.isStreaming = false;
        }
    }

    /**
     * Stream text character by character
     * @param {string} fullText - The full text to stream
     * @param {HTMLElement} element - The element to stream the text into
     * @param {string} currentText - The current text already in the element
     * @returns {Promise<void>}
     */
    async streamTextCharByChar(fullText, element, currentText) {
        // Find the new text that was added
        let newText = '';
        if (currentText === '') {
            newText = fullText;
        } else if (fullText.startsWith(currentText)) {
            newText = fullText.substring(currentText.length);
        } else {
            // If the text doesn't start with the current text, just use the full text
            // This can happen if the backend sends a completely new response
            newText = fullText;
            element.textContent = '';
        }

        // Check if we're in the middle of a LaTeX block to avoid breaking it
        let inLatexBlock = false;
        let latexDelimiters = ['$', '\\(', '\\)', '\\[', '\\]'];

        // Stream the new text character by character
        for (let i = 0; i < newText.length; i++) {
            const char = newText[i];

            // Check if we're entering or exiting a LaTeX block
            if (char === '$' ||
                (char === '\\' && i + 1 < newText.length && ['(', ')', '[', ']'].includes(newText[i+1]))) {
                inLatexBlock = !inLatexBlock;
            }

            element.textContent += char;

            // Add a small delay between characters for a more natural typing effect
            // Skip delay for spaces, punctuation, and LaTeX delimiters to make it feel more natural
            if (!/[\s\.,;:\?!]/.test(char) && !latexDelimiters.includes(char) && i % 2 === 0 && !inLatexBlock) {
                await new Promise(resolve => setTimeout(resolve, 5));
            }

            // Scroll to bottom periodically if chatMessages is available
            if (i % 10 === 0 && this.chatMessages) {
                this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
            }
        }
    }
}

// Create a global instance of the streaming service
window.streamingService = new StreamingService();
