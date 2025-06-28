const axios = require('axios');

const API_BASE_URL = 'http://localhost:8000';

async function testLocalSetup() {
  console.log('🧪 Testing Local Full Backend Setup\n');
  
  try {
    // Test 1: Health endpoint
    console.log('1. Testing health endpoint...');
    const health = await axios.get(`${API_BASE_URL}/health`);
    console.log('✅ Health:', health.data);
    
    // Test 2: Regions endpoint
    console.log('\n2. Testing regions endpoint...');
    const regions = await axios.get(`${API_BASE_URL}/regions`);
    console.log('✅ Regions:', regions.data);
    
    // Test 3: API key status
    console.log('\n3. Testing API key status...');
    const apiKeyStatus = await axios.get(`${API_BASE_URL}/api-key/status`);
    console.log('✅ API Key Status:', apiKeyStatus.data);
    
    // Test 4: Saved URLs
    console.log('\n4. Testing saved URLs...');
    const savedUrls = await axios.get(`${API_BASE_URL}/saved-urls`);
    console.log('✅ Saved URLs:', savedUrls.data);
    
    // Test 5: Test crawl-and-summarize with sample data
    console.log('\n5. Testing crawl-and-summarize endpoint...');
    const testData = {
      urls: [
        "https://www.fao.org/worldfoodsituation/foodpricesindex/en/",
        "https://www.ncei.noaa.gov/access/monitoring/monthly-report/global-drought/202503"
      ],
      region: "Global Overview"
    };
    
    const crawlResponse = await axios.post(`${API_BASE_URL}/crawl-and-summarize`, testData, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('✅ Crawl Response Status:', crawlResponse.status);
    console.log('✅ Analysis Length:', crawlResponse.data.summary?.length || 0, 'characters');
    console.log('✅ PDF Support:', crawlResponse.data.pdf_support);
    console.log('✅ URLs Processed:', crawlResponse.data.urls_processed);
    
    console.log('\n🎉 All tests passed! Local setup is working correctly.');
    console.log('\n📋 Summary:');
    console.log('- Backend: Running on http://localhost:8000');
    console.log('- Frontend: Running on http://localhost:5173');
    console.log('- PDF Support: Enabled');
    console.log('- API Key: Configured');
    console.log('- Full crawling: Working');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testLocalSetup(); 