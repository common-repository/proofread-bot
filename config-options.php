<?php
/*
 *   Display the configuration options for AtD
 */

/*
 *   A convienence function to display the HTML for an AtD option
 */
function proofread_bot_print_option( $name, $value, $options ) {
	// Attribute-safe version of $name
	$attr_name = sanitize_title($name); // Using sanitize_title since there's no comparable function for attributes
?>
   <input type="checkbox" id="proofread_bot_<?php echo ($attr_name) ?>" name="<?php echo $options['name'] ?>[<?php echo $name; ?>]" value="1" <?php checked( '1', $options[$name] ); ?>> <label for="proofread_bot_<?php echo $attr_name ?>"><?php echo $value; ?></label>
<?php
}

/*
 *  Print a message saying proofread_bot s not available due to the language settings
 */
function proofread_bot_process_not_supported() {
?>
   <p><?php printf(__( 'WordPress checks your grammar, spelling, and misused words with <a href="%s">After the Deadline</a>. This feature is available to blogs set to the English language. Blogs in other languages will continue to have access to the old spellchecker.', 'proofread_bot'), 'http://www.afterthedeadline.com'); ?></p>
<?php
}

/*
 *  Save proofread_bot options
 */
function proofread_bot_process_options_update() {

	$user = wp_get_current_user();

	if ( ! $user || $user->ID == 0 )
		return;

	proofread_bot_update_options( $user->ID, 'proofread_bot_options' );
	proofread_bot_update_options( $user->ID, 'proofread_bot_check_when' );
	proofread_bot_update_options( $user->ID, 'proofread_bot_guess_lang' );
}

/*
 *  Display the various proofread_bot options
 */
function proofread_bot_display_options_form() {

	/* grab our user and validate their existence */
	$user = wp_get_current_user();
	if ( ! $user || $user->ID == 0 )
		return;

	$options_show_types = proofread_bot_get_options($user->ID, 'proofread_bot_options');
	$options_check_when = proofread_bot_get_options($user->ID, 'proofread_bot_check_when');
	$options_guess_lang = proofread_bot_get_options($user->ID, 'proofread_bot_guess_lang');
?>
   <table class="form-table">
      <tr valign="top">
         <th scope="row"> <?php _e('Proofreading'); ?></th>
		 <td>
   <p><?php _e('Automatically proofread content when:'); ?>

   <p><?php 
		proofread_bot_print_option( 'onpublish', __('a post or page is first published', 'proofread_bot'), $options_check_when ); 
		echo '<br />';
		proofread_bot_print_option( 'onupdate', __('a post or page is updated', 'proofread_bot'), $options_check_when );
   ?></p>

   <p style="font-weight: bold"><?php _e('English Options', 'proofread_bot'); ?></font>

   <p><?php _e('Enable proofreading for the following grammar and style rules when writing posts and pages:'); ?></p>

   <p><?php 
		proofread_bot_print_option( 'Bias Language', __('Bias Language'), $options_show_types );
		echo '<br />';
		proofread_bot_print_option( 'Cliches', __('Clich&eacute;s'), $options_show_types );
		echo '<br />';
		proofread_bot_print_option( 'Complex Expression', __('Complex Phrases'), $options_show_types ); 
		echo '<br />';
		proofread_bot_print_option( 'Diacritical Marks', __('Diacritical Marks'), $options_show_types );
		echo '<br />';
		proofread_bot_print_option( 'Double Negative', __('Double Negatives'), $options_show_types );
		echo '<br />';
		proofread_bot_print_option( 'Hidden Verbs', __('Hidden Verbs'), $options_show_types );
		echo '<br />';
		proofread_bot_print_option( 'Jargon Language', __('Jargon'), $options_show_types ); 
		echo '<br />';
		proofread_bot_print_option( 'Passive voice', __('Passive Voice'), $options_show_types ); 
		echo '<br />';
		proofread_bot_print_option( 'Phrases to Avoid', __('Phrases to Avoid'), $options_show_types ); 
		echo '<br />';
		proofread_bot_print_option( 'Redundant Expression', __('Redundant Phrases'), $options_show_types ); 
   ?></p>
   <p><?php printf(__('<a href="%s">Learn more</a> about these options.', 'proofread_bot'), 'http://support.wordpress.com/proofreading/'); 
?></p>

   <p style="font-weight: bold"><?php _e('Language', 'proofread_bot'); ?></font>

   <p><?php printf(__('The proofreader supports English, French, German, Portuguese, and Spanish. Your <a href="%s">WPLANG</a> value is the default proofreading language.'), 'http://codex.wordpress.org/Installing_WordPress_in_Your_Language'); ?></p>

   <p><?php
	proofread_bot_print_option( 'true', __('Use automatically detected language to proofread posts and pages'), $options_guess_lang );
   ?></p>

<?php
}

/*
 *  Returns an array of proofread_bot user options specified by $name
 */
function proofread_bot_get_options( $user_id, $name ) {
	$options_raw = proofread_bot_get_setting($user_id, $name, 'single');
	
	$options = array();
	$options['name'] = $name;

	if ( $options_raw )
		foreach ( explode( ',', $options_raw ) as $option ) 
			$options[ $option ] = 1;
	
	return $options;
}

/*
 *  Saves set of user options specified by $name from POST data
 */
function proofread_bot_update_options( $user_id, $name ) {
	/* We should probably run $_POST[name] through an esc_*() function... */
	if ( is_array( $_POST[$name] ) ) {
		$copy = array_map('strip_tags', array_keys($_POST[$name]));
		proofread_bot_update_setting( $user_id, proofread_bot_sanitize($name), implode( ',', $copy )  );
	}
	else {
		proofread_bot_update_setting( $user_id, proofread_bot_sanitize($name), '');
	}
	
	return;
}
