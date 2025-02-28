"use server";
import { ModelType } from "@/types/models";
import { headers } from "next/headers";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

export interface GenerationParameters {
  model: ModelType;
  messages: OpenAI.ChatCompletionMessageParam[];
  temperature?: number;
  tools?: OpenAI.ChatCompletionTool[];
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  schema?: object extends object ? z.ZodType<object> : never;
  stream?: boolean;
  reasoningEffort?: "low" | "medium" | "high";
}

// This interface is used for client-side streaming
export interface ClientStreamOptions {
  onChunk: (chunk: string) => void;
  onCompletion: () => void;
}

const openai = new OpenAI({
  baseURL: "https://openrouter.helicone.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
  },
});

// Define a type for our message object
interface AssistantMessageObject {
  role: string;
  content: string | null;
  tool_calls?: {
    id: string;
    type: string;
    function: {
      name: string;
      arguments: string;
    };
  }[];
}

export async function generate<T extends object | undefined = undefined>(
  props: GenerationParameters
): Promise<
  T extends object
    ? T
    :
        | OpenAI.Chat.Completions.ChatCompletion["choices"][0]["message"]
        | ReadableStream<Uint8Array>
> {
  const headersList = await headers();
  const abortController = new AbortController();

  try {
    const requestOptions: OpenAI.RequestOptions = {
      signal: abortController.signal,
    };

    // Create the base request parameters
    const baseParams = {
      model: props.model,
      messages: props.messages,
      temperature: props.temperature,
      max_tokens: props.maxTokens,
      top_p: props.topP,
      frequency_penalty: props.frequencyPenalty,
      presence_penalty: props.presencePenalty,
      stop: props.stop,
      tools: props.tools,
      ...(props.schema && {
        response_format: zodResponseFormat(props.schema, "result"),
      }),
    };

    // Add reasoning if provided (OpenRouter supports this)
    const requestParams = props.reasoningEffort
      ? {
          ...baseParams,
          reasoning: {
            effort: props.reasoningEffort,
          },
        }
      : baseParams;

    // Handle streaming separately
    if (props.stream) {
      // Set stream to true for streaming requests
      const streamingParams = {
        ...requestParams,
        stream: true,
      };

      // Use type assertion to bypass TypeScript checking
      const response = await openai.chat.completions.create(
        streamingParams as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParams,
        requestOptions
      );

      // Use the readStream utility to handle the streaming response
      const stream =
        response as unknown as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;

      // Create a new ReadableStream from the AsyncIterable
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            // Create empty objects to accumulate the full response
            const messageObject: AssistantMessageObject = {
              role: "assistant",
              content: "",
              tool_calls: [],
            };

            // Track tool calls by ID to avoid duplicates
            const toolCallsById: Record<
              string,
              {
                id: string;
                type: string;
                function: {
                  name: string;
                  arguments: string;
                };
              }
            > = {};

            for await (const chunk of stream) {
              // Check if request was cancelled
              if (headersList.get("x-cancel") === "1") {
                controller.close();
                abortController.abort();
                break;
              }

              const content = chunk?.choices?.[0]?.delta?.content;

              // Handle reasoning data if it exists (using type assertion)
              const delta = chunk?.choices?.[0]?.delta as {
                content?: string;
                reasoning?: string;
                tool_calls?: Array<{
                  id?: string;
                  type?: string;
                  function?: {
                    name?: string;
                    arguments?: string;
                  };
                }>;
                [key: string]: unknown;
              };

              // Check if there's reasoning data in the delta
              if (delta.reasoning) {
                // Create a JSON object with just the reasoning field
                const reasoningData = JSON.stringify({
                  reasoning: delta.reasoning,
                });
                // Log for debugging
                console.log("Sending reasoning data:", delta.reasoning);
                // Send the reasoning data to the client directly through the stream
                controller.enqueue(new TextEncoder().encode(reasoningData));

                // No need to emit events anymore, we're streaming directly
                console.log(
                  "Streamed reasoning data directly:",
                  delta.reasoning
                );
              }

              // Accumulate tool calls if they exist
              if (delta.tool_calls && delta.tool_calls.length > 0) {
                for (const toolCall of delta.tool_calls) {
                  // If we have an id, use it to track the tool call
                  if (toolCall.id) {
                    // Initialize tool call in our tracking object if it doesn't exist
                    if (!toolCallsById[toolCall.id]) {
                      toolCallsById[toolCall.id] = {
                        id: toolCall.id,
                        type: toolCall.type || "function",
                        function: {
                          name: "",
                          arguments: "",
                        },
                      };
                      // Add to the message's tool_calls array
                      // Ensure tool_calls is initialized
                      if (!messageObject.tool_calls) {
                        messageObject.tool_calls = [];
                      }
                      messageObject.tool_calls.push(toolCallsById[toolCall.id]);
                    }

                    // Update function data if it exists
                    if (toolCall.function) {
                      if (toolCall.function.name) {
                        toolCallsById[toolCall.id].function.name =
                          toolCall.function.name;
                      }
                      if (toolCall.function.arguments) {
                        toolCallsById[toolCall.id].function.arguments =
                          (toolCallsById[toolCall.id].function.arguments ||
                            "") + toolCall.function.arguments;
                      }
                    }
                  }
                }
                // Log the updated tool calls
                console.log("Updated tool calls:", messageObject.tool_calls);
              }

              // Only add actual content to the fullResponse
              if (content) {
                messageObject.content = (messageObject.content || "") + content;

                // Also send tool call information to the client when available
                if (delta.tool_calls && delta.tool_calls.length > 0) {
                  const toolCallData = JSON.stringify({
                    tool_calls: delta.tool_calls,
                  });
                  controller.enqueue(new TextEncoder().encode(toolCallData));
                } else {
                  controller.enqueue(new TextEncoder().encode(content));
                }
              }
            }

            // Send the complete message object at the end
            const finalMessage = JSON.stringify({
              finalMessage: messageObject,
            });
            controller.enqueue(new TextEncoder().encode(finalMessage));
            controller.close();
          } catch (error) {
            console.error("Error in stream processing:", error);
            controller.error(error);
          }
        },
      });

      // Return the ReadableStream directly to the client
      return readableStream as unknown as T extends object
        ? T
        :
            | OpenAI.Chat.Completions.ChatCompletion["choices"][0]["message"]
            | ReadableStream<Uint8Array>;
    } else {
      // For non-streaming requests
      const nonStreamingParams = {
        ...requestParams,
        stream: false,
      };

      // Use type assertion to bypass TypeScript checking
      const completionResponse = (await openai.chat.completions.create(
        nonStreamingParams as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParams,
        requestOptions
      )) as OpenAI.Chat.Completions.ChatCompletion;

      // Return the full message object (including tool_calls if present)
      const message = completionResponse.choices?.[0]?.message;

      if (!message) {
        throw new Error(
          `Failed to generate response: ${JSON.stringify(
            completionResponse as unknown as Record<string, unknown>
          )}`
        );
      }

      // Log the response for debugging
      console.log("Response received:", {
        hasContent: !!message.content,
        hasToolCalls: !!message.tool_calls && message.tool_calls.length > 0,
        toolCallsCount: message.tool_calls?.length || 0,
      });

      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log(
          "Tool calls received:",
          JSON.stringify(message.tool_calls, null, 2)
        );
      }

      if (props.schema) {
        // If a schema is provided, parse the content as JSON
        if (message.content) {
          try {
            const parsed = props.schema.parse(JSON.parse(message.content));
            return parsed as T extends object
              ? T
              :
                  | OpenAI.Chat.Completions.ChatCompletion["choices"][0]["message"]
                  | ReadableStream<Uint8Array>;
          } catch (error) {
            console.error("Error parsing content with schema:", error);
            throw new Error("Failed to parse response with schema");
          }
        } else {
          throw new Error("No content to parse with schema");
        }
      }

      // Return the full message object instead of just the content
      return message as T extends object
        ? T
        :
            | OpenAI.Chat.Completions.ChatCompletion["choices"][0]["message"]
            | ReadableStream<Uint8Array>;
    }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "ResponseAborted" || error.name === "AbortError")
    ) {
      return "" as unknown as T extends object
        ? T
        :
            | OpenAI.Chat.Completions.ChatCompletion["choices"][0]["message"]
            | ReadableStream<Uint8Array>;
    }
    console.error("Error in generate function:", error);
    throw error;
  }
}
