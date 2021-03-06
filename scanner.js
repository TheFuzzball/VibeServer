var fs = require('fs');
var crypto = require('crypto');
var match = require('match-files');
var async = require('async');

/**
 * Scanner
 * @description Scans the collection.
 */
function Scanner(callback){

	// public stats.
	this.scanning = {
		"state" : "NO_SCAN",
		"items" : {
			"del" : {
				"no" : 0,
				"of" : 0
			},
			"add" : {
				"no" : 0,
				"of" : 0
			}
		}
	}

	// usual nonsense.
	var self = this;

	/**
	 * setState
	 * @description updates the scanner state and alerts when a change happens.
	 * @param state - a new state (string.)
	 * @param no - the index of the item being scanned. (ADDING_TRACK only.)
	 * @param of - the total number of items to be scanned. (ADDING_TRACK only.)
	 * @param path - the path of the item being scanned. (ADDING_TRACK only.)
	 */
	function setState(state,no,of,path){
		
		// set the new state.
		self.scanning.state = state;
		
		// if we're adding a track.
		if ( state == "SCAN_ADD" && no && of && path )
		{
			// log the percent of tracks scanned and the path of the current item being scanned.
			console.log("Adding " + no + ' of ' + of + ' - ' + path);
			
		}
		else if ( state == "SCAN_DEL" && no && of && path )
		{
			console.log("Removing: " + no + " of " + of + " - " + path);
			
		}
		else{
	
			// log the state change.
			console.log("Scanner status changed: " + state + ".");
		}
	}

	/**
	 * flattenArray
	 * @description converts an array of objects with a single property into an array of strings.
	 */
	function flattenArray(A){
	
		// make an array to put the result into.
		var result = [];
	
		// loop through the properties of A.
		for ( var i = 0; i < A.length; i++ )
		{
		
			for ( var j in A[i] )
			{
				result.push(A[i][j]);
			}
		
		}
	
		// return the resulting array.
		return result;
	
	}

	/**
	 * collectionDifference
	 * @description returns the files that have been added or removed from an array.
	 * @param A - the first array
	 * @param B - the second array
	 */
	function collectionDifference(A,B){
	
		// find the files that are not in the second array that are in the first.
		var removed = A.filter(function(item){
		
			// if the current item in A is not in B
			if ( B.indexOf(item) === -1 )
			{
				// add the item to the new array.
				return 1;
			}
			else
			{
				// otherwise do not.
				return 0;
			}
		
		});
		
		// find the files that are in the second array that are not in the first.
		var added = B.filter(function(item){
		
			// if the current item in array B is not in array A
			if ( A.indexOf(item) === -1 )
			{
				// add it to the new array.
				return 1;
			}
			else
			{
				// otherwise do not.
				return 0;
			}
		
		});
	
		// return an array with the two arrays.
		return {
			"removed" : removed,
			"added" : added
		};
	
	}

	/**
	 * LastFM API for finding album art.
	 */
	var getLastFMAlbumArt = function(artist,album,callback){
	
		// MusicMe LastFM API key.
		var api_key = "6d97a6df16c5510dcd504956a0c6edb0";
		
		// LastFM API path.
		var url = "http://ws.audioscrobbler.com/2.0/?format=json";
		
		if ( artist && album )
		{
			artist = encodeURIComponent(artist);
			
			album = encodeURIComponent(album);
		}
		
		else callback();
		
		// get request.
		var request = require('request');
		
		// make a request for the given artist and album.
		request(url + "&api_key=" + api_key + "&method=album.getinfo&artist=" + artist + "&album=" + album,function(err,res,body){
		
			if ( err )
			{
				console.error(err);
				
				callback();
				
			}
			
			else
			{
				var body = JSON.parse(body);
				
				try {
					var result = {
						"small" : body.album.image[0]["#text"],
						"medium" : body.album.image[1]["#text"],
						"large" : body.album.image[2]["#text"],
						"extralarge" : body.album.image[3]["#text"],
						"mega" : body.album.image[4]["#text"]
					}
				}
				catch (ex)
				{
					result = null;
				}
				finally
				{
					callback(result);
				}
				
			}
		
		});
	
		request = null;
	
	}

	function countArtistAlbums(callback){
	
		// get a list of albums.
		event.emit('queryCollection','SELECT id FROM album',function(err,data){
		
			// loop through the albums.
			async.forEachSeries(data,function(album,next){
			
				// find the number of tracks in the current album.
				event.emit('queryCollection','SELECT count(*) AS count FROM track WHERE album_id = "' + album.id + '"',function(err,data){
				
					// parse the result into an integer.
					var tracks = parseInt(data[0]["count"]);
				
					// if there are no tracks for the album.
					if ( tracks === 0 )
					{
						// delete the album.
						event.emit('queryCollection','DELETE FROM album WHERE id = "' + album.id + '"',function(err){
						
							if ( err ) console.error(err);
						
							process.nextTick(next);
						
						});
						
					}
					else {
					
						// update the collection attribute.
						event.emit('queryCollection','UPDATE album SET tracks = ' + tracks + ' WHERE id = "' + album.id + '"',function(err){
						
							if ( err ) console.error(err);
						
							process.nextTick(next);
						
						});
						
					}
				
				});
			
			},callback);
		
		});
	
	}

	function countAlbumTracks(callback){
	
		// get a list of artists.
		event.emit('queryCollection','SELECT id FROM artist',function(err,data){
		
			// loop through the artists.
			async.forEachSeries(data,function(artist,next){
			
				// find the number of albums belonging to this artist.
				event.emit('queryCollection','SELECT count(*) AS count FROM album WHERE artist_id = "' + artist.id + '"',function(err,data){
				
					var albums = parseInt(data[0]["count"]);
				
					if ( albums == 0 )
					{
						event.emit('queryCollection','DELETE FROM artist WHERE id = "' + artist.id + '"',function(err){
						
							if ( err ) console.error(err);
							
							process.nextTick(next);
							
						});
					}
					else
					{
						event.emit('queryCollection','UPDATE artist SET albums = ' + albums + ' WHERE id = "' + artist.id + '"',function(err){
						
							if ( err ) console.error(err);
						
							process.nextTick(next);
						
						});
					}
				
				});
			
			},function(){
			
				if ( callback ) callback();
			
			});
			
		});
	
	}

	function fetchAlbumArt(callback){
	
		// get a list of albums.
		event.emit('queryCollection','SELECT album.id, artist.name AS artist, album.name AS album FROM artist INNER JOIN album ON album.artist_id = artist.id',function(err,res){
		
			if ( err )
			{
				throw err;
			}
			else
			{
			
				// loop through the albums in order.
				async.forEachSeries(res,function(item,next){
				
					if ( ! item )
					{
						// skip to next album.
						process.nextTick(next);
					}
					else
					{
						// get the album art urls.
						getLastFMAlbumArt(item.artist,item.album,function(art){
						
							// if there is art for this album then update the database with it.
							if ( art ) event.emit('updateCollection','UPDATE album SET art_small = ?, art_medium = ?, art_large = ? WHERE id = ?',[
								art.small,
								art.medium,
								art.large,
								item.id
							]);
						
							// do the same for the next album.
							process.nextTick(next);
						
						});
					}
				
				},function(){
				
					// when we're done getting the album art, check for a callback.
					if ( callback )
					{
						
						// run it there is one.
						callback();
						
					}
				
				});
				
			}
		
		});
	}

	/**
	 * scan
	 * @description Scans the collection path.
	 * @param callback - executed when scanning has completed. (function)
	 */
	this.scan = function(callback){
	
		// function to match MP3 files.
		function matchMP3(path){ return path.match(/\.mp3$/) }
	
		// set state.
		setState("SCAN_WALK");
	
		// walk the collection.
		match.find(settings.get('collection_path'),{ fileFilters : [matchMP3] },function(err, paths){
		
			// calculate the checksum of the current collection.
			var checksum = crypto.createHash('md5').update(paths.join('')).digest("hex");
		
			// compare the current checksum to the checksum of the last scanned collection.
			if ( checksum == settings.get('collection_checksum') )
			{
				// set scanner state to no-scan.
				setState("NO_SCAN");
			}
			else
			{
				
				// set scanner state to scanning difference.
				setState("SCAN_DIFF");
				
				// get the last scanned collection paths.
				event.emit('queryCollection','SELECT path FROM track',function(err,previous_collection){
				
					// get the differences between the previous and current collections.
					var diff = collectionDifference(flattenArray(previous_collection),paths);
				
					// update scanning stats.
					self.scanning.items.del.of = diff.removed.length;
					self.scanning.items.add.of = diff.added.length;
					
					setState("SCAN_ADD");
					
					// add tracks to the collection.
					async.forEachSeries(diff.added,function(song,next){
					
						event.emit('addTrackToCollection',song,function(){
						
							// update the scanning index.
							self.scanning.items.add.no++;
							
							// update the scanning state.
							setState("SCAN_ADD",self.scanning.items.add.no,self.scanning.items.add.of,song);
						
							process.nextTick(next);
						
						});
					
					},function(){
					
						settings.set('collection_checksum',checksum);
					
						// set adding stats to zero.
						self.scanning.items.add.of = self.scanning.items.add.no = 0;
						
						if ( self.scanning.items.del.of !== 0 )
						{
							setState("SCAN_DEL");
						}
						
						async.forEachSeries(diff.removed,function(song,next){
						
							event.emit('removeTrackFromCollection',song,function(){
							
								// update the scanning index.
								self.scanning.items.del.no++;
								
								// update scanning state.
								setState("SCAN_DEL",self.scanning.items.del.no,self.scanning.items.del.of,song);
							
							});
						
						},function(){
						
							// set deleting stats to zero.
							self.scanning.items.del.of = self.scanning.items.del.no = 0;
						
							// get the current epoch.
							var epoch = new Date().getTime();
							
							// get the previous epoch.
							var last_epoch = settings.get("postscan_epoch");
							
							// check if it's been more than a week since the last post scan.
							if ( ! last_epoch || (last_epoch + (1000 * 60 * 24 * 7)) < epoch )
							{
								// if it's been more than a week then run the scan.
								self.postScan(function(){
								
									// finished post scan.
									setState("NO_SCAN");
								
								});
								
								settings.set("postscan_epoch",epoch);
								
							}
							else
							{
								setState("NO_SCAN");
							}
						
						});
					
					});
				
				});
				
			}
		
		});
		
	}
	
	/**
	 * postScan
	 * @description updates collection metadata after adding tracks. Sets number of children for artists and albums, and gets albumart.
	 * @param callback - (function) Called once postAdd has finished.
	 */
	this.postScan = function(callback){
	
		// set new state.
		setState("POST_SCAN");
	
		countAlbumTracks(function(){
		
			countArtistAlbums(function(){
			
				// set new state.
				setState("FETCH_ART");
				
				fetchAlbumArt(function(){
				
					// set final state.
					setState("NO_SCAN");
				
				});
			
			});
		
		});
		
	}
	
	// run the callback within the scanner scope after init.
	if ( callback ) callback.call(this);
	
}

// Export the scanner class.
module.exports = Scanner;