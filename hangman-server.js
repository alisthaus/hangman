var http = require('http');
var querystring = require('querystring');
// var formidable = require("formidable");
var util = require('util');
var fs = require('fs');
var url = require('url');

var UseNewID;						// flag to determine if we have allocated a new ID
var ContextID;						// context id  
var ConetxtIDList = new Array();	// list of contexts
var MaxLives = 6;					// standard hangman limit of attempts (head, body, 2 arms, 2 legs)
var GlobalID = 0;

var WordList = ["rabbit", "cat", "dog", "cow", "deer", "poodle", "hat", "javascript"];
var AvailableLetters = "abcdefghijklmnopqrstuvwxyz";

// logging levels
var DEBUG="DEBUG";
var INFO="INFO";
var ERROR="ERROR";

// var logLevel = DEBUG + "," + INFO;
var logLevel = "";

fs.readFile('./hangman.html', function (err, html)
{
	if (err) 
	{
		throw err; 
	}

    http.createServer(function handler(request, response) 
    {
    
	    processPage(request, response, html, function() 
	    {
	    	var letter_guessed = "";
	    	UseNewID = false;
	    	if(request.post.undo === "undo")	// undo button pressed
	    	{
	    		ContextID = ConetxtIDList[ContextID].prev_ContextID;
	    			
	    	}
	    	else	
	    	{
		    	log(DEBUG, "letter guessed= " + request.post.letter);
		    	letter_guessed = request.post.letter.toLowerCase();
		    	
				var ctx;	// context
				// if no id or bogus id, start a new ctx
				
				if(letter_guessed.length > 0 && AvailableLetters.indexOf(letter_guessed >= 0) 	||
						request.post.newgame === "newgame") 	// letter entered is valid alpha or newgame request
				{
	
					if(typeof(ContextID) === "undefined" 	||		// default behavior going to the URL 
							  ContextID >= GlobalID	    ||		// user manually modified param to invalid value
							  ContextID < 0				||		// user manually modified id to negative number
							  isNaN(ContextID)				||		// user manually modified id to non numeric
							  request.post.newgame === "newgame")					
					{
					
						ConetxtIDList.push(GlobalID);
						ConetxtIDList[GlobalID] = new Object();
						
						ctx = new Object();
						
						if(ContextID < GlobalID)
						{
							ctx.prev_ContextID = ContextID;
						}
						else
						{
							ctx.prev_ContextID = -1;
						}
						ContextID = GlobalID;
						ctx.guesses = 0;	
						ctx.letters_guessed = letter_guessed;
						if(request.post.newgame === "newgame")
						{
							ctx.current_word = WordList[Math.floor(Math.random() * WordList.length)]; // pick a word at random from the list
						}
						else
						{
							ctx.current_word = WordList[0];	// new sessions always start with rabbit which is the first word in the hangman dictionary for this game
						}
						if(ctx.current_word.indexOf(letter_guessed) < 0) // letter not in word
						{	
							ctx.guesses = 1;
						}	
						Object.assign(ConetxtIDList[GlobalID], ctx);
						UseNewID = true;	// redirect to new URL
						GlobalID++;
						
					}
					
					else
					{
						ctx = ConetxtIDList[ContextID];
						
						if(letter_guessed.length > 0 &&
						   AvailableLetters.indexOf(letter_guessed >= 0) &&	// letter entered is valid alpha
						   ctx.letters_guessed.indexOf(letter_guessed) < 0)	// this letter was not already guessed
						{
							ConetxtIDList.push(GlobalID);
							ConetxtIDList[GlobalID] = new Object();
							ConetxtIDList[GlobalID].prev_ContextID = ContextID;
							ConetxtIDList[GlobalID].guesses = ctx.guesses;					
							ConetxtIDList[GlobalID].letters_guessed = ctx.letters_guessed+letter_guessed;	
							ConetxtIDList[GlobalID].current_word = ctx.current_word;
							
							if(ConetxtIDList[GlobalID].current_word.indexOf(letter_guessed) < 0) // letter not in word
							{	
								ConetxtIDList[GlobalID].guesses++;
							}	
							UseNewID = true;	// redirect to new URL
							GlobalID++;
						}
					}
					log(DEBUG, "Printing ctx ID# " + ContextID);
					log(DEBUG, ConetxtIDList[ContextID]);
				
					log(DEBUG, "id = " + Number(GlobalID-1));
					log(DEBUG, ConetxtIDList[GlobalID-1]);
				}
		}		
		
		var redirect_url;
	    if(UseNewID) 
	    {
	    	redirect_url = "http://" + request.headers.host + "?id=" + Number(GlobalID-1);
	    }
	    else if(ContextID >= 0)
	    {
	    	redirect_url = "http://" + request.headers.host + "?id=" + ContextID;
	    }
	    else
	    {
	    	redirect_url = "http://" + request.headers.host;
	    }
	    log(DEBUG, redirect_url);
	    	
	    response.writeHead(301,
			  {Location: redirect_url}
			);
	    response.end();
	    
	    
	    });
    
    
    }).listen(8081, 'localhost');
    log("INFO", 'Hangman running at http://localhost:8081/');

});

function processPage(request, response, html, callback) {
    var queryData = "";
    var url_parts;
    
    if(typeof callback !== 'function') {
    	log(ERROR, "process page called with invalid callback function");
    	return null;
    }

    log(DEBUG, "processPage: " + request.method);
    
    url_parts = querystring.parse(request.url.replace(/^.*\?/, ''));
	ContextID = url_parts.id;

	log(DEBUG, url_parts);
	log(DEBUG, "ContextID= " + ContextID);
	
	
    if(request.method === 'POST') {
        request.on('data', function(data) {
        	log(DEBUG, "processPage: data= " + data);
            queryData += data;
        });

        request.on('end', function() {
            request.post = querystring.parse(queryData);
            callback();
        });

    } 
    else 
    {
       	var lives_remaining = MaxLives;
    	var letters_guessed = "";
    	var len;
    	var letter_str = "";
    	var solved = true;
    	
    	if(ContextID >= 0 && ContextID < GlobalID)	// valid game
    	{
    		lives_remaining = MaxLives - ConetxtIDList[ContextID].guesses;
    		letters_guessed = ConetxtIDList[ContextID].letters_guessed;
    		current_word 	= ConetxtIDList[ContextID].current_word;
    		
    		len = current_word.length;
    		
    		for(var i=0; i<len; i++)
    		{
    			for(var j=0; j<letters_guessed.length; j++)
    			{
    				if(current_word[i] === letters_guessed[j])
    				{
    					letter_str += letters_guessed[j];
    					break;
    				}
    			}
    			if(j == letters_guessed.length)
    			{
    				letter_str += '_';
    				solved = false;
    			}
    		}
    	}
    	else
    	{
    		lives_remaining = MaxLives;
    		letters_guessed = "";
    		current_word = WordList[0];	// new sessions always start with rabbit which is the first word in the hangman dictionary for this game
			    		
    		len = current_word.length;
    		for(var i=0; i<len; i++)
    		{
				letter_str += '_';
				solved = false;
			}	
    		
    	}
    	var html_str = String(html);
    	var message_str = "";
    	var guess_disabled_str = "";	// disables the guess button
    	var undo_disabled_str = "";		// disabled the undo button
    	
    	if(solved)
		{
			message_str = "You solved the puzzle!"
			
		}
    	if(solved || lives_remaining === 0)
    	{
    		guess_disabled_str = "disabled";
    	}
    	
    	if(lives_remaining === 0)
    	{
    		message_str = "Sorry, but you lost.  The word was: " + current_word;
    	}
    	
    	if(typeof(ContextID) === "undefined")
    	{
    		undo_disabled_str = "disabled";
    	}
    	
        	
    	log(DEBUG, letter_str);
    	html_str = html_str.replace("{{LETTERS}}", 			letter_str);
    	html_str = html_str.replace("{{LIVES}}", 			lives_remaining);
    	html_str = html_str.replace("{{MESSAGE}}", 			message_str);
    	html_str = html_str.replace("{{GUESS-DISABLED}}", 	guess_disabled_str);
    	html_str = html_str.replace("{{UNDO-DISABLED}}", 	undo_disabled_str);
    	if(letters_guessed.length > 0)
    	{
    		html_str = html_str.replace("{{LETTERS_GUESSED}}", 	"So far you have guessed the letters: " + letters_guessed);
    	}
    	else
    	{
    		html_str = html_str.replace("{{LETTERS_GUESSED}}", 	"");
    	}
    	response.writeHead(200, {'Content-Type': 'text/html'});
    	response.write(html_str); 
    	response.end();
    }
}

function log(type, msg)
{
	if(logLevel.indexOf(type) >= 0 || type == ERROR)
	{
		console.log(msg);
	}
	if(type == ERROR)
	{
		var stack = new Error().stack
		console.log( stack )
	}
}
