/*
 * jquery.pbot.js - jQuery powered writing check with After the Deadline
 * Author      : György Chityil
 * Credit      : Raphael Mudge, Automattic
 * License     : GPL
 * Project     : http://www.proofreadbot.com
 * Contact     : info@proofreadbot.com
 *
 * Derived from: 
 *
 * jquery.spellchecker.js - a simple jQuery Spell Checker
 * Copyright (c) 2008 Richard Willis
 * MIT license  : http://www.opensource.org/licenses/mit-license.php
 * Project      : http://jquery-spellchecker.googlecode.com
 * Contact      : willis.rh@gmail.com
 */

var PBot = 
{
	rpc : '', /* see the proxy.php that came with the PBot/TinyMCE plugin */
	//rpc_css : 'http://proofreadbot.com/PBot-jquery/server/proxycss.php?data=', /* you may use this, but be nice! */
	rpc_css_lang : 'en',
	api_key : '',
	i18n : {}, // Back-compat
	listener : {}
};

PBot.getLang = function( key, defaultk ) {
	return ( window.PBot_l10n_r0ar && window.PBot_l10n_r0ar[key] ) || defaultk;
};

PBot.addI18n = function( obj ) {
	// Back-compat
	window.PBot_l10n_r0ar = obj;
};

PBot.setIgnoreStrings = function(string) {
	PBot.core.setIgnoreStrings(string);
};

PBot.showTypes = function(string) {
	PBot.core.showTypes(string);
};

PBot.checkCrossAJAX = function(container_id, callback_f) {
	/* checks if a global var for click stats exists and increments it if it does... */
	if (typeof PBot_proofread_click_count != "undefined")  
		PBot_proofread_click_count++; 

	PBot.callback_f = callback_f; /* remember the callback for later */
	PBot.remove(container_id);
	var container = jQuery('#' + container_id);

	var html = container.html();
	text     = jQuery.trim(container.html());
	text     = text.replace(/\&lt;/g, '<').replace(/\&gt;/g, '>').replace(/\&amp;/g, '&');
	text     = encodeURIComponent( text.replace( /\%/g, '%25' ) ); /* % not being escaped here creates problems, I don't know why. */

	/* do some sanity checks based on the browser */
	if ((text.length > 2000 && navigator.appName == 'Microsoft Internet Explorer') || text.length > 7800) {
		if (callback_f != undefined && callback_f.error != undefined)
			callback_f.error("Maximum text length for this browser exceeded");

		return;
	}

	/* do some cross-domain AJAX action with CSSHttpRequest */
	CSSHttpRequest.get(PBot.rpc_css + text + "&lang=" + PBot.rpc_css_lang + "&nocache=" + (new Date().getTime()), function(response) {
		/* do some magic to convert the response into an XML document */
		var xml;
		if (navigator.appName == 'Microsoft Internet Explorer') {
			xml = new ActiveXObject("Microsoft.XMLDOM");
			xml.async = false;
			xml.loadXML(response);
		} 
		else {
			xml = (new DOMParser()).parseFromString(response, 'text/xml');
		}

		/* check for and display error messages from the server */
		if (PBot.core.hasErrorMessage(xml)) {
			if (PBot.callback_f != undefined && PBot.callback_f.error != undefined)
				PBot.callback_f.error(PBot.core.getErrorMessage(xml));

			return;
		} 

		/* highlight the errors */

		PBot.container = container_id;
		var count = PBot.processXML(container_id, xml);

		if (PBot.callback_f != undefined && PBot.callback_f.ready != undefined)
			PBot.callback_f.ready(count);

		if (count == 0 && PBot.callback_f != undefined && PBot.callback_f.success != undefined)
			PBot.callback_f.success(count);

		PBot.counter = count;
		PBot.count   = count;
	});
};

/* check a div for any incorrectly spelled words */
PBot.check = function(container_id, callback_f) {
	/* checks if a global var for click stats exists and increments it if it does... */
	if (typeof PBot_proofread_click_count != "undefined")
		PBot_proofread_click_count++; 

	PBot.callback_f = callback_f; /* remember the callback for later */

	PBot.remove(container_id);	
		
	var container = jQuery('#' + container_id);

	var html = container.html();
	text     = jQuery.trim(container.html());
	text     = text.replace(/\&lt;/g, '<').replace(/\&gt;/g, '>').replace(/\&amp;/g, '&');
	text     = encodeURIComponent( text ); /* re-escaping % is not necessary here. don't do it */

	jQuery.ajax({
		type : "POST",
		url : PBot.rpc + '/checkDocument',
		data : 'key=' + PBot.api_key + '&data=' + text,
		format : 'raw', 
		dataType : (jQuery.browser.msie) ? "text" : "xml",

		error : function(XHR, status, error) {
			if (PBot.callback_f != undefined && PBot.callback_f.error != undefined)
 				PBot.callback_f.error(status + ": " + error);
		},
	
		success : function(data) {
			/* apparently IE likes to return XML as plain text-- work around from:
			   http://docs.jquery.com/Specifying_the_Data_Type_for_AJAX_Requests */

			var xml;
			if (typeof data == "string") {
				xml = new ActiveXObject("Microsoft.XMLDOM");
				xml.async = false;
				xml.loadXML(data);
			} 
			else {
				xml = data;
			}

			if (PBot.core.hasErrorMessage(xml)) {
				if (PBot.callback_f != undefined && PBot.callback_f.error != undefined)
					PBot.callback_f.error(PBot.core.getErrorMessage(xml));

				return;
			}

			/* on with the task of processing and highlighting errors */

			PBot.container = container_id;
			var count = PBot.processXML(container_id, xml);

			if (PBot.callback_f != undefined && PBot.callback_f.ready != undefined)
				PBot.callback_f.ready(count);

			if (count == 0 && PBot.callback_f != undefined && PBot.callback_f.success != undefined)
				PBot.callback_f.success(count);

			PBot.counter = count;
			PBot.count   = count;
		}
	});
};
	
PBot.remove = function(container_id) {
	PBot._removeWords(container_id, null);
};

PBot.clickListener = function(event) {
	if (PBot.core.isMarkedNode(event.target))
		PBot.suggest(event.target);
};

PBot.processXML = function(container_id, responseXML) {

	var results = PBot.core.processXML(responseXML);
   
	if (results.count > 0)
		results.count = PBot.core.markMyWords(jQuery('#' + container_id).contents(), results.errors);

	jQuery('#' + container_id).unbind('click', PBot.clickListener);
	jQuery('#' + container_id).click(PBot.clickListener);

	return results.count;
};

PBot.useSuggestion = function(word) {
	this.core.applySuggestion(PBot.errorElement, word);

	PBot.counter --;
	if (PBot.counter == 0 && PBot.callback_f != undefined && PBot.callback_f.success != undefined)
		PBot.callback_f.success(PBot.count);
};

PBot.editSelection = function() {
	var parent = PBot.errorElement.parent();

	if (PBot.callback_f != undefined && PBot.callback_f.editSelection != undefined)
		PBot.callback_f.editSelection(PBot.errorElement);

	if (PBot.errorElement.parent() != parent) {
		PBot.counter --;
		if (PBot.counter == 0 && PBot.callback_f != undefined && PBot.callback_f.success != undefined)
			PBot.callback_f.success(PBot.count);
	}
};

PBot.ignoreSuggestion = function() {
	PBot.core.removeParent(PBot.errorElement); 

	PBot.counter --;
	if (PBot.counter == 0 && PBot.callback_f != undefined && PBot.callback_f.success != undefined)
		PBot.callback_f.success(PBot.count);
};

PBot.ignoreAll = function(container_id) {
	var target = PBot.errorElement.text();
	var removed = PBot._removeWords(container_id, target);

	PBot.counter -= removed;

	if (PBot.counter == 0 && PBot.callback_f != undefined && PBot.callback_f.success != undefined)
		PBot.callback_f.success(PBot.count);

	if (PBot.callback_f != undefined && PBot.callback_f.ignore != undefined) {
		PBot.callback_f.ignore(target);
		PBot.core.setIgnoreStrings(target);
	}
};

PBot.explainError = function() {
	if (PBot.callback_f != undefined && PBot.callback_f.explain != undefined)
		PBot.callback_f.explain(PBot.explainURL);
};

PBot.suggest = function(element) {
	/* construct the menu if it doesn't already exist */

	if (jQuery('#suggestmenu').length == 0) {
		var suggest = jQuery('<div id="suggestmenu"></div>');
		suggest.prependTo('body');
	}
	else {
		var suggest = jQuery('#suggestmenu');
		suggest.hide();
	}

	/* find the correct suggestions object */          

	errorDescription = PBot.core.findSuggestion(element);

	/* build up the menu y0 */

	PBot.errorElement = jQuery(element);

	suggest.empty();

	if (errorDescription == undefined) {
		suggest.append('<strong>' + PBot.getLang('menu_title_no_suggestions', 'No suggestions') + '</strong>');
	}
	else if (errorDescription["suggestions"].length == 0) {
		suggest.append('<strong>' + errorDescription['description'] + '</strong>');
	}
	else {
		suggest.append('<strong>' + errorDescription['description'] + '</strong>');

		for (var i = 0; i < errorDescription["suggestions"].length; i++) {
			(function(sugg) {
				suggest.append('<a href="javascript:PBot.useSuggestion(\'' + sugg.replace(/'/, '\\\'') + '\')">' + sugg + '</a>');
			})(errorDescription["suggestions"][i]);
		}
	}

	/* do the explain menu if configured */

	if (PBot.callback_f != undefined && PBot.callback_f.explain != undefined && errorDescription['moreinfo'] != undefined) {
		suggest.append('<a href="javascript:PBot.explainError()" class="spell_sep_top">' + PBot.getLang('menu_option_explain', 'Explain...') + '</a>');
		PBot.explainURL = errorDescription['moreinfo'];
	}

	/* do the ignore option */

	suggest.append('<a href="javascript:PBot.ignoreSuggestion()" class="spell_sep_top">' + PBot.getLang('menu_option_ignore_once', 'Ignore suggestion') + '</a>');

	/* add the edit in place and ignore always option */

	if (PBot.callback_f != undefined && PBot.callback_f.editSelection != undefined) {
		if (PBot.callback_f != undefined && PBot.callback_f.ignore != undefined)
			suggest.append('<a href="javascript:PBot.ignoreAll(\'' + PBot.container + '\')">' + PBot.getLang('menu_option_ignore_always', 'Ignore always') + '</a>');
		else
			suggest.append('<a href="javascript:PBot.ignoreAll(\'' + PBot.container + '\')">' + PBot.getLang('menu_option_ignore_all', 'Ignore all') + '</a>');
 
		suggest.append('<a href="javascript:PBot.editSelection(\'' + PBot.container + '\')" class="spell_sep_bottom spell_sep_top">' + PBot.getLang('menu_option_edit_selection', 'Edit Selection...') + '</a>');
	}
	else {
		if (PBot.callback_f != undefined && PBot.callback_f.ignore != undefined)
			suggest.append('<a href="javascript:PBot.ignoreAll(\'' + PBot.container + '\')" class="spell_sep_bottom">' + PBot.getLang('menu_option_ignore_always', 'Ignore always') + '</a>');
		else
			suggest.append('<a href="javascript:PBot.ignoreAll(\'' + PBot.container + '\')" class="spell_sep_bottom">' + PBot.getLang('menu_option_ignore_all', 'Ignore all') + '</a>');
	}

	/* show the menu */

	var pos = jQuery(element).offset();
	var width = jQuery(element).width();

        /* a sanity check for Internet Explorer--my favorite browser in every possible way */
        if (width > 100) 
                width = 50; 

	jQuery(suggest).css({ left: (pos.left + width) + 'px', top: pos.top + 'px' });

	jQuery(suggest).fadeIn(200);

	/* bind events to make the menu disappear when the user clicks outside of it */

	PBot.suggestShow = true;

	setTimeout(function() {
		jQuery("body").bind("click", function() {
			if (!PBot.suggestShow)
				jQuery('#suggestmenu').fadeOut(200);      
		});
	}, 1);

	setTimeout(function() {
		PBot.suggestShow = false;
	}, 2); 
};

PBot._removeWords = function(container_id, w) {
	return this.core.removeWords(jQuery('#' + container_id), w);
};

/*
 * Set prototypes used by PBot Core UI 
 */
PBot.initCoreModule = function() {
	var core = new PBotCore();

	core.hasClass = function(node, className) {
		return jQuery(node).hasClass(className);
	};

	core.map = jQuery.map;

	core.contents = function(node) {
		return jQuery(node).contents();
	};

	core.replaceWith = function(old_node, new_node) {
		return jQuery(old_node).replaceWith(new_node);
	};

	core.findSpans = function(parent) {
        	return jQuery.makeArray(parent.find('span'));
	};

	core.create = function(string, isTextNode) {
		// replace out all tags with &-equivalents so that we preserve tag text.
		string = string.replace(/\&/g, '&amp;');
		string = string.replace(/\</g, '&lt;').replace(/\>/g, '&gt;');

		// find all instances of PBot-created spans
		var matches = string.match(/\&lt;span class="hidden\w+?" pre="[^"]*"\&gt;.*?\&lt;\/span\&gt;/g);

		// ... and fix the tags in those substrings.
		if (matches) {
			for (var x = 0; x < matches.length; x++) {
				string = string.replace(matches[x], matches[x].replace(/\&lt;/gi, '<').replace(/\&gt;/gi, '>'));
			};
		}

		if (core.isIE()) {
			// and... one more round of corrections for our friends over at the Internet Explorer
			matches = string.match(/\&lt;span class="mceItemHidden"\&gt;\&amp;nbsp;\&lt;\/span&gt;/g, string);
			//|&lt;BR.*?class.*?PBot_remove_me.*?\&gt;/gi, string);
			if (matches) {
				for (var x = 0; x < matches.length; x++) {
					string = string.replace(matches[x], matches[x].replace(/\&lt;/gi, '<').replace(/\&gt;/gi, '>').replace(/\&amp;/gi, '&'));
				};
			}
		}

		node = jQuery('<span class="mceItemHidden"></span>');
		node.html(string);
		return node;
	};

	core.remove = function(node) {
		return jQuery(node).remove();
	};

	core.removeParent = function(node) {
		/* unwrap exists in jQuery 1.4+ only. Thankfully because replaceWith as-used here won't work in 1.4 */
		if (jQuery(node).unwrap)
			return jQuery(node).contents().unwrap();
		else
			return jQuery(node).replaceWith(jQuery(node).html());
	};

	core.getAttrib = function(node, name) {
		return jQuery(node).attr(name);
	};

	return core;
};

PBot.core = PBot.initCoreModule();
