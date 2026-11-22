import { z } from 'zod';
import { createEndpoint } from '../server/endpoint';
import { gs1CheckDigit, isGlobalGtin } from '../lib/barcode';
import { getOffRecord } from '../server/openFoodFacts';

export type { OffProduct } from '../server/openFoodFacts';

export default createEndpoint({
  description: 'Looks up a barcode on Open Food Facts when it is not in BarcodeHub',
  inputSchema: z.object({ barcode: z.string().trim().regex(/^\d{12,13}$/) }),
  outputSchema: z.object({ product: z.any() }),
  execute: async ({ input }) => {
    const code = input.barcode;
    const type = code.length === 13 ? 'EAN-13' : 'UPC-A';
    // Internal-use numbers are reused by many shops, so an OFF hit would describe someone else's product.
    if (gs1CheckDigit(code.slice(0, -1)) !== Number(code.slice(-1)) || !isGlobalGtin(type, code)) return { product: null };
    return { product: (await getOffRecord(code))?.product ?? null };
  },
});
