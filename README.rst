===
jig
===

Github has an post-commit hooks for both IRC and HTTP, so why on earth would I
write another one?

1. Github's hooks cannot be filtered by branch. e.g., if I only want pushes to
   ``master`` to trigger builds in CI, I'm SOL there. (Jenkins/Hudson doesn't do
   this either: any branch will trigger the build, even if the branch built
   didn't change.)

2. Jenkins really wants you to make GET requests to trigger builds, and Github
   (correctly) wants to make POSTs.

So **jig** is my little tool to run an HTTP server, accept Github's
post-receive data, *filter by branch*, push the relevant info to IRC, then
trigger a build in Jenkins.

In the spirit of open-source, and because other people may find it useful, I'm
sharing jig here. I'd like to expand on what sort of project reporting it does
in the future, too.
