const dns = require('dns');

dns.resolveSrv('_mongodb._tcp.cluster0.p6qpcwl.mongodb.net', (err, addresses) => {
  if (err) {
    console.error('SRV lookup failed:', err);
    process.exit(1);
  }
  console.log('SRV records:');
  console.log(JSON.stringify(addresses, null, 2));
});
