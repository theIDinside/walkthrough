# walkthrough README

To be able to use `walkthrough` you will need to provide the CLI token for your phabricator account.

If you want to provide it directly, open settings and set `walkthrough.token` to your token. Otherwise,
in the workspace you are in, you can run the command `walkthrough.RefreshAll: Refresh user's review queue` and it will ask you for your token interactively. Inputting the token here, will save it for this workspace, so you will not have to do it again after that. (Running commands in vscode: `ctrl+shift+p` is default for opening the panel where you can type in commands).

### [0.1.0]
First version displays only 'needs-review' and 'needs-revision' revisions in separate panels.