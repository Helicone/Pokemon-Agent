# Tool Calling Implementation

This document explains how tool calling (function calling) is implemented in our application.

## Overview

Tool calling allows the AI to suggest actions that should be taken in the game. The AI doesn't directly execute these actions; instead, it suggests them, and our application executes them and provides the results back to the AI.

## Implementation Details

### 1. Tool Definitions

Tools are defined in `prompts/agent-prompt.ts` using the OpenAI tool schema:

```typescript
export const pokemonTools: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "move_direction",
      description: "Move the character in a cardinal direction",
      parameters: {
        type: "object",
        properties: {
          direction: {
            type: "string",
            enum: ["up", "down", "left", "right"],
            description: "The direction to move the character",
          },
        },
        required: ["direction"],
      },
    },
  },
  // Other tools...
];
```

### 2. Zod Schemas for Validation

We use Zod to validate tool arguments in `components/core/PlayerAgent.tsx`:

```typescript
// Define schemas for tool arguments
const MoveDirectionArgsSchema = z.object({
  direction: z.enum(["up", "down", "left", "right"]),
});

const EmptyArgsSchema = z.object({});

// Define tool call schema
const ToolCallSchema = z.object({
  id: z.string(),
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});
```

### 3. Processing Tool Calls

When the AI suggests a tool call, we:

1. Parse and validate the arguments using Zod
2. Execute the corresponding action
3. Add the result to the conversation history
4. Send the result back to the AI in the next turn

```typescript
// Process tool calls if present
if (
  assistantMessage.tool_calls &&
  assistantMessage.tool_calls.length > 0
) {
  const toolCall = assistantMessage.tool_calls[0];
  const actionTaken = await processToolCall(toolCall);

  // Display the action and reasoning
  const reasoning = assistantMessage.content || "No reasoning provided";
  setResponse(`Action: ${actionTaken}\n\nReasoning: ${reasoning}`);
}
```

### 4. Tool Execution

The `processToolCall` function handles the execution of tool calls:

```typescript
const processToolCall = async (
  toolCall: z.infer<typeof ToolCallSchema>
): Promise<string> => {
  try {
    const functionName = toolCall.function.name;
    let actionTaken = "";
    let argsString = toolCall.function.arguments;
    
    // Try to parse the arguments as JSON
    let args;
    try {
      args = JSON.parse(argsString);
    } catch (e) {
      console.error("Failed to parse tool arguments:", e);
      return `Failed to parse arguments for ${functionName}`;
    }

    switch (functionName) {
      case "move_direction": {
        try {
          const validatedArgs = MoveDirectionArgsSchema.parse(args);
          const direction = validatedArgs.direction;
          actionTaken = `Moved ${direction}`;

          // Execute the action in the emulator
          if (isGameRunning) {
            await pressKey(direction);
          }
        } catch (e) {
          console.error("Invalid move_direction arguments:", e);
          actionTaken = "Failed to parse move direction arguments";
        }
        break;
      }
      // Other cases...
    }

    // Add the action to history
    setActionHistory((prev) => [...prev, actionTaken]);

    // Add tool result to conversation
    setConversation((prev) => [
      ...prev,
      {
        role: "tool",
        tool_call_id: toolCall.id,
        name: functionName,
        content: JSON.stringify({ success: true, action: actionTaken }),
      },
    ]);

    return actionTaken;
  } catch (error) {
    console.error("Error processing tool call:", error);
    return `Error processing tool call: ${toolCall.function.name}`;
  }
};
```

### 5. Multi-turn Conversation

The conversation history is maintained in the component's state, and each new screenshot is added as a user message. The AI's responses and tool results are also added to the conversation history to maintain context.

## Testing

You can test the tool calling implementation using the `scripts/test-tool-calling.ts` script:

```bash
ts-node scripts/test-tool-calling.ts
```

This script simulates a conversation with the AI and processes tool calls to verify that the implementation works correctly.

## Troubleshooting

If you encounter issues with tool calling:

1. Check the console logs for errors
2. Verify that the tool definitions match the expected format
3. Ensure that the Zod schemas correctly validate the tool arguments
4. Check that the conversation history is being maintained correctly

## References

- [OpenAI Function Calling Documentation](https://platform.openai.com/docs/guides/function-calling)
- [Zod Documentation](https://zod.dev/) 