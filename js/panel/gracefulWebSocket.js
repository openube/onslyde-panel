(function (window, document) {
  "use strict";

  window.addEventListener('load', function (e) {
    // in fallback mode: connect returns a dummy object implementing the WebSocket interface
    wsf = onslyde.wsFallback.createSocket().gracefulWebSocket('ws://' + onslyde.ws.ip(onslyde.ws.sessionID()) + ':8081'); // the ws-protocol will automatically be changed to http
  }, false);

onslyde.wsFallback = onslyde.prototype = {

 createSocket : function() {

  function encodeData(data) {
    var urlEncodedData = "";

    for (var name in data) {
      urlEncodedData += name + "=" + data[name] + "&";
    }

    // We remove the last "&" character
    urlEncodedData = urlEncodedData.slice(0, -1);
    return urlEncodedData;
  }

  return{
    gracefulWebSocket:function (url, options) {
      // Default properties
      this.defaults = {
        keepAlive:false, // not implemented - should ping server to keep socket open
        autoReconnect:false, // not implemented - should try to reconnect silently if socket is closed
        fallback:true, // not implemented - always use HTTP fallback if native browser support is missing
        fallbackSendURL:url === 'ws://107.22.176.73:8081' ? 'http://onslyde.com' : url.replace('ws:', 'http:').replace('wss:', 'https:').replace('8081', '8080'),
        fallbackSendMethod:'POST',
        fallbackPollURL:url === 'ws://107.22.176.73:8081' ? 'http://onslyde.com' : url.replace('ws:', 'http:').replace('wss:', 'https:').replace('8081', '8080'),
        fallbackPollMethod:'GET',
        fallbackOpenDelay:100, // number of ms to delay simulated open event
        fallbackPollInterval:3000, // number of ms between poll requests
        fallbackPollParams:{}    // optional params to pass with poll requests
      };

      // Override defaults with user properties
      var opts = this.defaults;

      /**
       * Creates a fallback object implementing the WebSocket interface
       */
      function FallbackSocket() {

        // WebSocket interface constants
        var CONNECTING = 0;
        var OPEN = 1;
        var CLOSING = 2;
        var CLOSED = 3;

        var pollInterval;
        var openTimout;
        var posturl = '';


        // create WebSocket object
        var fws = {
          // ready state
          readyState:CONNECTING,
          bufferedAmount:0,
          send:function (senddata) {

            var success = true;
            //replace colon from namespaced websocket data

            //todo - peak option for polling
            var vote = '',
              attendeeIP = localStorage['onslyde.attendeeIP'];

            if (senddata.indexOf('speak:') === 0) {
              vote = senddata.replace(('speak:'), '');
              posturl = opts.fallbackSendURL + '/go/attendees/speak';
              senddata = {"speak":vote, "sessionID":onslyde.ws.sessionID(), "attendeeIP":attendeeIP};
            } else {
              if (senddata.indexOf('vote:') === 0) {
                vote = senddata.replace(('vote:'), '');
              } else if (senddata.indexOf('props:') === 0) {
                vote = senddata.replace(('props:'), '');
              }

              if (vote.split(',').length > 0) {
                //we know/assume there will be 3 items in the array,
                //with the vote data being the first

                vote = vote.split(',')[0];
              }

              if (!window['userObject'] || typeof userObject === 'undefined') {
                 window.userObject = {
                  name:'unknown',
                  email:'unknown'
                };
              }

              posturl = opts.fallbackSendURL + '/go/attendees/vote';
              senddata = {"vote":vote, "sessionID":onslyde.ws.sessionID(), "attendeeIP":attendeeIP, "username":window.userObject.name, "email":window.userObject.email};
            }

            var ai = new onslyde.core.ajax(posturl, function (text, url) {
              pollSuccess();
            }, false);
            ai.doPost(encodeData(senddata));

            return success;
          },
          close:function () {
            window.clearTimeout(openTimout);
            window.clearInterval(pollInterval);
            this.readyState = CLOSED;
          },
          onopen:function () {
          },
          onmessage:function (message) {
            //use the same message handler as core ws
            onslyde.ws._onmessage(message);
          },
          onerror:function () {
          },
          onclose:function () {
          },
          sendText:function(text){
            fws.send(text);
          },
          previousRequest:null,
          currentRequest:null
        };


        function getFallbackParams(tracked) {

          // update timestamp of previous and current poll request
          fws.previousRequest = fws.currentRequest;
          fws.currentRequest = new Date().getTime();

          return  {
            "previousRequest":fws.previousRequest,
            "currentRequest":fws.currentRequest,
            "sessionID":onslyde.ws.sessionID(),
            "attendeeIP":localStorage['onslyde.attendeeIP'],
            "tracked":tracked};
        }

        /**
         * @param {Object} data
         */
        function pollSuccess(data) {
          var messageEvent = {"data":data};
          fws.onmessage(messageEvent);
        }

        var counter = 0;

        function poll(tracked) {

          if (tracked !== 'start') {
            tracked = 'active';
          }

          var pollData = getFallbackParams(tracked);

          var ai = new onslyde.core.ajax(opts.fallbackPollURL + '/go/attendees/json?' + encodeData(pollData), function (text, url) {
            pollSuccess(text);
          }, false);
          ai.doGet();

          counter++;
          if (counter === 3600) {
            window.clearInterval(pollInterval);
          }
        }

        // simulate open event and start polling
        openTimout = window.setTimeout(function () {
          fws.readyState = OPEN;
          poll('start');
          pollInterval = window.setInterval(poll, opts.fallbackPollInterval);
        }, opts.fallbackOpenDelay);

        // return socket impl
        return fws;
      }

      // create a new websocket or fallback
      var ws;

      if("WebSocket" in window && WebSocket.CLOSED > 2){
        ws = onslyde.ws.connect(null,'',onslyde.ws.sessionID());
      }else{
        ws = new FallbackSocket();
      }

      var senddata = {"sessionID":onslyde.ws.sessionID(), "attendeeIP":onslyde.ws.getip()};

      //create the ajax object for use when client disconnects
      var ai = new onslyde.core.ajax(opts.fallbackPollURL + '/go/attendees/remove', function (text, url) {}, false);

      window.addEventListener("beforeunload", function (e) {
        ws.close();
        ws = null;
        var confirmationMessage = 'thanks!';
        //disconnect polling client on server
        if (!("WebSocket" in window)) {
          ai.doPost(encodeData(senddata));
        }
        (e || window.event).returnValue = confirmationMessage;  //Webkit, Safari, Chrome etc.
        return confirmationMessage;
      });

      return ws;
    }
  };
}

};
})(window,document);
