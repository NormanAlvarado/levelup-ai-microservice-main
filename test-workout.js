const http = require('http');

// Datos del request
const postData = JSON.stringify({
  "userId": "a7f021f7-ded5-4e0a-b57c-427e9d04f61d",
  "goal": "gain_muscle",
  "duration": 45,
  "difficulty": "intermediate",
  "daysPerWeek": 4,
  "equipment": ["dumbbells", "barbell"]
});

// Opciones del request
const options = {
  hostname: 'localhost',
  port: 3005,
  path: '/api/ai/workout/personalized',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🚀 Enviando request a:', `http://localhost:3005${options.path}`);
console.log('📦 Datos:', postData);

// Hacer el request
const req = http.request(options, (res) => {
  console.log(`✅ Status: ${res.statusCode}`);
  console.log(`📋 Headers:`, res.headers);

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('🎯 Response:');
    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error);
});

req.write(postData);
req.end();