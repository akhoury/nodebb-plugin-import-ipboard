
var	fs = require('fs-extra'),
	marked = require('marked'),
	path = require('path'),
	pkg = fs.readJsonSync(path.join(__dirname + '/../package.json')),
    	nbbId = pkg.name.replace(/nodebb-plugin-/, ''),
	Plugin = {
		admin: {
			menu: function(custom_header) {
				custom_header.plugins.push({
					"route": '/plugins/' + nbbId,
					"icon": 'icon-edit',
					"name": nbbId
				});

				return custom_header;
			},
			route: function(custom_routes, callback) {
				fs.readFile(path.join(__dirname, '../README.md'), function(err, tpl) {
					marked(tpl.toString(), function(err, content){
						if (err) throw err;

						custom_routes.routes.push({
							route: '/plugins/' + nbbId,
							method: "get",
							options: function(req, res, callback) {
								callback({
									req: req,
									res: res,
									route: '/plugins/' + nbbId,
									name: Plugin,
									content: content
								});
							}
						});

						callback(null, custom_routes);
					});
				});
			}
		}
	};

module.exports = Plugin;
