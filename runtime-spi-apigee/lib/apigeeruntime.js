/*
 * This module implements the runtime SPI by talking to a proxy that is hosted inside Apigee.
 *
 * options:
 *   uri: The URI that your Apigee DNA Adapter is deployed to Apigee
 *   key: The API key for your adapter
 */

var url = require('url');
var path = require('path');
var http = require('http');
var https = require('https');
var querystring = require('querystring');

var spi = function(options) {
  if (!options.uri) {
    throw new Error('uri parameter must be specified');
  }
  if (!options.key) {
    throw new Error('key parameter must be specified');
  }

  this.uri = options.uri;
  this.key = options.key;
};
module.exports = spi;

/*
 * Generate an access token using client_credentials. Parameters:
 *   clientId: required
 *   clientSecret: required
 *   scope: optional
 *   tokenLifetime: lifetime in milliseconds, optional
 *
 * Returns an object with all the fields in the standard OAuth 2.0 response.
 */
spi.prototype.createTokenClientCredentials = function(options, cb) {
  var qs = {
    grant_type: 'client_credentials'
  };
  if (options.scope) {
    qs.scope = options.scope;
  }
  var body = querystring.stringify(qs);
  options.grantType = 'client_credentials';
  makeRequest(this, 'POST', '/tokentypes/client/tokens',
    body, options, function(err, result) {
      cb(err, result);
    });
};

/*
 * Generate an access token using password credentials. Parameters:
 *   clientId: required
 *   clientSecret: required
 *   scope: optional
 *   tokenLifetime: lifetime in milliseconds, optional
 *   username: required but not checked (must be checked outside this module)
 *   password: required by not checked (must be checked outside this module)
 *
 * Returns an object with all the fields in the standard OAuth 2.0 response.
 */
spi.prototype.createTokenPasswordCredentials = function(options, cb) {
  var qs = {
    grant_type: 'password',
    username: options.username,
    password: options.password
  };
  if (options.scope) {
    qs.scope = options.scope;
  }
  var body = querystring.stringify(qs);
  options.grantType = 'password';
  makeRequest(this, 'POST', '/tokentypes/password/tokens',
    body, options, function(err, result) {
      cb(err, result);
    });
};

/*
 * Generate an access token for authorization code once a code has been set up. Parameters:
 *   clientId: required
 *   clientSecret: required
 *   code: Authorization code already generated by the "generateAuthorizationCode" method
 *   redirectUri: The same redirect URI that was set in the call to generate the authorization code
 *   tokenLifetime: lifetime in milliseconds, optional
 *
 * Returns an object with all the fields in the standard OAuth 2.0 response.
 */
spi.prototype.createTokenAuthorizationCode = function(options, cb) {
  var qs = {
    grant_type: 'authorization_code',
    code: options.code
  };
  if (options.redirectUri) {
    qs.redirect_uri = options.redirectUri;
  }
  if (options.clientId) {
    qs.client_id = options.clientId;
  }
  var body = querystring.stringify(qs);
  options.grantType = 'authorization_code';
  makeRequest(this, 'POST', '/tokentypes/authcode/tokens',
    body, options, function(err, result) {
      cb(err, result);
    });
};

/*
 * Generate a redirect response for the authorization_code grant type. Parameters:
 *   clientId: required
 *   redirectUri: required and must match what was deployed along with the app
 *   scope: optional
 *   state: optional but certainly recommended
 *
 * Returns the redirect URI as a string.
 */
spi.prototype.generateAuthorizationCode = function(options, cb) {
  var qs = {
    response_type: 'code',
    client_id: options.clientId
  };
  if (options.redirectUri) {
    qs.redirect_uri = options.redirectUri
  }
  if (options.scope) {
    qs.scope = options.scope;
  }
  if (options.state) {
    qs.state = options.state;
  }

  makeGetRequest(this, '/tokentypes/authcode/authcodes', querystring.stringify(qs),
                 options, function(err, result) {
    cb(err, result);
  });
};

/*
 * Generate a redirect response for the implicit grant type. Parameters:
 *   clientId: required
 *   redirectUri: required and must match what was deployed along with the app
 *   scope: optional
 *   state: optional but certainly recommended
 *
 * Returns the redirect URI as a string.
 */
spi.prototype.createTokenImplicitGrant = function(options, cb) {
  var qs = {
    response_type: 'token',
    client_id: options.clientId
  };
  if (options.redirectUri) {
    qs.redirect_uri = options.redirectUri
  }
  if (options.scope) {
    qs.scope = options.scope;
  }
  if (options.state) {
    qs.state = options.state;
  }

  makeGetRequest(this, '/tokentypes/implicit/tokens', querystring.stringify(qs),
                 options, function(err, result) {
    cb(err, result);
  });
};

/*
 * Refresh an existing access token, and return a new token. Parameters:
 *   clientId: required
 *   clientSecret: required
 *   refreshToken: required, from the original token grant
 *   scope: optional
 */
spi.prototype.refreshToken = function(options, cb) {
  var qs = {
    grant_type: 'refresh_token',
    refresh_token: options.refreshToken
  };
  if (options.scope) {
    qs.scope = options.scope;
  }
  var body = querystring.stringify(qs);
  options.grantType = 'refresh_token';
  makeRequest(this, 'POST', '/tokentypes/all/refresh',
    body, options, function(err, result) {
      cb(err, result);
    });
};

/*
 * Invalidate an existing token. Parameters:
 *   clientId: required
 *   clientSecret: required
 *   refreshToken: either this or accessToken must be specified
 *   accessToken: same
 */
spi.prototype.invalidateToken = function(options, cb) {
  var qs = {};
  if (options.refreshToken) {
    qs.token = options.refreshToken;
    qs.token_type_hint = 'refresh_token';
  } else {
    qs.token = options.accessToken;
    qs.token_type_hint = 'access_token';
  }
  var body = querystring.stringify(qs);

  makeRequest(this, 'POST', '/tokentypes/all/invalidate',
    body, options, function(err, result) {
      cb(err, result);
    });
};

function makeRequest(self, verb, uriPath, body, options, cb) {
  if (typeof o === 'function') {
    cb = o;
    o = undefined;
  }

  var finalUri = self.uri + uriPath;
  console.log('%s %s', verb, finalUri);

  var r = url.parse(finalUri);
  r.headers = {
    Authorization: new Buffer(options.clientId + ':' + options.clientSecret).toString('base64')
  };
  r.headers['x-DNA-Api-Key'] = self.key;
  if (options.tokenLifetime) {
    r.headers['x-DNA-Token-Lifetime'] = options.tokenLifetime;
  }
  r.method = verb;
  if (body) {
    r.headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }
  //console.log('%j', r);

  var req;
  if (r.protocol === 'http:') {
    req = http.request(r, function(resp) {
      requestComplete(resp, options, cb);
    });
  } else if (r.protocol === 'https:') {
    req = https.request(r, function(resp) {
      requestComplete(resp, options, cb);
    });
  } else {
    cb(new Error('Unsupported protocol ' + r.protocol));
    return;
  }

  req.on('error', function(err) {
    cb(err);
  });
  if (body) {
    //console.log('%j', o);
    req.end(body);
  } else {
    req.end();
  }
}

function makeGetRequest(self, uriPath, qs, options, cb) {
  var finalUri = self.uri + uriPath + '?' + qs;
  console.log('%s %s', 'GET', finalUri);

  var r = url.parse(finalUri);
  r.headers = {};
  r.headers['x-DNA-Api-Key'] = self.key;
  r.method = 'GET';

  var req;
  if (r.protocol === 'http:') {
    req = http.request(r, function(resp) {
      getRequestComplete(resp, options, cb);
    });
  } else if (r.protocol === 'https:') {
    req = https.request(r, function(resp) {
      getRequestComplete(resp, options, cb);
    });
  } else {
    cb(new Error('Unsupported protocol ' + r.protocol));
    return;
  }

  req.on('error', function(err) {
    cb(err);
  });
  req.end();
}

function readResponse(resp, data) {
  var d;
  do {
    d = resp.read();
    if (d) {
      data += d;
    }
  } while (d);
  return data;
}

function requestComplete(resp, options, cb) {
  resp.on('error', function(err) {
    cb(err);
  });

  var respData = '';
  resp.on('readable', function() {
    respData = readResponse(resp, respData);
  });

  resp.on('end', function() {
    if (resp.statusCode >= 300) {
      var err = new Error('Error on HTTP request');
      err.statusCode = resp.statusCode;
      err.message = respData;
      cb(err);
    } else {
      try {
        var sr = JSON.parse(respData);
        var ret = {
          access_token: sr.access_token,
          refresh_token: sr.refresh_token,
          // TODO this should be returned by Apigee!
          token_type: options.grantType,
          scope: sr.scope,
          expires_in: parseInt(sr.expires_in)
        };
        cb(undefined, ret);
      } catch (SyntaxError) {
        // The response might not be JSON -- not everything returns it
        cb();
      }
    }
  });
}

function getRequestComplete(resp, options, cb) {
  resp.on('error', function(err) {
    cb(err);
  });

  var respData = '';
  resp.on('readable', function() {
    respData = readResponse(resp, respData);
  });

  resp.on('end', function() {
    if (resp.statusCode != 302) {
      var err = new Error('Error on HTTP request');
      err.statusCode = resp.statusCode;
      err.message = respData;
      cb(err);
    } else {
      cb(undefined, resp.headers.location);
    }
  });
}