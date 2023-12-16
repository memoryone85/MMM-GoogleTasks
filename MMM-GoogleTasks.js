
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

    // Pointless for a mirror, not currently implemented
    /* 
    dueMax: "2040-07-11T18:30:00.000Z", // RFC 3339 timestamp 
    dueMin: "1970-07-11T18:30:00.000Z", // RFC 3339 timestamp 
    completedMax: "2040-07-11T18:30:00.000Z", //only if showCompleted true (RFC 3339 timestamp)
    completedMin: "1970-07-11T18:30:00.000Z", //only if showCompleted true (RFC 3339 timestamp)
    */
  },

  // Define required scripts
  getScripts: function () {
    return ["moment.js"];
  },

  // Define required scripts.
  getStyles: function () {
    return ["font-awesome.css", "MMM-GoogleTasks.css"];
  },

  // Define start sequence
  start: function () {
    Log.info("Starting module: " + this.name);
    this.tasks;
    this.loaded = false;
    if (!this.config.listID) {
      Log.log("config listID required");
    } else {
      this.sendSocketNotification("MODULE_READY", {});
    }

    // API requies completed config settings if showCompleted
    if (!this.config.showCompleted) {
      // delete this.config.completedMin;
      // delete this.config.completedMax;
    } else {
      this.config.showHidden = true;
    }
  },

  socketNotificationReceived: function (notification, payload) {
      var self = this;
    if (notification === "SERVICE_READY") {
      self.sendSocketNotification("REQUEST_UPDATE", self.config);

      // Create repeating call to node_helper get list
      setInterval(function () {
        self.sendSocketNotification("REQUEST_UPDATE", self.config);
      }, self.config.updateInterval);

      // Check if payload id matches module id
    } else if (
      notification === "UPDATE_DATA" &&
      payload.id === self.config.listID
    ) {
      // Handle new data
      self.loaded = true;
      if (payload.items) {
        self.tasks = payload.items;
        self.updateDom(self.config.animationSpeed);
      } else {
        self.tasks = null;
        Log.info("No tasks found.");
        self.updateDom(self.config.animationSpeed);
      }
    }
  },

  getDom: function () {
    var self = this;

    let wrapper = document.createElement("div");
    wrapper.className = "container ";
    wrapper.className += this.config.tableClass;

    if (!this.tasks) {
      wrapper.innerHTML = this.loaded ? "EMPTY" : "LOADING";
      wrapper.className = this.config.tableClass + " dimmed";
      return wrapper;
    }
    
    let nowDate = new Date();
    nowDate.setHours(0);
    nowDate.setMinutes(0);
    nowDate.setSeconds(0);
    let nowTime = nowDate.getTime();
    this.tasks = this.tasks
        .filter((task) => task.parent === undefined) // Filter tasks to only parent tasks
        .filter(function(task)
        {
            let taskDate = new Date(task.due);
            taskDate.setHours(0);
            taskDate.setMinutes(0);
            taskDate.setSeconds(0);
            return taskDate.getTime() <= nowTime;
        });

    // Sort attributes like they are shown in the Tasks app
    this.tasks = this.tasks.sort((a, b) =>
      a.due > b.due ? 1 : -1
    );

    let titleWrapper, dateWrapper, noteWrapper;

    this.tasks.forEach((item, index) => {
      titleWrapper = document.createElement("div");
      titleWrapper.className = "item title";
      
      // If item is completed change icon to checkmark
      let bullet = (item.status === "completed" ? "fa-check" : "fa-circle-thin");
      if (item.status === "completed")
      {
          titleWrapper.className += " done";
      }
      
      titleWrapper.innerHTML =
        '<i class="fa ' + bullet + '" ></i>' + item.title;

      if (item.parent) {
        titleWrapper.className = "item child";
      }

      if (item.notes) {
        noteWrapper = document.createElement("div");
        noteWrapper.className = "item notes light";
        noteWrapper.innerHTML = item.notes.replace(/\n/g, "<br>");
        titleWrapper.appendChild(noteWrapper);
      }

      dateWrapper = document.createElement("div");
      dateWrapper.className = "item date light";

      if (item.due) {
        let date = moment(item.due);
        dateWrapper.innerHTML = date.utc().format(this.config.dateFormat);
      }
      
      let thisItem = item;
      titleWrapper.addEventListener("click", (event) =>
      {
          Log.log("Clicked");
          event.target.style.backgroundColor = 'salmon';
          self.sendSocketNotification("TOGGLE_COMPLETE", {config:self.config, task:thisItem});
      });

      wrapper.appendChild(titleWrapper);
      wrapper.appendChild(dateWrapper);
    });

    return wrapper;
  }
});
