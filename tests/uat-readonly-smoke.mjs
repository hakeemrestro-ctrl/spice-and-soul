// Website-preview checks only: no credentials, form submission, payments or emails.
// Intentionally fixed to the dedicated UAT domain; never accepts a production URL.
import assert from 'node:assert/strict';

const origin = 'https://project-2ed6x.vercel.app';
const cases = [
  ['/', 200, 'Master Indian cooking'],
  ['/courses', 200, 'Indian Cooking Courses'],
  ['/courses/north-indian-classics', 200, 'North Indian Classics'],
  ['/courses/street-food-chaat', 200, 'Street Food'],
  ['/courses/south-indian-mastery', 200, 'South Indian Mastery'],
  ['/courses/indian-sweets-desserts', 200, 'Indian Sweets'],
  ['/courses/biryani-rice-dishes', 200, 'Biryani'],
  ['/about-us', 200], ['/blog', 200], ['/blog/how-to-grind-masala', 200],
  ['/restaurant', 200], ['/free-sampler', 200], ['/privacy', 200],
  ['/terms', 200], ['/refund-policy', 200],
  ['/login', 404], ['/register', 404], ['/dashboard', 404],
  ['/admin/login', 503, 'UAT website preview'],
  ['/admin', 503, 'UAT website preview'],
  ['/checkout', 503, 'UAT website preview'],
  ['/resend', 503, 'UAT website preview'],
  ['/api/billdesk/callback', 503, 'UAT_PREVIEW_ONLY'],
  ['/api/billdesk/webhook', 503, 'UAT_PREVIEW_ONLY'],
];

let failures = 0;
for (const [path, status, marker] of cases) {
  try {
    const response = await fetch(origin + path, {
      method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(20000),
    });
    assert.equal(response.status, status);
    const body = await response.text();
    if (marker) assert.ok(body.includes(marker));
    assert.match(response.headers.get('x-robots-tag') ?? '', /noindex/);
    if (status === 503) assert.match(response.headers.get('cache-control') ?? '', /no-store/);
    console.log(`PASS ${path} (${status})`);
  } catch {
    failures++;
    // Do not print HTML, response headers, cookies, tokens or exception details.
    console.error(`FAIL ${path}: expected status ${status} and preview-page contract`);
  }
}
console.log(`${cases.length - failures}/${cases.length} read-only UAT checks passed`);
process.exitCode = failures ? 1 : 0;
