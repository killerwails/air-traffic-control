# air-traffic-control
private web interface for running forge playbooks

## Install

NOTE : You need to have [node](https://nodejs.org/download/) installed.
- clone the repo
- navigate into the air-traffic-control directory
- `npm install`

## update conifg.js
Change `REPOSITORY_HOME` to the directory containing your `playbook-*` forge ready repos.  ATC will filter for playbooks by folder name automaticly.

Change `USERID` to your user on the remote server.  You should have your keys in your keychain.

## start server
```
node app.js
```

## open site
```
http://localhost:3000
```
