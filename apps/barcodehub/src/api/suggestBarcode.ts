import { z } from 'zod';
import { createEndpoint } from '../server/endpoint';
import { requireTenant } from '../server/helpers';
import { nextBarcode } from '../server/nextBarcode';
import { isOnOpenFoodFacts } from '../server/openFoodFacts';

export default createEndpoint({
  description: 'Suggests the next free barcode number for the signed-in tenant',
  authenticated: true,
  inputSchema: z.object({ type: z.enum(['EAN-13', 'UPC-A', 'System Code128']) }),
  outputSchema: z.object({ barcode: z.string(), checked: z.boolean() }),
  execute: async ({ input, context }) => {
    const tenant = await requireTenant(context);
    // Skip numbers Open Food Facts already lists, so a new barcode doesn't point at someone else's product there.
    return nextBarcode(tenant, input.type, isOnOpenFoodFacts);
  },
});
