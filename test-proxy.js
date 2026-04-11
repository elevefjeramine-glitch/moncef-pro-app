const http = require('https');

async function testCloudflare() {
  const url = 'https://moncef-ia-proxy.eleve-fjer-amine.workers.dev/api/claude';
  const data = JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] });

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://elevefjeramine-glitch.github.io'
    }
  };

  const req = http.request(url, options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Headers:', res.headers);
      console.log('Body:', body);
    });
  });

  req.on('error', (e) => {
    console.error('Request error:', e);
  });

  req.write(data);
  req.end();
}

testCloudflare();
