# air-traffic-control
private web interface for running forge playbooks

## Install
```
npm install
```

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