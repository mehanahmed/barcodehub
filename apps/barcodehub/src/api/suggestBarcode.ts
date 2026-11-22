import { z } from 'zod';
import { createEndpoint } from '../server/endpoint';
import { requireTenant } from '../server/helpers';
import { nextBarcode } from '../server/nextBarcode';

export default createEndpoint({
  description: 'Suggests the next free barcode number for the signed-in tenant',
  authenticated: true,
  inputSchema: z.object({ type: z.enum(['EAN-13', 'UPC-A', 'System Code128']) }),
  outputSchema: z.object({ barcode: z.string() }),
  execute: async ({ input, context }) => {
    const tenant = await requireTenant(context);
    return { barcode: await nextBarcode(tenant, input.type) };
  },
});
