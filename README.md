# air-traffic-control
private web interface for running forge playbooks

## Install
```
npm install
```

## start server
```
node app.js
```

## update conifg.js
change `REPOSITORY_HOME` to the directory containing your `playbook-*` forge ready repos.  ATC will filter for playbooks by folder name automaticly.

## open site
```
http://localhost:3000
```