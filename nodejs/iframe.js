module.exports = function xdomain(settings) {

    return function (request, response, next) {
        !request.xhr ? response.set('Content-Type', 'text/html') : response.set('Content-Type', 'text/plain');
        // non CORS spec compliant CORS check
        // @TODO(feltnerm): Don't do this.
        if (request.host !== settings.nodeHostname ||
            request.port !== settings.nodePort && !request.xhr) {
            request.xdomain = true;
        }
        next();
    }
}

