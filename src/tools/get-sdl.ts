import { z } from 'zod/v3';
import type { ToolDefinition, ToolContext } from '../types/index.js';
import { createOutput } from '../utils/create-output.js';
import { getSDLTemplate } from '../utils/get-sdl-template.js';

const parameters = z.object({
  name: z.string(),
});

export const GetSDLTool: ToolDefinition<typeof parameters> = {
  name: 'get-sdl-template',
  description: 'Get SDL template from the local directory by unique name',
  parameters,
  handler: async (args, context: ToolContext) => {
    const template = getSDLTemplate(args.name);

    if (!template) {
      return createOutput({ error: `Template ${args.name} not found` });
    }

    return createOutput(template);
  },
};
