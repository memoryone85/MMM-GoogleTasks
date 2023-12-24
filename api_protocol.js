const TaskApi = {
    REQ_Connect: "REQ_Connect",
    REQ_FetchAllTasks: "REQ_FetchAllTasks",
    REQ_PushTaskData: "REQ_PushTaskData",
    
    RSP_ServiceReady: "RSP_ServiceReady",
    RSP_AllTasksData: "RSP_AllTasksData",
    RSP_TaskDataPushed: "RSP_TaskDataPushed",
};


if (typeof module !== "undefined") {
	module.exports = TaskApi;
}
