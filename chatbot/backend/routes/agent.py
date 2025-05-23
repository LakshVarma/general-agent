from flask import Blueprint, request, jsonify
from chatbot.backend.services.agent_service import AgentService # Assuming AgentService is in this path

agent_bp = Blueprint('agent_bp', __name__, url_prefix='/agent')
agent_service = AgentService()

@agent_bp.route('/execute', methods=['POST'])
async def execute_code():
    data = request.get_json() # Changed from await request.get_json()
    if not data or 'code' not in data:
        return jsonify({'error': 'Missing "code" in request body'}), 400
    
    code_to_execute = data['code']
    
    try:
        # Assuming execute_task is an async method in AgentService
        result = await agent_service.execute_task(task=code_to_execute)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 500

@agent_bp.route('/generate', methods=['POST'])
async def generate_new_code(): # Renamed to avoid conflict if any
    data = request.get_json() # Changed from await request.get_json()
    if not data or 'prompt' not in data:
        return jsonify({'error': 'Missing "prompt" in request body'}), 400
    
    prompt = data['prompt']
    language = data.get('language', 'python') # Default to python if not specified
    
    try:
        # Assuming generate_code is an async method in AgentService
        generated_code = await agent_service.generate_code(prompt=prompt, language=language)
        return jsonify({'language': language, 'code': generated_code})
    except Exception as e:
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 500
        
# It's important to include traceback for debugging internal server errors.
import traceback
