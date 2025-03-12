const vscode = require("vscode");

const PHABRICATOR_URL = "https://phabricator.services.mozilla.com";

class Revision {
  revisionId;
  phabricatorId;
  summary;
  title;
  uri;
  isDraft;
  bugzillaId;
  dateCreated;
  dateModified;
  status;

  /**
   * @param { number } revisionId
   * @param { string } phabricatorId
   * @param { string } title
   * @param { string } summary
   * @param { string } uri
   * @param { boolean } draft
   * @param { string } bugzillaId
   * @param { number } dateCreated
   * @param { number } dateModified
   * @param { "needs-revision" | "needs-review" } status
   */
  constructor(
    revisionId,
    phabricatorId,
    title,
    summary,
    uri,
    draft,
    bugzillaId,
    dateCreated,
    dateModified,
    status
  ) {
    this.revisionId = revisionId;
    this.phabricatorId = phabricatorId;
    this.title = title;
    this.summary = summary;
    this.uri = uri;
    this.isDraft = draft;
    this.bugzillaId = bugzillaId;
    this.dateCreated = dateCreated;
    this.dateModified = dateModified;
    this.status = status;
  }

  get RevisionId() {
    return `D${this.revisionId}`;
  }

  /**
   *
   * @param {number} maxCount - Set a maxCount of inline comments to fetch
   * @param { boolean | false } getDone=false - if true, also get inline comments that are already done.
   * @returns { Promise<InlineComment[]> }
   */
  async GetInlineComments(maxCount, getDone = false) {
    try {
      const url = `${PHABRICATOR_URL}/api/transaction.search`;
      const body = new URLSearchParams();
      const config = await ConduitConfiguration.GetConfig();
      body.set("api.token", config.token);
      body.set("objectIdentifier", this.RevisionId);
      body.set("limit", `${maxCount}`);

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body,
      });

      const data = await response.json();

      // Extract and return the inline comments
      const comments = data.result.data.filter(
        (transaction) =>
          transaction.type === "inline" && transaction.fields.isDone == getDone
      );

      return comments.map((tx) => {
        return new InlineComment(this, tx);
      });
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to fetch inline comments: ${error}`
      );
      return [];
    }
  }
}

class SourceLocation {
  #path;
  line;
  length;

  /**
   * @param { string } relativeFilePath
   * @param { number } line
   * @param { number } length
   */
  constructor(relativeFilePath, line, length) {
    this.#path = relativeFilePath;
    this.line = line;
    this.length = length;
  }

  get RelativePath() {
    return this.#path;
  }

  get Path() {
    return vscode.Uri.joinPath(
      vscode.workspace.workspaceFolders[0].uri,
      this.RelativePath
    );
  }
}

/**
 * @typedef { { id: number, phid: string, version: number, authorPHID: string, dateCreated: number, dateModified: number, removed: boolean, content: { raw: string } } } CommentTx
 */

class InlineComment {
  /** @type { Revision } */
  #owningRevision;
  id;
  isDone;
  dateCreated;
  dateModified;
  authorPHID;
  textContents;
  replyToCommentPHID;
  sourceLocation;
  objectPHID;
  phid;

  /**
   * @param { Revision } revision
   * @param { object } tx
   */
  constructor(revision, tx) {
    if(tx.type !== 'inline') {
        throw new Error(`Unexpected transaction type: ${tx.type}, required 'inline'`);
    }
    const {path, line, length, isDone, replyToCommentPHID} = tx.fields;
    this.#owningRevision = revision;
    this.id = this.id;
    this.isDone = isDone;
    this.dateCreated = tx.dateCreated;
    this.dateModified = tx.dateModified;
    this.authorPHID = tx.authorPHID;
    this.textContents = tx.comments[0].content.raw;
    this.replyToCommentPHID = replyToCommentPHID;
    this.sourceLocation = new SourceLocation(path, line, length);
    this.objectPHID = tx.objectPHID;
    this.phid = tx.phid;
  }

  get Revision() {
    return this.#owningRevision;
  }

  get Label() {
    return `${this.sourceLocation.RelativePath}:${this.sourceLocation.line}`;
  }
}

class ConduitConfiguration {
  static instance = null;

  static async ConfigureToken() {
    const result = await vscode.window.showInputBox({
      ignoreFocusOut: true,
      placeHolder: "Token...",
      prompt: "Input conduit token",
      title: "Conduit token registration",
    });
    if (result == null) {
      throw new Error(`No token was configured. Can't access Conduit API`);
    }
    await vscode.workspace
      .getConfiguration("walkthrough")
      .update("token", result);
    return result;
  }

  static async ConfigureUser() {
    const bodyParams = new URLSearchParams();
    let conduitToken = vscode.workspace
      .getConfiguration("walkthrough")
      .get("token");
    if (conduitToken == null || conduitToken == undefined) {
      throw new Error(`Conduit token has not been configured for workspace.`);
    }
    bodyParams.append("api.token", conduitToken);

    const response = await fetch(`${PHABRICATOR_URL}/api/user.whoami`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: bodyParams.toString(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    let userId = data.result.phid;
    await vscode.workspace
      .getConfiguration("walkthrough")
      .update("userId", userId);
    return userId;
  }

  static async Init() {
    if (ConduitConfiguration.instance) {
      return ConduitConfiguration.instance;
    }
    let conduitToken = vscode.workspace
      .getConfiguration("walkthrough")
      .get("token");
    if (conduitToken === null || conduitToken === undefined) {
      conduitToken = await ConduitConfiguration.ConfigureToken();
    }

    let userId = vscode.workspace.getConfiguration("walkthrough").get("userId");
    if (userId == null) {
      try {
        userId = await ConduitConfiguration.ConfigureUser();
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to fetch user PHID. Error response: ${error.message}`
        );
        return null;
      }
    }

    ConduitConfiguration.instance = new ConduitConfiguration(
      conduitToken,
      userId
    );
    return ConduitConfiguration.instance;
  }

  /**
   *
   * @returns { Promise<ConduitConfiguration> }
   */
  static async GetConfig() {
    return await ConduitConfiguration.Init();
  }

  constructor(token, user) {
    this.token = token;
    this.user = user;
  }
}

const SUPPORTED_API = [
  "differential.revision.search",
  "transaction.search",
  "differential.diff.search",
];

/**
 * @param { string } API
 * @returns { Promise<any> }
 */
async function GetUserRevisions(API) {
  if (!SUPPORTED_API.includes(API)) {
    throw new Error(`${API} not yet supported.`);
  }
  try {
    const url = `${PHABRICATOR_URL}/api/${API}`;
    const body = new URLSearchParams();
    const config = await ConduitConfiguration.GetConfig();
    body.set("api.token", config.token);
    body.set("constraints[responsiblePHIDs][0]", config.user);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body,
    });

    return await response.json();
  } catch (error) {
    return { error: `Error calling ${API}: ${error.message}` };
  }
}
/**
 * @param { "needs-review" | "needs-revision" } selectedStatus
 * @returns { Promise<Revision[]> } list of revisions to return
 */
async function GetRevisions(selectedStatus) {
  try {
    const response = await GetUserRevisions("differential.revision.search");
    let result = [];
    for (const rev of response.result.data) {
      let { status, summary, title, uri } = rev.fields;
      switch (status?.value ?? "") {
        case "needs-review":
        case "needs-revision":
          if (status.value == selectedStatus) {
            result.push(
              new Revision(
                rev.id,
                rev.phid,
                title,
                summary,
                uri,
                rev.isDraft,
                rev["bugzilla.bug-id"],
                rev.dateCreated,
                rev.dateModified,
                status.value
              )
            );
          }

        default:
          break;
      }
    }
    return result;
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to fetch active revisions: ${error}`
    );
    return [];
  }
}

module.exports = { GetRevisions, Revision, InlineComment };
