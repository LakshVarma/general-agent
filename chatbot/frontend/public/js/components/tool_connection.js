/**
 * Tool connection component for the chatbot.
 */

class ToolConnectionComponent {
    /**
     * Create a tool connection status message.
     * @param {string} text - The status message text.
     * @param {string} service - The service name (e.g., gmail, zoom).
     * @param {string} action - The action name (e.g., send_email, create_meeting).
     * @returns {HTMLElement} The status message element.
     */
    createStatusMessage(text, service = 'tool', action = '') {
        const statusElement = document.createElement('div');
        
        // Determine the service class
        let serviceClass = 'tool';
        if (service === 'gmail' || service === 'email') {
            serviceClass = 'gmail';
        } else if (service === 'zoom' || service === 'meeting') {
            serviceClass = 'zoom';
        } else if (service === 'google_drive' || service === 'drive') {
            serviceClass = 'google-drive';
        } else if (service === 'google_docs' || service === 'docs') {
            serviceClass = 'google-docs';
        } else if (service === 'notion') {
            serviceClass = 'notion';
        }
        
        // Add the tool connection classes
        statusElement.className = `status-message tool-connecting ${serviceClass}-tool`;
        
        // Create the spinner
        const spinnerElement = document.createElement('span');
        spinnerElement.className = 'tool-connection-spinner';
        statusElement.appendChild(spinnerElement);
        
        // Add the text
        statusElement.appendChild(document.createTextNode(text));
        
        return statusElement;
    }
    
    /**
     * Create a success status message.
     * @param {string} text - The status message text.
     * @returns {HTMLElement} The status message element.
     */
    createSuccessMessage(text) {
        const statusElement = document.createElement('div');
        statusElement.className = 'status-message success';
        
        // Create the success icon
        const iconElement = document.createElement('span');
        iconElement.className = 'tool-connection-success';
        iconElement.innerHTML = '<i class="fas fa-check"></i>';
        statusElement.appendChild(iconElement);
        
        // Add the text
        statusElement.appendChild(document.createTextNode(text));
        
        return statusElement;
    }
    
    /**
     * Create an error status message.
     * @param {string} text - The status message text.
     * @returns {HTMLElement} The status message element.
     */
    createErrorMessage(text) {
        const statusElement = document.createElement('div');
        statusElement.className = 'status-message error';
        
        // Create the error icon
        const iconElement = document.createElement('span');
        iconElement.className = 'tool-connection-error';
        iconElement.innerHTML = '<i class="fas fa-times"></i>';
        statusElement.appendChild(iconElement);
        
        // Add the text
        statusElement.appendChild(document.createTextNode(text));
        
        return statusElement;
    }
    
    /**
     * Create an email results container.
     * @param {Array} emails - The email results.
     * @returns {HTMLElement} The email results element.
     */
    createEmailResults(emails) {
        const resultsElement = document.createElement('div');
        resultsElement.className = 'email-results';
        
        // Add the header
        const headerElement = document.createElement('h4');
        headerElement.innerHTML = '<i class="fas fa-envelope"></i> Email Results';
        resultsElement.appendChild(headerElement);
        
        // Add the email list
        const listElement = document.createElement('ul');
        listElement.className = 'email-list';
        
        if (emails && emails.length > 0) {
            emails.forEach(email => {
                const itemElement = document.createElement('li');
                itemElement.className = 'email-item';
                
                // Add the email header
                const headerElement = document.createElement('div');
                headerElement.className = 'email-header';
                
                // Add the sender
                const senderElement = document.createElement('div');
                senderElement.className = 'email-sender';
                senderElement.textContent = email.sender || 'Unknown Sender';
                headerElement.appendChild(senderElement);
                
                // Add the date
                const dateElement = document.createElement('div');
                dateElement.className = 'email-date';
                dateElement.textContent = email.date || 'Unknown Date';
                headerElement.appendChild(dateElement);
                
                itemElement.appendChild(headerElement);
                
                // Add the subject
                const subjectElement = document.createElement('div');
                subjectElement.className = 'email-subject';
                subjectElement.textContent = email.subject || 'No Subject';
                itemElement.appendChild(subjectElement);
                
                // Add the snippet
                const snippetElement = document.createElement('div');
                snippetElement.className = 'email-snippet';
                snippetElement.textContent = email.snippet || 'No Content';
                itemElement.appendChild(snippetElement);
                
                listElement.appendChild(itemElement);
            });
        } else {
            const noResultsElement = document.createElement('li');
            noResultsElement.className = 'email-item';
            noResultsElement.textContent = 'No emails found.';
            listElement.appendChild(noResultsElement);
        }
        
        resultsElement.appendChild(listElement);
        
        return resultsElement;
    }
    
    /**
     * Create a file results container.
     * @param {Array} files - The file results.
     * @returns {HTMLElement} The file results element.
     */
    createFileResults(files) {
        const resultsElement = document.createElement('div');
        resultsElement.className = 'file-results';
        
        // Add the header
        const headerElement = document.createElement('h4');
        headerElement.innerHTML = '<i class="fas fa-file"></i> File Results';
        resultsElement.appendChild(headerElement);
        
        // Add the file list
        const listElement = document.createElement('ul');
        listElement.className = 'file-list';
        
        if (files && files.length > 0) {
            files.forEach(file => {
                const itemElement = document.createElement('li');
                itemElement.className = 'file-item';
                
                // Add the file name
                const nameElement = document.createElement('div');
                nameElement.className = 'file-name';
                nameElement.textContent = file.name || 'Unknown File';
                itemElement.appendChild(nameElement);
                
                // Add the file type
                const typeElement = document.createElement('div');
                typeElement.className = 'file-type';
                typeElement.textContent = file.mimeType || 'Unknown Type';
                itemElement.appendChild(typeElement);
                
                // Add the file link
                if (file.webViewLink) {
                    const linkElement = document.createElement('div');
                    linkElement.className = 'file-link';
                    linkElement.innerHTML = `<a href="${file.webViewLink}" target="_blank">Open in Google Drive</a>`;
                    itemElement.appendChild(linkElement);
                }
                
                listElement.appendChild(itemElement);
            });
        } else {
            const noResultsElement = document.createElement('li');
            noResultsElement.className = 'file-item';
            noResultsElement.textContent = 'No files found.';
            listElement.appendChild(noResultsElement);
        }
        
        resultsElement.appendChild(listElement);
        
        return resultsElement;
    }
}

// Export the component
window.toolConnectionComponent = new ToolConnectionComponent();
