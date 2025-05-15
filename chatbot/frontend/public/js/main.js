/**
 * Main JavaScript file for the chatbot application.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize the UI
    const ui = new ChatbotUI();

    // Initialize the chat service
    const chatService = new ChatService(ui);

    // Get the chat form
    const chatForm = document.getElementById('chat-form');

    // Handle form submission
    chatForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        // Get the user input
        const userInput = document.getElementById('user-input');
        const message = userInput.value.trim();

        // If the message is empty, do nothing
        if (!message) return;

        // Add the user message to the chat
        ui.addUserMessage(message);

        // Clear the input
        userInput.value = '';

        // Send the message to the API
        const response = await chatService.sendMessage(message);

        // If there's a response and it's not from streaming, add it to the chat
        if (response && response.text && !response.success) {
            ui.addAssistantMessage(response.text, response.formatted_text);
        }
    });

    // Handle the clear chat button
    document.getElementById('clear-btn').addEventListener('click', async () => {
        // Reset the chat on the server
        await chatService.resetChat();

        // Clear the chat in the UI
        ui.clearChat();
    });

    // Handle the new chat button
    document.getElementById('new-chat-btn').addEventListener('click', async () => {
        // Reset the chat on the server
        await chatService.resetChat();

        // Clear the chat in the UI
        ui.clearChat();
    });

    // Focus the input field when the page loads
    document.getElementById('user-input').focus();
});
