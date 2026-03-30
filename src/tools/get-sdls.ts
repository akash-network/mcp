import { z } from 'zod/v3';
import type { ToolDefinition, ToolContext } from '../types/index.js';
import { createOutput } from '../utils/create-output.js';
import { getSDLTemplates } from '../utils/get-sdl-templates.js';

const parameters = z.object({
  page: z.number().optional(),
  limit: z.number().optional(),
});

export const GetSDLsTool: ToolDefinition<typeof parameters> = {
  name: 'get-sdl-templates',
  description: 'Get SDL templates from the local directory',
  parameters,
  handler: async (args, context: ToolContext) => {
    const templates = getSDLTemplates(args.page ?? 1, args.limit ?? 10);

    return createOutput(templates);
  },
};
