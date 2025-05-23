import express, { Request, Response } from 'express';
import agentRoutes from './routes/agentRoutes'; // Import agent routes

const app = express();
const port = process.env.PORT || 5001;

// Middleware to parse JSON bodies
app.use(express.json());

// Basic route
app.get('/', (req: Request, res: Response) => {
  res.send('Hello, TypeScript Express!');
});

// Use agent routes
app.use('/api/agent', agentRoutes); // Mount agent routes under /api/agent

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
