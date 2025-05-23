import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Bot, Code, Globe, Zap } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Chatbot Frontend
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Next.js frontend with agent capabilities for code execution, web
            fetching, and Zapier MCP integration
          </p>
          <Link href="/agent-preview">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
              Try Agent Preview
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5 text-blue-600" />
                Code Execution
              </CardTitle>
              <CardDescription>
                Execute Python code with real-time output and error handling
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Run Python scripts, generate plots, and handle file operations
                with comprehensive error reporting.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-green-600" />
                Web Fetching
              </CardTitle>
              <CardDescription>
                Fetch data from external APIs and web services
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Make HTTP requests with custom headers, handle responses, and
                process web data efficiently.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-orange-600" />
                Zapier MCP
              </CardTitle>
              <CardDescription>
                Integrate with Zapier using Model Context Protocol
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Trigger Zapier workflows, send emails, create tasks, and
                automate processes seamlessly.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-purple-600" />
              Agent Preview
            </CardTitle>
            <CardDescription>
              Interactive interface to test all agent capabilities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              The Agent Preview provides a comprehensive testing interface where
              you can:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 mb-4">
              <li>Select different task types from a dropdown menu</li>
              <li>Input parameters dynamically based on the selected task</li>
              <li>Execute tasks and view detailed results</li>
              <li>
                Handle errors gracefully with comprehensive error reporting
              </li>
            </ul>
            <Link href="/agent-preview">
              <Button>
                Open Agent Preview
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
