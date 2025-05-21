import unittest
import logging
from chatbot.backend.services.workflow_service import WorkflowService

# Configure logging to be quiet during tests, unless a test specifically needs to check logs.
# If you need to see logs from the service during test development, you can change the level.
logging.basicConfig(level=logging.CRITICAL)

class TestWorkflowService(unittest.TestCase):

    def setUp(self):
        """
        Set up an instance of WorkflowService before each test.
        """
        self.service = WorkflowService()
        # Suppress logging output from the service during tests
        # You can comment this out if you need to debug service logs
        service_logger = logging.getLogger("chatbot.backend.services.workflow_service")
        service_logger.setLevel(logging.CRITICAL)


    def test_load_workflow_success(self):
        """
        Test loading a valid workflow definition.
        """
        workflow_def = {"name": "test_workflow", "steps": []}
        self.service.load_workflow(workflow_def)
        self.assertIn("test_workflow", self.service.workflows)
        self.assertEqual(self.service.workflows["test_workflow"], workflow_def)

    def test_load_workflow_missing_name(self):
        """
        Test that load_workflow raises a ValueError if the workflow definition has no "name".
        """
        workflow_def = {"steps": []} # Missing "name"
        with self.assertRaisesRegex(ValueError, "Workflow definition must have a 'name'."):
            self.service.load_workflow(workflow_def)

    def test_execute_simple_workflow(self):
        """
        Test a simple workflow with data passing between steps.
        """
        workflow_def = {
            "name": "simple_workflow",
            "steps": [
                {
                    "name": "step1_gen_data",
                    "type": "data_generation",
                    "inputs": {"source": "initial_source"}
                },
                {
                    "name": "step2_echo_data",
                    "type": "echo",
                    "inputs": {"message": "{{steps.step1_gen_data.outputs.generated_data}}"}
                }
            ]
        }
        self.service.load_workflow(workflow_def)
        outputs = self.service.execute_workflow("simple_workflow")

        expected_step1_output = "Generated data based on initial_source"
        self.assertIn("step1_gen_data", outputs)
        self.assertEqual(outputs["step1_gen_data"]["generated_data"], expected_step1_output)

        self.assertIn("step2_echo_data", outputs)
        self.assertEqual(outputs["step2_echo_data"]["echoed_message"], expected_step1_output)

    def test_execute_workflow_input_resolution(self):
        """
        Test various input resolution scenarios: direct, nested dict, and list.
        """
        workflow_def = {
            "name": "resolution_test_workflow",
            "steps": [
                {
                    "name": "source_step",
                    "type": "data_generation",
                    "inputs": {"source": "resolution_data"}
                },
                {
                    "name": "consumer_step",
                    "type": "echo",
                    "inputs": {
                        "direct_ref": "{{steps.source_step.outputs.generated_data}}",
                        "nested_ref": {
                            "key1": "{{steps.source_step.outputs.generated_data}}",
                            "key2": "static_value"
                        },
                        "list_ref": [
                            "{{steps.source_step.outputs.generated_data}}",
                            "another_static_value",
                            {"deep_key": "{{steps.source_step.outputs.generated_data}}"}
                        ]
                    }
                }
            ]
        }
        self.service.load_workflow(workflow_def)
        outputs = self.service.execute_workflow("resolution_test_workflow")

        expected_data = "Generated data based on resolution_data"
        self.assertIn("consumer_step", outputs)
        consumer_outputs = outputs["consumer_step"]["echoed_message"] # Echo step puts all inputs under "echoed_message"

        self.assertEqual(consumer_outputs["direct_ref"], expected_data)
        self.assertEqual(consumer_outputs["nested_ref"]["key1"], expected_data)
        self.assertEqual(consumer_outputs["nested_ref"]["key2"], "static_value")
        self.assertIsInstance(consumer_outputs["list_ref"], list)
        self.assertEqual(consumer_outputs["list_ref"][0], expected_data)
        self.assertEqual(consumer_outputs["list_ref"][1], "another_static_value")
        self.assertIsInstance(consumer_outputs["list_ref"][2], dict)
        self.assertEqual(consumer_outputs["list_ref"][2]["deep_key"], expected_data)


    def test_execute_workflow_unresolved_reference(self):
        """
        Test graceful handling of unresolved references.
        """
        workflow_def = {
            "name": "unresolved_ref_workflow",
            "steps": [
                {
                    "name": "step_with_bad_ref",
                    "type": "echo",
                    "inputs": {"message": "{{steps.non_existent_step.outputs.non_existent_output}}"}
                }
            ]
        }
        self.service.load_workflow(workflow_def)
        # Capture logs to check for error messages
        with self.assertLogs(logger='chatbot.backend.services.workflow_service', level='ERROR') as cm:
            outputs = self.service.execute_workflow("unresolved_ref_workflow")
        
        self.assertIn("step_with_bad_ref", outputs)
        # Based on current _resolve_inputs, it should keep the original string
        self.assertEqual(outputs["step_with_bad_ref"]["echoed_message"]["message"],
                         "{{steps.non_existent_step.outputs.non_existent_output}}")
        
        # Check if the specific error log was generated
        self.assertTrue(any("Error resolving input '{{steps.non_existent_step.outputs.non_existent_output}}'" in log_msg for log_msg in cm.output))


    def test_execute_workflow_step_with_no_inputs(self):
        """
        Test execution of a step that has no 'inputs' field defined.
        """
        workflow_def = {
            "name": "no_inputs_workflow",
            "steps": [
                {
                    "name": "step_A_no_inputs",
                    "type": "data_generation" # This type has default behavior for inputs
                }
            ]
        }
        self.service.load_workflow(workflow_def)
        outputs = self.service.execute_workflow("no_inputs_workflow")

        self.assertIn("step_A_no_inputs", outputs)
        # data_generation step produces "Generated data based on default" when source is not provided
        self.assertEqual(outputs["step_A_no_inputs"]["generated_data"], "Generated data based on default")

    def test_execute_non_existent_workflow(self):
        """
        Test that calling execute_workflow with an unknown workflow name raises a ValueError.
        """
        with self.assertRaisesRegex(ValueError, "Workflow 'unknown_workflow' not found."):
            self.service.execute_workflow("unknown_workflow")

    def test_workflow_step_output_overwriting(self):
        """
        Ensure step outputs are accumulated correctly and not overwritten.
        """
        workflow_def = {
            "name": "multi_step_output_workflow",
            "steps": [
                {
                    "name": "step1",
                    "type": "data_generation",
                    "inputs": {"source": "data1"}
                },
                {
                    "name": "step2",
                    "type": "data_generation",
                    "inputs": {"source": "data2"}
                },
                {
                    "name": "step3_echo",
                    "type": "echo",
                    "inputs": {
                        "msg1": "{{steps.step1.outputs.generated_data}}",
                        "msg2": "{{steps.step2.outputs.generated_data}}"
                    }
                }
            ]
        }
        self.service.load_workflow(workflow_def)
        outputs = self.service.execute_workflow("multi_step_output_workflow")

        self.assertIn("step1", outputs)
        self.assertEqual(outputs["step1"]["generated_data"], "Generated data based on data1")

        self.assertIn("step2", outputs)
        self.assertEqual(outputs["step2"]["generated_data"], "Generated data based on data2")
        
        self.assertIn("step3_echo", outputs)
        self.assertEqual(outputs["step3_echo"]["echoed_message"]["msg1"], "Generated data based on data1")
        self.assertEqual(outputs["step3_echo"]["echoed_message"]["msg2"], "Generated data based on data2")
        
        # Check that service.step_outputs (internal state before returning) also has all step outputs
        self.assertIn("step1", self.service.step_outputs)
        self.assertIn("step2", self.service.step_outputs)
        self.assertIn("step3_echo", self.service.step_outputs)


if __name__ == '__main__':
    unittest.main()
