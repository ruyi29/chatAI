const http = require('http');

const data = JSON.stringify({ message: '你好，帮我介绍一下你自己' });

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/chat/stream',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  res.on('data', (chunk) => {
    process.stdout.write(chunk.toString());
  });

  res.on('end', () => {
    console.log('\n-- stream ended --');
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
  process.exit(1);
});

req.write(data);
req.end();
