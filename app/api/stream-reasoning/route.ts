import { NextRequest } from "next/server";

// Create a global event emitter for reasoning data
export const reasoningEmitter = new EventTarget();

export async function GET(request: NextRequest) {
  console.log("SSE Connection established");

  // Set headers for SSE
  const headers = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };

  // Create a new ReadableStream for SSE
  const stream = new ReadableStream({
    start(controller) {
      console.log("SSE Stream controller started");

      // Function to send reasoning data
      const sendReasoning = (event: CustomEvent) => {
        const data = event.detail;
        console.log("SSE Sending reasoning data:", data);

        const message = `event: reasoning\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(new TextEncoder().encode(message));
      };

      // Send an initial connection message
      const initialMessage = `event: reasoning\ndata: ${JSON.stringify({
        reasoning: "Connection established",
      })}\n\n`;
      controller.enqueue(new TextEncoder().encode(initialMessage));

      // Add event listener for reasoning data
      reasoningEmitter.addEventListener(
        "reasoning",
        sendReasoning as EventListener
      );

      // Clean up function
      request.signal.addEventListener("abort", () => {
        console.log("SSE Connection aborted");
        reasoningEmitter.removeEventListener(
          "reasoning",
          sendReasoning as EventListener
        );
        controller.close();
      });
    },
  });

  return new Response(stream, { headers });
}

// Helper function to emit reasoning data
export function emitReasoning(reasoning: string) {
  console.log("Emitting reasoning data:", reasoning);
  reasoningEmitter.dispatchEvent(
    new CustomEvent("reasoning", {
      detail: { reasoning },
    })
  );
}
