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
  const actionHistoryScrollAreaRef = useRef<HTMLDivElement>(null);

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
    // Function to scroll to bottom
    const scrollToBottom = () => {
      const scrollableDiv = reasoningScrollAreaRef.current?.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollableDiv) {
        scrollableDiv.scrollTop = scrollableDiv.scrollHeight;
        console.log("Auto-scrolling reasoning area to bottom");
      }
    };

    if (reasoningScrollAreaRef.current && (loading || reasoningStream)) {
      // Immediate scroll attempt
      setTimeout(scrollToBottom, 50);

      // Set up mutation observer to detect content changes
      const contentDiv = reasoningScrollAreaRef.current.querySelector(
        ".whitespace-pre-wrap"
      );
      if (contentDiv) {
        const observer = new MutationObserver(() => {
          setTimeout(scrollToBottom, 10);
        });

        observer.observe(contentDiv, {
          childList: true,
          subtree: true,
          characterData: true,
        });

        // Clean up observer
        return () => observer.disconnect();
      }
    }
  }, [reasoningStream, loading]);

  // Auto-scroll action history when new actions are added
  useEffect(() => {
    // Function to scroll to bottom
    const scrollToBottom = () => {
      const scrollableDiv = actionHistoryScrollAreaRef.current?.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollableDiv) {
        scrollableDiv.scrollTop = scrollableDiv.scrollHeight;
        console.log("Auto-scrolling action history to bottom");
      }
    };

    if (actionHistoryScrollAreaRef.current && actionHistory.length > 0) {
      // Immediate scroll attempt
      setTimeout(scrollToBottom, 50);

      // Set up mutation observer to detect content changes
      const contentDiv =
        actionHistoryScrollAreaRef.current.querySelector(".p-4");
      if (contentDiv) {
        const observer = new MutationObserver(() => {
          setTimeout(scrollToBottom, 10);
        });

        observer.observe(contentDiv, {
          childList: true,
          subtree: true,
          characterData: true,
        });

        // Clean up observer
        return () => observer.disconnect();
      }
    }
  }, [actionHistory]);

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

      // Try to parse the arguments - handle different formats
      type ToolArgs = {
        direction?: "up" | "down" | "left" | "right";
        times?: number;
      };

      let args: ToolArgs = {};
      try {
        if (toolCall.function.arguments) {
          // Clean up the arguments if needed
          let argsStr = toolCall.function.arguments;

          // Remove surrounding quotes if present (sometimes happens with streaming)
          argsStr = argsStr.replace(/^["']|["']$/g, "");

          // Handle case where arguments might not be a complete JSON object
          if (!argsStr.startsWith("{") && !argsStr.startsWith("[")) {
            // Try to make it a valid JSON by wrapping in braces
            try {
              args = JSON.parse(`{${argsStr}}`);
            } catch {
              // If that fails, try with different formatting
              argsStr = argsStr.replace(
                /(['"])?([a-zA-Z0-9_]+)(['"])?:/g,
                '"$2":'
              );
              argsStr = argsStr.replace(/'/g, '"');
              try {
                args = JSON.parse(`{${argsStr}}`);
              } catch (e) {
                console.error("Failed to parse arguments in multiple ways:", e);
                args = {}; // Default empty object
              }
            }
          } else {
            // It's already a JSON object format
            args = JSON.parse(argsStr);
          }
        }
      } catch (error) {
        console.error("Error parsing tool call arguments:", error);
        console.log("Using empty args object instead");
      }

      switch (functionName) {
        case "move_direction":
          const direction = args.direction || "up"; // Default direction
          const times = args.times || 1; // Default times

          console.log(`Moving ${direction} ${times} times`);

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
        model: "anthropic/claude-3.7-sonnet:thinking",
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

            // Handle partial tool calls - show them in the reasoning area
            if (data.partial_tool_calls && data.partial_tool_calls.length > 0) {
              const toolCall = data.partial_tool_calls[0];
              if (toolCall.function) {
                const name = toolCall.function.name || "";
                const partialArgs = toolCall.function.arguments || "";

                // Only update if we have something meaningful
                if (name || partialArgs) {
                  setReasoningStream((prev) => {
                    // Check if we already have tool call info in the stream
                    const hasToolCallInfo = prev.includes("Tool call:");

                    let newStream = prev;
                    if (!hasToolCallInfo) {
                      // Add a new tool call section
                      newStream += newStream ? "\n\nTool call:" : "Tool call:";
                    } else {
                      // Remove the previous tool call section to replace it
                      newStream =
                        newStream.split("Tool call:")[0] + "Tool call:";
                    }

                    if (name) {
                      newStream += `\nFunction: ${name}`;
                    }
                    if (partialArgs) {
                      // Clean up args for display
                      const displayArgs = partialArgs
                        .replace(/^["'{}]|["'{}]$/g, "")
                        .replace(/\\"/g, '"');
                      newStream += `\nArgs: ${displayArgs}`;
                    }

                    return newStream;
                  });
                }
              }
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

      // Try to parse any accumulated tool call arguments as JSON if needed
      if (finalAssistantMessage?.tool_calls) {
        for (const toolCall of finalAssistantMessage.tool_calls) {
          if (toolCall.function && toolCall.function.arguments) {
            try {
              // Try to parse if it's not already a valid JSON object
              if (
                typeof toolCall.function.arguments === "string" &&
                !toolCall.function.arguments.startsWith("{") &&
                !toolCall.function.arguments.startsWith("[")
              ) {
                const cleanedArgs = toolCall.function.arguments
                  .replace(/^"+|"+$/g, "") // Remove surrounding quotes if any
                  .replace(/\\"/g, '"'); // Replace escaped quotes

                // Check if it's a valid JSON string
                JSON.parse(`{${cleanedArgs}}`);

                // If it parsed successfully, format it properly
                toolCall.function.arguments = `{${cleanedArgs}}`;
              }
            } catch (e) {
              // If parsing fails, leave it as is
              console.log("Failed to clean tool call arguments:", e);
            }
          }
        }
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

        // Use the first tool call - most relevant for this Pokemon agent scenario
        const toolCall = assistantMessage.tool_calls[0];

        if (toolCall && toolCall.function) {
          // Execute the tool call
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
        } else {
          console.error("Tool call found but is malformed:", toolCall);
          setResponse("Received an invalid tool call. Please try again.");
        }
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

            {/* Action History - Moved to right side */}
            <div className="space-y-2 flex-1">
              <div className="font-medium">Action History:</div>
              <ScrollArea
                className="border rounded-md bg-muted/50 h-40"
                ref={actionHistoryScrollAreaRef}
              >
                <div className="p-4">
                  {actionHistory.length > 0 ? (
                    <ul className="list-disc pl-5">
                      {actionHistory.map((action, index) => (
                        <li key={index}>{action}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">
                      No actions taken yet
                    </p>
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

          {/* AI Response section */}
          <div className="space-y-2">
            <div className="font-medium">
              <span>AI Response:</span>
            </div>
            <ScrollArea
              className={`border rounded-md bg-muted/50 h-[180px] transition-all duration-200 ${
                loading ? "sky-blue-border" : ""
              }`}
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
                ) : response ? (
                  response
                ) : (
                  <span className="text-muted-foreground italic">
                    Response will appear here
                  </span>
                )}
              </div>
            </ScrollArea>
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
