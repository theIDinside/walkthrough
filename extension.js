const vscode = require("vscode");
const { RevisionTreeProvider } = require("./src/treeView");

function activate(context) {
  const needRevisionDataProvider = new RevisionTreeProvider("needs-revision");
  vscode.window.registerTreeDataProvider(
    "needsRevision",
    needRevisionDataProvider
  );
  vscode.window.createTreeView("needsRevision", {
    treeDataProvider: needRevisionDataProvider,
    canSelectMany: false,
  });

  const needReviewDataProvider = new RevisionTreeProvider("needs-review");
  vscode.window.registerTreeDataProvider("needsReview", needReviewDataProvider);
  vscode.window.createTreeView("needsReview", {
    treeDataProvider: needReviewDataProvider,
    canSelectMany: false,
  });

  context.subscriptions.push(
    vscode.commands.registerCommand("walkthrough.RefreshNeedsRevision", () => {
      needRevisionDataProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("walkthrough.RefreshNeedsReview", () => {
      needReviewDataProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("walkthrough.RefreshAll", () => {
      needRevisionDataProvider.refresh();
      needReviewDataProvider.refresh();
    })
  );

  // Tree View Click commands & context menu commands
  context.subscriptions.push(
    vscode.commands.registerCommand("walkthrough.InlineCommentClicked", (item) => {
		console.log(`Clicked item: ${JSON.stringify(item.InlineComment, null, 2)}`);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("walkthrough.InlineCommentAction", (item) => {
		console.log(`Clicked item: ${JSON.stringify(item.InlineComment, null, 2)}`);
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
