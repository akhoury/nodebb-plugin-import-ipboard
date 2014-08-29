
var	fs = require('fs-extra'),
	marked = require('marked'),
	path = require('path'),

	ImportUbb = {
		admin: {
			menu: function(custom_header) {
				custom_header.plugins.push({
					"route": '/plugins/import-ubb',
					"icon": 'icon-edit',
					"name": 'ImportUbb'
				});

				return custom_header;
			},
			route: function(custom_routes, callback) {
				fs.readFile(path.join(__dirname, '../README.md'), function(err, tpl) {
					marked(tpl.toString(), function(err, content){
						if (err) throw err;

						custom_routes.routes.push({
							route: '/plugins/import-ubb',
							method: "get",
							options: function(req, res, callback) {
								callback({
									req: req,
									res: res,
									route: '/plugins/import-ubb',
									name: ImportUbb,
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

module.exports = ImportUbb;