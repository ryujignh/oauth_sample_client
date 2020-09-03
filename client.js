require('dotenv').config()
var express = require("express");
var bodyParser = require('body-parser');
var request = require("sync-request");
var url = require("url");
var qs = require("qs");
var querystring = require('querystring');
var cons = require('consolidate');
var randomstring = require("randomstring");
var __ = require('underscore');
__.string = require('underscore.string');
var jose = require('jsrsasign');

var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.engine('html', cons.underscore);
app.set('view engine', 'html');
app.set('views', 'files/client');

// authorization server information

var authorizationEndpoint = process.env.NODE_ENV === 'production' ? 'https://creww.me/oauth/authorize' : 'http://creww.test:53000/oauth/authorize';
var tokenEndpoint = process.env.NODE_ENV === 'production' ? 'https://creww.me/oauth/token' : 'http://creww.test:53000/oauth/token';
var authServer = {
	authorizationEndpoint: authorizationEndpoint,
	tokenEndpoint: tokenEndpoint,
};

// client information

var client = {
	"client_id": '',
	"client_secret": '',
	"redirect_uri": '',
	"scope": ''
};

var state = null;

var access_token = null;
var refresh_token = null;
var scope = null;
var key = null;
var alg = null;

app.get('/', function (req, res) {
	res.render('index', {access_token: access_token, refresh_token: refresh_token, scope: scope, key: key});
});

app.post('/authorize', function(req, res){

	access_token = null;
	refresh_token = null;
	scope = null;
	state = randomstring.generate();

	var client_id = req.body.client_id_field
	var client_secret = req.body.client_secret_field
	var client_scope = req.body.client_scope_field
	var redirect_uri = req.body.redirect_uri_field

	client.client_id = client_id
	client.client_secret = client_secret
	client.scope = client_scope
	client.redirect_uri = redirect_uri

	var authorizeUrl = buildUrl(authServer.authorizationEndpoint, {
		response_type: 'code',
		scope: client.scope,
		client_id: client.client_id,
		redirect_uri: client.redirect_uri,
		state: state
	});

	console.log("redirect", url.format(authorizeUrl));
	res.redirect(url.format(authorizeUrl));
});

app.get("/callback", function(req, res){

	if (req.query.error) {
		// it's an error response, act accordingly
		res.render('error', {error: req.query.error});
		return;
	}

	// var resState = req.query.state;
	// if (resState == state) {
	// 	console.log('State value matches: expected %s got %s', state, resState);
	// } else {
	// 	console.log('State DOES NOT MATCH: expected %s got %s', state, resState);
	// 	res.render('error', {error: 'State value did not match'});
	// 	return;
	// }

	var code = req.query.code;

	var form_data = qs.stringify({
		grant_type: 'authorization_code',
		code: code,
		client_id: client.client_id,
		client_secret: client.client_secret,
		redirect_uri: client.redirect_uri
	});

	var headers = {
		'Content-Type': 'application/x-www-form-urlencoded',
	};

	var tokRes = request('POST', authServer.tokenEndpoint + '?' + form_data, {
		headers: headers,
	});

	console.log('Requesting access token for code %s',code);

	console.log(tokRes);

	if (tokRes.statusCode >= 200 && tokRes.statusCode < 300) {
		var body = JSON.parse(tokRes.getBody());

		access_token = body.access_token;
		console.log('Got access token: %s', access_token);
		if (body.refresh_token) {
			refresh_token = body.refresh_token;
			console.log('Got refresh token: %s', refresh_token);
		}

		scope = body.scope;
		console.log('Got scope: %s', scope);

		/*
		 * Save the access token key
		 */

		res.render('index', {access_token: access_token, refresh_token: refresh_token, scope: scope, key: key});
	} else {
		res.render('error', {error: 'Unable to fetch access token, server response: ' + tokRes.statusCode})
	}
});

var buildUrl = function(base, options, hash) {
	var newUrl = url.parse(base, true);
	delete newUrl.search;
	if (!newUrl.query) {
		newUrl.query = {};
	}
	__.each(options, function(value, key, list) {
		newUrl.query[key] = value;
	});
	if (hash) {
		newUrl.hash = hash;
	}

	return url.format(newUrl);
};

var encodeClientCredentials = function(clientId, clientSecret) {
	return new Buffer(querystring.escape(clientId) + ':' + querystring.escape(clientSecret)).toString('base64');
};

app.use('/', express.static('files/client'));

var server = app.listen(9000, 'localhost', function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log('OAuth Client is listening at http://%s:%s', host, port);
});

