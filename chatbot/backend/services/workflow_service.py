import logging
import re

logger = logging.getLogger(__name__)

class WorkflowService:
    def __init__(self):
        self.workflows = {}
        self.step_outputs = {}

    def load_workflow(self, workflow_definition: dict):
        """
        Loads and stores a workflow definition.
        """
        workflow_name = workflow_definition.get("name")
        if not workflow_name:
            logger.error("Workflow definition must have a 'name'.")
            raise ValueError("Workflow definition must have a 'name'.")
        self.workflows[workflow_name] = workflow_definition
        logger.info(f"Workflow '{workflow_name}' loaded successfully.")

    def _resolve_inputs(self, inputs: dict) -> dict:
        """
        Resolves input references of the form {{steps.step_name.outputs.output_name}}.
        """
        resolved_inputs = {}
        if not inputs:
            return resolved_inputs

        for key, value in inputs.items():
            if isinstance(value, str):
                match = re.fullmatch(r"\{\{steps\.([a-zA-Z0-9_]+)\.outputs\.([a-zA-Z0-9_]+)\}\}", value)
                if match:
                    step_name_ref, output_name_ref = match.groups()
                    try:
                        resolved_value = self.step_outputs[step_name_ref][output_name_ref]
                        resolved_inputs[key] = resolved_value
                        logger.debug(f"Resolved input '{value}' to '{resolved_value}'")
                    except KeyError:
                        logger.error(f"Error resolving input '{value}': Output '{output_name_ref}' not found for step '{step_name_ref}'.")
                        resolved_inputs[key] = value # Keep original if not found, or raise error
                else:
                    resolved_inputs[key] = value
            elif isinstance(value, dict):
                resolved_inputs[key] = self._resolve_inputs(value)
            elif isinstance(value, list):
                resolved_list = []
                for item in value:
                    if isinstance(item, str):
                        match = re.fullmatch(r"\{\{steps\.([a-zA-Z0-9_]+)\.outputs\.([a-zA-Z0-9_]+)\}\}", item)
                        if match:
                            step_name_ref, output_name_ref = match.groups()
                            try:
                                resolved_value = self.step_outputs[step_name_ref][output_name_ref]
                                resolved_list.append(resolved_value)
                                logger.debug(f"Resolved input list item '{item}' to '{resolved_value}'")
                            except KeyError:
                                logger.error(f"Error resolving input list item '{item}': Output '{output_name_ref}' not found for step '{step_name_ref}'.")
                                resolved_list.append(item) # Keep original
                        else:
                            resolved_list.append(item)
                    elif isinstance(item, dict): # Resolve if dict within list
                        resolved_list.append(self._resolve_inputs(item))
                    else:
                        resolved_list.append(item)
                resolved_inputs[key] = resolved_list
            else:
                resolved_inputs[key] = value
        return resolved_inputs

    def execute_workflow(self, workflow_name: str):
        """
        Executes a pre-loaded workflow.
        """
        if workflow_name not in self.workflows:
            logger.error(f"Workflow '{workflow_name}' not found.")
            raise ValueError(f"Workflow '{workflow_name}' not found.")

        workflow = self.workflows[workflow_name]
        steps = workflow.get("steps", [])
        logger.info(f"Executing workflow: {workflow_name}")
        self.step_outputs = {} # Reset outputs for this execution

        for step in steps:
            step_name = step.get("name")
            step_type = step.get("type")
            inputs = step.get("inputs", {})

            if not step_name or not step_type:
                logger.error("Each step must have a 'name' and 'type'. Skipping invalid step.")
                continue

            logger.info(f"Executing step: {step_name} of type {step_type}")

            # Resolve inputs
            resolved_inputs = self._resolve_inputs(inputs)
            logger.debug(f"Step '{step_name}' resolved inputs: {resolved_inputs}")

            # Simulate step execution based on type
            # For now, we just print and prepare for storing outputs
            # Actual step logic (e.g. code execution, API calls) would go here
            if step_type == "data_generation":
                # Example: generate some data based on inputs
                output_value = f"Generated data based on {resolved_inputs.get('source', 'default')}"
                self.step_outputs[step_name] = {"generated_data": output_value}
                logger.info(f"Step '{step_name}' produced output: {self.step_outputs[step_name]}")
            elif step_type == "echo":
                # Example: echo back some input
                message = resolved_inputs.get("message", "No message provided")
                self.step_outputs[step_name] = {"echoed_message": message}
                logger.info(f"Step '{step_name}' echoed: {message}")
            else:
                logger.warning(f"Step type '{step_type}' not recognized. Step '{step_name}' will produce no output.")
                self.step_outputs[step_name] = {} # Ensure step_name is in outputs

        logger.info(f"Workflow '{workflow_name}' execution finished.")
        return self.step_outputs

if __name__ == '__main__':
    # Basic configuration for logging
    logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

    # Example Usage
    service = WorkflowService()

    # Define a sample workflow
    sample_workflow = {
        "name": "my_test_workflow",
        "steps": [
            {
                "name": "step1_data_source",
                "type": "data_generation",
                "inputs": {"source": "initial_data"},
                # This step is expected to produce an output, e.g., {"generated_data": "some_value"}
            },
            {
                "name": "step2_process_data",
                "type": "echo",
                "inputs": {
                    "message": "{{steps.step1_data_source.outputs.generated_data}}",
                    "another_param": "static_value",
                    "nested_ref": {
                        "key1": "{{steps.step1_data_source.outputs.generated_data}}"
                    },
                    "list_ref": [
                        "{{steps.step1_data_source.outputs.generated_data}}",
                        "another_item"
                    ]
                }
            },
            {
                "name": "step3_missing_ref",
                "type": "echo",
                "inputs": {
                    "message": "{{steps.non_existent_step.outputs.non_existent_output}}"
                }
            }
        ]
    }

    # Load the workflow
    service.load_workflow(sample_workflow)

    # Execute the workflow
    try:
        final_outputs = service.execute_workflow("my_test_workflow")
        logger.info(f"Final workflow outputs: {final_outputs}")

        # Expected output for step2_process_data:
        # {
        #   'echoed_message': 'Generated data based on initial_data',
        #   'another_param': 'static_value',
        #   'nested_ref': {'key1': 'Generated data based on initial_data'},
        #   'list_ref': ['Generated data based on initial_data', 'another_item']
        # }
        # Check if step2_process_data output is as expected
        step2_output = final_outputs.get("step2_process_data", {}).get("echoed_message")
        expected_step2_message_part = "Generated data based on initial_data"
        if step2_output and expected_step2_message_part in str(step2_output):
             logger.info("Step 2 processed data as expected.")
        else:
             logger.error(f"Step 2 output unexpected: {step2_output}")

    except ValueError as e:
        logger.error(f"Workflow execution failed: {e}")

    # Example with a workflow that has a step with no inputs
    workflow_no_inputs = {
        "name": "workflow_step_no_inputs",
        "steps": [
            {
                "name": "step_A",
                "type": "data_generation"
                # No inputs defined here, should use default or handle gracefully
            }
        ]
    }
    service.load_workflow(workflow_no_inputs)
    try:
        final_outputs_no_inputs = service.execute_workflow("workflow_step_no_inputs")
        logger.info(f"Final workflow outputs (no inputs test): {final_outputs_no_inputs}")
        step_A_output = final_outputs_no_inputs.get("step_A", {}).get("generated_data")
        if "default" in str(step_A_output) :
            logger.info("Step A (no inputs) generated data with default.")
        else:
            logger.error(f"Step A (no inputs) output unexpected: {step_A_output}")
    except ValueError as e:
        logger.error(f"Workflow execution failed (no inputs test): {e}")
