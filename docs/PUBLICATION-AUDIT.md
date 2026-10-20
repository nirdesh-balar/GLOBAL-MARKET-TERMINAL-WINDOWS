# Phase 1.2 pre-publication audit

Date: 2026-10-20. Destination: https://github.com/nirdesh-balar/GLOBAL-MARKET-TERMINAL-WINDOWS (owner-created public repository). No repository creation is requested or attempted.

## Reviewed scope

- Actual starting Windows HEAD: `10d274935a116cf0ad5831f6376d6b33f1cc11d5`, main, clean working tree, initially no remote.
- Existing remote was verified empty with git ls-remote and GitHub repository metadata. Origin now points only to the existing Windows repository. No force push is permitted.
- 107 tracked files, 5 independent commits and 120 unique reachable file blobs were inspected before publication.
- No private-key blocks, known credential/token patterns or personal absolute Mac home paths were found in reachable source/history blobs.
- No virtual environment, node_modules, profile, cache, database, log, generated application binary, downloaded financial file or private evidence was tracked.
- Six email matches in distributed upstream license/author notices and public npm package metadata were reviewed as required public attribution/metadata. They are preserved. Copyright/author names and GitHub ownership identifiers remain intentional public project attribution.
- Necessary exact-version third-party license/notice files remain tracked. Known incomplete third-party provenance and packaging-tool advisory gates remain documented; this audit does not grant official binary release permission or market-data distribution rights.

## Commit metadata privacy

Five unpublished commits initially contained the owner's personal email in author/committer metadata. A verified Git bundle was saved in ignored local work storage before cleanup. Author/committer email fields were replaced with the owner's GitHub-provided noreply form; parent IDs were updated accordingly. Names, timestamps, commit messages, source trees and independent history structure were preserved. Every rewritten commit's source tree was checked equal to its original. No remote history existed or was overwritten, no force push was used, and the original Mac repository was never opened or modified.

Privacy-cleaned baseline HEAD: `c4686e6584eb07e8b49a46f02a9f84f6f3ce946e`. Source tree: `512b470fd2bfe48b3db4c8b097e6357e9fe78515`. Historical local SHA references in earlier reports describe the pre-publication local history; their underlying source trees are unchanged. The private backup and mapping remain ignored and are not uploaded.

## Authentication and CI boundaries

The connected GitHub service reports owner push/admin permission, but a separate local Git/CLI authentication route is needed to transfer the existing Git history. Git dry-run initially failed for missing credentials. Browser device authorization is completed by the owner, with no device code or credential requested in chat or included in published files. No private login logs are tracked.

Only the verified Windows main branch is eligible for a normal push. The unchanged Windows workflow uses windows-2022 x64, locked dependencies, immutable action SHAs, read-only workflow permissions and development artifacts. Official releases, release assets and auto-update publication remain disabled. Native Windows pass/fail evidence must come from actual Actions logs and artifacts, not Mac test results.
