const axios = require('axios');

const testGemini = async () => {
  try {
    console.log('🧪 Testing Gemini AI connection...');
    
    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyBuaJt3y77fKLlaOKQ1dsuCuWHvA0p1uog',
      {
        contents: [
          {
            parts: [
              {
                text: 'Just say "Hello from Gemini!" in JSON format: {"message": "Hello from Gemini!"}'
              }
            ]
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Gemini Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ Gemini Error:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
};

testGemini();