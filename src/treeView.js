const vscode = require("vscode");
const { GetRevisions } = require("./conduitApi");

/**
 * @import { Revision, InlineComment } from "./conduitApi";
 */

class InlineCommentTreeItem extends vscode.TreeItem {
  #transaction;
  contextValue = "InlineCommentTreeItem";

  /**
   * @param {InlineComment} inlineComment
   */
  constructor(inlineComment) {
    super(inlineComment.Label, vscode.TreeItemCollapsibleState.None);
    this.#transaction = inlineComment;
    this.command = {
      command: "walkthrough.InlineCommentClicked",
      title: "Open",
      arguments: [this],
    };
  }

  get InlineComment() {
    return this.#transaction;
  }
}

class RevisionTreeItem extends vscode.TreeItem {
  /** @type { Revision } */
  #revision;

  /** @type { InlineCommentTreeItem[] } */
  #inlineComments = [];

  contextValue = "RevisionTreeItem";
  /**
   * @param {Revision} revision
   */
  constructor(revision) {
    super(revision.title, vscode.TreeItemCollapsibleState.Collapsed);
    this.#revision = revision;
  }

  async UpdateInlineCommentsCache() {
    const inlineComments = await this.#revision.GetInlineComments(500, false);
    this.#inlineComments = inlineComments.map(
      (item) => new InlineCommentTreeItem(item)
    );
  }

  InlineComments() {
    return this.#inlineComments;
  }

  NeedsRefresh() {
    return this.#inlineComments.length == 0;
  }
}

class RevisionTreeProvider {
  /** @type {"needs-review" | "needs-revision"} */
  revisionStatus;
  /** @type { RevisionTreeItem[] } */
  revisions;

  /**
   * @param {"needs-review" | "needs-revision"} revisionStatus
   */
  constructor(revisionStatus) {
    this.revisionStatus = revisionStatus;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.revisions = [];
  }

  async refresh() {
    this.revisions = await GetRevisions(this.revisionStatus).then((res) =>
      res.map((revision) => new RevisionTreeItem(revision))
    );
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element) {
    return element;
  }

  async getChildren(element) {
    // If the element is a RevisionTreeItem and is expanded
    if (element instanceof RevisionTreeItem) {
      if (
        element.collapsibleState ===
          vscode.TreeItemCollapsibleState.Collapsed &&
        element.NeedsRefresh()
      ) {
        await element.UpdateInlineCommentsCache();
      }
      return element.InlineComments();
    }
    return this.revisions;
  }
}

module.exports = { RevisionTreeProvider };
