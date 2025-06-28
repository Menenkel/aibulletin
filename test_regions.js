const https = require('https');
const http = require('http');

function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

async function testBackend() {
    try {
        console.log('Testing backend endpoints...\n');
        
        // Test regions endpoint
        const regions = await makeRequest('http://localhost:8000/regions');
        console.log('Regions returned:', regions.length);
        console.log('Regions:', regions);
        
        // Test health endpoint
        const health = await makeRequest('http://localhost:8000/health');
        console.log('\nHealth status:', health);
        
        // Test API key status
        const apiKeyStatus = await makeRequest('http://localhost:8000/api-key/status');
        console.log('\nAPI key status:', apiKeyStatus);
        
        // Test saved URLs
        const savedUrls = await makeRequest('http://localhost:8000/saved-urls');
        console.log('\nSaved URLs:', savedUrls);
        
    } catch (error) {
        console.error('Error testing backend:', error.message);
    }
}

testBackend(); 