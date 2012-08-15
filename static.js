var fs = require('fs');
var url = require('url');
var crypto = require('crypto');

var MIME_TYPES = [
	[/\.html$/, 'text/html'],
	[/\.js$/, 'text/javascript'],
	[/\.css$/, 'text/css'],
	[/\.txt$/, 'text/plain'],
	
	[/\.jpg$/, 'image/jpeg'],
	[/\.png$/, 'image/png'],
	[/\.gif$/, 'image/gif'],
	
	[/\.ogg$/, 'application/ogg'],
	[/\.ogv$/, 'video/ogg'],
	[/\.oga$/, 'audio/ogg'],
	[/\.mp3$/, 'audio/mp3'],
	[/\.wav$/, 'audio/wav'],
	
	[/\.jar$/, 'application/java-archive']
];

module.exports = function(servePath) {
	var cache = {};
	
	return function(req, res, next) {
		// TODO: Use the path module later
		var path = url.parse(req.url).pathname;
		while(path.indexOf('..') != -1) {
			path = path.replace('..', '.', 'g');
		}
		path = path.substr(1);
		if(path.indexOf(servePath) != 0) return next();
		
		fs.exists(path, function(exists) {
			if(!exists) {
				res.writeHead(404);
				res.end();
				return;
			}
			
			if(req.headers['if-modified-since'] || req.headers['if-none-match']) {
				res.writeHead(304);
				res.end();
				return;
			}
			
			var data;
			var headers = {};
			for(var i = 0; i < MIME_TYPES.length; i++) {
				var type = MIME_TYPES[i];
				if(type[0].test(path)) {
					headers['Content-Type'] = type[1];
					break;
				}
			}
			
			var entry = cache[path];
			if(entry == null) {
				var stat = fs.statSync(path);
				entry = {
					length: stat.size
				};
				cache[path] = entry;
			}
			if(entry.etag == null) {
				// Use the lazy method
				entry.etag = crypto.createHash('md5').update(path).digest('hex').substr(0, 16);
			}
			
			headers['Content-Length'] = entry.length;
			headers['ETag'] = entry.etag;
			headers['Cache-Control'] = 'max-age=31536000';
			
			var method = req.method.toUpperCase();
			if(method == 'GET') {
				res.writeHead(200, headers);
				
				var stream = fs.createReadStream(path);
				res.on('close', function() {
					stream.destroy();
				});
				stream.pipe(res);
			} else if(method == 'HEAD') {
				res.writeHead(200, headers);
				res.end();
			} else next();
		});
	}
}