const core = require('@actions/core');
const github = require('@actions/github');
const { Octokit } = require("@octokit/rest");

async function run() { 
    const token = "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" //core.getInput("github-token", { required: true });
    const octokit = github.getOctokit(token);

    const labelNames = await getPullRequestLabelNames(octokit);

    const labels = getInputLabels();
    const result = labels.every(
        (label) => labelNames.findIndex((value) => label === value) >= 0
    );
    const services = [];
    var monthly_release = "";
    labelNames.forEach((value) => { 
        if(value.startsWith("update-") && !value.endsWith("all")){
            services.push(value.replace("update-", ""));
        }
        if(value.startsWith("MR-")){
            monthly_release = value.replace("MR-","");
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
    async function get_content(file){
        content = await octo.rest.repos.getContent({
                    owner: github.context.repo.owner,
                    repo: github.context.repo.repo,
                    path: `taskdefinitions/${file}.json`
                }).then(function(response){
                    let data = response["data"]["content"];
                    let buff = new Buffer.from(data, 'base64');
                    let text = buff.toString('ascii');
                    const json = JSON.parse(text);
                    return json
                });
        return content
    }
    if( monthly_release != ""){
    get_content(monthly_release).then(async function(response){
        const lst = [];
        const stages = response["stages"]
        var count = 0
        for (const index in stages) { 
            const dict = {}
            await get_content(stages[index]).then(async function(response){
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
    })} else {
        core.setOutput("jobs", []);
    }
    core.setOutput("result", result);
    core.setOutput("labels", labelNames);
    core.setOutput("services",services.toString())
    core.setOutput("ft-branch", ftBranch.toString())
}

async function getPullRequestLabelNames(octokit) {
    const owner = github.context.repo.owner;
    const repo = github.context.repo.repo;
    const commit_sha = "f3dfca819f507cea954a9c4122385ed1e8ea3461" //github.context.sha;

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
    const raw = `["auto-ebf"]`//core.getInput("labels", { required: true });
    const json = JSON.parse(raw);
    return Array.isArray(json) ? json : [];
}

run().catch((err) => {
    core.setFailed(err.message);
});
//