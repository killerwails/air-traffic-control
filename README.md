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

## setup aws access
You should have your aws keys at `~/.aws`
```
export AWS_ACCESS_KEY_ID=REDACT
export AWS_SECRET_ACCESS_KEY=REDACT
```
and `~/.boto`
```
[Credentials]
aws_access_key_id = REDACT
aws_secret_access_key = REDACT
```
.boto is read by ansible automaticly however you do need to reference your ~/.aws file:
```
source ~/.aws
```

## start server
```
node air-traffic-control.js
```

## open site
```
http://localhost:3000
```
