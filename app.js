// app.js
// This file contains the server side JavaScript code for your application.
// This sample application uses express as web application framework (http://expressjs.com/),
// and jade as template engine (http://jade-lang.com/).

var express = require('express');
var https = require('https');
var url = require('url');
var jsdom_env = require('jsdom').env;
var jquery = require('jquery');
var querystring = require('querystring');
var xmlescape = require('xml-escape');
var _ = require("underscore");
var html2text = require("html-to-text");
var GoogleNews_URL = "https://ajax.googleapis.com/ajax/services/search/news?v=1.0&q=";

var request = require('request');
var libxmljs = require("libxmljs");


// setup middleware
var app = express();
app.use(express.errorHandler());
app.use(express.urlencoded()); // to support URL-encoded bodies
app.use(app.router);

app.use(express.static(__dirname + '/public')); //setup static public directory
app.set('view engine', 'jade');
app.set('views', __dirname + '/views'); //optional since express defaults to CWD/views

// There are many useful environment variables available in process.env.
// VCAP_APPLICATION contains useful information about a deployed application.
var appInfo = JSON.parse(process.env.VCAP_APPLICATION || "{}");
// TODO: Get application information and use it in your app.

// defaults for dev outside bluemix
var service_url = 'https://gateway.watsonplatform.net/laser/service/api/v1/sire/a4410faa-0369-4a7f-9436-44d0f80ffb3c';
var service_username = 'd2b82451-eb00-42f5-a707-a5549792183a';
var service_password = 'EKgZ7fi1KtUi';

// VCAP_SERVICES contains all the credentials of services bound to
// this application. For details of its content, please refer to
// the document or sample of each service.
if (process.env.VCAP_SERVICES) {
    console.log('Parsing VCAP_SERVICES');
    var services = JSON.parse(process.env.VCAP_SERVICES);
    //service name, check the VCAP_SERVICES in bluemix to get the name of the services you have
    var service_name = 'relationship_extraction';
    
    if (services[service_name]) {
        var svc = services[service_name][0].credentials;
        service_url = svc.url;
        service_username = svc.username;
        service_password = svc.password;
    } else {
        console.log('The service '+service_name+' is not in the VCAP_SERVICES, did you forget to bind it?');
    }

} else {
    console.log('No VCAP_SERVICES found in ENV, using defaults for local development');
}

console.log('service_url = ' + service_url);
console.log('service_username = ' + service_username);
console.log('service_password = ' + new Array(service_password.length).join("X"));

var auth = 'Basic ' + new Buffer(service_username + ':' + service_password).toString('base64');

// render index page
app.get('/', function(req, res){
        res.render('search');
});

app.get('/map', function(req, res){
        res.render('map');
});

function watson (req, res, huge_string) {
    var parts = url.parse(service_url);

    // create the request options from our form to POST to Watson
    var options = { 
        host: parts.hostname,
        port: parts.port,
        path: parts.pathname,
        method: 'POST',
        headers: {
            'Content-Type'  :'application/x-www-form-urlencoded',
            'X-synctimeout' : '30',
            'Authorization' :  auth }
    };

    // Create a request to POST to Watson
    var watson_req = https.request(options, function(result) {
        result.setEncoding('utf-8');
        var resp_string = '';

        result.on("data", function(chunk) {
            resp_string += chunk;
        });

        result.on('end', function() {
            var arr = parseTo(resp_string);
            // var arr = [];
            return res.send(JSON.stringify(arr));
            // return res.send(resp_string);
        });

    });

    watson_req.on('error', function(e) {
        return res.send('error' + e.message);
    });

    // huge_string = huge_string.replace(/[^\w\s\,\.\n]/g,' ');
    // huge_string = huge_string.split(/\s+/).join(' ');
    // huge_string = huge_string.substring(0, 1000);
    to_watson = {
        'txt': huge_string,
        'sid': 'ie-en-news',
        'rt': 'xml'
    };
    console.log(" + + + + + + + + Length: " + huge_string.length);
    // console.log("Sending text to watson: " + huge_string);
    watson_req.write(querystring.stringify(to_watson));
    watson_req.end();
}

// Handle the form POST containing the text to identify with Watson and reply with the language
app.post('/', function(req, res){

    request(GoogleNews_URL + req.body.keyword, function (error, response, body) {
        // var response_list = [];
        var huge_str = "";
        var count = 0;

        if (!error && response.statusCode == 200) {
            var gn_json = JSON.parse(body);
            results = gn_json.responseData.results;

            function check_finish(argument) {
                if(count >= results.length) {
                    watson(req, res, huge_str);
                }
            }

            _(results).each(function(result) {
                var url = result.unescapedUrl;

                console.log("Searching in " + url);
                jsdom_env(url, function (errors, window) {
                    console.error(errors);
                    var $ = jquery(window);
                    var article_text = '';
                    count++;

                    $.each($("p"), function(i, el) {
                        var text = el.textContent.trim().split(/\s+/).join(' ');
                        if(text.length >= 200) {
                            article_text += '\n' + text;
                        }
                    });

                    huge_str += '\n\n' + article_text;

                    console.log("Article length: " + article_text.length);

                    check_finish();
                });

                // request(url, function(error, response, body) {
                //     count++;

                //     if (!error && response.statusCode == 200) {
                //         var article_text = html2text.fromString(body);
                //         huge_str += '\n\n' + article_text;
                //     }

                //     check_finish();
                // });
            });
        } else {
            console.log("ERROR: " + body);
        }

    });
});


// The IP address of the Cloud Foundry DEA (Droplet Execution Agent) that hosts this application:
var host = (process.env.VCAP_APP_HOST || 'localhost');
// The port on the DEA for communication with the application:
var port = (process.env.VCAP_APP_PORT || 3000);

console.log("Starting App " + host + ":" + port);

// Start server
app.listen(port, host);


function parseTo(data){
    console.log(data);
    var result = [];
    var xmlDoc = libxmljs.parseXml(data);
    // var places = xmlDoc.find("//mention[@role='LOCATION']");
    var places = xmlDoc.find("//entity[@type='GPE' and @level='NAM']");
    var length = places.length;
    for(var i=0; i<length; i++) {
        var score = Number(places[i].attr('score').value());
        var childs = places[i].childNodes();
        var child_count = childs.length;
        var name = childs[1].text().trim();

        console.log(places[i].text() + '\n' + score + '\n ------- ');
        
        var find = findByName(name, result);
        if (find === null) {
            result.push({
                'name': name,
                'count': child_count,
                'score': score
            });
        }else{
            result[find].count += child_count;
            result[find].score = Math.max(result[find].score, score);
        }
    }

    result.sort(function(a, b){ return b.score - a.score; });

    console.log(result);
    return result;
}

function findByName(name, array){
    var position = null;
    for (i = 0; i < array.length; i++) {
        if (name==array[i].name) {
            position = i;
        }
    }
    return position;
}
