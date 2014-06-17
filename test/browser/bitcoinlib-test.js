$(document).ready(function(){ 
	
	function testSignatureVerifyBitcoin(){
		var address = "1H7RFM1C5UCPSyoNwimhMa9Ntz82iib8uY";
		var signature = "HGMEQWMZFL7O1D14YejfMSQPe8iEJs9mlYiKLhT+0cjQs1wWKYd9CdSLh1Pc/fcKkDV0Kmk7mLoVfYnQ0vbiDrA=";
		var message = "00000000000000000a94cd53c34e2cdfd2b7eab95e7b2d948e5ad200d863bcd4|Airbex Btc Asset";	
		var res = Bitcoin.Message.verifyBase64(address, signature, message);
		$('#testVerifySignatureBitcoin').text(res ? "OK": "KO")
	}
	
	testSignatureVerifyBitcoin();
	
})
