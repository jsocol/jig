var http = require('http'),
    https = require('https'),
    qs = require('querystring'),
    irc = require('irc'),
    options = require('nomnom').opts({
        config: {
            string: "-c CONFIG, --config=CONFIG",
            default: "config.ini",
            help: "What config file to use. (Default: config.ini)"
        }
    }).parseArgs(),
    daemon = require('daemon'),
    IniReader = require('inireader').IniReader,
    GitHubApi = require('github'),
    github = new GitHubApi({version: "3.0.0"}),
    PULLREQRE = /pull\s+(?:req\s+)?#?(\d+)/i,
    TAGRE = /\/tags\/(.+)$/i;

inireader = new IniReader();
inireader.load(options.config);
var CONFIG = inireader.getBlock();


var CHANNELS = CONFIG.irc.channels.split(','),
    BRANCHES = {},
    JENKINS =  CONFIG.http.jenkins,
    IRCHOST = CONFIG.irc.server,
    IRCNICK = CONFIG.irc.nick;

CHANNELS.forEach(function(c, i) {
    CHANNELS[i] = c.trim();
});

for (var br in CONFIG.branches) {
    var ref = CONFIG.branches[br];
    BRANCHES[ref] = CONFIG['branch:' + br];
    BRANCHES[ref].name = br;
}

function interpolate(fmt, obj, named) {
    if (named) {
        return fmt.replace(/%\(\w+\)s/g, function(match){return String(obj[match.slice(2,-2)])});
    } else {
        return fmt.replace(/%s/g, function(match){return String(obj.shift())});
    }
}

var client = new irc.Client(IRCHOST, IRCNICK, {
    channels: CHANNELS
}).on('error', function(err) {
    if (err.rawCommand != '421') {
        console.log(err);
        if (err.hasOwnProperty('stack')) {
            console.log(err.stack);
        }
    }
});


var response = '\00307#%(number)s\003 - \002%(state)s\002 - \00303%(user)s\003 - %(title)s - %(url)s';

function printPullReq(to, pull) {
    client.say(
        to,
        interpolate(response, {
            'number': pull.number,
            'title': pull.title,
            'url': pull.html_url,
            'user': pull.user.login,
            'state': pull.state.toUpperCase()
        }, true));
}

client.on('message', function(from, to, msg) {
    if (to.indexOf('#') != 0) return;
    msg = msg.toLowerCase();
    if (msg.indexOf(IRCNICK) == 0 && /botsnack\s*$/i.test(msg)) {
        client.say(to, 'YUMMY');
    } else if (msg.indexOf(IRCNICK) == 0 && /thanks/i.test(msg)) {
        client.say(to, 'no problem!');
    } else if (msg.indexOf(IRCNICK) == 0 && /pulls\s*$/i.test(msg)) {
        var requester = {user: CONFIG.github.user, repo: CONFIG.github.repo, state: 'open'};
        github.pullRequests.getAll(requester, function(err, pulls) {
            pulls.forEach(function(pull) {
                printPullReq(to, pull);
            });
        });
    } else if (PULLREQRE.test(msg)) {
        var m = PULLREQRE.exec(msg),
            requester = {user: CONFIG.github.user, repo: CONFIG.github.repo, number: m[1]};
        github.pullRequests.get(requester, function(err, pull) {
            if (err || !pull) {
                console.log(err);
                return;
            }
            printPullReq(to, pull);
        });
    }
});


var server = http.createServer(function(req, res) {
    if (req.method != 'POST') {
        res.statusCode = 405;
        res.end();
        return;
    }
    var payload = '';
    req.on('data', function(d) {
        payload += d;
    });
    req.on('end', function() {
        res.statusCode = 200;
        res.end();
        try {
            var post, data;
            post = qs.parse(payload);
            data = JSON.parse(post.payload);
        } catch(e) {
            console.log(e);
            return;
        }
        console.log('ref is: ' + data.ref);
        var push = '\00303%(pusher)s\003 \00307%(branch)s\003: %(compare)s',
            commit = '\00303%(author)s\003 \002%(sha)s\002: %(msg)s';
        if (data.ref in BRANCHES) {
            console.log('push to ' + data.ref);
            var ref = BRANCHES[data.ref];
            var pushMsg = interpolate(push, {
                    'pusher': data.pusher.name,
                    'branch': ref.name,
                    'compare': data.compare
                }, true),
                commitMsgs = [];

            if (ref.commits && ref.commits.toLowerCase() == 'yes') {
                data.commits.forEach(function(c) {
                    commitMsgs.push(interpolate(commit, {
                        'author': c.author.username,
                        'sha': c.id.substring(0, 8),
                        'msg': c.message
                    }, true));
                });
            }

            CHANNELS.forEach(function(c) {
                client.say(c, pushMsg);
                commitMsgs.forEach(function(m) {
                    client.say(c, m);
                });
            });

            var q = {
                token: ref.token,
                cause: 'Push by ' + data.pusher.name
            };

            var web = http,
                headers = {};
            if (CONFIG.http.ssl == 'yes') {
                web = https;
            }
            if (CONFIG.http.auth) {
                headers['Authorization'] = CONFIG.http.auth;
            }
            // We wrap this in a setTimeout to give downstream repos
            // time to sync with github.
            setTimeout(function() {
                web.get({
                    host: JENKINS,
                    path: ref.path + '?' + qs.stringify(q),
                    headers: headers
                }, function(res) {
                    console.log(res.statusCode + ': ' + ref.path + '?' + qs.stringify(q));
                }).on('error', function(err) {
                    console.log(err);
                });
            }, 5000);
        } else if (TAGRE.test(data.ref)) {
            var m = TAGRE.exec(data.ref),
                tag = '\002New Tag:\002 \00312%(tag)s\003 pushed by \00303%(pusher)s\003',
                tagMsg = interpolate(tag, {'tag': m[1], 'pusher': data.pusher.name}, true);
            CHANNELS.forEach(function(c) {
                client.say(c, tagMsg);
            });
        }
    });
});

server.listen(CONFIG.http.port, CONFIG.http.host);

if (CONFIG.process.daemon == 'yes') {
    daemon.daemonize(CONFIG.process.logfile, CONFIG.process.pidfile, function(err, pid) {
        console.log('Daemonizing');
    });
}
