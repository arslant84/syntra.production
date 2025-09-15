// Simple script to test the accommodation API endpoints
const http = require('http');

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      const { statusCode } = res;
      const contentType = res.headers['content-type'];

      res.setEncoding('utf8');
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        try {
          // Even if status code is not 200, try to parse the response body
          let parsedData;
          try {
            parsedData = JSON.parse(rawData);
          } catch (e) {
            parsedData = { error: 'Failed to parse JSON', rawData };
          }
          
          if (statusCode !== 200) {
            const error = new Error(`Request Failed. Status Code: ${statusCode}`);
            error.response = parsedData;
            reject(error);
            return;
          }
          
          if (!/^application\/json/.test(contentType)) {
            const error = new Error(`Invalid content-type. Expected application/json but received ${contentType}`);
            error.response = parsedData;
            reject(error);
            return;
          }
          
          resolve(parsedData);
        } catch (e) {
          console.error(`Error handling response: ${e.message}`);
          reject(e);
        }
      });
    }).on('error', (e) => {
      console.error(`Got error: ${e.message}`);
      reject(e);
    });
  });
}

async function testAccommodationAPI() {
  console.log('Testing Accommodation API Endpoints...');
  
  try {
    // Test locations endpoint
    console.log('\nTesting /api/accommodation/admin/locations endpoint:');
    try {
      const locationsData = await makeRequest('http://localhost:9004/api/accommodation/admin/locations');
      console.log(`Success! Received ${locationsData.locations?.length || 0} locations`);
    } catch (error) {
      console.error(`Failed to test locations endpoint: ${error.message}`);
    }

    // Test rooms endpoint
    console.log('\nTesting /api/accommodation/admin/rooms endpoint:');
    try {
      const roomsData = await makeRequest('http://localhost:9004/api/accommodation/admin/rooms');
      console.log(`Success! Received ${roomsData.rooms?.length || 0} rooms`);
    } catch (error) {
      console.error(`Failed to test rooms endpoint: ${error.message}`);
    }

    // Test bookings endpoint
    console.log('\nTesting /api/accommodation/admin/bookings endpoint:');
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;
    try {
      console.log(`Requesting bookings with year=${year} and month=${month}`);
      const bookingsData = await makeRequest(`http://localhost:9004/api/accommodation/admin/bookings?year=${year}&month=${month}`);
      console.log(`Success! Received ${bookingsData.bookings?.length || 0} bookings`);
    } catch (error) {
      console.error(`Failed to test bookings endpoint: ${error.message}`);
      if (error.response) {
        console.error('Error details:', JSON.stringify(error.response, null, 2));
      }
    }

  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

testAccommodationAPI();
