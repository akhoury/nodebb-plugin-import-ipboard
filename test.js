var fs = require('fs-extra');

require('./index').testrun({
    dbhost: 'localhost',
    dbport: 3306,
    dbname: 'ipb',
    dbuser: 'user',
    dbpass: 'password',

    tablePrefix: 'ipb_'
}, function(err, results) {
	results.forEach(function(r, i) {
		console.log(i, r && Object.keys(r).length);
	});
    // fs.writeFileSync('./tmp.json', JSON.stringify(results, undefined, 2));
});