/**
 * Server instructions, returned in the `initialize` response and surfaced by clients as
 * standing context for the whole session - no tool call or prompt needed.
 *
 * Three jobs: say what this server is connected to, get records linked rather than
 * described, and get records read before they are written. Every byte here costs context in
 * every session, so keep it to things a client cannot work out from the tool list: the
 * identity of the system, which identifier a human recognises, what to do with `url`, and
 * that these writes land on shared production data.
 *
 * The read-before-write sentence earns its place because the alternative is silent: Aha's
 * writes replace values rather than merging them, `aha_search` cannot return the fields a
 * writer is about to overwrite, and a model that never calls `aha_get_*` first will not
 * notice any of that. It is the one instruction here whose absence corrupts data rather
 * than merely costing a round trip.
 *
 * Guidance, not enforcement - clients vary in how prominently they surface this. Anything
 * that must hold belongs in the data instead.
 */

/**
 * Build the instructions for a configured company.
 *
 * The subdomain is interpolated so the client knows which account it is looking at, and can
 * recognise a record link on sight. Note this is fixed at `initialize` time: a later
 * `configure_server` call that changes the company cannot revise instructions the client has
 * already been handed, so the named host can go stale within a session. The `url` on each
 * record always reflects the live credentials, which is why the text points at that rather
 * than asking anyone to assemble links from the host.
 *
 * @param subdomain The configured Aha.io company subdomain, if there is one
 */
export function buildServerInstructions(subdomain?: string | null): string {
  const account = subdomain
    ? `the account at https://${subdomain}.aha.io`
    : 'the account this server is configured against';

  return `Aha! (aha.io) is the product management tool used for ${account}, and these tools read and write it directly. Its records are the live, shared source of truth rather than a scratch copy: ideas are incoming customer requests, features and epics are planned work, releases group work by date, and goals and initiatives hold the strategy that work rolls up to.

Read a record before you change it. \`aha_search\` returns only a name, type, id and URL - never workflow status, release membership or custom field values - so read the record itself with \`aha_get_feature\`, \`aha_get_epic\`, \`aha_get_idea\`, \`aha_get_initiative\` or \`aha_get_release\` before writing to it, and report what it currently says if a change looks like it would overwrite someone else's work. Two of these tools replace a whole collection rather than adding to it: \`aha_update_feature_tags\` and \`aha_associate_feature_with_goals\` drop anything left out of the request.

Records carry two identifiers. \`reference_num\` - PROJA-134, IDEASB-I-6375 - is the one people use and the one the Aha UI shows. \`id\` is an internal number nobody recognises. Name a record by its reference number.

Every record also carries an absolute \`url\` to its page in Aha. Use it. When you mention a feature, idea, epic, release, goal or initiative, render a markdown link to that \`url\`, labelled with the reference number and name - the user's next step is usually to open the record. Report search results as a list of such links rather than as raw JSON. \`resource\` is the REST endpoint for a record, not a page a person can read, so never offer it as the link.`;
}
