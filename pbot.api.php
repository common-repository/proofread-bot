<?php
	
	function PBot_check_api($text) {
		
		if (strpos($text,'&lt;p&gt;') !== false) {
			$text = htmlspecialchars_decode($text);
		}
		
		//print  mb_detect_encoding($text);
		
		//$text = htmlentities($text);
		//	$text = html_entity_decode($text);
		// if text contains &lt;p&gt;
		
		//fix corrupted encoding characters...
		// may need to revisit this if I introduce other languages...
		//$text = mb_convert_encoding($text, 'UTF-8', 'UTF-8');
		
		
		//print_r($text);
		//die;
		
		$options = get_option('PBot_options');
		
		$api = new DrupalREST_pbot('http://proofreadbot.com/server/', $options['proofread_bot_username'], $options['proofread_bot_password'], TRUE);
		
		//print_r($api);
		
		$node = new stdClass();
		$node->type = 'proofreading';
		
		$node->body["und"][0]["value"] = $text;
		
		//2 for filtered_html
		$node->body["und"][0]["format"] = "filtered_html";
		
		$api->login();
		
		//session is set to "=" if login failed :D, kind of hackish
		//print_r($api);
		if ($options['proofread_bot_username'] && $options['proofread_bot_password'] && $api->session == "=")  {
			//return "Login failed to proofreadbot.com, please check your Proofread Bot username and password in the <a href=\"". home_url()."/wp-admin/options-general.php?page=proofread-bot/PBot.php\">plugin admin screen</a>.";
			return "Login failed to proofreadbot.com, please check your Proofread Bot username and password at the Plugin settings (click configure on the Plugins screen).";
		}
		
		$result = $api->createNode(array('node' => $node));
		
		//lets test this crappy encoding issue...	
		//$result = $api->retrieveNode("717774");
		
		$result_body = json_decode($result->body);

		if ($result->ErrorCode && $result->body) {
			$form_error = json_decode($result->body);
			//print_r($result_body);
			return addslashes($form_error->form_errors->content);
			//result body without json is only used for system errors?
			//return $result->body;
		}
		else {
			$node = $api->retrieveNode($result->nid);
			
			/*
				print "<pre>";
				print_r($node);
				print "</pre>";
			*/
			return $node;
		}
	}
	
	class DrupalREST_pbot {
		var $username;
		var $password;
		var $session;
		var $endpoint;
		var $debug;
		
		function __construct($endpoint, $username, $password, $debug)
		{
			$this->username = $username;
			$this->password = $password;
			//TODO: Check for trailing slash and fix if needed
			$this->endpoint = $endpoint;
			$this->debug = $debug;
		}
		
		function login()
		{
			$ch = curl_init($this->endpoint . 'user/login.json');
			$post_data = array(
			'username' => $this->username,
			'password' => $this->password,
			);
			$post = http_build_query($post_data, '', '&');
			curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);			
			curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
			curl_setopt($ch, CURLOPT_HEADER, false);
			curl_setopt($ch, CURLOPT_POST, true);
			curl_setopt($ch, CURLOPT_POSTFIELDS, $post);
			curl_setopt($ch, CURLOPT_HTTPHEADER,array (
            "Accept: application/json",
            "Content-type: application/x-www-form-urlencoded"
			));
			$response = json_decode(curl_exec($ch));
			//Save Session information to be sent as cookie with future calls
			$this->session = $response->session_name . '=' . $response->sessid;

			// GET CSRF Token
			curl_setopt_array($ch, array(
			CURLOPT_RETURNTRANSFER => 1,
			CURLOPT_URL => 'http://proofreadbot.com/services/session/token',
			));
			curl_setopt($ch, CURLOPT_COOKIE, "$this->session"); 
			// $csrf_token = curl_exec($ch);
			//print_r($csrf_token);
			
			$ret = new stdClass;
			
			$ret->response = curl_exec($ch);
			$ret->error    = curl_error($ch);
			$ret->info     = curl_getinfo($ch);
			
			//curl_close($ch);
			
			//print_r($ret->response);
			$this->csrf_token = $ret->response;
		}
		
		// Retrieve a node from a node id
		function retrieveNode($nid)
		{
			//Cast node id as integer
			$nid = (int) $nid;
			$ch = curl_init($this->endpoint . 'node/' . $nid );
			curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);			
			curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
			curl_setopt($ch, CURLOPT_HEADER, TRUE);
			curl_setopt($ch, CURLINFO_HEADER_OUT, TRUE);
			curl_setopt($ch, CURLOPT_HTTPHEADER,array (
			"Accept: application/json",
			"Cookie: $this->session"
			));
			$result = $this->_handleResponse($ch);
			
			curl_close($ch);
			
			return $result;
		}
		
		function createNode($node)
		{
			$post = http_build_query($node, '', '&');
			$ch = curl_init($this->endpoint . 'node/');
			curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);			
			curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);
			curl_setopt($ch, CURLOPT_HEADER, TRUE);
			curl_setopt($ch, CURLOPT_POST, TRUE);
			curl_setopt($ch, CURLOPT_POSTFIELDS, $post);
			curl_setopt($ch, CURLOPT_HTTPHEADER,
			array (
			"Accept: application/json",
			"Content-type: application/x-www-form-urlencoded",
			"Cookie: $this->session",
			'X-CSRF-Token: ' .$this->csrf_token
			));
			
			$result = $this->_handleResponse($ch);
			
			curl_close($ch);
			
			return $result;
		}
		
		// Private Helper Functions
		private function _handleResponse($ch)
		{
			$response = curl_exec($ch);
			$info = curl_getinfo($ch);
			
			//break apart header & body
			$header = substr($response, 0, $info['header_size']);
			$body = substr($response, $info['header_size']);
			
			$result = new stdClass();
			
			if ($info['http_code'] != '200')
			{
				$header_arrray = explode("\n",$header);
				$result->ErrorCode = $info['http_code'];
				$result->ErrorText = $header_arrray['0'];
				} else {
				$result->ErrorCode = NULL;
				$decodedBody= json_decode($body);
				$result = (object) array_merge((array) $result, (array) $decodedBody );
			}
			
			if ($this->debug)
			{
				$result->header = $header;
				$result->body = $body;
			}
			
			return $result;
		}
	}

	
?>