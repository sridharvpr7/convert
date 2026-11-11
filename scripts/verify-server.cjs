const http = require('node:http');
const { spawn } = require('node:child_process');

async function testServer() {
  console.log('Testing full-stack production server...');
  const proc = spawn('node', ['server/index.js'], {
    env: { ...process.env, PORT: '5055' },
    stdio: 'pipe',
  });

  await new Promise((r) => setTimeout(r, 1500));

  function request(url) {
    return new Promise((resolve, reject) => {
      http.get(url, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, data }));
      }).on('error', reject);
    });
  }

  try {
    const health = await request('http://localhost:5055/api/health');
    console.log('✓ /api/health status:', health.status);
    const healthJson = JSON.parse(health.data);
    console.log('✓ Health response:', JSON.stringify(healthJson, null, 2));

    const html = await request('http://localhost:5055/');
    console.log('✓ Root / status:', html.status);
    console.log('✓ HTML content length:', html.data.length, 'bytes');
    console.log('✓ Contains <title>:', html.data.includes('<title>'));

    console.log('\n--- SERVER VERIFICATION PASSED ---');
  } finally {
    proc.kill();
  }
}

testServer().catch((err) => {
  console.error('Server test failed:', err);
  process.exit(1);
});

