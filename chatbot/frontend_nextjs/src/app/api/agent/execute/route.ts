import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5001";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Forward the request to the Node.js backend
    const response = await fetch(`${BACKEND_URL}/api/agent/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error proxying request to backend:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to communicate with the backend service",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
