import { test } from 'node:test';
import assert from 'node:assert/strict';
import lookup, { fetchOpenFoodFacts } from '../src/api/lookupOpenFoodFacts';

const fakeFetch = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

test('Open Food Facts: maps a found product', async () => {
  const p = await fetchOpenFoodFacts('3017624010701', fakeFetch(200, {
    status: 1,
    product: { product_name: 'Nutella', brands: 'Ferrero, Nutella', quantity: '400 g', categories: 'Spreads, Sweet', image_front_small_url: 'https://images.openfoodfacts.org/x.jpg' },
  }));
  assert.deepEqual(p, {
    barcode: '3017624010701', name: 'Nutella', brand: 'Ferrero', quantity: '400 g', category: 'Spreads',
    image: 'https://images.openfoodfacts.org/x.jpg', url: 'https://world.openfoodfacts.org/product/3017624010701',
  });
});

test('Open Food Facts: not found, errors and non-https images give null', async () => {
  assert.equal(await fetchOpenFoodFacts('3017624010701', fakeFetch(404, { status: 0 })), null);
  assert.equal(await fetchOpenFoodFacts('3017624010701', fakeFetch(200, { status: 1, product: {} })), null);
  assert.equal(await fetchOpenFoodFacts('3017624010701', (async () => { throw new Error('down'); }) as unknown as typeof fetch), null);
  const p = await fetchOpenFoodFacts('3017624010701', fakeFetch(200, { status: 1, product: { product_name: 'X', image_front_small_url: 'javascript:alert(1)' } }));
  assert.equal(p?.image, null);
});

test('Open Food Facts: internal-use and bad check digit numbers are never looked up', async () => {
  for (const barcode of ['2000000000015', '400000000015', '3017624010702']) {
    assert.deepEqual(await lookup.execute({ input: { barcode } } as any), { product: null }, barcode);
  }
});
