
Module.register("MMM-GoogleTasks", {
    // Default module config.
    defaults: {
        listID: "", // List ID (see authenticate.js)
        maxResults: 10,
        showCompleted: false, //set showCompleted and showHidden true
        dateFormat: "MMM Do", // Format to display dates (moment.js formats)
        updateInterval: 10000, // Time between content updates (millisconds)
        animationSpeed: 2000, // Speed of the update animation (milliseconds)
        tableClass: "small" // Name of the classes issued from main.css
    },

    // Define required scripts
    getScripts: function () { return ["moment.js", "api_protocol.js"]; },
    getStyles: function () { return ["font-awesome.css", "MMM-GoogleTasks.css"]; },
    
    
    // Define start sequence
    start: function ()
    {
        Log.info("Starting module: " + this.name);
        this.tasks;
        this.loaded = false;
        if (!this.config.listID)
        {
            Log.log("config listID required");
        }
        else
        {
            this.sendSocketNotification(TaskApi.REQ_Connect, {});
        }

        // API requies completed config settings if showCompleted
        if (!this.config.showCompleted)
        {
            // delete this.config.completedMin;
            // delete this.config.completedMax;
        }
        else
        {
            this.config.showHidden = true;
        }
    },

    socketNotificationReceived: function (notification, payload)
    {
        var self = this;
        if (notification === TaskApi.RSP_ServiceReady)
        {
            self.sendSocketNotification(TaskApi.REQ_FetchAllTasks, self.config);

            // Create repeating call to node_helper get list
            setInterval(function ()
                {
                    self.sendSocketNotification(TaskApi.REQ_FetchAllTasks, self.config);
                }, self.config.updateInterval);

            // Check if payload id matches module id
        }
        else if (notification === TaskApi.RSP_AllTasksData && payload.id === self.config.listID)
        {
            // Handle new data
            self.loaded = true;
            if (payload.items)
            {
                let nowDate = new Date();
                nowDate.setHours(0);
                nowDate.setMinutes(0);
                nowDate.setSeconds(0);
                nowDate.setMilliseconds(0);
                let nowTime = nowDate.getTime();
                
                self.tasks = payload.items
                    .filter((task) => task.parent === undefined) // Filter tasks to only parent tasks
                    .filter(function(task)
                    {
                        let taskDate = new Date(task.due);
                        taskDate.setHours(0);
                        taskDate.setMinutes(0);
                        taskDate.setSeconds(0);
                        taskDate.setMilliseconds(0);
                        let taskTime = taskDate.getTime();
                        // Don't need tasks from the future.
                        if (taskTime > nowTime)
                        {
                            return false;
                        }
                        // Don't need completed tasks from the past.
                        if (taskTime < nowTime)
                        {
                            if (task.status === "completed")
                            {
                                return false;
                            }
                        }
                        return true;
                    });
                this._sortTasks();

                if (this.tasks
                    .some((task) => task.status !== "completed"))
                {
                    self.sendNotification("USER_PRESENCE", true);
                    self.didSendEmptyPresence = false;
                }
                else
                {
                    if (!self.didSendEmptyPresence)
                    {
                        self.sendNotification("USER_PRESENCE", true);
                        self.didSendEmptyPresence = true;
                    }
                }
                
                self.updateDom(self.config.animationSpeed);
            }
            else
            {
                if (!self.didSendEmptyPresence)
                {
                    self.sendNotification("USER_PRESENCE", true);
                    self.didSendEmptyPresence = true;
                }
                self.tasks = null;
                Log.info("No tasks found.");
                self.updateDom(self.config.animationSpeed);
            }
        }
        else if (notification == TaskApi.RSP_TaskDataPushed && payload.listID === self.config.listID)
        {
            // #TEMP: Request all tasks, since we've finished modifying one. But actually, we should be able to just
            // assume the change we made is good, and leave it up to the regular scheduled update to actually do anything.
            self.sendSocketNotification(TaskApi.REQ_FetchAllTasks, self.config);
        }
    },
    
    
    _sortTasks: function()
    {
        if (this.tasks)
        {
            // Sort attributes like they are shown in the Tasks app
            this.tasks.sort(function(a, b)
            {
                let aCompleted = (a.status === "completed");
                let bCompleted = (b.status === "completed");
                if (aCompleted != bCompleted)
                {
                    return aCompleted ? 1 : -1;
                }
                if (a.due != b.due)
                {
                    return a.due > b.due ? 1 : -1;
                }
                return a.id < b.id ? -1 : 1;
            });
        }
    },
    

    getDom: function ()
    {
        var self = this;

        let wrapper = document.createElement("div");
        wrapper.className = "container ";
        wrapper.className += this.config.tableClass;

        if (!this.tasks)
        {
            wrapper.innerHTML = this.loaded ? "EMPTY" : "LOADING";
            wrapper.className = this.config.tableClass + " dimmed";
            return wrapper;
        }

        this.tasks.forEach((item, index) =>
            {
                let titleWrapper, dateWrapper, noteWrapper;

                titleWrapper = document.createElement("div");
                titleWrapper.className = "item title";

                // If item is completed change icon to checkmark
                let bullet = (item.status === "completed" ? "fa-check" : "fa-circle-thin");
                if (item.status === "completed")
                {
                    titleWrapper.className += " done";
                }

                titleWrapper.innerHTML = '<i class="fa ' + bullet + '" ></i>' + item.title;

                if (item.parent)
                {
                    titleWrapper.className = "item child";
                }

                if (item.notes)
                {
                    noteWrapper = document.createElement("div");
                    noteWrapper.className = "item notes light";
                    noteWrapper.innerHTML = item.notes.replace(/\n/g, "<br>");
                    titleWrapper.appendChild(noteWrapper);
                }

                dateWrapper = document.createElement("div");
                dateWrapper.className = "item date light";

                if (item.due)
                {
                    let date = moment(item.due);
                    dateWrapper.innerHTML = date.utc().format(this.config.dateFormat);
                }

                let thisItem = item;
                titleWrapper.addEventListener("click", (event) =>
                    {
                        Log.log("Clicked");
                        titleWrapper.style.backgroundColor = 'salmon';
                        
                        if (item.status === "completed")
                        {
                            item.status = "needsAction";
                        }
                        else
                        {
                            item.status = "completed";
                        }

                        self.sendSocketNotification(TaskApi.REQ_PushTaskData, {config:self.config, task:thisItem});
                    });

                wrapper.appendChild(titleWrapper);
                wrapper.appendChild(dateWrapper);
            });

        return wrapper;
    }
});
