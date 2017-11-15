var noble = require('noble');

noble.on('stateChange', function(state) {	
	if (state === 'poweredOn') 
	{
		console.log('ok');
		var uuid = [];
		
   		 noble.startScanning(uuid, false);
	}
 	else
	{
    		noble.stopScanning();
		console.log('nok');
	}
});


noble.on('discover', function(peripheral) {
    console.log('Found device with local name: ' + peripheral.advertisement.localName);
    console.log('advertising the following service uuid\'s: ' + peripheral.advertisement.serviceUuids);
    console.log();
});
