const core = require('@actions/core');
const github = require('@actions/github');
const { Octokit } = require("@octokit/rest");
const YAML = require('yamljs');

async function run() { 
    const token =  core.getInput("github-token", { required: true });
    const task_path = core.getInput("task-path", { required: false });
    const is_adhoc = core.getInput("is-adhoc", { required: false });
    const task_name = core.getInput("task-name", { required: false });
    const octokit = github.getOctokit(token);

    const labelNames = await getPullRequestLabelNames(octokit);
    
    //getting input values
    const labels = getInputLabels();

    const result = labels.every(
        (label) => labelNames.findIndex((value) => label === value) >= 0
    );
    const services = [];
    var userconfirmation = "manual";

    labelNames.forEach((value) => { 
        if(value.startsWith("update-") && !value.endsWith("all")){
            services.push(value.replace("update-", ""));
        }
        if(value === "manual"){
            userconfirmation = "manual"
        }
        if(value === "auto"){
            userconfirmation = "auto"
        }
    });
    const ftBranch = [];
    labelNames.forEach((value) => { 
        if(value.startsWith("origin/")){
            ftBranch.push(value);
        }
    });

    const octo = new Octokit({
        auth: token,
        });
    async function get_task_list(path){
        content = await octo.rest.repos.getContent({
                    owner: github.context.repo.owner,
                    repo: github.context.repo.repo,
                    path: path
                }).then(function(response){
                    let data = response["data"]["content"];
                    let buff = new Buffer.from(data, 'base64');
                    let text = buff.toString('ascii');
                    const ystring = YAML.parse(text)
                    const jsonStr = JSON.stringify(ystring);
                    const json = JSON.parse(jsonStr)
                    return json
                });
        return content
    }
    async function get_task_content(file){
        content = await octo.rest.repos.getContent({
                    owner: github.context.repo.owner,
                    repo: github.context.repo.repo,
                    path: `deployments/taskdefinitions/${file}.json`
                }).then(function(response){
                    let data = response["data"]["content"];
                    let buff = new Buffer.from(data, 'base64');
                    let text = buff.toString('ascii');
                    const json = JSON.parse(text);
                    return json
                });
        return content
    }
    async function set_output_job(path){
         await get_task_list(path).then(async function(response){
            const lst = [];
            const stages = response["stages"]
            var count = 0
            for (const index in stages) { 
                const dict = {}
                await get_task_content(stages[index]).then(async function(response){
                    dict["index"] = index
                    dict["job_name"] = stages[index]
                    let val = await {...dict,...response}
                    lst.push(val)
                    count++
                    if(count == stages.length){
                    core.setOutput("jobs", lst);
                    }
                });
              }
        })
    }

    if( task_path != ""){
    path = `${task_path}`
    set_output_job(path)
    } else if ( is_adhoc === "true") {
        const lst = [];
        jobs = get_task_content(task_name)
        lst.push(jobs)
        core.setOutput("jobs", lst);
    } else {
        core.setOutput("jobs", []);
    }
    core.setOutput("result", result);
    core.setOutput("labels", labelNames);
    core.setOutput("services",services.toString());
    core.setOutput("ft-branch", ftBranch.toString());
    core.setOutput("userconfirmation", userconfirmation);
}

async function getPullRequestLabelNames(octokit) {
    const owner = github.context.repo.owner;
    const repo = github.context.repo.repo;
    const commit_sha = github.context.sha;

    const response =
        await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
            owner,
            repo,
            commit_sha,
        });

    const pr = response.data.length > 0 && response.data[0];
    return pr ? pr.labels.map((label) => label.name || "") : [];
}

function getInputLabels() {
    const raw = core.getInput("labels", { required: false });
    const json = JSON.parse(raw);
    return Array.isArray(json) ? json : [];
}

run().catch((err) => {
    core.setFailed(err.message);
});
//
