const core = require('@actions/core');
const github = require('@actions/github');

async function run() {
    const token = core.getInput("github-token", { required: true });
    const octokit = github.getOctokit(token);

    const labelNames = await getPullRequestLabelNames(octokit);

    const labels = getInputLabels();
    const result = labels.every(
        (label) => labelNames.findIndex((value) => label === value) >= 0
    );
    const services = [];
    labelNames.forEach((value) => { 
        if(value.startsWith("update-") && !value.endsWith("all")){
            services.push(value.replace("update-", ""));
        }
    });
    core.setOutput("result", result);
    core.setOutput("labels", labelNames);
    core.setOutput("services",services.toString())
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
