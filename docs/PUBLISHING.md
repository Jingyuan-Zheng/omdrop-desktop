# Upload this prepared repository to GitHub

The local repository is prepared on `main`. No remote is configured and no files
have been uploaded. Do not upload the parent workspace: use this directory only.

1. Review README.md, NOTICE.md, supported versions and the generated packages.
2. Set your desired Git author identity for future commits. If you want to
   replace the neutral preparation author on the initial commit, configure
   `user.name` and `user.email`, then run `git commit --amend --reset-author --no-edit`.
3. Create an **empty** GitHub repository. Do not initialize it with a separate
   README or license. `omdrop-desktop` is a suggested repository name, not an
   existing remote claimed by this source tree.
4. Copy its actual URL and run:

```sh
git remote add origin YOUR_REPOSITORY_URL
git push -u origin main
```

Replace `YOUR_REPOSITORY_URL` with GitHub's actual HTTPS or SSH URL. No token
belongs in this file or in a remote URL. Authenticate through your Git client.

Before a public announcement, enable Issues, GitHub Actions and private
vulnerability reporting in repository settings. Adjust SECURITY.md if you choose
a different reporting channel. Verify the first CI run before creating a release.

To publish a release after checking the code and CI:

```sh
make package
python3 tools/check_release.py
git tag v0.1.0
git push origin v0.1.0
```

Attach the two zip files from `dist/` and `dist/SHA256SUMS` to a GitHub release.
The extension zip contains only the Shell extension. The source zip contains
the complete project and Nautilus installer. This repository deliberately has
no workflow that automatically publishes a release or contacts other projects.

The workflow uses no repository secrets and requests read-only contents access.
No GitHub account, repository owner, sponsorship link or screenshot of a personal
desktop has been invented for this source package.
