import { Router, Request, Response } from 'express';
import { AgentService } from '../services/AgentService';

const router = Router();
const agentService = new AgentService();

interface TaskRequestBody {
  type: string;
  params: any;
}

router.post('/execute', async (req: Request, res: Response) => {
  const task = req.body as TaskRequestBody;

  if (!task || typeof task.type !== 'string' || task.params === undefined) {
    return res.status(400).json({ success: false, error: 'Malformed task object in request body.' });
  }

  try {
    console.log(`Agent route /execute received task:`, task);
    const result = await agentService.executeTask(task);
    if (result.success) {
      return res.status(200).json(result);
    } else {
      // Consider different status codes for different types of errors from the service
      return res.status(400).json(result); 
    }
  } catch (error) {
    console.error('Error in /agent/execute route:', error);
    // Check if error is an instance of Error to safely access message property
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return res.status(500).json({ success: false, error: errorMessage });
  }
});

export default router;
