/**
 * Enhanced JavaScript for the chatbot application.
 * Includes file upload, voice input, persistent chat history, and LaTeX rendering.
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const chatMessages = document.getElementById('chat-messages');
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const clearBtn = document.getElementById('clear-btn');
    const newChatBtn = document.getElementById('new-chat-btn');
    const micBtn = document.getElementById('mic-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const chatHistoryList = document.getElementById('chat-history-list');
    const fileUploadContainer = document.getElementById('file-upload-container');
    const fileInput = document.getElementById('file-input');
    const uploadCancelBtn = document.getElementById('upload-cancel-btn');
    const uploadSubmitBtn = document.getElementById('upload-submit-btn');
    const filePreview = document.getElementById('file-preview');
    const voiceInputContainer = document.getElementById('voice-input-container');
    const voiceCancelBtn = document.getElementById('voice-cancel-btn');
    const modelSelector = document.getElementById('model-selector');

    // API endpoints
    const apiUrl = 'http://localhost:5000/api/chat';
    const resetUrl = 'http://localhost:5000/api/reset';
    const uploadUrl = 'http://localhost:5000/api/upload';
    const historyUrl = 'http://localhost:5000/api/history';
    const modelsUrl = 'http://localhost:5000/api/models';

    // State
    let currentChatId = null;
    let isRecording = false;
    let mediaRecorder = null;
    let audioChunks = [];
    let currentModel = 'gemini'; // Default model

    // Initialize
    loadModels();
    loadChatHistory();

    // Function to load available models
    async function loadModels() {
        try {
            const response = await fetch(modelsUrl);
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();

            if (data.success && data.models) {
                // Set the default model
                currentModel = data.default;

                // Clear the model selector
                modelSelector.innerHTML = '';

                // Add each model to the selector
                data.models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = model.name;
                    option.selected = model.default;
                    modelSelector.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading models:', error);
        }
    }

    // Function to load chat history
    async function loadChatHistory() {
        try {
            const response = await fetch(historyUrl);
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();

            if (data.success && data.history) {
                // Clear the chat history list
                chatHistoryList.innerHTML = '';

                // Add each chat to the list
                data.history.forEach(chat => {
                    const listItem = document.createElement('li');
                    listItem.className = 'chat-history-item';
                    listItem.dataset.chatId = chat.id;
                    listItem.textContent = chat.title;

                    listItem.addEventListener('click', () => loadChat(chat.id));

                    chatHistoryList.appendChild(listItem);
                });
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
    }

    // Function to load a specific chat
    async function loadChat(chatId) {
        try {
            const response = await fetch(`${historyUrl}/${chatId}`);
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();

            if (data.success && data.chat) {
                // Set the current chat ID
                currentChatId = chatId;

                // Clear the chat messages
                chatMessages.innerHTML = '';

                // Add each message to the chat
                data.chat.messages.forEach(message => {
                    if (message.role === 'user') {
                        addUserMessage(message.content);
                    } else if (message.role === 'assistant') {
                        addAssistantMessage(message.content, message.formatted_content);
                    }
                });

                // Highlight the active chat in the history list
                document.querySelectorAll('.chat-history-item').forEach(item => {
                    item.classList.remove('active');
                    if (item.dataset.chatId === chatId) {
                        item.classList.add('active');
                    }
                });
            }
        } catch (error) {
            console.error('Error loading chat:', error);
        }
    }

    // Function to add a user message to the chat
    function addUserMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message user-message';
        messageElement.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="message-bubble">
                <div class="message-content">
                    <p>${escapeHTML(message)}</p>
                </div>
            </div>
        `;

        chatMessages.appendChild(messageElement);
        scrollToBottom();
    }

    // Function to add an assistant message to the chat
    function addAssistantMessage(message, formattedMessage) {
        // Remove typing indicator if it exists
        removeTypingIndicator();

        const messageElement = document.createElement('div');
        messageElement.className = 'message assistant-message';

        // Use the formatted message if available, otherwise use the plain message
        const content = formattedMessage || escapeHTML(message);

        messageElement.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-bubble">
                <div class="message-content">
                    ${content}
                </div>
            </div>
        `;

        chatMessages.appendChild(messageElement);
        scrollToBottom();

        // Apply syntax highlighting to code blocks and add copy buttons
        messageElement.querySelectorAll('pre code').forEach((block) => {
            // Add a parent div for positioning
            const preElement = block.parentElement;
            const wrapper = document.createElement('div');
            wrapper.className = 'code-block-wrapper';
            wrapper.style.position = 'relative';

            // Create copy button
            const copyButton = document.createElement('button');
            copyButton.className = 'copy-code-button';
            copyButton.innerHTML = '<i class="fas fa-copy"></i>';
            copyButton.title = 'Copy code';

            // Add click event to copy code
            copyButton.addEventListener('click', () => {
                const code = block.textContent;
                navigator.clipboard.writeText(code).then(() => {
                    // Change button text temporarily
                    copyButton.innerHTML = '<i class="fas fa-check"></i>';
                    setTimeout(() => {
                        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
                    }, 2000);
                }).catch(err => {
                    console.error('Failed to copy code: ', err);
                });
            });

            // Wrap the pre element
            preElement.parentNode.insertBefore(wrapper, preElement);
            wrapper.appendChild(preElement);
            wrapper.appendChild(copyButton);

            // Apply syntax highlighting
            hljs.highlightElement(block);
        });

        // Render LaTeX - improved version
        try {
            // First, find all katex-block and katex-inline elements
            const katexBlocks = messageElement.querySelectorAll('.katex-block');
            const katexInlines = messageElement.querySelectorAll('.katex-inline');

            // Process block elements
            katexBlocks.forEach(block => {
                try {
                    const latex = block.textContent.trim();
                    katex.render(latex, block, { displayMode: true });
                } catch (err) {
                    console.error('KaTeX block rendering error:', err);
                    block.textContent = `[LaTeX Error: ${err.message}]`;
                }
            });

            // Process inline elements
            katexInlines.forEach(inline => {
                try {
                    const latex = inline.textContent.trim();
                    katex.render(latex, inline, { displayMode: false });
                } catch (err) {
                    console.error('KaTeX inline rendering error:', err);
                    inline.textContent = `[LaTeX Error: ${err.message}]`;
                }
            });

            // Also use auto-render for any remaining LaTeX
            renderMathInElement(messageElement, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false}
                ],
                throwOnError: false,
                output: 'html'
            });
        } catch (err) {
            console.error('LaTeX rendering error:', err);
        }
    }

    // Function to show a typing indicator
    function showTypingIndicator() {
        const typingElement = document.createElement('div');
        typingElement.className = 'message assistant-message';
        typingElement.id = 'typing-indicator';
        typingElement.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-bubble">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;

        chatMessages.appendChild(typingElement);
        scrollToBottom();
    }

    // Function to remove the typing indicator
    function removeTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    // Function to clear the chat
    async function clearChat() {
        // Clear the chat messages
        chatMessages.innerHTML = '';

        // Add the welcome message
        addAssistantMessage(`
            <p>Hello! I'm your AI assistant with agentic capabilities. I can generate and execute Python code for tasks like data visualization and analysis. I can also help with Gmail, Google Calendar, and other services through my MCP tools.</p>
            <p>Try asking me to:</p>
            <ul>
                <li>Create a visualization</li>
                <li>Analyze some data</li>
                <li>Send an email</li>
                <li>Schedule a meeting</li>
                <li>Find files in Google Drive</li>
            </ul>
        `);

        // Clear the input
        userInput.value = '';
        userInput.focus();

        // Reset the current chat ID
        currentChatId = null;

        // Reset the chat on the server
        try {
            await fetch(resetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ model: currentModel })
            });
        } catch (error) {
            console.error('Error resetting chat:', error);
        }

        // Remove active class from all chat history items
        document.querySelectorAll('.chat-history-item').forEach(item => {
            item.classList.remove('active');
        });
    }

    // Function to scroll the chat messages to the bottom
    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Function to escape HTML special characters
    function escapeHTML(html) {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    }

    // Function to send a message to the API
    async function sendMessage(message, file = null) {
        try {
            // Show typing indicator
            showTypingIndicator();

            // Prepare the request data
            const requestData = {
                message: message,
                model: currentModel
            };

            // Add the chat ID if available
            if (currentChatId) {
                requestData.chat_id = currentChatId;
            }

            // Add file information if available
            if (file) {
                requestData.file = file;
            }

            // Check if we should use the streaming agent service
            if (window.agentService && !file) {
                // Remove typing indicator since we'll use streaming
                removeTypingIndicator();

                // Let the agent service handle the streaming
                await window.agentService.handleSubmit(message);

                // Update the current chat ID if needed
                if (!currentChatId) {
                    currentChatId = String(Date.now());
                }

                // Reload the chat history
                loadChatHistory();

                // Return a dummy response since we handled it with streaming
                return { success: true };
            } else {
                // Use the regular API for file uploads or if agent service is not available
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestData)
                });

                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }

                const data = await response.json();

                // Update the current chat ID
                if (data.chat_id) {
                    currentChatId = data.chat_id;
                }

                // Reload the chat history
                loadChatHistory();

                return data;
            }
        } catch (error) {
            console.error('Error sending message:', error);

            // Remove typing indicator
            removeTypingIndicator();

            // Show error message
            addAssistantMessage(
                `I'm sorry, I encountered an error: ${error.message}. Please try again.`
            );

            return null;
        }
    }

    // Function to upload a file
    async function uploadFile(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(uploadUrl, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error uploading file:', error);
            return null;
        }
    }

    // Function to handle file input change
    fileInput.addEventListener('change', () => {
        // Show the file preview
        filePreview.style.display = 'flex';

        // Clear the file preview
        filePreview.innerHTML = '';

        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];

            // Create a preview of the file
            if (file.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(file);
                filePreview.appendChild(img);
            } else {
                // Create an icon based on file type
                const iconElement = document.createElement('div');
                iconElement.className = 'file-preview-icon';

                let iconClass = 'fa-file';

                // Set icon based on file type
                if (file.type.includes('pdf')) {
                    iconClass = 'fa-file-pdf';
                } else if (file.type.includes('word') || file.name.endsWith('.doc') || file.name.endsWith('.docx')) {
                    iconClass = 'fa-file-word';
                } else if (file.type.includes('excel') || file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
                    iconClass = 'fa-file-excel';
                } else if (file.type.includes('audio')) {
                    iconClass = 'fa-file-audio';
                } else if (file.type.includes('video')) {
                    iconClass = 'fa-file-video';
                } else if (file.type.includes('zip') || file.type.includes('rar') || file.type.includes('tar')) {
                    iconClass = 'fa-file-archive';
                } else if (file.type.includes('code') || file.name.endsWith('.js') || file.name.endsWith('.py') || file.name.endsWith('.html')) {
                    iconClass = 'fa-file-code';
                } else if (file.type.includes('text')) {
                    iconClass = 'fa-file-alt';
                }

                iconElement.innerHTML = `<i class="fas ${iconClass}"></i>`;
                filePreview.appendChild(iconElement);
            }

            // Create file info
            const fileInfo = document.createElement('div');
            fileInfo.className = 'file-preview-info';

            // Format file size
            let fileSize = (file.size / 1024).toFixed(2) + ' KB';
            if (file.size > 1024 * 1024) {
                fileSize = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
            }

            fileInfo.innerHTML = `
                <div class="file-preview-name">${file.name}</div>
                <div class="file-preview-size">${fileSize}</div>
            `;
            filePreview.appendChild(fileInfo);

            // Add remove button
            const removeButton = document.createElement('button');
            removeButton.className = 'file-preview-remove';
            removeButton.innerHTML = '<i class="fas fa-times"></i>';
            removeButton.addEventListener('click', (e) => {
                e.preventDefault();
                fileInput.value = '';
                filePreview.style.display = 'none';
            });
            filePreview.appendChild(removeButton);
        }
    });

    // Setup drag and drop for file upload
    const fileDropArea = document.getElementById('file-drop-area');

    if (fileDropArea) {
        // Click on drop area to trigger file input
        fileDropArea.addEventListener('click', () => {
            fileInput.click();
        });

        // Handle drag and drop events
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            fileDropArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        // Add dragover class
        ['dragenter', 'dragover'].forEach(eventName => {
            fileDropArea.addEventListener(eventName, () => {
                fileDropArea.classList.add('dragover');
            }, false);
        });

        // Remove dragover class
        ['dragleave', 'drop'].forEach(eventName => {
            fileDropArea.addEventListener(eventName, () => {
                fileDropArea.classList.remove('dragover');
            }, false);
        });

        // Handle file drop
        fileDropArea.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;

            if (files.length > 0) {
                fileInput.files = files;

                // Trigger change event
                const event = new Event('change');
                fileInput.dispatchEvent(event);
            }
        }, false);
    }

    // Handle close button for file upload
    const uploadCloseBtn = document.getElementById('upload-close-btn');
    if (uploadCloseBtn) {
        uploadCloseBtn.addEventListener('click', () => {
            fileUploadContainer.style.display = 'none';
            fileInput.value = '';
            filePreview.style.display = 'none';
        });
    }

    // Function to handle voice input
    async function startVoiceInput() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Show the voice input container
            voiceInputContainer.style.display = 'block';

            // Create a media recorder
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            // Handle data available event
            mediaRecorder.addEventListener('dataavailable', event => {
                audioChunks.push(event.data);
            });

            // Handle stop event
            mediaRecorder.addEventListener('stop', async () => {
                // Hide the voice input container
                voiceInputContainer.style.display = 'none';

                // Create a blob from the audio chunks
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

                // Create a file from the blob
                const audioFile = new File([audioBlob], 'voice-input.webm', { type: 'audio/webm' });

                // Upload the file
                const uploadResult = await uploadFile(audioFile);

                if (uploadResult && uploadResult.success) {
                    // Add a user message
                    addUserMessage('Voice input');

                    // Send a message with the file
                    const response = await sendMessage('I sent a voice recording. Please transcribe and respond to it.', uploadResult.file);

                    // Add the assistant message
                    if (response) {
                        addAssistantMessage(response.text, response.formatted_text);
                    }
                }

                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            });

            // Start recording
            mediaRecorder.start();
            isRecording = true;

            // Update the mic button
            micBtn.classList.add('voice-input-active');
        } catch (error) {
            console.error('Error starting voice input:', error);
            alert('Could not access microphone. Please check your permissions.');
        }
    }

    // Function to stop voice input
    function stopVoiceInput() {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            isRecording = false;

            // Update the mic button
            micBtn.classList.remove('voice-input-active');
        }
    }

    // Handle form submission
    chatForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const message = userInput.value.trim();

        // If the message is empty, do nothing
        if (!message) return;

        // Add the user message to the chat
        addUserMessage(message);

        // Clear the input
        userInput.value = '';

        // Send the message to the API
        const response = await sendMessage(message);

        // If we're not using the streaming agent, add the assistant message to the chat
        if (response && response.text && !window.agentService) {
            addAssistantMessage(response.text, response.formatted_text);
        }
    });

    // Handle clear chat button
    clearBtn.addEventListener('click', clearChat);

    // Handle new chat button
    newChatBtn.addEventListener('click', clearChat);

    // Handle mic button
    micBtn.addEventListener('click', () => {
        if (isRecording) {
            stopVoiceInput();
        } else {
            startVoiceInput();
        }
    });

    // Handle voice cancel button
    voiceCancelBtn.addEventListener('click', stopVoiceInput);

    // Handle upload button
    uploadBtn.addEventListener('click', () => {
        fileUploadContainer.style.display = 'block';
    });

    // Handle upload cancel button
    uploadCancelBtn.addEventListener('click', () => {
        fileUploadContainer.style.display = 'none';
        fileInput.value = '';
        filePreview.innerHTML = '';
    });

    // Handle upload submit button
    uploadSubmitBtn.addEventListener('click', async () => {
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];

            // Upload the file
            const uploadResult = await uploadFile(file);

            if (uploadResult && uploadResult.success) {
                // Hide the file upload container
                fileUploadContainer.style.display = 'none';

                // Add a user message
                addUserMessage(`I uploaded a file: ${file.name}`);

                // Send a message with the file
                const response = await sendMessage(`I uploaded a file: ${file.name}`, uploadResult.file);

                // Add the assistant message
                if (response) {
                    addAssistantMessage(response.text, response.formatted_text);
                }

                // Clear the file input
                fileInput.value = '';
                filePreview.innerHTML = '';
            }
        }
    });

    // Handle model selector change
    modelSelector.addEventListener('change', () => {
        currentModel = modelSelector.value;
        console.log(`Model changed to: ${currentModel}`);

        // Reset the chat when changing models
        clearChat();
    });

    // Focus the input field when the page loads
    userInput.focus();
});
