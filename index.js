#!/usr/bin/node
const jwt = require('jsonwebtoken');
const fs = require('fs');
const http = require("https");

// stored some properties in muh package.json
const configs = require("./package.json");
const jwtConf = configs.config.jwt;
const gheConf = configs.config.ghe;

function newJWT() {
  let cert = fs.readFileSync(process.env.JWT_PEMFILE || jwtConf.pemfile);  // get private key
  let date = parseInt((new Date().getTime() / 1000).toFixed(0))
  return jwt.sign({
     iat: date,
     exp: date + (5 /* 10 minute max */ * 60),
     iss: 1
   }, cert, { algorithm: jwtConf.algo });
}

function newToken(cb) {
  var req = http.request({
    "method": "POST",
    "hostname": process.env.GHE_HOSTNAME || gheConf.hostname,
    "port": gheConf.port,
    "path": "/api/v3/installations/1/access_tokens",
    "headers": {
      "accept": "application/vnd.github.machine-man-preview+json",
      "authorization": `Bearer ${newJWT()}`
    }
  }, function (res) {
    var chunks = [];

    res.on("data", function (chunk) {
      chunks.push(chunk);
    });

    res.on("end", function () {
      var body = Buffer.concat(chunks);
      cb(body.toString());
    });
  });
  req.end();
}

function isValid(s) {
  let now = new Date().getTime();
  let exp = new Date(s).getTime();

  return (exp - (now + 10000)) > 0;
}


// Does config have 'cache' element?
let fetchNew = true;
if (configs.hasOwnProperty('cache')) {
  if (configs.cache.hasOwnProperty("installation")) {
    if (configs.cache.installation.hasOwnProperty("expires_at")) {
      if (isValid(configs.cache.installation.expires_at)) {
        console.log(configs.cache.installation.token);
        fetchNew = false;
      }
    }
  }
}

if (fetchNew) {
  newToken(tok => {
    // Try to parse
    let tokenResponse = JSON.parse(tok);
    if (tokenResponse.hasOwnProperty("token") && tokenResponse.hasOwnProperty("expires_at")) {
      configs['cache'] = { "installation": tokenResponse };
      fs.writeFileSync("./package.json", JSON.stringify(configs, null, 2));
      console.log(tokenResponse.token);
    }
  })
}
