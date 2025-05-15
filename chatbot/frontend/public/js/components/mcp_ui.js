/**
 * MCP UI components for the chatbot.
 */

class MCPUI {
    constructor(mcpClientService) {
        this.mcpClientService = mcpClientService;
    }

    /**
     * Create an email composition form.
     * @returns {HTMLElement} The email form element.
     */
    createEmailForm() {
        const formElement = document.createElement('div');
        formElement.className = 'email-form';
        formElement.innerHTML = `
            <h4><i class="fas fa-envelope"></i> Compose Email</h4>
            <div class="form-group">
                <label for="email-to">To:</label>
                <input type="email" id="email-to" placeholder="recipient@example.com" required>
            </div>
            <div class="form-group">
                <label for="email-cc">CC:</label>
                <input type="email" id="email-cc" placeholder="cc@example.com">
            </div>
            <div class="form-group">
                <label for="email-subject">Subject:</label>
                <input type="text" id="email-subject" placeholder="Email subject" required>
            </div>
            <div class="form-group">
                <label for="email-body">Message:</label>
                <textarea id="email-body" placeholder="Type your message here..." required></textarea>
            </div>
            <div class="btn-group">
                <button id="email-send-btn" class="btn btn-primary">Send Email</button>
            </div>
        `;

        // Add event listeners
        setTimeout(() => {
            const sendBtn = formElement.querySelector('#email-send-btn');
            sendBtn.addEventListener('click', () => this.handleSendEmail(formElement));
        }, 0);

        return formElement;
    }

    /**
     * Create a Zoom meeting form.
     * @returns {HTMLElement} The meeting form element.
     */
    createMeetingForm() {
        const formElement = document.createElement('div');
        formElement.className = 'meeting-form';
        formElement.innerHTML = `
            <h4><i class="fas fa-video"></i> Create Zoom Meeting</h4>
            <div class="form-group">
                <label for="meeting-topic">Topic:</label>
                <input type="text" id="meeting-topic" placeholder="Meeting topic" required>
            </div>
            <div class="form-group">
                <label for="meeting-start-time">Start Time:</label>
                <input type="datetime-local" id="meeting-start-time" required>
            </div>
            <div class="form-group">
                <label for="meeting-duration">Duration (minutes):</label>
                <input type="number" id="meeting-duration" value="60" min="15" max="240" required>
            </div>
            <div class="form-group">
                <label for="meeting-agenda">Agenda:</label>
                <textarea id="meeting-agenda" placeholder="Meeting agenda..."></textarea>
            </div>
            <div class="btn-group">
                <button id="meeting-create-btn" class="btn btn-primary">Create Meeting</button>
            </div>
        `;

        // Add event listeners
        setTimeout(() => {
            const createBtn = formElement.querySelector('#meeting-create-btn');
            createBtn.addEventListener('click', () => this.handleCreateMeeting(formElement));
        }, 0);

        return formElement;
    }

    /**
     * Handle sending an email.
     * @param {HTMLElement} formElement - The form element.
     */
    async handleSendEmail(formElement) {
        const to = formElement.querySelector('#email-to').value;
        const cc = formElement.querySelector('#email-cc').value;
        const subject = formElement.querySelector('#email-subject').value;
        const body = formElement.querySelector('#email-body').value;

        if (!to || !subject || !body) {
            alert('Please fill in all required fields (To, Subject, and Message).');
            return;
        }

        // Show loading state
        const sendBtn = formElement.querySelector('#email-send-btn');
        const originalText = sendBtn.textContent;
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

        // Send the email
        const result = await this.mcpClientService.gmailSendEmail({
            to,
            cc: cc || undefined,
            subject,
            body
        });

        // Reset button state
        sendBtn.disabled = false;
        sendBtn.textContent = originalText;

        // Show result
        if (result.success) {
            alert('Email sent successfully!');
            // Clear the form
            formElement.querySelector('#email-to').value = '';
            formElement.querySelector('#email-cc').value = '';
            formElement.querySelector('#email-subject').value = '';
            formElement.querySelector('#email-body').value = '';
        } else {
            alert(`Error sending email: ${result.error}`);
        }
    }

    /**
     * Handle creating a Zoom meeting.
     * @param {HTMLElement} formElement - The form element.
     */
    async handleCreateMeeting(formElement) {
        const topic = formElement.querySelector('#meeting-topic').value;
        const startTime = formElement.querySelector('#meeting-start-time').value;
        const duration = formElement.querySelector('#meeting-duration').value;
        const agenda = formElement.querySelector('#meeting-agenda').value;

        if (!topic || !startTime || !duration) {
            alert('Please fill in all required fields (Topic, Start Time, and Duration).');
            return;
        }

        // Show loading state
        const createBtn = formElement.querySelector('#meeting-create-btn');
        const originalText = createBtn.textContent;
        createBtn.disabled = true;
        createBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

        // Format the start time to ISO format
        const startTimeISO = new Date(startTime).toISOString();

        // Create the meeting
        const result = await this.mcpClientService.zoomCreateMeeting({
            topic,
            start_time: startTimeISO,
            duration: parseInt(duration),
            agenda: agenda || undefined
        });

        // Reset button state
        createBtn.disabled = false;
        createBtn.textContent = originalText;

        // Show result
        if (result.success) {
            alert('Meeting created successfully!');

            // Display meeting details
            const detailsElement = document.createElement('div');
            detailsElement.className = 'meeting-details';
            detailsElement.innerHTML = `
                <h5>Meeting Details</h5>
                <p><strong>Join URL:</strong> <a href="${result.result.join_url}" target="_blank">${result.result.join_url}</a></p>
                <p><strong>Meeting ID:</strong> ${result.result.id}</p>
                <p><strong>Password:</strong> ${result.result.password || 'None'}</p>
            `;

            formElement.appendChild(detailsElement);

            // Clear the form
            formElement.querySelector('#meeting-topic').value = '';
            formElement.querySelector('#meeting-start-time').value = '';
            formElement.querySelector('#meeting-duration').value = '60';
            formElement.querySelector('#meeting-agenda').value = '';
        } else {
            alert(`Error creating meeting: ${result.error}`);
        }
    }
}

// Export the UI components
window.mcpUI = new MCPUI(window.mcpClientService);
