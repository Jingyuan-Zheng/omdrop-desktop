# Publishing and releases

The canonical repository is [Jingyuan-Zheng/omdrop-desktop](https://github.com/Jingyuan-Zheng/omdrop-desktop),
with development on `main`. Use this project directory only, not a parent
workspace containing local installations or runtime data.

## Publishing a fork or a new copy

1. Review README.md, NOTICE.md, supported versions and the generated packages.
2. Set your desired Git author identity for future commits. If you want to
   replace the neutral preparation author on the initial commit, configure
   `user.name` and `user.email`, then run `git commit --amend --reset-author --no-edit`.
3. Create an **empty** GitHub repository. Do not initialize it with a separate
   README or license. Choose a name and update project URLs if publishing a fork.
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
README screenshots are generated from the real UI in an isolated session using
offline demonstration data. They contain no personal desktop content. To
regenerate them on GNOME 46, set `OMDROP_DEMO_DIR` to an absolute output directory,
set `LANGUAGE=en_IE`, then run `sh scripts/test-shell.sh`. Review both PNGs before
committing them. The screenshot harness is not shipped in the Shell extension.
