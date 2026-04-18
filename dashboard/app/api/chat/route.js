import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { query } = await request.json();
    
    // Proxy the request to our local FastAPI Python backend running the Graph-RAG
    const response = await fetch('http://127.0.0.1:8000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
    }
    
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error("Chat proxy error:", error);
    return NextResponse.json(
      { response: `Network Error: Could not connect to Python Graph-RAG Backend (${error.message}). Is the FastAPI server running on port 8000?` }, 
      { status: 500 }
    );
  }
}
