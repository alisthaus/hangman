var http = require('http');
var querystring = require('querystring');
var util = require('util');
var fs = require('fs');
var url = require('url');

var UseNewID = false;				// flag to determine if we have allocated a new ID
var ContextID;						// context id  
var ContextIDList = new Array();	// list of contexts
var ContextIDHash = new Array();
var MaxLives = 6;					// standard hangman limit of attempts (head, body, 2 arms, 2 legs)
var GlobalID = 0;
var RandomString;

var WordList = ["RABBIT", "CAT", "DOG", "COW", "DEER", "POODLE", "HAT", "JAVASCRIPT", "NODE", "GIT", "GITHUB", "HEROKU", "ECLIPSE", "NODECLIPSE"];

// logging levels
var DEBUG="DEBUG";
var INFO="INFO";
var ERROR="ERROR";

// var LogLevel = DEBUG + "," + INFO;
var LogLevel = "";

fs.readFile('./hangman.html', function (err, html)
{
	if (err) 
	{
		log(ERROR, "Readfile failed")
		throw err; 
	}

    http.createServer(function handler(request, response) 
    {
	    processPage(request, response, html, function() 
	    {
	    	var available_letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	    	var letter_guessed = "";
	    	var newgame = (request.post.newgame === "newgame");
	    	UseNewID = false;
	    	
	    	    	
	    	if(request.post.undo === "undo")	// undo button pressed
	    	{
	    		ContextID = ContextIDList[ContextID].prev_ContextID;
	    		RandomString = ContextID.random_string;
	    			
	    	}
	    	else	
	    	{
		    	log(DEBUG, "letter guessed= " + request.post.letter);
		    	letter_guessed = request.post.letter.toUpperCase();
		    	
				var ctx;	// context
				
				// if no letter guessed or non alpha guessed - ignore
				// todo: client side html enhancement should restrict input to valid input
				if((letter_guessed.length === 0 || available_letters.indexOf(letter_guessed) < 0) && !newgame)
				{
					redirect(request, response);
					return;
				}
				
				// if no id or bogus id, start a new context
				if(typeof(ContextID) === "undefined"	||		// default behavior going to the URL w/o specifying an id
						  ContextID >= GlobalID	    	||		// user manually modified param to invalid value
						  ContextID < 0					||		// user manually modified id to negative number
						  isNaN(ContextID)				||		// user manually modified id to non numeric
						  newgame)								// newgame button pressed		
				{
				
					ContextIDList.push(GlobalID);
					ContextIDList[GlobalID] = new Context();
					
					RandomString = randomString();
															
					ContextIDHash[RandomString] = GlobalID;
					ContextIDList[GlobalID].random_string = RandomString;
					
					if(ContextID < GlobalID)
					{
						ContextIDList[GlobalID].prev_ContextID = ContextID;
					}
					
					ContextID = GlobalID;
					
					ContextIDList[GlobalID].letters_guessed = letter_guessed;
					if(newgame)
					{
						ContextIDList[GlobalID].current_word = WordList[Math.floor(Math.random() * WordList.length)]; // pick a random word from the list
					}
					else
					{
						ContextIDList[GlobalID].current_word = WordList[0];	// new sessions always start with rabbit which is the first word in the hangman dictionary for this game
					}
					if(ContextIDList[GlobalID].current_word.indexOf(letter_guessed) < 0) // letter not in word
					{	
						ContextIDList[GlobalID].guesses = 1;
					}	
					
					ctx = ContextIDList[GlobalID];
					UseNewID = true;	// redirect to new URL
					GlobalID++;
					
				}
				
				else
				{
					ctx = ContextIDList[ContextID];
					
					if(letter_guessed.length > 0 &&
					   available_letters.indexOf(letter_guessed >= 0) &&	// letter entered is valid alpha
					   ctx.letters_guessed.indexOf(letter_guessed) < 0)	// this letter was not already guessed
					{
						
						RandomString = randomString();
						
						ContextIDList.push(GlobalID);
						ContextIDHash[RandomString] = GlobalID;
						ContextIDList[GlobalID] = new Context();
						ContextIDList[GlobalID].prev_ContextID = ContextID;
						ContextIDList[GlobalID].guesses = ctx.guesses;					
						ContextIDList[GlobalID].letters_guessed = ctx.letters_guessed+letter_guessed;	
						ContextIDList[GlobalID].current_word = ctx.current_word;
						ContextIDList[GlobalID].random_string = RandomString;
						
						if(ContextIDList[GlobalID].current_word.indexOf(letter_guessed) < 0) // letter not in word
						{	
							ContextIDList[GlobalID].guesses++;
						}	
						UseNewID = true;	// redirect to new URL
						GlobalID++;
					}
				}
				log(DEBUG, "Printing ctx ID# " + ContextID);
				log(DEBUG, ContextIDList[ContextID]);
			
				log(DEBUG, "id = " + Number(GlobalID-1));
				log(DEBUG, ContextIDList[GlobalID-1]);
			
	    	}		
	    	redirect(request, response);
		
	    });
    }).listen(process.env.PORT || 8081);	// when run locally, will run on port 8081.  Heroku hosting does not allow specifying a port and will always use port 80 
    

});

function Context()
{
	this.guesses 			= 0;	
	this.letters_guessed 	= "";
	this.current_word 		= "";
	this.prev_ContextID 	= -1;
	this.random_string		= "";
}

function redirect(request, response)
{
	var redirect_url;
    if(UseNewID) 
    {
    	redirect_url = "http://" + request.headers.host + "?id=" + RandomString;
    }
    else if(ContextID >= 0)
    {
    	redirect_url = "http://" + request.headers.host + "?id=" + ContextIDList[ContextID].random_string;
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
}

function processPage(request, response, html, callback) {
    var queryData = "";
    var url_parts;
    var current_word;
    
    if(typeof callback !== 'function') {
    	log(ERROR, "process page called with invalid callback function");
    	return null;
    }

    log(DEBUG, "processPage: " + request.method);
    
    url_parts = querystring.parse(request.url.replace(/^.*\?/, ''));
	RandomString = url_parts.id;
	ContextID = ContextIDHash[RandomString];

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
    		lives_remaining = MaxLives - ContextIDList[ContextID].guesses;
    		letters_guessed = ContextIDList[ContextID].letters_guessed;
    		current_word 	= ContextIDList[ContextID].current_word;
    		
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
			message_str = "<b>You solved the puzzle!</b>"
			
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
function randomString()
{
    var len = 16;	// length of random string
    var outStr = "", newStr;
    while (outStr.length < len)
    {
        newStr = Math.random().toString(36).slice(2);
        outStr += newStr.slice(0, Math.min(newStr.length, (len - outStr.length)));
    }
    
    // verify that we have a unique random string
    if(typeof(ContextIDHash[outStr]) !== "undefined")
	{
		log(DEBUG, "ranndomString returned a duplicate hash of: " + outStr);
		outStr += Number(GlobalID);
		log(DEBUG, "modifying to unique sting: " + outStr);
	}
    log(DEBUG, "randomString() returning: "+ outStr);
    return outStr;
}

function log(type, msg)
{
	if(LogLevel.indexOf(type) >= 0 || type === ERROR)
	{
		console.log(msg);
	}
	if(type === ERROR)
	{
		var stack = new Error().stack;
		console.log(stack);
	}
}
