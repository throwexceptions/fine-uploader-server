module.exports = function cors() {
    var CORS = require('connect-xcors'),
        options = {
            origins: []                       // implicit same as ['*'], and null
          , methods: ['HEAD', 'GET', 'POST']  // OPTIONS is always allowed
          , headers: [                        // both `Exposed` and `Allowed` headers
                'X-Requested-With'
              , 'X-HTTP-Method-Override'
              , 'Content-Type'
              , 'Accept'
              , 'Cache-Control'
            ]
          , credentials: false                // don't allow Credentials
          , resources: [
              {
                  pattern: '/'                // a string prefix or RegExp
              //, origins
              //, methods
              //, headers
              //, credentials
              }
            ]
        };
    return CORS(options);
}

