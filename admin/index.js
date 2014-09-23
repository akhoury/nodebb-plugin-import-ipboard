
var	fs = require('fs-extra'),
    marked = require('marked'),
    path = require('path'),
    pkg = fs.readJsonSync(path.join(__dirname + '/../package.json')),
    nbbId = pkg.name.replace(/nodebb-plugin-/, ''),
    prefix = '/admin/plugins/' + nbbId,
    apiPrefix = '/api' + prefix,
    note = '<h1 style="color:red;">This plugin is not designed to work from this Admin Panel. Please uninstall it, '
        + 'then install <a target="_blank" href="https://github.com/akhoury/nodebb-plugin-import">nodebb-plugin-import</a> '
        + 'and choose the correct source exporter from the available list</h1><br/><br/><h1>README.md:</h1><br/>',

    Plugin = {
        admin: {
            menu: function(custom_header, callback) {
                custom_header.plugins.push({
                    "route": '/plugins/' + nbbId,
                    "icon": 'fa-ban',
                    "name": nbbId
                });

                return callback(null, custom_header);
            },

            load: function(app, middleware, controllers, callback) {
                var render = function(req, res, next) {
                    return res.render('admin/plugins/' + nbbId);
                };

                app.get(prefix, middleware.admin.buildHeader, render);
                app.get(apiPrefix, render);

                fs.readFile(path.join(__dirname, '/../README.md'), function (err, tpl) {

                    marked(tpl.toString(), function (err, content) {
                        if (err) {
                            console.warn(pkg.name, err);
                        }
                        content = note + (content || '');
                        fs.writeFile(path.join(__dirname, '/../public/templates/admin/plugins/' + nbbId + '.tpl'), content, {encoding: 'utf-8'}, function(err) {
                            if (err) {
                                console.warn(pkg.name, err);
                            }
                            callback();
                        });
                    });
                });
            }
        }
    };

module.exports = Plugin;
