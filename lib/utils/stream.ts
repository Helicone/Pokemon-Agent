export async function readStream(
  stream: ReadableStream<Uint8Array>,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const reader = stream.getReader();
  let fullResponse = "";
  console.log("Starting to read stream...");

  try {
    while (true) {
      if (signal?.aborted) {
        console.log("Stream reading aborted");
        reader.cancel();
        break;
      }

      const { done, value } = await reader.read();
      if (done) {
        console.log("Stream reading complete");
        break;
      }

      const chunk = new TextDecoder().decode(value);
      console.log(
        "Received chunk:",
        chunk.length > 100 ? chunk.substring(0, 100) + "..." : chunk
      );
      fullResponse += chunk;
      onChunk(chunk);
    }
    console.log("Returning full response, length:", fullResponse.length);
    return fullResponse;
  } finally {
    reader.releaseLock();
  }
}
