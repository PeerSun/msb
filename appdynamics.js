var helpers = require('./lib/support/helpers');
var messageFactory = require('./lib/messageFactory');
var serviceDetails = require('./lib/support/serviceDetails');
var appd = require('appdynamics');

var createRequestMessage = messageFactory.createRequestMessage;
var createResponseMessage = messageFactory.createResponseMessage;

messageFactory.createRequestMessage = function(config, originalMessage) {
  var message = createRequestMessage(config, originalMessage);
  var topic = helpers.topicWithoutInstanceId(message.topics.to);

  if (topic && topic[0] === '_') return message;
  var payloadWithHeaders = (originalMessage && originalMessage.payload && originalMessage.payload.headers && originalMessage.payload);
  var ci = (payloadWithHeaders && payloadWithHeaders.headers.singularityheader) ? appd.parseCorrelationInfo(payloadWithHeaders.headers.singularityheader) : null;
  console.log('incoming ci', payloadWithHeaders && payloadWithHeaders.headers.singularityheader, ci);
  var transaction = appd.startTransaction(ci || payloadWithHeaders || topic || 'bus');
  message.__transaction = transaction;
  // transaction.beforeExitCall = function(exitCall) {
  //   var c = transaction.createCorrelationInfo(exitCall);
  //   if (!message.payload) message.payload = {};
  //   if (!message.payload.headers) message.payload.headers = {};
  //   if (!message.payload.headers.singularityheader) message.payload.singularityheader = c;
  //   message.payload.exitCallDetected = true;
  //   return exitCall;
  // };
  return message;
};

messageFactory.createResponseMessage = function(originalMessage, ack, payload) {
  var message = createResponseMessage(originalMessage, ack, payload);
  var topic = helpers.topicWithoutInstanceId(message.topics.to);

  if (topic && topic[0] === '_') return message;
  var payloadWithHeaders = (originalMessage && originalMessage.payload && originalMessage.payload.headers && originalMessage.payload);
  var ci = (payloadWithHeaders && payloadWithHeaders.headers.singularityheader) ? appd.parseCorrelationInfo(payloadWithHeaders.headers.singularityheader) : null;
  console.log('incoming ci', payloadWithHeaders && payloadWithHeaders.headers.singularityheader, ci);
  var transaction = appd.startTransaction(ci || payloadWithHeaders || topic || 'bus');
  message.__transaction = transaction;
  // transaction.beforeExitCall = function(exitCall) {
  //   var c = transaction.createCorrelationInfo(exitCall);
  //   if (!message.payload) message.payload = {};
  //   if (!message.payload.headers) message.payload.headers = {};
  //   if (!message.payload.headers.singularityheader) message.payload.singularityheader = c;
  //   message.payload.exitCallDetected = true;
  //   return exitCall;
  // };
  return message;
};

// messageFactory.completeMeta = function(message, meta) {
//   var message = completeMeta(message, meta);
//   var transaction = message.__transaction;
//   if (transaction) {
//     try {
//       console.log('startExitCall');
//       var exit = transaction.startExitCall({
//         exitType: 'EXIT_WEBSERVICE',
//         label: 'queue',
//         backendName: message.topics.to,
//         identifyingProperties: {}
//       });
//       var correlationInfo = message.__transaction.createCorrelationInfo(exit);
//       console.log('completeMeta', correlationInfo);
//       message.__transaction.end(); // Required for reporting to happen?
//       delete(message.__transaction);
//     } catch(e) {
//       console.error(e);
//       console.error(e.stack);
//     }
//   }
//   return message;
// };

appd.profile({
  debug: true,
  controllerHostName: 'paid108.saas.appdynamics.com',
  controllerPort: 443, // If SSL, be sure to enable the next line
  accountName: 'ThomasCook', // Required for a controller running in multi-tenant mode
  accountAccessKey: '3gzb592a4xcy', // Required for a controller running in multi-tenant mode
  applicationName: 'microservices',
  tierName: serviceDetails.name,
  nodeName: serviceDetails.name, // Node names must be unique. A unique name has been generated for you.
  controllerSslEnabled: true // Optional - use if connecting to controller via SSL
});



