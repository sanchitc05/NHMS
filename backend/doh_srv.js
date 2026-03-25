const https = require('https');
const fs = require('fs');

const url = 'https://cloudflare-dns.com/dns-query?name=_mongodb._tcp.cluster0.p6qpcwl.mongodb.net&type=SRV';
const options = {
  headers: {
    'accept': 'application/dns-json'
  }
};

https.get(url, options, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    fs.writeFileSync('doh_srv.json', data);
    console.log("SRV fetched!");
  });
}).on('error', (e) => {
  console.error(e);
});
