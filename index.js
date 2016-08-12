// var redis = require('redis');
// var client = redis.createClient(port, host);

var request = require('request');
var express = require('express');
var bodyParser = require('body-parser');

var app = express();

app.set('port', (process.env.PORT || 5000));

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

app.use(express.static(__dirname + '/public'));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/webhook/', function (request, response) {
  if (request.query['hub.verify_token'] === 'Nobroker_Labs') {
    response.send(request.query['hub.challenge'])
  }
  response.send('Error, wrong token')
})

// API endpoint

app.post('/webhook', function (request, response) {
  var data = request.body;
  // Make sure this is a page subscription
  if (data.object == 'page') {
    // Iterate over each entry
    // There may be multiple if batched
    data.entry.forEach(function(pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;

      // Iterate over each messaging event
      pageEntry.messaging.forEach(function(messagingEvent) {
        if (messagingEvent.optin) {
          // receivedAuthentication(messagingEvent);
        } else if (messagingEvent.message) {
          receivedMessage(messagingEvent);
        } else if (messagingEvent.delivery) {
          // receivedDeliveryConfirmation(messagingEvent);
        } else if (messagingEvent.postback) {
          receivedPostback(messagingEvent);
        } else {
          console.log("Webhook received unknown messagingEvent: ", messagingEvent);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know you've 
    // successfully received the callback. Otherwise, the request will time out.
    response.sendStatus(200);
  }
});

var PAGE_ACCESS_TOKEN = "EAAEHFebMi9sBAAdNZAMrgsmKVrGm2rVu7oPzlkr2cb2McHYz0ccENdcFquaVtNKghYG1tWZBR8LZCJCzmTzu9tyGaZCZCj58iyg9vncvZBEQzsfPgZCzk2YsCjv002d3NeXaRZBKoIS30wnB5EuqxZBeNpk4oI4wiMtE2T9fZCFUblZBQZDZD";

function User(){
}

var userMap = {};

function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  // console.log("Received message for user %d and page %d at %d", 
  //  senderID, recipientID, timeOfMessage);

  if (Object.keys(userMap).length > 100) {
    userMap.splice(-1,1);
  }

  if (!userMap.hasOwnProperty(senderID)) {
    console.log('Adding new user to session: ' + senderID);
    userMap[senderID] = new User();
  } else {
    console.log('User already in session: ' + userMap[senderID]);
  }

  /*
  Add user to redis cache:
  console.log('Adding new user to redis: ' + senderID);
  client.hmset(senderID, JSON.stringify(new User()));
  */
  var messageId = message.mid;
  var messageText = message.text;
  var messageAttachments = message.attachments;

  if (messageText) {

    /*if (messageText.toLowerCase().indexOf("hi") > -1 || messageText.toLowerCase().indexOf("hello") > -1
        || messageText.toLowerCase().indexOf("hey") > -1) {
      sendGenericMessage(senderID);
      return;
    }*/

    if (messageText.indexOf("plan") > -1) {
      sendPlansMessage(senderID);
      return;
    }

    makeWitCall(messageText, senderID);

  } else if (messageAttachments) {
    echoMessage(senderID, "Message with attachment received");
  }
}

function makeWitCall(messageText, senderID) {
    queryString = encodeURIComponent(messageText);
    witUrl = 'https://api.wit.ai/message?v=20160721&q=' + queryString;
    console.log('Wit URL: ' + witUrl);

    var options = {
      uri: witUrl,
      method: 'GET',
      headers: {
          'Authorization': 'Bearer IQ7WHYYVOGCDSAWYXIXDBSGDHHDY4QA5',
        }
    }

    request(options, function(error, response, body) {
      if(error) {
        echoMessage(senderID, "Oops! AI Engine failed to understand that. Try something like: 2 bhk flat for rent btm layout bangalore.");
        setTimeout(sendPlansMessage(senderID), 3000);
      }
      else {
          processWitRespone(senderID, body);
      }
        return;
    });
}

function processWitRespone(senderID, body) {
  var map = {};
  map['intent'] = 0;
  map['location'] = 0;
  map['bhk'] = 0;
  map['minrent'] = 0;
  map['maxrent'] = 0;
  map['swimmingPool'] = 0;

  var jsonResponse = JSON.parse(body);
  var results = jsonResponse.entities;
  var user = userMap[senderID];

  /* client.hgetall(senderID, function(err, object) {
    user = JSON.parse(object) ;
  }); */

  if (!results) {
    echoMessage(senderID, "Thanks for contacting. One of our executives will get in touch with you shortly...");
  }

  if(results.hasOwnProperty('reset')){
    userMap[senderID] = new User();
    // client.hmset(senderID, JSON.stringify(new User()));
    echoMessage(senderID, "Session reset for userId: " + senderID);
    return;
  }

  if(results.hasOwnProperty('location')) {
    map['location'] = results.location[0].value;
    console.log('User Loc by text: ' + map['location']);

    googleQueryString = encodeURIComponent(map['location']);

    googleUrl = 'https://maps.googleapis.com/maps/api/place/autocomplete/json?key=AIzaSyCwy2ETEJXPynpNXJggwjzsHxFcG3Il34o&input='
                  + googleQueryString;

    console.log('GoogleUrl: ' + googleUrl);
    var options = {
      uri: googleUrl,
      method: 'GET'
    }

    request(options, function(error, response, body) {
      if(error) {
        console.log(error);
        echoMessage(senderID, "Oops! Could not understand that. Try something like: 2 bhk flat for rent btm layout bangalore.");
        setTimeout(sendPlansMessage(senderID), 3000);
      }
      else {
        var googleResponse = JSON.parse(body);
        var predictions = googleResponse.predictions;

        if (predictions && predictions.length > 0) {
          console.log("Predictions Count: " + predictions.length);
          var place_id = predictions[0].place_id;
          console.log("Google PlaceId: " + place_id);
          var existing_intent = user.intent;

          userMap[senderID] = new User();
          user = userMap[senderID];

      /*  client.hmset(senderID, JSON.stringify(new User()));
          client.hgetall(senderID, function(err, object) {
            user = JSON.parse(object) ;
          });
      */
          if (existing_intent) {
            user.intent = existing_intent;
          }
          console.log("Session reset for userId: " + senderID);
          user.location = place_id;

          searchNobroker(map, userMap, results, user, senderID);
        }
      }
    });

  } else if (user.hasOwnProperty('location')) {
    if(results.hasOwnProperty('greeting')){
      sendGenericMessage(senderID);
      return;
    }
    searchNobroker(map, userMap, results, user, senderID);
  } else if(results.hasOwnProperty('greeting')){
      sendGenericMessage(senderID);
      return;
  } else {
      echoMessage(senderID, "Sorry, Unable to . Our executives will get in touch with you shortly.");
      return;
  }
}

function  searchNobroker(map, userMap, results, user, senderID) {
          if(results.hasOwnProperty('intent')){
            user.intent = results.intent[0].value;
          } else if (!user.hasOwnProperty('intent')) {
            askIntent(senderID);
            userMap[senderID] = user;
        //  client.hmset(senderID, JSON.stringify(user));
        //  client.expire(senderID, 900);
            return;
          }

          echoMessage(senderID, "Just a sec, I’m looking that up...");

          if(results.hasOwnProperty('no_of_bedrooms'))
            user.bhk = results.no_of_bedrooms[0].value.match(/\d+/)[0];

          if(results.hasOwnProperty('maxrent'))
           user.maxrent = results.maxrent[0].value;

          if(results.hasOwnProperty('minrent'))
            user.minrent = results.minrent[0].value;

          if(results.hasOwnProperty('swimmingpool'))
           user.swimmingPool = 1;

          if(results.hasOwnProperty('gym'))
           user.gym = 1;

          if(results.hasOwnProperty('lift'))
           user.lift = 1;

          if(results.hasOwnProperty('parking')){
            map['parking'] = results.parking[0].value;
            if (map['parking'].toLowerCase().indexOf("car") > -1) {
              map['parking'] = 'car';
            }
            user.parking = map['parking'];
          }

          if(results.hasOwnProperty('leaseType')){
            map['leaseType'] = results.leaseType[0].value;
            if (map['leaseType'].toLowerCase().indexOf("family") > -1) {
              map['leaseType'] = 'family';
            }
            user.leaseType = map['leaseType'];
          }

          if(results.hasOwnProperty('furnishing')){
            map['furnishing'] = results.furnishing[0].value;
            if (map['furnishing'].toLowerCase().indexOf("un") > -1) {
              user.furnishing = 'NOT_FURNISHED';
            } else if (map['furnishing'].toLowerCase().indexOf("semi") > -1) {
              user.furnishing = 'SEMI_FURNISHED';
            } else if (map['furnishing'].toLowerCase().indexOf("ful") > -1) {
              user.furnishing = 'FULLY_FURNISHED';
            }
          }
          
          userMap[senderID] = user;
      //  client.hmset(senderID, JSON.stringify(user));
      //  client.expire(senderID, 900);
          
          var searchURL;
          if (user.intent.toString().toLowerCase().indexOf("buy") > -1) {
            searchURL = 'http://www.nobroker.in/api/v1/property/sale/filter/region/';
          } else {
            searchURL = 'http://www.nobroker.in/api/v1/property/filter/region/';
          }
          searchURL = searchURL + user.location.trim();
          searchURL = searchURL + '?withPics=1&sharedAccomodation=0&pageNo=1&';

          if (user.bhk) {
            searchURL = searchURL + 'type=BHK' +user.bhk.trim() + '&'; 
          }
           
          if (user.maxrent) {
            if (user.hasOwnProperty('minrent')) {
              searchURL = searchURL + 'rent=' + user.minrent.trim() + ',' + user.maxrent.trim() + '&';
            } else {
              searchURL = searchURL + 'rent=0,' + user.maxrent.trim() + '&';
            }
          }

          if (user.hasOwnProperty('swimmingPool')) {
            searchURL = searchURL + 'swimmingPool=1&';
          }

          if (user.hasOwnProperty('gym')) {
            searchURL = searchURL + 'gym=1&';
          }

          if (user.hasOwnProperty('lift')) {
            searchURL = searchURL + 'lift=1&';
          }

          if (user.hasOwnProperty('furnishing')) {
            searchURL = searchURL + 'furnishing=' + user.furnishing + '&';
          }

          if (user.parking) {
            if (user.parking.toString().toLowerCase() === "car") {
              searchURL = searchURL + 'parking=FOUR_WHEELER&';
            } else {
              searchURL = searchURL + 'parking=TWO_WHEELER&';
            }
          }

          if (user.leaseType) {
            if (user.leaseType.toString().toLowerCase() === "family") {
              searchURL = searchURL + 'leaseType=FAMILY&';
            } else {
              searchURL = searchURL + 'parking=BACHELOR&';
            }
          }

          console.log("NoBroker Search URL: " + searchURL);
          
          options = {
            uri: searchURL,
            method: 'GET',
          }

          request(options, function(error, response, body) {
            if(error) {
              console.error(error);
              echoMessage(senderID, "Oops! Could not understand that. Try something like: 2 bhk flat for rent btm layout bangalore.");
              setTimeout(sendPlansMessage(senderID), 3000);
            } else {
              sendPropertyResponse(JSON.parse(body), senderID, user);
              return;
            }
          });
}

var propertyArray = [];

function Property() {
};

function sendPropertyResponse(jsonResponse, senderID, user) {
  var count = 0;
  var data = jsonResponse.data;

  if (!data) {
    echoMessage(senderID, "Oops! something went wrong with your request. Try again sometime later");
    return 0;
  }

  if (data.length === 0) {
    echoMessage(senderID, "Oops! No matching properties found! \n Type \'reset\' to reset your filters.");
    // setTimeout(sendPlansMessage(senderID), 1500);
    return 0;
  }

  var propertyArray = [];
  var userPropertyArray = [];

  for (var i=0; count < 9; i++) {
    if (i > 100) {
      break;
    }
    if (data[i] && count < 4) {
        var prop = new Property();
        prop.title = data[i].title;
        prop.description = data[i].description;
        prop.rent = data[i].rent;
        prop.deposit = data[i].deposit;
        var photos = data[i].photos;
        if (photos.length > 0) {
          imageStr = photos[0].imagesMap.original;
          img = imageStr.split('_')[0] + '/';
          prop.image = 'http://d3snwcirvb4r88.cloudfront.net/images/' + img + imageStr;
        } else {
          continue;
        }
        prop.shortUrl = data[i].shortUrl;
        prop.detailUrl = 'http://www.nobroker.in/' + data[i].detailUrl;
        count++;
        propertyArray.push(prop);
    } else if (data[i] && count >= 4) {
        var prop = new Property();
        prop.title = data[i].title;
        prop.description = data[i].description;
        prop.rent = data[i].rent;
        prop.deposit = data[i].deposit;
        var photos = data[i].photos;
        if (photos.length > 0) {
          imageStr = photos[0].imagesMap.original;
          img = imageStr.split('_')[0] + '/';
          prop.image = 'http://d3snwcirvb4r88.cloudfront.net/images/' + img + imageStr;
        } else {
          continue;
        }
        prop.shortUrl = data[i].shortUrl;
        prop.detailUrl = 'http://www.nobroker.in/' + data[i].detailUrl;
        count++;
        userPropertyArray.push(prop);
    }
  }

  if (propertyArray.length > 3) {
      if (!user.filterSent) {
        echoMessage(senderID, 'You can add filters like your budget, number of bedrooms, furnishing status, gym, lift.');
        echoMessage(senderID, 'For instance: \'show only 2 bhk\', \'budget 15000\', \'show only with gym.\'');
        user.filterSent = 'true';
        userMap[senderID] = user;
  //  client.hmset(senderID, JSON.stringify(user));
  //  client.expire(senderID, 900);
      }
      // sendPropertiesMessage(senderID, propertyArray); 
      if (userPropertyArray && userPropertyArray.length > 3) {
            user.userPropertyArray = userPropertyArray;
            userMap[senderID] = user;
            showMoreButton(senderID);
            sendPropertiesMessage(senderID, propertyArray, showMoreButtonVar);
        //  client.hmset(senderID, JSON.stringify(user));
        //  client.expire(senderID, 900);
      } else {
          sendPropertiesMessage(senderID, propertyArray);
      }
  } else {
      echoMessage(senderID, 'Sorry! No matching properties found. Type \'reset\' to reset your filters.');
  }
}

function sendPropertiesMessage(recipientId, propertyArray, showMoreButtonVar) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "Recommended Property",
            subtitle: propertyArray[0].title + ". \nRent: " + propertyArray[0].rent + ". \nDeposit: " + propertyArray[0].deposit,
            item_url: propertyArray[0].shortUrl,
            image_url: propertyArray[0].image,
            buttons: [{
              type: "web_url",
              url: propertyArray[0].detailUrl,
              title: "View Property"
            }, {
              type: "postback",
              title: "Read Here",
              payload: propertyArray[0].description.substring(0, 999),
            }]
          },
          {
            title: "Recommended Property",
            subtitle: propertyArray[1].title + ". Rent: " + propertyArray[1].rent + ". \nDeposit: " + propertyArray[1].deposit,
            item_url: propertyArray[1].shortUrl,
            image_url: propertyArray[1].image,
            buttons: [{
              type: "web_url",
              url: propertyArray[1].detailUrl,
              title: "View Property"
            }, {
              type: "postback",
              title: "Read Here",
              payload: propertyArray[1].description.substring(0, 999),
            }]
          },
          {
            title: "Recommended Property",
            subtitle: propertyArray[2].title + ". Rent: " + propertyArray[2].rent + ". \nDeposit: " + propertyArray[2].deposit,
            item_url: propertyArray[2].shortUrl,
            image_url: propertyArray[2].image,
            buttons: [{
              type: "web_url",
              url: propertyArray[2].detailUrl,
              title: "View Property"
            }, {
              type: "postback",
              title: "Read Here",
              payload: propertyArray[2].description.substring(0, 999),
            }]
          },
          {
            title: "Recommended Property",
            subtitle: propertyArray[3].title + ". Rent: " + propertyArray[3].rent + ". \nDeposit: " + propertyArray[3].deposit,
            item_url: propertyArray[3].shortUrl,
            image_url: propertyArray[3].image,
            buttons: [{
              type: "web_url",
              url: propertyArray[3].detailUrl,
              title: "View Property"
            }, {
              type: "postback",
              title: "Read Here",
              payload: propertyArray[3].description.substring(0, 999),
            }]
          }]
        }
      }
    }
  };  

  callSendAPI(messageData);

  if (showMoreButtonVar) {
    echoMessage(recipientId, 'inside showMoreButtonVar');
    setTimeout(showMoreButtonVar(recipientId), 2000);
  }
}

var showMoreButtonVar = function showMoreButton(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text: 'Wish to see more properties?',
            buttons: [{
            "type": "postback",
            "payload": "showmore",
            "title": "Show More properties"
            }, {
            "type": "postback",
            "payload": "reset",
            "title": "Reset Search"
            }]
        }
      }
    }
  };  

  callSendAPI(messageData);
}

function sendGenericMessage(recipientId) {
  var fbResponse;

  request({
            url: 'https://graph.facebook.com/v2.6/'+ recipientId +'?fields=',
            qs: {access_token: PAGE_ACCESS_TOKEN},
            method: 'GET'
        }, function(error, response, body) {
            if (error) {
                console.log('Error sending message: ', error);
            } else if (response.body.error) {
                console.log('Error: ', response.body.error);
            }else{
                fbResponse = JSON.parse(body);
                var messageData = {
              recipient: {
                  id: recipientId
              },
              message:{
                attachment: {
                  type: "template",
                  payload: {
                    template_type: "button",
                    text: 'Dear ' + fbResponse.first_name + '.\nI am an AI-based assistant for Nobroker. Ask me things like: \'2 bhk flats in koramangala bangalore.\'\n\n',
                    buttons: [{
                        "type": "web_url",
                        "url": "http://www.nobroker.in/tenant/plans",
                        "title": "Take me to Nobroker"
                        }, {
                        "type": "postback",
                        "title": "Buy or Rent property",
                        "payload": "plan"
                      }, {
                        "type": "web_url",
                        "title": "Post your property",
                        "url": "http://www.nobroker.in/list-your-property-for-rent-sale"
                      }
                    ]
                }
              }
            }
          }
        callSendAPI(messageData);
            }
        });
}

function askIntent(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
          type: "template",
          payload: {
          template_type: "button",
          text: 'Please select your preference: buy/rent',
          buttons: [{
          "type": "postback",
          "payload": "Buy",
          "title": "Buy"
          }, {
          "type": "postback",
          "title": "Rent",
          "payload": "Rent"
          }]
          }
          }
    }
  };  

  callSendAPI(messageData);
}

function echoMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  };

  callSendAPI(messageData);
}

function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      console.log("Successfully sent message with id %s to recipient %s", 
        messageId, recipientId);
    } else {
      console.error("Unable to send message.");
      console.error(response);
      console.error(error);
    }
  });  
}

function sendPlansMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "Freedom Plan",
            subtitle: "Set yourself free and get more owner contacts",
            item_url: "http://www.nobroker.in/tenant/plans",
            image_url: "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcSA7kPTdRq4JiOqF6i24scjHgMBUy1EBpzi1aBiI9WrP-QEOtJdAQ",
            buttons: [{
              type: "web_url",
              url: "http://www.nobroker.in/tenant/plans",
              title: "View on Web"
            }, {
              type: "postback",
              title: "Read Here",
              payload: "freedom",
            }],
          }, {
            title: "Relax Plan",
            subtitle: "Sit back and relax, get a personal assistant to find a house",
            item_url: "http://www.nobroker.in/tenant/plans",
            image_url: "http://paulstallard.me/wp-content/uploads/2015/07/relax-05.jpg",
            buttons: [{
              type: "web_url",
              url: "http://www.nobroker.in/tenant/plans",
              title: "View on Web"
            }, {
              type: "postback",
              title: "Read Here",
              payload: "relax",
            }], 
          }, {
            title: "Assure Plan",
            subtitle: "Guaranteed home solutions with a personal assistant",
            item_url: "http://www.nobroker.in/tenant/plans",
            image_url: "http://comps.gograph.com/100-percent-assured-stamp_gg55034019.jpg",
            buttons: [{
              type: "web_url",
              url: "http://www.nobroker.in/tenant/plans",
              title: "View on Web"
            }, {
              type: "postback",
              title: "Read Here",
              payload: "assure",
            }]
          }]
        }
      }
    }
  };  

  callSendAPI(messageData);
}

function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback button for Structured Messages. 
  var payload = event.postback.payload;
  // console.log("Received postback for user %d and page %d with payload '%s' at %d", senderID, recipientID, payload, timeOfPostback);

  // When a postback is called, we'll send a message back to the sender to let them know it was successful
  if (payload.toString().toLowerCase() === ("plan")) {
  sendPlansMessage(senderID);
  } else if (payload.toString().toLowerCase() === ("freedom")) {
    messageText = "Set yourself free and get more owner contacts.";
    echoMessage(senderID, messageText);
  } else if (payload.toString().toLowerCase() === ("relax")) {
    messageText = "Sit back and relax, get a personal assistant to find a house.";
    echoMessage(senderID, messageText);
  } else if (payload.toString().toLowerCase() === ("assure")) {
    messageText = "Guaranteed home solutions with a personal assistant.";
    echoMessage(senderID, messageText);
  } else if (payload.toString().toLowerCase() === ("rent")) {
    if (!userMap.hasOwnProperty(senderID)) {
      console.error('Adding new user to session: ' + senderID);
      var user = new User();
      user.intent = 'rent';
      userMap[senderID] = user;
  //  client.hmset(senderID, JSON.stringify(user));
  //  client.expire(senderID, 900);
    }
    var user = userMap[senderID];
/*  client.hgetall(senderID, function(err, object) {
      user = JSON.parse(object) ;
    });
*/
    user.intent = 'rent';
    makeWitCall('rent', senderID)
  } else if (payload.toString().toLowerCase() === ("buy")) {
    if (!userMap.hasOwnProperty(senderID)) {
      console.error('Adding new user to session: ' + senderID);
      userMap[senderID] = new User();
  //  client.hmset(senderID, JSON.stringify(user));
  //  client.expire(senderID, 900);
    }
    var user = userMap[senderID];
/*  client.hgetall(senderID, function(err, object) {
      user = JSON.parse(object) ;
    });
*/
    user.intent = 'buy';
    makeWitCall('buy', senderID)
  } else if (payload.toString().toLowerCase() === ("showmore")) {
      var user = userMap[senderID];
      if (user && user.hasOwnProperty('userPropertyArray') && user.userPropertyArray.length > 3) {
        sendPropertiesMessage(senderID, user.userPropertyArray);
      } else {
        echoMessage(senderID, "Please visit www.nobroker.in for more similar properties.");
      }
  } else if(payload.toString().toLowerCase() === ("reset")){
    userMap[senderID] = new User();
    // client.hmset(senderID, JSON.stringify(new User()));
    echoMessage(senderID, "Reset successful!");
    return;
  } else {
    echoMessage(senderID, "Sorry, didnt understand.");
  }
}

app.get('/', function(request, response) {
  response.render('pages/index');
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});