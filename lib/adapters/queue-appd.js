'use strict';
// module.exports = require('message-queue')('redis');
var EventEmitter = require('events').EventEmitter;
var redis = require('redis');
var helpers = require('../support/helpers');
var queue = exports;

var publisherClient;
var subscriberClient;

queue.Publish = function(config) {
  publisherClient = publisherClient || redis.createClient(config);

  return {
    channel: function(channel) {
      return {
        publish: function(message, cb) {
          var transaction = message.topics.to && message.topics.to[0] !== '_' && message.__transaction;
          delete(message.__transaction);

          if (transaction && !message.payload.exitCallDetected) {
            var topic = helpers.topicWithoutInstanceId(message.topics.to);
            try {
              var exit = transaction.startExitCall({
                exitType: 'EXIT_WEBSERVICE',
                label: topic,
                backendName: 'Event Bus',
                identifyingProperties: {
                  topic: topic
                }
              });
              var correlationInfo = transaction.createCorrelationInfo(exit);
              if (!message.payload) message.payload = {};
              if (!message.payload.headers) message.payload.headers = {};
              if (!message.payload.headers.singularityheader) message.payload.headers.singularityheader = correlationInfo;
              console.log('correlationInfo', correlationInfo, typeof correlationInfo);
            } catch (e) {
              console.error(e);
              console.error(e.stack);
            }
          }
          publisherClient.publish(channel, JSON.stringify(message), function(err) {
            if (exit) transaction.endExitCall(exit, err);
            if (err) return cb(err);

            if (transaction) transaction.end();
            cb();
          });
        },
        close: _noop
      };
    }
  };
};

queue.Subscribe = function(config) {
  subscriberClient = subscriberClient || redis.createClient(config);
  subscriberClient.setMaxListeners(0);

  var emitter = new EventEmitter();

  function onClientMessage(channel, message) {
    if (channel !== config.channel) return;
    process.nextTick(function() {
      var parsedMessage;
      try {
        parsedMessage = JSON.parse(message);
      } catch (e) {
        emitter.emit('error', e);
        return;
      }
      emitter.emit('message', parsedMessage);
    });
  }

  subscriberClient.on('message', onClientMessage);
  subscriberClient.on('error', emitter.emit.bind(emitter, 'error'));
  subscriberClient.on('end', emitter.emit.bind(emitter, 'end'));

  emitter.close = function() {
    subscriberClient.removeListener('message', onClientMessage);
    subscriberClient.unsubscribe(config.channel);
  };

  subscriberClient.subscribe(config.channel);

  return emitter;
};

function _noop() {}
