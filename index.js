
var async = require('async');
var mysql = require('mysql');
var _ = require('underscore');
var fs = require('fs-extra');
var noop = function(){};
var pkg = fs.readJsonSync('./package.json');
var name = pkg.id.replace(/nodebb-plugin-import-/, '');
var logPrefix = '[' + pkg.id + ']';

(function(Exporter) {

    Exporter.setup = function(config, callback) {
        Exporter.log('setup');

        // mysql db only config
        // extract them from the configs passed by the nodebb-plugin-import adapter
        var _config = {
            host: config.dbhost || config.host || 'localhost',
            user: config.dbuser || config.user || 'root',
            password: config.dbpass || config.pass || config.password || '',
            port: config.dbport || config.port || 3306,
            database: config.dbname || config.name || config.database || name
        };

        Exporter.log(_config);

        Exporter.config(_config);
        Exporter.config('prefix', config.prefix || config.tablePrefix || pkg._tablePrefix || '');

        Exporter.connection = mysql.createConnection(_config);
        Exporter.connection.connect();

        callback(null, Exporter.config());
    };

    Exporter.getUsers = function(callback) {
        Exporter.log('getUsers');
        callback = !_.isFunction(callback) ? noop : callback;

        var err;
        var prefix = Exporter.config('prefix');
        var startms = +new Date();

        /* REPLACE QUERY */
        var query = 'SELECT ';

        if (!Exporter.connection) {
            err = {error: 'MySQL connection is not setup. Run setup(config) first'};
            Exporter.error(err.error);
            return callback(err);
        }

        Exporter.connection.query(query,
            function(err, rows) {
                if (err) {
                    Exporter.error(err);
                    return callback(err);
                }

                //normalize here
                var map = {};
                rows.forEach(function(row) {
                    if (row._username && row._email) {

                        // nbb forces signatures to be less than 150 chars
                        // keeping it HTML see https://github.com/akhoury/nodebb-plugin-import#markdown-note
                        row._signature = Exporter.truncateStr(row._signature || '', 150);

                        // from unix timestamp (s) to JS timestamp (ms)
                        row._joindate = ((row._joindate || 0) * 1000) || startms;

                        // lower case the email for consistency
                        row._email = row._email.toLowerCase();

                        // I don't know about you about I noticed a lot my users have incomplete urls, urls like: http://
                        row._picture = Exporter.validateUrl(row._picture);
                        row._website = Exporter.validateUrl(row._website);

                        map[row._uid] = row;
                    } else {
                        var requiredValues = [row._username, row._email];
                        var requiredKeys = ['_username','_email'];
                        var falsyIndex = Exporter.whichIsFalsy(requiredValues);

                        Exporter.warn('Skipping user._uid: ' + row._uid + ' because ' + requiredKeys[falsyIndex] + ' is falsy. Value: ' + requiredValues[falsyIndex]);

                    }
                });

                // keep a copy of the users in memory here
                Exporter._users = map;

                callback(null, map);
            });
    };

    Exporter.getCategories = function(callback) {
        Exporter.log('getCategories');
        callback = !_.isFunction(callback) ? noop : callback;

        var err;
        var prefix = Exporter.config('prefix');
        var startms = +new Date();

        /* REPLACE QUERY */
        var query = 'SELECT ';

        if (!Exporter.connection) {
            err = {error: 'MySQL connection is not setup. Run setup(config) first'};
            Exporter.error(err.error);
            return callback(err);
        }

        Exporter.connection.query(query,
            function(err, rows) {
                if (err) {
                    Exporter.error(err);
                    return callback(err);
                }

                //normalize here
                var map = {};
                rows.forEach(function(row) {
                    if (row._name) {
                        row._description = row._description || 'No decsciption available';
                        row._timestamp = ((row._timestamp || 0) * 1000) || startms;

                        map[row._cid] = row;
                    } else {
                        Exporter.warn('Skipping category._cid:' + row._cid + ' because category._name=' + row._name + ' is invalid');
                    }
                });

                // keep a copy in memory
                Exporter._categories = map;

                callback(null, map);
            });
    };

    Exporter.getTopics = function(callback) {
        Exporter.log('getTopics');
        callback = !_.isFunction(callback) ? noop : callback;

        var err;
        var prefix = Exporter.config('prefix');
        var startms = +new Date();

        /* REPLACE QUERY */
        var query = 'SELECt ';

        if (!Exporter.connection) {
            err = {error: 'MySQL connection is not setup. Run setup(config) first'};
            Exporter.error(err.error);
            return callback(err);
        }

        Exporter.connection.query(query,
            function(err, rows) {
                if (err) {
                    Exporter.error(err);
                    return callback(err);
                }

                //normalize here
                var map = {};
                var msg = 'You must run getCategories() before you can getTopics()';

                if (!Exporter._categories) {
                    err = {error: 'Categories are not in memory. ' + msg};
                    Exporter.error(err.error);
                    return callback(err);
                }

                rows.forEach(function(row) {
                    if (Exporter._categories[row._cid]) {

                        row._title = row._title ? row._title[0].toUpperCase() + row._title.substr(1) : 'Untitled';
                        row._timestamp = ((row._timestamp || 0) * 1000) || startms;

                        map[row._tid] = row;
                    } else {
                        var requiredValues = [Exporter._categories[row._cid]];
                        var requiredKeys = ['category'];
                        var falsyIndex = Exporter.whichIsFalsy(requiredValues);

                        Exporter.warn('Skipping topic._tid: ' + row._tid + ' because ' + requiredKeys[falsyIndex] + ' is falsy. Value: ' + requiredValues[falsyIndex]);
                    }
                });

                // keep a copy in memory
                Exporter._topics = map;

                callback(null, map);
            });
    };

    Exporter.getPosts = function(callback) {
        Exporter.log('getPosts');
        callback = !_.isFunction(callback) ? noop : callback;

        var err;
        var prefix = Exporter.config('prefix');
        var startms = +new Date();

        /* REPLACE QUERY */
        var query = 'SELECT ';

        if (!Exporter.connection) {
            err = {error: 'MySQL connection is not setup. Run setup(config) first'};
            Exporter.error(err.error);
            return callback(err);
        }

        Exporter.connection.query(query,
            function(err, rows) {
                if (err) {
                    Exporter.error(err);
                    return callback(err);
                }

                //normalize here
                var map = {};
                var msg = 'You must run getTopics() before you can getPosts()';

                if (!Exporter._topics) {
                    err = {error: 'Topics are not in memory. ' + msg};
                    Exporter.error(err.error);
                    return callback(err);
                }

                rows.forEach(function(row) {
                    if (Exporter._topics[row._tid] && row._content) {
                        row._timestamp = ((row._timestamp || 0) * 1000) || startms;
                        map[row._tid] = row;
                    } else {
                        var requiredValues = [Exporter._topics[row._tid], row._content];
                        var requiredKeys = ['topic', 'content'];
                        var falsyIndex = Exporter.whichIsFalsy(requiredValues);

                        Exporter.warn('Skipping post._pid: ' + row._pid + ' because ' + requiredKeys[falsyIndex] + ' is falsy. Value: ' + requiredValues[falsyIndex]);
                    }
                });

                callback(null, map);
            });
    };

    Exporter.teardown = function(callback) {
        Exporter.log('teardown');
        Exporter.connection.end();

        Exporter.log('Done');
        callback();
    };

    Exporter.testrun = function(config, callback) {
        async.series([
            function(next) {
                Exporter.setup(config, next);
            },
            function(next) {
                Exporter.getUsers(next);
            },
            function(next) {
                Exporter.getCategories(next);
            },
            function(next) {
                Exporter.getTopics(next);
            },
            function(next) {
                Exporter.getPosts(next);
            },
            function(next) {
                Exporter.teardown(next);
            }
        ], callback);
    };

    Exporter.warn = function() {
        var args = _.toArray(arguments);
        args.unshift(logPrefix);
        console.warn.apply(console, args);
    };

    Exporter.log = function() {
        var args = _.toArray(arguments);
        args.unshift(logPrefix);
        console.log.apply(console, args);
    };
    
    Exporter.error = function() {
        var args = _.toArray(arguments);
        args.unshift(logPrefix);
        console.error.apply(console, args);
    };

    Exporter.config = function(config, val) {
        if (config != null) {
            if (typeof config === 'object') {
                Exporter._config = config;
            } else if (typeof config === 'string') {
                if (val != null) {
                    Exporter._config = Exporter._config || {};
                    Exporter._config[config] = val;
                }
                return Exporter._config[config];
            }
        }
        return Exporter._config;
    };

    // from Angular https://github.com/angular/angular.js/blob/master/src/ng/directive/input.js#L11
    Exporter.validateUrl = function(url) {
        var pattern = /^(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/;
        return url && url.length < 2083 && url.match(pattern) ? url : '';
    };

    Exporter.truncateStr = function(str, len) {
        if (typeof str != 'string') return str;
        len = _.isNumber(len) && len > 3 ? len : 20;
        return str.length <= len ? str : str.substr(0, len - 3) + '...';
    };

    Exporter.whichIsFalsy = function(arr) {
        for (var i = 0; i < arr.length; i++) {
            if (!arr[i])
                return i;
        }
        return null;
    };

})(module.exports);
