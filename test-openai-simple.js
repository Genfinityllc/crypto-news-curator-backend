#!/usr/bin/env node

/**
 * Simple OpenAI API Key Test
 * Tests if the OpenAI API key is working properly
 */

const https = require('https');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
    console.log('❌ OPENAI_API_KEY environment variable not set');
    process.exit(1);
}

if (OPENAI_API_KEY.startsWith('sk-')) {
    console.log('✅ OpenAI API key format looks correct');
} else {
    console.log('⚠️ OpenAI API key format may be incorrect (should start with sk-)');
}

// Test OpenAI API connection
const postData = JSON.stringify({
    model: "gpt-3.5-turbo",
    messages: [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Say 'OpenAI API key is working!' if you can read this."}
    ],
    max_tokens: 20
});

const options = {
    hostname: 'api.openai.com',
    port: 443,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Length': Buffer.byteLength(postData)
    }
};

console.log('🧪 Testing OpenAI API connection...');

const req = https.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        try {
            const response = JSON.parse(data);
            
            if (res.statusCode === 200) {
                console.log('✅ OpenAI API key is working!');
                console.log('📝 Response:', response.choices[0].message.content);
                console.log('💰 Tokens used:', response.usage.total_tokens);
            } else {
                console.log('❌ OpenAI API error:');
                console.log('Status:', res.statusCode);
                console.log('Response:', response);
            }
        } catch (error) {
            console.log('❌ Failed to parse response:', error.message);
            console.log('Raw response:', data);
        }
    });
});

req.on('error', (error) => {
    console.log('❌ Request failed:', error.message);
});

req.write(postData);
req.end();