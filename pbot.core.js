/*
 * proofread_bot.core.js - A building block to create a front-end for proofread_bot
 * Author      : Gy�rgy Chityil
 * Credit      : Raphael Mudge, Automattic
 * License     : GPL
 * Project     : http://www.proofreadbot.com
 * Contact     : info@proofreadbot.com
 */

/* EXPORTED_SYMBOLS is set so this file can be a JavaScript Module */
var EXPORTED_SYMBOLS = ['PBotCore'];

function PBotCore() {
	/* these are the categories of errors PBot should ignore */
	this.ignore_types = ['Bias Language', 'Cliches', 'Complex Expression', 'Diacritical Marks', 'Double Negatives', 'Hidden Verbs', 'Jargon Language', 'Passive voice', 'Phrases to Avoid', 'Redundant Expression'];

	/* these are the phrases PBot should ignore */
	this.ignore_strings = {};

	/* Localized strings */
	// Back-compat, not used
	this.i18n = {};
};

/*
 * Internationalization Functions
 */

PBotCore.prototype.getLang = function( key, defaultk ) {
	return ( window.PBot_l10n_r0ar && window.PBot_l10n_r0ar[key] ) || defaultk;
};

PBotCore.prototype.addI18n = function( obj ) {
	// Back-compat
	window.PBot_l10n_r0ar = obj;
};

/*
 * Setters
 */

PBotCore.prototype.setIgnoreStrings = function(string) {
	var parent = this;

	this.map(string.split(/,\s*/g), function(string) {
		parent.ignore_strings[string] = 1;
	});
};

PBotCore.prototype.showTypes = function(string) {
	var show_types = string.split(/,\s*/g);
	var types = {};

	/* set some default types that we want to make optional */

		/* grammar checker options */
	types["Double Negatives"]     = 1;
	types["Hidden Verbs"]         = 1;
	types["Passive voice"]        = 1;
	types["Bias Language"]        = 1;

		/* style checker options */
	types["Cliches"]              = 1;
	types["Complex Expression"]   = 1;
	types["Diacritical Marks"]    = 1;
	types["Jargon Language"]      = 1;
	types["Phrases to Avoid"]     = 1;
	types["Redundant Expression"] = 1;

        var ignore_types = [];

        this.map(show_types, function(string) {
                types[string] = undefined;
        });

        this.map(this.ignore_types, function(string) {
                if (types[string] != undefined) 
                        ignore_types.push(string);
        });

        this.ignore_types = ignore_types;
};

/* 
 * Error Parsing Code
 */

PBotCore.prototype.makeError = function(error_s, tokens, type, seps, pre) {        
	var struct = new Object();
	struct.type = type;
	struct.string = error_s;
	struct.tokens = tokens;

	
	// A RegExp that matches all the characters which have a special meaning in a RegExp
	var regexpSpecialChars = /([\[\]\^\$\|\(\)\\\+\*\?\{\}\=\!\.])/gi;
	var error_s = error_s.replace(regexpSpecialChars, '\\$1');
	
	//console.log(seps);
	
	if (new RegExp("\\b" + error_s + "\\b").test(error_s)) {
		struct.regexp = new RegExp("(?!"+error_s+"<)\\b" + error_s + "\\b");
	}
	else if (new RegExp(error_s + "\\b").test(error_s)) {
		struct.regexp = new RegExp("(?!"+error_s+"<)" + error_s + "\\b");
	}
	else if (new RegExp("\\b" + error_s).test(error_s)) {
		struct.regexp = new RegExp("(?!"+error_s+"<)\\b" + error_s);
	}
	else {
		struct.regexp = new RegExp(error_s);
	}

	struct.used   = false; /* flag whether we've used this rule or not */

	return struct;
};

PBotCore.prototype.addToErrorStructure = function(errors, list, type, seps) {
	var parent = this;                  

	this.map(list, function(error) {
		var tokens = error["word"].split(/\s+/);
		var pre    = error["pre"];
		var first  = tokens[0];


		if (errors['__' + first] == undefined) {      
			errors['__' + first] = new Object();
			errors['__' + first].pretoks  = {};
			errors['__' + first].defaults = new Array();
		}

		if (pre == "") {               
			errors['__' + first].defaults.push(parent.makeError(error["word"], tokens, type, seps, pre));
		} else {
			if (errors['__' + first].pretoks['__' + pre] == undefined)
				errors['__' + first].pretoks['__' + pre] = new Array();

			errors['__' + first].pretoks['__' + pre].push(parent.makeError(error["word"], tokens, type, seps, pre));
		}
	});
};

PBotCore.prototype.buildErrorStructure = function(spellingList, enrichmentList, grammarList) {
	var seps   = this._getSeparators();
	var errors = {};

	this.addToErrorStructure(errors, spellingList, "hiddenSpellError", seps);            
	this.addToErrorStructure(errors, grammarList, "hiddenGrammarError", seps);
	this.addToErrorStructure(errors, enrichmentList, "hiddenSuggestion", seps);
	return errors;
};

PBotCore.prototype._getSeparators = function() {
	var re = '', i;
	var str = '"s#$%&()*+/<=>@[\]^_{|}';
	// Build word separator regexp
	for (i=0; i<str.length; i++)
		re += '\\' + str.charAt(i);

	return "(?:(?:[\xa0" + re  + "]))+";
	//return /\b/;
};        

//http://stackoverflow.com/questions/494035/how-do-you-pass-a-variable-to-a-regular-expression-javascript/494122#494122
RegExp.quote = function(str) {
    return (str+'').replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
};


PBotCore.prototype.processXML = function(responseXML) {

	/* types of errors to ignore */
	var types = {};

	this.map(this.ignore_types, function(type) {
		types[type] = 1;
	});

	/* save suggestions in the editor object */
	this.suggestions = [];

	/* process through the errors */
	var errors = responseXML.getElementsByTagName('error');

	/* words to mark */
	var grammarErrors    = [];
	var spellingErrors   = [];
	var enrichment       = [];

	for (var i = 0; i < errors.length; i++) {
		if (errors[i].getElementsByTagName('string').item(0).firstChild != null) {
			var errorString      = errors[i].getElementsByTagName('string').item(0).firstChild.data;
			var errorType        = errors[i].getElementsByTagName('type').item(0).firstChild.data;
			var errorDescription = errors[i].getElementsByTagName('description').item(0).firstChild.data;

			var errorContext;

			if (errors[i].getElementsByTagName('precontext').item(0).firstChild != null) 
				errorContext = errors[i].getElementsByTagName('precontext').item(0).firstChild.data;   
			else
				errorContext = "";

			/* create a hashtable with information about the error in the editor object, we will use this later
			   to populate a popup menu with information and suggestions about the error */

			if (this.ignore_strings[errorString] == undefined) {
				var suggestion = {};
				suggestion["description"] = errorDescription;
				suggestion["suggestions"] = [];

				/* used to find suggestions when a highlighted error is clicked on */
				//console.log(errorString);
				//http://stackoverflow.com/questions/494035/how-do-you-pass-a-variable-to-a-regular-expression-javascript/494122#494122

				suggestion["matcher"]     = new RegExp('^' + RegExp.quote(errorString).replace(/\s+/, this._getSeparators()) + '$');

				suggestion["context"]     = errorContext;
				suggestion["string"]      = errorString;
				suggestion["type"]        = errorType;

				this.suggestions.push(suggestion);

				if (errors[i].getElementsByTagName('suggestions').item(0) != undefined) {
					var suggestions = errors[i].getElementsByTagName('suggestions').item(0).getElementsByTagName('option');
					for (var j = 0; j < suggestions.length; j++)
						suggestion["suggestions"].push(suggestions[j].firstChild.data);
				}

				/* setup the more info url */
				if (errors[i].getElementsByTagName('url').item(0) != undefined) {
					var errorUrl = errors[i].getElementsByTagName('url').item(0).firstChild.data;
					suggestion["moreinfo"] = errorUrl;
				}

				if (types[errorDescription] == undefined) {
					if (errorType == "suggestion")
						enrichment.push({ word: errorString, pre: errorContext });

					if (errorType == "grammar")
						grammarErrors.push({ word: errorString, pre: errorContext });
				}

				if (errorType == "spelling" || errorDescription == "Homophone")
					spellingErrors.push({ word: errorString, pre: errorContext });

				if (errorDescription == 'Cliches')
					suggestion["description"] = 'Clich&eacute;s'; /* done here for backwards compatability with current user settings */

				if (errorDescription == "Spelling")
					suggestion["description"] = this.getLang('menu_title_spelling', 'Spelling');

				if (errorDescription == "Repeated Word")
					suggestion["description"] = this.getLang('menu_title_repeated_word', 'Repeated Word');
				
				if (errorDescription == "Did you mean...")
					suggestion["description"] = this.getLang('menu_title_confused_word', 'Did you mean...');
			} // end if ignore[errorString] == undefined
		} // end if 
	} // end for loop

	var errorStruct;
        var ecount = spellingErrors.length + grammarErrors.length + enrichment.length;

	if (ecount > 0)
		errorStruct = this.buildErrorStructure(spellingErrors, enrichment, grammarErrors);
	else
		errorStruct = undefined;

	/* save some state in this object, for retrieving suggestions later */
	return { errors: errorStruct, count: ecount, suggestions: this.suggestions };
};

PBotCore.prototype.findSuggestion = function(element) {
	var text = element.innerHTML;
	var context = ( this.getAttrib(element, 'pre') + "" ).replace(/[\\,!\\?\\."\s]/g, '');
	if (this.getAttrib(element, 'pre') == undefined)
	{
	   alert(element.innerHTML);
	}

	var errorDescription = undefined;

	// it will clash with After The Deadline if I am not checking here, as Atd also fires Pbot functions, OOP Crap, dont ask
	if (typeof this.suggestions != 'undefined')
		{
		var len = this.suggestions.length;
	   
		for (var i = 0; i < len; i++) {
			var key = this.suggestions[i]["string"];
	   
			if ((context == "" || context == this.suggestions[i]["context"]) && this.suggestions[i]["matcher"].test(text)) {
				errorDescription = this.suggestions[i];
				break;
				}
			}
		}
	return errorDescription;
};

/*
 * TokenIterator class
 */

function TokenIterator(tokens) {
	this.tokens = tokens;
	this.index  = 0;
	this.count  = 0;
	this.last   = 0;
};

TokenIterator.prototype.next = function() {
	var current = this.tokens[this.index];
	this.count = this.last;
	this.last += current.length + 1;
	this.index++;

	/* strip single quotes from token, PBot does this when presenting errors */
	if (current != "") {
		if (current[0] == "'")
			current = current.substring(1, current.length);

		if (current[current.length - 1] == "'") 
			current = current.substring(0, current.length - 1);
	}

	return current;
};

TokenIterator.prototype.hasNext = function() {
	return this.index < this.tokens.length;
};

TokenIterator.prototype.hasNextN = function(n) {
	return (this.index + n) < this.tokens.length;            
};

TokenIterator.prototype.skip = function(m, n) {
	this.index += m;
	this.last += n;

	if (this.index < this.tokens.length)
		this.count = this.last - this.tokens[this.index].length;
};

TokenIterator.prototype.getCount = function() {
	return this.count;
};

TokenIterator.prototype.peek = function(n) {
	var peepers = new Array();
	var end = this.index + n;
	for (var x = this.index; x < end; x++)
		peepers.push(this.tokens[x]);
	return peepers;
};

/* 
 *  code to manage highlighting of errors
 */
PBotCore.prototype.markMyWords = function(container_nodes, errors) { 
	var seps = new RegExp(this._getSeparators()),
		nl = new Array(),
		ecount = 0, /* track number of highlighted errors */
		parent = this,
		bogus = this._isTinyMCE ? ' data-mce-bogus="1"' : '',
		emptySpan = '<span class="mceItemHidden"' + bogus + '>&nbsp;</span>';

	/* Collect all text nodes */
	/* Our goal--ignore nodes that are already wrapped */
   
	this._walk( container_nodes, function( n ) {
		if ( n.nodeType == 3 && ! parent.isMarkedNode( n ) )
			nl.push( n );
	});
 
	/* walk through the relevant nodes */  
   
	var iterator;
      
	this.map( nl, function( n ) {
		var v;

		if ( n.nodeType == 3 ) {
			v = n.nodeValue; /* we don't want to mangle the HTML so use the actual encoded string */
			var tokens = n.nodeValue.split( seps ); /* split on the unencoded string so we get access to quotes as " */
			var previous = "";

			var doReplaces = [];

			iterator = new TokenIterator(tokens);

			while ( iterator.hasNext() ) {
				var token = iterator.next();
				var current  = errors['__' + token];

				var defaults;

				if ( current != undefined && current.pretoks != undefined ) {
					defaults = current.defaults;
					current = current.pretoks['__' + previous];

					var done = false;
					var prev, curr;

					prev = v.substr(0, iterator.getCount());
					curr = v.substr(prev.length, v.length);

					var checkErrors = function( error ) {
						if ( error != undefined && ! error.used && foundStrings[ '__' + error.string ] == undefined && error.regexp.test( curr ) ) {
							var oldlen = curr.length;

							foundStrings[ '__' + error.string ] = 1;
							doReplaces.push([ error.regexp, '<span class="'+error.type+'" pre="'+previous+'"' + bogus + '>$&</span>' ]);

							error.used = true;
							done = true;
						}
					};

					var foundStrings = {};

					if (current != undefined) {
						previous = previous + ' ';
						parent.map(current, checkErrors);
					}

					if (!done) {
						previous = '';
						parent.map(defaults, checkErrors);
					}
				}

				previous = token;
			} // end while

			/* do the actual replacements on this span */
			if ( doReplaces.length > 0 ) {
				newNode = n;

				for ( var x = 0; x < doReplaces.length; x++ ) {
					var regexp = doReplaces[x][0], result = doReplaces[x][1];

					/* it's assumed that this function is only being called on text nodes (nodeType == 3), the iterating is necessary
					   because eventually the whole thing gets wrapped in an mceItemHidden span and from there it's necessary to
					   handle each node individually. */
					var bringTheHurt = function( node ) {
						if ( node.nodeType == 3 ) {
							ecount++;

							/* sometimes IE likes to ignore the space between two spans, solution is to insert a placeholder span with
							   a non-breaking space.  The markup removal code substitutes this span for a space later */
							if ( parent.isIE() && node.nodeValue.length > 0 && node.nodeValue.substr(0, 1) == ' ' )
								return parent.create( emptySpan + node.nodeValue.substr( 1, node.nodeValue.length - 1 ).replace( regexp, result ), false );
							else
								return parent.create( node.nodeValue.replace( regexp, result ), false );
						} 
						else {
							var contents = parent.contents(node);

							for ( var y = 0; y < contents.length; y++ ) {
								if ( contents[y].nodeType == 3 && regexp.test( contents[y].nodeValue ) ) {
									var nnode;

									if ( parent.isIE() && contents[y].nodeValue.length > 0 && contents[y].nodeValue.substr(0, 1) == ' ')
										nnode = parent.create( emptySpan + contents[y].nodeValue.substr( 1, contents[y].nodeValue.length - 1 ).replace( regexp, result ), true );
									else
										nnode = parent.create( contents[y].nodeValue.replace( regexp, result ), true );

									parent.replaceWith( contents[y], nnode );
									parent.removeParent( nnode );

									ecount++;

									return node; /* we did a replacement so we can call it quits, errors only get used once */
								}
							}

							return node;
						}
					};

					newNode = bringTheHurt(newNode);
				}

				parent.replaceWith(n, newNode);
			}
		} 
	}); 

	return ecount;
};

PBotCore.prototype._walk = function(elements, f) {
	var i;
	for (i = 0; i < elements.length; i++) {
		f.call(f, elements[i]);
		this._walk(this.contents(elements[i]), f);
	}
};  

PBotCore.prototype.removeWords = function(node, w) {   
	var count = 0;
	var parent = this;

	this.map(this.findSpans(node).reverse(), function(n) {
		if (n && (parent.isMarkedNode(n) || parent.hasClass(n, 'mceItemHidden') || parent.isEmptySpan(n)) ) {
			if (n.innerHTML == '&nbsp;') {
				var nnode = document.createTextNode(' '); /* hax0r */
				parent.replaceWith(n, nnode);
			}
			else if (!w || n.innerHTML == w) {
				parent.removeParent(n);
				count++;
			}
		}
	});

	return count;
};

PBotCore.prototype.isEmptySpan = function(node) {
	return (this.getAttrib(node, 'class') == "" && this.getAttrib(node, 'style') == "" && this.getAttrib(node, 'id') == "" && !this.hasClass(node, 'Apple-style-span') && this.getAttrib(node, 'mce_name') == "");
};

PBotCore.prototype.isMarkedNode = function(node) {
	return (this.hasClass(node, 'hiddenGrammarError') || this.hasClass(node, 'hiddenSpellError') || this.hasClass(node, 'hiddenSuggestion'));
};

/*
 * Context Menu Helpers
 */
PBotCore.prototype.applySuggestion = function(element, suggestion) {
	if (suggestion == '(omit)') {
		this.remove(element);
	}
	else {
		var node = this.create(suggestion);
		this.replaceWith(element, node);
		this.removeParent(node);
	}
};

/* 
 * Check for an error
 */
PBotCore.prototype.hasErrorMessage = function(xmlr) {
	return (xmlr != undefined && xmlr.getElementsByTagName('message').item(0) != null);
};

PBotCore.prototype.getErrorMessage = function(xmlr) {
	return xmlr.getElementsByTagName('message').item(0);
};

/* this should always be an error, alas... not practical */
PBotCore.prototype.isIE = function() {
	return navigator.appName == 'Microsoft Internet Explorer';
};

// TODO: this doesn't seem used anywhere in PBot, moved here from install_PBot_l10n.js for eventual back-compat 
/* a quick poor man's sprintf */
function PBot_sprintf(format, values) {
	var result = format;
	for (var x = 0; x < values.length; x++)
		result = result.replace(new RegExp('%' + (x + 1) + '\\$', 'g'), values[x]);
	return result;
}
