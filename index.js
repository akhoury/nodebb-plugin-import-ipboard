
var path = require('path');
var async = require('async');
var mysql = require('mysql');
var moment = require('moment');
var _ = require('underscore');
var fs = require('fs-extra');
var noop = function(){};
var pkg = fs.readJsonSync(path.join(__dirname, '/package.json'));
var name = pkg.name.replace(/nodebb-plugin-import-/, '');
var logPrefix = '[' + pkg.name + ']';

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

    // usually that's unecessary, but IP.Board's schema is a little different
    var getGroups = function(config, callback) {
        Exporter.log('getGroups');
        if (_.isFunction(config)) {
            callback = config;
            config = {};
        }
        callback = !_.isFunction(callback) ? noop : callback;
        if (!Exporter.connection) {
            Exporter.setup(config);
        }
        var prefix = Exporter.config('prefix');
        var query = 'SELECT '
            + prefix + 'groups.g_id as _gid, '
            + prefix + 'groups.g_view_board as _notbanned, ' // not sure, just making an assumption
            + prefix + 'groups.g_post_new_topics as _pending, ' // not sure, just making an assumption
            + prefix + 'groups.g_open_close_posts as _administrator, ' // not sure, just making an assumption
            + prefix + 'groups.g_is_supmod as _moderator ' // not sure, just making an assumption
            + ' from ' + prefix + 'groups ';
        Exporter.connection.query(query,
            function(err, rows) {
                if (err) {
                    Exporter.error(err);
                    return callback(err);
                }
                var map = {};
                rows.forEach(function(row) {
                    map[row._gid] = row;
                });
                // keep a copy of the users in memory here
                Exporter._groups = map;
                callback(null, map);
            });
    };

    Exporter.getUsers = function(callback) {
        return Exporter.getPaginatedUsers(0, -1, callback);
    };
    Exporter.getPaginatedUsers = function(start, limit, callback) {
        callback = !_.isFunction(callback) ? noop : callback;

        if (!Exporter.connection) {
            Exporter.setup(config);
        }

        var prefix = Exporter.config('prefix');
        var startms = +new Date();

        var query = 'SELECT ' + prefix + 'members.member_id as _uid, '
            + prefix + 'members.name as _username, '
            + prefix + 'members.members_display_name as _alternativeUsername, '
            + prefix + 'members.email as _email, '
            + prefix + 'members.member_group_id as _gid, '
            + prefix + 'members.joined as _joindate, '
            + prefix + 'members.title as _title, '
            + prefix + 'members.members_profile_views as _profileviews, '
            + 'CONCAT(' + prefix + 'members.bday_month, \'/\', ' + prefix + 'members.bday_day, \'/\', '  + prefix + 'members.bday_year)' + ' as _birthday '
            + ' from ' + prefix + 'members '
            + (start >= 0 && limit >= 0 ? 'LIMIT ' + start + ',' + limit : '');

        // _banned and _level are determined below

        getGroups(function(err, groups) {
            Exporter.connection.query(query,
                function(err, rows) {
                    if (err) {
                        Exporter.error(err);
                        return callback(err);
                    }

                    //normalize here
                    var map = {};
                    rows.forEach(function(row) {

                        // nbb forces signatures to be less than 150 chars
                        // keeping it HTML see https://github.com/akhoury/nodebb-plugin-import#markdown-note
                        row._signature = Exporter.truncateStr(row._signature || '', 150);
                        // from unix timestamp (s) to JS timestamp (ms)
                        row._joindate = ((row._joindate || 0) * 1000) || startms;
                        // lower case the email for consistency
                        row._email = (row._email || '').toLowerCase();
                        row._birthday = moment(row._birthday, 'MM/DD/YYYY').isValid() ? row._birthday : '';
                        // I don't know about you about I noticed a lot my users have incomplete urls, urls like: http://
                        row._picture = Exporter.validateUrl(row._picture);
                        row._website = Exporter.validateUrl(row._website);

                        // let's check the group that this user belongs to and set the right privileges
                        row._level = groups[row._gid]._administrator > 0 && groups[row._gid]._moderator > 0 ? 'administrator' : groups[row._gid]._moderator > 0 ? 'moderator' : 'member';
                        row._banned = groups[row._gid]._notbanned > 0 ? 0 : 1;

                        map[row._uid] = row;
                    });

                    callback(null, map);
                });
        });
    };

    Exporter.getCategories = function(callback) {
        return Exporter.getPaginatedCategories(0, -1, callback);    
    };
    Exporter.getPaginatedCategories = function(start, limit, callback) {

        callback = !_.isFunction(callback) ? noop : callback;

        if (!Exporter.connection) {
            Exporter.setup(config);
        }

        var prefix = Exporter.config('prefix');
        var startms = +new Date();
        var query = 'SELECT '
            + prefix + 'forums.id as _cid, '
            + prefix + 'forums.name as _name, '
            + prefix + 'forums.description as _description, '
            + prefix + 'forums.parent_id as _parent '
            + ' from ' + prefix + 'forums '
            + (start >= 0 && limit >= 0 ? 'LIMIT ' + start + ',' + limit : '');


        Exporter.connection.query(query,
            function(err, rows) {
                if (err) {
                    Exporter.error(err);
                    return callback(err);
                }

                //normalize here
                var map = {};
                rows.forEach(function(row) {
                    row._name = row._name || 'Untitled Category';
                    row._description = row._description || 'No decsciption available';
                    row._timestamp = ((row._timestamp || 0) * 1000) || startms;
                    map[row._cid] = row;
                });

                callback(null, map);
            });
    };

    Exporter.getTopics = function(callback) {
        return Exporter.getPaginatedTopics(0, -1, callback);
    };
    Exporter.getPaginatedTopics = function(start, limit, callback) {
        callback = !_.isFunction(callback) ? noop : callback;

        if (!Exporter.connection) {
            Exporter.setup(config);
        }

        var prefix = Exporter.config('prefix');
        var startms = +new Date();

        var query = 'SELECT '
            + prefix + 'topics.tid as _tid, '
            + prefix + 'topics.starter_id as _uid, '
            + prefix + 'topics.forum_id as _cid, '
            + prefix + 'topics.topic_firstpost as _pid, '
            + prefix + 'topics.title as _title, '
            + prefix + 'topics.start_date as _timestamp, '
            + prefix + 'topics.views as _viewcount, '
            + prefix + 'topics.state as _status, '
            + prefix + 'topics.pinned as _pinned, '
            + prefix + 'topics.approved as _approved, '
            + prefix + 'topics.topic_answered_pid as _answerpid, '
            + prefix + 'posts.post as _content, '
            + prefix + 'posts.topic_id as _post_tid '
            + 'FROM ' + prefix + 'topics, ' + prefix + 'posts '
            + 'WHERE ' + prefix + 'topics.tid=' + prefix + 'posts.topic_id '
            + 'AND ' + prefix + 'posts.new_topic=1 '
            + (start >= 0 && limit >= 0 ? 'LIMIT ' + start + ',' + limit : '');


        Exporter.connection.query(query,
            function(err, rows) {
                if (err) {
                    Exporter.error(err);
                    return callback(err);
                }

                //normalize here
                var map = {};

                rows.forEach(function(row) {
                    row._title = row._title ? row._title[0].toUpperCase() + row._title.substr(1) : 'Untitled';
                    row._timestamp = ((row._timestamp || 0) * 1000) || startms;
                    map[row._tid] = row;
                });

                callback(null, map);
            });
    };

    Exporter.getPosts = function(callback) {
        return Exporter.getPaginatedPosts(0, -1, callback);
    };
    Exporter.getPaginatedPosts = function(start, limit, callback) {
        callback = !_.isFunction(callback) ? noop : callback;

        if (!Exporter.connection) {
            Exporter.setup(config);
        }

        var prefix = Exporter.config('prefix');
        var startms = +new Date();

        var query = 'SELECT '
            + prefix + 'posts.pid as _pid, '
            + prefix + 'posts.topic_id as _tid, '
            + prefix + 'posts.author_id as _uid, '
            + prefix + 'posts.post as _content, '
            + prefix + 'posts.post_date as _timestamp, '
            + prefix + 'posts.edit_time as _edittimestamp '
            + 'FROM ' + prefix + 'posts '
            + 'WHERE ' + prefix + 'posts.new_topic=0 '
            + (start >= 0 && limit >= 0 ? 'LIMIT ' + start + ',' + limit : '');


        Exporter.connection.query(query,
            function(err, rows) {
                if (err) {
                    Exporter.error(err);
                    return callback(err);
                }

                //normalize here
                var map = {};
                rows.forEach(function(row) {
                    row._content = row._content || '';
                    row._timestamp = ((row._timestamp || 0) * 1000) || startms;
                    map[row._pid] = row;
                });

                callback(null, map);
            });
    };

    Exporter.teardown = function(callback) {
        Exporter.log('teardown');
        Exporter.connection.end();

        Exporter.log('Done');
        if (_.isFunction(callback)) {
            callback();
        }
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
    
    Exporter.paginatedTestrun = function(config, callback) {
        async.series([
            function(next) {
                Exporter.setup(config, next);
            },
            function(next) {
                Exporter.getPaginatedUsers(0, 1000, next);
            },
            function(next) {
                Exporter.getPaginatedCategories(0, 1000, next);
            },
            function(next) {
                Exporter.getPaginatedTopics(0, 1000, next);
            },
            function(next) {
                Exporter.getPaginatedPosts(1001, 2000, next);
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
