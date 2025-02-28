"use client";

import { generate } from "@/actions/llm";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import agentPrompt, { pokemonTools } from "@/prompts/agent-prompt";
import { XCircle } from "lucide-react";
import Image from "next/image";
import OpenAI from "openai";
import { useEffect, useRef, useState } from "react";
import { useEmulator } from "./EmulatorContext";

// CSS for the glowing animation with a more specific selector
const glowingAnimationStyles = `
@keyframes skyBlueGlow {
  0% {
    box-shadow: 0 0 5px 0px rgba(56, 189, 248, 0.4), 0 0 10px 2px rgba(56, 189, 248, 0.2);
    border-color: rgba(56, 189, 248, 0.3);
  }
  50% {
    box-shadow: 0 0 15px 5px rgba(56, 189, 248, 0.6), 0 0 20px 10px rgba(56, 189, 248, 0.3);
    border-color: rgba(56, 189, 248, 0.7);
  }
  100% {
    box-shadow: 0 0 5px 0px rgba(56, 189, 248, 0.4), 0 0 10px 2px rgba(56, 189, 248, 0.2);
    border-color: rgba(56, 189, 248, 0.3);
  }
}

@keyframes pulse-slow {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.card-container .thinking-glow {
  animation: skyBlueGlow 2s infinite ease-in-out;
  position: relative;
  transition: all 0.3s ease;
  border: 1px solid rgba(56, 189, 248, 0.3);
}

.animate-pulse-slow {
  animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.card-container .thinking-glow::before {
  content: '';
  position: absolute;
  top: -5px;
  left: -5px;
  right: -5px;
  bottom: -5px;
  border-radius: 1rem;
  background: radial-gradient(circle at center, rgba(56, 189, 248, 0.1) 0%, transparent 70%);
  z-index: -1;
  filter: blur(8px);
}

.sky-blue-text {
  color: rgb(56, 189, 248);
}

.sky-blue-border {
  border-color: rgba(56, 189, 248, 0.5) !important;
}
`;

export default function PlayerAgent() {
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionHistory, setActionHistory] = useState<string[]>([]);
  const [conversation, setConversation] = useState<
    OpenAI.ChatCompletionMessageParam[]
  >([]);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const autoPlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [turnCount, setTurnCount] = useState(0);
  const [reasoningStream, setReasoningStream] = useState<string>("");
  const reasoningScrollAreaRef = useRef<HTMLDivElement>(null);

  const { screenshotDataUrl, takeScreenshot, pressKey, isGameRunning } =
    useEmulator();

  // Monitor changes to actionHistory
  useEffect(() => {
    console.log("Action history state updated:", actionHistory);
  }, [actionHistory]);

  // Auto-play effect
  useEffect(() => {
    // Clear any existing timeout when component unmounts or auto-play is toggled
    return () => {
      if (autoPlayTimeoutRef.current) {
        clearTimeout(autoPlayTimeoutRef.current);
        autoPlayTimeoutRef.current = null;
      }
    };
  }, []);

  // Handle auto-play state changes
  useEffect(() => {
    if (isAutoPlaying && !loading && isGameRunning) {
      // Schedule the next action after 1 second
      autoPlayTimeoutRef.current = setTimeout(() => {
        handleSubmit();
      }, 500);
    } else if (!isAutoPlaying && autoPlayTimeoutRef.current) {
      // Clear the timeout if auto-play is stopped
      clearTimeout(autoPlayTimeoutRef.current);
      autoPlayTimeoutRef.current = null;
    }
  }, [isAutoPlaying, loading, isGameRunning]);

  // Auto-scroll reasoning area when new content arrives
  useEffect(() => {
    if (reasoningScrollAreaRef.current && loading) {
      const scrollArea = reasoningScrollAreaRef.current;
      scrollArea.scrollTop = scrollArea.scrollHeight;
      console.log(
        "Auto-scrolling reasoning area, current content length:",
        reasoningStream.length
      );
    }
  }, [reasoningStream, loading]);

  // Toggle auto-play
  const toggleAutoPlay = () => {
    setIsAutoPlaying((prev) => !prev);
  };

  // Process tool calls and execute the corresponding action
  const processToolCall = async (
    toolCall: OpenAI.ChatCompletionMessageToolCall
  ): Promise<void> => {
    try {
      const functionName = toolCall.function.name;
      console.log(
        `Processing tool call: ${functionName}`,
        toolCall.function.arguments
      );

      switch (functionName) {
        case "move_direction":
          const { direction, times = 1 } = JSON.parse(
            toolCall.function.arguments
          ) as {
            direction: "up" | "down" | "left" | "right";
            times?: number;
          };

          // Press the key 'times' number of times
          for (let i = 0; i < times; i++) {
            await pressKey(direction);
          }

          // Add to action history with times information
          setActionHistory((prev) => [
            ...prev,
            `move_${direction} (${times} times)`,
          ]);
          break;
        case "press_a":
          await pressKey("a");
          setActionHistory((prev) => [...prev, "press_a"]);
          break;
        case "press_b":
          await pressKey("b");
          setActionHistory((prev) => [...prev, "press_b"]);
          break;

        default:
          throw new Error(`Unknown tool call: ${functionName}`);
      }
    } catch (error) {
      console.error("Error processing tool call:", error);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);
      setReasoningStream(""); // Clear reasoning stream for new action
      console.log("Starting new action...");

      // Take a screenshot
      const imageUrl = await takeScreenshot();
      console.log("Screenshot taken:", imageUrl ? "Success" : "Failed");

      if (!imageUrl) {
        setError(
          "Failed to capture screenshot from the emulator. Please try again."
        );
        setLoading(false);
        return;
      }

      // Prepare messages for the API call
      let messages: OpenAI.ChatCompletionMessageParam[];

      // Initialize conversation if empty
      if (conversation.length === 0) {
        messages = agentPrompt(imageUrl);
        setConversation(messages);
      } else {
        // Increment turn count for each new action
        const newTurnCount = turnCount + 1;
        setTurnCount(newTurnCount);

        // Add the new screenshot to the conversation with turn number
        const userMessage: OpenAI.ChatCompletionMessageParam = {
          role: "user",
          content: [
            {
              type: "text",
              text: `Turn #${newTurnCount}: What is the best next action to take here towards your goal?`,
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
              },
            },
          ],
        };

        // Important: Update conversation state with the new user message first
        const updatedConversation = [...conversation, userMessage];
        setConversation(updatedConversation);
        messages = updatedConversation;
      }

      // Generate the response - this now returns a ReadableStream directly when streaming
      const streamResponse = (await generate({
        model: "anthropic/claude-3.7-sonnet:beta",
        messages: messages,
        tools: pokemonTools,
        reasoningEffort: "low",
        stream: true,
      })) as ReadableStream<Uint8Array>;

      console.log("Received stream response");

      // Create a reader to read the stream chunks
      const reader = streamResponse.getReader();

      // Initialize variables to store the final response
      type ExtendedAssistantMessage = OpenAI.ChatCompletionMessageParam & {
        tool_calls?: OpenAI.ChatCompletionMessageToolCall[];
      };

      let finalAssistantMessage: ExtendedAssistantMessage | null = null;
      let fullResponse = "";

      try {
        // Read chunks from the stream
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log("Stream reading complete");
            break;
          }

          // Convert the chunk to text
          const chunkText = new TextDecoder().decode(value);
          fullResponse += chunkText;

          console.log("Received chunk:", chunkText.substring(0, 100));

          try {
            // Try to parse the chunk as JSON
            const data = JSON.parse(chunkText);

            // Handle reasoning data
            if (data.reasoning) {
              console.log("Found reasoning data:", data.reasoning);
              setReasoningStream((prev) =>
                prev ? `${prev}\n${data.reasoning}` : data.reasoning
              );
            }

            // Handle final message
            if (data.finalMessage) {
              console.log("Received final message:", data.finalMessage);
              finalAssistantMessage = data.finalMessage;
            }
          } catch {
            // If it's not JSON, it might be regular text content
            // Ignore errors from trying to parse non-JSON content
          }
        }
      } finally {
        reader.releaseLock();
      }

      // If we didn't get a final message, construct a basic one
      if (!finalAssistantMessage) {
        console.log("No final message received, constructing from content");
        finalAssistantMessage = {
          role: "assistant",
          content: fullResponse,
        };
      }

      // Handle the response
      const assistantMessage = finalAssistantMessage;
      console.log("Final assistant message:", assistantMessage);

      // Add assistant message to conversation
      setConversation((prev) => [...prev, assistantMessage]);

      // Process tool calls if present
      if (
        assistantMessage.tool_calls &&
        assistantMessage.tool_calls.length > 0
      ) {
        console.log("Tool calls found:", assistantMessage.tool_calls);
        const toolCall = assistantMessage.tool_calls[0];
        await processToolCall(toolCall);

        // Add tool response to the conversation
        const toolResponse: OpenAI.ChatCompletionMessageParam = {
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({
            success: true,
            result: "Action executed successfully",
          }),
        };

        // Update conversation with the tool response
        setConversation((prev) => [...prev, toolResponse]);

        setResponse(`Action taken: ${toolCall.function.name}`);
      } else if (assistantMessage.content) {
        // If there's content but no tool calls
        if (typeof assistantMessage.content === "string") {
          setResponse(assistantMessage.content);
        } else {
          setResponse(JSON.stringify(assistantMessage.content));
        }
      } else {
        setResponse("No response content or tool calls found.");
      }

      // Give more time for any final reasoning data to arrive before ending
      await new Promise((resolve) => setTimeout(resolve, 300));

      setLoading(false);
    } catch (error) {
      console.error("Error generating response:", error);
      setError(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
      setResponse("Error generating response. Please try again.");
      setLoading(false);

      // If there's an error during auto-play, stop it to prevent error loops
      if (isAutoPlaying) {
        setIsAutoPlaying(false);
      }
    }
  };

  return (
    <div className="h-full card-container">
      {/* Inject the CSS for the glowing animation */}
      <style jsx global>
        {glowingAnimationStyles}
      </style>

      <Card
        className={`w-[32rem] h-full mx-auto bg-zinc-950 transition-all duration-300 flex flex-col justify-between ${
          loading ? "thinking-glow" : ""
        }`}
        style={
          loading
            ? {
                boxShadow:
                  "0 0 10px 2px rgba(56, 189, 248, 0.4), 0 0 20px 6px rgba(56, 189, 248, 0.2)",
                background:
                  "radial-gradient(circle at center, rgba(12, 74, 110, 0.3) 0%, rgba(0, 0, 0, 0) 70%), #09090b",
              }
            : undefined
        }
      >
        <CardHeader>
          <CardTitle>Pokémon Emerald Agent</CardTitle>
          <CardDescription>Watch the AI play Pokémon Emerald</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            {/* Game Screenshot */}
            <div className="space-y-2 flex-1">
              <div className="font-medium">Game Screenshot:</div>

              {/* Emulator Screenshot Preview */}
              <div className="mt-2">
                {screenshotDataUrl ? (
                  <div className="relative h-40 w-full rounded-md overflow-hidden">
                    <Image
                      src={screenshotDataUrl}
                      alt="Emulator screenshot"
                      className="object-contain w-full h-full"
                      width={320}
                      height={160}
                    />
                  </div>
                ) : (
                  <div className="p-4 border rounded-md bg-muted/50 flex items-center justify-center h-40">
                    <p className="text-muted-foreground">
                      {isGameRunning
                        ? "Screenshot will appear here after taking an action"
                        : "Start the emulator to capture screenshots"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Reasoning Stream */}
            <div className="space-y-2 flex-1">
              <div className="font-medium flex justify-between items-center">
                <span>AI Reasoning:</span>
                {reasoningStream && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setReasoningStream("")}
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
              <ScrollArea
                className="border rounded-md bg-muted/50 h-40"
                ref={reasoningScrollAreaRef}
              >
                <div className="whitespace-pre-wrap p-4">
                  {loading ? (
                    reasoningStream ? (
                      <div className="text-sky-400 animate-pulse-slow">
                        {reasoningStream}
                        <span className="animate-pulse">▌</span>
                      </div>
                    ) : (
                      <span className="sky-blue-text animate-pulse">
                        Thinking...
                      </span>
                    )
                  ) : reasoningStream ? (
                    <span>{reasoningStream}</span>
                  ) : (
                    <span className="text-muted-foreground italic">
                      Reasoning will appear here during thinking
                    </span>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          {error && (
            <div className="p-2 text-sm text-red-500 bg-red-50 rounded-md">
              {error}
            </div>
          )}

          {/* Action History */}
          <div className="space-y-2">
            <div className="font-medium">Action History:</div>
            <ScrollArea className="p-4 border rounded-md bg-muted/50 h-32">
              {actionHistory.length > 0 ? (
                <ul className="list-disc pl-5">
                  {actionHistory.map((action, index) => (
                    <li key={index}>{action}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">No actions taken yet</p>
              )}
            </ScrollArea>
          </div>

          <div className="space-y-2">
            <div className="font-medium">AI Response:</div>
            <div
              className={`p-4 border rounded-md bg-muted/50 min-h-24 whitespace-pre-wrap ${
                loading ? "sky-blue-border" : ""
              }`}
            >
              {loading ? (
                <span className="sky-blue-text animate-pulse">Thinking...</span>
              ) : response ? (
                response
              ) : (
                "Response will appear here"
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            onClick={toggleAutoPlay}
            disabled={loading || !isGameRunning}
            className="w-full"
            variant={isAutoPlaying ? "destructive" : "action"}
          >
            {isAutoPlaying
              ? "Stop Playing"
              : loading
              ? "Processing..."
              : "Start Auto-Play"}
          </Button>
          {!isAutoPlaying && (
            <Button
              onClick={handleSubmit}
              disabled={loading || !isGameRunning}
              className="w-full"
              variant="outline"
            >
              Take Single Action
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
