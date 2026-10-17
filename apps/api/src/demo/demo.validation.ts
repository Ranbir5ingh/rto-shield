import { z } from 'zod';

export const tourCompleteSchema = z.object({
  tour: z.enum(['seller', 'demo']),
});
