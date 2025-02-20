<?php
/* 
 *  Called by the TinyMCE plugin when Ignore Always is clicked (setup as an action through admin-ajax.php)
 */
function AtD_ignore_call() {

	if ( ! AtD_is_allowed() )
		return;

	$user = wp_get_current_user();

	if ( ! $user || $user->ID == 0 )
		return;

	$ignores = explode( ',', AtD_get_setting( $user->ID, 'AtD_ignored_phrases') );
	array_push( $ignores, $_GET['phrase'] );

	$ignores = array_filter( array_map( 'strip_tags', $ignores ) );

	AtD_update_setting( $user->ID, 'AtD_ignored_phrases', implode( ',', $ignores ) );

	header( 'Content-Type: text/xml' );
	echo '<success></success>';
	die();
}

/* 
 *  Called when a POST occurs, used to save AtD ignored phrases
 */
function AtD_process_unignore_update() {

	if ( ! AtD_is_allowed() )
		return;

        $user = wp_get_current_user();

        if ( ! $user || $user->ID == 0 )
                return;

	$ignores = array_filter( array_map( 'strip_tags', explode( ',', $_POST['AtD_ignored_phrases'] ) ) );
        AtD_update_setting( $user->ID, 'AtD_ignored_phrases', join( ',', $ignores ) );
}

/*
 *  Display the AtD unignore form on a page
 */
function AtD_display_unignore_form() {

	if ( ! AtD_is_allowed() )
		return;

	$user = wp_get_current_user();

	if ( ! $user || $user->ID == 0 )
		return;

	$ignores = AtD_get_setting( $user->ID, 'AtD_ignored_phrases');
?>
<script>
function atd_show_phrases( ignored )
{
	var element = jQuery( '#atd_ignores' ).get( 0 );
	var items   = new Array();

	ignored.sort();

	for ( var i = 0; i < ignored.length; i++ ) {
		if ( ignored[i].length > 0 )
			items.push( '<span id="atd_' + i + '"><a class="ntdelbutton" href="javascript:atd_unignore(\'' + encodeURIComponent( ignored[i].replace("'", "\\'") ) + '\')">X</a>&nbsp;' + ignored[i] + '</span>' );
	}

	element.innerHTML = items.length >= 1 ? items.join("<br>") : ''; 
}

function atd_unignore( phrase, eid ) {
	/* get the ignored values and remove the unwanted phrase */
	var ignored = jQuery( '#AtD_ignored_phrases' ).val().split( /,/g );
        ignored = jQuery.map(ignored, function(value, index) { return value == phrase ? null : value; });
        jQuery( '#AtD_ignored_phrases' ).val( ignored.join(',') );

	/* update the UI */
	atd_show_phrases( ignored );

	/* show a nifty message to the user */
        jQuery( '#AtD_message' ).show();
}

function atd_ignore () {
	/* get the ignored values and update the hidden field */
	var ignored = jQuery( '#AtD_ignored_phrases' ).val().split( /,/g );

        jQuery.map(jQuery( '#AtD_add_ignore' ).val().split(/,\s*/g), function(value, index) { ignored.push(value); });

        jQuery( '#AtD_ignored_phrases' ).val( ignored.join(',') );

	/* update the UI */
	atd_show_phrases( ignored );
	jQuery( '#AtD_add_ignore' ).val('');             

	/* show that nifteroo messaroo to the useroo */
        jQuery( '#AtD_message' ).show(); 
}

function atd_ignore_init() {
	jQuery( '#AtD_message' ).hide();
	atd_show_phrases( jQuery( '#AtD_ignored_phrases' ).val().split( /,/g ) );
}

/* document.ready() does not execute in IE6 unless it's at the bottom of the page. oi! */
if (navigator.appName == 'Microsoft Internet Explorer')
	setTimeout( atd_ignore_init, 2500 );
else
	jQuery( document ).ready( atd_ignore_init );
</script>
   <input type="hidden" name="AtD_ignored_phrases" id="AtD_ignored_phrases" value="<?php echo esc_attr( $ignores ); ?>">

          <p style="font-weight: bold"><?php _e('Ignored Phrases', 'proofread_bot'); ?></font>
     
          <p><?php _e('Identify words and phrases to ignore while proofreading your posts and pages:', 'proofread_bot'); ?></p>

          <p><input type="text" id="AtD_add_ignore" name="AtD_add_ignore"> <input type="button" value="<?php _e('Add', 'proofread_bot'); ?>" onclick="javascript:atd_ignore()"></p>

          <div class="tagchecklist" id="atd_ignores"></div>

          <div class="plugin-update-tr" id="AtD_message" style="display: none">
          <div class="update-message"><strong><?php _e('Be sure to click "Update Profile" at the bottom of the screen to save your changes.', 'proofread_bot'); ?></strong></div>
          </div>

         </td>
      </tr>
   </table>

<?php
}
