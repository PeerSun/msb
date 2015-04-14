var argv = process.argv.slice(2);
var appd = require('appdynamics');

if (!(argv[0] === '-entry' || argv[0] === '-service')) {
  console.error('Please specify an -entry or -service role, e.g. `node example -entry`')
  process.exit(1);
}

/* Initialize App Dynamics */
appd.profile({
  debug: true,
  controllerHostName: 'paid108.saas.appdynamics.com',
  controllerPort: 443, // If SSL, be sure to enable the next line
  accountName: 'ThomasCook', // Required for a controller running in multi-tenant mode
  accountAccessKey: '3gzb592a4xcy', // Required for a controller running in multi-tenant mode
  applicationName: 'microservices',
  tierName: 'tier' + argv[0],
  nodeName: 'node' + argv[0], // Node names must be unique. A unique name has been generated for you.
  controllerSslEnabled: true // Optional - use if connecting to controller via SSL
});

var EventEmitter = require('events').EventEmitter;
var redis = require('redis');
var publisherClient;
var subscriberClient;

function publish(channel, message, cb) {
  var client = publisherClient || (publisherClient = redis.createClient());

  client.publish(channel, JSON.stringify(message), cb);
}

function subscribe(channel) {
  var client = subscriberClient || (subscriberClient = redis.createClient());
  var emitter = new EventEmitter();

  client.on('message', function(messageChannel, message) {
    if (channel !== messageChannel) return;
    emitter.emit('message', JSON.parse(message));
  });

  client.subscribe(channel);
  return emitter;
}

function createEntry() {
  var publisherTopic = 'entry';
  var subscriberTopic = 'entry:response';
  var subscriber = subscribe(subscriberTopic);

  require('http').createServer(function(req, res) {
    var trx = appd.startTransaction(req);

    /* Take next message */
    subscriber.once('message', function(message) {
      res.writeHead(message.statusCode);
      res.end(JSON.stringify(message));
    });

    var exit = trx.startExitCall({
      exitType: 'EXIT_WEBSERVICE',
      label: publisherTopic,
      backendName: 'Event Bus',
      identifyingProperties: {
        topic: publisherTopic
      }
    });

    var request = {
      ci: trx.createCorrelationInfo(exit),
      at: new Date()
    };

    publish(publisherTopic, request, function(err) {
      trx.endExitCall(exit, err);
      trx.end();

      if (err) console.error(err);
      console.log('requested');
    });
  }).listen(8080, function() {
    console.log('example listening on 8080');
  });
}

function createService() {
  var publisherTopic = 'entry:response';
  var subscriberTopic = 'entry';
  var subscriber = subscribe(subscriberTopic);

  subscriber.on('message', function(message) {
    console.log('received', message);
    if (!message.ci) return publish(publisherTopic, { statusCode: 400, info: 'CorrelationInfo is empty.' }, noop);

    var nci = appd.parseCorrelationInfo(message.ci);
    var trx = appd.startTransaction(nci);

    var exit = trx.startExitCall({
      exitType: 'EXIT_WEBSERVICE',
      label: publisherTopic,
      backendName: 'Event Bus',
      identifyingProperties: {
        topic: publisherTopic
      }
    });

    var response = {
      ci: trx.createCorrelationInfo(exit),
      statusCode: 200,
      dates: [message.at, new Date()]
    };

    publish(publisherTopic, response, function(err) {
      trx.endExitCall(exit, err);
      trx.end();

      if (err) console.error(err);
      console.log('responded');
    });
  });
}

if (argv[0] === '-entry') createEntry();
else if (argv[0] === '-service') createService();

function noop(){}
