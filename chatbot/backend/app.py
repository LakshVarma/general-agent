"""
Main Flask application for the chatbot.
"""
import time
import os
import json
import re
from flask import Flask, request, jsonify, send_from_directory, Response, stream_with_context
from flask_cors import CORS
from werkzeug.utils import secure_filename
from gemini_service import GeminiService
from nvidia_service import NvidiaService
from code_executor import AgentService
from mcp_server import MCPServer, run_async
from utils.response_formatter import prepare_response
from chatbot.backend.routes.agent import agent_bp # Added for agent routes
import config

# Create uploads directory if it doesn't exist
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# Create chat history directory if it doesn't exist
HISTORY_FOLDER = os.path.join(os.path.dirname(__file__), 'chat_history')
if not os.path.exists(HISTORY_FOLDER):
    os.makedirs(HISTORY_FOLDER)

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload size
CORS(app, resources={r"/*": {"origins": config.CORS_ORIGINS}})

# Register blueprints
app.register_blueprint(agent_bp)

# Initialize the AI services
gemini_service = GeminiService()
nvidia_service = NvidiaService(config.NVIDIA_API_KEY, config.NVIDIA_MODEL)
agent_service = AgentService()
mcp_server = MCPServer()

# Initialize MCP server connection
try:
    print("Connecting to MCP server...")
    connection_result = run_async(mcp_server.connect())
    if connection_result:
        print(f"Successfully connected to MCP server with available services: {list(mcp_server.tool_categories.keys())}")
    else:
        print("Failed to connect to MCP server")
except Exception as e:
    print(f"Error connecting to MCP server: {e}")
    import traceback
    traceback.print_exc()

# Select the default service based on configuration
if config.DEFAULT_MODEL.lower() == "nvidia":
    default_service = nvidia_service
    print(f"Using NVIDIA model: {config.NVIDIA_MODEL} as default")
else:
    default_service = gemini_service
    print(f"Using Gemini model: {config.GEMINI_MODEL} as default")

# Create agent output directory if it doesn't exist
AGENT_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'agent_output')
if not os.path.exists(AGENT_OUTPUT_DIR):
    os.makedirs(AGENT_OUTPUT_DIR)

# Define allowed file extensions
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'docx', 'xlsx', 'pptx', 'csv', 'json', 'md', 'html', 'css', 'js', 'py', 'java', 'c', 'cpp'}

def allowed_file(filename):
    """Check if the file extension is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/chat', methods=['POST'])
def chat():
    """
    Chat endpoint for the chatbot.

    Expects a JSON payload with a 'message' field and optional 'chat_id' field.
    Returns a JSON response with the chatbot's reply.
    """
    data = request.json

    if not data or 'message' not in data:
        return jsonify({"error": "Message is required"}), 400

    user_message = data['message']
    chat_id = data.get('chat_id', str(int(time.time())))
    model = data.get('model', config.DEFAULT_MODEL).lower()

    # Get uploaded file path if available
    file_path = None
    if 'file' in data and data['file'] and 'path' in data['file']:
        file_path = data['file']['path']

    # Select the appropriate service based on the model parameter
    use_nvidia = model == "nvidia"

    if use_nvidia:
        print(f"Attempting to use NVIDIA model for this request")
        # Try NVIDIA service first if requested
        if file_path:
            # NVIDIA service can handle images
            response_text, success = nvidia_service.generate_response(user_message, file_path)
        else:
            # Standard text response
            response_text, success = nvidia_service.generate_response(user_message)

        # If NVIDIA API fails, fall back to Gemini
        if not success:
            print(f"NVIDIA API connection failed, falling back to Gemini")
            response_text = gemini_service.generate_response(user_message)
    else:
        # Use Gemini service
        print(f"Using Gemini model for this request")
        response_text = gemini_service.generate_response(user_message)

    # Prepare the response
    response = prepare_response(response_text)
    timestamp = int(time.time())
    response["timestamp"] = timestamp
    response["chat_id"] = chat_id

    # Save to chat history
    try:
        history_file = os.path.join(HISTORY_FOLDER, f"{chat_id}.json")

        # Create or update the chat history file
        if os.path.exists(history_file):
            with open(history_file, 'r') as f:
                chat_data = json.load(f)
        else:
            # Create a new chat history file
            chat_data = {
                "id": chat_id,
                "title": user_message[:30] + "..." if len(user_message) > 30 else user_message,
                "timestamp": timestamp,
                "messages": []
            }

        # Add the user message
        chat_data["messages"].append({
            "role": "user",
            "content": user_message,
            "timestamp": timestamp
        })

        # Add the assistant message
        chat_data["messages"].append({
            "role": "assistant",
            "content": response_text,
            "formatted_content": response.get("formatted_text", ""),
            "timestamp": timestamp
        })

        # Update the timestamp
        chat_data["timestamp"] = timestamp

        # Save the chat history
        with open(history_file, 'w') as f:
            json.dump(chat_data, f, indent=2)

        response["saved"] = True
    except Exception as e:
        print(f"Error saving chat history: {e}")
        response["saved"] = False

    return jsonify(response)

@app.route('/api/reset', methods=['POST'])
def reset():
    """
    Reset the chat history.
    """
    data = request.json or {}
    model = data.get('model', config.DEFAULT_MODEL).lower()

    if model == "nvidia":
        result = nvidia_service.reset_chat()
    else:
        result = gemini_service.reset_chat()

    return jsonify({"message": result})

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """
    File upload endpoint.

    Expects a file in the request.
    Returns a JSON response with the file information and AI's analysis.
    """
    # Check if a file was included in the request
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']

    # Check if a file was selected
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    # Check if the file type is allowed
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)

        # Process the file with the appropriate AI service
        file_info = {
            "filename": filename,
            "path": file_path,
            "url": f"/uploads/{filename}",
            "size": os.path.getsize(file_path),
            "mimetype": file.mimetype
        }

        # Determine the file type and generate an appropriate prompt
        file_type = file.mimetype
        file_extension = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''

        # Generate a prompt based on the file type
        if file_type.startswith('image/'):
            # For images, use NVIDIA service which can handle images better
            prompt = f"I've uploaded an image file named {filename}. Please analyze this image and describe what you see in detail."
            response_text, success = nvidia_service.generate_response(prompt, file_path)

            # Fall back to Gemini if NVIDIA fails
            if not success:
                response_text = gemini_service.generate_response(f"I've uploaded an image file named {filename}. Please note that you can't see the image, but I'd like you to help me understand what kinds of information I might extract from images like this.")

        elif file_type.startswith('text/') or file_extension in ['txt', 'csv', 'json']:
            # For text files, read the content and send it to the AI
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    file_content = f.read()

                # Limit content length to prevent token overflow
                max_length = 5000
                if len(file_content) > max_length:
                    file_content = file_content[:max_length] + "...[content truncated due to length]"

                prompt = f"I've uploaded a text file named {filename}. Here's the content:\n\n{file_content}\n\nPlease analyze this content and provide insights."
                response_text = gemini_service.generate_response(prompt)
            except Exception as e:
                response_text = f"I encountered an error while reading the file: {str(e)}. Please make sure the file is a valid text file with proper encoding."

        elif file_extension in ['pdf', 'docx']:
            # For documents, we can't process them directly but can acknowledge them
            prompt = f"I've uploaded a document file named {filename} of type {file_type}. While I can't read the content directly, can you tell me what kind of information is typically found in {file_extension.upper()} files and how I might extract and analyze that data?"
            response_text = gemini_service.generate_response(prompt)

        else:
            # For other file types
            prompt = f"I've uploaded a file named {filename} of type {file_type}. Can you tell me more about this file type and how I might work with it?"
            response_text = gemini_service.generate_response(prompt)

        # Prepare the response
        response = prepare_response(response_text)
        response["file"] = file_info
        response["success"] = True

        # Save to chat history
        try:
            chat_id = str(int(time.time()))
            history_file = os.path.join(HISTORY_FOLDER, f"{chat_id}.json")

            # Create a new chat history entry
            chat_data = {
                "id": chat_id,
                "title": f"File: {filename}",
                "timestamp": int(time.time()),
                "messages": [
                    {
                        "role": "user",
                        "content": f"[Uploaded file: {filename}]",
                        "timestamp": int(time.time()),
                        "file": file_info
                    },
                    {
                        "role": "assistant",
                        "content": response_text,
                        "formatted_content": response.get("formatted_text", ""),
                        "timestamp": int(time.time())
                    }
                ]
            }

            # Save the chat history
            with open(history_file, 'w') as f:
                json.dump(chat_data, f, indent=2)

            response["chat_id"] = chat_id
            response["saved"] = True
        except Exception as e:
            print(f"Error saving chat history: {e}")
            response["saved"] = False

        return jsonify(response)

    return jsonify({"error": "File type not allowed"}), 400

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    """
    Serve uploaded files.
    """
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/api/history', methods=['GET'])
def get_chat_history():
    """
    Get the chat history.
    """
    try:
        history_files = os.listdir(HISTORY_FOLDER)
        history_list = []

        for file in history_files:
            if file.endswith('.json'):
                with open(os.path.join(HISTORY_FOLDER, file), 'r') as f:
                    chat_data = json.load(f)
                    history_list.append({
                        "id": file.replace('.json', ''),
                        "title": chat_data.get('title', 'Untitled Chat'),
                        "timestamp": chat_data.get('timestamp', 0),
                        "preview": chat_data.get('messages', [])[0]['content'] if chat_data.get('messages', []) else ''
                    })

        # Sort by timestamp (newest first)
        history_list.sort(key=lambda x: x['timestamp'], reverse=True)

        return jsonify({"success": True, "history": history_list})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/history/<chat_id>', methods=['GET'])
def get_chat_by_id(chat_id):
    """
    Get a specific chat by ID.
    """
    try:
        file_path = os.path.join(HISTORY_FOLDER, f"{chat_id}.json")

        if not os.path.exists(file_path):
            return jsonify({"error": "Chat not found"}), 404

        with open(file_path, 'r') as f:
            chat_data = json.load(f)

        return jsonify({"success": True, "chat": chat_data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/history/<chat_id>', methods=['DELETE'])
def delete_chat(chat_id):
    """
    Delete a specific chat by ID.
    """
    try:
        file_path = os.path.join(HISTORY_FOLDER, f"{chat_id}.json")

        if not os.path.exists(file_path):
            return jsonify({"error": "Chat not found"}), 404

        os.remove(file_path)

        return jsonify({"success": True, "message": "Chat deleted successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/models', methods=['GET'])
def get_models():
    """
    Get available AI models.
    """
    models = [
        {
            "id": "gemini",
            "name": "Google Gemini",
            "model": config.GEMINI_MODEL,
            "features": ["text"],
            "default": config.DEFAULT_MODEL.lower() == "gemini"
        },
        {
            "id": "nvidia",
            "name": "NVIDIA AI (Mistral)",
            "model": config.NVIDIA_MODEL,
            "features": ["text", "images"],
            "default": config.DEFAULT_MODEL.lower() == "nvidia"
        }
    ]

    return jsonify({
        "success": True,
        "models": models,
        "default": config.DEFAULT_MODEL.lower()
    })

@app.route('/api/execute', methods=['POST'])
def execute_code():
    """
    Execute Python code.

    Expects a JSON payload with a 'code' field and optional 'file_paths' field.
    Returns a JSON response with the execution results.
    """
    data = request.json

    if not data or 'code' not in data:
        return jsonify({"error": "Code is required"}), 400

    code = data['code']
    file_paths = data.get('file_paths', [])

    # Execute the code
    result = agent_service.execute_code(code, file_paths)

    return jsonify(result)

@app.route('/api/stream', methods=['POST'])
def stream_response():
    """
    Stream a response from the AI model.

    Expects a JSON payload with a 'message' field and optional 'model' field.
    Returns a streaming response with the AI's reply.
    """
    data = request.json

    if not data or 'message' not in data:
        return jsonify({"error": "Message is required"}), 400

    user_message = data['message']
    model = data.get('model', config.DEFAULT_MODEL).lower()

    print(f"Streaming response for message: {user_message[:100]}... using model: {model}")

    # Check if this is an email-related request
    if any(keyword in user_message.lower() for keyword in ["email", "gmail", "send", "compose", "write email"]):
        print(f"Detected email-related request: {user_message}")

    # Check if this is a meeting-related request
    if any(keyword in user_message.lower() for keyword in ["zoom", "meeting", "schedule", "create meeting"]):
        print(f"Detected meeting-related request: {user_message}")

    # Note: Service selection is now handled inside the generate function

    def generate():
        # Initial response with metadata
        yield json.dumps({
            "type": "metadata",
            "message_id": str(time.time()),
            "model": model
        }) + "\n"

        # Select the appropriate service based on the model parameter
        use_nvidia = model == "nvidia"
        actual_model_used = model

        # Get the response from the appropriate service
        if use_nvidia:
            # Try NVIDIA service first if requested
            yield json.dumps({
                "type": "status",
                "text": "Connecting to NVIDIA AI..."
            }) + "\n"

            if "```python" in user_message or "generate code" in user_message.lower() or "write code" in user_message.lower():
                # For code generation requests
                response_text, success = nvidia_service.generate_response(user_message)

                if not success:
                    # Fall back to Gemini if NVIDIA fails
                    yield json.dumps({
                        "type": "status",
                        "text": "NVIDIA API connection failed, falling back to Gemini..."
                    }) + "\n"
                    response_text = gemini_service.generate_response(user_message)
                    actual_model_used = "gemini"
            else:
                # For regular requests
                response_text, success = nvidia_service.generate_response(user_message)

                if not success:
                    # Fall back to Gemini if NVIDIA fails
                    yield json.dumps({
                        "type": "status",
                        "text": "NVIDIA API connection failed, falling back to Gemini..."
                    }) + "\n"
                    response_text = gemini_service.generate_response(user_message)
                    actual_model_used = "gemini"
        else:
            # Use Gemini service directly
            response_text = gemini_service.generate_response(user_message)

        # Check if this is an MCP-related request
        print(f"Checking if message is MCP-related: {user_message}")
        if any(service in user_message.lower() for service in ["gmail", "email", "zoom", "meeting", "google drive", "docs", "sheets", "notion"]):
            print("Detected MCP-related request")
            # Send the initial response
            yield json.dumps({
                "type": "content",
                "text": response_text,
                "model_used": actual_model_used
            }) + "\n"

            # Detect the service and action from the message
            service = None
            action = None
            params = {}

            # Gmail/Email actions
            if "gmail" in user_message.lower() or "email" in user_message.lower():
                print("Detected Gmail/Email request")
                service = "gmail"

                if "search" in user_message.lower() and ("emails" in user_message.lower() or "email" in user_message.lower()):
                    print("Detected email search request")
                    action = "find_email"
                    # Extract search query from the message
                    search_terms = re.findall(r'search for emails? (?:with|containing|about|from) ["\'"]?([^"\']+)["\'"]?', user_message.lower())
                    if search_terms:
                        params["query"] = search_terms[0]
                        print(f"Extracted search query: {params['query']}")

                        # Send a message that we're searching emails
                        yield json.dumps({
                            "type": "status",
                            "text": f"Searching emails for: {params['query']}..."
                        }) + "\n"

                elif ("send" in user_message.lower() or "compose" in user_message.lower() or "write" in user_message.lower()) and "email" in user_message.lower():
                    print("Detected email composition request")
                    action = "send_email"

                    # Try to extract email parameters from the message
                    to_match = re.search(r'to\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', user_message)
                    subject_match = re.search(r'subject\s+["\']?([^"\']+)["\']?', user_message, re.IGNORECASE)
                    body_match = re.search(r'body\s+["\']?([^"\']+)["\']?', user_message, re.IGNORECASE)

                    # If we have enough information, send the email directly
                    if to_match:
                        to_email = to_match.group(1)
                        subject = subject_match.group(1) if subject_match else "Email from Chatbot"
                        body = body_match.group(1) if body_match else "This is an email sent from the chatbot."

                        # For send email requests with parameters, call the MCP tool directly
                        yield json.dumps({
                            "type": "status",
                            "text": f"I'll send an email to {to_email}."
                        }) + "\n"

                        # Send a message that we're connecting to the tool
                        yield json.dumps({
                            "type": "status",
                            "text": "Connecting to Gmail send_email tool..."
                        }) + "\n"

                        # Set up parameters for the email
                        email_params = {
                            "instructions": f"Send an email to {to_email} with subject '{subject}' and body '{body}'",
                            "to": to_email,
                            "subject": subject,
                            "body": body
                        }

                        try:
                            # Call the MCP tool
                            tool_name = "gmail_send_email"
                            print(f"Calling MCP tool: {tool_name} with params: {email_params}")
                            result = run_async(mcp_server.call_tool(tool_name, email_params))
                            print(f"MCP tool result: {result}")

                            # Send the results
                            yield json.dumps({
                                "type": "status",
                                "text": f"Email sent successfully to {to_email}!"
                            }) + "\n"

                            yield json.dumps({
                                "type": "mcp_result",
                                "service": "gmail",
                                "action": "send_email",
                                "result": result
                            }) + "\n"
                        except Exception as e:
                            print(f"Error sending email: {e}")
                            import traceback
                            traceback.print_exc()

                            # If there's an error, fall back to the form
                            yield json.dumps({
                                "type": "status",
                                "text": f"I encountered an error sending the email directly. Please use the email form that appears below."
                            }) + "\n"

                            print("Sending mcp_action for email composition")
                            yield json.dumps({
                                "type": "mcp_action",
                                "service": "gmail",
                                "action": "compose_email"
                            }) + "\n"
                    else:
                        # For send email requests without enough parameters, use the form
                        yield json.dumps({
                            "type": "status",
                            "text": "I can help you send an email. Please use the email form that appears below."
                        }) + "\n"

                        # Send a message that we're connecting to the tool
                        yield json.dumps({
                            "type": "status",
                            "text": "Connecting to Gmail send_email tool..."
                        }) + "\n"

                        print("Sending mcp_action for email composition")
                        yield json.dumps({
                            "type": "mcp_action",
                            "service": "gmail",
                            "action": "compose_email"
                        }) + "\n"

            # Zoom actions
            elif "zoom" in user_message.lower() or "meeting" in user_message.lower():
                print("Detected Zoom/Meeting request")
                service = "zoom"

                if "create" in user_message.lower() or "schedule" in user_message.lower() or "set up" in user_message.lower():
                    print("Detected meeting creation request")
                    action = "create_meeting"
                    # For create meeting requests, we'll just acknowledge it
                    # The actual creation will be handled by a separate form in the UI
                    yield json.dumps({
                        "type": "status",
                        "text": "I can help you create a Zoom meeting. Please use the meeting form that appears below."
                    }) + "\n"

                    # Send a message that we're connecting to the tool
                    yield json.dumps({
                        "type": "status",
                        "text": "Connecting to Zoom create_meeting tool..."
                    }) + "\n"

                    print("Sending mcp_action for meeting creation")
                    yield json.dumps({
                        "type": "mcp_action",
                        "service": "zoom",
                        "action": "create_meeting"
                    }) + "\n"

            # Google Drive actions
            elif "google drive" in user_message.lower() or "drive" in user_message.lower() or "file" in user_message.lower():
                print("Detected Google Drive request")
                service = "google_drive"

                if "find" in user_message.lower() or "search" in user_message.lower():
                    print("Detected file search request")
                    action = "find_a_file"
                    # Extract file name from the message
                    file_terms = re.findall(r'find (?:a |the )?file (?:called |named |titled |with name |with title )["\'"]?([^"\']+)["\'"]?', user_message.lower())
                    if file_terms:
                        params["title"] = file_terms[0]
                        print(f"Extracted file title: {params['title']}")

                        # Send a message that we're searching for the file
                        yield json.dumps({
                            "type": "status",
                            "text": f"Searching for file: {params['title']}..."
                        }) + "\n"

            # If we identified a service and action with parameters, call the MCP tool
            if service and action and params:
                tool_name = f"{service}_{action}"
                print(f"Calling MCP tool: {tool_name} with params: {params}")

                try:
                    # Send a message that we're connecting to the tool
                    yield json.dumps({
                        "type": "status",
                        "text": f"Connecting to {service} {action} tool..."
                    }) + "\n"

                    # Call the MCP tool
                    result = run_async(mcp_server.call_tool(tool_name, params))
                    print(f"MCP tool result: {result}")

                    # Send the results
                    print("Sending mcp_result to frontend")
                    yield json.dumps({
                        "type": "mcp_result",
                        "service": service,
                        "action": action,
                        "result": result
                    }) + "\n"
                except Exception as e:
                    print(f"Error calling MCP tool: {e}")
                    import traceback
                    traceback.print_exc()
                    yield json.dumps({
                        "type": "error",
                        "text": f"Error calling {tool_name}: {str(e)}"
                    }) + "\n"
            elif "email" in user_message.lower() and ("send" in user_message.lower() or "compose" in user_message.lower() or "write" in user_message.lower()):
                # Special case for email composition without specific parameters
                print("Handling email composition without specific parameters")

                # Try to extract email parameters from the message
                to_match = re.search(r'to\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', user_message)
                subject_match = re.search(r'subject\s+["\']?([^"\']+)["\']?', user_message, re.IGNORECASE)
                body_match = re.search(r'body\s+["\']?([^"\']+)["\']?', user_message, re.IGNORECASE)

                # If we have enough information, send the email directly
                if to_match:
                    to_email = to_match.group(1)
                    subject = subject_match.group(1) if subject_match else "Email from Chatbot"
                    body = body_match.group(1) if body_match else "This is an email sent from the chatbot."

                    # For send email requests with parameters, call the MCP tool directly
                    yield json.dumps({
                        "type": "status",
                        "text": f"I'll send an email to {to_email}."
                    }) + "\n"

                    # Send a message that we're connecting to the tool
                    yield json.dumps({
                        "type": "status",
                        "text": "Connecting to Gmail send_email tool..."
                    }) + "\n"

                    # Set up parameters for the email
                    email_params = {
                        "instructions": f"Send an email to {to_email} with subject '{subject}' and body '{body}'",
                        "to": to_email,
                        "subject": subject,
                        "body": body
                    }

                    try:
                        # Call the MCP tool
                        tool_name = "gmail_send_email"
                        print(f"Calling MCP tool: {tool_name} with params: {email_params}")
                        result = run_async(mcp_server.call_tool(tool_name, email_params))
                        print(f"MCP tool result: {result}")

                        # Send the results
                        yield json.dumps({
                            "type": "status",
                            "text": f"Email sent successfully to {to_email}!"
                        }) + "\n"

                        yield json.dumps({
                            "type": "mcp_result",
                            "service": "gmail",
                            "action": "send_email",
                            "result": result
                        }) + "\n"
                    except Exception as e:
                        print(f"Error sending email: {e}")
                        import traceback
                        traceback.print_exc()

                        # If there's an error, fall back to the form
                        yield json.dumps({
                            "type": "status",
                            "text": f"I encountered an error sending the email directly. Please use the email form that appears below."
                        }) + "\n"

                        print("Sending mcp_action for email composition")
                        yield json.dumps({
                            "type": "mcp_action",
                            "service": "gmail",
                            "action": "compose_email"
                        }) + "\n"
                else:
                    # For send email requests without enough parameters, use the form
                    yield json.dumps({
                        "type": "status",
                        "text": "I can help you send an email. Please use the email form that appears below."
                    }) + "\n"

                    # Send a message that we're connecting to the tool
                    yield json.dumps({
                        "type": "status",
                        "text": "Connecting to Gmail send_email tool..."
                    }) + "\n"

                    print("Sending mcp_action for email composition")
                    yield json.dumps({
                        "type": "mcp_action",
                        "service": "gmail",
                        "action": "compose_email"
                    }) + "\n"

        # Check if this is a request for code execution
        elif "```python" in user_message or "generate code" in user_message.lower() or "write code" in user_message.lower():
            # Extract code blocks
            code_blocks = re.findall(r'```python\s*(.*?)\s*```', response_text, re.DOTALL)

            # Send the initial response
            yield json.dumps({
                "type": "content",
                "text": response_text,
                "model_used": actual_model_used
            }) + "\n"

            # If code blocks were found, execute them
            if code_blocks:
                code = code_blocks[0]  # Take the first code block

                # Send a message that we're executing the code
                yield json.dumps({
                    "type": "status",
                    "text": "Executing code..."
                }) + "\n"

                # Execute the code
                execution_result = agent_service.execute_code(code)

                # Send the execution results
                yield json.dumps({
                    "type": "execution_result",
                    "result": execution_result
                }) + "\n"
        else:
            # Regular message, just send the response
            yield json.dumps({
                "type": "content",
                "text": response_text,
                "model_used": actual_model_used
            }) + "\n"

        # Final message to indicate completion
        yield json.dumps({
            "type": "done"
        }) + "\n"

    return Response(stream_with_context(generate()), mimetype='text/event-stream')

@app.route('/api/mcp/services', methods=['GET'])
def mcp_list_services():
    """
    List available MCP services and their tools.
    """
    try:
        services = run_async(mcp_server.list_services())
        return jsonify({
            "success": True,
            "services": services
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/mcp/tools', methods=['GET'])
def mcp_list_tools():
    """
    List all available MCP tools.
    """
    try:
        tools = run_async(mcp_server.list_available_tools())
        return jsonify({
            "success": True,
            "tools": tools
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/mcp/call', methods=['POST'])
def mcp_call_tool():
    """
    Call a specific MCP tool with parameters.
    """
    data = request.json
    print(f"MCP call request received: {data}")

    if not data:
        print("Error: Tool data is required")
        return jsonify({"error": "Tool data is required"}), 400

    if 'tool_name' not in data:
        print("Error: tool_name is required")
        return jsonify({"error": "tool_name is required"}), 400

    if 'params' not in data:
        print("Error: params is required")
        return jsonify({"error": "params is required"}), 400

    tool_name = data['tool_name']
    params = data['params']

    print(f"Calling MCP tool: {tool_name} with params: {params}")

    # Extract service and action from tool_name (e.g., gmail_send_email -> gmail, send_email)
    parts = tool_name.split('_', 1)
    service = parts[0] if len(parts) > 0 else "unknown"
    action = parts[1] if len(parts) > 1 else "unknown"

    # Create a response with streaming
    def generate():
        try:
            # Send a message that we're connecting to the tool
            yield json.dumps({
                "type": "status",
                "text": f"Connecting to {service} {action} tool..."
            }) + "\n"

            # Call the MCP tool
            result = run_async(mcp_server.call_tool(tool_name, params))
            print(f"MCP tool result: {result}")

            # Send the result
            yield json.dumps({
                "success": True,
                "result": result
            }) + "\n"
        except Exception as e:
            print(f"Error calling MCP tool: {e}")
            import traceback
            traceback.print_exc()
            yield json.dumps({
                "success": False,
                "error": str(e)
            }) + "\n"

    return Response(stream_with_context(generate()), mimetype='text/event-stream')

@app.route('/api/health', methods=['GET'])
def health_check():
    """
    Health check endpoint.
    """
    mcp_services = list(mcp_server.tool_categories.keys()) if hasattr(mcp_server, 'tool_categories') else []

    return jsonify({
        "status": "ok",
        "gemini_api_configured": bool(config.GEMINI_API_KEY),
        "nvidia_api_configured": bool(config.NVIDIA_API_KEY),
        "default_model": config.DEFAULT_MODEL,
        "mcp_connected": mcp_server.client.is_connected() if hasattr(mcp_server.client, 'is_connected') else False,
        "mcp_services": mcp_services
    })

if __name__ == '__main__':
    if not config.GEMINI_API_KEY:
        print("WARNING: GEMINI_API_KEY is not set. The chatbot will not work properly.")

    app.run(
        host=config.HOST,
        port=config.PORT,
        debug=config.DEBUG
    )
