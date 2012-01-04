var walk = require('walk');
var crypto = require('crypto');
var fs = require('fs');
var musicmetadata = require('musicmetadata');

function Scanner(){

	var self = this;

	// handle should I scan event.
	emitter.on('shouldIScan',function(callbackEvent){
	
		shouldIScan(function(iShouldScan){
		
			emitter.emit(callbackEvent,iShouldScan);
		
		});
	
	});

	// handle scan event.
	emitter.on('scanCollection',function(){
	
		scan();
	
	});

}

/**
 * walkCollection
 * @description Walks a given path and returns an array of files within.
 * @function callback - Function to be called once the directory has been walked.
 * @bool allowAnyFile - Return a list of ALL files within a directory, not just audio formats.
 */
var walkCollection = Scanner.prototype.walkCollection = function(callback, allowAnyFile){
	
	// Make sure there is a path.
	if ( ! settings.collection_path ) throw "walkCollection was called without a path!";
	
	// Make sure there is a callback.
	else if ( typeof callback !== "function" ) throw "walkCollection called without a callback!";

	// Make a walker.
	var walker = walk.walk(settings.collection_path);
	
	// Array for song paths.
	var songs = [];
	
	// Check each file.
	walker.on('file',function checkFile(path,stat,next){
		
		// Check for an audio file.
		if ( allowAnyFile || /\.(mp3|aac|wav|flac|ogg)$/.test(stat.name) ){
			
			// Push the song path to the song array.
			songs.push(path + '/' + stat.name);
		
		}
		
		// Read next file.
		next();
		
	});
	
	// When the walking has finished:
	walker.on('end',function EOF(){
		
		// Execute the callback and pass it the songs array.
		callback(songs);
		
		// Destroy self.
		walker = songs = null;
		
	});
	
}

/**
 * shouldIScan
 * @description Compares the stored collection checksum with a newly generated collection 
 				checksum to determine if the collection has been changed.
 * @string path - the path to the collection.
 * @function callback - function to execute after we've decided. (depending on the collection, it could be a while.)
 */
var shouldIScan = Scanner.prototype.shouldIScan = function(callback){
	
	if ( !callback) throw "Missing callback, fool!";
	
	var self = this;
	
	// we need to walk the collection to get a list of files.
	walkCollection(function(collection){
	
		// join and create a checksum.
		var checksum = crypto.createHash('md5').update(collection.join('')).digest('hex');

		// if the checksum matches the stored checksum, then nothing's changed.
		if ( ! settings.collection_checksum ){
		
			decision = true;
			
			settings.collection_checksum = checksum;
			
			emitter.emit('saveSettings');
			
		}
		
		else var decision = ( settings.collection_checksum === checksum ) ? true : false ;
		
		console.log(decision);
		
		// execute callback.
		callback(decision,collection,checksum);
	
	});
}

/**
 * getMetadata
 * @description Get metadata object for a given path.
 * @string path - File to get the metadata for.
 * @function callback - Function executed when metadata is fetched.
 * @function next (optional) - Called when parsing has finished. (Supports synchronous metadata fetching.)
 */
var getMetadata = Scanner.prototype.getMetadata = function(path, callback, next){
	
	// open the path.
	var readStream = fs.createReadStream(path);
	
	// if there is no handle for the path it probably doesn't exist.
	if ( ! readStream )
	{
		// log the skip.
		console.log("Skipping " + path);
		
		// actually skip.
		if ( next ) next();
	}
	
	// make a new metadata parser.
	var parser = new musicmetadata(readStream);
	
	// when metadata is fetched,
	parser.on('metadata',function(metadata){
		
		// add the path to the metadata.
		metadata.path = path;
		
		// pass it to the callback.
		callback(metadata);
		
	});
	
	// when the parsing is all done:
	parser.on('done',function(err){
		
		// check for errors,
		if ( err ) console.log(err);
		
		// clear the parser,
		parser = null;
		
		// call next, if it exists.
		if (  typeof next == "function" ) next();
		
	});

}

/**
 * getMetadataAll
 * @description Get metadata for an array of files. (Synchronous.)
 * @array paths - Array of paths to get the metadata for.
 * @function callback - Called for each path in the array.
 * @function done (optional) - Called when all metadata has been fetched.
 */
var getMetadataAll = Scanner.prototype.getMetadataAll = function(paths, callback, done){
	
	(function iterate(i){
		
		// if we've run out of paths.
		if ( (paths.length) === i )
		{
			// we're all done.
			if ( typeof done == "function" ) done();
		}
		else
		{
			// get metadata for the present path.
			getMetadata(paths[i],function(metadata){
				
				// pass the metadata object, the file path and the index to the callback.
				callback(metadata,paths[i],i);
				
			},function(){
				
				// once the current path has been handled, move to the next.
				iterate(i + 1);
				
			});
		}
		
	})(0);
	
}

/**
 * difference
 * @description returns two arrays, what's been added and what's been removed.
 * @array a - old list of paths.
 * @array b - new list of paths.
 */
var difference = Scanner.prototype.difference = function(A,B){
	
	var removed = A.filter(function(n) {
		if(B.indexOf(n) == -1)
		{
			return true;
		}
		return false;
	});
	
	var added = B.filter(function(n) {
		if(A.indexOf(n) == -1)
		{
			return true;
		}
		return false;
	});
	
	return [removed,added];
	
}

/**
 * addTrackToCollection
 * @description Add track metadata to the collection. (metadata must include a path.)
 * @array added - Array of files to add.
 * @object db - Database to work with.
 * @function callback - (optional) Called once the track has been added.
 */
var addTracksToCollection = Scanner.prototype.addTracksToCollection = function(add, callback){

	var self = this;

	// there is nothing to add.
	if ( add.length === 0 ) callback();
	
	// there is something to remove.
	else {
		
		// loop through added items.
		(function addLoop(i){
		
		
			// get metadata.
			getMetadata(add[i],function(data){
				
				// update the scanning status object.
				scanning.no = (add.length - i);
				
				// emit an event for the addition.
				socket.emit('addedCollectionItem',scanning.no);
				
				// add album and track one after another.
				db.serialize(function(){
					
					// add the album to the collection.
					db.run("INSERT OR IGNORE INTO album (name,artist,tracks,year,genre) VALUES(?,?,?,?,?)", {
						1: data.album,
						2: data.artist[0],
						3: data.track.of,
						4: data.year,
						5: data.genre[0]
					});
					
					// add the track to the collection.
					db.run("INSERT OR REPLACE INTO track(hash,title,album,trackno,path) VALUES(?,?,?,?,?)",{
						1: crypto.createHash('md5').update(data.title+data.artist[0]+data.album).digest('hex'),
						2: data.title,
						3: data.album,
						4: data.track.no,
						5: data.path
					},function(){
						
						if ( i === 0 ) callback();
						else addLoop(i - 1);
						
					});
						
				});
				
			});
			
		// read tracks back-to-front. for some reason
		// they're walked upside down, this reverses it.
		})(add.length - 1);
		
	}

}

/**
 * removeTracksFromCollection
 * @description Remove tracks from the collection.
 * @array remove - array of tracks to remove. (path property.)
 * @object db - Database to remove tracks from.
 * @function callback - (optional) executed when the operation is completed.
 */
var removeTracksFromCollection = Scanner.prototype.removeTracksFromCollection = function(remove,callback){
	
	// there is nothing to remove.
	if ( remove.length === 0 && typeof callback === 'function' ) callback();
	
	// there is something to remove.
	else{
	
		// loop the tracks to remove.
		(function removeLoop(i){
		
			if ( i === remove.length ){
			
				if ( typeof callback === 'function' ) callback();
			
			}
			else{
			
				db.get('DELETE FROM track WHERE path = ?',{ 1 : remove[i] },function(){
				
					removeLoop(i + 1);
				
				});
			}
		
		})(0);
	}

}

/**
 * scan
 * @description Scans a directory for audio files and adds each file's metadata to the database.
 */
var scan = Scanner.prototype.scan = function(){

	var self = this;

	// check if the collection has changed.
	shouldIScan(function(iShouldScan,collection,checksum){

		if ( iShouldScan ){
			
			// array to contain the current collection in the database.
			var collectionFromDB = [];
			
			// get each path from the collection.
			db.each('SELECT path FROM tracks',function(err,row){
				
				// add the path to the array.
				if ( !err ) collectionFromDB.push(row.path);
				
			},function(){
			
				// get the difference between the actual collection and the database collection.
				var diff = difference(collectionFromDB,collection);

				// remove deleted tracks from the collection.
				removeTracksFromCollection(diff[0],function(){
				
					console.log("Removed " + diff[0].length + " tracks from the collection.");
				
					// create an object to monitor the scanning process.
					scanning = {
						no : 0,
						of : diff[1].length
					}
				
					// add new tracks to the collection.
					addTracksToCollection(diff[1],function(){
					
						console.log("Added " + diff[1].length + " tracks to the collection.");
					
						// update the checksum.
						db.get('INSERT OR REPLACE INTO settings (id,setting) VALUES ("collection_checksum",?)',{1:checksum});
						
						// update cached checksum.
						settings.collection_checksum = checksum;
						
						// default scanning status.
						scanning = self.scanning = null;
						
					});
				
				});

			});
		
		}
	});
}


module.exports = Scanner;