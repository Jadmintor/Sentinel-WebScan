const axios = require('axios');

const acunetixApi = axios.create({
  baseURL: process.env.ACUNETIX_API_URL,
  headers: {
    'X-Auth': process.env.ACUNETIX_API_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 30000
});

module.exports = acunetixApi;