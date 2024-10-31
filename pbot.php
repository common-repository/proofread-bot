<?php
/*		Plugin Name: Proofread Bot
		Plugin URI: http://proofreadbot.com
		Description: Grammar, style and plagiarism checker
		Version: 2.2.3
		Author: Gyorgy Chityil
		Author URI: http://proofreadbot.com
*/

include('pbot.api.php');


add_action( 'proofread_bot', 'PBot_load' );

function PBot_load() {
	Jetpack::enable_module_configurable( __FILE__ );
	Jetpack::module_configuration_load( __FILE__, 'PBot_configuration_load' );
}

function PBot_configuration_load() {
	wp_safe_redirect( get_edit_profile_url( get_current_user_id() ) . '#PBot' );
	exit;
}


/*
		*  Load necessary include files
	*/
include( 'config-options.php' );
include( 'utils.php' );
include( 'proxy.php' );


define('PBot_VERSION', '20120221');

/**
 * Update a user's PBot setting
 */
function PBot_update_setting( $user_id, $name, $value ) {
	update_user_meta( $user_id, $name, $value );
}

/**
 * Retrieve a user's PBot Setting
 */
function PBot_get_setting( $user_id, $name, $single = true ) {
	return get_user_meta( $user_id, $name, $single );
}

/*
 * Display the PBot configuration options
 */
function PBot_config() {
	PBot_display_options_form();
	PBot_display_unignore_form();
}

/*
 *  Code to update the toolbar with the PBot Button and Install the PBot TinyMCE Plugin
	*/
function PBot_addbuttons() {
	/* Don't bother doing this stuff if the current user lacks permissions */
	if ( ! PBot_is_allowed() )
	return;
	
	if ( ! defined( 'PBot_TINYMCE_4' ) ) {
		define( 'PBot_TINYMCE_4', ( ! empty( $GLOBALS['tinymce_version'] ) && substr( $GLOBALS['tinymce_version'], 0, 1 ) >= 4 ) );
	}

	/* Add only in Rich Editor mode */
	if ( get_user_option( 'rich_editing' ) == 'true' ) {
		add_filter( 'mce_external_plugins', 'add_PBot_tinymce_plugin' );
		add_filter( 'mce_buttons', 'register_PBot_button' );
	}
	
	//add_action( 'personal_options_update', 'PBot_process_options_update' );
	//add_action( 'personal_options_update', 'PBot_process_unignore_update' );
	//add_action( 'profile_personal_options', 'PBot_config' );
}


/*
		* Hook into the TinyMCE buttons and replace the current spellchecker
	*/
function register_PBot_button( $buttons ) {
	if ( PBot_TINYMCE_4 ) {
		// Use the default icon in TinyMCE 4.0 (replaced by dashicons in editor.css)
		if ( ! in_array( 'proofread_bot', $buttons, true ) ) {
			$buttons[] = 'proofread_bot';
		}

		return $buttons;
	}
	
	/* kill the spellchecker.. don't need no steenkin PHP spell checker */
	foreach ( $buttons as $key => $button ) {
		if ( $button == 'proofread_bot' ) {
			$buttons[$key] = 'PBot';
			return $buttons;
			}
	}
	
	/* hrm... ok add us last plz */
	array_push( $buttons, '|', 'PBot' );
	
	return $buttons;
}

/*
 * Load the TinyMCE plugin : editor_plugin.js (TinyMCE 3.x) | plugin.js (TinyMCE 4.0)
	*/
function add_PBot_tinymce_plugin( $plugin_array ) {
	$plugin = PBot_TINYMCE_4 ? 'plugin_v4' : 'plugin_v3';

	$plugin_array['PBot'] = plugins_url( '/tinymce/' . $plugin . '.js?v=' . PBot_VERSION, __FILE__ );
	return $plugin_array;
}

/*
		* Update the TinyMCE init block with PBot specific settings
	*/
function PBot_change_mce_settings( $init_array ) {
	if ( ! PBot_is_allowed() )
		return $init_array;
	
	$user = wp_get_current_user();
	
	$init_array['PBot_rpc_url']        = admin_url( 'admin-ajax.php?action=proxy_PBot&_wpnonce=' . wp_create_nonce( 'proxy_PBot' ) . '&url=' );
	$init_array['PBot_ignore_rpc_url'] = admin_url( 'admin-ajax.php?action=PBot_ignore&_wpnonce=' . wp_create_nonce( 'PBot_ignore' ) . '&phrase=' );
	$init_array['PBot_rpc_id']         = 'WPORG-' . md5(get_bloginfo('wpurl'));
	$init_array['PBot_theme']          = 'wordpress';
	$init_array['PBot_ignore_enable']  = 'true';
	$init_array['PBot_strip_on_get']   = 'true';
	$init_array['PBot_ignore_strings'] = json_encode( explode( ',',  PBot_get_setting( $user->ID, 'PBot_ignored_phrases' ) ) );
	$init_array['PBot_show_types']     = PBot_get_setting( $user->ID, 'PBot_options' );
	$init_array['gecko_spellcheck']   = 'false';
	
	return $init_array;
}



/*
		* Sanitizes PBot AJAX data to acceptable chars, caller needs to make sure ' is escaped
	*/
function PBot_sanitize( $untrusted ) {
	return preg_replace( '/[^a-zA-Z0-9\-\',_ ]/i', "", $untrusted );
}

/*
		* PBot HTML Editor Stuff
	*/

function PBot_settings() {
	$user = wp_get_current_user();
	
	header( 'Content-Type: text/javascript' );
	
	/* set the RPC URL for PBot */
	echo "PBot.rpc = " . json_encode( esc_url_raw( admin_url( 'admin-ajax.php?action=proxy_PBot&_wpnonce=' . wp_create_nonce( 'proxy_PBot' ) . '&url=' ) ) ) . ";\n";
	
	/* set the API key for PBot */
	echo "PBot.api_key = " . json_encode( 'WPORG-' . md5( get_bloginfo( 'wpurl' ) ) ) . ";\n";
	
	/* set the ignored phrases for PBot */
	echo "PBot.setIgnoreStrings(" . json_encode( PBot_get_setting( $user->ID, 'PBot_ignored_phrases' ) ) . ");\n";
	
	/* honor the types we want to show */
	echo "PBot.showTypes(" . json_encode( PBot_get_setting( $user->ID, 'PBot_options' ) ) .");\n";
	
	/* this is not an PBot/jQuery setting but I'm putting it in PBot to make it easy for the non-viz plugin to find it */
	$admin_ajax_url = admin_url( 'admin-ajax.php?action=PBot_ignore&_wpnonce=' . wp_create_nonce( 'PBot_ignore' ) . '&phrase=' );
	echo "PBot.rpc_ignore = " . json_encode( esc_url_raw( $admin_ajax_url ) ) . ";\n";
	
	die;
}

function PBot_load_javascripts() {
	if ( PBot_should_load_on_page() ) {
		wp_enqueue_script( 'PBot_core', WP_PLUGIN_URL . '/proofread-bot/pbot.core.js', array() );
		//wp_enqueue_script( 'PBot_quicktags', WP_PLUGIN_URL . '/proofread-bot/PBot-nonvis-editor-plugin.js', array('quicktags') );
		//wp_enqueue_script( 'PBot_jquery', WP_PLUGIN_URL . '/proofread-bot/jquery.PBot.js', array('jquery') );
		//wp_enqueue_script( 'PBot_settings', admin_url() . 'admin-ajax.php?action=PBot_settings', array('PBot_jquery') );
		//wp_enqueue_script( 'PBot_autoproofread', WP_PLUGIN_URL . '/proofread-bot/PBot-autoproofread.js', array('PBot_jquery') );
		// A style available in WP               
		wp_enqueue_style (  'wp-jquery-ui-dialog');
		wp_enqueue_script('jquery-ui-dialog');
		wp_enqueue_style('jquery-style', 'http://ajax.googleapis.com/ajax/libs/jqueryui/1.8.1/themes/smoothness/jquery-ui.css'); 
	}
}


/* Spits out user options for auto-proofreading on publish/update */
function PBot_load_submit_check_javascripts() {
	global $pagenow;
	
	$user = wp_get_current_user();
	if ( ! $user || $user->ID == 0 )
	return;
	
	if ( PBot_should_load_on_page() ) {
		$PBot_check_when = PBot_get_setting( $user->ID, 'PBot_check_when' );

		if ( !empty( $PBot_check_when ) ) {
			$check_when = array();
			/* Set up the options in json */
			foreach( explode( ',', $PBot_check_when ) as $option ) {
				$check_when[$option] = true;
			}
			echo '<script type="text/javascript">' . "\n";
			echo 'PBot_check_when = ' . json_encode( (object) $check_when ) . ";\n";
			echo '</script>' . "\n";
		}
	}
}

/*
 * Check if a user is allowed to use PBot
 */
function PBot_is_allowed() {
	$user = wp_get_current_user();
	if ( ! $user || $user->ID == 0 )
	return;
	
        if ( ! current_user_can( 'edit_posts' ) && ! current_user_can( 'edit_pages' ) )
	return;
	
	return 1;
}

function PBot_load_css() {
	if ( PBot_should_load_on_page() )
	wp_enqueue_style( 'PBot_style', WP_PLUGIN_URL . '/proofread-bot/pbot.css', null, '1.0', 'screen' );
}

/* Helper used to check if javascript should be added to page. Helps avoid bloat in admin */
function PBot_should_load_on_page() {
	global $pagenow, $current_screen;
	
	//$pages = array('post.php', 'post-new.php', 'page.php', 'page-new.php', 'admin.php', 'profile.php');
	$pages = array('post.php', 'post-new.php', 'page.php', 'page-new.php', 'admin.php', 'profile.php', 'widgets.php');
	
	if ( in_array( $pagenow, $pages ) ) {
		if ( isset( $current_screen->post_type ) && $current_screen->post_type ) {
			return post_type_supports( $current_screen->post_type, 'editor' );
		}
	return true;
	}
	
	return apply_filters( 'PBot_load_scripts', false );
}

// add button to DFW
add_filter( 'wp_fullscreen_buttons', 'PBot_fullscreen' );
function PBot_fullscreen($buttons) {
	$buttons['proofread_bot'] = array( 'title' => __( 'Proofread Writing', '' ), 'onclick' => "tinyMCE.execCommand('PBot_mceWritingImprovementTool');", 'both' => false );
	return $buttons;
}

/* add some vars into the PBot plugin */
add_filter( 'tiny_mce_before_init', 'PBot_change_mce_settings' );

/* load some stuff for non-visual editor */
add_action( 'admin_enqueue_scripts', 'PBot_load_javascripts' );
//add_action( 'admin_enqueue_scripts', 'PBot_load_submit_check_javascripts' );
add_action( 'admin_enqueue_scripts', 'PBot_load_css' );

/* init process for button control */
add_action( 'init', 'PBot_addbuttons' );

/* setup hooks for our PHP functions we want to make available via an AJAX call */
add_action( 'wp_ajax_proxy_PBot', 'PBot_redirect_call' );
add_action( 'wp_ajax_PBot_ignore', 'PBot_ignore_call' );
add_action( 'wp_ajax_PBot_settings', 'PBot_settings' );



// TINYMCE END


/*
		* Set up options, convert old options, add filters if automatic display is enabled, and enqueue scripts
		* @uses get_option, update_option, add_filter, wp_enqueue_script
		* @return null
	*/

/* Define the custom box */
add_action( 'add_meta_boxes', 'PBot_add_custom_box' );


/* Adds a box to the main column on the Post and Page edit screens */
function PBot_add_custom_box() {
	
	add_meta_box( 
	'PBot',
	__( 'Proofread Bot Report', 'PBot_textdomain' ),
	'PBot_inner_custom_box',
	'post' 
	);
	
	add_meta_box( 
	'PBot',
	__( 'Proofread Bot Report', 'PBot_textdomain' ),
	'PBot_inner_custom_box',
	'page'
	);
}

/* Prints the box content */
function PBot_inner_custom_box( $post ) {
	
	// Use nonce for verification
	wp_nonce_field( plugin_basename( __FILE__ ), 'PBot_noncename' );
	
	// The actual fields for data entry
	//echo '<label for="PBot_new_field">';
	//_e("Proofread Bot results will appear here", 'PBot_textdomain' );
	//echo '</label> ';
	echo '<button type="button"  id="PBot-submit" onclick="return false;">Get your Proofread Bot Report</button>
		<div id="PBot_result"></div>';
	echo '<script>        
		jQuery(document).ready(function(){
		
		//console.log(tinyMCE.activeEditor.getContent(content));
		
		jQuery("#PBot-submit").click(function(event){
		var PBot_text;
		
		// standard tinymce
		if (jQuery("#content_ifr").contents().find("#tinymce").html() !== "")
		PBot_text = jQuery("#content_ifr").contents().find("#tinymce").html();
		
		// tinymce advanced
		if (jQuery("#content").html() !== "")
		PBot_text = jQuery("#content").html();
		
		if (PBot_text === null || PBot_text === ""  || PBot_text === "undefined"  || PBot_text === "<p><br data-mce-bogus=\"1\"></p>" || PBot_text === "<p><br></p>" )
		{
		jQuery("#PBot-submit").after("<br/>Failed to get text from editor, please try switching to \"Visual\" if you use TinyMCE Advanced or report the issue at http://proofreadbot.com/support-forum mentioning your Wysiwyg extension, such as CKEditor etc...");
		}
		else
		{
		jQuery("#PBot-submit").after("<div id=\"PBot_throbber\"><img src=\"'. WP_PLUGIN_URL.'/proofread-bot/throbber.gif\" /> Fetching report, may take a few seconds...</div>");
		
		var data = {
		action: \'post_check_PBot\',
		"text": PBot_text
		};
		
		// since 2.8 ajaxurl is always defined in the admin header and points to admin-ajax.php
		jQuery.post(ajaxurl, data, function(response) {
		jQuery("#PBot-submit").after(response);
		jQuery("#PBot_throbber").remove(); 
		});	
		}
		});
		});
		</script>';
}

// AJAX
add_action('wp_ajax_post_check_PBot', 'PBot_post_ajax_check');

function PBot_post_ajax_check()
{   
	$post = $_POST['text'];
	
	if(current_user_can('check_PBot'))
	{
		//if (strpos($post, "&lt;") !== 'false')
		//	$post = html_entity_decode($post);
		
		//print_r($post);
		//die;
		
		$node = PBot_check_api($post);
		if(isset($node->field_html_report_text)) {
		print_r($node->field_html_report_text->und[0]->value);
		}
		else {
		print_r($node);
		}
	}
	
	
	die();
}


function PBot_setup() {
	//Add filters if set to automatic display
	add_filter( 'the_content', 'PBot_auto' );
	//if( $options[ 'display' ] == 1 && $options[ 'content-excerpt' ] == 1 ) add_filter( 'the_excerpt', 'PBot_auto' );
}
add_action( 'plugins_loaded', 'PBot_setup' );


function PBot_auto( $content ) {
	global $post;
	$options = get_option('PBot_options');
	//print_r($options);
	
	$button_link="http://www.proofreadbot.com";
	if(strlen($options['PBot_affiliate_id']) > 0) 
	{
		$button_link="http://".$options['PBot_affiliate_id'].".proofbot.hop.clickbank.net/\" rel=\"nofollow";
	}
	
	$button = "<a href=\"".$button_link."\" target=\"_blank\"><img src=\"". WP_PLUGIN_URL ."/proofread-bot/buttons/small_".$options["PBot_button"]."-button1-".$options["PBot_button_color"].".png\" /></a>";
	
	//print $button;
	
	//Add button to $content
	if( $options[ 'PBot_placement_posts' ] == true)  
	$content = $content . $button;
	
	
	return $content;
	
}

add_action('admin_menu', 'PBotoptions_add_page_fn');
// Add sub page to the Settings Menu
function PBotoptions_add_page_fn() {
	add_options_page('Proofread Bot', 'Proofread Bot', 'administrator', __FILE__, 'PBot_options_page');
}

function PBot_options_page() {
	?>
	<div class="wrap">
	<div class="icon32" id="icon-options-general"><br></div>
	<h2>Proofread Bot Options</h2>
	You can use Proofread Bot plugin without filling out the account details here, and you have 1 free proofread credit (600 words) per day. For more checks please <a href="http://proofreadbot.com/invite-your-friends" target="_blank">invite your friends <img src="<?php print WP_PLUGIN_URL ?>/proofread-bot/facebook.png" /></a> or <a href="http://proofreadbot.com/node/2">purchase a package</a>, 1 automated proofread credit = 1 friend invite or 0.01$ (1 cent).
	<form action="options.php" method="post">
	<?php settings_fields('PBot_options'); ?>
	<?php do_settings_sections(__FILE__); ?>
	<p class="submit">
	<input name="Submit" type="submit" class="button-primary" value="<?php esc_attr_e('Save Changes'); ?>" />
	</p>
	</form>
	</div>
	<?php
}

add_action('admin_init', 'PBotsoptions_init_fn' );
// Register our settings. Add the settings section, and settings fields
function PBotsoptions_init_fn(){
	register_setting('PBot_options', 'PBot_options', 'PBot_options_validate' );
	
	add_settings_section('main_section', 'Proofread Bot Account Details', 'PBot_section_text_fn', __FILE__);
	
	add_settings_field('proofread_bot_username', 'Proofread Bot Username', 'PBot_setting_username_fn', __FILE__, 'main_section');
	add_settings_field('proofread_bot_password', 'Proofread Bot Password', 'PBot_setting_password_fn', __FILE__, 'main_section');
	add_settings_field('min_user_level', 'Lowest Role that can check Proofread Bot', 'PBot_setting_role_fn', __FILE__, 'main_section');
	
	add_settings_section('button_section', 'Proofread Bot Button Settings', 'PBot_button_section_text_fn', __FILE__);
	
	add_settings_field('PBot_button', 'Select Button', 'PBot_setting_button_fn', __FILE__, 'button_section');
	add_settings_field('PBot_button_color', 'Select Button Color', 'PBot_setting_button_color_fn', __FILE__, 'button_section');
	// add_settings_field('PBot_button_placement_homepage', 'Show button on homepage', 'PBot_setting_button_placement_homepage_fn', __FILE__, 'button_section');
	add_settings_field('PBot_button_placement_posts', 'Show button on posts', 'PBot_setting_button_placement_posts_fn', __FILE__, 'button_section');
	
	add_settings_section('affiliate_section', 'Proofread Bot Affiliate Program - Make Money', 'PBot_affiliate_section_text_fn', __FILE__);
	add_settings_field('PBot_affiliate_id', 'Proofread Bot Affiliate Id', 'PBot_setting_affiliate_id_fn', __FILE__, 'affiliate_section');
	
	// add custom capability depending on settings
	$options = get_option('PBot_options');
	$min_role = $options ? $options['role'] : 'administrator' ;
	$roles = array('Administrator'=>'administrator', 'Editor'=>'editor', 'Author'=>'author', 'Contributor'=>'contributor');
	
	foreach($roles as $role=>$val)
	{
		$role = get_role($val);
		$role->add_cap( 'check_PBot' );
		
		if($val == $min_role)
		break;
	}
}

function PBot_section_text_fn()
{
	echo '<p>Enter your Proofread Bot account details.</p>';
}

function PBot_button_section_text_fn()
{
	echo '<p>Select optionally a button to show your visitors you care about grammar and style on your site! You can also make some money by participating in the Proofread Bot affiliate program.</p>';
}

function PBot_affiliate_section_text_fn()
{
	echo '<p>Make money by participating in the Proofread Bot affiliate program, powered by Clickbank. The button you selected will link with your clickbank id so referrals can be credited to you. If you don\'t have a clickbank id  get it  <a rel="nofollow" href="http://proofreadbot.com/affiliate/signup" target="_blank">here</a>, you will be taken to the Clickbank vendor / affiliate signup page. (Vendor and affiliate accounts are the same at Clickbank.)</p>';
}

function PBot_options_validate($input) {
	// Check our textbox option field contains no HTML tags - if so strip them out
	return $input; // return validated input
}

function PBot_setting_role_fn() {
	$options = get_option('PBot_options');
	$items = array('Administrator'=>'administrator', 'Editor'=>'editor', 'Author'=>'author', 'Contributor'=>'contributor');
	
	echo "<select id='PBot_role' name='PBot_options[role]'>";
	
	foreach($items as $item=>$value)
	{
		$selected = ($options['role']== $value ) ? 'selected="selected"' : '';
		echo "<option value='$value' $selected>$item</option>";
	}
	
	echo "</select>";
}

function PBot_setting_username_fn() {
	$options = get_option('PBot_options');
	echo "<input name='PBot_options[proofread_bot_username]' size='40' type='text' value='{$options['proofread_bot_username']}' />";
}

function PBot_setting_password_fn() {
	$options = get_option('PBot_options');
	echo "<input name='PBot_options[proofread_bot_password]' size='40' type='text' value='{$options['proofread_bot_password']}' />";
}

function PBot_setting_affiliate_id_fn() {
	$options = get_option('PBot_options');
	echo "<input name='PBot_options[PBot_affiliate_id]' size='40' type='text' value='{$options['PBot_affiliate_id']}' />";
}


function PBot_setting_button_fn() {
	$options = get_option('PBot_options');
	//print_r($options);
	?>
	<fieldset>
	<label><input name='PBot_options[PBot_button]' value='proofreadbot' type='radio' <?php if( !$options['PBot_button'] || $options['PBot_button']=='proofreadbot' ) echo ' checked="checked"'; ?>>
	<img src="<?php echo WP_PLUGIN_URL ?>/proofread-bot/buttons/small_proofreadbot-button1-light.png" /></label><br/>
	<label><input name='PBot_options[PBot_button]' value='perfect_grammar' type='radio' <?php if( !$options['PBot_button'] || $options['PBot_button']=='perfect_grammar' ) echo ' checked="checked"'; ?>>
	<img src="<?php echo WP_PLUGIN_URL ?>/proofread-bot/buttons/small_perfect_grammar-button1-light.png" /></label>
	</fieldset> 	
	<?php
}

function PBot_setting_button_color_fn() {
	$options = get_option('PBot_options');
	$items = array('Light'=>'light', 'Dark'=>'dark', 'Green'=>'green', 'Red'=>'red', 'Yellow'=>'yellow', 'Blue'=>'blue');
	
	echo "<select id='PBot_button_color' name='PBot_options[PBot_button_color]'>";
	
	foreach($items as $item=>$value)
	{
		$selected = ($options['PBot_button_color']== $value ) ? 'selected="selected"' : '';
		echo "<option value='$value' $selected>$item</option>";
	}
	
	echo "</select>";
}

function PBot_setting_button_placement_homepage_fn() {
	$options = get_option('PBot_options');
	if( $options['PBot_placement_homepage']== true) 
	$checked = 'checked="checked"';
	
	echo "<input name='PBot_options[PBot_placement_homepage]' type='checkbox' value='true' $checked />";
}

function PBot_setting_button_placement_posts_fn() {
	$options = get_option('PBot_options');
	
	if($options['PBot_placement_posts']== true )
	$checked = 'checked="checked"';
	
	echo "<input name='PBot_options[PBot_placement_posts]' type='checkbox' value='true' $checked />";
}


// Place in Option List on Settings > Plugins page 
function PBot_actlinks( $links, $file ) {
	//Static so we don't call plugin_basename on every plugin row.
	static $this_plugin;
	if ( ! $this_plugin ) $this_plugin = plugin_basename(__FILE__);
	
	if ( $file == $this_plugin ){
		$settings_link = '<a href="options-general.php?page=proofread-bot/pbot.php">' . __('Settings') . '</a>';
		array_unshift( $links, $settings_link ); // before other links
	}
	return $links;
}
add_filter("plugin_action_links", 'PBot_actlinks', 10, 2);

?>