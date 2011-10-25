==============
Installing Jig
==============

Installing Jig is *mostly* very simple, with one temporary complication.


Installation
============

First you'll want to clone the repo, or otherwise get the source::

    $ git clone https://github.com/jsocol/jig
    $ cd jig

Run ``npm install .`` to pull in the dependencies::

    $ npm install .

Now here's the tricky bit: until a pull request gets merged, you need to use my
fork of node-github_, which implements part of the API that isn't in the main
repo yet.

This is what I did, you can probably do better::

    $ cd node_modules
    $ mv github/node_modules ./
    $ rm -rf github
    $ git clone https://github.com/jsocol/node-github github
    $ mv node_modules github/
    $ cd ..

That should do it!

Once that pull-req_ gets merged, things will be much simpler.


Configuring
===========

Before you can run Jig, you'll need to configure it. I know, it stinks. But
there were too many options for pure CLI config.

Copy ``example.config.ini``, maybe to ``config.ini``, and edit it. There are
comments inline to help.


Running
=======

Ah, the easy part! Once you have a ``config.ini`` file::

    $ node jig.js

If your config file isn't called ``config.ini`` or is in another location, you
can do::

    $ node jig.js --config=/path/to/config/file.ini

I recommend setting it up to run with supervisor, or configuring Jig to
daemonize itself. Running in a detached screen session works, too.


.. _node-github: https://github.com/jsocol/node-github
.. _pull-req: https://github.com/ajaxorg/node-github/pull/20
