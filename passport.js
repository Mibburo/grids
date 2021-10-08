
// Part 0 GRIDS specific
let claims = {
  userinfo: {
    verified_claims: {
      verification: {
        trust_framework: {
          value: "grids_kyb",
        },
        userinfo_endpoint: {
          value: "https://dp.kompany.com:8060/userinfo",
        },
        evidence: [
          {
            type: {
              value: "company_register",
            },
            registry: {
              organisation: {
                essential: false,
                purpose: "string",
              },
              country: {
                essential: true,
                purpose: "string",
                value: "AT",
              },
            },
            time: {
              max_age: 31000000,
              essential: true,
              purpose: "string",
            },
            data: {
              essential: true,
              purpose: "string",
            },
            extractURL: {
              essential: true,
              purpose: "string",
            },
            document: {
              SKU: {
                essential: false,
                purpose: "string",
              },
              option: {
                essential: false,
                purpose: "string",
              },
            },
          },
        ],
      },
      claims: {
        family_name: null,
        given_name: null,
        birthdate: null,
        legal_name: null,
        legal_person_identifier:  null,
        lei: null,
        vat_registration: null,
        address: null,
        tax_reference: null,
        sic: null,
        business_role: null,
        sub_jurisdiction: null,
        trading_status: null,
      },
    },
  },
  id_token: {
    verified_claims: {
      verification: {
        trust_framework: {
          value: "eidas",
        },
      },
      claims: {
        family_name: null,
        given_name: null,
        birthdate: null,
        person_identifier: null,
        place_of_birth: null,
        address: null,
        gender: null,
      },
    },
  },
};

// Part 1, import dependencies
const express = require("express");
const router = express.Router();
const passport = require("passport");
const { Strategy, discoverAndCreateClient } = require("passport-curity");
const http = require("http");
const https = require("https");
const jose = require('node-jose');
const fs = require("fs");
const Kyb = require("./Kyb");
const repo = require("./repository");
const { JWK, JWE } = require('node-jose')

// Part 2, configure authentication endpoints
router.get("/login", passport.authenticate("curity"));
router.get(
  "/callback",
  passport.authenticate("curity", { failureRedirect: "/login" }),
  (req, res) => {
    res.redirect("/user");
  }
);

// Part 3, create a JWKS
const keyStore = jose.JWK.createKeyStore()
keyStore.generate('RSA', 2048, {alg: 'RSA-OAEP-256', use: 'enc' })
.then(result => {
  fs.writeFileSync(
      'keys.json',
      JSON.stringify(keyStore.toJSON(true), null, '  ')
  )
})

// Part 4, configuration of Passport
const getConfiguredPassport = async () => {

  let _issuer_url = process.env.ISSUER_URL?process.env.ISSUER_URL:"https://vm.project-grids.eu:8180/auth/realms/grids"
  let _client_id = process.env.OIDC_CLIENT_ID?process.env.OIDC_CLIENT_ID:"test"
  let _client_secret = process.env.OIDC_CLIENT_SECRET?process.env.OIDC_CLIENT_SECRET:"5814f193-2ef3-45ee-967c-e4e647d9bc48"
  let _redirect_uri = process.env.OIDC_REDIRECT_URI?process.env.OIDC_REDIRECT_URI:"http://239d-2a02-587-321d-c8d1-506f-8f90-b03c-c88a.ngrok.io/callback"

  // Part 4a, get dynamic registration client id and secret
  const dynamicClient = JSON.parse(await getDynClient());
  const dynClientId = dynamicClient.client_id;
  const dynClientSecret = dynamicClient.client_secret;

  console.log({
    issuerUrl: _issuer_url,
    clientID: dynClientId,
    clientSecret: dynClientSecret,
    redirectUris: [_redirect_uri],
  })

  // Part 4b, discover Curity Server metadata and configure the OIDC client
  const client = await discoverAndCreateClient({
    issuerUrl: _issuer_url,
    clientID: dynClientId,
    clientSecret: dynClientSecret,
    redirectUris: [_redirect_uri],
  });
 
  let _user_info_request = process.env.USER_INFO?process.env.USER_INFO:"vm.project-grids.eu"
  let _user_info_port = process.env.USER_INFO_PORT?process.env.USER_INFO_PORT:"8180"
  // Part 4c, configure the passport strategy
  const strategy = new Strategy(
    {
      client,
      params: {
        scope: "openid profile",
        claims: claims,
      },
      fallbackToUserInfoRequest: true,
    },

    function (accessToken, refreshToken, profile, cb) {
      const options = {
        hostname: _user_info_request,
        port: _user_info_port,
        path: "/auth/realms/grids/protocol/openid-connect/userinfo",
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Length": "0",
        },
      };
      const httpsReq = https.request(options, function (res) {
        const chunks = [];
        res.on("data", function (chunk) {
          chunks.push(chunk);
        });
        res.on("end", function () {
          const body = Buffer.concat(chunks);
          console.log("******* USER INFO **********************");
          console.log(body.toString());
          console.log("******* USER INFO END **********************");
          const resJson = JSON.parse(body.toString());
          sendToken(resJson._claim_sources.src1.access_token, resJson._claim_sources.src1.endpoint);
        });
      });
      httpsReq.end();
      return cb(null, { profile });
    }
  );

  // Part 4d, tell passport to use the strategy
  passport.use(strategy);

  // Part 4e, tell passport how to serialize and deserialize user data
  passport.serializeUser((user, done) => {
    done(null, user);
  });

  passport.deserializeUser((user, done) => {
    done(null, user);
  });

  return passport;
};

// creates a dynamic client for registration
function getDynClient() {
  const data = JSON.stringify({
    "application_type": "web",
    "redirect_uris": [
      "http://239d-2a02-587-321d-c8d1-506f-8f90-b03c-c88a.ngrok.io/callback"
    ],
    "client_name": "GridsUAegean",
    "subject_type": "pairwise",
    "token_endpoint_auth_method": "client_secret_basic",
    "jwks_uri": "http://239d-2a02-587-321d-c8d1-506f-8f90-b03c-c88a.ngrok.io/jwks",
    "userinfo_encrypted_response_alg": "RSA-OAEP-256",
    "userinfo_encrypted_response_enc": "A128CBC-HS256"
  });

  const options = {
    hostname: "vm.project-grids.eu",
    port: 8180,
    path: "/auth/realms/grids/clients-registrations/openid-connect",
    method: 'POST',
    headers: {
      Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICI3NDdiMzRmNy02YmZjLTRhODgtODgxYS0wYjlhNWQ3NjZmOTgifQ.eyJleHAiOjAsImlhdCI6MTYzMzY4MTM4MCwianRpIjoiY2QxZmE0ZjItMTUzYS00NjQyLWE1ZWQtMWExMWRiNjcwM2MwIiwiaXNzIjoiaHR0cHM6Ly92bS5wcm9qZWN0LWdyaWRzLmV1OjgxODAvYXV0aC9yZWFsbXMvZ3JpZHMiLCJhdWQiOiJodHRwczovL3ZtLnByb2plY3QtZ3JpZHMuZXU6ODE4MC9hdXRoL3JlYWxtcy9ncmlkcyIsInR5cCI6IkluaXRpYWxBY2Nlc3NUb2tlbiJ9.w4zYKqdMJggijHJTpMGuVBh1T1FzODCUdEH9XI0YhQs`,
      'Content-Type' : 'application/json',
      'Content-Length' : data.length
    },
  };

  return new Promise ((resolve, reject) => {
    let req = https.request(options);

    req.on('response', res => {
      const chunks = [];
      res.on("data", function (chunk) {
        chunks.push(chunk);
      });
      res.on("end", function () {
        const body = Buffer.concat(chunks);
        resolve(body.toString());
      });
    });

    req.on('error', err => {
      reject(err);
    });
    req.write(data);
    req.end();
  });
}

function sendToken(accessToken, endpoint){

  const epParts = endpoint.split("/");
  const host = epParts[2].split(":")[0];
  const port = epParts[2].split(":")[1];
  const path = "/" + epParts[3];

  const options = {
    hostname: host,
    port: 8050,
    path: path,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
  };

  const req = https.request(options, (res) => {
    console.log('statusCode:', res.statusCode);
    console.log('headers:', res.headers);

    const chunks = [];
    res.on("data", function (chunk) {
      chunks.push(chunk);
    });
    res.on("end", function () {
      const body = Buffer.concat(chunks);
      const payload = body.toString();
      const ks = fs.readFileSync('keys.json')
      jose.JWK.asKeyStore(ks.toString()).then(async keyStore => {
        //decrypt received data
        const decrypted = await JWE.createDecrypt(keyStore).decrypt(payload);
        const body = Buffer.from(decrypted.plaintext);
        const resJson = JSON.parse(body.toString());
        // add decrypted data to database
        repo.addDataToDb(resJson.verified_claims.verified_claims[0].claims);
      });
    });
  });

  req.on('error', (e) => {
    console.error(e);
  });
  req.end();

}

// Part 4, export objects
exports = module.exports;
exports.getConfiguredPassport = getConfiguredPassport;
exports.passportController = router;