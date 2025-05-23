import unittest
import asyncio
from unittest.mock import MagicMock, patch

# Adjust the import path according to your project structure
from chatbot.backend.services.agent_service import AgentService
from chatbot.backend.code_executor import AgentService as CodeExecutor # This is the actual code executor

class TestAgentService(unittest.IsolatedAsyncioTestCase):

    def setUp(self):
        # We don't want to mock CodeExecutor at the module level for all tests,
        # so we'll patch it specifically for AgentService's instance
        self.code_executor_patch = patch('chatbot.backend.services.agent_service.CodeExecutor')
        self.MockCodeExecutor = self.code_executor_patch.start()
        
        # Create an instance of AgentService. This will use the mocked CodeExecutor
        self.agent_service = AgentService()
        
        # Get the mocked instance of CodeExecutor that AgentService is using
        self.mock_code_executor_instance = self.agent_service.code_executor 

    def tearDown(self):
        self.code_executor_patch.stop()

    async def test_execute_task_success(self):
        """Test successful code execution via execute_task."""
        mock_result = {
            'success': True,
            'stdout': 'Hello from code',
            'stderr': '',
            'files': [],
            'plots': []
        }
        self.mock_code_executor_instance.execute_code.return_value = mock_result
        
        code_to_run = "print('Hello from code')"
        result = await self.agent_service.execute_task(task=code_to_run)
        
        self.mock_code_executor_instance.execute_code.assert_called_once_with(code=code_to_run, file_paths=None)
        self.assertEqual(result, mock_result)
        self.assertTrue(result['success'])
        self.assertEqual(result['stdout'], 'Hello from code')

    async def test_execute_task_failure_in_code(self):
        """Test code execution that results in an error (e.g., Python exception)."""
        mock_result = {
            'success': False,
            'stdout': '',
            'stderr': 'Traceback: ... ZeroDivisionError: division by zero',
            'error': 'division by zero',
            'files': [],
            'plots': []
        }
        self.mock_code_executor_instance.execute_code.return_value = mock_result
        
        code_to_run = "1 / 0"
        result = await self.agent_service.execute_task(task=code_to_run)
        
        self.mock_code_executor_instance.execute_code.assert_called_once_with(code=code_to_run, file_paths=None)
        self.assertEqual(result, mock_result)
        self.assertFalse(result['success'])
        self.assertIn('ZeroDivisionError', result['stderr'])

    async def test_execute_task_dangerous_code(self):
        """Test execution of code deemed dangerous by CodeExecutor."""
        mock_result = {
            'success': False,
            'error': 'Code contains potentially dangerous operations',
            'stdout': '',
            'stderr': 'Security error: Code contains potentially dangerous operations',
            'files': [],
            'plots': []
        }
        self.mock_code_executor_instance.execute_code.return_value = mock_result
        
        dangerous_code = "import os; os.system('echo pwned')"
        result = await self.agent_service.execute_task(task=dangerous_code)
        
        self.mock_code_executor_instance.execute_code.assert_called_once_with(code=dangerous_code, file_paths=None)
        self.assertEqual(result, mock_result)
        self.assertFalse(result['success'])
        self.assertEqual(result['error'], 'Code contains potentially dangerous operations')

    async def test_generate_code_python(self):
        """Test code generation for Python (placeholder implementation)."""
        prompt = "create a hello world function"
        language = "python"
        expected_code = """
def sample_generated_function():
    print("This is sample generated Python code.")

sample_generated_function()
"""
        result = await self.agent_service.generate_code(prompt=prompt, language=language)
        self.assertEqual(result.strip(), expected_code.strip())

    async def test_generate_code_javascript(self):
        """Test code generation for JavaScript (placeholder implementation)."""
        prompt = "create a hello world function"
        language = "javascript"
        expected_code = """
function helloWorld() {
    console.log("Hello, world!");
}

helloWorld();
"""
        result = await self.agent_service.generate_code(prompt=prompt, language=language)
        self.assertEqual(result.strip(), expected_code.strip())

    async def test_generate_code_unsupported_language(self):
        """Test code generation for an unsupported language."""
        prompt = "create a hello world function"
        language = "cobol"
        expected_output = f"// Code generation for {language} is not supported yet."
        result = await self.agent_service.generate_code(prompt=prompt, language=language)
        self.assertEqual(result, expected_output)

if __name__ == '__main__':
    unittest.main()
