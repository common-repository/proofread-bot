<?php
/*
 *  This script redirects AtD AJAX requests to the AtD service
 */

/* this function directly from akismet.php by Matt Mullenweg.  *props* */
function PBot_http_post( $request, $host, $path, $port = 80 ) {
        $http_request  = "POST $path HTTP/1.0\r\n";
        $http_request .= "Host: $host\r\n";
        $http_request .= "Content-Type: application/x-www-form-urlencoded\r\n";
        $http_request .= "Content-Length: " . strlen($request) . "\r\n";
        $http_request .= "User-Agent: AtD/0.1\r\n";
        $http_request .= "\r\n";
        $http_request .= $request;            

        $response = '';                 

        if( false != ( $fs = @fsockopen($host, $port, $errno, $errstr, 10) ) ) {                 
                fwrite( $fs, $http_request );

                while ( ! feof( $fs ) )
                        $response .= fgets( $fs );

                fclose( $fs );
                $response = explode( "\r\n\r\n", $response, 2 );
        }
        return $response;
}

/* 
 *  This function is called as an action handler to admin-ajax.php
 */
function PBot_redirect_call() {


	if ( $_SERVER['REQUEST_METHOD'] === 'POST' )
			$postText = trim(  file_get_contents( 'php://input' )  );
	
	parse_str($postText);

	//see what's in here
	//print_r($data);
	//die;
	

	
	$node = PBot_check_api($data);


	//header( 'Content-Type: text/xml;charset=utf8' );
	header('Content-type:application/xml;charset=utf-8');	
		
	$xml = "<xmldoc>";
	if ($node->field_html_report_text)
		{
		$xml .="<display>
				<![CDATA[";
		$xml .= preg_replace('/[^(\x20-\x7F)]*?/','', $node->field_html_report_text->und[0]->value);
		$xml .= "]]>
			</display>";
		$xml .= preg_replace('/[^(\x20-\x7F)]*?/','', $node->field_wysiwyg_report_text->und[0]->value);
		}
	else
		$xml .= "<message>
		<![CDATA["
				.$node."
			]]>
			</message>";
	$xml .= "</xmldoc>";

	print $xml;

	die();
}
