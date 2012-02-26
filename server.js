/**
 * Server
 * @description Socket.io server.
 */
function Server(){

	var http = require('http');

	// make an HTTP server.
	var httpServer = http.createServer().listen(settings.get('port'));

	// make a socket.io instance and listen on the default port.
	var io = require('socket.io').listen(httpServer);
	
	// socket.io configuration.
	io.enable('browser client minification');
	io.enable('browser client gzip');
	io.set('log level', 1);
	io.set('transports', ['websocket','flashsocket','jsonp-polling']);
	
	// socket.io API methods.
	io.sockets.on('connection',function(socket){
	
		/**
		 * getArtists
		 * @description Returns an array of artist objects.
		 * @param callback - function to be sent the result.
		 */
		socket.on('getArtists',function(callback,more){
		
			event.emit('queryCollection','SELECT name, id, album_count FROM artist WHERE name != "" ORDER BY name COLLATE NOCASE',function(err,res){
				
				if ( err ) throw err;
				
				else{
				
					callback(res);
				
				}
			});
		});
	
		/**
		 * getAlbums
		 * @description Lists all albums in the collection.
		 * @param callback - function to be sent the result.
		 */
		socket.on('getAlbums',function(callback){
		
			event.emit('queryCollection','SELECT title, id, track_count FROM album WHERE title != "" ORDER BY title COLLATE NOCASE'),function(err,res){
			
				if ( err ) throw err;
			
				callback(res);
			
			};
		
		});
		
		/**
		 * getTracks
		 * @description Lists all tracks in the collection.
		 * @param callback - (function) called when the data has been fetched.
		 */
		socket.on('getTracks',function(callback){
		
			event.emit('queryCollection','SELECT title, id, duration, track_no FROM track WHERE title != ""',function(err,res){
			
				if ( err ) throw err;
				
				callback(res);
			
			});
		
		});
		
		/**
		 * getGenres
		 * @description Lists all genres in the collection.
		 * @param callback - function to be sent the result.
		 */
		socket.on('getGenres',function(callback){
		
			event.emit('queryCollection','SELECT DISTINCT genre FROM album WHERE genre != "" COLLATE NOCASE'),function(err,res){
			
				if ( err ) throw err;
			
				callback(res);
			
			};
		
		});
		
		/**
		 * getArtistAlbums
		 * @description Lists the albums belonging to a given artist.
		 * @param artist_id - the id of the artist to list albums for.
		 * @param callback - function to be sent the result.
		 */
		socket.on('getArtistAlbums',function(artist_id,callback){
		
			event.emit('queryCollection','SELECT title, id, track_of, track_count FROM album WHERE artist_id = "' + artist_id + '"',function(err,res){
			
				if ( err ) throw err;
			
				callback(res);
			
			});
		
		});
		 
		/**
		 * getAlbumTracks
		 * @description Lists the tracks belonging to a given album.
		 * @param album_id - the id of the album to list tracks for.
		 * @param callback - function to be sent the result.
		 */
		socket.on('getAlbumTracks',function(album_id,callback){
		
			event.emit('queryCollection','SELECT title, id, track_no, duration, bitrate, sample_rate FROM track WHERE album_id = "' + album_id + '"',function(err,res){
			
				if ( err ) throw err;
			
				callback(res);
			
			});
		
		});
		 
		/**
		 * getArtistTracks
		 * @description Lists all tracks belonging to a given artist.
		 * @param artist_id - the id of the artist to list albums for.
		 * @param callback - function to be sent the result.
		 */
		socket.on('getArtistTracks',function(artist_id,callback){
		
			event.emit('queryCollection','SELECT title,id FROM track WHERE artist_id = "' + artist_id + '"',function(err,res){
			
				if ( err ) throw err;
				
				callback(res);
			
			});
		
		});
		
		/**
		 * setRating
		 * @description set a rating for a track.
		 * @param track_id (string) - ID for the track we're setting the rating for.
		 * @param rating (int) - The rating of the track. (0-5)
		 * @param callback (function) - called once the operation is complete. (Returns true or false for success status.)
		 */
		socket.on('setRating',function(track_id,rating){
		
			if ( track_id && rating )
			{
				event.emit('queryCollection','UPDATE track SET rating=' + parseInt(rating) + ' WHERE id = "' + track_id + '"',function(err){
				
					if ( err ){
						callback(err);
						throw err;
					}
					else {
						callback(true);
					}
				
				});
				
			}
		});
		
		/**
		 * getAlbumArtURI
		 * @description Returns an array of URIs to album art. (small, medium, large.)
		 * @param artist - (string) Artist name.
		 * @param album - (string) Album name.
		 * @param callback - function to be sent the result.
		 */
		socket.on('getAlbumArtURI',function(artist,album,callback){
	
			var request = require('request');
			
			var api_key = "6d97a6df16c5510dcd504956a0c6edb0";
			
			var uri = "http://ws.audioscrobbler.com/2.0/?format=json";
			
			var query = uri + "&api_key=" + api_key + "&method=album.getinfo&artist=" + encodeURIComponent(artist) + "&album=" + encodeURIComponent(album);
			
			request({uri: query },function(err,res,body){
			
				if ( ! err && res.statusCode == 200){
				
					var results = JSON.parse(body);
					
					if ( ! results.album )
					{
						callback("No Results with " + query);
						
					}
					else {
					
						callback(results.album.image,results.album.url);
					
					}
				
				}
			
			});
		
		});
		
		/**
		 * getArtistImageURI
		 * @description Returns an array of URIs for Artist images.
		 * @param artist - (string) Artist name.
		 * @param callback - (function) Callback function.
		 */
		socket.on('getArtistImageURI',function(artist,callback){
		
			var request = require('request');
			
			var api_key = "6d97a6df16c5510dcd504956a0c6edb0";
			
			var uri = "http://ws.audioscrobbler.com/2.0/?format=json";
			
			var query = uri + "&api_key=" + api_key + "&method=artist.getimages&artist=" + encodeURIComponent(artist);
			
			request({uri: query },function(err,res,body){
			
				if ( ! err && res.statusCode == 200){
				
					var results = JSON.parse(body);
					
					callback(results);
				}
			
			});
		
		});
	
	});
	
	/**
	 * stream
	 * @description Handles stream requests.
	 * @uri_scheme /stream/:track_id
	 */
	httpServer.on('request',function(req,res){
	
		if ( req.url == "/stream" )
		{
			res.end("Use /stream/:track_id");
		}
		
		else if ( /\/stream\/.+/.test(req.url) )
		{
			// get the id of the track.
			var track_id = req.url.match(/\/stream\/(.+)/)[1];
			
			// get the path of the track.
			event.emit('queryCollection','SELECT path FROM track WHERE id = "' + track_id + '"',function(err,result){
			
				// if there was an error fetching then throw it.
				if ( err ) throw err;
				
				// if there was a result..
				else if ( result[0] ){
					
					// decode the path.
					var path = decodeURIComponent(result[0].path);
					
					// require the filesystem module.
					var fs = require('fs');
					
					// tell the client we accept 206.
					res.setHeader("Accept-Ranges", "bytes");
				
					// get the file statistics.
					var stat = fs.stat(path,function(err,stats){
					
						// get the length of the file.
						var total = stats.size;
						
						// if there is no range request.
						if ( ! req.headers.range )
						{
						
							// make this dynamic!
							res.setHeader('Content-Type','audio/mpeg');
						
							// send the full file.
							res.end(fs.readFile(path));
						
						}
						
						// if there is a range request... (the fun begins..)
						else
						{
							// get the range.
							var range = req.headers.range.match(/=(.+)-(.*)/);
							
							// get the range start.
							var start = parseInt(range[1]);
							
							// get the range end.
							var end = parseInt(range[2]) || total - 1;
							
							// calculate the number of bytes to be sent.
							var chunks = (end - start) + 1;
							
							// tell the client we're sending partial content.
							res.statusCode = "206 Partial Content";
							
							// tell the client the range of bytes we're sending.
							res.setHeader("Content-Range","bytes " + start + "-" + end + "/" + total);
							
							// tell the client the number of bytes we're sending.
							res.setHeader("Content-Length", chunks);
							
							// read in the byte range.
							var stream = fs.createReadStream(path,{start: start, end: end});
							
							// when we have data.
							stream.on('data',function(data){
							
								// send it to the client.
								res.write(data);
							
							});
							
							// when we run out of data.
							stream.on('end',function(){
								
								// end our response.
								res.end();
							
							})
							
						}
					});
					
				}
				
				// if there was no result, the track_id is invalid.
				else {
				
					res.end("Invalid track_id.");
				
				}
			
			});
		}
	
	});
	
}

module.exports = Server;