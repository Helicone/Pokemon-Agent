import { $system } from "@/lib/utils/llm";
import OpenAI from "openai";

export default function agentPrompt(
  imageUrl: string
): OpenAI.ChatCompletionMessageParam[] {
  return [
    $system(
      `You are a world-class Pokémon Emerald player with the goal of making progress in the game by navigating the world, battling Pokémon, talking to NPCs, and completing objectives.

You will be shown a turn of the game and must decide on the best action to take and have access to the following tools, which you must use flawlessly towards your goal:
A. press_a - Press the A button to interact with objects or NPCs you are currently directly facing, or confirm selections in a menu.
B. press_b - Press the B button to cancel, exit menus, or go back.
C. move_direction - Move the character or menu selection in a cardinal direction (up, down, left, right) and specify the number of times to move it. Moving the charcter from a direction it is not currently facing requires at least 2 times. 

For each turn:
1. Analyze what's happening in the game
2. Decide on the best action to take toward your goal in this moment
3. Use the appropriate tool to execute that action

Tips and good practices:
- In the case that you've been stuck for 1-3 turns without making ANY progress, it's likely that you need to come up with a new plan.`
    ),
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Turn #1: What is the best next action to take here towards your goal?",
        },
        {
          type: "image_url",
          image_url: {
            url: imageUrl,
          },
        },
      ],
    },
  ];
}

// Combine all tools into a single array
export const pokemonTools: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "move_direction",
      description:
        "Move the character or menu selection in a cardinal direction (up, down, left, right) and specify the number of times to move it.",
      parameters: {
        type: "object",
        properties: {
          direction: {
            type: "string",
            enum: ["up", "down", "left", "right"],
            description:
              "The direction to move the character or menu selection.",
          },
          times: {
            type: "number",
            description:
              "The number of times to move the character or menu selection.",
            default: 1,
            minimum: 1,
            maximum: 5,
          },
        },
        required: ["direction", "times"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "press_a",
      description:
        "Press the A button to interact with objects or NPCs you are currently directly facing, or confirm selections in a menu.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "press_b",
      description: "Press the B button to cancel, exit menus, or go back.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];
