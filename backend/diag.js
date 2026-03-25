const { MongoClient } = require('mongodb');
const fs = require('fs');

const uri = "mongodb://kirtihooda2006_db_user:Kir1234@ac-e1jsaet-shard-00-00.p6qpcwl.mongodb.net:27017,ac-e1jsaet-shard-00-01.p6qpcwl.mongodb.net:27017,ac-e1jsaet-shard-00-02.p6qpcwl.mongodb.net:27017/?ssl=true&replicaSet=atlas-e1jsaet-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0";

const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 15000,
  family: 4
});

async function run() {
  let log = "";
  try {
    log += "Starting IPv4 direct connection attempt...\n";
    await client.connect();
    log += "Initialized! Running ping...\n";
    const result = await client.db("admin").command({ ping: 1 });
    log += "Ping successful: " + JSON.stringify(result) + "\n";
  } catch (err) {
    log += "ERROR:\n" + err.name + ": " + err.message + "\n" + err.stack + "\n";
  } finally {
    fs.writeFileSync('diag_out_node.txt', log);
    await client.close();
  }
}
run();
run();
