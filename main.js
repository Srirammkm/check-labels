const core = require('@actions/core');
const github = require('@actions/github');
const { Octokit } = require("@octokit/rest");
const YAML = require('yamljs');

async function run() { 
    const token =  core.getInput("github-token", { required: true });
    const octokit = github.getOctokit(token);

    const labelNames = await getPullRequestLabelNames(octokit);
    
    //getting input values
    const labels = getInputLabels();

    const result = labels.every(
        (label) => labelNames.findIndex((value) => label === value) >= 0
    );
    const services = [];
    var monthly_release = "";
    var adhoc = "";
    var userconfirmation = "manual";

    labelNames.forEach((value) => { 
        if(value.startsWith("update-") && !value.endsWith("all")){
            services.push(value.replace("update-", ""));
        }
        if(value.startsWith("MR-")){
            monthly_release = value.replace("MR-","");
        }
        if(value.startsWith("AH-")){
            adhoc = value.replace("AH-","");
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

    if( monthly_release != ""){
    path = `deployments/monthly-release/${monthly_release}`
    set_output_job(path)
    } else if( adhoc != "" ){
        path = `deployments/adhoc-tasks/${adhoc}`
        set_output_job(path)
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
    const raw = core.getInput("labels", { required: true });
    const json = JSON.parse(raw);
    return Array.isArray(json) ? json : [];
}

run().catch((err) => {
    core.setFailed(err.message);
});
//
