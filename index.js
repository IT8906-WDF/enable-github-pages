import * as dotenv from 'dotenv';
import { Octokit } from 'octokit';

dotenv.config();

function makePagesUrl(repository) {
    return `https://${process.env.GITHUB_ORG_NAME}.github.io/${repository}`;
}

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});

console.log('Getting repositories...');
const response = await octokit.request('GET /search/repositories', {
    q: `org:${process.env.GITHUB_ORG_NAME} ${process.env.GITHUB_REPO_PREFIX}*`,
    per_page: 100,
});
const repositories = response.data.items.map((repository) => repository.name);
console.log(`${repositories.length} Found!`);
console.log(repositories);

console.log(`Enabling GitHub Pages`);
const creationRequests = repositories.map((repository) =>
    octokit
        .request('POST /repos/{owner}/{repo}/pages', {
            owner: process.env.GITHUB_ORG_NAME,
            repo: repository,
            build_type: 'workflow', // Deploy with GitHub Action
            source: {
                branch: 'main',
            },
        })
        .then((response) => [response.data.html_url, 'Ok'])
        .catch((error) => {
            if (error.status === 422) {
                return [repository, error.response.data.message];
            } else if (error.status === 409) {
                return [makePagesUrl(repository), error.response.data.message];
            } else {
                throw error;
            }
        }),
);
const creationResponses = await Promise.all(creationRequests);
console.log(creationResponses);

console.log(`Triggering Build`);
const triggers = repositories.map((repository) =>
    octokit
        .request('POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches', {
            owner: process.env.GITHUB_ORG_NAME,
            repo: repository,
            workflow_id: 'deploy_to_github_pages.yml',
            ref: 'main',
        })
        .then((response) => [makePagesUrl(repository), 'Ok']),
);
const triggerResponses = await Promise.all(triggers);
console.log(triggerResponses);
