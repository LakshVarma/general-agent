"""
Agent service for the chatbot API.
"""
import logging
import os
import json
from typing import Dict, List, Any, Optional

from chatbot.backend.code_executor import AgentService as CodeExecutor

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AgentService:
    """Service for handling agent-based tasks."""

    def __init__(self):
        """Initialize the agent service."""
        self.code_executor = CodeExecutor()
        logger.info("AgentService initialized with CodeExecutor.")
        
    async def execute_task(self, task: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Execute a task using an agent, expecting the task to be Python code.

        Args:
            task: The Python code to execute.
            context: The context for the task (currently not used by code_executor).

        Returns:
            A dictionary containing the result of the code execution.
        """
        logger.info(f"Executing task (Python code) via CodeExecutor: {task[:200]}...")
        # Assuming task is Python code to be executed.
        # file_paths is set to None as per instruction.
        execution_result = self.code_executor.execute_code(code=task, file_paths=None)
        # The execute_code method in the provided CodeExecutor class is not async,
        # so we call it directly without await.
        
        # Log the success status as per refined instructions
        success_status = execution_result.get('success') if isinstance(execution_result, dict) else "Unknown (result not a dict)"
        logger.info(f"Code execution finished. Success: {success_status}")
        
        return execution_result
        
    async def generate_code(self, prompt: str, language: str = "python") -> str:
        """
        Generate code based on a prompt.

        Args:
            prompt: The prompt for code generation.
            language: The programming language to generate code in.

        Returns:
            The generated code.
        """
        logger.info(f"Generating {language} code for prompt: {prompt}")
        
        if language == "python":
            return "def sample_generated_function():\n    print(\"This is sample generated Python code.\")\n\nsample_generated_function()"
        elif language == "javascript":
            return """
function helloWorld() {
    console.log("Hello, world!");
}

helloWorld();
"""
        else:
            return f"// Code generation for {language} is not supported yet."
