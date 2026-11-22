import { test } from 'node:test';
import assert from 'node:assert/strict';
import lookup from '../src/api/lookupOpenFoodFacts';
import { fetchOffRecord, offWriteConfig, buildOffFields, publishToOff } from '../src/server/openFoodFacts';

const sample = { barcode: '8941234000017', title: 'Mango Juice', brand: 'Acme', netWeight: '250 ml', category: '', ingredients: 'Mango, water', countryOfOrigin: 'Bangladesh', certifications: '' };

test('Open Food Facts publishing: staging unless production is asked for, and never without an account', () => {
  assert.equal(offWriteConfig({}), null);
  const staging = offWriteConfig({ OFF_USER_ID: 'bh', OFF_PASSWORD: 'pw' })!;
  assert.equal(staging.base, 'https://world.openfoodfacts.net');
  assert.equal(staging.headers.Authorization, 'Basic ' + btoa('off:off'));
  const prod = offWriteConfig({ OFF_USER_ID: 'bh', OFF_PASSWORD: 'pw', OFF_SERVER: 'production' })!;
  assert.equal(prod.base, 'https://world.openfoodfacts.org');
  assert.equal(prod.headers.Authorization, undefined);
});

test('Open Food Facts publishing: field mapping leaves empty values out and detects Bengali', () => {
  const f = buildOffFields(sample);
  assert.equal(f.product_name, 'Mango Juice');
  assert.equal(f.quantity, '250 ml');
  assert.equal(f.lang, 'en');
  assert.equal('categories' in f, false);
  assert.equal('add_labels' in f, false);
  assert.equal(buildOffFields({ ...sample, title: 'আমের জুস' }).lang, 'bn');
});

test('Open Food Facts publishing: sends product then photo, reports a refused photo, throws on a refused product', async () => {
  const cfg = offWriteConfig({ OFF_USER_ID: 'bh', OFF_PASSWORD: 'pw' })!;
  const calls: { url: string; body: FormData }[] = [];
  const fake = (answers: unknown[]) => (async (url: string, init: RequestInit) => {
    calls.push({ url, body: init.body as FormData });
    return new Response(JSON.stringify(answers[calls.length - 1]), { status: 200 });
  }) as unknown as typeof fetch;

  const ok = await publishToOff(cfg, 'uuid1', sample, { data: new Blob(['x']), name: 'a.jpg' }, fake([{ status: 1 }, { status: 'status not ok', error: 'too small' }]));
  assert.equal(calls[0].url, 'https://world.openfoodfacts.net/cgi/product_jqm2.pl');
  assert.equal(calls[0].body.get('user_id'), 'bh');
  assert.equal(calls[0].body.get('app_uuid'), 'uuid1');
  assert.equal(calls[0].body.get('code'), '8941234000017');
  assert.equal(calls[1].url, 'https://world.openfoodfacts.net/cgi/product_image_upload.pl');
  assert.equal(calls[1].body.get('imagefield'), 'front_en');
  assert.ok(calls[1].body.get('imgupload_front_en') instanceof Blob);
  assert.deepEqual(ok, { url: 'https://world.openfoodfacts.net/product/8941234000017', photoUploaded: false, photoError: 'too small' });

  calls.length = 0;
  await assert.rejects(publishToOff(cfg, 'uuid1', sample, null, fake([{ status: 0, status_verbose: 'no code' }])), /refused the product: no code/);
  assert.equal(calls.length, 1);
});

const fetchOpenFoodFacts = async (code: string, f: typeof fetch) => (await fetchOffRecord(code, f))?.product ?? null;

const fakeFetch = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

test('Open Food Facts: maps a found product', async () => {
  const p = await fetchOpenFoodFacts('3017624010701', fakeFetch(200, {
    status: 1,
    product: { product_name: 'Nutella', brands: 'Ferrero, Nutella', quantity: '400 g', categories: 'Spreads, Sweet', image_front_url: 'https://images.openfoodfacts.org/x.jpg' },
  }));
  assert.deepEqual(p, {
    barcode: '3017624010701', name: 'Nutella', brand: 'Ferrero', quantity: '400 g', category: 'Spreads', ingredients: '', countries: '',
    image: 'https://images.openfoodfacts.org/x.jpg', url: 'https://world.openfoodfacts.org/product/3017624010701',
  });
});

test('Open Food Facts: not found, errors and non-https images give null', async () => {
  assert.equal(await fetchOpenFoodFacts('3017624010701', fakeFetch(404, { status: 0 })), null);
  assert.equal(await fetchOpenFoodFacts('3017624010701', fakeFetch(200, { status: 1, product: {} })), null);
  assert.equal(await fetchOpenFoodFacts('3017624010701', (async () => { throw new Error('down'); }) as unknown as typeof fetch), null);
  const p = await fetchOpenFoodFacts('3017624010701', fakeFetch(200, { status: 1, product: { product_name: 'X', image_front_url: 'javascript:alert(1)' } }));
  assert.equal(p?.image, null);
});

test('Open Food Facts: exists vs unknown', async () => {
  assert.deepEqual(await fetchOffRecord('3017624010701', fakeFetch(404, { status: 0 })), { exists: false, product: null });
  assert.deepEqual(await fetchOffRecord('3017624010701', fakeFetch(200, { status: 1, product: {} })), { exists: true, product: null });
  assert.equal(await fetchOffRecord('3017624010701', fakeFetch(503, {})), null);
});

test('Open Food Facts: internal-use and bad check digit numbers are never looked up', async () => {
  for (const barcode of ['2000000000015', '400000000015', '3017624010702']) {
    assert.deepEqual(await lookup.execute({ input: { barcode } } as any), { product: null }, barcode);
  }
});
