/* global tinymce */
/*
 * TinyMCE Writing Improvement Tool Plugin
 * Author: Raphael Mudge (raffi@automattic.com)
 *
 * Updated for TinyMCE 4.0
 *
 * http://www.proofreadbot.com
 *
 * Distributed under the LGPL
 *
 * Derived from:
 *	$Id: editor_plugin_src.js 425 2007-11-21 15:17:39Z spocke $
 *
 *	@author Moxiecode
 *	@copyright Copyright (C) 2004-2008, Moxiecode Systems AB, All rights reserved.
 *
 *	Moxiecode Spell Checker plugin released under the LGPL with TinyMCE
 */
tinymce.PluginManager.add( 'PBot', function( editor ) {
	var suggestionsMenu, started, PBotCore, dom,
		each = tinymce.each;

	/* initializes the functions used by the PBot Core UI Module */
	function initPBotCore() {

		PBotCore = new window.PBotCore();
		PBotCore.map = each;
		PBotCore._isTinyMCE = true;

		PBotCore.getAttrib = function( node, key ) {
			return dom.getAttrib( node, key );
		};

		PBotCore.findSpans = function( parent ) {
			if ( parent === undefined ) {
				return dom.select('span');
			} else {
				return dom.select( 'span', parent );
			}
		};

		PBotCore.hasClass = function( node, className ) {
			return dom.hasClass( node, className );
		};

		PBotCore.contents = function( node ) {
			return node.childNodes;
		};

		PBotCore.replaceWith = function( old_node, new_node ) {
			return dom.replace( new_node, old_node );
		};

		PBotCore.create = function( node_html ) {
			return dom.create( 'span', { 'class': 'mceItemHidden', 'data-mce-bogus': 1 }, node_html );
		};

		PBotCore.removeParent = function( node ) {
			dom.remove( node, true );
			return node;
		};

		PBotCore.remove = function( node ) {
			dom.remove( node );
		};

		PBotCore.setIgnoreStrings( editor.getParam( 'PBot_ignore_strings', [] ).join(',') );
		PBotCore.showTypes( editor.getParam( 'PBot_show_types', '' ) );
	}

	function getLang( key, defaultStr ) {
		return ( window.PBot_l10n_r0ar && window.PBot_l10n_r0ar[key] ) || defaultStr;
	}

	function isMarkedNode( node ) {
		return ( node.className && /\bhidden(GrammarError|SpellError|Suggestion)\b/.test( node.className ) );
	}

	function markMyWords( errors ) {
		return PBotCore.markMyWords( PBotCore.contents( editor.getBody() ), errors );
	}

	// If no more suggestions, finish.
	function checkIfFinished() {
		if ( ! editor.dom.select('span.hiddenSpellError, span.hiddenGrammarError, span.hiddenSuggestion').length ) {
			if ( suggestionsMenu ) {
				suggestionsMenu.hideMenu();
			}

			finish();
		}
	}

	function ignoreWord( target, word, all ) {
		var dom = editor.dom;

		if ( all ) {
			each( editor.dom.select( 'span.hiddenSpellError, span.hiddenGrammarError, span.hiddenSuggestion' ), function( node ) {
				var text = node.innerText || node.textContent;

				if ( text === word ) {
					dom.remove( node, true );
				}
			});
		} else {
			dom.remove( target, true );
		}

		checkIfFinished();
	}

	// Called when the user clicks "Finish" or when no more suggestions left.
	// Removes all remaining spans and fires custom event.
	function finish() {
		var node,
			dom = editor.dom,
			regex = new RegExp( 'mceItemHidden|hidden(((Grammar|Spell)Error)|Suggestion)' ),
			nodes = dom.select('span'),
			i = nodes.length;

		while ( i-- ) { // reversed
			node = nodes[i];

			if ( node.className && regex.test( node.className ) ) {
				dom.remove( node, true );
			}
		}

		// Rebuild the DOM so PBot core can find the text nodes
		editor.setContent( editor.getContent({ format: 'raw' }), { format: 'raw' } );

		started = false;
		editor.nodeChanged();
		editor.fire('SpellcheckEnd');
	}

	function sendRequest( file, data, success ) {
		var id = editor.getParam( 'PBot_rpc_id', '12345678' ),
			url = editor.getParam( 'PBot_rpc_url', '{backend}' );

		if ( url === '{backend}' || id === '12345678' ) {
			window.alert( 'Please specify: PBot_rpc_url and PBot_rpc_id' );
			return;
		}

		// create the nifty spinny thing that says "hizzo, I'm doing something fo realz"
		editor.setProgressState( true );

		tinymce.util.XHR.send({
			url: url + '/' + file,
			content_type: 'text/xml',
			type: 'POST',
			data: 'data=' + encodeURI( data ).replace( /&/g, '%26' ) + '&key=' + id,
			success: success,
			error: function( type, req, o ) {
				editor.setProgressState();
				window.alert( type + '\n' + req.status + '\nAt: ' + o.url );
			}
		});
	}

	function storeIgnoredStrings( text ) {
		// Store in sessionStorage?
	}

	function setAlwaysIgnore( text ) {
		var url = editor.getParam( 'PBot_ignore_rpc_url' );

		if ( ! url || url === '{backend}' ) {
			// Store ignored words for this session only
			storeIgnoredStrings( text );
		} else {
			// Plugin is configured to send ignore preferences to server, do that
			tinymce.util.XHR.send({
				url: url + encodeURIComponent( text ) + '&key=' + editor.getParam( 'PBot_rpc_id', '12345678' ),
				content_type: 'text/xml',
				type: 'GET',
				error: function() {
					storeIgnoredStrings( text );
				}
			});
		}

		// Update PBot_ignore_strings with the new value
		PBotCore.setIgnoreStrings( text );
	}

	// Create the suggestions menu
	function showSuggestions( target ) {
		var pos, root, targetPos,
			items = [],
			text = target.innerText || target.textContent,
			errorDescription = PBotCore.findSuggestion( target );

		if ( ! errorDescription ) {
			items.push({
				text: getLang( 'menu_title_no_suggestions', 'No suggestions' ),
				classes: 'PBot-menu-title',
				disabled: true
			});
		} else {
			items.push({
				text: errorDescription.description,
				classes: 'PBot-menu-title',
				disabled: true
			});

			if ( errorDescription.suggestions.length ) {
				items.push({ text: '-' }); // separator

				each( errorDescription.suggestions, function( suggestion ) {
					items.push({
						text: suggestion,
						onclick: function() {
							PBotCore.applySuggestion( target, suggestion );
							checkIfFinished();
						}
					});
				});
			}
		}

		if ( errorDescription && errorDescription.moreinfo ) {
			items.push({ text: '-' }); // separator
			
			items.push({
				text: getLang( 'menu_option_explain', 'Explain...' ),
				onclick : function() {
					/*editor.windowManager.open({
						title: getLang( 'menu_option_explain', 'Explain...' ),
						url: errorDescription.moreinfo,
						width: 480,
						height: 380,
						inline: true
					});*/
					//PBOT CUSTOM
					var wWidth = jQuery(window).width();
					var dWidth = wWidth * 0.7;
					var wHeight = jQuery(window).height();
					var dHeight = wHeight * 0.7;

					var $clone = jQuery(errorDescription.moreinfo).clone();
					$clone.dialog({
						"width": dWidth, 
						"height":dHeight,
					});
					//PBOT CUSTOM END
				}
			});
		}

		items.push.apply( items, [
			{ text: '-' }, // separator

			{ text: getLang( 'menu_option_ignore_once', 'Ignore suggestion' ), onclick: function() {
				ignoreWord( target, text );
			}}
		]);

		if ( editor.getParam( 'PBot_ignore_enable' ) ) {
			items.push({
				text: getLang( 'menu_option_ignore_always', 'Ignore always' ),
				onclick: function() {
					setAlwaysIgnore( text );
					ignoreWord( target, text, true );
				}
			});
		} else {
			items.push({
				text: getLang( 'menu_option_ignore_all', 'Ignore all' ),
				onclick: function() {
					ignoreWord( target, text, true );
				}
			});
		}

		// Render menu
		suggestionsMenu = new tinymce.ui.Menu({
			items: items,
			context: 'contextmenu',
			onautohide: function( event ) {
				if ( isMarkedNode( event.target ) ) {
					event.preventDefault();
				}
			},
			onhide: function() {
				suggestionsMenu.remove();
				suggestionsMenu = null;
			}
		});

		suggestionsMenu.renderTo( document.body );

		// Position menu
		pos = tinymce.DOM.getPos( editor.getContentAreaContainer() );
		targetPos = editor.dom.getPos( target );
		root = editor.dom.getRoot();

		// Adjust targetPos for scrolling in the editor
		if ( root.nodeName === 'BODY' ) {
			targetPos.x -= root.ownerDocument.documentElement.scrollLeft || root.scrollLeft;
			targetPos.y -= root.ownerDocument.documentElement.scrollTop || root.scrollTop;
		} else {
			targetPos.x -= root.scrollLeft;
			targetPos.y -= root.scrollTop;
		}

		pos.x += targetPos.x;
		pos.y += targetPos.y;

		suggestionsMenu.moveTo( pos.x, pos.y + target.offsetHeight );
	}

	// Init everything
	editor.on( 'init', function() {
		if ( typeof window.PBotCore === 'undefined' ) {
			return;
		}

		// Set dom and PBotCore
		dom = editor.dom;
		initPBotCore();

		// add a command to request a document check and process the results.
		editor.addCommand( 'PBot_mceWritingImprovementTool', function( callback ) {
			var results,
				errorCount = 0;

			if ( typeof callback !== 'function' ) {
				callback = function(){};
			}

			// checks if a global var for click stats exists and increments it if it does...
			if ( typeof window.PBot_proofread_click_count !== 'undefined' ) {
				window.PBot_proofread_click_count++;
			}

			// remove the previous errors
			if ( started ) {
				finish();
				return;
			}

			// send request to our service
			sendRequest( 'checkDocument', editor.getContent({ format: 'raw' }), function( data, request ) {
				// turn off the spinning thingie
				editor.setProgressState();

				//console.log(request);
				//console.log(request.responseXML);
				// PROOFREAD BOT CUSTOM ONSITE remove previous error
				if (jQuery('#messages-error').length)	{
					jQuery('#messages-error').remove();
				}
				// PROOFREAD BOT CUSTOM ONSITE
				//remove previous result
				if (jQuery('#PBot_result').length)	{
					jQuery('#PBot_result').empty();
				}
					
				
				// if the server is not accepting requests, let the user know
				if ( request.status !== 200 || request.responseText.substr( 1, 4 ) === 'html' || ! request.responseXML ) {
					editor.windowManager.alert(
						getLang( 'message_server_error', 'There was a problem communicating with the Proofreading service. Try again in one minute.' ),
						callback(0)
					);

					return;
				}
				
				//PBOT CUSTOM
				// check to see if things are broken first and foremost
				if ( request.responseXML.getElementsByTagName('message').item(0) !== null ) {
					editor.windowManager.alert(
						request.responseXML.getElementsByTagName('message').item(0).firstChild.wholeText,
						callback(0)
					);

					return;
				}

				
				//console.log(request.responseXML.getElementsByTagName('message'));
				// console.log(request.responseXML.getElementsByTagName('message')[0].childNodes);
				
				// if Drupal, we will need to add the PBot_result div...
				if (!jQuery('#PBot_result').length)	{
					jQuery('<div/>')
					.attr({
						id: 'PBot_result',
					})
					.appendTo('#edit-body');
				}
				
				//console.log(request.responseXML.getElementsByTagName('message'));
				/* check to see if things are broken first and foremost */
				if (jQuery(request.responseXML).find("message").text())	{
					
					jQuery('#PBot_result')
					.html(jQuery(request.responseXML).find("message").text());
					
					//ed.windowManager.alert(jQuery(request.responseXML).find("message").text());
					jQuery("<div title='Proofread Bot Notice'>" + jQuery(request.responseXML).find("message").text() + "</div>").dialog();
					
					return;
				}
				
				
					//unfortunately jquery append and html strips the script tags...
					jQuery('<div/>')
					//.append(jQuery(request.responseXML).find("display").text())
					.appendTo('#PBot_result');

					document.getElementById("PBot_result").innerHTML = jQuery(request.responseXML).find("display").text();
					
				
					//we also need to evaluate scripts added with html... http://stackoverflow.com/questions/75943/how-do-you-execute-a-dynamically-loaded-javascript-block
					var scripts = jQuery('#PBot_result').find("script");
					
					for (var ix = 0; ix < scripts.length; ix++) {
						eval(scripts[ix].text);
					}
				//PBOT CUSTOM END

				
				results = PBotCore.processXML( request.responseXML );

				if ( results.count > 0 ) {
					errorCount = markMyWords( results.errors );
				}

				if ( ! errorCount ) {
					editor.windowManager.alert( getLang( 'message_no_errors_found', 'No writing errors were found.' ) );
				} else {
					started = true;
					editor.fire('SpellcheckStart');
				}

				callback( errorCount );
			});
		});

		if ( editor.settings.content_css !== false ) {
			// CSS for underlining suggestions
			dom.addStyle( '.hiddenSpellError{border-bottom:2px solid red;cursor:default;}' +
				'.hiddenGrammarError{border-bottom:2px solid green;cursor:default;}' +
				'.hiddenSuggestion{border-bottom:2px solid blue;cursor:default;}' );
		}

		// Menu z-index > DFW
		tinymce.DOM.addStyle( 'div.mce-floatpanel{z-index:150100 !important;}' );

		// Click on misspelled word
		editor.on( 'click', function( event ) {
			if ( isMarkedNode( event.target ) ) {
				event.preventDefault();
				editor.selection.select( event.target );
				// Create the suggestions menu
				showSuggestions( event.target );
			}
		});
	});

	editor.addMenuItem( 'proofread_bot', {
		text: getLang( 'button_proofread_tooltip', 'Proofread Writing' ),
		context: 'tools',
		cmd: 'PBot_mceWritingImprovementTool',
		onPostRender: function() {
			var self = this;

			editor.on('SpellcheckStart SpellcheckEnd', function() {
				self.active( started );
			});
		}
	});

	editor.addButton( 'proofread_bot', {
		tooltip: getLang( 'button_proofread_tooltip', 'Proofread Writing' ),
		cmd: 'PBot_mceWritingImprovementTool',
		image: '../wp-content/plugins/proofread-bot/tinymce/pbot_check.gif',
		class: 'pbot_mce_button',
		//image: '../wp-content/plugins/proofread-bot/tinymce/logo_26x24.gif',
		onPostRender: function() {
			var self = this;

			editor.on( 'SpellcheckStart SpellcheckEnd', function() {
				self.active( started );
			});
		}
	});

	editor.on( 'remove', function() {
		if ( suggestionsMenu ) {
			suggestionsMenu.remove();
			suggestionsMenu = null;
		}
	});
});
