var NodeHelper = require("node_helper");
const {google} = require('googleapis');
const fs = require('fs');
const Log = require('logger');

const TaskApi = require("./api_protocol.js");


module.exports = NodeHelper.create({

    start: function()
    {
        this.NodeHelperName = this.name + ".NodeHelper";
        
        console.log("Starting node helper for: " + this.name);

        this.oAuth2Client;
        this.service;
    },

    socketNotificationReceived: function(notification, payload)
    {
        Log.log(this.NodeHelperName + ": Notification: " + notification);

        if (notification === TaskApi.REQ_Connect)
        {
            this.authenticate();
        }
        else if (notification === TaskApi.REQ_FetchAllTasks)
        {
            this.getList(payload);
        }
        else if (notification === TaskApi.REQ_PushTaskData)
        {
            this.pushTaskData(payload.config, payload.task);
        }
    },

    authenticate: function()
    {
        if (this.service)
        {
            // Check if tasks service is already running, avoids running authentication twice
            console.log(this.NodeHelperName + ": TASKS SERVICE ALREADY RUNNING, DONT NEED TO AUTHENTICATE AGAIN")
            this.sendSocketNotification(TaskApi.RSP_ServiceReady, {});
            return;
        }
        
        var self = this;

        fs.readFile(self.path + '/credentials.json', (err, content) =>
            {
                if (err)
                {
                    return console.error(this.NodeHelperName + ': Error loading client secret file:', err);
                }
                
                // Authorize a client with credentials, then call the Google Tasks API.
                authorize(JSON.parse(content), self.startTasksService);
            });

        function authorize(credentials, callback)
        {
            const {client_secret, client_id, redirect_uris} = credentials.installed;
            self.oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
          
            // Check if we have previously stored a token.
            fs.readFile(self.path + '/token.json', (err, token) =>
                {
                    if (err)
                    {
                        return console.error(this.NodeHelperName + ': Error loading token');
                    }
                    self.oAuth2Client.setCredentials(JSON.parse(token));
                    callback(self.oAuth2Client, self);
                });
        }
    },

    startTasksService: function(auth, self)
    {
        self.service = google.tasks({version: 'v1', auth});
        self.sendSocketNotification(TaskApi.RSP_ServiceReady, {});
    },

    getList: function(config)
    {
        var self = this;

        if (!self.service)
        {
            console.error(this.NodeHelperName + ": Refresh required"); 
            return;
        }

        self.service.tasks.list({
            tasklist: config.listID,
            //maxResults: config.maxResults,
            showCompleted: config.showCompleted,
            showHidden: config.showHidden
            }, (err, res) =>
            {
                if (err)
                {
                    return console.error(this.NodeHelperName + ': The API returned an error: ' + err);
                }

                var payload = {id: config.listID, items: res.data.items};
                self.sendSocketNotification(TaskApi.RSP_AllTasksData, payload);
            });
    },

    pushTaskData: function(config, item)
    {
        var self = this;

        if (!self.service)
        {
            console.log("Refresh required"); 
            return;
        }

        self.service.tasks.update({
            tasklist: config.listID,
            task: item.id,
            requestBody: item,
            }, (err, res) =>
            {
                if (err)
                {
                    return console.error(this.NodeHelperName + ': The API returned an error: ' + err);
                }
                
                self.sendSocketNotification(TaskApi.RSP_TaskDataPushed, {listID:config.listID, taskID:item.id});
            });
    }
});